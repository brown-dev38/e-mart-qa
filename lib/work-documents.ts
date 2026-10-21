import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import { getWorkFlow } from "./department-workflow";
import type { WorkDocumentScope, WorkDocumentResult } from "@/types/academic";
import type { SaveResult } from "@/types/master-data";

const uploadDirectory = path.join(process.cwd(), "public", "uploads", "work-documents");
class InputError extends Error {}
function id(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 4_294_967_295) throw new InputError("กรุณาเลือกข้อมูลให้ครบถ้วน");
  return value;
}

export async function resolveWorkScope(scope: WorkDocumentScope) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope) ||
    [scope.programCode, scope.departmentCode, scope.subDepartmentCode].some((value) => typeof value !== "string" || !value.trim() || value.length > 20)) throw new InputError("เงื่อนไขการเลือกเอกสารไม่ถูกต้อง");
  const [program, job] = await Promise.all([
    prisma.docs_programs.findUnique({ where: { code: scope.programCode }, include: { framework: true } }),
    prisma.docs_sub_departments.findFirst({ where: { code: scope.subDepartmentCode, department: { code: scope.departmentCode } }, include: { department: true } }),
  ]);
  if (!program?.is_active || !program.framework.is_active || !job?.is_active || !job.department.is_active || !job.department.has_sub_department) throw new InputError("หลักสูตรหรือประเภทงานถูกปิดใช้งานหรือไม่พบข้อมูล");
  const workflow = getWorkFlow(job.document_workflow, program.framework.code);
  if (!workflow || workflow.types.length === 0) throw new InputError("ประเภทงานนี้ยังไม่มีรูปแบบเอกสารที่รองรับ");

  let academicYearId: number | null = null;
  let curriculumVersionId: number | null = null;
  let courseOfferingId: number | null = null;
  if (workflow.mode === "version") {
    if (scope.academicYearId != null || scope.courseOfferingId != null) throw new InputError("ฉบับหลักสูตรไม่ใช้ปีการศึกษาหรือรายวิชา");
    const version = await prisma.docs_curriculum_versions.findUnique({ where: { id: id(scope.curriculumVersionId) } });
    if (!version?.is_active || version.program_id !== program.id) throw new InputError("ฉบับหลักสูตรไม่อยู่ภายใต้หลักสูตรที่เลือก");
    curriculumVersionId = version.id;
  } else {
    if (scope.curriculumVersionId != null) throw new InputError("ประเภทงานนี้ไม่ใช้ฉบับหลักสูตร");
    const year = await prisma.docs_academic_years.findUnique({ where: { id: id(scope.academicYearId) } });
    if (!year?.is_active) throw new InputError("ไม่พบปีการศึกษาที่เปิดใช้งาน");
    academicYearId = year.id;
    if (workflow.mode === "course") {
      const offering = await prisma.docs_course_offerings.findUnique({
        where: { id: id(scope.courseOfferingId) }, include: { course: true, semester: true, study_year: true },
      });
      if (!offering?.is_active || !offering.course.is_active || !offering.semester.is_active || !offering.study_year.is_active || offering.course.program_id !== program.id || offering.academic_year_id !== year.id) throw new InputError("รายวิชาไม่ตรงกับหลักสูตรหรือปีการศึกษาที่เลือก หรือถูกปิดใช้งาน");
      courseOfferingId = offering.id;
    } else if (scope.courseOfferingId != null) throw new InputError("ประเภทงานนี้ไม่ใช้รายวิชา");
  }
  return {
    workflow,
    where: { department_id: job.department_id, sub_department_id: job.id, program_id: program.id, academic_year_id: academicYearId, curriculum_version_id: curriculumVersionId, course_offering_id: courseOfferingId },
  };
}

function errorResult(error: unknown): { ok: false; error: string } {
  if (error instanceof InputError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "ดำเนินการกับเอกสารไม่สำเร็จ กรุณาลองใหม่" };
}

export async function listWorkDocuments(scope: WorkDocumentScope, userId: string, isAdmin: boolean): Promise<WorkDocumentResult> {
  try {
    const { where } = await resolveWorkScope(scope);
    const rows = await prisma.docs_work_documents.findMany({ where, orderBy: [{ created_at: "desc" }, { id: "desc" }] });
    return { ok: true, documents: rows.map((row) => ({
      id: String(row.id), documentType: row.document_type, title: row.title,
      fileName: row.file_name, filePath: row.file_path, fileSize: String(row.file_size_bytes),
      createdAt: row.created_at.toISOString(), canDelete: isAdmin || row.created_by === userId,
    })) };
  } catch (error) { return errorResult(error); }
}

export async function saveWorkDocument(formData: FormData, userId: string): Promise<SaveResult> {
  let storedFile: string | null = null;
  try {
    const rawScope = formData.get("scope");
    if (typeof rawScope !== "string" || rawScope.length > 2000) throw new InputError("ข้อมูลการเลือกเอกสารไม่ถูกต้อง");
    let scope: WorkDocumentScope;
    try { scope = JSON.parse(rawScope); } catch { throw new InputError("ข้อมูลการเลือกเอกสารไม่ถูกต้อง"); }
    const { where, workflow } = await resolveWorkScope(scope);
    const documentType = formData.get("documentType");
    const type = workflow.types.find((item) => item.code === documentType);
    if (!type) throw new InputError("ประเภทเอกสารไม่ตรงกับงานหรือกรอบเกณฑ์ของหลักสูตร");
    const rawTitle = formData.get("title");
    const title = typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : type.label;
    if (title.length > 500) throw new InputError("ชื่อเอกสารต้องไม่เกิน 500 ตัวอักษร");
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) throw new InputError("กรุณาเลือกไฟล์เอกสาร");
    if (file.size > 20 * 1024 * 1024) throw new InputError("ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
    const extension = path.extname(file.name).toLowerCase();
    if (![".pdf", ".doc", ".docx", ".xls", ".xlsx"].includes(extension)) throw new InputError("รองรับไฟล์ PDF, Word และ Excel");
    await mkdir(uploadDirectory, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    storedFile = path.join(uploadDirectory, filename);
    await writeFile(storedFile, Buffer.from(await file.arrayBuffer()));
    await prisma.docs_work_documents.create({ data: {
      ...where, document_type: type.code, title, file_path: `/uploads/work-documents/${filename}`,
      file_name: path.basename(file.name).slice(0, 255), file_size_bytes: BigInt(file.size), created_by: userId,
    } });
    return { ok: true };
  } catch (error) {
    if (storedFile) await unlink(storedFile).catch(() => undefined);
    return errorResult(error);
  }
}

export async function deleteWorkDocument(rawId: string, userId: string, isAdmin: boolean): Promise<SaveResult> {
  try {
    if (typeof rawId !== "string" || !/^\d{1,20}$/.test(rawId) || BigInt(rawId) > BigInt("18446744073709551615")) throw new InputError("รหัสเอกสารไม่ถูกต้อง");
    const document = await prisma.docs_work_documents.findFirst({ where: { id: BigInt(rawId), ...(isAdmin ? {} : { created_by: userId }) } });
    if (!document) throw new InputError("ไม่พบเอกสาร หรือคุณไม่มีสิทธิ์ลบรายการนี้");
    await prisma.docs_work_documents.delete({ where: { id: document.id } });
    const file = path.resolve(uploadDirectory, path.basename(document.file_path));
    if (path.dirname(file) === uploadDirectory) await unlink(file).catch(() => undefined);
    return { ok: true };
  } catch (error) { return errorResult(error); }
}

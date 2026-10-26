import { prisma } from "./prisma";
import { storeQualityFile, removeQualityFile } from "./quality-document-files";
import { qualityActor } from "./quality-document-workflow";
import { writeAudit } from "./audit-log";
import type { DocumentSaveResult } from "@/types/quality-document";
import { requiresDocumentCriterion } from "./quality-document-catalog";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

class SequenceExhausted extends Error {}

export async function saveQualityDocument(
  formData: FormData,
  userId: string,
): Promise<DocumentSaveResult> {
  await qualityActor(userId);
  const departmentCode = field(formData, "department").toUpperCase();
  const jobCode = field(formData, "job").toUpperCase();
  const programCode = field(formData, "program").toUpperCase();
  const levelCode = field(formData, "level").toUpperCase();
  const needsCriterion = requiresDocumentCriterion(levelCode);
  const criterionCode = needsCriterion ? field(formData, "criterion").toUpperCase() : "";
  const title = field(formData, "title");
  const description = field(formData, "description");

  if (!departmentCode || !programCode || !levelCode || (needsCriterion && !criterionCode)) {
    return { ok: false, error: "ข้อมูลสำหรับออกรหัสเอกสารไม่ครบถ้วน" };
  }
  if (!title) {
    return { ok: false, error: "กรุณาระบุชื่อเอกสาร" };
  }
  if (title.length > 500) {
    return { ok: false, error: "ชื่อเอกสารต้องไม่เกิน 500 ตัวอักษร" };
  }
  if (description.length > 2000) {
    return { ok: false, error: "คำอธิบายต้องไม่เกิน 2,000 ตัวอักษร" };
  }
  const [department, program, level] = await Promise.all([
    prisma.docs_departments.findUnique({ where: { code: departmentCode } }),
    prisma.docs_programs.findUnique({ where: { code: programCode } }),
    prisma.docs_document_levels.findUnique({ where: { code: levelCode } }),
  ]);

  if (!department || !department.is_active) {
    return { ok: false, error: "ไม่พบหน่วยงานหลักที่เลือก หรือถูกปิดใช้งานแล้ว" };
  }
  if (!program || !program.is_active) {
    return { ok: false, error: "ไม่พบหลักสูตรที่เลือก หรือถูกปิดใช้งานแล้ว" };
  }
  if (!level || !level.is_active) {
    return { ok: false, error: "ไม่พบระดับเอกสารที่เลือก หรือถูกปิดใช้งานแล้ว" };
  }

  let subDepartment = null;
  if (department.has_sub_department) {
    if (!jobCode) {
      return { ok: false, error: "กรุณาเลือกงานย่อยของหน่วยงาน" };
    }
    subDepartment = await prisma.docs_sub_departments.findUnique({
      where: {
        department_id_code: {
          department_id: department.id,
          code: jobCode,
        },
      },
    });
    if (!subDepartment || !subDepartment.is_active) {
      return { ok: false, error: "ไม่พบงานย่อยที่เลือก หรือถูกปิดใช้งานแล้ว" };
    }
  } else if (jobCode) {
    return { ok: false, error: "หน่วยงานที่เลือกไม่มีงานย่อย" };
  }

  const criterion = needsCriterion ? await prisma.docs_qa_criteria.findUnique({
    where: {
      framework_id_code: {
        framework_id: program.framework_id,
        code: criterionCode,
      },
    },
  }) : null;
  if (needsCriterion && (!criterion || !criterion.is_active)) {
    return { ok: false, error: "ไม่พบเกณฑ์ที่เลือก หรือถูกปิดใช้งานแล้ว" };
  }
  if (criterion && !criterion.is_selectable) {
    return {
      ok: false,
      error: "เกณฑ์ที่เลือกเป็นเพียงหัวข้อกลุ่ม ไม่สามารถผูกเอกสารได้",
    };
  }

  const codePrefix = [
    department.code,
    ...(subDepartment ? [subDepartment.code] : []),
    program.code,
    level.code,
    ...(criterion ? [criterion.code] : []),
  ].join("-");

  let fileData: Awaited<ReturnType<typeof storeQualityFile>> = null;
  let saved: { documentCode: string; documentId: string };
  try {
    fileData = await storeQualityFile(formData.get("file"));
    saved = await prisma.$transaction(async tx => {
      // Lock a stable parent even when this group has no documents yet.
      // Read Committed ensures a waiting request sees the previous allocation.
      await tx.$queryRaw`SELECT id FROM docs_departments WHERE id = ${department.id} FOR UPDATE`;
      const actor = await qualityActor(userId, tx);
      const existing = await tx.docs_qa_documents.findMany({
        where: { OR: [
          {
            department_id: department.id,
            sub_department_id: subDepartment?.id ?? null,
            program_id: program.id,
            document_level_id: level.id,
            criterion_id: criterion?.id ?? null,
          },
          { document_code: { startsWith: `${codePrefix}-` } },
        ] },
        select: {
          sequence_no: true, document_code: true, department_id: true,
          sub_department_id: true, program_id: true, document_level_id: true, criterion_id: true,
        },
      });
      let highest = 0;
      for (const row of existing) {
        const suffix = row.document_code.startsWith(`${codePrefix}-`)
          ? row.document_code.slice(codePrefix.length + 1) : "";
        const sameGroup = row.department_id === department.id &&
          row.sub_department_id === (subDepartment?.id ?? null) &&
          row.program_id === program.id && row.document_level_id === level.id && row.criterion_id === (criterion?.id ?? null);
        for (const value of [sameGroup ? row.sequence_no : null, suffix]) {
          if (value && /^\d{1,10}$/.test(value)) highest = Math.max(highest, Number(value));
        }
      }
      if (highest >= 999) throw new SequenceExhausted("ลำดับเอกสารในกลุ่มนี้ครบ 999 แล้ว กรุณาติดต่อผู้ดูแลระบบ");
      const sequence = String(highest + 1).padStart(3, "0");
      const allocatedCode = `${codePrefix}-${sequence}`;
      const created = await tx.docs_qa_documents.create({
        data: {
          document_code: allocatedCode,
          sequence_no: sequence,
          title,
          description: description || null,
          department_id: department.id,
          sub_department_id: subDepartment?.id ?? null,
          program_id: program.id,
          document_level_id: level.id,
          criterion_id: criterion?.id ?? null,
          current_version: null,
          status: "DRAFT",
          created_by: userId,
          revisions: { create: {
            version_label: "DRAFT", status: "DRAFT", open_slot: 1,
            title, description: description || null, uploaded_by: userId,
            ...fileData,
            events: { create: { action: "CREATE", actor_id: actor.id, actor_name: actor.name } },
          } },
        },
      });
      await writeAudit(tx, actor, {
        action: "CREATE", entityType: "QUALITY_DOCUMENT", entityId: String(created.id),
        entityLabel: allocatedCode, summary: `เพิ่มเอกสารคุณภาพ: ${title}`, details: { title, version: "000" },
      });
      return { documentCode: allocatedCode, documentId: String(created.id) };
    }, { isolationLevel: "ReadCommitted" });
  } catch (error) {
    if (fileData) await removeQualityFile(fileData.file_path);
    if (error instanceof SequenceExhausted) return { ok: false, error: error.message };
    if ((error as { code?: string }).code === "P2002") {
      return {
        ok: false,
        error: "มีการออกรหัสเอกสารพร้อมกัน กรุณาลองบันทึกอีกครั้ง ระบบจะกำหนดลำดับใหม่ให้",
      };
    }
    if (error instanceof Error && /ไฟล์|รองรับเฉพาะ/.test(error.message)) return { ok: false, error: error.message };
    console.error("[quality-document-save] Unexpected save failure", error);
    return { ok: false, error: "บันทึกเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  return { ok: true, ...saved };
}

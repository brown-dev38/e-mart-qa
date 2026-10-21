import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import type { DocumentSaveResult } from "@/types/quality-document";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx"]);
const UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "qa-documents",
);

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveQualityDocument(
  formData: FormData,
  userId: string,
): Promise<DocumentSaveResult> {
  const departmentCode = field(formData, "department").toUpperCase();
  const jobCode = field(formData, "job").toUpperCase();
  const programCode = field(formData, "program").toUpperCase();
  const levelCode = field(formData, "level").toUpperCase();
  const criterionCode = field(formData, "criterion").toUpperCase();
  const sequence = field(formData, "sequence");
  const title = field(formData, "title");
  const description = field(formData, "description");

  if (!departmentCode || !programCode || !levelCode || !criterionCode) {
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
  if (!/^\d{1,3}$/.test(sequence)) {
    return { ok: false, error: "ลำดับเอกสารต้องเป็นตัวเลข 0–999" };
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

  const criterion = await prisma.docs_qa_criteria.findUnique({
    where: {
      framework_id_code: {
        framework_id: program.framework_id,
        code: criterionCode,
      },
    },
  });
  if (!criterion || !criterion.is_active) {
    return { ok: false, error: "ไม่พบเกณฑ์ที่เลือก หรือถูกปิดใช้งานแล้ว" };
  }
  if (!criterion.is_selectable) {
    return {
      ok: false,
      error: "เกณฑ์ที่เลือกเป็นเพียงหัวข้อกลุ่ม ไม่สามารถผูกเอกสารได้",
    };
  }

  const documentCode = [
    department.code,
    ...(subDepartment ? [subDepartment.code] : []),
    program.code,
    level.code,
    criterion.code,
    sequence.padStart(3, "0"),
  ].join("-");

  let storedFilePath: string | null = null;
  let fileData: {
    file_path: string;
    file_name: string;
    file_mime_type: string | null;
    file_size_bytes: bigint;
  } | null = null;

  const fileEntry = formData.get("file");
  if (fileEntry instanceof File && fileEntry.size > 0) {
    if (fileEntry.size > MAX_FILE_BYTES) {
      return { ok: false, error: "ไฟล์ต้องมีขนาดไม่เกิน 20 MB" };
    }
    const extension = path.extname(fileEntry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return { ok: false, error: "รองรับเฉพาะไฟล์ PDF, Word และ Excel" };
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const storageName = `${randomUUID()}${extension}`;
    storedFilePath = path.join(UPLOAD_DIR, storageName);
    await writeFile(storedFilePath, Buffer.from(await fileEntry.arrayBuffer()));

    fileData = {
      file_path: `/uploads/qa-documents/${storageName}`,
      file_name: fileEntry.name.slice(0, 255),
      file_mime_type: fileEntry.type ? fileEntry.type.slice(0, 100) : null,
      file_size_bytes: BigInt(fileEntry.size),
    };
  }

  try {
    await prisma.docs_qa_documents.create({
      data: {
        document_code: documentCode,
        sequence_no: sequence.padStart(3, "0"),
        title,
        description: description || null,
        department_id: department.id,
        sub_department_id: subDepartment?.id ?? null,
        program_id: program.id,
        document_level_id: level.id,
        criterion_id: criterion.id,
        current_version: "1.0",
        status: "DRAFT",
        created_by: userId,
        ...fileData,
      },
    });
  } catch (error) {
    if (storedFilePath) {
      await unlink(storedFilePath).catch(() => undefined);
    }
    if ((error as { code?: string }).code === "P2002") {
      return {
        ok: false,
        error: `รหัสเอกสาร ${documentCode} มีอยู่ในระบบแล้ว กรุณาเปลี่ยนลำดับเอกสาร`,
      };
    }
    console.error(error);
    return { ok: false, error: "บันทึกเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  return { ok: true, documentCode };
}

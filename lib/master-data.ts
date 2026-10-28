import { prisma } from "@/lib/prisma";
import { loadAcademicData, isAcademicEntity, saveAcademicRecord, deleteAcademicRecord } from "./academic-data";
import type { DocumentWorkflow } from "@/types/academic";
import type {
  MasterData,
  MasterEntity,
  MasterRecordInput,
  SaveResult,
  WfmeStandardType,
} from "@/types/master-data";

const WFME_STANDARD_TYPES: WfmeStandardType[] = [
  "NONE",
  "BASIC",
  "QUALITY_DEV",
];

class InputError extends Error {}

function text(
  value: unknown,
  label: string,
  max: number,
  required = true,
): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    if (required) throw new InputError(`กรุณากรอก${label}`);
    return "";
  }
  if (raw.length > max) {
    throw new InputError(`${label}ต้องไม่เกิน ${max} ตัวอักษร`);
  }
  return raw;
}

function optionalText(
  value: unknown,
  label: string,
  max: number,
): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (raw.length > max) {
    throw new InputError(`${label}ต้องไม่เกิน ${max} ตัวอักษร`);
  }
  return raw;
}

function intValue(
  value: unknown,
  label: string,
  min = 0,
  max = 4_294_967_295,
): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new InputError(`${label}ไม่ถูกต้อง`);
  }
  return num;
}

function optionalId(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  return intValue(value, label, 1);
}

function boolValue(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

function recordId(input: MasterRecordInput): number | null {
  return optionalId(input.id, "รหัสข้อมูล");
}

function friendlyError(error: unknown): string {
  if (error instanceof InputError) return error.message;
  const code = (error as { code?: string }).code;
  if (code === "P2002") return "รหัสนี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น";
  if (code === "P2003") {
    return "ไม่สามารถดำเนินการได้ เนื่องจากมีข้อมูลอื่นอ้างอิงรายการนี้อยู่";
  }
  if (code === "P2025") return "ไม่พบข้อมูลที่ต้องการ";
  console.error(error);
  return "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export async function loadMasterData(): Promise<MasterData> {
  const [
    departments,
    sub_departments,
    frameworks,
    programs,
    document_levels,
    criteria,
  ] = await Promise.all([
    prisma.docs_departments.findMany({
      select: {
        id: true,
        code: true,
        name_th: true,
        name_en: true,
        has_sub_department: true,
        sort_order: true,
        is_active: true,
      },
      orderBy: [{ sort_order: "asc" }, { code: "asc" }],
    }),
    prisma.docs_sub_departments.findMany({
      select: {
        document_workflow: true,
        id: true,
        department_id: true,
        code: true,
        name_th: true,
        name_en: true,
        sort_order: true,
        is_active: true,
      },
      orderBy: [{ sort_order: "asc" }, { code: "asc" }],
    }),
    prisma.docs_accreditation_frameworks.findMany({
      select: {
        id: true,
        code: true,
        prefix_char: true,
        name_th: true,
        name_en: true,
        version_year: true,
        is_active: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.docs_programs.findMany({
      select: {
        id: true,
        code: true,
        name_th: true,
        name_en: true,
        framework_id: true,
        is_active: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.docs_document_levels.findMany({
      select: {
        id: true,
        code: true,
        name_th: true,
        name_en: true,
        level_order: true,
        is_active: true,
      },
      orderBy: { level_order: "asc" },
    }),
    prisma.docs_qa_criteria.findMany({
      select: {
        id: true,
        framework_id: true,
        parent_id: true,
        code: true,
        section_number: true,
        level_depth: true,
        wfme_standard_type: true,
        title_th: true,
        title_en: true,
        description_th: true,
        is_selectable: true,
        sort_order: true,
        is_active: true,
      },
      orderBy: [
        { framework_id: "asc" },
        { level_depth: "asc" },
        { sort_order: "asc" },
        { code: "asc" },
      ],
    }),
  ]);

  return {
    ...await loadAcademicData(),
    departments,
    sub_departments,
    frameworks,
    programs,
    document_levels,
    criteria,
  };
}

async function requireDepartment(id: number) {
  const record = await prisma.docs_departments.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!record) throw new InputError("ไม่พบหน่วยงานหลักที่เลือก");
}

async function requireFramework(id: number) {
  const record = await prisma.docs_accreditation_frameworks.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!record) throw new InputError("ไม่พบกรอบเกณฑ์ที่เลือก");
}

async function requireParentCriterion(
  parentId: number,
  frameworkId: number,
  editingId: number | null,
) {
  const parent = await prisma.docs_qa_criteria.findUnique({
    where: { id: parentId },
    select: { id: true, framework_id: true, parent_id: true },
  });
  if (!parent) throw new InputError("ไม่พบเกณฑ์แม่ที่เลือก");
  if (parent.framework_id !== frameworkId) {
    throw new InputError("เกณฑ์แม่ต้องอยู่ภายใต้กรอบเกณฑ์เดียวกัน");
  }
  if (editingId !== null && parent.id === editingId) {
    throw new InputError("ไม่สามารถเลือกเกณฑ์ตัวเองเป็นเกณฑ์แม่ได้");
  }

  const seen = new Set<number>([parent.id]);
  let cursorParentId = parent.parent_id;
  while (cursorParentId !== null && !seen.has(cursorParentId)) {
    if (editingId !== null && cursorParentId === editingId) {
      throw new InputError("ไม่สามารถเลือกเกณฑ์ลูกเป็นเกณฑ์แม่ได้");
    }
    seen.add(cursorParentId);
    const next = await prisma.docs_qa_criteria.findUnique({
      where: { id: cursorParentId },
      select: { parent_id: true },
    });
    cursorParentId = next?.parent_id ?? null;
  }
}

export async function saveMasterRecord(
  entity: MasterEntity,
  input: MasterRecordInput,
): Promise<SaveResult> {
  if (isAcademicEntity(entity)) return saveAcademicRecord(entity, input);
  try {
    const id = recordId(input);

    switch (entity) {
      case "departments": {
        const data = {
          code: text(input.code, "รหัสหน่วยงาน", 20).toUpperCase(),
          name_th: text(input.name_th, "ชื่อหน่วยงาน (ไทย)", 150),
          name_en: optionalText(input.name_en, "ชื่อหน่วยงาน (อังกฤษ)", 150),
          has_sub_department: boolValue(input.has_sub_department),
          sort_order: intValue(input.sort_order ?? 0, "ลำดับการแสดงผล"),
          is_active: boolValue(input.is_active, true),
        };
        if (id !== null) {
          await prisma.docs_departments.update({ where: { id }, data });
        } else {
          await prisma.docs_departments.create({ data });
        }
        break;
      }

      case "sub_departments": {
        const workflow = input.document_workflow == null || input.document_workflow === "" ? null : String(input.document_workflow);
        if (workflow !== null && !["QAS", "CUR", "TCH", "ASM", "ADM", "STU"].includes(workflow)) throw new InputError("รูปแบบเอกสารไม่ถูกต้อง");
        const departmentId = intValue(
          input.department_id,
          "หน่วยงานหลัก",
          1,
        );
        await requireDepartment(departmentId);
        const data = {
          department_id: departmentId,
          document_workflow: input.document_workflow === undefined ? undefined : workflow as DocumentWorkflow | null,
          code: text(input.code, "รหัสงานย่อย", 20).toUpperCase(),
          name_th: text(input.name_th, "ชื่องานย่อย (ไทย)", 150),
          name_en: optionalText(input.name_en, "ชื่องานย่อย (อังกฤษ)", 150),
          sort_order: intValue(input.sort_order ?? 0, "ลำดับการแสดงผล"),
          is_active: boolValue(input.is_active, true),
        };
        if (id !== null) {
          const previous = await prisma.docs_sub_departments.findUniqueOrThrow({ where: { id } });
          if ((previous.department_id !== data.department_id ||
            (data.document_workflow !== undefined && previous.document_workflow !== data.document_workflow)) &&
            await prisma.docs_work_documents.count({ where: { sub_department_id: id } })) {
            throw new InputError("งานย่อยนี้มีเอกสารแล้ว ไม่สามารถย้ายหน่วยงานหรือเปลี่ยนรูปแบบเอกสารได้");
          }
          await prisma.docs_sub_departments.update({ where: { id }, data });
        } else {
          await prisma.docs_sub_departments.create({ data });
        }
        break;
      }

      case "frameworks": {
        const data = {
          code: text(input.code, "รหัสกรอบเกณฑ์", 20).toUpperCase(),
          prefix_char: text(input.prefix_char, "ตัวอักษรนำหน้า", 5).toUpperCase(),
          name_th: text(input.name_th, "ชื่อกรอบเกณฑ์ (ไทย)", 150),
          name_en: optionalText(input.name_en, "ชื่อกรอบเกณฑ์ (อังกฤษ)", 150),
          version_year: optionalText(input.version_year, "ปี/รุ่นของเกณฑ์", 20),
          is_active: boolValue(input.is_active, true),
        };
        if (id !== null) {
          await prisma.docs_accreditation_frameworks.update({
            where: { id },
            data,
          });
        } else {
          await prisma.docs_accreditation_frameworks.create({ data });
        }
        break;
      }

      case "programs": {
        const frameworkId = intValue(input.framework_id, "กรอบเกณฑ์", 1);
        await requireFramework(frameworkId);
        const data = {
          code: text(input.code, "รหัสหลักสูตร", 20).toUpperCase(),
          name_th: text(input.name_th, "ชื่อหลักสูตร (ไทย)", 200),
          name_en: optionalText(input.name_en, "ชื่อหลักสูตร (อังกฤษ)", 200),
          framework_id: frameworkId,
          is_active: boolValue(input.is_active, true),
        };
        if (id !== null) {
          await prisma.docs_programs.update({ where: { id }, data });
        } else {
          await prisma.docs_programs.create({ data });
        }
        break;
      }

      case "document_levels": {
        const data = {
          code: text(input.code, "รหัสระดับเอกสาร", 10).toUpperCase(),
          name_th: text(input.name_th, "ชื่อระดับเอกสาร (ไทย)", 100),
          name_en: optionalText(input.name_en, "ชื่อระดับเอกสาร (อังกฤษ)", 100),
          level_order: intValue(input.level_order ?? 1, "ลำดับชั้นเอกสาร", 1, 255),
          is_active: boolValue(input.is_active, true),
        };
        if (id !== null) {
          await prisma.docs_document_levels.update({ where: { id }, data });
        } else {
          await prisma.docs_document_levels.create({ data });
        }
        break;
      }

      case "criteria": {
        const frameworkId = intValue(input.framework_id, "กรอบเกณฑ์", 1);
        await requireFramework(frameworkId);
        const parentId = optionalId(input.parent_id, "เกณฑ์แม่");
        if (parentId !== null) {
          await requireParentCriterion(parentId, frameworkId, id);
        }
        const standardType = String(
          input.wfme_standard_type ?? "NONE",
        ) as WfmeStandardType;
        if (!WFME_STANDARD_TYPES.includes(standardType)) {
          throw new InputError("ประเภทมาตรฐาน WFME ไม่ถูกต้อง");
        }
        const data = {
          framework_id: frameworkId,
          parent_id: parentId,
          code: text(input.code, "รหัสเกณฑ์", 30).toUpperCase(),
          section_number: text(input.section_number, "เลขข้อเกณฑ์", 20),
          level_depth: intValue(input.level_depth ?? 1, "ระดับชั้น", 1, 3),
          wfme_standard_type: standardType,
          title_th: text(input.title_th, "ชื่อหัวข้อเกณฑ์ (ไทย)", 500),
          title_en: optionalText(input.title_en, "ชื่อหัวข้อเกณฑ์ (อังกฤษ)", 500),
          description_th: optionalText(
            input.description_th,
            "คำอธิบายเกณฑ์",
            20_000,
          ),
          is_selectable: boolValue(input.is_selectable, true),
          sort_order: intValue(input.sort_order ?? 0, "ลำดับการแสดงผล"),
          is_active: boolValue(input.is_active, true),
        };
        if (id !== null) {
          await prisma.docs_qa_criteria.update({ where: { id }, data });
        } else {
          await prisma.docs_qa_criteria.create({ data });
        }
        break;
      }

      default:
        throw new InputError("ไม่พบประเภทข้อมูลที่ต้องการบันทึก");
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function deleteMasterRecord(
  entity: MasterEntity,
  rawId: unknown,
): Promise<SaveResult> {
  try {
    const id = intValue(rawId, "รหัสข้อมูล", 1);
    if (isAcademicEntity(entity)) {
      await deleteAcademicRecord(entity, id);
      return { ok: true };
    }
    switch (entity) {
      case "departments":
        await prisma.docs_departments.delete({ where: { id } });
        break;
      case "sub_departments":
        await prisma.docs_sub_departments.delete({ where: { id } });
        break;
      case "frameworks":
        await prisma.docs_accreditation_frameworks.delete({ where: { id } });
        break;
      case "programs":
        await prisma.docs_programs.delete({ where: { id } });
        break;
      case "document_levels":
        await prisma.docs_document_levels.delete({ where: { id } });
        break;
      case "criteria":
        await prisma.docs_qa_criteria.delete({ where: { id } });
        break;
      default:
        throw new InputError("ไม่พบประเภทข้อมูลที่ต้องการลบ");
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

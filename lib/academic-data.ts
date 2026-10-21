import { prisma } from "./prisma";
import { ACADEMIC_ENTITIES, type AcademicData, type AcademicEntity } from "@/types/academic";
import type { MasterRecordInput, SaveResult } from "@/types/master-data";

export function isAcademicEntity(value: string): value is AcademicEntity {
  return (ACADEMIC_ENTITIES as readonly string[]).includes(value);
}

export async function loadAcademicData(): Promise<AcademicData> {
  const [academic_years, semesters, study_years, curriculum_versions, courses, course_offerings] = await Promise.all([
    prisma.docs_academic_years.findMany({ orderBy: { year: "desc" } }),
    prisma.docs_semesters.findMany({ orderBy: [{ sort_order: "asc" }, { code: "asc" }] }),
    prisma.docs_study_years.findMany({ orderBy: { year: "asc" } }),
    prisma.docs_curriculum_versions.findMany({ orderBy: [{ program_id: "asc" }, { year: "asc" }] }),
    prisma.docs_courses.findMany({ orderBy: { code: "asc" } }),
    prisma.docs_course_offerings.findMany({ orderBy: { id: "asc" } }),
  ]);
  return { academic_years, semesters, study_years, curriculum_versions, courses, course_offerings };
}

class InputError extends Error {}
function integer(value: unknown, label: string, min = 1, max = 4_294_967_295) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new InputError(`${label}ไม่ถูกต้อง`);
  return number;
}
function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new InputError(`${label}ไม่ถูกต้อง (ไม่เกิน ${max} ตัวอักษร)`);
  return value.trim();
}

export async function saveAcademicRecord(entity: AcademicEntity, input: MasterRecordInput): Promise<SaveResult> {
  try {
    const id = input.id == null ? null : integer(input.id, "รหัสรายการ");
    const is_active = input.is_active === undefined || input.is_active === true;
    switch (entity) {
      case "academic_years": {
        const data = { year: integer(input.year, "ปีการศึกษา พ.ศ.", 2400, 3000), is_active };
        if (id) await prisma.docs_academic_years.update({ where: { id }, data });
        else await prisma.docs_academic_years.create({ data });
        break;
      }
      case "semesters": {
        const data = { code: text(input.code, "รหัสภาคการศึกษา", 20).toUpperCase(), name_th: text(input.name_th, "ชื่อภาคการศึกษา", 100), sort_order: integer(input.sort_order ?? 0, "ลำดับ", 0), is_active };
        if (id) await prisma.docs_semesters.update({ where: { id }, data });
        else await prisma.docs_semesters.create({ data });
        break;
      }
      case "study_years": {
        const data = { year: integer(input.year, "ชั้นปี", 1, 20), is_active };
        if (id) await prisma.docs_study_years.update({ where: { id }, data });
        else await prisma.docs_study_years.create({ data });
        break;
      }
      case "curriculum_versions": {
        const data = { program_id: integer(input.program_id, "หลักสูตร"), year: integer(input.year, "ปีฉบับหลักสูตร พ.ศ.", 2400, 3000), is_initial: input.is_initial === true, is_active };
        if (id) {
          const previous = await prisma.docs_curriculum_versions.findUniqueOrThrow({ where: { id } });
          if (previous.program_id !== data.program_id && await prisma.docs_work_documents.count({ where: { curriculum_version_id: id } })) throw new InputError("ไม่สามารถย้ายฉบับหลักสูตรที่มีเอกสารไปยังหลักสูตรอื่นได้");
          await prisma.docs_curriculum_versions.update({ where: { id }, data });
        } else await prisma.docs_curriculum_versions.create({ data });
        break;
      }
      case "courses": {
        const data = { program_id: integer(input.program_id, "หลักสูตร"), code: text(input.code, "รหัสรายวิชา", 30), name_th: text(input.name_th, "ชื่อรายวิชา", 200), is_active };
        if (id) {
          const previous = await prisma.docs_courses.findUniqueOrThrow({ where: { id } });
          if (previous.program_id !== data.program_id && await prisma.docs_work_documents.count({ where: { course_offering: { course_id: id } } })) throw new InputError("ไม่สามารถย้ายรายวิชาที่มีเอกสารไปยังหลักสูตรอื่นได้");
          await prisma.docs_courses.update({ where: { id }, data });
        } else await prisma.docs_courses.create({ data });
        break;
      }
      case "course_offerings": {
        const data = { course_id: integer(input.course_id, "รายวิชา"), academic_year_id: integer(input.academic_year_id, "ปีการศึกษา"), semester_id: integer(input.semester_id, "ภาคการศึกษา"), study_year_id: integer(input.study_year_id, "ชั้นปี"), is_active };
        if (id) {
          const previous = await prisma.docs_course_offerings.findUniqueOrThrow({ where: { id } });
          if (["course_id", "academic_year_id", "semester_id", "study_year_id"].some((key) => previous[key as keyof typeof data] !== data[key as keyof typeof data]) && await prisma.docs_work_documents.count({ where: { course_offering_id: id } })) throw new InputError("รายการเปิดสอนนี้มีเอกสารแล้ว กรุณาสร้างรายการเปิดสอนใหม่");
          await prisma.docs_course_offerings.update({ where: { id }, data });
        } else await prisma.docs_course_offerings.create({ data });
        break;
      }
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof InputError) return { ok: false, error: error.message };
    const code = (error as { code?: string }).code;
    if (code === "P2002") return { ok: false, error: "ข้อมูลนี้มีอยู่แล้ว กรุณาตรวจสอบรายการซ้ำ" };
    if (code === "P2003") return { ok: false, error: "ไม่พบข้อมูลอ้างอิงที่เลือก" };
    if (code === "P2025") return { ok: false, error: "ไม่พบรายการที่ต้องการแก้ไข" };
    console.error(error);
    return { ok: false, error: "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่" };
  }
}

export async function deleteAcademicRecord(entity: AcademicEntity, id: number) {
  switch (entity) {
    case "academic_years": await prisma.docs_academic_years.delete({ where: { id } }); break;
    case "semesters": await prisma.docs_semesters.delete({ where: { id } }); break;
    case "study_years": await prisma.docs_study_years.delete({ where: { id } }); break;
    case "curriculum_versions": await prisma.docs_curriculum_versions.delete({ where: { id } }); break;
    case "courses": await prisma.docs_courses.delete({ where: { id } }); break;
    case "course_offerings": await prisma.docs_course_offerings.delete({ where: { id } }); break;
  }
}

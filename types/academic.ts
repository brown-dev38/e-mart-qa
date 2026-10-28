export type DocumentWorkflow = "QAS" | "CUR" | "TCH" | "ASM" | "ADM" | "STU";

export const ACADEMIC_ENTITIES = [
  "academic_years", "semesters", "study_years", "curriculum_versions", "courses", "course_offerings",
] as const;
export type AcademicEntity = (typeof ACADEMIC_ENTITIES)[number];
export type AcademicYear = { id: number; year: number; is_active: boolean };
export type Semester = { id: number; code: string; name_th: string; sort_order: number; is_active: boolean };
export type StudyYear = { id: number; year: number; is_active: boolean };
export type CurriculumVersion = { id: number; program_id: number; year: number; is_initial: boolean; is_active: boolean };
export type Course = { id: number; program_id: number; code: string; name_th: string; is_active: boolean };
export type CourseOffering = {
  id: number; course_id: number; academic_year_id: number; semester_id: number; study_year_id: number; is_active: boolean;
};
export type AcademicData = {
  academic_years: AcademicYear[];
  semesters: Semester[];
  study_years: StudyYear[];
  curriculum_versions: CurriculumVersion[];
  courses: Course[];
  course_offerings: CourseOffering[];
};
export type WorkDocumentScope = {
  programCode: string;
  departmentCode: string;
  subDepartmentCode: string;
  academicYearId?: number;
  curriculumVersionId?: number;
  courseOfferingId?: number;
};
export type WorkDocument = {
  id: string; documentType: string; title: string; fileName: string;
  filePath: string; fileSize: string; createdAt: string;
  canDelete: boolean;
};
export type WorkDocumentResult = { ok: true; documents: WorkDocument[] } | { ok: false; error: string };

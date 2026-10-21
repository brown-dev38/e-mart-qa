import type { AcademicData, AcademicEntity, DocumentWorkflow } from "./academic";

export type MasterEntity = AcademicEntity
  | "departments"
  | "sub_departments"
  | "frameworks"
  | "programs"
  | "document_levels"
  | "criteria";

export type WfmeStandardType = "NONE" | "BASIC" | "QUALITY_DEV";

export type QaDepartment = {
  id: number;
  code: string;
  name_th: string;
  name_en: string | null;
  has_sub_department: boolean;
  sort_order: number;
  is_active: boolean;
};

export type QaSubDepartment = {
  document_workflow: DocumentWorkflow | null;
  id: number;
  department_id: number;
  code: string;
  name_th: string;
  name_en: string | null;
  sort_order: number;
  is_active: boolean;
};

export type QaFramework = {
  id: number;
  code: string;
  prefix_char: string;
  name_th: string;
  name_en: string | null;
  version_year: string | null;
  is_active: boolean;
};

export type QaProgram = {
  id: number;
  code: string;
  name_th: string;
  name_en: string | null;
  framework_id: number;
  is_active: boolean;
};

export type QaDocumentLevel = {
  id: number;
  code: string;
  name_th: string;
  name_en: string | null;
  level_order: number;
  is_active: boolean;
};

export type QaCriterion = {
  id: number;
  framework_id: number;
  parent_id: number | null;
  code: string;
  section_number: string;
  level_depth: number;
  wfme_standard_type: WfmeStandardType;
  title_th: string;
  title_en: string | null;
  description_th: string | null;
  is_selectable: boolean;
  sort_order: number;
  is_active: boolean;
};

export type MasterData = AcademicData & {
  departments: QaDepartment[];
  sub_departments: QaSubDepartment[];
  frameworks: QaFramework[];
  programs: QaProgram[];
  document_levels: QaDocumentLevel[];
  criteria: QaCriterion[];
};

export type MasterRecordInput = Record<string, unknown>;

export type SaveResult = { ok: true } | { ok: false; error: string };

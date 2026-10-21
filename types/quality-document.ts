export type DocumentSaveResult =
  | { ok: true; documentCode: string }
  | { ok: false; error: string };

export type QualityDocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type QualityDocumentScope = {
  programCode?: string;
  departmentCode?: string;
  subDepartmentCode?: string | null;
};

export type QualityDocumentListItem = {
  id: string;
  document_code: string;
  title: string;
  status: QualityDocumentStatus;
  current_version: string;
  created_at: string;
  effective_date: string | null;
  department_code: string;
  department_name: string;
  sub_department_code: string | null;
  sub_department_name: string | null;
  program_code: string;
  program_name: string;
  framework_code: string;
  level_code: string;
  level_name: string;
  criterion_code: string;
  criterion_title: string;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: string | null;
};

export type QualityDocumentListResult =
  | { ok: true; documents: QualityDocumentListItem[] }
  | { ok: false; error: string };

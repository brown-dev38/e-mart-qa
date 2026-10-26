export type DocumentSaveResult =
  | { ok: true; documentCode: string; documentId: string }
  | { ok: false; error: string };

export type QualityDocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type RevisionStatus = "DRAFT" | "PENDING" | "APPROVED" | "SUPERSEDED" | "WITHDRAWN";
export type WorkflowResult = { ok: true } | { ok: false; error: string };
export type RevisionCommand = {
  revisionId: string;
  lockVersion: number;
  action: "submit" | "review" | "approve" | "return";
  comment?: string;
  effectiveDate?: string;
};

export type QualityRevision = {
  id: string;
  version: string;
  status: RevisionStatus;
  title: string;
  description: string;
  changeNote: string;
  changeReason: string;
  fileName: string | null;
  hasFile: boolean;
  fileUrl: string | null;
  reviewFileUrl: string | null;
  lockVersion: number;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  effectiveDate: string | null;
  supersededByVersion: string | null;
  withdrawnBy: string | null;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
  canEdit: boolean;
  canReview: boolean;
  canApprove: boolean;
  canReadSubmissions: boolean;
  events: { id: string; action: string; actor: string; comment: string | null; date: string }[];
  submissions: QualitySubmission[];
};

export type QualitySubmission = {
  id: string; roundNo: number; targetVersion: string;
  title: string; description: string; changeNote: string; changeReason: string;
  fileName: string; fileUrl: string | null; reviewFileUrl: string | null;
  status: "PENDING" | "RETURNED" | "APPROVED";
  submittedBy: string; submittedAt: string; capturedAt: string; source: string;
  reviewedBy: string | null; reviewedAt: string | null; reviewComment: string | null;
  reviewerName: string | null; reviewerAt: string | null; effectiveDate: string | null;
};

export type QualityWorkflowDetail = {
  id: string;
  today: string;
  deleted: boolean;
  documentCode: string;
  currentVersion: string | null;
  nextVersion: string;
  archived: boolean;
  canEditRegistry: boolean;
  canWithdraw: boolean;
  storageLocation: string;
  registryVersion: number;
  registryChanges: { id: string; previousLocation: string; storageLocation: string; reason: string; actor: string; date: string }[];
  canCreateDraft: boolean;
  revisions: QualityRevision[];
};

export type ApprovalQueueItem = {
  id: string;
  documentId: string;
  documentCode: string;
  title: string;
  targetVersion: string;
  currentVersion: string | null;
  submittedBy: string;
  submittedAt: string | null;
  canReview: boolean;
};

export type QualityReviewPhase = "RETURNED" | RevisionStatus;
export type QualityReviewItem = {
  id: string;
  documentCode: string;
  title: string;
  department: string;
  program: string;
  phase: QualityReviewPhase;
  targetVersion: string;
  roundNo: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  submittedAt: string | null;
  canEdit: boolean;
};

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
  current_version: string | null;
  scheduled_version: string | null;
  open_revision_status: RevisionStatus | null;
  open_revision_returned: boolean;
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
  criterion_code: string | null;
  criterion_title: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: string | null;
};

export type QualityDocumentListResult =
  | { ok: true; documents: QualityDocumentListItem[] }
  | { ok: false; error: string };

export type QualityRegistryCommand = { documentId: string; lockVersion: number; storageLocation: string; reason: string };

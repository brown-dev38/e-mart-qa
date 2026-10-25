import { prisma } from "./prisma";
import { revisionFileUrl } from "./quality-document-files";
import type { QualityDocumentListItem, QualityDocumentScope } from "@/types/quality-document";

export async function listQualityDocuments(scope: QualityDocumentScope = {}, actor?: { id: string; admin: boolean }): Promise<
  QualityDocumentListItem[]
> {
  const rows = await prisma.docs_qa_documents.findMany({
    where: {
      deleted_at: null,
      ...(scope.programCode ? { program: { code: scope.programCode } } : {}),
      ...(scope.departmentCode ? { department: { code: scope.departmentCode } } : {}),
      ...(scope.subDepartmentCode === null
        ? { sub_department_id: null }
        : scope.subDepartmentCode
          ? { sub_department: { code: scope.subDepartmentCode } }
          : {}),
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      document_code: true,
      title: true,
      status: true,
      current_version: true,
      created_by: true,
      revisions: { where: { open_slot: 1 }, select: {
        id: true, status: true, title: true, file_path: true, file_name: true, file_size_bytes: true,
        submissions: { orderBy: { round_no: "desc" }, take: 1, select: { status: true } },
        events: { where: { action: "RETURN" }, take: 1, select: { id: true } },
      } },
      created_at: true,
      effective_date: true,
      file_path: true,
      file_name: true,
      file_size_bytes: true,
      department: { select: { code: true, name_th: true } },
      sub_department: { select: { code: true, name_th: true } },
      program: { select: { code: true, name_th: true } },
      document_level: { select: { code: true, name_th: true } },
      criterion: {
        select: {
          code: true,
          title_th: true,
          framework: { select: { code: true } },
        },
      },
    },
  });

  return rows.filter(row => row.status !== "DRAFT" || actor?.admin || row.created_by === actor?.id).map((row) => {
    const open = row.revisions[0];
    const showDraft = row.status === "DRAFT";
    const visibleOpen = actor?.admin || row.created_by === actor?.id;
    return ({
    id: row.id.toString(),
    document_code: row.document_code,
    title: showDraft && open ? open.title : row.title,
    status: row.status,
    current_version: row.current_version,
    open_revision_status: visibleOpen ? open?.status ?? null : null,
    open_revision_returned: !!(visibleOpen && open?.status === "DRAFT" && (open.submissions[0] ? open.submissions[0].status === "RETURNED" : open.events.length)),
    created_at: row.created_at.toISOString(),
    effective_date: row.effective_date
      ? row.effective_date.toISOString().slice(0, 10)
      : null,
    department_code: row.department.code,
    department_name: row.department.name_th,
    sub_department_code: row.sub_department?.code ?? null,
    sub_department_name: row.sub_department?.name_th ?? null,
    program_code: row.program.code,
    program_name: row.program.name_th,
    framework_code: row.criterion.framework.code,
    level_code: row.document_level.code,
    level_name: row.document_level.name_th,
    criterion_code: row.criterion.code,
    criterion_title: row.criterion.title_th,
    file_path: showDraft ? (open?.file_path ? revisionFileUrl(open.id) : null) : row.file_path,
    file_name: showDraft ? open?.file_name ?? null : row.file_name,
    file_size_bytes: (showDraft ? open?.file_size_bytes : row.file_size_bytes)?.toString() ?? null,
  }); });
}

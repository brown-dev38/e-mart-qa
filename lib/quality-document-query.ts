import { prisma } from "./prisma";
import type { QualityDocumentListItem } from "@/types/quality-document";

export async function listQualityDocuments(): Promise<
  QualityDocumentListItem[]
> {
  const rows = await prisma.docs_qa_documents.findMany({
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      document_code: true,
      title: true,
      status: true,
      current_version: true,
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

  return rows.map((row) => ({
    id: row.id.toString(),
    document_code: row.document_code,
    title: row.title,
    status: row.status,
    current_version: row.current_version,
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
    file_path: row.file_path,
    file_name: row.file_name,
    file_size_bytes: row.file_size_bytes?.toString() ?? null,
  }));
}

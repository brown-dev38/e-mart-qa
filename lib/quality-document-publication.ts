import type { Prisma, docs_qa_documents } from "@prisma/client";
import { prisma } from "./prisma";
import { revisionFileUrl } from "./quality-document-files";
import { writeAudit } from "./audit-log";

export function qualityToday(now = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function nextQualityRevision(lastApproved: number | null): number {
  return lastApproved === null ? 0 : lastApproved + 1;
}

// Call while holding the document row lock. Approved future revisions do not
// replace the current file until their effective date in Asia/Bangkok.
export async function activateQualityPublication(tx: Prisma.TransactionClient, doc: docs_qa_documents) {
  if (doc.deleted_at || doc.status === "ARCHIVED") return doc;
  const due = await tx.docs_qa_document_revisions.findFirst({
    where: { document_id: doc.id, status: "APPROVED", OR: [
      { effective_date: { lte: new Date(`${qualityToday()}T00:00:00Z`) } },
      { effective_date: null },
    ] }, orderBy: { revision_number: "desc" },
  });
  if (!due || due.version_label === doc.current_version) return doc;
  const now = new Date();
  await tx.docs_qa_document_revisions.updateMany({
    where: { document_id: doc.id, status: "APPROVED", revision_number: { lt: due.revision_number ?? 0 } },
    data: { status: "SUPERSEDED", superseded_at: now, superseded_by_version: due.version_label },
  });
  const updated = await tx.docs_qa_documents.update({ where: { id: doc.id }, data: {
    title: due.title, description: due.description, current_version: due.version_label,
    status: "PUBLISHED", effective_date: due.effective_date,
    file_path: revisionFileUrl(due.id), file_name: due.file_name,
    file_mime_type: due.file_mime_type, file_size_bytes: due.file_size_bytes,
  } });
  await tx.docs_qa_review_events.create({ data: { revision_id: due.id, action: "EFFECTIVE", actor_id: "SYSTEM", actor_name: "ระบบ", comment: `มีผลใช้ฉบับ ${due.version_label}` } });
  await writeAudit(tx, { id: "", name: "ระบบ" }, {
    action: "EFFECTIVE", entityType: "QUALITY_DOCUMENT", entityId: String(doc.id), entityLabel: doc.document_code,
    summary: `มีผลใช้ฉบับ ${due.version_label}`, details: { version: due.version_label, previousVersion: doc.current_version },
  });
  return updated;
}

// Activation is idempotent and is also run on reads, so a scheduled revision
// becomes current even when no operator is logged in at midnight.
export async function refreshQualityPublications(documentId?: bigint) {
  const due = await prisma.docs_qa_document_revisions.findMany({
    where: { status: "APPROVED", ...(documentId ? { document_id: documentId } : {}),
      document: { deleted_at: null, status: { not: "ARCHIVED" } },
      OR: [{ effective_date: { lte: new Date(`${qualityToday()}T00:00:00Z`) } }, { effective_date: null }],
    }, select: { document_id: true, version_label: true, document: { select: { current_version: true } } },
  });
  const ids = new Set(due.filter(row => row.version_label !== row.document.current_version).map(row => row.document_id));
  for (const id of ids) await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM docs_qa_documents WHERE id = ${id} FOR UPDATE`;
    const doc = await tx.docs_qa_documents.findUnique({ where: { id } });
    if (doc) await activateQualityPublication(tx, doc);
  }, { isolationLevel: "ReadCommitted" });
}

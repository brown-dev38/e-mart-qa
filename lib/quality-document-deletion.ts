import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { currentActor, ActionError } from "./current-actor";
import { writeAudit } from "./audit-log";
import { workflowId } from "./quality-document-workflow";
import type { DeleteQualityCommand, DeletionItem } from "@/types/audit";
import type { WorkflowResult } from "@/types/quality-document";

const include = {
  department: { select: { code: true } },
  revisions: { select: { id: true, lock_version: true, title: true, open_slot: true }, orderBy: { id: "asc" as const } },
};
type Row = Awaited<ReturnType<typeof rows>>[number];
function rows(deleted: boolean, search: string) {
  return prisma.docs_qa_documents.findMany({
    where: { deleted_at: deleted ? { not: null } : null, ...(search ? { OR: [{ document_code: { contains: search } }, { title: { contains: search } }, { revisions: { some: { title: { contains: search } } } }] } : {}) },
    include, orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });
}
function token(row: Pick<Row, "id" | "updated_at" | "approved_revision_no" | "revisions">) {
  return createHash("sha256").update(JSON.stringify([
    String(row.id), row.updated_at.toISOString(), row.approved_revision_no,
    row.revisions.map(r => [String(r.id), r.lock_version]),
  ])).digest("hex");
}
export async function listQualityDeletion(deleted: boolean, search: string, userId: string): Promise<DeletionItem[]> {
  const actor = await currentActor(userId);
  if (!actor.admin) throw new ActionError("เฉพาะผู้ดูแลระบบที่ลบเอกสารคุณภาพได้");
  if (typeof deleted !== "boolean" || typeof search !== "string" || search.length > 200) throw new ActionError("ตัวกรองไม่ถูกต้อง");
  return (await rows(deleted, search.trim())).map(row => ({
    id: String(row.id), code: row.document_code, title: row.revisions.find(r => r.open_slot === 1)?.title || row.title,
    status: row.status, version: row.current_version ?? "ฉบับร่าง", department: row.department.code,
    token: token(row), deletedAt: row.deleted_at?.toISOString() || null, deletedBy: row.deleted_by, reason: row.deletion_reason,
  }));
}
export async function deleteQualityDocument(command: DeleteQualityCommand, userId: string): Promise<WorkflowResult> {
  try {
    if (!command || typeof command.reason !== "string" || !command.reason.trim() || command.reason.trim().length > 1000 || typeof command.confirmationCode !== "string" || typeof command.token !== "string") throw new ActionError("กรุณาระบุเหตุผลไม่เกิน 1,000 ตัวอักษรและยืนยันรหัสเอกสาร");
    const id = workflowId(command.id);
    await prisma.$transaction(async tx => {
      const actor = await currentActor(userId, tx);
      if (!actor.admin) throw new ActionError("เฉพาะผู้ดูแลระบบที่ลบเอกสารคุณภาพได้");
      await tx.$queryRaw`SELECT id FROM docs_qa_documents WHERE id = ${id} FOR UPDATE`;
      const row = await tx.docs_qa_documents.findUnique({ where: { id }, include });
      if (!row || row.deleted_at) throw new ActionError("ไม่พบเอกสาร หรือเอกสารถูกลบไปแล้ว");
      if (command.confirmationCode.trim() !== row.document_code) throw new ActionError("รหัสเอกสารที่ยืนยันไม่ตรงกับรายการที่เลือก");
      if (command.token !== token(row)) throw new ActionError("เอกสารมีการเปลี่ยนแปลงแล้ว กรุณารีเฟรชรายการก่อนลบ");
      const reason = command.reason.trim();
      await tx.docs_qa_documents.update({ where: { id }, data: { deleted_at: new Date(), deleted_by: actor.id, deletion_reason: reason, updated_by: actor.id } });
      await writeAudit(tx, actor, {
        action: "DELETE", entityType: "QUALITY_DOCUMENT", entityId: String(id), entityLabel: row.document_code,
        summary: `ลบเอกสารคุณภาพ: ${row.title}`, details: {
          reason, title: row.title, version: row.current_version, status: row.status, revisionCount: row.revisions.length,
        },
      });
    }, { isolationLevel: "ReadCommitted" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof ActionError ? error.message : "ลบเอกสารไม่สำเร็จ กรุณาลองใหม่" };
  }
}

import { prisma } from "./prisma";
import { currentActor, ActionError } from "./current-actor";
import { writeAudit } from "./audit-log";
import { workflowId } from "./quality-document-workflow";
import type { QualityRegistryCommand, WorkflowResult } from "@/types/quality-document";

export async function updateQualityRegistry(command: QualityRegistryCommand, userId: string): Promise<WorkflowResult> {
  try {
    if (!command || typeof command.storageLocation !== "string" || command.storageLocation.trim().length > 1000 ||
      typeof command.reason !== "string" || !command.reason.trim() || command.reason.trim().length > 2000 ||
      !Number.isSafeInteger(command.lockVersion) || command.lockVersion < 0) throw new ActionError("กรุณาระบุตำแหน่งจัดเก็บและเหตุผลการแก้ทะเบียนให้ถูกต้อง");
    const id = workflowId(command.documentId);
    await prisma.$transaction(async tx => {
      const actor = await currentActor(userId, tx);
      await tx.$queryRaw`SELECT id FROM docs_qa_documents WHERE id = ${id} FOR UPDATE`;
      const doc = await tx.docs_qa_documents.findUnique({ where: { id } });
      if (!doc || doc.deleted_at || (!actor.admin && doc.created_by !== actor.id)) throw new ActionError("ไม่มีสิทธิ์แก้ทะเบียนเอกสารนี้");
      if (doc.registry_version !== command.lockVersion) throw new ActionError("ข้อมูลทะเบียนเปลี่ยนแปลงแล้ว กรุณาเปิดใหม่");
      const location = command.storageLocation.trim() || null;
      const reason = command.reason.trim();
      if (location === doc.storage_location) throw new ActionError("ยังไม่ได้เปลี่ยนตำแหน่งจัดเก็บ");
      await tx.docs_qa_registry_changes.create({ data: { document_id: id, previous_location: doc.storage_location,
        storage_location: location, reason, actor_id: actor.id, actor_name: actor.name } });
      await tx.docs_qa_documents.update({ where: { id }, data: { storage_location: location,
        registry_version: { increment: 1 }, updated_by: actor.id } });
      await writeAudit(tx, actor, { action: "REGISTRY_UPDATE", entityType: "QUALITY_DOCUMENT", entityId: String(id),
        entityLabel: doc.document_code, summary: "แก้ไขข้อมูลทะเบียนโดยคงฉบับอนุมัติเดิม", details: {
          previousLocation: doc.storage_location, storageLocation: location, reason, version: doc.current_version,
        } });
    }, { isolationLevel: "ReadCommitted" });
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof ActionError ? error.message : "แก้ทะเบียนไม่สำเร็จ กรุณาลองใหม่" }; }
}

export async function withdrawQualityDocument(command: { documentId: string; lockVersion: number; reason: string }, userId: string): Promise<WorkflowResult> {
  try {
    if (!command || typeof command.reason !== "string" || !command.reason.trim() || command.reason.trim().length > 2000 ||
      !Number.isSafeInteger(command.lockVersion) || command.lockVersion < 0) throw new ActionError("กรุณาระบุเหตุผลการยกเลิกใช้");
    const id = workflowId(command.documentId);
    await prisma.$transaction(async tx => {
      const actor = await currentActor(userId, tx);
      if (!actor.admin) throw new ActionError("เฉพาะผู้ดูแลระบบที่ยกเลิกใช้เอกสารได้");
      await tx.$queryRaw`SELECT id FROM docs_qa_documents WHERE id = ${id} FOR UPDATE`;
      const doc = await tx.docs_qa_documents.findUnique({ where: { id } });
      if (!doc || doc.deleted_at || doc.status === "ARCHIVED") throw new ActionError("ไม่พบเอกสารที่ยกเลิกใช้ได้");
      if (doc.registry_version !== command.lockVersion) throw new ActionError("ข้อมูลทะเบียนเปลี่ยนแปลงแล้ว กรุณาเปิดใหม่");
      const revisions = await tx.docs_qa_document_revisions.findMany({ where: { document_id: id, status: "APPROVED" } });
      if (!revisions.length) throw new ActionError("เอกสารนี้ยังไม่มีฉบับอนุมัติ");
      const now = new Date(), reason = command.reason.trim();
      for (const revision of revisions) {
        await tx.docs_qa_document_revisions.update({ where: { id: revision.id }, data: { status: "WITHDRAWN",
          withdrawn_by: actor.id, withdrawn_name: actor.name, withdrawn_at: now, withdrawal_reason: reason, lock_version: { increment: 1 } } });
        await tx.docs_qa_review_events.create({ data: { revision_id: revision.id, action: "WITHDRAW", actor_id: actor.id, actor_name: actor.name, comment: reason } });
      }
      await tx.docs_qa_documents.update({ where: { id }, data: { status: "ARCHIVED", registry_version: { increment: 1 }, updated_by: actor.id } });
      await writeAudit(tx, actor, { action: "WITHDRAW", entityType: "QUALITY_DOCUMENT", entityId: String(id),
        entityLabel: doc.document_code, summary: "ยกเลิกใช้เอกสาร", details: { reason, version: doc.current_version } });
    }, { isolationLevel: "ReadCommitted" });
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof ActionError ? error.message : "ยกเลิกใช้ไม่สำเร็จ กรุณาลองใหม่" }; }
}

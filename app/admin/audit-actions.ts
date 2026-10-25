"use server";

import { auth } from "@/lib/auth";
import { ActionError } from "@/lib/current-actor";
import { listAuditLog } from "@/lib/audit-log";
import { deleteQualityDocument, listQualityDeletion } from "@/lib/quality-document-deletion";
import type { AuditFilter, DeleteQualityCommand } from "@/types/audit";

async function identity() {
  const session = await auth();
  if (!session?.user?.id) throw new ActionError("กรุณาเข้าสู่ระบบก่อนใช้งาน");
  return session.user.id;
}
function failure(error: unknown) {
  return { ok: false as const, error: error instanceof ActionError ? error.message : "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่" };
}
export async function listAuditLogAction(filter: AuditFilter = {}) {
  try { return { ok: true as const, data: await listAuditLog(filter, await identity()) }; }
  catch (error) { return failure(error); }
}
export async function listQualityDeletionAction(deleted = false, search = "") {
  try { return { ok: true as const, documents: await listQualityDeletion(deleted, search, await identity()) }; }
  catch (error) { return failure(error); }
}
export async function deleteQualityDocumentAction(command: DeleteQualityCommand) {
  try { return await deleteQualityDocument(command, await identity()); }
  catch (error) { return failure(error); }
}

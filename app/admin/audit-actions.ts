"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ActionError } from "@/lib/current-actor";
import { listAuditLog } from "@/lib/audit-log";
import { deleteQualityDocument, listQualityDeletion, qualityDeletionDetail } from "@/lib/quality-document-deletion";
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
  try {
    const result = await deleteQualityDocument(command, await identity());
    if (result.ok) revalidatePath("/");
    return result;
  }
  catch (error) { return failure(error); }
}
export async function getQualityDeletionAction(documentId: string) {
  try { return { ok: true as const, document: await qualityDeletionDetail(documentId, await identity()) }; }
  catch (error) { return failure(error); }
}

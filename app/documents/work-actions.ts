"use server";

import { auth } from "@/lib/auth";
import { auditedChange } from "@/lib/audit-log";
import { currentActor } from "@/lib/current-actor";
import { prisma } from "@/lib/prisma";
import { listWorkDocuments, saveWorkDocument, deleteWorkDocument } from "@/lib/work-documents";
import type { WorkDocumentScope, WorkDocumentResult } from "@/types/academic";
import type { SaveResult } from "@/types/master-data";

export async function listWorkDocumentsAction(scope: WorkDocumentScope): Promise<WorkDocumentResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนดูเอกสาร" };
  try {
    const actor = await currentActor(session.user.id);
    return listWorkDocuments(scope, actor.id, actor.admin);
  } catch { return { ok: false, error: "ไม่สามารถเข้าถึงเอกสารได้ กรุณาเข้าสู่ระบบอีกครั้ง" }; }
}
export async function saveWorkDocumentAction(data: FormData): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนบันทึกเอกสาร" };
  const title = typeof data.get("title") === "string" ? String(data.get("title")).slice(0, 500) : "เอกสารตามงาน";
  return auditedChange(session.user.id, {
    action: "CREATE", entityType: "WORK_DOCUMENT", entityLabel: title,
    summary: `เพิ่มเอกสารตามงาน: ${title}`,
    details: { documentType: typeof data.get("documentType") === "string" ? String(data.get("documentType")).slice(0, 30) : "" },
  }, actor => saveWorkDocument(data, actor.id), false);
}
export async function deleteWorkDocumentAction(id: string): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนลบเอกสาร" };
  if (typeof id !== "string" || !/^\d{1,20}$/.test(id) || BigInt(id) > BigInt("18446744073709551615")) return { ok: false, error: "รหัสเอกสารไม่ถูกต้อง" };
  const row = await prisma.docs_work_documents.findUnique({ where: { id: BigInt(id) }, select: { title: true, document_type: true } });
  return auditedChange(session.user.id, {
    action: "DELETE", entityType: "WORK_DOCUMENT", entityId: id, entityLabel: row?.title,
    summary: `ลบเอกสารตามงาน: ${row?.title || `#${id}`}`, details: { documentType: row?.document_type || null },
  }, actor => deleteWorkDocument(id, actor.id, actor.admin), false);
}

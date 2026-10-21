"use server";

import { auth } from "@/lib/auth";
import { listWorkDocuments, saveWorkDocument, deleteWorkDocument } from "@/lib/work-documents";
import type { WorkDocumentScope, WorkDocumentResult } from "@/types/academic";
import type { SaveResult } from "@/types/master-data";

export async function listWorkDocumentsAction(scope: WorkDocumentScope): Promise<WorkDocumentResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนดูเอกสาร" };
  return listWorkDocuments(scope, session.user.id, session.user.role === "admin");
}
export async function saveWorkDocumentAction(data: FormData): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนบันทึกเอกสาร" };
  return saveWorkDocument(data, session.user.id);
}
export async function deleteWorkDocumentAction(id: string): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนลบเอกสาร" };
  return deleteWorkDocument(id, session.user.id, session.user.role === "admin");
}

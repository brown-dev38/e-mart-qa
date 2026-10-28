"use server";

import { auth } from "@/lib/auth";
import { ActionError } from "@/lib/current-actor";
import { qualityDocumentVersions } from "@/lib/quality-document-versions";

export async function qualityDocumentVersionsAction(documentId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "กรุณาเข้าสู่ระบบก่อนดูเอกสาร" };
  try { return { ok: true as const, detail: await qualityDocumentVersions(documentId, session.user.id) }; }
  catch (error) { return { ok: false as const, error: error instanceof ActionError ? error.message : "โหลดเวอร์ชันเอกสารไม่สำเร็จ กรุณาลองใหม่" }; }
}

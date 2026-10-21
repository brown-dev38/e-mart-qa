"use server";

import { auth } from "@/lib/auth";
import { listQualityDocuments } from "@/lib/quality-document-query";
import { saveQualityDocument } from "@/lib/quality-document-save";
import type {
  DocumentSaveResult,
  QualityDocumentListResult,
} from "@/types/quality-document";

export async function saveQualityDocumentAction(
  formData: FormData,
): Promise<DocumentSaveResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนบันทึกเอกสาร" };
  }

  return saveQualityDocument(formData, session.user.id);
}

export async function listQualityDocumentsAction(): Promise<QualityDocumentListResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนดูรายการเอกสาร" };
  }

  try {
    return { ok: true, documents: await listQualityDocuments() };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      error: "โหลดรายการเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }
}

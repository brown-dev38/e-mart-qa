"use server";

import { auth } from "@/lib/auth";
import { listQualityDocuments } from "@/lib/quality-document-query";
import { saveQualityDocument } from "@/lib/quality-document-save";
import { qualityActor } from "@/lib/quality-document-workflow";
import type {
  DocumentSaveResult,
  QualityDocumentListResult,
  QualityDocumentScope,
} from "@/types/quality-document";

export async function saveQualityDocumentAction(
  formData: FormData,
): Promise<DocumentSaveResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนบันทึกเอกสาร" };
  }

  try {
    return await saveQualityDocument(formData, session.user.id);
  } catch {
    return { ok: false, error: "บันทึกเอกสารไม่สำเร็จ กรุณาตรวจสอบบัญชีแล้วลองใหม่" };
  }
}

export async function listQualityDocumentsAction(
  scope: QualityDocumentScope = {},
): Promise<QualityDocumentListResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนดูรายการเอกสาร" };
  }

  if (
    !scope || typeof scope !== "object" || Array.isArray(scope) ||
    [scope.programCode, scope.departmentCode, scope.subDepartmentCode].some(
      (value) => value !== undefined && value !== null &&
        (typeof value !== "string" || !value.trim() || value.length > 20),
    ) || scope.programCode === null || scope.departmentCode === null
  ) {
    return { ok: false, error: "เงื่อนไขการค้นหาเอกสารไม่ถูกต้อง" };
  }

  try {
    const actor = await qualityActor(session.user.id);
    return { ok: true, documents: await listQualityDocuments(scope, actor) };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      error: "โหลดรายการเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }
}

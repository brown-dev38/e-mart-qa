"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { auditedChange, mutationEvent } from "@/lib/audit-log";
import { saveOwnProfile } from "@/lib/user-profile";
import type { SaveResult } from "@/types/user-directory";

export async function saveOwnProfileAction(
  input: Record<string, unknown>,
): Promise<SaveResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  // adminOnly=false ให้ผู้ใช้ทั่วไปแก้ไขโปรไฟล์ตัวเองได้
  // ตัว saveOwnProfile ยังบังคับแก้เฉพาะ id ตัวเองเท่านั้น
  const result = await auditedChange(
    userId,
    mutationEvent("USER_PROFILE", input),
    () => saveOwnProfile(userId, input),
    false,
  );
  if (result.ok) revalidatePath("/");
  return result;
}
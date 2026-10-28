"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { auditedChange, mutationEvent } from "@/lib/audit-log";
import {
  deleteDirectoryDepartment,
  deleteDirectoryPosition,
  deleteDirectoryUser,
  saveDirectoryDepartment,
  saveDirectoryPosition,
  saveDirectoryUser,
} from "@/lib/user-directory";
import type {
  DirectoryRecordInput,
  SaveResult,
} from "@/types/user-directory";

export async function saveDepartmentAction(
  input: DirectoryRecordInput,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const result = await auditedChange(session.user.id, mutationEvent("USER_DEPARTMENT", input), () => saveDirectoryDepartment(input));
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deleteDepartmentAction(
  id: number,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };
  const result = await auditedChange(session.user.id, mutationEvent("USER_DEPARTMENT", { id }, "DELETE"), () => deleteDirectoryDepartment(id));
  if (result.ok) revalidatePath("/");
  return result;
}

export async function savePositionAction(
  input: DirectoryRecordInput,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const result = await auditedChange(session.user.id, mutationEvent("POSITION", input), () => saveDirectoryPosition(input));
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deletePositionAction(
  id: number,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };
  const result = await auditedChange(session.user.id, mutationEvent("POSITION", { id }, "DELETE"), () => deleteDirectoryPosition(id));
  if (result.ok) revalidatePath("/");
  return result;
}

export async function saveUserAction(
  input: DirectoryRecordInput,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const result = await auditedChange(session.user.id, mutationEvent("USER", input), () => saveDirectoryUser(input));
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deleteUserAction(id: number): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };
  const result = await deleteDirectoryUser(id, session.user.id);
  if (result.ok) revalidatePath("/");
  return result;
}

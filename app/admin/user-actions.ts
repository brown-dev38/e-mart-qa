"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  deleteDirectoryDepartment,
  deleteDirectoryPosition,
  saveDirectoryDepartment,
  saveDirectoryPosition,
  saveDirectoryUser,
} from "@/lib/user-directory";
import type {
  DirectoryRecordInput,
  SaveResult,
} from "@/types/user-directory";

async function authorize(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return "กรุณาเข้าสู่ระบบก่อนใช้งาน";
  if (session.user.role !== "admin") {
    return "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการข้อมูลได้";
  }
  return null;
}

export async function saveDepartmentAction(
  input: DirectoryRecordInput,
): Promise<SaveResult> {
  const denied = await authorize();
  if (denied) return { ok: false, error: denied };
  const result = await saveDirectoryDepartment(input);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deleteDepartmentAction(
  id: number,
): Promise<SaveResult> {
  const denied = await authorize();
  if (denied) return { ok: false, error: denied };
  const result = await deleteDirectoryDepartment(id);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function savePositionAction(
  input: DirectoryRecordInput,
): Promise<SaveResult> {
  const denied = await authorize();
  if (denied) return { ok: false, error: denied };
  const result = await saveDirectoryPosition(input);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deletePositionAction(
  id: number,
): Promise<SaveResult> {
  const denied = await authorize();
  if (denied) return { ok: false, error: denied };
  const result = await deleteDirectoryPosition(id);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function saveUserAction(
  input: DirectoryRecordInput,
): Promise<SaveResult> {
  const denied = await authorize();
  if (denied) return { ok: false, error: denied };
  const result = await saveDirectoryUser(input);
  if (result.ok) revalidatePath("/");
  return result;
}

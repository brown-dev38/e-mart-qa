"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { deleteMasterRecord, saveMasterRecord } from "@/lib/master-data";
import type {
  MasterEntity,
  MasterRecordInput,
  SaveResult,
} from "@/types/master-data";

const ENTITIES: MasterEntity[] = [
  "departments",
  "sub_departments",
  "frameworks",
  "programs",
  "document_levels",
  "criteria",
];

async function authorize(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return "กรุณาเข้าสู่ระบบก่อนใช้งาน";
  if (session.user.role !== "admin") {
    return "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการข้อมูลได้";
  }
  return null;
}

export async function saveRecordAction(
  entity: MasterEntity,
  input: MasterRecordInput,
): Promise<SaveResult> {
  const denied = await authorize();
  if (denied) return { ok: false, error: denied };
  if (!ENTITIES.includes(entity)) {
    return { ok: false, error: "ไม่พบประเภทข้อมูลที่ต้องการบันทึก" };
  }

  const result = await saveMasterRecord(entity, input);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deleteRecordAction(
  entity: MasterEntity,
  id: number,
): Promise<SaveResult> {
  const denied = await authorize();
  if (denied) return { ok: false, error: denied };
  if (!ENTITIES.includes(entity)) {
    return { ok: false, error: "ไม่พบประเภทข้อมูลที่ต้องการลบ" };
  }

  const result = await deleteMasterRecord(entity, id);
  if (result.ok) revalidatePath("/");
  return result;
}

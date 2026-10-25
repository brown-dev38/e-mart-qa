"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { auditedChange, mutationEvent } from "@/lib/audit-log";
import { deleteMasterRecord, saveMasterRecord } from "@/lib/master-data";
import { ACADEMIC_ENTITIES } from "@/types/academic";
import type {
  MasterEntity,
  MasterRecordInput,
  SaveResult,
} from "@/types/master-data";

const ENTITIES: MasterEntity[] = [
  ...ACADEMIC_ENTITIES,
  "departments",
  "sub_departments",
  "frameworks",
  "programs",
  "document_levels",
  "criteria",
];

export async function saveRecordAction(
  entity: MasterEntity,
  input: MasterRecordInput,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };
  if (!ENTITIES.includes(entity)) {
    return { ok: false, error: "ไม่พบประเภทข้อมูลที่ต้องการบันทึก" };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const result = await auditedChange(session.user.id, mutationEvent("MASTER_DATA", input, undefined, entity), () => saveMasterRecord(entity, input));
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deleteRecordAction(
  entity: MasterEntity,
  id: number,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };
  if (!ENTITIES.includes(entity)) {
    return { ok: false, error: "ไม่พบประเภทข้อมูลที่ต้องการลบ" };
  }

  const result = await auditedChange(session.user.id, mutationEvent("MASTER_DATA", { id }, "DELETE", entity), () => deleteMasterRecord(entity, id));
  if (result.ok) revalidatePath("/");
  return result;
}

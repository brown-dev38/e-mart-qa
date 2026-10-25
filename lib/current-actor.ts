import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export class ActionError extends Error {}
export async function currentActor(userId: string, db: Prisma.TransactionClient = prisma) {
  if (typeof userId !== "string" || !/^[1-9]\d{0,9}$/.test(userId)) throw new ActionError("กรุณาเข้าสู่ระบบอีกครั้ง");
  const user = await db.users.findUnique({ where: { id: Number(userId) }, include: { role: true } });
  if (!user?.is_active) throw new ActionError("บัญชีผู้ใช้ไม่พร้อมใช้งาน");
  return { id: String(user.id), name: user.username, admin: user.role?.is_active === true && user.role.name === "admin" };
}
export type CurrentActor = Awaited<ReturnType<typeof currentActor>>;

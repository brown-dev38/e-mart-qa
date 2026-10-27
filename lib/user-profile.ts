import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import type { SaveResult } from "@/types/user-directory";

class InputError extends Error {}

function text(value: unknown, label: string, max: number): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) throw new InputError(`กรุณากรอก${label}`);
  if (raw.length > max) {
    throw new InputError(`${label}ต้องไม่เกิน ${max} ตัวอักษร`);
  }
  return raw;
}

function optionalText(
  value: unknown,
  label: string,
  max: number,
): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (raw.length > max) {
    throw new InputError(`${label}ต้องไม่เกิน ${max} ตัวอักษร`);
  }
  return raw;
}

function emailValue(value: unknown): string | null {
  const email = optionalText(value, "อีเมล", 191);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InputError("รูปแบบอีเมลไม่ถูกต้อง");
  }
  return email;
}

function passwordValue(value: unknown): string | null {
  const password = typeof value === "string" ? value : "";
  if (!password) return null;
  if ([...password].length < 8) {
    throw new InputError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new InputError("รหัสผ่านต้องมีขนาดไม่เกิน 72 ไบต์");
  }
  return password;
}

function optionalId(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(num) || num < 1) {
    throw new InputError(`${label}ไม่ถูกต้อง`);
  }
  return num;
}

function friendlyError(error: unknown): string {
  if (error instanceof InputError) return error.message;
  const code = (error as { code?: string }).code;
  if (code === "P2002") {
    return "ข้อมูลนี้ถูกใช้งานแล้ว กรุณาตรวจสอบชื่อผู้ใช้หรืออีเมล";
  }
  if (code === "P2025") return "ไม่พบข้อมูลผู้ใช้ที่ต้องการ";
  console.error(error);
  return "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export type OwnProfileData = {
  id: number;
  username: string;
  email: string | null;
  citizen_id: string | null;
  firstname: string | null;
  lastname: string | null;
  role_id: number | null;
  role_name: string | null;
  department_id: number | null;
  department_name: string | null;
  position_id: number | null;
  position_name: string | null;
  departments: { id: number; name: string; is_active: boolean }[];
  positions: { id: number; name: string; is_active: boolean }[];
  roles: { id: number; name: string; is_active: boolean }[];
};

export async function loadOwnProfile(userId: string): Promise<OwnProfileData | null> {
  const id = Number(userId);
  if (!Number.isInteger(id) || id < 1) return null;
  const [user, departments, positions, roles] = await Promise.all([
    prisma.users.findUnique({
      where: { id },
      include: { role: true, department: true, position: true },
    }),
    prisma.departments.findMany({ orderBy: { name: "asc" } }),
    prisma.positions.findMany({ orderBy: { name: "asc" } }),
    prisma.role.findMany({ orderBy: { id: "asc" } }),
  ]);
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    citizen_id: user.citizen_id,
    firstname: user.firstname,
    lastname: user.lastname,
    role_id: user.role_id,
    role_name: user.role?.name ?? null,
    department_id: user.department_id,
    department_name: user.department?.name ?? null,
    position_id: user.position_id,
    position_name: user.position?.name ?? null,
    departments: departments.map((item) => ({
      id: item.id,
      name: item.name,
      is_active: item.is_active,
    })),
    positions: positions.map((item) => ({
      id: item.id,
      name: item.name,
      is_active: item.is_active,
    })),
    roles: roles.map((item) => ({
      id: item.id,
      name: item.name,
      is_active: item.is_active,
    })),
  };
}

/**
 * แก้ไขข้อมูลบัญชีของตัวเองเท่านั้น (ผู้ใช้ทั่วไปแก้ไขได้)
 * - `targetId` ต้องตรงกับผู้ใช้ที่ล็อกอินอยู่เสมอ จึงแก้ของคนอื่นไม่ได้
 * - บทบาท (role_id) บังคับให้คงค่าปัจจุบัน กันไม่ให้ผู้ใช้ยกระดับสิทธิ์ตัวเอง
 */
export async function saveOwnProfile(
  actingUserId: string,
  input: Record<string, unknown>,
): Promise<SaveResult> {
  try {
    const actorId = Number(actingUserId);
    if (!Number.isInteger(actorId) || actorId < 1) {
      throw new InputError("กรุณาเข้าสู่ระบบอีกครั้ง");
    }

    // บังคับให้แก้เฉพาะตัวเองเท่านั้น
    const requestedId = optionalId(input.id, "รหัสผู้ใช้");
    if (requestedId !== actorId) throw new InputError("ไม่สามารถแก้ไขบัญชีผู้อื่นได้");

    const username = text(input.username, "ชื่อผู้ใช้", 150);
    const email = emailValue(input.email);
    const citizenId = optionalText(input.citizen_id, "เลขบัตรประชาชน", 100);
    const firstname = optionalText(input.firstname, "ชื่อ", 150);
    const lastname = optionalText(input.lastname, "นามสกุล", 150);
    const departmentId = optionalId(input.department_id, "หน่วยงาน");
    const positionId = optionalId(input.position_id, "ตำแหน่ง");
    const password = passwordValue(input.password);
    const passwordConfirmation =
      typeof input.confirm_password === "string" ? input.confirm_password : "";

    if (password && password !== passwordConfirmation) {
      throw new InputError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const current = await tx.users.findUnique({ where: { id: actorId } });
      if (!current) throw new InputError("ไม่พบข้อมูลผู้ใช้ที่ต้องการ");

      const duplicateUsername = await tx.users.findFirst({
        where: { username, NOT: { id: actorId } },
        select: { id: true },
      });
      if (duplicateUsername) {
        throw new InputError("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาใช้ชื่ออื่น");
      }

      if (email) {
        const duplicateEmail = await tx.users.findFirst({
          where: { email, NOT: { id: actorId } },
          select: { id: true },
        });
        if (duplicateEmail) {
          throw new InputError("อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น");
        }
      }

      if (departmentId !== null) {
        const department = await tx.departments.findUnique({
          where: { id: departmentId },
        });
        if (!department) throw new InputError("ไม่พบหน่วยงาน/สังกัดที่เลือก");
        if (!department.is_active && current.department_id !== departmentId) {
          throw new InputError("หน่วยงาน/สังกัดที่เลือกถูกปิดใช้งานแล้ว");
        }
      }

      if (positionId !== null) {
        const position = await tx.positions.findUnique({
          where: { id: positionId },
        });
        if (!position) throw new InputError("ไม่พบตำแหน่งที่เลือก");
        if (!position.is_active && current.position_id !== positionId) {
          throw new InputError("ตำแหน่งที่เลือกถูกปิดใช้งานแล้ว");
        }
      }

      const data: {
        username: string;
        email: string | null;
        citizen_id: string | null;
        firstname: string | null;
        lastname: string | null;
        department_id: number | null;
        position_id: number | null;
        updated_at: Date;
        password_hash?: string;
        password_changed_at?: Date;
        must_change_password?: boolean;
      } = {
        username,
        email,
        citizen_id: citizenId,
        firstname,
        lastname,
        department_id: departmentId,
        position_id: positionId,
        updated_at: now,
      };

      if (passwordHash) {
        data.password_hash = passwordHash;
        data.password_changed_at = now;
        data.must_change_password = true;
      }

      await tx.users.update({ where: { id: actorId }, data });
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}
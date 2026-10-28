import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { ActionError, currentActor } from "./current-actor";
import { writeAudit } from "./audit-log";
import type {
  DirectoryRecordInput,
  SaveResult,
  UserDirectoryData,
} from "@/types/user-directory";

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

function passwordValue(value: unknown, required: boolean): string | null {
  const password = typeof value === "string" ? value : "";
  if (!password) {
    if (required) throw new InputError("กรุณากรอกรหัสผ่าน");
    return null;
  }
  if ([...password].length < 8) {
    throw new InputError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new InputError("รหัสผ่านต้องมีขนาดไม่เกิน 72 ไบต์");
  }
  return password;
}

function intValue(
  value: unknown,
  label: string,
  min: number,
  max = 4_294_967_295,
): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new InputError(`${label}ไม่ถูกต้อง`);
  }
  return num;
}

function optionalId(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  return intValue(value, label, 1);
}

function boolValue(value: unknown, fallback = true): boolean {
  if (value === undefined || value === null) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

function friendlyError(error: unknown): string {
  if (error instanceof InputError || error instanceof ActionError) return error.message;
  const code = (error as { code?: string }).code;
  if (code === "P2002") {
    return "ข้อมูลนี้ถูกใช้งานแล้ว กรุณาตรวจสอบชื่อผู้ใช้หรืออีเมล";
  }
  if (code === "P2003") {
    return "ไม่สามารถดำเนินการได้ เนื่องจากมีข้อมูลอื่นอ้างอิงรายการนี้อยู่";
  }
  if (code === "P2025") return "ไม่พบข้อมูลที่ต้องการ";
  console.error(error);
  return "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export async function loadUserDirectory(): Promise<UserDirectoryData> {
  const [departments, positions, roles, users] = await Promise.all([
    prisma.departments.findMany({ orderBy: { name: "asc" } }),
    prisma.positions.findMany({ orderBy: { name: "asc" } }),
    prisma.role.findMany({ orderBy: { id: "asc" } }),
    prisma.users.findMany({
      include: { role: true, department: true, position: true },
      orderBy: { id: "asc" },
    }),
  ]);

  return {
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
    users: users.map((item) => ({
      id: item.id,
      username: item.username,
      email: item.email,
      citizen_id: item.citizen_id,
      firstname: item.firstname,
      lastname: item.lastname,
      must_change_password: item.must_change_password,
      is_active: item.is_active,
      role_id: item.role_id,
      role_name: item.role?.name ?? null,
      department_id: item.department_id,
      department_name: item.department?.name ?? null,
      position_id: item.position_id,
      position_name: item.position?.name ?? null,
    })),
  };
}

export async function deleteDirectoryUser(rawId: unknown, userId: string): Promise<SaveResult> {
  try {
    if (typeof rawId !== "number" || !Number.isSafeInteger(rawId) || rawId < 1 || rawId > 2_147_483_647) {
      throw new InputError("รหัสผู้ใช้ไม่ถูกต้อง");
    }
    const id = rawId;
    if (typeof userId !== "string" || !/^[1-9]\d{0,9}$/.test(userId) || Number(userId) > 2_147_483_647) {
      throw new InputError("กรุณาเข้าสู่ระบบอีกครั้ง");
    }
    await prisma.$transaction(async (tx) => {
      // Lock both accounts in a fixed order so concurrent admin deletions cannot remove each other.
      await tx.$queryRaw`SELECT id FROM users WHERE id IN (${Number(userId)}, ${id}) ORDER BY id FOR UPDATE`;
      const actor = await currentActor(userId, tx);
      if (!actor.admin) throw new InputError("เฉพาะผู้ดูแลระบบเท่านั้นที่ลบผู้ใช้งานได้");
      if (actor.id === String(id)) throw new InputError("ไม่สามารถลบบัญชีของตนเองได้");
      const user = await tx.users.findUnique({ where: { id }, select: { username: true } });
      if (!user) throw new InputError("ไม่พบผู้ใช้งาน หรือบัญชีถูกลบไปแล้ว");
      await tx.users.delete({ where: { id } });
      await writeAudit(tx, actor, {
        action: "DELETE", entityType: "USER", entityId: String(id), entityLabel: user.username,
        summary: `ลบผู้ใช้งาน: ${user.username}`, details: { username: user.username },
      });
    }, { isolationLevel: "ReadCommitted" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function saveDirectoryDepartment(
  input: DirectoryRecordInput,
): Promise<SaveResult> {
  try {
    const id = optionalId(input.id, "รหัสรายการ");
    const name = text(input.name, "ชื่อหน่วยงาน/สังกัด", 150);
    const is_active = boolValue(input.is_active);

    if (id !== null) {
      await prisma.departments.update({
        where: { id },
        data: { name, is_active },
      });
    } else {
      const now = new Date();
      await prisma.departments.create({
        data: {
          name,
          is_active,
          created_at: now,
          updated_at: now,
        },
      });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function deleteDirectoryDepartment(
  rawId: unknown,
): Promise<SaveResult> {
  try {
    const id = intValue(rawId, "รหัสรายการ", 1);
    const used = await prisma.users.count({
      where: { department_id: id },
    });
    if (used > 0) {
      throw new InputError("ไม่สามารถลบได้ เนื่องจากมีผู้ใช้งานอยู่ในหน่วยงานนี้");
    }
    await prisma.departments.delete({ where: { id } });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function saveDirectoryPosition(
  input: DirectoryRecordInput,
): Promise<SaveResult> {
  try {
    const id = optionalId(input.id, "รหัสรายการ");
    const name = text(input.name, "ชื่อตำแหน่ง", 150);
    const is_active = boolValue(input.is_active);

    if (id !== null) {
      await prisma.positions.update({
        where: { id },
        data: { name, is_active },
      });
    } else {
      const now = new Date();
      await prisma.positions.create({
        data: {
          name,
          is_active,
          created_at: now,
          updated_at: now,
        },
      });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function deleteDirectoryPosition(
  rawId: unknown,
): Promise<SaveResult> {
  try {
    const id = intValue(rawId, "รหัสรายการ", 1);
    const used = await prisma.users.count({
      where: { position_id: id },
    });
    if (used > 0) {
      throw new InputError("ไม่สามารถลบได้ เนื่องจากมีผู้ใช้งานอยู่ในตำแหน่งนี้");
    }
    await prisma.positions.delete({ where: { id } });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function saveDirectoryUser(
  input: DirectoryRecordInput,
): Promise<SaveResult> {
  try {
    const id = optionalId(input.id, "รหัสผู้ใช้");
    const username = text(input.username, "ชื่อผู้ใช้", 150);
    const email = emailValue(input.email);
    const citizenId = optionalText(input.citizen_id, "เลขบัตรประชาชน", 100);
    const firstname = optionalText(input.firstname, "ชื่อ", 150);
    const lastname = optionalText(input.lastname, "นามสกุล", 150);
    const roleId = optionalId(input.role_id, "บทบาท");
    const departmentId = optionalId(input.department_id, "หน่วยงาน");
    const positionId = optionalId(input.position_id, "ตำแหน่ง");
    const is_active = boolValue(input.is_active);
    const password = passwordValue(input.password, id === null);
    const passwordConfirmation =
      typeof input.confirm_password === "string" ? input.confirm_password : "";

    if (roleId === null) throw new InputError("กรุณาเลือกบทบาท");
    if (password && password !== passwordConfirmation) {
      throw new InputError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const now = new Date();

    const data: {
      username: string;
      email: string | null;
      citizen_id: string | null;
      firstname: string | null;
      lastname: string | null;
      role_id: number;
      department_id: number | null;
      position_id: number | null;
      is_active: boolean;
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
      role_id: roleId,
      department_id: departmentId,
      position_id: positionId,
      is_active,
      updated_at: now,
    };

    if (passwordHash) {
      data.password_hash = passwordHash;
      data.password_changed_at = now;
      data.must_change_password = true;
    }

    await prisma.$transaction(async (tx) => {
      const current = id === null
        ? null
        : await tx.users.findUnique({ where: { id } });
      if (id !== null && !current) throw new InputError("ไม่พบข้อมูลผู้ใช้ที่ต้องการ");

      const duplicateUsername = await tx.users.findFirst({
        where: {
          username,
          ...(id === null ? {} : { NOT: { id } }),
        },
        select: { id: true },
      });
      if (duplicateUsername) {
        throw new InputError("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาใช้ชื่ออื่น");
      }

      if (email) {
        const duplicateEmail = await tx.users.findFirst({
          where: {
            email,
            ...(id === null ? {} : { NOT: { id } }),
          },
          select: { id: true },
        });
        if (duplicateEmail) {
          throw new InputError("อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น");
        }
      }

      const role = await tx.role.findUnique({ where: { id: roleId } });
      if (!role) throw new InputError("ไม่พบบทบาทที่เลือก");
      if (!role.is_active && current?.role_id !== roleId) {
        throw new InputError("บทบาทที่เลือกถูกปิดใช้งานแล้ว");
      }

      if (departmentId !== null) {
        const department = await tx.departments.findUnique({
          where: { id: departmentId },
        });
        if (!department) throw new InputError("ไม่พบหน่วยงาน/สังกัดที่เลือก");
        if (!department.is_active && current?.department_id !== departmentId) {
          throw new InputError("หน่วยงาน/สังกัดที่เลือกถูกปิดใช้งานแล้ว");
        }
      }

      if (positionId !== null) {
        const position = await tx.positions.findUnique({
          where: { id: positionId },
        });
        if (!position) throw new InputError("ไม่พบตำแหน่งที่เลือก");
        if (!position.is_active && current?.position_id !== positionId) {
          throw new InputError("ตำแหน่งที่เลือกถูกปิดใช้งานแล้ว");
        }
      }

      if (id === null) {
        await tx.users.create({
          data: {
            ...data,
            password_hash: passwordHash,
            password_changed_at: now,
            must_change_password: true,
            created_at: now,
          },
        });
      } else {
        await tx.users.update({ where: { id }, data });
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

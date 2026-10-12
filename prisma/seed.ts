import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcrypt";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

const ROLES: { name: string; employee_id: number }[] = [
  { name: "admin", employee_id: 1 },
  { name: "staff", employee_id: 2 },
  { name: "user", employee_id: 3 },
];

const USERS: { id: number; username: string; role: string; password: string }[] = [
  { id: 1, username: "admin", role: "admin", password: "test123" },
  { id: 2, username: "staff", role: "staff", password: "test123" },
  { id: 3, username: "user", role: "user", password: "test123" },
];

async function main() {
  const now = new Date();

  for (const role of ROLES) {
    const existing = await prisma.role.findFirst({ where: { name: role.name } });
    if (existing) {
      await prisma.role.update({
        where: { id: existing.id },
        data: { employee_id: role.employee_id, isActive: true, updated_at: now },
      });
      console.log(`role "${role.name}" already exists (id=${existing.id})`);
    } else {
      const created = await prisma.role.create({
        data: { ...role, isActive: true, created_at: now, updated_at: now },
      });
      console.log(`role "${role.name}" created (id=${created.id})`);
    }
  }

  for (const spec of USERS) {
    const role = await prisma.role.findFirst({ where: { name: spec.role } });
    if (!role) throw new Error(`role "${spec.role}" not found`);

    const password_hash = await bcrypt.hash(spec.password, 10);
    const data = {
      username: spec.username,
      password_hash,
      role_id: role.id,
      isActive: true,
      updated_at: now,
    };

    const existing = await prisma.users.findUnique({ where: { id: spec.id } });
    if (existing) {
      await prisma.users.update({ where: { id: spec.id }, data });
      console.log(`user ${spec.id} "${spec.username}" updated (role=${spec.role})`);
    } else {
      await prisma.users.create({ data: { ...data, id: spec.id, created_at: now } });
      console.log(`user ${spec.id} "${spec.username}" created (role=${spec.role})`);
    }
  }

  const roleCount = await prisma.role.count();
  const userCount = await prisma.users.count();
  console.log(`done — ${roleCount} role(s), ${userCount} user(s) in database`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { seedDepartmentData } from "./seed-department-data.mjs";
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
try {
  await seedDepartmentData(prisma);
  console.log("Department document master data seeded.");
} finally {
  await prisma.$disconnect();
}

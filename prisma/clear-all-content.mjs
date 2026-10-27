import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { rm } from "node:fs/promises";
import path from "node:path";

/**
 * ล้างข้อมูลเอกสาร + master data ทั้งหมดในระบบ (เก็บเฉพาะบัญชีผู้ใช้/บทบาท/หน่วยงานผู้ใช้)
 *
 * การใช้งาน:
 *   node prisma/clear-all-content.mjs          # dry-run: แสดงจำนวนที่จะลบ โดยไม่ลบจริง
 *   node prisma/clear-all-content.mjs --apply  # ล้างข้อมูลจริง
 */

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL), log: [] });
const apply = process.argv.includes("--apply");

// docs_qa_criteria อ้างตัวเองผ่าน parent_id (onDelete: Restrict) จึงต้องลบ leaf-first
// leaf = node ที่ไม่มีลูก (children: { none: {} })
async function clearCriteria(tx) {
  let total = 0;
  for (;;) {
    const { count } = await tx.docs_qa_criteria.deleteMany({
      where: { children: { none: {} } },
    });
    total += count;
    if (count === 0) break;
  }
  return total;
}

// เรียงจาก leaf -> root เพื่อไม่ให้ชน foreign key (เอกสาร -> master)
const docTables = [
  ["docs_qa_review_events", (tx) => tx.docs_qa_review_events.deleteMany()],
  ["docs_qa_submissions", (tx) => tx.docs_qa_submissions.deleteMany()],
  ["docs_qa_registry_changes", (tx) => tx.docs_qa_registry_changes.deleteMany()],
  ["docs_qa_document_revisions", (tx) => tx.docs_qa_document_revisions.deleteMany()],
  ["docs_qa_documents", (tx) => tx.docs_qa_documents.deleteMany()],
  ["docs_work_documents", (tx) => tx.docs_work_documents.deleteMany()],
  // master data ตามลำดับ (ลูก -> พ่อ)
  ["docs_course_offerings", (tx) => tx.docs_course_offerings.deleteMany()],
  ["docs_courses", (tx) => tx.docs_courses.deleteMany()],
  ["docs_curriculum_versions", (tx) => tx.docs_curriculum_versions.deleteMany()],
  ["docs_academic_years", (tx) => tx.docs_academic_years.deleteMany()],
  ["docs_semesters", (tx) => tx.docs_semesters.deleteMany()],
  ["docs_study_years", (tx) => tx.docs_study_years.deleteMany()],
  ["docs_document_levels", (tx) => tx.docs_document_levels.deleteMany()],
  ["docs_sub_departments", (tx) => tx.docs_sub_departments.deleteMany()],
  ["docs_programs", (tx) => tx.docs_programs.deleteMany()],
  ["docs_departments", (tx) => tx.docs_departments.deleteMany()],
  // docs_accreditation_frameworks ถูก docs_qa_criteria อ้าง (framework_id) จึงลบหลัง criteria
];

async function main() {
  const auditCount = await prisma.audit_logs.count();

  if (!apply) {
    console.log("=== DRY RUN (ไม่ลบจริง) ใช้ --apply เพื่อล้างจริง ===");
    console.log(`audit_logs: ${auditCount} แถว`);
    for (const [name] of docTables) {
      const count = await prisma[name].count();
      console.log(`${name}: ${count} แถว`);
    }
    console.log(`docs_qa_criteria: ${await prisma.docs_qa_criteria.count()} แถว (ลบแบบ leaf-first)`);
    console.log(`docs_accreditation_frameworks: ${await prisma.docs_accreditation_frameworks.count()} แถว`);
    console.log("\nจะลบเฉพาะตารางข้างต้น + ไฟล์เอกสารในโฟลเดอร์");
    console.log("เก็บ: users, role, departments, positions");
    await prisma.$disconnect();
    return;
  }

  // ล้าง DB ทั้งหมดใน transaction เดียว (เรียง leaf -> root ตาม FK)
  await prisma.$transaction(async (tx) => {
    await tx.audit_logs.deleteMany();
    for (const [, action] of docTables) {
      await action(tx);
    }
    // criteria leaf-first ก่อนลบ frameworks (criteria อ้าง framework_id)
    await clearCriteria(tx);
    await tx.docs_accreditation_frameworks.deleteMany();
  });

  // ลบไฟล์เอกสารจริง (ปลอดภัย: ลบเฉพาะ directory ที่ระบบเป็นเจ้าของ)
  const paths = [
    path.join(process.cwd(), "storage", "qa-documents"),
    path.join(process.cwd(), "public", "uploads", "qa-documents"),
    path.join(process.cwd(), "public", "uploads", "work-documents"),
  ];
  for (const dir of paths) {
    await rm(dir, { recursive: true, force: true });
    console.log(`ลบโฟลเดอร์ไฟล์: ${dir}`);
  }

  console.log("ล้างข้อมูลเรียบร้อย (เก็บ users/role/departments/positions ไว้)");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
  await prisma.$disconnect();
});
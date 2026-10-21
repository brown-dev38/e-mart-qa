import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcrypt";
import { seedDepartmentData } from "./seed-department-data.mjs";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

const ROLES: { name: string }[] = [
  { name: "admin" },
  { name: "staff" },
  { name: "user" },
];

const USERS: { id: number; username: string; role: string; password: string }[] = [
  { id: 1, username: "admin", role: "admin", password: "test123" },
  { id: 2, username: "staff", role: "staff", password: "test123" },
  { id: 3, username: "user", role: "user", password: "test123" },
];

const QA_DEPARTMENTS = [
  {
    code: "EDU",
    name_th: "หน่วยงานการศึกษา",
    name_en: "Education Department",
    has_sub_department: true,
    sort_order: 1,
  },
  {
    code: "MGT",
    name_th: "หน่วยงานบริหาร",
    name_en: "Management Department",
    has_sub_department: false,
    sort_order: 2,
  },
];

const QA_SUB_DEPARTMENTS = [
  { department: "EDU", code: "ADM", name_th: "งานรับเข้า", name_en: "Admissions Unit", sort_order: 1 },
  {
    department: "EDU",
    code: "TCH",
    name_th: "งานจัดการเรียนการสอน",
    name_en: "Teaching and Learning Unit",
    sort_order: 2,
  },
  {
    department: "EDU",
    code: "ASM",
    name_th: "งานวัดและประเมินผล",
    name_en: "Assessment and Evaluation Unit",
    sort_order: 3,
  },
  { department: "EDU", code: "STU", name_th: "งานนิสิต", name_en: "Student Affairs Unit", sort_order: 4 },
];

const QA_FRAMEWORKS = [
  {
    code: "WFME",
    prefix_char: "W",
    name_th: "เกณฑ์มาตรฐานสากลแพทยศาสตรศึกษา (WFME)",
    name_en: "World Federation for Medical Education",
    version_year: "2020",
  },
  {
    code: "AUN",
    prefix_char: "A",
    name_th: "เกณฑ์เครือข่ายการประกันคุณภาพมหาวิทยาลัยอาเซียน (AUN-QA)",
    name_en: "ASEAN University Network - Quality Assurance",
    version_year: "4.0",
  },
];

const QA_PROGRAMS = [
  {
    code: "M.D.",
    name_th: "หลักสูตรแพทยศาสตรบัณฑิต",
    name_en: "Doctor of Medicine Program",
    framework: "WFME",
  },
  {
    code: "B.PMD.",
    name_th: "หลักสูตรฉุกเฉินการแพทยบัณฑิต",
    name_en: "Bachelor of Paramedicine Program",
    framework: "AUN",
  },
];

const QA_DOCUMENT_LEVELS = [
  { code: "QM", name_th: "นโยบายคุณภาพ", name_en: "Quality Manual / Policy", level_order: 1 },
  { code: "SP", name_th: "ระเบียบปฏิบัติ", name_en: "System Procedure", level_order: 2 },
  { code: "WI", name_th: "แนวทางปฏิบัติ", name_en: "Work Instruction", level_order: 3 },
  { code: "FM", name_th: "แบบฟอร์ม", name_en: "Form", level_order: 4 },
  { code: "SD", name_th: "เอกสารสนับสนุน", name_en: "Supporting Document", level_order: 5 },
];

const QA_CRITERIA: {
  framework: string;
  parent: string | null;
  code: string;
  section_number: string;
  level_depth: number;
  wfme_standard_type: "NONE" | "BASIC" | "QUALITY_DEV";
  title_th: string;
  title_en: string | null;
  is_selectable: boolean;
  sort_order: number;
}[] = [
  {
    framework: "WFME",
    parent: null,
    code: "W1",
    section_number: "1",
    level_depth: 1,
    wfme_standard_type: "NONE",
    title_th: "พันธกิจและผลลัพธ์การเรียนรู้ (Mission and Outcomes)",
    title_en: "Mission and Outcomes",
    is_selectable: false,
    sort_order: 1,
  },
  {
    framework: "WFME",
    parent: "W1",
    code: "W1.1",
    section_number: "1.1",
    level_depth: 2,
    wfme_standard_type: "NONE",
    title_th: "การกำหนดพันธกิจ (Stated Mission)",
    title_en: "Stated Mission",
    is_selectable: false,
    sort_order: 1,
  },
  {
    framework: "WFME",
    parent: "W1.1",
    code: "W1.1.1",
    section_number: "1.1.1",
    level_depth: 3,
    wfme_standard_type: "BASIC",
    title_th: "การกำหนดและประกาศพันธกิจของคณะแพทยศาสตร์",
    title_en: "Institutional Mission Statement",
    is_selectable: true,
    sort_order: 1,
  },
  {
    framework: "WFME",
    parent: "W1.1",
    code: "W1.1.2",
    section_number: "1.1.2",
    level_depth: 3,
    wfme_standard_type: "BASIC",
    title_th: "การมีส่วนร่วมของประชาคมและผู้มีส่วนได้ส่วนเสียในการกำหนดพันธกิจ",
    title_en: "Stakeholder Participation in Mission Formulation",
    is_selectable: true,
    sort_order: 2,
  },
  {
    framework: "AUN",
    parent: null,
    code: "A1",
    section_number: "1",
    level_depth: 1,
    wfme_standard_type: "NONE",
    title_th: "ผลการเรียนรู้ที่คาดหวัง (Expected Learning Outcomes)",
    title_en: "Expected Learning Outcomes",
    is_selectable: false,
    sort_order: 1,
  },
  {
    framework: "AUN",
    parent: "A1",
    code: "A1.1",
    section_number: "1.1",
    level_depth: 2,
    wfme_standard_type: "NONE",
    title_th: "การกำหนดผลการเรียนรู้ที่คาดหวังของหลักสูตร",
    title_en: "Formulation of Expected Learning Outcomes",
    is_selectable: false,
    sort_order: 1,
  },
  {
    framework: "AUN",
    parent: "A1.1",
    code: "A1.1-1",
    section_number: "1.1-1",
    level_depth: 3,
    wfme_standard_type: "NONE",
    title_th: "ผลการเรียนรู้ที่คาดหวังมีความชัดเจนและสอดคล้องกับพันธกิจ",
    title_en: "Alignment of Expected Learning Outcomes",
    is_selectable: true,
    sort_order: 1,
  },
];


async function main() {
  const now = new Date();

  for (const role of ROLES) {
    const existing = await prisma.role.findFirst({ where: { name: role.name } });
    if (existing) {
      await prisma.role.update({
        where: { id: existing.id },
        data: { is_active: true, updated_at: now },
      });
      console.log(`role "${role.name}" already exists (id=${existing.id})`);
    } else {
      const created = await prisma.role.create({
        data: { ...role, is_active: true, created_at: now, updated_at: now },
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
      is_active: true,
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

  for (const department of QA_DEPARTMENTS) {
    await prisma.docs_departments.upsert({
      where: { code: department.code },
      update: { ...department, updated_at: now },
      create: { ...department, created_at: now, updated_at: now },
    });
  }

  for (const subDepartment of QA_SUB_DEPARTMENTS) {
    const department = await prisma.docs_departments.findUnique({
      where: { code: subDepartment.department },
    });
    if (!department) {
      throw new Error(`department "${subDepartment.department}" not found`);
    }
    const { department: _department, ...data } = subDepartment;
    const workFlow = ({ ADM: "ADM", TCH: "TCH", ASM: "ASM" } as const)[data.code as "ADM" | "TCH" | "ASM"] ?? null;
    await prisma.docs_sub_departments.upsert({
      where: {
        department_id_code: {
          department_id: department.id,
          code: data.code,
        },
      },
      update: { ...data, updated_at: now },
      create: {
        ...data,
        department_id: department.id,
        document_workflow: workFlow,
        created_at: now,
        updated_at: now,
      },
    });
  }

  for (const framework of QA_FRAMEWORKS) {
    await prisma.docs_accreditation_frameworks.upsert({
      where: { code: framework.code },
      update: { ...framework, updated_at: now },
      create: { ...framework, created_at: now, updated_at: now },
    });
  }

  for (const program of QA_PROGRAMS) {
    const framework = await prisma.docs_accreditation_frameworks.findUnique({
      where: { code: program.framework },
    });
    if (!framework) {
      throw new Error(`framework "${program.framework}" not found`);
    }
    const { framework: _framework, ...data } = program;
    await prisma.docs_programs.upsert({
      where: { code: data.code },
      update: { ...data, framework_id: framework.id, updated_at: now },
      create: {
        ...data,
        framework_id: framework.id,
        created_at: now,
        updated_at: now,
      },
    });
  }

  for (const level of QA_DOCUMENT_LEVELS) {
    await prisma.docs_document_levels.upsert({
      where: { code: level.code },
      update: { ...level, updated_at: now },
      create: { ...level, created_at: now, updated_at: now },
    });
  }

  // Insert parents before children so each parent lookup succeeds.
  const orderedCriteria = [...QA_CRITERIA].sort(
    (a, b) => a.level_depth - b.level_depth,
  );
  for (const spec of orderedCriteria) {
    const framework = await prisma.docs_accreditation_frameworks.findUnique({
      where: { code: spec.framework },
    });
    if (!framework) {
      throw new Error(`framework "${spec.framework}" not found`);
    }
    const parent = spec.parent
      ? await prisma.docs_qa_criteria.findUnique({
          where: {
            framework_id_code: {
              framework_id: framework.id,
              code: spec.parent,
            },
          },
        })
      : null;
    if (spec.parent && !parent) {
      throw new Error(`criteria "${spec.parent}" not found`);
    }
    const { framework: _framework, parent: _parent, ...data } = spec;
    await prisma.docs_qa_criteria.upsert({
      where: {
        framework_id_code: {
          framework_id: framework.id,
          code: data.code,
        },
      },
      update: {
        ...data,
        parent_id: parent?.id ?? null,
        updated_at: now,
      },
      create: {
        ...data,
        framework_id: framework.id,
        parent_id: parent?.id ?? null,
        created_at: now,
        updated_at: now,
      },
    });
  }

  await seedDepartmentData(prisma);

  const roleCount = await prisma.role.count();
  const userCount = await prisma.users.count();
  const departmentCount = await prisma.docs_departments.count();
  const criteriaCount = await prisma.docs_qa_criteria.count();
  console.log(
    `done — ${roleCount} role(s), ${userCount} user(s), ${departmentCount} QA department(s), ${criteriaCount} criteria in database`,
  );
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

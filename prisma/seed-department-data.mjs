/** @param {import('@prisma/client').PrismaClient} prisma */
export async function seedDepartmentData(prisma) {
  await prisma.docs_academic_years.upsert({ where: { year: 2569 }, update: {}, create: { year: 2569 } });
  for (const [code, name_th, sort_order] of [
    ["1", "ภาคการศึกษาที่ 1", 1], ["2", "ภาคการศึกษาที่ 2", 2], ["SUMMER", "ภาคฤดูร้อน", 3],
  ]) {
    await prisma.docs_semesters.upsert({ where: { code }, update: {}, create: { code, name_th, sort_order } });
  }
  for (let year = 1; year <= 6; year++) {
    await prisma.docs_study_years.upsert({ where: { year }, update: {}, create: { year } });
  }
  const department = await prisma.docs_departments.findUnique({ where: { code: "EDU" } });
  if (department) {
    for (const [code, name_th, sort_order, workflow] of [
      ["QAS", "งานประกันคุณภาพ", 5, "QAS"],
      ["CUR", "งานบริหารหลักสูตร", 6, "CUR"],
    ]) {
      const existing = await prisma.docs_sub_departments.findFirst({ where: { department_id: department.id, OR: [{ code }, { name_th }] } });
      const document_workflow = /** @type {'QAS' | 'CUR'} */ (workflow);
      if (existing) await prisma.docs_sub_departments.update({
        where: { id: existing.id }, data: { document_workflow },
      });
      else await prisma.docs_sub_departments.create({ data: {
        department_id: department.id, code, name_th, sort_order,
        document_workflow,
      } });
    }
  }
  for (const [code, years] of [["M.D.", [2553, 2565, 2570]], ["B.PMD.", [2553, 2559, 2564, 2569]]]) {
    const program = await prisma.docs_programs.findUnique({ where: { code } });
    if (!program) continue;
    for (const year of years) {
      await prisma.docs_curriculum_versions.upsert({
        where: { program_id_year: { program_id: program.id, year } }, update: {},
        create: { program_id: program.id, year, is_initial: year === 2553 },
      });
    }
  }
}

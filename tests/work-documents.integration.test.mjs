import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

test("database scopes, document types, file lifecycle, and master data validation", { skip: process.env.RUN_DB_TESTS !== "1" }, async () => {
  await import("dotenv/config");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return next(pathToFileURL(path.join(root, specifier.slice(2) + ".ts")).href, context);
    if (specifier.startsWith(".") && context.parentURL?.startsWith(pathToFileURL(root).href)) {
      const url = new URL(specifier, context.parentURL);
      if (!path.extname(url.pathname) && existsSync(fileURLToPath(url) + ".ts")) return next(url.href + ".ts", context);
    }
    return next(specifier, context);
  } });
  const { prisma } = await import("../lib/prisma.ts");
  const { listWorkDocuments, saveWorkDocument, deleteWorkDocument, resolveWorkScope } = await import("../lib/work-documents.ts");
  const { saveAcademicRecord } = await import("../lib/academic-data.ts");
  const { saveMasterRecord } = await import("../lib/master-data.ts");
  const { seedDepartmentData } = await import("../prisma/seed-department-data.mjs");
  const marker = `verification-${crypto.randomUUID()}`;
  let courseId, offeringId;
  try {
    const md = await prisma.docs_programs.findUniqueOrThrow({ where: { code: "M.D." } });
    const bpmd = await prisma.docs_programs.findUniqueOrThrow({ where: { code: "B.PMD." } });
    const year = await prisma.docs_academic_years.findUniqueOrThrow({ where: { year: 2569 } });
    const semester = await prisma.docs_semesters.findUniqueOrThrow({ where: { code: "1" } });
    const studyYear = await prisma.docs_study_years.findUniqueOrThrow({ where: { year: 1 } });
    const version = await prisma.docs_curriculum_versions.findUniqueOrThrow({ where: { program_id_year: { program_id: md.id, year: 2565 } } });
    const jobs = {};
    for (const workflow of ["QA", "CM", "TCH", "ASM", "ADM"]) jobs[workflow] = (await prisma.docs_sub_departments.findFirstOrThrow({ where: { document_workflow: workflow, department: { code: "EDU" } } })).code;
    const base = { departmentCode: "EDU", programCode: "M.D.", subDepartmentCode: jobs.QA, academicYearId: year.id };
    const course = await prisma.docs_courses.create({ data: { program_id: md.id, code: marker.slice(0, 30), name_th: marker } });
    courseId = course.id;
    const offering = await prisma.docs_course_offerings.create({ data: { course_id: courseId, academic_year_id: year.id, semester_id: semester.id, study_year_id: studyYear.id } });
    offeringId = offering.id;
    const teaching = { ...base, subDepartmentCode: jobs.TCH, courseOfferingId: offering.id };

    const createForm = (scope, type, filename = "verification.pdf") => {
      const form = new FormData();
      form.set("scope", JSON.stringify(scope)); form.set("documentType", type); form.set("title", marker);
      form.set("file", new File(["%PDF-1.4\nverification\n%%EOF"], filename, { type: "application/pdf" }));
      return form;
    };
    for (const [scope, type] of [
      [base, "SAR"], [base, "ACCREDITATION"], [base, "APR"], [base, "APR_RESULT"],
      [{ ...base, programCode: "B.PMD." }, "CAR"],
      [{ departmentCode: "EDU", programCode: "M.D.", subDepartmentCode: jobs.CM, curriculumVersionId: version.id }, "CURRICULUM"],
      [teaching, "TQF3"], [teaching, "TQF5"], [teaching, "EVALUATION"],
      [{ ...teaching, subDepartmentCode: jobs.ASM }, "STUDY_RESULT"],
      [{ ...base, subDepartmentCode: jobs.ADM }, "ADMISSION_ANNOUNCEMENT"],
    ]) {
      const saved = await saveWorkDocument(createForm(scope, type), marker);
      assert.equal(saved.ok, true, JSON.stringify(saved));
      const listed = await listWorkDocuments(scope, marker, false);
      assert.equal(listed.ok, true, JSON.stringify(listed));
      assert.ok(listed.documents.some((document) => document.title === marker && document.documentType === type));
    }
    assert.equal((await saveWorkDocument(createForm(base, "CAR"), marker)).ok, false);
    const qaJob = await prisma.docs_sub_departments.findFirstOrThrow({ where: { code: jobs.QA, department: { code: "EDU" } } });
    assert.equal((await saveMasterRecord("sub_departments", { ...qaJob, document_workflow: "CM" })).ok, false);
    assert.equal((await saveWorkDocument(createForm({ ...base, programCode: "B.PMD." }, "APR"), marker)).ok, false);
    assert.equal((await saveWorkDocument(createForm(teaching, "TQF3", "invalid.exe"), marker)).ok, false);
    await assert.rejects(resolveWorkScope({ ...teaching, programCode: "B.PMD." }));
    await assert.rejects(resolveWorkScope({ departmentCode: "EDU", programCode: "B.PMD.", subDepartmentCode: jobs.CM, curriculumVersionId: version.id }));
    await assert.rejects(resolveWorkScope({ ...base, academicYearId: undefined }));
    await assert.rejects(resolveWorkScope({ ...base, courseOfferingId: offering.id }));
    const mdDocs = await listWorkDocuments(base, marker, false);
    assert.equal(mdDocs.documents.filter((item) => item.title === marker).length, 4);
    const bpmdDocs = await listWorkDocuments({ ...base, programCode: "B.PMD." }, marker, false);
    assert.equal(bpmdDocs.documents.filter((item) => item.title === marker).length, 1);

    const testDocument = mdDocs.documents.find((item) => item.title === marker);
    assert.equal((await deleteWorkDocument(testDocument.id, "another-user", false)).ok, false);
    assert.equal((await deleteWorkDocument(testDocument.id, marker, false)).ok, true);
    assert.equal(existsSync(path.join(root, "public", testDocument.filePath)), false);
    assert.equal((await saveAcademicRecord("courses", { id: course.id, program_id: bpmd.id, code: course.code, name_th: course.name_th, is_active: true })).ok, false);
    assert.equal((await saveAcademicRecord("academic_years", { year: 2026 })).ok, false);
    assert.equal((await saveAcademicRecord("course_offerings", { course_id: courseId, academic_year_id: year.id, semester_id: semester.id, study_year_id: studyYear.id })).ok, false);
    const versionsBefore = await prisma.docs_curriculum_versions.count();
    await seedDepartmentData(prisma);
    assert.equal(await prisma.docs_curriculum_versions.count(), versionsBefore);
  } finally {
    const documents = await prisma.docs_work_documents.findMany({ where: { created_by: marker } });
    for (const document of documents) {
      await unlink(path.join(root, "public", "uploads", "work-documents", path.basename(document.file_path))).catch(() => undefined);
      await prisma.docs_work_documents.delete({ where: { id: document.id } });
    }
    if (offeringId) await prisma.docs_course_offerings.delete({ where: { id: offeringId } });
    if (courseId) await prisma.docs_courses.delete({ where: { id: courseId } });
    await prisma.$disconnect(); hook.deregister();
  }
});

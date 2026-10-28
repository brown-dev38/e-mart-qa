import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDepartmentDocumentCatalog,
  readDepartmentSelection,
} from "../lib/department-documents.ts";

function masterData() {
  return {
    academic_years: [], semesters: [], study_years: [], curriculum_versions: [], courses: [], course_offerings: [],
    departments: [
      { id: 1, code: "EDU", name_th: "การศึกษา", is_active: true, has_sub_department: true },
      { id: 2, code: "MGT", name_th: "บริหาร", is_active: true, has_sub_department: false },
      { id: 3, code: "OLD", name_th: "ปิดแล้ว", is_active: false, has_sub_department: true },
      { id: 4, code: "OTHER", name_th: "หน่วยงานใหม่", is_active: true, has_sub_department: true },
    ],
    sub_departments: [
      { id: 1, department_id: 1, code: "TCH", name_th: "การสอน", is_active: true },
      { id: 2, department_id: 1, code: "CUSTOM-QA", name_th: "ประกันคุณภาพ", is_active: true, document_workflow: "QAS" },
      { id: 3, department_id: 1, code: "OFF", name_th: "งานปิดแล้ว", is_active: false },
      { id: 4, department_id: 3, code: "QA", name_th: "อยู่ในหน่วยงานปิด", is_active: true },
      { id: 5, department_id: 4, code: "QA", name_th: "รหัสซ้ำต่างหน่วยงาน", is_active: true },
    ],
    frameworks: [
      { id: 1, code: "WFME", is_active: true },
      { id: 2, code: "AUN", is_active: true },
      { id: 3, code: "OLD", is_active: false },
    ],
    programs: [
      { id: 1, code: "M.D.", name_th: "แพทยศาสตร์", name_en: "Medicine", framework_id: 1, is_active: true },
      { id: 2, code: "B.PMD.", name_th: "ฉุกเฉินการแพทย์", name_en: null, framework_id: 2, is_active: true },
      { id: 3, code: "CLOSED", framework_id: 1, is_active: false },
      { id: 4, code: "OLD", framework_id: 3, is_active: true },
      { id: 5, code: "ORPHAN", framework_id: 99, is_active: true },
    ],
    criteria: [],
    document_levels: [],
  };
}

test("uses active database programs and their own frameworks, including nullable English names", () => {
  const catalog = buildDepartmentDocumentCatalog(masterData());
  assert.deepEqual(catalog.programs.map(({ value, framework }) => [value, framework]), [
    ["M.D.", "WFME"], ["B.PMD.", "AUN"],
  ]);
  assert.equal(catalog.programs[1].englishName, null);
});

test("includes new work types, excludes inactive parents and children, and distinguishes duplicate codes", () => {
  const { workTypes } = buildDepartmentDocumentCatalog(masterData());
  assert.deepEqual(workTypes.map(({ value }) => value), [
    "sub-department:1", "sub-department:2", "department:2", "sub-department:5",
  ]);
  assert.deepEqual(workTypes.filter(({ subDepartmentCode }) => subDepartmentCode === "QA" || subDepartmentCode === "CUSTOM-QA")
    .map(({ departmentCode }) => departmentCode), ["EDU", "OTHER"]);
  assert.equal(workTypes.find(({ value }) => value === "department:2").subDepartmentCode, null);
  assert.equal(workTypes.find(({ value }) => value === "sub-department:2").workflow, "QAS");
});

test("migrates saved selections to database codes and clears selections removed by an administrator", () => {
  const data = masterData();
  const catalog = buildDepartmentDocumentCatalog(data);
  assert.deepEqual(readDepartmentSelection({ curriculum: "md", workType: "teaching" }, catalog), {
    curriculum: "M.D.", workType: "sub-department:1",
  });
  assert.deepEqual(readDepartmentSelection({ curriculum: null, workType: "sub-department:2" }, catalog), {
    curriculum: null, workType: "sub-department:2",
  });
  assert.deepEqual(readDepartmentSelection({ curriculum: "B.PMD.", workType: "sub-department:2" }, catalog), {
    curriculum: "B.PMD.", workType: "sub-department:2",
  });
  assert.deepEqual(readDepartmentSelection({ curriculum: "CLOSED", workType: "sub-department:2" }, catalog), {
    curriculum: null, workType: null,
  });
  data.sub_departments[1].is_active = false;
  assert.deepEqual(readDepartmentSelection({ curriculum: "M.D.", workType: "sub-department:2" }, buildDepartmentDocumentCatalog(data)), {
    curriculum: "M.D.", workType: null,
  });
});

test("handles empty master data without falling back to hardcoded choices", () => {
  const data = masterData();
  data.programs = [];
  data.departments = [];
  const catalog = buildDepartmentDocumentCatalog(data);
  assert.deepEqual(catalog.programs, []);
  assert.deepEqual(catalog.workTypes, []);
  assert.deepEqual(readDepartmentSelection({ curriculum: "md", workType: "teaching" }, catalog), {
    curriculum: null, workType: null,
  });
});

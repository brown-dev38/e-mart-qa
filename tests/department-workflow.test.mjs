import assert from "node:assert/strict";
import test from "node:test";
import { getWorkFlow, curriculumVersionLabel } from "../lib/department-workflow.ts";

test("quality assurance documents follow each program's framework", () => {
  assert.deepEqual(getWorkFlow("QA", "WFME").types.map((type) => type.code), ["SAR", "ACCREDITATION", "APR", "APR_RESULT"]);
  assert.deepEqual(getWorkFlow("QA", "AUN").types.map((type) => type.code), ["SAR", "CAR"]);
  assert.deepEqual(getWorkFlow("QA", "UNKNOWN").types, []);
});
test("each work type requires the selectors and documents specified by the requirements", () => {
  assert.equal(getWorkFlow("CM", "WFME").mode, "version");
  assert.equal(getWorkFlow("TCH", "WFME").mode, "course");
  assert.equal(getWorkFlow("ASM", "AUN").mode, "course");
  assert.equal(getWorkFlow("ADM", "AUN").mode, "year");
  assert.deepEqual(getWorkFlow("TCH", "WFME").types.map((type) => type.code), ["TQF3", "TQF5", "EVALUATION"]);
  assert.deepEqual(getWorkFlow("ASM", "AUN").types.map((type) => type.code), ["STUDY_RESULT"]);
  assert.equal(getWorkFlow("STU", "WFME"), null);
  assert.equal(curriculumVersionLabel({ year: 2553, is_initial: true }), "หลักสูตรใหม่ พ.ศ. 2553");
  assert.equal(curriculumVersionLabel({ year: 2569, is_initial: false }), "ฉบับปรับปรุง พ.ศ. 2569");
});

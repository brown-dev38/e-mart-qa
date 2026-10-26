import assert from "node:assert/strict";
import test from "node:test";
import { buildDocumentPrefix, readDocumentDraft } from "../lib/quality-document-catalog.ts";

const catalog = {
  departments: [
    { value: "MGT", label: "บริหาร", hasSubDepartment: false },
    { value: "EDU", label: "การศึกษา", hasSubDepartment: true },
  ],
  subDepartments: { EDU: [{ value: "QA", label: "ประกันคุณภาพ" }] },
  programs: [{ value: "M.D.", label: "แพทยศาสตร์", name: "แพทยศาสตร์", framework: "WFME" }],
  levels: [{ value: "SP", label: "ระเบียบปฏิบัติ" }, { value: "WI", label: "วิธีปฏิบัติงาน" }],
  criteria: {},
  criterionCodes: { WFME: ["W1.1.1"] },
};
const values = { department: "MGT", curriculum: "M.D.", level: "SP", title: "เอกสาร", description: "" };

test("SP codes omit the criterion, including a selection left over from another level", () => {
  assert.equal(buildDocumentPrefix(values, catalog), "MGT-M.D.-SP");
  assert.equal(buildDocumentPrefix({ ...values, criterion: "W1.1.1" }, catalog), "MGT-M.D.-SP");
  assert.equal(buildDocumentPrefix({ ...values, department: "EDU", job: "QA" }, catalog), "EDU-QA-M.D.-SP");
});

test("SP still requires the other classification fields and a valid subdepartment", () => {
  for (const field of ["department", "curriculum", "level"]) {
    assert.equal(buildDocumentPrefix({ ...values, [field]: undefined }, catalog), null);
  }
  assert.equal(buildDocumentPrefix({ ...values, department: "EDU" }, catalog), null);
  assert.equal(buildDocumentPrefix({ ...values, department: "EDU", job: "UNKNOWN" }, catalog), null);
});

test("other document levels continue to require a valid criterion", () => {
  assert.equal(buildDocumentPrefix({ ...values, level: "WI" }, catalog), null);
  assert.equal(buildDocumentPrefix({ ...values, level: "WI", criterion: "INVALID" }, catalog), null);
  assert.equal(buildDocumentPrefix({ ...values, level: "WI", criterion: "W1.1.1" }, catalog), "MGT-M.D.-WI-W1.1.1");
});

test("restoring a saved SP draft clears its previous criterion while preserving other levels", () => {
  const restore = level => readDocumentDraft(JSON.stringify({ values: { ...values, level, criterion: "W1.1.1" }, hadAttachment: true }), catalog);
  const sp = restore("SP");
  assert.equal(sp.values.criterion, undefined);
  assert.equal(sp.values.level, "SP");
  assert.equal(sp.hadAttachment, true);
  assert.equal(restore("WI").values.criterion, "W1.1.1");
});

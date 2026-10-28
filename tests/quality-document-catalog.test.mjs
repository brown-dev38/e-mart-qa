import assert from "node:assert/strict";
import test, { after } from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL) {
    const url = new URL(specifier, context.parentURL);
    if (!url.pathname.split("/").pop().includes(".") && existsSync(fileURLToPath(url) + ".ts")) return next(url.href + ".ts", context);
  }
  return next(specifier, context);
} });
const { buildDocumentPrefix, readDocumentDraft } = await import("../lib/quality-document-catalog.ts");
after(() => hook.deregister());

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

test("saved form drafts preserve the effective date and the selected existing document", () => {
  const restore = effectiveDate => readDocumentDraft(JSON.stringify({ values: { ...values, documentMode: "revision", documentId: "42", effectiveDate } }), catalog).values;
  assert.equal(restore("2030-01-01").effectiveDate, "2030-01-01");
  assert.equal(restore("2030-01-01").documentMode, "revision");
  assert.equal(restore("2030-01-01").documentId, "42");
  assert.equal(restore("2030-02-30").effectiveDate, undefined);
});

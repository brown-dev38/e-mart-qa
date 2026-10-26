import assert from "node:assert/strict";
import test from "node:test";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("SP creation works through the running Server Action with and without an attachment", { skip: process.env.RUN_HTTP_TESTS !== "1", timeout: 120_000 }, async () => {
  await import("dotenv/config");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaMariaDb } = await import("@prisma/adapter-mariadb");
  const { encode } = await import("next-auth/jwt");
  const { encodeReply } = await import("next/dist/compiled/react-server-dom-webpack/client.node.js");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const base = new URL(process.env.NEXT_TEST_URL || "http://localhost:3000");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "HTTP test must use a local server");
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
  const marker = "SPHTTP" + crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  let user, reviewer, department, framework, program;
  const files = new Set();
  try {
    const role = await prisma.role.findFirstOrThrow({ where: { name: "admin" } });
    await prisma.docs_document_levels.findFirstOrThrow({ where: { code: "SP", is_active: true } });
    user = await prisma.users.create({ data: { username: marker, role_id: role.id, is_active: true, created_at: new Date(), updated_at: new Date() } });
    reviewer = await prisma.users.create({ data: { username: `${marker}-reviewer`, role_id: role.id, is_active: true, created_at: new Date(), updated_at: new Date() } });
    department = await prisma.docs_departments.create({ data: { code: marker, name_th: marker, has_sub_department: false } });
    framework = await prisma.docs_accreditation_frameworks.create({ data: { code: marker, name_th: marker, prefix_char: "W" } });
    program = await prisma.docs_programs.create({ data: { code: marker, name_th: marker, framework_id: framework.id } });
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { uid: String(user.id), sub: String(user.id), name: marker, role: "admin" }, maxAge: 600 });
    const cookie = `next-auth.session-token=${token}`;
    const reviewerToken = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { uid: String(reviewer.id), sub: String(reviewer.id), role: "admin" }, maxAge: 600 });
    const reviewerCookie = `next-auth.session-token=${reviewerToken}`;
    const warm = await fetch(base, { headers: { cookie }, signal: AbortSignal.timeout(45_000) });
    assert.equal(warm.status, 200);
    await warm.arrayBuffer();
    const manifest = JSON.parse(await readFile(path.join(root, ".next/dev/server/server-reference-manifest.json"), "utf8"));
    const actionIds = new Map(Object.entries(manifest.node).map(([id, action]) => [action.exportedName, id]));
    assert.ok(actionIds.has("saveQualityDocumentAction"));
    async function action(name, args, actionCookie = cookie) {
      const response = await fetch(base, {
        method: "POST", headers: { cookie: actionCookie, Origin: base.origin, "Next-Action": actionIds.get(name) },
        body: await encodeReply(args), signal: AbortSignal.timeout(45_000),
      });
      const body = await response.text();
      assert.equal(response.status, 200);
      const result = body.split("\n").flatMap(line => {
        try { return [JSON.parse(line.slice(line.indexOf(":") + 1))]; } catch { return []; }
      }).find(value => value && typeof value.ok === "boolean");
      assert.ok(result, "Server Action returns a result");
      return result;
    }
    for (const withFile of [false, true]) {
      const form = new FormData();
      for (const [key, value] of Object.entries({ department: marker, program: marker, level: "SP", title: marker })) form.set(key, value);
      if (withFile) form.set("file", new File(["%PDF-1.4\nSP test\n%%EOF"], "procedure.pdf", { type: "application/pdf" }));
      const result = await action("saveQualityDocumentAction", [form]);
      assert.equal(result.ok, true, result.error);
      const row = await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: BigInt(result.documentId) }, include: { revisions: true } });
      assert.equal(row.criterion_id, null);
      assert.equal(row.document_code, `${marker}-${marker}-SP-${withFile ? "002" : "001"}`);
      assert.equal(row.revisions.length, 1);
      assert.equal(row.revisions[0].file_name, withFile ? "procedure.pdf" : null);
      assert.equal(row.current_version, null);
      assert.equal(row.revisions[0].version_label, "DRAFT");
      if (row.revisions[0].file_path) files.add(row.revisions[0].file_path);
    }
    const listed = await action("listQualityDocumentsAction", [{ departmentCode: marker }]);
    assert.equal(listed.ok, true, listed.error);
    assert.equal(listed.documents.length, 2);
    assert.ok(listed.documents.every(doc => doc.criterion_code === null && doc.framework_code === marker));
    const documentId = listed.documents.find(doc => doc.file_name)?.id;
    assert.ok(documentId);
    const ok = result => { assert.equal(result.ok, true, result.error); return result; };
    let detail = ok(await action("qualityWorkflowDetailAction", [documentId])).detail;
    const form = new FormData();
    for (const [key, value] of Object.entries({ revisionId: detail.revisions[0].id, lockVersion: String(detail.revisions[0].lockVersion), title: marker,
      description: "HTTP document control", changeNote: "จัดทำครั้งแรก", changeReason: "กำหนดขั้นตอนการทำงาน" })) form.set(key, value);
    ok(await action("saveAndSubmitQualityRevisionAction", [form]));
    detail = ok(await action("qualityWorkflowDetailAction", [documentId])).detail;
    const command = actionName => ({ revisionId: detail.revisions[0].id, lockVersion: detail.revisions[0].lockVersion, action: actionName,
      effectiveDate: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) });
    assert.equal((await action("transitionQualityRevisionAction", [command("approve")], reviewerCookie)).ok, false, "HTTP approval requires review first");
    assert.equal((await action("transitionQualityRevisionAction", [command("review")])).ok, false, "HTTP self review is forbidden");
    ok(await action("transitionQualityRevisionAction", [command("review")], reviewerCookie));
    detail = ok(await action("qualityWorkflowDetailAction", [documentId])).detail;
    ok(await action("transitionQualityRevisionAction", [command("approve")], reviewerCookie));
    detail = ok(await action("qualityWorkflowDetailAction", [documentId])).detail;
    assert.equal(detail.currentVersion, "000");
    assert.equal(detail.revisions[0].reviewedBy, reviewer.username);
    assert.equal(detail.revisions[0].approvedBy, reviewer.username);
    const download = await fetch(new URL(detail.revisions[0].fileUrl, base), { headers: { cookie } });
    assert.equal(download.status, 200);
    await download.arrayBuffer();
    ok(await action("updateQualityRegistryAction", [{ documentId, lockVersion: detail.registryVersion, storageLocation: "ตู้ A", reason: "จัดระเบียบเอกสาร" }]));
    detail = ok(await action("qualityWorkflowDetailAction", [documentId])).detail;
    assert.equal(detail.currentVersion, "000");
    assert.equal(detail.registryChanges[0].reason, "จัดระเบียบเอกสาร");
    ok(await action("withdrawQualityDocumentAction", [{ documentId, lockVersion: detail.registryVersion, reason: "ยกเลิกเอกสารทดสอบ" }], reviewerCookie));
    const denied = await fetch(new URL(detail.revisions[0].fileUrl, base), { headers: { cookie } });
    assert.equal(denied.status, 404);
    await denied.arrayBuffer();
    detail = ok(await action("qualityWorkflowDetailAction", [documentId])).detail;
    assert.equal(detail.revisions[0].status, "WITHDRAWN");
  } finally {
    if (department) {
      const rows = await prisma.docs_qa_documents.findMany({ where: { department_id: department.id }, include: { revisions: { include: { submissions: true } } } });
      for (const row of rows) {
        for (const revision of row.revisions) if (revision.file_path) files.add(revision.file_path);
        for (const revision of row.revisions) for (const submission of revision.submissions) files.add(submission.file_path);
        await prisma.audit_logs.deleteMany({ where: { entity_type: "QUALITY_DOCUMENT", entity_id: String(row.id) } });
      }
      await prisma.docs_qa_documents.deleteMany({ where: { department_id: department.id } });
    }
    for (const file of files) {
      assert.match(file, /^storage\/qa-documents\/[\da-f-]+\.pdf$/);
      await unlink(path.join(root, file)).catch(() => undefined);
    }
    if (program) await prisma.docs_programs.delete({ where: { id: program.id } });
    if (framework) await prisma.docs_accreditation_frameworks.delete({ where: { id: framework.id } });
    if (department) await prisma.docs_departments.delete({ where: { id: department.id } });
    if (user) await prisma.users.delete({ where: { id: user.id } });
    if (reviewer) await prisma.users.delete({ where: { id: reviewer.id } });
    await prisma.$disconnect();
  }
});

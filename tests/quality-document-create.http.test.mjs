import assert from "node:assert/strict";
import test from "node:test";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

test("dated SP creation and revision replacement work through the running Server Actions", { skip: process.env.RUN_HTTP_TESTS !== "1", timeout: 120_000 }, async () => {
  await import("dotenv/config");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaMariaDb } = await import("@prisma/adapter-mariadb");
  const { encode } = await import("next-auth/jwt");
  const { encodeReply } = await import("next/dist/compiled/react-server-dom-webpack/client.node.js");
  const base = new URL(process.env.NEXT_TEST_URL || "http://localhost:3000");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
  const marker = "SPHTTP" + crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 31 * 3600000).toISOString().slice(0, 10);
  const users = [], cookies = {};
  let department, framework, program;
  const bytes = Buffer.from("%PDF-1.4\nDated SP test\n%%EOF");
  try {
    for (const name of ["owner", "outsider"]) {
      const role = await prisma.role.findFirstOrThrow({ where: { name: "user", is_active: true } });
      const user = await prisma.users.create({ data: { username: `${marker}-${name}`, role_id: role.id, created_at: new Date(), updated_at: new Date() } });
      users.push(user);
      cookies[name] = `next-auth.session-token=${await encode({ secret: process.env.NEXTAUTH_SECRET, token: { uid: String(user.id), sub: String(user.id), role: "user" }, maxAge: 180 })}`;
    }
    department = await prisma.docs_departments.create({ data: { code: marker, name_th: marker, has_sub_department: true } });
    const job = await prisma.docs_sub_departments.create({ data: { department_id: department.id, code: "QA", name_th: "งานประกันคุณภาพ" } });
    await prisma.docs_sub_departments.create({ data: { department_id: department.id, code: "OLD", name_th: "งานที่ปิดใช้", is_active: false } });
    framework = await prisma.docs_accreditation_frameworks.create({ data: { code: marker, name_th: marker, prefix_char: "W" } });
    program = await prisma.docs_programs.create({ data: { code: marker, name_th: marker, framework_id: framework.id } });
    const warm = await fetch(base, { headers: { cookie: cookies.owner } }); assert.equal(warm.status, 200); await warm.arrayBuffer();
    const manifest = JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json", "utf8"));
    const actions = new Map(Object.entries(manifest.node).map(([id, action]) => [action.exportedName, id]));
    async function action(name, args, actor = "owner") {
      assert.ok(actions.has(name), name);
      const response = await fetch(base, { method: "POST", headers: { cookie: cookies[actor], Origin: base.origin, "Next-Action": actions.get(name) }, body: await encodeReply(args), signal: AbortSignal.timeout(45_000) });
      assert.equal(response.status, 200);
      const result = (await response.text()).split("\n").flatMap(line => {
        try { return [JSON.parse(line.slice(line.indexOf(":") + 1))]; } catch { return []; }
      }).find(value => value && typeof value.ok === "boolean");
      assert.ok(result); return result;
    }
    const form = (date = tomorrow, documentId) => {
      const value = new FormData();
      for (const [key, entry] of Object.entries({ department: marker, program: marker, level: "SP", title: marker, effectiveDate: date })) value.set(key, entry);
      if (documentId) value.set("documentId", documentId);
      value.set("file", new File([bytes], "procedure.pdf", { type: "application/pdf" }));
      return value;
    };
    for (const date of ["", "2026-02-30", "2000-01-01"]) assert.equal((await action("saveQualityDocumentAction", [form(date)])).ok, false);
    const noAttachment = form(); noAttachment.delete("file");
    assert.equal((await action("saveQualityDocumentAction", [noAttachment])).ok, false);
    for (const jobCode of ["UNKNOWN", "OLD"]) {
      const invalid = form(); invalid.set("job", jobCode);
      assert.equal((await action("saveQualityDocumentAction", [invalid])).ok, false);
    }
    const saved = await action("saveQualityDocumentAction", [form()]);
    assert.equal(saved.ok, true, saved.error); assert.equal(saved.status, "DRAFT");
    assert.equal(saved.documentCode, `${marker}-${marker}-SP-001`);
    let row = await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: BigInt(saved.documentId) }, include: { revisions: true } });
    assert.equal(row.sub_department_id, null, "departments with jobs may save a document without selecting one");
    const first = row.revisions[0]; assert.equal(row.criterion_id, null); assert.equal(first.auto_publish, true);
    let listed = await action("listQualityDocumentsAction", [{ departmentCode: marker }]);
    assert.equal(listed.documents[0].scheduled_effective_date, tomorrow); assert.equal(listed.documents[0].file_path, null);
    await prisma.docs_qa_document_revisions.update({ where: { id: first.id }, data: { effective_date: new Date(`${today}T00:00:00Z`) } });
    listed = await action("listQualityDocumentsAction", [{ departmentCode: marker }]);
    assert.equal(listed.documents[0].status, "PUBLISHED"); assert.equal(listed.documents[0].current_version, "000");
    const oldUrl = listed.documents[0].file_path;
    const scheduled = await action("saveQualityDocumentAction", [form(tomorrow, saved.documentId)]);
    assert.equal(scheduled.ok, true, scheduled.error); assert.equal(scheduled.status, "DRAFT");
    assert.equal((await action("saveQualityDocumentAction", [form(tomorrow, saved.documentId)], "outsider")).ok, false);
    listed = await action("listQualityDocumentsAction", [{ departmentCode: marker }]);
    assert.equal(listed.documents[0].current_version, "000"); assert.equal(listed.documents[0].file_path, oldUrl); assert.equal(listed.documents[0].scheduled_is_draft, true);
    row = await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: row.id }, include: { revisions: { orderBy: { id: "desc" } } } });
    const second = row.revisions[0]; assert.equal(second.status, "DRAFT"); assert.equal(second.version_label, "001");
    const oldFile = await fetch(new URL(oldUrl, base), { headers: { cookie: cookies.outsider } }); assert.equal(oldFile.status, 200); assert.deepEqual(Buffer.from(await oldFile.arrayBuffer()), bytes);
    const futureFile = await fetch(new URL(`/api/quality-documents/revisions/${second.id}/file`, base), { headers: { cookie: cookies.owner } }); assert.equal(futureFile.status, 404);
    assert.ok(!(await action("listQualityRevisionTargetsAction", [])).documents.some(document => document.id === saved.documentId));
    await prisma.docs_qa_document_revisions.update({ where: { id: second.id }, data: { effective_date: new Date(`${today}T00:00:00Z`) } });
    const activeFile = await fetch(new URL(`/api/quality-documents/revisions/${second.id}/file`, base), { headers: { cookie: cookies.outsider } }); assert.equal(activeFile.status, 200); assert.deepEqual(Buffer.from(await activeFile.arrayBuffer()), bytes);
    const replacedFile = await fetch(new URL(oldUrl, base), { headers: { cookie: cookies.outsider } }); assert.equal(replacedFile.status, 404);
    const detail = await action("qualityDocumentVersionsAction", [saved.documentId]);
    assert.equal(detail.detail.currentVersion, "001"); assert.deepEqual(detail.detail.versions.map(version => version.state), ["EFFECTIVE", "SUPERSEDED"]);
    assert.equal(await prisma.docs_qa_submissions.count({ where: { revision: { document_id: row.id } } }), 0);
    assert.equal(await prisma.docs_qa_review_events.count({ where: { revision: { document_id: row.id }, action: { in: ["SUBMIT", "REVIEW", "APPROVE"] } } }), 0);
    const withJob = form(); withJob.set("job", "QA");
    const savedWithJob = await action("saveQualityDocumentAction", [withJob]);
    assert.equal(savedWithJob.ok, true, savedWithJob.error);
    assert.equal(savedWithJob.documentCode, `${marker}-QA-${marker}-SP-001`);
    assert.equal((await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: BigInt(savedWithJob.documentId) } })).sub_department_id, job.id);
    const withoutJob = form(); withoutJob.set("job", "");
    const consecutive = await Promise.all([action("saveQualityDocumentAction", [withoutJob]), action("saveQualityDocumentAction", [form()])]);
    for (const result of consecutive) assert.equal(result.ok, true, result.error);
    assert.deepEqual(consecutive.map(result => result.documentCode).sort(), [`${marker}-${marker}-SP-002`, `${marker}-${marker}-SP-003`], "documents without a job have a separate sequence");
  } finally {
    if (department) {
      const documents = await prisma.docs_qa_documents.findMany({ where: { department_id: department.id }, include: { revisions: true } });
      await prisma.audit_logs.deleteMany({ where: { entity_type: "QUALITY_DOCUMENT", entity_id: { in: documents.map(document => String(document.id)) } } });
      await prisma.docs_qa_documents.deleteMany({ where: { department_id: department.id } });
      for (const document of documents) for (const revision of document.revisions) if (revision.file_path) await unlink(path.join(process.cwd(), revision.file_path)).catch(() => undefined);
    }
    if (program) await prisma.docs_programs.delete({ where: { id: program.id } });
    if (framework) await prisma.docs_accreditation_frameworks.delete({ where: { id: framework.id } });
    if (department) {
      await prisma.docs_sub_departments.deleteMany({ where: { department_id: department.id } });
      await prisma.docs_departments.delete({ where: { id: department.id } });
    }
    await prisma.users.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await prisma.$disconnect();
  }
});

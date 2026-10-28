import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("only approved files can be downloaded for use; review access is limited to owners and reviewers", { skip: process.env.RUN_HTTP_TESTS !== "1", timeout: 120_000 }, async () => {
  await import("dotenv/config");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaMariaDb } = await import("@prisma/adapter-mariadb");
  const { encode } = await import("next-auth/jwt");
  const { encodeReply } = await import("next/dist/compiled/react-server-dom-webpack/client.node.js");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const base = new URL(process.env.NEXT_TEST_URL || "http://localhost:3000");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
  const marker = "DL" + randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
  const users = [], cookies = {}, files = new Set();
  let department, framework, program, document;
  const bytes = Buffer.from("%PDF-1.4\nDownload policy regression\n%%EOF");
  async function fixtureFile(legacy = false) {
    const file = `${legacy ? "public/uploads" : "storage"}/qa-documents/${randomUUID()}.pdf`;
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), bytes);
    files.add(file);
    return legacy ? file.slice("public".length) : file;
  }
  try {
    for (const [name, roleName, active] of [["owner", "user", true], ["reviewer", "admin", true], ["outsider", "user", true], ["disabled", "admin", false]]) {
      const role = await prisma.role.findFirstOrThrow({ where: { name: roleName, is_active: true } });
      const user = await prisma.users.create({ data: { username: `${marker}-${name}`, role_id: role.id, is_active: active, created_at: new Date(), updated_at: new Date() } });
      users.push(user);
      const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { uid: String(user.id), sub: String(user.id), role: roleName }, maxAge: 600 });
      cookies[name] = `next-auth.session-token=${token}`;
    }
    const warm = await fetch(base, { headers: { cookie: cookies.owner }, signal: AbortSignal.timeout(45_000) });
    assert.equal(warm.status, 200);
    await warm.arrayBuffer();
    const manifest = JSON.parse(await readFile(path.join(root, ".next/dev/server/server-reference-manifest.json"), "utf8"));
    const actionIds = new Map(Object.entries(manifest.node).map(([id, action]) => [action.exportedName, id]));
    async function action(name, args, actor = "owner") {
      const response = await fetch(base, {
        method: "POST", headers: { cookie: cookies[actor], Origin: base.origin, "Next-Action": actionIds.get(name) },
        body: await encodeReply(args), signal: AbortSignal.timeout(45_000),
      });
      assert.equal(response.status, 200);
      const result = (await response.text()).split("\n").flatMap(line => {
        try { return [JSON.parse(line.slice(line.indexOf(":") + 1))]; } catch { return []; }
      }).find(value => value && typeof value.ok === "boolean");
      assert.equal(result?.ok, true, result?.error);
      return result;
    }
    department = await prisma.docs_departments.create({ data: { code: marker, name_th: marker, has_sub_department: false } });
    framework = await prisma.docs_accreditation_frameworks.create({ data: { code: marker, name_th: marker, prefix_char: "W" } });
    program = await prisma.docs_programs.create({ data: { code: marker, name_th: marker, framework_id: framework.id } });
    const level = await prisma.docs_document_levels.findFirstOrThrow({ where: { code: "SP", is_active: true } });
    const draftPath = await fixtureFile();
    document = await prisma.docs_qa_documents.create({ data: {
      document_code: marker, title: marker, created_by: String(users[0].id),
      department_id: department.id, program_id: program.id, document_level_id: level.id,
      revisions: { create: { version_label: "DRAFT", open_slot: 1, title: marker, uploaded_by: String(users[0].id), file_path: draftPath, file_name: "procedure.pdf", file_size_bytes: BigInt(bytes.length) } },
    }, include: { revisions: true } });
    const revision = document.revisions[0];
    const revisionUrl = `/api/quality-documents/revisions/${revision.id}/file`;
    async function get(url, actor, status, expectedName) {
      const response = await fetch(new URL(url, base), { headers: actor ? { cookie: cookies[actor] } : {}, signal: AbortSignal.timeout(30_000) });
      assert.equal(response.status, status, `${actor || "anonymous"}: ${url}`);
      if (status === 200) {
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        const disposition = decodeURIComponent(response.headers.get("content-disposition"));
        assert.equal(disposition.includes("สำหรับตรวจทาน-"), false);
        if (expectedName) assert.equal(disposition, `attachment; filename*=UTF-8''${expectedName}`);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
      } else await response.arrayBuffer();
    }
    async function restricted(url) {
      for (const actor of ["owner", "reviewer", "outsider"]) await get(url, actor, 404);
      for (const actor of ["owner", "reviewer"]) await get(`${url}?purpose=review`, actor, 200);
      await get(`${url}?purpose=review`, "outsider", 404);
      await get(url, "disabled", 401);
      await get(`${url}?purpose=review`, "disabled", 401);
      await get(url, null, 401);
      await get(`${url}?purpose=review`, null, 401);
    }
    await restricted(revisionUrl);
    let detail = (await action("qualityDocumentVersionsAction", [String(document.id)])).detail;
    assert.equal(detail.versions[0].fileName, "procedure.pdf");
    assert.equal(detail.versions[0].downloadUrl, null);
    assert.equal(Object.hasOwn(detail.versions[0], "fileUrl"), false);
    assert.equal(detail.versions[0].previewUrl, `/api/quality-documents/revisions/${revision.id}/preview`);
    assert.equal((await action("listQualityDocumentsAction", [{ departmentCode: marker }])).documents[0].file_path, null);
    const evidencePath = await fixtureFile();
    const submission = await prisma.docs_qa_submissions.create({ data: {
      revision_id: revision.id, round_no: 1, target_revision_no: 1, title: marker,
      file_path: evidencePath, file_name: "procedure.pdf", file_size_bytes: BigInt(bytes.length),
      file_sha256: createHash("sha256").update(bytes).digest("hex"), submitted_by: String(users[0].id), submitted_name: marker, submitted_at: new Date(),
    } });
    const submissionUrl = `/api/quality-documents/submissions/${submission.id}/file`;
    await prisma.docs_qa_document_revisions.update({ where: { id: revision.id }, data: { status: "PENDING" } });
    await restricted(revisionUrl);
    await restricted(submissionUrl);
    assert.equal((await action("listQualityDocumentsAction", [{ departmentCode: marker }])).documents[0].file_path, null);
    await prisma.docs_qa_submissions.update({ where: { id: submission.id }, data: { status: "RETURNED" } });
    await prisma.docs_qa_document_revisions.update({ where: { id: revision.id }, data: { status: "DRAFT" } });
    await restricted(revisionUrl);
    await restricted(submissionUrl);
    await prisma.docs_qa_submissions.update({ where: { id: submission.id }, data: { status: "APPROVED" } });
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.docs_qa_document_revisions.update({ where: { id: revision.id }, data: { status: "APPROVED", version_label: "000", open_slot: null, revision_number: 0, effective_date: futureDate } });
    await restricted(revisionUrl);
    await restricted(submissionUrl);
    const scheduled = (await action("listQualityDocumentsAction", [{ departmentCode: marker }])).documents[0];
    assert.equal(scheduled.status, "DRAFT");
    assert.equal(scheduled.current_version, null);
    assert.equal(scheduled.scheduled_version, "000");
    assert.equal(scheduled.file_path, null, "an approved revision cannot be downloaded before its effective date");
    await prisma.docs_qa_document_revisions.update({ where: { id: revision.id }, data: { effective_date: null } });
    await prisma.docs_qa_documents.update({ where: { id: document.id }, data: { status: "PUBLISHED", current_version: "000", approved_revision_no: 0, file_path: revisionUrl } });
    for (const actor of ["owner", "reviewer", "outsider"]) await get(revisionUrl, actor, 200);
    await get(revisionUrl, "disabled", 401);
    for (const actor of ["owner", "reviewer"]) await get(submissionUrl, actor, 200);
    await get(submissionUrl, "outsider", 404);
    detail = (await action("qualityDocumentVersionsAction", [String(document.id)])).detail;
    assert.equal(detail.versions[0].state, "EFFECTIVE");
    assert.equal(detail.versions[0].downloadUrl, revisionUrl);
    assert.equal(Object.hasOwn(detail.versions[0], "fileUrl"), false);
    assert.equal((await action("listQualityDocumentsAction", [{ departmentCode: marker }])).documents[0].file_path, revisionUrl);
    const nextDraft = await prisma.docs_qa_document_revisions.create({ data: { document_id: document.id, version_label: "DRAFT", open_slot: 1, title: marker, file_path: draftPath, file_name: "next.pdf" } });
    await restricted(`/api/quality-documents/revisions/${nextDraft.id}/file`);
    assert.equal((await action("listQualityDocumentsAction", [{ departmentCode: marker }])).documents[0].file_path, revisionUrl, "the approved download stays available while the next revision is a draft");
    await prisma.docs_qa_document_revisions.update({ where: { id: nextDraft.id }, data: { status: "APPROVED", version_label: "001", revision_number: 1, open_slot: null, effective_date: futureDate } });
    await restricted(`/api/quality-documents/revisions/${nextDraft.id}/file`);
    const current = (await action("listQualityDocumentsAction", [{ departmentCode: marker }])).documents[0];
    assert.equal(current.status, "PUBLISHED");
    assert.equal(current.current_version, "000");
    assert.equal(current.scheduled_version, "001");
    assert.equal(current.file_path, revisionUrl, "a future revision must not replace the currently effective download");
    await get(revisionUrl, "outsider", 200);
    await prisma.docs_qa_documents.update({ where: { id: document.id }, data: { status: "ARCHIVED" } });
    for (const actor of ["owner", "reviewer", "outsider"]) await get(revisionUrl, actor, 404);
    for (const actor of ["owner", "reviewer"]) await get(submissionUrl, actor, 404);
    assert.equal((await action("listQualityDocumentsAction", [{ departmentCode: marker }])).documents[0].file_path, null);
    await prisma.docs_qa_documents.update({ where: { id: document.id }, data: { status: "PUBLISHED", deleted_at: new Date() } });
    for (const actor of ["owner", "reviewer", "outsider"]) await get(revisionUrl, actor, 404);
    for (const actor of ["owner", "reviewer"]) await get(submissionUrl, actor, 404);
    await get(`${revisionUrl}?purpose=review`, "reviewer", 200);
    await get(`${submissionUrl}?purpose=review`, "reviewer", 200);
    const retained = (await action("qualityDocumentVersionsAction", [String(document.id)], "reviewer")).detail;
    const retainedRevision = retained.versions.find(row => row.id === String(revision.id));
    assert.equal(retained.deleted, true);
    assert.equal(retainedRevision.previewUrl, `/api/quality-documents/revisions/${revision.id}/preview`);
    assert.equal(retainedRevision.downloadUrl, null);
    assert.equal(Object.hasOwn(retainedRevision, "fileUrl"), false);
    assert.equal(Object.hasOwn(retainedRevision, "submissions"), false);
    assert.equal((await action("listQualityDocumentsAction", [{ departmentCode: marker }], "reviewer")).documents.length, 0);
    await prisma.docs_qa_documents.update({ where: { id: document.id }, data: { deleted_at: null } });
    const legacyPath = await fixtureFile(true);
    await get(legacyPath, "reviewer", 404);
    await get(legacyPath, null, 404);
    await get(legacyPath.replace("qa-documents", "%71a-documents"), null, 404);
    await get(legacyPath.replace("qa-documents", "QA-documents"), null, 404);
    await get(legacyPath.replace("uploads", "%75ploads"), null, 404);
    const originalName = "ระเบียบปฏิบัติระบบเอกสารคุณภาพ.pdf";
    const importedName = "ระเบียบปฏิบัติระบบเอกสารคุณภาพ (2).pdf";
    await prisma.docs_qa_submissions.update({ where: { id: submission.id }, data: { file_name: `สำหรับตรวจทาน-${importedName}` } });
    for (const url of [revisionUrl, submissionUrl]) {
      await get(url, "owner", 200, originalName);
      await get(`${url}?purpose=review`, "reviewer", 200, originalName);
    }
    // Imported approved revisions can still be read through the checked endpoint.
    await prisma.docs_qa_submissions.delete({ where: { id: submission.id } });
    await prisma.docs_qa_document_revisions.update({ where: { id: revision.id }, data: { file_path: legacyPath, file_name: `สำหรับตรวจทาน-สำหรับตรวจทาน-${importedName}` } });
    await get(revisionUrl, "outsider", 200, originalName);
    await get(`${revisionUrl}?purpose=review`, "reviewer", 200, originalName);
  } finally {
    if (document) await prisma.docs_qa_documents.delete({ where: { id: document.id } });
    for (const file of files) await unlink(path.join(root, file)).catch(() => undefined);
    if (program) await prisma.docs_programs.delete({ where: { id: program.id } });
    if (framework) await prisma.docs_accreditation_frameworks.delete({ where: { id: framework.id } });
    if (department) await prisma.docs_departments.delete({ where: { id: department.id } });
    for (const user of users) await prisma.users.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});

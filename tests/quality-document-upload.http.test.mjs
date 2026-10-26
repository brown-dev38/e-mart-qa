import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Exercise the actual Proxy + Server Action pipeline, not only the save function.
// Start `next dev` first; all mutations use a temporary user and document.
test("quality draft saves metadata and complete uploads through HTTP up to 20 MiB", { skip: process.env.RUN_HTTP_TESTS !== "1", timeout: 120_000 }, async () => {
  await import("dotenv/config");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaMariaDb } = await import("@prisma/adapter-mariadb");
  const { encode } = await import("next-auth/jwt");
  const { encodeReply } = await import("next/dist/compiled/react-server-dom-webpack/client.node.js");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const base = new URL(process.env.NEXT_TEST_URL || "http://localhost:3000");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "HTTP test must use a local server");
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
  const files = new Set();
  let user, document;
  try {
    const role = await prisma.role.findFirstOrThrow({ where: { name: "admin" } });
    const source = await prisma.docs_qa_documents.findFirstOrThrow({ where: { deleted_at: null } });
    const marker = "HTTPUPLOAD" + crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    user = await prisma.users.create({ data: { username: marker, role_id: role.id, is_active: true, created_at: new Date(), updated_at: new Date() } });
    document = await prisma.docs_qa_documents.create({ data: {
      document_code: marker, sequence_no: null, title: marker, created_by: String(user.id),
      department_id: source.department_id, program_id: source.program_id, document_level_id: source.document_level_id, criterion_id: source.criterion_id,
      revisions: { create: { version_label: "000", open_slot: 1, title: marker, uploaded_by: String(user.id) } },
    } });
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { uid: String(user.id), sub: String(user.id), name: marker, role: "admin" }, maxAge: 600 });
    const cookie = `next-auth.session-token=${token}`;
    const warm = await fetch(base, { headers: { cookie }, signal: AbortSignal.timeout(45_000) });
    assert.equal(warm.status, 200);
    await warm.arrayBuffer();
    const manifest = JSON.parse(await readFile(path.join(root, ".next/dev/server/server-reference-manifest.json"), "utf8"));
    const actionIds = new Map(Object.entries(manifest.node).map(([id, action]) => [action.exportedName, id]));
    assert.ok(actionIds.has("updateQualityRevisionAction"), "update action is present in the dev server manifest");
    assert.ok(actionIds.has("saveAndSubmitQualityRevisionAction"), "combined action is present in the dev server manifest");
    async function revision() {
      const row = await prisma.docs_qa_document_revisions.findFirstOrThrow({ where: { document_id: document.id } });
      if (row.file_path) files.add(row.file_path);
      return row;
    }
    async function save(file, title, action = "updateQualityRevisionAction") {
      const row = await revision();
      const form = new FormData();
      form.set("revisionId", String(row.id)); form.set("lockVersion", String(row.lock_version));
      form.set("title", title); form.set("description", "HTTP upload regression test"); form.set("changeNote", "Updated through the real Server Action");
      form.set("changeReason", "Verify complete uploads through the HTTP pipeline");
      if (file) form.set("file", file);
      const response = await fetch(base, {
        method: "POST", headers: { cookie, Origin: base.origin, "Next-Action": actionIds.get(action) },
        body: await encodeReply([form]), signal: AbortSignal.timeout(45_000),
      });
      const body = await response.text();
      assert.equal(response.status, 200, `save request failed with HTTP ${response.status}`);
      const result = body.split("\n").flatMap(line => {
        try { return [JSON.parse(line.slice(line.indexOf(":") + 1))]; } catch { return []; }
      }).find(value => value && typeof value.ok === "boolean");
      assert.ok(result, "server action returns a workflow result");
      return result;
    }
    assert.equal((await save(null, "Metadata only")).ok, true);
    for (const size of [11 * 1024 * 1024, 20 * 1024 * 1024]) {
      const bytes = Buffer.alloc(size, 0x41);
      bytes.write("%PDF-1.4\n"); bytes.write("\n%%EOF", size - 6);
      const result = await save(new File([bytes], `upload-${size}.pdf`, { type: "application/pdf" }), `Upload ${size}`);
      assert.equal(result.ok, true, result.error);
      const stored = await revision();
      assert.equal(stored.file_size_bytes, BigInt(size));
      const storedBytes = await readFile(path.join(root, stored.file_path));
      assert.equal(createHash("sha256").update(storedBytes).digest("hex"), createHash("sha256").update(bytes).digest("hex"), "the full file survives Proxy without truncation");
    }
    const before = await revision();
    const oversized = await save(new File([Buffer.alloc(20 * 1024 * 1024 + 1)], "too-large.pdf", { type: "application/pdf" }), "Must not be stored");
    assert.equal(oversized.ok, false);
    assert.match(oversized.error, /20 MB/);
    const after = await revision();
    assert.equal(after.lock_version, before.lock_version);
    assert.equal(after.file_path, before.file_path, "rejected upload preserves the saved draft");
    assert.equal((await save(null, "Metadata after upload")).ok, true);
    assert.equal((await revision()).file_path, before.file_path, "metadata-only edit keeps the attachment");
    const directBytes = Buffer.alloc(20 * 1024 * 1024, 0x42);
    directBytes.write("%PDF-1.4\n");
    const direct = await save(new File([directBytes], "one-click.pdf", { type: "application/pdf" }), "Saved and submitted together", "saveAndSubmitQualityRevisionAction");
    assert.equal(direct.ok, true, direct.error);
    assert.equal((await revision()).status, "PENDING");
    const snapshot = await prisma.docs_qa_submissions.findFirstOrThrow({ where: { revision: { document_id: document.id } } });
    files.add(snapshot.file_path);
    assert.equal(snapshot.title, "Saved and submitted together");
    assert.equal(snapshot.status, "PENDING");
    assert.equal(snapshot.file_size_bytes, BigInt(directBytes.length));
    assert.equal(snapshot.file_sha256, createHash("sha256").update(directBytes).digest("hex"));
    assert.equal(createHash("sha256").update(await readFile(path.join(root, snapshot.file_path))).digest("hex"), snapshot.file_sha256);
  } finally {
    if (document) {
      const snapshots = await prisma.docs_qa_submissions.findMany({ where: { revision: { document_id: document.id } } });
      for (const snapshot of snapshots) files.add(snapshot.file_path);
      const revisions = await prisma.docs_qa_document_revisions.findMany({ where: { document_id: document.id } });
      for (const row of revisions) if (row.file_path) files.add(row.file_path);
      await prisma.audit_logs.deleteMany({ where: { entity_type: "QUALITY_DOCUMENT", entity_id: String(document.id) } });
      await prisma.docs_qa_documents.delete({ where: { id: document.id } });
    }
    for (const file of files) {
      assert.match(file, /^storage\/qa-documents\/[\da-f-]+\.pdf$/);
      await unlink(path.join(root, file)).catch(() => undefined);
    }
    if (user) await prisma.users.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});

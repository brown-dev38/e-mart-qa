import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

test("dated document and version uploads preserve complete files through HTTP up to 20 MiB", { skip: process.env.RUN_HTTP_TESTS !== "1", timeout: 120_000 }, async () => {
  await import("dotenv/config");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaMariaDb } = await import("@prisma/adapter-mariadb");
  const { encode } = await import("next-auth/jwt");
  const { encodeReply } = await import("next/dist/compiled/react-server-dom-webpack/client.node.js");
  const base = new URL(process.env.NEXT_TEST_URL || "http://localhost:3000");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
  const marker = "UP" + crypto.randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase();
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), future = new Date(Date.now() + 31 * 3600000).toISOString().slice(0, 10);
  let user, department, framework, program;
  try {
    const role = await prisma.role.findFirstOrThrow({ where: { name: "admin", is_active: true } });
    user = await prisma.users.create({ data: { username: marker, role_id: role.id, created_at: new Date(), updated_at: new Date() } });
    department = await prisma.docs_departments.create({ data: { code: marker, name_th: marker } });
    framework = await prisma.docs_accreditation_frameworks.create({ data: { code: marker, name_th: marker, prefix_char: "W" } });
    program = await prisma.docs_programs.create({ data: { code: marker, name_th: marker, framework_id: framework.id } });
    const cookie = `next-auth.session-token=${await encode({ secret: process.env.NEXTAUTH_SECRET, token: { uid: String(user.id), sub: String(user.id), role: "admin" }, maxAge: 180 })}`;
    const warm = await fetch(base, { headers: { cookie } }); assert.equal(warm.status, 200); await warm.arrayBuffer();
    const manifest = JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json", "utf8"));
    const actionId = Object.entries(manifest.node).find(([, value]) => value.exportedName === "saveQualityDocumentAction")?.[0]; assert.ok(actionId);
    async function save(bytes, documentId) {
      const form = new FormData();
      for (const [key, entry] of Object.entries({ department: marker, program: marker, level: "SP", title: marker, effectiveDate: documentId ? future : today })) form.set(key, entry);
      if (documentId) form.set("documentId", documentId);
      if (bytes) form.set("file", new File([bytes], "upload.pdf", { type: "application/pdf" }));
      const response = await fetch(base, { method: "POST", headers: { cookie, Origin: base.origin, "Next-Action": actionId }, body: await encodeReply([form]), signal: AbortSignal.timeout(45_000) });
      assert.equal(response.status, 200);
      const result = (await response.text()).split("\n").flatMap(line => {
        try { return [JSON.parse(line.slice(line.indexOf(":") + 1))]; } catch { return []; }
      }).find(value => value && typeof value.ok === "boolean"); assert.ok(result); return result;
    }
    assert.equal((await save(null)).ok, false);
    let existing;
    const hash = value => createHash("sha256").update(value).digest("hex");
    for (const size of [11 * 1024 * 1024, 20 * 1024 * 1024]) {
      const bytes = Buffer.alloc(size, 0x41); bytes.write("%PDF-1.4\n");
      const saved = await save(bytes); assert.equal(saved.ok, true, saved.error); assert.equal(saved.status, "PUBLISHED");
      const revision = await prisma.docs_qa_document_revisions.findFirstOrThrow({ where: { document_id: BigInt(saved.documentId) } });
      assert.equal(revision.file_size_bytes, BigInt(size)); assert.equal(hash(await readFile(path.join(process.cwd(), revision.file_path))), hash(bytes));
      existing = saved;
    }
    const before = await prisma.docs_qa_documents.count({ where: { department_id: department.id } });
    const oversized = await save(Buffer.alloc(20 * 1024 * 1024 + 1)); assert.equal(oversized.ok, false); assert.match(oversized.error, /20 MB/);
    assert.equal(await prisma.docs_qa_documents.count({ where: { department_id: department.id } }), before);
    const nextBytes = Buffer.alloc(20 * 1024 * 1024, 0x42); nextBytes.write("%PDF-1.4\n");
    const next = await save(nextBytes, existing.documentId); assert.equal(next.ok, true, next.error); assert.equal(next.status, "DRAFT");
    const draft = await prisma.docs_qa_document_revisions.findFirstOrThrow({ where: { document_id: BigInt(existing.documentId), status: "DRAFT" } });
    assert.equal(draft.auto_publish, true); assert.equal(draft.file_size_bytes, BigInt(nextBytes.length));
    assert.equal(hash(await readFile(path.join(process.cwd(), draft.file_path))), hash(nextBytes));
    assert.equal((await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: BigInt(existing.documentId) } })).current_version, "000");
  } finally {
    if (department) {
      const documents = await prisma.docs_qa_documents.findMany({ where: { department_id: department.id }, include: { revisions: true } });
      await prisma.audit_logs.deleteMany({ where: { entity_type: "QUALITY_DOCUMENT", entity_id: { in: documents.map(document => String(document.id)) } } });
      await prisma.docs_qa_documents.deleteMany({ where: { department_id: department.id } });
      for (const document of documents) for (const revision of document.revisions) if (revision.file_path) await unlink(path.join(process.cwd(), revision.file_path)).catch(() => undefined);
    }
    if (program) await prisma.docs_programs.delete({ where: { id: program.id } });
    if (framework) await prisma.docs_accreditation_frameworks.delete({ where: { id: framework.id } });
    if (department) await prisma.docs_departments.delete({ where: { id: department.id } });
    if (user) await prisma.users.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});

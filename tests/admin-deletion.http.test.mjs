import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

test("admin deletion actions enforce permissions, revoke deleted accounts and retain document history", {
  skip: process.env.RUN_HTTP_TESTS !== "1", timeout: 120_000,
}, async () => {
  await import("dotenv/config");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaMariaDb } = await import("@prisma/adapter-mariadb");
  const { encode } = await import("next-auth/jwt");
  const { encodeReply } = await import("next/dist/compiled/react-server-dom-webpack/client.node.js");
  const base = new URL(process.env.NEXT_TEST_URL || "http://localhost:3000");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
  const marker = "DEL" + randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase();
  const users = [], cookies = {};
  let department, framework, program, document;
  const filePath = `storage/qa-documents/${randomUUID()}.pdf`;
  const fileBytes = Buffer.from("%PDF-1.4\nDeletion regression\n%%EOF");
  const fingerprint = rows => createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  const originalUsers = await prisma.users.findMany({ orderBy: { id: "asc" } });
  const originalIds = originalUsers.map(user => user.id);
  try {
    for (const [name, roleName, active] of [["admin", "admin", true], ["member", "user", true], ["disabled", "admin", false], ["victim", "admin", true]]) {
      const role = await prisma.role.findFirstOrThrow({ where: { name: roleName, is_active: true } });
      const user = await prisma.users.create({ data: {
        username: `${marker}-${name}`, role_id: role.id, is_active: active, created_at: new Date(), updated_at: new Date(),
      } });
      users.push(user);
      // Even a forged admin claim must not override the role currently stored in the database.
      const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { uid: String(user.id), sub: String(user.id), role: "admin" }, maxAge: 120 });
      cookies[name] = `next-auth.session-token=${token}`;
    }
    const [admin, member, , victim] = users;
    department = await prisma.docs_departments.create({ data: { code: marker, name_th: marker } });
    framework = await prisma.docs_accreditation_frameworks.create({ data: { code: marker, name_th: marker, prefix_char: "W" } });
    program = await prisma.docs_programs.create({ data: { code: marker, name_th: marker, framework_id: framework.id } });
    const level = await prisma.docs_document_levels.findUniqueOrThrow({ where: { code: "SP" } });
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, fileBytes);
    document = await prisma.docs_qa_documents.create({ data: {
      document_code: marker, title: marker, department_id: department.id, program_id: program.id,
      document_level_id: level.id, created_by: String(victim.id),
      revisions: { create: { title: marker, version_label: "DRAFT", open_slot: 1, file_path: filePath, file_name: "verification.pdf", file_size_bytes: BigInt(fileBytes.length) } },
    }, include: { revisions: true } });
    const warm = await fetch(base, { headers: { cookie: cookies.admin }, signal: AbortSignal.timeout(45_000) });
    assert.equal(warm.status, 200);
    assert.ok((await warm.text()).includes("departmentDocumentCatalog"));
    const manifest = JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json", "utf8"));
    const actions = new Map(Object.entries(manifest.node).map(([id, value]) => [value.exportedName, id]));
    async function action(name, args, actor = "admin") {
      assert.ok(actions.has(name), `Missing server action ${name}`);
      const response = await fetch(base, {
        method: "POST", headers: { ...(cookies[actor] ? { cookie: cookies[actor] } : {}), Origin: base.origin, "Next-Action": actions.get(name) },
        body: await encodeReply(args), signal: AbortSignal.timeout(45_000), redirect: "manual",
      });
      if (response.status === 307) {
        assert.equal(new URL(response.headers.get("location"), base).pathname, "/login");
        return { ok: false, error: "Authentication required" };
      }
      assert.equal(response.status, 200);
      const result = (await response.text()).split("\n").flatMap(line => {
        try { return [JSON.parse(line.slice(line.indexOf(":") + 1))]; } catch { return []; }
      }).find(value => value && typeof value.ok === "boolean");
      assert.ok(result, `Missing action result for ${name} (${actor})`);
      return result;
    }
    for (const actor of ["member", "disabled", "anonymous"]) {
      assert.equal((await action("deleteUserAction", [victim.id], actor)).ok, false);
      assert.equal((await action("getQualityDeletionAction", [String(document.id)], actor)).ok, false);
    }
    assert.equal((await action("deleteUserAction", [admin.id])).ok, false, "admins cannot delete themselves");
    for (const id of [0, true, "1", []]) assert.equal((await action("deleteUserAction", [id])).ok, false);
    assert.ok(await prisma.users.findUnique({ where: { id: victim.id } }));
    assert.equal((await action("deleteUserAction", [victim.id])).ok, true, "admins can delete another admin");
    assert.equal(await prisma.users.findUnique({ where: { id: victim.id } }), null);
    assert.ok(await prisma.docs_qa_documents.findUnique({ where: { id: document.id } }), "deleting a user preserves their documents");
    assert.equal((await action("deleteUserAction", [member.id], "victim")).ok, false, "a deleted account's old admin session is rejected");
    const revoked = await fetch(base, { headers: { cookie: cookies.victim }, redirect: "manual" });
    assert.equal(revoked.status, 307, "deleted accounts are redirected to sign in");
    assert.ok(revoked.headers.get("set-cookie")?.includes("next-auth.session-token="), "the deleted account's stale session cookie is cleared");
    const signIn = await fetch(new URL("/login", base), { headers: { cookie: cookies.victim }, redirect: "manual" });
    assert.equal(signIn.status, 200, "deleted accounts can reach sign in without a redirect loop");
    const download = await fetch(new URL(`/api/quality-documents/revisions/${document.revisions[0].id}/file?purpose=review`, base), { headers: { cookie: cookies.victim } });
    assert.equal(download.status, 401, "deleted accounts cannot download files with an old session");

    const prepared = await action("getQualityDeletionAction", [String(document.id)]);
    assert.equal(prepared.ok, true);
    const command = { id: String(document.id), token: prepared.document.token, confirmationCode: marker, reason: "ทดสอบลบเอกสาร" };
    for (const actor of ["member", "disabled", "anonymous", "victim"]) assert.equal((await action("deleteQualityDocumentAction", [command], actor)).ok, false);
    assert.equal((await action("deleteQualityDocumentAction", [{ ...command, confirmationCode: "wrong" }])).ok, false);
    assert.equal((await action("deleteQualityDocumentAction", [{ ...command, reason: "" }])).ok, false);
    await prisma.docs_qa_document_revisions.update({ where: { id: document.revisions[0].id }, data: { lock_version: { increment: 1 } } });
    assert.equal((await action("deleteQualityDocumentAction", [command])).ok, false, "stale confirmation snapshots are rejected");
    const refreshed = await action("getQualityDeletionAction", [String(document.id)]);
    command.token = refreshed.document.token;
    assert.equal((await action("deleteQualityDocumentAction", [command])).ok, true);
    assert.equal((await action("deleteQualityDocumentAction", [command])).ok, false);
    const after = await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: document.id }, include: { revisions: true } });
    assert.ok(after.deleted_at);
    assert.equal(after.deleted_by, String(admin.id));
    assert.equal(after.deletion_reason, command.reason);
    assert.equal(after.revisions.length, 1);
    assert.deepEqual(await readFile(filePath), fileBytes);
    const listed = await action("listQualityDocumentsAction", [{}]);
    assert.equal(listed.ok, true);
    assert.ok(!listed.documents.some(row => row.id === String(document.id)));
    for (const [entityType, entityId] of [["USER", String(victim.id)], ["QUALITY_DOCUMENT", String(document.id)]]) {
      assert.equal(await prisma.audit_logs.count({ where: { actor_id: String(admin.id), action: "DELETE", entity_type: entityType, entity_id: entityId, outcome: "SUCCESS" } }), 1);
    }
    assert.equal(fingerprint(await prisma.users.findMany({ where: { id: { in: originalIds } }, orderBy: { id: "asc" } })), fingerprint(originalUsers), "existing accounts are unchanged");
  } finally {
    if (document) {
      await prisma.docs_qa_document_revisions.deleteMany({ where: { document_id: document.id } });
      await prisma.docs_qa_documents.delete({ where: { id: document.id } });
    }
    await unlink(filePath).catch(() => undefined);
    if (program) await prisma.docs_programs.delete({ where: { id: program.id } });
    if (framework) await prisma.docs_accreditation_frameworks.delete({ where: { id: framework.id } });
    if (department) await prisma.docs_departments.delete({ where: { id: department.id } });
    await prisma.audit_logs.deleteMany({ where: { actor_id: { in: users.map(user => String(user.id)) } } });
    await prisma.users.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await prisma.$disconnect();
  }
});

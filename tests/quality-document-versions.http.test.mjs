import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

function pdfFixture() {
  const contents = "0.1 0.4 0.2 rg 10 10 60 60 re f\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 240] /Resources << >> /Contents 5 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 240] /Resources << >> /Contents 6 0 R >>",
    `<< /Length ${contents.length} >>\nstream\n${contents}endstream`, `<< /Length ${contents.length} >>\nstream\n${contents}endstream`,
  ];
  let value = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(value)); value += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(value);
  value += `xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(value);
}

test("version details are read-only and preview authorized PDF, Word and Excel versions without original file responses", {
  skip: process.env.RUN_HTTP_TESTS !== "1", timeout: 120_000,
}, async () => {
  await import("dotenv/config");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaMariaDb } = await import("@prisma/adapter-mariadb");
  const { encode } = await import("next-auth/jwt");
  const { encodeReply } = await import("next/dist/compiled/react-server-dom-webpack/client.node.js");
  const XLSX = await import("xlsx");
  const base = new URL(process.env.NEXT_TEST_URL || "http://localhost:3000");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
  const marker = "VERS" + randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const users = [], cookies = {}, files = new Set();
  let department, framework, program, document;
  const pdf = pdfFixture();
  async function store(bytes, extension) {
    const file = `storage/qa-documents/${randomUUID()}.${extension}`;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes); files.add(file);
    return { file_path: file, file_name: `preview.${extension}`, file_size_bytes: BigInt(bytes.length) };
  }
  function word(text) {
    const archive = XLSX.CFB.utils.cfb_new();
    XLSX.CFB.utils.cfb_add(archive, "[Content_Types].xml", Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
    XLSX.CFB.utils.cfb_add(archive, "word/document.xml", Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`));
    return XLSX.CFB.write(archive, { type: "buffer", fileType: "zip" });
  }
  try {
    for (const [name, roleName, active] of [["owner", "user", true], ["admin", "admin", true], ["outsider", "user", true], ["disabled", "user", false]]) {
      const role = await prisma.role.findFirstOrThrow({ where: { name: roleName, is_active: true } });
      const user = await prisma.users.create({ data: { username: `${marker}-${name}`, role_id: role.id, is_active: active, created_at: new Date(), updated_at: new Date() } });
      users.push(user);
      cookies[name] = `next-auth.session-token=${await encode({ secret: process.env.NEXTAUTH_SECRET, token: { uid: String(user.id), sub: String(user.id), role: roleName }, maxAge: 180 })}`;
    }
    department = await prisma.docs_departments.create({ data: { code: marker, name_th: marker } });
    framework = await prisma.docs_accreditation_frameworks.create({ data: { code: marker, name_th: marker, prefix_char: "W" } });
    program = await prisma.docs_programs.create({ data: { code: marker, name_th: marker, framework_id: framework.id } });
    const level = await prisma.docs_document_levels.findUniqueOrThrow({ where: { code: "SP" } });
    document = await prisma.docs_qa_documents.create({ data: {
      document_code: marker, title: marker, created_by: String(users[0].id), status: "PUBLISHED", current_version: "004", approved_revision_no: 4,
      department_id: department.id, program_id: program.id, document_level_id: level.id,
    } });
    const oldPdf = await prisma.docs_qa_document_revisions.create({ data: {
      document_id: document.id, title: marker, version_label: "000", revision_number: 0, status: "SUPERSEDED", ...await store(pdf, "pdf"),
    } });
    const wordRevision = await prisma.docs_qa_document_revisions.create({ data: {
      document_id: document.id, title: marker, version_label: "001", revision_number: 1, status: "SUPERSEDED", ...await store(word("Word preview ทดสอบ"), "docx"),
    } });
    const excel = [];
    for (const [index, extension, bookType] of [[2, "xls", "biff8"], [3, "xlsx", "xlsx"]]) {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["หัวข้อ", "ค่า"], ["ทดสอบ", "<script>text only</script>"]]), "ข้อมูล");
      excel.push(await prisma.docs_qa_document_revisions.create({ data: {
        document_id: document.id, title: marker, version_label: `00${index}`, revision_number: index, status: "SUPERSEDED",
        ...await store(XLSX.write(workbook, { type: "buffer", bookType }), extension),
      } }));
    }
    const current = await prisma.docs_qa_document_revisions.create({ data: {
      document_id: document.id, title: marker, version_label: "004", revision_number: 4, status: "APPROVED", ...await store(Buffer.from("invalid source; use approved evidence"), "pdf"),
    } });
    const evidenceFile = await store(pdf, "pdf");
    await prisma.docs_qa_submissions.create({ data: {
      revision_id: current.id, round_no: 1, target_revision_no: 4, title: marker, status: "APPROVED", submitted_by: String(users[0].id), submitted_name: marker, submitted_at: new Date(),
      ...evidenceFile, file_sha256: createHash("sha256").update(pdf).digest("hex"),
    } });
    const draft = await prisma.docs_qa_document_revisions.create({ data: {
      document_id: document.id, title: marker, version_label: "DRAFT", open_slot: 1, status: "DRAFT", ...await store(word("Draft content"), "docx"),
    } });
    const missing = await prisma.docs_qa_document_revisions.create({ data: { document_id: document.id, title: marker, version_label: "005", status: "WITHDRAWN" } });
    const warm = await fetch(base, { headers: { cookie: cookies.owner } });
    assert.equal(warm.status, 200); await warm.arrayBuffer();
    const manifest = JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json", "utf8"));
    const actionId = Object.entries(manifest.node).find(([, value]) => value.exportedName === "qualityDocumentVersionsAction")?.[0];
    assert.ok(actionId);
    async function details(actor) {
      const response = await fetch(base, { method: "POST", headers: { cookie: cookies[actor], Origin: base.origin, "Next-Action": actionId }, body: await encodeReply([String(document.id)]) });
      assert.equal(response.status, 200);
      const result = (await response.text()).split("\n").flatMap(line => {
        try { return [JSON.parse(line.slice(line.indexOf(":") + 1))]; } catch { return []; }
      }).find(value => value && typeof value.ok === "boolean");
      assert.ok(result); return result;
    }
    async function preview(revision, actor = "owner", status = 200, page = 1) {
      const response = await fetch(new URL(`/api/quality-documents/revisions/${revision.id}/preview?page=${page}`, base), { headers: actor ? { cookie: cookies[actor] } : {}, signal: AbortSignal.timeout(30_000) });
      assert.equal(response.status, status);
      assert.equal(response.headers.get("content-type"), "application/json");
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("content-disposition"), null);
      return response.json();
    }
    const all = await details("owner");
    assert.equal(all.ok, true); assert.equal(all.detail.versions.length, 7);
    assert.equal(all.detail.versions.find(row => row.id === String(current.id)).state, "EFFECTIVE");
    assert.equal(all.detail.versions.find(row => row.id === String(missing.id)).previewUrl, null);
    for (const version of all.detail.versions) for (const key of ["fileUrl", "reviewFileUrl", "submissions", "canEdit", "canApprove", "canReview", "lockVersion"]) assert.equal(Object.hasOwn(version, key), false);
    assert.ok(!JSON.stringify(all).includes("storage/qa-documents"));
    assert.equal((await details("outsider")).detail.versions.length, 6);
    const rendered = await preview(oldPdf, "outsider");
    assert.equal(rendered.kind, "pdf"); assert.equal(rendered.totalPages, 2);
    assert.ok(rendered.image.startsWith("data:image/png;base64,"));
    assert.equal(Buffer.from(rendered.image.split(",")[1], "base64").subarray(1, 4).toString(), "PNG");
    assert.equal((await preview(oldPdf, "outsider", 200, 2)).page, 2);
    await preview(oldPdf, "owner", 404, 3); await preview(oldPdf, "owner", 400, 0);
    assert.equal((await preview(wordRevision, "outsider")).text.trim(), "Word preview ทดสอบ");
    for (const revision of excel) {
      const result = await preview(revision, "outsider"); assert.equal(result.kind, "spreadsheet");
      assert.equal(result.sheets[0].rows[1][1], "<script>text only</script>");
    }
    assert.equal((await preview(current, "outsider")).kind, "pdf", "approved previews use the immutable submission instead of the live source");
    assert.equal((await preview(draft)).text.trim(), "Draft content");
    await preview(draft, "outsider", 404); await preview(draft, "disabled", 401); await preview(draft, null, 401); await preview(missing, "owner", 404);
    const pendingBytes = word("Pending snapshot content");
    await prisma.docs_qa_submissions.create({ data: {
      revision_id: draft.id, round_no: 1, target_revision_no: 5, title: marker, status: "PENDING", submitted_by: String(users[0].id), submitted_name: marker, submitted_at: new Date(),
      ...await store(pendingBytes, "docx"), file_sha256: createHash("sha256").update(pendingBytes).digest("hex"),
    } });
    await prisma.docs_qa_document_revisions.update({ where: { id: draft.id }, data: { status: "PENDING" } });
    assert.equal((await details("owner")).detail.versions.find(row => row.id === String(draft.id)).state, "PENDING");
    assert.equal((await preview(draft, "admin")).text.trim(), "Pending snapshot content");
    await preview(draft, "outsider", 404);
    const deniedDownload = await fetch(new URL(`/api/quality-documents/revisions/${oldPdf.id}/file`, base), { headers: { cookie: cookies.outsider } });
    assert.equal(deniedDownload.status, 404, "old versions remain preview-only");
    await writeFile(evidenceFile.file_path, Buffer.from("tampered evidence"));
    await preview(current, "admin", 404);
    await writeFile(evidenceFile.file_path, pdf);
    await prisma.docs_qa_documents.update({ where: { id: document.id }, data: { deleted_at: new Date() } });
    assert.equal((await details("owner")).ok, false); await preview(oldPdf, "owner", 404);
    assert.equal((await details("admin")).ok, true); assert.equal((await preview(oldPdf, "admin")).kind, "pdf");
  } finally {
    if (document) await prisma.docs_qa_documents.delete({ where: { id: document.id } });
    for (const file of files) await unlink(file).catch(() => undefined);
    if (program) await prisma.docs_programs.delete({ where: { id: program.id } });
    if (framework) await prisma.docs_accreditation_frameworks.delete({ where: { id: framework.id } });
    if (department) await prisma.docs_departments.delete({ where: { id: department.id } });
    await prisma.audit_logs.deleteMany({ where: { actor_id: { in: users.map(user => String(user.id)) } } });
    await prisma.users.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await prisma.$disconnect();
  }
});

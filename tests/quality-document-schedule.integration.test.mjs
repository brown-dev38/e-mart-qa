import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

test("dated documents activate automatically and retain the previous effective revision until the date arrives", { skip: process.env.RUN_DB_TESTS !== "1" }, async () => {
  await import("dotenv/config");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return next(pathToFileURL(path.join(root, specifier.slice(2) + ".ts")).href, context);
    if (specifier.startsWith(".") && context.parentURL?.startsWith(pathToFileURL(root).href)) {
      const url = new URL(specifier, context.parentURL);
      if (!path.extname(url.pathname) && existsSync(fileURLToPath(url) + ".ts")) return next(url.href + ".ts", context);
    }
    return next(specifier, context);
  } });
  const { prisma } = await import("../lib/prisma.ts");
  const { saveQualityDocument } = await import("../lib/quality-document-save.ts");
  const { qualityRevisionTargets } = await import("../lib/quality-document-schedule.ts");
  const { listQualityDocuments } = await import("../lib/quality-document-query.ts");
  const { qualityDocumentVersions } = await import("../lib/quality-document-versions.ts");
  const { qualityRevisionFile } = await import("../lib/quality-document-workflow.ts");
  const { qualityToday, refreshQualityPublications } = await import("../lib/quality-document-publication.ts");
  const marker = "DATE" + crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const today = qualityToday(), tomorrow = qualityToday(new Date(Date.now() + 86400000));
  const users = [], files = new Set();
  let department, framework, program;
  const bytes = Buffer.from("%PDF-1.4\nDate scheduling regression\n%%EOF");
  const ok = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result; };
  try {
    for (const [name, active] of [["owner", true], ["outsider", true], ["disabled", false]]) {
      const role = await prisma.role.findFirstOrThrow({ where: { name: "user", is_active: true } });
      users.push(await prisma.users.create({ data: { username: `${marker}-${name}`, role_id: role.id, is_active: active, created_at: new Date(), updated_at: new Date() } }));
    }
    const [owner, outsider, disabled] = users.map(user => String(user.id));
    department = await prisma.docs_departments.create({ data: { code: marker, name_th: marker } });
    framework = await prisma.docs_accreditation_frameworks.create({ data: { code: marker, name_th: marker, prefix_char: "W" } });
    program = await prisma.docs_programs.create({ data: { code: marker, name_th: marker, framework_id: framework.id } });
    const form = (date = tomorrow, documentId, title = marker) => {
      const value = new FormData();
      for (const [key, entry] of Object.entries({ department: marker, program: marker, level: "SP", title, effectiveDate: date })) value.set(key, entry);
      if (documentId) value.set("documentId", documentId);
      value.set("file", new File([bytes], "schedule.pdf", { type: "application/pdf" }));
      return value;
    };
    for (const date of ["", "2026-02-30", "2000-01-01", "not-a-date"]) assert.equal((await saveQualityDocument(form(date), owner)).ok, false);
    const missing = form(); missing.delete("file");
    assert.equal((await saveQualityDocument(missing, owner)).ok, false);
    assert.equal(await prisma.docs_qa_documents.count({ where: { department_id: department.id } }), 0);
    const saved = ok(await saveQualityDocument(form(), owner));
    assert.equal(saved.status, "DRAFT");
    let document = await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: BigInt(saved.documentId) }, include: { revisions: true } });
    const first = document.revisions[0];
    assert.equal(document.current_version, null); assert.equal(first.status, "DRAFT"); assert.equal(first.auto_publish, true);
    assert.equal(first.effective_date.toISOString().slice(0, 10), tomorrow);
    assert.equal(first.version_label, "000"); assert.equal(first.open_slot, 1);
    const waiting = (await listQualityDocuments({}, { id: owner, admin: false })).find(row => row.id === saved.documentId);
    assert.equal(waiting.status, "DRAFT"); assert.equal(waiting.scheduled_is_draft, true); assert.equal(waiting.scheduled_effective_date, tomorrow); assert.equal(waiting.file_path, null);
    assert.equal(waiting.can_create_revision, false);
    assert.equal((await qualityDocumentVersions(saved.documentId, owner)).versions[0].state, "DRAFT");
    assert.ok(!(await listQualityDocuments({}, { id: outsider, admin: false })).some(row => row.id === saved.documentId));
    await assert.rejects(qualityRevisionFile(String(first.id), owner));
    await prisma.docs_qa_document_revisions.update({ where: { id: first.id }, data: { effective_date: new Date(`${today}T00:00:00Z`) } });
    await Promise.all([refreshQualityPublications(document.id), refreshQualityPublications(document.id)]);
    document = await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: document.id } });
    assert.equal(document.status, "PUBLISHED"); assert.equal(document.current_version, "000"); assert.equal(document.approved_revision_no, 0);
    assert.equal(await prisma.docs_qa_review_events.count({ where: { revision_id: first.id, action: "EFFECTIVE" } }), 1);
    assert.ok((await qualityRevisionTargets(owner)).some(row => row.id === saved.documentId));
    assert.equal((await listQualityDocuments({}, { id: owner, admin: false })).find(row => row.id === saved.documentId).can_create_revision, true);
    assert.equal((await listQualityDocuments({}, { id: outsider, admin: false })).find(row => row.id === saved.documentId).can_create_revision, false);
    const original = await qualityRevisionFile(String(first.id), outsider);
    const secondForm = form(tomorrow, saved.documentId, `${marker} next`);
    assert.equal((await saveQualityDocument(secondForm, outsider)).ok, false);
    await assert.rejects(saveQualityDocument(secondForm, disabled));
    const scheduled = ok(await saveQualityDocument(secondForm, owner));
    assert.equal(scheduled.status, "DRAFT");
    document = await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: document.id }, include: { revisions: { orderBy: { id: "desc" } } } });
    const second = document.revisions[0];
    assert.equal(document.status, "PUBLISHED"); assert.equal(document.current_version, "000"); assert.equal(document.title, marker);
    assert.equal(second.status, "DRAFT"); assert.equal(second.version_label, "001");
    assert.equal((await qualityRevisionFile(String(first.id), outsider)).path, original.path);
    assert.deepEqual(await readFile(path.join(root, original.path)), bytes);
    await assert.rejects(qualityRevisionFile(String(second.id), owner));
    assert.ok(!(await qualityRevisionTargets(owner)).some(row => row.id === saved.documentId));
    assert.equal((await saveQualityDocument(form(tomorrow, saved.documentId), owner)).ok, false);
    const stillCurrent = (await listQualityDocuments({}, { id: owner, admin: false })).find(row => row.id === saved.documentId);
    assert.equal(stillCurrent.current_version, "000"); assert.equal(stillCurrent.scheduled_version, "001"); assert.equal(stillCurrent.scheduled_is_draft, true);
    assert.equal(stillCurrent.can_create_revision, false);
    assert.equal(stillCurrent.file_path, `/api/quality-documents/revisions/${first.id}/file`);
    await prisma.docs_qa_document_revisions.update({ where: { id: second.id }, data: { effective_date: new Date(`${today}T00:00:00Z`) } });
    ok({ ok: !!(await qualityRevisionFile(String(second.id), outsider)) });
    document = await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: document.id } });
    assert.equal(document.current_version, "001"); assert.equal(document.title, `${marker} next`);
    assert.equal((await prisma.docs_qa_document_revisions.findUniqueOrThrow({ where: { id: first.id } })).status, "SUPERSEDED");
    await assert.rejects(qualityRevisionFile(String(first.id), outsider));
    assert.deepEqual(await readFile(path.join(root, original.path)), bytes, "the old file is retained unchanged");
    const competing = await Promise.all([saveQualityDocument(form(tomorrow, saved.documentId), owner), saveQualityDocument(form(tomorrow, saved.documentId), owner)]);
    assert.equal(competing.filter(result => result.ok).length, 1, "only one future version may be scheduled at a time");
    assert.equal(await prisma.docs_qa_document_revisions.count({ where: { document_id: document.id } }), 3);
    const immediate = ok(await saveQualityDocument(form(today), owner)); assert.equal(immediate.status, "PUBLISHED");
    const immediateVersion = ok(await saveQualityDocument(form(today, immediate.documentId), owner)); assert.equal(immediateVersion.status, "PUBLISHED");
    assert.equal((await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: BigInt(immediate.documentId) } })).current_version, "001");
    const legacyForm = form(); legacyForm.delete("effectiveDate");
    const legacy = ok(await saveQualityDocument(legacyForm, owner));
    await prisma.docs_qa_document_revisions.updateMany({ where: { document_id: BigInt(legacy.documentId) }, data: { effective_date: new Date(`${today}T00:00:00Z`) } });
    await refreshQualityPublications(BigInt(legacy.documentId));
    assert.equal((await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: BigInt(legacy.documentId) } })).status, "DRAFT", "legacy drafts require their original workflow and are never auto-activated");
    for (const state of ["deleted", "ARCHIVED"]) {
      const blocked = ok(await saveQualityDocument(form(), owner));
      await prisma.docs_qa_document_revisions.updateMany({ where: { document_id: BigInt(blocked.documentId) }, data: { effective_date: new Date(`${today}T00:00:00Z`) } });
      await prisma.docs_qa_documents.update({ where: { id: BigInt(blocked.documentId) }, data: state === "deleted" ? { deleted_at: new Date() } : { status: "ARCHIVED" } });
      await refreshQualityPublications(BigInt(blocked.documentId));
      assert.equal((await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: BigInt(blocked.documentId) } })).current_version, null);
    }
  } finally {
    if (department) {
      const documents = await prisma.docs_qa_documents.findMany({ where: { department_id: department.id }, include: { revisions: true } });
      for (const document of documents) for (const revision of document.revisions) if (revision.file_path) files.add(revision.file_path);
      await prisma.audit_logs.deleteMany({ where: { entity_type: "QUALITY_DOCUMENT", entity_id: { in: documents.map(document => String(document.id)) } } });
      await prisma.docs_qa_documents.deleteMany({ where: { department_id: department.id } });
    }
    for (const file of files) await unlink(path.join(root, file)).catch(() => undefined);
    if (program) await prisma.docs_programs.delete({ where: { id: program.id } });
    if (framework) await prisma.docs_accreditation_frameworks.delete({ where: { id: framework.id } });
    if (department) await prisma.docs_departments.delete({ where: { id: department.id } });
    await prisma.users.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await prisma.$disconnect(); hook.deregister();
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

test("quality document approval, revision history, permissions and concurrent requests", { skip: process.env.RUN_DB_TESTS !== "1" }, async () => {
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
  const { listQualityDocuments } = await import("../lib/quality-document-query.ts");
  const { createQualityRevision, updateQualityRevision, saveAndSubmitQualityRevision, transitionQualityRevision, qualityWorkflowDetail, qualityApprovalQueue, qualityReviewInbox, qualityRevisionFile, qualitySubmissionFile, workflowId } = await import("../lib/quality-document-workflow.ts");
  const { qualityFilePath, verifiedSubmissionBytes } = await import("../lib/quality-document-files.ts");
  const { listQualityDeletion, deleteQualityDocument } = await import("../lib/quality-document-deletion.ts");
  const { auditInput, auditedChange, mutationEvent, listAuditLog } = await import("../lib/audit-log.ts");
  const { saveDirectoryUser } = await import("../lib/user-directory.ts");
  const marker = "QA" + crypto.randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase();
  let department, framework, program, level, criterion;
  const roles = [], users = [], files = new Set();
  const now = new Date();
  const ok = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result; };
  try {
    for (const name of ["admin", "user"]) roles.push(await prisma.role.create({ data: { name, created_at: now, updated_at: now } }));
    for (const [index, role, active] of [[0, roles[0], true], [1, roles[0], true], [2, roles[1], true], [3, roles[0], false]]) {
      users.push(await prisma.users.create({ data: { username: `${marker}-${index}`, role_id: role.id, is_active: active, created_at: now, updated_at: now } }));
    }
    const [author, reviewer, outsider, disabled] = users.map(u => String(u.id));
    department = await prisma.docs_departments.create({ data: { code: marker, name_th: marker } });
    framework = await prisma.docs_accreditation_frameworks.create({ data: { code: marker, name_th: marker, prefix_char: "W" } });
    program = await prisma.docs_programs.create({ data: { code: marker, name_th: marker, framework_id: framework.id } });
    level = await prisma.docs_document_levels.create({ data: { code: marker.slice(0, 10), name_th: marker } });
    criterion = await prisma.docs_qa_criteria.create({ data: { code: "W1.1.1", section_number: "1.1.1", framework_id: framework.id, title_th: marker } });
    function createForm(sequence) {
      const form = new FormData();
      for (const [key, value] of Object.entries({ department: marker, program: marker, level: level.code, criterion: criterion.code, title: "เรื่องแรก", description: "ทดสอบ" })) form.set(key, value);
      if (sequence !== undefined) form.set("sequence", sequence);
      return form;
    }
    const saved = ok(await saveQualityDocument(createForm(), author));
    assert.ok(saved.documentCode.endsWith("-001"), "sequence starts at 001 without a client value");
    const forged = ok(await saveQualityDocument(createForm("999"), author));
    assert.ok(forged.documentCode.endsWith("-002"), "server ignores client-supplied sequence");
    const simultaneous = await Promise.all([
      saveQualityDocument(createForm("001"), author),
      saveQualityDocument(createForm("invalid"), author),
    ]);
    simultaneous.forEach(ok);
    assert.deepEqual(simultaneous.map(r => r.documentCode.slice(-3)).sort(), ["003", "004"], "concurrent creates allocate distinct sequential codes");
    const doc = await prisma.docs_qa_documents.findUniqueOrThrow({ where: { document_code: saved.documentCode } });
    assert.equal(saved.documentId, String(doc.id), "create result can open the new document directly");
    const documentId = String(doc.id);
    let detail = await qualityWorkflowDetail(documentId, author);
    let draft = detail.revisions[0];
    assert.equal(detail.currentVersion, "000");
    assert.equal(detail.nextVersion, "001");
    assert.equal(draft.status, "DRAFT");
    assert.equal((await qualityReviewInbox(author)).find(d => d.id === documentId)?.phase, "DRAFT");
    assert.ok(!(await qualityReviewInbox(outsider)).some(d => d.id === documentId), "review inbox hides other owners' documents");
    await assert.rejects(qualityReviewInbox(disabled));
    const command = (r, action, comment) => ({ revisionId: r.id, lockVersion: r.lockVersion, action, comment });
    assert.equal((await transitionQualityRevision(command(draft, "submit"), author)).ok, false, "attachment required");
    assert.equal((await createQualityRevision(documentId, outsider)).ok, false);
    assert.equal((await createQualityRevision(documentId, author)).ok, false, "only one open draft");
    assert.equal((await qualityWorkflowDetail(documentId, outsider)).revisions.length, 0);
    await assert.rejects(qualityApprovalQueue(outsider));
    await assert.rejects(qualityWorkflowDetail(documentId, disabled));
    const publicList = await listQualityDocuments({ departmentCode: marker }, { id: outsider, admin: false });
    assert.equal(publicList.length, 0, "other users cannot see drafts");

    async function edit(r, actor = author, name = "first.pdf", note = "", title = "เรื่องแรกฉบับแก้ไข") {
      const form = new FormData();
      form.set("revisionId", r.id); form.set("lockVersion", String(r.lockVersion));
      form.set("title", title); form.set("description", "รายละเอียด"); form.set("changeNote", note);
      form.set("file", new File([`%PDF-1.4\n${name}\n%%EOF`], name, { type: "application/pdf" }));
      const result = await updateQualityRevision(form, actor);
      if (result.ok) {
        const row = await prisma.docs_qa_document_revisions.findUniqueOrThrow({ where: { id: BigInt(r.id) } });
        files.add(row.file_path);
      }
      return result;
    }
    assert.equal((await edit(draft, outsider)).ok, false);
    assert.equal((await edit(draft, author, "bad.exe")).ok, false);
    ok(await edit(draft, author, "first.pdf", "ส่งตรวจครั้งแรก"));
    assert.equal((await edit(draft)).ok, false, "stale edit rejected");
    draft = (await qualityWorkflowDetail(documentId, author)).revisions[0];
    await assert.rejects(qualityRevisionFile(draft.id, outsider));
    const source = await qualityRevisionFile(draft.id, author);
    const sourceBytes = await readFile(qualityFilePath(source.path));
    await unlink(qualityFilePath(source.path));
    assert.equal((await transitionQualityRevision(command(draft, "submit"), author)).ok, false, "missing file cannot become submission evidence");
    assert.equal(await prisma.docs_qa_submissions.count({ where: { revision_id: BigInt(draft.id) } }), 0);
    await writeFile(qualityFilePath(source.path), sourceBytes);
    const concurrentSubmissions = await Promise.all([
      transitionQualityRevision(command(draft, "submit"), author),
      transitionQualityRevision(command(draft, "submit"), author),
    ]);
    assert.equal(concurrentSubmissions.filter(r => r.ok).length, 1, "one pending copy per simultaneous submission");
    draft = (await qualityWorkflowDetail(documentId, author)).revisions[0];
    assert.equal(draft.status, "PENDING");
    assert.equal(draft.submissions.length, 1);
    const firstSubmission = draft.submissions[0];
    assert.equal(firstSubmission.targetVersion, "001");
    assert.equal(firstSubmission.roundNo, 1);
    assert.equal(firstSubmission.source, "SUBMITTED");
    const firstEvidence = await qualitySubmissionFile(firstSubmission.id, author);
    files.add(firstEvidence.path);
    assert.notEqual(firstEvidence.path, source.path, "submission stores a physical copy");
    assert.equal((await verifiedSubmissionBytes({ file_path: firstEvidence.path, file_sha256: firstEvidence.hash })).toString(), sourceBytes.toString());
    await assert.rejects(qualitySubmissionFile(firstSubmission.id, outsider));
    await assert.rejects(qualitySubmissionFile(firstSubmission.id, disabled));
    await writeFile(qualityFilePath(source.path), "changed original draft bytes");
    assert.equal((await readFile(qualityFilePath(firstEvidence.path))).toString(), sourceBytes.toString(), "later source changes cannot alter evidence");
    assert.equal((await edit(draft)).ok, false, "pending file is frozen");
    assert.equal((await transitionQualityRevision(command(draft, "approve"), outsider)).ok, false);
    assert.equal((await transitionQualityRevision(command(draft, "approve"), author)).ok, false, "no self approval");
    assert.equal((await transitionQualityRevision(command(draft, "return"), reviewer)).ok, false, "return needs reason");
    assert.ok((await qualityApprovalQueue(reviewer)).some(r => r.documentId === documentId && r.targetVersion === "001"));
    ok(await transitionQualityRevision(command(draft, "return", "กรุณาแก้ไขรายละเอียด"), reviewer));
    detail = await qualityWorkflowDetail(documentId, author);
    assert.equal(detail.currentVersion, "000");
    assert.equal(detail.revisions[0].status, "DRAFT");
    assert.ok(detail.revisions[0].events.some(e => e.action === "RETURN" && e.comment === "กรุณาแก้ไขรายละเอียด"));
    assert.equal(detail.revisions[0].submissions[0].status, "RETURNED");
    assert.equal(detail.revisions[0].submissions[0].reviewComment, "กรุณาแก้ไขรายละเอียด");
    assert.equal((await transitionQualityRevision(command(draft, "approve"), reviewer)).ok, false, "stale reviewer rejected");
    draft = detail.revisions[0];
    const returnedItem = (await qualityReviewInbox(author)).find(d => d.id === documentId);
    assert.equal(returnedItem.phase, "RETURNED");
    assert.equal(returnedItem.reviewComment, "กรุณาแก้ไขรายละเอียด");
    assert.equal(returnedItem.reviewedBy, users[1].username);
    assert.equal(returnedItem.targetVersion, "001");
    assert.equal(returnedItem.roundNo, 1);
    assert.equal((await listQualityDocuments({ departmentCode: marker }, { id: author, admin: true })).find(d => d.id === documentId)?.open_revision_returned, true, "list distinguishes a returned draft from a new draft");
    await writeFile(qualityFilePath(source.path), sourceBytes);
    const unchanged = await transitionQualityRevision(command(draft, "submit"), author);
    assert.equal(unchanged.ok, false, "unchanged returned submission cannot be sent again");
    assert.match(unchanged.error, /ยังไม่มีการแก้ไข/);
    ok(await edit(draft, author, "corrected.pdf", "", "แก้ไขหลังส่งกลับ"));
    draft = (await qualityWorkflowDetail(documentId, author)).revisions[0];
    assert.equal((await transitionQualityRevision(command(draft, "submit"), author)).ok, false, "resubmission requires an explanation of corrections");
    ok(await edit(draft, author, "corrected.pdf", "แก้ไขรายละเอียดตามข้อเสนอแนะ", "แก้ไขหลังส่งกลับ"));
    draft = (await qualityWorkflowDetail(documentId, author)).revisions[0];
    assert.equal(draft.submissions[0].title, firstSubmission.title, "snapshot title is immutable when the draft is edited");
    ok(await transitionQualityRevision(command(draft, "submit"), author));
    draft = (await qualityWorkflowDetail(documentId, author)).revisions[0];
    assert.deepEqual(draft.submissions.map(s => [s.roundNo, s.status]), [[2, "PENDING"], [1, "RETURNED"]]);
    const pendingItem = (await qualityReviewInbox(author)).find(d => d.id === documentId);
    assert.equal(pendingItem.phase, "PENDING");
    assert.equal(pendingItem.roundNo, 2);
    assert.equal((await listQualityDocuments({ departmentCode: marker }, { id: author, admin: true })).find(d => d.id === documentId)?.open_revision_returned, false, "resubmission clears the returned marker");
    assert.equal(pendingItem.reviewComment, "กรุณาแก้ไขรายละเอียด", "previous feedback stays visible during the next review");
    const secondSubmission = draft.submissions[0];
    const secondEvidence = await qualitySubmissionFile(secondSubmission.id, author);
    files.add(secondEvidence.path);
    const secondBytes = await readFile(qualityFilePath(secondEvidence.path));
    await writeFile(qualityFilePath(secondEvidence.path), "tampered submission bytes");
    assert.equal((await transitionQualityRevision(command(draft, "approve"), reviewer)).ok, false, "hash mismatch must block approval");
    assert.equal((await qualityWorkflowDetail(documentId, author)).currentVersion, "000");
    await writeFile(qualityFilePath(secondEvidence.path), secondBytes);
    const concurrent = await Promise.all([
      transitionQualityRevision(command(draft, "approve", "ผ่าน"), reviewer),
      transitionQualityRevision(command(draft, "approve", "ผ่าน"), reviewer),
    ]);
    assert.equal(concurrent.filter(r => r.ok).length, 1, "exactly one approval succeeds");
    detail = await qualityWorkflowDetail(documentId, author);
    assert.equal(detail.currentVersion, "001");
    assert.equal(detail.nextVersion, "002");
    const approved = detail.revisions[0];
    assert.equal(approved.status, "APPROVED");
    assert.equal((await qualityReviewInbox(author)).find(d => d.id === documentId)?.phase, "APPROVED");
    assert.equal(approved.events.filter(e => e.action === "APPROVE").length, 1);
    assert.deepEqual(approved.submissions.map(s => s.status), ["APPROVED", "RETURNED"]);
    assert.equal(approved.submissions[0].reviewedBy, users[1].username);
    assert.equal(approved.submissions[0].title, "แก้ไขหลังส่งกลับ");
    assert.equal((await readFile(qualityFilePath(firstEvidence.path))).toString(), sourceBytes.toString());
    assert.ok((await qualityWorkflowDetail(documentId, outsider)).revisions.every(r => r.submissions.length === 0), "draft evidence remains private even after approval");
    const submittedEvent = await prisma.docs_qa_review_events.findFirstOrThrow({ where: { revision_id: BigInt(approved.id), action: "APPROVE" } });
    assert.equal(String(submittedEvent.submission_id), secondSubmission.id);
    const originalFile = await qualityRevisionFile(approved.id, outsider);
    const originalContents = await readFile(qualityFilePath(originalFile.path), "utf8");
    assert.equal(originalFile.path, secondEvidence.path, "approved file is the exact reviewed evidence");
    assert.equal((await edit(approved)).ok, false, "approved revisions immutable");
    ok(await createQualityRevision(documentId, author));
    draft = (await qualityWorkflowDetail(documentId, author)).revisions[0];
    assert.equal(draft.fileUrl, null, "new revision requires a fresh attachment");
    ok(await edit(draft, author, "second.pdf", "", "เรื่องเดิมฉบับที่สอง"));
    draft = (await qualityWorkflowDetail(documentId, author)).revisions[0];
    assert.equal((await transitionQualityRevision(command(draft, "submit"), author)).ok, false, "change note required for subsequent revisions");
    ok(await edit(draft, author, "second-final.pdf", "ปรับปรุงขั้นตอน", "เรื่องเดิมฉบับที่สอง"));
    draft = (await qualityWorkflowDetail(documentId, author)).revisions[0];
    ok(await transitionQualityRevision(command(draft, "submit"), author));
    const current = await prisma.docs_qa_documents.findUniqueOrThrow({ where: { id: doc.id } });
    assert.equal(current.current_version, "001", "old approval remains active while pending");
    assert.equal(current.title, approved.title);
    assert.equal((await qualityWorkflowDetail(documentId, outsider)).revisions.length, 1, "outsider sees only approved history");
    draft = (await qualityWorkflowDetail(documentId, author)).revisions[0];
    assert.equal(draft.submissions[0].targetVersion, "002");
    assert.equal(draft.submissions[0].roundNo, 1, "round numbers belong to the target revision");
    ok(await transitionQualityRevision(command(draft, "approve"), reviewer));
    detail = await qualityWorkflowDetail(documentId, outsider);
    assert.equal(detail.currentVersion, "002");
    assert.equal(detail.revisions.length, 2);
    assert.deepEqual(detail.revisions.map(r => r.version), ["002", "001"]);
    assert.equal(await readFile(qualityFilePath((await qualityRevisionFile(approved.id, outsider)).path), "utf8"), originalContents);
    const another = await prisma.docs_qa_documents.findFirstOrThrow({ where: { department_id: department.id, sequence_no: "002" } });
    assert.equal(another.current_version, "000", "document sequence has independent revisions");
    assert.throws(() => workflowId("-1"));
    assert.throws(() => workflowId("18446744073709551616"));
    await prisma.docs_qa_documents.update({ where: { id: doc.id }, data: { approved_revision_no: 999 } });
    assert.equal((await createQualityRevision(documentId, author)).ok, false);
    await prisma.docs_qa_documents.update({ where: { id: doc.id }, data: { sequence_no: "999" } });
    const exhausted = await saveQualityDocument(createForm(), author);
    assert.equal(exhausted.ok, false);
    assert.match(exhausted.error, /ครบ 999/);
    await prisma.docs_qa_documents.update({ where: { id: doc.id }, data: { approved_revision_no: 2, sequence_no: "001" } });

    await assert.rejects(listQualityDeletion(false, marker, outsider));
    await assert.rejects(listAuditLog({}, outsider));
    await assert.rejects(listAuditLog({}, disabled));
    await assert.rejects(listAuditLog({ from: "2026-02-30" }, reviewer));
    await assert.rejects(listAuditLog({ page: -1 }, reviewer));
    await assert.rejects(listAuditLog({ action: "__proto__" }, reviewer));
    const audit = await listAuditLog({ search: marker }, reviewer);
    assert.ok(audit.items.some(event => event.action === "APPROVE" && event.entityLabel === saved.documentCode));
    assert.ok(audit.items.some(event => event.action === "CREATE"));
    const deletion = (await listQualityDeletion(false, marker, reviewer)).find(row => row.id === documentId);
    const deletionCommand = { id: documentId, token: deletion.token, confirmationCode: deletion.code, reason: "เอกสารทดสอบซ้ำ" };
    assert.equal((await deleteQualityDocument(deletionCommand, outsider)).ok, false);
    assert.equal((await deleteQualityDocument({ ...deletionCommand, confirmationCode: "wrong" }, reviewer)).ok, false);
    assert.equal((await deleteQualityDocument({ ...deletionCommand, reason: "" }, reviewer)).ok, false);
    ok(await createQualityRevision(documentId, author));
    assert.equal((await deleteQualityDocument(deletionCommand, reviewer)).ok, false, "deletion must reject stale document snapshots");
    const latest = (await listQualityDeletion(false, marker, reviewer)).find(row => row.id === documentId);
    const deletes = await Promise.all([
      deleteQualityDocument({ ...deletionCommand, token: latest.token }, reviewer),
      deleteQualityDocument({ ...deletionCommand, token: latest.token }, reviewer),
    ]);
    assert.equal(deletes.filter(r => r.ok).length, 1, "only one concurrent deletion commits");
    assert.ok(!(await listQualityDeletion(false, marker, reviewer)).some(row => row.id === documentId));
    assert.ok((await listQualityDeletion(true, marker, reviewer)).some(row => row.id === documentId && row.reason === deletionCommand.reason));
    assert.ok(!(await listQualityDocuments({ departmentCode: marker }, { id: author, admin: true })).some(row => row.id === documentId));
    assert.ok(!(await qualityApprovalQueue(reviewer)).some(row => row.documentId === documentId));
    assert.equal((await createQualityRevision(documentId, author)).ok, false);
    await assert.rejects(qualityWorkflowDetail(documentId, outsider));
    await assert.rejects(qualityRevisionFile(approved.id, outsider));
    const retained = await qualityWorkflowDetail(documentId, reviewer);
    assert.equal(retained.deleted, true);
    assert.ok(retained.revisions.every(r => !r.canEdit && !r.canReview));
    assert.equal(await readFile(qualityFilePath((await qualityRevisionFile(approved.id, reviewer)).path), "utf8"), originalContents);
    assert.equal((await qualitySubmissionFile(firstSubmission.id, reviewer)).path, firstEvidence.path);
    await assert.rejects(qualitySubmissionFile(firstSubmission.id, outsider));
    const deleteHistory = await listAuditLog({ search: saved.documentCode, action: "DELETE" }, reviewer);
    assert.equal(deleteHistory.total, 1);
    assert.equal(deleteHistory.items[0].details.reason, deletionCommand.reason);
    assert.equal(deleteHistory.items[0].actorId, reviewer);
    // Deleting the highest allocated document must not allow its code to be reused.
    const last = (await listQualityDeletion(false, marker, reviewer)).find(row => row.code.endsWith("-004"));
    ok(await deleteQualityDocument({ id: last.id, token: last.token, confirmationCode: last.code, reason: "ทดสอบรักษาลำดับ" }, reviewer));
    assert.ok(ok(await saveQualityDocument(createForm(), outsider)).documentCode.endsWith("-005"));
    const ownerInbox = await qualityReviewInbox(outsider);
    assert.equal(ownerInbox.length, 1, "non-admin inbox contains only the user's own document");
    assert.equal(ownerInbox[0].phase, "DRAFT");
    assert.equal(ownerInbox[0].canEdit, true);
    assert.ok(!(await qualityReviewInbox(reviewer)).some(row => row.id === documentId), "deleted documents do not appear in the review inbox");

    // A single request must save the displayed fields and submit their exact snapshot.
    const combined = ok(await saveQualityDocument(createForm(), author));
    const combinedId = combined.documentId;
    let combinedDraft = (await qualityWorkflowDetail(combinedId, author)).revisions[0];
    function sendForm(revision, title, note = "", fileName) {
      const form = new FormData();
      for (const [key, value] of Object.entries({ revisionId: revision.id, lockVersion: String(revision.lockVersion), title, description: "ส่งจากหน้าจอในครั้งเดียว", changeNote: note })) form.set(key, value);
      if (fileName) form.set("file", new File([`%PDF-1.4\n${fileName}\n%%EOF`], fileName, { type: "application/pdf" }));
      return form;
    }
    async function combinedRow() {
      const row = await prisma.docs_qa_document_revisions.findUniqueOrThrow({ where: { id: BigInt(combinedDraft.id) } });
      if (row.file_path) files.add(row.file_path);
      return row;
    }
    assert.equal((await saveAndSubmitQualityRevision(sendForm(combinedDraft, "ยังไม่มีไฟล์"), author)).ok, false);
    assert.equal((await combinedRow()).title, combinedDraft.title, "failed submission rolls back the edit");
    assert.equal((await combinedRow()).lock_version, combinedDraft.lockVersion);
    assert.equal((await qualityWorkflowDetail(combinedId, author)).revisions[0].events.length, 1, "failed submission adds no edit event");
    assert.equal((await saveAndSubmitQualityRevision(sendForm(combinedDraft, "ไม่มีสิทธิ์", "", "forbidden.pdf"), outsider)).ok, false);
    assert.equal((await saveAndSubmitQualityRevision(sendForm(combinedDraft, "บัญชีปิด", "", "disabled.pdf"), disabled)).ok, false);
    const once = await Promise.all([
      saveAndSubmitQualityRevision(sendForm(combinedDraft, "แก้ไขและส่งครั้งเดียว", "", "combined-first.pdf"), author),
      saveAndSubmitQualityRevision(sendForm(combinedDraft, "แก้ไขและส่งครั้งเดียว", "", "combined-first.pdf"), author),
    ]);
    assert.equal(once.filter(r => r.ok).length, 1, "one save-and-submit wins concurrent requests");
    const combinedFirst = await combinedRow();
    combinedDraft = (await qualityWorkflowDetail(combinedId, author)).revisions[0];
    assert.equal(combinedDraft.status, "PENDING");
    assert.equal(combinedDraft.title, "แก้ไขและส่งครั้งเดียว");
    assert.equal(combinedDraft.submissions.length, 1);
    assert.equal(combinedDraft.submissions[0].title, combinedDraft.title);
    assert.deepEqual(combinedDraft.events.map(e => e.action), ["CREATE", "EDIT", "SUBMIT"]);
    const immutableFirst = await qualitySubmissionFile(combinedDraft.submissions[0].id, author);
    const immutableFirstBytes = await readFile(qualityFilePath(immutableFirst.path));
    assert.equal(immutableFirstBytes.toString(), (await readFile(qualityFilePath(combinedFirst.file_path))).toString());
    ok(await transitionQualityRevision(command(combinedDraft, "return", "เพิ่มรายละเอียด"), reviewer));
    combinedDraft = (await qualityWorkflowDetail(combinedId, author)).revisions[0];
    const beforeCorrection = await combinedRow();
    assert.equal((await saveAndSubmitQualityRevision(sendForm(combinedDraft, "ต้องไม่บันทึกเมื่อส่งไม่ผ่าน", "", "no-note.pdf"), author)).ok, false);
    assert.equal((await combinedRow()).title, beforeCorrection.title);
    assert.equal((await combinedRow()).file_path, beforeCorrection.file_path, "failed combined submission keeps the saved attachment");
    assert.equal((await combinedRow()).lock_version, beforeCorrection.lock_version);
    ok(await saveAndSubmitQualityRevision(sendForm(combinedDraft, "แก้ไขแล้วส่งตรวจซ้ำ", "เพิ่มรายละเอียดตามข้อเสนอแนะ", "combined-corrected.pdf"), author));
    await combinedRow();
    combinedDraft = (await qualityWorkflowDetail(combinedId, author)).revisions[0];
    assert.deepEqual(combinedDraft.submissions.map(s => [s.roundNo, s.status]), [[2, "PENDING"], [1, "RETURNED"]]);
    assert.equal(combinedDraft.submissions[0].changeNote, "เพิ่มรายละเอียดตามข้อเสนอแนะ");
    assert.equal((await readFile(qualityFilePath(immutableFirst.path))).toString(), immutableFirstBytes.toString(), "resubmission keeps the previous evidence unchanged");
    ok(await transitionQualityRevision(command(combinedDraft, "return", "ชี้แจงเพิ่มเติม"), reviewer));
    combinedDraft = (await qualityWorkflowDetail(combinedId, author)).revisions[0];
    assert.equal((await saveAndSubmitQualityRevision(sendForm(combinedDraft, combinedDraft.title, combinedDraft.changeNote), author)).ok, false, "unchanged returned payload is still rejected");
    const savedCorrection = await combinedRow();
    const correctionBytes = await readFile(qualityFilePath(savedCorrection.file_path));
    await unlink(qualityFilePath(savedCorrection.file_path));
    try {
      assert.equal((await saveAndSubmitQualityRevision(sendForm(combinedDraft, combinedDraft.title, "ชี้แจงรายละเอียดเพิ่มเติม"), author)).ok, false, "snapshot failure rolls back the combined edit");
      assert.equal((await combinedRow()).change_note, savedCorrection.change_note);
      assert.equal((await combinedRow()).lock_version, savedCorrection.lock_version);
    } finally { await writeFile(qualityFilePath(savedCorrection.file_path), correctionBytes); }
    ok(await saveAndSubmitQualityRevision(sendForm(combinedDraft, combinedDraft.title, "ชี้แจงรายละเอียดเพิ่มเติม"), author));
    assert.equal((await combinedRow()).file_path, savedCorrection.file_path, "metadata-only resubmission reuses the existing attachment");
    combinedDraft = (await qualityWorkflowDetail(combinedId, author)).revisions[0];
    assert.equal(combinedDraft.submissions[0].roundNo, 3);
    assert.equal(combinedDraft.submissions[0].changeNote, "ชี้แจงรายละเอียดเพิ่มเติม");
    assert.equal((await transitionQualityRevision(command(combinedDraft, "approve"), author)).ok, false);
    ok(await transitionQualityRevision(command(combinedDraft, "approve"), reviewer));
    assert.equal((await qualityWorkflowDetail(combinedId, author)).currentVersion, "001");

    const sensitive = { username: `${marker}-audited`, password: "Audit-Test-Password-1234", confirm_password: "Audit-Test-Password-1234", citizen_id: "sensitive-id", password_hash: "sensitive-hash", role_id: roles[1].id, is_active: true };
    const safe = auditInput(sensitive);
    assert.equal(safe.passwordChanged, true);
    assert.ok(!JSON.stringify(safe).includes(sensitive.password));
    assert.ok(!JSON.stringify(safe).includes(sensitive.citizen_id));
    assert.ok(!JSON.stringify(safe).includes(sensitive.password_hash));
    const event = mutationEvent("USER", sensitive);
    let invoked = false;
    assert.equal((await auditedChange(outsider, event, async () => { invoked = true; return { ok: true }; })).ok, false);
    assert.equal(invoked, false, "admin authorization precedes mutation");
    ok(await auditedChange(reviewer, event, () => saveDirectoryUser(sensitive)));
    const auditedUser = await prisma.users.findUniqueOrThrow({ where: { username: sensitive.username } });
    users.push(auditedUser);
    const userHistory = await listAuditLog({ search: sensitive.username, entityType: "USER" }, reviewer);
    assert.ok(userHistory.items.some(item => item.outcome === "SUCCESS"));
    assert.ok(userHistory.items.some(item => item.outcome === "FAILED"));
    assert.ok(!JSON.stringify(userHistory).includes(sensitive.password));
    assert.ok(!JSON.stringify(userHistory).includes(sensitive.citizen_id));
    const paginationLabel = `pagination-${marker}`;
    await prisma.audit_logs.createMany({ data: Array.from({ length: 23 }, () => ({ actor_id: reviewer, actor_name: users[1].username, action: "UPDATE", entity_type: "MASTER_DATA", entity_label: paginationLabel, summary: "ทดสอบแบ่งหน้าประวัติ" })) });
    const firstPage = await listAuditLog({ search: paginationLabel }, reviewer);
    const secondPage = await listAuditLog({ search: paginationLabel, page: 2 }, reviewer);
    assert.equal(firstPage.total, 23); assert.equal(firstPage.items.length, 20); assert.equal(secondPage.items.length, 3);
    assert.ok(!firstPage.items.some(a => secondPage.items.some(b => a.id === b.id)));
  } finally {
    await prisma.audit_logs.deleteMany({ where: { actor_name: { startsWith: `${marker}-` } } });
    if (department) {
      const submissions = await prisma.docs_qa_submissions.findMany({ where: { revision: { document: { department_id: department.id } } } });
      for (const submission of submissions) files.add(submission.file_path);
      const revisions = await prisma.docs_qa_document_revisions.findMany({ where: { document: { department_id: department.id } } });
      for (const revision of revisions) if (revision.file_path) files.add(revision.file_path);
      await prisma.docs_qa_documents.deleteMany({ where: { department_id: department.id } });
    }
    for (const file of files) await unlink(qualityFilePath(file)).catch(() => undefined);
    if (criterion) await prisma.docs_qa_criteria.delete({ where: { id: criterion.id } });
    if (program) await prisma.docs_programs.delete({ where: { id: program.id } });
    if (framework) await prisma.docs_accreditation_frameworks.delete({ where: { id: framework.id } });
    if (level) await prisma.docs_document_levels.delete({ where: { id: level.id } });
    if (department) await prisma.docs_departments.delete({ where: { id: department.id } });
    for (const user of users) await prisma.users.delete({ where: { id: user.id } });
    for (const role of roles) await prisma.role.delete({ where: { id: role.id } });
    await prisma.$disconnect(); hook.deregister();
  }
});

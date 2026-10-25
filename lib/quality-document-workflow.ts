import type { Prisma, docs_qa_documents, docs_qa_document_revisions } from "@prisma/client";
import { prisma } from "./prisma";
import { ActionError as WorkflowError, currentActor as qualityActor } from "./current-actor";
import { writeAudit } from "./audit-log";
export { ActionError as WorkflowError, currentActor as qualityActor } from "./current-actor";
import { removeQualityFile, revisionFileUrl, storeQualityFile, snapshotQualityFile, submissionFileUrl, verifiedSubmissionBytes } from "./quality-document-files";
import type { ApprovalQueueItem, QualityReviewItem, QualityWorkflowDetail, RevisionCommand, WorkflowResult } from "@/types/quality-document";

type Transaction = Prisma.TransactionClient;
function fail(message: string): never { throw new WorkflowError(message); }
export function workflowId(value: string): bigint {
  if (typeof value !== "string" || !/^[1-9]\d{0,19}$/.test(value) || BigInt(value) > BigInt("18446744073709551615")) {
    fail("รหัสรายการไม่ถูกต้อง");
  }
  return BigInt(value);
}
export function versionLabel(value: number) { return String(value).padStart(3, "0"); }

type Actor = Awaited<ReturnType<typeof qualityActor>>;
function manages(actor: Actor, owner: string | null) { return actor.admin || actor.id === owner; }

async function lockedDocument(tx: Transaction, id: bigint) {
  // Serialize all changes for a document, including allocation of its next revision number.
  await tx.$queryRaw`SELECT id FROM docs_qa_documents WHERE id = ${id} FOR UPDATE`;
  const doc = await tx.docs_qa_documents.findUnique({ where: { id } });
  if (!doc) fail("ไม่พบเอกสาร");
  if (doc.deleted_at) fail("เอกสารนี้ถูกลบแล้ว");
  if (doc.status === "ARCHIVED") fail("เอกสารนี้เก็บถาวรแล้ว");
  return doc;
}

async function record(tx: Transaction, revisionId: bigint, actor: Actor, action: string, comment?: string, submissionId?: bigint) {
  await tx.docs_qa_review_events.create({ data: {
    revision_id: revisionId, submission_id: submissionId, action, actor_id: actor.id, actor_name: actor.name, comment: comment || null,
  } });
  const revision = await tx.docs_qa_document_revisions.findUniqueOrThrow({ where: { id: revisionId }, include: { document: true } });
  const submission = submissionId ? await tx.docs_qa_submissions.findUniqueOrThrow({ where: { id: submissionId } }) : null;
  await writeAudit(tx, actor, {
    action: action === "CREATE" ? "REVISION_CREATE" : action, entityType: "QUALITY_DOCUMENT",
    entityId: String(revision.document_id), entityLabel: revision.document.document_code,
    summary: `${action}: ${revision.title}`, details: {
      revisionId: String(revisionId), version: revision.version_label, title: revision.title, comment: comment || null,
      ...(submission ? { submissionId: String(submission.id), roundNo: submission.round_no, targetVersion: versionLabel(submission.target_revision_no) } : {}),
    },
  });
}
function message(error: unknown): WorkflowResult {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error("Quality document workflow failed", error instanceof Error ? error.name : "UnknownError");
  return { ok: false, error: "ดำเนินการไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่" };
}

async function submitRevision(
  tx: Transaction, doc: docs_qa_documents, revision: docs_qa_document_revisions, actor: Actor,
  comment: string, onSnapshot: (path: string) => void,
) {
  if (!manages(actor, doc.created_by)) fail("คุณไม่มีสิทธิ์ส่งเอกสารนี้");
  if (revision.status !== "DRAFT" || revision.open_slot !== 1) fail("ส่งตรวจได้เฉพาะฉบับร่าง");
  if (!revision.file_path || !revision.file_name) fail("กรุณาแนบไฟล์ก่อนส่งตรวจ");
  if (doc.approved_revision_no > 0 && !revision.change_note?.trim()) fail("กรุณาระบุรายละเอียดการแก้ไขก่อนส่งตรวจ");
  if (doc.approved_revision_no >= 999) fail("เลขฉบับครบ 999 แล้ว");
  const previous = await tx.docs_qa_submissions.findFirst({ where: { revision_id: revision.id }, orderBy: { round_no: "desc" } });
  if (previous?.status === "PENDING") fail("มีรอบส่งตรวจที่ยังไม่สิ้นสุดอยู่แล้ว");
  if (previous?.status === "RETURNED" && !revision.change_note?.trim()) fail("กรุณาระบุสิ่งที่แก้ไขตามข้อเสนอแนะก่อนส่งตรวจซ้ำ");
  let copy;
  try { copy = await snapshotQualityFile(revision.file_path); }
  catch (error) {
    if (error instanceof Error && /^(ไม่พบไฟล์ส่งตรวจ|ไฟล์ส่งตรวจ)/.test(error.message)) fail(error.message);
    throw error;
  }
  onSnapshot(copy.file_path);
  if (previous?.status === "RETURNED" && previous.title === revision.title &&
    previous.description === revision.description && previous.change_note === revision.change_note &&
    previous.file_sha256 === copy.file_sha256) fail("ยังไม่มีการแก้ไขจากรอบที่ส่งกลับ กรุณาแก้ไขก่อนส่งตรวจซ้ำ");
  const now = new Date();
  const submission = await tx.docs_qa_submissions.create({ data: {
    revision_id: revision.id, round_no: (previous?.round_no ?? 0) + 1,
    target_revision_no: doc.approved_revision_no + 1,
    title: revision.title, description: revision.description, change_note: revision.change_note,
    ...copy, file_name: revision.file_name, file_mime_type: revision.file_mime_type,
    submitted_by: actor.id, submitted_name: actor.name, submitted_at: now,
  } });
  await tx.docs_qa_document_revisions.update({ where: { id: revision.id }, data: {
    status: "PENDING", submitted_by: actor.id, submitted_at: now, lock_version: { increment: 1 },
  } });
  await record(tx, revision.id, actor, "SUBMIT", comment, submission.id);
}

export async function createQualityRevision(documentId: string, userId: string): Promise<WorkflowResult> {
  try {
    const id = workflowId(documentId);
    await prisma.$transaction(async tx => {
      const actor = await qualityActor(userId, tx);
      const doc = await lockedDocument(tx, id);
      if (!manages(actor, doc.created_by)) fail("คุณไม่มีสิทธิ์แก้ไขเอกสารนี้");
      if (doc.approved_revision_no >= 999) fail("เลขฉบับครบ 999 แล้ว กรุณาติดต่อผู้ดูแลระบบ");
      if (await tx.docs_qa_document_revisions.findFirst({ where: { document_id: id, open_slot: 1 } })) {
        fail("มีฉบับร่างหรือฉบับรออนุมัติอยู่แล้ว");
      }
      const revision = await tx.docs_qa_document_revisions.create({ data: {
        document_id: id, title: doc.title, description: doc.description, version_label: "000",
        status: "DRAFT", open_slot: 1, uploaded_by: actor.id,
        // A new revision requires a new attachment; approved files remain immutable.
      } });
      await record(tx, revision.id, actor, "CREATE", `ร่างสำหรับฉบับ ${versionLabel(doc.approved_revision_no + 1)}`);
    }, { isolationLevel: "ReadCommitted" });
    return { ok: true };
  } catch (error) { return message(error); }
}

export async function updateQualityRevision(form: FormData, userId: string): Promise<WorkflowResult> {
  return writeQualityRevision(form, userId, false);
}

export async function saveAndSubmitQualityRevision(form: FormData, userId: string): Promise<WorkflowResult> {
  return writeQualityRevision(form, userId, true);
}

async function writeQualityRevision(form: FormData, userId: string, submit: boolean): Promise<WorkflowResult> {
  let stored: Awaited<ReturnType<typeof storeQualityFile>> = null;
  let snapshotPath: string | null = null;
  try {
    const id = workflowId(String(form.get("revisionId") ?? ""));
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const changeNote = String(form.get("changeNote") ?? "").trim();
    const lockVersion = Number(form.get("lockVersion"));
    if (!title || title.length > 500 || description.length > 2000 || changeNote.length > 2000) fail("กรุณาระบุชื่อเรื่องไม่เกิน 500 ตัวอักษร และรายละเอียดไม่เกิน 2,000 ตัวอักษร");
    if (!Number.isSafeInteger(lockVersion) || lockVersion < 0 || !form.has("lockVersion")) fail("ข้อมูลฉบับไม่ถูกต้อง");
    const actor = await qualityActor(userId);
    const original = await prisma.docs_qa_document_revisions.findUnique({ where: { id }, include: { document: true } });
    if (!original || !manages(actor, original.document.created_by)) fail("คุณไม่มีสิทธิ์แก้ไขเอกสารนี้");
    if (original.status !== "DRAFT" || original.lock_version !== lockVersion) fail("ฉบับนี้มีการเปลี่ยนแปลงแล้ว กรุณาเปิดใหม่");
    stored = await storeQualityFile(form.get("file"));
    await prisma.$transaction(async tx => {
      const currentActor = await qualityActor(userId, tx);
      const doc = await lockedDocument(tx, original.document_id);
      const revision = await tx.docs_qa_document_revisions.findUniqueOrThrow({ where: { id } });
      if (!manages(currentActor, doc.created_by)) fail("คุณไม่มีสิทธิ์แก้ไขเอกสารนี้");
      if (revision.status !== "DRAFT" || revision.lock_version !== lockVersion) fail("ฉบับนี้มีการเปลี่ยนแปลงแล้ว กรุณาเปิดใหม่");
      const changed = stored !== null || title !== revision.title || description !== (revision.description || "") || changeNote !== (revision.change_note || "");
      let edited = revision;
      if (changed || !submit) {
        edited = await tx.docs_qa_document_revisions.update({ where: { id }, data: {
          title, description: description || null, change_note: changeNote || null,
          ...stored, uploaded_by: currentActor.id, lock_version: { increment: 1 },
        } });
        await record(tx, id, currentActor, "EDIT", changeNote);
      }
      if (submit) await submitRevision(tx, doc, edited, currentActor, "", path => { snapshotPath = path; });
    }, { isolationLevel: "ReadCommitted", timeout: 15000 });
    // Keep previous files for recovery/audit; only failed uploads are removed.
    return { ok: true };
  } catch (error) {
    if (snapshotPath) await removeQualityFile(snapshotPath);
    if (stored) await removeQualityFile(stored.file_path);
    if (error instanceof Error && /ไฟล์|รองรับเฉพาะ/.test(error.message)) return { ok: false, error: error.message };
    return message(error);
  }
}

export async function transitionQualityRevision(command: RevisionCommand, userId: string): Promise<WorkflowResult> {
  let snapshotPath: string | null = null;
  try {
    if (!command || !["submit", "approve", "return"].includes(command.action) || !Number.isSafeInteger(command.lockVersion) || command.lockVersion < 0 || (command.comment !== undefined && typeof command.comment !== "string")) fail("คำสั่งไม่ถูกต้อง");
    const id = workflowId(command.revisionId);
    const comment = command.comment?.trim() || "";
    if (comment.length > 2000) fail("ความเห็นต้องไม่เกิน 2,000 ตัวอักษร");
    await prisma.$transaction(async tx => {
      const actor = await qualityActor(userId, tx);
      const original = await tx.docs_qa_document_revisions.findUnique({ where: { id }, select: { document_id: true } });
      if (!original) fail("ไม่พบฉบับเอกสาร");
      const doc = await lockedDocument(tx, original.document_id);
      const revision = await tx.docs_qa_document_revisions.findUniqueOrThrow({ where: { id } });
      if (revision.lock_version !== command.lockVersion) fail("ฉบับนี้มีการเปลี่ยนแปลงแล้ว กรุณาเปิดใหม่");
      if (command.action === "submit") {
        await submitRevision(tx, doc, revision, actor, comment, path => { snapshotPath = path; });
      } else {
        if (!actor.admin) fail("เฉพาะผู้ดูแลระบบที่มีสิทธิ์ตรวจสอบอนุมัติ");
        if (actor.id === revision.submitted_by || actor.id === revision.uploaded_by) fail("ผู้จัดทำหรือผู้ส่งตรวจไม่สามารถตรวจอนุมัติฉบับของตนเองได้");
        if (revision.status !== "PENDING" || revision.open_slot !== 1) fail("เอกสารนี้ไม่ได้รออนุมัติแล้ว");
        const submission = await tx.docs_qa_submissions.findFirst({ where: { revision_id: id, status: "PENDING" }, orderBy: { round_no: "desc" } });
        if (!submission || submission.target_revision_no !== doc.approved_revision_no + 1) fail("ไม่พบหลักฐานรอบส่งตรวจที่ตรงกับฉบับนี้ กรุณาติดต่อผู้ดูแลระบบ");
        const now = new Date();
        if (command.action === "return") {
          if (!comment) fail("กรุณาระบุเหตุผลที่ส่งกลับแก้ไข");
          await tx.docs_qa_document_revisions.update({ where: { id }, data: { status: "DRAFT", lock_version: { increment: 1 } } });
          await tx.docs_qa_submissions.update({ where: { id: submission.id }, data: {
            status: "RETURNED", reviewed_by: actor.id, reviewed_name: actor.name, reviewed_at: now, review_comment: comment,
          } });
          await record(tx, id, actor, "RETURN", comment, submission.id);
        } else {
          const next = doc.approved_revision_no + 1;
          if (next > 999) fail("เลขฉบับครบ 999 แล้ว");
          if (!revision.file_path || !revision.file_name) fail("ไม่พบไฟล์เอกสารสำหรับอนุมัติ");
          const label = versionLabel(next);
          try { await verifiedSubmissionBytes(submission); }
          catch { fail("ไม่สามารถอนุมัติได้ เนื่องจากไฟล์หลักฐานส่งตรวจสูญหายหรือเปลี่ยนแปลง กรุณาส่งกลับเพื่อแนบไฟล์และส่งตรวจใหม่"); }
          await tx.docs_qa_document_revisions.update({ where: { id }, data: {
            status: "APPROVED", version_label: label, revision_number: next, open_slot: null,
            approved_by: actor.id, approved_at: now, lock_version: { increment: 1 },
            title: submission.title, description: submission.description, change_note: submission.change_note,
            file_path: submission.file_path, file_name: submission.file_name,
            file_mime_type: submission.file_mime_type, file_size_bytes: submission.file_size_bytes,
          } });
          await tx.docs_qa_submissions.update({ where: { id: submission.id }, data: {
            status: "APPROVED", reviewed_by: actor.id, reviewed_name: actor.name, reviewed_at: now, review_comment: comment || null,
          } });
          await tx.docs_qa_documents.update({ where: { id: doc.id }, data: {
            title: submission.title, description: submission.description, current_version: label,
            approved_revision_no: next, status: "PUBLISHED", effective_date: now,
            file_path: revisionFileUrl(id), file_name: submission.file_name,
            file_mime_type: submission.file_mime_type, file_size_bytes: submission.file_size_bytes, updated_by: actor.id,
          } });
          await record(tx, id, actor, "APPROVE", comment, submission.id);
        }
      }
    }, { isolationLevel: "ReadCommitted", timeout: 15000 });
    return { ok: true };
  } catch (error) {
    if (snapshotPath) await removeQualityFile(snapshotPath);
    return message(error);
  }
}

export async function qualityWorkflowDetail(documentId: string, userId: string): Promise<QualityWorkflowDetail> {
  const actor = await qualityActor(userId);
  const doc = await prisma.docs_qa_documents.findUnique({ where: { id: workflowId(documentId) }, include: {
    revisions: { orderBy: { id: "desc" }, include: {
      events: { orderBy: [{ created_at: "asc" }, { id: "asc" }] },
      submissions: { orderBy: { round_no: "desc" } },
    } },
  } });
  if (!doc) fail("ไม่พบเอกสาร");
  if (doc.deleted_at && !actor.admin) fail("เอกสารนี้ถูกลบแล้ว");
  const canManage = manages(actor, doc.created_by) && doc.status !== "ARCHIVED" && !doc.deleted_at;
  return {
    id: String(doc.id), deleted: !!doc.deleted_at, documentCode: doc.document_code, currentVersion: doc.current_version,
    nextVersion: versionLabel(doc.approved_revision_no + 1),
    canCreateDraft: canManage && doc.approved_revision_no < 999 && !doc.revisions.some(r => r.open_slot === 1),
    revisions: doc.revisions.filter(r => r.status === "APPROVED" || canManage || actor.admin).map(r => {
      const submitted = r.status === "PENDING" ? r.submissions.find(s => s.status === "PENDING") : undefined;
      return ({
      id: String(r.id), version: r.version_label, status: r.status, title: submitted?.title ?? r.title,
      description: (submitted?.description ?? r.description) || "", changeNote: (submitted?.change_note ?? r.change_note) || "",
      fileName: submitted?.file_name ?? r.file_name, fileUrl: submitted ? submissionFileUrl(submitted.id) : r.file_path ? revisionFileUrl(r.id) : null,
      lockVersion: r.lock_version, submittedAt: r.submitted_at?.toISOString() || null,
      approvedAt: r.approved_at?.toISOString() || null, approvedBy: r.approved_by,
      canEdit: canManage && r.status === "DRAFT",
      canReadSubmissions: actor.admin || actor.id === doc.created_by,
      canReview: actor.admin && !doc.deleted_at && doc.status !== "ARCHIVED" && r.status === "PENDING" && actor.id !== r.submitted_by && actor.id !== r.uploaded_by,
      events: r.events.map(e => ({ id: String(e.id), action: e.action, actor: e.actor_name, comment: e.comment, date: e.created_at.toISOString() })),
      submissions: actor.admin || actor.id === doc.created_by ? r.submissions.map(s => ({
        id: String(s.id), roundNo: s.round_no, targetVersion: versionLabel(s.target_revision_no),
        title: s.title, description: s.description || "", changeNote: s.change_note || "",
        fileName: s.file_name, fileUrl: submissionFileUrl(s.id), status: s.status,
        submittedBy: s.submitted_name, submittedAt: s.submitted_at.toISOString(),
        capturedAt: s.captured_at.toISOString(), source: s.source,
        reviewedBy: s.reviewed_name, reviewedAt: s.reviewed_at?.toISOString() || null, reviewComment: s.review_comment,
      })) : [],
    }); }),
  };
}

export async function qualityApprovalQueue(userId: string): Promise<ApprovalQueueItem[]> {
  const actor = await qualityActor(userId);
  if (!actor.admin) fail("เฉพาะผู้ดูแลระบบที่มีสิทธิ์ตรวจสอบอนุมัติ");
  const rows = await prisma.docs_qa_document_revisions.findMany({
    where: { status: "PENDING", document: { status: { not: "ARCHIVED" }, deleted_at: null } },
    include: { document: true }, orderBy: [{ submitted_at: "asc" }, { id: "asc" }],
  });
  const submitters = await prisma.users.findMany({ where: { id: { in: rows.map(r => Number(r.submitted_by)).filter(Number.isSafeInteger) } }, select: { id: true, username: true } });
  const names = new Map(submitters.map(u => [String(u.id), u.username]));
  return rows.map(r => ({
    id: String(r.id), documentId: String(r.document_id), documentCode: r.document.document_code,
    title: r.title, targetVersion: versionLabel(r.document.approved_revision_no + 1),
    currentVersion: r.document.current_version, submittedBy: names.get(r.submitted_by || "") || "ไม่ทราบผู้ส่ง",
    submittedAt: r.submitted_at?.toISOString() || null,
    canReview: actor.id !== r.submitted_by && actor.id !== r.uploaded_by,
  }));
}

export async function qualityRevisionFile(revisionId: string, userId: string) {
  const actor = await qualityActor(userId);
  const revision = await prisma.docs_qa_document_revisions.findUnique({
    where: { id: workflowId(revisionId) }, include: {
      document: { select: { created_by: true, deleted_at: true } },
      submissions: { where: { status: { in: ["PENDING", "APPROVED"] } }, orderBy: { round_no: "desc" }, take: 1 },
    },
  });
  if (!revision?.file_path || (revision.status !== "APPROVED" && !actor.admin && revision.document.created_by !== actor.id)) fail("ไม่พบไฟล์เอกสาร");
  if (revision.document.deleted_at && !actor.admin) fail("เอกสารนี้ถูกลบแล้ว");
  const evidence = revision.submissions[0];
  if (evidence && revision.status !== "DRAFT") return { path: evidence.file_path, name: evidence.file_name, hash: evidence.file_sha256, evidence: true };
  return { path: revision.file_path, name: revision.file_name || "document", hash: null, evidence: false };
}

export async function qualitySubmissionFile(submissionId: string, userId: string) {
  const actor = await qualityActor(userId);
  const submission = await prisma.docs_qa_submissions.findUnique({
    where: { id: workflowId(submissionId) },
    include: { revision: { select: { document: { select: { created_by: true, deleted_at: true } } } } },
  });
  if (!submission) fail("ไม่พบสำเนาส่งตรวจ");
  const doc = submission.revision.document;
  if ((!actor.admin && doc.created_by !== actor.id) || (doc.deleted_at && !actor.admin)) fail("ไม่มีสิทธิ์ดูสำเนาส่งตรวจ");
  return { path: submission.file_path, name: submission.file_name, hash: submission.file_sha256 };
}

export async function qualityReviewInbox(userId: string): Promise<QualityReviewItem[]> {
  const actor = await qualityActor(userId);
  const docs = await prisma.docs_qa_documents.findMany({
    where: { deleted_at: null, status: { not: "ARCHIVED" }, ...(actor.admin ? {} : { created_by: actor.id }) },
    include: {
      department: { select: { code: true } }, program: { select: { code: true } },
      revisions: { orderBy: { id: "desc" }, take: 1, include: {
        submissions: { orderBy: { round_no: "desc" }, take: 1 },
        events: { where: { action: "RETURN" }, orderBy: { id: "desc" }, take: 1 },
      } },
    }, orderBy: [{ updated_at: "desc" }, { id: "desc" }],
  });
  return docs.flatMap(doc => {
    const revision = doc.revisions[0];
    if (!revision) return [];
    const latest = revision.submissions[0];
    const returnedEvent = revision.events[0];
    const returned = revision.status === "DRAFT" && (latest ? latest.status === "RETURNED" : !!returnedEvent);
    const decision = latest && latest.status !== "PENDING" ? latest : null;
    return [{
      id: String(doc.id), documentCode: doc.document_code, title: revision.title,
      department: doc.department.code, program: doc.program.code,
      phase: returned ? "RETURNED" as const : revision.status,
      targetVersion: revision.status === "APPROVED" ? revision.version_label : versionLabel(doc.approved_revision_no + 1),
      roundNo: latest?.round_no ?? 0,
      reviewedBy: decision ? decision.reviewed_name : returnedEvent?.actor_name ?? null,
      reviewedAt: decision ? decision.reviewed_at?.toISOString() ?? null : returnedEvent?.created_at.toISOString() ?? null,
      reviewComment: decision ? decision.review_comment : returnedEvent?.comment ?? null,
      submittedAt: revision.submitted_at?.toISOString() || null,
      canEdit: revision.status === "DRAFT" && (actor.admin || actor.id === doc.created_by),
    }];
  });
}

import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ActionError, currentActor, type CurrentActor } from "./current-actor";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditFilter, type AuditPage } from "@/types/audit";

type AuditEvent = {
  action: string; entityType: string; entityId?: string | null; entityLabel?: string | null;
  summary: string; details?: Prisma.InputJsonObject; outcome?: string;
};
export async function writeAudit(db: Prisma.TransactionClient, actor: Pick<CurrentActor, "id" | "name">, event: AuditEvent) {
  return db.audit_logs.create({ data: {
    actor_id: actor.id || null, actor_name: actor.name.slice(0, 150), action: event.action,
    entity_type: event.entityType, entity_id: event.entityId?.slice(0, 100), entity_label: event.entityLabel?.slice(0, 500),
    summary: event.summary.slice(0, 1000), details: event.details, outcome: event.outcome ?? "SUCCESS",
  } });
}

// Explicit allowlist: credentials, password hashes, citizen IDs and session tokens never enter the log.
export function auditInput(input: Record<string, unknown>): Prisma.InputJsonObject {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const key of ["id", "code", "name", "name_th", "name_en", "title_th", "title_en", "description_th", "prefix_char", "version_year", "wfme_standard_type", "section_number", "username", "email", "firstname", "lastname", "is_active", "role_id", "department_id", "position_id", "program_id", "framework_id", "year", "document_workflow", "parent_id", "course_id", "academic_year_id", "semester_id", "study_year_id", "level_depth", "sort_order", "is_selectable", "is_initial", "level_order"]) {
    const value = input[key];
    if (typeof value === "string") safe[key] = value.slice(0, 500);
    else if ((typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean" || value === null) safe[key] = value;
  }
  if (typeof input.password === "string" && input.password.length) safe.passwordChanged = true;
  return safe;
}

export function mutationEvent(entityType: string, input: Record<string, unknown>, operation?: "CREATE" | "UPDATE" | "DELETE", category?: string): AuditEvent {
  const details = auditInput(input);
  const action = operation || (input.id ? "UPDATE" : "CREATE");
  const entityId = typeof input.id === "number" || typeof input.id === "string" ? String(input.id).slice(0, 100) : null;
  const label = [input.username, input.code, input.name_th, input.name].find(v => typeof v === "string" && v.trim());
  const reference = `${category ? `${category}: ` : ""}${typeof label === "string" ? label.slice(0, 400) : entityId ? `#${entityId}` : "รายการใหม่"}`;
  return { action, entityType, entityId, entityLabel: reference, summary: `${AUDIT_ACTIONS[action]}: ${reference}`, details };
}

export async function auditedChange(
  userId: string,
  event: AuditEvent,
  operation: (actor: CurrentActor) => Promise<{ ok: true } | { ok: false; error: string }>,
  adminOnly = true,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let attemptId: bigint;
  let actor: CurrentActor;
  try {
    actor = await currentActor(userId);
    // Persist the attempt before calling legacy services. A crash leaves STARTED, never a false success.
    const entry = await writeAudit(prisma, actor, { ...event, outcome: "STARTED" });
    attemptId = entry.id;
  } catch (error) {
    return { ok: false, error: error instanceof ActionError ? error.message : "บันทึกประวัติไม่สำเร็จ จึงยังไม่ได้เปลี่ยนข้อมูล กรุณาลองใหม่" };
  }
  let result: { ok: true } | { ok: false; error: string };
  try {
    result = adminOnly && !actor.admin
      ? { ok: false, error: "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการข้อมูลได้" }
      : await operation(actor);
  } catch { result = { ok: false, error: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่" }; }
  try {
    await prisma.audit_logs.update({ where: { id: attemptId }, data: {
      outcome: result.ok ? "SUCCESS" : "FAILED",
      details: { ...event.details, ...(!result.ok ? { error: result.error.slice(0, 1000) } : {}) },
    } });
  } catch {
    // The durable STARTED record remains. Do not claim a committed mutation failed and invite a duplicate retry.
    console.error("Unable to finalize audit outcome; initial attempt is retained");
  }
  return result;
}

function dateBoundary(value: string, nextDay: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ActionError("รูปแบบวันที่ไม่ถูกต้อง");
  const day = new Date(`${value}T00:00:00+07:00`);
  if (!Number.isFinite(day.getTime()) || new Date(day.getTime() + 7 * 3600000).toISOString().slice(0, 10) !== value) throw new ActionError("วันที่ไม่ถูกต้อง");
  return new Date(day.getTime() + (nextDay ? 86400000 : 0));
}
export async function listAuditLog(filter: AuditFilter, userId: string): Promise<AuditPage> {
  const actor = await currentActor(userId);
  if (!actor.admin) throw new ActionError("เฉพาะผู้ดูแลระบบที่เข้าถึง Audit log ได้");
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) throw new ActionError("ตัวกรองไม่ถูกต้อง");
  for (const key of ["search", "action", "entityType", "outcome", "from", "to"] as const) {
    if (filter[key] !== undefined && (typeof filter[key] !== "string" || filter[key].length > 200)) throw new ActionError("ตัวกรองไม่ถูกต้อง");
  }
  if ((filter.action && !Object.hasOwn(AUDIT_ACTIONS, filter.action)) || (filter.entityType && !Object.hasOwn(AUDIT_ENTITIES, filter.entityType)) || (filter.outcome && !["SUCCESS", "FAILED", "STARTED"].includes(filter.outcome))) throw new ActionError("ตัวกรองไม่ถูกต้อง");
  const page = filter.page ?? 1;
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new ActionError("เลขหน้าไม่ถูกต้อง");
  const from = filter.from ? dateBoundary(filter.from, false) : undefined;
  const to = filter.to ? dateBoundary(filter.to, true) : undefined;
  if (from && to && from >= to) throw new ActionError("วันเริ่มต้นต้องไม่เกินวันสิ้นสุด");
  const search = filter.search?.trim();
  const where: Prisma.audit_logsWhereInput = {
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.entityType ? { entity_type: filter.entityType } : {}),
    ...(filter.outcome ? { outcome: filter.outcome } : {}),
    ...(from || to ? { created_at: { gte: from, lt: to } } : {}),
    ...(search ? { OR: ["actor_name", "actor_id", "entity_label", "entity_id", "summary"].map(key => ({ [key]: { contains: search } })) } : {}),
  };
  const pageSize = 20;
  const [rows, total] = await Promise.all([
    prisma.audit_logs.findMany({ where, orderBy: [{ created_at: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.audit_logs.count({ where }),
  ]);
  return { total, page, pageSize, items: rows.map(row => ({
    id: String(row.id), actorId: row.actor_id, actorName: row.actor_name, action: row.action,
    entityType: row.entity_type, entityId: row.entity_id, entityLabel: row.entity_label, outcome: row.outcome,
    summary: row.summary, details: row.details, createdAt: row.created_at.toISOString(),
  })) };
}

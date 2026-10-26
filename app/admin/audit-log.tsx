"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Descriptions, Empty, Input, Modal, Select, Table, Tag } from "antd";
import { RefreshCw } from "lucide-react";
import { listAuditLogAction } from "./audit-actions";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditFilter, type AuditItem, type AuditPage } from "@/types/audit";

const outcomes: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: "สำเร็จ", color: "green" }, FAILED: { label: "ไม่สำเร็จ", color: "red" }, STARTED: { label: "เริ่มดำเนินการ / ยังไม่ยืนยันผล", color: "gold" },
};
const labels: Record<string, string> = {
  revisionId: "รหัสฉบับ", version: "ฉบับ", comment: "ความเห็น", reason: "เหตุผล", title: "ชื่อเอกสาร", status: "สถานะ",
  submissionId: "รหัสสำเนาส่งตรวจ", roundNo: "ครั้งที่ส่งตรวจ", targetVersion: "ฉบับที่เสนออนุมัติ",
  revisionCount: "จำนวนฉบับ", source: "แหล่งประวัติ", error: "รายละเอียดที่ไม่สำเร็จ", passwordChanged: "มีการตั้งรหัสผ่าน",
  storageLocation: "ตำแหน่งจัดเก็บใหม่", previousLocation: "ตำแหน่งจัดเก็บเดิม", previousVersion: "ฉบับก่อนหน้า",
  id: "รหัสรายการ", code: "รหัส", name: "ชื่อ", name_th: "ชื่อภาษาไทย", username: "ชื่อบัญชี", is_active: "เปิดใช้งาน",
  name_en: "ชื่อภาษาอังกฤษ", title_th: "หัวข้อภาษาไทย", title_en: "หัวข้อภาษาอังกฤษ", description_th: "รายละเอียด", prefix_char: "คำนำหน้ารหัส", version_year: "รุ่นกรอบเกณฑ์", wfme_standard_type: "ประเภทมาตรฐาน WFME", section_number: "เลขข้อ", level_order: "ลำดับระดับเอกสาร",
  role_id: "รหัสบทบาท", department_id: "รหัสหน่วยงาน", position_id: "รหัสตำแหน่ง", program_id: "รหัสหลักสูตร", framework_id: "รหัสกรอบเกณฑ์",
  year: "ปี", document_workflow: "รูปแบบเอกสาร", parent_id: "รหัสรายการแม่", course_id: "รหัสรายวิชา", academic_year_id: "รหัสปีการศึกษา",
  semester_id: "รหัสภาคเรียน", study_year_id: "รหัสชั้นปี", level_depth: "ระดับเกณฑ์", sort_order: "ลำดับแสดง", is_selectable: "เลือกผูกเอกสารได้", is_initial: "หลักสูตรใหม่", documentType: "ประเภทเอกสาร",
};
const date = (value: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(value));
function detailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  if (value === "review_history") return "ประวัติการตรวจเดิม";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
export default function AuditLog() {
  const [filter, setFilter] = useState<AuditFilter>({ page: 1 });
  const [search, setSearch] = useState("");
  const [data, setData] = useState<AuditPage>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditItem | null>(null);
  const [pending, startTransition] = useTransition();
  const load = useCallback(() => startTransition(async () => {
    try {
      const result = await listAuditLogAction(filter);
      if (result.ok) { setData(result.data); setError(null); }
      else { setError(result.error); setData({ items: [], total: 0, page: 1, pageSize: 20 }); }
    } catch { setError("โหลดประวัติไม่สำเร็จ กรุณาลองใหม่"); }
  }), [filter]);
  useEffect(load, [load]);
  function change(key: keyof AuditFilter, value: string | undefined) { setFilter(current => ({ ...current, [key]: value, page: 1 })); }
  const details = selected?.details && typeof selected.details === "object" && !Array.isArray(selected.details) ? Object.entries(selected.details) : [];
  return <Card className="mb-9">
    <Alert type="info" showIcon className="mb-5" title="ประวัติการทำงานของระบบ" description="แสดงผู้ดำเนินการ เวลา รายการ และผลการทำงาน เก็บประวัติไว้เมื่อข้อมูลถูกลบ ประวัติย้อนหลังเริ่มจากการเปิดใช้ระบบนี้และประวัติการตรวจเอกสารเดิมที่มีอยู่" />
    <div className="mb-4 flex flex-wrap gap-3">
      <Input.Search className="min-w-64 flex-1" placeholder="ค้นหาผู้ดำเนินการ รหัสรายการ หรือรายละเอียด" aria-label="ค้นหาประวัติ" value={search} onChange={e => setSearch(e.target.value)} onSearch={() => change("search", search)} enterButton="ค้นหา" allowClear />
      <Button icon={<RefreshCw size={16} />} onClick={load} loading={pending}>รีเฟรช</Button>
    </div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Select allowClear placeholder="ทุกประเภทข้อมูล" aria-label="ประเภทข้อมูล" value={filter.entityType} onChange={v => change("entityType", v)} options={Object.entries(AUDIT_ENTITIES).map(([value, label]) => ({ value, label }))} />
      <Select allowClear placeholder="ทุกการดำเนินการ" aria-label="การดำเนินการ" value={filter.action} onChange={v => change("action", v)} options={Object.entries(AUDIT_ACTIONS).map(([value, label]) => ({ value, label }))} />
      <Select allowClear placeholder="ทุกผลการทำงาน" aria-label="ผลการทำงาน" value={filter.outcome} onChange={v => change("outcome", v)} options={Object.entries(outcomes).map(([value, item]) => ({ value, label: item.label }))} />
      <label className="text-xs text-muted">ตั้งแต่วันที่<input aria-label="ตั้งแต่วันที่" type="date" className="mt-1 block w-full rounded border border-line px-2 py-1.5 text-sm" value={filter.from || ""} onChange={e => change("from", e.target.value || undefined)} /></label>
      <label className="text-xs text-muted">ถึงวันที่<input aria-label="ถึงวันที่" type="date" className="mt-1 block w-full rounded border border-line px-2 py-1.5 text-sm" value={filter.to || ""} onChange={e => change("to", e.target.value || undefined)} /></label>
    </div>
    {error && <Alert className="mb-4" type="error" showIcon title={error} />}
    <Table<AuditItem> rowKey="id" dataSource={data.items} loading={pending} scroll={{ x: 1150 }} locale={{ emptyText: <Empty description="ไม่พบประวัติตามเงื่อนไข" /> }} pagination={{ current: filter.page || 1, pageSize: data.pageSize, total: data.total, showSizeChanger: false, onChange: page => setFilter(current => ({ ...current, page })), showTotal: total => `ทั้งหมด ${total} รายการ` }} columns={[
      { title: "เวลา (ประเทศไทย)", dataIndex: "createdAt", width: 190, render: date },
      { title: "ผู้ดำเนินการ", key: "actor", width: 170, render: (_, row) => <div><span>{row.actorName}</span>{row.actorId && <p className="text-xs text-muted">บัญชี #{row.actorId}</p>}</div> },
      { title: "ประเภทข้อมูล", dataIndex: "entityType", width: 145, render: (value: string) => AUDIT_ENTITIES[value as keyof typeof AUDIT_ENTITIES] || value },
      { title: "การดำเนินการ", dataIndex: "action", width: 130, render: (value: string) => AUDIT_ACTIONS[value as keyof typeof AUDIT_ACTIONS] || value },
      { title: "รายการ", key: "entity", render: (_, row) => <div className="break-words"><p>{row.entityLabel || row.entityId || "—"}</p><p className="text-xs text-muted">{row.summary}</p></div> },
      { title: "ผล", dataIndex: "outcome", width: 135, render: value => <Tag color={outcomes[value]?.color}>{outcomes[value]?.label || value}</Tag> },
      { title: "รายละเอียด", key: "details", width: 100, render: (_, row) => <Button onClick={() => setSelected(row)}>ดูประวัติ</Button> },
    ]} />
    <Modal title="รายละเอียด Audit log" open={!!selected} onCancel={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>ปิด</Button>} width={720}>
      {selected && <Descriptions column={1} bordered size="small" items={[
        { key: "actor", label: "ผู้ดำเนินการ", children: selected.actorName },
        { key: "date", label: "เวลา (ประเทศไทย)", children: date(selected.createdAt) },
        { key: "summary", label: "รายละเอียด", children: selected.summary },
        { key: "result", label: "ผลการทำงาน", children: outcomes[selected.outcome]?.label || selected.outcome },
        ...details.map(([key, value]) => ({ key, label: labels[key] || key, children: <span className="whitespace-pre-wrap break-all">{detailValue(value)}</span> })),
      ]} />}
    </Modal>
  </Card>;
}

"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Empty, Input, Modal, Segmented, Table, Tag } from "antd";
import { RefreshCw, Trash2 } from "lucide-react";
import { deleteQualityDocumentAction, listQualityDeletionAction } from "./audit-actions";
import type { DeletionItem } from "@/types/audit";
import QualityDocumentWorkflow from "../quality-document-workflow";

export default function QualityDocumentDeletion() {
  const [deleted, setDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<DeletionItem[]>([]);
  const [selected, setSelected] = useState<DeletionItem | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const load = useCallback(() => startTransition(async () => {
    try {
      const result = await listQualityDeletionAction(deleted, query);
      if (result.ok) { setRows(result.documents); setError(null); }
      else { setRows([]); setError(result.error); }
    } catch { setError("โหลดรายการไม่สำเร็จ กรุณาลองใหม่"); }
  }), [deleted, query]);
  useEffect(load, [load]);
  function remove() {
    if (!selected) return;
    startTransition(async () => {
      try {
        const result = await deleteQualityDocumentAction({ id: selected.id, token: selected.token, reason, confirmationCode: confirmation });
        if (!result.ok) { setError(result.error); return; }
        setNotice(`ลบ ${selected.code} ออกจากรายการใช้งานแล้ว`);
        setSelected(null); load();
      } catch { setError("ลบเอกสารไม่สำเร็จ กรุณาลองใหม่"); }
    });
  }
  return <Card className="mb-9">
    <Alert type="warning" showIcon className="mb-5" title="การลบสำหรับผู้ดูแลระบบ" description="ลบเอกสารออกจากรายการใช้งานและหยุดการแก้ไข/อนุมัติ เก็บไฟล์ รหัส และประวัติไว้เพื่อตรวจสอบย้อนหลัง รหัสเดิมจะไม่ถูกนำไปออกซ้ำ" />
    <div className="mb-5 flex flex-wrap gap-3">
      <Segmented value={deleted ? "deleted" : "active"} onChange={value => { setDeleted(value === "deleted"); setNotice(null); }} options={[{ label: "เอกสารที่ใช้งาน", value: "active" }, { label: "เอกสารที่ลบแล้ว", value: "deleted" }]} />
      <Input.Search className="min-w-64 flex-1" aria-label="ค้นหาเอกสารสำหรับลบ" placeholder="ค้นหารหัสหรือชื่อเอกสาร" value={search} onChange={e => setSearch(e.target.value)} onSearch={() => setQuery(search)} allowClear enterButton="ค้นหา" />
      <Button icon={<RefreshCw size={16} />} onClick={load} loading={pending}>รีเฟรช</Button>
    </div>
    {error && <Alert className="mb-4" type="error" showIcon title={error} />}
    {notice && <Alert className="mb-4" type="success" showIcon title={notice} />}
    <Table<DeletionItem> rowKey="id" dataSource={rows} loading={pending} scroll={{ x: 1050 }} pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: <Empty description="ไม่พบเอกสารตามเงื่อนไข" /> }} columns={[
      { title: "รหัสเอกสารหลัก", dataIndex: "code", width: 300, render: value => <span className="break-all font-mono text-xs">{value}</span> },
      { title: "ชื่อเอกสาร", dataIndex: "title" },
      { title: "หน่วยงาน", dataIndex: "department", width: 100 },
      { title: "สถานะ", key: "status", width: 120, render: (_, row) => <Tag color={row.deletedAt ? "red" : row.status === "PUBLISHED" ? "green" : "default"}>{row.deletedAt ? "ลบแล้ว" : row.status === "PUBLISHED" ? "มีผลใช้งาน" : row.status === "ARCHIVED" ? "เก็บถาวร" : "ฉบับร่าง"}</Tag> },
      ...(deleted ? [{ title: "เหตุผลที่ลบ", dataIndex: "reason" as const, key: "reason" }] : []),
      { title: "จัดการ", key: "actions", width: 215, render: (_, row) => <div className="flex flex-wrap gap-2"><Button onClick={() => setView(row.id)}>ประวัติ / ฉบับ</Button>{!row.deletedAt && <Button danger icon={<Trash2 size={14} />} onClick={() => { setSelected(row); setReason(""); setConfirmation(""); setError(null); }}>ลบ</Button>}</div> },
    ]} />
    <Modal title="ยืนยันลบเอกสารคุณภาพ" open={!!selected} mask={{ closable: false }} closable={!pending} onCancel={() => setSelected(null)} onOk={remove} confirmLoading={pending} okText="ลบเอกสาร" cancelText="ยกเลิก" okButtonProps={{ danger: true, disabled: !selected || confirmation.trim() !== selected.code || !reason.trim() }} cancelButtonProps={{ disabled: pending }}>
      {selected && <div className="space-y-4">
        <p className="font-medium">{selected.title}</p><p className="break-all font-mono text-xs">{selected.code}</p>
        <Alert type="warning" showIcon title="เอกสารจะหายจากรายการใช้งานทันที" description="ฉบับร่างและฉบับรออนุมัติจะไม่สามารถดำเนินการต่อได้ ไฟล์และประวัติยังเก็บไว้สำหรับ admin" />
        <div><label htmlFor="delete-reason" className="mb-2 block text-sm">เหตุผลที่ลบ</label><Input.TextArea id="delete-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} disabled={pending} /></div>
        <div><label htmlFor="delete-confirmation" className="mb-2 block text-sm">พิมพ์รหัสเอกสารหลักด้านบนเพื่อยืนยัน</label><Input id="delete-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={pending} /></div>
        {error && <Alert type="error" showIcon title={error} action={<Button onClick={() => { setSelected(null); load(); }}>รีเฟรชรายการ</Button>} />}
      </div>}
    </Modal>
    {view && <QualityDocumentWorkflow documentId={view} onClose={() => setView(null)} onChanged={load} />}
  </Card>;
}

"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Alert, Button, Card, Empty, Input, Pagination, Table, Tag } from "antd";
import { RefreshCw, Search } from "lucide-react";
import { qualityApprovalQueueAction } from "./documents/approval-actions";
import type { ApprovalQueueItem } from "@/types/quality-document";
import QualityDocumentWorkflow from "./quality-document-workflow";
import "./quality-document-list.css";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value)) : "—";
export default function QualityDocumentApprovals() {
  const [documents, setDocuments] = useState<ApprovalQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const load = useCallback(() => startTransition(async () => {
    try {
      const result = await qualityApprovalQueueAction();
      if (result.ok) { setDocuments(result.documents); setError(null); }
      else setError(result.error);
    } catch { setError("โหลดรายการไม่สำเร็จ กรุณาลองใหม่"); }
  }), []);
  useEffect(load, [load]);
  const filtered = useMemo(() => documents.filter(doc => `${doc.documentCode}-${doc.targetVersion} ${doc.title} ${doc.submittedBy}`.toLowerCase().includes(search.trim().toLowerCase())), [documents, search]);
  const pagination = { current: Math.min(page, Math.max(1, Math.ceil(filtered.length / 5))), pageSize: 5, total: filtered.length, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true };
  const action = (doc: ApprovalQueueItem) => <Button type={doc.canReview ? "primary" : "default"} onClick={() => setSelected(doc.documentId)}>{doc.canReview ? "ตรวจเอกสาร" : "ดูสถานะ"}</Button>;
  return <Card size="small" className="qa-document-list">
    <div className="qa-list-toolbar"><Input allowClear value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="ค้นหารหัส ชื่อเอกสาร หรือผู้ส่งตรวจ" aria-label="ค้นหาเอกสารรออนุมัติ" prefix={<Search size={16} aria-hidden="true" />} /><Button icon={<RefreshCw size={16} aria-hidden="true" />} loading={pending} onClick={load} aria-label="รีเฟรชรายการรออนุมัติ" /></div>
    {error && <Alert className="my-3" type="error" showIcon title={error} />}
    <p className="my-3 text-xs text-muted">รออนุมัติ {filtered.length} รายการ · ผู้จัดทำหรือผู้ส่งตรวจอนุมัติฉบับของตนเองไม่ได้</p>
    <div className="qa-desktop-documents"><Table<ApprovalQueueItem> rowKey="id" dataSource={filtered} loading={pending} size="small" scroll={{ x: 720 }} pagination={pagination} locale={{ emptyText: <Empty description="ไม่มีเอกสารรออนุมัติ" /> }} columns={[
      { title: "เอกสาร", key: "document", render: (_, doc) => <div><button className="qa-document-title" onClick={() => setSelected(doc.documentId)}>{doc.title}</button><p className="mt-1 break-all font-mono text-xs text-muted">{doc.documentCode}</p></div> },
      { title: "ฉบับเสนอ / ใช้งาน", key: "version", width: 155, render: (_, doc) => <div><Tag color="gold">เสนอ {doc.targetVersion}</Tag><p className="mt-1 text-xs text-muted">{doc.currentVersion === "000" ? "ยังไม่มีฉบับใช้งาน" : `ใช้งาน ${doc.currentVersion}`}</p></div> },
      { title: "ผู้ส่งตรวจ", key: "sender", width: 180, render: (_, doc) => <div><p>{doc.submittedBy}</p><p className="mt-1 text-xs text-muted">{date(doc.submittedAt)}</p></div> },
      { title: "ดำเนินการ", key: "review", width: 150, render: (_, doc) => action(doc) },
    ]} /></div>
    <div className="qa-mobile-documents" aria-busy={pending}>
      {filtered.slice((pagination.current - 1) * 5, pagination.current * 5).map(doc => <article key={doc.id} className="qa-mobile-document"><button className="qa-document-title" onClick={() => setSelected(doc.documentId)}>{doc.title}</button><p className="mt-1 break-all font-mono text-xs text-muted">{doc.documentCode}</p><p className="my-2 text-xs text-muted">เสนอฉบับ {doc.targetVersion} · {doc.submittedBy} · {date(doc.submittedAt)}</p>{action(doc)}</article>)}
      {!filtered.length && <Empty description="ไม่มีเอกสารรออนุมัติ" />}<Pagination size="small" {...pagination} />
    </div>
    {selected && <QualityDocumentWorkflow documentId={selected} onClose={() => setSelected(null)} onChanged={load} />}
  </Card>;
}

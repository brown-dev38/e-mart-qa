"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Alert, Button, Card, Empty, Input, Pagination, Table, Tabs, Tag } from "antd";
import { RefreshCw, Search } from "lucide-react";
import { qualityReviewInboxAction } from "./documents/approval-actions";
import QualityDocumentWorkflow from "./quality-document-workflow";
import type { QualityReviewItem, QualityReviewPhase } from "@/types/quality-document";
import "./quality-document-list.css";

const phases = { RETURNED: { label: "ส่งกลับให้แก้ไข", color: "orange" }, DRAFT: { label: "ฉบับร่าง", color: "blue" }, PENDING: { label: "รอตรวจอนุมัติ", color: "gold" }, APPROVED: { label: "อนุมัติแล้ว", color: "green" }, SUPERSEDED: { label: "ถูกแทนที่", color: "default" }, WITHDRAWN: { label: "ยกเลิกใช้", color: "red" } };
const date = (value: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));

export default function QualityDocumentReviewInbox() {
  const [documents, setDocuments] = useState<QualityReviewItem[]>([]);
  const [phase, setPhase] = useState<QualityReviewPhase | "ALL">("RETURNED");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const load = useCallback(() => startTransition(async () => {
    try {
      const result = await qualityReviewInboxAction();
      if (result.ok) { setDocuments(result.documents); setError(null); }
      else { setDocuments([]); setError(result.error); }
    } catch { setError("โหลดรายการติดตามไม่สำเร็จ กรุณาลองใหม่"); }
  }), []);
  useEffect(load, [load]);
  const filtered = useMemo(() => documents.filter(doc => (phase === "ALL" || doc.phase === phase) && `${doc.documentCode} ${doc.title} ${doc.reviewComment || ""}`.toLowerCase().includes(search.trim().toLowerCase())), [documents, phase, search]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 5)));
  const pagination = { current: currentPage, pageSize: 5, total: filtered.length, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true };
  const action = (doc: QualityReviewItem) => <Button type={doc.phase === "RETURNED" ? "primary" : "default"} onClick={() => setSelected(doc.id)}>{doc.canEdit ? doc.phase === "RETURNED" ? "แก้ไขเอกสาร" : "เปิดฉบับร่าง" : "ดูรายละเอียด"}</Button>;
  return <Card size="small" className="qa-document-list">
    <div className="qa-list-toolbar">
      <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} allowClear prefix={<Search size={16} aria-hidden="true" />} aria-label="ค้นหางานตรวจและแก้ไข" placeholder="ค้นหารหัส ชื่อเอกสาร หรือข้อเสนอแนะ" />
      <Button onClick={load} loading={pending} aria-label="รีเฟรชงานตรวจและแก้ไข" icon={<RefreshCw size={16} aria-hidden="true" />} />
    </div>
    <Tabs className="mt-2" activeKey={phase} onChange={value => { setPhase(value as QualityReviewPhase | "ALL"); setPage(1); }} items={[
      { key: "ALL", label: `ทั้งหมด (${documents.length})` },
      ...(Object.keys(phases) as QualityReviewPhase[]).map(key => ({ key, label: `${phases[key].label} (${documents.filter(doc => doc.phase === key).length})` })),
    ]} />
    {error && <Alert type="error" showIcon className="mb-3" title={error} />}
    {phase === "RETURNED" && <p className="mb-3 text-xs text-muted">เปิดเอกสารเพื่ออ่านข้อเสนอแนะ แก้ไข แล้วส่งตรวจซ้ำ</p>}
    <div className="qa-desktop-documents"><Table<QualityReviewItem> rowKey="id" dataSource={filtered} loading={pending} size="small" scroll={{ x: 760 }} pagination={pagination} locale={{ emptyText: <Empty description={phase === "RETURNED" ? "ไม่มีเอกสารที่รอคุณแก้ไข" : "ไม่พบเอกสารตามเงื่อนไข"} /> }} columns={[
      { title: "เอกสาร", key: "document", render: (_, doc) => <div><button className="qa-document-title" onClick={() => setSelected(doc.id)}>{doc.title}</button><p className="mt-1 break-all font-mono text-xs text-muted">{doc.documentCode}</p><p className="mt-1 text-xs text-muted">{doc.department} · {doc.program} · ฉบับ {doc.targetVersion}</p></div> },
      { title: "สถานะ", key: "phase", width: 155, render: (_, doc) => <div><Tag color={phases[doc.phase].color}>{phases[doc.phase].label}</Tag><p className="mt-1 text-xs text-muted">{doc.roundNo ? `ส่งตรวจ ${doc.roundNo} ครั้ง` : "ยังไม่ได้ส่งตรวจ"}</p></div> },
      { title: "ผลตรวจล่าสุด", key: "feedback", width: 240, render: (_, doc) => <div><p className="line-clamp-2 whitespace-pre-wrap break-words text-sm">{doc.reviewComment || (doc.phase === "PENDING" ? "กำลังรอผลการตรวจ" : "—")}</p>{doc.reviewedBy && <p className="mt-1 text-xs text-muted">{doc.reviewedBy}{doc.reviewedAt ? ` · ${date(doc.reviewedAt)}` : ""}</p>}</div> },
      { title: "ดำเนินการ", key: "actions", width: 150, render: (_, doc) => action(doc) },
    ]} /></div>
    <div className="qa-mobile-documents" aria-busy={pending}>
      {filtered.slice((currentPage - 1) * 5, currentPage * 5).map(doc => <article key={doc.id} className="qa-mobile-document">
        <button className="qa-document-title" onClick={() => setSelected(doc.id)}>{doc.title}</button><p className="mt-1 break-all font-mono text-xs text-muted">{doc.documentCode}</p>
        <div className="my-2"><Tag color={phases[doc.phase].color}>{phases[doc.phase].label}</Tag><span className="text-xs text-muted">ฉบับ {doc.targetVersion} · ส่งตรวจ {doc.roundNo} ครั้ง</span></div>
        {doc.reviewComment && <p className="mb-3 line-clamp-2 whitespace-pre-wrap text-sm">{doc.reviewComment}</p>}{action(doc)}
      </article>)}
      {!filtered.length && <Empty description={phase === "RETURNED" ? "ไม่มีเอกสารที่รอคุณแก้ไข" : "ไม่พบเอกสารตามเงื่อนไข"} />}<Pagination size="small" {...pagination} />
    </div>
    {selected && <QualityDocumentWorkflow documentId={selected} onClose={() => setSelected(null)} onChanged={load} />}
  </Card>;
}

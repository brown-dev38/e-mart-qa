"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert, Button, Empty, Modal, Table, Tag, type TableProps } from "antd";
import { Eye } from "lucide-react";
import { qualityDocumentVersionsAction } from "./documents/version-actions";
import QualityDocumentPreview from "./quality-document-preview";
import type { DocumentVersion, DocumentVersions, VersionState } from "@/types/quality-document-versions";

const states: Record<VersionState, { label: string; color: string }> = {
  DRAFT: { label: "ฉบับร่าง", color: "default" }, RETURNED: { label: "ส่งกลับแก้ไข", color: "orange" },
  PENDING: { label: "รออนุมัติ", color: "gold" }, SCHEDULED: { label: "อนุมัติแล้ว · รอมีผล", color: "blue" },
  EFFECTIVE: { label: "มีผลใช้บังคับ", color: "green" }, SUPERSEDED: { label: "ฉบับเก่า", color: "default" },
  WITHDRAWN: { label: "ยกเลิกใช้", color: "red" },
};
const date = (value: string | null) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(value)) : "—";

export default function QualityDocumentVersions({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<DocumentVersions | null>(null);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      try {
        const result = await qualityDocumentVersionsAction(documentId);
        if (cancelled) return;
        if (result.ok) { setDetail(result.detail); setError(null); }
        else setError(result.error);
      } catch { if (!cancelled) setError("โหลดเวอร์ชันเอกสารไม่สำเร็จ กรุณาลองใหม่"); }
    });
    return () => { cancelled = true; };
  }, [documentId, attempt]);
  const revision = detail?.versions.find(item => item.id === selected)
    ?? detail?.versions.find(item => item.state === "EFFECTIVE") ?? detail?.versions[0];
  const columns: TableProps<DocumentVersion>["columns"] = [
    { title: "เวอร์ชัน", key: "version", width: 105, render: (_, item) => <span className="font-medium">{item.version}</span> },
    { title: "ชื่อเอกสาร", key: "title", render: (_, item) => <div><p className="break-words">{item.title}</p>{item.changeNote && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted">{item.changeNote}</p>}<p className="mt-1 break-all text-xs text-muted">{item.fileName || "ยังไม่มีไฟล์"}</p></div> },
    { title: "สถานะ", key: "state", width: 175, render: (_, item) => <Tag color={states[item.state].color}>{states[item.state].label}</Tag> },
    { title: "วันที่มีผลใช้", key: "date", width: 140, render: (_, item) => date(item.effectiveDate) },
    { title: "พรีวิว", key: "preview", width: 120, render: (_, item) => <Button icon={<Eye size={15} aria-hidden="true" />}
      disabled={!item.previewUrl} onClick={() => setSelected(item.id)} aria-label={`ดูพรีวิวเวอร์ชัน ${item.version}`}>ดูพรีวิว</Button> },
  ];
  return <Modal title="เอกสารทุกเวอร์ชัน" open onCancel={onClose} width={1120} style={{ top: 20 }}
    footer={<Button onClick={onClose}>ปิด</Button>} loading={!detail && pending}>
    {error && <Alert type="error" showIcon className="mb-4" title={error} action={<Button onClick={() => setAttempt(value => value + 1)}>ลองใหม่</Button>} />}
    {detail && <div className="space-y-5">
      <div><p className="break-all font-mono text-xs text-muted">{detail.code}</p><h2 className="mt-2 text-lg font-medium">{detail.title}</h2>
        <p className="mt-2 text-xs text-muted">เอกสารทุกเวอร์ชันที่คุณมีสิทธิ์ดู พร้อมสถานะและพรีวิว</p></div>
      {detail.deleted && <Alert type="warning" showIcon title="เอกสารนี้ถูกนำออกจากรายการใช้งานแล้ว" />}
      <Table<DocumentVersion> rowKey="id" size="small" columns={columns} dataSource={detail.versions} loading={pending}
        scroll={{ x: 760 }} pagination={{ pageSize: 5, showSizeChanger: false, hideOnSinglePage: true }}
        rowClassName={item => item.id === revision?.id ? "qa-selected-version" : ""}
        locale={{ emptyText: <Empty description="ไม่มีเวอร์ชันเอกสารที่คุณเข้าถึงได้" /> }} />
      {revision && <div className="rounded-xl border border-line bg-canvas p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">พรีวิว · {revision.version}</h3><Tag color={states[revision.state].color}>{states[revision.state].label}</Tag></div>
        {revision.description && <p className="mb-4 whitespace-pre-wrap break-words text-sm text-muted">{revision.description}</p>}
        {revision.previewUrl ? <QualityDocumentPreview key={revision.id} url={revision.previewUrl} title={revision.title} /> : <Empty description="เวอร์ชันนี้ยังไม่มีไฟล์สำหรับพรีวิว" />}
      </div>}
    </div>}
  </Modal>;
}

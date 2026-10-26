"use client";

import { useState } from "react";
import { Alert, Button, Descriptions, Empty, Input, Modal, Pagination, Timeline } from "antd";
import { updateQualityRegistryAction, withdrawQualityDocumentAction } from "./documents/approval-actions";
import type { QualityWorkflowDetail, WorkflowResult } from "@/types/quality-document";

export default function QualityDocumentRegistry({ detail, pending, onRun }: {
  detail: QualityWorkflowDetail; pending: boolean;
  onRun: (operation: () => Promise<WorkflowResult>, successMessage?: string) => void;
}) {
  const [location, setLocation] = useState(detail.storageLocation);
  const [reason, setReason] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [page, setPage] = useState(1);
  return <div className="qa-workflow-pane space-y-4">
    <Descriptions column={1} size="small" items={[
      { key: "code", label: "รหัสเอกสาร", children: detail.documentCode },
      { key: "version", label: "ฉบับมีผลใช้", children: detail.archived ? "ยกเลิกใช้" : detail.currentVersion ?? "ยังไม่มีฉบับอนุมัติที่มีผลใช้" },
      { key: "location", label: "ตำแหน่งจัดเก็บ", children: detail.storageLocation || "ยังไม่ระบุ" },
    ]} />
    {detail.canEditRegistry && <div className="space-y-3">
      <Alert type="info" showIcon title="การแก้ทะเบียนนี้ไม่เปลี่ยนเนื้อหา เลขฉบับ หรือข้อมูลอนุมัติเดิม" />
      <div><label className="qa-field-label" htmlFor="registry-location">ตำแหน่งจัดเก็บ</label><Input id="registry-location" value={location} maxLength={1000} disabled={pending} onChange={e => setLocation(e.target.value)} /></div>
      <div><label className="qa-field-label" htmlFor="registry-reason">เหตุผลการแก้ทะเบียน *</label><Input.TextArea id="registry-reason" value={reason} maxLength={2000} disabled={pending} onChange={e => setReason(e.target.value)} /></div>
      <Button disabled={pending || location.trim() === detail.storageLocation || !reason.trim()} onClick={() => onRun(() => updateQualityRegistryAction({ documentId: detail.id, lockVersion: detail.registryVersion, storageLocation: location, reason }), "บันทึกการแก้ทะเบียนแล้ว")}>บันทึกทะเบียน</Button>
    </div>}
    <h3 className="text-sm font-medium">ประวัติการแก้ทะเบียน</h3>
    {detail.registryChanges.length ? <><Timeline items={detail.registryChanges.slice((page - 1) * 5, page * 5).map(item => ({ key: item.id,
      content: <div className="space-y-1 text-sm"><p>{item.actor} · {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(item.date))}</p><p className="break-words">{item.previousLocation || "ไม่ระบุ"} → {item.storageLocation || "ไม่ระบุ"}</p><p className="whitespace-pre-wrap break-words text-muted">{item.reason}</p></div>,
    }))} /><Pagination size="small" current={page} pageSize={5} total={detail.registryChanges.length} onChange={setPage} hideOnSinglePage showSizeChanger={false} /></> : <Empty description="ยังไม่มีประวัติการแก้ทะเบียน" />}
    {detail.canWithdraw && <Button danger disabled={pending} onClick={() => setWithdrawing(true)}>ยกเลิกใช้เอกสาร</Button>}
    <Modal title="ยืนยันยกเลิกใช้เอกสาร" open={withdrawing} onCancel={() => setWithdrawing(false)} confirmLoading={pending} okText="ยกเลิกใช้" cancelText="กลับ" okButtonProps={{ danger: true, disabled: !withdrawReason.trim() }} onOk={() => {
      setWithdrawing(false);
      onRun(() => withdrawQualityDocumentAction({ documentId: detail.id, lockVersion: detail.registryVersion, reason: withdrawReason }), "ยกเลิกใช้เอกสารแล้ว");
    }}>
      <p className="mb-3">เอกสารจะดาวน์โหลดเพื่อใช้งานไม่ได้ โดยเก็บฉบับและประวัติเดิมไว้ตรวจสอบย้อนหลัง</p>
      <label className="qa-field-label" htmlFor="withdraw-reason">เหตุผลการยกเลิกใช้ *</label><Input.TextArea id="withdraw-reason" value={withdrawReason} maxLength={2000} onChange={e => setWithdrawReason(e.target.value)} />
    </Modal>
  </div>;
}

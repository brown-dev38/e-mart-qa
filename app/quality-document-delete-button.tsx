"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Modal } from "antd";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteQualityDocumentAction, getQualityDeletionAction } from "./admin/audit-actions";
import type { DeletionItem } from "@/types/audit";

export default function QualityDocumentDeleteButton({ documentId, title, onDeleted }: {
  documentId: string; title: string; onDeleted: () => void;
}) {
  const [document, setDocument] = useState<DeletionItem | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function prepare() {
    startTransition(async () => {
      try {
        const result = await getQualityDeletionAction(documentId);
        if (!result.ok) { toast.error(result.error); return; }
        setDocument(result.document);
        setReason(""); setConfirmation(""); setError(null);
      } catch { toast.error("โหลดข้อมูลสำหรับลบไม่สำเร็จ กรุณาลองใหม่"); }
    });
  }

  function remove() {
    if (!document || pending) return;
    startTransition(async () => {
      try {
        const result = await deleteQualityDocumentAction({
          id: document.id, token: document.token, confirmationCode: confirmation, reason,
        });
        if (!result.ok) { setError(result.error); return; }
        setDocument(null);
        toast.success("ลบเอกสารออกจากรายการใช้งานแล้ว");
        onDeleted();
      } catch { setError("ลบเอกสารไม่สำเร็จ กรุณาลองใหม่"); }
    });
  }

  return <>
    <Button danger type="text" title="ลบเอกสาร" aria-label={`ลบเอกสาร ${title}`}
      icon={<Trash2 size={16} aria-hidden="true" />} loading={pending && !document} disabled={pending}
      onClick={prepare} />
    <Modal title="ยืนยันลบเอกสารคุณภาพ" open={!!document} onOk={remove}
      onCancel={() => { if (!pending) setDocument(null); }} mask={{ closable: !pending }}
      closable={!pending} confirmLoading={pending} okText="ลบเอกสาร" cancelText="ยกเลิก"
      okButtonProps={{ danger: true, disabled: !document || confirmation.trim() !== document.code || !reason.trim() }}
      cancelButtonProps={{ disabled: pending }}>
      {document && <div className="mt-4 space-y-4">
        <p className="font-medium">{document.title}</p>
        <p className="break-all font-mono text-xs">{document.code}</p>
        <Alert type="warning" showIcon title="เอกสารจะถูกนำออกจากรายการใช้งาน"
          description="เก็บไฟล์และประวัติไว้สำหรับตรวจสอบย้อนหลัง และหยุดการแก้ไขหรืออนุมัติเอกสารนี้" />
        <div><label htmlFor={`delete-reason-${documentId}`} className="mb-2 block text-sm">เหตุผลที่ลบ</label>
          <Input.TextArea id={`delete-reason-${documentId}`} value={reason} onChange={e => setReason(e.target.value)}
            maxLength={1000} rows={3} disabled={pending} /></div>
        <div><label htmlFor={`delete-confirmation-${documentId}`} className="mb-2 block text-sm">พิมพ์รหัสเอกสารด้านบนเพื่อยืนยัน</label>
          <Input id={`delete-confirmation-${documentId}`} value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={pending} /></div>
        {error && <Alert type="error" showIcon title={error} action={<Button disabled={pending} onClick={prepare}>โหลดข้อมูลล่าสุด</Button>} />}
      </div>}
    </Modal>
  </>;
}

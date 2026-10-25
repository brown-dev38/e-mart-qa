"use client";

import { startTransition, useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Popover, Select, Upload, type UploadFile } from "antd";
import { Copy, Eye, FileText, Info, Paperclip, RotateCcw, Save, Trash2, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import { buildDocumentPrefix, EMPTY_DOCUMENT, isValidCriterion, readDocumentDraft, type DocumentCatalog, type DocumentFormValues } from "@/lib/quality-document-catalog";
import { documentDraftKey } from "@/lib/quality-document-draft";
import { saveQualityDocumentAction } from "./documents/actions";
import QualityDocumentWorkflow from "./quality-document-workflow";
import "./quality-document-form.css";

export default function QualityDocumentForm({ userId, catalog }: { userId: string; catalog: DocumentCatalog }) {
  const [form] = Form.useForm<DocumentFormValues>();
  const values = (Form.useWatch([], { form, preserve: true }) ?? EMPTY_DOCUMENT) as DocumentFormValues;
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const [needsAttachment, setNeedsAttachment] = useState(false);
  const [saving, startSaving] = useTransition();
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [openedDocument, setOpenedDocument] = useState<string | null>(null);
  const draftKey = documentDraftKey(userId);
  const department = catalog.departments.find(item => item.value === values.department);
  const jobOptions = values.department ? catalog.subDepartments[values.department] ?? [] : [];
  const curriculum = catalog.programs.find(item => item.value === values.curriculum);
  const framework = curriculum?.framework;
  const prefix = buildDocumentPrefix(values, catalog);
  const code = prefix ? `${prefix}-XXX-000` : null;
  const isManagement = department ? !department.hasSubDepartment : false;

  useEffect(() => {
    try {
      const draft = readDocumentDraft(localStorage.getItem(draftKey), catalog);
      if (draft) startTransition(() => {
        form.setFieldsValue(draft.values);
        setRestored(true);
        setNeedsAttachment(draft.hadAttachment);
      });
    } catch { /* The form also works without browser storage. */ }
  }, [draftKey, form, catalog]);

  function saveDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ values: form.getFieldsValue(true), hadAttachment: files.length > 0 || needsAttachment }));
      setRestored(true);
      toast.success("เก็บข้อมูลไว้กรอกต่อในเครื่องนี้แล้ว ไฟล์แนบต้องเลือกใหม่เมื่อเปิดครั้งถัดไป");
    } catch { toast.error("เก็บข้อมูลไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์"); }
  }
  function resetForm() {
    form.resetFields(); setFiles([]); setRestored(false); setNeedsAttachment(false);
    try { localStorage.removeItem(draftKey); }
    catch { toast.error("ล้างแบบฟอร์มแล้ว แต่ลบข้อมูลที่เก็บในเครื่องไม่ได้"); }
  }
  async function copyCode(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success("คัดลอกรหัสเอกสารแล้ว"); }
    catch { toast.error("คัดลอกรหัสไม่ได้ กรุณาเลือกรหัสแล้วคัดลอกด้วยตนเอง"); }
  }
  function saveDocument() {
    const current = form.getFieldsValue(true) as DocumentFormValues;
    const payload = new FormData();
    for (const [key, value] of Object.entries({ department: current.department, job: current.job, program: current.curriculum, level: current.level, criterion: current.criterion, title: current.title, description: current.description })) payload.set(key, value ?? "");
    const file = files[0]?.originFileObj as File | undefined;
    if (file) payload.set("file", file);
    startSaving(async () => {
      try {
        const result = await saveQualityDocumentAction(payload);
        if (!result.ok) { toast.error(result.error); return; }
        setSavedCode(`${result.documentCode}-000`);
        setSavedId(result.documentId);
        toast.success("บันทึกเอกสารแล้ว"); setReviewOpen(false); resetForm();
      } catch { toast.error("เชื่อมต่อไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง"); }
    });
  }
  async function preview() {
    try { await form.validateFields(); setReviewOpen(true); }
    catch { toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน"); }
  }
  const summary = [
    { key: "department", label: "หน่วยงาน", children: department?.label || "—" },
    ...(!isManagement ? [{ key: "job", label: "ชื่องาน", children: jobOptions.find(item => item.value === values.job)?.label || "—" }] : []),
    { key: "program", label: "หลักสูตร", children: curriculum?.label || "—" },
    { key: "level", label: "ระดับเอกสาร", children: catalog.levels.find(item => item.value === values.level)?.label || "—" },
    { key: "criterion", label: "เกณฑ์", children: values.criterion || "—" },
  ];

  return <Form<DocumentFormValues> form={form} name="quality-document" layout="vertical" initialValues={EMPTY_DOCUMENT} disabled={saving}
    scrollToFirstError={{ focus: true }} onFinish={saveDocument}
    onFinishFailed={() => toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน", { id: "document-validation" })}
    className="qa-document-form">
    {savedCode && <Alert className="mb-3" type="success" showIcon title="บันทึกเป็นฉบับร่างแล้ว"
      description={<span className="break-all font-mono text-xs">{savedCode}</span>}
      action={<div className="flex flex-wrap gap-2"><Button size="small" onClick={() => copyCode(savedCode)} icon={<Copy size={14} aria-hidden="true" />}>คัดลอก</Button><Button size="small" type="primary" disabled={!savedId} onClick={() => setOpenedDocument(savedId)}>เปิดเอกสาร / ส่งตรวจ</Button></div>} />}
    <Card size="small">
      <div className="qa-form-columns">
        <section className="min-w-0" aria-labelledby="qa-category-title">
          <h2 id="qa-category-title" className="qa-form-section-title">1. จัดหมวดหมู่เอกสาร</h2>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="department" label="หน่วยงาน" rules={[{ required: true, message: "กรุณาเลือกหน่วยงาน" }]}>
              <Select placeholder="เลือกหน่วยงาน" options={catalog.departments.map(item => ({ value: item.value, label: item.label }))}
                onChange={() => form.setFieldValue("job", undefined)} />
            </Form.Item>
            {!isManagement ? <Form.Item name="job" label="ชื่องาน" rules={[{ required: true, message: "กรุณาเลือกชื่องาน" }]}>
              <Select placeholder={values.department ? "เลือกชื่องาน" : "เลือกหน่วยงานก่อน"} disabled={saving || !department?.hasSubDepartment} options={jobOptions} />
            </Form.Item> : <div className="qa-form-inline-note">หน่วยงานนี้ไม่มีงานย่อย</div>}
            <Form.Item name="curriculum" label="หลักสูตร" rules={[{ required: true, message: "กรุณาเลือกหลักสูตร" }]}>
              <Select placeholder="เลือกหลักสูตร" options={catalog.programs.map(item => ({ value: item.value, label: item.label }))}
                onChange={() => form.setFieldValue("criterion", undefined)} />
            </Form.Item>
            <Form.Item name="level" label="ระดับเอกสาร" rules={[{ required: true, message: "กรุณาเลือกระดับเอกสาร" }]}>
              <Select placeholder="เลือกระดับเอกสาร" options={catalog.levels} />
            </Form.Item>
          </div>
          <Form.Item name="criterion" label={<>เกณฑ์ประเมิน{framework && <span className="ml-2 text-xs text-muted">{framework}</span>}</>}
            rules={[{ required: true, message: "กรุณาเลือกเกณฑ์ประเมิน" }, { validator: (_, value: string | undefined) => !value || !framework || isValidCriterion(catalog, framework, value) ? Promise.resolve() : Promise.reject(new Error("กรุณาเลือกเกณฑ์ที่ตรงกับหลักสูตรจากรายการ")) }]}>
            <Select disabled={saving || !framework} placeholder={framework ? `ค้นหารหัสหรือชื่อเกณฑ์ ${framework}` : "เลือกหลักสูตรก่อน"}
              options={framework ? catalog.criteria[framework] ?? [] : []} showSearch={{ optionFilterProp: "label" }} optionLabelProp="label" allowClear
              virtual={false} listHeight={256} classNames={{ popup: { root: "qa-criterion-dropdown" } }} notFoundContent="ไม่พบเกณฑ์ที่ค้นหา" />
          </Form.Item>
          <div className="qa-form-code-row">
            <div className="min-w-0 flex-1"><span className="text-xs text-muted">รหัสเอกสาร · ลำดับอัตโนมัติ</span>
              <output id="document-code-preview" className="mt-1 block break-all font-mono text-xs" aria-live="polite">{code || "เลือกหมวดหมู่เพื่อดูตัวอย่างรหัส"}</output>
            </div>
            <Popover trigger="click" title="รหัสเอกสาร" content={<div className="max-w-64 text-sm leading-6">ระบบกำหนดลำดับเริ่ม 001 เมื่อบันทึก<br />XXX เป็นตัวอย่างลำดับที่ยังไม่ได้กำหนด<br />ท้าย 000 คือฉบับร่าง และเพิ่มเมื่ออนุมัติ</div>}>
              <Button type="text" size="small" aria-label="วิธีออกรหัสเอกสาร" icon={<Info size={16} aria-hidden="true" />} />
            </Popover>
          </div>
        </section>
        <section className="min-w-0" aria-labelledby="qa-content-title">
          <h2 id="qa-content-title" className="qa-form-section-title">2. ชื่อและไฟล์เอกสาร</h2>
          <Form.Item name="title" label="ชื่อเอกสารคุณภาพ" rules={[{ required: true, whitespace: true, message: "กรุณาระบุชื่อเอกสาร" }]}>
            <Input placeholder="ระบุชื่อเอกสาร" maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="คำอธิบาย (ไม่บังคับ)">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={2000} placeholder="ขอบเขตหรือรายละเอียดเพิ่มเติม" />
          </Form.Item>
          <label className="mb-2 block text-[13px]">ไฟล์เอกสาร <span className="text-muted">(แนบภายหลังได้)</span></label>
          {needsAttachment && !files.length && <Alert className="mb-2" type="warning" showIcon title="เลือกไฟล์แนบอีกครั้ง ไฟล์ไม่ถูกเก็บในเครื่อง" />}
          <Upload.Dragger accept=".pdf,.doc,.docx,.xls,.xlsx" maxCount={1} fileList={files} disabled={saving}
            beforeUpload={file => {
              if (!/\.(pdf|docx?|xlsx?)$/i.test(file.name)) { toast.error("รองรับไฟล์ PDF, Word และ Excel"); return Upload.LIST_IGNORE; }
              if (file.size > 20 * 1024 * 1024) { toast.error("ไฟล์ต้องมีขนาดไม่เกิน 20 MB"); return Upload.LIST_IGNORE; }
              return false;
            }}
            onChange={({ fileList }) => { setFiles(fileList); if (fileList.length) setNeedsAttachment(false); }}
            iconRender={() => <FileText size={16} aria-hidden="true" />} showUploadList={{ showPreviewIcon: false, removeIcon: <Trash2 size={15} aria-hidden="true" /> }}>
            <div className="flex items-center justify-center gap-3"><UploadCloud size={24} className="text-accent" aria-hidden="true" />
              <div className="text-left"><p className="text-sm">เลือกไฟล์ หรือลากมาวาง</p><p className="mt-1 text-xs text-muted">PDF, Word, Excel · ไม่เกิน 20 MB</p></div>
            </div>
          </Upload.Dragger>
        </section>
      </div>
    </Card>
    <div className="qa-document-actions">
      <div className="qa-form-secondary-actions">
        <Button type="text" onClick={resetForm} disabled={saving} icon={<RotateCcw size={15} aria-hidden="true" />}>ล้างข้อมูล</Button>
        <Button type="text" onClick={saveDraft} disabled={saving}>{restored ? "เก็บข้อมูลต่อ" : "เก็บไว้กรอกต่อ"}</Button>
      </div>
      <Button onClick={preview} disabled={saving} icon={<Eye size={16} aria-hidden="true" />}>ตรวจสอบก่อนบันทึก</Button>
      <Button type="primary" htmlType="submit" loading={saving} icon={<Save size={16} aria-hidden="true" />}>บันทึกเอกสาร</Button>
    </div>
    <Modal title="ตรวจสอบก่อนบันทึก" open={reviewOpen} onCancel={() => { if (!saving) setReviewOpen(false); }} width={660}
      styles={{ body: { maxHeight: "65dvh", overflowY: "auto" } }} mask={{ closable: false }}
      footer={<div className="flex justify-end gap-2"><Button onClick={() => setReviewOpen(false)} disabled={saving}>กลับไปแก้ไข</Button><Button type="primary" loading={saving} onClick={saveDocument}>บันทึกเอกสาร</Button></div>}>
      <h2 className="mb-2 break-words font-semibold">{values.title}</h2>
      <p className="mb-4 break-all font-mono text-xs text-accent">{code}</p>
      <Descriptions column={1} size="small" items={summary} />
      {values.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">{values.description}</p>}
      {files[0] && <p className="mt-3 flex items-center gap-2 break-all text-sm"><Paperclip size={15} aria-hidden="true" />{files[0].name}</p>}
      <p className="mt-4 text-xs text-muted">บันทึกเป็นฉบับร่าง 000 จากนั้นเปิดเอกสารเพื่อส่งตรวจอนุมัติ</p>
    </Modal>
    {openedDocument && <QualityDocumentWorkflow documentId={openedDocument} onClose={() => setOpenedDocument(null)} onChanged={() => undefined} />}
  </Form>;
}

"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Tag,
  Upload,
  type UploadFile,
} from "antd";
import {
  Building2,
  Check,
  ChevronDown,
  Copy,
  Eye,
  FileCheck2,
  FileText,
  Hash,
  Info,
  Paperclip,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import toast from "react-hot-toast";
import { assessmentCriteria } from "@/lib/assessment-criteria";
import {
  buildDocumentCode,
  curricula,
  departments,
  documentLevels,
  educationJobs,
  emptyDocument,
  isValidCriterion,
  readDocumentDraft,
  type QualityDocumentValues,
} from "@/lib/quality-documents";
import "./quality-document-form.css";

const selectArrow = <ChevronDown size={16} aria-hidden="true" />;

function SectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-xs font-semibold text-accent">
        {number}
      </span>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-6 text-muted">{description}</p>
      </div>
    </div>
  );
}

export default function QualityDocumentForm({ userId }: { userId: string }) {
  const [form] = Form.useForm<QualityDocumentValues>();
  const values = (Form.useWatch([], { form, preserve: true }) ??
    emptyDocument) as QualityDocumentValues;
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const [needsAttachment, setNeedsAttachment] = useState(false);
  const draftKey = `e-smart-qa:document-draft:${userId}`;
  const curriculum = curricula.find((item) => item.value === values.curriculum);
  const framework = curriculum?.framework;
  const code = buildDocumentCode(values);
  const isManagement = values.department === "MGT";
  const parts = [
    { label: "หน่วยงาน", value: values.department },
    ...(!isManagement ? [{ label: "ชื่องาน", value: values.job }] : []),
    { label: "หลักสูตร", value: curriculum?.abbreviation },
    { label: "ระดับเอกสาร", value: values.level },
    { label: "เกณฑ์ประเมิน", value: values.criterion },
    {
      label: "ลำดับ",
      value: /^\d{1,3}$/.test(values.sequence ?? "")
        ? values.sequence.padStart(3, "0")
        : undefined,
    },
  ];

  useEffect(() => {
    try {
      const draft = readDocumentDraft(localStorage.getItem(draftKey));
      if (draft) {
        form.setFieldsValue(draft.values);
        setRestored(true);
        setNeedsAttachment(draft.hadAttachment);
      }
    } catch {
      // The form remains available if local storage is blocked.
    }
  }, [draftKey, form]);

  function saveDraft() {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          values: form.getFieldsValue(true),
          hadAttachment: files.length > 0 || needsAttachment,
        }),
      );
      setRestored(true);
      toast.success("บันทึกฉบับร่างในเบราว์เซอร์แล้ว", {
        id: "document-draft",
      });
    } catch {
      toast.error(
        "บันทึกฉบับร่างไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์",
        { id: "document-draft" },
      );
    }
  }

  function resetForm() {
    form.resetFields();
    setFiles([]);
    setRestored(false);
    setNeedsAttachment(false);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      toast.error("ล้างแบบฟอร์มแล้ว แต่ลบฉบับร่างที่บันทึกไว้ไม่ได้");
    }
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("คัดลอกรหัสเอกสารแล้ว");
    } catch {
      toast.error("คัดลอกรหัสไม่ได้ กรุณาเลือกรหัสแล้วคัดลอกด้วยตนเอง");
    }
  }

  const summary = [
    {
      key: "department",
      label: "หน่วยงาน",
      children:
        departments.find((item) => item.value === values.department)?.label ??
        "—",
    },
    ...(!isManagement
      ? [
          {
            key: "job",
            label: "ชื่องาน",
            children:
              educationJobs.find((item) => item.value === values.job)?.label ??
              "—",
          },
        ]
      : []),
    {
      key: "curriculum",
      label: "หลักสูตร",
      children: curriculum
        ? `${curriculum.name} (${curriculum.abbreviation})`
        : "—",
    },
    {
      key: "level",
      label: "ระดับเอกสาร",
      children:
        documentLevels.find((item) => item.value === values.level)?.label ??
        "—",
    },
    { key: "framework", label: "กรอบประเมิน", children: framework ?? "—" },
    { key: "criterion", label: "รหัสเกณฑ์", children: values.criterion || "—" },
    {
      key: "sequence",
      label: "ลำดับเอกสาร",
      children: parts.at(-1)?.value ?? "—",
    },
  ];

  return (
    <Form<QualityDocumentValues>
      form={form}
      name="quality-document"
      layout="vertical"
      initialValues={emptyDocument}
      scrollToFirstError={{ focus: true }}
      onFinish={() => {
        toast.dismiss("document-validation");
        setReviewOpen(true);
      }}
      onFinishFailed={() =>
        toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน", {
          id: "document-validation",
        })
      }
      className="qa-document-form mb-9"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag icon={<FileText size={13} aria-hidden="true" />}>ฉบับร่าง</Tag>
          {restored && (
            <span className="text-xs text-muted">
              มีฉบับร่างที่บันทึกในเบราว์เซอร์นี้
            </span>
          )}
        </div>
        <Button
          type="text"
          onClick={resetForm}
          icon={<RotateCcw size={15} aria-hidden="true" />}
        >
          ล้างข้อมูล
        </Button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionTitle
              number="01"
              title="ข้อมูลสำหรับออกรหัสเอกสาร"
              description="เลือกหมวดหมู่เอกสาร ระบบจะประกอบรหัสให้ตามข้อมูลที่ระบุ"
            />
            <div className="grid gap-x-5 sm:grid-cols-2">
              <Form.Item
                name="department"
                label="หน่วยงาน"
                rules={[{ required: true, message: "กรุณาเลือกหน่วยงาน" }]}
              >
                <Select
                  placeholder="เลือกหน่วยงาน"
                  options={departments.map((item) => ({ ...item }))}
                  suffixIcon={selectArrow}
                  onChange={() => form.setFieldValue("job", undefined)}
                />
              </Form.Item>
              {!isManagement ? (
                <Form.Item
                  name="job"
                  label="ชื่องาน"
                  rules={[{ required: true, message: "กรุณาเลือกชื่องาน" }]}
                >
                  <Select
                    placeholder={
                      values.department ? "เลือกชื่องาน" : "เลือกหน่วยงานก่อน"
                    }
                    disabled={values.department !== "EDU"}
                    options={educationJobs.map((item) => ({ ...item }))}
                    suffixIcon={selectArrow}
                  />
                </Form.Item>
              ) : (
                <div className="qa-management-note">
                  <Building2
                    size={18}
                    className="shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <span>
                    หน่วยงานบริหารไม่มีงานย่อย
                    <br />
                    <span className="text-xs text-muted">
                      รหัสเอกสารจะไม่รวมส่วนชื่องาน
                    </span>
                  </span>
                </div>
              )}

              <Form.Item
                name="curriculum"
                label="หลักสูตร"
                rules={[{ required: true, message: "กรุณาเลือกหลักสูตร" }]}
              >
                <Select
                  placeholder="เลือกหลักสูตร"
                  options={curricula.map((item) => ({
                    value: item.value,
                    label: `${item.name} (${item.abbreviation})`,
                  }))}
                  suffixIcon={selectArrow}
                  onChange={() => form.setFieldValue("criterion", undefined)}
                />
              </Form.Item>
              <Form.Item
                name="level"
                label="ระดับเอกสารคุณภาพ"
                rules={[{ required: true, message: "กรุณาเลือกระดับเอกสาร" }]}
              >
                <Select
                  placeholder="เลือกระดับเอกสาร"
                  options={documentLevels.map((item) => ({ ...item }))}
                  suffixIcon={selectArrow}
                />
              </Form.Item>
            </div>

            <div className="qa-framework-note">
              <ShieldCheck
                size={18}
                className="shrink-0 text-accent"
                aria-hidden="true"
              />
              <span className="flex-1">กรอบเกณฑ์การประเมิน</span>
              <Tag color={framework ? "green" : undefined}>
                {framework ?? "เลือกหลักสูตรก่อน"}
              </Tag>
            </div>

            <div className="mt-5 grid gap-x-5 sm:grid-cols-[minmax(0,1fr)_160px]">
              <Form.Item
                name="criterion"
                label="รหัสเกณฑ์การประเมิน"
                extra={
                  framework === "WFME"
                    ? "เลือกข้อเกณฑ์ WFME หรือค้นหาด้วยรหัสและชื่อหัวข้อ"
                    : framework === "AUN"
                      ? "เลือกข้อเกณฑ์ AUN เช่น A1.1-1 หรือค้นหาด้วยชื่อหัวข้อ"
                      : "กรอบประเมินจะกำหนดตามหลักสูตร"
                }
                rules={[
                  { required: true, message: "กรุณาเลือกรหัสเกณฑ์" },
                  {
                    validator: (_, value: string | undefined) =>
                      !value || !framework || isValidCriterion(value, framework)
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error(
                              "กรุณาเลือกเกณฑ์ที่ตรงกับหลักสูตรจากรายการ",
                            ),
                          ),
                  },
                ]}
              >
                <Select
                  disabled={!framework}
                  placeholder={
                    framework
                      ? `เลือกหรือค้นหาเกณฑ์ ${framework}`
                      : "เลือกหลักสูตรก่อน"
                  }
                  options={framework ? assessmentCriteria[framework] : []}
                  showSearch={{ optionFilterProp: "label" }}
                  optionLabelProp="label"
                  allowClear
                  suffixIcon={selectArrow}
                  virtual={false}
                  listHeight={320}
                  classNames={{ popup: { root: "qa-criterion-dropdown" } }}
                  notFoundContent="ไม่พบเกณฑ์ที่ค้นหา"
                />
              </Form.Item>
              <Form.Item
                name="sequence"
                label="ลำดับเอกสาร"
                extra="ตัวเลข 3 หลัก เริ่มต้น 000"
                rules={[
                  { required: true, message: "กรุณาระบุลำดับ" },
                  { pattern: /^\d{1,3}$/, message: "ใช้ตัวเลข 0–999" },
                ]}
              >
                <Input
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="000"
                  onBlur={() => {
                    const value = form.getFieldValue("sequence");
                    if (typeof value === "string" && /^\d{1,3}$/.test(value))
                      form.setFieldValue("sequence", value.padStart(3, "0"));
                  }}
                />
              </Form.Item>
            </div>
          </Card>

          <Card>
            <SectionTitle
              number="02"
              title="รายละเอียดเอกสาร"
              description="ระบุชื่อเอกสารและคำอธิบายเพื่อให้ค้นหาและอ้างอิงได้ง่าย"
            />
            <Form.Item
              name="title"
              label="ชื่อเอกสารคุณภาพ"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "กรุณาระบุชื่อเอกสาร",
                },
              ]}
            >
              <Input
                placeholder="ระบุชื่อเอกสารคุณภาพ"
                maxLength={200}
                showCount
              />
            </Form.Item>
            <Form.Item
              name="description"
              label="คำอธิบายเพิ่มเติม"
              className="mb-0"
            >
              <Input.TextArea
                rows={3}
                maxLength={2000}
                showCount
                placeholder="รายละเอียดหรือขอบเขตของเอกสาร (ไม่บังคับ)"
              />
            </Form.Item>
          </Card>

          <Card>
            <SectionTitle
              number="03"
              title="ไฟล์เอกสาร"
              description="แนบไฟล์เอกสารที่เกี่ยวข้อง (ไม่บังคับ)"
            />
            {needsAttachment && files.length === 0 && (
              <Alert
                className="mb-4"
                type="warning"
                showIcon
                icon={<Info size={18} aria-hidden="true" />}
                title="กรุณาเลือกไฟล์แนบอีกครั้ง ไฟล์ไม่ได้ถูกเก็บพร้อมฉบับร่าง"
              />
            )}
            <Upload.Dragger
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              maxCount={1}
              fileList={files}
              beforeUpload={(file) => {
                if (!/\.(pdf|docx?|xlsx?)$/i.test(file.name)) {
                  toast.error("รองรับไฟล์ PDF, Word และ Excel");
                  return Upload.LIST_IGNORE;
                }
                if (file.size > 20 * 1024 * 1024) {
                  toast.error("ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
                  return Upload.LIST_IGNORE;
                }
                return false;
              }}
              onChange={({ fileList }) => {
                setFiles(fileList);
                if (fileList.length) setNeedsAttachment(false);
              }}
              iconRender={() => <FileText size={18} aria-hidden="true" />}
              showUploadList={{
                showPreviewIcon: false,
                removeIcon: <Trash2 size={16} aria-hidden="true" />,
              }}
            >
              <UploadCloud
                size={30}
                className="mx-auto mb-3 text-accent"
                aria-hidden="true"
              />
              <p className="font-medium">
                คลิกเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
              </p>
              <p className="mt-2 text-xs text-muted">
                PDF, Word หรือ Excel · 1 ไฟล์ · ไม่เกิน 20 MB
              </p>
            </Upload.Dragger>
            <p className="mt-3 text-xs leading-6 text-muted">
              ไฟล์แนบไม่ถูกเก็บพร้อมฉบับร่างในเบราว์เซอร์
            </p>
          </Card>
        </div>

        <aside
          className="min-w-0 space-y-5 xl:sticky xl:top-6"
          aria-label="ตัวอย่างรหัสเอกสาร"
        >
          <Card className="qa-code-preview">
            <div className="flex items-center gap-2">
              <Hash size={18} aria-hidden="true" />
              <h2 className="text-sm font-semibold">ตัวอย่างรหัสเอกสาร</h2>
            </div>
            <p className="mt-2 text-xs leading-6 text-white/65">
              รหัสจะเปลี่ยนตามข้อมูลที่คุณเลือก
            </p>
            <output
              id="document-code-preview"
              className="qa-document-code"
              aria-live="polite"
            >
              {code ?? "รอข้อมูลสำหรับออกรหัส"}
            </output>
            <Button
              block
              ghost
              disabled={!code}
              onClick={copyCode}
              icon={<Copy size={15} aria-hidden="true" />}
            >
              คัดลอกรหัส
            </Button>
            <p className="mt-4 text-[11px] leading-6 text-white/65">
              {isManagement
                ? "MGT ไม่มีงานย่อย รหัสจึงไม่รวมส่วนชื่องาน"
                : "หน่วยงาน–ชื่องาน–หลักสูตร–ระดับ–เกณฑ์–ลำดับ"}
            </p>
          </Card>

          <Card
            title={<h2 className="text-sm font-semibold">ส่วนประกอบของรหัส</h2>}
            size="small"
          >
            <dl className="qa-code-parts">
              {parts.map((part) => (
                <div key={part.label}>
                  <dt>{part.label}</dt>
                  <dd>{part.value || "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-canvas p-3 text-xs leading-6 text-muted">
              <Info size={15} className="mt-1 shrink-0" aria-hidden="true" />
              <span>
                ตัวอย่าง
                <br />
                <span className="break-all font-mono text-[11px]">
                  {framework === "AUN"
                    ? "EDU-ADM-B.PMD.-QM-A1.1-1-000"
                    : "EDU-ADM-M.D.-QM-W1.1.1-000"}
                </span>
              </span>
            </div>
          </Card>

          <div className="rounded-xl border border-line p-4 text-xs leading-6 text-muted">
            <Check size={16} className="mb-2 text-accent" aria-hidden="true" />
            M.D. ใช้เกณฑ์ WFME (W)
            <br />
            B.PMD. ใช้เกณฑ์ AUN เช่น A1.1-1
            <p className="mt-2 border-t border-line pt-2">
              รหัสนี้เป็นตัวอย่าง ยังไม่ได้ตรวจสอบรหัสซ้ำ
            </p>
          </div>
        </aside>
      </div>

      <div className="qa-document-actions">
        <p className="flex-1 text-xs leading-6 text-muted">
          บันทึกฉบับร่างไว้ในเบราว์เซอร์นี้เพื่อกลับมาแก้ไขภายหลัง
        </p>
        <Button
          onClick={saveDraft}
          icon={<Save size={16} aria-hidden="true" />}
        >
          บันทึกฉบับร่าง
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          icon={<Eye size={16} aria-hidden="true" />}
        >
          ตรวจสอบข้อมูล
        </Button>
      </div>

      <Modal
        title={
          <span className="flex items-center gap-2">
            <FileCheck2 size={20} className="text-accent" aria-hidden="true" />
            ตรวจสอบเอกสารคุณภาพ
          </span>
        }
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        width={680}
        footer={
          <Button type="primary" onClick={() => setReviewOpen(false)}>
            กลับไปแบบฟอร์ม
          </Button>
        }
      >
        <Tag className="mb-4">ตัวอย่างเอกสาร</Tag>
        <h2 className="mb-2 break-words text-lg font-semibold">
          {values.title}
        </h2>
        <p className="mb-6 break-all rounded-lg bg-canvas p-3 font-mono text-sm text-accent">
          {code}
        </p>
        <Descriptions column={1} size="small" items={summary} />
        {values.description && (
          <p className="mt-5 whitespace-pre-wrap break-words border-t border-line pt-4 text-sm leading-7 text-muted">
            {values.description}
          </p>
        )}
        {files.length > 0 && (
          <p className="mt-5 flex items-center gap-2 break-all text-sm">
            <Paperclip size={16} className="shrink-0" aria-hidden="true" />
            {files[0].name}
          </p>
        )}
        <p className="mt-6 text-xs leading-6 text-muted">
          เป็นการตรวจสอบข้อมูลก่อนบันทึก เอกสารยังไม่ได้ขึ้นทะเบียน
        </p>
      </Modal>
    </Form>
  );
}

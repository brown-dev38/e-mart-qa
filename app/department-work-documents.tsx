"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Table, Tag, type TableProps } from "antd";
import { Download, Plus, RefreshCw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { getWorkFlow, curriculumVersionLabel, type WorkFlow } from "@/lib/department-workflow";
import type { DepartmentDocumentCatalog } from "@/types/department-documents";
import type { AcademicData, WorkDocument, WorkDocumentScope } from "@/types/academic";
import { listWorkDocumentsAction, saveWorkDocumentAction, deleteWorkDocumentAction } from "./documents/work-actions";
import QualityDocumentList from "./quality-document-list";

const dateFormatter = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

function WorkDocumentList({ scope, types }: { scope: WorkDocumentScope; types: WorkFlow["types"] }) {
  const [documents, setDocuments] = useState<WorkDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startLoad] = useTransition();
  const [busy, startMutation] = useTransition();
  const [open, setOpen] = useState(false);
  const [typeCode, setTypeCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [form] = Form.useForm();
  const scopeKey = JSON.stringify(scope);

  const load = useCallback(() => {
    startLoad(async () => {
      try {
        const result = await listWorkDocumentsAction(JSON.parse(scopeKey));
        if (result.ok) { setDocuments(result.documents); setError(null); }
        else setError(result.error);
      } catch { setError("โหลดเอกสารไม่สำเร็จ กรุณาลองใหม่"); }
    });
  }, [scopeKey]);
  useEffect(() => { load(); }, [load]);

  function openUpload(code: string) {
    setTypeCode(code);
    form.resetFields();
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setOpen(true);
  }
  function save(values: { title?: string }) {
    if (!file) { toast.error("กรุณาเลือกไฟล์เอกสาร"); return; }
    const data = new FormData();
    data.set("scope", scopeKey);
    data.set("documentType", typeCode);
    data.set("title", values.title ?? "");
    data.set("file", file);
    startMutation(async () => {
      try {
        const result = await saveWorkDocumentAction(data);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("บันทึกเอกสารแล้ว");
        setOpen(false);
        load();
      } catch { toast.error("บันทึกเอกสารไม่สำเร็จ กรุณาลองใหม่"); }
    });
  }
  function remove(id: string) {
    startMutation(async () => {
      try {
        const result = await deleteWorkDocumentAction(id);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("ลบเอกสารแล้ว"); load();
      } catch { toast.error("ลบเอกสารไม่สำเร็จ กรุณาลองใหม่"); }
    });
  }
  const columns: TableProps<WorkDocument>["columns"] = [
    { title: "ชื่อเอกสาร", dataIndex: "title", key: "title", render: (value: string) => <span className="break-words">{value}</span> },
    { title: "ไฟล์", key: "file", render: (_, row) => <a href={row.filePath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-accent hover:underline"><Download size={14} aria-hidden="true" /><span className="break-all">{row.fileName}</span></a> },
    { title: "ขนาด", key: "size", width: 100, render: (_, row) => `${(Number(row.fileSize) / 1024).toLocaleString("th-TH", { maximumFractionDigits: 1 })} KB` },
    { title: "วันที่เพิ่ม", key: "date", width: 180, render: (_, row) => dateFormatter.format(new Date(row.createdAt)) },
    { title: "จัดการ", key: "actions", width: 70, render: (_, row) => row.canDelete && <Popconfirm title="ยืนยันการลบเอกสารนี้?" okText="ลบ" cancelText="ยกเลิก" onConfirm={() => remove(row.id)} okButtonProps={{ danger: true }}><Button danger type="text" aria-label={`ลบ ${row.title}`} disabled={busy} icon={<Trash2 size={16} aria-hidden="true" />} /></Popconfirm> },
  ];

  return <div className="space-y-4">
    <div className="flex justify-end"><Button onClick={load} loading={pending} icon={<RefreshCw size={16} aria-hidden="true" />}>รีเฟรชเอกสาร</Button></div>
    {error && <Alert type="error" showIcon title={error} action={<Button onClick={load}>ลองใหม่</Button>} />}
    {types.map((type) => <Card key={type.code} title={<span className="whitespace-normal">{type.group && <Tag>{type.group}</Tag>}{type.label}</span>} extra={<Button type="primary" disabled={busy} icon={<Plus size={16} aria-hidden="true" />} onClick={() => openUpload(type.code)}>เพิ่มเอกสาร</Button>}>
      <Table<WorkDocument> rowKey="id" size="middle" loading={pending} columns={columns} dataSource={documents.filter((document) => document.documentType === type.code)} pagination={{ pageSize: 5, showSizeChanger: false }} scroll={{ x: 750 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีเอกสารประเภทนี้" /> }} />
    </Card>)}
    <Modal forceRender open={open} title={`เพิ่ม${types.find((type) => type.code === typeCode)?.label ?? "เอกสาร"}`} okText="บันทึก" cancelText="ยกเลิก" confirmLoading={busy} onOk={() => form.submit()} onCancel={() => { if (!busy) setOpen(false); }} mask={{ closable: !busy }}>
      <Form form={form} layout="vertical" onFinish={save} className="mt-5">
        <Form.Item name="title" label="ชื่อเอกสาร" rules={[{ max: 500, message: "ชื่อเอกสารต้องไม่เกิน 500 ตัวอักษร" }]}><Input maxLength={500} placeholder="ปล่อยว่างเพื่อใช้ชื่อประเภทเอกสาร" disabled={busy} /></Form.Item>
        <Form.Item label="ไฟล์เอกสาร" required extra="PDF, Word หรือ Excel ขนาดไม่เกิน 20 MB">
          <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" disabled={busy} aria-label="ไฟล์เอกสาร" className="w-full text-sm" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Form.Item>
      </Form>
    </Modal>
  </div>;
}

export default function DepartmentWorkDocuments({ program, workType, academic }: {
  program: DepartmentDocumentCatalog["programs"][number];
  workType: DepartmentDocumentCatalog["workTypes"][number];
  academic: AcademicData;
}) {
  const workflow = getWorkFlow(workType.workflow, program.framework);
  const [yearId, setYearId] = useState<number>();
  const [versionId, setVersionId] = useState<number>();
  const [semesterId, setSemesterId] = useState<number>();
  const [studyYearId, setStudyYearId] = useState<number>();
  const [offeringId, setOfferingId] = useState<number>();
  if (!workflow) return <QualityDocumentList scope={{ programCode: program.value, departmentCode: workType.departmentCode, subDepartmentCode: workType.subDepartmentCode }} />;

  const year = academic.academic_years.find((item) => item.id === yearId);
  const semester = academic.semesters.find((item) => item.id === semesterId);
  const studyYear = academic.study_years.find((item) => item.id === studyYearId);
  const versions = academic.curriculum_versions.filter((item) => item.program_id === program.id);
  const version = versions.find((item) => item.id === versionId);
  const offerings = academic.course_offerings.filter((item) => item.academic_year_id === yearId && item.semester_id === semesterId && item.study_year_id === studyYearId && academic.courses.some((course) => course.id === item.course_id && course.program_id === program.id));
  const offering = semester && studyYear ? offerings.find((item) => item.id === offeringId) : undefined;
  const ready = workflow.mode === "version" ? Boolean(version) : Boolean(year && (workflow.mode !== "course" || offering));
  const scope: WorkDocumentScope = {
    programCode: program.value, departmentCode: workType.departmentCode, subDepartmentCode: workType.subDepartmentCode!,
    ...(workflow.mode === "version" ? { curriculumVersionId: version?.id } : { academicYearId: year?.id }),
    ...(workflow.mode === "course" ? { courseOfferingId: offering?.id } : {}),
  };
  const field = (label: string, control: React.ReactNode) => <div className="min-w-0"><label className="mb-2 block text-sm font-medium">{label}</label>{control}</div>;

  return <div className="space-y-5">
    <Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {workflow.mode === "version" ? field("ฉบับหลักสูตร", <Select className="w-full" aria-label="ฉบับหลักสูตร" placeholder="เลือกฉบับหลักสูตร" value={version?.id} onChange={setVersionId} options={versions.map((item) => ({ value: item.id, label: curriculumVersionLabel(item) }))} notFoundContent="ยังไม่มีฉบับหลักสูตร" />)
          : field("ปีการศึกษา", <Select className="w-full" aria-label="ปีการศึกษา" placeholder="เลือกปีการศึกษา" value={year?.id} onChange={(value) => { setYearId(value); setSemesterId(undefined); setStudyYearId(undefined); setOfferingId(undefined); }} options={academic.academic_years.map((item) => ({ value: item.id, label: String(item.year) }))} notFoundContent="ยังไม่มีปีการศึกษา" />)}
        {workflow.mode === "course" && <>
          {field("ภาคการศึกษา", <Select className="w-full" aria-label="ภาคการศึกษา" placeholder="เลือกภาคการศึกษา" disabled={!year} value={semester?.id} onChange={(value) => { setSemesterId(value); setStudyYearId(undefined); setOfferingId(undefined); }} options={academic.semesters.map((item) => ({ value: item.id, label: item.name_th }))} />)}
          {field("ชั้นปี", <Select className="w-full" aria-label="ชั้นปี" placeholder="เลือกชั้นปี" disabled={!year || !semester} value={studyYear?.id} onChange={(value) => { setStudyYearId(value); setOfferingId(undefined); }} options={academic.study_years.map((item) => ({ value: item.id, label: `ชั้นปีที่ ${item.year}` }))} />)}
          {field("รายวิชา", <Select className="w-full" aria-label="รายวิชา" placeholder="เลือกรายวิชา" disabled={!year || !semester || !studyYear} value={offering?.id} onChange={setOfferingId} showSearch optionFilterProp="label" options={offerings.map((item) => { const course = academic.courses.find((course) => course.id === item.course_id)!; return { value: item.id, label: `${course.code} — ${course.name_th}` }; })} notFoundContent="ยังไม่มีรายวิชาที่เปิดสอนตามตัวเลือกนี้" />)}
        </>}
      </div>
      {workflow.mode === "course" && year && semester && studyYear && offerings.length === 0 && <Alert className="mt-4" type="info" showIcon title="ยังไม่มีรายวิชาที่เปิดสอนตามตัวเลือกนี้" description="ผู้ดูแลระบบสามารถเพิ่มรายวิชาและกำหนดการเปิดสอนได้ในเมนู ตั้งค่าข้อมูลพื้นฐาน → รายวิชา และ การเปิดสอนรายวิชา" />}
    </Card>
    {ready ? <WorkDocumentList key={JSON.stringify(scope)} scope={scope} types={workflow.types} /> : <Card><Empty description={workflow.mode === "version" ? "เลือกฉบับหลักสูตรเพื่อดูเอกสาร" : workflow.mode === "course" ? "เลือกปีการศึกษา ภาคการศึกษา ชั้นปี และรายวิชาให้ครบ" : "เลือกปีการศึกษาเพื่อดูเอกสาร"} /></Card>}
  </div>;
}

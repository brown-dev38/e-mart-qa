"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Alert, Button, Card, Descriptions, Empty, Input, Pagination, Select, Table, Tag, type TableProps } from "antd";
import { Download, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { listQualityDocumentsAction } from "./documents/actions";
import QualityDocumentWorkflow from "./quality-document-workflow";
import type { QualityDocumentListItem, QualityDocumentStatus, QualityDocumentScope } from "@/types/quality-document";
import "./quality-document-list.css";

const STATUS_META = { DRAFT: { label: "ฉบับร่าง", color: "default" }, PUBLISHED: { label: "มีผลใช้งาน", color: "green" }, ARCHIVED: { label: "ยกเลิกใช้", color: "orange" } };
const STATUS_FILTERS = [...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label })), { value: "RETURNED", label: "ส่งกลับให้แก้ไข" }, { value: "PENDING", label: "รออนุมัติ" }];
type StatusFilter = QualityDocumentStatus | "RETURNED" | "PENDING";
function statusTag(doc: QualityDocumentListItem) {
  let { label, color } = STATUS_META[doc.status];
  if (doc.scheduled_version) { label = doc.current_version === null ? `ฉบับ ${doc.scheduled_version} อนุมัติแล้ว · รอมีผล` : `ใช้งาน ${doc.current_version} · ฉบับ ${doc.scheduled_version} รอมีผล`; color = "blue"; }
  if (doc.status === "DRAFT" && doc.open_revision_status === "PENDING") { label = "รออนุมัติ"; color = "gold"; }
  if (doc.status === "PUBLISHED" && doc.open_revision_status) label = doc.open_revision_status === "DRAFT" ? "ใช้งาน · มีร่างใหม่" : "ใช้งาน · ฉบับใหม่รออนุมัติ";
  if (doc.open_revision_returned) { label = doc.status === "PUBLISHED" ? "ใช้งาน · ฉบับใหม่รอแก้ไข" : "ส่งกลับให้แก้ไข"; color = "orange"; }
  return <Tag color={color} className="!m-0 whitespace-normal">{label}</Tag>;
}

export default function QualityDocumentList({ scope }: { scope?: QualityDocumentScope }) {
  const programCode = scope?.programCode, departmentCode = scope?.departmentCode, subDepartmentCode = scope?.subDepartmentCode;
  const [documents, setDocuments] = useState<QualityDocumentListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string>();
  const [program, setProgram] = useState<string>();
  const [level, setLevel] = useState<string>();
  const [status, setStatus] = useState<StatusFilter>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const load = useCallback(() => startTransition(async () => {
    try {
      const result = await listQualityDocumentsAction({ programCode, departmentCode, subDepartmentCode });
      if (result.ok) { setDocuments(result.documents); setError(null); }
      else setError(result.error);
    } catch { setError("โหลดรายการไม่สำเร็จ กรุณาลองใหม่"); }
    setLoaded(true);
  }), [programCode, departmentCode, subDepartmentCode]);
  useEffect(load, [load]);
  const options = useMemo(() => {
    const departments = new Map<string, string>(), programs = new Map<string, string>(), levels = new Map<string, string>();
    for (const doc of documents) {
      departments.set(doc.department_code, `${doc.department_code} — ${doc.department_name}`);
      programs.set(doc.program_code, `${doc.program_code} — ${doc.program_name}`);
      levels.set(doc.level_code, `${doc.level_code} — ${doc.level_name}`);
    }
    const list = (map: Map<string, string>) => [...map].map(([value, label]) => ({ value, label }));
    return { departments: list(departments), programs: list(programs), levels: list(levels) };
  }, [documents]);
  const filtered = useMemo(() => documents.filter(doc =>
    `${doc.document_code} ${doc.current_version ?? ""} ${doc.title} ${doc.criterion_code ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (!department || doc.department_code === department) && (!program || doc.program_code === program) && (!level || doc.level_code === level) &&
    (!status || (status === "RETURNED" ? doc.open_revision_returned : status === "PENDING" ? doc.open_revision_status === "PENDING" : status === "DRAFT" ? doc.status === "DRAFT" && doc.open_revision_status !== "PENDING" && !doc.open_revision_returned : doc.status === status))), [documents, search, department, program, level, status]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 5)));
  const activeFilters = [department, program, level, status].filter(Boolean).length;
  const openFile = (doc: QualityDocumentListItem) => doc.status === "PUBLISHED" && doc.file_path && <Button href={doc.file_path} target="_blank" rel="noreferrer" aria-label={`ดาวน์โหลดฉบับอนุมัติ ${doc.title}`} icon={<Download size={15} aria-hidden="true" />}>ดาวน์โหลด</Button>;
  const columns: NonNullable<TableProps<QualityDocumentListItem>["columns"]> = [
    { title: "เอกสาร", key: "document", render: (_, doc) => <div><button className="qa-document-title" onClick={() => setSelected(doc.id)}>{doc.title}</button><p className="mt-1 break-all font-mono text-xs text-muted">รหัสเอกสาร: {doc.document_code}</p><p className="mt-1 text-xs text-muted">{doc.current_version !== null ? `ฉบับ: ${doc.current_version}` : "ยังไม่มีฉบับมีผลใช้"}</p><p className="mt-1 text-xs text-muted">{doc.department_code}{doc.sub_department_code ? ` / ${doc.sub_department_code}` : ""} · {doc.program_code}</p></div> },
    { title: "ประเภท / เกณฑ์", key: "category", width: 125, render: (_, doc) => <div><p className="text-sm">{doc.level_code}</p><p className="text-xs text-muted">{doc.criterion_code ?? "—"}</p></div> },
    { title: "สถานะ", key: "status", width: 160, render: (_, doc) => statusTag(doc) },
    { title: "เปิดเอกสาร", key: "actions", width: 200, render: (_, doc) => <div className="flex gap-2">{openFile(doc)}<Button onClick={() => setSelected(doc.id)}>รายละเอียด</Button></div> },
  ];
  const pagination = { current: currentPage, pageSize: 5, total: filtered.length, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true };
  return <Card size="small" className="qa-document-list">
    <div className="qa-list-toolbar">
      <Input allowClear prefix={<Search size={16} aria-hidden="true" />} placeholder="ค้นหารหัส ชื่อเอกสาร หรือเกณฑ์" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} aria-label="ค้นหาเอกสาร" />
      <Button onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="qa-document-filters" icon={<SlidersHorizontal size={15} aria-hidden="true" />}>ตัวกรอง{activeFilters ? ` (${activeFilters})` : ""}</Button>
      <Button onClick={load} loading={pending} aria-label="รีเฟรชรายการเอกสาร" icon={<RefreshCw size={15} aria-hidden="true" />} />
    </div>
    {filtersOpen && <div id="qa-document-filters" className="qa-list-filters">
      {!scope && <Select allowClear placeholder="หน่วยงาน" options={options.departments} value={department} onChange={value => { setDepartment(value); setPage(1); }} aria-label="กรองตามหน่วยงาน" />}
      {!scope && <Select allowClear placeholder="หลักสูตร" options={options.programs} value={program} onChange={value => { setProgram(value); setPage(1); }} aria-label="กรองตามหลักสูตร" />}
      <Select allowClear placeholder="ระดับเอกสาร" options={options.levels} value={level} onChange={value => { setLevel(value); setPage(1); }} aria-label="กรองตามระดับเอกสาร" />
      <Select<StatusFilter> allowClear placeholder="สถานะ" options={STATUS_FILTERS} value={status} onChange={value => { setStatus(value); setPage(1); }} aria-label="กรองตามสถานะ" />
      {!!activeFilters && <Button type="text" onClick={() => { setDepartment(undefined); setProgram(undefined); setLevel(undefined); setStatus(undefined); setPage(1); }}>ล้างตัวกรอง</Button>}
    </div>}
    {error && <Alert type="error" showIcon className="mb-3" title={error} action={<Button size="small" onClick={load}>ลองใหม่</Button>} />}
    <p className="my-3 text-xs text-muted">พบ {filtered.length} จาก {documents.length} รายการ · กดชื่อเอกสารเพื่อดูรายละเอียด</p>
    <div className="qa-desktop-documents"><Table<QualityDocumentListItem> rowKey="id" dataSource={filtered} columns={columns} loading={pending} size="small" scroll={{ x: 760 }} pagination={pagination}
      expandable={{ expandedRowRender: doc => <Descriptions size="small" column={2} items={[
        { key: "department", label: "หน่วยงาน", children: doc.department_name }, { key: "program", label: "หลักสูตร", children: doc.program_name },
        { key: "criterion", label: "เกณฑ์", children: doc.criterion_code ? `${doc.criterion_code} ${doc.criterion_title ?? ""}` : "—" }, { key: "created", label: "สร้างเมื่อ", children: new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(doc.created_at)) },
      ]} /> }} locale={{ emptyText: <Empty description={loaded ? "ไม่พบเอกสารตามเงื่อนไข" : "กำลังโหลดเอกสาร…"} /> }} /></div>
    <div className="qa-mobile-documents" aria-busy={pending}>
      {filtered.slice((currentPage - 1) * 5, currentPage * 5).map(doc => <article className="qa-mobile-document" key={doc.id}>
        <button className="qa-document-title" onClick={() => setSelected(doc.id)}>{doc.title}</button>
        <p className="mt-1 break-all font-mono text-xs text-muted">รหัสเอกสาร: {doc.document_code}</p><p className="mt-1 text-xs text-muted">{doc.current_version !== null ? `ฉบับ: ${doc.current_version}` : "ยังไม่มีฉบับมีผลใช้"}</p>
        <div className="my-3 flex flex-wrap items-center gap-2">{statusTag(doc)}<span className="text-xs text-muted">{doc.department_code} · {doc.program_code}</span></div>
        <div className="flex gap-2">{openFile(doc)}<Button onClick={() => setSelected(doc.id)}>รายละเอียด / แก้ไข</Button></div>
      </article>)}
      {!filtered.length && <Empty description={loaded ? "ไม่พบเอกสารตามเงื่อนไข" : "กำลังโหลดเอกสาร…"} />}
      <Pagination size="small" {...pagination} />
    </div>
    {selected && <QualityDocumentWorkflow documentId={selected} onClose={() => setSelected(null)} onChanged={load} />}
  </Card>;
}

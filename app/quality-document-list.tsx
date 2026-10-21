"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  type TableProps,
} from "antd";
import { Download, RefreshCw, Search } from "lucide-react";
import { listQualityDocumentsAction } from "./documents/actions";
import type {
  QualityDocumentListItem,
  QualityDocumentStatus,
  QualityDocumentScope,
} from "@/types/quality-document";

const STATUS_META: Record<
  QualityDocumentStatus,
  { label: string; color?: string }
> = {
  DRAFT: { label: "ฉบับร่าง" },
  PUBLISHED: { label: "เผยแพร่", color: "green" },
  ARCHIVED: { label: "เก็บถาวร", color: "orange" },
};

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatBytes(value: string | null): string | null {
  if (!value) return null;
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function QualityDocumentList({ scope }: { scope?: QualityDocumentScope }) {
  const programCode = scope?.programCode;
  const departmentCode = scope?.departmentCode;
  const subDepartmentCode = scope?.subDepartmentCode;
  const [documents, setDocuments] = useState<QualityDocumentListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string | undefined>();
  const [program, setProgram] = useState<string | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [status, setStatus] = useState<QualityDocumentStatus | undefined>();

  const load = useCallback(() => {
    startTransition(async () => {
      const result = await listQualityDocumentsAction({ programCode, departmentCode, subDepartmentCode });
      if (result.ok) {
        setDocuments(result.documents);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoaded(true);
    });
  }, [startTransition, programCode, departmentCode, subDepartmentCode]);

  useEffect(() => {
    load();
  }, [load]);

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of documents) {
      map.set(doc.department_code, `${doc.department_code} — ${doc.department_name}`);
    }
    return [...map].map(([value, label]) => ({ value, label }));
  }, [documents]);

  const programOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of documents) {
      map.set(doc.program_code, `${doc.program_code} — ${doc.program_name}`);
    }
    return [...map].map(([value, label]) => ({ value, label }));
  }, [documents]);

  const levelOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of documents) {
      map.set(doc.level_code, `${doc.level_code} — ${doc.level_name}`);
    }
    return [...map].map(([value, label]) => ({ value, label }));
  }, [documents]);

  const filtered = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (
        searchText &&
        !`${doc.document_code} ${doc.title} ${doc.criterion_code}`
          .toLowerCase()
          .includes(searchText)
      ) {
        return false;
      }
      if (department && doc.department_code !== department) return false;
      if (program && doc.program_code !== program) return false;
      if (level && doc.level_code !== level) return false;
      if (status && doc.status !== status) return false;
      return true;
    });
  }, [documents, search, department, program, level, status]);

  const columns: NonNullable<TableProps<QualityDocumentListItem>["columns"]> = [
    {
      title: "รหัสเอกสาร",
      dataIndex: "document_code",
      key: "document_code",
      width: 310,
      render: (value: string) => (
        <span className="break-all font-mono text-[12px]">{value}</span>
      ),
    },
    {
      title: "ชื่อเรื่อง",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (value: string) => <span title={value}>{value}</span>,
    },
    {
      title: "หน่วยงาน",
      key: "department",
      width: 150,
      render: (_, doc) => (
        <span className="block leading-5">
          <span className="block">{doc.department_code}</span>
          {doc.sub_department_code && (
            <span className="block text-xs text-muted">
              {doc.sub_department_code}
            </span>
          )}
        </span>
      ),
    },
    {
      title: "หลักสูตร",
      key: "program",
      width: 150,
      render: (_, doc) => (
        <span className="block leading-5">
          <span className="block">{doc.program_code}</span>
          <span className="block text-xs text-muted">{doc.framework_code}</span>
        </span>
      ),
    },
    {
      title: "ระดับ",
      dataIndex: "level_code",
      key: "level_code",
      width: 90,
    },
    {
      title: "เกณฑ์",
      dataIndex: "criterion_code",
      key: "criterion_code",
      width: 120,
    },
    {
      title: "สถานะ",
      key: "status",
      width: 110,
      render: (_, doc) => (
        <Tag color={STATUS_META[doc.status].color}>
          {STATUS_META[doc.status].label}
        </Tag>
      ),
    },
    {
      title: "เวอร์ชัน",
      dataIndex: "current_version",
      key: "current_version",
      width: 100,
    },
    {
      title: "วันที่สร้าง",
      key: "created_at",
      width: 170,
      render: (_, doc) => dateFormatter.format(new Date(doc.created_at)),
    },
    {
      title: "ไฟล์",
      key: "file",
      width: 190,
      render: (_, doc) =>
        doc.file_path ? (
          <a
            href={doc.file_path}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 text-accent hover:underline"
          >
            <Download size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate" title={doc.file_name ?? undefined}>
              {doc.file_name ?? "ดาวน์โหลด"}
            </span>
            {doc.file_size_bytes && (
              <span className="shrink-0 text-xs text-muted">
                ({formatBytes(doc.file_size_bytes)})
              </span>
            )}
          </a>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  return (
    <div className="mb-9">
      <Card>
        <div className={`mb-5 grid gap-3 sm:grid-cols-2 ${scope
          ? "xl:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))_auto]"
          : "xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto]"}`}>
          <Input
            allowClear
            prefix={<Search size={16} aria-hidden="true" />}
            placeholder="ค้นหารหัสเอกสาร ชื่อเรื่อง หรือรหัสเกณฑ์"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="ค้นหาเอกสาร"
          />
          {!scope && <Select
            allowClear
            placeholder="หน่วยงาน"
            options={departmentOptions}
            value={department}
            onChange={setDepartment}
            aria-label="กรองตามหน่วยงาน"
          />}
          {!scope && <Select
            allowClear
            placeholder="หลักสูตร"
            options={programOptions}
            value={program}
            onChange={setProgram}
            aria-label="กรองตามหลักสูตร"
          />}
          <Select
            allowClear
            placeholder="ระดับเอกสาร"
            options={levelOptions}
            value={level}
            onChange={setLevel}
            aria-label="กรองตามระดับเอกสาร"
          />
          <Select<QualityDocumentStatus>
            allowClear
            placeholder="สถานะ"
            options={(Object.keys(STATUS_META) as QualityDocumentStatus[]).map(
              (value) => ({ value, label: STATUS_META[value].label }),
            )}
            value={status}
            onChange={setStatus}
            aria-label="กรองตามสถานะ"
          />
          <Button
            onClick={load}
            loading={pending}
            icon={<RefreshCw size={16} aria-hidden="true" />}
            className="xl:w-auto"
          >
            รีเฟรช
          </Button>
        </div>

        {error && (
          <Alert
            type="error"
            showIcon
            className="mb-4"
            title={error}
            action={
              <Button size="small" onClick={load}>
                ลองใหม่
              </Button>
            }
          />
        )}

        <p className="mb-4 text-sm text-muted">
          พบ {filtered.length.toLocaleString("th-TH")} รายการ
          จากทั้งหมด {documents.length.toLocaleString("th-TH")} รายการ
        </p>

        <Table<QualityDocumentListItem>
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          loading={pending && !loaded}
          size="middle"
          scroll={{ x: "max-content" }}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total) => `ทั้งหมด ${total} รายการ`,
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  loaded
                    ? scope ? "ยังไม่มีเอกสารสำหรับหลักสูตรและประเภทงานที่เลือก" : "ยังไม่มีเอกสารคุณภาพในระบบ"
                    : "กำลังโหลดรายการเอกสาร…"
                }
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

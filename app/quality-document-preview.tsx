"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { Alert, Button, Empty, Select, Spin } from "antd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DocumentPreview } from "@/types/quality-document-versions";

export default function QualityDocumentPreview({ url, title }: { url: string; title: string }) {
  const [page, setPage] = useState(1);
  const [sheet, setSheet] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ key: string; data?: DocumentPreview; error?: string } | null>(null);
  const requestKey = `${url}:${page}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    startTransition(async () => {
      try {
        const response = await fetch(`${url}?page=${page}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลดพรีวิวไม่สำเร็จ");
        if (!controller.signal.aborted) setResult({ key: requestKey, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key: requestKey, error: error instanceof Error ? error.message : "โหลดพรีวิวไม่สำเร็จ" });
      }
    });
    return () => controller.abort();
  }, [url, page, attempt, requestKey]);
  const loading = pending || result?.key !== requestKey;
  const data = result?.key === requestKey ? result.data : undefined;
  const currentSheet = data?.kind === "spreadsheet" ? data.sheets[sheet] ?? data.sheets[0] : null;

  return <section className="qa-version-preview" aria-label={`พรีวิว ${title}`} onContextMenu={event => event.preventDefault()}>
    {loading && <div role="status" className="flex min-h-64 items-center justify-center gap-3"><Spin /><span>กำลังเตรียมพรีวิว…</span></div>}
    {!loading && result?.error && <Alert type="error" showIcon title={result.error} action={<Button onClick={() => setAttempt(value => value + 1)}>ลองใหม่</Button>} />}
    {!loading && data?.kind === "pdf" && <>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
        <Button aria-label="หน้าก่อนหน้า" icon={<ChevronLeft size={16} aria-hidden="true" />} disabled={page <= 1} onClick={() => setPage(value => value - 1)} />
        <span className="text-sm" aria-live="polite">หน้า {data.page} / {data.totalPages}</span>
        <Button aria-label="หน้าถัดไป" icon={<ChevronRight size={16} aria-hidden="true" />} disabled={page >= data.totalPages} onClick={() => setPage(value => value + 1)} />
      </div>
      <Image src={data.image} width={data.width} height={data.height} alt={`${title} หน้า ${data.page}`}
        unoptimized draggable={false} className="mx-auto h-auto max-w-full border border-line bg-white shadow-sm" />
    </>}
    {!loading && data?.kind === "text" && <>
      <p className="mb-3 text-xs text-muted">พรีวิวเนื้อหาข้อความจากเอกสาร Word</p>
      {data.truncated && <Alert className="mb-3" type="info" title="เอกสารมีขนาดยาว พรีวิวแสดงเฉพาะข้อความส่วนแรก" />}
      {data.text.trim() ? <article className="whitespace-pre-wrap break-words rounded-lg bg-white p-5 text-sm leading-8">{data.text}</article> : <Empty description="ไม่พบข้อความในเอกสารนี้" />}
    </>}
    {!loading && data?.kind === "spreadsheet" && <>
      <Select aria-label="เลือกชีตสำหรับพรีวิว" className="mb-4 min-w-48" value={data.sheets[sheet] ? sheet : 0}
        onChange={setSheet} options={data.sheets.map((item, index) => ({ value: index, label: item.name }))} />
      {currentSheet?.truncated && <Alert className="mb-3" type="info" title="พรีวิวแสดงไม่เกิน 500 แถว และ 50 คอลัมน์ต่อชีต" />}
      {currentSheet?.rows.length ? <div className="max-h-[65dvh] overflow-auto rounded-lg border border-line bg-white">
        <table className="w-full border-collapse text-sm" aria-label={currentSheet.name}><tbody>
          {currentSheet.rows.map((row, rowIndex) => <tr key={rowIndex}>
            <th scope="row" className="sticky left-0 border border-line bg-canvas px-3 py-2 text-xs text-muted">{rowIndex + 1}</th>
            {row.map((cell, column) => <td key={column} className="min-w-28 whitespace-pre-wrap border border-line px-3 py-2 align-top">{cell}</td>)}
          </tr>)}
        </tbody></table>
      </div> : <Empty description="ชีตนี้ไม่มีข้อมูล" />}
    </>}
  </section>;
}

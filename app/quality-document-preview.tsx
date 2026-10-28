"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition, type PointerEvent } from "react";
import { Alert, Button, Empty, Input, Select, Spin } from "antd";
import { ChevronLeft, ChevronRight, Hand, Scan, ZoomIn, ZoomOut } from "lucide-react";
import type { DocumentPreview } from "@/types/quality-document-versions";
import "./quality-document-preview.css";

function PdfPageSelector({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  const [value, setValue] = useState(String(page));
  const target = Number(value);
  const valid = /^\d+$/.test(value) && Number.isSafeInteger(target) && target >= 1 && target <= totalPages;
  function goToPage() {
    if (valid) onChange(target);
  }
  return <>
    <span className="text-xs">หน้า</span>
    <Input size="small" className="qa-preview-page-input" aria-label="เลือกหน้าเอกสาร" inputMode="numeric" enterKeyHint="go"
      value={value} status={!valid ? "error" : undefined} aria-invalid={!valid} title={`ระบุเลขหน้า 1–${totalPages} แล้วกด Enter หรือปุ่มไป`}
      onFocus={event => event.target.select()} onChange={event => setValue(event.target.value)}
      onPressEnter={event => { event.preventDefault(); goToPage(); }} />
    <span className="text-xs">/ {totalPages}</span>
    <Button size="small" aria-label="ไปยังหน้าที่เลือก" disabled={!valid || target === page} onClick={goToPage}>ไป</Button>
    <span className="sr-only" aria-live="polite">หน้าปัจจุบัน {page} จาก {totalPages} หน้า</span>
  </>;
}

export default function QualityDocumentPreview({ url, title }: { url: string; title: string }) {
  const [page, setPage] = useState(1);
  const [sheet, setSheet] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [handTool, setHandTool] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
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
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setViewportSize({ width, height });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [loading, data?.kind]);
  const availableWidth = Math.max(1, viewportSize.width - 24);
  const fittedWidth = data?.kind === "pdf"
    ? Math.min(data.width, availableWidth, Math.max(1, viewportSize.height - 24) * data.width / data.height)
    : availableWidth;
  function fitPage() {
    setZoom(100);
    viewport.current?.scrollTo({ top: 0, left: 0 });
  }
  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (!handTool || !event.isPrimary || event.button !== 0) return;
    const area = event.currentTarget;
    const bounds = area.getBoundingClientRect();
    if (event.clientX >= bounds.left + area.clientLeft + area.clientWidth || event.clientY >= bounds.top + area.clientTop + area.clientHeight) return;
    event.preventDefault();
    area.focus({ preventScroll: true });
    area.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: area.scrollLeft, top: area.scrollTop };
    setDragging(true);
  }
  function movePan(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = start.left + start.x - event.clientX;
    event.currentTarget.scrollTop = start.top + start.y - event.clientY;
  }
  function endPan(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <section className="qa-version-preview" aria-label={`พรีวิว ${title}`} onContextMenu={event => event.preventDefault()}>
    {loading && <div role="status" className="flex min-h-64 items-center justify-center gap-3"><Spin /><span>กำลังเตรียมพรีวิว…</span></div>}
    {!loading && result?.error && <Alert type="error" showIcon title={result.error} action={<Button onClick={() => setAttempt(value => value + 1)}>ลองใหม่</Button>} />}
    {!loading && data && <>
      <div className="qa-preview-controls" role="group" aria-label="เครื่องมือพรีวิวเอกสาร">
        {data.kind === "pdf" && <div className="qa-preview-control-group">
          <Button size="small" aria-label="หน้าก่อนหน้า" icon={<ChevronLeft size={16} aria-hidden="true" />} disabled={page <= 1} onClick={() => setPage(value => value - 1)} />
          <PdfPageSelector key={data.page} page={data.page} totalPages={data.totalPages} onChange={setPage} />
          <Button size="small" aria-label="หน้าถัดไป" icon={<ChevronRight size={16} aria-hidden="true" />} disabled={page >= data.totalPages} onClick={() => setPage(value => value + 1)} />
        </div>}
        {data.kind === "spreadsheet" && <Select size="small" aria-label="เลือกชีตสำหรับพรีวิว" className="qa-preview-sheet" value={data.sheets[sheet] ? sheet : 0}
          onChange={setSheet} options={data.sheets.map((item, index) => ({ value: index, label: item.name }))} />}
        <div className="qa-preview-control-group">
          <Button size="small" type={handTool ? "primary" : "default"} aria-label="เครื่องมือมือเลื่อนเอกสาร" aria-pressed={handTool}
            title="เครื่องมือมือ: กดค้างแล้วลากเพื่อเลื่อนเอกสาร" icon={<Hand size={16} aria-hidden="true" />} onClick={() => setHandTool(value => !value)} />
          <Button size="small" aria-label="ซูมออก" title="ซูมออก" icon={<ZoomOut size={16} aria-hidden="true" />} disabled={zoom <= 50} onClick={() => setZoom(value => Math.max(50, value - 25))} />
          <Select size="small" aria-label="ระดับการซูม" className="qa-preview-zoom-select" virtual={false} value={zoom} onChange={setZoom}
            options={[50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300].map(value => ({ value, label: `${value}%` }))} />
          <Button size="small" aria-label="ซูมเข้า" title="ซูมเข้า" icon={<ZoomIn size={16} aria-hidden="true" />} disabled={zoom >= 300} onClick={() => setZoom(value => Math.min(300, value + 25))} />
          <Button size="small" onClick={fitPage} icon={<Scan size={15} aria-hidden="true" />}>พอดีหน้า</Button>
        </div>
      </div>
      <div ref={viewport} className={`qa-preview-viewport${handTool ? " is-hand-tool" : ""}${dragging ? " is-dragging" : ""}`} tabIndex={0} role="region" aria-label="พื้นที่พรีวิวเอกสาร เลื่อนเพื่อดูส่วนที่ขยาย"
        onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={endPan}>
        <div className="qa-preview-surface"><div className="qa-preview-document" style={{ width: fittedWidth, zoom: zoom / 100 }} data-zoom={zoom}>
          {data.kind === "pdf" && <Image src={data.image} width={data.width} height={data.height} alt={`${title} หน้า ${data.page}`}
            unoptimized draggable={false} className="qa-preview-pdf border border-line bg-white shadow-sm" onDoubleClick={() => { if (!handTool) { if (zoom === 100) setZoom(200); else fitPage(); } }} />}
          {data.kind === "text" && <>
            <p className="mb-3 text-xs text-muted">พรีวิวเนื้อหาข้อความจากเอกสาร Word</p>
            {data.truncated && <Alert className="mb-3" type="info" title="เอกสารมีขนาดยาว พรีวิวแสดงเฉพาะข้อความส่วนแรก" />}
            {data.text.trim() ? <article className="whitespace-pre-wrap break-words rounded-lg bg-white p-5 text-sm leading-8">{data.text}</article> : <Empty description="ไม่พบข้อความในเอกสารนี้" />}
          </>}
          {data.kind === "spreadsheet" && <>
            {currentSheet?.truncated && <Alert className="mb-3" type="info" title="พรีวิวแสดงไม่เกิน 500 แถว และ 50 คอลัมน์ต่อชีต" />}
            {currentSheet?.rows.length ? <table className="w-full border-collapse bg-white text-sm" aria-label={currentSheet.name}><tbody>
              {currentSheet.rows.map((row, rowIndex) => <tr key={rowIndex}>
                <th scope="row" className="border border-line bg-canvas px-3 py-2 text-xs text-muted">{rowIndex + 1}</th>
                {row.map((cell, column) => <td key={column} className="min-w-28 whitespace-pre-wrap border border-line px-3 py-2 align-top">{cell}</td>)}
              </tr>)}
            </tbody></table> : <Empty description="ชีตนี้ไม่มีข้อมูล" />}
          </>}
        </div></div>
      </div>
    </>}
  </section>;
}

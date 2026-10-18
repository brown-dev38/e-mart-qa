# สรุปการวิเคราะห์ระบบ — eSMART_QA2.html

> ไฟล์ต้นทาง: `workflow/eSMART_QA2.html`
> ขอบเขต: วิเคราะห์โครงสร้างและสถาปัตยกรรมของระบบ (ยังไม่แก้ไขโค้ด)
> วันที่วิเคราะห์: 2026-10-12

## 1. ภาพรวม

ระบบ **e-SMART QA** — ระบบบริหารคุณภาพ คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา

- เป็น **single-file web app** ขนาด ~3.3 MB / ~1,800 บรรทัด (CSS + JavaScript ฝังในไฟล์เดียว)
- รันแบบ **offline 100%** ไม่มี backend และไม่ต่อ network (CSP กำหนด `connect-src 'none'`)
- เปิดในเบราว์เซอร์ได้ทันทีโดยไม่ต้องติดตั้งอะไร
- จัดเก็บข้อมูลด้วยการ **save / load ไฟล์ JSON** (ไม่มี localStorage / ไม่มีฐานข้อมูล)

## 2. สถาปัตยกรรม (4 ชั้น)

### 2.1 Static data (JSON ฝังในไฟล์)

| ข้อมูล | เนื้อหา |
| --- | --- |
| `qa-unified-data` | ทะเบียนกระบวนการ / เอกสาร / แผนที่อ้างอิง (source: ทะเบียนหลักฐาน(1).xlsx) |
| `sar-form-source` | แบบฟอร์ม SAR 09–15 (fields, tables, questions) |
| `approval-policy-source` | นโยบายและลำดับขั้นการอนุมัติ |
| `wfme-map-data` (+ รูป/ฟอนต์ base64) | แผนผัง WFME 8 องค์ประกอบ / 32 หัวข้อ |

### 2.2 Core stores (IIFE ผูกกับ `window.*`)

- **`qaStore`** (registry-core) — ทะเบียนเอกสารระดับ QM/QP/WI/FM/REC/REF/INSTANCE, validation, การออกรหัส
- **`approvalStore`** (approval-store) — state machine ของคำขออนุมัติ + policy resolution + snapshot
- **`suiteStore`** (suite-store) — ข้อมูลรายปี needs / goals / tasks / audits / reviews

### 2.3 Runtime / UI

- **`sarBridge`** — E-SAR (รายงานการประเมินตนเอง), หน่วยงาน, แบบบันทึก 09–15, gaps, summary, export
- **`registry-ui`** — UI ทะเบียนเอกสาร (ออกเลขทะเบียน, CRUD)
- **`approvalUI`** — dialog คำขอ / การอนุมัติ
- **`suiteApp`** — 7 โมดูลระบบงาน + navigation
- **`wfme-code-demo`** — หลักฐานข้อ 3.4.1 + การตรวจสิทธิ์เข้าถึง
- **`wfme-map`** — แผนผัง WFME แบบ interactive (มุมมองย่อ / ภาพต้นฉบับ, popover, ค้นหา)

### 2.4 Shell

- `#qa-unified-system` รวม 6 pane: `sar` / `workflow` / `trace` / `criteria` / `wfme-map` / `suite`
- Sidebar (`#suite-nav`) 7 ระบบงาน + context (หน่วยงาน / ปีรายงาน) + save bar

## 3. โมดูลระบบงาน (7 โมดูล)

1. **E-SAR** — รายงานการประเมินตนเอง
2. **E-Process** — กระบวนการทำงาน
3. **E-Tracking** — ติดตามแผนปฏิบัติการ
4. **E-KPI** — ตัวชี้วัดและผลลัพธ์
5. **E-CQI** — ปรับปรุงผลการดำเนินการ
6. **E-Document** — เอกสารคุณภาพ
7. **E-Audit** — ตรวจประเมินคุณภาพ

## 4. แนวคิดโดเมน

- เอกสารมีลำดับชั้น **QM → QP → WI → FM → REC / REF / INSTANCE** และใช้รหัสตามหมวดงาน (MIS, CUR, ASM, STU, ADM ฯลฯ)
- **8 หน่วยงาน**: FAC, EDU, MGT, RES, ADM, TCH, ASM, STU × หลายปีการศึกษา (พ.ศ.) รองรับ multi-year
- **Approval workflow** มี role-based authorization (คณบดี / คณะกรรมการ / มหาวิทยาลัย), ตรวจ snapshot ว่าเอกสารเปลี่ยนหลังอนุมัติหรือไม่ และห้ามผู้อนุมัติเป็นผู้จัดทำเรื่องของตนเอง
- **WFME traceability** — เชื่อม เกณฑ์ → กระบวนการ → เอกสาร → KPI

## 5. การเชื่อมต่อระหว่างระบบ

- ใช้ **`CustomEvent`** เป็นหลัก เช่น `quality-navigate`, `quality-selection`, `qa-registry-change`, `suite-render`, `suite-change`, `approval-change`, `approval-document`, `sar-context`
- ใช้ **bridge object** ที่ผูกกับ DOM element (`sarBridge`, `qualityBridge`) เป็น API ข้ามระบบ
- ใช้ **global (`window.*`)** ร่วมกันเป็น bus ข้อมูล

## 6. จุดเด่นเชิงคุณภาพ

- เข้าถึงง่าย (aria, role, การจัดการ focus)
- รองรับ light / dark theme (`light-dark()`)
- Responsive และมี print styles
- Escape HTML ก่อน export
- Validation เข้มข้น + sanitize ป้องกัน prototype pollution

## 7. ข้อสังเกต / ความเสี่ยง

- ไฟล์เดียวใหญ่ 3.3 MB; ทุกอย่างผูกกับ global + event แบบ implicit → maintain / test ยาก
- `qualityBridge` ถูกนิยามซ้ำหลายจุด (ตัวหลังทับตัวก่อน) สื่อว่าเป็นโค้ดที่รวมจากหลาย prototype
- ไม่มี automated test, ไม่มี build / module แยกส่วน (เป็น artifact ที่ generate/merge มา)
- ไม่มี auth จริง — ระบุเองว่า "ยังไม่เชื่อมระบบยืนยันตัวตนหรือลายมือชื่อดิจิทัล" (audit trail เป็นระดับเอกสารเท่านั้น)
- เสี่ยง data loss เพราะต้องกดบันทึกไฟล์เอง

## 8. บริบทของโปรเจค

- repo นี้เป็น **Next.js scaffold เปล่า** (`app/page.tsx`, `app/layout.tsx`, `app/globals.css`)
- โฟลเดอร์ `workflow/` เป็น **ตัวอย่าง / reference** ที่แยกออกมา
- แนวโน้ม: ไฟล์นี้เป็นต้นแบบ (prototype) ที่จะนำมาพอร์ตเข้าโครงสร้าง Next.js ต่อไป

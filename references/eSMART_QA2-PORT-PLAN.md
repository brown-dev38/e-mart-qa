# แผนการพอร์ต eSMART_QA2 → Next.js

> ต้นทาง: `references/eSMART_QA2.html` (prototype single-file, offline)
> ปลายทาง: แอป Next.js ใน repo นี้
> สถานะ: แผน (ยังไม่เริ่มเขียนโค้ด)
> วิเคราะห์ประกอบ: `references/eSMART_QA2-NOTES.md`

---

## 1. เป้าหมายและหลักการ

- ย้ายระบบ e-SMART QA จาก prototype ไฟล์เดียว → แอป Next.js ที่ maintain / test / ขยายได้
- **รักษาความถูกต้องของกติกาโดเมน (parity)** — prototype เป็น golden reference ใช้เทียบผล
- แยกชั้นให้ชัด: **data → domain (pure) → UI** ก่อน แล้วค่อยผูก persistence / auth
- ไม่ทำ big-bang rewrite — ทำเป็น **vertical slice** ทีละโมดูล พร้อมใช้งานได้จริง

## 2. สถานะปัจจุบัน

**Scaffold (repo นี้)**
- Next.js `16.4.0` (App Router) + React `19.3.0` + TypeScript strict
- Tailwind CSS v4 (`@import "tailwindcss"` + `@tailwindcss/turbopack`)
- `next.config.ts`: `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback: true`
- ยังไม่มี: ระบบ routing ของโมดูล, data layer, domain layer, persistence

**Prototype (`references/eSMART_QA2.html`)**
- single-file ~3.3 MB, CSS+JS ฝังใน, ไม่มี dependency, offline (CSP `connect-src 'none'`)
- 7 โมดูลระบบงาน + 3 core stores + 6 pane + แผนผัง WFME
- persistence = save/load ไฟล์ JSON (ไม่มี DB)
- cross-module สื่อสารด้วย `CustomEvent` + global bridge

## 3. ข้อกำหนดเบื้องต้น (ต้องทำก่อนเขียนโค้ด)

- **อ่านเอกสาร Next 16 ก่อนทุกครั้ง** ที่ `node_modules/next/dist/docs/` โดยเฉพาะ `01-app/01-getting-started`, `01-app/03-api-reference`, `01-app/02-guides` — เวอร์ชันนี้มี breaking changes จากที่รู้ (ดู `AGENTS.md`)
- ยืนยันการตัดสินใจเชิงสถาปัตยกรรมในข้อ 7 ให้ครบก่อนเริ่ม Phase 1

## 4. สถาปัตยกรรมเป้าหมาย (โครงสร้างโฟลเดอร์ที่เสนอ)

```
app/
  layout.tsx                 # theme + a11y shell
  page.tsx                   # dashboard / ทางเข้าโมดูล
  (systems)/
    sar/…                    # E-SAR
    process/…                # E-Process
    tracking/…               # E-Tracking
    kpi/…                    # E-KPI
    cqi/…                    # E-CQI
    documents/…              # E-Document
    audit/…                  # E-Audit
    registry/…               # ทะเบียนเอกสารกลาง
    approval/…               # คำขอ / อนุมัติ
    wfme/…                   # แผนผัง WFME + traceability + เกณฑ์ 3.4.1
data/                        # แยกจาก embedded JSON (static, typed)
  processes.json
  sar-forms.json
  approval-policy.json
  wfme-map.json
lib/
  domain/
    registry/                # จาก qaStore
    approval/                # จาก approvalStore (state machine)
    suite/                   # จาก suiteStore (multi-year)
  validation/                # sanitize / validate ที่ใช้ร่วม
  state/                     # แทน CustomEvent bus + global stores
types/                       # โดเมนไทป์ (Doc, Request, Report, …)
components/
  ui/                        # primitives
  systems/                   # คอมโพเนนต์รายโมดูล
```

## 5. แผนดำเนินงาน (Phases)

### Phase 0 — Foundations & Decisions
- อ่านเอกสาร Next 16 ที่เกี่ยวข้อง
- เคลียร์การตัดสินใจข้อ 7 ทั้งหมด
- ตกลงกลยุทธ์ styling (port CSS เดิม vs rebuild ด้วย Tailwind v4) และ state management

### Phase 1 — Extract static data
- ดึง JSON ที่ฝังใน `<script type="application/json">` ออกเป็นไฟล์ใน `data/`:
  `qa-unified-data`, `sar-form-source`, `approval-policy-source`, `wfme-map-data`
- แยกฟอนต์ (WM Sarabun) และรูป WFME ออกจาก base64 → static asset
- เขียน type ให้ครบ + script ตรวจความสอดคล้องของข้อมูล
- **ผลลัพธ์:** ข้อมูลที่ type-safe, ไม่มี logic

### Phase 2 — Port core domain (pure TS + tests)
- `registry` ← `qaStore`: ลำดับชั้นเอกสาร, ออกรหัส, `validate`, sanitize (คงกติกา prototype)
- `approval` ← `approvalStore`: state machine (draft→review→returned→approved→published/cancelled/withdrawn), policy resolution, snapshot change detection, role authorization
- `suite` ← `suiteStore`: ข้อมูลรายปี, needs/goals/tasks/audits/reviews, `switchYear`
- **ตัด DOM/`window`/`CustomEvent` ออกทั้งหมด** → pure functions
- เขียน unit test (parity กับ prototype) เป็นด่านกันถอยหลัง

### Phase 3 — Vertical slice แรก: E-Document + registry
- ทำ routing + UI ครบ loop: list → form → save → validate
- ต่อ persistence (import/export JSON) ให้เทียบเท่า prototype
- วาง pattern ของ state/UI ที่โมดูลอื่นจะใช้ซ้ำ

### Phase 4 — E-SAR
- forms 09–15, units (8 หน่วยงาน), multi-year, gaps, summary, export รายงาน
- โมดูลซับซ้อนสุด ใช้ pattern จาก Phase 3

### Phase 5 — โมดูลที่เหลือ
- E-Process, E-Tracking, E-KPI, E-CQI, E-Audit (โดยมากเป็นตาราง + form + metric)

### Phase 6 — WFME layer
- แผนผัง WFME (มุมมองย่อ + ภาพต้นฉบับ), traceability, หลักฐานข้อ 3.4.1 + สิทธิ์เข้าถึง, approval UI

### Phase 7 — Cross-cutting & hardening
- Navigation shell (sidebar 7 ระบบ), theme light/dark, a11y, print styles
- ตรวจ parity ทั้งระบบ, จัดการ persistence/auth ตามข้อ 7

## 6. การแมป prototype → Next.js (สรุป)

| Prototype | ปลายทาง |
| --- | --- |
| `<script type="application/json">` ฝังใน | `data/*.json` + types |
| `qaStore` / `approvalStore` / `suiteStore` | `lib/domain/*` (pure TS) |
| `sarBridge` / `qualityBridge` / `window.suiteApp` | โมดูล domain + state layer |
| `CustomEvent` (quality-navigate, suite-render, …) | state management กลาง |
| IIFE + DOM manipulation | React components + App Router |
| save/load ไฟล์ JSON | persistence layer (ดูข้อ 7) |

## 7. การตัดสินใจที่ต้องเคลียร์ก่อนเริ่ม (blockers)

1. **Persistence** — คงเป็น import/export ไฟล์ JSON แบบ original หรือย้ายไป DB/API server
2. **State management** — React Context / Zustand / อื่น ๆ แทน global stores + event bus
3. **Styling** — port CSS custom-property เดิม หรือ rebuild ด้วย Tailwind v4 (ระบบนี้ custom เยอะ)
4. **Auth** — เพิ่มจริงหรือยัง (prototype ระบุว่ายังไม่มี auth / ลายมือชื่อดิจิทัล)
5. **Rendering strategy** — interactive เป็นหลัก → client-heavy; ระบุว่าส่วนไหนเป็น Server Component ได้
6. **i18n / ภาษา** — ยืนยันว่าเป็นไทย monolingual

## 8. ความเสี่ยง

- parity ของ approval engine + registry validation (ซับซ้อน, ฝังใน string) — ต้องมี test
- ข้อมูล WFME/ฟอนต์ base64 ขนาดใหญ่ — ต้องย้ายเป็น asset อย่างถูกวิธี
- CSS custom เยอะ — rebuild ด้วย Tailwind อาจเสี่ยงเสียรายละเอียด (a11y/print/responsive)
- Next 16 breaking changes — ต้องยึด docs ในเครื่องเป็นหลัก

## 9. นิยามเสร็จ (Definition of Done) ต่อ phase

- ผ่าน type check + lint + unit test
- ผลลัพธ์ตรงกับ prototype (parity) สำหรับเส้นทางที่เทียบได้
- ไม่มี regression ด้าน a11y / responsive / print
- commit แยกตาม phase

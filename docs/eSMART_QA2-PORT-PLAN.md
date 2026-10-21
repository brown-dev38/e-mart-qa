# แผนพัฒนาระบบ e-SMART QA (Next.js)

> ต้นทาง (อ้างอิง/สเปค): `references/eSMART_QA2.html` (prototype single-file, offline) + `eSMART_QA2-NOTES.md`
> ปลายทาง: แอป Next.js ใน repo นี้ (มีฐานโครงสร้าง + ระบบงานแรกแล้ว)
> สถานะ: **อยู่ระหว่างพัฒนา** — ฐาน (auth, DB, admin, ทะเบียนเอกสาร) เสร็จแล้ว เหลือระบบงานที่เหลือ
> หมายเหตุ: แผนเดิมเป็น "พอร์ต prototype แบบ offline/JSON" แต่ทิศทางจริง **pivot ไปเป็น DB-backed app** (Prisma + MySQL) เอกสารนี้จึงถูกปรับให้ตรงกับโค้ดจริง

---

## 1. เป้าหมายและหลักการ

- พัฒนาระบบ e-SMART QA เป็นแอป Next.js ที่ maintain / test / ขยายได้บนฐานข้อมูลจริง
- **prototype เดิมเป็นแค่ reference/สเปค** (โครงสร้างข้อมูล กติกาโดเมน) — การนำโค้ดฝังใน single-file **ไม่ถูก port ตรง ๆ** เพราะ pivot ไปใช้ DB
- แยกชั้นให้ชัด: **UI (React) → server actions → domain/logic → Prisma/DB**
- ไม่ทำ big-bang — ทำเป็น **vertical slice** ทีละระบบงาน พร้อมใช้งานได้จริง

## 2. สถานะปัจจุบัน

**Scaffold & toolchain**
- Next.js `16.4.0` (App Router) + React `19.3.0` + TypeScript strict
- UI: Tailwind CSS v4 + **Ant Design v6** (`@ant-design/nextjs-registry` + `<AntdRegistry layer>`)
- ฐานข้อมูล: **Prisma 7 + MySQL** ผ่าน `@prisma/adapter-mariadb` (ใช้ standalone MySQL Server ที่ติดตั้ง) — `lib/prisma.ts`
- `next.config.ts`: `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback: true`

**Auth (เสร็จแล้ว)**
- NextAuth v4 Credentials (username/password) + JWT session — `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`
- หน้า `/login`, logout, gating ที่ server page / server action
- บทบาท: `admin`, `staff`, `user` (จากตาราง `role`)

**Data layer / Admin (เสร็จแล้ว)**
- Schema: ตาราง core (`users`, `role`, `departments`, `positions`) + `docs_*` master tables (`docs_departments`, `docs_sub_departments`, `docs_accreditation_frameworks`, `docs_programs`, `docs_document_levels`, `docs_qa_criteria`, `docs_qa_documents`, `docs_qa_document_revisions`) — `prisma/schema.prisma`
- ตาราง `departments`, `positions`, `role` ไม่มี `employee_id` แล้ว (migration `20261021010000_remove_unused_employee_id`); ผู้ใช้งานเชื่อมกับแต่ละตารางผ่าน `users.department_id`, `users.position_id`, `users.role_id` → `id`
- Migrations + seed (roles, users, departments, subunits, frameworks, programs, document levels, QA criteria) — `prisma/seed.ts`
- Admin จัดการ master data (เพิ่ม/แก้/ลบ 6 กลุ่ม) — `app/admin/actions.ts` (server actions, เฉพาะ `admin`) + UI `app/admin/admin-settings.tsx`
- Business logic/validation: `lib/master-data.ts` (`loadMasterData`, `saveMasterRecord`, `deleteMasterRecord`)

**ทะเบียนเอกสารคุณภาพ (เสร็จแล้ว)**
- หน้าแยกตามหน่วยงานเชื่อมฐานข้อมูลครบตามสเปค: QA/SAR/APR/CAR, ฉบับหลักสูตร, มคอ.3/มคอ.5/ผลประเมิน, ผลการศึกษา และประกาศรับสมัคร พร้อมหน้าตั้งค่าปี/ภาคเรียน/ชั้นปี/รายวิชา/การเปิดสอน — ดู `department-documents-setup.md`
- สร้างเอกสาร + list + ดูตามหน่วยงาน — `app/quality-document-*.tsx`, `app/department-documents.tsx`
- Server actions: `app/documents/actions.ts`; logic: `lib/quality-document-save.ts`, `...-query.ts`, `...-catalog.ts`, `...-draft.ts`
- Dashboard workspace (sidebar, breadcrumb, mobile drawer) — `app/dashboard.tsx`

## 3. ข้อกำหนดเบื้องต้น

- **อ่านเอกสาร Next 16 ก่อนทุกครั้ง** ที่ `node_modules/next/dist/docs/` (โดยเฉพาะ `01-app/01-getting-started`, `01-app/03-api-reference`, `01-app/02-guides`) — เวอร์ชันนี้มี breaking changes จากที่รู้ (ดู `AGENTS.md`)
- หลังแก้ `prisma/schema.prisma` → รัน `npx prisma generate` (และ migrate ถ้าเปลี่ยนโครงสร้าง) — client ที่ค้างเก่าเป็นสาเหตุ error "model undefined"
- ทำคนละ feature เป็น feature branch (สอดคล้องกับ workflow ที่ใช้)

## 4. สถาปัตยกรรมปัจจุบัน (จริงใน repo)

```
app/
  layout.tsx / page.tsx            # root layout + dashboard page (server, auth-gate)
  dashboard.tsx                    # workspace UI (client)
  login/page.tsx                   # หน้า login
  api/auth/[...nextauth]/route.ts  # NextAuth API
  documents/actions.ts             # server actions: เอกสารคุณภาพ
  admin/actions.ts                 # server actions: master data (admin only)
  admin/admin-settings.tsx         # UI จัดการ master data
  quality-document-form.tsx / -list.tsx / department-documents.tsx
  ui-provider.tsx / sign-out-button.tsx
lib/
  prisma.ts                        # PrismaClient + MariaDB adapter (singleton)
  auth.ts                          # NextAuth options + auth()
  master-data.ts                   # โดเมน master data (load/save/delete + validate)
  quality-document-*.ts            # โดเมนทะเบียนเอกสาร (save/query/catalog/draft)
prisma/
  schema.prisma                    # โมเดล + enum
  migrations/                      # baseline + add docs_* tables
  seed.ts                          # roles/users/master data/QA criteria
types/
  master-data.ts / quality-document.ts / next-auth.d.ts
```

## 5. แผนดำเนินงาน (Phases)

### ✅ เสร็จแล้ว
- **Foundation** — scaffold, Tailwind v4 + antd, Prisma 7 + MySQL, migrations, seed
- **Auth** — NextAuth credentials, /login, JWT, role gating, logout
- **Master data admin** — CRUD 6 กลุ่ม (admin), validation แบบ domain
- **E-Document registry** — create/list/แยกตามหน่วยงาน

### ⬜ เหลือ (vertical slice ต่อ)
- **E-SAR** — forms 09–15, หน่วยงาน, multi-year, gaps, summary, export รายงาน
- **E-Process / E-Tracking / E-KPI / E-CQI / E-Audit** — ตาราง + form + metric (ต่อจาก pattern ที่วางไว้)
- **กฎระเบียบข้อบังคับ (Regulations)** — ปัจจุบันเป็น placeholder
- **Approval / workflow** — draft→review→approved→published (ถ้าจำเป็นร่วมกับทะเบียนเอกสาร)
- **WFME layer** — แผนผัง WFME, traceability, หลักฐานเกณฑ์ 3.4.1 (อ้างอิง `docs/แผนผังข้อมูล WFME.png`, `เกณฑ์-wfme-2568-new.pdf`)
- **Cross-cutting** — เอกสาร/รายงาน export, a11y/print/responsive review, hardening

## 6. สถานะการตัดสินใจ (เดิมในข้อ 7 → ตัดสินแล้ว)

| ประเด็น | ข้อสรุป | หมายเหตุ |
| --- | --- | --- |
| Persistence | **MySQL ผ่าน Prisma 7 (adapter-mariadb)** | ไม่ใช่ import/export JSON แบบ prototype แล้ว |
| State | React state + Context + localStorage (draft/nav) + **server actions** | ไม่มี global store/CustomEvent bus |
| Styling | **Tailwind v4 + Ant Design v6** | ไม่ port CSS/JS เดิมจาก prototype |
| Auth | **NextAuth v4 (credentials, JWT)** — จริงแล้ว | roles: admin/staff/user |
| Rendering | Server Components (page/auth/master data) + client สำหรับ interactive ส่วนใหญ่ | — |
| i18n / ภาษา | **ไทย monolingual** (`lang="th"`) | — |

## 7. ความเสี่ยง

- **Prisma client stale** — หลังรับโค้ดใหม่/เปลี่ยน schema ต้องรัน `prisma generate` เสมอ ไม่งั้นเจอ "model undefined"
- Prisma 7 เปลี่ยน default output dir + driver adapter — ต้องอ่าน `PRISMA-SETUP-NOTES.md` ก่อนแตะ DB
- ระบบเดิม (SAR ฯลฯ) ซับซ้อน — ควร port เป็น vertical slice พร้อม domain logic/validation แยกจาก UI
- Next 16 breaking changes — ยึด docs ในเครื่องเป็นหลัก (ดู AGENTS.md)

## 8. นิยามเสร็จ (Definition of Done) ต่อ feature/phase

- ผ่าน type check + lint
- ทำงานจริงบน MySQL (seed/migrate ครบ) และไม่ทำให้ error "model undefined"
- กดใช้งานครบ loop (list → form → save → validate) และ role gate ถูกต้อง
- commit แยกตาม feature

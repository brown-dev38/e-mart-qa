# บันทึกการแก้ไข: ตั้งค่า Prisma (MySQL / XAMPP)

> วันที่: 2026-10-12
> ขอบเขต: แก้ setup Prisma ให้ใช้งานได้กับ MySQL (localhost:3306, ฐานข้อมูล `e-smart-qa`)
> สาเหตุราก: โปรเจคใช้ `prisma@8.0.0-rc.22` (prerelease ที่รื้อ CLI) แต่ `@prisma/client` เป็น v7 — ไม่ตรง major กัน

---

## ไทม์ไลน์การแก้ไข (ตามลำดับเหตุการณ์)

### 1. อาการเริ่มต้น (รันคำสั่งเดิมไม่ได้)
| # | คำสั่ง | ผลลัพธ์ |
| --- | --- | --- |
| 1 | `npx prisma init --datasource-provider mysql` | ✘ `[CLI.INVALID_ARGUMENTS] No flag registered for --datasource-provider` |
| 2 | `npx prisma migrate dev --name init` | ✘ `[CLI.UNKNOWN_COMMAND] No command registered for 'migrate', did you mean 'migration'?` |
| 3 | — | คำเตือน `Prisma agent skills are out of date … Run: prisma skills sync` |

### 2. วินิจฉัยสาเหตุ
- ตรวจ `package.json` → พบ `prisma: ^8.0.0-rc.22` (dev) แต่ `@prisma/client: ^7.10.0` → **major ไม่ตรงกัน**
- ตรวจ `node_modules/prisma/package.json` → ยืนยันเวอร์ชัน `8.0.0-rc.22` และมี `@prisma/composer`, `skills`
- รัน CLI help → ยืนยันว่าโครงสร้างคำสั่งเปลี่ยนทั้งหมด:
  `init`, `orm`, `contract`, `migration`, `db`, `skills`, `lsp`
- พบว่า `prisma orm init --target` รองรับแค่ **`postgres` / `mongodb`** (ไม่มี `mysql`)
- ตรวจ `.env` → มี `DATABASE_URL` ชี้ MySQL อยู่แล้ว; ยังไม่มี `prisma.config.ts`

### 3. ตัดสินใจ
- เลือก **ลดมาใช้ Prisma 7 stable** เพื่อใช้ workflow `migrate dev` แบบเดิม และรองรับ MySQL
- ตรวจเวอร์ชัน v7 ล่าสุด → `prisma` และ `@prisma/client` = **7.10.0** ทั้งคู่

### 4. ลงมือแก้
| # | การกระทำ | ผล |
| --- | --- | --- |
| 4 | `npm install --save-dev prisma@7.10.0` + `npm install @prisma/client@7.10.0` | ✓ ติดตั้ง 7.10.0, ถอดแพ็กเกจ v8 ออก 309 ตัว |
| 5 | ตรวจ engines + CLI | ✓ `schema-engine-windows.exe` ดาวน์โหลดแล้ว; `prisma --version` = 7.10.0 |
| 6 | `prisma migrate dev --name init` | ✘ `P1012: The datasource property 'url' is no longer supported in schema files` |
| 7 | สร้าง `prisma.config.ts` + ลบ `url = env("DATABASE_URL")` ใน `schema.prisma` | — |
| 8 | `prisma migrate dev --name init` | ✘ `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` |
| 9 | เพิ่ม `import "dotenv/config"` ใน config + `npm i -D dotenv` | ✓ โหลด `.env` ได้ |
| 10 | `prisma migrate dev --name init` | ✓ สร้างและ apply migration `20261012073644_init` |
| 11 | `prisma generate` | ✓ Generate Client v7.10.0 → `node_modules/@prisma/client` |
| 12 | `prisma migrate status` + ตรวจ `migration.sql` | ✓ "Database schema is up to date!" — 4 ตาราง + FK ครบ |
| 13 | `npm install @prisma/adapter-mariadb@7.10.0` | ✓ ได้ adapter สำหรับ runtime |

### 5. ผลลัพธ์สุดท้าย
- ฐานข้อมูล MySQL `e-smart-qa` sync กับ schema แล้ว
- ตารางที่สร้าง: `users`, `department`, `role`, `position` (+ foreign keys)
- Prisma CLI + Client อยู่ที่ **7.10.0** ตรงกัน

---

## ไฟล์ที่เปลี่ยนแปลง

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `package.json` / `package-lock.json` | `prisma` → `^7.10.0`; เพิ่ม `@prisma/adapter-mariadb ^7.10.0`; เพิ่ม `dotenv` (dev) |
| `prisma/schema.prisma` | ลบ `url = env("DATABASE_URL")` ออกจาก datasource |
| `prisma.config.ts` | **ใหม่** — schema path, datasource url จาก env, migrations path, โหลด `.env` |
| `prisma/migrations/20261012073644_init/` | **ใหม่** — `migration.sql` + `migration_lock.toml` |

## การใช้งานต่อ + ข้อควรรู้

- คำสั่งที่ใช้ได้ตามเดิม: `npx prisma migrate dev --name <name>`, `npx prisma studio`
- ตอนสร้าง `PrismaClient` (Prisma 7) **ต้องส่ง driver adapter**:
  ```ts
  import { PrismaClient } from "@prisma/client";
  import { PrismaMariaDb } from "@prisma/adapter-mariadb";

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  export const prisma = new PrismaClient({ adapter });
  ```
- คำเตือน "Update available 7.10.0 → 8.0.0-rc.22" **ให้ข้าม** เพราะตั้งใจอยู่บน v7 stable
- ยังไม่มี `lib/prisma.ts` singleton — รอสรุปโครงสร้าง app ก่อน

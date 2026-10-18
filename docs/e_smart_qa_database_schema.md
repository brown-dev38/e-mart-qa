# การออกแบบโครงสร้างฐานข้อมูล MySQL สำหรับระบบ e-smart-qa (คณะแพทยศาสตร์)

เอกสารฉบับนี้สรุปโครงสร้างฐานข้อมูล MySQL (รองรับ MySQL 8.0+) สำหรับระบบจัดการเอกสารประกันคุณภาพการศึกษา (**e-smart-qa**) ที่พัฒนาด้วย **Next.js + MySQL** โดยครอบคลุมตารางข้อมูลหลัก (Master Data), โครงสร้างเกณฑ์ WFME และ AUN แบบลำดับชั้น (Hierarchical Criteria) และตารางจัดเก็บเอกสารคุณภาพ

## 1. แนวคิดการออกแบบตามเงื่อนไขของระบบ (Design Principles)

1. **การรองรับหน่วยงานที่มีและไม่มีงานย่อย (`departments` & `sub_departments`)**
   - แยกตารางหน่วยงานหลัก (`EDU`, `MGT`) ออกจากตารางงานย่อย (`ADM`, `TCH`, `ASM`, `STU`)
   - ตาราง `departments` มีฟิลด์ `has_sub_department` เพื่อระบุว่าหน่วยงานนั้นมีงานย่อยหรือไม่ (`EDU` = `1`, `MGT` = `0`)
   - ในตารางเอกสาร `qa_documents` กำหนดให้ `sub_department_id` มีค่าเป็น `NULL` ได้ (`NULLABLE`) สำหรับเอกสารของหน่วยงานบริหาร (`MGT`) ที่ไม่มีงานย่อยภายใต้หน่วยงาน

2. **การล็อกความสัมพันธ์ระหว่างหลักสูตรกับเกณฑ์ (`programs` -> `accreditation_frameworks`)**
   - ตาราง `programs` ผูก Foreign Key `framework_id` เข้ากับตารางกรอบมาตรฐาน (`WFME`, `AUN`) โดยตรง
   - เมื่อผู้ใช้เลือกหลักสูตร `M.D.` ระบบจะกรองเฉพาะเกณฑ์ภายใต้ `WFME` มาให้เลือก และหากเลือก `B.PMD.` ระบบจะกรองเฉพาะเกณฑ์ภายใต้ `AUN` ป้องกันการจับคู่ข้ามเกณฑ์ผิดพลาด

3. **โครงสร้างเกณฑ์การประเมินแบบลำดับชั้น (`qa_criteria`)**
   - ใช้รูปแบบ **Self-Referencing Foreign Key (`parent_id`)** ร่วมกับระดับชั้น (`level_depth`) เพื่อรองรับลำดับชั้นของเกณฑ์ WFME ได้อย่างยืดหยุ่น:
     - **ระดับที่ 1 (Area / หมวดหลัก):** เช่น `Area 1` (Mission and Outcomes)
     - **ระดับที่ 2 (Sub-area / หมวดย่อย):** เช่น `1.1` (Stated Mission)
     - **ระดับที่ 3 (Standard / ข้อเกณฑ์ย่อยที่ใช้ออกรหัส):** เช่น `W1.1.1`, `W1.1.2`
   - มีฟิลด์ `is_selectable` (`BOOLEAN`) เพื่อบังคับให้ผู้ใช้เลือกผูกเอกสารได้เฉพาะข้อเกณฑ์ย่อยระดับใบ (Leaf Node เช่น `W1.1.1` หรือ `A1.1-1`) เท่านั้น

4. **ความสัมพันธ์ระหว่างเอกสารกับเกณฑ์ (1 เอกสาร : 1 เกณฑ์)**
   - เอกสาร 1 ฉบับผูกกับเกณฑ์ได้เพียง 1 ข้อ จึงเก็บ `criterion_id` เป็น Foreign Key อยู่ในตาราง `qa_documents` โดยตรง (One-to-Many จากมุมของเกณฑ์ คือ 1 เกณฑ์มีเอกสารได้หลายฉบับ แต่ 1 เอกสารชี้ไปที่เกณฑ์เดียว)
   - ส่วนการรันเลขลำดับเอกสาร (`sequence_no`) แยกเก็บเป็นฟิลด์ `VARCHAR(10)` (ค่าเริ่มต้น `'000'` หรือ `NULL`) เพื่อให้สามารถนำมาเขียนลอจิกคำนวณเลขรันต่อได้ในอนาคตโดยไม่ต้องแก้โครงสร้างตาราง

## 2. สรุปรายชื่อตารางในฐานข้อมูล (Table Overview)

| ลำดับ | ชื่อตาราง (Table Name) | ประเภทตาราง | หน้าที่และการเก็บข้อมูล |
| :--- | :--- | :--- | :--- |
| 1 | `departments` | Master Data | เก็บข้อมูลหน่วยงานหลัก (`EDU`, `MGT`) |
| 2 | `sub_departments` | Master Data | เก็บข้อมูลงานย่อยภายใต้หน่วยงาน (`ADM`, `TCH`, `ASM`, `STU`) |
| 3 | `accreditation_frameworks` | Master Data | เก็บกรอบเกณฑ์การประเมิน (`WFME`, `AUN`) |
| 4 | `programs` | Master Data | เก็บข้อมูลหลักสูตร (`M.D.`, `B.PMD.`) และผูกกับกรอบเกณฑ์ |
| 5 | `document_levels` | Master Data | เก็บระดับเอกสารคุณภาพ (`QM`, `SP`, `WI`, `FM`, `SD`) |
| 6 | `qa_criteria` | Hierarchical Master | เก็บโครงสร้างเกณฑ์ WFME และ AUN แบบลำดับชั้น (Tree Structure) |
| 7 | `qa_documents` | Transaction | เก็บข้อมูลเอกสารคุณภาพ รหัสเอกสาร เมทาดาทา และไฟล์แนบหลัก |
| 8 | `qa_document_revisions` | Transaction (Optional) | เก็บประวัติการอัปเดตไฟล์เอกสารย้อนหลัง (Version Control) |

## 3. โครงสร้างตารางโดยละเอียด (Data Dictionary)

### 3.1 ตาราง `departments` (หน่วยงานหลัก)
| ชื่อคอลัมน์ | ชนิดข้อมูล | Constraint | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `PK, AUTO_INCREMENT` | รหัสอ้างอิงหน่วยงานหลัก |
| `code` | `VARCHAR(20)` | `NOT NULL, UNIQUE` | รหัสย่อหน่วยงาน เช่น `EDU`, `MGT` |
| `name_th` | `VARCHAR(150)` | `NOT NULL` | ชื่อหน่วยงานภาษาไทย เช่น `หน่วยงานการศึกษา` |
| `name_en` | `VARCHAR(150)` | `NULL` | ชื่อหน่วยงานภาษาอังกฤษ |
| `has_sub_department` | `TINYINT(1)` | `NOT NULL DEFAULT 0` | `1` = มีงานย่อย (`EDU`), `0` = ไม่มีงานย่อย (`MGT`) |
| `is_active` | `TINYINT(1)` | `NOT NULL DEFAULT 1` | สถานะการใช้งาน (`1` = เปิดใช้งาน, `0` = ปิด) |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | วันเวลาที่สร้างรายการ |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | วันเวลาที่แก้ไขล่าสุด |

### 3.2 ตาราง `sub_departments` (ชื่องานย่อยภายใต้หน่วยงาน)
| ชื่อคอลัมน์ | ชนิดข้อมูล | Constraint | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `PK, AUTO_INCREMENT` | รหัสอ้างอิงงานย่อย |
| `department_id` | `INT UNSIGNED` | `FK -> departments.id, NOT NULL` | อ้างอิงหน่วยงานหลัก |
| `code` | `VARCHAR(20)` | `NOT NULL` | รหัสย่องาน เช่น `ADM`, `TCH`, `ASM`, `STU` |
| `name_th` | `VARCHAR(150)` | `NOT NULL` | ชื่องานภาษาไทย เช่น `งานรับเข้า` |
| `name_en` | `VARCHAR(150)` | `NULL` | ชื่องานภาษาอังกฤษ |
| `sort_order` | `INT UNSIGNED` | `NOT NULL DEFAULT 0` | ลำดับการแสดงผล |
| `is_active` | `TINYINT(1)` | `NOT NULL DEFAULT 1` | สถานะการใช้งาน |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | วันเวลาที่สร้างรายการ |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | วันเวลาที่แก้ไขล่าสุด |

### 3.3 ตาราง `accreditation_frameworks` (กรอบเกณฑ์การประเมิน)
| ชื่อคอลัมน์ | ชนิดข้อมูล | Constraint | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `PK, AUTO_INCREMENT` | รหัสอ้างอิงกรอบเกณฑ์ |
| `code` | `VARCHAR(20)` | `NOT NULL, UNIQUE` | รหัสกรอบเกณฑ์ เช่น `WFME`, `AUN` |
| `prefix_char` | `VARCHAR(5)` | `NOT NULL` | ตัวอักษรนำหน้ารหัสเกณฑ์ เช่น `W`, `A` |
| `name_th` | `VARCHAR(150)` | `NOT NULL` | ชื่อเกณฑ์ภาษาไทย |
| `name_en` | `VARCHAR(150)` | `NULL` | ชื่อเกณฑ์ภาษาอังกฤษ |
| `version_year` | `VARCHAR(20)` | `NULL` | ปีหรือรุ่นของเกณฑ์ เช่น `2020` |
| `is_active` | `TINYINT(1)` | `NOT NULL DEFAULT 1` | สถานะการใช้งาน |

### 3.4 ตาราง `programs` (หลักสูตร)
| ชื่อคอลัมน์ | ชนิดข้อมูล | Constraint | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `PK, AUTO_INCREMENT` | รหัสอ้างอิงหลักสูตร |
| `code` | `VARCHAR(20)` | `NOT NULL, UNIQUE` | รหัสย่อหลักสูตรที่ใช้ในรหัสเอกสาร เช่น `M.D.`, `B.PMD.` |
| `name_th` | `VARCHAR(200)` | `NOT NULL` | ชื่อหลักสูตรภาษาไทย |
| `name_en` | `VARCHAR(200)` | `NULL` | ชื่อหลักสูตรภาษาอังกฤษ |
| `framework_id` | `INT UNSIGNED` | `FK -> accreditation_frameworks.id` | กรอบเกณฑ์อ้างอิงหลักของหลักสูตร (`M.D.` -> `WFME`, `B.PMD.` -> `AUN`) |
| `is_active` | `TINYINT(1)` | `NOT NULL DEFAULT 1` | สถานะการใช้งาน |

### 3.5 ตาราง `document_levels` (ระดับเอกสารคุณภาพ)
| ชื่อคอลัมน์ | ชนิดข้อมูล | Constraint | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `PK, AUTO_INCREMENT` | รหัสอ้างอิงระดับเอกสาร |
| `code` | `VARCHAR(10)` | `NOT NULL, UNIQUE` | รหัสย่อระดับเอกสาร (`QM`, `SP`, `WI`, `FM`, `SD`) |
| `name_th` | `VARCHAR(100)` | `NOT NULL` | ชื่อระดับเอกสารภาษาไทย |
| `name_en` | `VARCHAR(100)` | `NULL` | ชื่อระดับเอกสารภาษาอังกฤษ |
| `level_order` | `TINYINT UNSIGNED` | `NOT NULL` | ลำดับชั้นความสำคัญ (`1`=QM, `2`=SP, `3`=WI, `4`=FM, `5`=SD) |
| `is_active` | `TINYINT(1)` | `NOT NULL DEFAULT 1` | สถานะการใช้งาน |

### 3.6 ตาราง `qa_criteria` (โครงสร้างเกณฑ์ WFME / AUN แบบลำดับชั้น)
| ชื่อคอลัมน์ | ชนิดข้อมูล | Constraint | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| `id` | `INT UNSIGNED` | `PK, AUTO_INCREMENT` | รหัสอ้างอิงข้อเกณฑ์ |
| `framework_id` | `INT UNSIGNED` | `FK -> accreditation_frameworks.id` | อ้างอิงกรอบเกณฑ์ (`WFME` หรือ `AUN`) |
| `parent_id` | `INT UNSIGNED` | `FK -> qa_criteria.id, NULL` | อ้างอิงหัวข้อแม่ (`NULL` หากเป็นหมวดใหญ่สุดระดับที่ 1) |
| `code` | `VARCHAR(30)` | `NOT NULL` | รหัสเกณฑ์ที่ใช้ออกรหัสเอกสาร เช่น `W1`, `W1.1`, `W1.1.1`, `A1.1-1` |
| `section_number` | `VARCHAR(20)` | `NOT NULL` | เลขหัวข้อตามเกณฑ์จริง เช่น `1`, `1.1`, `1.1.1`, `1.1-1` |
| `level_depth` | `TINYINT UNSIGNED` | `NOT NULL` | ระดับความลึกของชั้น (`1`=Area, `2`=Sub-area, `3`=Standard) |
| `wfme_standard_type` | `ENUM('NONE','BASIC','QUALITY_DEV')` | `NOT NULL DEFAULT 'NONE'` | ประเภทเกณฑ์ของ WFME (`BASIC`=เกณฑ์พื้นฐาน, `QUALITY_DEV`=เกณฑ์พัฒนา) |
| `title_th` | ` VARCHAR(500)` | `NOT NULL` | ชื่อหัวข้อเกณฑ์ภาษาไทย |
| `title_en` | `VARCHAR(500)` | `NULL` | ชื่อหัวข้อเกณฑ์ภาษาอังกฤษ |
| `description_th` | `TEXT` | `NULL` | คำอธิบายรายละเอียดเกณฑ์หรือแนวทางการประเมิน |
| `is_selectable` | `TINYINT(1)` | `NOT NULL DEFAULT 1` | `1` = นำไปผูกเอกสารได้ (`W1.1.1`), `0` = เป็นเพียงหัวข้อหมวดหมู่ (`W1`, `W1.1`) |
| `sort_order` | `INT UNSIGNED` | `NOT NULL DEFAULT 0` | ลำดับการแสดงผลภายใต้หัวข้อแม่เดียวกัน |
| `is_active` | `TINYINT(1)` | `NOT NULL DEFAULT 1` | สถานะการใช้งาน |

### 3.7 ตาราง `qa_documents` (ตารางจัดเก็บเอกสารคุณภาพ)
| ชื่อคอลัมน์ | ชนิดข้อมูล | Constraint | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK, AUTO_INCREMENT` | รหัสอ้างอิงเอกสารคุณภาพ |
| `document_code` | `VARCHAR(100)` | `NOT NULL, UNIQUE` | รหัสเอกสารเต็ม เช่น `EDU-ADM-M.D.-QM-W1.1.1-000` |
| `sequence_no` | `VARCHAR(10)` | `NULL DEFAULT '000'` | เลขลำดับเอกสารท้ายรหัส (เว้นไว้ให้กำหนดลอจิกภายหลัง) |
| `title` | `VARCHAR(500)` | `NOT NULL` | ชื่อเรื่องเอกสารคุณภาพ |
| `description` | `TEXT` | `NULL` | รายละเอียดหรือสรุปสาระสำคัญของเอกสาร |
| `department_id` | `INT UNSIGNED` | `FK -> departments.id, NOT NULL` | หน่วยงานหลักเจ้าของเอกสาร (`EDU`, `MGT`) |
| `sub_department_id` | `INT UNSIGNED` | `FK -> sub_departments.id, NULL` | งานย่อย (`ADM`, `TCH`, ...) เป็น `NULL` ได้กรณีเป็น `MGT` |
| `program_id` | `INT UNSIGNED` | `FK -> programs.id, NOT NULL` | หลักสูตรของเอกสาร (`M.D.`, `B.PMD.`) |
| `document_level_id` | `INT UNSIGNED` | `FK -> document_levels.id, NOT NULL` | ระดับเอกสารคุณภาพ (`QM`, `SP`, `WI`, `FM`, `SD`) |
| `criterion_id` | `INT UNSIGNED` | `FK -> qa_criteria.id, NOT NULL` | เกณฑ์การประเมินที่ผูกกับเอกสาร (1 เอกสาร ผูกได้ 1 เกณฑ์) |
| `current_version` | `VARCHAR(20)` | `NOT NULL DEFAULT '1.0'` | เลขเวอร์ชันหรือครั้งที่แก้ไขปัจจุบัน |
| `effective_date` | `DATE` | `NULL` | วันที่เริ่มบังคับใช้เอกสาร |
| `review_date` | `DATE` | `NULL` | วันที่ครบกำหนดทบทวนเอกสาร |
| `file_path` | `VARCHAR(1000)` | `NULL` | พาธหรือ URL สำหรับดาวน์โหลดไฟล์เอกสารปัจจุบัน |
| `file_name` | `VARCHAR(255)` | `NULL` | ชื่อไฟล์ต้นฉบับที่อัปโหลด |
| `file_mime_type` | `VARCHAR(100)` | `NULL` | ชนิดไฟล์ เช่น `application/pdf` |
| `file_size_bytes` | `BIGINT UNSIGNED` | `NULL` | ขนาดไฟล์ (Bytes) |
| `status` | `ENUM('DRAFT','PUBLISHED','ARCHIVED')` | `NOT NULL DEFAULT 'DRAFT'` | สถานะของเอกสารในระบบ |
| `created_by` | `VARCHAR(100)` | `NULL` | รหัสหรือชื่อผู้สร้างเอกสาร |
| `updated_by` | `VARCHAR(100)` | `NULL` | รหัสหรือชื่อผู้แก้ไขล่าสุด |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | วันเวลาที่สร้างเอกสาร |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | วันเวลาที่แก้ไขล่าสุด |

## 4. คำสั่ง SQL สำหรับสร้างตารางและข้อมูลตั้งต้น (MySQL DDL & Seed Script)

สามารถคัดลอกสคริปต์ SQL ด้านล่างไปรันใน MySQL (เช่นผ่าน DBeaver, phpMyAdmin, หรือ MySQL Workbench) เพื่อสร้างฐานข้อมูลและข้อมูลตั้งต้นได้ทันที:

```sql
-- สร้างฐานข้อมูล (ปรับชื่อได้ตามต้องการ)
CREATE DATABASE IF NOT EXISTS `e_smart_qa`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `e_smart_qa`;

-- ==========================================
-- 1. ตารางหน่วยงานหลัก (departments)
-- ==========================================
CREATE TABLE `departments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL COMMENT 'รหัสหน่วยงาน เช่น EDU, MGT',
  `name_th` VARCHAR(150) NOT NULL COMMENT 'ชื่อหน่วยงานภาษาไทย',
  `name_en` VARCHAR(150) DEFAULT NULL COMMENT 'ชื่อหน่วยงานภาษาอังกฤษ',
  `has_sub_department` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=มีงานย่อย, 0=ไม่มีงานย่อย',
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_departments_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 2. ตารางงานย่อยภายใต้หน่วยงาน (sub_departments)
-- ==========================================
CREATE TABLE `sub_departments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `department_id` INT UNSIGNED NOT NULL COMMENT 'FK อ้างอิงตาราง departments',
  `code` VARCHAR(20) NOT NULL COMMENT 'รหัสงานย่อย เช่น ADM, TCH, ASM, STU',
  `name_th` VARCHAR(150) NOT NULL COMMENT 'ชื่องานย่อยภาษาไทย',
  `name_en` VARCHAR(150) DEFAULT NULL COMMENT 'ชื่องานย่อยภาษาอังกฤษ',
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sub_dept_code_per_dept` (`department_id`, `code`),
  CONSTRAINT `fk_sub_departments_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 3. ตารางกรอบเกณฑ์การประเมิน (accreditation_frameworks)
-- ==========================================
CREATE TABLE `accreditation_frameworks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL COMMENT 'รหัสกรอบเกณฑ์ เช่น WFME, AUN',
  `prefix_char` VARCHAR(5) NOT NULL COMMENT 'ตัวอักษรนำหน้าเกณฑ์ เช่น W, A',
  `name_th` VARCHAR(150) NOT NULL,
  `name_en` VARCHAR(150) DEFAULT NULL,
  `version_year` VARCHAR(20) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_frameworks_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 4. ตารางหลักสูตร (programs)
-- ==========================================
CREATE TABLE `programs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL COMMENT 'รหัสหลักสูตร เช่น M.D., B.PMD.',
  `name_th` VARCHAR(200) NOT NULL,
  `name_en` VARCHAR(200) DEFAULT NULL,
  `framework_id` INT UNSIGNED NOT NULL COMMENT 'FK ผูกเกณฑ์อ้างอิงหลักของหลักสูตร',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_programs_code` (`code`),
  KEY `idx_programs_framework` (`framework_id`),
  CONSTRAINT `fk_programs_framework`
    FOREIGN KEY (`framework_id`) REFERENCES `accreditation_frameworks` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 5. ตารางระดับเอกสารคุณภาพ (document_levels)
-- ==========================================
CREATE TABLE `document_levels` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(10) NOT NULL COMMENT 'รหัสระดับเอกสาร เช่น QM, SP, WI, FM, SD',
  `name_th` VARCHAR(100) NOT NULL,
  `name_en` VARCHAR(100) DEFAULT NULL,
  `level_order` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'ลำดับชั้นเอกสาร 1-5',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_document_levels_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 6. ตารางเกณฑ์การประเมินแบบลำดับชั้น (qa_criteria)
-- ==========================================
CREATE TABLE `qa_criteria` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `framework_id` INT UNSIGNED NOT NULL COMMENT 'FK อ้างอิงกรอบเกณฑ์ WFME หรือ AUN',
  `parent_id` INT UNSIGNED DEFAULT NULL COMMENT 'FK อ้างอิงหัวข้อแม่ในตารางเดียวกัน (NULL = หมวดหลัก)',
  `code` VARCHAR(30) NOT NULL COMMENT 'รหัสเกณฑ์ที่ใช้ในรหัสเอกสาร เช่น W1.1.1, A1.1-1',
  `section_number` VARCHAR(20) NOT NULL COMMENT 'เลขข้อเกณฑ์ เช่น 1, 1.1, 1.1.1',
  `level_depth` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=Area/หมวดหลัก, 2=Sub-area/หมวดย่อย, 3=Standard/เกณฑ์ย่อย',
  `wfme_standard_type` ENUM('NONE', 'BASIC', 'QUALITY_DEV') NOT NULL DEFAULT 'NONE' COMMENT 'ประเภทมาตรฐาน WFME',
  `title_th` VARCHAR(500) NOT NULL COMMENT 'ชื่อหัวข้อเกณฑ์ภาษาไทย',
  `title_en` VARCHAR(500) DEFAULT NULL COMMENT 'ชื่อหัวข้อเกณฑ์ภาษาอังกฤษ',
  `description_th` TEXT DEFAULT NULL COMMENT 'คำอธิบายรายละเอียดเกณฑ์',
  `is_selectable` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=เลือกผูกกับเอกสารได้, 0=เป็นหัวข้อกลุ่มเท่านั้น',
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_criteria_framework_code` (`framework_id`, `code`),
  KEY `idx_criteria_parent` (`parent_id`),
  KEY `idx_criteria_framework_level` (`framework_id`, `level_depth`, `sort_order`),
  CONSTRAINT `fk_criteria_framework`
    FOREIGN KEY (`framework_id`) REFERENCES `accreditation_frameworks` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_criteria_parent`
    FOREIGN KEY (`parent_id`) REFERENCES `qa_criteria` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 7. ตารางจัดเก็บเอกสารคุณภาพ (qa_documents)
-- ==========================================
CREATE TABLE `qa_documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `document_code` VARCHAR(100) NOT NULL COMMENT 'รหัสเอกสารเต็ม เช่น EDU-ADM-M.D.-QM-W1.1.1-000',
  `sequence_no` VARCHAR(10) DEFAULT '000' COMMENT 'ลำดับเอกสาร (เว้นลอจิกการรันไว้กำหนดภายหลัง)',
  `title` VARCHAR(500) NOT NULL COMMENT 'ชื่อเอกสารคุณภาพ',
  `description` TEXT DEFAULT NULL COMMENT 'รายละเอียดเอกสาร',
  `department_id` INT UNSIGNED NOT NULL COMMENT 'FK หน่วยงานหลัก (EDU, MGT)',
  `sub_department_id` INT UNSIGNED DEFAULT NULL COMMENT 'FK งานย่อย (NULL ได้สำหรับ MGT)',
  `program_id` INT UNSIGNED NOT NULL COMMENT 'FK หลักสูตร (M.D., B.PMD.)',
  `document_level_id` INT UNSIGNED NOT NULL COMMENT 'FK ระดับเอกสาร (QM, SP, WI, FM, SD)',
  `criterion_id` INT UNSIGNED NOT NULL COMMENT 'FK เกณฑ์การประเมิน (1 เอกสาร : 1 เกณฑ์)',
  `current_version` VARCHAR(20) NOT NULL DEFAULT '1.0' COMMENT 'เวอร์ชันของเอกสาร',
  `effective_date` DATE DEFAULT NULL COMMENT 'วันที่บังคับใช้',
  `review_date` DATE DEFAULT NULL COMMENT 'วันที่ทบทวนเอกสาร',
  `file_path` VARCHAR(1000) DEFAULT NULL COMMENT 'พาธเก็บไฟล์หรือ URL',
  `file_name` VARCHAR(255) DEFAULT NULL COMMENT 'ชื่อไฟล์ต้นฉบับ',
  `file_mime_type` VARCHAR(100) DEFAULT NULL COMMENT 'ประเภทไฟล์ เช่น application/pdf',
  `file_size_bytes` BIGINT UNSIGNED DEFAULT NULL COMMENT 'ขนาดไฟล์ (Bytes)',
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_qa_documents_code` (`document_code`),
  KEY `idx_docs_dept_subdept` (`department_id`, `sub_department_id`),
  KEY `idx_docs_program` (`program_id`),
  KEY `idx_docs_level` (`document_level_id`),
  KEY `idx_docs_criterion` (`criterion_id`),
  KEY `idx_docs_status` (`status`),
  CONSTRAINT `fk_docs_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_docs_sub_department`
    FOREIGN KEY (`sub_department_id`) REFERENCES `sub_departments` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_docs_program`
    FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_docs_document_level`
    FOREIGN KEY (`document_level_id`) REFERENCES `document_levels` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_docs_criterion`
    FOREIGN KEY (`criterion_id`) REFERENCES `qa_criteria` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 8. ตารางประวัติการแก้ไขเอกสาร (qa_document_revisions)
-- ==========================================
CREATE TABLE `qa_document_revisions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `document_id` BIGINT UNSIGNED NOT NULL COMMENT 'FK อ้างอิงตาราง qa_documents',
  `version_label` VARCHAR(20) NOT NULL COMMENT 'เลขเวอร์ชัน เช่น 1.0, 1.1, 2.0',
  `change_note` TEXT DEFAULT NULL COMMENT 'บันทึกการเปลี่ยนแปลง',
  `file_path` VARCHAR(1000) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_mime_type` VARCHAR(100) DEFAULT NULL,
  `file_size_bytes` BIGINT UNSIGNED DEFAULT NULL,
  `uploaded_by` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_revisions_document` (`document_id`),
  CONSTRAINT `fk_revisions_document`
    FOREIGN KEY (`document_id`) REFERENCES `qa_documents` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- ข้อมูลตั้งต้น (SEED MASTER DATA)
-- ==========================================

-- 1. ข้อมูลหน่วยงานหลัก
INSERT INTO `departments` (`id`, `code`, `name_th`, `name_en`, `has_sub_department`, `sort_order`) VALUES
(1, 'EDU', 'หน่วยงานการศึกษา', 'Education Department', 1, 1),
(2, 'MGT', 'หน่วยงานบริหาร', 'Management Department', 0, 2);

-- 2. ข้อมูลงานย่อยภายใต้หน่วยงานการศึกษา (EDU)
INSERT INTO `sub_departments` (`id`, `department_id`, `code`, `name_th`, `name_en`, `sort_order`) VALUES
(1, 1, 'ADM', 'งานรับเข้า', 'Admissions Unit', 1),
(2, 1, 'TCH', 'งานจัดการเรียนการสอน', 'Teaching and Learning Unit', 2),
(3, 1, 'ASM', 'งานวัดและประเมินผล', 'Assessment and Evaluation Unit', 3),
(4, 1, 'STU', 'งานนิสิต', 'Student Affairs Unit', 4);

-- 3. ข้อมูลกรอบเกณฑ์การประเมิน
INSERT INTO `accreditation_frameworks` (`id`, `code`, `prefix_char`, `name_th`, `name_en`, `version_year`) VALUES
(1, 'WFME', 'W', 'เกณฑ์มาตรฐานสากลแพทยศาสตรศึกษา (WFME)', 'World Federation for Medical Education', '2020'),
(2, 'AUN', 'A', 'เกณฑ์เครือข่ายการประกันคุณภาพมหาวิทยาลัยอาเซียน (AUN-QA)', 'ASEAN University Network - Quality Assurance', '4.0');

-- 4. ข้อมูลหลักสูตร (ผูกกับกรอบเกณฑ์)
INSERT INTO `programs` (`id`, `code`, `name_th`, `name_en`, `framework_id`) VALUES
(1, 'M.D.', 'หลักสูตรแพทยศาสตรบัณฑิต', 'Doctor of Medicine Program', 1),
(2, 'B.PMD.', 'หลักสูตรฉุกเฉินการแพทยบัณฑิต', 'Bachelor of Paramedicine Program', 2);

-- 5. ข้อมูลระดับเอกสารคุณภาพ
INSERT INTO `document_levels` (`id`, `code`, `name_th`, `name_en`, `level_order`) VALUES
(1, 'QM', 'นโยบายคุณภาพ', 'Quality Manual / Policy', 1),
(2, 'SP', 'ระเบียบปฏิบัติ', 'System Procedure', 2),
(3, 'WI', 'แนวทางปฏิบัติ', 'Work Instruction', 3),
(4, 'FM', 'แบบฟอร์ม', 'Form', 4),
(5, 'SD', 'เอกสารสนับสนุน', 'Supporting Document', 5);

-- 6. ตัวอย่างโครงสร้างเกณฑ์ WFME แบบลำดับชั้น (Area -> Sub-area -> Standard)
INSERT INTO `qa_criteria`
  (`id`, `framework_id`, `parent_id`, `code`, `section_number`, `level_depth`, `wfme_standard_type`, `title_th`, `title_en`, `is_selectable`, `sort_order`)
VALUES
  -- ระดับที่ 1: Area 1 (เป็นหัวข้อหลัก เลือกผูกเอกสารไม่ได้ -> is_selectable = 0)
  (1, 1, NULL, 'W1', '1', 1, 'NONE', 'พันธกิจและผลลัพธ์การเรียนรู้ (Mission and Outcomes)', 'Mission and Outcomes', 0, 1),
  -- ระดับที่ 2: Sub-area 1.1 (เป็นหมวดย่อย เลือกผูกเอกสารไม่ได้ -> is_selectable = 0)
  (2, 1, 1, 'W1.1', '1.1', 2, 'NONE', 'การกำหนดพันธกิจ (Stated Mission)', 'Stated Mission', 0, 1),
  -- ระดับที่ 3: Standard 1.1.1 และ 1.1.2 (เป็นข้อเกณฑ์ย่อย เลือกผูกเอกสารได้ -> is_selectable = 1)
  (3, 1, 2, 'W1.1.1', '1.1.1', 3, 'BASIC', 'การกำหนดและประกาศพันธกิจของคณะแพทยศาสตร์', 'Institutional Mission Statement', 1, 1),
  (4, 1, 2, 'W1.1.2', '1.1.2', 3, 'BASIC', 'การมีส่วนร่วมของประชาคมและผู้มีส่วนได้ส่วนเสียในการกำหนดพันธกิจ', 'Stakeholder Participation in Mission Formulation', 1, 2);

-- 7. ตัวอย่างโครงสร้างเกณฑ์ AUN แบบลำดับชั้น
INSERT INTO `qa_criteria`
  (`id`, `framework_id`, `parent_id`, `code`, `section_number`, `level_depth`, `wfme_standard_type`, `title_th`, `title_en`, `is_selectable`, `sort_order`)
VALUES
  (5, 2, NULL, 'A1', '1', 1, 'NONE', 'ผลการเรียนรู้ที่คาดหวัง (Expected Learning Outcomes)', 'Expected Learning Outcomes', 0, 1),
  (6, 2, 5, 'A1.1', '1.1', 2, 'NONE', 'การกำหนดผลการเรียนรู้ที่คาดหวังของหลักสูตร', 'Formulation of Expected Learning Outcomes', 0, 1),
  (7, 2, 6, 'A1.1-1', '1.1-1', 3, 'NONE', 'ผลการเรียนรู้ที่คาดหวังมีความชัดเจนและสอดคล้องกับพันธกิจ', 'Alignment of Expected Learning Outcomes', 1, 1);

-- 8. ตัวอย่างการบันทึกเอกสารคุณภาพตามตัวอย่างรหัสที่กำหนด
INSERT INTO `qa_documents`
  (`document_code`, `sequence_no`, `title`, `department_id`, `sub_department_id`, `program_id`, `document_level_id`, `criterion_id`, `status`)
VALUES
  ('EDU-ADM-M.D.-QM-W1.1.1-000', '000', 'นโยบายคุณภาพการรับเข้าศึกษาหลักสูตรแพทยศาสตรบัณฑิต', 1, 1, 1, 1, 3, 'PUBLISHED'),
  ('EDU-ADM-B.PMD.-QM-A1.1-1-000', '000', 'นโยบายคุณภาพการรับเข้าศึกษาหลักสูตรฉุกเฉินการแพทยบัณฑิต', 1, 1, 2, 1, 7, 'PUBLISHED');
```

## 5. แนวทางการคิวรีและตรวจสอบเงื่อนไขใน Next.js (Application Logic)

### 5.1 การคิวรีโครงสร้างเกณฑ์ WFME แบบลำดับชั้น (Recursive CTE ใน MySQL 8.0+)
เมื่อต้องการดึงต้นไม้เกณฑ์ WFME ทั้งหมดไปแสดงในหน้า Dropdown หรือ Tree View บน Next.js สามารถใช้ `WITH RECURSIVE` ของ MySQL 8.0 เพื่อเรียงลำดับชั้นจาก Area -> Sub-area -> Standard ได้ทันที:

```sql
WITH RECURSIVE criteria_tree AS (
  -- ดึงหมวดหลัก (Level 1) ของ WFME
  SELECT
    id, parent_id, code, section_number, title_th,
    level_depth, is_selectable,
    CAST(LPAD(sort_order, 4, '0') AS CHAR(200)) AS sort_path
  FROM qa_criteria
  WHERE framework_id = 1 AND parent_id IS NULL AND is_active = 1

  UNION ALL

  -- ดึงหมวดย่อยและข้อเกณฑ์ย่อยภายใต้หมวดหลัก
  SELECT
    c.id, c.parent_id, c.code, c.section_number, c.title_th,
    c.level_depth, c.is_selectable,
    CONCAT(ct.sort_path, '-', LPAD(c.sort_order, 4, '0')) AS sort_path
  FROM qa_criteria c
  INNER JOIN criteria_tree ct ON c.parent_id = ct.id
  WHERE c.is_active = 1
)
SELECT * FROM criteria_tree
ORDER BY sort_path ASC;
```

### 5.2 การประกอบรหัสเอกสาร (Document Code Formatter)
ในฝั่ง Next.js API Route หรือ Server Action เมื่อผู้ใช้ส่งข้อมูลฟอร์มสร้างเอกสารเข้ามา ระบบควรตรวจสอบความถูกต้อง (Validation) ดังนี้:
1. **ตรวจสอบชื่องานย่อย (`sub_department_id`):**
   - หาก `department.has_sub_department === true` (เช่น `EDU`) ต้องบังคับให้มี `sub_department_id` และต้องเป็นงานย่อยที่อยู่ภายใต้ `department_id` นั้น
   - หาก `department.has_sub_department === false` (เช่น `MGT`) ให้ตั้งค่า `sub_department_id = null`
2. **ตรวจสอบความตรงกันของหลักสูตรกับเกณฑ์ (`program.framework_id === criterion.framework_id`):**
   - ป้องกันไม่ให้เอกสารของหลักสูตร `M.D.` (`framework_id = 1`) ไปผูกกับเกณฑ์ของ `AUN` (`framework_id = 2`)
   - ตรวจสอบว่า `criterion.is_selectable === 1` เสมอ
3. **การต่อสตริงรหัสเอกสาร (`document_code`):**
   - กรณีมีงานย่อย (`EDU`): `${dept.code}-${subDept.code}-${program.code}-${level.code}-${criterion.code}-${seq}` -> `EDU-ADM-M.D.-QM-W1.1.1-000`
   - กรณีไม่มีงานย่อย (`MGT`): สามารถเลือกประกอบรหัสแบบข้ามส่วนชื่องานย่อย (`MGT-M.D.-QM-W1.1.1-000`) หรือใส่เครื่องหมายขีดคั่นตามข้อตกลงของคณะได้จากข้อมูลชุดเดียวกันโดยไม่ต้องแก้ไขฐานข้อมูล

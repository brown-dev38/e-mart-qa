ALTER TABLE `docs_qa_documents`
  ALTER COLUMN `current_version` SET DEFAULT '000',
  ADD COLUMN `approved_revision_no` SMALLINT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE `docs_qa_document_revisions`
  MODIFY `file_path` VARCHAR(1000) NULL,
  MODIFY `file_name` VARCHAR(255) NULL,
  ADD COLUMN `title` VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `status` ENUM('DRAFT','PENDING','APPROVED') NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN `revision_number` SMALLINT UNSIGNED NULL,
  ADD COLUMN `open_slot` TINYINT UNSIGNED NULL,
  ADD COLUMN `lock_version` INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `submitted_by` VARCHAR(100) NULL,
  ADD COLUMN `submitted_at` TIMESTAMP(0) NULL,
  ADD COLUMN `approved_by` VARCHAR(100) NULL,
  ADD COLUMN `approved_at` TIMESTAMP(0) NULL,
  ADD COLUMN `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Preserve legacy revisions and their labels; old approval actors/dates are unknown.
UPDATE `docs_qa_document_revisions` r JOIN `docs_qa_documents` d ON d.id = r.document_id
SET r.title = d.title, r.description = d.description;

INSERT INTO `docs_qa_document_revisions`
  (`document_id`, `version_label`, `title`, `description`, `file_path`, `file_name`,
   `file_mime_type`, `file_size_bytes`, `uploaded_by`, `status`, `open_slot`, `revision_number`, `change_note`)
SELECT d.id, IF(d.status = 'DRAFT', '000', d.current_version), d.title, d.description,
  d.file_path, d.file_name, d.file_mime_type, d.file_size_bytes, d.created_by,
  IF(d.status = 'DRAFT', 'DRAFT', 'APPROVED'), IF(d.status = 'DRAFT', 1, NULL),
  IF(d.status = 'DRAFT', NULL, 1), 'นำเข้าข้อมูลเดิมก่อนเปิดใช้ขั้นตอนอนุมัติ'
FROM `docs_qa_documents` d
WHERE d.status = 'DRAFT' OR NOT EXISTS (
  SELECT 1 FROM `docs_qa_document_revisions` r
  WHERE r.document_id = d.id AND r.version_label = d.current_version
);

UPDATE `docs_qa_documents` SET approved_revision_no = 1 WHERE status IN ('PUBLISHED', 'ARCHIVED');
UPDATE `docs_qa_documents` SET current_version = '000' WHERE status = 'DRAFT';
ALTER TABLE `docs_qa_document_revisions`
  ALTER COLUMN `title` DROP DEFAULT,
  ALTER COLUMN `status` SET DEFAULT 'DRAFT';

CREATE UNIQUE INDEX `docs_qa_document_revisions_document_id_open_slot_key` ON `docs_qa_document_revisions` (`document_id`, `open_slot`);
CREATE UNIQUE INDEX `docs_qa_document_revisions_document_id_revision_number_key` ON `docs_qa_document_revisions` (`document_id`, `revision_number`);
CREATE INDEX `docs_qa_document_revisions_status_submitted_at_idx` ON `docs_qa_document_revisions` (`status`, `submitted_at`);

CREATE TABLE `docs_qa_review_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `revision_id` BIGINT UNSIGNED NOT NULL,
  `action` VARCHAR(30) NOT NULL,
  `actor_id` VARCHAR(100) NOT NULL,
  `actor_name` VARCHAR(150) NOT NULL,
  `comment` TEXT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `docs_qa_review_events_revision_id_created_at_idx` (`revision_id`, `created_at`),
  CONSTRAINT `docs_qa_review_events_revision_id_fkey` FOREIGN KEY (`revision_id`)
    REFERENCES `docs_qa_document_revisions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

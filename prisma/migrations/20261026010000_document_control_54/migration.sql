-- Preserve existing approved labels. NULL means there has been no approval;
-- zero is now a valid first approved revision number.
ALTER TABLE `docs_qa_documents`
  MODIFY `current_version` VARCHAR(20) NULL,
  MODIFY `approved_revision_no` SMALLINT UNSIGNED NULL,
  ADD COLUMN `storage_location` VARCHAR(1000) NULL,
  ADD COLUMN `registry_version` INTEGER UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE `docs_qa_document_revisions`
  MODIFY `status` ENUM('DRAFT','PENDING','APPROVED','SUPERSEDED','WITHDRAWN') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `change_reason` TEXT NULL,
  ADD COLUMN `approved_name` VARCHAR(150) NULL,
  ADD COLUMN `reviewed_by` VARCHAR(100) NULL,
  ADD COLUMN `reviewed_name` VARCHAR(150) NULL,
  ADD COLUMN `reviewed_at` TIMESTAMP(0) NULL,
  ADD COLUMN `effective_date` DATE NULL,
  ADD COLUMN `superseded_at` TIMESTAMP(0) NULL,
  ADD COLUMN `superseded_by_version` VARCHAR(20) NULL,
  ADD COLUMN `withdrawn_by` VARCHAR(100) NULL,
  ADD COLUMN `withdrawn_name` VARCHAR(150) NULL,
  ADD COLUMN `withdrawn_at` TIMESTAMP(0) NULL,
  ADD COLUMN `withdrawal_reason` TEXT NULL;

ALTER TABLE `docs_qa_submissions`
  ADD COLUMN `change_reason` TEXT NULL,
  ADD COLUMN `reviewer_id` VARCHAR(100) NULL,
  ADD COLUMN `reviewer_name` VARCHAR(150) NULL,
  ADD COLUMN `reviewer_at` TIMESTAMP(0) NULL,
  ADD COLUMN `effective_date` DATE NULL;

UPDATE `docs_qa_documents` d
LEFT JOIN (
  SELECT `document_id`, MAX(`revision_number`) AS latest
  FROM `docs_qa_document_revisions` WHERE `status` = 'APPROVED' GROUP BY `document_id`
) approved ON approved.document_id = d.id
SET d.approved_revision_no = approved.latest,
    d.current_version = CASE WHEN d.status = 'DRAFT' THEN NULL ELSE d.current_version END;

-- Only the current revision has a known effective date in the old schema.
UPDATE `docs_qa_document_revisions` r
JOIN `docs_qa_documents` d ON d.id = r.document_id AND d.current_version = r.version_label
SET r.effective_date = d.effective_date
WHERE r.status = 'APPROVED';

UPDATE `docs_qa_document_revisions` r
JOIN `docs_qa_documents` d ON d.id = r.document_id
SET r.status = 'SUPERSEDED', r.superseded_by_version = d.current_version
WHERE r.status = 'APPROVED' AND d.current_version IS NOT NULL AND r.version_label <> d.current_version;

CREATE TABLE `docs_qa_registry_changes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `document_id` BIGINT UNSIGNED NOT NULL,
  `previous_location` VARCHAR(1000) NULL,
  `storage_location` VARCHAR(1000) NULL,
  `reason` VARCHAR(2000) NOT NULL,
  `actor_id` VARCHAR(100) NOT NULL,
  `actor_name` VARCHAR(150) NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `docs_qa_registry_changes_document_id_created_at_idx` (`document_id`, `created_at`),
  CONSTRAINT `docs_qa_registry_changes_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `docs_qa_documents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

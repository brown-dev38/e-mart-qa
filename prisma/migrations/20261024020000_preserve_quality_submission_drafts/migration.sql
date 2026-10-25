CREATE TABLE `docs_qa_submissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `revision_id` BIGINT UNSIGNED NOT NULL,
  `round_no` INT UNSIGNED NOT NULL,
  `target_revision_no` SMALLINT UNSIGNED NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `description` TEXT NULL,
  `change_note` TEXT NULL,
  `file_path` VARCHAR(1000) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_mime_type` VARCHAR(100) NULL,
  `file_size_bytes` BIGINT UNSIGNED NOT NULL,
  `file_sha256` CHAR(64) NULL,
  `submitted_by` VARCHAR(100) NOT NULL,
  `submitted_name` VARCHAR(150) NOT NULL,
  `submitted_at` TIMESTAMP(3) NOT NULL,
  `captured_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `source` VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
  `status` ENUM('PENDING','RETURNED','APPROVED') NOT NULL DEFAULT 'PENDING',
  `reviewed_by` VARCHAR(100) NULL,
  `reviewed_name` VARCHAR(150) NULL,
  `reviewed_at` TIMESTAMP(3) NULL,
  `review_comment` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `docs_qa_submissions_revision_id_round_no_key` (`revision_id`, `round_no`),
  INDEX `docs_qa_submissions_status_submitted_at_idx` (`status`, `submitted_at`),
  CONSTRAINT `docs_qa_submissions_revision_id_fkey` FOREIGN KEY (`revision_id`)
    REFERENCES `docs_qa_document_revisions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `docs_qa_review_events` ADD COLUMN `submission_id` BIGINT UNSIGNED NULL;
CREATE INDEX `docs_qa_review_events_submission_id_idx` ON `docs_qa_review_events` (`submission_id`);
ALTER TABLE `docs_qa_review_events` ADD CONSTRAINT `docs_qa_review_events_submission_id_fkey`
  FOREIGN KEY (`submission_id`) REFERENCES `docs_qa_submissions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Only the latest pending payload is still known. Never invent snapshots for past reviews.
INSERT INTO `docs_qa_submissions` (`revision_id`, `round_no`, `target_revision_no`, `title`, `description`, `change_note`,
  `file_path`, `file_name`, `file_mime_type`, `file_size_bytes`, `submitted_by`, `submitted_name`, `submitted_at`, `source`)
SELECT r.id, GREATEST((SELECT COUNT(*) FROM docs_qa_review_events e WHERE e.revision_id = r.id AND e.action = 'SUBMIT'), 1),
  d.approved_revision_no + 1, r.title, r.description, r.change_note,
  r.file_path, r.file_name, r.file_mime_type, COALESCE(r.file_size_bytes, 0),
  COALESCE(r.submitted_by, r.uploaded_by, 'unknown'),
  COALESCE((SELECT e.actor_name FROM docs_qa_review_events e WHERE e.revision_id = r.id AND e.action = 'SUBMIT' ORDER BY e.id DESC LIMIT 1), u.username, 'ไม่ทราบบัญชี'),
  COALESCE(r.submitted_at, r.created_at), 'LEGACY_PENDING'
FROM docs_qa_document_revisions r
JOIN docs_qa_documents d ON d.id = r.document_id
LEFT JOIN users u ON u.id = CAST(r.submitted_by AS UNSIGNED)
WHERE r.status = 'PENDING' AND r.open_slot = 1 AND r.file_path IS NOT NULL AND r.file_name IS NOT NULL;

UPDATE docs_qa_review_events e
JOIN (SELECT revision_id, MAX(id) AS event_id FROM (SELECT id, revision_id FROM docs_qa_review_events WHERE action = 'SUBMIT') old_events GROUP BY revision_id) last_event ON last_event.event_id = e.id
JOIN docs_qa_submissions s ON s.revision_id = e.revision_id AND s.source = 'LEGACY_PENDING'
SET e.submission_id = s.id;

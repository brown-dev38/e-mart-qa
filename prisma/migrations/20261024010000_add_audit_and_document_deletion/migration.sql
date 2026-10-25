ALTER TABLE `docs_qa_documents`
  ADD COLUMN `deleted_at` TIMESTAMP(3) NULL,
  ADD COLUMN `deleted_by` VARCHAR(100) NULL,
  ADD COLUMN `deletion_reason` VARCHAR(1000) NULL;
CREATE INDEX `docs_qa_documents_deleted_at_idx` ON `docs_qa_documents` (`deleted_at`);

-- Audit records intentionally have no FK: deleting an entity or user must not erase history.
CREATE TABLE `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_id` VARCHAR(100) NULL,
  `actor_name` VARCHAR(150) NOT NULL,
  `action` VARCHAR(30) NOT NULL,
  `entity_type` VARCHAR(30) NOT NULL,
  `entity_id` VARCHAR(100) NULL,
  `entity_label` VARCHAR(500) NULL,
  `outcome` VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  `summary` VARCHAR(1000) NOT NULL,
  `details` JSON NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `audit_logs_created_at_id_idx` (`created_at`, `id`),
  INDEX `audit_logs_actor_id_created_at_idx` (`actor_id`, `created_at`),
  INDEX `audit_logs_entity_type_entity_id_idx` (`entity_type`, `entity_id`),
  INDEX `audit_logs_action_outcome_idx` (`action`, `outcome`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `audit_logs` (`actor_id`, `actor_name`, `action`, `entity_type`, `entity_id`, `entity_label`, `summary`, `details`, `created_at`)
SELECT e.actor_id, e.actor_name, IF(e.action = 'CREATE', 'REVISION_CREATE', e.action),
  'QUALITY_DOCUMENT', CAST(d.id AS CHAR), d.document_code,
  LEFT(CONCAT(e.action, ': ', r.title), 1000),
  JSON_OBJECT('revisionId', CAST(r.id AS CHAR), 'version', r.version_label,
    'comment', e.comment, 'source', 'review_history'), e.created_at
FROM docs_qa_review_events e
JOIN docs_qa_document_revisions r ON r.id = e.revision_id
JOIN docs_qa_documents d ON d.id = r.document_id;

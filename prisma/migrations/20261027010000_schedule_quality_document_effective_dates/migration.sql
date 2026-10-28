ALTER TABLE `docs_qa_document_revisions`
ADD COLUMN `auto_publish` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `qa_revision_auto_effective_idx`
ON `docs_qa_document_revisions` (`auto_publish`, `status`, `effective_date`);

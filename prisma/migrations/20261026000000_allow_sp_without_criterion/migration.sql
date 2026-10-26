-- System Procedure documents do not require an assessment criterion.
ALTER TABLE `docs_qa_documents` MODIFY `criterion_id` INTEGER UNSIGNED NULL;

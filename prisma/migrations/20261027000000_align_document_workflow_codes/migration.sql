-- Keep the old values valid until existing rows have been converted.
ALTER TABLE `docs_sub_departments`
MODIFY COLUMN `document_workflow` ENUM('QA', 'CM', 'TCH', 'ASM', 'ADM', 'QAS', 'CUR', 'STU') NULL;

UPDATE `docs_sub_departments`
SET `document_workflow` = CASE
  WHEN `document_workflow` = 'QA' THEN 'QAS'
  WHEN `document_workflow` = 'CM' THEN 'CUR'
  WHEN `document_workflow` IS NULL AND `code` = 'STU' THEN 'STU'
  ELSE `document_workflow`
END
WHERE `document_workflow` IN ('QA', 'CM')
   OR (`document_workflow` IS NULL AND `code` = 'STU');

ALTER TABLE `docs_sub_departments`
MODIFY COLUMN `document_workflow` ENUM('QAS', 'CUR', 'TCH', 'ASM', 'ADM', 'STU') NULL;

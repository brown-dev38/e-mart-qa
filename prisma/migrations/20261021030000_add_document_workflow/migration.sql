ALTER TABLE `docs_sub_departments`
ADD COLUMN `document_workflow` ENUM('QA', 'CM', 'TCH', 'ASM', 'ADM') NULL;

-- Initialize existing work types once; future code/name edits preserve the workflow.
UPDATE `docs_sub_departments`
SET `document_workflow` = CASE
  WHEN `code` = 'QA' OR `name_th` = 'งานประกันคุณภาพ' THEN 'QA'
  WHEN `code` IN ('CM', 'CMU') OR `name_th` = 'งานบริหารหลักสูตร' THEN 'CM'
  WHEN `code` = 'TCH' OR `name_th` IN ('งานจัดการเรียนการสอน', 'งานการจัดการเรียนการสอน') THEN 'TCH'
  WHEN `code` = 'ASM' OR `name_th` = 'งานวัดและประเมินผล' THEN 'ASM'
  WHEN `code` = 'ADM' OR `name_th` = 'งานรับเข้า' THEN 'ADM'
  ELSE NULL
END;

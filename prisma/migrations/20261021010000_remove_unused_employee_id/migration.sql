-- Remove unused employee_id columns from the core lookup tables.
-- User assignments continue to reference each table's primary key (id).

ALTER TABLE `departments` DROP COLUMN `employee_id`;
ALTER TABLE `positions` DROP COLUMN `employee_id`;
ALTER TABLE `role` DROP COLUMN `employee_id`;

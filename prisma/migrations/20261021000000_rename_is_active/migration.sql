-- Rename isActive -> is_active (non-destructive) on the core user tables.

ALTER TABLE `users` RENAME COLUMN `isActive` TO `is_active`;
ALTER TABLE `role` RENAME COLUMN `isActive` TO `is_active`;
ALTER TABLE `positions` RENAME COLUMN `isActive` TO `is_active`;
ALTER TABLE `departments` RENAME COLUMN `isActive` TO `is_active`;
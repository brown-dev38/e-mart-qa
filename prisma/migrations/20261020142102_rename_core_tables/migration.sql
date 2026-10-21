-- Rename core tables without losing data (foreign keys and indexes follow automatically)
RENAME TABLE `department` TO `departments`, `position` TO `positions`;

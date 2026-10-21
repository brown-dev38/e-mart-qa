-- CreateTable
CREATE TABLE `docs_departments` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name_th` VARCHAR(150) NOT NULL,
    `name_en` VARCHAR(150) NULL,
    `has_sub_department` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `docs_departments_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_sub_departments` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `department_id` INTEGER UNSIGNED NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name_th` VARCHAR(150) NOT NULL,
    `name_en` VARCHAR(150) NULL,
    `sort_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `docs_sub_departments_department_id_code_key`(`department_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_accreditation_frameworks` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `prefix_char` VARCHAR(5) NOT NULL,
    `name_th` VARCHAR(150) NOT NULL,
    `name_en` VARCHAR(150) NULL,
    `version_year` VARCHAR(20) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `docs_accreditation_frameworks_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_programs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name_th` VARCHAR(200) NOT NULL,
    `name_en` VARCHAR(200) NULL,
    `framework_id` INTEGER UNSIGNED NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `docs_programs_code_key`(`code`),
    INDEX `docs_programs_framework_id_idx`(`framework_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_document_levels` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(10) NOT NULL,
    `name_th` VARCHAR(100) NOT NULL,
    `name_en` VARCHAR(100) NULL,
    `level_order` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `docs_document_levels_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_qa_criteria` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `framework_id` INTEGER UNSIGNED NOT NULL,
    `parent_id` INTEGER UNSIGNED NULL,
    `code` VARCHAR(30) NOT NULL,
    `section_number` VARCHAR(20) NOT NULL,
    `level_depth` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `wfme_standard_type` ENUM('NONE', 'BASIC', 'QUALITY_DEV') NOT NULL DEFAULT 'NONE',
    `title_th` VARCHAR(500) NOT NULL,
    `title_en` VARCHAR(500) NULL,
    `description_th` TEXT NULL,
    `is_selectable` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `docs_qa_criteria_parent_id_idx`(`parent_id`),
    INDEX `docs_qa_criteria_framework_id_level_depth_sort_order_idx`(`framework_id`, `level_depth`, `sort_order`),
    UNIQUE INDEX `docs_qa_criteria_framework_id_code_key`(`framework_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_qa_documents` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `document_code` VARCHAR(100) NOT NULL,
    `sequence_no` VARCHAR(10) NULL DEFAULT '000',
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `department_id` INTEGER UNSIGNED NOT NULL,
    `sub_department_id` INTEGER UNSIGNED NULL,
    `program_id` INTEGER UNSIGNED NOT NULL,
    `document_level_id` INTEGER UNSIGNED NOT NULL,
    `criterion_id` INTEGER UNSIGNED NOT NULL,
    `current_version` VARCHAR(20) NOT NULL DEFAULT '1.0',
    `effective_date` DATE NULL,
    `review_date` DATE NULL,
    `file_path` VARCHAR(1000) NULL,
    `file_name` VARCHAR(255) NULL,
    `file_mime_type` VARCHAR(100) NULL,
    `file_size_bytes` BIGINT UNSIGNED NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `created_by` VARCHAR(100) NULL,
    `updated_by` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `docs_qa_documents_document_code_key`(`document_code`),
    INDEX `docs_qa_documents_department_id_sub_department_id_idx`(`department_id`, `sub_department_id`),
    INDEX `docs_qa_documents_program_id_idx`(`program_id`),
    INDEX `docs_qa_documents_document_level_id_idx`(`document_level_id`),
    INDEX `docs_qa_documents_criterion_id_idx`(`criterion_id`),
    INDEX `docs_qa_documents_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_qa_document_revisions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `document_id` BIGINT UNSIGNED NOT NULL,
    `version_label` VARCHAR(20) NOT NULL,
    `change_note` TEXT NULL,
    `file_path` VARCHAR(1000) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_mime_type` VARCHAR(100) NULL,
    `file_size_bytes` BIGINT UNSIGNED NULL,
    `uploaded_by` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `docs_qa_document_revisions_document_id_idx`(`document_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `docs_sub_departments` ADD CONSTRAINT `docs_sub_departments_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `docs_departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_programs` ADD CONSTRAINT `docs_programs_framework_id_fkey` FOREIGN KEY (`framework_id`) REFERENCES `docs_accreditation_frameworks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_qa_criteria` ADD CONSTRAINT `docs_qa_criteria_framework_id_fkey` FOREIGN KEY (`framework_id`) REFERENCES `docs_accreditation_frameworks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_qa_criteria` ADD CONSTRAINT `docs_qa_criteria_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `docs_qa_criteria`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_qa_documents` ADD CONSTRAINT `docs_qa_documents_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `docs_departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_qa_documents` ADD CONSTRAINT `docs_qa_documents_sub_department_id_fkey` FOREIGN KEY (`sub_department_id`) REFERENCES `docs_sub_departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_qa_documents` ADD CONSTRAINT `docs_qa_documents_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `docs_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_qa_documents` ADD CONSTRAINT `docs_qa_documents_document_level_id_fkey` FOREIGN KEY (`document_level_id`) REFERENCES `docs_document_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_qa_documents` ADD CONSTRAINT `docs_qa_documents_criterion_id_fkey` FOREIGN KEY (`criterion_id`) REFERENCES `docs_qa_criteria`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_qa_document_revisions` ADD CONSTRAINT `docs_qa_document_revisions_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `docs_qa_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

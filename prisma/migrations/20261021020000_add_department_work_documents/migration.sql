-- CreateTable
CREATE TABLE `docs_academic_years` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `year` SMALLINT UNSIGNED NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `docs_academic_years_year_key`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_semesters` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name_th` VARCHAR(100) NOT NULL,
    `sort_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `docs_semesters_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_study_years` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `year` TINYINT UNSIGNED NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `docs_study_years_year_key`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_curriculum_versions` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `program_id` INTEGER UNSIGNED NOT NULL,
    `year` SMALLINT UNSIGNED NOT NULL,
    `is_initial` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `docs_curriculum_versions_program_id_year_key`(`program_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_courses` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `program_id` INTEGER UNSIGNED NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name_th` VARCHAR(200) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `docs_courses_program_id_code_key`(`program_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_course_offerings` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `course_id` INTEGER UNSIGNED NOT NULL,
    `academic_year_id` INTEGER UNSIGNED NOT NULL,
    `semester_id` INTEGER UNSIGNED NOT NULL,
    `study_year_id` INTEGER UNSIGNED NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `docs_course_offerings_academic_year_id_semester_id_study_yea_idx`(`academic_year_id`, `semester_id`, `study_year_id`),
    UNIQUE INDEX `docs_course_offerings_course_id_academic_year_id_semester_id_key`(`course_id`, `academic_year_id`, `semester_id`, `study_year_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docs_work_documents` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `department_id` INTEGER UNSIGNED NOT NULL,
    `sub_department_id` INTEGER UNSIGNED NOT NULL,
    `program_id` INTEGER UNSIGNED NOT NULL,
    `academic_year_id` INTEGER UNSIGNED NULL,
    `curriculum_version_id` INTEGER UNSIGNED NULL,
    `course_offering_id` INTEGER UNSIGNED NULL,
    `document_type` VARCHAR(30) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `file_path` VARCHAR(1000) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size_bytes` BIGINT UNSIGNED NOT NULL,
    `created_by` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `docs_work_documents_department_id_sub_department_id_program__idx`(`department_id`, `sub_department_id`, `program_id`, `academic_year_id`),
    INDEX `docs_work_documents_curriculum_version_id_idx`(`curriculum_version_id`),
    INDEX `docs_work_documents_course_offering_id_idx`(`course_offering_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `docs_curriculum_versions` ADD CONSTRAINT `docs_curriculum_versions_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `docs_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_courses` ADD CONSTRAINT `docs_courses_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `docs_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_course_offerings` ADD CONSTRAINT `docs_course_offerings_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `docs_courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_course_offerings` ADD CONSTRAINT `docs_course_offerings_academic_year_id_fkey` FOREIGN KEY (`academic_year_id`) REFERENCES `docs_academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_course_offerings` ADD CONSTRAINT `docs_course_offerings_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `docs_semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_course_offerings` ADD CONSTRAINT `docs_course_offerings_study_year_id_fkey` FOREIGN KEY (`study_year_id`) REFERENCES `docs_study_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_work_documents` ADD CONSTRAINT `docs_work_documents_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `docs_departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_work_documents` ADD CONSTRAINT `docs_work_documents_sub_department_id_fkey` FOREIGN KEY (`sub_department_id`) REFERENCES `docs_sub_departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_work_documents` ADD CONSTRAINT `docs_work_documents_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `docs_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_work_documents` ADD CONSTRAINT `docs_work_documents_academic_year_id_fkey` FOREIGN KEY (`academic_year_id`) REFERENCES `docs_academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_work_documents` ADD CONSTRAINT `docs_work_documents_curriculum_version_id_fkey` FOREIGN KEY (`curriculum_version_id`) REFERENCES `docs_curriculum_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docs_work_documents` ADD CONSTRAINT `docs_work_documents_course_offering_id_fkey` FOREIGN KEY (`course_offering_id`) REFERENCES `docs_course_offerings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

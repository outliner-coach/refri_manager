-- CreateTable
CREATE TABLE `members` (
    `id` CHAR(36) NOT NULL,
    `employee_no` VARCHAR(32) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `department` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `slack_user_id` VARCHAR(64) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `synced_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `members_employee_no_key`(`employee_no`),
    UNIQUE INDEX `members_email_key`(`email`),
    INDEX `members_employee_no_idx`(`employee_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `food_items` (
    `id` CHAR(36) NOT NULL,
    `member_id` CHAR(36) NOT NULL,
    `food_name` VARCHAR(120) NOT NULL,
    `expiry_date` DATE NOT NULL,
    `registered_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` ENUM('REGISTERED', 'DISPOSED', 'EXPIRED') NOT NULL DEFAULT 'REGISTERED',
    `updated_at` TIMESTAMP(0) NOT NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `food_items_expiry_date_status_idx`(`expiry_date`, `status`),
    INDEX `food_items_member_id_registered_at_idx`(`member_id`, `registered_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `food_assets` (
    `id` CHAR(36) NOT NULL,
    `food_item_id` CHAR(36) NOT NULL,
    `photo_object_key` VARCHAR(255) NOT NULL,
    `audio_object_key` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `food_assets_food_item_id_idx`(`food_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `food_item_events` (
    `id` CHAR(36) NOT NULL,
    `food_item_id` CHAR(36) NOT NULL,
    `actor_member_id` CHAR(36) NOT NULL,
    `event_type` VARCHAR(64) NOT NULL,
    `payload_json` JSON NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `food_item_events_food_item_id_idx`(`food_item_id`),
    INDEX `food_item_events_actor_member_id_idx`(`actor_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_schedule` (
    `id` CHAR(36) NOT NULL,
    `food_item_id` CHAR(36) NOT NULL,
    `target_type` ENUM('OWNER', 'ADMIN') NOT NULL,
    `schedule_type` ENUM('OWNER_D_MINUS_3', 'OWNER_D_DAY', 'OWNER_D_PLUS_7', 'OWNER_WEEKLY', 'ADMIN_D_PLUS_7') NOT NULL,
    `scheduled_at` TIMESTAMP(0) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED_RETRY', 'FAILED_PERM') NOT NULL DEFAULT 'PENDING',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `notification_schedule_status_scheduled_at_idx`(`status`, `scheduled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_attempts` (
    `id` CHAR(36) NOT NULL,
    `schedule_id` CHAR(36) NOT NULL,
    `idempotency_key` VARCHAR(120) NOT NULL,
    `attempt_no` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED_RETRY', 'FAILED_PERM') NOT NULL,
    `error_code` VARCHAR(80) NULL,
    `response_json` JSON NULL,
    `sent_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `notification_attempts_idempotency_key_key`(`idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deletion_audit` (
    `id` CHAR(36) NOT NULL,
    `entity_type` VARCHAR(64) NOT NULL,
    `entity_id` VARCHAR(64) NOT NULL,
    `deleted_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `reason` VARCHAR(255) NOT NULL,
    `meta_json` JSON NULL,

    INDEX `deletion_audit_entity_type_deleted_at_idx`(`entity_type`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `food_items` ADD CONSTRAINT `food_items_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `food_assets` ADD CONSTRAINT `food_assets_food_item_id_fkey` FOREIGN KEY (`food_item_id`) REFERENCES `food_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `food_item_events` ADD CONSTRAINT `food_item_events_food_item_id_fkey` FOREIGN KEY (`food_item_id`) REFERENCES `food_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `food_item_events` ADD CONSTRAINT `food_item_events_actor_member_id_fkey` FOREIGN KEY (`actor_member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_schedule` ADD CONSTRAINT `notification_schedule_food_item_id_fkey` FOREIGN KEY (`food_item_id`) REFERENCES `food_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_attempts` ADD CONSTRAINT `notification_attempts_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `notification_schedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


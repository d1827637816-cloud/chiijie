-- ==========================================
-- PAYMENT SYSTEM DATABASE MIGRATION
-- Production-Ready Payment Integration Schema
-- ==========================================
-- Run this migration script to create necessary payment tracking tables

USE `webtokobajuu`;

-- ==========================================
-- TABLE 1: payment_transactions
-- Tracks all payment attempts and status
-- ==========================================
CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` VARCHAR(64) NOT NULL COMMENT 'Unique transaction ID (TRX-timestamp-random)',
  `order_id` VARCHAR(32) NOT NULL COMMENT 'Link to orders table',
  `midtrans_transaction_id` VARCHAR(64) UNIQUE COMMENT 'Transaction ID from Midtrans',
  `snap_token` VARCHAR(255) UNIQUE COMMENT 'Midtrans Snap token',
  `amount` BIGINT UNSIGNED NOT NULL COMMENT 'Transaction amount in Rupiah (cents)',
  `currency` VARCHAR(3) DEFAULT 'IDR' COMMENT 'Currency code',
  `payment_method` VARCHAR(64) COMMENT 'Payment method used (bank_transfer_bca, gopay, ovo, dana, qris, shopeepay)',
  `payment_status` ENUM('pending', 'settlement', 'capture', 'deny', 'cancel', 'expire', 'failed', 'refund') DEFAULT 'pending' COMMENT 'Payment status from Midtrans',
  `customer_email` VARCHAR(255) COMMENT 'Customer email',
  `customer_phone` VARCHAR(20) COMMENT 'Customer phone',
  `merchant_reference` VARCHAR(255) COMMENT 'Optional merchant reference',
  `fraud_status` VARCHAR(50) COMMENT 'Fraud detection status from Midtrans',
  `approval_code` VARCHAR(100) COMMENT 'Bank authorization code',
  `masked_card` VARCHAR(50) COMMENT 'Masked card number (if card payment)',
  `bank_name` VARCHAR(64) COMMENT 'Bank name for bank transfer',
  `bank_account` VARCHAR(64) COMMENT 'Bank account for transfer destination',
  `transfer_amount` BIGINT UNSIGNED COMMENT 'Exact amount to transfer',
  `payment_expire_time` DATETIME COMMENT 'Payment expiry time',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Transaction creation time',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update time',
  `settlement_time` DATETIME COMMENT 'When payment settled/captured',
  `webhook_received_at` DATETIME COMMENT 'Timestamp when webhook was received',
  `ip_address` VARCHAR(45) COMMENT 'Customer IP address (IPv4/IPv6)',
  `user_agent` VARCHAR(500) COMMENT 'Customer user agent',
  `notes` LONGTEXT COMMENT 'Additional notes/logs',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_midtrans_transaction_id` (`midtrans_transaction_id`),
  UNIQUE KEY `uniq_snap_token` (`snap_token`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_customer_email` (`customer_email`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_payment_method` (`payment_method`),
  CONSTRAINT `fk_payment_trans_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='Payment transactions tracking and audit log';

-- ==========================================
-- TABLE 2: payment_webhooks
-- Audit trail for Midtrans webhook notifications
-- ==========================================
CREATE TABLE IF NOT EXISTS `payment_webhooks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Auto increment ID',
  `webhook_id` VARCHAR(64) UNIQUE COMMENT 'Webhook ID from Midtrans header',
  `transaction_id` VARCHAR(64) COMMENT 'Midtrans transaction ID',
  `order_id` VARCHAR(32) COMMENT 'Order ID from webhook',
  `event_type` VARCHAR(50) COMMENT 'Webhook event type (payment.capture, payment.settle, etc)',
  `transaction_status` VARCHAR(50) COMMENT 'Transaction status from webhook',
  `gross_amount` BIGINT UNSIGNED COMMENT 'Gross amount from webhook',
  `payload` LONGTEXT NOT NULL COMMENT 'Full webhook payload (JSON)',
  `signature_verified` BOOLEAN DEFAULT FALSE COMMENT 'Whether signature was valid',
  `ip_address` VARCHAR(45) COMMENT 'IP address of webhook sender',
  `processing_status` ENUM('pending', 'processed', 'failed', 'duplicate', 'ignored') DEFAULT 'pending' COMMENT 'Processing status',
  `processing_error` VARCHAR(500) COMMENT 'Error message if processing failed',
  `retry_count` INT UNSIGNED DEFAULT 0 COMMENT 'Number of retry attempts',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Webhook received time',
  `processed_at` DATETIME COMMENT 'When webhook was processed',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_webhook_id` (`webhook_id`),
  KEY `idx_transaction_id` (`transaction_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_processing_status` (`processing_status`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='Webhook notification audit log';

-- ==========================================
-- TABLE 3: payment_refunds
-- Track refund requests and status
-- ==========================================
CREATE TABLE IF NOT EXISTS `payment_refunds` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `transaction_id` VARCHAR(64) NOT NULL COMMENT 'Link to payment_transactions',
  `order_id` VARCHAR(32) NOT NULL COMMENT 'Link to orders',
  `refund_amount` BIGINT UNSIGNED NOT NULL COMMENT 'Amount to refund in Rupiah',
  `refund_reason` VARCHAR(255) NOT NULL COMMENT 'Reason for refund',
  `refund_status` ENUM('requested', 'approved', 'processing', 'completed', 'failed', 'rejected') DEFAULT 'requested',
  `midtrans_refund_id` VARCHAR(100) COMMENT 'Refund ID from Midtrans',
  `requested_by` VARCHAR(255) COMMENT 'Who requested the refund',
  `approved_by` VARCHAR(255) COMMENT 'Who approved the refund',
  `approval_notes` VARCHAR(500),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at` DATETIME,
  `completed_at` DATETIME,
  
  PRIMARY KEY (`id`),
  KEY `idx_transaction_id` (`transaction_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_refund_status` (`refund_status`),
  CONSTRAINT `fk_refund_transactions` FOREIGN KEY (`transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='Refund request tracking';

-- ==========================================
-- TABLE 4: payment_settlement
-- Track settlement/payout status from Midtrans
-- ==========================================
CREATE TABLE IF NOT EXISTS `payment_settlement` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `settlement_batch_id` VARCHAR(100) UNIQUE,
  `transaction_id` VARCHAR(64) COMMENT 'Link to payment_transactions',
  `settlement_amount` BIGINT UNSIGNED COMMENT 'Amount settled in Rupiah',
  `settlement_date` DATE COMMENT 'Settlement date',
  `settlement_status` ENUM('pending', 'settled', 'failed') DEFAULT 'pending',
  `bank_transfer_status` VARCHAR(50) COMMENT 'Status from bank',
  `bank_reference` VARCHAR(100) COMMENT 'Bank reference number',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` DATETIME,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_transaction_id` (`transaction_id`),
  KEY `idx_settlement_status` (`settlement_status`),
  KEY `idx_settlement_date` (`settlement_date`),
  CONSTRAINT `fk_settlement_transactions` FOREIGN KEY (`transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='Settlement/payout tracking';

-- ==========================================
-- TABLE 5: payment_fraud_logs
-- Track suspicious activity and fraud prevention
-- ==========================================
CREATE TABLE IF NOT EXISTS `payment_fraud_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `transaction_id` VARCHAR(64) COMMENT 'Link to transaction',
  `order_id` VARCHAR(32) COMMENT 'Link to order',
  `fraud_indicator` VARCHAR(100) NOT NULL COMMENT 'Type of fraud indicator detected',
  `fraud_score` DECIMAL(5,2) COMMENT 'Fraud probability score (0-100)',
  `ip_address` VARCHAR(45),
  `customer_email` VARCHAR(255),
  `unusual_pattern` VARCHAR(500) COMMENT 'Description of unusual pattern',
  `action_taken` ENUM('flagged', 'blocked', 'manual_review', 'allowed', 'challenged') DEFAULT 'flagged',
  `admin_notes` VARCHAR(500),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  KEY `idx_transaction_id` (`transaction_id`),
  KEY `idx_fraud_score` (`fraud_score`),
  KEY `idx_action_taken` (`action_taken`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='Fraud detection and prevention log';

-- ==========================================
-- TABLE 6: payment_retry_queue
-- Queue for failed payment retry
-- ==========================================
CREATE TABLE IF NOT EXISTS `payment_retry_queue` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `transaction_id` VARCHAR(64) NOT NULL,
  `order_id` VARCHAR(32) NOT NULL,
  `retry_count` INT UNSIGNED DEFAULT 0,
  `max_retries` INT UNSIGNED DEFAULT 3,
  `next_retry_at` DATETIME,
  `status` ENUM('pending_retry', 'retrying', 'success', 'failed', 'abandoned') DEFAULT 'pending_retry',
  `error_message` VARCHAR(500),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_retry_at` DATETIME,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_transaction_id` (`transaction_id`),
  KEY `idx_status` (`status`),
  KEY `idx_next_retry_at` (`next_retry_at`),
  CONSTRAINT `fk_retry_transactions` FOREIGN KEY (`transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='Retry queue for failed payment attempts';

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Add index untuk query performa tinggi
ALTER TABLE `orders` ADD INDEX `idx_payment_status` (`status_index`);
ALTER TABLE `orders` ADD INDEX `idx_customer_created` (`customer_id`, `created_at`);

-- Add foreign key check index
ALTER TABLE `payment_transactions` ADD INDEX `idx_order_payment_status` (`order_id`, `payment_status`);

-- ==========================================
-- TRIGGERS & STORED PROCEDURES
-- ==========================================

-- Trigger untuk update order status ketika payment berhasil
-- DELIMITER //
-- CREATE TRIGGER `update_order_on_payment_success`
-- AFTER UPDATE ON `payment_transactions`
-- FOR EACH ROW
-- BEGIN
--   IF NEW.payment_status IN ('settlement', 'capture') AND OLD.payment_status != NEW.payment_status THEN
--     UPDATE `orders` SET `status_index` = 1, `last_updated` = NOW() WHERE `id` = NEW.order_id;
--   END IF;
-- END //
-- DELIMITER ;

-- ==========================================
-- VIEW untuk reporting
-- ==========================================
CREATE OR REPLACE VIEW `v_payment_summary` AS
SELECT 
  o.id as order_id,
  o.customer_id,
  pt.id as transaction_id,
  pt.amount,
  pt.payment_method,
  pt.payment_status,
  o.total as order_total,
  pt.created_at as transaction_date,
  DATEDIFF(NOW(), pt.created_at) as days_since_transaction,
  CASE 
    WHEN pt.payment_status IN ('settlement', 'capture') THEN 'PAID'
    WHEN pt.payment_status = 'pending' THEN 'AWAITING_PAYMENT'
    WHEN pt.payment_status IN ('expire', 'deny', 'cancel', 'failed') THEN 'FAILED'
    ELSE 'UNKNOWN'
  END as payment_state
FROM `orders` o
LEFT JOIN `payment_transactions` pt ON o.id = pt.order_id
ORDER BY pt.created_at DESC;

-- ==========================================
-- DEFAULT DATA
-- ==========================================

-- Payment method reference
-- INSERT INTO `payment_methods` VALUES
-- ('bank_transfer_bca', 'BCA Bank Transfer', 'bank_transfer', TRUE),
-- ('bank_transfer_mandiri', 'Mandiri Bank Transfer', 'bank_transfer', TRUE),
-- ('bank_transfer_bni', 'BNI Bank Transfer', 'bank_transfer', TRUE),
-- ('gopay', 'GoPay E-Wallet', 'ewallet', TRUE),
-- ('ovo', 'OVO E-Wallet', 'ewallet', TRUE),
-- ('dana', 'DANA E-Wallet', 'ewallet', TRUE),
-- ('shopeepay', 'ShopeePay E-Wallet', 'ewallet', TRUE),
-- ('qris', 'QRIS Dynamic QR Code', 'qr_code', TRUE);

-- ==========================================
-- DONE
-- ==========================================
-- All payment system tables created successfully!
-- Next: Add env variables and configure webhook endpoint

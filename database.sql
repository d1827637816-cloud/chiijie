-- Database schema for webtokobajuu
-- Import this file into phpMyAdmin or MySQL CLI.

CREATE DATABASE IF NOT EXISTS `webtokobajuu` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `webtokobajuu`;

-- Table: products
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `brand` VARCHAR(128) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `price` INT UNSIGNED NOT NULL,
  `img` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: customers
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(32) DEFAULT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `province` VARCHAR(100) DEFAULT NULL,
  `postal` VARCHAR(20) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: orders
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(32) NOT NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `shipping_method` VARCHAR(128) NOT NULL,
  `payment_method` VARCHAR(128) NOT NULL,
  `subtotal` INT UNSIGNED NOT NULL,
  `shipping_cost` INT UNSIGNED NOT NULL,
  `discount` INT UNSIGNED NOT NULL DEFAULT 0,
  `total` INT UNSIGNED NOT NULL,
  `status_index` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  CONSTRAINT `fk_orders_customers` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: order_items
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(32) NOT NULL,
  `product_id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `brand` VARCHAR(128) NOT NULL,
  `price` INT UNSIGNED NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  CONSTRAINT `fk_order_items_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: order_status_history
CREATE TABLE IF NOT EXISTS `order_status_history` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(32) NOT NULL,
  `step` TINYINT UNSIGNED NOT NULL,
  `status` VARCHAR(128) NOT NULL,
  `location` VARCHAR(128) NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_order_id` (`order_id`),
  CONSTRAINT `fk_status_history_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Product seed data
INSERT INTO `products` (`id`, `name`, `brand`, `category`, `price`, `img`) VALUES
('p1', 'Premium White Linen Shirt', 'MANGO MAN', 'pria', 699000, 'men_shirt_product_1780400575906.png'),
('p2', 'Essential Black Bomber Jacket', 'H&M', 'pria', 799000, 'hero_banner_men_fashion_1780400311037.png'),
('p3', 'Tailored Navy Chino Pants', 'UNIQLO', 'pria', 549000, 'hero_banner_men_fashion_1780400311037.png'),
('p4', 'Soft Cotton Polo Shirt', 'ZARA MAN', 'pria', 399000, 'men_shirt_product_1780400575906.png'),
('p5', 'Vintage Indigo Denim Overshirt', 'LEVI’S', 'pria', 999000, 'hero_banner_men_fashion_1780400311037.png'),
('p6', 'Stretch Performance Jogger Pants', 'NIKE', 'pria', 649000, 'men_sneakers_product_1780400547442.png'),
('p7', 'Structured Grey Wool Blazer', 'ZARA MAN', 'pria', 1200000, 'hero_banner_men_fashion_1780400311037.png'),
('p8', 'Relaxed Fit Denim Shirt', 'LEVI’S', 'pria', 850000, 'men_shirt_product_1780400575906.png'),
('p9', 'Classic White Oxford Shirt', 'BROOKS BROTHERS', 'pria', 760000, 'hero_banner_men_fashion_1780400575906.png'),
('w1', 'Floral Midi Dress', 'ZARA', 'wanita', 899000, 'hero_banner_men_fashion_1780400311037.png'),
('w2', 'Silk Wrap Blouse', 'MANGO', 'wanita', 650000, 'hero_banner_men_fashion_1780400311037.png'),
('w3', 'Satin Slip Dress', 'H&M', 'wanita', 750000, 'hero_banner_men_fashion_1780400311037.png'),
('a1', 'Kaos Bergambar Fun', 'GAP KIDS', 'anak', 299000, 'hero_banner_men_fashion_1780400311037.png'),
('a2', 'Set Piyama Warna Ceria', 'CARTER’S', 'anak', 350000, 'hero_banner_men_fashion_1780400311037.png'),
('l1', 'Cashmere Rollneck Sweater', 'BURBERRY', 'luxury', 12500000, 'men_watch_product_1780400562688.png'),
('l2', 'Tailored Wool Overcoat', 'TOM FORD', 'luxury', 21500000, 'men_watch_product_1780400562688.png'),
('l3', 'Silk Weave Formal Shirt', 'ERMENEGILDO ZEGNA', 'luxury', 8500000, 'men_watch_product_1780400562688.png');

-- Example customer and order data
INSERT INTO `customers` (`first_name`, `last_name`, `email`, `phone`, `address`, `city`, `province`, `postal`) VALUES
('Dewi', 'Santoso', 'dewi@example.com', '081234567890', 'Jl. Melati No. 12', 'Jakarta', 'DKI Jakarta', '12345');

INSERT INTO `orders` (`id`, `customer_id`, `shipping_method`, `payment_method`, `subtotal`, `shipping_cost`, `discount`, `total`, `status_index`, `last_updated`) VALUES
('LXM-00000001', 1, 'Reguler', 'Kartu Kredit', 1498000, 30000, 0, 1528000, 1, NOW());

INSERT INTO `order_items` (`order_id`, `product_id`, `name`, `brand`, `price`, `quantity`) VALUES
('LXM-00000001', 'p1', 'Premium White Linen Shirt', 'MANGO MAN', 699000, 1),
('LXM-00000001', 'p2', 'Essential Black Bomber Jacket', 'H&M', 799000, 1);

INSERT INTO `order_status_history` (`order_id`, `step`, `status`, `location`, `updated_at`) VALUES
('LXM-00000001', 1, 'Pesanan diterima', 'Gudang LUXE.M', NOW()),
('LXM-00000001', 2, 'Diproses', 'Pusat Pemenuhan', NOW());

-- Table: shipping_costs (Regional pricing)
CREATE TABLE IF NOT EXISTS `shipping_costs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `province` VARCHAR(100) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `regular_cost` INT UNSIGNED NOT NULL,
  `express_cost` INT UNSIGNED NOT NULL,
  `overnight_cost` INT UNSIGNED NOT NULL,
  `active` BOOLEAN DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_province_city` (`province`, `city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: payment_transactions
CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` VARCHAR(64) NOT NULL,
  `order_id` VARCHAR(32) NOT NULL,
  `transaction_id` VARCHAR(255) DEFAULT NULL,
  `amount` INT UNSIGNED NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `snap_token` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_payment_orders` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed shipping costs data for different regions
INSERT INTO `shipping_costs` (`province`, `city`, `regular_cost`, `express_cost`, `overnight_cost`) VALUES
-- DKI Jakarta
('DKI Jakarta', 'Jakarta Pusat', 15000, 25000, 40000),
('DKI Jakarta', 'Jakarta Utara', 15000, 25000, 40000),
('DKI Jakarta', 'Jakarta Timur', 15000, 25000, 40000),
('DKI Jakarta', 'Jakarta Barat', 15000, 25000, 40000),
('DKI Jakarta', 'Jakarta Selatan', 15000, 25000, 40000),
('DKI Jakarta', 'Kepulauan Seribu', 25000, 35000, 50000),

-- Jawa Barat
('Jawa Barat', 'Bandung', 20000, 30000, 45000),
('Jawa Barat', 'Bekasi', 18000, 28000, 42000),
('Jawa Barat', 'Bogor', 18000, 28000, 42000),
('Jawa Barat', 'Depok', 18000, 28000, 42000),
('Jawa Barat', 'Tangerang', 18000, 28000, 42000),
('Jawa Barat', 'Serang', 25000, 35000, 50000),

-- Jawa Tengah
('Jawa Tengah', 'Semarang', 25000, 35000, 50000),
('Jawa Tengah', 'Yogyakarta', 28000, 38000, 53000),
('Jawa Tengah', 'Solo', 28000, 38000, 53000),
('Jawa Tengah', 'Salatiga', 28000, 38000, 53000),

-- Jawa Timur
('Jawa Timur', 'Surabaya', 28000, 38000, 53000),
('Jawa Timur', 'Malang', 32000, 42000, 57000),
('Jawa Timur', 'Gresik', 28000, 38000, 53000),
('Jawa Timur', 'Sidoarjo', 28000, 38000, 53000),

-- Bali
('Bali', 'Denpasar', 35000, 45000, 60000),
('Bali', 'Ubud', 38000, 48000, 63000),
('Bali', 'Kuta', 35000, 45000, 60000),

-- Sumatera Utara
('Sumatera Utara', 'Medan', 35000, 45000, 60000),

-- Sumatera Selatan
('Sumatera Selatan', 'Palembang', 35000, 45000, 60000),

-- Sulawesi Selatan
('Sulawesi Selatan', 'Makassar', 40000, 50000, 65000),

-- Kalimantan Timur
('Kalimantan Timur', 'Samarinda', 40000, 50000, 65000),
('Kalimantan Timur', 'Balikpapan', 40000, 50000, 65000),

-- Jawa (kota2 lainnya)
('Jawa Barat', 'Tasikmalaya', 28000, 38000, 53000),
('Jawa Barat', 'Ciamis', 28000, 38000, 53000),
('Jawa Barat', 'Karawang', 20000, 30000, 45000);

-- End of schema

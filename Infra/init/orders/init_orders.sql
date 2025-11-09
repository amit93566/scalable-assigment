-- ==========================================================
-- Initialize Orders + Order Items Database
-- Matches headers in eci_orders.csv and eci_order_items.csv
-- ==========================================================

-- Enable UUIDs (if needed later)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================
-- ORDERS TABLE
-- ===============================
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    order_status VARCHAR(50),
    payment_status VARCHAR(50),
    order_total NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ===============================
-- ORDER ITEMS TABLE
-- ===============================
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id INT NOT NULL,
    sku VARCHAR(50),
    quantity INT NOT NULL,
    unit_price NUMERIC(10,2)
);

-- ===============================
-- LOAD RAW DATA FROM CSV FILES
-- ===============================
-- Temporary staging tables to match CSV headers exactly

CREATE TEMP TABLE tmp_orders_raw (
    order_id TEXT,
    customer_id TEXT,
    order_status TEXT,
    payment_status TEXT,
    order_total TEXT,
    created_at TEXT
);

CREATE TEMP TABLE tmp_order_items_raw (
    order_item_id TEXT,
    order_id TEXT,
    product_id TEXT,
    sku TEXT,
    quantity TEXT,
    unit_price TEXT
);

-- ===============================
-- COPY DATA FROM CSV FILES
-- ===============================
COPY tmp_orders_raw(order_id, customer_id, order_status, payment_status, order_total, created_at)
FROM '/docker-entrypoint-initdb.d/eci_orders.csv'
DELIMITER ','
CSV HEADER;

COPY tmp_order_items_raw(order_item_id, order_id, product_id, sku, quantity, unit_price)
FROM '/docker-entrypoint-initdb.d/eci_order_items.csv'
DELIMITER ','
CSV HEADER;

-- ===============================
-- INSERT CLEANED DATA INTO TABLES
-- ===============================
INSERT INTO orders(order_id, customer_id, order_status, payment_status, order_total, created_at)
SELECT
    order_id::int,
    customer_id::bigint,
    COALESCE(NULLIF(order_status, ''), 'CREATED'),
    COALESCE(NULLIF(payment_status, ''), 'PENDING'),
    order_total::numeric,
    COALESCE(NULLIF(created_at, '')::timestamptz, now())
FROM tmp_orders_raw;

INSERT INTO order_items(order_item_id, order_id, product_id, sku, quantity, unit_price)
SELECT
    order_item_id::int,
    order_id::int,
    product_id::int,
    sku,
    quantity::int,
    unit_price::numeric
FROM tmp_order_items_raw;

-- ===============================
-- VERIFICATION LOG
-- ===============================
DO $$
BEGIN
    RAISE NOTICE ' Orders table populated: % rows', (SELECT COUNT(*) FROM orders);
    RAISE NOTICE ' Order items table populated: % rows', (SELECT COUNT(*) FROM order_items);
END $$;


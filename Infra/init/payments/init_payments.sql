/* CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    payment_method VARCHAR(50),
    status VARCHAR(20) NOT NULL,
    provider_transaction_id VARCHAR(128),
    idempotency_key VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COPY payments(payment_id, order_id, amount, currency, payment_method, status, provider_transaction_id, idempotency_key, created_at, updated_at)
FROM '/docker-entrypoint-initdb.d/eci_payments.csv'
DELIMITER ','
CSV HEADER;
*/

/*CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    payment_method VARCHAR(50),
    status VARCHAR(20) NOT NULL,
    provider_transaction_id VARCHAR(128),
    idempotency_key VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create a temporary table for raw import
CREATE TEMP TABLE tmp_payments AS
SELECT * FROM payments WITH NO DATA;

-- Load data into the temp table (payment_id column will be numeric or text)
COPY tmp_payments(payment_id, order_id, amount, currency, payment_method, status, provider_transaction_id, idempotency_key, created_at, updated_at)
FROM '/docker-entrypoint-initdb.d/eci_payments.csv'
DELIMITER ','
CSV HEADER;

-- Insert into main table, generate UUIDs automatically
INSERT INTO payments(order_id, amount, currency, payment_method, status, provider_transaction_id, idempotency_key, created_at, updated_at)
SELECT order_id::uuid, amount, currency, payment_method, status, provider_transaction_id, idempotency_key, created_at, updated_at
FROM tmp_payments;
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id TEXT,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    method VARCHAR(50),
    status VARCHAR(20) NOT NULL,
    provider_transaction_id VARCHAR(128),
    idempotency_key VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TEMP TABLE tmp_payments_raw (
    payment_id TEXT,
    order_id TEXT,
    amount TEXT,
    method TEXT,
    status TEXT,
    provider_transaction_id TEXT,
    created_at TEXT
);

COPY tmp_payments_raw(payment_id, order_id, amount, method, status, provider_transaction_id, created_at)
FROM '/docker-entrypoint-initdb.d/eci_payments.csv'
DELIMITER ','
CSV HEADER;

INSERT INTO payments(order_id, amount, method, status, provider_transaction_id, created_at)
SELECT
    order_id,
    amount::numeric,
    method,
    status,
    provider_transaction_id,
    COALESCE(NULLIF(created_at, '')::timestamptz, now())
FROM tmp_payments_raw;


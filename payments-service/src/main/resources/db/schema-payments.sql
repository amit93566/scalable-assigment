CREATE TABLE IF NOT EXISTS payments (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency
  ON payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_order_id
  ON payments(order_id);


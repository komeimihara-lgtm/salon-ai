-- 電子契約書テーブル
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  course_name TEXT NOT NULL,
  treatment_content TEXT,
  sessions INTEGER,
  start_date DATE,
  end_date DATE,
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'lump_sum',
  status TEXT NOT NULL DEFAULT 'draft',
  signature_image TEXT,
  signed_at TIMESTAMPTZ,
  signer_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_salon_id ON contracts(salon_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id ON contracts(customer_id);

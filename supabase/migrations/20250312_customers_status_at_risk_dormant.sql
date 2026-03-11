-- customers テーブルの status に 'at_risk', 'dormant' を追加
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_status_check;
ALTER TABLE customers ADD CONSTRAINT customers_status_check
  CHECK (status IN ('active', 'lost', 'vip', 'temporary', 'at_risk', 'dormant'));

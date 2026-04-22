-- 売上の支払方法に「交通系 (transit_ic)」と「QR決済 (qr_code)」を追加
-- sales.sale_type の CHECK 制約を拡張（payment_method には元々CHECKなし）

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_sale_type_check;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_sale_type_check CHECK (
    sale_type IN (
      'cash',
      'card',
      'online',
      'loan',
      'transit_ic',
      'qr_code',
      'ticket_consume',
      'subscription_consume',
      'product'
    )
  );

COMMENT ON COLUMN public.sales.sale_type IS
  '売上の種別（集計用）: cash/card/online/loan/transit_ic/qr_code/ticket_consume/subscription_consume/product';

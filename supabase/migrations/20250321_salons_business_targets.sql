-- salons に business_hours と targets を追加
ALTER TABLE salons ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"openTime":"10:00","closeTime":"21:00"}';
ALTER TABLE salons ADD COLUMN IF NOT EXISTS targets JSONB DEFAULT '{"sales":600000,"visits":60,"avgPrice":10000,"productSales":50000,"newCustomers":10,"newReservations":15}';

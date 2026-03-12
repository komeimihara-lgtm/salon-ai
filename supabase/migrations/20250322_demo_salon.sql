-- デモサロンレコード
INSERT INTO salons (
  id, name, owner_name, plan, phone, address, status, beds
) VALUES (
  'demo0000-0000-0000-0000-000000000001',
  'デモサロン SOLA',
  'デモ オーナー',
  'pro',
  '03-0000-0000',
  '東京都渋谷区神宮前1-1-1',
  'demo',
  '["A","B"]'
) ON CONFLICT (id) DO NOTHING;

-- LINE友だち未紐付け: サロンごとに同一ユーザーIDを許可（マルチテナントで上書きされないようにする）
ALTER TABLE unmatched_line_users DROP CONSTRAINT IF EXISTS unmatched_line_users_line_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS unmatched_line_users_salon_line_unique
  ON unmatched_line_users (salon_id, line_user_id);

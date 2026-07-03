-- サロン独自のカルテ項目を「箱を個別に作らず」そのまま受け入れるための汎用JSON列。
-- CSVインポート時に辞書へマッピングできなかった列を { ヘッダー名: 値 } として格納し、
-- カルテ画面で「その他のカルテ項目」として表示する。項目の有無でエラーにならなくする土台。
ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

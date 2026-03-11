-- salons テーブルに closed_days カラムを追加（定休日: 曜日インデックス配列, 0=月〜6=日）
ALTER TABLE salons
ADD COLUMN IF NOT EXISTS closed_days JSONB DEFAULT '[]';

-- salons テーブルに closed_weekdays カラムを追加（0=月, 1=火, ..., 6=日）
ALTER TABLE salons
ADD COLUMN IF NOT EXISTS closed_weekdays INTEGER[] DEFAULT '{}';

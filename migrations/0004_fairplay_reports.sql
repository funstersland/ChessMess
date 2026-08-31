alter table fair_play_scans add column if not exists reporter_id text;
alter table fair_play_scans add column if not exists kind text not null default 'auto';
alter table fair_play_scans add column if not exists subject_user_id text;

alter table fair_play_cases add column if not exists reporter_id text;
alter table fair_play_cases add column if not exists kind text not null default 'auto';

create index if not exists fair_play_scans_reporter_idx
  on fair_play_scans (reporter_id, created_at desc);

create index if not exists profiles_account_status_idx
  on profiles (account_status);

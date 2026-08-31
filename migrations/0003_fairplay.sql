alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists account_status text not null default 'ok';
alter table profiles add column if not exists fair_play_score integer;
alter table profiles add column if not exists flagged_at timestamptz;
alter table profiles add column if not exists suspended_at timestamptz;
alter table profiles add column if not exists suspend_reason text;

alter table games add column if not exists opponent_kind text not null default 'bot';
alter table games add column if not exists ucis jsonb;

create table if not exists fair_play_scans (
  id              text primary key,
  game_id         text,
  user_id         text not null,
  display_name    text not null default 'Player',
  opponent        text not null default '',
  color           text not null,
  variant         text not null default 'standard',
  source          text not null default 'live',
  pgn             text not null default '',
  fen_start       text not null default '',
  ply_count       integer not null default 0,
  considered      integer not null default 0,
  stockfish_top1  double precision,
  stockfish_top3  double precision,
  stockfish_acpl  double precision,
  court_top1      double precision,
  court_top3      double precision,
  court_acpl      double precision,
  sentinel_top1   double precision,
  sentinel_top3   double precision,
  sentinel_acpl   double precision,
  consensus       double precision,
  accuracy        double precision,
  risk_score      integer not null default 0,
  verdict         text not null,
  engines_used    jsonb,
  report          jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists fair_play_scans_user_idx
  on fair_play_scans (user_id, created_at desc);

create table if not exists fair_play_cases (
  id            text primary key,
  scan_id       text not null,
  user_id       text not null,
  display_name  text not null default 'Player',
  opponent      text not null default '',
  risk_score    integer not null,
  verdict       text not null,
  status        text not null default 'pending',
  admin_id      text,
  admin_note    text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists fair_play_cases_status_idx
  on fair_play_cases (status, created_at desc);
create index if not exists fair_play_cases_user_idx
  on fair_play_cases (user_id, created_at desc);

create table if not exists profiles (
  user_id      text primary key,
  display_name text not null default 'Player',
  bio          text not null default '',
  rating       integer not null default 1200,
  wins         integer not null default 0,
  draws        integer not null default 0,
  losses       integer not null default 0,
  peak_rating  integer not null default 1200,
  coach_voice  text not null default 'female',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists games (
  id              text primary key,
  user_id         text not null,
  opponent        text not null,
  opponent_rating integer not null default 1200,
  color           text not null,
  variant         text not null default 'standard',
  time_control    text not null default 'none',
  result          text not null,
  rated           boolean not null default true,
  rating_before   integer not null default 1200,
  rating_after    integer not null default 1200,
  pgn             text not null default '',
  fen_start       text not null default '',
  analysis        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists games_user_id_idx on games (user_id, created_at desc);

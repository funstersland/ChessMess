-- Signaling tables for friend games (previously created at runtime only).
-- key_hash binds each peer id to a secret held by that browser.
create table if not exists webrtc_peers (
  room      text not null,
  peer_id   text not null,
  name      text not null default '',
  last_seen timestamptz not null default now(),
  primary key (room, peer_id)
);
alter table webrtc_peers add column if not exists key_hash text;

create table if not exists webrtc_signals (
  id         bigserial primary key,
  room       text not null,
  to_peer    text not null,
  from_peer  text not null,
  kind       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists webrtc_signals_inbox on webrtc_signals (room, to_peer, id);

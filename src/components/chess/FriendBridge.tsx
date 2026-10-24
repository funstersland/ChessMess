import { useEffect, useRef } from "react";
import { useP2PRoom } from "@/lib/multiplayer/use-p2p-room";
import type { Side, TimeControlId, VariantId } from "@/lib/chess/types";

export type FriendIdentity = {
  name: string;
  userId?: string;
};

export type FriendHello = {
  type: "hello";
  variant: VariantId;
  time: TimeControlId;
  fen?: string;
  hostColor: Side;
  name: string;
  userId?: string;
};

/**
 * Messages between the two players. `clock` on a move is the mover's own
 * time left after the move (ms); the receiver adopts it so both boards agree.
 */
export type FriendMsg =
  | FriendHello
  | { type: "iam"; name: string; userId?: string }
  | { type: "move"; uci: string; clock?: number }
  | { type: "drop"; role: string; to: string; clock?: number }
  | { type: "resign" }
  | { type: "timeout"; flagged: Side }
  | { type: "draw_offer" }
  | { type: "draw_accept" }
  | { type: "draw_decline" }
  | { type: "takeback_request" }
  | { type: "takeback_accept" }
  | { type: "takeback_decline" };

/** How often the host repeats its hello until the guest acknowledges it. */
const HELLO_RETRY_MS = 1000;

export function FriendBridge({
  room,
  name,
  userId,
  host,
  hello,
  onPeer,
  onHello,
  onIdentity,
  onMove,
  onDrop,
  onResign,
  onTimeout,
  onDrawOffer,
  onDrawAccept,
  onDrawDecline,
  onTakebackRequest,
  onTakebackAccept,
  onTakebackDecline,
  onRejected,
  registerSend,
}: {
  room: string;
  name: string;
  userId?: string;
  host: boolean;
  hello: FriendHello;
  onPeer: (connected: boolean) => void;
  onHello: (msg: FriendHello) => void;
  onIdentity?: (id: FriendIdentity) => void;
  onMove: (uci: string, clock?: number) => void;
  onDrop?: (role: string, to: string, clock?: number) => void;
  onResign: () => void;
  onTimeout: (flagged: Side) => void;
  onDrawOffer: () => void;
  onDrawAccept: () => void;
  onDrawDecline: () => void;
  onTakebackRequest: () => void;
  onTakebackAccept: () => void;
  onTakebackDecline: () => void;
  onRejected?: (reason: "room_full" | "forbidden") => void;
  registerSend: (fn: (msg: FriendMsg) => void) => void;
}) {
  const p2p = useP2PRoom({ room, name });
  const helloRef = useRef(hello);
  helloRef.current = hello;
  const acked = useRef(false);
  const nameRef = useRef(name);
  nameRef.current = name;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    registerSend((msg) => p2p.send(msg));
  }, [p2p, registerSend]);

  useEffect(() => {
    if (p2p.rejected) onRejected?.(p2p.rejected);
  }, [p2p.rejected, onRejected]);

  const live = p2p.peers.some((p) => p.connectionState === "connected");
  useEffect(() => {
    onPeer(live);
  }, [live, onPeer]);

  // The data channel can open a moment after the connection reports
  // "connected", and a send before that is dropped. So the host repeats its
  // hello until the guest answers with "iam".
  useEffect(() => {
    if (!host || !live) return;
    const sendHello = () => {
      if (acked.current) return;
      p2p.send({ ...helloRef.current, name: nameRef.current, userId: userIdRef.current });
    };
    sendHello();
    const timer = window.setInterval(sendHello, HELLO_RETRY_MS);
    return () => window.clearInterval(timer);
  }, [p2p, host, live]);

  useEffect(() => {
    return p2p.onMessage((_from, data) => {
      const msg = data as FriendMsg;
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;
      switch (msg.type) {
        case "hello":
          if (host) return;
          onHello(msg);
          onIdentity?.({ name: msg.name, userId: msg.userId });
          // Answer every hello: the answer is the host's acknowledgement.
          p2p.send({ type: "iam", name: nameRef.current, userId: userIdRef.current });
          return;
        case "iam":
          acked.current = true;
          onIdentity?.({ name: msg.name, userId: msg.userId });
          return;
        case "move":
          if (typeof msg.uci === "string") onMove(msg.uci, numberOrUndefined(msg.clock));
          return;
        case "drop":
          if (onDrop && typeof msg.role === "string" && typeof msg.to === "string") {
            onDrop(msg.role, msg.to, numberOrUndefined(msg.clock));
          }
          return;
        case "resign":
          onResign();
          return;
        case "timeout":
          if (msg.flagged === "white" || msg.flagged === "black") onTimeout(msg.flagged);
          return;
        case "draw_offer":
          onDrawOffer();
          return;
        case "draw_accept":
          onDrawAccept();
          return;
        case "draw_decline":
          onDrawDecline();
          return;
        case "takeback_request":
          onTakebackRequest();
          return;
        case "takeback_accept":
          onTakebackAccept();
          return;
        case "takeback_decline":
          onTakebackDecline();
          return;
      }
    });
  }, [
    p2p,
    host,
    onHello,
    onIdentity,
    onMove,
    onDrop,
    onResign,
    onTimeout,
    onDrawOffer,
    onDrawAccept,
    onDrawDecline,
    onTakebackRequest,
    onTakebackAccept,
    onTakebackDecline,
  ]);

  return null;
}

function numberOrUndefined(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function makeRoomCode() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0]! % 1_000_000).padStart(6, "0");
}

export function normalizeRoomCode(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 6);
}

export function isValidRoomCode(code: string) {
  return /^\d{6}$/.test(code);
}

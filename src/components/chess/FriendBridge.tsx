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

export type FriendMsg =
  | FriendHello
  | { type: "iam"; name: string; userId?: string }
  | { type: "move"; uci: string }
  | { type: "drop"; role: string; to: string }
  | { type: "resign" }
  | { type: "takeback_request" }
  | { type: "takeback_accept" }
  | { type: "takeback_decline" };

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
  onTakebackRequest,
  onTakebackAccept,
  onTakebackDecline,
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
  onMove: (uci: string) => void;
  onDrop?: (role: string, to: string) => void;
  onResign: () => void;
  onTakebackRequest: () => void;
  onTakebackAccept: () => void;
  onTakebackDecline: () => void;
  registerSend: (fn: (msg: FriendMsg) => void) => void;
}) {
  const p2p = useP2PRoom({ room, name });
  const helloRef = useRef(hello);
  helloRef.current = hello;
  const sentHello = useRef(false);
  const sentIam = useRef(false);
  const nameRef = useRef(name);
  nameRef.current = name;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    registerSend((msg) => p2p.send(msg));
  }, [p2p, registerSend]);

  useEffect(() => {
    const live = p2p.peers.some((p) => p.connectionState === "connected");
    onPeer(live);
    if (host && live && !sentHello.current) {
      sentHello.current = true;
      p2p.send({
        ...helloRef.current,
        name: nameRef.current,
        userId: userIdRef.current,
      });
    }
  }, [p2p, host, onPeer]);

  useEffect(() => {
    return p2p.onMessage((_from, data) => {
      const msg = data as FriendMsg;
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;
      if (msg.type === "hello") {
        onHello(msg);
        onIdentity?.({ name: msg.name, userId: msg.userId });
        if (!host && !sentIam.current) {
          sentIam.current = true;
          p2p.send({ type: "iam", name: nameRef.current, userId: userIdRef.current });
        }
      }
      if (msg.type === "iam") {
        onIdentity?.({ name: msg.name, userId: msg.userId });
      }
      if (msg.type === "move") onMove(msg.uci);
      if (msg.type === "drop" && onDrop) onDrop(msg.role, msg.to);
      if (msg.type === "resign") onResign();
      if (msg.type === "takeback_request") onTakebackRequest();
      if (msg.type === "takeback_accept") onTakebackAccept();
      if (msg.type === "takeback_decline") onTakebackDecline();
    });
  }, [p2p, host, onHello, onIdentity, onMove, onDrop, onResign, onTakebackRequest, onTakebackAccept, onTakebackDecline]);

  return null;
}

export function makeRoomCode() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

export function normalizeRoomCode(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 6);
}

export function isValidRoomCode(code: string) {
  return /^\d{6}$/.test(code);
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Position } from "chessops/chess";
import type { Role } from "chessops/types";
import { Flag, FlipHorizontal2, RotateCcw, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { botClient } from "@/lib/chess/bot";
import {
  buildPgn,
  capturedFromStart,
  clonePos,
  downloadPgn,
  fenOf,
  INITIAL_FEN,
  isDropUci,
  isPromotionMove,
  lastMoveFromUci,
  loadPosition,
  materialCount,
  playDrop,
  playFromTo,
  playUci,
  snapshotOf,
  variantHasPockets,
} from "@/lib/chess/engine";
import { nextRating } from "@/lib/chess/rating";
import type {
  AnalyzeItem,
  BotId,
  GameSnapshot,
  LastMove,
  OpponentKind,
  PlayedMove,
  Side,
  SquareName,
  TimeControlId,
  VariantId,
} from "@/lib/chess/types";
import { BOTS, botById, timeById, TIME_CONTROLS, VARIANTS, variantById } from "@/lib/chess/variants";
import { playSfx, unlockAudio } from "@/lib/audio/sfx";
import { coachLine, coachMoveGuidance, speak, stopSpeaking } from "@/lib/coach/coach";
import { useSettings } from "@/lib/store/settings";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { applyGameResult } from "@/lib/server/profile";
import { getFairPlayMe, submitFairPlayScan } from "@/lib/server/fairplay";
import { scanGame } from "@/lib/fairplay/scan";
import { verdictLabel } from "@/lib/fairplay/score";
import { ChessBoard } from "./ChessBoard";
import {
  type CaptureFxData,
  activeBoardStyle,
  animationsEnabled,
  boardHasCaptureFx,
  victimOnSquare,
} from "./captureFx";
import {
  MOVE_SLIDE_MS,
  botThinkDelay,
  type MoveSlideData,
  waitAfterBotMove,
  waitBeforeBotTurn,
} from "./movePacing";
import { Captured } from "./Captured";
import { Clock } from "./Clock";
import { CoachBubble } from "./CoachBubble";
import { EvalBar } from "./EvalBar";
import { MoveList } from "./MoveList";
import { PocketBar } from "./PocketBar";
import { PieceSvg } from "./PieceSvg";
import { FriendBridge, isValidRoomCode, makeRoomCode, normalizeRoomCode, type FriendHello, type FriendIdentity, type FriendMsg } from "./FriendBridge";
import { cn } from "@/lib/utils";

export interface MatchConfig {
  opponent: OpponentKind;
  bot: BotId;
  variant: VariantId;
  color: Side | "random";
  time: TimeControlId;
  fen?: string;
  room?: string;
  onlineMode?: "create" | "join";
}

type Phase = "idle" | "wait" | "player" | "bot" | "over";

function uid() {
  return crypto.randomUUID();
}

function guestStats() {
  try {
    const raw = localStorage.getItem("chessmess-guest");
    if (raw) return JSON.parse(raw) as { rating: number; wins: number; draws: number; losses: number };
  } catch {
    /* ignore */
  }
  return { rating: 1200, wins: 0, draws: 0, losses: 0 };
}

function saveGuest(s: ReturnType<typeof guestStats>) {
  localStorage.setItem("chessmess-guest", JSON.stringify(s));
}

export function PlayArena({
  initial,
  onExit,
}: {
  initial?: Partial<MatchConfig>;
  onExit?: () => void;
}) {
  const settings = useSettings();
  const user = useCurrentUser();
  const [config, setConfig] = useState<MatchConfig>({
    opponent: initial?.opponent ?? "bot",
    bot: initial?.bot ?? "intermediate",
    variant: initial?.variant ?? "standard",
    color: initial?.color ?? "white",
    time: initial?.time ?? "none",
    fen: initial?.fen,
    onlineMode: initial?.onlineMode ?? (initial?.room ? "join" : "create"),
    room:
      initial?.room != null
        ? normalizeRoomCode(initial.room)
        : initial?.opponent === "online"
          ? (initial?.onlineMode ?? "create") === "join"
            ? ""
            : makeRoomCode()
          : undefined,
  });
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [snap, setSnap] = useState<GameSnapshot>(() =>
    snapshotOf(loadPosition("standard"), "standard"),
  );
  const [playerColor, setPlayerColor] = useState<Side>("white");
  const [selected, setSelected] = useState<SquareName | null>(null);
  const [pendingDrop, setPendingDrop] = useState<Role | null>(null);
  const [promo, setPromo] = useState<{ from: SquareName; to: SquareName } | null>(null);
  const [moves, setMoves] = useState<PlayedMove[]>([]);
  const [lastMoves, setLastMoves] = useState<LastMove[]>([]);
  const [coachText, setCoachText] = useState<string | null>(null);
  const [hint, setHint] = useState<{ from: SquareName; to: SquareName } | null>(null);
  const [evalCp, setEvalCp] = useState<number | null>(null);
  const [shake, setShake] = useState(0);
  const [captureFx, setCaptureFx] = useState<CaptureFxData | null>(null);
  const [moveSlide, setMoveSlide] = useState<MoveSlideData | null>(null);
  const [orientation, setOrientation] = useState<Side>("white");
  const [clocks, setClocks] = useState<{ white: number | null; black: number | null }>({
    white: null,
    black: null,
  });
  const [analysis, setAnalysis] = useState<AnalyzeItem[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewPly, setReviewPly] = useState<number | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const [fenDraft, setFenDraft] = useState(INITIAL_FEN);
  const [showResult, setShowResult] = useState(false);
  const [peerOn, setPeerOn] = useState(false);
  const host = config.onlineMode !== "join";
  const sendRef = useRef<(msg: FriendMsg) => void>(() => {});
  const [fpNote, setFpNote] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<"ok" | "flagged" | "suspended">("ok");
  const [fpReport, setFpReport] = useState<import("@/lib/fairplay/types").ScanReport | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [peerName, setPeerName] = useState("Online friend");
  const [peerUserId, setPeerUserId] = useState<string | undefined>();
  const [takebackWaiting, setTakebackWaiting] = useState(false);
  const [takebackRequest, setTakebackRequest] = useState(false);
  const gameIdRef = useRef<string | null>(null);

  const posRef = useRef<Position>(loadPosition("standard"));
  const startFenRef = useRef(INITIAL_FEN);
  const phaseRef = useRef<Phase>("idle");
  const colorRef = useRef<Side>("white");
  const clocksRef = useRef(clocks);
  const lastTick = useRef(0);
  const endedRef = useRef(false);
  const movesRef = useRef<PlayedMove[]>([]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    clocksRef.current = clocks;
  }, [clocks]);
  useEffect(() => {
    if (!user) {
      setAccountStatus("ok");
      return;
    }
    void getFairPlayMe()
      .then((m) => setAccountStatus(m.status))
      .catch(() => setAccountStatus("ok"));
  }, [user]);

  const bot = botById(config.bot);
  const variant = variantById(config.variant);
  const time = timeById(config.time);
  const isCoachMode = config.opponent === "coach";
  const isBotMatch = config.opponent === "bot";
  const isBotOpponent = isBotMatch || isCoachMode;

  const speakCoach = useCallback(
    (line: string) => {
      setCoachText(line);
      speak(line, {
        gender: settings.coachVoice,
        volume: settings.coachVol,
        rate: settings.coachRate,
        enabled: settings.sound,
      });
    },
    [settings.coachRate, settings.coachVoice, settings.coachVol, settings.sound],
  );

  const guideCoachAfterMove = useCallback(
    async (before: Position, played: { san: string; uci: string }, inCheck: boolean) => {
      const ply = movesRef.current.length;
      try {
        const sc = await botClient.score(fenOf(before), config.variant, played.uci);
        setEvalCp(before.turn === "white" ? sc.playedCp : -sc.playedCp);
        const line = coachMoveGuidance({
          ply,
          san: played.san,
          inCheck,
          classification: sc.classification,
          bestSan: sc.bestSan,
          cpLoss: sc.cpLoss,
        });
        if (sc.classification === "blunder" || sc.classification === "mistake") {
          toast[sc.classification === "blunder" ? "error" : "warning"](line);
        }
        speakCoach(line);
      } catch {
        speakCoach(coachMoveGuidance({ ply, san: played.san, inCheck }));
      }
    },
    [config.variant, speakCoach],
  );

  const refresh = useCallback((pos: Position) => {
    posRef.current = pos;
    setSnap(snapshotOf(pos, config.variant));
  }, [config.variant]);

  const triggerCaptureFx = useCallback(
    (before: Position, from: SquareName, to: SquareName) => {
      if (!settings.animations || !animationsEnabled()) return;
      const board = activeBoardStyle(settings.theme, settings.boardStyle, settings.lockThemeAssets);
      if (!boardHasCaptureFx(board)) return;
      const victim = victimOnSquare(before, to);
      if (!victim) return;
      setCaptureFx({ from, to, victim });
    },
    [settings.animations, settings.boardStyle, settings.lockThemeAssets, settings.theme],
  );

  const clearCaptureFx = useCallback(() => setCaptureFx(null), []);

  const beginMoveSlide = useCallback(
    (from: SquareName, to: SquareName, pos: Position) => {
      if (!settings.animations || !animationsEnabled()) {
        setMoveSlide(null);
        return;
      }
      const piece = snapshotOf(pos, config.variant).pieces.find((p) => p.square === to);
      if (!piece) {
        setMoveSlide(null);
        return;
      }
      setMoveSlide({ from, to, role: piece.role, color: piece.color });
    },
    [config.variant, settings.animations],
  );

  useEffect(() => {
    if (!moveSlide) return;
    const t = window.setTimeout(() => setMoveSlide(null), MOVE_SLIDE_MS + 40);
    return () => window.clearTimeout(t);
  }, [moveSlide]);

  const applyTakeback = useCallback(
    (plies: number) => {
      const keep = movesRef.current.slice(0, Math.max(0, movesRef.current.length - plies));
      const pos = loadPosition(config.variant, startFenRef.current);
      for (const m of keep) playUci(pos, m.uci);
      movesRef.current = keep;
      setMoves(keep);
      setLastMoves(
        keep.slice(-2).map((m) => lastMoveFromUci(m.uci, m.color)),
      );
      refresh(pos);
      setPhase("player");
      endedRef.current = false;
      setTakebackWaiting(false);
      setTakebackRequest(false);
      setHint(null);
      setCaptureFx(null);
      setMoveSlide(null);
    },
    [config.variant, refresh],
  );

  function bumpClockAfterMove(mover: Side) {
    const t = timeById(config.time);
    setClocks((c) => {
      if (c.white == null || c.black == null) return c;
      const next = { ...c };
      if (t.perMove) {
        next[mover] = (t.baseSec ?? 0) * 1000;
      } else if (t.incSec) {
        next[mover] = (next[mover] ?? 0) + t.incSec * 1000;
      }
      return next;
    });
  }

  const finish = useCallback(
    async (winner: Side | "draw", reason: string) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setPhase("over");
      setShowResult(true);
      setResultNote(reason);
      stopSpeaking();
      const youWin = winner === playerColor;
      const draw = winner === "draw";
      playSfx(draw ? "draw" : youWin ? "win" : "lose", settings.theme);
      if (isCoachMode) {
        speakCoach(coachLine(youWin ? "mate" : draw ? "lose" : "lose"));
      }

      const sans = movesRef.current.map((m) => m.san);
      const oppName =
        isBotOpponent
          ? bot.name
          : config.opponent === "online"
            ? peerName || "Online friend"
            : "Pass and play";
      const pgn = buildPgn({
        white: playerColor === "white" ? (user?.displayName ?? "You") : oppName,
        black: playerColor === "black" ? (user?.displayName ?? "You") : oppName,
        variant: config.variant,
        result: draw ? "1/2-1/2" : winner === "white" ? "1-0" : "0-1",
        fen: startFenRef.current,
        sans,
        timeControl: config.time,
      });
      const gameId = uid();
      gameIdRef.current = gameId;
      const ucis = movesRef.current.map((m) => m.uci);

      let analyzed: AnalyzeItem[] | undefined;
      setAnalyzing(true);
      try {
        const res = await botClient.analyze(
          startFenRef.current,
          config.variant,
          movesRef.current.map((m) => m.uci),
        );
        analyzed = res.items;
        setAnalysis(res.items);
      } catch {
        setAnalysis([]);
      } finally {
        setAnalyzing(false);
      }

      if (isBotMatch) {
        const g = guestStats();
        const score = draw ? 0.5 : youWin ? 1 : 0;
        const games = g.wins + g.draws + g.losses;
        const { next, delta } = nextRating(g.rating, bot.rating, score, games);
        setRatingDelta(delta);
        const updated = {
          rating: next,
          wins: g.wins + (youWin ? 1 : 0),
          draws: g.draws + (draw ? 1 : 0),
          losses: g.losses + (!youWin && !draw ? 1 : 0),
        };
        saveGuest(updated);
        if (user) {
          try {
            await applyGameResult({
              data: {
                id: gameId,
                opponent: bot.name,
                opponentRating: bot.rating,
                color: playerColor,
                variant: config.variant,
                timeControl: config.time,
                result: draw ? "draw" : youWin ? "win" : "loss",
                rated: true,
                ratingBefore: g.rating,
                ratingAfter: next,
                pgn,
                fenStart: startFenRef.current,
                analysis: analyzed,
                opponentKind: "bot",
                ucis,
              },
            });
          } catch {
            /* guest save still holds */
          }
        }
      } else if (user) {
        try {
          await applyGameResult({
            data: {
              id: gameId,
              opponent: oppName,
              opponentRating: 1200,
              color: playerColor,
              variant: config.variant,
              timeControl: config.time,
              result: draw ? "draw" : youWin ? "win" : "loss",
              rated: false,
              ratingBefore: guestStats().rating,
              ratingAfter: guestStats().rating,
              pgn,
              fenStart: startFenRef.current,
              analysis: analyzed,
              opponentKind: config.opponent,
              ucis,
            },
          });
        } catch {
          /* ignore */
        }
      }

      if (config.opponent !== "local" && ucis.length >= 8) {
        const claimed = guestStats().rating;
        setFpNote("Fair Play: starting Stockfish…");
        void scanGame(
          {
            fenStart: startFenRef.current,
            ucis,
            variant: config.variant,
            color: playerColor,
            rating: claimed,
            opponent: oppName,
            pgn,
          },
          (p) => setFpNote(p.message),
        )
          .then(async (scanned) => {
            setFpReport(scanned);
            if (user) {
              const res = await submitFairPlayScan({
                data: {
                  id: `${gameId}-scan`,
                  gameId,
                  opponent: oppName,
                  color: playerColor,
                  variant: config.variant,
                  source: "live",
                  pgn,
                  fenStart: startFenRef.current,
                  rating: claimed,
                  metrics: scanned.metrics,
                  report: scanned,
                  kind: "auto",
                },
              });
              if (res.caseId) {
                setFpNote(
                  `Fair Play flagged you (risk ${res.risk}). Sent to the steward — they approve any suspension.`,
                );
                toast.error("Fair Play flagged this game");
                setAccountStatus("flagged");
              } else {
                setFpNote(`Fair Play: ${verdictLabel(res.verdict)} · risk ${res.risk}`);
              }
            } else {
              setFpNote(`Fair Play: ${verdictLabel(scanned.verdict)} · risk ${scanned.risk}`);
            }
          })
          .catch(() => setFpNote(null));

        if (config.opponent === "online" && user) {
          const oppColor = playerColor === "white" ? "black" : "white";
          void scanGame({
            fenStart: startFenRef.current,
            ucis,
            variant: config.variant,
            color: oppColor,
            rating: 1500,
            opponent: user.displayName ?? "You",
            pgn,
          }).then(async (scanned) => {
            if (scanned.verdict !== "flag" && scanned.verdict !== "severe") return;
            const res = await submitFairPlayScan({
              data: {
                id: `${gameId}-opp`,
                gameId,
                opponent: user.displayName ?? "You",
                color: oppColor,
                variant: config.variant,
                source: "report",
                pgn,
                fenStart: startFenRef.current,
                rating: 1500,
                metrics: scanned.metrics,
                report: scanned,
                kind: "report",
                subjectUserId: peerUserId,
                subjectName: oppName,
              },
            });
            if (res.caseId) {
              toast.message("Opponent flagged for steward review.");
            }
          }).catch(() => {});
        }
      }
    },
    [
      bot.name,
      bot.rating,
      config.opponent,
      config.time,
      config.variant,
      isBotMatch,
      isBotOpponent,
      isCoachMode,
      playerColor,
      settings,
      speakCoach,
      user,
      peerName,
      peerUserId,
    ],
  );

  const applyOutcome = useCallback(
    (pos: Position) => {
      const s = snapshotOf(pos, config.variant);
      if (s.over) {
        void finish(s.winner ?? "draw", s.reason ?? "game over");
        return true;
      }
      return false;
    },
    [config.variant, finish],
  );

  const requestBot = useCallback(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (posRef.current.turn === colorRef.current) return;
      setPhase("bot");
      const thinkStart = performance.now();
      try {
        const pos = posRef.current;
        const res = await botClient.move(fenOf(pos), config.variant, config.bot);
        await botThinkDelay(performance.now() - thinkStart);
        if (phaseRef.current === "over") return;
        const before = clonePos(pos);
        const played = playUci(pos, res.uci);
        if (!played) continue;
        const s = snapshotOf(pos, config.variant);
        const color: Side = before.turn;
        setMoves((m) => {
          const next = [
            ...m,
            {
              uci: res.uci,
              san: played.san,
              fenBefore: fenOf(before),
              fenAfter: s.fen,
              color,
              captured: played.captured as PlayedMove["captured"],
            },
          ];
          movesRef.current = next;
          return next;
        });
        const lm = lastMoveFromUci(res.uci, color);
        setLastMoves((prev) => {
          const next = prev.filter((x) => x.color !== color);
          next.push(lm);
          return next.slice(-2);
        });
        playSfx(
          s.inCheck ? "check" : isDropUci(res.uci) ? "drop" : played.captured ? "capture" : "move",
          settings.theme,
        );
        if (!isDropUci(res.uci) && played.captured && lm.from) {
          triggerCaptureFx(before, lm.from, lm.to);
          setShake(performance.now());
        }
        bumpClockAfterMove(color);
        if (!isDropUci(res.uci) && lm.from) beginMoveSlide(lm.from, lm.to, pos);
        refresh(pos);
        const board = activeBoardStyle(settings.theme, settings.boardStyle, settings.lockThemeAssets);
        await waitAfterBotMove(settings.animations, !!played.captured, board);
        if (!applyOutcome(pos)) setPhase("player");
        return;
      } catch {
        /* retry with a fresh engine boot */
      }
    }
    toast.error("The bot stalled. Try takeback or start a new game.");
    if (posRef.current.turn === colorRef.current) setPhase("player");
    else setPhase("bot");
  }, [
    applyOutcome,
    beginMoveSlide,
    config.bot,
    config.variant,
    refresh,
    settings.boardStyle,
    settings.animations,
    settings.lockThemeAssets,
    settings.theme,
    triggerCaptureFx,
  ]);

  const doMove = useCallback(
    (from: SquareName, to: SquareName, promotion?: Role) => {
      if (phaseRef.current !== "player" && config.opponent !== "local") return;
      const pos = posRef.current;
      if (isPromotionMove(pos, from, to) && !promotion) {
        setPromo({ from, to });
        return;
      }
      const before = clonePos(pos);
      const played = playFromTo(pos, from, to, promotion);
      if (!played) {
        playSfx("illegal", settings.theme);
        return;
      }
      unlockAudio();
      const s = snapshotOf(pos, config.variant);
      const color: Side = before.turn;
      const entry: PlayedMove = {
        uci: played.uci,
        san: played.san,
        fenBefore: fenOf(before),
        fenAfter: s.fen,
        color,
        captured: played.captured as PlayedMove["captured"],
      };
      setMoves((m) => {
        const next = [...m, entry];
        movesRef.current = next;
        return next;
      });
      setLastMoves((prev) => {
        const next = prev.filter((x) => x.color !== color);
        next.push(lastMoveFromUci(played.uci, color));
        return next.slice(-2);
      });
      setSelected(null);
      setPendingDrop(null);
      setPromo(null);
      setHint(null);
      playSfx(
        s.inCheck ? "check" : played.captured ? "capture" : played.san.includes("O-O") ? "castle" : "move",
        settings.theme,
      );
      if (played.captured) {
        triggerCaptureFx(before, from, to);
        setShake(performance.now());
      }
      bumpClockAfterMove(color);
      beginMoveSlide(from, to, pos);
      refresh(pos);

      if (applyOutcome(pos)) return;
      if (config.opponent === "online") {
        sendRef.current({ type: "move", uci: played.uci });
        setPhase("player");
        return;
      }
      if (isBotOpponent && pos.turn !== colorRef.current) {
        void (async () => {
          const board = activeBoardStyle(
            settings.theme,
            settings.boardStyle,
            settings.lockThemeAssets,
          );
          await waitBeforeBotTurn(settings.animations, !!played.captured, board);
          if (phaseRef.current !== "over" && posRef.current.turn !== colorRef.current) {
            void requestBot();
          }
        })();
      } else if (config.opponent === "local" && settings.autoFlip) {
        setOrientation(pos.turn);
        setPhase("player");
      } else {
        setPhase("player");
      }

      if (isCoachMode && color === playerColor) {
        void guideCoachAfterMove(before, played, s.inCheck);
      }
    },
    [
      applyOutcome,
      beginMoveSlide,
      config.opponent,
      config.variant,
      refresh,
      guideCoachAfterMove,
      isBotOpponent,
      isCoachMode,
      playerColor,
      requestBot,
      settings,
      triggerCaptureFx,
    ],
  );

  const performDrop = useCallback(
    (role: Role, to: SquareName, opts?: { remote?: boolean }) => {
      const pos = posRef.current;
      const before = clonePos(pos);
      const played = playDrop(pos, role, to);
      if (!played) {
        if (!opts?.remote) playSfx("illegal", settings.theme);
        return false;
      }
      const color: Side = before.turn;
      const s = snapshotOf(pos, config.variant);
      setMoves((m) => {
        const next = [
          ...m,
          {
            uci: played.uci,
            san: played.san,
            fenBefore: fenOf(before),
            fenAfter: s.fen,
            color,
          },
        ];
        movesRef.current = next;
        return next;
      });
      setLastMoves((prev) => {
        const next = prev.filter((x) => x.color !== color);
        next.push(lastMoveFromUci(played.uci, color));
        return next.slice(-2);
      });
      setPendingDrop(null);
      setSelected(null);
      setHint(null);
      playSfx(s.inCheck ? "check" : "drop", settings.theme);
      bumpClockAfterMove(color);
      refresh(pos);

      if (applyOutcome(pos)) return true;

      if (!opts?.remote && config.opponent === "online") {
        sendRef.current({ type: "drop", role, to });
        setPhase("player");
        return true;
      }

      if (!opts?.remote && isBotOpponent && pos.turn !== colorRef.current) {
        void (async () => {
          const board = activeBoardStyle(
            settings.theme,
            settings.boardStyle,
            settings.lockThemeAssets,
          );
          await waitBeforeBotTurn(settings.animations, false, board);
          if (phaseRef.current !== "over" && posRef.current.turn !== colorRef.current) {
            void requestBot();
          }
        })();
      } else if (config.opponent === "local" && settings.autoFlip) {
        setOrientation(pos.turn);
        if (!opts?.remote) setPhase("player");
      } else if (!opts?.remote) {
        setPhase("player");
      }

      if (isCoachMode && color === playerColor) {
        void guideCoachAfterMove(before, played, s.inCheck);
      }
      return true;
    },
    [
      applyOutcome,
      config.opponent,
      config.variant,
      refresh,
      guideCoachAfterMove,
      isBotOpponent,
      isCoachMode,
      playerColor,
      requestBot,
      settings.animations,
      settings.autoFlip,
      settings.boardStyle,
      settings.lockThemeAssets,
      settings.theme,
    ],
  );

  const applyRemote = useCallback(
    (uci: string) => {
      if (endedRef.current) return;
      const pos = posRef.current;
      const before = clonePos(pos);
      const played = playUci(pos, uci);
      if (!played) return;
      const s = snapshotOf(pos, config.variant);
      const color: Side = before.turn;
      setMoves((m) => {
        const next = [
          ...m,
          {
            uci,
            san: played.san,
            fenBefore: fenOf(before),
            fenAfter: s.fen,
            color,
            captured: played.captured as PlayedMove["captured"],
          },
        ];
        movesRef.current = next;
        return next;
      });
      const lm = lastMoveFromUci(uci, color);
      setLastMoves((prev) => {
        const next = prev.filter((x) => x.color !== color);
        next.push(lm);
        return next.slice(-2);
      });
      playSfx(
        s.inCheck ? "check" : isDropUci(uci) ? "drop" : played.captured ? "capture" : "move",
        settings.theme,
      );
      if (!isDropUci(uci) && played.captured && lm.from) {
        triggerCaptureFx(before, lm.from, lm.to);
        setShake(performance.now());
      }
      bumpClockAfterMove(color);
      if (!isDropUci(uci) && lm.from) beginMoveSlide(lm.from, lm.to, pos);
      refresh(pos);
      if (!applyOutcome(pos)) setPhase("player");
    },
    [applyOutcome, beginMoveSlide, config.variant, refresh, settings.theme, triggerCaptureFx],
  );

  const applyRemoteDrop = useCallback(
    (role: string, to: string) => {
      if (endedRef.current) return;
      performDrop(role as Role, to as SquareName, { remote: true });
    },
    [performDrop],
  );

  const onFriendHello = useCallback(
    (msg: FriendHello) => {
      if (host) return;
      const color: Side = msg.hostColor === "white" ? "black" : "white";
      colorRef.current = color;
      setPlayerColor(color);
      setOrientation(color);
      setConfig((c) => ({
        ...c,
        variant: msg.variant,
        time: msg.time,
        fen: msg.fen,
        opponent: "online",
      }));
      if (msg.name) setPeerName(msg.name);
      if (msg.userId) setPeerUserId(msg.userId);
      const pos = loadPosition(msg.variant, msg.fen);
      startFenRef.current = fenOf(pos);
      posRef.current = pos;
      setSnap(snapshotOf(pos, msg.variant));
      setPhase("player");
    },
    [host],
  );

  const onTakebackRequest = useCallback(() => {
    setTakebackRequest(true);
    toast.message(`${peerName} wants to take back their last move`);
  }, [peerName]);

  const onTakebackAccept = useCallback(() => {
    applyTakeback(1);
    toast.success("Takeback accepted");
  }, [applyTakeback]);

  const onTakebackDecline = useCallback(() => {
    setTakebackWaiting(false);
    toast.message(`${peerName} declined your takeback`);
  }, [peerName]);

  const onFriendIdentity = useCallback((id: FriendIdentity) => {
    if (id.name) setPeerName(id.name);
    if (id.userId) setPeerUserId(id.userId);
  }, []);

  function startMatch() {
    if (accountStatus === "suspended" && config.opponent !== "local") {
      toast.error("Rated and online play are closed while you are suspended.");
      return;
    }
    if (config.opponent === "online" && !isValidRoomCode(config.room ?? "")) {
      toast.error("Enter a valid 6-digit room code.");
      return;
    }
    unlockAudio();
    endedRef.current = false;
    const color: Side =
      config.color === "random" ? (Math.random() < 0.5 ? "white" : "black") : config.color;
    colorRef.current = color;
    setPlayerColor(color);
    setOrientation(color);
    const pos = loadPosition(
      config.variant,
      config.variant === "fromposition" ? fenDraft : config.fen,
    );
    startFenRef.current = fenOf(pos);
    posRef.current = pos;
    setSnap(snapshotOf(pos, config.variant));
    setMoves([]);
    movesRef.current = [];
    setLastMoves([]);
    setAnalysis(null);
    setResultNote(null);
    setFpNote(null);
    setFpReport(null);
    setRatingDelta(null);
    setSelected(null);
    setHint(null);
    setEvalCp(null);
    setTakebackWaiting(false);
    setTakebackRequest(false);
    setStarted(true);
    const t = timeById(config.time);
    const ms = t.baseSec != null ? t.baseSec * 1000 : null;
    setClocks({ white: ms, black: ms });
    playSfx("start", settings.theme);
    if (isBotOpponent) void botClient.prewarm();
    if (isCoachMode) {
      speakCoach(coachLine("greeting"));
    } else {
      setCoachText(null);
    }
    if (config.opponent === "online") {
      setPhase("wait");
    } else if (isBotOpponent && pos.turn !== color) {
      void requestBot();
    } else {
      setPhase("player");
    }
  }

  const autoJoin = useRef(false);
  useEffect(() => {
    if (autoJoin.current) return;
    if (initial?.opponent === "online" && initial.room && initial.onlineMode === "join") {
      autoJoin.current = true;
      startMatch();
    }
    // Join links skip the setup screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (config.opponent !== "online") return;
    if (peerOn && phase === "wait") setPhase("player");
  }, [peerOn, phase, config.opponent]);

  useEffect(() => {
    if (!started || phase === "over" || phase === "wait") return;
    if (time.baseSec == null) return;
    lastTick.current = performance.now();
    let raf = 0;
    let alive = true;
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(250, now - lastTick.current);
      lastTick.current = now;
      if (!endedRef.current) {
        const turn = posRef.current.turn;
        setClocks((c) => {
          if (c.white == null || c.black == null) return c;
          const next = { ...c };
          next[turn] = Math.max(0, (next[turn] ?? 0) - dt);
          if (next[turn] <= 0 && !endedRef.current) {
            void finish(turn === "white" ? "black" : "white", "on time");
          }
          return next;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [started, phase === "over", time.baseSec, finish, phase]);

  const mat = useMemo(() => materialCount(posRef.current), [snap.fen]);
  const captured = useMemo(
    () => capturedFromStart(posRef.current, config.variant),
    [snap.fen, config.variant],
  );

  const reviewSnap = useMemo(() => {
    if (reviewPly == null) return snap;
    const pos = loadPosition(config.variant, startFenRef.current);
    for (let i = 0; i <= reviewPly && i < moves.length; i++) {
      playUci(pos, moves[i]!.uci);
    }
    return snapshotOf(pos, config.variant);
  }, [reviewPly, snap, config.variant, moves]);

  const counts = analysis
    ? {
        great: analysis.filter((a) => a.classification === "great" || a.classification === "brilliant").length,
        good: analysis.filter((a) => a.classification === "good").length,
        mistake: analysis.filter((a) => a.classification === "mistake").length,
        blunder: analysis.filter((a) => a.classification === "blunder").length,
      }
    : null;

  if (!started) {
    return (
      <Setup
        config={config}
        setConfig={setConfig}
        fenDraft={fenDraft}
        setFenDraft={setFenDraft}
        onStart={startMatch}
        onExit={onExit}
        suspended={accountStatus === "suspended"}
      />
    );
  }

  const boardSnap = reviewPly != null ? reviewSnap : snap;
  const myTurn = config.opponent === "local" || snap.turn === playerColor;
  const interactive =
    phase === "player" && myTurn && reviewPly == null && !snap.over;

  const vsLabel = isCoachMode
    ? `Coach · vs ${bot.name}`
    : isBotMatch
      ? `vs ${bot.name}`
      : config.opponent === "online"
        ? `Online · ${config.room ?? "room"}`
        : "Pass and play";

  const lastMove = moves[moves.length - 1];
  const canRequestTakebackOnline =
    config.opponent === "online" &&
    phase === "player" &&
    moves.length > 0 &&
    lastMove?.color === playerColor &&
    !takebackWaiting &&
    !takebackRequest;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {config.opponent === "online" && config.room && (
        <FriendBridge
          key={config.room}
          room={config.room}
          name={user?.displayName ?? "Player"}
          userId={user?.id}
          host={host}
          hello={{
            type: "hello",
            variant: config.variant,
            time: config.time,
            fen: startFenRef.current,
            hostColor: playerColor,
            name: user?.displayName ?? "Player",
            userId: user?.id,
          }}
          onPeer={setPeerOn}
          onHello={onFriendHello}
          onIdentity={onFriendIdentity}
          onMove={applyRemote}
          onDrop={applyRemoteDrop}
          onResign={() => void finish(playerColor, "resignation")}
          onTakebackRequest={onTakebackRequest}
          onTakebackAccept={onTakebackAccept}
          onTakebackDecline={onTakebackDecline}
          registerSend={(fn) => {
            sendRef.current = fn;
          }}
        />
      )}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-display text-lg text-fg">{variant.name}</p>
            <p className="text-sm text-muted">
              {vsLabel} · {time.name}
            </p>
          </div>
          <Badge tone={phase === "bot" ? "warn" : phase === "over" ? "accent" : phase === "wait" ? "warn" : "muted"}>
            {phase === "bot"
              ? `${bot.name} is thinking`
              : phase === "over"
                ? "Game over"
                : phase === "wait"
                  ? "Waiting for friend"
                  : snap.turn === "white"
                    ? "White to move"
                    : "Black to move"}
          </Badge>
        </div>

        {phase === "wait" && (
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4 text-sm">
            <p className="font-medium">Room code {config.room}</p>
            <p className="mt-1 text-muted">
              Share this 6-digit code or the invite link. The game starts when your friend joins — unrated,
              casual.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(config.room ?? "");
                  toast.success("Room code copied");
                }}
              >
                Copy code
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const url = `${window.location.origin}/play?vs=online&room=${config.room}`;
                  void navigator.clipboard.writeText(url);
                  toast.success("Invite link copied");
                }}
              >
                Copy invite link
              </Button>
            </div>
          </div>
        )}

        {takebackRequest && config.opponent === "online" && phase === "player" && (
          <div className="rounded-[var(--radius-md)] border border-accent/40 bg-accent/10 p-4 text-sm">
            <p className="font-medium text-fg">{peerName} wants to take back their last move.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  sendRef.current({ type: "takeback_accept" });
                  applyTakeback(1);
                  setTakebackRequest(false);
                  toast.success("Takeback accepted");
                }}
              >
                Accept
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  sendRef.current({ type: "takeback_decline" });
                  setTakebackRequest(false);
                  toast.message("Takeback declined");
                }}
              >
                Decline
              </Button>
            </div>
          </div>
        )}

        {takebackWaiting && config.opponent === "online" && (
          <p className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm text-muted">
            Takeback requested — waiting for {peerName} to respond.
          </p>
        )}

        <div className="flex items-end gap-3">
          {isBotOpponent && (isCoachMode || phase === "over") ? (
            <div className="hidden h-[min(72vw,640px)] sm:block">
              <EvalBar cp={evalCp} orientation={orientation} />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="mb-2 space-y-1">
              <div className="flex min-h-8 items-center justify-between gap-2">
                <p className="text-sm text-muted">
                  {orientation === "white"
                    ? isBotOpponent
                      ? bot.name
                      : "Black"
                    : "You"}
                </p>
                {settings.showCaptured && !variantHasPockets(config.variant) && (
                  <Captured
                    pieces={captured[orientation === "white" ? "black" : "white"]}
                    color={orientation === "white" ? "white" : "black"}
                    advantage={
                      orientation === "white"
                        ? Math.max(0, mat.black - mat.white)
                        : Math.max(0, mat.white - mat.black)
                    }
                  />
                )}
              </div>
              <Clock
                ms={clocks[orientation === "white" ? "black" : "white"]}
                active={snap.turn !== orientation && phase !== "over" && phase !== "wait"}
                label={orientation === "white" ? "Black" : "White"}
              />
            </div>
            {snap.pocket && (
              <div className="mb-2 space-y-2 rounded-[var(--radius-md)] border border-border bg-surface/70 p-3">
                <p className="text-xs text-muted">
                  Captured pieces go to your hand — tap a piece, then a square.
                </p>
                {(config.opponent === "local"
                  ? (["white", "black"] as Side[])
                  : [playerColor]
                ).map((side) => (
                  <PocketBar
                    key={side}
                    pocket={snap.pocket!}
                    side={side}
                    label={
                      config.opponent === "local"
                        ? side === "white"
                          ? "White hand"
                          : "Black hand"
                        : "In hand"
                    }
                    canUse={
                      interactive &&
                      snap.turn === side &&
                      (config.opponent === "local" || side === playerColor)
                    }
                    pendingDrop={pendingDrop}
                    onPick={(role) => {
                      setSelected(null);
                      setPendingDrop(role);
                    }}
                  />
                ))}
              </div>
            )}
            <ChessBoard
              snap={boardSnap}
              orientation={orientation}
              interactive={interactive}
              showCoords={settings.showCoords}
              markLastMove={settings.markLastMove}
              highlightLegal={settings.highlightLegal}
              lastMoves={lastMoves}
              hint={isCoachMode ? hint : null}
              selected={selected}
              onSelect={setSelected}
              onMove={(f, t) => doMove(f, t)}
              onDrop={(role, to) => {
                if (!interactive) return;
                performDrop(role, to);
              }}
              pendingDrop={pendingDrop}
              shake={settings.animations ? shake : 0}
              captureFx={captureFx}
              onCaptureFxDone={clearCaptureFx}
              moveSlide={settings.animations ? moveSlide : null}
            />
            <div className="mt-2 space-y-1">
              <div className="flex min-h-8 items-center justify-between gap-2">
                <p className="text-sm text-muted">
                  {orientation === playerColor
                    ? "You"
                    : isBotOpponent
                      ? bot.name
                      : "White"}
                </p>
                {settings.showCaptured && !variantHasPockets(config.variant) && (
                  <Captured
                    pieces={captured[orientation]}
                    color={orientation === "white" ? "black" : "white"}
                    advantage={
                      orientation === "white"
                        ? Math.max(0, mat.white - mat.black)
                        : Math.max(0, mat.black - mat.white)
                    }
                  />
                )}
              </div>
              <Clock
                ms={clocks[orientation]}
                active={snap.turn === orientation && phase !== "over" && phase !== "wait"}
                label={orientation === playerColor ? "You" : "White"}
              />
            </div>
          </div>
        </div>

        {snap.checksGiven && (
          <p className="text-sm text-muted">
            Checks · White {snap.checksGiven.white}/3 · Black {snap.checksGiven.black}/3
          </p>
        )}

        {promo && (
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface p-3">
            <span className="text-sm text-muted">Promote to</span>
            {(["queen", "rook", "bishop", "knight"] as Role[]).map((role) => (
              <button
                key={role}
                type="button"
                className="size-12 rounded-[var(--radius-sm)] border border-border bg-elevated p-1"
                onClick={() => doMove(promo.from, promo.to, role)}
              >
                <PieceSvg role={role} color={snap.turn} />
              </button>
            ))}
          </div>
        )}

        {isCoachMode && <CoachBubble text={coachText} onMute={stopSpeaking} />}
      </div>

      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
          >
            <FlipHorizontal2 className="size-4" /> Flip
          </Button>
          {isBotOpponent && (
            <Button
              variant="secondary"
              size="sm"
              disabled={moves.length === 0 || phase === "bot"}
              onClick={() => applyTakeback(2)}
            >
              <RotateCcw className="size-4" /> Takeback
            </Button>
          )}
          {config.opponent === "online" && (
            <Button
              variant="secondary"
              size="sm"
              disabled={!canRequestTakebackOnline}
              onClick={() => {
                sendRef.current({ type: "takeback_request" });
                setTakebackWaiting(true);
                toast.message("Takeback requested");
              }}
            >
              <RotateCcw className="size-4" /> Request takeback
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (config.opponent === "online") sendRef.current({ type: "resign" });
              void finish(playerColor === "white" ? "black" : "white", "resignation");
            }}
            disabled={phase === "over" || phase === "wait"}
          >
            <Flag className="size-4" /> Resign
          </Button>
        </div>
        <MoveList
          moves={moves}
          ply={reviewPly ?? undefined}
          onPly={(i) => setReviewPly(i)}
        />
        {reviewPly != null && (
          <Button variant="secondary" size="sm" onClick={() => setReviewPly(null)}>
            Back to live
          </Button>
        )}
        {phase === "over" && !showResult && (
          <Button variant="secondary" size="sm" onClick={() => setShowResult(true)}>
            Show result
          </Button>
        )}
        <Button variant="ghost" className="w-full" onClick={() => { stopSpeaking(); onExit?.(); setStarted(false); setPhase("idle"); }}>
          Leave board
        </Button>
      </aside>

      {phase === "over" && showResult && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-bg/70 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-[var(--radius-xl)] border border-border bg-surface p-6">
            <h2 className="font-display text-2xl text-fg">
              {resultNote === "resignation"
                ? "Resigned"
                : snap.winner === "draw"
                  ? "Draw"
                  : snap.winner === playerColor
                    ? "You win"
                    : "Defeat"}
            </h2>
            <p className="text-sm text-muted">{resultNote}</p>
            {ratingDelta != null && (
              <p className="font-display text-xl tabular-nums">
                Rating {ratingDelta >= 0 ? "+" : ""}
                {ratingDelta} · now {guestStats().rating}
              </p>
            )}
            {analyzing && <p className="text-sm text-subtle">Reviewing moves…</p>}
            {fpNote && <p className="text-sm text-muted">{fpNote}</p>}
            {fpReport && (
              <div className="rounded-[var(--radius-md)] border border-border bg-elevated p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Shield className="size-4" /> Fair Play
                  <Badge
                    tone={
                      fpReport.verdict === "clean"
                        ? "good"
                        : fpReport.verdict === "watch"
                          ? "warn"
                          : fpReport.verdict === "flag" || fpReport.verdict === "severe"
                            ? "danger"
                            : "muted"
                    }
                  >
                    {verdictLabel(fpReport.verdict)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-subtle">
                  Stockfish {Math.round(fpReport.metrics.stockfish.top1 * 100)}% · risk{" "}
                  {fpReport.risk}
                </p>
              </div>
            )}
            {counts && (
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div className="rounded-[var(--radius-md)] bg-elevated p-3">
                  <div className="font-display text-lg">{counts.great}</div>
                  <div className="text-subtle">Great</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-elevated p-3">
                  <div className="font-display text-lg">{counts.good}</div>
                  <div className="text-subtle">Good</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-elevated p-3">
                  <div className="font-display text-lg text-warn">{counts.mistake}</div>
                  <div className="text-subtle">Mistakes</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-elevated p-3">
                  <div className="font-display text-lg text-danger">{counts.blunder}</div>
                  <div className="text-subtle">Blunders</div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setStarted(false); endedRef.current = false; setPhase("idle"); startMatch(); }}>
                Rematch
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const first = analysis?.find((a) => a.classification === "blunder" || a.classification === "mistake");
                  setReviewPly(first?.ply ?? 0);
                  setShowResult(false);
                }}
              >
                Review mistakes
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadPgn(
                    buildPgn({
                      white: playerColor === "white" ? "You" : bot.name,
                      black: playerColor === "black" ? "You" : bot.name,
                      variant: config.variant,
                      result:
                        snap.winner === "draw" ? "1/2-1/2" : snap.winner === "white" ? "1-0" : "0-1",
                      fen: startFenRef.current,
                      sans: moves.map((m) => m.san),
                      timeControl: config.time,
                    }),
                  )
                }
              >
                Download replay
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStarted(false);
                  setPhase("idle");
                  onExit?.();
                }}
              >
                New game
              </Button>
              {config.opponent === "online" && (
                <Button
                  variant="danger"
                  disabled={reportBusy}
                  onClick={() => {
                    const gameId = gameIdRef.current ?? uid();
                    const ucis = movesRef.current.map((m) => m.uci);
                    if (ucis.length < 8) {
                      toast.error("Need more moves to file a report.");
                      return;
                    }
                    if (!user) {
                      toast.error("Sign in to file a report with the steward.");
                      return;
                    }
                    setReportBusy(true);
                    const oppColor: Side = playerColor === "white" ? "black" : "white";
                    const pgn = buildPgn({
                      white: playerColor === "white" ? (user.displayName ?? "You") : peerName,
                      black: playerColor === "black" ? (user.displayName ?? "You") : peerName,
                      variant: config.variant,
                      result:
                        snap.winner === "draw" ? "1/2-1/2" : snap.winner === "white" ? "1-0" : "0-1",
                      fen: startFenRef.current,
                      sans: movesRef.current.map((m) => m.san),
                      timeControl: config.time,
                    });
                    void scanGame({
                      fenStart: startFenRef.current,
                      ucis,
                      variant: config.variant,
                      color: oppColor,
                      rating: 1500,
                      opponent: user.displayName ?? "You",
                      pgn,
                    })
                      .then(async (scanned) => {
                        const res = await submitFairPlayScan({
                          data: {
                            id: `${gameId}-report`,
                            gameId,
                            opponent: user.displayName ?? "You",
                            color: oppColor,
                            variant: config.variant,
                            source: "report",
                            pgn,
                            fenStart: startFenRef.current,
                            rating: 1500,
                            metrics: scanned.metrics,
                            report: scanned,
                            kind: "report",
                            subjectUserId: peerUserId,
                            subjectName: peerName || "Opponent",
                          },
                        });
                        if (res.caseId) {
                          toast.success("Report sent. A steward must approve any suspension.");
                          setFpNote(
                            `Reported ${peerName || "opponent"} · risk ${res.risk}. Waiting on steward.`,
                          );
                        } else {
                          toast.message(`Recorded as ${verdictLabel(res.verdict)}.`);
                        }
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not report"))
                      .finally(() => setReportBusy(false));
                  }}
                >
                  {reportBusy ? "Scanning opponent…" : "Report opponent"}
                </Button>
              )}
            </div>
            {!user && (
              <p className="text-sm text-muted">
                Sign in to keep rating and history across devices.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Setup({
  config,
  setConfig,
  fenDraft,
  setFenDraft,
  onStart,
  onExit,
  suspended,
}: {
  config: MatchConfig;
  setConfig: (c: MatchConfig) => void;
  fenDraft: string;
  setFenDraft: (s: string) => void;
  onStart: () => void;
  onExit?: () => void;
  suspended?: boolean;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-fg">New game</h1>
          <p className="mt-1 text-muted">Pick a world, a mode, a mind to beat.</p>
        </div>
        {onExit && (
          <Button variant="ghost" onClick={onExit}>
            Back
          </Button>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Opponent</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["bot", "Play a bot", "Rated match — no coach, takebacks allowed."],
              ["coach", "Coach mode", "The coach guides every move you play."],
              ["local", "Pass and play", "Two players, one screen."],
              ["online", "Online friend", "Share a room code — casual, unrated."],
            ] as const
          ).map(([id, label, blurb]) => (
            <button
              key={id}
              type="button"
              onClick={() =>
                setConfig({
                  ...config,
                  opponent: id,
                  onlineMode: id === "online" ? config.onlineMode ?? "create" : config.onlineMode,
                  room:
                    id === "online"
                      ? config.onlineMode === "join"
                        ? ""
                        : config.room && isValidRoomCode(config.room)
                          ? config.room
                          : makeRoomCode()
                      : config.room,
                })
              }
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-3 text-left",
                config.opponent === id
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-elevated text-fg",
              )}
            >
              <div className="text-sm font-medium">{label}</div>
              <p className={cn("mt-1 text-xs", config.opponent === id ? "text-accent-fg/80" : "text-subtle")}>
                {blurb}
              </p>
            </button>
          ))}
        </div>
      </section>

      {config.opponent === "online" && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Online room</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                ["create", "Create room"],
                ["join", "Join with code"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    onlineMode: id,
                    room:
                      id === "create"
                        ? config.room && isValidRoomCode(config.room)
                          ? config.room
                          : makeRoomCode()
                        : "",
                  })
                }
                className={cn(
                  "h-11 rounded-[var(--radius-md)] border px-3 text-sm transition-colors",
                  config.onlineMode === id
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-border bg-elevated text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {config.onlineMode === "create" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex h-11 w-36 items-center justify-center rounded-[var(--radius-md)] border border-border bg-elevated px-3 font-mono text-lg tracking-[0.35em] text-fg tabular-nums"
                  aria-label={`Room code ${config.room}`}
                >
                  {config.room ?? "------"}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfig({ ...config, room: makeRoomCode() })}
                >
                  New code
                </Button>
              </div>
              <p className="text-xs text-subtle">
                Share this 6-digit code. Your friend picks Join with code, enters it, and taps Join —
                casual and unrated.
              </p>
            </>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!isValidRoomCode(config.room ?? "")) {
                  toast.error("Enter a valid 6-digit room code.");
                  return;
                }
                onStart();
              }}
            >
              <div className="flex flex-wrap items-stretch gap-2">
                <input
                  value={config.room ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, room: normalizeRoomCode(e.target.value) })
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  maxLength={6}
                  placeholder="000000"
                  aria-label="Room code"
                  className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-elevated px-3 text-center font-mono text-lg tracking-[0.35em] text-fg tabular-nums sm:max-w-[9rem]"
                />
                <Button
                  type="submit"
                  className="h-11 px-6"
                  disabled={!isValidRoomCode(config.room ?? "")}
                >
                  Join
                </Button>
              </div>
              <p className="text-xs text-subtle">
                Enter your friend&apos;s 6-digit code, then tap Join to enter their room.
              </p>
            </form>
          )}
        </section>
      )}

      {(config.opponent === "bot" || config.opponent === "coach") && (
        <section className="space-y-3">
          <h2 className="font-display text-xl text-fg">
            {config.opponent === "coach" ? "Sparring partner" : "Bot ladder"}
          </h2>
          <p className="text-sm text-muted">
            {config.opponent === "coach"
              ? "Pick an opponent strength. The coach comments on every move you make."
              : "Pick a bot that matches your strength."}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {BOTS.map((b) => {
              const on = config.bot === b.id;
              return (
              <button
                key={b.id}
                type="button"
                onClick={() => setConfig({ ...config, bot: b.id })}
                className={cn(
                  "rounded-[var(--radius-md)] border px-4 py-3 text-left transition-colors",
                  on
                    ? "border-accent bg-accent text-accent-fg shadow-[0_0_0_1px_var(--cm-accent)]"
                    : "border-border bg-surface text-fg hover:bg-elevated",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{b.name}</span>
                  <span className={cn("text-xs tabular-nums", on ? "text-accent-fg/75" : "text-subtle")}>
                    {b.rating}
                  </span>
                </div>
                <p className={cn("mt-1 text-sm", on ? "text-accent-fg/80" : "text-muted")}>{b.blurb}</p>
              </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Mode</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {VARIANTS.map((v) => {
            const on = config.variant === v.id;
            return (
            <button
              key={v.id}
              type="button"
              onClick={() => setConfig({ ...config, variant: v.id })}
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors",
                on
                  ? "border-accent bg-accent text-accent-fg shadow-[0_0_0_1px_var(--cm-accent)]"
                  : "border-border bg-surface text-fg hover:bg-elevated",
              )}
            >
              <div className="text-sm font-medium">{v.name}</div>
              <p className={cn("mt-1 text-xs", on ? "text-accent-fg/80" : "text-subtle")}>{v.blurb}</p>
            </button>
            );
          })}
        </div>
      </section>

      {config.variant === "fromposition" && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted">Starting FEN</h2>
          <textarea
            value={fenDraft}
            onChange={(e) => setFenDraft(e.target.value)}
            className="min-h-20 w-full rounded-[var(--radius-md)] border border-border bg-elevated p-3 font-mono text-xs text-fg"
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Your colour</h2>
        <div className="flex flex-wrap gap-2">
          {(["white", "black", "random"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setConfig({ ...config, color: c })}
              className={cn(
                "h-11 rounded-[var(--radius-md)] border px-4 text-sm capitalize",
                config.color === c
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-elevated",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Time</h2>
        <div className="flex flex-wrap gap-2">
          {TIME_CONTROLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setConfig({ ...config, time: t.id })}
              className={cn(
                "h-11 rounded-[var(--radius-md)] border px-3 text-sm",
                config.time === t.id
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-elevated",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      </section>

      {suspended && config.opponent !== "local" && (
        <p className="rounded-[var(--radius-md)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Your account is suspended. Rated and online play are closed until a steward restores them.
          Pass and play still works.
        </p>
      )}

      {!(config.opponent === "online" && config.onlineMode === "join") && (
        <Button size="lg" className="w-full sm:w-auto" onClick={onStart}>
          {config.opponent === "online" ? "Create & wait" : "Start"}
        </Button>
      )}
    </div>
  );
}

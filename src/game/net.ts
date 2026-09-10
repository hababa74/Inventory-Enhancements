/**
 * Online room layer built on Lovable Cloud Realtime broadcast channels.
 *
 * A room is just a channel named `duel-<CODE>`. The creator is the host
 * (slot 0), the second player is the guest (slot 1). Presence tells us who is
 * in the room, broadcast carries lobby + gameplay messages.
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type GameMsg = Record<string, unknown> & { t: string };

export type NetEvent =
  | { type: "connected"; roomCode: string; you: 0 | 1 }
  | { type: "opponentJoined"; name: string; skin: string }
  | { type: "opponentReady"; ready: boolean }
  | { type: "opponentLeft" }
  | { type: "start" }
  | { type: "error"; message: string }
  | { type: "lost" }
  | { type: "msg"; data: GameMsg };

export interface Peer {
  id: string;
  name: string;
  skin: string;
  ready: boolean;
  host: boolean;
}

function makeCode() {
  const chars = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

class RoomConnection {
  channel: RealtimeChannel | null = null;
  roomCode = "";
  you: 0 | 1 = 0;
  isHost = true;
  name = "PLAYER";
  skin = "cyberblade";
  ready = false;
  opponent: Peer | null = null;
  private listeners = new Set<(e: NetEvent) => void>();
  private id = Math.random().toString(36).slice(2, 10);
  private matchStarted = false;

  get online() {
    return this.channel !== null;
  }

  on(cb: (e: NetEvent) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  private emit(e: NetEvent) {
    this.listeners.forEach((l) => l(e));
  }

  async create(name: string, skin: string) {
    return this.open(makeCode(), true, name, skin);
  }

  /** Join a channel for a match the server already created (fixed roles). */
  async enterMatch(code: string, host: boolean, name: string, skin: string) {
    await this.open(code.toUpperCase(), host, name, skin);
    this.ready = true;
    void this.channel?.track({ id: this.id, name: this.name, skin: this.skin, ready: true, host });
    return code;
  }

  async join(code: string, name: string, skin: string) {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      this.emit({ type: "error", message: "Ungültiger Room-Code (mindestens 4 Zeichen)." });
      throw new Error("invalid room");
    }
    return this.open(clean, false, name, skin);
  }

  private async open(code: string, host: boolean, name: string, skin: string) {
    this.leave();
    this.roomCode = code;
    this.isHost = host;
    this.you = host ? 0 : 1;
    this.name = name || (host ? "HOST" : "GUEST");
    this.skin = skin;
    this.ready = false;
    this.opponent = null;

    const ch = supabase.channel(`duel-${code}`, {
      config: { broadcast: { self: false }, presence: { key: this.id } },
    });
    this.channel = ch;

    ch.on("presence", { event: "sync" }, () => this.syncPresence());
    ch.on("broadcast", { event: "game" }, ({ payload }) => {
      const msg = payload as GameMsg;
      if (msg.t === "start") {
        if (!this.matchStarted) {
          this.matchStarted = true;
          this.emit({ type: "start" });
        }
      } else {
        this.emit({ type: "msg", data: msg });
      }
    });

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("timeout")), 12000);
      ch.subscribe((status) => {
        // Guard: ignore stale callbacks if a newer open() call has replaced the channel
        if (this.channel !== ch) { window.clearTimeout(timer); resolve(); return; }
        if (status === "SUBSCRIBED") {
          window.clearTimeout(timer);
          void ch.track({ id: this.id, name: this.name, skin: this.skin, ready: false, host });
          this.emit({ type: "connected", roomCode: code, you: this.you });
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          window.clearTimeout(timer);
          this.emit({ type: "error", message: "Verbindung zum Room fehlgeschlagen." });
          reject(new Error(status));
        }
      });
    });
    return code;
  }

  private syncPresence() {
    const ch = this.channel;
    if (!ch) return;
    const state = ch.presenceState() as Record<string, Array<Record<string, unknown>>>;
    const peers: Peer[] = [];
    for (const key of Object.keys(state)) {
      const p = state[key]?.[0];
      if (!p) continue;
      peers.push({
        id: String(p["id"] ?? key),
        name: String(p["name"] ?? "PLAYER"),
        skin: String(p["skin"] ?? "cyberblade"),
        ready: Boolean(p["ready"]),
        host: Boolean(p["host"]),
      });
    }
    const other = peers.find((p) => p.id !== this.id) ?? null;
    const had = this.opponent;
    this.opponent = other;
    if (other && (!had || had.id !== other.id)) {
      this.emit({ type: "opponentJoined", name: other.name, skin: other.skin });
    }
    if (!other && had) this.emit({ type: "opponentLeft" });
    if (other && had && other.ready !== had.ready) this.emit({ type: "opponentReady", ready: other.ready });

    // host starts the match once both sides are ready
    if (this.isHost && this.ready && other?.ready) this.startMatch();
  }

  setReady(ready: boolean) {
    this.ready = ready;
    void this.channel?.track({ id: this.id, name: this.name, skin: this.skin, ready, host: this.isHost });
    if (this.isHost && ready && this.opponent?.ready) this.startMatch();
  }

  startMatch() {
    if (!this.channel || this.matchStarted) return;
    this.matchStarted = true;
    const ch = this.channel;
    void ch.send({ type: "broadcast", event: "game", payload: { t: "start" } });
    setTimeout(() => {
      if (this.channel === ch) void ch.send({ type: "broadcast", event: "game", payload: { t: "start" } });
    }, 70);
    setTimeout(() => {
      if (this.channel === ch) void ch.send({ type: "broadcast", event: "game", payload: { t: "start" } });
    }, 140);
    this.emit({ type: "start" });
  }

  send(msg: GameMsg) {
    const ch = this.channel;
    if (!ch) return;
    void ch.send({ type: "broadcast", event: "game", payload: msg });
  }

  leave() {
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.ready = false;
    this.opponent = null;
    this.roomCode = "";
    this.matchStarted = false;
    this.listeners.clear();
  }
}

export const connection = new RoomConnection();

export function roomLink(code: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/?room=${code}`;
}

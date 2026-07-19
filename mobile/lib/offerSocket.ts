import Constants from "expo-constants";

const API_BASE_URL =
  (Constants.expoConfig?.extra?.API_BASE_URL as string) ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000";

const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

const KEEPALIVE_MS = 20_000;
const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

let socket: WebSocket | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = BASE_RECONNECT_MS;
let currentTankerId: number | null = null;
let currentCallback: (() => void) | null = null;
let closedByClient = false;

function clearTimers() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function open() {
  if (currentTankerId == null || !currentCallback) return;

  const tankerId = currentTankerId;
  const onOfferAvailable = currentCallback;
  const ws = new WebSocket(`${WS_BASE_URL}/tankers/${tankerId}/offers/ws`);
  socket = ws;

  ws.onopen = () => {
    reconnectDelay = BASE_RECONNECT_MS;
    keepaliveTimer = setInterval(() => {
      try {
        ws.send("ping");
      } catch {
        // socket already closing — onclose will handle reconnect
      }
    }, KEEPALIVE_MS);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.type === "offer_available") onOfferAvailable();
    } catch {
      // ignore malformed frames
    }
  };

  const scheduleReconnect = () => {
    if (closedByClient || currentTankerId !== tankerId) return;
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
    // Jitter avoids every driver reconnecting in lockstep after a backend restart.
    const jitter = Math.random() * 0.3 * reconnectDelay;
    reconnectTimer = setTimeout(open, reconnectDelay + jitter);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
  };

  ws.onerror = scheduleReconnect;
  ws.onclose = scheduleReconnect;
}

/**
 * Opens (or re-targets) the incoming-offer push channel for a tanker. Safe to
 * call repeatedly — always tears down any prior connection first. This is a
 * best-effort real-time signal only: callers must keep a slower REST backstop
 * poll running alongside it in case the socket dies silently.
 */
export function connect(tankerId: number, onOfferAvailable: () => void) {
  disconnect();
  closedByClient = false;
  currentTankerId = tankerId;
  currentCallback = onOfferAvailable;
  reconnectDelay = BASE_RECONNECT_MS;
  open();
}

export function disconnect() {
  closedByClient = true;
  currentTankerId = null;
  currentCallback = null;
  clearTimers();
  if (socket) {
    const s = socket;
    socket = null;
    s.onopen = null;
    s.onmessage = null;
    s.onerror = null;
    s.onclose = null;
    try {
      s.close();
    } catch {
      // already closed
    }
  }
}

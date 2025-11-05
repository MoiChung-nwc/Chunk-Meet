// utils/WebSocketManager.js (v3.7 – stable, with end-call reconnect fix)
class WebSocketManager {
  constructor(name = "default") {
    this.sockets = new Map();
    this.listeners = new Map();
    this.defaultEndpoint = null;
    this.name = name;
    this.lastToken = null;
  }

  _normalizeEndpoint(endpoint) {
    if (!endpoint) throw new Error("endpoint required");
    return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  }

  _makeEntry(endpoint) {
    return {
      socket: null,
      isOpening: false,
      openQueue: [],
    };
  }

  async connect(endpoint, token, onMessage) {
    endpoint = this._normalizeEndpoint(endpoint);
    this.lastToken = token;

    let entry = this.sockets.get(endpoint);
    if (!entry) {
      entry = this._makeEntry(endpoint);
      this.sockets.set(endpoint, entry);
    }

    if (!this.listeners.has(endpoint)) this.listeners.set(endpoint, new Set());
    if (onMessage) this.listeners.get(endpoint).add(onMessage);

    if (!this.defaultEndpoint) this.defaultEndpoint = endpoint;

    if (entry.socket && entry.socket.readyState === WebSocket.OPEN) {
      console.log(`[WS:${this.name}][${endpoint}] ✅ already open`);
      return true;
    }

    if (entry.isOpening) {
      console.log(`[WS:${this.name}][${endpoint}] ⏳ waiting existing connection`);
      return this.waitUntilReady(endpoint);
    }

    const url = `${this._baseUrl()}${endpoint}?token=${encodeURIComponent(token)}`;
    console.log(`[WS:${this.name}][${endpoint}] 🚀 connecting to ${url}`);

    entry.isOpening = true;
    entry.openQueue = [];
    const ws = new WebSocket(url);
    entry.socket = ws;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn(`[WS:${this.name}][${endpoint}] ⏰ connect timeout`);
        entry.isOpening = false;
        reject(new Error("connect timeout"));
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log(`[WS:${this.name}][${endpoint}] ✅ onopen fired at ${Date.now()}`);
        entry.isOpening = false;

        if (entry.openQueue.length > 0) {
          console.log(`[WS:${this.name}][${endpoint}] ↩️ flushing ${entry.openQueue.length} queued messages`);
          entry.openQueue.forEach((msg) => ws.send(JSON.stringify(msg)));
          entry.openQueue = [];
        }

        resolve(true);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const list = this.listeners.get(endpoint);
          if (list && list.size > 0) {
            list.forEach((cb) => {
              try {
                cb(msg, e);
              } catch (err) {
                console.error(`[WS:${this.name}][${endpoint}] listener error`, err);
              }
            });
          }

          if (msg?.type === "new-message" && typeof window.onNewMessage === "function") {
            try {
              window.onNewMessage(msg);
            } catch (err) {
              console.error(`[WS:${this.name}] window.onNewMessage error`, err);
            }
          }
        } catch (err) {
          console.error(`[WS:${this.name}][${endpoint}] ❌ invalid message`, err);
        }
      };

      ws.onerror = (e) => {
        clearTimeout(timeout);
        entry.isOpening = false;
        console.error(`[WS:${this.name}][${endpoint}] ❌ error`, e);
        reject(e);
      };

      ws.onclose = (e) => {
        clearTimeout(timeout);
        entry.isOpening = false;
        entry.socket = null;
        console.warn(`[WS:${this.name}][${endpoint}] 🚪 closed ${e.code} ${e.reason}`);

        // 🔁 Auto reconnect (trừ khi logout/shutdown/manual)
        if (!["logout", "shutdown", "manual disconnect"].includes(e.reason)) {
          const delay = 1500;
          console.log(`[WS:${this.name}][${endpoint}] 🔁 reconnecting after ${delay}ms...`);
          setTimeout(() => {
            this.connect(endpoint, this.lastToken, null).catch(() => {
              console.warn(`[WS:${this.name}][${endpoint}] ❌ reconnect failed`);
            });
          }, delay);
        }
      };
    });
  }

  async waitUntilReady(endpoint, timeout = 7000) {
    endpoint = this._normalizeEndpoint(endpoint);
    const entry = this.sockets.get(endpoint);
    if (!entry || !entry.socket) return false;
    if (entry.socket.readyState === WebSocket.OPEN) return true;

    console.log(`[WS:${this.name}][${endpoint}] ⏳ waitUntilReady start`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("waitUntilReady timeout")), timeout);
      entry.socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          console.log(`[WS:${this.name}][${endpoint}] 🟢 waitUntilReady resolved`);
          resolve(true);
        },
        { once: true }
      );
    });
  }

  send(obj, endpoint = null) {
    if (!obj) return;
    endpoint = endpoint ? this._normalizeEndpoint(endpoint) : this.defaultEndpoint;
    const entry = this.sockets.get(endpoint);

    if (!entry || !entry.socket) {
      console.warn(`[WS:${this.name}][${endpoint}] ⚠️ socket not initialized, dropping ${obj.type}`);
      return;
    }

    const readyState = entry.socket.readyState;
    const stateName = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][readyState];
    console.log(`[WS:${this.name}][${endpoint}] 📨 send(${obj.type}) state=${stateName}`);

    if (readyState === WebSocket.OPEN) {
      entry.socket.send(JSON.stringify(obj));
    } else if (readyState === WebSocket.CONNECTING) {
      console.warn(`[WS:${this.name}][${endpoint}] ⏳ not open yet, queueing '${obj.type}'`);
      entry.openQueue.push(obj);
    } else {
      console.warn(`[WS:${this.name}][${endpoint}] ❌ cannot send, socket closed`);
    }
  }

  removeListener(endpoint, onMessage) {
    endpoint = this._normalizeEndpoint(endpoint);
    const set = this.listeners.get(endpoint);
    if (set) set.delete(onMessage);
  }

  disconnect(endpoint, reason = "manual disconnect") {
    endpoint = this._normalizeEndpoint(endpoint);
    const entry = this.sockets.get(endpoint);
    if (!entry?.socket) return;

    console.log(`[WS:${this.name}][${endpoint}] 🔻 disconnect: ${reason}`);

    if (this.name === "chat" && endpoint === "/ws/chat" && !["logout", "shutdown"].includes(reason)) {
      console.log(`[WS:${this.name}][${endpoint}] ⚠️ Skip closing socket (keep alive for chat)`);
      this.listeners.delete(endpoint);
      return;
    }

    entry.socket.close(1000, reason);
    this.sockets.delete(endpoint);
    this.listeners.delete(endpoint);
    console.log(`[WS:${this.name}][${endpoint}] ✅ closed safely`);
  }

  isConnected(endpoint = null) {
    endpoint = endpoint ? this._normalizeEndpoint(endpoint) : this.defaultEndpoint;
    const entry = this.sockets.get(endpoint);
    return !!(entry?.socket && entry.socket.readyState === WebSocket.OPEN);
  }

  _baseUrl() {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host.startsWith("127.");
    return isLocal
      ? "ws://localhost:8081"
      : `${window.location.protocol.replace("http", "ws")}//${window.location.host}`;
  }
}

// 🔹 Instances
export const wsManager = new WebSocketManager("main");
export const wsMeetingManager = new WebSocketManager("meeting");
export const wsChatManager = new WebSocketManager("chat");
export default wsManager;

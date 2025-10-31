// utils/WebSocketManager.js (v3.0 — stable version)
class WebSocketManager {
  constructor() {
    this.sockets = new Map();
    this.defaultEndpoint = null;
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
      onMessage: null,
    };
  }

  async connect(endpoint, token, onMessage) {
    endpoint = this._normalizeEndpoint(endpoint);
    let entry = this.sockets.get(endpoint);
    if (!entry) {
      entry = this._makeEntry(endpoint);
      this.sockets.set(endpoint, entry);
    }

    if (!this.defaultEndpoint) this.defaultEndpoint = endpoint;
    entry.onMessage = onMessage;

    if (entry.socket && entry.socket.readyState === WebSocket.OPEN) {
      console.log(`[WS][${endpoint}] ✅ already open`);
      return true;
    }

    if (entry.isOpening) {
      console.log(`[WS][${endpoint}] ⏳ waiting existing connection`);
      return this.waitUntilReady(endpoint);
    }

    const url = `${this._baseUrl()}${endpoint}?token=${encodeURIComponent(token)}`;
    console.log(`[WS][${endpoint}] 🚀 connecting to ${url}`);

    entry.isOpening = true;
    const ws = new WebSocket(url);
    entry.socket = ws;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn(`[WS][${endpoint}] ⏰ connect timeout`);
        entry.isOpening = false;
        reject(new Error("connect timeout"));
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log(`[WS][${endpoint}] ✅ onopen fired at ${Date.now()}`);
        entry.isOpening = false;

        if (entry.openQueue.length > 0) {
          console.log(`[WS][${endpoint}] ↩️ flushing ${entry.openQueue.length} queued messages`);
          entry.openQueue.forEach((msg) => {
            ws.send(JSON.stringify(msg));
            console.log(`[WS][${endpoint}] → flushed ${msg.type}`);
          });
          entry.openQueue = [];
        }
        resolve(true);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (entry.onMessage) entry.onMessage(msg, e);
        } catch (err) {
          console.error(`[WS][${endpoint}] ❌ invalid message`, err);
        }
      };

      ws.onerror = (e) => {
        clearTimeout(timeout);
        entry.isOpening = false;
        console.error(`[WS][${endpoint}] ❌ error`, e);
        reject(e);
      };

      ws.onclose = (e) => {
        clearTimeout(timeout);
        entry.isOpening = false;
        entry.socket = null;
        console.warn(`[WS][${endpoint}] 🚪 closed ${e.code} ${e.reason}`);
      };
    });
  }

  async waitUntilReady(endpoint, timeout = 7000) {
    endpoint = this._normalizeEndpoint(endpoint);
    const entry = this.sockets.get(endpoint);
    if (!entry || !entry.socket) return false;

    if (entry.socket.readyState === WebSocket.OPEN) return true;

    console.log(`[WS][${endpoint}] ⏳ waitUntilReady start (state=${entry.socket.readyState})`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("waitUntilReady timeout"));
      }, timeout);

      entry.socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          console.log(`[WS][${endpoint}] 🟢 waitUntilReady resolved`);
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
    const stateName = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][entry?.socket?.readyState ?? 3];
    console.log(`[WS][${endpoint}] 📨 send(${obj.type}) state=${stateName}`);

    if (entry?.socket && entry.socket.readyState === WebSocket.OPEN) {
      entry.socket.send(JSON.stringify(obj));
    } else {
      console.warn(`[WS][${endpoint}] ⏳ not open, queueing '${obj.type}'`);
      entry?.openQueue?.push(obj);
    }
  }

  close(endpoint) {
    endpoint = this._normalizeEndpoint(endpoint);
    const entry = this.sockets.get(endpoint);
    if (entry?.socket) {
      console.log(`[WS][${endpoint}] 🔻 closing`);
      entry.socket.close(1000, "manual close");
      this.sockets.delete(endpoint);
    }
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

export const wsManager = new WebSocketManager();
export default wsManager;

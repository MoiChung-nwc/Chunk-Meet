class WebSocketManager {
  constructor(name = "default") {
    this.name = name;
    this.sockets = new Map();
    this.listeners = new Map();
    this.defaultEndpoint = null;
    this.lastToken = null;
  }

  _normalizeEndpoint(endpoint) {
    if (!endpoint) throw new Error("endpoint required");
    return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  }

  _makeEntry() {
    return {
      socket: null,
      isOpening: false,
      openQueue: [],
      lastConnect: 0,
    };
  }


  async connect(endpoint, token, onMessage = null, force = false) {
    endpoint = this._normalizeEndpoint(endpoint);
    this.lastToken = token;
    let entry = this.sockets.get(endpoint);

    if (!entry) {
      entry = this._makeEntry();
      this.sockets.set(endpoint, entry);
    }

    // 🧩 Gắn listener an toàn, không trùng
    if (onMessage) {
      if (!this.listeners.has(endpoint)) this.listeners.set(endpoint, new Set());
      const set = this.listeners.get(endpoint);
      if (![...set].includes(onMessage)) set.add(onMessage);
    }

    if (!this.defaultEndpoint) this.defaultEndpoint = endpoint;

    // 🔁 Nếu socket đã mở và không force
    if (entry.socket && entry.socket.readyState === WebSocket.OPEN && !force) {
      console.log(`[WS:${this.name}][${endpoint}] ✅ already open`);
      return true;
    }

    // 🧱 Chặn double connect trong vòng 1 giây
    const now = Date.now();
    if (now - entry.lastConnect < 1000 && entry.isOpening) {
      console.log(`[WS:${this.name}][${endpoint}] ⏳ skipping duplicate connect`);
      return this.waitUntilReady(endpoint);
    }
    entry.lastConnect = now;

    entry.isOpening = true;
    const url = `${this._baseUrl()}${endpoint}?token=${encodeURIComponent(token)}`;
    console.log(`[WS:${this.name}][${endpoint}] 🚀 connecting to ${url}`);

    const ws = new WebSocket(url);
    entry.socket = ws;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        entry.isOpening = false;
        reject(new Error("connect timeout"));
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timeout);
        entry.isOpening = false;
        console.log(`[WS:${this.name}][${endpoint}] ✅ onopen`);

        // Gửi queue
        if (entry.openQueue.length > 0) {
          entry.openQueue.forEach((m) => ws.send(JSON.stringify(m)));
          entry.openQueue = [];
        }

        // 🔁 Chat auto-sync
        if (this.name === "chat" && endpoint === "/ws/chat") {
          console.log(`[WS:${this.name}] 🔁 Auto-sync groups & online users`);
          setTimeout(() => {
            this.send({ type: "request-online-users" }, "/ws/chat");
            this.send({ type: "request-sync" }, "/ws/chat");
          }, 500);
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

        // 🔁 Auto reconnect nhẹ
        if (!["logout", "shutdown", "manual disconnect"].includes(e.reason)) {
          const delay = 1500;
          console.log(`[WS:${this.name}][${endpoint}] 🔁 reconnect after ${delay}ms`);
          setTimeout(() => {
            this.connect(endpoint, this.lastToken, null).catch(() => {
              console.warn(`[WS:${this.name}][${endpoint}] ❌ reconnect failed`);
            });
          }, delay);
        }
      };
    });
  }


  send(obj, endpoint = null) {
    if (!obj) return;
    endpoint = endpoint ? this._normalizeEndpoint(endpoint) : this.defaultEndpoint;
    const entry = this.sockets.get(endpoint);
    if (!entry || !entry.socket) {
      console.warn(`[WS:${this.name}][${endpoint}] ⚠️ socket not ready`);
      return;
    }

    const ws = entry.socket;
    const state = ws.readyState;
    const stateName = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][state];
    console.log(`[WS:${this.name}][${endpoint}] 📨 send(${obj.type}) state=${stateName}`);

    if (state === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    else if (state === WebSocket.CONNECTING) {
      entry.openQueue.push(obj);
      console.log(`[WS:${this.name}][${endpoint}] ⏳ queued '${obj.type}'`);
    } else console.warn(`[WS:${this.name}][${endpoint}] ❌ cannot send, socket closed`);
  }


  async waitUntilReady(endpoint, timeout = 6000) {
    endpoint = this._normalizeEndpoint(endpoint);
    const entry = this.sockets.get(endpoint);
    if (!entry?.socket) return false;
    if (entry.socket.readyState === WebSocket.OPEN) return true;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("waitUntilReady timeout")), timeout);
      entry.socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve(true);
        },
        { once: true }
      );
    });
  }


  removeListener(endpoint, onMessage = null) {
    endpoint = this._normalizeEndpoint(endpoint);
    const set = this.listeners.get(endpoint);
    if (set) {
      if (onMessage) set.delete(onMessage);
      else set.clear();
    }
  }

  disconnect(endpoint, reason = "manual disconnect") {
    endpoint = this._normalizeEndpoint(endpoint);
    const entry = this.sockets.get(endpoint);
    if (!entry?.socket) return;

    console.log(`[WS:${this.name}][${endpoint}] 🔻 disconnect: ${reason}`);

    if (this.name === "chat" && endpoint === "/ws/chat" && !["logout", "shutdown"].includes(reason)) {
      console.log(`[WS:${this.name}][${endpoint}] ⚠️ skip manual close (keep-alive chat)`);
      this.listeners.delete(endpoint);
      return;
    }

    entry.socket.close(1000, reason);
    this.sockets.delete(endpoint);
    this.listeners.delete(endpoint);
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

export const wsManager = new WebSocketManager("main");
export const wsMeetingManager = new WebSocketManager("meeting");
export const wsChatManager = new WebSocketManager("chat");
export default wsManager;

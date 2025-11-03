// utils/WebSocketManager.js (v3.3 – fixed multi-listener)
class WebSocketManager {
  constructor(name = "default") {
    this.sockets = new Map();
    this.listeners = new Map(); // ✅ NEW: hỗ trợ nhiều callback cho cùng endpoint
    this.defaultEndpoint = null;
    this.name = name;
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
    let entry = this.sockets.get(endpoint);
    if (!entry) {
      entry = this._makeEntry(endpoint);
      this.sockets.set(endpoint, entry);
    }

    // ✅ Đăng ký thêm listener mới thay vì ghi đè
    if (!this.listeners.has(endpoint)) this.listeners.set(endpoint, new Set());
    if (onMessage) this.listeners.get(endpoint).add(onMessage);

    if (!this.defaultEndpoint) this.defaultEndpoint = endpoint;

    // Nếu socket đã mở
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

        // Flush queue
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
          // ✅ Gọi tất cả listener cho endpoint này
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

          // Gọi callback toàn cục nếu có
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
      };
    });
  }

  async waitUntilReady(endpoint, timeout = 7000) {
    endpoint = this._normalizeEndpoint(endpoint);
    const entry = this.sockets.get(endpoint);
    if (!entry || !entry.socket) return false;

    if (entry.socket.readyState === WebSocket.OPEN) return true;
    console.log(`[WS:${this.name}][${endpoint}] ⏳ waitUntilReady start (state=${entry.socket.readyState})`);
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
    const stateName = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][entry?.socket?.readyState ?? 3];
    console.log(`[WS:${this.name}][${endpoint}] 📨 send(${obj.type}) state=${stateName}`);

    if (entry?.socket && entry.socket.readyState === WebSocket.OPEN) {
      entry.socket.send(JSON.stringify(obj));
    } else {
      console.warn(`[WS:${this.name}][${endpoint}] ⏳ not open, queueing '${obj.type}'`);
      entry?.openQueue?.push(obj);
    }
  }

  // ✅ Cho phép gỡ listener riêng
  removeListener(endpoint, onMessage) {
    endpoint = this._normalizeEndpoint(endpoint);
    const set = this.listeners.get(endpoint);
    if (set) set.delete(onMessage);
  }

  disconnect(endpoint, reason = "manual disconnect") {
    endpoint = this._normalizeEndpoint(endpoint);
    const entry = this.sockets.get(endpoint);
    if (entry?.socket) {
      console.log(`[WS:${this.name}][${endpoint}] 🔻 disconnect: ${reason}`);
      entry.socket.close(1000, reason);
      this.sockets.delete(endpoint);
      this.listeners.delete(endpoint);
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

// 🔹 Instance cho từng mục
export const wsManager = new WebSocketManager("main");
export const wsMeetingManager = new WebSocketManager("meeting");
export const wsChatManager = new WebSocketManager("chat");

export default wsManager;

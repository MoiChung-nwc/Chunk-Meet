// utils/WebSocketManager.js (v3.2 — normalized and stable)
class WebSocketManager {
  constructor(name = "default") {
    this.sockets = new Map();
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

    // Nếu socket đã mở, không reconnect
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

    // ⚠️ Reset queue cũ để tránh gửi nhầm “leave” từ phiên trước
    entry.openQueue = [];

    entry.isOpening = true;
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

        // Flush queue sau khi kết nối thành công
        if (entry.openQueue.length > 0) {
          console.log(`[WS:${this.name}][${endpoint}] ↩️ flushing ${entry.openQueue.length} queued messages`);
          entry.openQueue.forEach((msg) => {
            // ✅ Normalize meetingCode nếu có
            if (msg.meetingCode) {
              msg.meetingCode = msg.meetingCode.trim().toLowerCase();
            }
            ws.send(JSON.stringify(msg));
            console.log(`[WS:${this.name}][${endpoint}] → flushed ${msg.type}`);
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

    // ✅ Normalize meetingCode về lowercase trước khi gửi
    if (obj.meetingCode) {
      obj.meetingCode = obj.meetingCode.trim().toLowerCase();
    }

    if (entry?.socket && entry.socket.readyState === WebSocket.OPEN) {
      entry.socket.send(JSON.stringify(obj));
    } else {
      console.warn(`[WS:${this.name}][${endpoint}] ⏳ not open, queueing '${obj.type}'`);
      // ✅ Normalize luôn khi queue
      if (obj.meetingCode) {
        obj.meetingCode = obj.meetingCode.trim().toLowerCase();
      }
      entry?.openQueue?.push(obj);
    }
  }

  close(endpoint) {
    endpoint = this._normalizeEndpoint(endpoint);
    const entry = this.sockets.get(endpoint);
    if (entry?.socket) {
      console.log(`[WS:${this.name}][${endpoint}] 🔻 closing`);
      entry.socket.close(1000, "manual close");
      this.sockets.delete(endpoint);
    }
  }

  disconnect(endpoint, reason = "manual disconnect") {
    endpoint = this._normalizeEndpoint(endpoint);
    const entry = this.sockets.get(endpoint);
    if (entry?.socket) {
      console.log(`[WS:${this.name}][${endpoint}] 🔻 disconnect: ${reason}`);
      entry.socket.close(1000, reason);
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

// 🔹 Instance mặc định (cho signaling chung hoặc dashboard)
export const wsManager = new WebSocketManager("main");

// 🔹 Instance riêng biệt cho group meeting
export const wsMeetingManager = new WebSocketManager("meeting");

// 🔹 Instance riêng cho chat realtime (nếu cần)
export const wsChatManager = new WebSocketManager("chat");

export default wsManager;

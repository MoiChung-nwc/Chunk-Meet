class WebSocketManager {
  constructor(name = "default") {
    this.name = name;
    this.sockets = new Map();     // endpoint -> { socket, isOpening, openQueue, lastConnect }
    this.listeners = new Map();   // endpoint -> Set<callback>
    this.defaultEndpoint = null;
    this.lastToken = null;
  }

  /** 🔧 Chuẩn hóa endpoint */
  _normalizeEndpoint(endpoint) {
    if (!endpoint) throw new Error("endpoint required");
    return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  }

  /** 🏗️ Tạo entry mặc định cho mỗi endpoint */
  _makeEntry() {
    return {
      socket: null,
      isOpening: false,
      openQueue: [],
      lastConnect: 0,
    };
  }

  /** 🚀 Kết nối WebSocket với JWT token */
  async connect(endpoint, token, onMessage = null, force = false) {
    endpoint = this._normalizeEndpoint(endpoint);
    this.lastToken = token;
    let entry = this.sockets.get(endpoint);

    if (!entry) {
      entry = this._makeEntry();
      this.sockets.set(endpoint, entry);
    }

    // Gắn listener (tránh trùng)
    if (onMessage) {
      if (!this.listeners.has(endpoint)) this.listeners.set(endpoint, new Set());
      const set = this.listeners.get(endpoint);
      if (![...set].includes(onMessage)) set.add(onMessage);
    }

    if (!this.defaultEndpoint) this.defaultEndpoint = endpoint;

    // Nếu socket đang mở sẵn
    if (entry.socket && entry.socket.readyState === WebSocket.OPEN && !force) {
      console.log(`[WS:${this.name}][${endpoint}] ✅ already open`);
      return true;
    }

    // ⛔ Chống double connect spam
    const now = Date.now();
    if (now - entry.lastConnect < 1000 && entry.isOpening) {
      console.log(`[WS:${this.name}][${endpoint}] ⏳ skipping duplicate connect`);
      return this.waitUntilReady(endpoint);
    }
    entry.lastConnect = now;
    entry.isOpening = true;

    // Tạo WebSocket URL
    const url = `${this._baseUrl()}${endpoint}?token=${encodeURIComponent(token)}`;
    console.log(`[WS:${this.name}][${endpoint}] 🚀 connecting to ${url}`);

    // 🧹 Đóng socket cũ nếu tồn tại (tránh 2 socket cùng mở)
    if (entry.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(entry.socket.readyState)) {
      console.warn(`[WS:${this.name}][${endpoint}] 🔌 closing old socket before reconnect`);
      try {
        entry.socket.close(1000, "reconnect");
      } catch (err) {
        console.error(`[WS:${this.name}][${endpoint}] ⚠️ failed to close old socket`, err);
      }
      entry.socket = null;
    }

    const ws = new WebSocket(url);
    entry.socket = ws;

    console.log(`[WS:${this.name}] 🔍 Active sockets:`, [...this.sockets.keys()]);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        entry.isOpening = false;
        reject(new Error("connect timeout"));
      }, 8000);

      /** 🟢 Khi mở thành công */
      ws.onopen = () => {
        clearTimeout(timeout);
        entry.isOpening = false;
        console.log(`[WS:${this.name}][${endpoint}] ✅ onopen`);

        // Gửi tất cả message đang pending
        if (entry.openQueue.length > 0) {
          entry.openQueue.forEach((m) => ws.send(JSON.stringify(m)));
          entry.openQueue = [];
        }

        // 💬 Chat auto-sync
        if (this.name === "chat" && endpoint === "/ws/chat") {
          console.log(`[WS:${this.name}] 🔁 Auto-sync groups & online users`);
          setTimeout(() => {
            this.send({ type: "request-online-users" }, "/ws/chat");
            this.send({ type: "request-sync" }, "/ws/chat");
          }, 500);
        }

        // 🎥 Meeting signaling
        if (this.name === "meeting" && endpoint === "/ws/meeting") {
          console.log(`[WS:${this.name}] 🔁 Ready to sync meeting events`);
        }

        // 📁 File signaling
        if (this.name === "file" && endpoint === "/ws/file") {
          console.log(`[WS:${this.name}] 📂 File signaling ready`);

          // ✅ Auto join lại file-room nếu đang trong meeting
          const meetingCode = sessionStorage.getItem("activeMeetingCode");
          if (meetingCode) {
            console.log(`[WS:${this.name}] 📎 Auto-join file room for meeting ${meetingCode}`);
            this.send({ type: "join-file-room", meetingCode }, "/ws/file");
          }
        }

        resolve(true);
      };

      /** 💬 Nhận message từ server */
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

      /** ❌ Xử lý lỗi kết nối */
      ws.onerror = (e) => {
        clearTimeout(timeout);
        entry.isOpening = false;
        console.error(`[WS:${this.name}][${endpoint}] ❌ error`, e);
        reject(e);
      };

      /** 🔌 Khi socket đóng */
      ws.onclose = (e) => {
        clearTimeout(timeout);
        entry.isOpening = false;
        entry.socket = null;
        console.warn(`[WS:${this.name}][${endpoint}] 🚪 closed ${e.code} ${e.reason}`);

        // 🔁 Auto reconnect cho chat, file, meeting
        if (
          ["chat", "file", "meeting"].includes(this.name) &&
          !["logout", "shutdown", "manual disconnect"].includes(e.reason)
        ) {
          const delay = 1500;
          console.log(`[WS:${this.name}][${endpoint}] 🔁 reconnect after ${delay}ms`);
          setTimeout(() => {
            this.connect(endpoint, this.lastToken, null).catch(() => {
              console.warn(`[WS:${this.name}][${endpoint}] ❌ reconnect failed`);
            });
          }, delay);
        } else {
          console.log(`[WS:${this.name}][${endpoint}] 🚫 closed manually`);
        }
      };
    });
  }

  /** 📨 Gửi message qua socket */
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

    if (state === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    } else if (state === WebSocket.CONNECTING) {
      entry.openQueue.push(obj);
      console.log(`[WS:${this.name}][${endpoint}] ⏳ queued '${obj.type}'`);
    } else {
      console.warn(`[WS:${this.name}][${endpoint}] ❌ cannot send, socket closed`);
    }
  }

  /** ⏳ Chờ socket mở */
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

  /** 🧹 Xóa listener */
  removeListener(endpoint, onMessage = null) {
    endpoint = this._normalizeEndpoint(endpoint);
    const set = this.listeners.get(endpoint);
    if (set) {
      if (onMessage) set.delete(onMessage);
      else set.clear();
    }
  }

  /** 🔻 Ngắt kết nối */
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

    try {
      entry.socket.close(1000, reason);
    } catch (e) {
      console.warn(`[WS:${this.name}][${endpoint}] ⚠️ error closing socket`, e);
    }

    this.sockets.delete(endpoint);
    this.listeners.delete(endpoint);
  }

  /** 🔍 Kiểm tra đã kết nối chưa */
  isConnected(endpoint = null) {
    endpoint = endpoint ? this._normalizeEndpoint(endpoint) : this.defaultEndpoint;
    const entry = this.sockets.get(endpoint);
    return !!(entry?.socket && entry.socket.readyState === WebSocket.OPEN);
  }

  /** 🌍 Base URL động */
  _baseUrl() {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host.startsWith("127.");
    return isLocal
      ? "ws://localhost:8081"
      : `${window.location.protocol.replace("http", "ws")}//${window.location.host}`;
  }
}

/* 🧩 Export các manager chuyên biệt */
export const wsManager = new WebSocketManager("main");
export const wsMeetingManager = new WebSocketManager("meeting");
export const wsChatManager = new WebSocketManager("chat");
export const wsFileManager = new WebSocketManager("file");

export default wsManager;

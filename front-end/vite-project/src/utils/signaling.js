export const createSignalingSocket = (token, onMessage) => {
  if (!token) throw new Error("createSignalingSocket: token required");
  const encoded = encodeURIComponent(token);
  const url = `ws://localhost:8081/ws/signaling?token=${encoded}`;

  if (window.signalingSocket && window.signalingSocket._token === token) {
    const sock = window.signalingSocket;
    if (onMessage) sock._onMessage = onMessage;
    return makeApi(sock);
  }

  const sock = new WebSocket(url);
  sock._token = token;
  sock._onMessage = onMessage;
  sock._openQueue = [];
  sock._retry = 0;

  let readyResolve, readyReject;
  sock._readyPromise = new Promise((res, rej) => {
    readyResolve = res;
    readyReject = rej;
  });

  sock.onopen = () => {
    console.log("[Signaling] ✅ Connected");
    sock._openQueue.forEach((m) => sock.send(JSON.stringify(m)));
    sock._openQueue = [];
    readyResolve(true);
  };

  sock.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (typeof sock._onMessage === "function") sock._onMessage(msg);
    } catch (e) {
      console.error("[Signaling] invalid JSON:", ev.data);
    }
  };

  sock.onerror = (e) => {
    console.error("[Signaling] ⚠️ Error:", e);
    readyReject(e);
  };

  sock.onclose = (ev) => {
    console.warn("[Signaling] ❌ Closed:", ev.code, ev.reason);
    if (window.signalingSocket === sock) delete window.signalingSocket;
    if (!ev.wasClean && sock._retry < 3) {
      setTimeout(() => {
        console.log("[Signaling] 🔁 Reconnecting...");
        createSignalingSocket(token, sock._onMessage);
        sock._retry++;
      }, 1500);
    }
  };

  window.signalingSocket = sock;
  return makeApi(sock);
};

function makeApi(sock) {
  const send = (msg) => {
    if (!msg) return;
    if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(msg));
    else sock._openQueue.push(msg);
  };
  const close = (reason = "Manual close") => {
    try {
      if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(sock.readyState))
        sock.close(1000, reason);
    } catch (e) {
      console.warn("[Signaling] close error", e);
    }
  };
  return { socket: sock, send, close, ready: sock._readyPromise };
}

export const setSignalingHandler = (fn) => {
  if (window.signalingSocket) window.signalingSocket._onMessage = fn;
};
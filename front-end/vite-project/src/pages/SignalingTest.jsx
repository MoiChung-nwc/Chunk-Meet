import React, { useState, useEffect, useRef } from "react";

const SignalingTest = () => {
  const [token, setToken] = useState("");
  const [roomId, setRoomId] = useState("room123");
  const [ws, setWs] = useState(null);
  const [logs, setLogs] = useState([]);
  const messageRef = useRef(null);

  const addLog = (msg) =>
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const connectWebSocket = () => {
    if (!token) {
      alert("Vui lòng nhập JWT token!");
      return;
    }

    const socket = new WebSocket(`ws://localhost:8081/ws/signaling?token=${token}`);

    socket.onopen = () => {
      addLog("✅ WebSocket connected");
      socket.send(JSON.stringify({ type: "join", roomId }));
      addLog(`📩 Sent join request for room: ${roomId}`);
    };

    socket.onmessage = (event) => {
      addLog(`📨 Received: ${event.data}`);
    };

    socket.onclose = () => {
      addLog("❌ WebSocket closed");
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      addLog("⚠️ WebSocket error occurred");
    };

    setWs(socket);
  };

  const sendMessage = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert("WebSocket chưa kết nối!");
      return;
    }

    try {
      const msg = JSON.parse(messageRef.current.value);
      ws.send(JSON.stringify(msg));
      addLog(`📤 Sent: ${JSON.stringify(msg)}`);
    } catch (err) {
      alert("JSON không hợp lệ!");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto text-gray-800">
      <h2 className="text-2xl font-bold mb-4">🔗 WebSocket Signaling Test</h2>

      <div className="mb-4">
        <label className="block mb-1">JWT Token:</label>
        <textarea
          className="w-full p-2 border rounded"
          rows="3"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <label className="block mb-1">Room ID:</label>
        <input
          className="w-full p-2 border rounded"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
      </div>

      <button
        onClick={connectWebSocket}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Kết nối WebSocket
      </button>

      <div className="mt-6">
        <label className="block mb-1">Gửi JSON message:</label>
        <textarea
          ref={messageRef}
          className="w-full p-2 border rounded"
          rows="4"
          placeholder={`Ví dụ:\n{\n  "type": "offer",\n  "roomId": "room123",\n  "to": "userB@gmail.com",\n  "sdp": "v=0..."\n}`}
        />
        <button
          onClick={sendMessage}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Gửi
        </button>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">📜 Logs:</h3>
        <div className="bg-gray-100 p-3 rounded h-60 overflow-auto font-mono text-sm">
          {logs.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SignalingTest;

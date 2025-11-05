import React, { useEffect, useState, useRef, useCallback } from "react";
import { IoSend, IoArrowBackSharp } from "react-icons/io5";
import { FaPhone } from "react-icons/fa";
import axios from "axios";
import { wsChatManager, wsManager } from "../../utils/WebSocketManager";

const joinedRooms = new Set();
const messageCache = {}; // ✅ Cache tin nhắn theo conversationId

const ChatWindow = ({ user, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  const token = sessionStorage.getItem("accessToken");
  const email =
    sessionStorage.getItem("email") ||
    JSON.parse(localStorage.getItem("user") || "{}").email;

  const ts = () => new Date().toLocaleTimeString("vi-VN");

  /** 📥 Xử lý tất cả message từ WebSocket */
  const handleMessage = (msg) => {
    console.log(`[ChatWindow ${ts()}] 📨 WS message:`, msg);
    switch (msg.type) {
      case "chat-history":
        console.log(
          `[ChatWindow ${ts()}] 🧾 Received chat-history (${msg.messages?.length || 0} messages)`
        );
        setMessages(msg.messages || []);
        messageCache[msg.conversationId] = msg.messages || [];
        break;

      case "chat":
        if (msg.conversationId === user.conversationId) {
          setMessages((prev) => {
            const exists = prev.some(
              (m) =>
                m.timestamp === msg.timestamp &&
                m.sender === msg.sender &&
                m.message === msg.message
            );
            const next = exists ? prev : [...prev, msg];
            messageCache[user.conversationId] = next;
            return next;
          });
        }
        break;

      case "typing":
        if (msg.from === user.email) {
          setIsTyping(true);
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
        }
        break;

      /** ✅ Cập nhật trạng thái online qua danh sách */
      case "online-users":
        if (Array.isArray(msg.users)) {
          const targetOnline = msg.users.includes(user.email);
          setIsOnline(targetOnline);
          console.log(
            `[ChatWindow ${ts()}] 🌐 online-users update: ${user.email} = ${targetOnline}`
          );
        }
        break;

      /** ✅ Cập nhật realtime khi user online/offline */
      case "user-status":
        if (msg.email === user.email) {
          setIsOnline(msg.online);
          setLastSeen(msg.lastSeen || null);
          console.log(
            `[ChatWindow ${ts()}] 👤 ${msg.email} is now ${
              msg.online ? "online" : "offline"
            }`
          );
        }
        break;

      case "read-update":
        if (msg.conversationId === user.conversationId) {
          console.log(`[ChatWindow ${ts()}] 📖 Read-update by ${msg.reader}`);
        }
        break;

      default:
        console.log(`[ChatWindow ${ts()}] ⚠️ Unhandled WS:`, msg);
    }
  };

  /** 🔌 Mount ChatWindow */
  useEffect(() => {
    if (!user?.conversationId) return;
    console.log(`[ChatWindow ${ts()}] 🧩 Mount conversation=${user.conversationId}`);

    // ✅ Nếu có cache → khôi phục
    if (messageCache[user.conversationId]) {
      console.log(
        `[ChatWindow ${ts()}] ♻️ Restoring ${messageCache[user.conversationId].length} cached messages`
      );
      setMessages(messageCache[user.conversationId]);
    }

    const connect = async () => {
      try {
        console.log(`[ChatWindow ${ts()}] 🔌 Connecting /ws/chat for ${email}`);
        await wsChatManager.connect("/ws/chat", token, handleMessage, true);

        if (!joinedRooms.has(user.conversationId)) {
          console.log(`[ChatWindow ${ts()}] 🚀 Sending join for ${user.conversationId}`);
          wsChatManager.send(
            { type: "join", conversationId: user.conversationId },
            "/ws/chat"
          );
          joinedRooms.add(user.conversationId);
        }

        markConversationAsRead(user.conversationId);

        // ✅ Sau khi join, yêu cầu danh sách online
        setTimeout(() => {
          console.log(`[ChatWindow ${ts()}] 📡 Requesting online-users`);
          wsChatManager.send({ type: "request-online-users" }, "/ws/chat");
        }, 500);
      } catch (err) {
        console.error(`[ChatWindow ${ts()}] ❌ Chat WS connect error:`, err);
      }
    };

    connect();
  }, [user]);

  /** 🔁 Khi vừa kết thúc call và quay lại Chat */
  useEffect(() => {
    const reload = sessionStorage.getItem("reloadChatAfterCall");
    if (reload === "true" && user?.conversationId) {
      console.log(`[ChatWindow ${ts()}] 🔁 Detected reload flag, rejoining chat...`);
      sessionStorage.removeItem("reloadChatAfterCall");

      const rejoin = async () => {
        console.log(`[ChatWindow ${ts()}] ⏳ Waiting 1s before rejoin...`);
        await new Promise((r) => setTimeout(r, 1000));

        if (!wsChatManager.isConnected("/ws/chat")) {
          console.log(`[ChatWindow ${ts()}] ⚙️ Reconnecting chat socket...`);
          await wsChatManager.connect("/ws/chat", token, handleMessage, true);
        }

        console.log(`[ChatWindow ${ts()}] 🔄 Sending join again for ${user.conversationId}`);
        wsChatManager.send(
          { type: "join", conversationId: user.conversationId },
          "/ws/chat"
        );

        // ✅ Yêu cầu backend gửi lại lịch sử chat
        setTimeout(() => {
          wsChatManager.send(
            { type: "get-history", conversationId: user.conversationId },
            "/ws/chat"
          );
          wsChatManager.send({ type: "request-online-users" }, "/ws/chat");
        }, 400);

        markConversationAsRead(user.conversationId);
      };
      rejoin();
    }
  }, [user?.conversationId]);

  /** 📖 Đánh dấu đã đọc */
  const markConversationAsRead = async (conversationId) => {
    try {
      await axios.put(
        `http://localhost:8081/api/chat/mark-read?conversationId=${conversationId}&email=${email}`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      wsChatManager.send(
        { type: "read-update", conversationId, reader: email },
        "/ws/chat"
      );
      console.log(`[ChatWindow ${ts()}] 📖 Marked as read conversation=${conversationId}`);
    } catch (err) {
      console.error(`[ChatWindow ${ts()}] ⚠️ markAsRead error:`, err);
    }
  };

  /** Cuộn xuống cuối */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    console.log(`[ChatWindow ${ts()}] 🖼 Rendering ${messages.length} messages`);
  }, [messages]);

  /** ✍️ Gửi typing */
  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      wsChatManager.send(
        { type: "typing", conversationId: user.conversationId, from: email },
        "/ws/chat"
      );
    }
  }, [user?.conversationId, email]);

  /** 💬 Gửi tin nhắn */
  const sendMessage = () => {
    if (!newMsg.trim()) return;
    wsChatManager.send(
      { type: "chat", conversationId: user.conversationId, message: newMsg.trim() },
      "/ws/chat"
    );
    console.log(`[ChatWindow ${ts()}] ✉️ Sent message:`, newMsg.trim());
    setNewMsg("");
  };

  /** 📞 Bắt đầu cuộc gọi */
  const handleStartCall = async () => {
    try {
      console.log(`[ChatWindow ${ts()}] 📞 Starting call with ${user.email}`);
      sessionStorage.setItem("callOrigin", "chat");
      await wsManager.connect("/ws/call", token);
      await new Promise((r) => setTimeout(r, 300));
      wsManager.send({ type: "call", from: email, to: user.email }, "/ws/call");
    } catch (err) {
      console.error(`[ChatWindow ${ts()}] ❌ Call start error:`, err);
    }
  };

  /** 🟢 Trạng thái user hiển thị */
  const renderStatusText = () => {
    if (isTyping) return "Đang nhập...";
    if (isOnline)
      return <span className="text-green-500 font-medium">Đang hoạt động</span>;
    if (lastSeen)
      return (
        <span className="text-gray-500">
          Hoạt động lúc{" "}
          {new Date(lastSeen).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      );
    return <span className="text-gray-400">Ngoại tuyến</span>;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-gray-50">
        <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-700">
          <IoArrowBackSharp size={22} />
        </button>
        <img
          src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
          alt={user.name}
          className="w-10 h-10 rounded-full"
        />
        <div className="flex-1">
          <p className="font-semibold text-gray-800">{user.firstName || user.name}</p>
          <p className="text-xs">{renderStatusText()}</p>
        </div>
        <button
          onClick={handleStartCall}
          className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
        >
          <FaPhone size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-gray-50 to-white space-y-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.sender === email ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                msg.sender === email
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-200 text-gray-800 rounded-bl-none"
              }`}
            >
              {msg.message}
              <span className="block text-[10px] mt-1 opacity-70 text-right">
                {new Date(msg.timestamp).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-2xl bg-gray-200 text-gray-600 text-sm flex gap-1">
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-300"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white flex items-center gap-3">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => {
            setNewMsg(e.target.value);
            sendTyping();
          }}
          placeholder="Nhập tin nhắn..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 px-4 py-2 bg-gray-100 rounded-full outline-none text-sm focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={sendMessage}
          className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
        >
          <IoSend size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;

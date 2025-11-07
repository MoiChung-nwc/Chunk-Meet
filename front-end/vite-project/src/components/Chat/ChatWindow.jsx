import React, { useEffect, useState, useRef, useCallback } from "react";
import { IoSend, IoArrowBackSharp } from "react-icons/io5";
import { FaPhone } from "react-icons/fa";
import axios from "axios";
import { wsChatManager, wsManager } from "../../utils/WebSocketManager";

const joinedRooms = new Set();
const messageCache = {}; // cache tin nhắn theo conversationId

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

  // ===========================================================
  // 📥 Handle incoming WS messages
  // ===========================================================
  const handleMessage = (msg) => {
    if (!msg?.type) return;
    switch (msg.type) {
      case "group-history":
        if (msg.groupId === user.conversationId) {
          setMessages(msg.messages || []);
          messageCache[msg.groupId] = msg.messages || [];
        }
        break;

      case "group-chat":
        if (msg.groupId === user.conversationId) {
          setMessages((prev) => [...prev, msg]);
          messageCache[user.conversationId] = [
            ...(messageCache[user.conversationId] || []),
            msg,
          ];
        }
        break;

      case "typing-group":
        if (msg.groupId === user.conversationId && msg.from !== email) {
          setIsTyping(true);
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1800);
        }
        break;

      case "group-deleted":
      case "group-member-removed":
        if (msg.groupId === user.conversationId && msg.email === email) {
          console.warn(`[ChatWindow ${ts()}] 🚫 Removed from group`);
          setMessages([]);
        }
        break;

      case "chat-history":
        if (msg.conversationId === user.conversationId) {
          setMessages(msg.messages || []);
          messageCache[msg.conversationId] = msg.messages || [];
          markConversationAsRead(msg.conversationId);
        }
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
            if (exists) return prev;
            const updated = [...prev, msg];
            messageCache[user.conversationId] = updated;
            return updated;
          });
          if (msg.sender === email) {
            wsChatManager.send(
              { type: "read-update", conversationId: msg.conversationId, reader: email },
              "/ws/chat"
            );
          }
        }
        break;

      case "typing":
        if (msg.from === user.email) {
          setIsTyping(true);
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1800);
        }
        break;

      case "online-users":
        if (Array.isArray(msg.users) && !user.isGroup) {
          setIsOnline(msg.users.includes(user.email));
        }
        break;

      case "user-status":
        if (msg.email === user.email && !user.isGroup) {
          setIsOnline(msg.online);
          setLastSeen(msg.lastSeen || null);
        }
        break;

      default:
        console.debug(`[ChatWindow ${ts()}] ⚙️ Unhandled WS:`, msg.type);
    }
  };

  // ===========================================================
  // 🔌 Khi mount ChatWindow
  // ===========================================================
  useEffect(() => {
    if (!user?.conversationId || !token) return;

    console.log(`[ChatWindow ${ts()}] 🎯 Open chat: ${user.conversationId}`);

    if (messageCache[user.conversationId]) {
      setMessages(messageCache[user.conversationId]);
    }

    const connect = async () => {
      try {
        await wsChatManager.connect("/ws/chat", token, handleMessage);
        if (!joinedRooms.has(user.conversationId)) {
          wsChatManager.send(
            user.isGroup
              ? { type: "join-group", groupId: user.conversationId }
              : { type: "join", conversationId: user.conversationId },
            "/ws/chat"
          );
          joinedRooms.add(user.conversationId);
        }

        if (user.isGroup) {
          wsChatManager.send(
            { type: "get-group-history", groupId: user.conversationId },
            "/ws/chat"
          );
        } else {
          wsChatManager.send(
            { type: "get-history", conversationId: user.conversationId },
            "/ws/chat"
          );
          markConversationAsRead(user.conversationId);
          setTimeout(
            () => wsChatManager.send({ type: "request-online-users" }, "/ws/chat"),
            300
          );
        }
      } catch (err) {
        console.error(`[ChatWindow ${ts()}] ❌ WS connect error:`, err);
      }
    };

    connect();
  }, [user, token]);

  // ===========================================================
  // 📖 Đánh dấu đã đọc (chỉ 1-1)
  // ===========================================================
  const markConversationAsRead = async (conversationId) => {
    if (user.isGroup) return;
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
    } catch (err) {
      console.warn(`[ChatWindow ${ts()}] ⚠️ markAsRead error:`, err);
    }
  };

  // ===========================================================
  // Cuộn xuống cuối khi có tin mới
  // ===========================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 120);
    return () => clearTimeout(timer);
  }, [messages]);

  // ===========================================================
  // ✍️ Gửi typing
  // ===========================================================
  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1000) {
      lastTypingSentRef.current = now;
      wsChatManager.send(
        user.isGroup
          ? { type: "typing-group", groupId: user.conversationId, from: email }
          : { type: "typing", conversationId: user.conversationId, from: email },
        "/ws/chat"
      );
    }
  }, [user?.conversationId, email, user?.isGroup]);

  // ===========================================================
  // 💬 Gửi tin nhắn
  // ===========================================================
  const sendMessage = () => {
    if (!newMsg.trim()) return;
    const payload = user.isGroup
      ? { type: "group-chat", groupId: user.conversationId, message: newMsg.trim() }
      : { type: "chat", conversationId: user.conversationId, message: newMsg.trim() };

    wsChatManager.send(payload, "/ws/chat");
    console.log(`[ChatWindow ${ts()}] ✉️ Sent message:`, newMsg.trim());
    setNewMsg("");
  };

  // ===========================================================
  // 📞 Gọi (chỉ 1-1)
  // ===========================================================
  const handleStartCall = async () => {
    if (user.isGroup) return;
    try {
      sessionStorage.setItem("callOrigin", "chat");
      await wsManager.connect("/ws/call", token);
      await new Promise((r) => setTimeout(r, 200));
      wsManager.send({ type: "call", from: email, to: user.email }, "/ws/call");
    } catch (err) {
      console.error(`[ChatWindow ${ts()}] ❌ Call start error:`, err);
    }
  };

  // ===========================================================
  // 🟢 Hiển thị trạng thái user
  // ===========================================================
  const renderStatusText = () => {
    if (user.isGroup) return `${user.members?.length || 0} thành viên`;
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

  // ===========================================================
  // 🧩 UI
  // ===========================================================
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-gray-50">
        <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-700">
          <IoArrowBackSharp size={22} />
        </button>
        <img
          src={
            user.isGroup
              ? "https://cdn-icons-png.flaticon.com/512/1077/1077114.png"
              : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
          }
          alt={user.name}
          className="w-10 h-10 rounded-full"
        />
        <div className="flex-1">
          <p className="font-semibold text-gray-800">{user.firstName || user.name}</p>
          <p className="text-xs">{renderStatusText()}</p>
        </div>
        {!user.isGroup && (
          <button
            onClick={handleStartCall}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
          >
            <FaPhone size={16} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-gray-50 to-white space-y-2">
        {messages.map((msg, idx) => (
          <div
            key={`${msg.timestamp}-${idx}`}
            className={`flex ${msg.sender === email ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                msg.sender === email
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-200 text-gray-800 rounded-bl-none"
              }`}
            >
              {user.isGroup && msg.sender !== email && (
                <p className="text-[11px] font-semibold mb-1">
                  {msg.sender.split("@")[0]}
                </p>
              )}
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
      <div className="p-4 border-t bg-white flex items-center gap-3">
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

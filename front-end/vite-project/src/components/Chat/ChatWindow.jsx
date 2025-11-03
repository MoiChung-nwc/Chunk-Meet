import React, { useState, useEffect, useRef } from "react";
import { IoSend, IoArrowBackSharp } from "react-icons/io5";

const ChatWindow = ({ user, onBack }) => {
  const [messages, setMessages] = useState([
    { id: 1, from: "them", text: "Hi there! 👋", time: "10:00" },
    { id: 2, from: "me", text: "Hello! How are you?", time: "10:01" },
  ]);
  const [newMsg, setNewMsg] = useState("");
  const [typing, setTyping] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto scroll xuống tin mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Hiệu ứng typing giả lập (demo)
  useEffect(() => {
    const timer = setInterval(() => {
      if (Math.random() > 0.7) setTyping(true);
      else setTyping(false);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const sendMessage = () => {
    if (!newMsg.trim()) return;
    setMessages([
      ...messages,
      { id: Date.now(), from: "me", text: newMsg.trim(), time: "Now" },
    ]);
    setNewMsg("");
    setTyping(true);
    setTimeout(() => setTyping(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-gray-50">
        <button
          onClick={onBack}
          className="md:hidden text-gray-500 hover:text-gray-700"
        >
          <IoArrowBackSharp size={22} />
        </button>
        <div className="relative">
          <img
            src={user.avatar}
            alt={user.name}
            className="w-10 h-10 rounded-full"
          />
          {user.online && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800">{user.name}</span>
          <span className="text-xs text-gray-500">
            {typing ? "Đang nhập..." : user.online ? "Đang hoạt động" : "Ngoại tuyến"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-gray-50 to-white space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.from === "me" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                msg.from === "me"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-200 text-gray-800 rounded-bl-none"
              }`}
            >
              {msg.text}
              <span className="block text-[10px] mt-1 opacity-70 text-right">
                {msg.time}
              </span>
            </div>
          </div>
        ))}

        {typing && (
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

      {/* Input box */}
      <div className="p-4 border-t border-gray-200 bg-white flex items-center gap-3">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Nhập tin nhắn..."
          className="flex-1 px-4 py-2 bg-gray-100 rounded-full outline-none text-sm focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
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

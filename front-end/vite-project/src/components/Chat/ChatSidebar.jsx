import React, { useState } from "react";
import { FaSearch, FaPhoneAlt, FaVideo, FaTimes } from "react-icons/fa";

const dummyUsers = [
  {
    id: 1,
    name: "James Collison",
    email: "james@example.com",
    avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
    lastMessage: "See you soon!",
    online: true,
    unread: 2,
    typing: false,
  },
  {
    id: 2,
    name: "Laura Kim",
    email: "laura@example.com",
    avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135789.png",
    lastMessage: "Let's meet tomorrow.",
    online: false,
    unread: 0,
    typing: true,
  },
  {
    id: 3,
    name: "Henry Phan",
    email: "henry@example.com",
    avatar: "https://cdn-icons-png.flaticon.com/512/2922/2922510.png",
    lastMessage: "Got it!",
    online: true,
    unread: 1,
    typing: false,
  },
];

const ChatSidebar = ({ onSelectUser }) => {
  const [query, setQuery] = useState("");
  const filtered = dummyUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase())
  );

  const handleCall = (user, type) => {
    if (type === "audio") alert(`📞 Bắt đầu cuộc gọi thoại với ${user.name}`);
    if (type === "video") alert(`🎥 Bắt đầu cuộc gọi video với ${user.name}`);
  };

  return (
    <div className="w-80 h-full bg-white border-r flex flex-col">
      {/* 🔹 Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b bg-gray-50">
        <h2 className="font-semibold text-lg text-gray-800">Chats</h2>
      </div>

      {/* 🔹 Search bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <FaSearch className="text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm người dùng..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
        />
      </div>

      {/* 🔹 User list */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 cursor-pointer transition group"
            onClick={() => onSelectUser(user)}
          >
            {/* Avatar + online status */}
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-10 h-10 rounded-full border"
              />
              {user.online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
              )}
            </div>

            {/* User info */}
            <div className="flex-1 text-left min-w-0">
              <div className="flex justify-between items-center">
                <p className="font-medium text-gray-800 text-sm truncate">
                  {user.name}
                </p>
                {user.unread > 0 && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    {user.unread}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">
                {user.typing
                  ? <span className="italic text-blue-500">Đang nhập...</span>
                  : user.lastMessage}
              </p>
            </div>

            {/* Call + Video icons */}
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCall(user, "audio");
                }}
                className="p-1.5 rounded-full hover:bg-blue-100 text-blue-600"
              >
                <FaPhoneAlt className="text-sm" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCall(user, "video");
                }}
                className="p-1.5 rounded-full hover:bg-blue-100 text-blue-600"
              >
                <FaVideo className="text-sm" />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-10">
            Không tìm thấy người dùng 😢
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;

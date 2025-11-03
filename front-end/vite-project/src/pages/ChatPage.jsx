import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatSidebar from "../components/Chat/ChatSidebar";
import ChatWindow from "../components/Chat/ChatWindow";

const ChatPage = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 bg-white border-b shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-blue-600 font-medium hover:underline"
          >
            ← Quay lại Dashboard
          </button>
        </div>
        <h1 className="text-lg font-semibold text-gray-700">💬 Chat Center</h1>
        <div />
      </header>

      {/* Main */}
      <div className="flex flex-1">
        <ChatSidebar onSelectUser={setSelectedUser} />
        <div className="flex-1 flex flex-col bg-white shadow-lg">
          {!selectedUser ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <img
                src="https://cdn-icons-png.flaticon.com/512/4072/4072357.png"
                alt="chat"
                className="w-20 mb-4 opacity-60"
              />
              <p className="text-lg font-medium">Chọn một người để bắt đầu trò chuyện 💬</p>
            </div>
          ) : (
            <ChatWindow user={selectedUser} onBack={() => setSelectedUser(null)} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

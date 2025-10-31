import React from "react";
import ChatSidebar from "../components/Chat/ChatSidebar";

const ChatPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex">
      {/* Sidebar */}
      <ChatSidebar />

      {/* Phần trống bên phải để tương lai hiển thị ChatWindow */}
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>💬 Chọn một người để bắt đầu trò chuyện</p>
      </div>
    </div>
  );
};

export default ChatPage;

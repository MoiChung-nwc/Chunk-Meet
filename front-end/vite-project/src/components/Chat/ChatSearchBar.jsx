import React, { useState, useEffect } from "react";

const ChatSearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    onSearch?.(query);
  }, [query]);

  return (
    <div className="p-3 border-b border-gray-100">
      <input
        type="text"
        placeholder="🔍 Tìm kiếm người dùng..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-4 py-2 rounded-full border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm text-gray-800 placeholder-gray-400"
      />
    </div>
  );
};

export default ChatSearchBar;

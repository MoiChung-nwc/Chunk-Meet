import ChatMessage from "./ChatMessage";

const ChatWindow = ({ user, onBack }) => {
  const [messages, setMessages] = useState([
    { id: 1, from: "me", text: "Hello!", time: "10:00" },
    { id: 2, from: "them", text: "Hi there!", time: "10:01" },
  ]);
  const [newMsg, setNewMsg] = useState("");

  const sendMessage = () => {
    if (!newMsg.trim()) return;
    setMessages([...messages, { id: Date.now(), from: "me", text: newMsg, time: "Now" }]);
    setNewMsg("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-200 bg-gray-50">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">←</button>
        <img src={user.avatar} alt="avatar" className="w-9 h-9 rounded-full" />
        <div className="text-left">
          <p className="font-medium text-gray-800">{user.name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 bg-gray-50 space-y-2">
        {messages.map((m) => (
          <ChatMessage key={m.id} msg={m} />
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 flex items-center gap-2 bg-white">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Nhập tin nhắn..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-white text-sm"
        >
          ➤
        </button>
      </div>
    </div>
  );
};
export default ChatWindow;

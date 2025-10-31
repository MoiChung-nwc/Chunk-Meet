const ChatMessage = ({ msg }) => {
  const isMe = msg.from === "me";
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
          isMe
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-200 text-gray-800 rounded-bl-none"
        }`}
      >
        {msg.text}
        <div className="text-[10px] text-gray-400 mt-1 text-right">{msg.time}</div>
      </div>
    </div>
  );
};
export default ChatMessage;

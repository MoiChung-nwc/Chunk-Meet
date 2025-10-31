const ChatUserList = ({ onSelectUser }) => {
  const users = [
    { id: 1, name: "James Collison", email: "james@company.com", avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png", lastMessage: "See you soon!" },
    { id: 2, name: "Laura Kim", email: "laura@company.com", avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135789.png", lastMessage: "Thanks for the update!" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {users.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer transition"
          onClick={() => onSelectUser(u)}
        >
          <img src={u.avatar} alt="avatar" className="w-10 h-10 rounded-full border" />
          <div className="flex-1 text-left">
            <p className="font-medium text-gray-800 text-sm">{u.name}</p>
            <p className="text-gray-500 text-xs truncate">{u.lastMessage}</p>
          </div>
          <span className="text-xs text-gray-400">2m ago</span>
        </div>
      ))}
    </div>
  );
};
export default ChatUserList;

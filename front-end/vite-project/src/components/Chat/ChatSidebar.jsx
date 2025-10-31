import ChatSearchBar from "./ChatSearchBar";
import ChatUserList from "./ChatUserList";
import ChatWindow from "./ChatWindow";

const ChatSidebar = ({ onClose }) => {
  const [selectedUser, setSelectedUser] = useState(null);

  return (
    <div className="fixed right-0 top-0 h-full w-[360px] bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-slide-left z-50">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h2 className="font-semibold text-lg text-gray-800">Chats</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✖</button>
      </div>

      {!selectedUser ? (
        <>
          <ChatSearchBar />
          <ChatUserList onSelectUser={setSelectedUser} />
        </>
      ) : (
        <ChatWindow user={selectedUser} onBack={() => setSelectedUser(null)} />
      )}
    </div>
  );
};

export default ChatSidebar;

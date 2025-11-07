import React, { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const ChatGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = sessionStorage.getItem("accessToken");
  const email =
    sessionStorage.getItem("email") ||
    JSON.parse(localStorage.getItem("user") || "{}").email;

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim()) return toast.error("Vui lòng nhập tên nhóm");
    setIsSubmitting(true);

    try {
      const res = await axios.post(
        "http://localhost:8081/api/chat/group/create",
        {
          name,
          description,
          createdBy: email,
          avatar: "https://cdn-icons-png.flaticon.com/512/1077/1077114.png",
          members: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const group = res.data.data;
      toast.success("✅ Tạo nhóm thành công!");
      onGroupCreated(group);
      onClose();
    } catch (err) {
      console.error("❌ Lỗi tạo nhóm:", err);
      toast.error("Không thể tạo nhóm, vui lòng thử lại");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-5 rounded-xl w-96 shadow-lg">
        <h3 className="font-semibold text-lg mb-3">🧩 Tạo nhóm mới</h3>
        <input
          type="text"
          placeholder="Tên nhóm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg p-2 mb-3 text-sm"
        />
        <textarea
          placeholder="Mô tả (tùy chọn)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border rounded-lg p-2 mb-3 text-sm"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
          >
            Hủy
          </button>
          <button
            onClick={handleCreate}
            disabled={isSubmitting}
            className={`px-4 py-2 rounded text-sm text-white ${
              isSubmitting ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSubmitting ? "Đang tạo..." : "Tạo nhóm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatGroupModal;

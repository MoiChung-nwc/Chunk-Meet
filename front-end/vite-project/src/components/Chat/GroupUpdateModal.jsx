import React, { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const GroupUpdateModal = ({ group, onClose, onUpdated }) => {
  const [name, setName] = useState(group.name || "");
  const [description, setDescription] = useState(group.description || "");
  const [avatar, setAvatar] = useState(group.avatar || "");
  const [loading, setLoading] = useState(false);

  const token = sessionStorage.getItem("accessToken");
  const actor =
    sessionStorage.getItem("email") ||
    JSON.parse(localStorage.getItem("user") || "{}").email;

  const handleUpdate = async () => {
    if (!name.trim()) return toast.error("Vui lòng nhập tên nhóm");
    setLoading(true);

    try {
      await axios.put(
        `http://localhost:8081/api/chat/group/${group.id}/update?actor=${actor}`,
        { name, description, avatar },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("🆙 Cập nhật nhóm thành công!");
      onUpdated();
      onClose();
    } catch (err) {
      console.error("❌ Lỗi cập nhật nhóm:", err);
      toast.error("Không thể cập nhật nhóm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-white p-5 rounded-xl w-96 shadow-lg">
        <h3 className="font-semibold text-lg mb-3">✏️ Chỉnh sửa nhóm</h3>

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

        <input
          type="text"
          placeholder="URL avatar (tùy chọn)"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          className="w-full border rounded-lg p-2 mb-3 text-sm"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
          >
            Hủy
          </button>
          <button
            onClick={handleUpdate}
            disabled={loading}
            className={`px-4 py-2 rounded text-white text-sm ${
              loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupUpdateModal;

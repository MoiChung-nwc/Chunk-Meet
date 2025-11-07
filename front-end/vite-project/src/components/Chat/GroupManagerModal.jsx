import React, { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const GroupManagerModal = ({ group, onClose, onUpdated }) => {
  const [emailToAdd, setEmailToAdd] = useState("");
  const [loading, setLoading] = useState(false);

  const token = sessionStorage.getItem("accessToken");
  const actor =
    sessionStorage.getItem("email") ||
    JSON.parse(localStorage.getItem("user") || "{}").email;

  const addMember = async () => {
    if (!emailToAdd.trim()) return toast.error("Nhập email thành viên cần mời");
    setLoading(true);
    try {
      await axios.put(
        `http://localhost:8081/api/chat/group/${group.id}/add`,
        { actor, memberEmail: emailToAdd, roleName: "USER" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`✅ Đã thêm ${emailToAdd}`);
      setEmailToAdd("");
      onUpdated();
    } catch {
      toast.error("Không thể thêm thành viên");
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (memberEmail) => {
    if (!window.confirm(`Xóa ${memberEmail} khỏi nhóm?`)) return;
    setLoading(true);
    try {
      await axios.put(
        `http://localhost:8081/api/chat/group/${group.id}/remove`,
        { actor, memberEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`🚫 Đã xóa ${memberEmail}`);
      onUpdated();
    } catch {
      toast.error("Không thể xóa thành viên");
    } finally {
      setLoading(false);
    }
  };

  const leaveGroup = async () => {
    if (!window.confirm("Bạn có chắc muốn rời nhóm này?")) return;
    setLoading(true);
    try {
      await axios.put(
        `http://localhost:8081/api/chat/group/${group.id}/remove`,
        { actor, memberEmail: actor },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("🚪 Đã rời nhóm");
      onClose();
      onUpdated();
    } catch {
      toast.error("Lỗi khi rời nhóm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-[400px] p-5">
        <div className="flex justify-between items-center border-b pb-2 mb-3">
          <h3 className="font-semibold text-lg text-gray-800">👥 Quản lý thành viên</h3>
          <button onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div className="max-h-[250px] overflow-y-auto border rounded-lg">
          {group.members?.length > 0 ? (
            group.members.map((m) => (
              <div
                key={m}
                className="flex justify-between items-center py-2 px-3 border-b text-sm"
              >
                <span>{m}</span>
                {m !== actor && (
                  <button
                    onClick={() => removeMember(m)}
                    disabled={loading}
                    className="text-red-500 hover:underline"
                  >
                    Xóa
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-gray-400 py-3 text-sm">
              Chưa có thành viên nào
            </p>
          )}
        </div>

        <div className="mt-4">
          <input
            type="text"
            placeholder="Nhập email để mời..."
            value={emailToAdd}
            onChange={(e) => setEmailToAdd(e.target.value)}
            className="w-full border rounded-lg p-2 text-sm"
          />
          <button
            onClick={addMember}
            disabled={loading}
            className={`mt-2 w-full py-2 rounded-lg text-sm text-white ${
              loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            ➕ Thêm thành viên
          </button>
        </div>

        <div className="mt-4 border-t pt-3">
          <button
            onClick={leaveGroup}
            disabled={loading}
            className="w-full text-sm text-red-500 hover:underline"
          >
            🚪 Rời nhóm
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupManagerModal;

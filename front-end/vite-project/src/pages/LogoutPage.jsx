import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

// ✅ Cờ toàn cục (không reset khi component remount)
let logoutShown = false;

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!logoutShown) {
      localStorage.removeItem("token");
      toast.success("Đăng xuất thành công!");
      logoutShown = true;
    }

    const timeout = setTimeout(() => {
      logoutShown = false; // ✅ reset flag cho lần đăng xuất sau
      navigate("/login");
    }, 1500);

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-gray-700">Đang đăng xuất...</h1>
        <p className="text-sm text-gray-500 mt-2">Vui lòng đợi trong giây lát.</p>
      </div>
    </div>
  );
}

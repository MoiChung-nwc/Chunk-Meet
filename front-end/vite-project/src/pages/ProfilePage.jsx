import React, { useContext } from "react";
import MainLayout from "../layouts/MainLayout";
import { AuthContext } from "../context/AuthContext";

export default function Profile() {
  const { user } = useContext(AuthContext);

  return (
    <MainLayout showNavbar showSidebar>
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-6 text-blue-600">
          Hồ sơ cá nhân
        </h2>

        {user ? (
          <div className="space-y-4 text-gray-700">
            <div>
              <span className="font-semibold">Email:</span>{" "}
              <span>{user.email}</span>
            </div>
            <div>
              <span className="font-semibold">Vai trò:</span>{" "}
              <span>{user.roles?.join(", ") || "Không có"}</span>
            </div>
            <div>
              <span className="font-semibold">Quyền:</span>{" "}
              <span>{user.permissions?.join(", ") || "Không có"}</span>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500">
            Không có thông tin người dùng.
          </p>
        )}
      </div>
    </MainLayout>
  );
}

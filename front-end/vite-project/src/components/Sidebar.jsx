import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const menuItems = [
    { name: "Dashboard", path: "/dashboard", color: "text-blue-600" },
    { name: "Hồ sơ cá nhân", path: "/profile", color: "text-gray-700" },
    { name: "Đăng xuất", path: "/logout", color: "text-red-500" },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-md p-6 flex flex-col">
      <h2 className="text-lg font-semibold mb-6 text-gray-700 dark:text-gray-200">
        Menu
      </h2>

      <ul className="space-y-2 flex-1">
        {menuItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg font-medium transition-all ${
                  isActive
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                    : `${item.color} hover:bg-blue-50 dark:hover:bg-gray-700`
                }`
              }
            >
              {item.name}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Footer nhỏ trong sidebar */}
      <div className="mt-auto text-xs text-gray-400 dark:text-gray-500">
        © {new Date().getFullYear()} MyApp
      </div>
    </aside>
  );
}

import React from 'react';
import { Home, Calendar, Settings, MoreHorizontal, Bell } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold">P</div>
            <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600 dark:text-gray-300">
              <a className="flex items-center gap-2 hover:text-gray-900 dark:hover:text-white"><Home size={16} /> Home</a>
              <a className="flex items-center gap-2 hover:text-gray-900 dark:hover:text-white"><Calendar size={16} /> Meetings</a>
              <a className="flex items-center gap-2 hover:text-gray-900 dark:hover:text-white"><Settings size={16} /> Settings</a>
              <a className="flex items-center gap-2 hover:text-gray-900 dark:hover:text-white"><MoreHorizontal size={16} /> More</a>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <Bell size={18} />
            </button>
            <div className="flex items-center gap-2">
              <img src="https://i.pravatar.cc/40" alt="avatar" className="w-8 h-8 rounded-full" />
              <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-200">James</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

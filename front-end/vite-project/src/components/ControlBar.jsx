import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, UserPlus, MessageSquare, Share2, Circle, Smile } from 'lucide-react';

export default function ControlBar({
  isMuted,
  setMuted,
  isVideoOff,
  setVideoOff,
  onEnd,
  onToggleChat,
}) {
  return (
    <div className="w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-3 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMuted(!isMuted)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${isMuted ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white'}`}
          >
            {isMuted ? <MicOff /> : <Mic />} <span className="hidden sm:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            onClick={() => setVideoOff(!isVideoOff)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${isVideoOff ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white'}`}
          >
            {isVideoOff ? <VideoOff /> : <Video />} <span className="hidden sm:inline">{isVideoOff ? 'Start' : 'Stop'}</span>
          </button>

          <button onClick={onToggleChat} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800">
            <MessageSquare /> <span className="hidden sm:inline">Chat</span>
          </button>

          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800">
            <Share2 /> <span className="hidden sm:inline">Share</span>
          </button>

          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800">
            <Smile /> <span className="hidden sm:inline">Reactions</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <UserPlus /> <span className="hidden sm:inline">People</span>
          </button>

          <button onClick={onEnd} className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700">
            <PhoneOff /> <span className="hidden sm:inline">End</span>
          </button>
        </div>
      </div>
    </div>
  );
}

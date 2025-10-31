import React from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ParticipantCard({ name, src, muted, speaking }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      className="w-44 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700"
    >
      <div className="relative h-28 bg-gray-900">
        {src ? (
          <img src={src} alt={name} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-700 text-white">{name?.charAt(0)}</div>
        )}
        {speaking && (
          <div className="absolute top-2 left-2 bg-white/20 px-2 py-1 rounded-full text-xs text-white">Speaking</div>
        )}
      </div>
      <div className="p-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Mobile</div>
        </div>
        <div className="flex items-center gap-2">
          {muted ? <Mic size={14} className="text-red-500" /> : <Volume2 size={14} className="text-green-400" />}
        </div>
      </div>
    </motion.div>
  );
}

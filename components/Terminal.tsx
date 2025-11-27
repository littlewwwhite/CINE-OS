import React, { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../types';
import { ChevronUp, ChevronDown, Terminal as TerminalIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TerminalProps {
  logs: LogEntry[];
}

const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive if open
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  // Auto-open on error
  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog?.type === 'error') {
      setIsOpen(true);
    }
  }, [logs]);

  const latestLog = logs[logs.length - 1];

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto">
        
        {/* Header / StatusBar */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-4 py-2 border-t border-x border-[#333] bg-[#0A0A0A] text-xs font-mono transition-colors ${
            isOpen ? 'bg-[#111]' : 'hover:bg-[#111]'
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex gap-1.5">
              <div className={`w-2 h-2 rounded-full ${latestLog?.type === 'error' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
            </div>
            <span className="text-gray-400 shrink-0 font-bold">SYSTEM_LOG</span>
            {!isOpen && latestLog && (
              <>
                <span className="text-gray-600">::</span>
                <span className={`truncate ${
                  latestLog.type === 'error' ? 'text-red-400' :
                  latestLog.type === 'success' ? 'text-green-400' : 
                  latestLog.type === 'warning' ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {latestLog.message}
                </span>
              </>
            )}
          </div>
          <div className="text-gray-500 hover:text-white">
            {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        </button>

        {/* Expanded Content */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 250, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-[#050505]/95 backdrop-blur border-x border-[#333] overflow-hidden flex flex-col"
            >
              <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-1 custom-scrollbar">
                {logs.length === 0 && <span className="text-gray-600 italic">No system events recorded.</span>}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 hover:bg-white/5 p-0.5 rounded">
                    <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                    <span className={`${
                      log.type === 'error' ? 'text-red-500 font-bold' : 
                      log.type === 'success' ? 'text-green-400' : 
                      log.type === 'warning' ? 'text-yellow-400' : 'text-gray-300'
                    }`}>
                      {log.type === 'info' && '> '}
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Terminal;

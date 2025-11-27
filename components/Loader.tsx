import React from 'react';

const Loader: React.FC<{ text?: string }> = ({ text = "PROCESSING" }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 border-t-2 border-[var(--color-accent)] rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-r-2 border-white/20 rounded-full animate-spin [animation-duration:1.5s]"></div>
        <div className="absolute inset-4 border-l-2 border-white/40 rounded-full animate-spin [animation-duration:2s]"></div>
      </div>
      <p className="font-mono text-xs tracking-[0.2em] animate-pulse text-[var(--color-accent)]">
        {text}...
      </p>
    </div>
  );
};

export default Loader;
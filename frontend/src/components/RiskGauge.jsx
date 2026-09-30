import React from 'react';

export default function RiskGauge({ score = 0, level = "NORMAL", color = "#10B981", statusText = "" }) {
  const clampedScore = Math.min(10, Math.max(0, score));
  const percentage = (clampedScore / 10) * 100;
  
  const radius = 80;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-5 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-md shadow-xl text-white">
      <span className="text-[11px] sm:text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1 text-center">
        Chỉ Số Nguy Cơ Buồn Ngủ (Score 0-10)
      </span>

      <div className="relative flex items-center justify-center w-48 sm:w-52 h-26 sm:h-28 overflow-hidden">
        <svg className="w-48 sm:w-52 h-48 sm:h-52 -rotate-180 transform translate-y-11 sm:translate-y-12" viewBox="0 0 200 200">
          {/* Background Arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke="#1e293b"
            strokeWidth="16"
            strokeDasharray={circumference}
            strokeDashoffset="0"
          />
          {/* Colored Value Arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth="16"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        </svg>

        {/* Center Score Display */}
        <div className="absolute bottom-1 sm:bottom-2 flex flex-col items-center">
          <span className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color }}>
            {clampedScore.toFixed(1)}
          </span>
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium">/ 10</span>
        </div>
      </div>

      {/* Level Badge */}
      <div 
        className="mt-2 sm:mt-3 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider shadow-md transition-all duration-300 text-center"
        style={{ backgroundColor: `${color}20`, color: color, borderColor: `${color}60`, borderWidth: 1 }}
      >
        {statusText || level}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';

export default function BiometricChart({ earHistory = [], marHistory = [], earThreshold = 0.20 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Dynamically match width to container for crisp mobile & desktop rendering
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = rect.width || 360;
    const displayHeight = 120;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y <= displayHeight; y += displayHeight / 3) {
      ctx.moveTo(0, y);
      ctx.lineTo(displayWidth, y);
    }
    ctx.stroke();

    // Draw Threshold line
    const threshY = displayHeight - (earThreshold / 0.5) * displayHeight;
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(displayWidth, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw EAR line (Cyan)
    if (earHistory.length > 1) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const step = displayWidth / (earHistory.length - 1);
      earHistory.forEach((val, i) => {
        const x = i * step;
        const y = displayHeight - (Math.min(0.5, val) / 0.5) * displayHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Draw MAR line (Purple)
    if (marHistory.length > 1) {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const step = displayWidth / (marHistory.length - 1);
      marHistory.forEach((val, i) => {
        const x = i * step;
        const y = displayHeight - (Math.min(1.0, val) / 1.0) * displayHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [earHistory, marHistory, earThreshold]);

  return (
    <div className="flex flex-col p-3 sm:p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl text-white">
      <div className="flex flex-wrap justify-between items-center gap-1.5 mb-2">
        <span className="text-[11px] sm:text-xs uppercase font-semibold tracking-wider text-slate-400">
          Tín hiệu Biometrics (Real-time)
        </span>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
          <span className="flex items-center gap-1 text-cyan-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"></span> EAR
          </span>
          <span className="flex items-center gap-1 text-purple-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span> MAR
          </span>
          <span className="flex items-center gap-1 text-red-400 font-medium">
            <span className="w-2 h-0.5 bg-red-400 inline-block"></span> Ngưỡng
          </span>
        </div>
      </div>
      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          className="w-full h-[120px] rounded-lg bg-slate-950/70 block"
        />
      </div>
    </div>
  );
}

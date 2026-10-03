import React from 'react';

/**
 * HelmIcon (Bánh lái tàu / Kubernetes Helm Steering Wheel)
 * Biểu tượng bánh lái hoa tiêu 7 chấu đặc trưng giống hệt Kubernetes (K8s)
 */
export default function HelmIcon({ className = "w-6 h-6", color = "currentColor", ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Vành tròn ngoài */}
      <circle cx="12" cy="12" r="7.5" />
      {/* Trục tâm tròn */}
      <circle cx="12" cy="12" r="2.5" fill={color} fillOpacity="0.2" />

      {/* 7 nan hoa và tay nắm bánh lái (7-spoke Helm Wheel giống chuẩn Kubernetes) */}
      {[0, 51.43, 102.86, 154.29, 205.71, 257.14, 308.57].map((angle, index) => {
        const rad = (angle * Math.PI) / 180;
        // Điểm từ tâm ra vành tròn
        const x1 = 12 + 2.5 * Math.sin(rad);
        const y1 = 12 - 2.5 * Math.cos(rad);
        // Điểm trên vành tròn
        const x2 = 12 + 7.5 * Math.sin(rad);
        const y2 = 12 - 7.5 * Math.cos(rad);
        // Tay nắm vươn ra ngoài vành (như bánh lái tàu / K8s)
        const x3 = 12 + 10.5 * Math.sin(rad);
        const y3 = 12 - 10.5 * Math.cos(rad);

        return (
          <g key={index}>
            {/* Nan hoa từ trục ra vành */}
            <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.6" />
            {/* Tay cầm bánh lái vươn ra ngoài */}
            <line x1={x2} y1={y2} x2={x3} y2={y3} strokeWidth="2.2" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

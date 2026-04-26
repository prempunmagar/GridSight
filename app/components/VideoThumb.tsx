"use client";

interface Props {
  durationLabel: string;
}

// Procedural drone-style "tower-day" thumbnail, ported from design/gridsight.jsx.
export default function VideoThumb({ durationLabel }: Props) {
  const c1 = "#1f2a44";
  const c2 = "#3d5a7a";
  const c3 = "#86a3c7";
  const horizonY = 60;

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <svg
        viewBox="0 0 200 120"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="sky-tower-day" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
          <linearGradient id="gnd-tower-day" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={c2} />
            <stop offset="100%" stopColor={c1} />
          </linearGradient>
        </defs>
        <rect width="200" height={horizonY} fill="url(#sky-tower-day)" />
        <rect y={horizonY} width="200" height={120 - horizonY} fill="url(#gnd-tower-day)" />

        <path d="M 100 110 L 90 30 L 110 30 Z" fill={c1} opacity="0.85" />
        <path d="M 92 70 L 108 70 L 100 30 Z" fill="none" stroke={c3} strokeWidth="0.5" opacity="0.6" />
        <line x1="60" y1="40" x2="140" y2="40" stroke={c3} strokeWidth="0.6" opacity="0.7" />
        <line x1="55" y1="46" x2="145" y2="46" stroke={c3} strokeWidth="0.6" opacity="0.7" />
        <line x1="50" y1="52" x2="150" y2="52" stroke={c3} strokeWidth="0.6" opacity="0.7" />
        <circle cx="20" cy="14" r="6" fill="#fff" opacity="0.55" />

        <text x="6" y="10" fill="#ffd84d" fontSize="5" fontFamily="monospace" opacity="0.9">REC ●</text>
        <text x="160" y="10" fill="#fff" fontSize="4" fontFamily="monospace" opacity="0.7">AGL 42m</text>
        <text x="6" y="116" fill="#fff" fontSize="4" fontFamily="monospace" opacity="0.7">N 38.27° W 89.79°</text>
        <text x="160" y="116" fill="#fff" fontSize="4" fontFamily="monospace" opacity="0.7">HDG 358°</text>
        <g stroke="#fff" strokeWidth="0.4" opacity="0.5">
          <line x1="100" y1="56" x2="100" y2="64" />
          <line x1="96" y1="60" x2="104" y2="60" />
        </g>
      </svg>

      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/75 rounded font-mono text-[10px] text-white">
        {durationLabel}
      </span>
    </div>
  );
}

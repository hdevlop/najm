import React from 'react';
import type { StateCardProps } from '../types';

function formatStatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const unit = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(unit)), units.length - 1);
  const value = bytes / Math.pow(unit, index);

  if (index === 0) return `${Math.round(value)} ${units[index]}`;
  return `${value.toFixed(1)} ${units[index]}`;
}

export function StateCard({
  icon: Icon,
  iconColor,
  accentColor,
  iconBgColor,
  title,
  count,
  used,
  total,
  countLabel,
}: StateCardProps) {
  const pct = total > 0 ? Math.min(Math.max((used / total) * 100, 0), 100) : 0;
  const label = countLabel ?? (count === 1 ? 'Item' : 'Items');

  return (
    <div className="min-h-[116px] rounded-[10px] border border-white/10 bg-[#101010] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: iconBgColor ?? `${accentColor}24` }}
        >
          <Icon size={19} strokeWidth={2.25} className={iconColor} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold leading-4 text-white">{title}</div>
          <div className="mt-1 text-[10px] leading-3 text-[#9aa3af]">
            {count.toLocaleString()} {label}
          </div>
        </div>
      </div>

      <div className="mt-3 h-[5px] w-full overflow-hidden rounded-full bg-[#242424]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: accentColor }}
        />
      </div>

      <div className="mt-3 text-[10px] leading-none text-[#a8b0bd]">
        {formatStatBytes(used)} of {formatStatBytes(total)}
      </div>
    </div>
  );
}

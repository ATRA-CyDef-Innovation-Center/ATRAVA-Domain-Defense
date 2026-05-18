import { useId } from 'react';
import { cn } from '@/lib/utils';

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  subtitleClassName?: string;
  compact?: boolean;
};

export function BrandMark({ className }: { className?: string }) {
  const backgroundId = useId();
  const shieldId = useId();
  const accentId = useId();
  const glowId = useId();

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('h-10 w-10', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={backgroundId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F172A" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <linearGradient id={shieldId} x1="20" y1="12" x2="42" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67E8F9" />
          <stop offset="0.52" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id={accentId} x1="12" y1="14" x2="52" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E0F2FE" />
          <stop offset="1" stopColor="#7DD3FC" />
        </linearGradient>
        <radialGradient id={glowId} cx="0" cy="0" r="1" gradientTransform="translate(32 24) rotate(90) scale(26)">
          <stop stopColor="#38BDF8" stopOpacity="0.28" />
          <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="18" fill={`url(#${backgroundId})`} />
      <rect x="4.5" y="4.5" width="55" height="55" rx="17.5" stroke="#1E293B" />
      <circle cx="32" cy="26" r="21" fill={`url(#${glowId})`} />
      <path
        d="M32 10L47 15.4V29C47 39.3 40.9 48 32 52C23.1 48 17 39.3 17 29V15.4L32 10Z"
        fill={`url(#${shieldId})`}
      />
      <path
        d="M32 14.5L43 18.5V28.6C43 36.3 38.6 43 32 46.7C25.4 43 21 36.3 21 28.6V18.5L32 14.5Z"
        fill="#081121"
      />
      <circle cx="32" cy="27" r="9.5" stroke={`url(#${accentId})`} strokeWidth="1.8" />
      <path d="M22.5 27H41.5" stroke="#BAE6FD" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M32 17.5V36.5" stroke="#BAE6FD" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M26.6 19.3C28.3 21.1 29.4 23.8 29.4 27C29.4 30.2 28.3 32.9 26.6 34.7" stroke="#BAE6FD" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M37.4 19.3C35.7 21.1 34.6 23.8 34.6 27C34.6 30.2 35.7 32.9 37.4 34.7" stroke="#BAE6FD" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M25 22.1C27 23 29.4 23.5 32 23.5C34.6 23.5 37 23 39 22.1" stroke="#BAE6FD" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M25 31.9C27 31 29.4 30.5 32 30.5C34.6 30.5 37 31 39 31.9" stroke="#BAE6FD" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M32 10L47 15.4" stroke="#E0F2FE" strokeOpacity="0.6" strokeWidth="1" />
      <circle cx="32" cy="10.8" r="2" fill="#E0F2FE" />
    </svg>
  );
}

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  subtitleClassName,
  compact = false,
}: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark className={markClassName} />
      <div className="min-w-0 leading-none">
        <div className={cn('truncate text-xl font-bold tracking-[0.22em] text-foreground', textClassName)}>ATRAVA</div>
        {!compact && (
          <div
            className={cn(
              'mt-1 truncate text-[0.65rem] font-semibold uppercase tracking-[0.42em] text-sky-400/90',
              subtitleClassName
            )}
          >
            Domain Defense
          </div>
        )}
      </div>
    </div>
  );
}

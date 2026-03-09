import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  withTagline?: boolean;
  size?: "sm" | "md" | "lg";
};

function ParcelMark({ size }: { size: "sm" | "md" | "lg" }) {
  const dimension = size === "lg" ? 72 : size === "md" ? 56 : 44;

  return (
    <svg viewBox="0 0 80 80" width={dimension} height={dimension} aria-hidden className="brand-mark-svg">
      <defs>
        <linearGradient id="parcelLabBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#123b66" />
          <stop offset="100%" stopColor="#1f5faf" />
        </linearGradient>
        <linearGradient id="parcelLabGreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#159a9c" />
          <stop offset="100%" stopColor="#2ead6b" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="64" height="64" rx="18" fill="#eff6f7" />
      <path d="M14 43.5 35.5 22 53.5 40 34.5 58.5Z" fill="url(#parcelLabBlue)" />
      <path d="M41 28 60 28 60 47 41 47Z" fill="#dceefa" />
      <path d="M20 49 39 49 39 62 20 62Z" fill="#dff5ea" />
      <path d="M42 49 61 49 61 62 42 62Z" fill="url(#parcelLabGreen)" />
      <path d="M21 49h17.5M42 49h18M41 28h19M30 31.5 47.5 49" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="30" cy="32" r="5" fill="#ffffff" />
      <circle cx="30" cy="32" r="2.6" fill="#2ead6b" />
    </svg>
  );
}

export function BrandLogo({ href, className = "", withTagline = false, size = "md" }: BrandLogoProps) {
  const content = (
    <>
      <span className={`brand-mark brand-mark-${size}`}>
        <ParcelMark size={size} />
      </span>
      <span className="brand-wordmark-wrap">
        <span className={`brand-wordmark brand-wordmark-${size}`}>
          <span className="brand-wordmark-primary">필지</span>
          <span className="brand-wordmark-accent">Lab</span>
        </span>
        {withTagline ? <span className="brand-tagline">필지와 구역을 읽는 토지 분석 도구</span> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`brand-lockup ${className}`.trim()}>
        {content}
      </Link>
    );
  }

  return <div className={`brand-lockup ${className}`.trim()}>{content}</div>;
}

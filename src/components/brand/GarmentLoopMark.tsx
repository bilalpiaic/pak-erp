type GarmentLoopMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

/** Gold badge: clothes hanger inside a circular loop. */
export function GarmentLoopMark({
  size = 32,
  className,
  title = "GarmentLoop",
}: GarmentLoopMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect width="32" height="32" rx="8" fill="#B99445" />
      <circle cx="16" cy="16.7" r="8.3" stroke="#F9F7F2" strokeWidth="2.3" fill="none" />
      <path
        d="M10.3 14.55h11.4"
        stroke="#F9F7F2"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M10.3 14.55 16 22.5 21.7 14.55"
        stroke="#F9F7F2"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function WaveDivider({ className = '' }: { className?: string }) {
  // Two overlapping wave layers scrolling slowly in opposite directions for depth.
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden leading-none ${className}`}>
      <svg
        className="animate-wave block h-16 w-[200%] sm:h-24"
        viewBox="0 0 2400 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,60 C200,110 400,10 600,60 C800,110 1000,10 1200,60 C1400,110 1600,10 1800,60 C2000,110 2200,10 2400,60 L2400,120 L0,120 Z"
          fill="var(--color-sky-mist)"
        />
      </svg>
    </div>
  );
}

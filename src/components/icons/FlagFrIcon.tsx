export function FlagFrIcon({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 18" fill="none" aria-hidden="true">
      <rect width="24" height="18" rx="2" fill="#FFFFFF" />
      <path
        d="M0 2C0 0.895431 0.895431 0 2 0H8V18H2C0.895431 18 0 17.1046 0 16V2Z"
        fill="#002395"
      />
      <path
        d="M16 0H22C23.1046 0 24 0.895431 24 2V16C24 17.1046 23.1046 18 22 18H16V0Z"
        fill="#ED2939"
      />
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="17"
        rx="1.5"
        stroke="currentColor"
        strokeOpacity="0.15"
      />
    </svg>
  );
}

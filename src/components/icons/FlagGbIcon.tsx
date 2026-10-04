export function FlagGbIcon({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 18" fill="none" aria-hidden="true">
      <rect width="24" height="18" rx="2" fill="#012169" />
      <path d="M0 0L24 18M24 0L0 18" stroke="#FFFFFF" strokeWidth="3.5" />
      <path d="M0 0L24 18M24 0L0 18" stroke="#C8102E" strokeWidth="1.5" />
      <path d="M12 0V18M0 9H24" stroke="#FFFFFF" strokeWidth="5" />
      <path d="M12 0V18M0 9H24" stroke="#C8102E" strokeWidth="3" />
    </svg>
  );
}

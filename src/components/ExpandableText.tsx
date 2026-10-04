import { useState } from 'react';
import { getLanguage } from '../i18n/index.ts';

interface ExpandableTextProps {
  text: string;
  className?: string;
  maxChars?: number;
}

export function ExpandableText({
  text,
  className = 'text-[11px] text-stone-500 dark:text-stone-400',
  maxChars = 54,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const lang = getLanguage();

  if (text.length <= maxChars) {
    return <p className={className}>{text}</p>;
  }

  const shortText = `${text.slice(0, maxChars).trimEnd()}…`;

  return (
    <p className={`${className} leading-snug`}>
      <span>{expanded ? text : shortText}</span>{' '}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer text-[11px] p-0 m-0 bg-transparent border-none align-baseline"
      >
        {expanded ? (lang === 'fr' ? 'voir moins' : 'less') : lang === 'fr' ? 'voir plus' : 'more'}
      </button>
    </p>
  );
}

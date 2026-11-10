import type { MouseEventHandler } from 'react';

type Props = {
  label: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  title?: string;
  className?: string;
};

const tagClass = 'inline-flex min-w-0 max-w-56 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium leading-none text-blue-700';

export function JobTag({ label, onClick, title, className = '' }: Props) {
  const classes = `${tagClass} ${onClick ? 'transition hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600' : ''} ${className}`.trim();

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} title={title ?? label}>
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return <span className={classes} title={title ?? label}><span className="truncate">{label}</span></span>;
}

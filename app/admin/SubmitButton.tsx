'use client';

import { useFormStatus } from 'react-dom';

export default function SubmitButton({
  children,
  pendingText,
  className
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        'rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60'
      }
    >
      {pending ? (pendingText ?? 'Attendere…') : children}
    </button>
  );
}

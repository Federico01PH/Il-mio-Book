import type { Metadata } from 'next';
import ResetForm from './ResetForm';

export const metadata: Metadata = { title: 'Reimposta password' };
export const dynamic = 'force-dynamic';

export default function ResetPage({
  searchParams
}: {
  searchParams: { token?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <ResetForm token={searchParams.token ?? ''} />
    </main>
  );
}

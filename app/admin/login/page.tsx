import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Login admin' };

export default function AdminLoginPage({
  searchParams
}: {
  searchParams: { next?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6 text-text">
      <LoginForm next={searchParams.next ?? '/admin'} />
    </main>
  );
}

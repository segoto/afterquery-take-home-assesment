import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LogoutButton } from '@/components/LogoutButton';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/login');
  const payload = await verifyToken(token);
  if (!payload) redirect('/login');

  let jobs: { id: string; title: string; description: string }[] = [];
  let dbError = false;
  try {
    jobs = await prisma.job.findMany({ orderBy: { createdAt: 'asc' } });
  } catch (err) {
    console.error('[page] Failed to load jobs:', err);
    dbError = true;
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">AI Interviewer</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600 truncate">{payload.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-6">Available Positions</h1>
        {dbError ? (
          <p className="text-zinc-500 text-center py-12">
            Unable to load positions. Please try again later.{' '}
            <Link href="/" className="underline text-zinc-700">Refresh</Link>
          </p>
        ) : jobs.length === 0 ? (
          <p className="text-zinc-500 text-center py-12">No positions available at this time.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <Card key={job.id}>
                <h2 className="font-semibold text-lg text-zinc-900">{job.title}</h2>
                <p className="text-sm text-zinc-600 mt-2 line-clamp-3">{job.description}</p>
                <Button href={`/interview/${job.id}`} variant="primary" className="mt-4 w-full">
                  Start Interview
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

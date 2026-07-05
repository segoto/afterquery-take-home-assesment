import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LogoutButton } from '@/components/LogoutButton';
import { SessionListItem } from '@/types';
import { DashboardTabs } from '@/components/DashboardTabs';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/login');
  const payload = await verifyToken(token);
  if (!payload) redirect('/login');

  let jobs: { id: string; title: string; description: string }[] = [];
  let jobsError = false;
  try {
    jobs = await prisma.job.findMany({ orderBy: { createdAt: 'asc' } });
  } catch (err) {
    console.error('[page] Failed to load jobs:', err);
    jobsError = true;
  }

  let sessions: SessionListItem[] = [];
  let sessionsError = false;
  try {
    const rawSessions = await prisma.session.findMany({
      where: { userId: payload.sub },
      include: {
        job: { select: { id: true, title: true } },
        evaluation: { select: { score: true } },
        _count: { select: { turns: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
    sessions = rawSessions.map((s) => ({
      id: s.id,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      job: s.job,
      turnCount: s._count.turns,
      evaluationScore: s.evaluation?.score ?? null,
    }));
  } catch (err) {
    console.error('[page] Failed to load sessions:', err);
    sessionsError = true;
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
        <DashboardTabs
          jobs={jobs}
          jobsError={jobsError}
          sessions={sessions}
          sessionsError={sessionsError}
        />
      </main>
    </div>
  );
}

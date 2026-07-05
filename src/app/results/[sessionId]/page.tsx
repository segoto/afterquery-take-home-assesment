import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LogoutButton } from '@/components/LogoutButton';
import { TranscriptView } from '@/components/TranscriptView';
import { Prisma } from '@/generated/prisma/client';

type SessionWithDetails = Prisma.SessionGetPayload<{
  include: {
    job: { select: { id: true; title: true } };
    turns: true;
    evaluation: true;
  };
}>;

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  // Auth / email extraction
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value ?? '';
  const payload = await verifyToken(token);
  const userEmail = payload?.email ?? '';

  // Data fetch
  let session: SessionWithDetails | null = null;
  let fetchError = false;
  try {
    session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        job: { select: { id: true, title: true } },
        turns: { orderBy: { createdAt: 'asc' } },
        evaluation: true,
      },
    });
  } catch {
    fetchError = true;
  }

  // Error state
  if (fetchError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-zinc-700 mb-4">Something went wrong. Please try again.</p>
        <Button href="/" variant="secondary">Back to Home</Button>
      </main>
    );
  }

  // Not-found state
  if (session === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-zinc-700 mb-4">Session not found.</p>
        <Button href="/" variant="secondary">Back to Home</Button>
      </main>
    );
  }

  // Full layout
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">AI Interviewer</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600 truncate">{userEmail}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        {/* Session details */}
        <section>
          <h1 className="text-2xl font-bold text-zinc-900">{session.job.title} Interview</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-zinc-500">
              {new Date(session.startedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {session.status === 'IN_PROGRESS' && (
              <Badge variant="in-progress">In Progress</Badge>
            )}
            {session.status === 'COMPLETED' && (
              <Badge variant="completed">Completed</Badge>
            )}
            {session.status === 'ABANDONED' && (
              <Badge variant="abandoned">Abandoned</Badge>
            )}
          </div>
          {session.evaluation && (
            <p className="text-lg font-semibold mt-2">
              Score: {session.evaluation.score}/10
            </p>
          )}
        </section>

        {/* Transcript */}
        <section>
          <h2 className="text-xl font-semibold text-zinc-900 mb-4">Transcript</h2>
          {session.turns.length === 0 ? (
            <p className="text-zinc-500">No turns recorded.</p>
          ) : (
            <TranscriptView
              turns={session.turns.map((t) => ({
                id: t.id,
                speaker: t.speaker,
                content: t.content,
                createdAt: t.createdAt.toISOString(),
              }))}
            />
          )}
        </section>

        {/* Evaluation */}
        <section>
          <h2 className="text-xl font-semibold text-zinc-900 mb-4">Evaluation</h2>
          {!session.evaluation ? (
            <p className="text-zinc-500">Evaluation not yet available.</p>
          ) : (
            <>
              <p className="text-2xl font-bold mb-4">
                Score: {session.evaluation.score}/10
              </p>
              <h3 className="text-lg font-semibold mt-4 mb-2">Strengths</h3>
              {Array.isArray(session.evaluation.strengths) ? (
                <ul className="list-disc list-inside text-zinc-700">
                  {(session.evaluation.strengths as string[]).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-500">No data available.</p>
              )}
              <h3 className="text-lg font-semibold mt-4 mb-2">Concerns</h3>
              {Array.isArray(session.evaluation.concerns) ? (
                <ul className="list-disc list-inside text-zinc-700">
                  {(session.evaluation.concerns as string[]).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-500">No data available.</p>
              )}
            </>
          )}
        </section>

        <div>
          <Button href="/" variant="secondary">Back to Home</Button>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SessionListItem } from '@/types';
import { Badge, Button, Card } from '@/components/ui';

interface DashboardTabsProps {
  jobs: Array<{ id: string; title: string; description: string }>;
  jobsError: boolean;
  sessions: SessionListItem[];
  sessionsError: boolean;
}

export function DashboardTabs({
  jobs,
  jobsError,
  sessions,
  sessionsError,
}: DashboardTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'positions' | 'interviews'>('positions');
  const [abandoningId, setAbandoningId] = useState<string | null>(null);
  const [abandonError, setAbandonError] = useState<string | null>(null);

  async function handleAbandon(id: string) {
    setAbandonError(null);
    setAbandoningId(id);
    try {
      const res = await fetch('/api/sessions/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ABANDONED' }),
      });
      if (res.ok) {
        router.refresh();
        setAbandoningId(null);
      } else {
        setAbandoningId(null);
        setAbandonError(id);
      }
    } catch {
      setAbandoningId(null);
      setAbandonError(id);
    }
  }

  return (
    <div>
      <div role="tablist" className="flex border-b border-zinc-200 mb-6">
        <button
          role="tab"
          aria-selected={activeTab === 'positions'}
          onClick={() => setActiveTab('positions')}
          className={
            activeTab === 'positions'
              ? 'px-4 py-2 text-sm font-medium border-b-2 border-zinc-900 text-zinc-900'
              : 'px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700'
          }
        >
          Available Positions
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'interviews'}
          onClick={() => setActiveTab('interviews')}
          className={
            activeTab === 'interviews'
              ? 'px-4 py-2 text-sm font-medium border-b-2 border-zinc-900 text-zinc-900'
              : 'px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700'
          }
        >
          My Interviews
        </button>
      </div>

      <div role="tabpanel">
        {activeTab === 'positions' && (
          <>
            {jobsError ? (
              <p className="text-zinc-500 text-center py-12">
                Unable to load positions. Please try again later.{' '}
                <Link href="/" className="underline text-zinc-700">
                  Refresh
                </Link>
              </p>
            ) : jobs.length === 0 ? (
              <p className="text-zinc-500 text-center py-12">
                No positions available at this time.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {jobs.map((job) => (
                  <Card key={job.id}>
                    <h2 className="font-semibold text-lg text-zinc-900">{job.title}</h2>
                    <p className="text-sm text-zinc-600 mt-2 line-clamp-3">{job.description}</p>
                    <Button
                      href={'/interview/' + job.id}
                      variant="primary"
                      className="mt-4 w-full"
                    >
                      Start Interview
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'interviews' && (
          <>
            {sessionsError ? (
              <p className="text-zinc-500 text-center py-12">
                Unable to load interviews. Please try again later.
              </p>
            ) : sessions.length === 0 ? (
              <p className="text-zinc-500 text-center py-12">
                No past interviews yet. Start one from the Available Positions tab.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {sessions.map((session) => (
                  <Card key={session.id}>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-zinc-900 line-clamp-2">
                        {session.job.title}
                      </h2>
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
                    <p className="text-sm text-zinc-500 mt-1">
                      Started:{' '}
                      {new Date(session.startedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {' · '}
                      {session.turnCount} turn(s)
                    </p>
                    <div className="flex gap-2 justify-end mt-4 flex-wrap">
                      {session.status === 'IN_PROGRESS' && (
                        <>
                          <Button variant="secondary" href={'/interview/' + session.job.id}>
                            Continue
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleAbandon(session.id)}
                            loading={abandoningId === session.id}
                            disabled={abandoningId !== null}
                          >
                            Abandon
                          </Button>
                        </>
                      )}
                      {session.status === 'COMPLETED' && (
                        <Button variant="primary" href={'/results/' + session.id}>
                          View Results
                        </Button>
                      )}
                    </div>
                    {abandonError === session.id && (
                      <p className="text-red-600 text-sm mt-2">
                        Failed to abandon session. Please try again.
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { InterviewRoom } from '@/components/InterviewRoom';
import type { Job } from '@/types';

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  let job;
  try {
    job = await prisma.job.findUnique({ where: { id: jobId } });
  } catch {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-zinc-700 mb-4">Something went wrong. Please try again.</p>
        <Link href="/" className="text-blue-600 underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-zinc-700 mb-4">Job not found.</p>
        <Link href="/" className="text-blue-600 underline">
          Back to home
        </Link>
      </main>
    );
  }

  const jobForClient: Job = {
    id: job.id,
    slug: job.slug,
    title: job.title,
    description: job.description,
    questionPack: job.questionPack as unknown,
    seniority: job.seniority,
  };

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-zinc-900 mb-6">
        {job.title} Interview
      </h1>
      <InterviewRoom job={jobForClient} />
    </main>
  );
}

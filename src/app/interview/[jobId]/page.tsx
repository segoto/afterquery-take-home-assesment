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
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-5xl mx-auto w-full">
      <InterviewRoom job={jobForClient} />
    </main>
  );
}

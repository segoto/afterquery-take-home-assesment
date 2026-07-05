import { Seniority, QuestionType } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export type QuestionBankItem = {
  id: string;
  skill: string;
  weight: number;
  type: QuestionType;
  question: string;
};

export async function getQuestionBank(
  jobId: string,
  seniority: Seniority,
): Promise<QuestionBankItem[]> {
  const skills = await prisma.skill.findMany({
    where: { jobId },
    include: {
      questions: {
        where: {
          OR: [
            { seniority },
            { seniority: null },
          ],
        },
      },
    },
  });

  return skills.flatMap((skill) =>
    skill.questions.map((q) => ({
      id: q.id,
      skill: skill.name,
      weight: skill.weight,
      type: q.type,
      question: q.text,
    })),
  );
}

/**
 * Unit tests for src/lib/questions.ts — getQuestionBank
 *
 * Uses jest.unstable_mockModule (ESM-compatible) with dynamic imports.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Types matching the Prisma-generated shape returned by skill.findMany ────────

type MockQuestion = {
  id: string;
  skillId: string;
  text: string;
  seniority: 'JUNIOR' | 'MID' | 'SENIOR' | null;
  type: 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL';
  createdAt: Date;
};

type MockSkill = {
  id: string;
  jobId: string;
  name: string;
  weight: number;
  questions: MockQuestion[];
};

// ── Set up mock function ───────────────────────────────────────────────────────

const mockSkillFindMany = jest.fn<(args: unknown) => Promise<MockSkill[]>>();

// ── Register ESM-compatible module mock ───────────────────────────────────────

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    skill: {
      findMany: mockSkillFindMany,
    },
  },
}));

// ── Dynamically import after mocks are registered ─────────────────────────────

const { getQuestionBank } = await import('@/lib/questions');

// ── Helpers ───────────────────────────────────────────────────────────────────

const JOB_ID = 'clswe0001000000000000000001';
const NOW = new Date();

function makeQuestion(
  overrides: Partial<MockQuestion> & { id: string },
): MockQuestion {
  return {
    skillId: 'skill_1',
    text: 'Tell me about a time you designed a scalable system.',
    seniority: null,
    type: 'TECHNICAL',
    createdAt: NOW,
    ...overrides,
  };
}

function makeSkill(
  overrides: Partial<MockSkill> & { id: string; name: string },
): MockSkill {
  return {
    jobId: JOB_ID,
    weight: 2,
    questions: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getQuestionBank', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Empty result ─────────────────────────────────────────────────────────

  it('returns [] when no skills exist for the given jobId', async () => {
    mockSkillFindMany.mockResolvedValue([]);

    const result = await getQuestionBank(JOB_ID, 'MID');

    expect(result).toEqual([]);
    expect(mockSkillFindMany).toHaveBeenCalledWith({
      where: { jobId: JOB_ID },
      include: {
        questions: {
          where: {
            OR: [{ seniority: 'MID' }, { seniority: null }],
          },
        },
      },
    });
  });

  // ── 2. One skill, two matching questions → flat array ───────────────────────

  it('returns flat array with correct fields when one skill has two matching questions', async () => {
    const skill = makeSkill({
      id: 'skill_1',
      name: 'System Design',
      weight: 3,
      questions: [
        makeQuestion({ id: 'q1', text: 'How would you design a URL shortener?', type: 'TECHNICAL', seniority: 'MID' }),
        makeQuestion({ id: 'q2', text: 'Describe your approach to system scalability.', type: 'BEHAVIORAL', seniority: null }),
      ],
    });
    mockSkillFindMany.mockResolvedValue([skill]);

    const result = await getQuestionBank(JOB_ID, 'MID');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'q1',
      skill: 'System Design',
      weight: 3,
      type: 'TECHNICAL',
      question: 'How would you design a URL shortener?',
    });
    expect(result[1]).toEqual({
      id: 'q2',
      skill: 'System Design',
      weight: 3,
      type: 'BEHAVIORAL',
      question: 'Describe your approach to system scalability.',
    });
  });

  // ── 3. SENIOR query: returns both SENIOR and null-seniority questions ────────

  it('returns both SENIOR-seniority and null-seniority questions when queried with SENIOR', async () => {
    const skill = makeSkill({
      id: 'skill_2',
      name: 'TypeScript and Node.js',
      weight: 3,
      questions: [
        makeQuestion({ id: 'q3', text: 'How do you design type-safe APIs in TypeScript?', type: 'TECHNICAL', seniority: 'SENIOR' }),
        makeQuestion({ id: 'q4', text: 'Walk me through your approach to async error handling.', type: 'TECHNICAL', seniority: null }),
      ],
    });
    mockSkillFindMany.mockResolvedValue([skill]);

    const result = await getQuestionBank(JOB_ID, 'SENIOR');

    expect(result).toHaveLength(2);
    const ids = result.map((item) => item.id);
    expect(ids).toContain('q3');
    expect(ids).toContain('q4');
  });

  // ── 4. SENIOR query: does NOT return JUNIOR-only questions ──────────────────

  it('returns only the null-seniority question when a JUNIOR question is filtered out for SENIOR query', async () => {
    // The DB filter (OR: [{ seniority: 'SENIOR' }, { seniority: null }]) excludes JUNIOR.
    // We simulate the post-filter result: the mock returns only the null-seniority question.
    const skill = makeSkill({
      id: 'skill_3',
      name: 'Testing and Quality',
      weight: 2,
      questions: [
        makeQuestion({ id: 'q5', text: 'How do you approach testing in large-scale applications?', type: 'BEHAVIORAL', seniority: null }),
        // JUNIOR question is absent — already filtered by the DB (simulated here)
      ],
    });
    mockSkillFindMany.mockResolvedValue([skill]);

    const result = await getQuestionBank(JOB_ID, 'SENIOR');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q5');
  });

  // ── 5. Two skills → flat (non-nested) array ─────────────────────────────────

  it('returns a flat array when two skills each have questions', async () => {
    const skillA = makeSkill({
      id: 'skill_4',
      name: 'Collaboration',
      weight: 1,
      questions: [
        makeQuestion({ id: 'q6', text: 'Describe a time you resolved a conflict within your team.', type: 'BEHAVIORAL', seniority: null }),
      ],
    });
    const skillB = makeSkill({
      id: 'skill_5',
      name: 'System Design',
      weight: 3,
      questions: [
        makeQuestion({ id: 'q7', text: 'How would you design a distributed cache?', type: 'TECHNICAL', seniority: null }),
        makeQuestion({ id: 'q8', text: 'Walk me through a situation where you had to trade off consistency for availability.', type: 'SITUATIONAL', seniority: null }),
      ],
    });
    mockSkillFindMany.mockResolvedValue([skillA, skillB]);

    const result = await getQuestionBank(JOB_ID, 'MID');

    expect(result).toHaveLength(3);
    // Ensure result is flat — no nested arrays
    expect(Array.isArray(result)).toBe(true);
    result.forEach((item) => {
      expect(typeof item.id).toBe('string');
      expect(typeof item.skill).toBe('string');
      expect(typeof item.weight).toBe('number');
      expect(typeof item.type).toBe('string');
      expect(typeof item.question).toBe('string');
    });
    const ids = result.map((item) => item.id);
    expect(ids).toContain('q6');
    expect(ids).toContain('q7');
    expect(ids).toContain('q8');
  });
});

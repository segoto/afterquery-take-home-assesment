import { JOBS } from '@/lib/jobs';

describe('JOBS constant', () => {
  it('has at least 3 entries', () => {
    expect(JOBS.length).toBeGreaterThanOrEqual(3);
  });

  it('every entry has a non-empty id', () => {
    for (const job of JOBS) {
      expect(typeof job.id).toBe('string');
      expect(job.id.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty slug', () => {
    for (const job of JOBS) {
      expect(typeof job.slug).toBe('string');
      expect(job.slug.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty title', () => {
    for (const job of JOBS) {
      expect(typeof job.title).toBe('string');
      expect(job.title.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty description', () => {
    for (const job of JOBS) {
      expect(typeof job.description).toBe('string');
      expect(job.description.length).toBeGreaterThan(0);
    }
  });

  it('every id is unique', () => {
    const ids = JOBS.map((job) => job.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every slug is unique', () => {
    const slugs = JOBS.map((job) => job.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it('questionPack is null for all entries', () => {
    for (const job of JOBS) {
      expect(job.questionPack).toBeNull();
    }
  });
});

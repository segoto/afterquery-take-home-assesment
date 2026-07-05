import { prisma } from '../src/lib/prisma';
import { JOBS } from '../src/lib/jobs';

async function main() {
  for (const job of JOBS) {
    await prisma.job.upsert({
      where: { slug: job.slug },
      update: { title: job.title, description: job.description },
      create: { slug: job.slug, title: job.title, description: job.description },
    });
  }
  console.log(`Seeded ${JOBS.length} jobs.`);

  const [sweJob, pmJob, daJob] = await Promise.all([
    prisma.job.findUniqueOrThrow({ where: { slug: 'software-engineer' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'product-manager' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'data-analyst' } }),
  ]);
  const SWE_JOB_ID = sweJob.id;
  const PM_JOB_ID  = pmJob.id;
  const DA_JOB_ID  = daJob.id;

  // ---------------------------------------------------------------------------
  // Software Engineer
  // ---------------------------------------------------------------------------

  // Skill: System Design (weight 3)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: SWE_JOB_ID, name: 'System Design' } },
    update: {},
    create: { id: 'sswe-sys', jobId: SWE_JOB_ID, name: 'System Design', weight: 3 },
  });

  await prisma.question.upsert({
    where: { id: 'qswe-sys-001' },
    update: {},
    create: {
      id: 'qswe-sys-001',
      skillId: 'sswe-sys',
      text: 'Can you walk me through how you would design a URL shortener service that needs to handle millions of requests per day?',
      type: 'TECHNICAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-sys-002' },
    update: {},
    create: {
      id: 'qswe-sys-002',
      skillId: 'sswe-sys',
      text: 'How would you design a distributed caching layer to reduce database load in a high-traffic web application?',
      type: 'TECHNICAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-sys-003' },
    update: {},
    create: {
      id: 'qswe-sys-003',
      skillId: 'sswe-sys',
      text: 'Describe your approach to designing a microservices architecture for an e-commerce platform. What trade-offs would you consider?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-sys-004' },
    update: {},
    create: {
      id: 'qswe-sys-004',
      skillId: 'sswe-sys',
      text: 'Tell me about a time you had to redesign a system that was failing under load. What decisions did you make and what was the outcome?',
      type: 'BEHAVIORAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-sys-005' },
    update: {},
    create: {
      id: 'qswe-sys-005',
      skillId: 'sswe-sys',
      text: 'How have you approached documenting system design decisions in a way that helps your team understand trade-offs?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-sys-006' },
    update: {},
    create: {
      id: 'qswe-sys-006',
      skillId: 'sswe-sys',
      text: "Your team is building a new payment processing system and you're concerned about data consistency across services. How would you handle this?",
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-sys-007' },
    update: {},
    create: {
      id: 'qswe-sys-007',
      skillId: 'sswe-sys',
      text: "A sudden traffic spike is causing your monolithic app to fail. You're asked to propose a migration plan to microservices with minimal downtime. What's your approach?",
      type: 'SITUATIONAL',
      seniority: 'JUNIOR',
    },
  });

  // Skill: TypeScript and Node.js (weight 3)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: SWE_JOB_ID, name: 'TypeScript and Node.js' } },
    update: {},
    create: { id: 'sswe-ts', jobId: SWE_JOB_ID, name: 'TypeScript and Node.js', weight: 3 },
  });

  await prisma.question.upsert({
    where: { id: 'qswe-ts-001' },
    update: {},
    create: {
      id: 'qswe-ts-001',
      skillId: 'sswe-ts',
      text: "What are the key differences between TypeScript's structural typing and nominal typing, and how does this affect how you design interfaces?",
      type: 'TECHNICAL',
      seniority: 'MID',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-ts-002' },
    update: {},
    create: {
      id: 'qswe-ts-002',
      skillId: 'sswe-ts',
      text: 'Explain how the Node.js event loop works and how it affects the way you write asynchronous code.',
      type: 'TECHNICAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-ts-003' },
    update: {},
    create: {
      id: 'qswe-ts-003',
      skillId: 'sswe-ts',
      text: 'How do you handle errors in async/await code to ensure they are always caught and logged appropriately?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-ts-004' },
    update: {},
    create: {
      id: 'qswe-ts-004',
      skillId: 'sswe-ts',
      text: 'Tell me about a time you refactored a JavaScript codebase to TypeScript. What challenges did you encounter?',
      type: 'BEHAVIORAL',
      seniority: 'MID',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-ts-005' },
    update: {},
    create: {
      id: 'qswe-ts-005',
      skillId: 'sswe-ts',
      text: 'How do you stay up to date with changes in the Node.js and TypeScript ecosystems?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-ts-006' },
    update: {},
    create: {
      id: 'qswe-ts-006',
      skillId: 'sswe-ts',
      text: 'You inherit a Node.js service with no type annotations and frequent runtime errors in production. How do you incrementally improve it?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-ts-007' },
    update: {},
    create: {
      id: 'qswe-ts-007',
      skillId: 'sswe-ts',
      text: 'A junior team member is confused about when to use generics versus union types. How would you explain this distinction?',
      type: 'SITUATIONAL',
      seniority: 'SENIOR',
    },
  });

  // Skill: Testing and Quality (weight 2)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: SWE_JOB_ID, name: 'Testing and Quality' } },
    update: {},
    create: { id: 'sswe-qa', jobId: SWE_JOB_ID, name: 'Testing and Quality', weight: 2 },
  });

  await prisma.question.upsert({
    where: { id: 'qswe-qa-001' },
    update: {},
    create: {
      id: 'qswe-qa-001',
      skillId: 'sswe-qa',
      text: 'What is the difference between unit tests, integration tests, and end-to-end tests? When would you use each?',
      type: 'TECHNICAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-qa-002' },
    update: {},
    create: {
      id: 'qswe-qa-002',
      skillId: 'sswe-qa',
      text: 'How do you approach testing code that depends on external services or databases?',
      type: 'TECHNICAL',
      seniority: 'MID',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-qa-003' },
    update: {},
    create: {
      id: 'qswe-qa-003',
      skillId: 'sswe-qa',
      text: 'Describe a time when a test suite gave you false confidence and a bug slipped to production. What did you learn?',
      type: 'BEHAVIORAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-qa-004' },
    update: {},
    create: {
      id: 'qswe-qa-004',
      skillId: 'sswe-qa',
      text: 'How do you advocate for testing practices in a team that sees tests as a bottleneck?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-qa-005' },
    update: {},
    create: {
      id: 'qswe-qa-005',
      skillId: 'sswe-qa',
      text: 'Your team has a codebase with zero test coverage. How do you prioritize what to test first?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-qa-006' },
    update: {},
    create: {
      id: 'qswe-qa-006',
      skillId: 'sswe-qa',
      text: "A critical regression is found in production after a release. How do you use this incident to improve your team's testing practices?",
      type: 'SITUATIONAL',
      seniority: null,
    },
  });

  // Skill: Collaboration (weight 1)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: SWE_JOB_ID, name: 'Collaboration' } },
    update: {},
    create: { id: 'sswe-col', jobId: SWE_JOB_ID, name: 'Collaboration', weight: 1 },
  });

  await prisma.question.upsert({
    where: { id: 'qswe-col-001' },
    update: {},
    create: {
      id: 'qswe-col-001',
      skillId: 'sswe-col',
      text: 'How do you approach code reviews to ensure they are constructive and educational rather than adversarial?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-col-002' },
    update: {},
    create: {
      id: 'qswe-col-002',
      skillId: 'sswe-col',
      text: 'Tell me about a time you disagreed with a technical decision made by your team. How did you handle it?',
      type: 'BEHAVIORAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-col-003' },
    update: {},
    create: {
      id: 'qswe-col-003',
      skillId: 'sswe-col',
      text: "Describe how you've mentored a junior engineer and helped them grow.",
      type: 'BEHAVIORAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-col-004' },
    update: {},
    create: {
      id: 'qswe-col-004',
      skillId: 'sswe-col',
      text: 'How do you ensure clear communication between engineering and non-technical stakeholders during a project?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-col-005' },
    update: {},
    create: {
      id: 'qswe-col-005',
      skillId: 'sswe-col',
      text: "You're working with a remote team across multiple time zones on a critical feature. How do you keep everyone aligned?",
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qswe-col-006' },
    update: {},
    create: {
      id: 'qswe-col-006',
      skillId: 'sswe-col',
      text: 'A product manager keeps changing requirements mid-sprint. How do you handle this while maintaining team morale?',
      type: 'SITUATIONAL',
      seniority: 'SENIOR',
    },
  });

  console.log('Seeded Software Engineer skills and questions.');

  // ---------------------------------------------------------------------------
  // Product Manager
  // ---------------------------------------------------------------------------

  // Skill: Product Strategy (weight 3)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: PM_JOB_ID, name: 'Product Strategy' } },
    update: {},
    create: { id: 'sspm-str', jobId: PM_JOB_ID, name: 'Product Strategy', weight: 3 },
  });

  await prisma.question.upsert({
    where: { id: 'qspm-str-001' },
    update: {},
    create: {
      id: 'qspm-str-001',
      skillId: 'sspm-str',
      text: "How do you evaluate whether a new feature aligns with your product's strategic goals?",
      type: 'TECHNICAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-str-002' },
    update: {},
    create: {
      id: 'qspm-str-002',
      skillId: 'sspm-str',
      text: 'Walk me through how you build and communicate a product roadmap to stakeholders with conflicting priorities.',
      type: 'TECHNICAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-str-003' },
    update: {},
    create: {
      id: 'qspm-str-003',
      skillId: 'sspm-str',
      text: 'Tell me about a product decision you made that turned out to be wrong. What did you learn and how did you course-correct?',
      type: 'BEHAVIORAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-str-004' },
    update: {},
    create: {
      id: 'qspm-str-004',
      skillId: 'sspm-str',
      text: "Describe how you've used data to challenge an assumption that was widely held by your team or leadership.",
      type: 'BEHAVIORAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-str-005' },
    update: {},
    create: {
      id: 'qspm-str-005',
      skillId: 'sspm-str',
      text: 'How do you balance short-term business needs with long-term strategic vision?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-str-006' },
    update: {},
    create: {
      id: 'qspm-str-006',
      skillId: 'sspm-str',
      text: "Your company is entering a new market and you're tasked with defining the MVP. How do you decide what to build first?",
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-str-007' },
    update: {},
    create: {
      id: 'qspm-str-007',
      skillId: 'sspm-str',
      text: 'A key competitor has just launched a feature your users have been requesting. How do you respond strategically?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });

  // Skill: Stakeholder Management (weight 2)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: PM_JOB_ID, name: 'Stakeholder Management' } },
    update: {},
    create: { id: 'sspm-stk', jobId: PM_JOB_ID, name: 'Stakeholder Management', weight: 2 },
  });

  await prisma.question.upsert({
    where: { id: 'qspm-stk-001' },
    update: {},
    create: {
      id: 'qspm-stk-001',
      skillId: 'sspm-stk',
      text: 'What frameworks or tools do you use to track and communicate progress with stakeholders?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-stk-002' },
    update: {},
    create: {
      id: 'qspm-stk-002',
      skillId: 'sspm-stk',
      text: 'Tell me about a time you had to deliver bad news to a senior executive. How did you prepare and what was the outcome?',
      type: 'BEHAVIORAL',
      seniority: 'MID',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-stk-003' },
    update: {},
    create: {
      id: 'qspm-stk-003',
      skillId: 'sspm-stk',
      text: 'How do you manage a stakeholder who constantly escalates issues and bypasses your team?',
      type: 'BEHAVIORAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-stk-004' },
    update: {},
    create: {
      id: 'qspm-stk-004',
      skillId: 'sspm-stk',
      text: "Describe how you've built trust with a team that was initially skeptical of your product vision.",
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-stk-005' },
    update: {},
    create: {
      id: 'qspm-stk-005',
      skillId: 'sspm-stk',
      text: 'Two senior stakeholders have fundamentally different views on what the product should prioritize. How do you resolve this?',
      type: 'SITUATIONAL',
      seniority: 'MID',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-stk-006' },
    update: {},
    create: {
      id: 'qspm-stk-006',
      skillId: 'sspm-stk',
      text: "A key stakeholder is threatening to pull funding if a feature isn't shipped in two weeks. How do you handle this?",
      type: 'SITUATIONAL',
      seniority: null,
    },
  });

  // Skill: User Research (weight 3)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: PM_JOB_ID, name: 'User Research' } },
    update: {},
    create: { id: 'sspm-res', jobId: PM_JOB_ID, name: 'User Research', weight: 3 },
  });

  await prisma.question.upsert({
    where: { id: 'qspm-res-001' },
    update: {},
    create: {
      id: 'qspm-res-001',
      skillId: 'sspm-res',
      text: 'What qualitative research methods do you use to uncover unmet user needs?',
      type: 'TECHNICAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-res-002' },
    update: {},
    create: {
      id: 'qspm-res-002',
      skillId: 'sspm-res',
      text: 'How do you design a survey to minimize bias in the responses?',
      type: 'TECHNICAL',
      seniority: 'MID',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-res-003' },
    update: {},
    create: {
      id: 'qspm-res-003',
      skillId: 'sspm-res',
      text: 'Tell me about a time user research completely changed the direction of a product or feature.',
      type: 'BEHAVIORAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-res-004' },
    update: {},
    create: {
      id: 'qspm-res-004',
      skillId: 'sspm-res',
      text: 'How do you synthesize research findings into a clear problem statement that your team can act on?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-res-005' },
    update: {},
    create: {
      id: 'qspm-res-005',
      skillId: 'sspm-res',
      text: 'Your team disagrees on the user persona for the product. How do you facilitate alignment?',
      type: 'SITUATIONAL',
      seniority: 'MID',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-res-006' },
    update: {},
    create: {
      id: 'qspm-res-006',
      skillId: 'sspm-res',
      text: "You need to validate a new product concept in two weeks with a very limited budget. What's your research plan?",
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-res-007' },
    update: {},
    create: {
      id: 'qspm-res-007',
      skillId: 'sspm-res',
      text: 'A usability test shows users struggling with a flow that engineering has already built. How do you handle next steps?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });

  // Skill: Prioritization (weight 2)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: PM_JOB_ID, name: 'Prioritization' } },
    update: {},
    create: { id: 'sspm-pri', jobId: PM_JOB_ID, name: 'Prioritization', weight: 2 },
  });

  await prisma.question.upsert({
    where: { id: 'qspm-pri-001' },
    update: {},
    create: {
      id: 'qspm-pri-001',
      skillId: 'sspm-pri',
      text: 'What prioritization frameworks (e.g. RICE, MoSCoW) have you used and when do you choose one over another?',
      type: 'TECHNICAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-pri-002' },
    update: {},
    create: {
      id: 'qspm-pri-002',
      skillId: 'sspm-pri',
      text: 'How do you calculate or estimate the ROI of a feature before committing engineering resources?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-pri-003' },
    update: {},
    create: {
      id: 'qspm-pri-003',
      skillId: 'sspm-pri',
      text: 'Tell me about a time you had to say no to a feature request from a high-priority customer. How did you handle it?',
      type: 'BEHAVIORAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-pri-004' },
    update: {},
    create: {
      id: 'qspm-pri-004',
      skillId: 'sspm-pri',
      text: 'How do you handle a backlog that has grown too large for your team to realistically address?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-pri-005' },
    update: {},
    create: {
      id: 'qspm-pri-005',
      skillId: 'sspm-pri',
      text: 'You have three equally important features to ship but only capacity for one this quarter. How do you decide?',
      type: 'SITUATIONAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qspm-pri-006' },
    update: {},
    create: {
      id: 'qspm-pri-006',
      skillId: 'sspm-pri',
      text: 'Engineering tells you a feature you deprioritized is causing 30% of support tickets. How do you re-evaluate your backlog?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });

  console.log('Seeded Product Manager skills and questions.');

  // ---------------------------------------------------------------------------
  // Data Analyst
  // ---------------------------------------------------------------------------

  // Skill: SQL and Data Querying (weight 3)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: DA_JOB_ID, name: 'SQL and Data Querying' } },
    update: {},
    create: { id: 'ssda-sql', jobId: DA_JOB_ID, name: 'SQL and Data Querying', weight: 3 },
  });

  await prisma.question.upsert({
    where: { id: 'qsda-sql-001' },
    update: {},
    create: {
      id: 'qsda-sql-001',
      skillId: 'ssda-sql',
      text: 'How would you write a SQL query to find the top 10 customers by total revenue in the last 30 days?',
      type: 'TECHNICAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sql-002' },
    update: {},
    create: {
      id: 'qsda-sql-002',
      skillId: 'ssda-sql',
      text: 'Explain the difference between INNER JOIN, LEFT JOIN, and FULL OUTER JOIN with a concrete example.',
      type: 'TECHNICAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sql-003' },
    update: {},
    create: {
      id: 'qsda-sql-003',
      skillId: 'ssda-sql',
      text: 'What are window functions in SQL and when would you use them instead of GROUP BY?',
      type: 'TECHNICAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sql-004' },
    update: {},
    create: {
      id: 'qsda-sql-004',
      skillId: 'ssda-sql',
      text: 'How do you optimize a slow SQL query? Walk me through your diagnostic process.',
      type: 'TECHNICAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sql-005' },
    update: {},
    create: {
      id: 'qsda-sql-005',
      skillId: 'ssda-sql',
      text: 'Tell me about a time you discovered a data quality issue through a SQL query. How did you investigate and resolve it?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sql-006' },
    update: {},
    create: {
      id: 'qsda-sql-006',
      skillId: 'ssda-sql',
      text: "You're asked to build a report but the data is spread across five tables with inconsistent keys. How do you approach the query?",
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sql-007' },
    update: {},
    create: {
      id: 'qsda-sql-007',
      skillId: 'ssda-sql',
      text: 'A stakeholder wants to see conversion rates broken down by cohort month. How do you construct this analysis in SQL?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });

  // Skill: Data Visualization (weight 2)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: DA_JOB_ID, name: 'Data Visualization' } },
    update: {},
    create: { id: 'ssda-viz', jobId: DA_JOB_ID, name: 'Data Visualization', weight: 2 },
  });

  await prisma.question.upsert({
    where: { id: 'qsda-viz-001' },
    update: {},
    create: {
      id: 'qsda-viz-001',
      skillId: 'ssda-viz',
      text: 'What principles guide your choice of chart type for a given dataset?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-viz-002' },
    update: {},
    create: {
      id: 'qsda-viz-002',
      skillId: 'ssda-viz',
      text: 'How do you design a dashboard that is useful for both technical and non-technical audiences?',
      type: 'TECHNICAL',
      seniority: 'MID',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-viz-003' },
    update: {},
    create: {
      id: 'qsda-viz-003',
      skillId: 'ssda-viz',
      text: 'Tell me about a dashboard you built that drove a meaningful business decision. What made it effective?',
      type: 'BEHAVIORAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-viz-004' },
    update: {},
    create: {
      id: 'qsda-viz-004',
      skillId: 'ssda-viz',
      text: 'How do you handle a situation where a stakeholder asks for a visualization that you believe would be misleading?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-viz-005' },
    update: {},
    create: {
      id: 'qsda-viz-005',
      skillId: 'ssda-viz',
      text: "You're asked to build an executive dashboard that updates in real time from multiple data sources. How do you approach it?",
      type: 'SITUATIONAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-viz-006' },
    update: {},
    create: {
      id: 'qsda-viz-006',
      skillId: 'ssda-viz',
      text: "A stakeholder says the dashboard you built is 'too complicated.' How do you simplify it without losing important information?",
      type: 'SITUATIONAL',
      seniority: null,
    },
  });

  // Skill: Statistical Analysis (weight 3)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: DA_JOB_ID, name: 'Statistical Analysis' } },
    update: {},
    create: { id: 'ssda-sta', jobId: DA_JOB_ID, name: 'Statistical Analysis', weight: 3 },
  });

  await prisma.question.upsert({
    where: { id: 'qsda-sta-001' },
    update: {},
    create: {
      id: 'qsda-sta-001',
      skillId: 'ssda-sta',
      text: 'What is the difference between correlation and causation? Can you give an example from a data analysis context?',
      type: 'TECHNICAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sta-002' },
    update: {},
    create: {
      id: 'qsda-sta-002',
      skillId: 'ssda-sta',
      text: 'How do you determine the appropriate sample size for an A/B test?',
      type: 'TECHNICAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sta-003' },
    update: {},
    create: {
      id: 'qsda-sta-003',
      skillId: 'ssda-sta',
      text: 'Explain p-values and statistical significance to a non-technical stakeholder.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sta-004' },
    update: {},
    create: {
      id: 'qsda-sta-004',
      skillId: 'ssda-sta',
      text: 'Tell me about a time your statistical analysis led to a counterintuitive insight. How did you validate it?',
      type: 'BEHAVIORAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sta-005' },
    update: {},
    create: {
      id: 'qsda-sta-005',
      skillId: 'ssda-sta',
      text: 'How do you handle missing data in a dataset before running an analysis?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sta-006' },
    update: {},
    create: {
      id: 'qsda-sta-006',
      skillId: 'ssda-sta',
      text: 'A product team wants to run an A/B test but the traffic volume is very low. How do you advise them?',
      type: 'SITUATIONAL',
      seniority: 'SENIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-sta-007' },
    update: {},
    create: {
      id: 'qsda-sta-007',
      skillId: 'ssda-sta',
      text: 'You notice an anomaly in the data during a routine analysis. How do you determine if it\'s a real signal or a data error?',
      type: 'SITUATIONAL',
      seniority: 'SENIOR',
    },
  });

  // Skill: Communication (weight 1)
  await prisma.skill.upsert({
    where: { jobId_name: { jobId: DA_JOB_ID, name: 'Communication' } },
    update: {},
    create: { id: 'ssda-com', jobId: DA_JOB_ID, name: 'Communication', weight: 1 },
  });

  await prisma.question.upsert({
    where: { id: 'qsda-com-001' },
    update: {},
    create: {
      id: 'qsda-com-001',
      skillId: 'ssda-com',
      text: 'How do you structure a data analysis presentation so that it tells a clear story rather than just showing numbers?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-com-002' },
    update: {},
    create: {
      id: 'qsda-com-002',
      skillId: 'ssda-com',
      text: 'Tell me about a time you had to explain a complex statistical finding to a non-technical audience. How did you approach it?',
      type: 'BEHAVIORAL',
      seniority: 'JUNIOR',
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-com-003' },
    update: {},
    create: {
      id: 'qsda-com-003',
      skillId: 'ssda-com',
      text: 'How do you handle pushback from a stakeholder who disagrees with your analysis findings?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-com-004' },
    update: {},
    create: {
      id: 'qsda-com-004',
      skillId: 'ssda-com',
      text: "Describe how you've proactively shared data insights with a team that wasn't asking for them. What was the impact?",
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-com-005' },
    update: {},
    create: {
      id: 'qsda-com-005',
      skillId: 'ssda-com',
      text: "A business leader asks you to validate a decision they've already made with data. How do you handle this ethically?",
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qsda-com-006' },
    update: {},
    create: {
      id: 'qsda-com-006',
      skillId: 'ssda-com',
      text: 'You disagree with the conclusions a colleague drew from data you both analyzed. How do you raise this?',
      type: 'SITUATIONAL',
      seniority: 'SENIOR',
    },
  });

  console.log('Seeded Data Analyst skills and questions.');
  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

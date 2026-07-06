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

  // ---------------------------------------------------------------------------
  // Bank Questions (DB-driven adaptive question bank)
  // ---------------------------------------------------------------------------

  const bankJobs = await Promise.all([
    prisma.job.findUniqueOrThrow({ where: { slug: 'software-engineer' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'product-manager' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'data-analyst' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'frontend-engineer' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'backend-engineer' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'devops-engineer' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'data-engineer' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'ml-engineer' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'qa-engineer' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'product-manager-technical' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'site-reliability-engineer' } }),
    prisma.job.findUniqueOrThrow({ where: { slug: 'security-engineer' } }),
  ]);
  const [
    bankSweJob, bankPmJob, bankDaJob, bankFeJob, bankBeJob, bankDvoJob,
    bankDeJob, bankMleJob, bankQaJob, bankPmtJob, bankSreJob, bankSecJob,
  ] = bankJobs;

  // --- Software Engineer (qb-swe-001 to qb-swe-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-swe-001' },
    update: {},
    create: {
      id: 'qb-swe-001',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'Walk me through how you design a type-safe REST API in TypeScript, including error handling and input validation.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-002' },
    update: {},
    create: {
      id: 'qb-swe-002',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'Describe how you would architect a distributed system that requires strong consistency across multiple services.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-003' },
    update: {},
    create: {
      id: 'qb-swe-003',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'How do you diagnose and fix a memory leak in a long-running Node.js service in production?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-004' },
    update: {},
    create: {
      id: 'qb-swe-004',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'What is your approach to implementing a multi-layer caching strategy and what cache invalidation pitfalls do you watch out for?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-005' },
    update: {},
    create: {
      id: 'qb-swe-005',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'Tell me about a time you disagreed with a teammate on an architectural decision. How did you resolve it?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-006' },
    update: {},
    create: {
      id: 'qb-swe-006',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'Describe a situation where you mentored a junior developer and helped them grow. What was your approach?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-007' },
    update: {},
    create: {
      id: 'qb-swe-007',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'Tell me about a time you had to deliver under an extremely tight deadline without compromising code quality. How did you manage it?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-008' },
    update: {},
    create: {
      id: 'qb-swe-008',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'How do you approach code reviews to balance thoroughness with not becoming a bottleneck for the team?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-009' },
    update: {},
    create: {
      id: 'qb-swe-009',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'A production deploy has caused data corruption affecting 5% of users. You are on call. Walk me through your first 30 minutes of response.',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-010' },
    update: {},
    create: {
      id: 'qb-swe-010',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'Your service is experiencing unexpected latency spikes during peak hours but behaves normally off-peak. How do you investigate and resolve this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-011' },
    update: {},
    create: {
      id: 'qb-swe-011',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'The team is asked to migrate a monolith to microservices with zero downtime and a hard six-month deadline. How do you plan and prioritize this work?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-swe-012' },
    update: {},
    create: {
      id: 'qb-swe-012',
      jobId: bankSweJob.id,
      skillId: null,
      text: 'You notice the CI/CD pipeline frequently takes 45 minutes to run. Other engineers complain it slows them down. What steps do you take to improve it?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for Software Engineer.');

  // --- Product Manager (qb-pm-001 to qb-pm-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-pm-001' },
    update: {},
    create: {
      id: 'qb-pm-001',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'Walk me through how you use the RICE framework to prioritize a backlog with competing features.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-002' },
    update: {},
    create: {
      id: 'qb-pm-002',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'How do you write a user story that captures enough context for engineers to build without over-specifying the solution?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-003' },
    update: {},
    create: {
      id: 'qb-pm-003',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'What metrics do you define to determine whether a newly launched feature is successful? How do you set baseline and target values?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-004' },
    update: {},
    create: {
      id: 'qb-pm-004',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'How do you define and communicate the MVP for a new product area? What criteria determine what is in versus out of scope?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-005' },
    update: {},
    create: {
      id: 'qb-pm-005',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'Tell me about a time you managed significant stakeholder conflict where engineering and sales had opposing feature priorities. What did you do?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-006' },
    update: {},
    create: {
      id: 'qb-pm-006',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'Describe a product launch that did not go as planned. What did you learn and how did you course-correct?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-007' },
    update: {},
    create: {
      id: 'qb-pm-007',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'Tell me about a time you worked cross-functionally with design, engineering, and marketing to ship a feature. What was your role?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-008' },
    update: {},
    create: {
      id: 'qb-pm-008',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'How do you communicate a product roadmap to stakeholders who have very different levels of technical knowledge?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-009' },
    update: {},
    create: {
      id: 'qb-pm-009',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'Engineering and sales both have high-priority feature requests and the team only has capacity for one this quarter. How do you decide and communicate the decision?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-010' },
    update: {},
    create: {
      id: 'qb-pm-010',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'Your planned product launch has been blocked by the legal team two weeks before the ship date. How do you handle this situation?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-011' },
    update: {},
    create: {
      id: 'qb-pm-011',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'A top enterprise customer says they will churn unless you build their specific feature request within 60 days. How do you evaluate and respond to this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pm-012' },
    update: {},
    create: {
      id: 'qb-pm-012',
      jobId: bankPmJob.id,
      skillId: null,
      text: 'Post-launch data shows users are dropping off at a specific step in your new onboarding flow. How do you diagnose and address the problem?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for Product Manager.');

  // --- Data Analyst (qb-da-001 to qb-da-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-da-001' },
    update: {},
    create: {
      id: 'qb-da-001',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'Explain how window functions like RANK, DENSE_RANK, and ROW_NUMBER differ, and give a use case where you would choose each.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-002' },
    update: {},
    create: {
      id: 'qb-da-002',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'Describe your process for cleaning a dataset that has missing values, duplicates, and inconsistent formatting before analysis.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-003' },
    update: {},
    create: {
      id: 'qb-da-003',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'Walk me through how you would design and analyze an A/B test, including how you determine statistical significance.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-004' },
    update: {},
    create: {
      id: 'qb-da-004',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'What principles guide your design of a business dashboard so that it drives decisions rather than just reporting numbers?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-005' },
    update: {},
    create: {
      id: 'qb-da-005',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'Tell me about a time you had to explain a complex statistical finding to a non-technical executive and change their opinion. How did you approach it?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-006' },
    update: {},
    create: {
      id: 'qb-da-006',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'Describe a situation where you delivered a critical report under a tight deadline. How did you ensure accuracy and clarity?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-007' },
    update: {},
    create: {
      id: 'qb-da-007',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'Tell me about a time you discovered an anomaly or data quality issue proactively. What was the impact and how did you handle it?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-008' },
    update: {},
    create: {
      id: 'qb-da-008',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'How do you handle a situation where a stakeholder asks you to present data in a way you believe would be misleading?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-009' },
    update: {},
    create: {
      id: 'qb-da-009',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'Two different data sources you rely on are showing conflicting numbers for the same metric. How do you identify the root cause and what do you report in the meantime?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-010' },
    update: {},
    create: {
      id: 'qb-da-010',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'A senior leader asks you to validate a strategic decision they have already announced publicly. The data does not support it. How do you handle this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-011' },
    update: {},
    create: {
      id: 'qb-da-011',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'You are asked to track the ROI of a marketing campaign that ran across channels with no consistent UTM tagging. How do you approach this analysis?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-da-012' },
    update: {},
    create: {
      id: 'qb-da-012',
      jobId: bankDaJob.id,
      skillId: null,
      text: 'An A/B test for a key feature shows a statistically significant improvement but the sample size is very small. How do you advise the product team?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for Data Analyst.');

  // --- Frontend Engineer (qb-fe-001 to qb-fe-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-fe-001' },
    update: {},
    create: {
      id: 'qb-fe-001',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'Explain the techniques you use to optimize React application performance, including memoization, code splitting, and lazy loading.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-002' },
    update: {},
    create: {
      id: 'qb-fe-002',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'What are the WCAG accessibility guidelines you consider most critical when building a public-facing UI, and how do you test for them?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-003' },
    update: {},
    create: {
      id: 'qb-fe-003',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'How do you structure CSS in a large React application to avoid specificity conflicts and maintain long-term maintainability?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-004' },
    update: {},
    create: {
      id: 'qb-fe-004',
      jobId: bankFeJob.id,
      skillId: null,
      text: "Describe how React's reconciliation algorithm works and how understanding it influences your component design decisions.",
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-005' },
    update: {},
    create: {
      id: 'qb-fe-005',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'Tell me about a time you closely collaborated with a designer to implement a complex UI. How did you handle differences between the mockup and what was technically feasible?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-006' },
    update: {},
    create: {
      id: 'qb-fe-006',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'Describe a significant refactoring of a legacy frontend codebase you led. What drove the decision and how did you manage the risk?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-007' },
    update: {},
    create: {
      id: 'qb-fe-007',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'Tell me about a time user feedback led you to rethink a UI design choice you were confident in. How did you respond?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-008' },
    update: {},
    create: {
      id: 'qb-fe-008',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'How do you stay current with the rapidly evolving frontend ecosystem and decide which new tools or patterns to adopt?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-009' },
    update: {},
    create: {
      id: 'qb-fe-009',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'A designer hands you a pixel-perfect mockup that turns out to be inaccessible for keyboard-only users. How do you navigate this with the design team while meeting the launch date?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-010' },
    update: {},
    create: {
      id: 'qb-fe-010',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'Your application has a critical layout issue in Safari that only affects 8% of users but your engineering lead says it is not worth fixing right now. How do you respond?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-011' },
    update: {},
    create: {
      id: 'qb-fe-011',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'You are tasked with improving the Lighthouse score of a page from 45 to above 90. Describe your systematic approach and the biggest wins you would look for first.',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-fe-012' },
    update: {},
    create: {
      id: 'qb-fe-012',
      jobId: bankFeJob.id,
      skillId: null,
      text: 'The product team wants to ship an animated feature that you know will cause severe jank on mid-tier mobile devices. How do you handle this technically and politically?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for Frontend Engineer.');

  // --- Backend Engineer (qb-be-001 to qb-be-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-be-001' },
    update: {},
    create: {
      id: 'qb-be-001',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'Explain the trade-offs between using indexes, composite indexes, and partial indexes in PostgreSQL for a write-heavy workload.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-002' },
    update: {},
    create: {
      id: 'qb-be-002',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'When would you choose GraphQL over REST for an API, and what additional complexity does GraphQL introduce?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-003' },
    update: {},
    create: {
      id: 'qb-be-003',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'How do you design a backend service that needs to handle 10,000 concurrent connections with low latency and minimal resource usage?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-004' },
    update: {},
    create: {
      id: 'qb-be-004',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'Describe the communication patterns you consider when designing microservices — synchronous vs. asynchronous, event-driven, and saga patterns for distributed transactions.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-005' },
    update: {},
    create: {
      id: 'qb-be-005',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'Tell me about a time you debugged a production issue that was caused by a non-obvious interaction between services. How did you identify the root cause?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-006' },
    update: {},
    create: {
      id: 'qb-be-006',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'Describe how you balance technical debt reduction with shipping new product features. How do you make the case to non-technical stakeholders?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-007' },
    update: {},
    create: {
      id: 'qb-be-007',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'Tell me about a time you improved the reliability of a backend system significantly. What did you change and how did you measure the improvement?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-008' },
    update: {},
    create: {
      id: 'qb-be-008',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'How do you approach API versioning to avoid breaking existing clients while evolving the API?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-009' },
    update: {},
    create: {
      id: 'qb-be-009',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'A downstream service your API depends on starts returning errors for 20% of requests. Your service has no circuit breaker. How do you respond and what do you build to prevent recurrence?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-010' },
    update: {},
    create: {
      id: 'qb-be-010',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'You need to migrate a 500 million row table to a new schema with zero downtime and no data loss. Walk me through your migration strategy.',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-011' },
    update: {},
    create: {
      id: 'qb-be-011',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'Your team discovers that a widely used internal API endpoint has no authentication. You cannot take it offline immediately. What steps do you take?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-be-012' },
    update: {},
    create: {
      id: 'qb-be-012',
      jobId: bankBeJob.id,
      skillId: null,
      text: 'You inherit a service with no documentation, no tests, and a single point of failure. Leadership asks you to make it production-ready in eight weeks. How do you prioritize?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for Backend Engineer.');

  // --- DevOps Engineer (qb-dvo-001 to qb-dvo-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-dvo-001' },
    update: {},
    create: {
      id: 'qb-dvo-001',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'Walk me through how you would design a Kubernetes cluster architecture for a multi-tenant SaaS application, covering node pools, namespaces, and resource quotas.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-002' },
    update: {},
    create: {
      id: 'qb-dvo-002',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'Describe how you architect a CI/CD pipeline that supports multiple environments (dev, staging, prod) with automated tests and approval gates.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-003' },
    update: {},
    create: {
      id: 'qb-dvo-003',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'What are the principles of infrastructure as code, and how do you manage state, secrets, and drift in Terraform at scale?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-004' },
    update: {},
    create: {
      id: 'qb-dvo-004',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'How do you design an observability stack — metrics, logs, and traces — to give engineers full visibility into production services?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-005' },
    update: {},
    create: {
      id: 'qb-dvo-005',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'Tell me about a production outage you were responsible for resolving. What steps did you take during the incident and in the post-mortem?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-006' },
    update: {},
    create: {
      id: 'qb-dvo-006',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'Describe a time you significantly improved the developer experience for your engineering team. What was the bottleneck and what did you change?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-007' },
    update: {},
    create: {
      id: 'qb-dvo-007',
      jobId: bankDvoJob.id,
      skillId: null,
      text: "How do you build a culture of reliability and ownership within an engineering team that traditionally sees infrastructure as someone else's problem?",
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-008' },
    update: {},
    create: {
      id: 'qb-dvo-008',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'Tell me about a time you had to reduce cloud infrastructure costs significantly. What was your approach and what trade-offs did you make?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-009' },
    update: {},
    create: {
      id: 'qb-dvo-009',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'A critical security vulnerability is discovered in a base Docker image used across 40 services in production. You need to patch all of them within 24 hours. How do you execute this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-010' },
    update: {},
    create: {
      id: 'qb-dvo-010',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'Your deployment pipeline fails two hours before a business-critical release. The root cause is unclear and the on-call team is unavailable. What do you do?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-011' },
    update: {},
    create: {
      id: 'qb-dvo-011',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'You are asked to migrate your entire infrastructure from one cloud provider to another with less than two weeks of downtime budget spread across six months. How do you plan this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-dvo-012' },
    update: {},
    create: {
      id: 'qb-dvo-012',
      jobId: bankDvoJob.id,
      skillId: null,
      text: 'Your Kubernetes cluster is running at 85% CPU capacity and a major product launch is planned in two weeks. You have a limited budget for new nodes. How do you handle this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for DevOps Engineer.');

  // --- Data Engineer (qb-de-001 to qb-de-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-de-001' },
    update: {},
    create: {
      id: 'qb-de-001',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'Describe how you would design a data pipeline that ingests 1 TB of event data per day — comparing batch and streaming approaches and when you would choose each.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-002' },
    update: {},
    create: {
      id: 'qb-de-002',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'What data quality checks do you build into an ETL pipeline, and how do you alert on and recover from data quality failures?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-003' },
    update: {},
    create: {
      id: 'qb-de-003',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'How do you handle schema evolution in a data pipeline where upstream producers change their event structure over time?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-004' },
    update: {},
    create: {
      id: 'qb-de-004',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'Compare the star schema and data vault modeling approaches. When would you use each and what are their trade-offs for analytical queries?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-005' },
    update: {},
    create: {
      id: 'qb-de-005',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'Tell me about a time you collaborated closely with data scientists or analysts to understand their data needs and design a pipeline that served them well. What was the most challenging part?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-006' },
    update: {},
    create: {
      id: 'qb-de-006',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'Describe a production pipeline failure you managed end-to-end, from detection to resolution. What did you learn and change afterward?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-007' },
    update: {},
    create: {
      id: 'qb-de-007',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'How do you approach documenting data pipelines and data lineage so that future engineers can maintain and extend them?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-008' },
    update: {},
    create: {
      id: 'qb-de-008',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'Tell me about a time you had to optimize a slow data transformation job. What was the bottleneck and how did you resolve it?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-009' },
    update: {},
    create: {
      id: 'qb-de-009',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'An upstream team changes their event schema without warning, breaking your pipeline and causing three hours of missing data. How do you respond immediately and what do you put in place to prevent recurrence?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-010' },
    update: {},
    create: {
      id: 'qb-de-010',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'An analytics team reports that data in the warehouse is 12 hours behind schedule and they have an executive presentation in two hours. How do you triage and communicate?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-011' },
    update: {},
    create: {
      id: 'qb-de-011',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'You are asked to build a near-real-time dashboard that shows sales metrics updated every 30 seconds. Your current batch pipeline runs hourly. How do you approach the redesign?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-de-012' },
    update: {},
    create: {
      id: 'qb-de-012',
      jobId: bankDeJob.id,
      skillId: null,
      text: 'Your data lake is growing at 20% per month and storage costs are exceeding budget. How do you design a retention and archiving strategy without disrupting active consumers?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for Data Engineer.');

  // --- ML Engineer (qb-mle-001 to qb-mle-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-mle-001' },
    update: {},
    create: {
      id: 'qb-mle-001',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'Compare precision, recall, F1, and AUC-ROC as model evaluation metrics. For a fraud detection model, which would you prioritize and why?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-002' },
    update: {},
    create: {
      id: 'qb-mle-002',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'Describe the components of an ML training pipeline — from data ingestion to model registry — and the choices you make at each step.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-003' },
    update: {},
    create: {
      id: 'qb-mle-003',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'What feature engineering techniques have you found most impactful in practice, and how do you prevent train-test leakage when engineering features?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-004' },
    update: {},
    create: {
      id: 'qb-mle-004',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'How do you deploy a machine learning model to production in a way that supports A/B testing, canary rollouts, and fast rollback?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-005' },
    update: {},
    create: {
      id: 'qb-mle-005',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'Tell me about a time you presented model evaluation results to a non-technical audience and had to translate metrics like AUC or RMSE into business impact. How did you frame it?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-006' },
    update: {},
    create: {
      id: 'qb-mle-006',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'Describe a model that significantly underperformed in production compared to your offline evaluation. What caused the gap and how did you recover?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-007' },
    update: {},
    create: {
      id: 'qb-mle-007',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'How do you stay current with research advances in machine learning while also maintaining and shipping production systems?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-008' },
    update: {},
    create: {
      id: 'qb-mle-008',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'Tell me about a time you had to simplify or trade accuracy for interpretability or latency in a model. How did you make that call?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-009' },
    update: {},
    create: {
      id: 'qb-mle-009',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'After a six-month deployment, you discover your recommendation model has a significant demographic bias that favors one user segment over another. How do you handle this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-010' },
    update: {},
    create: {
      id: 'qb-mle-010',
      jobId: bankMleJob.id,
      skillId: null,
      text: "Your production model's performance has been degrading steadily for three weeks due to feature drift. You need to retrain but retraining takes eight hours and there is no automated trigger. How do you handle the immediate problem and design a better system?",
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-011' },
    update: {},
    create: {
      id: 'qb-mle-011',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'The business wants to deploy a model to a market where you have very little training data. How do you decide whether the model is ready, and what safeguards do you build in?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-mle-012' },
    update: {},
    create: {
      id: 'qb-mle-012',
      jobId: bankMleJob.id,
      skillId: null,
      text: 'You are asked to reduce model inference latency from 500 ms to under 50 ms without retraining from scratch. What techniques do you explore and in what order?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for ML Engineer.');

  // --- QA Engineer (qb-qa-001 to qb-qa-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-qa-001' },
    update: {},
    create: {
      id: 'qb-qa-001',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'Explain the test pyramid and how you decide what proportion of tests should be unit, integration, and end-to-end for a given product.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-002' },
    update: {},
    create: {
      id: 'qb-qa-002',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'How do you design an automation framework for a web application — covering page object patterns, test data management, and CI integration?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-003' },
    update: {},
    create: {
      id: 'qb-qa-003',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'What is your approach to performance testing — from defining load profiles to identifying bottlenecks and deciding when performance is acceptable?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-004' },
    update: {},
    create: {
      id: 'qb-qa-004',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'How do you write effective bug reports that give developers enough context to reproduce and fix issues efficiently?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-005' },
    update: {},
    create: {
      id: 'qb-qa-005',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'Tell me about a time you had to advocate strongly for quality under intense deadline pressure. How did you make the case and what was the outcome?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-006' },
    update: {},
    create: {
      id: 'qb-qa-006',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'Describe a critical bug you found very late in the release cycle. How did you communicate it and work with the team to decide the path forward?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-007' },
    update: {},
    create: {
      id: 'qb-qa-007',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'How do you build a collaborative relationship with developers so that quality is treated as a shared responsibility rather than a QA gatekeeper role?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-008' },
    update: {},
    create: {
      id: 'qb-qa-008',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'Tell me about a time you identified a gap in test coverage that was not obvious to the rest of the team. How did you identify it and what did you do?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-009' },
    update: {},
    create: {
      id: 'qb-qa-009',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'A major feature is about to ship but you have uncovered 15 open bugs of varying severity. The release manager says the ship date cannot move. How do you triage and advise leadership?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-010' },
    update: {},
    create: {
      id: 'qb-qa-010',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'You inherited a test suite where 30% of tests are flaky. They run in CI, causing builds to fail randomly. How do you prioritize fixing them without blocking the team?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-011' },
    update: {},
    create: {
      id: 'qb-qa-011',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'A feature was shipped without proper QA sign-off due to a miscommunication. It caused a production regression affecting users. How do you handle the post-incident review and prevent recurrence?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-qa-012' },
    update: {},
    create: {
      id: 'qb-qa-012',
      jobId: bankQaJob.id,
      skillId: null,
      text: 'You are asked to introduce automated testing into a large legacy codebase that has none. The team is resistant and management wants results in 90 days. How do you approach this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for QA Engineer.');

  // --- Product Manager – Technical (qb-pmt-001 to qb-pmt-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-pmt-001' },
    update: {},
    create: {
      id: 'qb-pmt-001',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'How do you evaluate the quality of an API design during a product review with engineering — what signals tell you it is too complex, under-specified, or inconsistent?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-002' },
    update: {},
    create: {
      id: 'qb-pmt-002',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'How do you read a system architecture diagram with engineering and identify the product-level trade-offs — things like consistency, availability, and latency — that should influence your roadmap?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-003' },
    update: {},
    create: {
      id: 'qb-pmt-003',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'How do you identify and prioritize technical debt on your roadmap, and how do you frame it to business stakeholders who do not understand its cost?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-004' },
    update: {},
    create: {
      id: 'qb-pmt-004',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'Describe how you write acceptance criteria for a technically complex feature in a way that is unambiguous for engineers but also traceable to business outcomes.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-005' },
    update: {},
    create: {
      id: 'qb-pmt-005',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'Tell me about a time you collaborated with engineering on a technically difficult feasibility question. How did you bridge the gap between what the business wanted and what was buildable?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-006' },
    update: {},
    create: {
      id: 'qb-pmt-006',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'Describe how you communicated a significant technical constraint to business or executive stakeholders in a way they could act on.',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-007' },
    update: {},
    create: {
      id: 'qb-pmt-007',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'Tell me about a time engineering pushed back hard on your timeline or scope. How did you respond and what was the resolution?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-008' },
    update: {},
    create: {
      id: 'qb-pmt-008',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'How do you earn and maintain credibility with a highly technical engineering team as a product manager who may not write code?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-009' },
    update: {},
    create: {
      id: 'qb-pmt-009',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'Engineering estimates that your most important roadmap item will take four months, but the business expects it in six weeks. Both timelines are fixed. How do you navigate this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-010' },
    update: {},
    create: {
      id: 'qb-pmt-010',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'Your roadmap has a hard technical dependency on a platform migration that engineering says will take three months. Sales has already committed to customers that the dependent feature will be available in two months. How do you handle this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-011' },
    update: {},
    create: {
      id: 'qb-pmt-011',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'A third-party API your product critically depends on is being deprecated in 90 days. Engineering says migration will take 120 days and require pausing all other feature work. How do you manage this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-pmt-012' },
    update: {},
    create: {
      id: 'qb-pmt-012',
      jobId: bankPmtJob.id,
      skillId: null,
      text: 'You are leading a product that serves both enterprise and consumer segments, and the engineering team says you cannot serve both with the same architecture. How do you make the call?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for Product Manager – Technical.');

  // --- Site Reliability Engineer (qb-sre-001 to qb-sre-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-sre-001' },
    update: {},
    create: {
      id: 'qb-sre-001',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'Explain the difference between SLIs, SLOs, and SLAs. How do you define SLIs for a latency-sensitive API and set realistic SLO targets?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-002' },
    update: {},
    create: {
      id: 'qb-sre-002',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'What components do you include in an incident response runbook to ensure an on-call engineer can act effectively in the first 15 minutes of a P0 incident?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-003' },
    update: {},
    create: {
      id: 'qb-sre-003',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'Describe your approach to chaos engineering — how do you design experiments, select blast radii, and measure whether your system behaves resiliently?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-004' },
    update: {},
    create: {
      id: 'qb-sre-004',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'How do you design capacity planning models that account for traffic seasonality, feature launches, and organic growth to prevent capacity crises?',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-005' },
    update: {},
    create: {
      id: 'qb-sre-005',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'Tell me about a blameless postmortem you led or participated in. How did you ensure it produced actionable improvements without scapegoating?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-006' },
    update: {},
    create: {
      id: 'qb-sre-006',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'Describe how you managed on-call rotation for a team with high incident frequency. What changes did you drive to reduce on-call burden and prevent burnout?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-007' },
    update: {},
    create: {
      id: 'qb-sre-007',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'How do you build a culture where development teams feel ownership over reliability — not just SRE — and actively participate in on-call and post-mortems?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-008' },
    update: {},
    create: {
      id: 'qb-sre-008',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'Tell me about a time you identified and eliminated a class of toil through automation. How did you prioritize it and measure the impact?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-009' },
    update: {},
    create: {
      id: 'qb-sre-009',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'A cascading failure has taken down three interdependent services simultaneously. Your error budget for the quarter is nearly exhausted. Walk me through your incident command and the decisions you are making in real time.',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-010' },
    update: {},
    create: {
      id: 'qb-sre-010',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'You need to expand infrastructure capacity by 40% for a planned product launch in three weeks but your budget approval is stuck in procurement. How do you manage this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-011' },
    update: {},
    create: {
      id: 'qb-sre-011',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'A development team wants to ship a feature that your analysis shows will consume 30% of your remaining error budget in the first week. How do you handle this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sre-012' },
    update: {},
    create: {
      id: 'qb-sre-012',
      jobId: bankSreJob.id,
      skillId: null,
      text: 'An on-call engineer escalates to you because monitoring shows an alert firing but the system appears healthy. How do you investigate whether this is a false positive or a real problem that has not yet manifested?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for Site Reliability Engineer.');

  // --- Security Engineer (qb-sec-001 to qb-sec-012) ---
  await prisma.question.upsert({
    where: { id: 'qb-sec-001' },
    update: {},
    create: {
      id: 'qb-sec-001',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'Walk me through how you conduct a threat model for a new API feature — the framework you use, who you involve, and how you translate findings into engineering requirements.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-002' },
    update: {},
    create: {
      id: 'qb-sec-002',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'Describe the key security checkpoints you integrate into an SDLC — from design review to deployment — to shift security left without becoming a bottleneck.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-003' },
    update: {},
    create: {
      id: 'qb-sec-003',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'Explain your methodology for a web application penetration test — scoping, reconnaissance, attack phases, and how you report findings by severity.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-004' },
    update: {},
    create: {
      id: 'qb-sec-004',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'Compare OAuth 2.0 authorization flows — authorization code, client credentials, and implicit — and explain when you would use each and what the security trade-offs are.',
      type: 'TECHNICAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-005' },
    update: {},
    create: {
      id: 'qb-sec-005',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'Tell me about a time you built a security awareness program or trained developers on secure coding. What was the most effective element and how did you measure behavior change?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-006' },
    update: {},
    create: {
      id: 'qb-sec-006',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'Describe a situation where you identified a critical vulnerability and had to balance immediate risk mitigation with not disrupting ongoing product development. How did you navigate it?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-007' },
    update: {},
    create: {
      id: 'qb-sec-007',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'How do you build trust and partnership with engineering teams who may view security as bureaucratic overhead?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-008' },
    update: {},
    create: {
      id: 'qb-sec-008',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'Tell me about a time you had to make a difficult risk-acceptance decision — where you could not fully eliminate a vulnerability. How did you frame the residual risk and who approved it?',
      type: 'BEHAVIORAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-009' },
    update: {},
    create: {
      id: 'qb-sec-009',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'You have confirmed a data breach: customer PII has been accessed by an unauthorized party. Your first 60 minutes are now. Walk me through your response — who you contact, what you contain, and what you preserve.',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-010' },
    update: {},
    create: {
      id: 'qb-sec-010',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'The business wants to ship a feature that requires storing sensitive payment data in a way that violates your data classification policy. The PM says customers are waiting. How do you handle this?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-011' },
    update: {},
    create: {
      id: 'qb-sec-011',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'A bug bounty researcher has submitted a critical SQL injection vulnerability in your production API with a working proof-of-concept. Your patching process typically takes two weeks. How do you respond?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  await prisma.question.upsert({
    where: { id: 'qb-sec-012' },
    update: {},
    create: {
      id: 'qb-sec-012',
      jobId: bankSecJob.id,
      skillId: null,
      text: 'You discover that a third-party dependency widely used across your platform has a known CVE rated 9.8 (critical). Patching requires upgrading a major version that may break APIs. How do you manage the remediation?',
      type: 'SITUATIONAL',
      seniority: null,
    },
  });
  console.log('Seeded 12 bank questions for Security Engineer.');

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

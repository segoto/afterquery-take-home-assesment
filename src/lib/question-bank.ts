export interface BankQuestion {
  id: string;
  text: string;
  type: 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL';
  skill: string;
}

export const QUESTION_BANKS: Record<string, BankQuestion[]> = {
  // ─── Software Engineer ──────────────────────────────────────────────────────
  clswe0001000000000000000001: [
    {
      id: 'sqb-swe-001',
      text: 'Walk me through how you design a type-safe REST API in TypeScript, including error handling and input validation.',
      type: 'TECHNICAL',
      skill: 'TypeScript and Node.js',
    },
    {
      id: 'sqb-swe-002',
      text: 'Describe how you would design a URL shortening service to handle millions of requests per day, including data store choices.',
      type: 'TECHNICAL',
      skill: 'System Design',
    },
    {
      id: 'sqb-swe-003',
      text: 'Tell me about a particularly challenging bug you encountered in a distributed system. How did you isolate and fix it?',
      type: 'TECHNICAL',
      skill: 'Debugging',
    },
    {
      id: 'sqb-swe-004',
      text: 'Describe your approach when you review a pull request that has significant design flaws. How do you handle the feedback process?',
      type: 'BEHAVIORAL',
      skill: 'Code Review',
    },
    {
      id: 'sqb-swe-005',
      text: 'Tell me about a time you had a significant technical disagreement with a teammate. How did it get resolved?',
      type: 'BEHAVIORAL',
      skill: 'Collaboration',
    },
    {
      id: 'sqb-swe-006',
      text: 'Give me an example of a project where you took ownership beyond your defined role. What did you do and what was the outcome?',
      type: 'BEHAVIORAL',
      skill: 'Ownership',
    },
    {
      id: 'sqb-swe-007',
      text: 'Imagine our primary database becomes unresponsive at 2 AM. You are on-call. Walk me through your response process.',
      type: 'SITUATIONAL',
      skill: 'Production Incident Response',
    },
    {
      id: 'sqb-swe-008',
      text: 'A product manager asks you to implement a feature in a way that introduces significant technical debt. How do you respond?',
      type: 'SITUATIONAL',
      skill: 'Technical Communication',
    },
    {
      id: 'sqb-swe-009',
      text: 'How do you approach versioning a public REST API when you need to make a breaking change?',
      type: 'TECHNICAL',
      skill: 'API Design',
    },
    {
      id: 'sqb-swe-010',
      text: 'Tell me about a time a feature you shipped caused an issue in production. What happened and what did you learn?',
      type: 'BEHAVIORAL',
      skill: 'Handling Failure',
    },
    {
      id: 'sqb-swe-011',
      text: 'Your team has a hard deadline in two weeks, but the existing codebase requires refactoring before the feature can be added safely. What do you do?',
      type: 'SITUATIONAL',
      skill: 'Deadlines and Tech Debt',
    },
    {
      id: 'sqb-swe-012',
      text: 'What practices do you use to maintain code quality across a growing codebase? Describe your philosophy on testing.',
      type: 'TECHNICAL',
      skill: 'Code Quality',
    },
  ],

  // ─── Product Manager ─────────────────────────────────────────────────────────
  clspm0002000000000000000002: [
    {
      id: 'sqb-spm-001',
      text: 'Walk me through how you would define success metrics for a new user onboarding flow.',
      type: 'TECHNICAL',
      skill: 'Metrics Definition',
    },
    {
      id: 'sqb-spm-002',
      text: 'Describe how you write a product requirement document. What sections do you consider essential?',
      type: 'TECHNICAL',
      skill: 'Requirements Writing',
    },
    {
      id: 'sqb-spm-003',
      text: 'How do you use data to validate assumptions in your roadmap? Give a concrete example.',
      type: 'TECHNICAL',
      skill: 'Data-driven Decision Making',
    },
    {
      id: 'sqb-spm-004',
      text: 'Tell me about a time you had to cut scope to hit a deadline. How did you decide what to cut?',
      type: 'BEHAVIORAL',
      skill: 'Prioritization',
    },
    {
      id: 'sqb-spm-005',
      text: 'Describe a situation where you had to communicate a product direction change to a resistant stakeholder.',
      type: 'BEHAVIORAL',
      skill: 'Stakeholder Communication',
    },
    {
      id: 'sqb-spm-006',
      text: 'Give me an example of how you collaborated with an engineering team to refine a complex technical requirement.',
      type: 'BEHAVIORAL',
      skill: 'Cross-functional Collaboration',
    },
    {
      id: 'sqb-spm-007',
      text: 'The CEO wants one feature, your largest customer wants another, and engineering warns of a critical debt issue. You can only pick one. How do you decide?',
      type: 'SITUATIONAL',
      skill: 'Conflicting Priorities',
    },
    {
      id: 'sqb-spm-008',
      text: 'One hour before a major launch, QA discovers a reproducible but low-severity bug. The marketing campaign is already live. What do you do?',
      type: 'SITUATIONAL',
      skill: 'Launch Decision Making',
    },
    {
      id: 'sqb-spm-009',
      text: 'How do you develop and articulate a long-term product vision that aligns engineering efforts?',
      type: 'TECHNICAL',
      skill: 'Product Vision',
    },
    {
      id: 'sqb-spm-010',
      text: 'Tell me about a time engineering pushed back significantly on a feature in your roadmap. How did you handle it?',
      type: 'BEHAVIORAL',
      skill: 'Roadmap Alignment',
    },
    {
      id: 'sqb-spm-011',
      text: 'Your quantitative metrics show one thing, but user interviews suggest the opposite. How do you resolve the conflict?',
      type: 'SITUATIONAL',
      skill: 'User Research vs Data',
    },
    {
      id: 'sqb-spm-012',
      text: 'Describe how you handle a situation where senior leadership provides unclear or changing direction.',
      type: 'BEHAVIORAL',
      skill: 'Handling Ambiguity',
    },
  ],

  // ─── Data Analyst ─────────────────────────────────────────────────────────────
  clsda0003000000000000000003: [
    {
      id: 'sqb-sda-001',
      text: 'Explain how you would write a SQL query to calculate week-over-week retention rate for a mobile app. Walk me through your logic.',
      type: 'TECHNICAL',
      skill: 'SQL',
    },
    {
      id: 'sqb-sda-002',
      text: 'Describe your workflow when given a raw CSV with quality issues and asked to produce an executive-level summary.',
      type: 'TECHNICAL',
      skill: 'Python Analysis',
    },
    {
      id: 'sqb-sda-003',
      text: 'What principles guide the way you design a business dashboard for non-technical stakeholders?',
      type: 'TECHNICAL',
      skill: 'Dashboard Design',
    },
    {
      id: 'sqb-sda-004',
      text: 'Tell me about a time your data analysis led to a counterintuitive conclusion. How did you communicate it to stakeholders?',
      type: 'BEHAVIORAL',
      skill: 'Communication of Insights',
    },
    {
      id: 'sqb-sda-005',
      text: 'Describe a situation where you received a vague analytical request. How did you clarify requirements and deliver value?',
      type: 'BEHAVIORAL',
      skill: 'Handling Ambiguity',
    },
    {
      id: 'sqb-sda-006',
      text: 'Give an example of how you worked with an engineering team to improve data quality or pipeline reliability.',
      type: 'BEHAVIORAL',
      skill: 'Engineering Collaboration',
    },
    {
      id: 'sqb-sda-007',
      text: 'Two separate reports show different revenue numbers for the same period. Leadership asks you to reconcile them by end of day. What do you do?',
      type: 'SITUATIONAL',
      skill: 'Conflicting Data Sources',
    },
    {
      id: 'sqb-sda-008',
      text: 'You present a well-reasoned analysis, but the business team rejects your findings because they contradict their expectations. How do you respond?',
      type: 'SITUATIONAL',
      skill: 'Stakeholder Pushback',
    },
    {
      id: 'sqb-sda-009',
      text: 'How do you differentiate between a real trend and random noise in a time-series dataset?',
      type: 'TECHNICAL',
      skill: 'Statistical Analysis',
    },
    {
      id: 'sqb-sda-010',
      text: 'How do you structure an analysis presentation to drive decision-making rather than just reporting numbers?',
      type: 'BEHAVIORAL',
      skill: 'Data Storytelling',
    },
    {
      id: 'sqb-sda-011',
      text: 'Midway through an important quarterly analysis, you discover the ETL pipeline has been producing incorrect data for three weeks. How do you handle it?',
      type: 'SITUATIONAL',
      skill: 'Data Pipeline Failure',
    },
    {
      id: 'sqb-sda-012',
      text: 'What methods do you use to detect and address data quality issues before they impact downstream analytics?',
      type: 'TECHNICAL',
      skill: 'Data Quality',
    },
  ],

  // ─── Frontend Engineer ────────────────────────────────────────────────────────
  clbfe0004000000000000000004: [
    {
      id: 'sqb-bfe-001',
      text: 'Explain the difference between server-side rendering and client-side rendering in Next.js and when you would choose each.',
      type: 'TECHNICAL',
      skill: 'React and Next.js',
    },
    {
      id: 'sqb-bfe-002',
      text: 'How does the browser critical rendering path work, and what techniques do you use to optimize it?',
      type: 'TECHNICAL',
      skill: 'Browser Rendering',
    },
    {
      id: 'sqb-bfe-003',
      text: 'Describe how you would diagnose and fix a React application with slow initial load times.',
      type: 'TECHNICAL',
      skill: 'Performance Optimization',
    },
    {
      id: 'sqb-bfe-004',
      text: 'Tell me about a time you worked closely with a designer to implement a UI component. What was the most challenging aspect?',
      type: 'BEHAVIORAL',
      skill: 'Design Collaboration',
    },
    {
      id: 'sqb-bfe-005',
      text: 'How do you approach giving and receiving code review feedback in a frontend codebase?',
      type: 'BEHAVIORAL',
      skill: 'Code Reviews',
    },
    {
      id: 'sqb-bfe-006',
      text: 'Describe your approach to ensuring a UI is accessible. How do you advocate for accessibility within your team?',
      type: 'BEHAVIORAL',
      skill: 'Accessibility',
    },
    {
      id: 'sqb-bfe-007',
      text: 'A new release doubled the First Contentful Paint time for our landing page. How do you investigate and fix it?',
      type: 'SITUATIONAL',
      skill: 'Performance Regression',
    },
    {
      id: 'sqb-bfe-008',
      text: 'Users on Safari report that a key feature is broken, but it works perfectly in Chrome. Walk me through your debugging process.',
      type: 'SITUATIONAL',
      skill: 'Cross-browser Debugging',
    },
    {
      id: 'sqb-bfe-009',
      text: 'What is the compound component pattern in React and when would you use it over simpler approaches?',
      type: 'TECHNICAL',
      skill: 'Component Design Patterns',
    },
    {
      id: 'sqb-bfe-010',
      text: 'How do you handle a situation where design mockups are incomplete or contradictory when a deadline is approaching?',
      type: 'BEHAVIORAL',
      skill: 'Handling Ambiguity',
    },
    {
      id: 'sqb-bfe-011',
      text: 'A designer insists on an animation that significantly impacts performance. How do you navigate this disagreement?',
      type: 'SITUATIONAL',
      skill: 'Designer-Developer Disagreement',
    },
    {
      id: 'sqb-bfe-012',
      text: 'Compare different state management approaches in a large React application. When would you reach for Redux vs Context vs local state?',
      type: 'TECHNICAL',
      skill: 'State Management',
    },
  ],

  // ─── Backend Engineer ─────────────────────────────────────────────────────────
  clbbe0005000000000000000005: [
    {
      id: 'sqb-bbe-001',
      text: 'Walk me through designing a RESTful API for a multi-tenant SaaS application, including authentication, rate limiting, and versioning.',
      type: 'TECHNICAL',
      skill: 'API Design',
    },
    {
      id: 'sqb-bbe-002',
      text: 'How do you decide between a relational database and a NoSQL database for a given use case?',
      type: 'TECHNICAL',
      skill: 'Database Modeling',
    },
    {
      id: 'sqb-bbe-003',
      text: 'Explain how you would implement a retry mechanism with exponential backoff for an unreliable third-party API.',
      type: 'TECHNICAL',
      skill: 'Fault-tolerant Architecture',
    },
    {
      id: 'sqb-bbe-004',
      text: 'Tell me about a time you improved the reliability of a backend service. What was broken, and what did you change?',
      type: 'BEHAVIORAL',
      skill: 'System Reliability',
    },
    {
      id: 'sqb-bbe-005',
      text: 'Describe a significant code review you conducted. What issues did you find and how did you communicate them?',
      type: 'BEHAVIORAL',
      skill: 'Code Reviews',
    },
    {
      id: 'sqb-bbe-006',
      text: 'Walk me through your systematic approach to debugging a backend service that is intermittently returning 500 errors.',
      type: 'BEHAVIORAL',
      skill: 'Debugging',
    },
    {
      id: 'sqb-bbe-007',
      text: 'You need to add a NOT NULL column to a 50-million-row table with zero downtime. What is your approach?',
      type: 'SITUATIONAL',
      skill: 'Database Migration at Scale',
    },
    {
      id: 'sqb-bbe-008',
      text: 'A breaking change is required in a widely-used internal API. How do you manage the migration while keeping all consumers working?',
      type: 'SITUATIONAL',
      skill: 'API Versioning',
    },
    {
      id: 'sqb-bbe-009',
      text: 'What are the most common security vulnerabilities in web APIs and how do you defend against them?',
      type: 'TECHNICAL',
      skill: 'Security',
    },
    {
      id: 'sqb-bbe-010',
      text: 'Give an example of how you worked with a frontend team to design a shared API contract. What made it successful?',
      type: 'BEHAVIORAL',
      skill: 'Cross-team Collaboration',
    },
    {
      id: 'sqb-bbe-011',
      text: 'A third-party integration is receiving too many requests from your service and threatening to block your API key. How do you address it immediately and architecturally?',
      type: 'SITUATIONAL',
      skill: 'Rate Limiting',
    },
    {
      id: 'sqb-bbe-012',
      text: 'What are the trade-offs of splitting a monolith into microservices, and how do you decide when to do it?',
      type: 'TECHNICAL',
      skill: 'Microservices',
    },
  ],

  // ─── DevOps Engineer ──────────────────────────────────────────────────────────
  cldvo0006000000000000000006: [
    {
      id: 'sqb-dvo-001',
      text: 'Describe how you would design a CI/CD pipeline for a microservices application deployed on Kubernetes.',
      type: 'TECHNICAL',
      skill: 'CI/CD Pipelines',
    },
    {
      id: 'sqb-dvo-002',
      text: 'Explain the difference between Docker and Kubernetes and how they complement each other in a production environment.',
      type: 'TECHNICAL',
      skill: 'Containerization',
    },
    {
      id: 'sqb-dvo-003',
      text: 'How have you used Terraform or similar tools to manage cloud infrastructure? What are your best practices?',
      type: 'TECHNICAL',
      skill: 'Infrastructure as Code',
    },
    {
      id: 'sqb-dvo-004',
      text: 'Describe your experience with on-call rotations. What was the most challenging incident you responded to?',
      type: 'BEHAVIORAL',
      skill: 'On-call Experience',
    },
    {
      id: 'sqb-dvo-005',
      text: 'Walk me through how you conduct a blameless post-mortem after a production incident.',
      type: 'BEHAVIORAL',
      skill: 'Incident Response',
    },
    {
      id: 'sqb-dvo-006',
      text: 'Tell me about a time you worked with a development team to improve their deployment process.',
      type: 'BEHAVIORAL',
      skill: 'Developer Collaboration',
    },
    {
      id: 'sqb-dvo-007',
      text: 'Our entire production environment becomes unavailable. Traffic is down to zero. Walk me through your incident response.',
      type: 'SITUATIONAL',
      skill: 'Production Outage',
    },
    {
      id: 'sqb-dvo-008',
      text: 'A critical CVE is published for a base Docker image used in all your production containers. What do you do?',
      type: 'SITUATIONAL',
      skill: 'Dependency Vulnerability',
    },
    {
      id: 'sqb-dvo-009',
      text: 'How do you design a monitoring strategy for a distributed system? What metrics, logs, and traces do you prioritize?',
      type: 'TECHNICAL',
      skill: 'Observability and Monitoring',
    },
    {
      id: 'sqb-dvo-010',
      text: 'Describe a repetitive operational task you automated. What was the impact on the team?',
      type: 'BEHAVIORAL',
      skill: 'Reducing Toil',
    },
    {
      id: 'sqb-dvo-011',
      text: 'Your cloud bill has increased 40% in the last quarter with no corresponding growth in traffic. How do you investigate and address it?',
      type: 'SITUATIONAL',
      skill: 'Cost Optimization',
    },
    {
      id: 'sqb-dvo-012',
      text: 'Compare blue-green deployments with canary deployments. When would you use each strategy?',
      type: 'TECHNICAL',
      skill: 'Deployment Strategies',
    },
  ],

  // ─── Data Engineer ───────────────────────────────────────────────────────────
  cldate0007000000000000000007: [
    {
      id: 'sqb-de-001',
      text: 'Walk me through designing an ETL pipeline that ingests data from multiple REST APIs, transforms it, and loads it into a data warehouse.',
      type: 'TECHNICAL',
      skill: 'ETL Design',
    },
    {
      id: 'sqb-de-002',
      text: 'How do you optimize a slow-running query in a distributed system like BigQuery or Spark?',
      type: 'TECHNICAL',
      skill: 'SQL and Distributed Processing',
    },
    {
      id: 'sqb-de-003',
      text: 'Explain the difference between a star schema and a snowflake schema. When would you use each?',
      type: 'TECHNICAL',
      skill: 'Data Modeling',
    },
    {
      id: 'sqb-de-004',
      text: 'Tell me about a time you worked with a data analyst or data scientist to understand their data access needs and built a solution for them.',
      type: 'BEHAVIORAL',
      skill: 'Cross-team Collaboration',
    },
    {
      id: 'sqb-de-005',
      text: 'Describe a time a critical data pipeline failed in production. How did you diagnose and fix it?',
      type: 'BEHAVIORAL',
      skill: 'Pipeline Failure Handling',
    },
    {
      id: 'sqb-de-006',
      text: 'How do you approach documenting data pipelines and schemas for teams that depend on your data?',
      type: 'BEHAVIORAL',
      skill: 'Documentation',
    },
    {
      id: 'sqb-de-007',
      text: 'Midway through an ingestion job, you discover the source system has been emitting malformed records for two days. What do you do?',
      type: 'SITUATIONAL',
      skill: 'Data Quality Mid-pipeline',
    },
    {
      id: 'sqb-de-008',
      text: 'An upstream source system changes a field from string to integer with no warning. How do you handle the fallout for downstream consumers?',
      type: 'SITUATIONAL',
      skill: 'Schema Migration',
    },
    {
      id: 'sqb-de-009',
      text: 'What validation checks do you build into your data pipelines to ensure data quality before it reaches analytics teams?',
      type: 'TECHNICAL',
      skill: 'Data Quality',
    },
    {
      id: 'sqb-de-010',
      text: 'How have you improved data discoverability and accessibility for non-technical stakeholders in a previous role?',
      type: 'BEHAVIORAL',
      skill: 'Data Accessibility',
    },
    {
      id: 'sqb-de-011',
      text: 'A key data source has deprecated an API endpoint you rely on, and the replacement returns a different schema. You have 30 days to migrate. How do you plan?',
      type: 'SITUATIONAL',
      skill: 'Source System Changes',
    },
    {
      id: 'sqb-de-012',
      text: 'Compare streaming data ingestion with batch processing. Describe a scenario where you would choose one over the other.',
      type: 'TECHNICAL',
      skill: 'Streaming vs Batch',
    },
  ],

  // ─── ML Engineer ─────────────────────────────────────────────────────────────
  clmle0008000000000000000008: [
    {
      id: 'sqb-mle-001',
      text: 'Explain the bias-variance trade-off and how it influenced a modeling decision you made.',
      type: 'TECHNICAL',
      skill: 'ML Algorithms',
    },
    {
      id: 'sqb-mle-002',
      text: 'How do you choose evaluation metrics for a classification model in a class-imbalanced dataset?',
      type: 'TECHNICAL',
      skill: 'Model Evaluation',
    },
    {
      id: 'sqb-mle-003',
      text: 'Describe your process for generating and selecting features for a tabular dataset. What techniques do you commonly apply?',
      type: 'TECHNICAL',
      skill: 'Feature Engineering',
    },
    {
      id: 'sqb-mle-004',
      text: 'Tell me about how you have set up monitoring for a model deployed in production. What signals do you track?',
      type: 'BEHAVIORAL',
      skill: 'MLOps',
    },
    {
      id: 'sqb-mle-005',
      text: 'Describe how you worked with a data scientist to take an experimental notebook to a production service.',
      type: 'BEHAVIORAL',
      skill: 'Collaboration with Data Scientists',
    },
    {
      id: 'sqb-mle-006',
      text: 'How do you track and compare machine learning experiments to ensure reproducibility?',
      type: 'BEHAVIORAL',
      skill: 'Experiment Management',
    },
    {
      id: 'sqb-mle-007',
      text: 'A recommendation model that performed well at launch is now degrading. Users are reporting poorer suggestions. How do you investigate?',
      type: 'SITUATIONAL',
      skill: 'Model Drift',
    },
    {
      id: 'sqb-mle-008',
      text: 'Before a model release, a fairness audit reveals it performs significantly worse for a demographic group. Leadership is pushing to release anyway. What do you do?',
      type: 'SITUATIONAL',
      skill: 'Bias and Fairness',
    },
    {
      id: 'sqb-mle-009',
      text: 'Walk me through the steps to deploy a trained scikit-learn model as a low-latency REST API endpoint.',
      type: 'TECHNICAL',
      skill: 'Productionizing Models',
    },
    {
      id: 'sqb-mle-010',
      text: 'Tell me about a machine learning project that did not achieve its intended goals. What did you learn?',
      type: 'BEHAVIORAL',
      skill: 'Failure and Learning',
    },
    {
      id: 'sqb-mle-011',
      text: 'Your model must be retrained daily on new data, but the training job occasionally takes longer than 24 hours. How do you address this?',
      type: 'SITUATIONAL',
      skill: 'Retraining Schedule',
    },
    {
      id: 'sqb-mle-012',
      text: 'How do you design a feature store, and what problems does it solve for machine learning teams?',
      type: 'TECHNICAL',
      skill: 'Data Pipelines for ML',
    },
  ],

  // ─── QA Engineer ─────────────────────────────────────────────────────────────
  clqae0009000000000000000009: [
    {
      id: 'sqb-qae-001',
      text: 'Explain the test pyramid. How do you balance the ratio of unit, integration, and end-to-end tests in a project?',
      type: 'TECHNICAL',
      skill: 'Test Pyramid',
    },
    {
      id: 'sqb-qae-002',
      text: 'What automation framework do you prefer for end-to-end testing and why? Describe how you structure tests in that framework.',
      type: 'TECHNICAL',
      skill: 'Automation Frameworks',
    },
    {
      id: 'sqb-qae-003',
      text: 'What makes a great bug report? Walk me through how you write one that developers can act on immediately.',
      type: 'TECHNICAL',
      skill: 'Bug Reporting',
    },
    {
      id: 'sqb-qae-004',
      text: 'Tell me about a time you worked closely with developers during development to catch issues early. How did that change the quality of the release?',
      type: 'BEHAVIORAL',
      skill: 'Developer Collaboration',
    },
    {
      id: 'sqb-qae-005',
      text: 'Describe a situation where a critical regression made it to production. How did you prevent a recurrence?',
      type: 'BEHAVIORAL',
      skill: 'Regression Handling',
    },
    {
      id: 'sqb-qae-006',
      text: 'How do you advocate for test coverage with a team that sees testing as a bottleneck to shipping?',
      type: 'BEHAVIORAL',
      skill: 'Test Coverage Advocacy',
    },
    {
      id: 'sqb-qae-007',
      text: 'The release is scheduled for tomorrow, but 3 automated tests are failing that you cannot reproduce manually. What do you do?',
      type: 'SITUATIONAL',
      skill: 'Release Pressure',
    },
    {
      id: 'sqb-qae-008',
      text: 'Your CI pipeline is full of flaky tests that intermittently fail, slowing down deployments. How do you address the problem systematically?',
      type: 'SITUATIONAL',
      skill: 'Flaky Tests',
    },
    {
      id: 'sqb-qae-009',
      text: 'How do you prioritize what to test when time is constrained before a major release?',
      type: 'TECHNICAL',
      skill: 'Risk-based Testing',
    },
    {
      id: 'sqb-qae-010',
      text: 'Give an example of a non-obvious edge case you discovered during testing. How did you find it and what was the impact?',
      type: 'BEHAVIORAL',
      skill: 'Edge Case Discovery',
    },
    {
      id: 'sqb-qae-011',
      text: 'You join a team whose legacy codebase has zero automated tests, and you need to add a major feature safely. What is your strategy?',
      type: 'SITUATIONAL',
      skill: 'Legacy System Testing',
    },
    {
      id: 'sqb-qae-012',
      text: 'How do you approach testing a REST API? What tools and techniques do you use to ensure correctness and reliability?',
      type: 'TECHNICAL',
      skill: 'API Testing',
    },
  ],

  // ─── Product Manager – Technical ─────────────────────────────────────────────
  clpmt0010000000000000000010: [
    {
      id: 'sqb-pmt-001',
      text: 'Describe how you evaluate a build-vs-buy decision for a technical component. What factors do you weigh?',
      type: 'TECHNICAL',
      skill: 'Technical Trade-off Evaluation',
    },
    {
      id: 'sqb-pmt-002',
      text: 'How do you engage with engineers when discussing latency, throughput, and scalability trade-offs for a feature?',
      type: 'TECHNICAL',
      skill: 'API and System Concepts',
    },
    {
      id: 'sqb-pmt-003',
      text: 'How do you define acceptance criteria for a technically complex backend feature that does not have a visible UI?',
      type: 'TECHNICAL',
      skill: 'Metrics and Success Criteria',
    },
    {
      id: 'sqb-pmt-004',
      text: 'Tell me about a time you had to persuade engineering to prioritize a technically complex feature. How did you make the case?',
      type: 'BEHAVIORAL',
      skill: 'Engineering Alignment',
    },
    {
      id: 'sqb-pmt-005',
      text: 'Describe a situation where you had to simplify a complex technical decision for a non-technical executive audience.',
      type: 'BEHAVIORAL',
      skill: 'Stakeholder Communication',
    },
    {
      id: 'sqb-pmt-006',
      text: 'Give me an example of how you prioritized features when engineering capacity was significantly reduced mid-quarter.',
      type: 'BEHAVIORAL',
      skill: 'Prioritization Under Constraints',
    },
    {
      id: 'sqb-pmt-007',
      text: 'Engineering proposes spending an entire quarter on refactoring instead of new features. A key customer is waiting for a specific feature. How do you navigate this?',
      type: 'SITUATIONAL',
      skill: 'Tech Debt vs Features',
    },
    {
      id: 'sqb-pmt-008',
      text: 'Your roadmap depends on a platform team delivering an API that is now three months behind schedule. How do you respond?',
      type: 'SITUATIONAL',
      skill: 'Cross-team Dependency',
    },
    {
      id: 'sqb-pmt-009',
      text: 'How do you structure a technical roadmap that balances feature work, infrastructure improvements, and operational excellence?',
      type: 'TECHNICAL',
      skill: 'Roadmap Planning',
    },
    {
      id: 'sqb-pmt-010',
      text: 'Describe how you handle a situation where business goals are clear but the technical approach is deeply uncertain.',
      type: 'BEHAVIORAL',
      skill: 'Ambiguity Resolution',
    },
    {
      id: 'sqb-pmt-011',
      text: 'Two days before launch, engineering informs you a key feature will not be ready. Leadership expects the original scope. What do you do?',
      type: 'SITUATIONAL',
      skill: 'Launch Without Key Feature',
    },
    {
      id: 'sqb-pmt-012',
      text: 'How do you maintain alignment between product, engineering, and design throughout a multi-month project?',
      type: 'BEHAVIORAL',
      skill: 'Cross-functional Leadership',
    },
  ],

  // ─── Site Reliability Engineer ────────────────────────────────────────────────
  clsre0011000000000000000011: [
    {
      id: 'sqb-sre-001',
      text: 'Explain what an SLO is and how an error budget is calculated. How does an error budget influence product decisions?',
      type: 'TECHNICAL',
      skill: 'SLOs and Error Budgets',
    },
    {
      id: 'sqb-sre-002',
      text: 'How do you design an alerting strategy that minimizes false positives while ensuring critical issues are caught quickly?',
      type: 'TECHNICAL',
      skill: 'Monitoring and Alerting',
    },
    {
      id: 'sqb-sre-003',
      text: 'Walk me through how you would conduct capacity planning for a service expected to double its traffic in six months.',
      type: 'TECHNICAL',
      skill: 'Capacity Planning',
    },
    {
      id: 'sqb-sre-004',
      text: 'Describe the most complex production incident you have handled. What was your role and what did you learn?',
      type: 'BEHAVIORAL',
      skill: 'Incident Response',
    },
    {
      id: 'sqb-sre-005',
      text: 'How do you facilitate a blameless post-mortem? What makes a post-mortem actionable versus just retrospective?',
      type: 'BEHAVIORAL',
      skill: 'Post-mortems',
    },
    {
      id: 'sqb-sre-006',
      text: 'Tell me about a time you worked with a development team to improve the reliability of a service they owned. What was your approach?',
      type: 'BEHAVIORAL',
      skill: 'Developer Collaboration',
    },
    {
      id: 'sqb-sre-007',
      text: 'Your service has breached its error budget for the month with two weeks remaining. Engineering wants to keep shipping features. What do you do?',
      type: 'SITUATIONAL',
      skill: 'SLO Breach',
    },
    {
      id: 'sqb-sre-008',
      text: 'You estimate that on-call engineers spend 40% of their time on a repetitive manual task. How do you prioritize and implement a fix?',
      type: 'SITUATIONAL',
      skill: 'Toil Reduction',
    },
    {
      id: 'sqb-sre-009',
      text: 'What types of operational tasks have you automated, and how did you measure the impact of that automation?',
      type: 'TECHNICAL',
      skill: 'Automation',
    },
    {
      id: 'sqb-sre-010',
      text: 'How do you build a sustainable on-call culture that does not lead to burnout for the team?',
      type: 'BEHAVIORAL',
      skill: 'On-call Culture',
    },
    {
      id: 'sqb-sre-011',
      text: 'A new feature expected to increase traffic by 3x is launching in 30 days. How do you prepare infrastructure to handle it safely?',
      type: 'SITUATIONAL',
      skill: 'Capacity Planning for New Features',
    },
    {
      id: 'sqb-sre-012',
      text: 'How do you design and execute a load test for a service before a major traffic event?',
      type: 'TECHNICAL',
      skill: 'Load Testing',
    },
  ],

  // ─── Security Engineer ────────────────────────────────────────────────────────
  clsec0012000000000000000012: [
    {
      id: 'sqb-sec-001',
      text: 'Describe your process for conducting a vulnerability assessment on a web application you have never seen before.',
      type: 'TECHNICAL',
      skill: 'Vulnerability Assessment',
    },
    {
      id: 'sqb-sec-002',
      text: 'Explain the top three OWASP web application attack vectors and how you mitigate each in code and infrastructure.',
      type: 'TECHNICAL',
      skill: 'Attack Vectors',
    },
    {
      id: 'sqb-sec-003',
      text: 'What is the difference between symmetric and asymmetric encryption, and when would you use each in a web application?',
      type: 'TECHNICAL',
      skill: 'Cryptography',
    },
    {
      id: 'sqb-sec-004',
      text: 'Describe what you look for when reviewing code for security vulnerabilities. Give a specific example of a finding.',
      type: 'BEHAVIORAL',
      skill: 'Security Code Reviews',
    },
    {
      id: 'sqb-sec-005',
      text: 'How do you build security awareness within a development team that does not have a security background?',
      type: 'BEHAVIORAL',
      skill: 'Security Culture',
    },
    {
      id: 'sqb-sec-006',
      text: 'Walk me through how you respond to a reported security incident, from initial triage to resolution.',
      type: 'BEHAVIORAL',
      skill: 'Incident Response',
    },
    {
      id: 'sqb-sec-007',
      text: 'You discover a SQL injection vulnerability in a production endpoint that handles user data. What do you do in the next 60 minutes?',
      type: 'SITUATIONAL',
      skill: 'Vulnerability in Production',
    },
    {
      id: 'sqb-sec-008',
      text: 'Engineering complains that your security review process is slowing down releases by a week. How do you respond?',
      type: 'SITUATIONAL',
      skill: 'Security vs Developer Velocity',
    },
    {
      id: 'sqb-sec-009',
      text: 'Walk me through how you conduct a threat modeling session for a new feature that handles payment data.',
      type: 'TECHNICAL',
      skill: 'Threat Modeling',
    },
    {
      id: 'sqb-sec-010',
      text: 'Describe your experience working with a compliance framework such as SOC 2, PCI-DSS, or ISO 27001.',
      type: 'BEHAVIORAL',
      skill: 'Compliance Frameworks',
    },
    {
      id: 'sqb-sec-011',
      text: 'A widely-used open-source library your application depends on has a published critical CVE. How do you assess impact and respond?',
      type: 'SITUATIONAL',
      skill: 'Third-party Library Vulnerability',
    },
    {
      id: 'sqb-sec-012',
      text: 'Explain the principles of zero trust architecture and how you would apply them to an internal developer tooling platform.',
      type: 'TECHNICAL',
      skill: 'Zero Trust Architecture',
    },
  ],
};

export function getStaticQuestionBank(jobId: string): BankQuestion[] {
  return QUESTION_BANKS[jobId] ?? [];
}

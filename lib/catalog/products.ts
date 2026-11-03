import type { ProductCategory, ProductDefinition, ProductSignalRule } from './types';

type Seed = {
  id: string;
  name: string;
  category: ProductCategory;
  summary: string;
  roles: string[];
  signals: ProductSignalRule[];
  kind?: 'product' | 'capability';
  parentId?: string;
  opportunity?: boolean;
  claims?: string[];
  prohibited?: string[];
};

const commonProhibited = [
  'Do not promise a specific performance, cost, revenue, or conversion improvement.',
  'Do not imply knowledge of private infrastructure, contracts, spend, or internal usage.',
  'Do not claim compliance or data residency without an approved, directly relevant source.'
];

const fit = (id: string, description: string, points: number): ProductSignalRule => ({
  id,
  description,
  category: 'product_fit',
  points
});

const trigger = (id: string, description: string, points: number): ProductSignalRule => ({
  id,
  description,
  category: 'trigger',
  points,
  freshnessSensitive: true
});

const make = (seed: Seed): ProductDefinition => ({
  id: seed.id,
  name: seed.name,
  category: seed.category,
  kind: seed.kind ?? 'product',
  canCreateOpportunity: seed.opportunity ?? true,
  parentId: seed.parentId,
  summary: seed.summary,
  targetRoles: seed.roles,
  signals: seed.signals,
  approvedClaims: seed.claims ?? [],
  prohibitedClaims: [...commonProhibited, ...(seed.prohibited ?? [])],
  emeaNotes: [
    'Use a clear why-you, why-now structure.',
    'Discuss privacy, governance, or control only when the evidence and approved claims support it.'
  ]
});

const engineering = ['VP Engineering', 'Head of Platform', 'Platform Engineering Lead', 'CTO'];
const web = ['Head of Web', 'Web Platform Lead', 'Frontend Platform Lead', 'VP Engineering'];
const ai = ['Head of AI', 'AI Platform Lead', 'Director of AI Engineering', 'VP Engineering'];
const security = ['CISO', 'Head of Security', 'Platform Security Lead', 'VP Engineering'];
const data = ['Head of Data', 'Analytics Lead', 'Growth Engineering Lead', 'VP Engineering'];

/**
 * Current Vercel platform surface, grouped into independently useful sales
 * motions. Capabilities remain searchable by the router but roll up to their
 * parent product so reps do not receive repetitive micro-opportunities.
 */
export const PRODUCTS: ProductDefinition[] = [
  make({
    id: 'vercel-platform', name: 'Vercel Platform', category: 'platform', roles: web,
    summary: 'Build, deploy, and deliver web applications on Vercel.',
    signals: [
      fit('nextjs-off-vercel', 'Runs Next.js on hosting other than Vercel', 25),
      fit('web-performance-pain', 'Public web performance evidence shows meaningful user pain', 18),
      trigger('web-platform-hiring', 'Hiring for web, frontend, or platform engineering', 12),
      trigger('web-launch', 'Recently launched or replatformed a web property', 18)
    ],
    claims: ['Vercel was created by the team behind Next.js.']
  }),
  make({
    id: 'services', name: 'Vercel Services', category: 'compute', roles: engineering,
    summary: 'Run backend services alongside web applications and agents.',
    signals: [fit('service-modernization', 'Modernizing backend or full-stack services', 20), trigger('backend-hiring', 'Hiring backend or platform engineers', 12)]
  }),
  make({
    id: 'containers', name: 'Vercel Containers', category: 'compute', roles: engineering,
    summary: 'Run containerized workloads in any language or framework.',
    signals: [fit('container-workloads', 'Operates containerized application workloads', 20), trigger('container-platform-hiring', 'Hiring for container platform work', 12)]
  }),
  make({
    id: 'fluid-compute', name: 'Fluid Compute', category: 'compute', roles: engineering,
    summary: 'Elastic compute for dynamic, long-running, and I/O-heavy workloads.',
    signals: [fit('io-heavy-workloads', 'Runs I/O-heavy or long-running application workloads', 20), fit('serverless-cost-pain', 'Publicly discusses serverless cost or cold-start pressure', 18), trigger('compute-scale-launch', 'Recently launched a compute-intensive product', 15)]
  }),
  make({
    id: 'queues', name: 'Vercel Queues', category: 'compute', roles: engineering,
    summary: 'Durable background tasks without managing queue infrastructure.',
    signals: [fit('background-jobs', 'Operates background or asynchronous jobs', 20), fit('queue-reliability', 'Discusses queue reliability or workload orchestration', 15)]
  }),
  make({
    id: 'ai-gateway', name: 'AI Gateway', category: 'ai', roles: ai,
    summary: 'Unified model access, routing, billing, and observability for AI workloads.',
    signals: [fit('multi-model-ai', 'Uses or evaluates multiple AI model providers', 24), fit('customer-ai-product', 'Runs a customer-facing AI application or agent', 21), trigger('ai-product-launch', 'Recently launched an AI feature or product', 20), trigger('ai-platform-hiring', 'Hiring AI platform or application engineers', 12)]
  }),
  make({
    id: 'ai-sdk', name: 'AI SDK', category: 'ai', roles: ai,
    summary: 'Framework-agnostic toolkit for building AI applications.',
    signals: [fit('ai-app-development', 'Builds AI application interfaces or agent experiences', 22), fit('ai-sdk-public-code', 'Public code shows application-level AI integrations', 20), trigger('ai-app-hiring', 'Hiring engineers to build AI applications', 12)]
  }),
  make({
    id: 'workflow', name: 'Workflow SDK', category: 'ai', roles: ai,
    summary: 'Durable, long-running workflows for agents and applications.',
    signals: [fit('durable-agent-work', 'Builds long-running or resumable agents', 22), fit('workflow-orchestration', 'Discusses workflow orchestration or durable execution', 18), trigger('agent-launch', 'Recently launched an agent product', 18)]
  }),
  make({
    id: 'sandbox', name: 'Vercel Sandbox', category: 'ai', roles: ai,
    summary: 'Isolated microVMs for agent-generated or untrusted code.',
    signals: [fit('code-executing-agent', 'Builds agents that execute generated or user-provided code', 25), fit('sandbox-security', 'Needs isolation for code execution', 20)]
  }),
  make({
    id: 'connect', name: 'Vercel Connect', category: 'ai', roles: ai,
    summary: 'Securely connect agents to internal systems and external services.',
    signals: [fit('connected-agents', 'Builds agents that act across business systems', 22), fit('agent-auth-complexity', 'Discusses agent authentication or connector complexity', 18)]
  }),
  make({
    id: 'chat-sdk', name: 'Chat SDK', category: 'ai', roles: ai,
    summary: 'Build agent experiences across chat platforms from one codebase.',
    signals: [fit('multi-channel-agent', 'Offers agents in Slack or multiple chat surfaces', 22), trigger('chat-agent-launch', 'Recently launched a conversational agent', 18)]
  }),
  make({
    id: 'eve', name: 'eve', category: 'ai', roles: ai,
    summary: 'Filesystem-first framework for durable AI agents.',
    signals: [fit('durable-agent-platform', 'Building a durable agent platform', 20), fit('agent-framework-evaluation', 'Evaluating agent frameworks', 18)]
  }),
  make({
    id: 'observability', name: 'Vercel Observability', category: 'observability', roles: engineering,
    summary: 'Production traffic, logs, traces, performance, and anomaly insights.',
    signals: [fit('production-debugging', 'Publicly discusses production debugging or reliability pain', 20), trigger('observability-hiring', 'Hiring for SRE, reliability, or observability', 12), trigger('production-incident', 'Recently experienced or discussed a production incident', 20), fit('traffic-scale', 'Operates a high-traffic application', 10)]
  }),
  make({
    id: 'web-analytics', name: 'Web Analytics', category: 'observability', roles: data,
    summary: 'First-party, privacy-friendly website engagement analytics.',
    signals: [fit('growth-measurement', 'Investing in digital growth or product analytics', 18), fit('privacy-analytics', 'Needs privacy-conscious first-party analytics', 20), trigger('growth-hiring', 'Hiring growth or analytics engineers', 10)]
  }),
  make({
    id: 'speed-insights', name: 'Speed Insights', category: 'observability', roles: web,
    summary: 'Measure real-user web performance and Core Web Vitals.',
    signals: [fit('web-performance-monitoring', 'Needs real-user performance monitoring', 20), fit('performance-pain', 'Public performance evidence shows user pain', 18)]
  }),
  make({
    id: 'vercel-agent', name: 'Vercel Agent', category: 'observability', roles: engineering,
    summary: 'Investigate production anomalies, review code, and help remediate regressions.',
    signals: [fit('incident-response-load', 'Engineering teams carry significant incident response work', 20), fit('ai-ops-interest', 'Investing in AI-assisted engineering operations', 18), trigger('reliability-incident', 'Recently discussed a reliability incident', 18)]
  }),
  make({
    id: 'firewall', name: 'Vercel Firewall', category: 'security', roles: security,
    summary: 'Framework-aware application firewall and edge protection.',
    signals: [fit('web-threats', 'Faces public web application abuse or attack pressure', 22), trigger('security-hiring', 'Hiring application or platform security engineers', 12), trigger('security-incident', 'Recently disclosed a relevant security incident', 20)]
  }),
  make({
    id: 'bot-management', name: 'Bot Management and BotID', category: 'security', roles: security,
    summary: 'Identify and control automated traffic and malicious bots.',
    signals: [fit('bot-abuse', 'Faces scraping, credential abuse, or automated traffic', 24), fit('fraud-pressure', 'Operates a marketplace, commerce, ticketing, or high-abuse service', 15)]
  }),
  make({
    id: 'secure-compute', name: 'Secure Compute', category: 'security', roles: security,
    summary: 'Isolated compute with private networking for sensitive workloads.',
    signals: [fit('private-networking', 'Requires private connectivity to sensitive systems', 22), fit('regulated-workloads', 'Operates regulated or sensitive application workloads', 18)]
  }),
  make({
    id: 'passport', name: 'Vercel Passport', category: 'security', roles: security,
    summary: 'Govern agent and platform access with enterprise identity controls.',
    signals: [fit('agent-governance', 'Needs identity governance for agents or developers', 22), fit('enterprise-identity', 'Uses enterprise identity and access controls', 16)]
  }),
  make({
    id: 'enterprise-governance', name: 'Enterprise Governance', category: 'security', roles: security,
    summary: 'Managed users, IAM, RBAC, SAML, audit logs, compliance, and BYOC controls.',
    signals: [fit('enterprise-governance', 'Has enterprise identity, audit, or access-control requirements', 22), trigger('compliance-growth', 'Expanding into regulated or enterprise markets', 18), trigger('security-leadership-hire', 'Recently hired security or governance leadership', 15)]
  }),
  make({
    id: 'blob', name: 'Vercel Blob', category: 'storage', roles: engineering,
    summary: 'Public or private object storage integrated with Vercel applications.',
    signals: [fit('file-heavy-app', 'Application stores user files or media', 18), fit('storage-complexity', 'Discusses application storage integration complexity', 15)]
  }),
  make({
    id: 'domains', name: 'Vercel Domains', category: 'platform', roles: engineering,
    summary: 'Buy, manage, and secure application domains.',
    signals: [fit('multi-domain-platform', 'Operates many domains or customer domains', 20), fit('domain-automation', 'Needs automated domain provisioning or management', 18)]
  }),
  make({
    id: 'flags', name: 'Vercel Flags', category: 'collaboration', roles: engineering,
    summary: 'Roll out product changes with feature flags and instant rollback.',
    signals: [fit('feature-experimentation', 'Runs frequent feature experiments or staged rollouts', 20), fit('release-risk', 'Discusses release risk or rollback needs', 15)]
  }),
  make({
    id: 'preview-collaboration', name: 'Previews and Vercel Toolbar', category: 'collaboration', roles: web,
    summary: 'Preview, review, and comment on every change before production.',
    signals: [fit('cross-functional-web-team', 'Large cross-functional team reviews web changes', 18), fit('slow-review-cycle', 'Publicly discusses slow or complex web review cycles', 18), trigger('web-team-growth', 'Growing design, marketing, and web engineering teams', 10)]
  }),
  make({
    id: 'v0', name: 'v0', category: 'developer-tools', roles: ['VP Engineering', 'Head of Design', 'Design Engineering Lead', 'CTO'],
    summary: 'Generate and iterate on applications from natural-language prompts.',
    signals: [fit('design-engineering', 'Investing in design engineering or rapid prototyping', 18), fit('app-prototyping', 'Needs faster application prototyping', 18), trigger('design-systems-hiring', 'Hiring design systems or design engineering roles', 10)]
  }),
  make({
    id: 'marketplace', name: 'Vercel Marketplace', category: 'platform', roles: engineering,
    summary: 'Install and manage databases and services through Vercel.',
    signals: [fit('integration-sprawl', 'Manages many application infrastructure integrations', 16), fit('platform-consolidation', 'Consolidating developer platform tooling', 18)]
  }),
  make({
    id: 'cicd', name: 'CI/CD and Git Deployments', category: 'collaboration', roles: engineering,
    summary: 'Deploy every change with previews and production promotion.',
    signals: [fit('deployment-friction', 'Publicly discusses slow or complex deployment pipelines', 22), fit('release-frequency', 'High release frequency or many application teams', 15)],
    kind: 'capability', parentId: 'vercel-platform', opportunity: false
  }),
  make({
    id: 'cdn-rendering', name: 'CDN and Rendering', category: 'platform', roles: web,
    summary: 'Global content delivery and framework-aware rendering.',
    signals: [fit('global-web-audience', 'Serves a global web audience', 15), fit('rendering-complexity', 'Operates complex dynamic or streaming rendering', 18)],
    kind: 'capability', parentId: 'vercel-platform', opportunity: false
  }),
  make({
    id: 'cron', name: 'Cron Jobs', category: 'compute', roles: engineering,
    summary: 'Schedule recurring application jobs.',
    signals: [fit('scheduled-jobs', 'Operates scheduled application tasks', 15)],
    kind: 'capability', parentId: 'fluid-compute', opportunity: false
  }),
  make({
    id: 'middleware', name: 'Routing Middleware', category: 'compute', roles: engineering,
    summary: 'Intercept and route requests before cache.',
    signals: [fit('routing-complexity', 'Has complex request routing or personalization needs', 15)],
    kind: 'capability', parentId: 'vercel-platform', opportunity: false
  }),
  make({
    id: 'drives', name: 'Vercel Drives', category: 'ai', roles: ai,
    summary: 'Persist agent files between runs.',
    signals: [fit('agent-file-persistence', 'Agents create or reuse files across long-running tasks', 18)],
    kind: 'capability', parentId: 'workflow', opportunity: false
  }),
  make({
    id: 'daemons', name: 'Daemons', category: 'compute', roles: engineering,
    summary: 'Run background workers alongside applications.',
    signals: [fit('background-workers', 'Operates continuously running background workers', 16)],
    kind: 'capability', parentId: 'services', opportunity: false
  }),
  make({
    id: 'global-config', name: 'Global Config', category: 'storage', roles: engineering,
    summary: 'Read globally distributed application configuration.',
    signals: [fit('distributed-config', 'Needs low-latency distributed application configuration', 15)],
    kind: 'capability', parentId: 'vercel-platform', opportunity: false
  }),
  make({
    id: 'ddos-protection', name: 'DDoS Protection', category: 'security', roles: security,
    summary: 'Absorb distributed denial-of-service attacks at the platform edge.',
    signals: [fit('ddos-pressure', 'Faces denial-of-service or availability attack pressure', 20)],
    kind: 'capability', parentId: 'firewall', opportunity: false
  }),
  make({
    id: 'audit-logs', name: 'Audit Logs', category: 'security', roles: security,
    summary: 'Track actions across teams and projects.',
    signals: [fit('audit-requirements', 'Has enterprise audit or change-tracking requirements', 16)],
    kind: 'capability', parentId: 'enterprise-governance', opportunity: false
  }),
  make({
    id: 'byoc', name: 'BYOC', category: 'security', roles: security,
    summary: 'Run Vercel-managed infrastructure inside a company AWS tenant.',
    signals: [fit('own-cloud-requirement', 'Requires workloads to run inside its own cloud tenant', 20)],
    kind: 'capability', parentId: 'secure-compute', opportunity: false
  }),
  make({
    id: 'managed-identity', name: 'Managed Users, IAM, RBAC, and SAML', category: 'security', roles: security,
    summary: 'Enterprise identity and role-based platform access.',
    signals: [fit('identity-controls', 'Requires enterprise identity and role-based access controls', 18)],
    kind: 'capability', parentId: 'enterprise-governance', opportunity: false
  }),
  make({
    id: 'vercel-api-cli-mcp', name: 'Vercel API, CLI, and MCP', category: 'developer-tools', roles: engineering,
    summary: 'Automate and agentically operate the Vercel platform.',
    signals: [fit('platform-automation', 'Investing in deployment or developer-platform automation', 16)],
    kind: 'capability', parentId: 'vercel-platform', opportunity: false
  }),
  make({
    id: 'agent-skills-plugins', name: 'Agent Skills and Plugins', category: 'ai', roles: ai,
    summary: 'Teach coding agents how to operate Vercel and connected tools.',
    signals: [fit('coding-agent-adoption', 'Adopting coding agents across engineering workflows', 18)],
    kind: 'capability', parentId: 'eve', opportunity: false
  }),
  make({
    id: 'vercel-drop', name: 'Vercel Drop', category: 'developer-tools', roles: web,
    summary: 'Publish web projects quickly through Vercel.',
    signals: [fit('rapid-publishing', 'Needs rapid lightweight web publishing', 12)],
    kind: 'capability', parentId: 'vercel-platform', opportunity: false
  }),
  make({
    id: 'templates', name: 'Templates', category: 'developer-tools', roles: engineering,
    summary: 'Start applications from working reference implementations.',
    signals: [fit('app-standardization', 'Standardizing application starters across teams', 12)],
    kind: 'capability', parentId: 'vercel-platform', opportunity: false
  }),
  make({
    id: 'aws-integrations', name: 'AWS Integrations', category: 'platform', roles: engineering,
    summary: 'Use AWS services and primitives alongside Vercel applications.',
    signals: [fit('aws-app-stack', 'Runs significant application infrastructure on AWS', 16)],
    kind: 'capability', parentId: 'marketplace', opportunity: false
  }),
  make({
    id: 'instant-rollback', name: 'Instant Rollback', category: 'collaboration', roles: engineering,
    summary: 'Restore a previous production deployment quickly.',
    signals: [fit('rollback-pressure', 'Needs safer releases and rapid rollback', 15)],
    kind: 'capability', parentId: 'vercel-platform', opportunity: false
  }),
  make({
    id: 'supported-frameworks', name: 'Supported Frameworks', category: 'platform', roles: web,
    summary: 'Deploy applications across modern web frameworks.',
    signals: [fit('multi-framework', 'Operates applications across several web frameworks', 14)],
    kind: 'capability', parentId: 'vercel-platform', opportunity: false
  })
];

export const OPPORTUNITY_PRODUCTS = PRODUCTS.filter((product) => product.canCreateOpportunity);

export function getProduct(id: string): ProductDefinition | undefined {
  const item = PRODUCTS.find((product) => product.id === id);
  if (!item) return undefined;
  return item.canCreateOpportunity ? item : PRODUCTS.find((product) => product.id === item.parentId);
}

export function productIndexForPrompt(): string {
  return PRODUCTS.map((p) =>
    [p.id, p.name, p.kind, p.parentId ? `rolls up to ${p.parentId}` : '', p.summary, `roles: ${p.targetRoles.join(', ')}`, `signals: ${p.signals.map((s) => `${s.id}=${s.description}`).join('; ')}`]
      .filter(Boolean)
      .join(' | ')
  ).join('\n');
}

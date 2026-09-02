/**
 * The four service lines, expanded from "What We Do" in the source brief.
 *
 * `slug` doubles as the anchor id on /services/ and as the value submitted by the
 * contact form's "service of interest" select, so the two can never drift apart.
 */

export interface Service {
  readonly slug: string;
  readonly title: string;
  /** One-line summary used on cards and in the form select. */
  readonly summary: string;
  /** Longer prose for the /services/ page. */
  readonly body: string;
  /** Concrete deliverables — rendered as a checklist. */
  readonly highlights: readonly string[];
  /** Lucide-style icon key, resolved by src/components/ui/Icon.astro. */
  readonly icon: 'users' | 'layers' | 'trending-up' | 'sparkles';
}

export const services = [
  {
    slug: 'talent-acquisition',
    title: 'Talent Acquisition & Specialised Staffing',
    summary: 'Elite technical, leadership and operational talent, matched to your culture.',
    body:
      'We deliver tailored staffing solutions across technical, leadership and operational ' +
      'roles. Whether you are scaling agile development teams or sourcing enterprise ' +
      'architects, we match elite talent to both the technical demands of the role and the ' +
      'culture of your organisation.',
    highlights: [
      'Agile development teams assembled and embedded',
      'Enterprise architect and principal engineer search',
      'Leadership and operational hiring',
      'Culture-fit screening alongside technical assessment',
    ],
    icon: 'users',
  },
  {
    slug: 'e2e-delivery',
    title: 'End-to-End Project Delivery',
    summary: 'Complete project life cycles, from first architecture diagram to production.',
    body:
      'We handle complete project life cycles — from initial architecture and UI/UX design ' +
      'through full-scale development, testing and cloud deployment. Our teams own the ' +
      'outcome, holding the line on delivery dates, modern security standards and ' +
      'performance under real load.',
    highlights: [
      'Architecture, UI/UX and technical discovery',
      'Full-scale development with automated testing',
      'Cloud deployment and CI/CD pipelines',
      'Security standards and performance engineering',
    ],
    icon: 'layers',
  },
  {
    slug: 'marketing-growth',
    title: 'Marketing & Growth Partnerships',
    summary: 'Targeted digital growth strategy, brand campaigns and creative outreach.',
    body:
      'We execute targeted digital growth strategies, brand campaigns and creative outreach ' +
      'programmes in close collaboration with media and technology leaders. Our engagements ' +
      'run from positioning and messaging through to campaign execution and measurement.',
    highlights: [
      'Digital growth strategy and channel planning',
      'Brand campaigns and creative production',
      'Creative outreach and partnership marketing',
      'Performance measurement and iteration',
    ],
    icon: 'trending-up',
  },
  {
    slug: 'ai-engineering',
    title: 'AI & Next-Gen Engineering',
    summary: 'Machine learning, generative AI and automated data pipelines in production.',
    body:
      'We build and integrate next-generation capability into existing systems: machine ' +
      'learning models, generative AI features, natural language processing and the ' +
      'automated data pipelines that keep them fed. The emphasis is on production ' +
      'readiness rather than proofs of concept.',
    highlights: [
      'Machine learning model development',
      'Generative AI integration into existing products',
      'Natural language processing (NLP)',
      'Automated, observable data pipelines',
    ],
    icon: 'sparkles',
  },
] as const satisfies readonly Service[];

export type ServiceSlug = (typeof services)[number]['slug'];

/**
 * Core technology stack — the "Practice Area / Core Specializations" table from
 * the source brief, modelled as data so /capabilities/ stays a pure projection.
 */

export interface Capability {
  readonly slug: string;
  /** Practice area, e.g. "Enterprise Applications". */
  readonly area: string;
  /** Headline platform for the area, e.g. "SAP". Empty when vendor-neutral. */
  readonly platform: string;
  /**
   * Compact title and subtitle for the practice-area strip on the home page,
   * where the full `area` name is too long to sit in a four-column row. Held as
   * data so the strip does not have to derive them by trimming `area`.
   */
  readonly label: string;
  readonly strapline: string;
  readonly description: string;
  /** Individual specialisations — rendered as tags. */
  readonly skills: readonly string[];
}

export const capabilities = [
  {
    slug: 'enterprise-applications',
    area: 'Enterprise Applications',
    platform: 'SAP',
    label: 'SAP',
    strapline: 'Enterprise applications',
    description:
      'S/4HANA implementation and migration, deep ABAP customisation, and module ' +
      'integration across the SAP estate.',
    skills: [
      'S/4HANA implementation',
      'ABAP customisation',
      'Module integration',
      'SAP cloud migration',
    ],
  },
  {
    slug: 'database-cloud',
    area: 'Database & Cloud Solutions',
    platform: 'Oracle',
    label: 'Oracle',
    strapline: 'Database & cloud',
    description:
      'Database architecture and tuning, cloud infrastructure optimisation, and the ' +
      'middleware that ties enterprise systems together.',
    skills: [
      'Database architecture',
      'Cloud infrastructure optimisation',
      'PL/SQL',
      'Middleware solutions',
    ],
  },
  {
    slug: 'full-stack',
    area: 'Full Stack Engineering',
    platform: '',
    label: 'Full Stack',
    strapline: 'Product engineering',
    description:
      'Product engineering across the modern stack, built as maintainable services with ' +
      'cloud-native operations from day one.',
    skills: [
      'Node.js',
      'React',
      'Angular',
      'Python',
      'Java',
      'Go',
      'Microservices',
      'REST APIs',
      'Cloud-native DevOps',
    ],
  },
  {
    slug: 'ai-next-gen',
    area: 'AI & Next-Gen Capabilities',
    platform: '',
    label: 'AI & Next-Gen',
    strapline: 'Applied AI & data',
    description:
      'Applied machine learning and generative AI, integrated into products and ' +
      'supported by automated data infrastructure.',
    skills: [
      'Machine learning models',
      'Generative AI integration',
      'Natural language processing',
      'Automated data pipelines',
    ],
  },
] as const satisfies readonly Capability[];

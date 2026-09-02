/**
 * Ecosystem partners and named client engagements.
 *
 * Rendered as styled wordmarks rather than image logos: we hold no trademark
 * licence for these marks, and a text treatment stays crisp at every size and
 * in dark mode without shipping third-party assets.
 */

export interface Organisation {
  readonly name: string;
  /** Shown beneath the wordmark. Keep to a single clause. */
  readonly role: string;
  readonly description: string;
}

/** Global integrators we deliver alongside. */
export const deliveryPartners = [
  {
    name: 'Wipro',
    role: 'Delivery partner',
    description:
      'Collaborative technology delivery, managed enterprise IT services and digital ' +
      'transformation programmes.',
  },
  {
    name: 'TCS',
    role: 'Delivery partner',
    description:
      'Enterprise systems scaling, cloud infrastructure integration and global delivery ' +
      'alignment, as Tata Consultancy Services.',
  },
] as const satisfies readonly Organisation[];

/** Named engagements described in the company brief. */
export const clientEngagements = [
  {
    name: 'Mohalla Tech',
    role: 'Marketing & growth',
    description:
      'Targeted digital growth strategies, brand campaigns and creative outreach delivered ' +
      'in collaboration with their media and technology teams.',
  },
  {
    name: 'Finlane',
    role: 'Fintech staffing',
    description:
      'Dedicated teams built across financial technology, operations and compliance for ' +
      'their fintech platform.',
  },
] as const satisfies readonly Organisation[];

/**
 * Figures shown in the stats band.
 *
 * Deliberately limited to facts that follow from the company brief — the firm was
 * established in 2025, so volume metrics such as placements or projects shipped
 * are left out rather than invented. Replace with audited numbers when available.
 */
export const stats = [
  { value: '2025', label: 'Established' },
  { value: '4', label: 'Engineering practice areas' },
  { value: '2', label: 'Global delivery partners' },
  { value: 'E2E', label: 'Ownership, discovery to deployment' },
] as const satisfies readonly { value: string; label: string }[];

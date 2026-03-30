/** Allowed enum values shared between the LLM prompt and the JSON contract. */

export const TICKET_CATEGORIES = [
  'Bug Report',
  'Feature Request',
  'Billing Issue',
  'Technical Question',
  'Incident/Outage',
] as const;

export const TICKET_PRIORITIES = ['Low', 'Medium', 'High'] as const;

/** Inbound channel — set by the ingestion layer, not by the LLM. */
export const SOURCE_CHANNELS = ['Email', 'Web Form', 'Support Portal'] as const;

/** Business queues for normal (non-HITL) routing — at least three as required. */
export const BUSINESS_QUEUES = [
  'Engineering',
  'Billing',
  'Product',
  'IT_Security',
] as const;

/** Final destination, including the human-review escalation queue. */
export const DESTINATION_QUEUES = [...BUSINESS_QUEUES, 'HumanReview'] as const;

/** Reason codes stored in `escalationReasons[]` — set by deterministic rules, not the LLM. */
export const ESCALATION_REASONS = [
  'low_confidence',
  'llm_escalation_suggested',
  'keyword_outage',
  'multi_user_impact',
  'billing_discrepancy_threshold',
  'rule_keyword_match',
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type SourceChannel = (typeof SOURCE_CHANNELS)[number];
export type BusinessQueue = (typeof BUSINESS_QUEUES)[number];
export type DestinationQueue = (typeof DESTINATION_QUEUES)[number];
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

/** Confidence below this threshold triggers automatic human escalation. */
export const CONFIDENCE_ESCALATION_THRESHOLD = 70;

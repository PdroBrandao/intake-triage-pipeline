import type {
  BusinessQueue,
  DestinationQueue,
  EscalationReason,
  SourceChannel,
  TicketCategory,
  TicketPriority,
} from './triage.constants';

export interface MessageIdentifier {
  /** Short snake_case label (e.g. "invoice_number", "http_status_code"). */
  type: string;
  value: string;
}

/**
 * Partial record returned by the LLM from a single prompt call.
 * Does not include routing or escalation fields — those are computed
 * deterministically by TriageRoutingService.
 */
export interface LlmTriagePartial {
  category: TicketCategory;
  priority: TicketPriority;
  /** 0–100 joint probability that both category and priority are correct. */
  confidence: number;
  coreIssueSentence: string;
  identifiers: MessageIdentifier[];
  urgencySignal: string;
  /** LLM recommendation only — does not override deterministic rules. */
  llmEscalationSuggested: boolean;
  humanReadableSummary: string;
}

/**
 * Final persisted record — merge of LlmTriagePartial and deterministic
 * routing/escalation decisions made by TriageRoutingService.
 */
export interface IntakeTriageRecord {
  messageId?: string;
  ingestedAt: string;
  source?: SourceChannel;
  rawMessage: string;
  category: TicketCategory;
  priority: TicketPriority;
  confidence: number;
  coreIssueSentence: string;
  identifiers: MessageIdentifier[];
  urgencySignal: string;
  llmEscalationSuggested: boolean;
  /** Business queue the ticket would go to if escalation were not triggered. */
  routedTeamQueue: BusinessQueue;
  /** Actual destination after applying all escalation rules. */
  destinationQueue: DestinationQueue;
  requiresHumanReview: boolean;
  escalationReasons: EscalationReason[];
  humanReadableSummary: string;
}

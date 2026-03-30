import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CONFIDENCE_ESCALATION_THRESHOLD,
  type BusinessQueue,
  type DestinationQueue,
  type EscalationReason,
  type SourceChannel,
  type TicketCategory,
} from '../triage.constants';
import type { IntakeTriageRecord, LlmTriagePartial } from '../triage.types';

export interface MergeIntakeRecordInput {
  partial: LlmTriagePartial;
  rawMessage: string;
  source?: SourceChannel;
  messageId?: string;
}

@Injectable()
export class TriageRoutingService {
  /**
   * Maps an LLM-classified category to a business team queue.
   * Bug Report and Incident/Outage share Engineering via fall-through.
   * This table is documented in the architecture write-up.
   */
  mapCategoryToTeam(category: TicketCategory): BusinessQueue {
    switch (category) {
      case 'Bug Report':
      case 'Incident/Outage':
        return 'Engineering';
      case 'Feature Request':
        return 'Product';
      case 'Billing Issue':
        return 'Billing';
      case 'Technical Question':
        return 'IT_Security';
    }
  }

  /**
   * Detects a billing discrepancy of at least $500 by parsing all USD amounts
   * in the raw message and comparing the max and min found.
   */
  billingDeltaAtLeast500(text: string): boolean {
    const matches = [...text.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)];
    const amounts = matches.map((m) => parseFloat(m[1].replace(/,/g, '')));
    if (amounts.length < 2) {
      return false;
    }
    const max = Math.max(...amounts);
    const min = Math.min(...amounts);
    return max - min >= 500;
  }

  /**
   * Deterministic escalation gate — runs AFTER the LLM call.
   * Combines confidence threshold, hard-coded keyword rules, and the LLM
   * suggestion into a single list of reasons. Any non-empty list triggers HITL.
   *
   * Rules:
   *   - confidence < CONFIDENCE_ESCALATION_THRESHOLD (70)
   *   - LLM flagged llmEscalationSuggested
   *   - raw message contains outage/down-for-all-users keywords
   *   - multiple/several users mentioned
   *   - billing discrepancy >= $500
   */
  collectEscalationReasons(
    partial: LlmTriagePartial,
    rawMessage: string,
  ): EscalationReason[] {
    const reasons: EscalationReason[] = [];
    const add = (r: EscalationReason) => {
      if (!reasons.includes(r)) {
        reasons.push(r);
      }
    };

    if (partial.confidence < CONFIDENCE_ESCALATION_THRESHOLD) {
      add('low_confidence');
    }
    if (partial.llmEscalationSuggested) {
      add('llm_escalation_suggested');
    }

    const lower = rawMessage.toLowerCase();
    if (/\boutage\b/.test(lower) || /down for all users/.test(lower)) {
      add('keyword_outage');
    }
    if (/multiple users/.test(lower) || /several users/.test(lower)) {
      add('multi_user_impact');
    }
    if (this.billingDeltaAtLeast500(rawMessage)) {
      add('billing_discrepancy_threshold');
    }

    return reasons;
  }

  /**
   * Core merge step — combines the LLM partial with deterministic routing
   * and escalation decisions to produce the final IntakeTriageRecord.
   *
   * Invariant: if requiresHumanReview is true, destinationQueue === 'HumanReview'.
   * routedTeamQueue always reflects where the ticket would go without escalation.
   */
  mergeToRecord(input: MergeIntakeRecordInput): IntakeTriageRecord {
    const { partial, rawMessage, source, messageId } = input;
    const routedTeamQueue = this.mapCategoryToTeam(partial.category);
    const escalationReasons = this.collectEscalationReasons(
      partial,
      rawMessage,
    );
    const requiresHumanReview = escalationReasons.length > 0;
    const destinationQueue: DestinationQueue = requiresHumanReview
      ? 'HumanReview'
      : routedTeamQueue;

    return {
      messageId: messageId ?? randomUUID(),
      ingestedAt: new Date().toISOString(),
      source,
      rawMessage,
      category: partial.category,
      priority: partial.priority,
      confidence: partial.confidence,
      coreIssueSentence: partial.coreIssueSentence,
      identifiers: partial.identifiers,
      urgencySignal: partial.urgencySignal,
      llmEscalationSuggested: partial.llmEscalationSuggested,
      humanReadableSummary: partial.humanReadableSummary,
      routedTeamQueue,
      destinationQueue,
      requiresHumanReview,
      escalationReasons,
    };
  }
}

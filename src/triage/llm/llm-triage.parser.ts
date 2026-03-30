import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from '../triage.constants';
import type { LlmTriagePartial, MessageIdentifier } from '../triage.types';

/** Thrown when the LLM output cannot be parsed or fails schema validation. */
export class LlmTriageParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmTriageParseError';
  }
}

/**
 * Strips ```json … ``` fences that some models add despite instructions.
 * The system prompt already requests raw JSON, but this acts as a safety net.
 */
export function stripJsonFences(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (m) {
    return m[1].trim();
  }
  return t;
}

export function parseLlmJsonContent(content: string): unknown {
  const raw = stripJsonFences(content);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new LlmTriageParseError('LLM output is not valid JSON');
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validates that the category is one of the allowed enum values. */
function asCategory(v: unknown): TicketCategory {
  if (
    typeof v === 'string' &&
    (TICKET_CATEGORIES as readonly string[]).includes(v)
  ) {
    return v as TicketCategory;
  }
  throw new LlmTriageParseError(`Invalid category: ${String(v)}`);
}

/** Validates that the priority is one of the allowed enum values. */
function asPriority(v: unknown): TicketPriority {
  if (
    typeof v === 'string' &&
    (TICKET_PRIORITIES as readonly string[]).includes(v)
  ) {
    return v as TicketPriority;
  }
  throw new LlmTriageParseError(`Invalid priority: ${String(v)}`);
}

/** Clamps confidence to [0, 100] and rounds to an integer. */
function asConfidence(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.round(v);
    if (n >= 0 && n <= 100) {
      return n;
    }
  }
  throw new LlmTriageParseError(`Invalid confidence: ${String(v)}`);
}

function asIdentifiers(v: unknown): MessageIdentifier[] {
  if (!Array.isArray(v)) {
    throw new LlmTriageParseError('identifiers must be an array');
  }
  return v.map((item, i) => {
    if (!isRecord(item)) {
      throw new LlmTriageParseError(`identifiers[${i}] must be an object`);
    }
    const type = item.type;
    const val = item.value;
    if (typeof type !== 'string' || typeof val !== 'string') {
      throw new LlmTriageParseError(
        `identifiers[${i}] must have string type and value`,
      );
    }
    return { type, value: val };
  });
}

/**
 * Validates the raw LLM JSON against the LlmTriagePartial contract.
 * Throws LlmTriageParseError on any field violation so the caller can
 * return a 503 without leaking internal details.
 */
export function assertLlmTriagePartial(data: unknown): LlmTriagePartial {
  if (!isRecord(data)) {
    throw new LlmTriageParseError('LLM output must be a JSON object');
  }

  const category = asCategory(data.category);
  const priority = asPriority(data.priority);
  const confidence = asConfidence(data.confidence);
  const coreIssueSentence = data.coreIssueSentence;
  if (typeof coreIssueSentence !== 'string' || !coreIssueSentence.trim()) {
    throw new LlmTriageParseError(
      'coreIssueSentence must be a non-empty string',
    );
  }
  const identifiers = asIdentifiers(data.identifiers);
  const urgencySignal = data.urgencySignal;
  if (typeof urgencySignal !== 'string' || !urgencySignal.trim()) {
    throw new LlmTriageParseError('urgencySignal must be a non-empty string');
  }
  if (typeof data.llmEscalationSuggested !== 'boolean') {
    throw new LlmTriageParseError('llmEscalationSuggested must be a boolean');
  }
  const humanReadableSummary = data.humanReadableSummary;
  if (
    typeof humanReadableSummary !== 'string' ||
    !humanReadableSummary.trim()
  ) {
    throw new LlmTriageParseError(
      'humanReadableSummary must be a non-empty string',
    );
  }

  return {
    category,
    priority,
    confidence,
    coreIssueSentence: coreIssueSentence.trim(),
    identifiers,
    urgencySignal: urgencySignal.trim(),
    llmEscalationSuggested: data.llmEscalationSuggested,
    humanReadableSummary: humanReadableSummary.trim(),
  };
}

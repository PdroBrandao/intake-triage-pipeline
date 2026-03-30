import { Injectable } from '@nestjs/common';
import { LlmTriageService } from '../triage/llm/llm-triage.service';
import { TriageRoutingService } from '../triage/routing/triage-routing.service';
import type { IntakeTriageRecord } from '../triage/triage.types';
import { IntakeRequestDto } from './dto/intake-request.dto';
import { IntakePersistenceService } from './persistence/intake-persistence.service';

@Injectable()
export class IntakeService {
  constructor(
    private readonly llmTriage: LlmTriageService,
    private readonly routing: TriageRoutingService,
    private readonly persistence: IntakePersistenceService,
  ) {}

  /**
   * Core orchestrator of the intake pipeline:
   *   1. LLM call  → classification + enrichment + summary (LlmTriagePartial)
   *   2. Routing   → deterministic queue mapping + escalation gate (IntakeTriageRecord)
   *   3. Persist   → appends the full record to the JSON output file
   */
  async processIntake(dto: IntakeRequestDto): Promise<IntakeTriageRecord> {
    const partial = await this.llmTriage.completeTriage(
      dto.rawMessage,
      dto.source,
    );
    const record = this.routing.mergeToRecord({
      partial,
      rawMessage: dto.rawMessage,
      source: dto.source,
      messageId: dto.messageId,
    });
    await this.persistence.persistRecord(record);
    return record;
  }
}

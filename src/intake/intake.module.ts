import { Module } from '@nestjs/common';
import { LlmTriageService } from '../triage/llm/llm-triage.service';
import { TriageRoutingService } from '../triage/routing/triage-routing.service';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { IntakePersistenceService } from './persistence/intake-persistence.service';

@Module({
  controllers: [IntakeController],
  providers: [
    IntakeService,
    IntakePersistenceService,
    LlmTriageService,
    TriageRoutingService,
  ],
})
export class IntakeModule {}

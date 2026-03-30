import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { IntakeTriageRecord } from '../triage/triage.types';
import { IntakeRequestDto } from './dto/intake-request.dto';
import { IntakeService } from './intake.service';

/**
 * Webhook entry point.
 * POST /webhooks/intake — accepts a raw inbound message and returns the full
 * triage record synchronously (classify → route → persist).
 */
@Controller('webhooks')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  @Post('intake')
  @HttpCode(200)
  async ingest(@Body() body: IntakeRequestDto): Promise<IntakeTriageRecord> {
    return this.intake.processIntake(body);
  }
}

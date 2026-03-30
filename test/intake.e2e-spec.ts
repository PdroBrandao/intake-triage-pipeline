import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { LlmTriageService } from '../src/triage/llm/llm-triage.service';
import type { IntakeTriageRecord } from '../src/triage/triage.types';

const basePartial = {
  category: 'Bug Report' as const,
  priority: 'High' as const,
  coreIssueSentence: 'User cannot log in.',
  identifiers: [] as { type: string; value: string }[],
  urgencySignal: 'single user',
  llmEscalationSuggested: false,
  humanReadableSummary: 'Test handoff summary.',
};

describe('Intake webhook (e2e)', () => {
  let app: INestApplication<App>;
  let outPath: string;
  const completeTriage = jest.fn();

  beforeEach(async () => {
    outPath = join(tmpdir(), `intake-e2e-${randomUUID()}.json`);
    process.env.INTAKE_JSON_PATH = outPath;
    process.env.INTAKE_JSON_DISABLED = 'false';
    completeTriage.mockResolvedValue({
      ...basePartial,
      confidence: 90,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LlmTriageService)
      .useValue({ completeTriage })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    try {
      unlinkSync(outPath);
    } catch {
      /* ignore */
    }
  });

  it('POST /webhooks/intake appends the record to the JSON file', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/intake')
      .send({
        source: 'Email',
        rawMessage: 'Cannot log in, 403 error.',
      })
      .expect(200)
      .expect((res) => {
        const body = res.body as IntakeTriageRecord;
        expect(body.destinationQueue).toBe('Engineering');
        expect(body.requiresHumanReview).toBe(false);
      });

    const stored = JSON.parse(readFileSync(outPath, 'utf8')) as unknown[];
    expect(Array.isArray(stored)).toBe(true);
    expect(stored).toHaveLength(1);
    expect((stored[0] as { rawMessage: string }).rawMessage).toContain('403');
  });

  it('low confidence → routes to HumanReview and records escalation reasons', async () => {
    completeTriage.mockResolvedValueOnce({
      ...basePartial,
      confidence: 50,
    });

    await request(app.getHttpServer())
      .post('/webhooks/intake')
      .send({ rawMessage: 'Ambiguous vague message.' })
      .expect(200)
      .expect((res) => {
        const body = res.body as IntakeTriageRecord;
        expect(body.requiresHumanReview).toBe(true);
        expect(body.destinationQueue).toBe('HumanReview');
        expect(body.escalationReasons).toContain('low_confidence');
      });

    const stored = JSON.parse(readFileSync(outPath, 'utf8')) as unknown[];
    expect(stored).toHaveLength(1);
  });
});

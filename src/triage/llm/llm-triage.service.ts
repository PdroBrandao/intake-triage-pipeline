import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { buildTriageUserMessage } from '../prompts/build-user-message';
import { TRIAGE_SYSTEM_PROMPT } from '../prompts/triage-system.prompt';
import type { LlmTriagePartial } from '../triage.types';
import {
  assertLlmTriagePartial,
  LlmTriageParseError,
  parseLlmJsonContent,
} from './llm-triage.parser';

@Injectable()
export class LlmTriageService {
  /**
   * Lazily instantiated so the app boots without OPENAI_API_KEY.
   * The first actual request will trigger validation.
   */
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getOpenAI(): OpenAI {
    if (this.client) {
      return this.client;
    }
    const apiKey = this.config.get<string>('openai.apiKey');
    // timeout: max wait for a single HTTP response from OpenAI
    const timeoutMs = this.config.get<number>('openai.timeoutMs') ?? 60_000;
    // maxRetries: automatic retries with exponential backoff via the SDK
    const maxRetries = this.config.get<number>('openai.maxRetries') ?? 3;

    if (!apiKey?.trim()) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY is not configured',
      );
    }

    this.client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries });
    return this.client;
  }

  /**
   * Calls the LLM with a single prompt (classification + enrichment + summary)
   * and returns a validated LlmTriagePartial.
   * Routing and escalation are NOT decided here — see TriageRoutingService.
   */
  async completeTriage(
    rawMessage: string,
    source?: string,
  ): Promise<LlmTriagePartial> {
    const model = this.config.get<string>('openai.model') ?? 'gpt-4.1';
    const user = buildTriageUserMessage(rawMessage, source);

    let completion;
    try {
      completion = await this.getOpenAI().chat.completions.create({
        model,
        messages: [
          { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
          { role: 'user', content: user },
        ],
        // Forces the model to output a JSON object, avoiding markdown fences
        response_format: { type: 'json_object' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException(`OpenAI request failed: ${msg}`);
    }

    const content = completion.choices[0]?.message?.content;
    if (!content?.trim()) {
      throw new ServiceUnavailableException('Empty LLM response');
    }

    try {
      const data = parseLlmJsonContent(content);
      return assertLlmTriagePartial(data);
    } catch (err: unknown) {
      if (err instanceof LlmTriageParseError) {
        throw new ServiceUnavailableException(err.message);
      }
      throw err;
    }
  }
}

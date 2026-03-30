const int = (v: string | undefined, fallback: number) => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export default () => ({
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1',
    /** Max wait (ms) for a single OpenAI HTTP response before timing out. */
    timeoutMs: int(process.env.OPENAI_TIMEOUT_MS, 60_000),
    /** Number of automatic retries with exponential backoff (OpenAI SDK). */
    maxRetries: int(process.env.OPENAI_MAX_RETRIES, 3),
  },
  intake: {
    /** Path (relative to cwd) where triage records are appended as a JSON array. */
    jsonPath:
      process.env.INTAKE_JSON_PATH?.trim() || 'data/intake-records.json',
    /** Set INTAKE_JSON_DISABLED=true to skip disk writes (useful in tests). */
    jsonPersistEnabled: process.env.INTAKE_JSON_DISABLED !== 'true',
  },
});

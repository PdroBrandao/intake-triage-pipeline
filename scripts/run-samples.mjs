/**
 * End-to-end smoke test against a live server.
 * Usage: start the server first (npm run start:dev), then run npm run intake:samples
 */
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';

const samplesPath = join(__dirname, '..', 'fixtures', 'sample-messages.json');
const samples = JSON.parse(await readFile(samplesPath, 'utf8'));

let failed = false;
for (const s of samples) {
  const body = {
    rawMessage: s.rawMessage,
    source: s.source,
    ...(s.messageId ? { messageId: s.messageId } : {}),
  };
  const res = await fetch(`${base}/webhooks/intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }
  const label = s.messageId ?? s.rawMessage.slice(0, 40);
  if (!res.ok) {
    failed = true;
    console.error(`FAIL ${label} HTTP ${res.status}`, json);
    continue;
  }
  console.log(
    `OK ${label} → destination=${json.destinationQueue} HITL=${json.requiresHumanReview} category=${json.category}`,
  );
}

if (failed) {
  process.exit(1);
}
console.log(
  '\nDone. Check the output file at INTAKE_JSON_PATH (default: data/intake-records.json).',
);

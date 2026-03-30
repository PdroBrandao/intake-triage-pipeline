# intake-triage-pipeline

AI-powered intake and triage pipeline for ArcVault — a synthetic B2B support scenario.

Classifies inbound customer messages (email, web form, support portal), enriches them with structured entities, routes to the correct team queue, and flags records that require human review.

Built with **NestJS + TypeScript + OpenAI gpt-4.1**. No external orchestration tool — routing and escalation are deterministic code, not model decisions.

→ [Architecture Write-Up](./docs/architecture-writeup.md)  
→ [Prompt Documentation](./docs/prompt-documentation.md)  
→ [Structured Output — 5 samples](./docs/structured-output.json)

---

## How it works

```
POST /webhooks/intake
        │
        ▼
  LLM (gpt-4.1) — classify + enrich + summarise
        │
        ▼
  Escalation Gate (deterministic rules)
        │
   ┌────┴─────────────────┐
   ▼                       ▼
Business Queue         HumanReview
(Engineering | Billing | Product | IT_Security)
        │                       │
        └────────┬───────────────┘
                 ▼
     data/intake-records.json
```

---

## Requirements

- Node.js ≥ 18
- An OpenAI API key with access to `gpt-4.1` (or configure another model via `OPENAI_MODEL`)

---

## Setup

```bash
git clone <repo-url>
cd intake-triage-pipeline

npm install

cp .env.example .env
# Add your OPENAI_API_KEY to .env
```

---

## Run

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build && npm run start:prod
```

Server starts at `http://localhost:3000`.

---

## Process the 5 sample inputs

With the server running in one terminal:

```bash
npm run intake:samples
```

This POSTs all 5 sample messages from `fixtures/sample-messages.json` to the webhook and prints a summary line per message. Output is appended to `data/intake-records.json`.

Expected output:

```
OK ... → destination=Engineering    HITL=false  category=Bug Report
OK ... → destination=Product        HITL=false  category=Feature Request
OK ... → destination=Billing        HITL=false  category=Billing Issue
OK ... → destination=IT_Security    HITL=false  category=Technical Question
OK ... → destination=HumanReview    HITL=true   category=Incident/Outage
```

---

## Single message via curl

```bash
curl -s -X POST http://localhost:3000/webhooks/intake \
  -H "Content-Type: application/json" \
  -d '{
    "rawMessage": "Your dashboard stopped loading for us around 2pm EST. Multiple users affected.",
    "source": "Web Form"
  }' | jq .
```

---

## Tests

```bash
# Unit tests
npm test

# E2E tests (no live API — LLM is mocked)
npm run test:e2e
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Required |
| `OPENAI_MODEL` | `gpt-4.1` | Model to use |
| `OPENAI_TIMEOUT_MS` | `60000` | Request timeout (ms) |
| `OPENAI_MAX_RETRIES` | `3` | SDK retries with exponential backoff |
| `INTAKE_JSON_PATH` | `data/intake-records.json` | Output file path (relative to cwd) |
| `INTAKE_JSON_DISABLED` | `false` | Set to `true` to skip disk writes |

---

## Output schema

Each processed message produces one record:

```json
{
  "messageId": "uuid",
  "ingestedAt": "ISO 8601",
  "source": "Email | Web Form | Support Portal",
  "rawMessage": "...",
  "category": "Bug Report | Feature Request | Billing Issue | Technical Question | Incident/Outage",
  "priority": "Low | Medium | High",
  "confidence": 0-100,
  "coreIssueSentence": "...",
  "identifiers": [{ "type": "...", "value": "..." }],
  "urgencySignal": "...",
  "llmEscalationSuggested": false,
  "routedTeamQueue": "Engineering | Billing | Product | IT_Security",
  "destinationQueue": "Engineering | Billing | Product | IT_Security | HumanReview",
  "requiresHumanReview": false,
  "escalationReasons": [],
  "humanReadableSummary": "..."
}
```

---

## Model choice

`gpt-4.1` was chosen for reliable instruction-following and consistent JSON output. With more time I would benchmark `gpt-4o-mini` against the 5 labeled samples — for structured extraction with strict enums, cheaper models often match accuracy once the prompt is well-calibrated.

---

## What the AI got wrong (and what I fixed)

- First run classified the dashboard outage (sample 5) as **`Bug Report`** instead of `Incident/Outage`. Fixed by adding explicit guidance: *"Prefer Incident/Outage when multiple users cannot use a core surface (e.g. dashboard)"*.
- Priority for sample 1 (login 403) came back as **`Medium`**. Fixed by adding: *"Use High for any complete loss of access for a known account even if only one user is affected"*.

---

**Author:** Pedro Brandão · [pdrobrandao.com](https://pdrobrandao.com) · [LinkedIn](https://linkedin.com/in/pdrobrandao)

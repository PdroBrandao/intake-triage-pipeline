# Architecture Write-Up — ArcVault Intake Triage Pipeline

---

## 1. System Design

```
POST /webhooks/intake
        │ raw message + source
        ▼
  LLM — gpt-4.1
  (classify + enrich + summarise)
        │ LlmTriagePartial
        ▼
  Escalation Gate  ──── confidence < 70 · keyword · billing · llmEscalationSuggested ────► HumanReview Queue
        │                                                                                           │
        │ confidence ≥ 70 · no rule hit                                                             │
        ▼                                                                                           │
  Business Queue                                                                                    │
  (Engineering | Billing | Product | IT_Security)                                                  │
        │                                                                                           │
        └──────────────────────── append IntakeTriageRecord ────────────────────────────────────────┘
                                          │
                                          ▼
                              data/intake-records.json
```

**How it connects:** a single `POST /webhooks/intake` triggers the full pipeline synchronously. The body carries the raw message and an optional source channel. The LLM call is the only non-deterministic step; everything after it — routing, escalation, persistence — is pure code with no model involvement.

**Where state lives:** an append-only JSON file on disk (`data/intake-records.json`). Each processed message produces one `IntakeTriageRecord` appended to the array. No database, no in-memory state — the file is the audit log.

---

## 2. Routing Logic

| Category | Team Queue | Rationale |
|---|---|---|
| Bug Report | Engineering | Code defect requiring an engineer |
| Incident/Outage | Engineering | Same team, higher implied urgency |
| Feature Request | Product | Product management owns the roadmap |
| Billing Issue | Billing | Finance / CS owns contract disputes |
| Technical Question | IT_Security | Integration and auth questions |

Bug Report and Incident/Outage share Engineering intentionally — the distinction between them affects priority and escalation, not the receiving team. This keeps the routing table to 4 queues while covering all 5 categories cleanly.

---

## 3. Escalation Logic

Escalation is fully deterministic. The LLM outputs a `llmEscalationSuggested` boolean as a soft signal; the final `requiresHumanReview` flag is always computed in code:

```
requiresHumanReview =
  confidence < 70
  OR llmEscalationSuggested
  OR rawMessage contains "outage" / "down for all users"
  OR rawMessage mentions "multiple users" / "several users"
  OR two USD amounts parsed from text with delta ≥ $500
```

When `requiresHumanReview` is true, `destinationQueue` is always `HumanReview` regardless of category. `routedTeamQueue` is still computed and stored — it shows where the ticket would have gone without escalation, useful for auditing and for human reviewers who need context.

The escalation reasons are stored as a typed array (`escalationReasons[]`) so downstream consumers know exactly why a ticket was flagged, not just that it was.

---

## 4. What I Would Do Differently at Production Scale

**Reliability**
- Replace the synchronous HTTP call with an async queue (e.g. BullMQ + Redis): the webhook acknowledges immediately, workers process in background; no request timeout risk on slow LLM responses.
- Add circuit breaker around the OpenAI call — if the API is degraded, fail fast and route all incoming messages to HumanReview rather than hanging.
- Idempotency key on ingestion: deduplicate by `messageId` to safely retry webhooks without double-processing.

**Cost & latency**
- Benchmark `gpt-4o-mini` against `gpt-4.1` on a labeled dataset. For structured extraction with strict enums, cheaper models often match accuracy once the prompt is well-calibrated.
- Token budget guard: enforce `max_tokens` on the completion to cap per-request cost.

**Accuracy**
- Implement eval-driven prompt versioning: every prompt change is tested against a fixed regression set before shipping. The 5 sample inputs serve as the v1.0 baseline. See [prompt-documentation.md](./prompt-documentation.md) for the full versioning strategy.
- Calibrate confidence scores against labeled outputs. The raw model score is not a calibrated probability — fitting a simple regression on score vs. actual accuracy makes the 70% threshold meaningful.

**Persistence**
- Replace the JSON file with a proper append-only store (Postgres, DynamoDB, or a message queue topic) for concurrent writes, querying, and retention policies.
- Add a `processed_at` timestamp and a `pipeline_version` field to every record for traceability.

---

## 5. Phase 2 — One More Week

| Addition | Why |
|---|---|
| Few-shot examples in the prompt (v1.1) | Reduce Bug vs. Incident/Outage ambiguity — the boundary that produced the most oscillation in the 5 samples |
| Automated evals against the labeled dataset | Ship no prompt version that regresses a passing case |
| Second-pass LLM review for `confidence < 70` | Catch obvious misclassifications before sending to HumanReview, reducing HITL volume |
| Downstream webhook delivery | POST the final record to team-specific endpoints (Engineering, Billing, etc.) instead of only writing to a file |
| Multi-tenant `tenantId` field | Namespace records by customer — the architecture is the same, routing rules become per-tenant configurable |

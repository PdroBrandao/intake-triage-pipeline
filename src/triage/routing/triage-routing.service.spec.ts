import { TriageRoutingService } from './triage-routing.service';

describe('TriageRoutingService', () => {
  const svc = new TriageRoutingService();

  it('maps categories to team queues', () => {
    expect(svc.mapCategoryToTeam('Billing Issue')).toBe('Billing');
    expect(svc.mapCategoryToTeam('Feature Request')).toBe('Product');
    expect(svc.mapCategoryToTeam('Technical Question')).toBe('IT_Security');
    expect(svc.mapCategoryToTeam('Incident/Outage')).toBe('Engineering');
  });

  it('detects billing delta >= 500 from two USD amounts', () => {
    expect(svc.billingDeltaAtLeast500('$1,000 and $400')).toBe(true);
    expect(svc.billingDeltaAtLeast500('$1240 vs $980')).toBe(false);
  });

  it('adds multi_user_impact when text mentions multiple users', () => {
    const partial = {
      category: 'Bug Report' as const,
      priority: 'High' as const,
      confidence: 95,
      coreIssueSentence: 'x',
      identifiers: [],
      urgencySignal: 'y',
      llmEscalationSuggested: false,
      humanReadableSummary: 'z',
    };
    const reasons = svc.collectEscalationReasons(
      partial,
      'Multiple users cannot log in.',
    );
    expect(reasons).toContain('multi_user_impact');
  });
});

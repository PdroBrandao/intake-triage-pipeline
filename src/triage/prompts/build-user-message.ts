export function buildTriageUserMessage(
  rawMessage: string,
  source?: string,
): string {
  const channel = source ? `Optional channel (if known): ${source}\n\n` : '';
  return `The customer message may be in any language; still produce enum values and summaries in English.\n\n${channel}Raw message:\n"""\n${rawMessage}\n"""`;
}

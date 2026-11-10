export type MessagingShareDraft = { id: string; body: string };

// A share prepares ordinary message text. Recipient and send authorization
// remain in the existing Messaging flow and RPC.
export function readMessagingShareDraft(value: unknown): MessagingShareDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<MessagingShareDraft>;
  if (typeof draft.id !== "string" || !draft.id || draft.id.length > 128 || typeof draft.body !== "string") return null;
  const body = draft.body.trim();
  return body && body.length <= 10000 ? { id: draft.id, body } : null;
}

export function appendMessagingShareDrafts(body: string, drafts: MessagingShareDraft[]): string | null {
  const addition = drafts.map(draft => draft.body).join("\n\n");
  const next = body ? `${body}\n\n${addition}` : addition;
  return next.trim().length <= 10000 ? next : null;
}

const DRAFT_KEY_PREFIX = "e-smart-qa:document-draft:v2";
const LEGACY_DRAFT_KEY_PREFIX = "e-smart-qa:document-draft";

export function documentDraftKey(userId: string): string {
  return `${DRAFT_KEY_PREFIX}:${userId}`;
}

export function clearDocumentDraft(userId: string): void {
  try {
    localStorage.removeItem(documentDraftKey(userId));
    localStorage.removeItem(`${LEGACY_DRAFT_KEY_PREFIX}:${userId}`);
  } catch {
    // Ignore storage errors; the form still unmounts with its in-memory state.
  }
}

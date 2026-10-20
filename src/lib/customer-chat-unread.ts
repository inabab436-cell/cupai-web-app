export interface IncomingChatMessage {
  id?: string;
  role: string;
  created_at?: string;
}

export const chatReadKey = (slug: string, conversationId: string) =>
  `cupai_chat_read_${slug}_${conversationId}`;

export function countUnreadReplies(messages: IncomingChatMessage[], seenId: string | null): number {
  const seenIndex = seenId ? messages.findIndex((m) => m.id === seenId) : -1;
  return messages.slice(seenIndex + 1).filter((m) => m.role === "assistant").length;
}

export function markChatRead(slug: string, conversationId: string, messages: IncomingChatMessage[]) {
  const lastId = messages.at(-1)?.id;
  if (!lastId) return;
  try {
    window.localStorage.setItem(chatReadKey(slug, conversationId), lastId);
    window.dispatchEvent(new Event("cupai-chat-read"));
  } catch { /* Storage is optional; never interrupt the conversation. */ }
}
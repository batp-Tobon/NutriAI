"use server";

import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createConversationRepository } from "@/infrastructure/supabase/repositories";

export type CoachMsg = { role: "user" | "assistant"; content: string };

/**
 * Carga el historial del Coach. Se llama SÓLO cuando el usuario abre el chat
 * flotante (no en cada navegación), para no penalizar la velocidad de la app.
 */
export async function loadCoachHistory(): Promise<CoachMsg[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  try {
    const supabase = await createClient();
    const conversations = createConversationRepository(supabase);
    const conversation = await conversations.getOrCreateDefault(user.id);
    const messages = await conversations.listMessages(conversation.id, user.id);
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  } catch {
    return [];
  }
}

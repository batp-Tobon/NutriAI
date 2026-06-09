import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createConversationRepository } from "@/infrastructure/supabase/repositories";
import { ChatClient } from "@/components/coach/chat-client";

export const metadata = { title: "Coach" };

export default async function CoachPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  let initial: { role: "user" | "assistant"; content: string }[] = [];
  try {
    const conversations = createConversationRepository(supabase);
    const conversation = await conversations.getOrCreateDefault(user!.id);
    const messages = await conversations.listMessages(conversation.id, user!.id);
    initial = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  } catch {
    initial = [];
  }

  return (
    <div className="py-2">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <span className="text-lg">🤖</span>
        </div>
        <div>
          <h1 className="text-base font-bold leading-none">NutriAI Coach</h1>
          <span className="text-xs text-primary">● Online</span>
        </div>
      </div>
      <ChatClient initial={initial} />
    </div>
  );
}

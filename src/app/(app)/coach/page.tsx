import Link from "next/link";
import { Lock } from "lucide-react";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createConversationRepository } from "@/infrastructure/supabase/repositories";
import { getUserAccess } from "@/server/access";
import { ChatClient } from "@/components/coach/chat-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Coach" };

export default async function CoachPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { access } = await getUserAccess();

  if (!access.aiEnabled) {
    return (
      <div className="py-2">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="text-lg font-bold">Coach IA</h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              El chat con el Coach inteligente está disponible en el{" "}
              <b>plan IA</b>. Cambia de plan para hablar con tu coach personal.
            </p>
            <Button asChild className="mt-1">
              <Link href="/subscribe">Ver planes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

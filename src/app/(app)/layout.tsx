import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { createConversationRepository } from "@/infrastructure/supabase/repositories";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CoachFab } from "@/components/coach/coach-fab";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { getAccess } from "@/core/application/subscription";
import { env } from "@/lib/env";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Forzar onboarding si el perfil no está completo
  if (profile && !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  // Paywall: prueba de 5 días → luego mensualidad (admins exentos)
  const isAdmin = env.adminEmails.includes((user.email ?? "").toLowerCase());
  const access = profile ? getAccess(profile, isAdmin) : null;
  if (profile && !access!.hasAccess) {
    redirect("/subscribe");
  }

  // Historial del Coach (solo si tiene IA) para el chat flotante.
  const aiEnabled = access?.aiEnabled ?? false;
  let coachInitial: { role: "user" | "assistant"; content: string }[] = [];
  if (aiEnabled) {
    try {
      const conversations = createConversationRepository(supabase);
      const conversation = await conversations.getOrCreateDefault(user.id);
      const messages = await conversations.listMessages(conversation.id, user.id);
      coachInitial = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    } catch {
      coachInitial = [];
    }
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <AppHeader profile={profile} email={user.email} isAdmin={isAdmin} />
      <main className="px-safe flex-1 pb-28 pt-1">{children}</main>
      <InstallPrompt />
      <CoachFab aiEnabled={aiEnabled} initial={coachInitial} />
      <BottomNav />
    </div>
  );
}

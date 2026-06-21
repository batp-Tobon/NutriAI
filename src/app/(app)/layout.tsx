import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "@/infrastructure/supabase/server";
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

  const profile = await getCurrentProfile();

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

  // El historial del Coach se carga al ABRIR el chat flotante (no aquí), para
  // que cada navegación sea más rápida.
  const aiEnabled = access?.aiEnabled ?? false;

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <AppHeader profile={profile} email={user.email} isAdmin={isAdmin} />
      <main className="px-safe flex-1 pb-28 pt-1">{children}</main>
      <InstallPrompt />
      <CoachFab aiEnabled={aiEnabled} />
      <BottomNav />
    </div>
  );
}

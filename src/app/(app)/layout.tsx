import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
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
  if (profile && !getAccess(profile, isAdmin).hasAccess) {
    redirect("/subscribe");
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <AppHeader profile={profile} email={user.email} />
      <main className="flex-1 px-4 pb-28 pt-1">{children}</main>
      <InstallPrompt />
      <BottomNav />
    </div>
  );
}

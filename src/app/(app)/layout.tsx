import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { InstallPrompt } from "@/components/pwa/install-prompt";

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

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <AppHeader profile={profile} email={user.email} />
      <main className="flex-1 px-4 pb-28 pt-1">{children}</main>
      <InstallPrompt />
      <BottomNav />
    </div>
  );
}

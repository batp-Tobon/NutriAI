import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/infrastructure/supabase/server";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata = { title: "Configura tu perfil" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">¡Bienvenido a NutriAI!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuéntanos sobre ti para calcular tus objetivos diarios.
        </p>
      </div>
      <ProfileForm profile={profile} mode="onboarding" />
    </div>
  );
}

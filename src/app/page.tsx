import { redirect } from "next/navigation";
import { getCurrentUser } from "@/infrastructure/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export default async function Home() {
  if (!isSupabaseConfigured()) redirect("/login");
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}

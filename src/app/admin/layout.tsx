import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getCurrentProfile,
  getCurrentUser,
} from "@/infrastructure/supabase/server";
import { env } from "@/lib/env";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  const isAdmin =
    profile?.role === "admin" ||
    env.adminEmails.includes((user.email ?? "").toLowerCase());

  if (!isAdmin) redirect("/dashboard");

  return (
    <div
      className="mx-auto min-h-dvh w-full max-w-3xl"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 2.5rem)",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-extrabold">
          Nutri<span className="text-primary">AI</span>{" "}
          <span className="text-muted-foreground">· Admin</span>
        </h1>
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> App
        </Link>
      </div>
      {children}
    </div>
  );
}

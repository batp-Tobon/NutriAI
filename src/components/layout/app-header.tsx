"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CreditCard, LogOut, Settings, User } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import type { Profile } from "@/core/domain/entities";

export function AppHeader({
  profile,
  email,
  isAdmin = false,
}: {
  profile: Profile | null;
  email?: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const name = profile?.full_name ?? email ?? "Usuario";

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="px-safe pt-safe sticky top-0 z-30 flex items-center justify-between border-b border-border/40 bg-background/95 pb-2 backdrop-blur">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label="Perfil" className="outline-none">
            <Avatar className="h-9 w-9 border border-border">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={name} />
              )}
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <User className="h-4 w-4" /> Perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/subscribe">
              <CreditCard className="h-4 w-4" /> Suscripción
            </Link>
          </DropdownMenuItem>
          {(isAdmin || profile?.role === "admin") && (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <Settings className="h-4 w-4" /> Panel admin
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut} className="text-destructive">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Link href="/dashboard" className="text-xl font-extrabold tracking-tight">
        Nutri<span className="text-primary">AI</span>
      </Link>

      <Link
        href="/notifications"
        aria-label="Notificaciones"
        className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
      </Link>
    </header>
  );
}

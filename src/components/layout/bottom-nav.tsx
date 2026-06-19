"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  Home,
  LineChart,
  TrendingDown,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/log", label: "Comidas", icon: UtensilsCrossed },
  { href: "/deficit", label: "Déficit", icon: TrendingDown },
  { href: "/plan", label: "Entreno", icon: Dumbbell },
  { href: "/progress", label: "Progreso", icon: LineChart },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-border/60 bg-background/95 px-1 pb-safe pt-1.5 backdrop-blur">
      <ul className="flex items-center justify-between">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "rounded-full px-3 py-1 transition-colors",
                    active && "bg-primary/15",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

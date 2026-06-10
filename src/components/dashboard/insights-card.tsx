import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Tip } from "@/core/application/insights";

export function InsightsCard({ tips }: { tips: Tip[] }) {
  if (tips.length === 0) return null;
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Recomendaciones de hoy
        </h2>
        <ul className="space-y-2">
          {tips.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  t.tone === "good"
                    ? "bg-primary"
                    : t.tone === "warn"
                      ? "bg-destructive"
                      : "bg-muted-foreground",
                )}
              />
              <span className="text-muted-foreground">{t.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatMsg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "¿Cómo ajusto mis macros hoy?",
  "Dame una idea de cena alta en proteína",
  "¿Voy bien para mi objetivo?",
];

export function ChatClient({
  initial,
  className,
}: {
  initial: ChatMsg[];
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>(
    initial.length > 0
      ? initial
      : [
          {
            role: "assistant",
            content:
              "¡Hola! Soy NutriAI Coach. Puedo ayudarte con nutrición, déficit calórico, ganancia muscular y hábitos. ¿En qué te ayudo hoy?",
          },
        ],
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content }]);
    setLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error del coach");
      setMessages((m) => m.slice(0, -1)); // revertir mensaje de usuario
      setInput(content);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col", className ?? "h-[calc(100dvh-9rem)]")}>
      <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar pb-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user"
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-secondary text-secondary-foreground",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-secondary px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border/60 pt-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregúntale a NutriAI…"
          className="h-11 min-w-0 flex-1 rounded-full border border-input bg-secondary/40 px-4 text-base focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}

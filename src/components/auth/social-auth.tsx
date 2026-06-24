"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

type SocialProvider = "google" | "facebook";

const PROVIDERS: { id: SocialProvider; label: string; Icon: () => React.ReactElement }[] = [
  { id: "google", label: "Continuar con Google", Icon: GoogleIcon },
  { id: "facebook", label: "Continuar con Facebook", Icon: FacebookIcon },
];

export function SocialAuth() {
  const [loading, setLoading] = useState<SocialProvider | null>(null);

  async function signInWith(provider: SocialProvider) {
    setLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: { redirectTo: `${env.appUrl}/auth/callback` },
    });
    if (error) {
      toast.error(error.message);
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          className="w-full"
          disabled={loading !== null}
          onClick={() => signInWith(id)}
        >
          <Icon /> {label}
        </Button>
      ))}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.1 14.7 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c5.9 0 9.8-4.1 9.8-9.9 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 6 4.4 11 10.1 11.9v-8.4H7.1V12h3v-2.6c0-3 1.8-4.6 4.5-4.6 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4C19.6 23 24 18 24 12z"
      />
    </svg>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { activateMonth } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";

export function ActivateButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function activate() {
    start(async () => {
      const res = await activateMonth(userId);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("Mes activado (+30 días)");
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={activate} disabled={pending}>
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      +1 mes
    </Button>
  );
}

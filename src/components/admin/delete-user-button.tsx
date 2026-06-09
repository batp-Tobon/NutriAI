"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { deleteUser } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteUserButton({
  userId,
  email,
}: {
  userId: string;
  email: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirmDelete() {
    start(async () => {
      const res = await deleteUser(userId);
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      toast.success("Usuario eliminado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Eliminar usuario"
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <Trash2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center">Eliminar usuario</DialogTitle>
            <DialogDescription className="text-center">
              Se eliminará la cuenta <b>{email ?? "de este usuario"}</b> y{" "}
              <b>todos sus datos</b>. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={confirmDelete}
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

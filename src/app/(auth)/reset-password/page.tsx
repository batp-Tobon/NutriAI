import { ResetForm } from "@/components/auth/reset-form";

export const metadata = { title: "Recuperar contraseña" };

export default function ResetPasswordPage() {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Recuperar contraseña</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Introduce tu email y te enviaremos un enlace.
        </p>
      </div>
      <ResetForm />
    </div>
  );
}

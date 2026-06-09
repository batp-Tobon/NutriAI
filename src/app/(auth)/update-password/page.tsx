import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata = { title: "Nueva contraseña" };

export default function UpdatePasswordPage() {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Define tu nueva contraseña</h2>
      </div>
      <UpdatePasswordForm />
    </div>
  );
}

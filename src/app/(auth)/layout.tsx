export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 2.5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 2.5rem)",
      }}
    >
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Nutri<span className="text-primary">AI</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nutrición y entrenamiento con inteligencia artificial
        </p>
      </div>
      {children}
    </div>
  );
}

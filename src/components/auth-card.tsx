import Link from "next/link";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-sm">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          FLOKK.
        </Link>
        <div className="mt-6 mb-5 space-y-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function FormSuccess({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="space-y-1 rounded-2xl bg-tint-mint p-4">
      <p className="font-semibold">{title}</p>
      <p className="text-sm opacity-80">{children}</p>
    </div>
  );
}

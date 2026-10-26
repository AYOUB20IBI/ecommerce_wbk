
export default function StorefrontPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-3xl font-bold text-foreground">
          Commerce Engine Storefront
        </h1>

        <p className="text-muted-foreground">
          Storefront Theme Test
        </p>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Storefront Design System
          </h2>

          <button
            type="button"
            className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground"
          >
            Primary Button
          </button>
        </div>
      </div>
    </main>
  );
}

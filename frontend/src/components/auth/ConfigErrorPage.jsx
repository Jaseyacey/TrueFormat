export default function ConfigErrorPage() {
  return (
    <section className="rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-6 text-[#EF4444]">
      <h2 className="mb-3 text-xl font-semibold">Frontend Config Missing</h2>
      <div className="space-y-2 text-sm">
        <p>
          Add these keys to <code>frontend/.env</code>:
        </p>
        <p>
          <code>VITE_SUPABASE_URL=...</code>
        </p>
        <p>
          <code>VITE_SUPABASE_ANON_KEY=...</code>
        </p>
        <p>Then restart Vite dev server.</p>
      </div>
    </section>
  );
}

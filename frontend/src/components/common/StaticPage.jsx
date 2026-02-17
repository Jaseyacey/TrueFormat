export default function StaticPage({ title, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#27272A]/55 p-6 backdrop-blur-md">
      <h2 className="mb-3 text-2xl font-semibold text-[#F8FAFC]">{title}</h2>
      <div className="space-y-2 text-[#94A3B8]">{children}</div>
    </section>
  );
}

import React from 'react';

export default function MarketingHomePage({ onPrimaryCta }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-600/40 bg-[#0b1729]/90 text-slate-100 shadow-2xl shadow-black/30 font-sans">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(96,165,250,.12),transparent_42%)]" />

      <main className="relative mx-auto max-w-6xl px-6 pb-16 pt-8 lg:px-10">
        
        {/* HERO SECTION */}
        <section className="grid gap-8 rounded-2xl border border-slate-600/50 bg-[#13243d]/70 p-8 lg:grid-cols-12 lg:p-12">
          <div className="lg:col-span-8">
            <p className="mb-4 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400">
              Deterministic Data Ingestion
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-5xl">
              Clean Supplier Data. <br/> No Manual Edits.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              Automate the transformation of messy CSVs and PDFs into system-ready files. We stop 
              <strong> scientific notation</strong>, <strong>date flips</strong>, and <strong>lost leading zeros</strong> before they hit your ERP.
            </p>
            <div className="mt-8 flex gap-4">
              <button
                onClick={onPrimaryCta}
                className="rounded-md bg-blue-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-400 shadow-lg shadow-blue-500/20"
              >
                Start Pilot
              </button>
            </div>
          </div>
          <aside className="lg:col-span-4 flex items-center">
            <div className="w-full rounded-xl border border-slate-600/55 bg-[#0b1729] p-6 shadow-inner">
              <div className="text-xs font-mono text-blue-400 mb-2">// Zero-Loss Guarantee</div>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex gap-2"><span>✓</span> 100% Deterministic</li>
                <li className="flex gap-2"><span>✓</span> Audit-Ready Logs</li>
                <li className="flex gap-2"><span>✓</span> Rule-Based Mapping</li>
              </ul>
            </div>
          </aside>
        </section>

        {/* UTILITY GRID */}
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <article className="rounded-xl border border-slate-600/50 bg-[#13243d]/50 p-6">
            <h3 className="font-bold text-slate-50">Format Hardening</h3>
            <p className="mt-2 text-sm text-slate-400">Forces SKUs to strings and normalizes currencies. No more corrupted part numbers.</p>
          </article>
          <article className="rounded-xl border border-slate-600/50 bg-[#13243d]/50 p-6">
            <h3 className="font-bold text-slate-50">Digital Locksmith</h3>
            <p className="mt-2 text-sm text-slate-400">Map once. Process forever. We handle the messy headers so your ERP doesn't have to.</p>
          </article>
          <article className="rounded-xl border border-slate-600/50 bg-[#13243d]/50 p-6">
            <h3 className="font-bold text-slate-50">No AI Guesswork</h3>
            <p className="mt-2 text-sm text-slate-400">Strict rule-based logic only. Zero hallucinations. Total financial compliance.</p>
          </article>
        </div>

        {/* PRICING CARD */}
        <section className="mt-12 overflow-hidden rounded-2xl border border-blue-500/40 bg-slate-900/80 shadow-xl shadow-blue-900/10">
          <div className="p-8 lg:p-10 flex flex-col lg:flex-row justify-between items-center gap-8">
            <div className="text-center lg:text-left">
              <h2 className="text-2xl font-bold text-white">Standard Infrastructure Plan</h2>
              <p className="mt-2 text-slate-400 max-w-md">The reliable "back-office" engine for wholesale and procurement teams.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-5xl font-black text-white">£500<span className="text-lg font-normal text-slate-500">/mo</span></div>
              <button
                onClick={onPrimaryCta}
                className="mt-4 w-full rounded-md border border-blue-400 px-8 py-2 text-sm font-bold text-blue-400 hover:bg-blue-400 hover:text-slate-950 transition"
              >
                Join the Pilot
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-slate-700 bg-slate-900/40 px-8 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <div className="text-center">Unlimited CSVs</div>
            <div className="text-center">Priority Support</div>
            <div className="text-center">Template Library</div>
            <div className="text-center">NetSuite/Xero Ready</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950/50 px-10 py-6 text-center text-xs text-slate-500">
        Deterministic Data Pipeline • Optimized for Production Environments
      </footer>
    </div>
  );
}
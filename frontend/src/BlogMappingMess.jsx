import React, { useEffect } from 'react';

const META_DESCRIPTION = 'Stop Excel from rounding your SKUs and flipping your dates. Learn how TrueFormat provides deterministic CSV exports for UK manufacturers using Sage, Xero, and D365.';

export default function BlogMappingMess({ onCta }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'The £15,000 Mapping Mess | TrueFormat Blog';

    let meta = document.querySelector('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    const previousDescription = meta.getAttribute('content') || '';
    meta.setAttribute('content', META_DESCRIPTION);

    return () => {
      document.title = previousTitle;
      if (created) {
        meta.remove();
      } else {
        meta.setAttribute('content', previousDescription);
      }
    };
  }, []);

  return (
    <article className="rounded-2xl border border-white/10 bg-[#27272A]/55 p-6 text-[#CBD5E1] backdrop-blur-md">
      <header className="mb-8 border-b border-white/10 pb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#38BDF8]">TrueFormat Blog</p>
        <h1 className="text-3xl font-black leading-tight text-[#F8FAFC] sm:text-4xl">
          Excel SKU scientific notation fix: The £15,000 &quot;Mapping Mess&quot; harming UK manufacturing margins
        </h1>
        <p className="mt-4 max-w-4xl text-sm text-[#94A3B8]">
          For UK Financial Controllers and MDs in manufacturing and wholesale: why generic OCR tools fail on industrial invoice structures, and how deterministic extraction protects margin and audit readiness.
        </p>
      </header>

      <section className="space-y-4 text-[15px] leading-7 text-[#CBD5E1]">
        <h2 className="text-2xl font-bold text-[#F8FAFC]">Introduction: The Friday CSV firefight</h2>
        <p>
          Every Friday afternoon, someone on the finance team is manually fixing CSV exports before posting to ERP. The immediate pain is obvious: rows that do not import, dates that break validation, and SKU columns that have silently changed shape. The hidden cost is larger. Each &quot;quick fix&quot; increases reconciliation drag across <strong>Manufacturing financial operations</strong>, introduces avoidable controls risk, and delays close activity.
        </p>
        <p>
          In the <strong>West Midlands industrial sector</strong> and across <strong>UK Manufacturing hubs</strong>, this is not a niche edge case. Supplier invoices routinely include long alphanumeric product codes, mixed VAT structures, and line-level descriptors that generic receipt-first tools were never designed to handle. Teams trying to run <strong>Automated supplier invoice processing UK</strong> workflows end up with semi-automated pipelines that still depend on human cleanup.
        </p>
        <p>
          TrueFormat was built around one premise: a deterministic pipe is worth more than a fast guess. If finance leaders want dependable <strong>B2B payment automation</strong>, the feed into Sage, Xero, or D365 cannot mutate IDs and dates in transit.
        </p>
      </section>

      <section className="mt-8 space-y-4 text-[15px] leading-7 text-[#CBD5E1]">
        <h2 className="text-2xl font-bold text-[#F8FAFC]">The Technical Trap: Scientific notation and date flips</h2>
        <p>
          The classic failure starts in spreadsheet tooling. A 15-digit SKU such as <code>503847192004561</code> is read as a number, rendered as <code>5.03847E+14</code>, and exported back as rounded data. That single mutation can break inventory audits, purchase history joins, and supplier dispute workflows. This is why an <strong>Excel SKU scientific notation fix</strong> is operational, not cosmetic.
        </p>
        <p>
          Date handling fails just as often. UK invoices in DD/MM/YYYY format are silently interpreted in US order. A genuine 07/10/2026 invoice becomes July instead of October. In systems already under pressure from <strong>Sage 200 invoice import errors</strong>, this misparse compounds downstream exceptions and manual rework. Data quality slips further when each correction is applied inconsistently by different users.
        </p>
        <p>
          The result is degraded <strong>CSV data integrity</strong>: technically valid files that are business-invalid. Generic OCR engines can extract text, but extraction quality alone does not guarantee reliable posting logic.
        </p>
      </section>

      <section className="mt-8 space-y-4 text-[15px] leading-7 text-[#CBD5E1]">
        <h2 className="text-2xl font-bold text-[#F8FAFC]">The Xero Gap: Where low-cost OCR tools break down</h2>
        <p>
          Lightweight OCR products are fine for simple expense receipts. They can even appear accurate on first pass for low-complexity invoices. But when the document is a £50k equipment invoice with structured line items, long SKUs, and ERP-specific mappings, rule ambiguity becomes expensive. This is the gap finance teams hit when they attempt industrial <strong>ERP data mapping</strong> with tools optimized for convenience, not determinism.
        </p>
        <p>
          In practice, teams end up revalidating totals, rebuilding mapping rules by supplier, and manually correcting columns before import. For firms handling trade-heavy flows in <strong>Scotland trade finance</strong> corridors, this introduces measurable cycle-time delays and avoidable payment friction. Low subscription cost does not mean low total cost when exception handling is persistent.
        </p>
      </section>

      <section className="mt-8 space-y-4 text-[15px] leading-7 text-[#CBD5E1]">
        <h2 className="text-2xl font-bold text-[#F8FAFC]">The TrueFormat Way: Deterministic Data Pipe</h2>
        <p>
          TrueFormat applies zero-guessing transformation rules from extraction to export. IDs remain string-safe, date parsing is explicitly UK-aware, and line-item mappings are resolved against a fixed target schema. Instead of asking finance staff to inspect every output, the system enforces consistency at source. That is how teams recover 15+ admin hours per week and reduce month-end friction.
        </p>
        <p>
          This is the core difference between OCR output and dependable operations. OCR can read characters; deterministic processing enforces business truth. TrueFormat is designed for robust <strong>Automated supplier invoice processing UK</strong> at line-item level, not receipt-level approximations.
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-[#38BDF8]/30 bg-[#0F172A]/70 p-4">
        <h3 className="mb-3 text-lg font-semibold text-[#F8FAFC]">Technical Breakdown: UK date safety in the pipe</h3>
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#020617] p-4 text-sm text-[#E2E8F0]">
          <code>{`final_df["date"] = pd.to_datetime(
    final_df["date"],
    errors="coerce",
    format="mixed",
    dayfirst=True
).dt.strftime("%Y-%m-%d")`}</code>
        </pre>
      </section>

      <section className="mt-8 space-y-4 text-[15px] leading-7 text-[#CBD5E1]">
        <h2 className="text-2xl font-bold text-[#F8FAFC]">The Business Case: £5,000 clean pipe vs £25,000 manual patching</h2>
        <p>
          A deterministic pipeline at roughly £5,000/year is not just a tooling choice; it is a control and margin decision. Compare that with ~£25,000/year for junior admin effort devoted to repeated correction loops, exception chasing, and posting retries. One approach removes recurring defects; the other budgets for them.
        </p>
        <p>
          For finance leaders, the decision framework is simple: choose predictable throughput, stronger controls, and lower error cost per invoice. In environments where invoices drive stock, project, and payment timing, reliable ingest is a strategic capability.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#38BDF8]/25 bg-[linear-gradient(120deg,#082f49_0%,#0f172a_100%)] p-5">
        <div>
          <p className="text-lg font-semibold text-[#F8FAFC]">Find your hidden mapping loss in under 2 minutes</p>
          <p className="text-sm text-[#BFDBFE]">Upload one problematic supplier invoice and see where integrity breaks before ERP import.</p>
        </div>
        <button
          type="button"
          onClick={onCta}
          className="rounded-lg bg-[#38BDF8] px-5 py-3 text-sm font-bold text-[#020617] transition hover:bg-[#7DD3FC]"
        >
          Book a 2-Minute Data Stress Test
        </button>
      </div>
    </article>
  );
}

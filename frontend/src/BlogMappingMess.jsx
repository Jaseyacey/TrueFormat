import React, { useEffect } from 'react';

const META_DESCRIPTION = 'Learn how to prevent Excel from corrupting SKUs in CSVs and import clean invoice data into Xero and ERP systems.';

function ExcelDateBugPost() {
  return (
    <section className="space-y-4 text-[15px] leading-7 text-[#CBD5E1]">
      <h3 className="text-2xl font-bold text-[#F8FAFC]">The Problem</h3>
      <p>
        Teams in supply chain, manufacturing, and pharmacy workflows regularly export CSVs with part numbers like
        <code> MAR-24 </code>, <code>10-04</code>, or <code>5E2</code>. When opened directly in Excel, these values can be auto-converted into dates or scientific notation.
      </p>
      <p>
        Once the file is saved, the original values are often unrecoverable. That corrupted CSV then fails during import into systems like Xero, Unleashed, or other ERPs, or worse, imports with broken inventory history.
      </p>

      <h3 className="text-2xl font-bold text-[#F8FAFC]">Why This Happens</h3>
      <p>
        Excel aggressively infers types using General formatting. If a value looks like a date or number, it transforms it without warning. This can strip leading zeros, alter SKU strings, and change business-critical identifiers.
      </p>

      <h3 className="text-2xl font-bold text-[#F8FAFC]">Manual Fix in Excel (Safe CSV Open)</h3>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Open a blank Excel workbook.</li>
        <li>Go to <strong>Data</strong>.</li>
        <li>Click <strong>From Text/CSV</strong> (or <strong>From Text</strong> in older Excel versions).</li>
        <li>Select the CSV and click <strong>Import</strong>.</li>
        <li>In preview, click <strong>Transform Data</strong>.</li>
        <li>Highlight SKU or Part Number columns.</li>
        <li>Set Data Type to <strong>Text</strong>.</li>
        <li>Click <strong>Close &amp; Load</strong>.</li>
      </ol>
      <p>
        Forcing text type prevents Excel guesswork and preserves IDs exactly as exported.
      </p>

      <h3 className="text-2xl font-bold text-[#F8FAFC]">Automated Fix: Bypass Excel Entirely</h3>
      <p>
        If your workflow extracts line items from supplier PDF invoices, deterministic transformation is safer than spreadsheet cleanup. TrueFormat avoids Excel conversion risk and emits import-ready CSV output.
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong>Deterministic SKU Protection:</strong> Part numbers and batch codes remain strings.</li>
        <li><strong>Pre-Export Math Audit:</strong> Quantity x Unit Price is validated against Line Total.</li>
        <li><strong>Native Xero Formatting:</strong> Output maps to required import headers.</li>
      </ul>

      <h3 className="text-2xl font-bold text-[#F8FAFC]">Backend Guardrail (Pandas)</h3>
      <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#020617] p-4 text-sm text-[#E2E8F0]">
        <code>{`import pandas as pd


def enforce_string_types(df):
    """
    Prevent pandas from stripping leading zeros or converting
    alphanumeric SKUs into dates/floats.
    """
    df['sku'] = df['sku'].astype(str)
    df['batch_number'] = df['batch_number'].astype(str)
    return df`}</code>
      </pre>
    </section>
  );
}

function MappingMessPost() {
  return (
    <section className="space-y-4 text-[15px] leading-7 text-[#CBD5E1]">
      <h3 className="text-2xl font-bold text-[#F8FAFC]">The Friday CSV firefight</h3>
      <p>
        Every Friday afternoon, someone on the finance team is manually fixing CSV exports before posting to ERP. The immediate pain is obvious: rows that do not import, dates that break validation, and SKU columns that have silently changed shape. The hidden cost is larger. Each &quot;quick fix&quot; increases reconciliation drag across <strong>Manufacturing financial operations</strong>, introduces avoidable controls risk, and delays close activity.
      </p>
      <p>
        In the <strong>West Midlands industrial sector</strong> and across <strong>UK Manufacturing hubs</strong>, this is not a niche edge case. Supplier invoices routinely include long alphanumeric product codes, mixed VAT structures, and line-level descriptors that generic receipt-first tools were never designed to handle. Teams trying to run <strong>Automated supplier invoice processing UK</strong> workflows end up with semi-automated pipelines that still depend on human cleanup.
      </p>

      <h3 className="text-2xl font-bold text-[#F8FAFC]">The Technical Trap</h3>
      <p>
        A 15-digit SKU such as <code>503847192004561</code> is read as a number, rendered as <code>5.03847E+14</code>, and exported back as rounded data. Date fields fail similarly when DD/MM/YYYY is interpreted in US order.
      </p>

      <h3 className="text-2xl font-bold text-[#F8FAFC]">The TrueFormat Way</h3>
      <p>
        TrueFormat applies zero-guessing rules from extraction to export. IDs remain string-safe, date parsing is explicitly UK-aware, and line-item mappings are resolved against a fixed target schema.
      </p>

      <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#020617] p-4 text-sm text-[#E2E8F0]">
        <code>{`final_df["date"] = pd.to_datetime(
    final_df["date"],
    errors="coerce",
    format="mixed",
    dayfirst=True
).dt.strftime("%Y-%m-%d")`}</code>
      </pre>
    </section>
  );
}

const BLOG_POSTS = [
  {
    id: 'excel-date-bug',
    eyebrow: 'Data Integrity',
    title: 'How to Stop Excel from Changing Part Numbers to Dates in CSVs (Xero & ERP Imports)',
    summary:
      'Excel auto-formatting can silently convert SKUs like MAR-24 or 5E2 into dates and numbers. This post explains the safe manual import path and the deterministic TrueFormat approach to protect invoice imports.',
    component: ExcelDateBugPost,
  },
  {
    id: 'mapping-mess',
    eyebrow: 'Operations Finance',
    title: 'Excel SKU scientific notation fix: The £15,000 "Mapping Mess" harming UK manufacturing margins',
    summary:
      'A deep dive into how generic OCR + spreadsheet cleanup creates recurring ERP import failures, and why deterministic extraction pipelines reduce operational and control risk.',
    component: MappingMessPost,
  },
];

export default function BlogMappingMess({ onCta }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'TrueFormat Blog | Excel-Safe CSV & ERP Imports';

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
        <h1 className="text-3xl font-black leading-tight text-[#F8FAFC] sm:text-4xl">Excel-Safe CSV Imports, ERP-Ready Data</h1>
        <p className="mt-4 max-w-4xl text-sm text-[#94A3B8]">
          Practical guides for finance and operations teams handling supplier invoices, SKU integrity, and deterministic CSV exports.
        </p>
      </header>

      <section className="space-y-4">
        {BLOG_POSTS.map((post) => {
          const PostComponent = post.component;
          return (
            <details
              key={post.id}
              className="rounded-xl border border-white/10 bg-[#0B1120]/55 p-4"
            >
              <summary className="cursor-pointer list-none">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#38BDF8]">{post.eyebrow}</p>
                <h2 className="mt-2 text-xl font-bold leading-snug text-[#F8FAFC]">{post.title}</h2>
                <p className="mt-3 text-sm text-[#94A3B8]">{post.summary}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#7DD3FC]">Expand full post</p>
              </summary>
              <div className="mt-6 border-t border-white/10 pt-5">
                <PostComponent />
              </div>
            </details>
          );
        })}
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

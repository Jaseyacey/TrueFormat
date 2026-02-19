import React, { useMemo, useState } from 'react';

const beforeRows = [
  { sku: '4.56012E+12', invoice_date: '01/02/24', qty: '', amount: '1,2OO.50' },
  { sku: '1234', invoice_date: '02/01/24', qty: '07', amount: '88.1' },
  { sku: '000998', invoice_date: '13/01/24', qty: '1O', amount: '19.995' },
];

const afterRows = [
  { transaction_id: '000000004560120000', date: '2024-02-01', quantity: '0', amount: '1200.50' },
  { transaction_id: '000000000000001234', date: '2024-01-02', quantity: '7', amount: '88.10' },
  { transaction_id: '000000000000000998', date: '2024-01-13', quantity: '10', amount: '20.00' },
];

function normalizeValue(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  if (/^\d+$/.test(raw)) {
    return raw.padStart(12, '0');
  }

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const left = Number(match[1]);
    const right = Number(match[2]);
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    const month = String(Math.min(Math.max(left, 1), 12)).padStart(2, '0');
    const day = String(Math.min(Math.max(right, 1), 31)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return raw;
}

function TrustGrid() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-7 tf-trust-grid">
      <div className="flex flex-col border-l-2 border-[#38BDF8] pl-4 tf-trust-item tf-trust-blue">
        <span className="font-mono text-xl font-bold text-[#38BDF8]">0.00%</span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-[#94A3B8]">Rounding Variance</span>
      </div>
      <div className="flex flex-col border-l-2 border-[#059669] pl-4 tf-trust-item tf-trust-green">
        <span className="font-mono text-xl font-bold text-[#F8FAFC]">100%</span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-[#94A3B8]">String Integrity</span>
      </div>
      <div className="flex flex-col border-l-2 border-[#38BDF8] pl-4 tf-trust-item tf-trust-blue">
        <span className="font-mono text-xl font-bold text-[#38BDF8]">&lt; 2m</span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-[#94A3B8]">Template Runtime</span>
      </div>
      <div className="flex flex-col border-l-2 border-[#059669] pl-4 tf-trust-item tf-trust-green">
        <span className="font-mono text-xl font-bold text-[#F8FAFC]">Audit-Ready</span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-[#94A3B8]">Transformation Logs</span>
      </div>
    </div>
  );
}

function DiffCard({ title, rows, columns, variant }) {
  return (
    <article className={`rounded-2xl border p-5 tf-diff-card ${variant === 'before' ? 'tf-diff-before' : 'tf-diff-after'}`}>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#CBD5E1]">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-white/10 tf-diff-table-wrap">
        <table className="w-full border-collapse text-left text-xs font-mono tf-diff-table">
          <thead>
            <tr className="bg-white/5 text-[#94A3B8]">
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 font-semibold">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="odd:bg-white/[0.02] even:bg-transparent">
                {columns.map((col) => (
                  <td key={col} className="border-t border-white/10 px-3 py-2 text-[#F8FAFC]">
                    {row[col] || <span className="text-[#EF4444]">null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function FeatureComparisonTable() {
  const rows = [
    {
      feature: 'Best Used For',
      hubdoc: 'Simple Receipts',
      dext: 'General Bookkeeping',
      trueformat: '50+ Line Supplier Invoices',
    },
    {
      feature: 'Line-Item Extraction',
      hubdoc: 'Manual Entry Required',
      dext: 'Costs Extra Credits',
      trueformat: 'Native & Unlimited',
    },
    {
      feature: 'Alphanumeric SKU Protection',
      hubdoc: 'Fails (Excel Date Corruption)',
      dext: 'Often Drops Leading Zeros',
      trueformat: '100% Deterministic Parsing',
    },
    {
      feature: 'Pre-Export Math Audit',
      hubdoc: 'No',
      dext: 'No',
      trueformat: 'Yes',
    },
  ];

  const competitorCellClass = (value) => {
    if (
      value.includes('Fails') ||
      value.includes('Manual') ||
      value === 'No'
    ) {
      return 'text-danger';
    }
    if (value.includes('Costs Extra') || value.includes('Often Drops')) {
      return 'text-warning';
    }
    return 'text-secondary';
  };

  return (
    <section className="card border border-secondary-subtle shadow bg-dark text-light">
      <div className="card-body p-3 p-md-4">
        <div className="mb-3">
          <h2 className="h4 fw-bold mb-1 text-white">Feature Comparison</h2>
          <p className="text-secondary mb-0">
            Purpose-built extraction for complex supplier invoices.
          </p>
        </div>

        <div className="table-responsive">
          <table className="table table-dark table-sm table-hover align-middle mb-0" style={{ minWidth: '760px' }}>
            <thead>
              <tr>
                <th scope="col" className="fw-bold text-white">Feature</th>
                <th scope="col" className="fw-semibold text-light-emphasis">Hubdoc</th>
                <th scope="col" className="fw-semibold text-light-emphasis">Dext/AutoEntry</th>
                <th scope="col" className="fw-semibold text-success">TrueFormat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature}>
                  <th scope="row" className="fw-bold text-white">{row.feature}</th>
                  <td className={`${competitorCellClass(row.hubdoc)} fw-semibold`}>{row.hubdoc}</td>
                  <td className={`${competitorCellClass(row.dext)} fw-semibold`}>{row.dext}</td>
                  <td className="text-success fw-semibold">{row.trueformat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3">
          <span className="badge text-bg-danger-subtle border border-danger-subtle" style={{ color: '#EF4444' }}>Competitor Limitations</span>
          <span className="badge text-bg-warning-subtle text-warning border border-warning-subtle">Credit/Parsing Risks</span>
          <span className="badge text-bg-success-subtle text-success border border-success-subtle">TrueFormat Strengths</span>
        </div>
      </div>
    </section>
  );
}

export default function MarketingHomePage({ onPrimaryCta }) {
  const [rawInput, setRawInput] = useState('000123');
  const hardened = useMemo(() => normalizeValue(rawInput), [rawInput]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#020617]/90 text-[#F8FAFC] shadow-2xl shadow-black/45 tf-home">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(56,189,248,0.16),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_8%,rgba(5,150,105,0.22),transparent_44%)]" />

      <main className="relative mx-auto max-w-6xl space-y-8 px-4 pb-12 pt-6 sm:px-6 lg:space-y-10 lg:px-10 lg:pt-10 tf-home-main">
        <section className="grid gap-8 rounded-2xl border border-white/10 bg-[#059669]/10 p-5 sm:p-8 lg:grid-cols-12 lg:p-10 tf-hero">
          <div className="lg:col-span-8 tf-hero-main">
            <div className="mb-6 flex flex-wrap items-center gap-4 tf-hero-kicker-row">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-[#38BDF8]/40 bg-[#1f2e4a] shadow-[0_0_28px_rgba(56,189,248,0.2)] tf-hero-logo-badge">
                <img src="/trueformat-logo.svg" alt="TrueFormat logo" className="h-12 w-12 rounded-full tf-logo" />
              </span>
              <p className="flex min-h-12 w-full max-w-full items-center justify-center rounded-full border border-[#38BDF8]/35 bg-[linear-gradient(90deg,rgba(5,150,105,0.35),rgba(5,150,105,0.2))] px-4 py-2 text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8AA0B2] sm:w-auto sm:whitespace-nowrap sm:px-7 sm:text-[13px] sm:tracking-[0.22em] lg:text-[15px] tf-hero-pill">
                Deterministic Data Ingestion
              </p>
            </div>

            <h1 className="text-[2rem] font-black leading-tight tracking-tight text-[#F8FAFC] sm:text-5xl tf-hero-title">
              Digital Locksmith For
              <br />
              Supplier Data Integrity.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#CBD5E1] sm:text-lg tf-hero-copy">
              Format hardening for CSV and PDF ingestion. TrueFormat eliminates rounding loss,
              date ambiguity, and leading-zero corruption before your ERP import.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap tf-hero-actions">
              <button
                onClick={onPrimaryCta}
                className="rounded-lg bg-[#38BDF8] px-6 py-3 text-sm font-bold text-[#020617] transition hover:bg-[#7DD3FC] sm:w-auto tf-btn tf-btn-primary"
              >
                Start Pilot
              </button>
              <button
                onClick={onPrimaryCta}
                className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-[#CBD5E1] transition hover:border-[#38BDF8] hover:text-[#F8FAFC] sm:w-auto tf-btn tf-btn-ghost"
              >
                Request Demo
              </button>
            </div>

            <TrustGrid />
          </div>

          <aside className="lg:col-span-4 tf-hero-side">
            <div className="rounded-2xl border border-white/10 bg-[#27272A]/55 p-6 backdrop-blur-md tf-shame">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Wall Of Shame</h2>
              <div className="mt-4 space-y-3 text-sm text-[#CBD5E1] tf-shame-list">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono tf-shame-item">4.56E+12 → SKU corruption</div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono tf-shame-item">01/02/24 ↔ 02/01/24 ambiguity</div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono tf-shame-item">000123 → 123 leading zero loss</div>
                <div className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 font-mono text-[#EF4444] tf-shame-item tf-shame-danger">15-digit float rounding risk</div>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-5 lg:grid-cols-2 tf-diff-grid">
          <DiffCard
            title="Before: Untrusted Supplier Row"
            rows={beforeRows}
            columns={['sku', 'invoice_date', 'qty', 'amount']}
            variant="before"
          />
          <DiffCard
            title="After: Hardened Deterministic Output"
            rows={afterRows}
            columns={['transaction_id', 'date', 'quantity', 'amount']}
            variant="after"
          />
        </section>

        <FeatureComparisonTable />

        <section className="rounded-2xl border border-white/10 bg-[#27272A]/55 p-6 backdrop-blur-md tf-how">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-[#F8FAFC]">How It Works</h2>
            <p className="mt-2 text-sm text-[#94A3B8]">
              Follow one at-risk field from ingestion to hardened export.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 tf-how-grid">
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5 tf-how-card">
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[#38BDF8]">1. Clean Catch</div>
              <p className="text-sm text-[#CBD5E1]">
                We ingest CSV, PDF, and Excel files and freeze values as raw strings before spreadsheet auto-formatting can alter them.
              </p>
              <p className="mt-3 text-xs text-[#94A3B8]">
                PM View: ingestion layer with `openpyxl` and custom PDF parsing.
              </p>
              <div className="mt-3 rounded-md border border-[#059669]/35 bg-[#059669]/10 px-3 py-2 text-xs font-mono text-[#38BDF8]">
                Key fix: stops `000456` becoming `456`.
              </div>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5 tf-how-card">
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[#38BDF8]">2. Smart Matching</div>
              <p className="text-sm text-[#CBD5E1]">
                The mapper aligns supplier headers with your schema, then you finalize the exact mapping as the deterministic pilot.
              </p>
              <p className="mt-3 text-xs text-[#94A3B8]">
                PM View: semantic LLM-assisted mapping with user-controlled finalization.
              </p>
              <div className="mt-3 rounded-md border border-[#059669]/35 bg-[#059669]/10 px-3 py-2 text-xs font-mono text-[#38BDF8]">
                Key fix: eliminates header mismatch mapping mess.
              </div>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5 tf-how-card">
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[#38BDF8]">3. Format Hardening</div>
              <p className="text-sm text-[#CBD5E1]">
                We lock date, currency, and ID formats so imports pass immediately without scientific notation drift or date flipping.
              </p>
              <p className="mt-3 text-xs text-[#94A3B8]">
                PM View: ISO 8601 enforcement and integer-safe serialization.
              </p>
              <div className="mt-3 rounded-md border border-[#059669]/35 bg-[#059669]/10 px-3 py-2 text-xs font-mono text-[#38BDF8]">
                Key fix: prevents `4.56E+12` and `01/02` vs `02/01` errors.
              </div>
            </article>
          </div>

          <div className="mt-5 rounded-lg border border-[#38BDF8]/25 bg-[#38BDF8]/10 px-4 py-3 text-sm text-[#CBD5E1]">
            Edge case handled: silent corruption is blocked at ingestion by freezing raw values before transformation.
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#27272A]/55 p-6 backdrop-blur-md tf-playground">
          <div className="grid gap-6 lg:grid-cols-2 tf-playground-grid">
            <div className="tf-playground-card">
              <h2 className="text-xl font-semibold text-[#F8FAFC]">Hardening Playground</h2>
              <p className="mt-2 text-sm text-[#94A3B8]">Paste a raw value and see deterministic normalization.</p>
              <input
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Try: 000123 or 01/02/24"
                className="mt-4 w-full rounded-lg border border-white/15 bg-[#020617] px-3 py-2 font-mono text-sm text-[#F8FAFC] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/30 tf-playground-input"
              />
              <div className="mt-4 rounded-lg border border-[#38BDF8]/35 bg-[#38BDF8]/10 p-4 tf-playground-output">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#94A3B8]">Hardened Output</p>
                <p className="mt-1 font-mono text-base text-[#38BDF8]">{hardened || '—'}</p>
              </div>
            </div>

            <div className="tf-playground-card">
              <h2 className="text-xl font-semibold text-[#F8FAFC]">Developer Docs Preview</h2>
              <p className="mt-2 text-sm text-[#94A3B8]">Deterministic endpoint with mapping and export traceability.</p>
              <pre className="mt-4 overflow-x-auto rounded-lg border border-white/10 bg-[#020617] p-4 text-xs text-[#CBD5E1] tf-docs-pre">
{`POST /v1/ingest\n{
  "supplier": "acme_wholesale",
  "file_type": "csv",
  "mapping_template": "std-v3",
  "hardening": {
    "preserve_leading_zeros": true,
    "force_numeric_as_string": ["transaction_id", "sku"]
  }
}`}
              </pre>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#27272A]/55 p-6 backdrop-blur-md tf-integrations">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Integrations & Compliance</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5 tf-integrations-grid">
            {['NetSuite', 'Xero', 'SAP', 'Sage', 'Microsoft Dynamics'].map((name) => (
              <div key={name} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-sm text-[#CBD5E1] tf-integration-pill">
                {name}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 tf-badge-row">
            <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-xs text-[#94A3B8] tf-badge">SOC 2 (In Progress)</span>
            <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-xs text-[#94A3B8] tf-badge">GDPR Controls</span>
            <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-xs text-[#94A3B8] tf-badge">Audit-Ready Logs</span>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#27272A]/55 px-6 py-6 text-center text-xs text-[#94A3B8] tf-home-footer">
        Deterministic Data Pipeline • Optimized for Production Environments
      </footer>
    </div>
  );
}

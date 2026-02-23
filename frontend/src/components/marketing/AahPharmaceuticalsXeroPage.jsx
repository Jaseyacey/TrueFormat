import { useEffect } from 'react';
import FreeCsvHealthCheck from './FreeCsvHealthCheck.jsx';
import { navigate } from '../../utils/navigation.js';

export default function AahPharmaceuticalsXeroPage() {
  useEffect(() => {
    document.title = 'How to Import AAH Pharmaceuticals Invoices into Xero (Without CSV Errors)';
  }, []);

  return (
    <main className="rounded-3xl border border-white/10 bg-[#020617]/90 px-5 py-8 text-[#F8FAFC] shadow-2xl shadow-black/45 sm:px-8 sm:py-10">
      <article className="mx-auto max-w-4xl">
        <header className="mb-8 border-b border-white/10 pb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#38BDF8]">
            Supplier-to-ERP Playbook
          </p>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">
            Stop Manually Entering AAH Pharmaceuticals Invoices into Xero
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#CBD5E1] sm:text-lg">
            If you run a pharmacy or medical accounting firm, you know the pain of AAH Pharmaceuticals invoices. They
            are massive, multi-page PDFs packed with hundreds of line items, complex VAT splits, and alphanumeric batch
            codes.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold">The Problem: Why Excel Breaks AAH CSV Exports</h2>
          <p className="mb-4 text-[#CBD5E1]">
            When you try to run an AAH invoice through a generic OCR scanner, it spits out a messy CSV. But the moment
            you open that CSV in Microsoft Excel to format it for Xero, Excel silently corrupts the data:
          </p>
          <p className="mb-3 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">SKU Corruption:</strong> Part numbers like MAR-24 are automatically
            converted into dates (March 24th).
          </p>
          <p className="text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Missing Batch Zeros:</strong> Leading zeros on batch codes (e.g., 005E2)
            are deleted because Excel treats them as math equations.
          </p>
          <p className="mt-4 text-[#CBD5E1]">
            When you upload this corrupted file to Xero, the line totals fail to match, and the import is blocked.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold">Test Your AAH Invoice CSV For Free</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <FreeCsvHealthCheck />
          </div>
          <p className="mt-4 text-[#CBD5E1]">
            Drag and drop your messy CSV into our free Health Check tool above. It processes locally in your browser to
            tell you exactly which AAH batch codes or SKUs are corrupted before you try to force them into Xero.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-4 text-2xl font-bold">The Solution: Deterministic Extraction for Medical Accountants</h2>
          <p className="mb-4 text-[#CBD5E1]">To import AAH invoices accurately, you need to bypass Excel entirely.</p>
          <p className="mb-4 text-[#CBD5E1]">
            TrueFormat is a deterministic data engine built specifically for complex supply chain and medical invoices.
          </p>
          <p className="mb-3 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Mathematical Audit:</strong> It mathematically verifies every AAH line
            item (Qty×UnitPrice=Total) before generating the export.
          </p>
          <p className="mb-5 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Strict String Protection:</strong> It locks alphanumeric batch codes so
            they cannot be corrupted.
          </p>
          <p className="mb-5 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Native Xero Mapping:</strong> It outputs a pristine CSV mapped perfectly
            to Xero&apos;s required headers (*ContactName, *InvoiceNumber, *UnitAmount).
          </p>
          <p className="mb-6 text-[#CBD5E1]">Stop fighting with broken medical spreadsheets.</p>

          <button
            type="button"
            className="rounded-lg bg-[#38BDF8] px-6 py-3 text-sm font-bold text-[#020617] transition hover:bg-[#7DD3FC]"
            onClick={() => navigate('/signup')}
          >
            Try TrueFormat for your AP Team today.
          </button>
        </section>
      </article>
    </main>
  );
}

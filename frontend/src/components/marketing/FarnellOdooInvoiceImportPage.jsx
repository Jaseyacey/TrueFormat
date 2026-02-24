import { useEffect } from 'react';
import FreeCsvHealthCheck from './FreeCsvHealthCheck.jsx';
import { navigate } from '../../utils/navigation.js';

export default function FarnellOdooInvoiceImportPage() {
  useEffect(() => {
    document.title = 'How to Import Farnell Invoices into Odoo (Fix CSV & OCR Errors)';
  }, []);

  return (
    <main className="rounded-3xl border border-white/10 bg-[#020617]/90 px-5 py-8 text-[#F8FAFC] shadow-2xl shadow-black/45 sm:px-8 sm:py-10">
      <article className="mx-auto max-w-4xl">
        <header className="mb-8 border-b border-white/10 pb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#38BDF8]">
            Supplier-to-ERP Playbook
          </p>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">Stop Manually Entering Farnell Invoices into Odoo</h1>
          <p className="mt-4 text-base leading-relaxed text-[#CBD5E1] sm:text-lg">
            If your hardware startup or manufacturing firm buys from Farnell, you know their invoices are a data entry
            nightmare. You are dealing with multi-page PDFs, hundreds of micro-components, and highly specific
            Manufacturer Part Numbers (MPNs).
          </p>
        </header>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold">The Problem: Why Odoo OCR and Excel Break Farnell Data</h2>
          <p className="mb-3 text-[#CBD5E1]">
            Trying to push a 50-line Farnell invoice through a generic AI scanner or Excel usually results in a blocked
            Odoo import. Here is why:
          </p>
          <p className="mb-3 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Micro-Pricing Math Failures:</strong> Farnell frequently bills items at
            fractions of a penny (e.g., £0.0034). Standard AI tools and LLMs hallucinate the rounding, meaning your
            line totals never match the invoice header.
          </p>
          <p className="mb-3 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Scientific Notation Corruption:</strong> Farnell part numbers often
            contain &quot;E&quot; (e.g., 12E4). When you export your data to a CSV to clean it up, Excel instantly
            assumes this is a math equation and corrupts the SKU into scientific notation (1.20E+05).
          </p>
          <p className="text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Dropped Leading Zeros:</strong> Component batch codes like 00789 are
            automatically stripped of their zeros by spreadsheet software, breaking your inventory matching in Odoo.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold">Test Your Farnell Invoice CSV For Free</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <FreeCsvHealthCheck />
          </div>
          <p className="mt-4 text-[#CBD5E1]">
            Drag and drop your messy Farnell CSV or PDF into our free Health Check tool above. It processes locally in
            your browser to flag exactly which MPNs Excel has corrupted into scientific notation, and which micro-priced
            lines will cause Odoo to block the import.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-4 text-2xl font-bold">The Solution: Deterministic Extraction for Electronic Components</h2>
          <p className="mb-4 text-[#CBD5E1]">
            You cannot rely on AI to guess micro-cents. TrueFormat is a deterministic data engine built specifically for
            complex electronic supply chains.
          </p>
          <p className="mb-3 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Micro-Math Audit:</strong> TrueFormat mathematically verifies every single
            Farnell line item (Qty×UnitPrice=LineTotal) down to the fraction of a penny against the header total before
            it exports.
          </p>
          <p className="mb-3 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Strict MPN Protection:</strong> It locks alphanumeric part numbers,
            leading zeros, and &quot;E&quot; codes so spreadsheet software cannot corrupt them into scientific notation.
          </p>
          <p className="mb-6 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Native Odoo Mapping:</strong> It outputs a pristine CSV mapped perfectly
            to Odoo&apos;s required AP ingestion headers (product_id, quantity, price_unit).
          </p>
          <p className="mb-6 text-[#CBD5E1]">Stop paying your AP team to fix broken spreadsheets.</p>

          <button
            type="button"
            className="rounded-lg bg-[#38BDF8] px-6 py-3 text-sm font-bold text-[#020617] transition hover:bg-[#7DD3FC]"
            onClick={() => navigate('/signup')}
          >
            Try TrueFormat&apos;s Deterministic Engine today.
          </button>
        </section>
      </article>
    </main>
  );
}

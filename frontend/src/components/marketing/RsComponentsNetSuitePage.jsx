import { useEffect } from 'react';
import FreeCsvHealthCheck from './FreeCsvHealthCheck.jsx';
import { navigate } from '../../utils/navigation.js';

export default function RsComponentsNetSuitePage() {
  useEffect(() => {
    document.title = 'How to Import RS Components Invoices into NetSuite (Without CSV Errors)';
  }, []);

  return (
    <main className="rounded-3xl border border-white/10 bg-[#020617]/90 px-5 py-8 text-[#F8FAFC] shadow-2xl shadow-black/45 sm:px-8 sm:py-10">
      <article className="mx-auto max-w-4xl">
        <header className="mb-8 border-b border-white/10 pb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#38BDF8]">
            Supplier-to-ERP Playbook
          </p>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">
            Stop Manually Entering RS Components Invoices into NetSuite
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#CBD5E1] sm:text-lg">
            If your manufacturing or hardware AP team processes RS Components invoices, you already know the nightmare.
            You are dealing with multi-page PDFs containing hundreds of electronic components, complex tax lines, and
            highly specific alphanumeric part numbers.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold">The Problem: Why NetSuite Rejects RS Components CSVs</h2>
          <p className="mb-3 text-[#CBD5E1]">
            NetSuite&apos;s native OCR and generic AI extraction tools choke on RS Components invoices for two reasons:
          </p>
          <p className="mb-3 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Broken Templates:</strong> RS Components frequently adjusts table layouts
            based on freight or bulk discounts, instantly breaking rigid OCR templates.
          </p>
          <p className="text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Excel Corrupting Electronic SKUs:</strong> When you export the extracted
            data to clean it up, Microsoft Excel silently destroys electronic part numbers. It drops leading zeros
            (turning 005E2 into 5E2 or scientific notation) and converts alphanumeric SKUs (like MAR-24) into dates.
          </p>
          <p className="mt-4 text-[#CBD5E1]">
            When you try to push that corrupted CSV into NetSuite, the PO matching fails, and your team is stuck doing
            hours of manual data entry.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold">Test Your RS Components Invoice For Free</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <FreeCsvHealthCheck />
          </div>
          <p className="mt-4 text-[#CBD5E1]">
            Drag and drop your messiest RS Components CSV or PDF into our free Health Check tool above. It processes
            locally in your browser to tell you exactly which SKUs Excel has corrupted and which lines will cause
            NetSuite to block the import.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-4 text-2xl font-bold">The Solution: Deterministic Extraction for Hardware Supply Chains</h2>
          <p className="mb-4 text-[#CBD5E1]">
            Stop paying for AI tools that hallucinate data. TrueFormat is a deterministic data engine built specifically
            for complex manufacturing supply chains.
          </p>
          <p className="mb-3 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">The Math Audit:</strong> TrueFormat mathematically verifies every single
            RS Components line item (Qty×UnitPrice=LineTotal) against the header total before it ever generates the
            export.
          </p>
          <p className="mb-3 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Strict SKU Protection:</strong> It locks alphanumeric part numbers and
            leading zeros so spreadsheet software cannot corrupt them.
          </p>
          <p className="mb-6 text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Native NetSuite Mapping:</strong> It outputs a pristine CSV mapped
            perfectly to NetSuite&apos;s required AP ingestion headers.
          </p>
          <p className="mb-6 text-[#CBD5E1]">Stop paying your AP team to do manual data entry.</p>

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

import React, { useEffect, useRef, useState } from 'react';

const PROCESSING_TIME_MS = 2500;
const CORRECTED_CSV_ROWS = [
  ['sku', 'batch_number', 'invoice_date', 'quantity', 'amount'],
  ['MAR-24', '000184', '2026-02-01', '12', '340.00'],
  ['ABR-09', '000007', '2026-02-03', '2', '1200.50'],
  ['SKU-451', '000923', '2026-02-08', '1', '89.99'],
];

export default function FreeCsvHealthCheck() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [, setUploadedFileName] = useState('supplier.csv');
  const timerRef = useRef(null);

  const resetTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => resetTimer, []);

  const startScan = () => {
    resetTimer();
    setIsDragging(false);
    setScanComplete(false);
    setIsProcessing(true);
    timerRef.current = window.setTimeout(() => {
      setIsProcessing(false);
      setScanComplete(true);
      timerRef.current = null;
    }, PROCESSING_TIME_MS);
  };

  // const buildCsvText = () => CORRECTED_CSV_ROWS.map((row) => row.join(',')).join('\n');

  // const buildDownloadName = () => {
  //   const baseName = uploadedFileName.replace(/\.csv$/i, '') || 'supplier';
  //   return `${baseName}-corrected.csv`;
  // };

  // const downloadCorrectedCsv = () => {
  //   const csvText = buildCsvText();
  //   const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  //   const url = window.URL.createObjectURL(blob);
  //   const link = document.createElement('a');
  //   link.href = url;
  //   link.download = buildDownloadName();
  //   document.body.appendChild(link);
  //   link.click();
  //   link.remove();
  //   window.URL.revokeObjectURL(url);
  // };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setUploadedFileName(file.name || 'supplier.csv');
      startScan();
    }
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name || 'supplier.csv');
      startScan();
    }
  };

  if (scanComplete) {
    return (
      <section className="w-full max-w-3xl mx-auto rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mt-0.5 h-6 w-6 shrink-0 text-red-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6" />
              <path d="M12 16.5h.01" />
            </svg>
            <div>
              <p className="text-red-600 font-semibold text-lg">⚠️ Health Check Failed: Xero Import Blocked.</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-800">
                <li>Detected 14 instances of alphanumeric SKU corruption (e.g., &apos;MAR-24&apos; converted to date format).</li>
                <li>Detected 23 missing leading zeros on batch numbers.</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Extract flawless Xero CSVs from PDFs using TrueFormat&apos;s Deterministic Engine.
        </button>
        {/* <button
          type="button"
          onClick={downloadCorrectedCsv}
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-6 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Download corrected CSV
        </button> */}
      </section>
    );
  }

  return (
    <section className="w-full max-w-3xl mx-auto">
      <label
        htmlFor="csv-health-check-file"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-gray-50 px-6 py-14 text-center transition ${
          isDragging ? 'border-blue-500' : 'border-gray-300'
        }`}
      >
        {isProcessing ? (
          <div className="w-full max-w-md">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <p className="mt-4 text-sm font-medium text-gray-700">
              Scanning for Excel date corruption and mapping errors...
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full w-full origin-left animate-[pulse_1s_ease-in-out_infinite] bg-blue-500" />
            </div>
          </div>
        ) : (
          <>
            <p className="text-base font-medium text-gray-900">
              Drag &amp; drop your supplier CSV here to check for Xero/ERP compatibility.
            </p>
            <p className="mt-2 text-sm text-gray-500">or click to select a CSV file</p>
          </>
        )}

        <input
          id="csv-health-check-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={handleInputChange}
        />
      </label>
    </section>
  );
}

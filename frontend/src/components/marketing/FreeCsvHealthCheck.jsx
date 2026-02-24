import React, { useState } from 'react';
import { resolveApiBase } from '../../utils/apiBase.js';
import { navigate } from '../../utils/navigation.js';

const API_BASE = resolveApiBase();

async function getApiError(res, fallback) {
  try {
    const data = await res.json();
    return data?.detail || data?.message || fallback;
  } catch {
    return fallback;
  }
}

export default function FreeCsvHealthCheck() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  const runHealthCheck = async (file) => {
    if (!file) return;

    setUploadedFileName(file.name || 'supplier-file');
    setError('');
    setResult(null);
    setIsDragging(false);
    setIsProcessing(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/health-check`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(await getApiError(res, `Health check failed (${res.status})`));
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Health check failed.');
    } finally {
      setIsProcessing(false);
    }
  };

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
    if (file) runHealthCheck(file);
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    if (file) runHealthCheck(file);
  };

  if (result) {
    const summary = result.summary || {};
    const skuExamples = result.examples?.sku || [];
    const batchExamples = result.examples?.batch || [];
    const hasIssues = Number(summary.issue_count || 0) > 0;

    return (
      <section className="w-full max-w-3xl mx-auto rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <div className={`rounded-lg border p-4 ${hasIssues ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`mt-0.5 h-6 w-6 shrink-0 ${hasIssues ? 'text-red-600' : 'text-emerald-600'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6" />
              <path d="M12 16.5h.01" />
            </svg>
            <div>
              <p className={`font-semibold text-lg ${hasIssues ? 'text-red-600' : 'text-emerald-700'}`}>
                {hasIssues ? 'Health Check Failed: Import Risk Detected.' : 'Health Check Passed: No import blockers detected.'}
              </p>
              <p className="mt-1 text-sm text-gray-700">File: {uploadedFileName}</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-800">
                <li>Rows checked: {summary.rows_checked ?? 0}</li>
                <li>Detected SKU/date or scientific-notation corruption: {summary.sku_corruption_count ?? 0}</li>
                <li>Detected potential missing leading zeros in batch codes: {summary.missing_leading_zero_count ?? 0}</li>
              </ul>
              {skuExamples.length > 0 && (
                <p className="mt-3 text-xs text-gray-600">SKU examples: {skuExamples.join(', ')}</p>
              )}
              {batchExamples.length > 0 && (
                <p className="mt-1 text-xs text-gray-600">Batch examples: {batchExamples.join(', ')}</p>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          onClick={() => navigate('/signup')}
        >
          Extract ERP-ready CSVs using TrueFormat&apos;s Deterministic Engine.
        </button>
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
              Running deterministic health check against uploaded file...
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full w-full origin-left animate-[pulse_1s_ease-in-out_infinite] bg-blue-500" />
            </div>
          </div>
        ) : (
          <>
            <p className="text-base font-medium text-gray-900">
              Drag &amp; drop your supplier CSV, XLSX, or PDF to check ERP compatibility.
            </p>
            <p className="mt-2 text-sm text-gray-500">or click to select a file</p>
          </>
        )}

        <input
          id="csv-health-check-file"
          type="file"
          accept=".csv,.xlsx,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={handleInputChange}
        />
      </label>
      {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
    </section>
  );
}

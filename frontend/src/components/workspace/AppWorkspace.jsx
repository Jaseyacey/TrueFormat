import { useMemo, useState } from 'react';
import ColumnMapper from '../../ColumnMapper.jsx';
import { supabase } from '../../supabaseClient.js';

const API_BASE = (import.meta.env.VITE_API_BASE
  || (import.meta.env.PROD ? 'https://trueformat.onrender.com' : 'http://127.0.0.1:8000')
).replace(/\/+$/, '');

const TARGET_SCHEMA = ['transaction_id', 'date', 'description', 'quantity', 'amount', 'line_total', 'customer_name'];

async function getApiError(res, fallback) {
  try {
    const data = await res.json();
    return data?.detail || data?.message || fallback;
  } catch {
    return fallback;
  }
}

function NullPills({ nullCount }) {
  const items = Object.entries(nullCount);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map(([col, count]) => {
        const clean = Number(count) === 0;
        return (
          <span
            key={col}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              clean
                ? 'border-[#38BDF8]/40 bg-[#38BDF8]/16 text-[#38BDF8]'
                : 'border-amber-200/30 bg-amber-400/10 text-amber-200'
            }`}
          >
            <span className="font-mono">{col}</span>
            <span>{count}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function AppWorkspace({ token, onUnauthorized }) {
  const [file, setFile] = useState(null);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [sourceColumns, setSourceColumns] = useState([]);
  const [suggestedMapping, setSuggestedMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [nullCount, setNullCount] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [finalMapping, setFinalMapping] = useState(null);
  const [rowCount, setRowCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const handleUnauthorized = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Fall through; caller still handles navigation.
      }
    }
    if (onUnauthorized) onUnauthorized();
  };

  const handleFilePick = (nextFile) => {
    if (!nextFile) return;
    setError('');
    setFile(nextFile);
  };

  const handlePdfDrop = (event) => {
    event.preventDefault();
    setIsDraggingPdf(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) return;
    const isPdf = droppedFile.type === 'application/pdf' || droppedFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setError('Drag-and-drop accepts PDF files only. Use Choose File for CSV/XLSX.');
      return;
    }
    handleFilePick(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose or drop a file first.');
      return;
    }
    setError('');
    setIsUploading(true);
    setStatus('Deterministic scan in progress...');

    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', headers: authHeader, body: formData });
      if (res.status === 401) {
        await handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(await getApiError(res, `Upload failed (${res.status})`));
      const data = await res.json();
      setSourceColumns(data.sourceColumns || []);
      setSuggestedMapping(data.suggestedMapping || {});
      setStatus('Columns loaded. Confirm the mapping below.');
    } catch (e) {
      setError(e.message || 'Failed to upload file.');
      setStatus('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFinalize = async (finalMap) => {
    if (!file) {
      setError('No file loaded.');
      return;
    }
    setError('');
    setStatus('Transforming data...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(finalMap));
    try {
      const res = await fetch(`${API_BASE}/transform`, { method: 'POST', headers: authHeader, body: formData });
      if (res.status === 401) {
        await handleUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || `Transform failed (${res.status})`);
      setPreview(data.preview || []);
      setNullCount(data.null_count || {});
      setRowCount(data.row_count || 0);
      setFinalMapping(finalMap);
      setStatus('Transform complete. Review the preview below.');
    } catch (e) {
      setError(e.message || 'Failed to transform data.');
      setStatus('');
    }
  };

  const handleDownload = async () => {
    if (!file || !finalMapping) {
      setError('No data to export.');
      return;
    }
    setStatus('Exporting CSV...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(finalMapping));
    try {
      const res = await fetch(`${API_BASE}/export-csv`, { method: 'POST', headers: authHeader, body: formData });
      if (res.status === 401) {
        await handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(await getApiError(res, `Export failed (${res.status})`));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'trueformat-export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setStatus('CSV exported successfully.');
    } catch (e) {
      setError(e.message || 'Failed to export CSV.');
      setStatus('');
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#27272A]/55 p-6 backdrop-blur-md">
      <div className="mb-4 flex items-center gap-3">
        <img src="/trueformat-logo.svg" alt="TrueFormat logo" className="h-11 w-11 rounded-full bg-white/5 p-1" />
        <h1 className="text-2xl font-black text-[#F8FAFC] sm:text-3xl">TrueFormat Secure Data Extraction</h1>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div
          className={`relative min-w-[260px] rounded-xl border p-4 transition ${
            isDraggingPdf
              ? 'border-[#38BDF8]/60 bg-[#059669]/26 shadow-[0_0_0_1px_rgba(56,189,248,0.2),0_0_26px_rgba(56,189,248,0.14)]'
              : 'border-white/10 bg-[#059669]/14'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingPdf(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDraggingPdf(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDraggingPdf(false);
          }}
          onDrop={handlePdfDrop}
        >
          {isUploading && (
            <div className="pointer-events-none absolute inset-x-3 top-2 h-[2px] overflow-hidden rounded bg-[#38BDF8]/25">
              <div className="scan-line h-full w-1/3 bg-[#38BDF8]" />
            </div>
          )}
          <p className="font-semibold text-[#38BDF8]">Drag and drop a PDF here</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Or use Choose File for CSV, XLSX, or PDF</p>
        </div>

        <input
          className="max-w-full rounded-lg border border-white/15 bg-[#27272A]/65 px-3 py-2 text-sm text-[#F8FAFC]"
          type="file"
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf"
          onChange={(e) => handleFilePick(e.target.files?.[0] || null)}
        />

        <button
          type="button"
          className="rounded-lg bg-[#38BDF8] px-4 py-2 text-sm font-semibold text-[#020617] transition hover:bg-[#475569]"
          onClick={handleUpload}
        >
          Upload & Auto-map
        </button>
      </div>

      {file && <p className="text-sm text-[#94A3B8]">Selected file: {file.name}</p>}
      {status && <p className="mt-2 text-sm font-semibold text-[#94A3B8]">{status}</p>}
      {error && <p className="mt-2 text-sm font-semibold text-[#EF4444]">{error}</p>}

      {sourceColumns.length > 0 && (
        <ColumnMapper
          sourceColumns={sourceColumns}
          targetFields={TARGET_SCHEMA}
          suggestedMapping={suggestedMapping}
          onFinalize={handleFinalize}
        />
      )}

      {preview.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 text-xl font-semibold text-[#F8FAFC]">Preview ({rowCount || preview.length} rows)</h2>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#059669]/24 text-[#38BDF8]">
                  {Object.keys(preview[0]).map((col) => (
                    <th key={col} className="px-3 py-3 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="odd:bg-[#059669]/10 even:bg-[#020617]/20 hover:bg-[#059669]/18">
                    {Object.keys(row).map((col) => {
                      const raw = row[col] === null ? '' : String(row[col]);
                      const txCell = col === 'transaction_id';
                      return (
                        <td
                          key={col}
                          className={`border-t border-white/10 px-3 py-2 font-mono text-xs ${
                            txCell ? 'text-[#38BDF8]' : 'text-[#38BDF8]'
                          }`}
                        >
                          {txCell ? <span className="rounded bg-[#059669]/25 px-1.5 py-0.5">{raw}</span> : raw}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-4 text-lg font-semibold text-[#F8FAFC]">Null counts</h3>
          <NullPills nullCount={nullCount} />

          <button
            type="button"
            className="mt-5 rounded-lg bg-[#38BDF8] px-4 py-2 text-sm font-semibold text-[#020617] transition hover:bg-[#475569]"
            onClick={handleDownload}
          >
            Download CSV
          </button>
        </section>
      )}
    </section>
  );
}

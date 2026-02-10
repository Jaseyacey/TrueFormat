import React, { useState } from 'react';
import ColumnMapper from './ColumnMapper.jsx';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [sourceColumns, setSourceColumns] = useState([]);
  const [targetFields, setTargetFields] = useState([]);
  const [suggestedMapping, setSuggestedMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [nullCount, setNullCount] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [finalMapping, setFinalMapping] = useState(null);
  const [rowCount, setRowCount] = useState(0);

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose a file first.');
      return;
    }
    setError('');
    setStatus('Uploading and analyzing columns...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://127.0.0.1:8000/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }
      const data = await res.json();
      setSourceColumns(data.sourceColumns || []);
      setTargetFields(data.targetFields || []);
      setSuggestedMapping(data.suggestedMapping || {});
      setStatus('Columns loaded. Confirm the mapping below.');
    } catch (e) {
      setError(e.message || 'Failed to upload file.');
      setStatus('');
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
      const res = await fetch('http://127.0.0.1:8000/transform', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Transform failed with status ${res.status}`);
      }
      const data = await res.json();
      if (data.status !== 'success') {
        throw new Error(data.message || 'Transform returned an error.');
      }
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

  const TARGET_SCHEMA = ['transaction_id', 'date', 'description', 'quantity', 'amount', 'line_total', 'customer_name'];

  return (
    <main className="app-shell">
      <h1 className="app-title">
        TrueFormat – Sales Import
      </h1>

      <div className="upload-row">
        <input
          className="file-input"
          type="file"
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button className="btn btn-primary" onClick={handleUpload}>
          Upload & Auto-map
        </button>
      </div>

      {status && <p className="status-text">{status}</p>}
      {error && <p className="error-text">{error}</p>}

      {sourceColumns.length > 0 && (
        <ColumnMapper
          sourceColumns={sourceColumns}
          targetFields={TARGET_SCHEMA}
          suggestedMapping={suggestedMapping}
          onFinalize={handleFinalize}
        />
      )}

      {preview.length > 0 && (
        <section className="preview-section">
          <h2 className="section-title">
            Preview ({rowCount || preview.length} rows)
          </h2>
          <div className="table-wrap">
            <table className="preview-table">
            <thead>
              <tr>
                {Object.keys(preview[0]).map((col) => (
                  <th key={col}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, idx) => (
                <tr key={idx}>
                  {Object.keys(row).map((col) => (
                    <td key={col}>
                      {row[col] === null ? '' : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          <h3 className="section-title">Null counts</h3>
          <ul className="null-list">
            {Object.entries(nullCount).map(([col, count]) => (
              <li key={col}>
                <strong>{col}</strong>: {count}
              </li>
            ))}
          </ul>

          <button
            className="btn btn-success"
            onClick={async () => {
              if (!file || !finalMapping) {
                setError('No data to export.');
                return;
              }
              setStatus('Exporting CSV...');
              try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('mapping', JSON.stringify(finalMapping));

                const res = await fetch('http://127.0.0.1:8000/export-csv', {
                  method: 'POST',
                  body: formData,
                });

                if (!res.ok) {
                  throw new Error(`Export failed with status ${res.status}`);
                }

                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'transformed_data.csv';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                setStatus('CSV exported successfully!');
              } catch (e) {
                setError(e.message || 'Failed to export CSV.');
                setStatus('');
              }
            }}
          >
            Download CSV
          </button>
        </section>
      )}
    </main>
  );
}

export default App;

import React, { useMemo, useState } from 'react';

const selectClass =
  'w-full rounded-lg border border-white/15 bg-[#27272A]/70 px-3 py-2 text-sm font-mono text-[#F8FAFC] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/30';

function MappingHeader({ fieldName, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#059669]/10 p-4 transition hover:bg-[#059669]/18">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#94A3B8]">System Field</span>
          <span className="text-sm font-mono text-[#38BDF8]">{fieldName}</span>
        </div>
        <div className="w-full md:w-[68%]">{children}</div>
      </div>
    </div>
  );
}

const ColumnMapper = ({ sourceColumns, targetFields, suggestedMapping = {}, onFinalize }) => {
  const [map, setMap] = useState(suggestedMapping);
  const [customInputs, setCustomInputs] = useState({});

  const mappingCoverage = useMemo(() => {
    const mapped = targetFields.filter((field) => map[field]).length;
    return { mapped, total: targetFields.length };
  }, [map, targetFields]);

  const handleChange = (field, value) => {
    if (value === '__CUSTOM__') {
      setCustomInputs((prev) => ({ ...prev, [field]: true }));
      return;
    }
    setCustomInputs((prev) => ({ ...prev, [field]: false }));
    setMap((prev) => ({ ...prev, [field]: value }));
  };

  const handleCustomInput = (field, value) => {
    setMap((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#27272A]/50 p-6 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-xl font-semibold text-[#F8FAFC]">Confirm Column Mapping</h3>
        <p className="text-xs uppercase tracking-[0.16em] text-[#94A3B8]">
          {mappingCoverage.mapped}/{mappingCoverage.total} mapped
        </p>
      </div>

      <div className="space-y-3">
        {targetFields.map((field) => (
          <MappingHeader key={field} fieldName={field}>
            <div className="flex flex-wrap items-center gap-2">
              {customInputs[field] ? (
                <>
                  <input
                    type="text"
                    className={selectClass}
                    placeholder="Enter source column name"
                    value={map[field] || ''}
                    onChange={(e) => handleCustomInput(field, e.target.value)}
                    onBlur={() => {
                      if (!map[field]) {
                        setCustomInputs((prev) => ({ ...prev, [field]: false }));
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8] transition hover:border-[#38BDF8] hover:text-[#38BDF8]"
                    onClick={() => {
                      setCustomInputs((prev) => ({ ...prev, [field]: false }));
                      setMap((prev) => {
                        const next = { ...prev };
                        delete next[field];
                        return next;
                      });
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <select
                  className={selectClass}
                  value={map[field] || ''}
                  onChange={(e) => handleChange(field, e.target.value)}
                >
                  <option value="">Select Source Column...</option>
                  {sourceColumns.map((col) => {
                    let displayName = col;
                    if (col === '_extracted_customer_name') displayName = 'Customer Name (from PDF)';
                    if (col === '_extracted_invoice_date') displayName = 'Invoice Date (from PDF)';
                    return (
                      <option key={col} value={col}>
                        {displayName}
                      </option>
                    );
                  })}
                  <option value="__CUSTOM__">--- Enter custom column name ---</option>
                </select>
              )}
            </div>
          </MappingHeader>
        ))}
      </div>

      <button
        type="button"
        className="mt-6 rounded-lg bg-[#38BDF8] px-5 py-2.5 text-sm font-bold text-[#020617] transition hover:bg-[#475569]"
        onClick={() => onFinalize?.(map)}
      >
        Finalize Import
      </button>
    </section>
  );
};

export default ColumnMapper;

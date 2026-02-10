import React, { useState } from 'react';

const ColumnMapper = ({ sourceColumns, targetFields, suggestedMapping = {}, onFinalize }) => {
  const [map, setMap] = useState(suggestedMapping);
  const [customInputs, setCustomInputs] = useState({});

  const handleChange = (field, value) => {
    if (value === '__CUSTOM__') {
      // Show custom input
      setCustomInputs((prev) => ({ ...prev, [field]: true }));
    } else {
      // Hide custom input and set the value
      setCustomInputs((prev) => ({ ...prev, [field]: false }));
      setMap((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleCustomInput = (field, value) => {
    setMap((prev) => ({ ...prev, [field]: value }));
  };

  const handleFinalize = () => {
    if (onFinalize) {
      onFinalize(map);
    }
  };

  return (
    <section className="mapper-card">
      <h3 className="section-title">Confirm Column Mapping</h3>
      {targetFields.map((field) => (
        <div key={field} className="mapper-row">
          <label className="mapper-label">{field}</label>
          <div className="mapper-input-wrap">
            {customInputs[field] ? (
              <>
                <input
                  type="text"
                  className="mapper-input"
                  placeholder="Enter column name..."
                  value={map[field] || ''}
                  onChange={(e) => handleCustomInput(field, e.target.value)}
                  onBlur={() => {
                    if (!map[field]) {
                      setCustomInputs((prev) => ({ ...prev, [field]: false }));
                    }
                  }}
                />
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setCustomInputs((prev) => ({ ...prev, [field]: false }));
                    setMap((prev) => {
                      const newMap = { ...prev };
                      delete newMap[field];
                      return newMap;
                    });
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <select
                className="mapper-input"
                value={map[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
              >
                <option value="">Select Source Column...</option>
                {sourceColumns.map((col) => {
                  // Display friendly names for extracted columns
                  let displayName = col;
                  if (col === '_extracted_customer_name') {
                    displayName = 'Customer Name (from PDF)';
                  } else if (col === '_extracted_invoice_date') {
                    displayName = 'Invoice Date (from PDF)';
                  }
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
        </div>
      ))}
      <button className="btn btn-dark" onClick={handleFinalize}>
        Finalize Import
      </button>
    </section>
  );
};

export default ColumnMapper;

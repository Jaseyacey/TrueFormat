// frontend/Mapper.js
import React, { useState } from 'react';

const ColumnMapper = ({ sourceColumns, targetFields }) => {
  const [map, setMap] = useState({});

  return (
    <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
      <h3 className="text-lg font-bold mb-4">Confirm Column Mapping</h3>
      {targetFields.map(field => (
        <div key={field} className="flex items-center justify-between mb-2 p-3 bg-white shadow-sm rounded">
          <span className="font-mono text-blue-600">{field}</span>
          <select 
            className="border p-1 rounded"
            onChange={(e) => setMap({...map, [field]: e.target.value})}
          >
            <option>Select Source Column...</option>
            {sourceColumns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
      ))}
      <button className="mt-4 bg-black text-white px-4 py-2 rounded hover:bg-gray-800">
        Finalize Import
      </button>
    </div>
  );
};
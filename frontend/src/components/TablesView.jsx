/**
 * Tables View Component
 * Displays all crawled data tables and their contents
 */
import React, { useState } from 'react';
import { getTables, getTableData } from '../services/api';
import usePolling from '../hooks/usePolling';

function TablesView() {
  const { data: tables, loading, error, refetch } = usePolling(getTables, 10000);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  const handleViewData = async (tableName) => {
    setSelectedTable(tableName);
    setLoadingData(true);
    try {
      const data = await getTableData(tableName);
      setTableData(data);
    } catch (error) {
      alert('Failed to load table data: ' + error.message);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading && !tables) {
    return (
      <div className="card">
        <div className="empty-state">
          <span className="spinner"></span>
          <p>Loading tables...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="empty-state">
          <p style={{ color: 'var(--accent-red)' }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!tables || tables.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>No data tables yet. Start a crawl job to create tables!</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🗄️ Data Tables</h3>
          <button className="btn btn-secondary" onClick={refetch}>
            🔄 Refresh
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Table Name</th>
                <th>Columns</th>
                <th>Rows</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.name}>
                  <td>
                    <strong>{table.name}</strong>
                  </td>
                  <td>{table.columns?.length || 0}</td>
                  <td style={{ fontWeight: '600', color: 'var(--accent-blue)' }}>
                    {table.row_count?.toLocaleString() || 0}
                  </td>
                  <td>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleViewData(table.name)}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      👁️ View Data
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTable && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📊 Data: {selectedTable}</h3>
            <button className="btn btn-secondary" onClick={() => setSelectedTable(null)}>
              ✕ Close
            </button>
          </div>

          {loadingData ? (
            <div className="empty-state">
              <span className="spinner"></span>
              <p>Loading data...</p>
            </div>
          ) : tableData ? (
            <>
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                Showing {tableData.data?.length || 0} of {tableData.count || 0} records
              </p>
              <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      {tableData.data?.[0] && Object.keys(tableData.data[0]).map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.data?.map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((val, vidx) => (
                          <td key={vidx} style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>No data available</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default TablesView;

/**
 * cURL Input Component
 * Allows users to input and validate cURL commands
 */
import React, { useState } from 'react';
import { validateCurl, startCrawl } from '../services/api';

function CurlInput({ onJobStarted }) {
  const [curlCommand, setCurlCommand] = useState('');
  const [tableName, setTableName] = useState('');
  const [validating, setValidating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  
  // Interval configuration
  const [startInterval, setStartInterval] = useState(5);
  const [endInterval, setEndInterval] = useState(15);
  const [randomizeInterval, setRandomizeInterval] = useState(true);
  const [maxPages, setMaxPages] = useState('');
  
  // Date range configuration
  const [enableDateRange, setEnableDateRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleValidate = async () => {
    if (!curlCommand.trim()) return;
    
    setValidating(true);
    setValidationResult(null);
    
    try {
      const result = await validateCurl(curlCommand);
      setValidationResult(result);
      
      // Auto-generate table name if not set
      if (!tableName && result.parsed_curl?.url) {
        const url = new URL(result.parsed_curl.url);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const suggestedName = pathParts[pathParts.length - 1] || 'api_data';
        setTableName(suggestedName.replace(/[^a-zA-Z0-9_]/g, '_'));
      }
    } catch (error) {
      setValidationResult({
        is_valid: false,
        error: error.response?.data?.detail || error.message
      });
    } finally {
      setValidating(false);
    }
  };

  const handleStartCrawl = async () => {
    if (!validationResult?.is_valid || !tableName.trim()) return;
    
    setStarting(true);
    
    try {
      const config = {
        curl_command: curlCommand,
        table_name: tableName.trim(),
        start_interval: parseInt(startInterval),
        end_interval: parseInt(endInterval),
        randomize_interval: randomizeInterval,
        max_pages: maxPages ? parseInt(maxPages) : null,
        start_date: enableDateRange && startDate ? new Date(startDate).toISOString() : null,
        end_date: enableDateRange && endDate ? new Date(endDate).toISOString() : null
      };
      
      const result = await startCrawl(config);
      
      // Reset form
      setCurlCommand('');
      setTableName('');
      setValidationResult(null);
      setStartDate('');
      setEndDate('');
      setEnableDateRange(false);
      
      if (onJobStarted) {
        onJobStarted(result);
      }
    } catch (error) {
      alert('Failed to start crawl: ' + (error.response?.data?.detail || error.message));
    } finally {
      setStarting(false);
    }
  };

  // Get current datetime in local format for min attribute
  const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">🔗 New Crawl Job</h3>
      </div>
      
      <div className="form-group">
        <label>cURL Command</label>
        <textarea
          value={curlCommand}
          onChange={(e) => setCurlCommand(e.target.value)}
          placeholder={`curl "https://api.example.com/data?page=1" \\
  -H "Authorization: Bearer your-token" \\
  -H "Accept: application/json"`}
          rows={5}
        />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Table Name</label>
          <input
            type="text"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="my_api_data"
          />
        </div>
        
        <div className="form-group">
          <label>Max Pages (optional)</label>
          <input
            type="number"
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
            placeholder="Unlimited"
            min="1"
          />
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Min Interval (seconds)</label>
          <input
            type="number"
            value={startInterval}
            onChange={(e) => setStartInterval(e.target.value)}
            min="1"
          />
        </div>
        
        <div className="form-group">
          <label>Max Interval (seconds)</label>
          <input
            type="number"
            value={endInterval}
            onChange={(e) => setEndInterval(e.target.value)}
            min="1"
          />
        </div>
        
        <div className="form-group">
          <label>&nbsp;</label>
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="randomize"
              checked={randomizeInterval}
              onChange={(e) => setRandomizeInterval(e.target.checked)}
            />
            <label htmlFor="randomize" style={{ marginBottom: 0, cursor: 'pointer' }}>
              Randomize Interval
            </label>
          </div>
        </div>
      </div>

      {/* Date Range Section */}
      <div className="date-range-section">
        <div className="form-group">
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="enableDateRange"
              checked={enableDateRange}
              onChange={(e) => setEnableDateRange(e.target.checked)}
            />
            <label htmlFor="enableDateRange" style={{ marginBottom: 0, cursor: 'pointer' }}>
              📅 Schedule Crawl with Date Range
            </label>
          </div>
        </div>

        {enableDateRange && (
          <div className="date-range-inputs">
            <div className="form-row">
              <div className="form-group">
                <label>Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={getCurrentDateTime()}
                />
                <small className="form-hint">When to start crawling (leave empty to start immediately)</small>
              </div>
              
              <div className="form-group">
                <label>End Date & Time</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || getCurrentDateTime()}
                />
                <small className="form-hint">When to stop crawling (leave empty for no end date)</small>
              </div>
            </div>

            {startDate && endDate && new Date(startDate) >= new Date(endDate) && (
              <div className="date-warning">
                ⚠️ End date must be after start date
              </div>
            )}

            {(startDate || endDate) && (
              <div className="date-summary">
                <strong>📋 Schedule Summary:</strong>
                <ul>
                  {startDate && (
                    <li>Start: {new Date(startDate).toLocaleString()}</li>
                  )}
                  {!startDate && (
                    <li>Start: Immediately</li>
                  )}
                  {endDate && (
                    <li>End: {new Date(endDate).toLocaleString()}</li>
                  )}
                  {!endDate && (
                    <li>End: No end date (runs until completion or manual stop)</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button 
          className="btn btn-secondary" 
          onClick={handleValidate}
          disabled={validating || !curlCommand.trim()}
        >
          {validating ? <><span className="spinner"></span> Validating...</> : '✓ Validate cURL'}
        </button>
        
        <button 
          className="btn btn-primary" 
          onClick={handleStartCrawl}
          disabled={
            !validationResult?.is_valid || 
            !tableName.trim() || 
            starting ||
            (enableDateRange && startDate && endDate && new Date(startDate) >= new Date(endDate))
          }
        >
          {starting ? <><span className="spinner"></span> Starting...</> : '🚀 Start Crawl'}
        </button>
      </div>
      
      {validationResult && (
        <div className={`validation-result ${validationResult.is_valid ? 'validation-success' : 'validation-error'}`}>
          <h4>
            {validationResult.is_valid ? '✅ Validation Successful' : '❌ Validation Failed'}
          </h4>
          
          {validationResult.error && (
            <p style={{ color: 'var(--accent-red)' }}>{validationResult.error}</p>
          )}
          
          {validationResult.is_valid && (
            <>
              <div className="info-grid">
                <div className="info-item">
                  <div className="label">Method</div>
                  <div className="value" style={{ fontSize: '1rem' }}>{validationResult.parsed_curl?.method}</div>
                </div>
                <div className="info-item">
                  <div className="label">Pagination Type</div>
                  <div className="value" style={{ fontSize: '1rem' }}>{validationResult.detected_pagination?.type || 'none'}</div>
                </div>
                <div className="info-item">
                  <div className="label">Status</div>
                  <div className="value" style={{ fontSize: '1rem', color: 'var(--accent-green)' }}>
                    {validationResult.test_response?.status_code}
                  </div>
                </div>
              </div>
              
              <details>
                <summary style={{ cursor: 'pointer', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                  View Response Sample
                </summary>
                <pre className="json-preview">
                  {JSON.stringify(validationResult.test_response?.data, null, 2)?.substring(0, 1000)}
                  {JSON.stringify(validationResult.test_response?.data, null, 2)?.length > 1000 && '...'}
                </pre>
              </details>
              
              <details>
                <summary style={{ cursor: 'pointer', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                  View Inferred Schema
                </summary>
                <pre className="json-preview">
                  {JSON.stringify(validationResult.inferred_schema, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default CurlInput;

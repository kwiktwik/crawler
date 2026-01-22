/**
 * Request Builder Component
 * Postman-like interface for building API requests
 */
import React, { useState, useEffect } from 'react';
import { validateCurl, startCrawl } from '../services/api';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const AUTH_TYPES = [
  { value: 'none', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'apikey', label: 'API Key' }
];
const BODY_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'form', label: 'Form Data' },
  { value: 'urlencoded', label: 'URL Encoded' }
];

function RequestBuilder({ onJobStarted, initialRequest, onSaveToCollection }) {
  // Request configuration
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [activeTab, setActiveTab] = useState('params');
  
  // Query Parameters
  const [params, setParams] = useState([{ key: '', value: '', enabled: true }]);
  
  // Headers
  const [headers, setHeaders] = useState([
    { key: 'Accept', value: 'application/json', enabled: true },
    { key: '', value: '', enabled: true }
  ]);
  
  // Auth
  const [authType, setAuthType] = useState('none');
  const [authConfig, setAuthConfig] = useState({
    bearerToken: '',
    basicUsername: '',
    basicPassword: '',
    apiKeyName: '',
    apiKeyValue: '',
    apiKeyLocation: 'header' // header or query
  });
  
  // Body
  const [bodyType, setBodyType] = useState('none');
  const [jsonBody, setJsonBody] = useState('{\n  \n}');
  const [formData, setFormData] = useState([{ key: '', value: '', enabled: true }]);
  
  // Crawl Configuration
  const [tableName, setTableName] = useState('');
  const [maxPages, setMaxPages] = useState('');
  const [startInterval, setStartInterval] = useState(5);
  const [endInterval, setEndInterval] = useState(15);
  const [randomizeInterval, setRandomizeInterval] = useState(true);
  const [enableDateRange, setEnableDateRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // State
  const [validating, setValidating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [showCurlPreview, setShowCurlPreview] = useState(false);

  // Load initial request if provided
  useEffect(() => {
    if (initialRequest) {
      setMethod(initialRequest.method || 'GET');
      setUrl(initialRequest.url || '');
      if (initialRequest.headers) {
        setHeaders([...initialRequest.headers, { key: '', value: '', enabled: true }]);
      }
      if (initialRequest.params) {
        setParams([...initialRequest.params, { key: '', value: '', enabled: true }]);
      }
      if (initialRequest.authType) {
        setAuthType(initialRequest.authType);
        setAuthConfig(initialRequest.authConfig || {});
      }
      if (initialRequest.bodyType) {
        setBodyType(initialRequest.bodyType);
        if (initialRequest.jsonBody) setJsonBody(initialRequest.jsonBody);
        if (initialRequest.formData) setFormData(initialRequest.formData);
      }
    }
  }, [initialRequest]);

  // Build full URL with query params
  const buildFullUrl = () => {
    if (!url) return '';
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      params.filter(p => p.enabled && p.key).forEach(p => {
        urlObj.searchParams.set(p.key, p.value);
      });
      return urlObj.toString();
    } catch {
      return url;
    }
  };

  // Build headers object
  const buildHeaders = () => {
    const hdrs = {};
    headers.filter(h => h.enabled && h.key).forEach(h => {
      hdrs[h.key] = h.value;
    });
    
    // Add auth headers
    if (authType === 'bearer' && authConfig.bearerToken) {
      hdrs['Authorization'] = `Bearer ${authConfig.bearerToken}`;
    } else if (authType === 'basic' && authConfig.basicUsername) {
      const credentials = btoa(`${authConfig.basicUsername}:${authConfig.basicPassword}`);
      hdrs['Authorization'] = `Basic ${credentials}`;
    } else if (authType === 'apikey' && authConfig.apiKeyLocation === 'header') {
      hdrs[authConfig.apiKeyName] = authConfig.apiKeyValue;
    }
    
    // Add content type for body
    if (bodyType === 'json') {
      hdrs['Content-Type'] = 'application/json';
    } else if (bodyType === 'form') {
      hdrs['Content-Type'] = 'multipart/form-data';
    } else if (bodyType === 'urlencoded') {
      hdrs['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    
    return hdrs;
  };

  // Build request body
  const buildBody = () => {
    if (bodyType === 'json') {
      return jsonBody;
    } else if (bodyType === 'form' || bodyType === 'urlencoded') {
      const data = {};
      formData.filter(f => f.enabled && f.key).forEach(f => {
        data[f.key] = f.value;
      });
      return bodyType === 'urlencoded' 
        ? new URLSearchParams(data).toString()
        : JSON.stringify(data);
    }
    return null;
  };

  // Generate cURL command
  const generateCurl = () => {
    const fullUrl = buildFullUrl();
    const hdrs = buildHeaders();
    const body = buildBody();
    
    let curl = `curl "${fullUrl}"`;
    
    if (method !== 'GET') {
      curl += ` \\\n  -X ${method}`;
    }
    
    Object.entries(hdrs).forEach(([key, value]) => {
      curl += ` \\\n  -H "${key}: ${value}"`;
    });
    
    if (body && method !== 'GET') {
      curl += ` \\\n  -d '${body}'`;
    }
    
    return curl;
  };

  // Handle key-value pair changes
  const updateKeyValue = (list, setList, index, field, value) => {
    const newList = [...list];
    newList[index][field] = value;
    
    // Auto-add new row if last row has content
    if (index === list.length - 1 && (newList[index].key || newList[index].value)) {
      newList.push({ key: '', value: '', enabled: true });
    }
    
    setList(newList);
  };

  const removeKeyValue = (list, setList, index) => {
    if (list.length > 1) {
      setList(list.filter((_, i) => i !== index));
    }
  };

  const toggleKeyValue = (list, setList, index) => {
    const newList = [...list];
    newList[index].enabled = !newList[index].enabled;
    setList(newList);
  };

  // Validate request
  const handleValidate = async () => {
    const curlCommand = generateCurl();
    if (!url.trim()) return;
    
    setValidating(true);
    setValidationResult(null);
    
    try {
      const result = await validateCurl(curlCommand);
      setValidationResult(result);
      
      // Auto-generate table name
      if (!tableName && result.parsed_curl?.url) {
        try {
          const urlObj = new URL(result.parsed_curl.url);
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          const suggestedName = pathParts[pathParts.length - 1] || 'api_data';
          setTableName(suggestedName.replace(/[^a-zA-Z0-9_]/g, '_'));
        } catch {}
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

  // Start crawl
  const handleStartCrawl = async () => {
    if (!validationResult?.is_valid || !tableName.trim()) return;
    
    setStarting(true);
    
    try {
      const config = {
        curl_command: generateCurl(),
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
      setValidationResult(null);
      
      if (onJobStarted) {
        onJobStarted(result);
      }
    } catch (error) {
      alert('Failed to start crawl: ' + (error.response?.data?.detail || error.message));
    } finally {
      setStarting(false);
    }
  };

  // Save to collection
  const handleSaveToCollection = () => {
    if (onSaveToCollection) {
      onSaveToCollection({
        name: tableName || 'Untitled Request',
        method,
        url,
        params: params.filter(p => p.key),
        headers: headers.filter(h => h.key),
        authType,
        authConfig,
        bodyType,
        jsonBody,
        formData: formData.filter(f => f.key)
      });
    }
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  // Key-Value Row Component
  const KeyValueRow = ({ item, index, list, setList, keyPlaceholder = "Key", valuePlaceholder = "Value" }) => (
    <div className={`kv-row ${!item.enabled ? 'disabled' : ''}`}>
      <button 
        className="kv-toggle"
        onClick={() => toggleKeyValue(list, setList, index)}
        title={item.enabled ? 'Disable' : 'Enable'}
      >
        {item.enabled ? '☑️' : '☐'}
      </button>
      <input
        type="text"
        className="kv-key"
        placeholder={keyPlaceholder}
        value={item.key}
        onChange={(e) => updateKeyValue(list, setList, index, 'key', e.target.value)}
      />
      <input
        type="text"
        className="kv-value"
        placeholder={valuePlaceholder}
        value={item.value}
        onChange={(e) => updateKeyValue(list, setList, index, 'value', e.target.value)}
      />
      <button 
        className="kv-remove"
        onClick={() => removeKeyValue(list, setList, index)}
        title="Remove"
      >
        ✕
      </button>
    </div>
  );

  return (
    <div className="request-builder">
      {/* URL Bar */}
      <div className="url-bar">
        <select 
          className={`method-select method-${method.toLowerCase()}`}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {HTTP_METHODS.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          className="url-input"
          placeholder="Enter request URL (e.g., https://api.example.com/users)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button 
          className="btn btn-primary send-btn"
          onClick={handleValidate}
          disabled={validating || !url.trim()}
        >
          {validating ? <span className="spinner"></span> : '🚀'} Send
        </button>
      </div>

      {/* Tabs */}
      <div className="request-tabs">
        <button 
          className={`request-tab ${activeTab === 'params' ? 'active' : ''}`}
          onClick={() => setActiveTab('params')}
        >
          Params
          {params.filter(p => p.enabled && p.key).length > 0 && (
            <span className="tab-badge">{params.filter(p => p.enabled && p.key).length}</span>
          )}
        </button>
        <button 
          className={`request-tab ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          Headers
          {headers.filter(h => h.enabled && h.key).length > 0 && (
            <span className="tab-badge">{headers.filter(h => h.enabled && h.key).length}</span>
          )}
        </button>
        <button 
          className={`request-tab ${activeTab === 'auth' ? 'active' : ''}`}
          onClick={() => setActiveTab('auth')}
        >
          Auth
          {authType !== 'none' && <span className="tab-badge">●</span>}
        </button>
        <button 
          className={`request-tab ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          Body
          {bodyType !== 'none' && <span className="tab-badge">●</span>}
        </button>
        <button 
          className={`request-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Crawl Settings
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Params Tab */}
        {activeTab === 'params' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h4>Query Parameters</h4>
              <span className="panel-hint">Parameters will be appended to the URL</span>
            </div>
            <div className="kv-list">
              {params.map((param, index) => (
                <KeyValueRow
                  key={index}
                  item={param}
                  index={index}
                  list={params}
                  setList={setParams}
                  keyPlaceholder="Parameter name"
                  valuePlaceholder="Value"
                />
              ))}
            </div>
          </div>
        )}

        {/* Headers Tab */}
        {activeTab === 'headers' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h4>Request Headers</h4>
              <span className="panel-hint">Custom headers to send with the request</span>
            </div>
            <div className="kv-list">
              {headers.map((header, index) => (
                <KeyValueRow
                  key={index}
                  item={header}
                  index={index}
                  list={headers}
                  setList={setHeaders}
                  keyPlaceholder="Header name"
                  valuePlaceholder="Header value"
                />
              ))}
            </div>
          </div>
        )}

        {/* Auth Tab */}
        {activeTab === 'auth' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h4>Authentication</h4>
              <span className="panel-hint">Configure authentication for this request</span>
            </div>
            
            <div className="auth-type-selector">
              {AUTH_TYPES.map(type => (
                <button
                  key={type.value}
                  className={`auth-type-btn ${authType === type.value ? 'active' : ''}`}
                  onClick={() => setAuthType(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div className="auth-config">
              {authType === 'none' && (
                <div className="auth-none">
                  <p>This request does not use any authentication.</p>
                </div>
              )}

              {authType === 'bearer' && (
                <div className="auth-bearer">
                  <label>Token</label>
                  <input
                    type="text"
                    placeholder="Enter your bearer token"
                    value={authConfig.bearerToken}
                    onChange={(e) => setAuthConfig({...authConfig, bearerToken: e.target.value})}
                  />
                  <span className="auth-hint">The token will be sent as: Authorization: Bearer &lt;token&gt;</span>
                </div>
              )}

              {authType === 'basic' && (
                <div className="auth-basic">
                  <div className="auth-row">
                    <div className="auth-field">
                      <label>Username</label>
                      <input
                        type="text"
                        placeholder="Username"
                        value={authConfig.basicUsername}
                        onChange={(e) => setAuthConfig({...authConfig, basicUsername: e.target.value})}
                      />
                    </div>
                    <div className="auth-field">
                      <label>Password</label>
                      <input
                        type="password"
                        placeholder="Password"
                        value={authConfig.basicPassword}
                        onChange={(e) => setAuthConfig({...authConfig, basicPassword: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {authType === 'apikey' && (
                <div className="auth-apikey">
                  <div className="auth-row">
                    <div className="auth-field">
                      <label>Key Name</label>
                      <input
                        type="text"
                        placeholder="e.g., X-API-Key"
                        value={authConfig.apiKeyName}
                        onChange={(e) => setAuthConfig({...authConfig, apiKeyName: e.target.value})}
                      />
                    </div>
                    <div className="auth-field">
                      <label>Key Value</label>
                      <input
                        type="text"
                        placeholder="Your API key"
                        value={authConfig.apiKeyValue}
                        onChange={(e) => setAuthConfig({...authConfig, apiKeyValue: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label>Add to</label>
                    <div className="radio-group">
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="apiKeyLocation"
                          checked={authConfig.apiKeyLocation === 'header'}
                          onChange={() => setAuthConfig({...authConfig, apiKeyLocation: 'header'})}
                        />
                        Header
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="apiKeyLocation"
                          checked={authConfig.apiKeyLocation === 'query'}
                          onChange={() => setAuthConfig({...authConfig, apiKeyLocation: 'query'})}
                        />
                        Query Params
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Body Tab */}
        {activeTab === 'body' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h4>Request Body</h4>
              <span className="panel-hint">Data to send with POST/PUT/PATCH requests</span>
            </div>

            <div className="body-type-selector">
              {BODY_TYPES.map(type => (
                <button
                  key={type.value}
                  className={`body-type-btn ${bodyType === type.value ? 'active' : ''}`}
                  onClick={() => setBodyType(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div className="body-content">
              {bodyType === 'none' && (
                <div className="body-none">
                  <p>This request does not have a body.</p>
                </div>
              )}

              {bodyType === 'json' && (
                <div className="body-json">
                  <textarea
                    className="json-editor"
                    placeholder='{"key": "value"}'
                    value={jsonBody}
                    onChange={(e) => setJsonBody(e.target.value)}
                    rows={10}
                  />
                </div>
              )}

              {(bodyType === 'form' || bodyType === 'urlencoded') && (
                <div className="body-form">
                  <div className="kv-list">
                    {formData.map((field, index) => (
                      <KeyValueRow
                        key={index}
                        item={field}
                        index={index}
                        list={formData}
                        setList={setFormData}
                        keyPlaceholder="Field name"
                        valuePlaceholder="Field value"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Crawl Settings Tab */}
        {activeTab === 'settings' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h4>Crawl Configuration</h4>
              <span className="panel-hint">Configure how the API will be crawled</span>
            </div>

            <div className="settings-grid">
              <div className="setting-group">
                <label>Table Name *</label>
                <input
                  type="text"
                  placeholder="my_api_data"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                />
                <span className="setting-hint">Name for the database table to store results</span>
              </div>

              <div className="setting-group">
                <label>Max Pages</label>
                <input
                  type="number"
                  placeholder="Unlimited"
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  min="1"
                />
                <span className="setting-hint">Maximum pages to crawl (leave empty for unlimited)</span>
              </div>

              <div className="setting-group">
                <label>Min Interval (seconds)</label>
                <input
                  type="number"
                  value={startInterval}
                  onChange={(e) => setStartInterval(e.target.value)}
                  min="1"
                />
              </div>

              <div className="setting-group">
                <label>Max Interval (seconds)</label>
                <input
                  type="number"
                  value={endInterval}
                  onChange={(e) => setEndInterval(e.target.value)}
                  min="1"
                />
              </div>

              <div className="setting-group checkbox-setting">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={randomizeInterval}
                    onChange={(e) => setRandomizeInterval(e.target.checked)}
                  />
                  Randomize interval between requests
                </label>
              </div>

              <div className="setting-group checkbox-setting">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={enableDateRange}
                    onChange={(e) => setEnableDateRange(e.target.checked)}
                  />
                  📅 Schedule with date range
                </label>
              </div>

              {enableDateRange && (
                <>
                  <div className="setting-group">
                    <label>Start Date & Time</label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={getCurrentDateTime()}
                    />
                  </div>

                  <div className="setting-group">
                    <label>End Date & Time</label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || getCurrentDateTime()}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* cURL Preview */}
      <div className="curl-preview-section">
        <button 
          className="curl-preview-toggle"
          onClick={() => setShowCurlPreview(!showCurlPreview)}
        >
          {showCurlPreview ? '▼' : '▶'} cURL Preview
        </button>
        {showCurlPreview && (
          <pre className="curl-preview-code">{generateCurl()}</pre>
        )}
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div className={`validation-result ${validationResult.is_valid ? 'validation-success' : 'validation-error'}`}>
          <h4>
            {validationResult.is_valid ? '✅ Request Successful' : '❌ Request Failed'}
          </h4>
          
          {validationResult.error && (
            <p className="error-text">{validationResult.error}</p>
          )}
          
          {validationResult.is_valid && (
            <>
              <div className="response-info">
                <div className="response-stat">
                  <span className="stat-label">Status</span>
                  <span className="stat-value success">{validationResult.test_response?.status_code}</span>
                </div>
                <div className="response-stat">
                  <span className="stat-label">Pagination</span>
                  <span className="stat-value">{validationResult.detected_pagination?.type || 'none'}</span>
                </div>
                <div className="response-stat">
                  <span className="stat-label">Fields Detected</span>
                  <span className="stat-value">{Object.keys(validationResult.inferred_schema || {}).length}</span>
                </div>
              </div>
              
              <details className="response-details">
                <summary>View Response</summary>
                <pre className="response-preview">
                  {JSON.stringify(validationResult.test_response?.data, null, 2)?.substring(0, 2000)}
                </pre>
              </details>
            </>
          )}
        </div>
      )}

      {/* Crawl Quick Settings - Always visible */}
      {validationResult?.is_valid && (
        <div className="quick-crawl-settings">
          <h4>🕷️ Ready to Crawl</h4>
          <div className="quick-settings-row">
            <div className="quick-setting">
              <label>Table Name *</label>
              <input
                type="text"
                placeholder="my_api_data"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className={!tableName.trim() ? 'input-warning' : ''}
              />
            </div>
            <div className="quick-setting">
              <label>Max Pages</label>
              <input
                type="number"
                placeholder="∞"
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                min="1"
              />
            </div>
            <div className="quick-setting">
              <label>Interval (sec)</label>
              <div className="interval-inputs">
                <input
                  type="number"
                  value={startInterval}
                  onChange={(e) => setStartInterval(e.target.value)}
                  min="1"
                  style={{width: '60px'}}
                />
                <span>-</span>
                <input
                  type="number"
                  value={endInterval}
                  onChange={(e) => setEndInterval(e.target.value)}
                  min="1"
                  style={{width: '60px'}}
                />
              </div>
            </div>
          </div>
          {!tableName.trim() && (
            <p className="settings-hint">⚠️ Enter a table name to start crawling</p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="request-actions">
        <button
          className="btn btn-secondary"
          onClick={handleSaveToCollection}
          disabled={!url.trim()}
        >
          💾 Save to Collection
        </button>
        <button
          className="btn btn-success btn-large"
          onClick={handleStartCrawl}
          disabled={!validationResult?.is_valid || !tableName.trim() || starting}
        >
          {starting ? (
            <><span className="spinner"></span> Starting...</>
          ) : !validationResult?.is_valid ? (
            '🔍 Send Request First'
          ) : !tableName.trim() ? (
            '📝 Enter Table Name'
          ) : (
            '🕷️ Start Crawling'
          )}
        </button>
      </div>
    </div>
  );
}

export default RequestBuilder;

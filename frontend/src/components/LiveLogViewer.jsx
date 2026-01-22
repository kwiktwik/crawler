/**
 * Live Log Viewer Component
 * Displays real-time crawl logs like tail -f
 */
import React, { useState, useEffect, useRef } from 'react';
import { getJobLogs, createLogStream } from '../services/api';

function LiveLogViewer({ jobId, isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('all');
  const logContainerRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Load initial logs and connect to stream
  useEffect(() => {
    if (!jobId || !isOpen) return;

    // Load initial logs
    const loadInitialLogs = async () => {
      try {
        const data = await getJobLogs(jobId, 200);
        setLogs(data.logs || []);
      } catch (error) {
        console.error('Failed to load logs:', error);
      }
    };

    loadInitialLogs();

    // Connect to SSE stream
    const eventSource = createLogStream(jobId);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data);
        if (log.job_id) {
          setLogs(prev => [...prev, log].slice(-500)); // Keep last 500 logs
        }
      } catch (e) {
        // Keepalive or invalid data
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [jobId, isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  // Get log level style
  const getLogLevelClass = (level) => {
    const classes = {
      info: 'log-info',
      success: 'log-success',
      warning: 'log-warning',
      error: 'log-error',
      debug: 'log-debug'
    };
    return classes[level] || 'log-info';
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  // Clear logs
  const handleClear = () => {
    setLogs([]);
  };

  // Copy logs
  const handleCopy = () => {
    const logText = filteredLogs
      .map(log => `[${formatTime(log.created_at)}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(logText);
  };

  if (!isOpen) return null;

  return (
    <div className="log-viewer-overlay" onClick={onClose}>
      <div className="log-viewer-container" onClick={e => e.stopPropagation()}>
        <div className="log-viewer-header">
          <div className="log-viewer-title">
            <span className="terminal-icon">📟</span>
            <h3>Live Crawl Logs</h3>
            <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '● Connected' : '○ Disconnected'}
            </span>
          </div>
          <div className="log-viewer-actions">
            <select 
              className="log-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="debug">Debug</option>
            </select>
            <label className="auto-scroll-toggle">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
            <button className="log-action-btn" onClick={handleCopy} title="Copy logs">
              📋
            </button>
            <button className="log-action-btn" onClick={handleClear} title="Clear logs">
              🗑️
            </button>
            <button className="log-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        
        <div className="log-viewer-body" ref={logContainerRef}>
          {filteredLogs.length === 0 ? (
            <div className="log-empty">
              <div className="log-empty-icon">📭</div>
              <p>No logs yet. Waiting for crawl activity...</p>
            </div>
          ) : (
            <div className="log-entries">
              {filteredLogs.map((log, index) => (
                <div key={log.id || index} className={`log-entry ${getLogLevelClass(log.level)}`}>
                  <span className="log-time">{formatTime(log.created_at)}</span>
                  <span className={`log-level ${log.level}`}>{log.level.toUpperCase()}</span>
                  <span className="log-message">{log.message}</span>
                  {log.details && (
                    <span className="log-details">{JSON.stringify(log.details)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="log-viewer-footer">
          <span className="log-count">{filteredLogs.length} entries</span>
          <span className="log-job-id">Job: {jobId?.substring(0, 8)}...</span>
        </div>
      </div>
    </div>
  );
}

export default LiveLogViewer;

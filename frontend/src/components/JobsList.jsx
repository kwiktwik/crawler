/**
 * Jobs List Component
 * Displays all crawl jobs as cards with full-screen view option
 */
import React, { useState } from 'react';
import { pauseJob, resumeJob, stopJob, getJob } from '../services/api';
import usePolling from '../hooks/usePolling';
import { getJobs } from '../services/api';
import LiveLogViewer from './LiveLogViewer';
import SaveToCollectionModal from './SaveToCollectionModal';

function JobsList({ compact = false, onSaveToCollection }) {
  const { data: jobs, loading, error, refetch } = usePolling(getJobs, 3000);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);
  const [fullJobDetails, setFullJobDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [logViewerJobId, setLogViewerJobId] = useState(null);
  const [saveModalJob, setSaveModalJob] = useState(null);

  // Extract request config from job's curl command for saving to collection
  const extractRequestFromJob = (job) => {
    if (!job?.curl_command) return null;
    
    // Parse the curl command to extract details
    const curlCommand = job.curl_command;
    let method = 'GET';
    let url = '';
    const headers = [];
    
    // Extract method
    const methodMatch = curlCommand.match(/-X\s+(\w+)/);
    if (methodMatch) method = methodMatch[1];
    
    // Extract URL
    const urlMatch = curlCommand.match(/curl\s+"([^"]+)"|curl\s+'([^']+)'|curl\s+(\S+)/);
    if (urlMatch) url = urlMatch[1] || urlMatch[2] || urlMatch[3];
    
    // Extract headers
    const headerMatches = curlCommand.matchAll(/-H\s+"([^"]+)"/g);
    for (const match of headerMatches) {
      const [key, ...valueParts] = match[1].split(':');
      if (key) {
        headers.push({
          key: key.trim(),
          value: valueParts.join(':').trim(),
          enabled: true
        });
      }
    }
    
    return {
      name: job.table_name || 'Saved Request',
      method,
      url,
      headers,
      params: [],
      authType: 'none',
      authConfig: {},
      bodyType: 'none',
      jsonBody: '',
      formData: []
    };
  };

  const handleAction = async (jobId, action, e) => {
    if (e) e.stopPropagation();
    setActionLoading({ ...actionLoading, [jobId]: action });
    try {
      if (action === 'pause') await pauseJob(jobId);
      if (action === 'resume') await resumeJob(jobId);
      if (action === 'stop') await stopJob(jobId);
      refetch();
    } catch (error) {
      alert(`Failed to ${action} job: ${error.response?.data?.detail || error.message}`);
    } finally {
      setActionLoading({ ...actionLoading, [jobId]: null });
    }
  };

  const handleViewFull = async (job) => {
    setSelectedJob(job);
    setLoadingDetails(true);
    try {
      const details = await getJob(job.id);
      setFullJobDetails(details);
    } catch (error) {
      console.error('Failed to load job details:', error);
      setFullJobDetails(job);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseFullView = () => {
    setSelectedJob(null);
    setFullJobDetails(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const getTimeRemaining = (endDateStr) => {
    const endDate = new Date(endDateStr);
    const now = new Date();
    const diff = endDate - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getBadgeClass = (status) => {
    const statusMap = {
      pending: 'badge-pending',
      running: 'badge-running',
      completed: 'badge-completed',
      failed: 'badge-failed',
      paused: 'badge-paused'
    };
    return statusMap[status] || 'badge-pending';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: '⏳',
      running: '🔄',
      completed: '✅',
      failed: '❌',
      paused: '⏸️'
    };
    return icons[status] || '❓';
  };

  if (loading && !jobs) {
    return (
      <div className="card">
        <div className="empty-state">
          <span className="spinner"></span>
          <p>Loading jobs...</p>
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

  if (!jobs || jobs.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>No crawl jobs yet. Create one using the form above!</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Live Log Viewer */}
      <LiveLogViewer 
        jobId={logViewerJobId}
        isOpen={!!logViewerJobId}
        onClose={() => setLogViewerJobId(null)}
      />

      {/* Save to Collection Modal */}
      {saveModalJob && (
        <SaveToCollectionModal
          request={extractRequestFromJob(saveModalJob)}
          onClose={() => setSaveModalJob(null)}
          onSaved={() => setSaveModalJob(null)}
        />
      )}

      {/* Full Screen Modal */}
      {selectedJob && (
        <div className="fullscreen-modal" onClick={handleCloseFullView}>
          <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-header">
              <h2>
                {getStatusIcon(selectedJob.status)} Job Details: {selectedJob.table_name}
              </h2>
              <button className="close-btn" onClick={handleCloseFullView}>✕</button>
            </div>
            
            {loadingDetails ? (
              <div className="empty-state">
                <span className="spinner"></span>
                <p>Loading details...</p>
              </div>
            ) : fullJobDetails ? (
              <div className="fullscreen-body">
                <div className="detail-grid">
                  <div className="detail-section">
                    <h4>📊 Status</h4>
                    <div className="detail-content">
                      <span className={`badge ${getBadgeClass(fullJobDetails.status)}`}>
                        {fullJobDetails.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="detail-section">
                    <h4>📈 Progress</h4>
                    <div className="detail-content">
                      <div className="stat-row">
                        <span className="stat-label">Records:</span>
                        <span className="stat-value">{fullJobDetails.total_records?.toLocaleString() || 0}</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Current Page:</span>
                        <span className="stat-value">{fullJobDetails.current_page || 0}</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Retries:</span>
                        <span className="stat-value">{fullJobDetails.retry_count || 0}/3</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="detail-section">
                    <h4>🔧 Configuration</h4>
                    <div className="detail-content">
                      <div className="stat-row">
                        <span className="stat-label">Pagination:</span>
                        <span className="stat-value">{fullJobDetails.pagination_type}</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Interval:</span>
                        <span className="stat-value">
                          {fullJobDetails.start_interval}s - {fullJobDetails.end_interval}s
                          {fullJobDetails.randomize_interval ? ' (random)' : ''}
                        </span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Max Pages:</span>
                        <span className="stat-value">{fullJobDetails.max_pages || 'Unlimited'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="detail-section">
                    <h4>🕐 Timestamps</h4>
                    <div className="detail-content">
                      <div className="stat-row">
                        <span className="stat-label">Created:</span>
                        <span className="stat-value">{formatDate(fullJobDetails.created_at)}</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Updated:</span>
                        <span className="stat-value">{formatDate(fullJobDetails.updated_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Date Range Schedule */}
                  {(fullJobDetails.start_date || fullJobDetails.end_date) && (
                    <div className="detail-section schedule-section">
                      <h4>📅 Scheduled Date Range</h4>
                      <div className="detail-content">
                        <div className="stat-row">
                          <span className="stat-label">Start Date:</span>
                          <span className="stat-value">
                            {fullJobDetails.start_date ? formatDate(fullJobDetails.start_date) : 'Immediately'}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">End Date:</span>
                          <span className="stat-value">
                            {fullJobDetails.end_date ? formatDate(fullJobDetails.end_date) : 'No end date'}
                          </span>
                        </div>
                        {fullJobDetails.end_date && (
                          <div className="stat-row">
                            <span className="stat-label">Time Remaining:</span>
                            <span className="stat-value">
                              {new Date(fullJobDetails.end_date) > new Date() 
                                ? getTimeRemaining(fullJobDetails.end_date)
                                : 'Expired'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="detail-section full-width">
                  <h4>🔗 cURL Command</h4>
                  <pre className="curl-display">{fullJobDetails.curl_command}</pre>
                </div>
                
                {fullJobDetails.error_message && (
                  <div className="detail-section full-width error-section">
                    <h4>⚠️ Error Message</h4>
                    <pre className="error-display">{fullJobDetails.error_message}</pre>
                  </div>
                )}
                
                <div className="fullscreen-actions">
                  {fullJobDetails.status === 'running' && (
                    <>
                      <button 
                        className="btn btn-secondary"
                        onClick={(e) => handleAction(fullJobDetails.id, 'pause', e)}
                        disabled={actionLoading[fullJobDetails.id]}
                      >
                        ⏸️ Pause
                      </button>
                      <button 
                        className="btn btn-danger"
                        onClick={(e) => handleAction(fullJobDetails.id, 'stop', e)}
                        disabled={actionLoading[fullJobDetails.id]}
                      >
                        ⏹️ Stop
                      </button>
                    </>
                  )}
                  {fullJobDetails.status === 'paused' && (
                    <>
                      <button 
                        className="btn btn-primary"
                        onClick={(e) => handleAction(fullJobDetails.id, 'resume', e)}
                        disabled={actionLoading[fullJobDetails.id]}
                      >
                        ▶️ Resume
                      </button>
                      <button 
                        className="btn btn-danger"
                        onClick={(e) => handleAction(fullJobDetails.id, 'stop', e)}
                        disabled={actionLoading[fullJobDetails.id]}
                      >
                        ⏹️ Stop
                      </button>
                    </>
                  )}
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      setLogViewerJobId(fullJobDetails.id);
                    }}
                  >
                    📟 View Live Logs
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setSaveModalJob(fullJobDetails)}
                  >
                    💾 Save to Collection
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Jobs Grid or Compact List */}
      {compact ? (
        <div className="compact-jobs-list">
          {jobs.slice(0, 10).map((job) => (
            <div key={job.id} className={`compact-job-item ${job.status}`}>
              <div className="compact-job-info">
                <span className="compact-job-icon">{getStatusIcon(job.status)}</span>
                <div className="compact-job-details">
                  <span className="compact-job-name">{job.table_name}</span>
                  <span className="compact-job-stats">
                    {job.total_records?.toLocaleString() || 0} records • Page {job.current_page || 0}
                  </span>
                </div>
              </div>
              <span className={`badge badge-small ${getBadgeClass(job.status)}`}>
                {job.status}
              </span>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className="compact-empty">No jobs yet</div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Crawl Jobs ({jobs.length})</h3>
            <button className="btn btn-secondary" onClick={refetch}>
              🔄 Refresh
            </button>
          </div>

          <div className="jobs-grid">
            {jobs.map((job) => (
              <div key={job.id} className={`job-card ${job.status}`}>
                <div className="job-card-header">
                  <div className="job-card-title">
                    <span className="job-icon">{getStatusIcon(job.status)}</span>
                    <span className="job-name">{job.table_name}</span>
                  </div>
                  <span className={`badge ${getBadgeClass(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                
                <div className="job-card-body">
                  <div className="job-stat">
                    <span className="job-stat-label">Records</span>
                    <span className="job-stat-value">{job.total_records?.toLocaleString() || 0}</span>
                  </div>
                  <div className="job-stat">
                    <span className="job-stat-label">Page</span>
                    <span className="job-stat-value">{job.current_page || 0}</span>
                  </div>
                  <div className="job-stat">
                    <span className="job-stat-label">Type</span>
                    <span className="job-stat-value small">{job.pagination_type?.replace('_', ' ')}</span>
                  </div>
                </div>

                {job.error_message && (
                  <div className="job-error">
                    ⚠️ {job.error_message.substring(0, 60)}...
                  </div>
                )}

                <div className="job-card-footer">
                  <span className="job-time">
                    {formatDate(job.updated_at)}
                  </span>
                  <div className="job-actions">
                    {job.status === 'running' && (
                      <button
                        className="action-btn pause"
                        onClick={(e) => handleAction(job.id, 'pause', e)}
                        disabled={actionLoading[job.id]}
                        title="Pause"
                      >
                        ⏸️
                      </button>
                    )}
                    {job.status === 'paused' && (
                      <button
                        className="action-btn resume"
                        onClick={(e) => handleAction(job.id, 'resume', e)}
                        disabled={actionLoading[job.id]}
                        title="Resume"
                      >
                        ▶️
                      </button>
                    )}
                    {(job.status === 'running' || job.status === 'paused') && (
                      <button
                        className="action-btn stop"
                        onClick={(e) => handleAction(job.id, 'stop', e)}
                        disabled={actionLoading[job.id]}
                        title="Stop"
                      >
                        ⏹️
                      </button>
                    )}
                    <button
                      className="action-btn view"
                      onClick={() => handleViewFull(job)}
                      title="View Details"
                    >
                      🔍
                    </button>
                    <button
                      className="action-btn logs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLogViewerJobId(job.id);
                      }}
                      title="View Logs"
                    >
                      📟
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default JobsList;

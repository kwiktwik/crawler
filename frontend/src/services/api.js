/**
 * API Service for communicating with the backend
 */
import axios from 'axios';

// Use relative URL to leverage webpack dev server proxy
// In production, set this to the actual backend URL
const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false,
});

// Crawler endpoints
export const validateCurl = async (curlCommand) => {
  const response = await api.post('/crawler/validate', { curl_command: curlCommand });
  return response.data;
};

export const startCrawl = async (config) => {
  const response = await api.post('/crawler/start', config);
  return response.data;
};

export const getNotifications = async (unreadOnly = false) => {
  const response = await api.get('/crawler/notifications', { params: { unread_only: unreadOnly } });
  return response.data;
};

export const markNotificationRead = async (notificationId) => {
  const response = await api.post(`/crawler/notifications/${notificationId}/read`);
  return response.data;
};

// Jobs endpoints
export const getJobs = async () => {
  const response = await api.get('/jobs/');
  return response.data;
};

export const getJob = async (jobId) => {
  const response = await api.get(`/jobs/${jobId}`);
  return response.data;
};

export const pauseJob = async (jobId) => {
  const response = await api.post(`/jobs/${jobId}/pause`);
  return response.data;
};

export const resumeJob = async (jobId) => {
  const response = await api.post(`/jobs/${jobId}/resume`);
  return response.data;
};

export const stopJob = async (jobId) => {
  const response = await api.post(`/jobs/${jobId}/stop`);
  return response.data;
};

// Tables endpoints
export const getTables = async () => {
  const response = await api.get('/tables/');
  return response.data;
};

export const getTable = async (tableName) => {
  const response = await api.get(`/tables/${tableName}`);
  return response.data;
};

export const getTableData = async (tableName, limit = 100, offset = 0) => {
  const response = await api.get(`/tables/${tableName}/data`, { params: { limit, offset } });
  return response.data;
};

// Logs endpoints
export const getJobLogs = async (jobId, limit = 100, sinceId = null) => {
  const params = { limit };
  if (sinceId) params.since_id = sinceId;
  const response = await api.get(`/crawler/jobs/${jobId}/logs`, { params });
  return response.data;
};

export const getBufferedLogs = async (jobId) => {
  const response = await api.get(`/crawler/jobs/${jobId}/logs/buffer`);
  return response.data;
};

// Create EventSource for SSE log streaming
export const createLogStream = (jobId) => {
  const baseUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : '';
  return new EventSource(`${baseUrl}/api/crawler/jobs/${jobId}/logs/stream`);
};

export default api;

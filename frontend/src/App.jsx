/**
 * API Crawler Dashboard - Main Application
 */
import React, { useState } from 'react';
import RequestBuilder from './components/RequestBuilder';
import CollectionManager from './components/CollectionManager';
import SaveToCollectionModal from './components/SaveToCollectionModal';
import JobsList from './components/JobsList';
import TablesView from './components/TablesView';
import Notifications from './components/Notifications';

function App() {
  const [activeTab, setActiveTab] = useState('crawler');
  const [jobStartedKey, setJobStartedKey] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [requestToSave, setRequestToSave] = useState(null);

  const handleJobStarted = (result) => {
    setJobStartedKey(prev => prev + 1);
    console.log('Job started:', result);
  };

  const handleSelectRequest = (request) => {
    setSelectedRequest(request);
    setActiveTab('crawler');
  };

  const handleSaveToCollection = (request) => {
    setRequestToSave(request);
    setShowSaveModal(true);
  };

  return (
    <div className="app-container">
      <Notifications />
      
      {/* Save Modal */}
      {showSaveModal && requestToSave && (
        <SaveToCollectionModal
          request={requestToSave}
          onClose={() => {
            setShowSaveModal(false);
            setRequestToSave(null);
          }}
          onSaved={() => {
            setShowSaveModal(false);
            setRequestToSave(null);
          }}
        />
      )}

      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🕷️</span>
          <span className="brand-text">API Crawler</span>
        </div>
        
        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${activeTab === 'crawler' ? 'active' : ''}`}
            onClick={() => setActiveTab('crawler')}
          >
            <span className="nav-icon">🚀</span>
            <span className="nav-text">Request Builder</span>
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'collections' ? 'active' : ''}`}
            onClick={() => setActiveTab('collections')}
          >
            <span className="nav-icon">📁</span>
            <span className="nav-text">Collections</span>
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-text">Jobs</span>
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'tables' ? 'active' : ''}`}
            onClick={() => setActiveTab('tables')}
          >
            <span className="nav-icon">🗄️</span>
            <span className="nav-text">Data Tables</span>
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'docs' ? 'active' : ''}`}
            onClick={() => setActiveTab('docs')}
          >
            <span className="nav-icon">📚</span>
            <span className="nav-text">Documentation</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="version-info">v1.0.0</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-main">
        <header className="main-header">
          <h1>
            {activeTab === 'crawler' && '🚀 Request Builder'}
            {activeTab === 'collections' && '📁 Collections'}
            {activeTab === 'jobs' && '📋 Crawl Jobs'}
            {activeTab === 'tables' && '🗄️ Data Tables'}
            {activeTab === 'docs' && '📚 Documentation'}
          </h1>
          <div className="header-subtitle">
            {activeTab === 'crawler' && 'Build and test API requests like Postman'}
            {activeTab === 'collections' && 'Organize and manage your saved requests'}
            {activeTab === 'jobs' && 'Monitor your crawling jobs'}
            {activeTab === 'tables' && 'View crawled data'}
            {activeTab === 'docs' && 'Learn how to use the crawler'}
          </div>
        </header>

        <div className="main-content">
          {activeTab === 'crawler' && (
            <div className="crawler-layout">
              <RequestBuilder 
                onJobStarted={handleJobStarted}
                initialRequest={selectedRequest}
                onSaveToCollection={handleSaveToCollection}
              />
              <div className="jobs-panel">
                <h3>Recent Jobs</h3>
                <JobsList key={jobStartedKey} compact={true} />
              </div>
            </div>
          )}

          {activeTab === 'collections' && (
            <CollectionManager onSelectRequest={handleSelectRequest} />
          )}

          {activeTab === 'jobs' && <JobsList key={jobStartedKey} />}

          {activeTab === 'tables' && <TablesView />}

          {activeTab === 'docs' && (
            <div className="docs-container">
              <div className="doc-section">
                <h2>🚀 Getting Started</h2>
                <p>The API Crawler allows you to crawl APIs and store the data in a structured database.</p>
                
                <h3>Quick Start</h3>
                <ol>
                  <li>Enter your API URL in the Request Builder</li>
                  <li>Add any required headers, authentication, or body</li>
                  <li>Click "Send" to test the request</li>
                  <li>Configure crawl settings (table name, intervals)</li>
                  <li>Click "Start Crawling" to begin</li>
                </ol>
              </div>

              <div className="doc-section">
                <h2>🧪 Testing with Mock Server</h2>
                <p>Start the mock server for testing:</p>
                <pre className="code-block">cd mock-server && npm start</pre>
                
                <h3>Available Endpoints</h3>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Endpoint</th>
                      <th>Pagination Type</th>
                      <th>URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Users</td>
                      <td>Page-based</td>
                      <td><code>http://localhost:3001/api/users?page=1</code></td>
                    </tr>
                    <tr>
                      <td>Posts</td>
                      <td>Offset-based</td>
                      <td><code>http://localhost:3001/api/posts?offset=0&limit=25</code></td>
                    </tr>
                    <tr>
                      <td>Comments</td>
                      <td>Cursor-based</td>
                      <td><code>http://localhost:3001/api/comments?cursor=0</code></td>
                    </tr>
                    <tr>
                      <td>Auth Data</td>
                      <td>None</td>
                      <td><code>POST http://localhost:3001/api/auth/data</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="doc-section">
                <h2>🔐 Authentication Types</h2>
                <div className="auth-docs">
                  <div className="auth-doc-item">
                    <h4>Bearer Token</h4>
                    <p>Adds <code>Authorization: Bearer &lt;token&gt;</code> header</p>
                  </div>
                  <div className="auth-doc-item">
                    <h4>Basic Auth</h4>
                    <p>Adds <code>Authorization: Basic &lt;base64&gt;</code> header</p>
                  </div>
                  <div className="auth-doc-item">
                    <h4>API Key</h4>
                    <p>Adds custom header or query parameter with your API key</p>
                  </div>
                </div>
              </div>

              <div className="doc-section">
                <h2>📊 Features</h2>
                <ul className="feature-list">
                  <li>✅ Visual request builder (no cURL knowledge needed)</li>
                  <li>✅ Collection management for organizing requests</li>
                  <li>✅ Multiple authentication methods</li>
                  <li>✅ JSON and form body support</li>
                  <li>✅ Automatic pagination detection</li>
                  <li>✅ Schema inference from API responses</li>
                  <li>✅ Dynamic database table creation</li>
                  <li>✅ Configurable request intervals</li>
                  <li>✅ Retry logic with failure notifications</li>
                  <li>✅ Date range scheduling</li>
                  <li>✅ Import/Export collections</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

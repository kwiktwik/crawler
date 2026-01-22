/**
 * Collection Manager Component
 * Manage saved API request collections
 */
import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'api_crawler_collections';

function CollectionManager({ onSelectRequest, onClose }) {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load collections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCollections(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load collections:', e);
      }
    } else {
      // Create default collection
      const defaultCollections = [
        {
          id: 'default',
          name: 'My Collection',
          requests: [],
          createdAt: new Date().toISOString()
        }
      ];
      setCollections(defaultCollections);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultCollections));
    }
  }, []);

  // Save collections to localStorage
  const saveCollections = (newCollections) => {
    setCollections(newCollections);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCollections));
  };

  // Create new collection
  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    
    const newCollection = {
      id: Date.now().toString(),
      name: newCollectionName.trim(),
      requests: [],
      createdAt: new Date().toISOString()
    };
    
    saveCollections([...collections, newCollection]);
    setNewCollectionName('');
    setShowNewCollection(false);
    setSelectedCollection(newCollection.id);
  };

  // Delete collection
  const handleDeleteCollection = (collectionId) => {
    if (window.confirm('Are you sure you want to delete this collection?')) {
      saveCollections(collections.filter(c => c.id !== collectionId));
      if (selectedCollection === collectionId) {
        setSelectedCollection(null);
      }
    }
  };

  // Add request to collection
  const addRequestToCollection = (collectionId, request) => {
    const newCollections = collections.map(c => {
      if (c.id === collectionId) {
        return {
          ...c,
          requests: [...c.requests, {
            ...request,
            id: Date.now().toString(),
            createdAt: new Date().toISOString()
          }]
        };
      }
      return c;
    });
    saveCollections(newCollections);
  };

  // Delete request from collection
  const handleDeleteRequest = (collectionId, requestId) => {
    const newCollections = collections.map(c => {
      if (c.id === collectionId) {
        return {
          ...c,
          requests: c.requests.filter(r => r.id !== requestId)
        };
      }
      return c;
    });
    saveCollections(newCollections);
  };

  // Update request
  const handleUpdateRequest = (collectionId, requestId, updates) => {
    const newCollections = collections.map(c => {
      if (c.id === collectionId) {
        return {
          ...c,
          requests: c.requests.map(r => 
            r.id === requestId ? { ...r, ...updates } : r
          )
        };
      }
      return c;
    });
    saveCollections(newCollections);
    setEditingRequest(null);
  };

  // Duplicate request
  const handleDuplicateRequest = (collectionId, request) => {
    addRequestToCollection(collectionId, {
      ...request,
      name: `${request.name} (Copy)`
    });
  };

  // Export collection
  const handleExportCollection = (collection) => {
    const dataStr = JSON.stringify(collection, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${collection.name.replace(/\s+/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import collection
  const handleImportCollection = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.name && Array.isArray(imported.requests)) {
          const newCollection = {
            ...imported,
            id: Date.now().toString(),
            createdAt: new Date().toISOString()
          };
          saveCollections([...collections, newCollection]);
        } else {
          alert('Invalid collection format');
        }
      } catch (error) {
        alert('Failed to import collection: ' + error.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Get method color class
  const getMethodClass = (method) => {
    const classes = {
      GET: 'method-get',
      POST: 'method-post',
      PUT: 'method-put',
      PATCH: 'method-patch',
      DELETE: 'method-delete'
    };
    return classes[method] || 'method-get';
  };

  // Filter requests
  const filterRequests = (requests) => {
    if (!searchTerm) return requests;
    const term = searchTerm.toLowerCase();
    return requests.filter(r => 
      r.name?.toLowerCase().includes(term) ||
      r.url?.toLowerCase().includes(term) ||
      r.method?.toLowerCase().includes(term)
    );
  };

  const currentCollection = collections.find(c => c.id === selectedCollection);

  return (
    <div className="collection-manager">
      <div className="collection-sidebar">
        <div className="sidebar-header">
          <h3>📁 Collections</h3>
          <div className="sidebar-actions">
            <button 
              className="icon-btn"
              onClick={() => setShowNewCollection(true)}
              title="New Collection"
            >
              ➕
            </button>
            <label className="icon-btn" title="Import Collection">
              📥
              <input
                type="file"
                accept=".json"
                onChange={handleImportCollection}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {showNewCollection && (
          <div className="new-collection-form">
            <input
              type="text"
              placeholder="Collection name"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateCollection()}
              autoFocus
            />
            <div className="form-actions">
              <button className="btn-small" onClick={handleCreateCollection}>Create</button>
              <button className="btn-small secondary" onClick={() => setShowNewCollection(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="collection-list">
          {collections.map(collection => (
            <div
              key={collection.id}
              className={`collection-item ${selectedCollection === collection.id ? 'active' : ''}`}
            >
              <div 
                className="collection-info"
                onClick={() => setSelectedCollection(collection.id)}
              >
                <span className="collection-icon">📁</span>
                <span className="collection-name">{collection.name}</span>
                <span className="collection-count">{collection.requests.length}</span>
              </div>
              <div className="collection-actions">
                <button 
                  className="icon-btn-small"
                  onClick={() => handleExportCollection(collection)}
                  title="Export"
                >
                  📤
                </button>
                <button 
                  className="icon-btn-small danger"
                  onClick={() => handleDeleteCollection(collection.id)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="collection-content">
        {currentCollection ? (
          <>
            <div className="content-header">
              <h3>{currentCollection.name}</h3>
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="🔍 Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {currentCollection.requests.length === 0 ? (
              <div className="empty-collection">
                <div className="empty-icon">📭</div>
                <h4>No requests yet</h4>
                <p>Create a request and save it to this collection</p>
              </div>
            ) : (
              <div className="request-list">
                {filterRequests(currentCollection.requests).map(request => (
                  <div key={request.id} className="request-item">
                    {editingRequest === request.id ? (
                      <div className="request-edit">
                        <input
                          type="text"
                          defaultValue={request.name}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateRequest(currentCollection.id, request.id, { name: e.target.value });
                            }
                          }}
                          onBlur={(e) => handleUpdateRequest(currentCollection.id, request.id, { name: e.target.value })}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <div 
                          className="request-info"
                          onClick={() => onSelectRequest && onSelectRequest(request)}
                        >
                          <span className={`request-method ${getMethodClass(request.method)}`}>
                            {request.method}
                          </span>
                          <span className="request-name">{request.name}</span>
                          <span className="request-url">{request.url}</span>
                        </div>
                        <div className="request-actions">
                          <button
                            className="icon-btn-small"
                            onClick={() => onSelectRequest && onSelectRequest(request)}
                            title="Load Request"
                          >
                            ▶️
                          </button>
                          <button
                            className="icon-btn-small"
                            onClick={() => setEditingRequest(request.id)}
                            title="Rename"
                          >
                            ✏️
                          </button>
                          <button
                            className="icon-btn-small"
                            onClick={() => handleDuplicateRequest(currentCollection.id, request)}
                            title="Duplicate"
                          >
                            📋
                          </button>
                          <button
                            className="icon-btn-small danger"
                            onClick={() => handleDeleteRequest(currentCollection.id, request.id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="no-collection-selected">
            <div className="empty-icon">👈</div>
            <h4>Select a collection</h4>
            <p>Choose a collection from the sidebar to view its requests</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Export utility functions for use in other components
export const addToCollection = (collectionId, request) => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const collections = JSON.parse(saved);
      const newCollections = collections.map(c => {
        if (c.id === collectionId) {
          return {
            ...c,
            requests: [...c.requests, {
              ...request,
              id: Date.now().toString(),
              createdAt: new Date().toISOString()
            }]
          };
        }
        return c;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCollections));
      return true;
    } catch (e) {
      console.error('Failed to add to collection:', e);
      return false;
    }
  }
  return false;
};

export const getCollections = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return [];
    }
  }
  return [];
};

export default CollectionManager;

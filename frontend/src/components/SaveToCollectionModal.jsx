/**
 * Save to Collection Modal
 * Modal for saving a request to a collection
 */
import React, { useState, useEffect } from 'react';
import { getCollections, addToCollection } from './CollectionManager';

function SaveToCollectionModal({ request, onClose, onSaved }) {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [requestName, setRequestName] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollection, setShowNewCollection] = useState(false);

  useEffect(() => {
    const cols = getCollections();
    setCollections(cols);
    if (cols.length > 0) {
      setSelectedCollection(cols[0].id);
    }
    setRequestName(request?.name || 'New Request');
  }, [request]);

  const handleSave = () => {
    if (!selectedCollection || !requestName.trim()) return;
    
    const requestToSave = {
      ...request,
      name: requestName.trim()
    };
    
    const success = addToCollection(selectedCollection, requestToSave);
    
    if (success) {
      if (onSaved) onSaved();
      onClose();
    } else {
      alert('Failed to save request');
    }
  };

  const handleCreateAndSave = () => {
    if (!newCollectionName.trim() || !requestName.trim()) return;
    
    // Create new collection
    const newCollection = {
      id: Date.now().toString(),
      name: newCollectionName.trim(),
      requests: [{
        ...request,
        name: requestName.trim(),
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString()
    };
    
    const saved = localStorage.getItem('api_crawler_collections');
    const collections = saved ? JSON.parse(saved) : [];
    localStorage.setItem('api_crawler_collections', JSON.stringify([...collections, newCollection]));
    
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content save-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>💾 Save to Collection</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label>Request Name</label>
            <input
              type="text"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="Enter request name"
            />
          </div>

          <div className="form-group">
            <label>Request Details</label>
            <div className="request-preview">
              <span className={`method-badge method-${request?.method?.toLowerCase()}`}>
                {request?.method}
              </span>
              <span className="url-preview">{request?.url}</span>
            </div>
          </div>

          {!showNewCollection ? (
            <>
              <div className="form-group">
                <label>Select Collection</label>
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                >
                  {collections.map(col => (
                    <option key={col.id} value={col.id}>
                      {col.name} ({col.requests.length} requests)
                    </option>
                  ))}
                </select>
              </div>

              <button 
                className="link-btn"
                onClick={() => setShowNewCollection(true)}
              >
                ➕ Create new collection
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>New Collection Name</label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Enter collection name"
                  autoFocus
                />
              </div>

              <button 
                className="link-btn"
                onClick={() => setShowNewCollection(false)}
              >
                ← Back to existing collections
              </button>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary"
            onClick={showNewCollection ? handleCreateAndSave : handleSave}
            disabled={!requestName.trim() || (showNewCollection ? !newCollectionName.trim() : !selectedCollection)}
          >
            💾 Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveToCollectionModal;

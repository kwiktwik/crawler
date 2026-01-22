/**
 * Notifications Component
 * Displays real-time notifications from the crawler
 */
import React, { useEffect, useState } from 'react';
import { getNotifications, markNotificationRead } from '../services/api';

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await getNotifications(true);
        
        // Find new notifications
        const existingIds = notifications.map(n => n.id);
        const newNotifications = data.filter(n => !existingIds.includes(n.id));
        
        if (newNotifications.length > 0) {
          setVisible(prev => [...newNotifications, ...prev].slice(0, 5));
          setNotifications(data);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (notification) => {
    try {
      await markNotificationRead(notification.id);
      setVisible(prev => prev.filter(n => n.id !== notification.id));
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  if (visible.length === 0) return null;

  return (
    <div className="notifications-panel">
      {visible.map((notification) => (
        <div 
          key={notification.id} 
          className={`notification notification-${notification.type}`}
          onClick={() => handleDismiss(notification)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <strong>
                {notification.type === 'error' && '❌ Error'}
                {notification.type === 'success' && '✅ Success'}
                {notification.type === 'info' && 'ℹ️ Info'}
              </strong>
              <p style={{ marginTop: '4px', fontSize: '14px' }}>{notification.message}</p>
              <small style={{ color: 'var(--text-secondary)' }}>
                {new Date(notification.created_at).toLocaleTimeString()}
              </small>
            </div>
            <button 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'var(--text-secondary)', 
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Notifications;

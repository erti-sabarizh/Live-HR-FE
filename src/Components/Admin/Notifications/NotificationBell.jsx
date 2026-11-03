import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { portalInstance } from "../../../Services/instance";
import "./Notificationbell.css";

const NotificationBell = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await portalInstance.get("api/notifications");

      if (res.data.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await portalInstance.put(`api/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await portalInstance.put("api/notifications/read-all");
      fetchNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case "PROFILE_EDIT_REQUEST":
      case "EDIT_REQUEST": return "📝";
      case "PROFILE_EDIT_APPROVED":
      case "EDIT_APPROVED": return "✅";
      case "PROFILE_EDIT_REJECTED":
      case "EDIT_REJECTED": return "❌";
      case "PROFILE_COMPLETION_REQUEST": return "📋";
      case "PROFILE_APPROVED": return "✅";
      case "PROFILE_REJECTED": return "❌";
      case "SECURITY_REQUEST": return "🛡️";
      case "SECURITY_APPROVED": return "🔓";
      case "SECURITY_REJECTED": return "❌";
      case "LEAVE_REQUEST":
      case "WFH_REQUEST": return "✈️";
      case "LEAVE_APPROVED":
      case "WFH_APPROVED": return "✅";
      case "LEAVE_REJECTED":
      case "WFH_REJECTED": return "❌";
      default: return "🔔";
    }
  };

  // Get notification color based on type
  const getNotificationColor = (type) => {
    switch (type) {
      case "PROFILE_EDIT_REQUEST":
      case "EDIT_REQUEST": return "#3b82f6";
      case "PROFILE_EDIT_APPROVED":
      case "EDIT_APPROVED": return "#22c55e";
      case "PROFILE_EDIT_REJECTED":
      case "EDIT_REJECTED": return "#ef4444";
      case "PROFILE_COMPLETION_REQUEST": return "#6366f1";
      case "PROFILE_APPROVED": return "#10b981";
      case "PROFILE_REJECTED": return "#ef4444";
      case "SECURITY_REQUEST": return "#6366f1";
      case "SECURITY_APPROVED": return "#22c55e";
      case "SECURITY_REJECTED": return "#ef4444";
      case "LEAVE_REQUEST":
      case "WFH_REQUEST": return "#f59e0b"; // amber for pending
      case "LEAVE_APPROVED":
      case "WFH_APPROVED": return "#22c55e"; // green for approved
      case "LEAVE_REJECTED":
      case "WFH_REJECTED": return "#ef4444"; // red for rejected
      default: return "#6b7280";
    }
  };

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        className="notification-bell-btn"
        onClick={() => setShowDropdown(!showDropdown)}
        title="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">
                <div className="loading-spinner"></div>
                <p>Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <span className="empty-icon">🔔</span>
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`notification-item ${!notification.read ? "unread" : ""}`}
                  onClick={() => {
                    if (!notification.read) markAsRead(notification._id);
                    setShowDropdown(false);
                    if (notification.metadata?.url) {
                      navigate(notification.metadata.url);
                    }
                  }}
                >
                  <div
                    className="notification-icon"
                    style={{
                      backgroundColor: `${getNotificationColor(notification.type)}20`,
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <h5>{notification.title}</h5>
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  {!notification.read && <div className="unread-dot" />}
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <span>{notifications.length} notification(s)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
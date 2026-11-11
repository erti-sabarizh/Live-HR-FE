// Sidebar.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Sidebar.css";
import { FaBars } from "react-icons/fa";
import { Icon } from "@iconify/react";
import { portalInstance } from "../../Services/instance";
import ProfilePage from "./ProfilePage";
import { useUser } from "../UserContext";
import { toast } from "react-toastify";
import { messaging, deleteToken } from "../../firebase";
import { checkProfileRestriction } from "../../utils/profileCompletionRestriction";
import {
  getCachedHrAccessConfig,
  canHrAddEmployee,
  canHrViewEmployee,
  canHrDailyAttendance,
  canHrMonthlyAttendance,
} from "../../utils/hrAccessHelper";
import { SidebarLayoutContext } from "./SidebarLayoutContext";

const ICON_BASE = "/ICONS";

const getIcon = (name, isActive) => {
  const fileName = isActive ? `${name} A.svg` : `${name}.svg`;
  return `${ICON_BASE}/${encodeURIComponent(fileName)}`;
};

const getUserIdFromToken = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(base64));
    return payload.id || payload._id;
  } catch {
    return null;
  }
};

const buildFileUrl = (fileUrl) => {
  if (!fileUrl) return null;
  if (fileUrl === "avatar.png") return "/avatar.png";
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }
  const base = (portalInstance.defaults.baseURL || "").replace(/\/+$/, "");
  const path = fileUrl.replace(/^\/+/, "");
  return `${base}/${path}`;
};

const DEFAULT_AVATAR =
  "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg";

/* ═════════════════════════════════════════════════════════════════════
   ⚡ IN-MEMORY CACHE (Persists across route navigations without re-fetching)
═════════════════════════════════════════════════════════════════════ */
const SIDEBAR_CACHE = {
  profileFetchedAt: 0,
  notifications: null,
  notificationsFetchedAt: 0,
  calendarData: null,
  calendarKey: "",
  profileCompletion: null,
  hasHolidayAssignment: null,
};

function SidebarContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useUser();

  const [role, setRole] = useState(null);
  const [manualNav, setManualNav] = useState(false);
  const [activeItem, setActiveItem] = useState("");
  const [activeSubItem, setActiveSubItem] = useState("");
  const [activeNestedItem, setActiveNestedItem] = useState("");
  const [openMenus, setOpenMenus] = useState({});
  const [openSubMenus, setOpenSubMenus] = useState({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hasHolidayAssignment, setHasHolidayAssignment] = useState(false);
  const [calendarMonthlyData, setCalendarMonthlyData] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [isHrSectionOpen, setIsHrSectionOpen] = useState(true);

  // ── Notification States ──
  const [notifications, setNotifications] = useState([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const notificationsDropdownRef = useRef(null);
  const scrollContentRef = useRef(null);

  const authObj = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
  const token = authObj?.token;
  const loggedInUserId = token ? getUserIdFromToken(token) : null;

  const roleSetByAPI = useRef(false);

  // ── Sidebar Menu Customization States ──
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [settingsRotateDeg, setSettingsRotateDeg] = useState(0);
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const settingsDropdownRef = useRef(null);
  const [visibleMenuTitles, setVisibleMenuTitles] = useState(() => {
    try {
      const key = `sidebar_custom_menus_${loggedInUserId || "default"}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!loggedInUserId && !role) return;
    try {
      const key = `sidebar_custom_menus_${loggedInUserId || role || "default"}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setVisibleMenuTitles(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error loading menu preferences", e);
    }
  }, [loggedInUserId, role]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowSettingsDrawer(false);
      }
    };
    if (showSettingsDrawer) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSettingsDrawer]);

  // ── Format Helper ──
  const formatTimeAgo = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // ── Fetch Logic for Admin ──
  const fetchAdminNotifications = async () => {
    if (!token || !loggedInUserId) return;
    try {
      let leaves = [];
      try {
        const [leaveRes, wfhRes] = await Promise.all([
          portalInstance.get("/api/leaves/admin/all"),
          portalInstance.get("/api/leaves/admin/wfh"),
        ]);
        const allLeaves = Array.isArray(leaveRes.data?.data) ? leaveRes.data.data : [];
        const wfhRequests = Array.isArray(wfhRes.data?.data) ? wfhRes.data.data : [];
        const allRequests = [
          ...allLeaves.map((l) => ({ ...l, requestType: "leave" })),
          ...wfhRequests.map((w) => ({ ...w, requestType: "wfh" })),
        ];

        const dismissed = JSON.parse(
          localStorage.getItem(`dismissedNotificationKeys_${loggedInUserId}`) || "[]"
        );

        const actionable = allRequests.filter((l) => {
          const key = `${l.requestType}-${l._id}-${l.status}`;
          return (l.status === "Pending" || l.status === "Leave Cancel") && !dismissed.includes(key);
        });

        actionable.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

        leaves = actionable.map((l) => ({
          id: l._id,
          uniqueKey: `${l.requestType}-${l._id}-${l.status}`,
          name: l.employee?.name || "Unknown",
          photo: buildFileUrl(l.employee?.photo) || DEFAULT_AVATAR,
          type: l.reasonType,
          status: l.status,
          category: l.requestType,
          time: l.updatedAt || l.createdAt,
        }));
      } catch (err) {
        console.error("Admin Leaves poll error:", err);
      }

      let holidays = [];
      try {
        const res = await portalInstance.get("/holiday-assignments/my");
        let assignments = res.data?.data || res.data?.assignments || res.data || [];
        const dismissed = JSON.parse(
          localStorage.getItem(`dismissedNotificationKeys_${loggedInUserId}`) || "[]"
        );
        const submitted = assignments.filter((a) => {
          const timestamp = a.updatedAt || a.submittedDate || "";
          const key = `holiday-${a._id}-${a.status}-${timestamp}`;
          return (a.status === "submitted" || a.status === "Submitted") && !dismissed.includes(key);
        });
        submitted.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        holidays = submitted.map((a) => ({
          id: a._id,
          uniqueKey: `holiday-${a._id}-${a.status}-${a.updatedAt || a.submittedDate || ""}`,
          name: a.assignedTo?.name || "Unknown",
          photo: buildFileUrl(a.assignedTo?.photo) || DEFAULT_AVATAR,
          holidayName: a.holidayName || a.holiday?.name || "Government Holiday",
          holidayDate: a.holidayDate || a.holiday?.date || "",
          status: a.status,
          category: "holiday",
          time: a.updatedAt || a.createdAt,
        }));
      } catch (err) {
        console.error("Admin Holiday poll error:", err);
      }

      let securities = [];
      try {
        const res = await portalInstance.get("/security/pending-for-me");
        const requests = Array.isArray(res.data?.data) ? res.data.data : [];
        const dismissed = JSON.parse(
          localStorage.getItem(`dismissedNotificationKeys_${loggedInUserId}`) || "[]"
        );
        const actionable = requests.filter((r) => {
          const key = `security-${r._id}-${r.status}`;
          return !dismissed.includes(key);
        });
        securities = actionable.map((r) => ({
          id: r._id,
          uniqueKey: `security-${r._id}-${r.status}`,
          name: r.makerId?.name || "Unknown",
          photo: r.makerId?.avatar || DEFAULT_AVATAR,
          title: r.title,
          status: r.status,
          category: "security",
          time: r.createdAt,
        }));
      } catch (err) {
        console.error("Admin Security poll error:", err);
      }

      let hrApprovals = [];
      try {
        const hrRes = await portalInstance.get("/hr-approval/requests?status=PENDING");
        const requests = Array.isArray(hrRes.data?.data) ? hrRes.data.data : [];
        const dismissed = JSON.parse(
          localStorage.getItem(`dismissedNotificationKeys_${loggedInUserId}`) || "[]"
        );
        const actionable = requests.filter((r) => {
          const key = `hr-approval-${r._id}-${r.status}`;
          return !dismissed.includes(key);
        });
        hrApprovals = actionable.map((r) => {
          let moduleLabel = r.targetModule;
          if (r.targetModule === "LEAVE_CATEGORY" || r.targetModule === "LEAVE_MANAGEMENT") {
            moduleLabel = "Leave Category";
          } else if (r.targetModule === "EMPLOYEE") {
            moduleLabel = "Employee Update";
          } else if (r.targetModule === "HOLIDAY" || r.targetModule === "GOV_HOLIDAY") {
            moduleLabel = "Holiday";
          } else if (r.targetModule === "SALARY_SLIP") {
            moduleLabel = "Salary Slip";
          }
          return {
            id: r._id,
            uniqueKey: `hr-approval-${r._id}-${r.status}`,
            name: r.hrName || r.hrId?.name || "HR User",
            photo: buildFileUrl(r.hrId?.photo) || DEFAULT_AVATAR,
            title: `HR ${moduleLabel} Request`,
            message: r.summary,
            status: r.status,
            category: "hr_approval",
            targetModule: r.targetModule,
            time: r.createdAt,
          };
        });
      } catch (err) {
        console.error("Admin HR Approval poll error:", err);
      }

      let systemNotifs = [];
      try {
        const sysRes = await portalInstance.get("/api/notifications");
        const allSys = Array.isArray(sysRes.data?.data) ? sysRes.data.data : [];
        const dismissed = JSON.parse(
          localStorage.getItem(`dismissedNotificationKeys_${loggedInUserId}`) || "[]"
        );
        const actionable = allSys.filter((n) => {
          const key = `sys-${n._id}`;
          return !dismissed.includes(key) && n.type !== "HR_APPROVAL_REQUEST";
        });
        systemNotifs = actionable.map((n) => {
          const isIg = n.type === "INSTAGRAM_MESSAGE" || n.type === "INSTAGRAM_COMMENT" || n.metadata?.targetModule?.startsWith("INSTAGRAM");
          const defaultUrl = isIg
            ? (n.type === "INSTAGRAM_COMMENT" ? "/social-media/instagram?tab=comments" : "/social-media/instagram?tab=messages")
            : "";
          return {
            id: n._id,
            uniqueKey: `sys-${n._id}`,
            name: isIg ? "Instagram" : (n.title || "Notification"),
            photo: isIg ? "https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" : DEFAULT_AVATAR,
            title: n.title,
            message: n.message,
            status: isIg ? (n.type === "INSTAGRAM_MESSAGE" ? "DM" : "Comment") : "Notice",
            category: isIg ? "instagram" : "system",
            targetModule: n.metadata?.targetModule || n.targetModule,
            url: n.metadata?.url || defaultUrl,
            time: n.createdAt,
          };
        });
      } catch (err) {
        console.error("Admin System/Instagram notifications poll error:", err);
      }

      const incoming = [...leaves, ...holidays, ...securities, ...hrApprovals, ...systemNotifs];
      const map = new Map();
      incoming.forEach((n) => {
        map.set(n.uniqueKey, n);
      });
      const sorted = Array.from(map.values())
        .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
        .slice(0, 20);
      setNotifications(sorted);
      SIDEBAR_CACHE.notifications = sorted;
      SIDEBAR_CACHE.notificationsFetchedAt = Date.now();
    } catch (err) {
      console.error("Admin Notifications fetch failed:", err);
    }
  };

  // ── Fetch Logic for Employee ──
  const fetchEmployeeNotifications = async () => {
    if (!token || !loggedInUserId) return;
    try {
      const dismissedIds = JSON.parse(
        localStorage.getItem(`dismissedNotifications_${loggedInUserId}`) || "[]"
      );

      let taskNotifs = [];
      try {
        const taskRes = await portalInstance.get("/creat/tasks/dashboard");
        const allTasks = taskRes.data.data || [];
        taskNotifs = allTasks
          .filter((task) => {
            const isAllocated = task.assignedStatus === "Allocated";
            const isAssigned = task.assignedStatus === "Assigned";
            const createdById = task.createdBy?._id || task.createdBy;
            const isCreatedByMe =
              createdById?.toString() === loggedInUserId?.toString();
            const isForMe = task.assignedMembers?.some((member) => {
              const mId = typeof member === "object" ? member._id : member;
              return mId?.toString() === loggedInUserId?.toString();
            });
            return (
              (isAllocated || isAssigned) &&
              isForMe &&
              !isCreatedByMe &&
              !dismissedIds.includes(task._id)
            );
          })
          .map((task) => ({
            id: task._id,
            uniqueKey: `task-${task._id}`,
            type: "TASK",
            title:
              task.assignedStatus === "Assigned"
                ? "New Task Assigned"
                : "New Task Allocated",
            message: task.taskTitle,
            subtext: `Priority: ${task.priority}`,
            timestamp: task.createdAt,
            isAssigned: task.assignedStatus === "Assigned",
            assignedBy:
              task.createdBy?.name ||
              task.createdBy?.employeeName ||
              task.createdBy?.firstName ||
              "Admin",
            description:
              (task.taskTitle
                ? task.taskTitle + (task.taskDetails ? " — " : "")
                : "") + (task.taskDetails || "No details provided."),
            time: task.createdAt,
          }));
      } catch (err) {
        console.log("Employee Tasks fetch error:", err);
      }

      let leaveNotifs = [];
      try {
        const leaveRes = await portalInstance.get("/api/leaves?notify=true");
        const allLeaves = Array.isArray(leaveRes.data)
          ? leaveRes.data
          : leaveRes.data?.data || [];
        leaveNotifs = allLeaves
          .filter((leave) => leave && !dismissedIds.includes(leave._id))
          .map((leave) => {
            let title = "";
            let notifType = "";
            if (leave.status === "Approved") {
              title = "Leave Approved";
              notifType = "APPROVED";
            } else if (leave.status === "Leave Cancel") {
              title = "Cancel Requested";
              notifType = "CANCEL";
            } else {
              title = "Leave Rejected";
              notifType = "CANCEL";
            }
            return {
              id: leave._id,
              uniqueKey: `leave-${leave._id}`,
              type: notifType,
              title,
              message: `${leave.reasonType} (${leave.dayType})`,
              subtext: `${new Date(leave.fromDate).toLocaleDateString()} - ${new Date(leave.toDate).toLocaleDateString()}`,
              timestamp: leave.updatedAt || leave.createdAt,
              time: leave.updatedAt || leave.createdAt,
            };
          });
      } catch (err) {
        console.log("Employee Leaves fetch error:", err);
      }

      let calendarNotifs = [];
      try {
        const res = await portalInstance.get("/holiday-assignments/my");
        const assignments = res.data?.data || [];
        const myAssignments = assignments.filter((a) => {
          const assignedId = a.assignedTo?._id || a.assignedTo;
          const isMe = String(assignedId) === String(loggedInUserId);
          const isDismissedForMe =
            a.isDismissed ||
            (Array.isArray(a.dismissedBy) &&
              a.dismissedBy.some((d) => String(d._id || d) === String(loggedInUserId)));
          return isMe && !isDismissedForMe;
        });

        const pendingOnly = myAssignments.filter(
          (a) => a.status === "pending" || a.status === "in-progress"
        );
        const pendingCalendarNotifs = pendingOnly
          .filter((a) => !dismissedIds.includes(`calendar-${a._id}`))
          .map((assignment) => ({
            id: `calendar-${assignment._id}`,
            uniqueKey: `calendar-${assignment._id}`,
            assignmentId: assignment._id,
            type: "HOLIDAY_CALENDAR",
            title: "Holiday Calendar Assigned",
            message: `Please fill the Holiday Calendar for ${assignment.year}`,
            subtext: `Status: ${assignment.status === "pending" ? "Not Started" : "In Progress"}`,
            timestamp: assignment.assignedDate,
            time: assignment.assignedDate,
          }));

        const approvedOnly = myAssignments.filter((a) => a.status === "approved");
        const approvedCalendarNotifs = approvedOnly
          .filter((a) => !dismissedIds.includes(`calendar-approved-${a._id}`))
          .map((assignment) => ({
            id: `calendar-approved-${assignment._id}`,
            uniqueKey: `calendar-approved-${assignment._id}`,
            assignmentId: assignment._id,
            type: "HOLIDAY_CALENDAR_APPROVED",
            title: "Holiday Calendar Approved",
            message: `Your Holiday Calendar for ${assignment.year} has been approved!`,
            subtext: "Approved by Admin",
            timestamp: assignment.reviewedDate || assignment.updatedAt || assignment.assignedDate,
            time: assignment.reviewedDate || assignment.updatedAt || assignment.assignedDate,
          }));

        calendarNotifs = [...pendingCalendarNotifs, ...approvedCalendarNotifs];
      } catch (err) {
        console.log("Employee Holiday fetch error:", err);
      }

      let securityNotifs = [];
      try {
        const res = await portalInstance.get("/security/pending-for-me");
        const requests = Array.isArray(res.data?.data) ? res.data.data : [];
        const actionable = requests.filter((r) => {
          return !dismissedIds.includes(`security-${r._id}`);
        });
        securityNotifs = actionable.map((r) => ({
          id: `security-${r._id}`,
          uniqueKey: `security-${r._id}`,
          type: "SECURITY",
          title: "Security Request",
          message: r.title,
          subtext: `From: ${r.makerId?.name || "Unknown"}`,
          timestamp: r.createdAt,
          time: r.createdAt,
        }));
      } catch (err) {
        console.log("Employee Security fetch error:", err);
      }

      let generalNotifs = [];
      try {
        const res = await portalInstance.get("/api/notifications");
        const allNotifs = res.data?.data || [];
        const filtered = allNotifs.filter(
          (n) =>
            n &&
            (n.type === "SECURITY_APPROVED" ||
              n.type === "SECURITY_REJECTED" ||
              n.type === "HR_APPROVAL_APPROVED" ||
              n.type === "HR_APPROVAL_REJECTED" ||
              n.type === "PROFILE_APPROVED" ||
              n.type === "PROFILE_REJECTED" ||
              n.type === "PERMISSION_APPROVED" ||
              n.type === "PERMISSION_REJECTED" ||
              n.type === "EDIT_APPROVED" ||
              n.type === "EDIT_REJECTED")
        );
        generalNotifs = filtered
          .filter((n) => !dismissedIds.includes(n._id))
          .map((n) => ({
            id: n._id,
            uniqueKey: `general-${n._id}`,
            type: n.type?.startsWith("PERMISSION")
              ? "PERMISSION_DECISION"
              : n.type?.startsWith("PROFILE")
              ? "PROFILE_DECISION"
              : n.type?.startsWith("HR_APPROVAL")
              ? "HR_APPROVAL_DECISION"
              : n.type?.startsWith("EDIT")
              ? "EDIT_DECISION"
              : "SECURITY_DECISION",
            title:
              n.title ||
              (n.type === "EDIT_APPROVED"
                ? "Profile Edit Request Approved"
                : n.type === "EDIT_REJECTED"
                ? "Profile Edit Request Rejected"
                : n.type === "PERMISSION_APPROVED"
                ? "Permission Approved"
                : "Permission Rejected"),
            message: n.message,
            subtext:
              n.type === "EDIT_APPROVED" || n.type === "PERMISSION_APPROVED" || n.type === "PROFILE_APPROVED"
                ? "Approved by Admin"
                : n.type === "EDIT_REJECTED" || n.type === "PERMISSION_REJECTED" || n.type === "PROFILE_REJECTED"
                ? "Rejected by Admin"
                : "",
            targetModule: n.metadata?.targetModule || n.targetModule,
            url: n.metadata?.url || n.url || (n.type === "EDIT_APPROVED" ? "/emp/my-details/edit" : "/emp/my-details"),
            timestamp: n.createdAt,
            time: n.createdAt,
          }));
      } catch (err) {
        console.log("Employee general notifications fetch error:", err);
      }

      const combined = [
        ...taskNotifs,
        ...leaveNotifs,
        ...calendarNotifs,
        ...securityNotifs,
        ...generalNotifs,
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setNotifications(combined);
      SIDEBAR_CACHE.notifications = combined;
      SIDEBAR_CACHE.notificationsFetchedAt = Date.now();
    } catch (err) {
      console.error("Employee Notifications fetch failed:", err);
    }
  };

  const fetchNotifications = async (force = false) => {
    // ⚡ OPTIMIZATION 2: 60-second in-memory TTL cache for notifications
    const now = Date.now();
    if (!force && SIDEBAR_CACHE.notifications && (now - SIDEBAR_CACHE.notificationsFetchedAt < 60000)) {
      setNotifications(SIDEBAR_CACHE.notifications);
      return;
    }

    if (role === "admin") {
      await fetchAdminNotifications();
    } else if (role === "employee") {
      await fetchEmployeeNotifications();
    }
  };

  // ── Poll Notifications (60-second interval) ──
  useEffect(() => {
    if (!role || !token || !loggedInUserId) return;
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(true), 60000);
    return () => clearInterval(interval);
  }, [role, token, loggedInUserId]);

  // ── Outside Click to Close Dropdown ──
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationsDropdownRef.current &&
        !notificationsDropdownRef.current.contains(event.target)
      ) {
        setShowNotificationsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Dismiss Single Notification ──
  const handleDismiss = async (e, notif) => {
    e.stopPropagation();
    if (role === "admin") {
      const keys = JSON.parse(
        localStorage.getItem(`dismissedNotificationKeys_${loggedInUserId}`) || "[]"
      );
      if (!keys.includes(notif.uniqueKey)) {
        keys.push(notif.uniqueKey);
        localStorage.setItem(`dismissedNotificationKeys_${loggedInUserId}`, JSON.stringify(keys));
      }
      setNotifications((prev) => {
        const next = prev.filter((n) => n.uniqueKey !== notif.uniqueKey);
        SIDEBAR_CACHE.notifications = next;
        return next;
      });
    } else {
      const dismissedIds = JSON.parse(
        localStorage.getItem(`dismissedNotifications_${loggedInUserId}`) || "[]"
      );
      if (!dismissedIds.includes(notif.id)) {
        dismissedIds.push(notif.id);
        localStorage.setItem(`dismissedNotifications_${loggedInUserId}`, JSON.stringify(dismissedIds));
      }
      if (notif.type === "APPROVED" || notif.type === "CANCEL") {
        try {
          await portalInstance.put(`/api/leaves/${notif.id}/dismiss`);
        } catch (err) {
          console.error("Failed to dismiss leave notification:", err);
        }
      }
      if (
        notif.type === "HOLIDAY_CALENDAR_APPROVED" ||
        notif.type === "HOLIDAY_CALENDAR" ||
        (typeof notif.id === "string" && notif.id.startsWith("calendar-"))
      ) {
        try {
          const assignId = notif.assignmentId || notif.id.replace(/^calendar-(?:approved-)?/, "");
          await portalInstance.put(`/holiday-assignments/${assignId}/dismiss`);
        } catch (err) {
          console.error("Failed to dismiss holiday assignment notification:", err);
        }
      }
      if (notif.type === "SECURITY_DECISION" || notif.type === "HR_APPROVAL_DECISION" || notif.type === "PROFILE_DECISION" || notif.type === "PERMISSION_DECISION" || notif.type === "EDIT_DECISION") {
        try {
          await portalInstance.put(`/api/notifications/${notif.id}/read`);
        } catch (err) {
          console.error("Failed to read notification:", err);
        }
      }
      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== notif.id);
        SIDEBAR_CACHE.notifications = next;
        return next;
      });
    }
  };

  // ── Clear All Notifications ──
  const handleClearAll = async () => {
    if (role === "admin") {
      const keys = JSON.parse(
        localStorage.getItem(`dismissedNotificationKeys_${loggedInUserId}`) || "[]"
      );
      notifications.forEach((n) => {
        if (!keys.includes(n.uniqueKey)) {
          keys.push(n.uniqueKey);
        }
      });
      localStorage.setItem(`dismissedNotificationKeys_${loggedInUserId}`, JSON.stringify(keys));
      setNotifications([]);
      SIDEBAR_CACHE.notifications = [];
    } else {
      const dismissedIds = JSON.parse(
        localStorage.getItem(`dismissedNotifications_${loggedInUserId}`) || "[]"
      );
      await Promise.all(
        notifications.map(async (n) => {
          if (!dismissedIds.includes(n.id)) {
            dismissedIds.push(n.id);
          }
          if (n.type === "APPROVED" || n.type === "CANCEL") {
            try {
              await portalInstance.put(`/api/leaves/${n.id}/dismiss`);
            } catch (err) {
              console.error("Failed to dismiss leave notification:", err);
            }
          }
          if (
            n.type === "HOLIDAY_CALENDAR_APPROVED" ||
            n.type === "HOLIDAY_CALENDAR" ||
            (typeof n.id === "string" && n.id.startsWith("calendar-"))
          ) {
            try {
              const assignId = n.assignmentId || n.id.replace(/^calendar-(?:approved-)?/, "");
              await portalInstance.put(`/holiday-assignments/${assignId}/dismiss`);
            } catch (err) {
              console.error("Failed to dismiss holiday assignment notification:", err);
            }
          }
          if (
            n.type === "SECURITY_DECISION" ||
            n.type === "PROFILE_DECISION" ||
            n.type === "HR_APPROVAL_DECISION" ||
            n.type === "PERMISSION_DECISION" ||
            n.type === "EDIT_DECISION"
          ) {
            try {
              await portalInstance.put(`/api/notifications/${n.id}/read`);
            } catch (err) {
              console.error("Failed to read notification:", err);
            }
          }
        })
      );
      localStorage.setItem(`dismissedNotifications_${loggedInUserId}`, JSON.stringify(dismissedIds));
      setNotifications([]);
      SIDEBAR_CACHE.notifications = [];
    }
  };

  // ── Click Notification Item ──
  const handleNotifClick = async (notif) => {
    setShowNotificationsDropdown(false);
    if (role === "admin") {
      const keys = JSON.parse(
        localStorage.getItem(`dismissedNotificationKeys_${loggedInUserId}`) || "[]"
      );
      if (!keys.includes(notif.uniqueKey)) {
        keys.push(notif.uniqueKey);
        localStorage.setItem(`dismissedNotificationKeys_${loggedInUserId}`, JSON.stringify(keys));
      }
      setNotifications((prev) => {
        const next = prev.filter((n) => n.uniqueKey !== notif.uniqueKey);
        SIDEBAR_CACHE.notifications = next;
        return next;
      });
      if (notif.category === "instagram") {
        try {
          await portalInstance.put(`/api/notifications/${notif.id}/read`);
        } catch (_) { }
        navigate(notif.url || "/social-media/instagram");
      } else if (notif.category === "system" && notif.url) {
        try {
          await portalInstance.put(`/api/notifications/${notif.id}/read`);
        } catch (_) { }
        navigate(notif.url);
      } else if (notif.category === "holiday") {
        navigate("/admin/holiday-management");
      } else if (notif.category === "security") {
        navigate("/admin/checker-dashboard");
      } else if (notif.category === "hr_approval") {
        if (notif.url) {
          navigate(notif.url);
        } else if (notif.targetModule === "GOV_HOLIDAY" || notif.targetModule === "HOLIDAY") {
          navigate("/admin/holiday-management");
        } else if (notif.targetModule === "SALARY_SLIP") {
          navigate("/admin/payslip-generator");
        } else if (
          notif.targetModule === "LEAVE_CATEGORY" ||
          notif.targetModule === "LEAVE_MANAGEMENT" ||
          (notif.title && notif.title.toLowerCase().includes("leave category")) ||
          (notif.message && notif.message.toLowerCase().includes("leave category"))
        ) {
          navigate("/admin/leave-management");
        } else if (notif.targetModule === "EMPLOYEE") {
          navigate("/admin/employees/manage-employee");
        } else {
          navigate("/admin/leaves");
        }
      } else {
        navigate("/admin/leaves");
      }
    } else {
      const dismissedIds = JSON.parse(
        localStorage.getItem(`dismissedNotifications_${loggedInUserId}`) || "[]"
      );
      if (!dismissedIds.includes(notif.id)) {
        dismissedIds.push(notif.id);
        localStorage.setItem(`dismissedNotifications_${loggedInUserId}`, JSON.stringify(dismissedIds));
      }
      if (notif.type === "APPROVED" || notif.type === "CANCEL") {
        try {
          await portalInstance.put(`/api/leaves/${notif.id}/dismiss`);
        } catch (err) {
          console.error("Failed to dismiss leave notification:", err);
        }
      }
      if (
        notif.type === "HOLIDAY_CALENDAR_APPROVED" ||
        notif.type === "HOLIDAY_CALENDAR" ||
        (typeof notif.id === "string" && notif.id.startsWith("calendar-"))
      ) {
        try {
          const assignId = notif.assignmentId || notif.id.replace(/^calendar-(?:approved-)?/, "");
          await portalInstance.put(`/holiday-assignments/${assignId}/dismiss`);
        } catch (err) {
          console.error("Failed to dismiss holiday assignment notification:", err);
        }
      }
      if (notif.type === "SECURITY_DECISION" || notif.type === "HR_APPROVAL_DECISION" || notif.type === "PROFILE_DECISION" || notif.type === "PERMISSION_DECISION" || notif.type === "EDIT_DECISION") {
        try {
          await portalInstance.put(`/api/notifications/${notif.id}/read`);
        } catch (err) {
          console.error("Failed to read notification:", err);
        }
      }
      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== notif.id);
        SIDEBAR_CACHE.notifications = next;
        return next;
      });
      if (notif.type === "PERMISSION_DECISION") {
        navigate(notif.url || "/emp/request-leave");
      } else if (notif.type === "PROFILE_DECISION" || notif.type === "EDIT_DECISION") {
        navigate(notif.url || "/emp/my-details");
      } else if (notif.type === "TASK") {
        navigate("/emp/tasks");
      } else if (notif.type === "HOLIDAY_CALENDAR" || notif.type === "HOLIDAY_CALENDAR_APPROVED") {
        navigate("/emp/holiday-requests");
      } else if (notif.type === "SECURITY" || notif.type === "SECURITY_DECISION") {
        navigate("/emp/marker");
      } else if (notif.type === "HR_APPROVAL_DECISION") {
        const titleLower = (notif.title || "").toLowerCase();
        const msgLower = (notif.message || "").toLowerCase();
        const mod = (notif.targetModule || "").toUpperCase();

        if (notif.url) {
          navigate(notif.url);
        } else if (
          mod === "EMPLOYEE" ||
          titleLower.includes("employee") ||
          titleLower.includes("salary") ||
          msgLower.includes("salary") ||
          msgLower.includes("profile") ||
          msgLower.includes("bank")
        ) {
          navigate("/admin/employees/manage-employee");
        } else if (mod === "GOV_HOLIDAY" || mod === "HOLIDAY" || titleLower.includes("holiday") || msgLower.includes("holiday")) {
          navigate("/admin/holiday-management");
        } else if (mod === "SALARY_SLIP" || titleLower.includes("salary slip") || msgLower.includes("salary slip")) {
          navigate("/admin/payslip-generator");
        } else if (
          mod === "LEAVE_CATEGORY" ||
          mod === "LEAVE_MANAGEMENT" ||
          titleLower.includes("leave category") ||
          msgLower.includes("leave category")
        ) {
          navigate("/admin/leave-management");
        } else {
          navigate("/admin/employees/manage-employee");
        }
      } else {
        navigate("/emp/request-leave");
      }
    }
  };

  // ── Accept Task ──
  const handleAcceptTask = async (e, taskId) => {
    e.stopPropagation();
    if (!taskId) return;
    try {
      const fd = new FormData();
      fd.append("status", "pending");
      fd.append("assignedStatus", "Accepted");
      await portalInstance.put(`/creat/task/${taskId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Task Accepted successfully!");
      const dismissedIds = JSON.parse(
        localStorage.getItem(`dismissedNotifications_${loggedInUserId}`) || "[]"
      );
      if (!dismissedIds.includes(taskId)) {
        dismissedIds.push(taskId);
        localStorage.setItem(`dismissedNotifications_${loggedInUserId}`, JSON.stringify(dismissedIds));
      }
      setNotifications((prev) => prev.filter((n) => n.id !== taskId));
    } catch (err) {
      console.error("Accept task error:", err);
      toast.error("Failed to accept task.");
    }
  };


  const today = new Date();
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();

  const calendarDates = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarDates.push({ day: prevMonthLastDay - i, current: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDates.push({ day: i, current: true });
  }
  const totalSlots = 42;
  while (calendarDates.length < totalSlots) {
    calendarDates.push({
      day: calendarDates.length - (firstDayOfMonth + daysInMonth) + 1,
      current: false,
    });
  }

  const isSecondOrFourthSaturday = (day) => {
    const date = new Date(today.getFullYear(), today.getMonth(), day);
    if (date.getDay() !== 6) return false;
    const weekOfMonth = Math.ceil(day / 7);
    return weekOfMonth === 2 || weekOfMonth === 4;
  };

  const holidayDays = React.useMemo(() => {
    if (!calendarMonthlyData?.calendarDays) return new Set();
    return new Set(
      calendarMonthlyData.calendarDays
        .filter((d) => d.month === "current" && d.status === "holiday")
        .map((d) => d.day)
    );
  }, [calendarMonthlyData]);

  /* ══════════════════════════════════════════
     USER DATA
  ══════════════════════════════════════════ */

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const stored = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");

        // ⚡ OPTIMIZATION (Step 2): Use cached user profile for 3 hours (3 * 3600 * 1000 ms)
        const now = Date.now();
        const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
        const loginTimeStr = sessionStorage.getItem("loginTime");
        const loginTime = loginTimeStr ? new Date(loginTimeStr).getTime() : SIDEBAR_CACHE.profileFetchedAt;
        const isProfileFresh = (now - loginTime) < THREE_HOURS_MS;

        if (stored?.token && stored?.name && stored?.role && isProfileFresh) {
          roleSetByAPI.current = true;
          setUser(stored);
          setRole(stored.role);
          setUserLoading(false);
          return;
        }

        setUserLoading(true);
        setRole(null);
        roleSetByAPI.current = false;

        if (stored?.token) {
          try {
            const res = await portalInstance.get("/profile/get-profile");
            const emp = res?.data?.data;

            if (emp) {
              const fullUserData = {
                ...stored,
                _id: emp._id,
                name: emp.name || stored.name || "User",
                photo: emp.photo || emp.picture || stored.photo || "",
                role: emp.role || stored.role,
                designation: emp.designation || stored.designation,
                email: emp.email || stored.email,
                empId: emp.employeeId || emp.empId || stored.empId,
                username: emp.username || stored.username,
                phone: emp.phone || stored.phone,
                department: emp.department?.name || emp.department || stored.department,
                doj: emp.dateOfJoining
                  ? new Date(emp.dateOfJoining).toLocaleDateString("en-IN")
                  : (stored.doj || "N/A"),
                dateJoined: emp.dateOfJoining || stored.dateJoined,
                isHr: !!emp.isHr,
                permissions: Array.isArray(emp.permissions)
                  ? emp.permissions
                  : (stored.permissions || []),
                token: stored.token,
                profileCompletion: emp.profileCompletion !== undefined ? Number(emp.profileCompletion) : Number(stored.profileCompletion ?? 0),
                isProfileCompleted: emp.isProfileCompleted ?? (Number(emp.profileCompletion ?? stored.profileCompletion ?? 0) >= 100 || stored.isProfileCompleted),
                isProfileRestricted: (Number(emp.profileCompletion ?? stored.profileCompletion ?? 0) >= 100 || emp.isProfileCompleted || stored.isProfileCompleted) ? false : stored.isProfileRestricted,
                profileApprovalStatus: emp.profileApprovalStatus || stored.profileApprovalStatus,
                daysRemainingForProfile: stored.daysRemainingForProfile,
                profileDeadline: stored.profileDeadline,
              };

              roleSetByAPI.current = true;
              setUser(fullUserData);
              setRole(fullUserData.role);
              SIDEBAR_CACHE.profileFetchedAt = Date.now();

              sessionStorage.setItem("Erti-Portal", JSON.stringify(fullUserData));

              setUserLoading(false);
              return;
            }
          } catch (apiErr) {
            console.error("Profile API failed:", apiErr);
          }
        }

        if (stored?.name) {
          const fallbackUser = {
            ...stored,
            name: stored.name || "User",
            photo: stored.photo || "",
            role: stored.role || "employee",
            designation: stored.designation || "",
            email: stored.email || "",
            empId: stored.empId || "",
            isHr: !!stored.isHr,
            permissions: stored.permissions || [],
            token: stored.token,
          };
          setUser(fallbackUser);
          setRole(stored.role || "employee");
        } else {
          setRole("employee");
        }
      } catch (err) {
        console.error("User load failed:", err);
        const stored = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
        setUser({ ...stored, name: stored.name || "User", photo: "", role: stored.role || "employee", token: stored.token });
        setRole(stored.role || "employee");
      } finally {
        setUserLoading(false);
      }
    };

    loadUserData();

    const handlePermUpdate = () => {
      SIDEBAR_CACHE.profileFetchedAt = 0; // Invalidate cache so fresh permissions are loaded
      loadUserData();
    };
    window.addEventListener("menuPermissionsUpdated", handlePermUpdate);
    return () => {
      window.removeEventListener("menuPermissionsUpdated", handlePermUpdate);
    };
  }, []);

  /* ══════════════════════════════════════════
     PROFILE COMPLETION
  ══════════════════════════════════════════ */
  useEffect(() => {
    const fetchCompletion = async () => {
      if (role !== "employee") return;

      // ⚡ OPTIMIZATION 4: If profile completion is already 100%, skip API call entirely
      const stored = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
      const existingScore = Number(user?.profileCompletion ?? stored?.profileCompletion ?? -1);
      if (existingScore >= 100 || user?.isProfileCompleted || stored?.isProfileCompleted) {
        setProfileCompletion(100);
        SIDEBAR_CACHE.profileCompletion = 100;
        return;
      }

      // If cached in memory for session, reuse without hitting API
      if (SIDEBAR_CACHE.profileCompletion !== null) {
        setProfileCompletion(SIDEBAR_CACHE.profileCompletion);
        return;
      }

      try {
        const storedScore = sessionStorage.getItem("sidebar_profile_completion");
        if (storedScore !== null) {
          const num = Number(storedScore);
          SIDEBAR_CACHE.profileCompletion = num;
          setProfileCompletion(num);
          return;
        }
      } catch (_) {}

      try {
        const res = await portalInstance.get("/data/completion");
        if (res.data.success) {
          const score = Number(res.data.profileCompletion || 0);
          setProfileCompletion(score);
          SIDEBAR_CACHE.profileCompletion = score;
          try { sessionStorage.setItem("sidebar_profile_completion", String(score)); } catch (_) {}
        }
      } catch (err) {
        console.error("Sidebar completion fetch failed", err);
      }
    };
    fetchCompletion();
  }, [role, user]);

  useEffect(() => {
    if (roleSetByAPI.current) return;
    if (user?.role) {
      setRole(user.role);
    }
  }, [user]);

  /* ══════════════════════════════════════════
     CALENDAR DATA
  ══════════════════════════════════════════ */

  useEffect(() => {
    if (!role) return;

    const fetchCalendarData = async () => {
      try {
        const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = MONTHS[today.getMonth()];
        const year = today.getFullYear();
        const currentKey = `${role}_${month}_${year}_${loggedInUserId || "me"}`;

        // ⚡ OPTIMIZATION 3: Check in-memory calendar cache for current month
        if (SIDEBAR_CACHE.calendarKey === currentKey && SIDEBAR_CACHE.calendarData) {
          setCalendarMonthlyData(SIDEBAR_CACHE.calendarData);
          return;
        }

        // Also check sessionStorage
        try {
          const storedCal = sessionStorage.getItem(`sidebar_calendar_${currentKey}`);
          if (storedCal) {
            const parsed = JSON.parse(storedCal);
            SIDEBAR_CACHE.calendarKey = currentKey;
            SIDEBAR_CACHE.calendarData = parsed;
            setCalendarMonthlyData(parsed);
            return;
          }
        } catch (_) {}

        if (role === "employee") {
          const res = await portalInstance.get(`/portal/attendance/monthly?month=${month}&year=${year}`);
          const data = res.data.data || null;
          SIDEBAR_CACHE.calendarKey = currentKey;
          SIDEBAR_CACHE.calendarData = data;
          setCalendarMonthlyData(data);
          try { sessionStorage.setItem(`sidebar_calendar_${currentKey}`, JSON.stringify(data)); } catch (_) {}
        } else {
          const res = await portalInstance.get(`/users/attendance/govholidays?year=${year}`);
          const holidays = res.data?.data || [];
          const currentMonth = today.getMonth();
          const calendarDays = holidays
            .filter((h) => new Date(h.date).getMonth() === currentMonth)
            .map((h) => ({ day: new Date(h.date).getDate(), month: "current", status: "holiday" }));
          const data = { calendarDays };
          SIDEBAR_CACHE.calendarKey = currentKey;
          SIDEBAR_CACHE.calendarData = data;
          setCalendarMonthlyData(data);
          try { sessionStorage.setItem(`sidebar_calendar_${currentKey}`, JSON.stringify(data)); } catch (_) {}
        }
      } catch (err) {
        console.error("Sidebar calendar data fetch failed", err);
        setCalendarMonthlyData(null);
      }
    };

    fetchCalendarData();
  }, [role, loggedInUserId]);

  /* ══════════════════════════════════════════
     HOLIDAY ASSIGNMENT CHECK
  ══════════════════════════════════════════ */

  useEffect(() => {
    const checkHolidayAssignment = async () => {
      if (role !== "employee") return;

      // ⚡ OPTIMIZATION 5: Cache holiday assignment in memory & session state
      if (SIDEBAR_CACHE.hasHolidayAssignment !== null) {
        setHasHolidayAssignment(SIDEBAR_CACHE.hasHolidayAssignment);
        return;
      }

      try {
        const stored = sessionStorage.getItem(`hasHolidayAssignment_${loggedInUserId || "me"}`);
        if (stored !== null) {
          const val = stored === "true";
          SIDEBAR_CACHE.hasHolidayAssignment = val;
          setHasHolidayAssignment(val);
          return;
        }
      } catch (_) {}

      try {
        const res = await portalInstance.get("/holiday-assignments/my");
        const result = res.data;
        const hasAssignment = (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) || false;
        setHasHolidayAssignment(hasAssignment);
        SIDEBAR_CACHE.hasHolidayAssignment = hasAssignment;
        try { sessionStorage.setItem(`hasHolidayAssignment_${loggedInUserId || "me"}`, String(hasAssignment)); } catch (_) {}
      } catch {
        setHasHolidayAssignment(false);
        SIDEBAR_CACHE.hasHolidayAssignment = false;
      }
    };
    checkHolidayAssignment();
  }, [role, loggedInUserId]);

  /* ══════════════════════════════════════════
     ACTIVE ROUTE DETECTION
  ══════════════════════════════════════════ */

  useEffect(() => {
    if (!role) return;
    if (manualNav) { setManualNav(false); return; }

    const path = location.pathname.toLowerCase();
    let parent = "";
    let child = "";
    let nestedParent = "";

    if (path.includes("/hr-requests")) {
      parent = "HR Requests";
      child = "";
      if (user?.isHr) {
        setIsHrSectionOpen(true);
      }
    }
    else if (path.includes("/todo-list")) {
      parent = "To Do List";
    }
    else if (path.includes("/website-content")) {
      parent = "Website";
    }
    else if (path.includes("/social-media/facebook")) {
      parent = "Social Media";
      child = "Facebook";
    }
    else if (path.includes("/social-media/instagram") || path.startsWith("/care")) {
      parent = "Social Media";
      child = "Instagram";
    }

    if (path.startsWith("/crawler")) {
      parent = "Web Crawler";
    }
    else if (path.includes("/payslip-generator") || path.includes("/appointment-letter") || path.includes("/termination-letter") || path.includes("/increment-letter")) {
      parent = "Slip Generation";
      if (path.includes("/payslip-generator")) child = "Payslip";
      else if (path.includes("/appointment-letter")) child = "Appointment Letter";
      else if (path.includes("/termination-letter")) child = "Termination Letter";
      else if (path.includes("/increment-letter")) child = "Increment Letter";
    }
    else if (path.includes("/employees/add-employee")) {
      parent = "Employees";
      child = "Add Employee";
    }
    else if (path.includes("/employees/manage-employee") || path.includes("/employees/view") || path.includes("/employees/") && path.includes("/edit")) {
      parent = "Employees";
      child = "Manage Employee";
    }
    else if (role === "admin") {
      if (path.includes("/admin/holiday-management")) { parent = "Leaves & Holidays"; child = "Holiday Configuration"; }
      else if (path.includes("/admin/holiday")) { parent = "Leaves & Holidays"; child = "Holiday List"; }
      else if (path.includes("/employees/add-employee")) { parent = "Employees"; child = "Add Employee"; }
      else if (path.includes("/employees/manage-employee")) { parent = "Employees"; child = "Manage Employee"; }
      else if (path.includes("/attendance")) { parent = "Attendance"; child = (path.includes("report") || path.includes("preview")) ? "Attendance Report" : "Daily Report"; }
      else if (path.includes("/project-details")) parent = "Project Details";
      else if (path.includes("/dashboard")) parent = "Dashboard";
      else if (path.includes("/tasks/analytics")) { parent = "Tasks"; child = "Task Analytics"; }
      else if (path.includes("/tasks")) { parent = "Tasks"; child = "Task List"; }
      else if (path.includes("/daily-work-updates")) parent = "Daily Work Update";
      // ✅ FIX: /admin/checker-dashboard now correctly maps to "Operation Hub"
      else if (path.includes("/checker-dashboard") || path.includes("/approver-dashboard")) parent = "Operation Hub";
      else if (path.includes("/leave-management")) { parent = "Leaves & Holidays"; child = "Manage Leaves"; }
      else if (path.includes("/leaves")) { parent = "Leaves & Holidays"; child = "Leave Requests"; }
      else if (path.includes("/employee-leaves") || path.includes("/employee-leave-list")) parent = "Employee Leaves";
      else if (path.includes("/admin/audit")) {
        parent = "Audit Dashboard";
        child = "";
      }

      else if (path.includes("/admin/configuration")) {
        parent = "Configuration";
        child = "";
      }
    } else {
      if (path.includes("/holiday-management")) parent = "Holiday Management";
      else if (path.includes("/leave-management")) {
        parent = "Leaves & Holidays";
        child = "Manage Leaves";
      }
      else if (path.includes("/dashboard")) parent = "Dashboard";
      else if (path.includes("/remainder")) parent = "Remainder";
      else if (path.includes("/my-details")) parent = "My Details";
      else if (path.includes("/request-leave")) parent = "Request Management";
      else if (path.includes("/holidays")) parent = "Holidays List";
      else if (path.includes("/tasks/analytics")) { parent = "Tasks"; child = "Task Analytics"; }
      else if (path.includes("/tasks") || path.includes("/update-task") || path.includes("/create-task")) { parent = "Tasks"; child = "My Tasks"; }
      else if (path.includes("/daily-work-updates")) parent = "Work Updates";
      else if (path.includes("/checker")) parent = "Checker";
      // ✅ FIX: /emp/marker now correctly maps to "Maker" menu item
      else if (path.includes("/marker")) parent = "Operation Hub";
      else if (path.includes("/admin/attendance-report") || path.includes("/admin/attendance-preview") || (user?.isHr && (path.includes("/attendance-report") || path.includes("/attendance-preview")))) {
        parent = "Employee Attendance";
        child = "Attendance Report";
      }
      else if (path.includes("/admin/attendance") || (user?.isHr && path.includes("/attendance") && !path.includes("/emp/attendance"))) {
        parent = "Employee Attendance";
        child = "Daily Report";
      }
      else if (path.includes("/emp/attendance-overview")) {
        parent = "Attendance Details";
        child = "Overview";
      }
      else if (path.includes("/emp/attendance")) {
        parent = "Attendance Details";
        child = "Attendance Page";
      }
      else if (path.includes("/salary-slip")) parent = "Salary Slip";
      else if (path.includes("/holiday-requests") || path.includes("/holiday-calendar")) {
        parent = "Leaves & Holidays";
        child = "Holiday Requests";
      }
      else if (path.includes("/emp/audit")) {
        parent = "Audit Management";
        child = "Access Control";
      }
      else if (path.includes("/emp/payment-scripts")) {
        parent = "Audit Management";
        child = "Payment Scripts";
      }
      else if (path.includes("/emp/vendors")) {
        parent = "Audit Management";
        child = "Inscope Vendors";
      }
    }

    setActiveItem((prev) => (prev !== parent ? parent : prev));
    setActiveSubItem((prev) => (prev !== child ? child : prev));
    setActiveNestedItem((prev) => (prev !== nestedParent ? nestedParent : prev));
    setOpenMenus((prev) => {
      if (prev[parent]) return prev;
      return { [parent]: true };
    });
    if (nestedParent) {
      setOpenSubMenus({ [nestedParent]: true });
    }
    if (["Employees", "Employee Attendance", "Leaves & Holidays", "Leave & Holidays", "Slip Generation", "HR Requests"].includes(parent)) {
      setIsHrSectionOpen(true);
    }
    setIsMobileMenuOpen(false);
  }, [location.pathname, role, manualNav, user?.isHr]);

  /* ══════════════════════════════════════════
     SIDEBAR SCROLL POSITION RESTORATION
  ══════════════════════════════════════════ */
  useEffect(() => {
    const restoreScroll = () => {
      if (!scrollContentRef.current) return;
      const savedPos = sessionStorage.getItem("sidebar_scroll_pos");
      if (savedPos !== null && !isNaN(Number(savedPos))) {
        scrollContentRef.current.scrollTop = Number(savedPos);
      }
      const activeElem =
        scrollContentRef.current.querySelector(".sidebar-submenu-item.sub-active") ||
        scrollContentRef.current.querySelector(".sidebar-menu-item.active");
      if (activeElem) {
        activeElem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };

    restoreScroll();
    const t1 = setTimeout(restoreScroll, 60);
    const t2 = setTimeout(restoreScroll, 200);
    const t3 = setTimeout(restoreScroll, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [location.pathname, activeItem, activeSubItem, isHrSectionOpen, role]);

  /* ══════════════════════════════════════════
     MENU HANDLERS
  ══════════════════════════════════════════ */

  const toggleMenu = (menuTitle) => {
    if (scrollContentRef.current) {
      sessionStorage.setItem("sidebar_scroll_pos", String(scrollContentRef.current.scrollTop));
    }
    setOpenMenus((prev) => {
      const isOpen = !!prev[menuTitle];
      if (isOpen) {
        setActiveItem("");
        setActiveSubItem("");
        setActiveNestedItem("");
        return {};
      }
      setActiveItem(menuTitle);
      return { [menuTitle]: true };
    });
  };

  const toggleSubMenu = (menuTitle) => {
    if (scrollContentRef.current) {
      sessionStorage.setItem("sidebar_scroll_pos", String(scrollContentRef.current.scrollTop));
    }
    setOpenSubMenus((prev) => {
      const isOpen = !!prev[menuTitle];
      if (isOpen) {
        return {};
      }
      return { [menuTitle]: true };
    });
  };

  const handleNavigate = (path, parent, sub = "", keepMenuOpen = false, nestedParent = "") => {
    if (scrollContentRef.current) {
      sessionStorage.setItem("sidebar_scroll_pos", String(scrollContentRef.current.scrollTop));
    }
    if (path === "/crawler") {
      window.open("/crawler", "_blank");
      return;
    }

    const storedUser = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
    const activeUser = { ...storedUser, ...(user || {}) };
    if (Number(activeUser.profileCompletion ?? 0) >= 100) {
      activeUser.isProfileCompleted = true;
      activeUser.isProfileRestricted = false;
    }
    const restriction = checkProfileRestriction(activeUser);
    if (
      restriction.isRestricted &&
      path !== "/emp/my-details" &&
      path !== "/emp/my-details/edit" &&
      path !== "/profile"
    ) {
      toast.warning(
        "Profile completion is required (100%). Access to other dashboard pages is restricted until your profile is completed."
      );
      navigate("/emp/my-details/edit");
      setIsMobileMenuOpen(false);
      return;
    }
    setManualNav(true);
    navigate(path);
    setActiveItem(parent);
    setActiveSubItem(sub);
    setActiveNestedItem(nestedParent);
    if (!keepMenuOpen) {
      setOpenMenus({});
      setOpenSubMenus({});
    } else if (nestedParent) {
      setOpenSubMenus({ [nestedParent]: true });
    }
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      const fcmToken = sessionStorage.getItem("fcm_token");
      if (fcmToken) {
        await portalInstance.post("/api/notifications/remove-token", { token: fcmToken }).catch(() => { });
      }
    } catch (err) {
      console.error("[FCM] Failed to remove token on logout:", err);
    }

    try {
      await deleteToken(messaging);
      console.log("[FCM] Token deleted successfully on logout");
    } catch (err) {
      console.error("[FCM] Failed to delete token on logout:", err);
    }

    sessionStorage.removeItem("fcm_user_id");

    sessionStorage.clear();
    setUser(null);
    setRole(null);
    window.location.href = "/";
  };

  const hasUserMenuPermission = (moduleName, subMenuName = null) => {
    const userPermissions = user?.permissions || [];
    if (!Array.isArray(userPermissions) || userPermissions.length === 0) return false;

    const clean = (str) =>
      (str || "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/leaves/g, "leave")
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/g, "");

    const targetMod = clean(moduleName);
    const targetSub = subMenuName ? clean(subMenuName) : null;

    return userPermissions.some((p) => {
      if (!p || p.permission === "NO_ACCESS") return false;
      const pMod = clean(p.module);
      if (pMod !== targetMod) return false;

      // If user has permission for the whole module (subMenu is null/empty/undefined or "Entire Menu")
      if (!p.subMenu || clean(p.subMenu) === "" || clean(p.subMenu) === clean("Entire Menu (All Submenus)")) {
        return true;
      }

      // If checking for a specific subMenu
      if (targetSub) {
        const pSub = clean(p.subMenu);
        if (pSub === targetSub) return true;
        // Handle alias between Manage Leaves and Leave Management
        if (
          (targetSub === "manageleave" || targetSub === "manageleaves" || targetSub === "leavemanagement") &&
          (pSub === "manageleave" || pSub === "manageleaves" || pSub === "leavemanagement")
        ) {
          return true;
        }
        return false;
      }

      return true;
    });
  };

  const adminMenu = [
    { title: "Dashboard", iconName: "Dashboard", path: "/admin/dashboard" },
    {
      title: "Employees", iconName: "Employee", subItems: [
        { label: "Add Employee", path: "/admin/employees/add-employee", iconName: "Add" },
        { label: "Manage Employee", path: "/admin/employees/manage-employee", iconName: "Manage Employee" },
      ]
    },
    {
      title: "Attendance", iconName: "Attendance", subItems: [
        { label: "Daily Report", path: "/admin/attendance", iconName: "Attendance" },
        { label: "Attendance Report", path: "/admin/attendance-report", iconName: "Attendance" },
      ]
    },
    {
      title: "Tasks",
      iconName: "Tasks",
      subItems: [
        { label: "Task List", path: "/admin/tasks", iconName: "Tasks" },
        { label: "Task Analytics", path: "/admin/tasks/analytics", iconName: "Tasks" },
      ]
    },
    { title: "Daily Work Update", iconName: "Admin Daily Work Update", path: "/admin/daily-work-updates" },
    { title: "Project Details", iconName: "Tasks", path: "/admin/project-details" },
    {
      title: "Leaves & Holidays",
      iconName: "Leave Requests",
      subItems: [
        { label: "Leave Requests", path: "/admin/leaves", iconName: "Leave Requests" },
        { label: "Manage Leaves", path: "/admin/leave-management", iconName: "Manage Employee" },
        { label: "Holiday List", path: "/admin/Holiday", iconName: "Holidays List" },
        { label: "Holiday Configuration", path: "/admin/holiday-management", iconName: "Audit Management" }
      ]
    },
    { title: "Operation Hub", iconName: "Operation Hub", path: "/admin/checker-dashboard" },
    {
      title: "Slip Generation",
      iconName: "Salary Slip",
      subItems: [
        { label: "Payslip", path: "/admin/payslip-generator", iconName: "Salary Slip" },
        { label: "Appointment Letter", path: "/admin/appointment-letter", iconName: "Salary Slip" },
        { label: "Termination Letter", path: "/admin/termination-letter", iconName: "Salary Slip" },
        { label: "Increment Letter", path: "/admin/increment-letter", iconName: "Salary Slip" }
      ]
    },
    { title: "HR Requests", iconName: "Leave Requests", path: "/admin/hr-requests" },
    { title: "Configuration", iconName: "Configuration", path: "/admin/configuration" },
    { title: "Audit Dashboard", iconName: "Audit Dashboard", path: "/admin/audit" },
    {
      title: "Web Crawler",
      iconName: "Audit Dashboard",
      path: "/crawler",
    },

    // {
    //   title: "Social Media",
    //   iconName: "Social Media",
    //   subItems: [
    //     { label: "Instagram", path: "/social-media/instagram", iconName: "Instagram" },
    //     { label: "Facebook", path: "/social-media/facebook", iconName: "Facebook" }
    //   ]
    // },
  ];

  const employeeMenuFull = [
    { title: "Dashboard", iconName: "Dashboard", path: "/emp/dashboard" },
    {
      title: "Attendance Details",
      iconName: "Attendance",
      subItems: [
        { label: "Attendance Page", path: "/emp/attendance", iconName: "Attendance" },
        { label: "Overview", path: "/emp/attendance-overview", iconName: "Attendance" },
      ],
    },
    { title: "My Details", iconName: "Employee", path: "/emp/my-details" },
    { title: "Request Management", iconName: "Leave Requests", path: "/emp/request-leave" },
    { title: "Holidays List", iconName: "Holidays List", path: "/emp/holidays" },
    {
      title: "Tasks",
      iconName: "Tasks",
      subItems: [
        { label: "My Tasks", path: "/emp/tasks", iconName: "Tasks" },
        { label: "Task Analytics", path: "/emp/tasks/analytics", iconName: "Tasks" },
      ]
    },
    { title: "Work Updates", iconName: "Work Updates", path: "/emp/daily-work-updates" },
    { title: "Operation Hub", iconName: "Operation Hub", path: "/emp/marker" },
    { title: "Salary Slip", iconName: "Salary Slip", path: "/emp/salary-slip" },
    ...(!user?.isHr
      ? [
        {
          title: "Leaves & Holidays",
          iconName: "Leave Requests",
          subItems: [
            { label: "Holiday Requests", path: "/emp/holiday-requests", iconName: "Leave Requests", requiresHolidayAssignment: true },
            { label: "Manage Leaves", path: "/admin/leave-management", iconName: "Manage Employee" },
            { label: "Leave Requests", path: "/admin/leaves", iconName: "Leave Requests" },
            { label: "Holiday List", path: "/admin/Holiday", iconName: "Holidays List" },
            { label: "Holiday Configuration", path: "/admin/holiday-management", iconName: "Audit Management" },
          ],
        },
      ]
      : []),
    {
      title: "Audit Management",
      iconName: "Audit Management",
      subItems: [
        { label: "Access Control", path: "/emp/audit", iconName: "Access Control" },
        { label: "Payment Scripts", path: "/emp/payment-scripts", iconName: "Payment Scripts" },
        { label: "Inscope Vendors", path: "/emp/vendors", iconName: "Inscope Vendors" }
      ]
    },
    {
      title: "Web Crawler",
      iconName: "Audit Dashboard",
      path: "/crawler",
    },
    ...(!user?.isHr
      ? [
        ...(hasUserMenuPermission("Employees") ? [{
          title: "Employees",
          iconName: "Employee",
          subItems: [
            { label: "Add Employee", path: "/admin/employees/add-employee", iconName: "Add" },
            { label: "Manage Employee", path: "/admin/employees/manage-employee", iconName: "Manage Employee" },
          ].filter(s => hasUserMenuPermission("Employees", s.label))
        }].filter(m => m.subItems.length > 0) : []),

        ...(hasUserMenuPermission("Attendance") ? [{
          title: "Employee Attendance",
          iconName: "Attendance",
          subItems: [
            { label: "Daily Report", path: "/admin/attendance", iconName: "Attendance" },
            { label: "Attendance Report", path: "/admin/attendance-report", iconName: "Attendance" },
          ].filter(s => hasUserMenuPermission("Attendance", s.label))
        }].filter(m => m.subItems.length > 0) : []),

        ...(hasUserMenuPermission("Daily Work Update") ? [{
          title: "Daily Work Update",
          iconName: "Admin Daily Work Update",
          path: "/admin/daily-work-updates"
        }] : []),

        ...(hasUserMenuPermission("Project Details") ? [{
          title: "Project Details",
          iconName: "Tasks",
          path: "/admin/project-details"
        }] : []),

        ...(hasUserMenuPermission("Slip Generation") ? [{
          title: "Slip Generation",
          iconName: "Salary Slip",
          subItems: [
            { label: "Payslip", path: "/admin/payslip-generator", iconName: "Salary Slip" },
            { label: "Appointment Letter", path: "/admin/appointment-letter", iconName: "Salary Slip" },
            { label: "Termination Letter", path: "/admin/termination-letter", iconName: "Salary Slip" },
            { label: "Increment Letter", path: "/admin/increment-letter", iconName: "Salary Slip" },
          ].filter(s => hasUserMenuPermission("Slip Generation", s.label))
        }].filter(m => m.subItems.length > 0) : []),

        ...(hasUserMenuPermission("HR Requests") ? [{
          title: "HR Requests",
          iconName: "Leave Requests",
          path: "/admin/hr-requests"
        }] : [])
      ]
      : []),
    // {
    //   title: "Social Media",
    //   iconName: "Social Media",
    //   subItems: [
    //     { label: "Instagram", path: "/social-media/instagram", iconName: "Instagram" },
    //     { label: "Facebook", path: "/social-media/facebook", iconName: "Facebook" }
    //   ]
    // },

    ...(user?.isHr
      ? (() => {
          const hrConfig = getCachedHrAccessConfig();
          const empSubItems = [];
          if (canHrAddEmployee(user, hrConfig)) {
            empSubItems.push({ label: "Add Employee", path: "/admin/employees/add-employee", iconName: "Add" });
          }
          if (canHrViewEmployee(user, hrConfig)) {
            empSubItems.push({ label: "Manage Employee", path: "/admin/employees/manage-employee", iconName: "Manage Employee" });
          }

          const attSubItems = [];
          if (canHrDailyAttendance(user, hrConfig)) {
            attSubItems.push({ label: "Daily Report", path: "/admin/attendance", iconName: "Attendance" });
          }
          if (canHrMonthlyAttendance(user, hrConfig)) {
            attSubItems.push({ label: "Attendance Report", path: "/admin/attendance-report", iconName: "Attendance" });
          }

          const hrMenuItems = [
            {
              isSectionTitle: true,
              title: "Hr Access",
            },
          ];

          if (empSubItems.length > 0) {
            hrMenuItems.push({
              isHrItem: true,
              title: "Employees",
              iconName: "Employee",
              subItems: empSubItems,
            });
          }

          if (attSubItems.length > 0) {
            hrMenuItems.push({
              isHrItem: true,
              title: "Employee Attendance",
              iconName: "Attendance",
              subItems: attSubItems,
            });
          }

          hrMenuItems.push(
            {
              isHrItem: true,
              title: "Leaves & Holidays",
              iconName: "Leave Requests",
              subItems: [
                { label: "Holiday Requests", path: "/emp/holiday-requests", iconName: "Leave Requests", requiresHolidayAssignment: true },
                { label: "Manage Leaves", path: "/admin/leave-management", iconName: "Manage Employee" }
              ]
            },
            {
              isHrItem: true,
              title: "Slip Generation",
              iconName: "Salary Slip",
              subItems: [
                { label: "Payslip", path: "/admin/payslip-generator", iconName: "Salary Slip" },
                { label: "Appointment Letter", path: "/admin/appointment-letter", iconName: "Salary Slip" },
                { label: "Termination Letter", path: "/admin/termination-letter", iconName: "Salary Slip" },
                { label: "Increment Letter", path: "/admin/increment-letter", iconName: "Salary Slip" }
              ]
            },
            {
              isHrItem: true,
              title: "HR Requests",
              iconName: "Leave Requests",
              path: "/emp/hr-requests"
            }
          );

          return hrMenuItems;
        })()
      : [])
  ];

  const getModulePermission = (moduleName) => {
    const userPermissions = user?.permissions || [];
    const permObj = userPermissions.find(p => p.module === moduleName);
    return permObj ? permObj.permission : 'NO_ACCESS';
  };

  const employeeMenu = employeeMenuFull.map((item) => {
    if (item.isSectionTitle) return item;
    if (item.title === "Audit Management") {
      const filteredSubItems = (item.subItems || []).filter(sub => {
        let moduleName = "";
        if (sub.label === "Access Control") moduleName = "Access Controller";
        else if (sub.label === "Payment Scripts") moduleName = "Payment Script";
        else if (sub.label === "Inscope Vendors") moduleName = "Inscope Vendor";

        return getModulePermission(moduleName) !== "NO_ACCESS";
      });
      return { ...item, subItems: filteredSubItems };
    }
    if (item.title === "Leave & Holidays" || item.title === "Leaves & Holidays") {
      const filteredSubItems = (item.subItems || []).filter(sub => {
        if (sub.label === "Holiday Requests") {
          return hasHolidayAssignment || user?.isHr;
        }
        if (sub.label === "Manage Leaves" || sub.label === "Leave Management") {
          return user?.isHr || hasUserMenuPermission("Leaves & Holidays", "Manage Leaves");
        }
        if (sub.label === "Leave Requests") {
          return user?.isHr || hasUserMenuPermission("Leaves & Holidays", "Leave Requests");
        }
        if (sub.label === "Holiday List") {
          return hasUserMenuPermission("Leaves & Holidays", "Holiday List");
        }
        if (sub.label === "Holiday Configuration") {
          return hasUserMenuPermission("Leaves & Holidays", "Holiday Configuration");
        }
        if (sub.requiresHolidayAssignment && !hasHolidayAssignment && !user?.isHr) return false;
        return true;
      });
      return { ...item, subItems: filteredSubItems };
    }
    return item;
  }).filter((item) => {
    if (item.isSectionTitle) return true;
    if (item.requiresHolidayAssignment && !hasHolidayAssignment && !user?.isHr) return false;
    if (item.title === "Audit Management" && (!item.subItems || item.subItems.length === 0)) return false;
    if ((item.title === "Leave & Holidays" || item.title === "Leaves & Holidays") && (!item.subItems || item.subItems.length === 0)) return false;
    return true;
  });

  const fullMenuItems = role === "admin" ? adminMenu : employeeMenu;

  // Dashboard is default and essential, excluded from customization toggling
  const configurableMenus = fullMenuItems.filter(
    (item) => !item.isSectionTitle && item.title !== "Dashboard"
  );

  const menuItems = React.useMemo(() => {
    if (!visibleMenuTitles || !Array.isArray(visibleMenuTitles)) {
      return fullMenuItems;
    }
    return fullMenuItems.filter((item) => {
      // Dashboard is default and always visible in sidebar
      if (item.title === "Dashboard") {
        return true;
      }
      if (item.isSectionTitle) {
        return fullMenuItems.some(
          (other) => other.isHrItem && (visibleMenuTitles.includes(other.title) || (other.title === "Leaves & Holidays" && visibleMenuTitles.includes("Leave & Holidays")))
        );
      }
      if (hasUserMenuPermission(item.title)) {
        return true;
      }
      return (
        visibleMenuTitles.includes(item.title) ||
        (item.title === "Leaves & Holidays" && visibleMenuTitles.includes("Leave & Holidays")) ||
        (item.title === "Leave & Holidays" && visibleMenuTitles.includes("Leaves & Holidays"))
      );
    });
  }, [fullMenuItems, visibleMenuTitles]);

  const handleToggleMenuVisibility = (title) => {
    if (title === "Dashboard") return;
    const currentList =
      visibleMenuTitles === null
        ? configurableMenus.map((m) => m.title)
        : [...visibleMenuTitles];

    let updated;
    if (currentList.includes(title)) {
      updated = currentList.filter((t) => t !== title);
    } else {
      updated = [...currentList, title];
    }

    setVisibleMenuTitles(updated);
    try {
      const key = `sidebar_custom_menus_${loggedInUserId || role || "default"}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save sidebar menu settings:", e);
    }
  };

  const handleSelectAllMenus = () => {
    const allTitles = configurableMenus.map((m) => m.title);
    setVisibleMenuTitles(allTitles);
    try {
      const key = `sidebar_custom_menus_${loggedInUserId || role || "default"}`;
      localStorage.setItem(key, JSON.stringify(allTitles));
    } catch (e) {}
  };

  const handleResetMenus = () => {
    setVisibleMenuTitles(null);
    try {
      const key = `sidebar_custom_menus_${loggedInUserId || role || "default"}`;
      localStorage.removeItem(key);
    } catch (e) {}
  };

  const visibleCount =
    visibleMenuTitles === null
      ? configurableMenus.length
      : configurableMenus.filter((m) => visibleMenuTitles.includes(m.title)).length;
  const allSelected = visibleCount === configurableMenus.length;

  const filteredConfigurableMenus = configurableMenus.filter((m) => {
    if (!menuSearchQuery.trim()) return true;
    return m.title.toLowerCase().includes(menuSearchQuery.toLowerCase().trim());
  });

  const displayName = user?.name || "User";
  const displayPhoto = user?.photo || "/avatar.png";

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */

  return (
    <>
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`sidebar-container ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/HR portal logo.png" alt="HR Portal" />
          <img
            src="/close.png"
            className="sidebar-close-mobile-btn"
            alt="Close"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        </div>

        <div className="sidebar-scroll-wrapper">
          <div
            className="sidebar-scroll-content"
            ref={scrollContentRef}
            onScroll={(e) => {
              sessionStorage.setItem("sidebar_scroll_pos", String(e.currentTarget.scrollTop));
            }}
          >
            <nav className="sidebar-nav">
              <ul className="sidebar-menu">
                {menuItems.map((item, i) => {
                  if (item.isSectionTitle) {
                    return (
                      <li
                        key={i}
                        className="sidebar-section-title"
                        onClick={() => setIsHrSectionOpen((prev) => !prev)}
                      >
                        <span>{item.title}</span>
                        <Icon
                          icon="ep:arrow-right"
                          className={`sidebar-section-chevron ${isHrSectionOpen ? "open" : ""}`}
                        />
                      </li>
                    );
                  }

                  if (item.isHrItem && !isHrSectionOpen) {
                    return null;
                  }

                  const isLeavesMatch = (t1, t2) =>
                    t1 === t2 ||
                    ((t1 === "Leaves & Holidays" || t1 === "Leave & Holidays") &&
                     (t2 === "Leaves & Holidays" || t2 === "Leave & Holidays"));

                  const isOpen = openMenus[item.title] || (isLeavesMatch(item.title, "Leaves & Holidays") && (!!openMenus["Leaves & Holidays"] || !!openMenus["Leave & Holidays"]));
                  const isActive = isLeavesMatch(activeItem, item.title);

                  return (
                    <React.Fragment key={i}>
                      <li
                        className={`sidebar-menu-item ${isActive ? "active" : ""}`}
                        onClick={() => (item.subItems || item.subMenus) ? toggleMenu(item.title) : handleNavigate(item.path, item.title)}
                      >
                        <img
                          src={getIcon(item.iconName, isActive)}
                          width={19}
                          alt=""
                          className="menu-icon"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/ICONS/Audit%20Management.svg";
                          }}
                        />
                        <span>{item.title}</span>
                        {(item.subItems || item.subMenus) && (
                          <Icon icon="ep:arrow-right" className={`sidebar-chevron ${isOpen ? "open" : ""}`} />
                        )}
                      </li>

                      {item.subItems && isOpen && (
                        <ul className="sidebar-submenu open">
                          {item.subItems.map((sub, j) => {
                            const isSubActive =
                              activeSubItem === sub.label ||
                              (activeSubItem === "Leave Management" && sub.label === "Manage Leaves") ||
                              (activeSubItem === "Manage Leaves" && sub.label === "Leave Management");
                            return (
                              <li
                                key={j}
                                className={`sidebar-submenu-item ${isSubActive ? "sub-active" : ""}`}
                                onClick={(e) => { e.stopPropagation(); handleNavigate(sub.path, item.title, sub.label, true); }}
                              >
                                <img
                                  src={getIcon(sub.iconName, isSubActive)}
                                  alt={`${sub.label} icon`}
                                  className="sidebar-submenu-icon"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = "/ICONS/Audit%20Management.svg";
                                  }}
                                />
                                <span>{sub.label}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {item.subMenus && isOpen && (
                        <ul className="sidebar-submenu open">
                          {item.subMenus.map((nested, j) => {
                            const isNestedOpen = !!openSubMenus[nested.title];
                            const isNestedActive = activeNestedItem === nested.title;

                            return (
                              <React.Fragment key={j}>
                                <li
                                  className={`sidebar-submenu-item sidebar-nested-menu-header ${isNestedOpen ? "nested-open" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSubMenu(nested.title);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "8px 12px 8px 18px",
                                    fontWeight: isNestedActive ? "600" : "500",
                                    color: isNestedActive ? "#5977f8" : "#77728e",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    {nested.iconify ? (
                                      <Icon
                                        icon={nested.iconify}
                                        width={16}
                                        height={16}
                                        style={{ color: isNestedActive ? "#5977f8" : "#77728e", flexShrink: 0 }}
                                      />
                                    ) : (
                                      <img src={getIcon(nested.iconName, false)} width={16} height={16} alt="" />
                                    )}
                                    <span>{nested.title}</span>
                                  </div>
                                  <Icon
                                    icon="ep:arrow-right"
                                    className={`sidebar-chevron ${isNestedOpen ? "open" : ""}`}
                                    style={{
                                      fontSize: "12px",
                                      transition: "transform 0.2s ease",
                                      transform: isNestedOpen ? "rotate(90deg)" : "rotate(0deg)"
                                    }}
                                  />
                                </li>

                                {isNestedOpen && (
                                  <ul className="sidebar-nested-subitems open" style={{ listStyle: "none", padding: 0, margin: "0 0 4px 0" }}>
                                    {nested.subItems.map((sub, k) => {
                                      const isSubActive = activeSubItem === sub.label;
                                      return (
                                        <li
                                          key={k}
                                          className={`sidebar-submenu-item ${isSubActive ? "sub-active" : ""}`}
                                          style={{
                                            padding: "6px 12px 6px 32px",
                                            fontSize: "11px",
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleNavigate(sub.path, item.title, sub.label, true, nested.title);
                                          }}
                                        >
                                          {sub.iconify ? (
                                            <Icon
                                              icon={sub.iconify}
                                              width={15}
                                              height={15}
                                              style={{ color: isSubActive ? "#5977f8" : "#8e94a9", flexShrink: 0 }}
                                            />
                                          ) : (
                                            <img src={getIcon(sub.iconName, isSubActive)} alt={`${sub.label} icon`} className="sidebar-submenu-icon" />
                                          )}
                                          <span>{sub.label}</span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </ul>
                      )}
                    </React.Fragment>
                  );
                })}
              </ul>
            </nav>

            {/* Mini Calendar */}
            <div
              className="sidebar-mini-calendar"
              onClick={() => navigate(`/emp/remainder`)}
              style={{ cursor: "pointer" }}
            >
              {/* Header: Month Year */}
              <div className="sidebar-calendar-month-header">
                <h3><strong>{today.toLocaleString("default", { month: "long" })}</strong> {today.getFullYear()}</h3>
                <div className="sidebar-header-underline"></div>
              </div>

              {/* Day-of-week headers */}
              <div className="sidebar-calendar-weekdays">
                {days.map((day, dayIndex) => {
                  const todayDayIndex = today.getDay();
                  const diff = dayIndex - todayDayIndex;
                  const targetDate = new Date(today);
                  targetDate.setDate(today.getDate() + diff);

                  const formattedDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

                  return (
                    <span
                      key={day}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/emp/remainder?date=${formattedDate}`);
                      }}
                      style={{ cursor: "pointer", userSelect: "none" }}
                      title={formattedDate}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>

              {/* Day cells grid */}
              <div className="sidebar-calendar-grid">
                {calendarDates.map((dateObj, idx) => {
                  const isToday = dateObj.day === today.getDate() && dateObj.current;
                  const dayOfWeek = dateObj.current
                    ? new Date(today.getFullYear(), today.getMonth(), dateObj.day).getDay()
                    : null;

                  const isSunday = dateObj.current && dayOfWeek === 0;
                  const is2ndOr4thSat = dateObj.current && isSecondOrFourthSaturday(dateObj.day);
                  const isHoliday = dateObj.current && holidayDays.has(dateObj.day);

                  let cellClass = "sidebar-calendar-day";

                  if (dateObj.current) {
                    if (isToday) cellClass += " sidebar-today-circle";
                    else if (isHoliday) cellClass += " sidebar-holiday-circle";
                    else if (isSunday || is2ndOr4thSat) cellClass += " sidebar-weekend-red";
                  } else {
                    cellClass += " sidebar-not-current-month";
                  }

                  const handleDateClick = () => {
                    let clickYear = today.getFullYear();
                    let clickMonth = today.getMonth() + 1;
                    let clickDay = dateObj.day;

                    if (!dateObj.current && dateObj.day > 15) {
                      clickMonth = today.getMonth();
                      if (clickMonth === 0) { clickMonth = 12; clickYear -= 1; }
                    } else if (!dateObj.current && dateObj.day < 15) {
                      clickMonth = today.getMonth() + 2;
                      if (clickMonth > 12) { clickMonth = 1; clickYear += 1; }
                    }

                    const formattedDate = `${clickYear}-${String(clickMonth).padStart(2, "0")}-${String(clickDay).padStart(2, "0")}`;
                    navigate(`/emp/remainder?date=${formattedDate}`);
                  };

                  return (
                    <span
                      key={idx}
                      className={cellClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDateClick();
                      }}
                      style={{ cursor: "pointer", userSelect: "none" }}
                    >
                      {dateObj.day}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="sidebar-logout-container" onClick={handleLogout}>
              <div className="sidebar-logout-btn-box">
                <Icon icon="material-symbols:logout-rounded" width={22} height={22} rotate={2} />
                <span>Logout</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <header className="sidebar-header">
        <div className="sidebar-header-left">
          <FaBars className="sidebar-hamburger-btn" onClick={() => setIsMobileMenuOpen(true)} />
          <h4 className="sidebar-page-title">
            {activeNestedItem && activeSubItem
              ? `${activeNestedItem} - ${activeSubItem}`
              : activeItem && activeSubItem
                ? `${activeItem} - ${activeSubItem}`
                : activeItem || activeSubItem || "Dashboard"}
          </h4>
        </div>

        <div className="sidebar-header-right">
          {/* Settings Icon & Drawer for Customizing Sidebar Menus */}
          <div className="sidebar-settings-container" ref={settingsDropdownRef}>
            <div
              className={`sidebar-settings-wrapper ${showSettingsDrawer ? "active" : ""}`}
              onClick={() => {
                setSettingsRotateDeg((prev) => prev + 180);
                setShowSettingsDrawer(!showSettingsDrawer);
                setShowNotificationsDropdown(false);
              }}
              title="Customize Sidebar Menus"
            >
              <span
                className="codex--settings sidebar-settings-icon"
                style={{ transform: `rotate(${settingsRotateDeg}deg)` }}
                aria-hidden="true"
              ></span>
            </div>

            {showSettingsDrawer && (
              <>
                <div
                  className="sidebar-settings-overlay"
                  onClick={() => setShowSettingsDrawer(false)}
                />
                <div className="sidebar-settings-drawer">
                  <div className="sidebar-settings-drawer-header">
                    <div className="sidebar-settings-drawer-header-left">
                      <span className="codex--settings" style={{ fontSize: "20px" }} aria-hidden="true"></span>
                      <span>Customize Sidebar</span>
                    </div>
                    <div className="sidebar-settings-drawer-header-right">
                      <button
                        className="sidebar-settings-drawer-reset-btn"
                        onClick={handleResetMenus}
                        title="Restore all default menus"
                      >
                        Reset Default
                      </button>
                      <button
                        className="sidebar-settings-drawer-close-btn"
                        onClick={() => setShowSettingsDrawer(false)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="sidebar-settings-drawer-banner">
                    <p className="sidebar-settings-drawer-desc">
                      Choose which menus appear in your sidebar.
                    </p>
                    <div className="sidebar-settings-drawer-toolbar">
                      <span className="sidebar-settings-drawer-counter">
                        {visibleCount} of {configurableMenus.length} visible
                      </span>
                      <button
                        className="sidebar-settings-drawer-toggle-all-btn"
                        onClick={allSelected ? handleResetMenus : handleSelectAllMenus}
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                  </div>


                  <div className="sidebar-settings-drawer-body">
                    {filteredConfigurableMenus.length === 0 ? (
                      <div className="text-center py-4 text-muted" style={{ fontSize: "13px" }}>
                        No menus match "{menuSearchQuery}"
                      </div>
                    ) : (
                      filteredConfigurableMenus.map((item) => {
                        const isSelected =
                          visibleMenuTitles === null
                            ? true
                            : visibleMenuTitles.includes(item.title);

                        return (
                          <div
                            key={item.title}
                            className={`sidebar-settings-menu-card ${isSelected ? "selected" : "unselected"}`}
                            onClick={() => handleToggleMenuVisibility(item.title)}
                          >
                            <div className="sidebar-settings-card-left">
                              <div className="sidebar-settings-card-icon-box">
                                <img
                                  src={getIcon(item.iconName, false)}
                                  alt=""
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = "/ICONS/Audit%20Management.svg";
                                  }}
                                />
                              </div>
                              <div className="sidebar-settings-card-text">
                                <span className="sidebar-settings-card-title">{item.title}</span>
                                {item.subItems && (
                                  <span className="sidebar-settings-card-subinfo">
                                    {item.subItems.length} sub-items
                                  </span>
                                )}
                              </div>
                            </div>
                            <label
                              className="sidebar-settings-switch-label"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleMenuVisibility(item.title)}
                              />
                              <span className="sidebar-settings-slider"></span>
                            </label>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bell Icon & Dropdown Modal */}
          <div className="sidebar-bell-container" ref={notificationsDropdownRef}>
            <div className="sidebar-bell-wrapper" onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="sidebar-bell-icon">
                <path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2m6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5z"></path>
              </svg>
              {notifications.length > 0 && (
                <span className="sidebar-bell-badge">{notifications.length}</span>
              )}
            </div>

            {showNotificationsDropdown && (
              <>
                <div className="sidebar-notifications-overlay" onClick={() => setShowNotificationsDropdown(false)}></div>
                <div className="sidebar-notifications-drawer">
                  <div className="sidebar-notifications-drawer-header">
                    <div className="sidebar-notifications-drawer-header-left">
                      <svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2m6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5z"></path>
                      </svg>
                      <span className="sidebar-notifications-drawer-title">Notifications</span>
                    </div>
                    <div className="sidebar-notifications-drawer-header-right">
                      {notifications.length > 0 && (
                        <button className="sidebar-notifications-drawer-clear-all" onClick={handleClearAll}>
                          Clear All
                        </button>
                      )}
                      <button className="sidebar-notifications-drawer-close-x" onClick={() => setShowNotificationsDropdown(false)}>
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="sidebar-notifications-drawer-list">
                    {notifications.length === 0 ? (
                      <div className="sidebar-notifications-drawer-empty">
                        <div className="sidebar-notifications-drawer-empty-icon-wrapper">
                          <svg xmlns="http://www.w3.org/2000/svg" width="3em" height="3em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" />
                          </svg>
                        </div>
                        <h4 className="sidebar-notifications-drawer-empty-title">No notifications</h4>
                        <p className="sidebar-notifications-drawer-empty-subtext">You're all caught up!</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const itemKey = notif.uniqueKey || notif.id;
                        return (
                          <div
                            key={itemKey}
                            className="sidebar-notifications-drawer-item"
                            onClick={() => handleNotifClick(notif)}
                          >
                            <button
                              className="sidebar-notifications-drawer-item-close"
                              onClick={(e) => handleDismiss(e, notif)}
                            >
                              &times;
                            </button>

                            <div className="sidebar-notifications-drawer-item-body">
                              {role === "admin" ? (
                                <>
                                  <p className="sidebar-notifications-drawer-item-title">
                                    <strong>{notif.category === "instagram" ? notif.title : notif.name}</strong>
                                  </p>
                                  <div className="sidebar-notifications-drawer-item-text">
                                    {notif.category === "instagram" ? (
                                      <span>
                                        <strong style={{ color: "#e1306c" }}>Instagram: </strong>
                                        <span>{notif.message}</span>
                                      </span>
                                    ) : notif.category === "holiday" ? (
                                      <span>
                                        <strong>Holiday Request: </strong>
                                        Government Holiday: {notif.holidayName}
                                        {notif.holidayDate && ` (${new Date(notif.holidayDate).toLocaleDateString()})`}
                                      </span>
                                    ) : notif.category === "wfh" ? (
                                      notif.status === "Leave Cancel" ? (
                                        <span className="text-danger"><strong>WFH Request: </strong>{notif.type}: Request Cancel</span>
                                      ) : (
                                        <span className="text-info"><strong>WFH Request: </strong>Work From Home: Sent WFH request</span>
                                      )
                                    ) : notif.category === "security" ? (
                                      <span><strong>Security Request: </strong>{notif.title}</span>
                                    ) : notif.category === "hr_approval" ? (
                                      <span>
                                        <strong style={{ color: "#4f46e5" }}>{notif.title || "HR Request"}: </strong>
                                        <span>{notif.message}</span>
                                      </span>
                                    ) : notif.category === "system" ? (
                                      <span>
                                        <strong style={{ color: "#0284c7" }}>{notif.title || "Notification"}: </strong>
                                        <span>{notif.message}</span>
                                      </span>
                                    ) : notif.status === "Leave Cancel" ? (
                                      <span className="text-danger"><strong>Leave Request: </strong>{notif.type}: Request Cancel</span>
                                    ) : (
                                      <span className="text-primary"><strong>Leave Request: </strong>{notif.type}: Sent leave request</span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="sidebar-notifications-drawer-item-title">
                                    <strong>{notif.title}</strong>
                                  </p>
                                  <p className="sidebar-notifications-drawer-item-text">{notif.message}</p>
                                  <p className="sidebar-notifications-drawer-item-subtext">{notif.subtext}</p>
                                  {notif.type === "TASK" && notif.isAssigned && (
                                    <button
                                      className="sidebar-notifications-drawer-item-accept-btn"
                                      onClick={(e) => handleAcceptTask(e, notif.id)}
                                    >
                                      Accept Task
                                    </button>
                                  )}
                                </>
                              )}
                              <span className="sidebar-notifications-drawer-item-time">
                                {formatTimeAgo(notif.time || notif.timestamp)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="sidebar-notifications-drawer-footer">
                    <button className="common-modal-btn btn-small-cancel" onClick={() => setShowNotificationsDropdown(false)}>
                      Close
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="sidebar-profile" onClick={() => setIsProfileOpen(true)} style={{ cursor: "pointer" }}>
            <div className="sidebar-profile-info">
              <span className="sidebar-user-name-text">{displayName}</span>
              {role === "employee" && profileCompletion < 100 && (
                <span className="sidebar-profile-pct">{profileCompletion}% Complete</span>
              )}
            </div>
            <div className="sidebar-profile-avatar-wrapper">
              <img
                src={displayPhoto}
                alt="User avatar"
                className="sidebar-profile-avatar"
                onError={(e) => { e.target.src = "/avatar.png"; }}
              />
              {role === "employee" && (
                <svg className="sidebar-profile-ring" viewBox="0 0 36 36">
                  <circle className="sidebar-profile-ring-bg" cx="18" cy="18" r="15.915" />
                  <circle
                    className="sidebar-profile-ring-fill"
                    cx="18" cy="18" r="15.915"
                    strokeDasharray={`${profileCompletion} ${100 - profileCompletion}`}
                    strokeDashoffset="25"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
      </header>

      <ProfilePage
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        profileCompletion={profileCompletion}
      />
    </>
  );
}

function Sidebar(props) {
  const isInsideLayout = React.useContext(SidebarLayoutContext);
  // ⚡ STEP 1: If PortalLayout is active, suppress duplicate instance from individual page
  if (isInsideLayout && !props.isRootLayout) {
    return null;
  }
  return <SidebarContent {...props} />;
}

export default Sidebar;
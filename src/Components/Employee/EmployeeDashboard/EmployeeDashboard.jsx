import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  ProgressBar,
  Modal,
  Form,
  Spinner,
  Table,
  Dropdown,
} from "react-bootstrap";
import "../../../Globel/Layout.css"
import { Icon } from "@iconify/react";
import { FaGift, FaChevronDown, FaBirthdayCake, FaTimes } from "react-icons/fa";
import { FiClock } from "react-icons/fi";
import { toast, ToastContainer } from "react-toastify";
import Sidebar from "../../HeaderSidebar/Sidebar";
import "./EmployeeDashboard.css";
import "../EmployeeAttendance/AttendancePage.css";

import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircleFill } from "react-bootstrap-icons";
import { portalInstance } from "../../../Services/instance";
import PasswordExpiryBanner from "../../PasswordExpiry/PasswordExpiryBanner";
import HRHolidayAlertBanner from "../Holiday/HRHolidayAlertBanner";
import HRLeaveCategoryAlertBanner from "../Leave/HRLeaveCategoryAlertBanner";
import Checkin from "../../../../public/Login.svg?url";
import Checkout from "../../../../public/Out.svg?url";
import WorkingHours from "../../../../public/Working.svg?url";
import Lottie from "lottie-react";
import confettiAnimation from "../../../../Animation/Confetti Effects Lottie Animation.json";
import TaskDetailsModal from "../Task/TaskDetailsModal";
import AssignTask from "../../Admin/Task/AssignTask";
import CreatTask from "../Task/AssignTask";
import Pagination from "../Pagination/Pagination";
import "../Pagination/Pagination.css";
import moment from "moment";
import CustomDropdown from "../../Common/CustomDropdown";
import "../../Common/CustomDropdown.css";
import MissingProfileBanner from "./MissingProfileBanner";
import TaskBanner from "../../Banner/TaskBanner";
import BirthdayCelebration from "../BirthdayCelebration/BirthdayCelebration";

import {
  shouldTriggerCelebration,
  markCelebrationPlayedInSession,
  resetCelebrationForTesting,
} from "../BirthdayCelebration/birthdayCelebrationHelper";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPER FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

const getMonthName = (monthNum) => {
  const months = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return months[monthNum] || "";
};

const PROJECT_STATUS_OPTIONS = [
  { value: "all", label: "All Projects" },
  { value: "in process", label: "In Process" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "on hold", label: "On Hold" },
];

const PROJECT_PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5" },
  { value: 6, label: "6" },
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
];

const normalizeStatusKey = (s) => {
  const str = String(s || "pending").toLowerCase().replace(/[\s_-]+/g, "");
  if (str.includes("complete")) return "completed";
  if (str.includes("process")) return "inprocess";
  if (str.includes("hold")) return "hold";
  return "pending";
};

const formatStatusLabel = (s) => {
  const key = normalizeStatusKey(s);
  if (key === "completed") return "Completed";
  if (key === "inprocess") return "In Process";
  if (key === "hold") return "On Hold";
  return "Pending";
};

const isWeeklyOffDate = (d) => {
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0) return true;
  if (day === 6) {
    const dayOfMonth = d.getDate();
    const saturdayRank = Math.ceil(dayOfMonth / 7);
    if (saturdayRank === 2 || saturdayRank === 4) return true; // 2nd & 4th Saturday
  }
  return false;
};

const formatYMD = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const calculateWorkingDaysFromHistory = (history, currentStatus, holidaysList = [], leavesList = []) => {
  if (!Array.isArray(history) || history.length === 0) {
    const s = normalizeStatusKey(currentStatus);
    return s === "completed" ? 1 : (s === "inprocess" ? 1 : 0);
  }

  const holidaysSet = new Set(holidaysList || []);
  const leavesSet = new Set(leavesList || []);

  const sorted = [...history].sort((a, b) => {
    const timeA = new Date(a.date || a.completionDate || a.updateDate || a.createdAt || 0).getTime();
    const timeB = new Date(b.date || b.completionDate || b.updateDate || b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  const statusByDate = {};
  sorted.forEach((item) => {
    const rawDate = item.date || item.completionDate || item.updateDate || item.createdAt;
    if (!rawDate) return;
    const dStr = new Date(rawDate).toISOString().split("T")[0];
    statusByDate[dStr] = normalizeStatusKey(item.status || item.phaseStatus || currentStatus);
  });

  const distinctDates = Object.keys(statusByDate).sort();
  if (distinctDates.length === 0) return 0;

  const minDate = distinctDates[0];
  const todayStr = new Date().toISOString().split("T")[0];

  let completionDate = null;
  for (const dStr of distinctDates) {
    if (statusByDate[dStr] === "completed") {
      completionDate = dStr;
      break;
    }
  }

  const normCurrent = normalizeStatusKey(currentStatus);
  if (!completionDate && normCurrent === "completed") {
    completionDate = distinctDates[distinctDates.length - 1];
    statusByDate[completionDate] = "completed";
  }

  const endDate = completionDate ? completionDate : todayStr;

  let accumulatedDays = 0;
  let runningStatus = "pending";

  const [startY, startM, startD] = minDate.split("-").map(Number);
  const [endY, endM, endD] = endDate.split("-").map(Number);

  let cur = new Date(startY, startM - 1, startD, 12, 0, 0);
  const end = new Date(endY, endM - 1, endD, 12, 0, 0);

  while (cur <= end) {
    const curStr = formatYMD(cur);
    if (statusByDate[curStr]) {
      runningStatus = statusByDate[curStr];
    }

    const isWeeklyOff = isWeeklyOffDate(cur);
    const isHoliday = holidaysSet.has(curStr);
    const isLeaveOrAbsent = leavesSet.has(curStr);
    const isSkipDay = isWeeklyOff || isHoliday || isLeaveOrAbsent;

    if (!isSkipDay) {
      if (runningStatus === "inprocess") {
        accumulatedDays += 1;
      } else if (runningStatus === "completed") {
        accumulatedDays += 1;
        break;
      }
      // Pending or On Hold: add 0 days
    }

    cur.setDate(cur.getDate() + 1);
  }

  if (normCurrent === "completed") {
    return Math.max(1, accumulatedDays);
  }
  return accumulatedDays;
};

const groupTasksWithHistory = (items, holidaysList = [], leavesList = []) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  // Connected Components / Union-Find to group related updates across days
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    let root = i;
    while (root !== parent[root]) root = parent[root];
    let curr = i;
    while (curr !== root) {
      let nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  };
  const union = (i, j) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = items[i];
      const b = items[j];

      const aId = a._id ? String(a._id) : null;
      const bId = b._id ? String(b._id) : null;
      const aWorkRef = a.workUpdateRefId ? String(a.workUpdateRefId) : null;
      const bWorkRef = b.workUpdateRefId ? String(b.workUpdateRefId) : null;
      const aRef = a.referenceId ? String(a.referenceId) : null;
      const bRef = b.referenceId ? String(b.referenceId) : null;
      const aTaskId = (a.task_id && a.task_id !== "standalone") ? String(a.task_id) : (a.task?._id ? String(a.task._id) : null);
      const bTaskId = (b.task_id && b.task_id !== "standalone") ? String(b.task_id) : (b.task?._id ? String(b.task._id) : null);
      const aTitle = (a.taskTitle || a.displayTitle || a.name || a.title || a.phase || "").trim().toLowerCase();
      const bTitle = (b.taskTitle || b.displayTitle || b.name || b.title || b.phase || "").trim().toLowerCase();

      let connected = false;
      // 1. workUpdateRefId links across days
      if (aWorkRef && bId && aWorkRef === bId) connected = true;
      else if (bWorkRef && aId && bWorkRef === aId) connected = true;
      else if (aWorkRef && bWorkRef && aWorkRef === bWorkRef) connected = true;
      // 2. Phase reference IDs
      else if (aRef && bRef && aRef === bRef) connected = true;
      // 3. Same formal task phase
      else if (aTaskId && bTaskId && aTaskId === bTaskId && ((aRef && bRef && aRef === bRef) || (!aRef && !bRef))) connected = true;
      // 4. Same title within standalone updates
      else if (aTitle && bTitle && aTitle === bTitle && (!aTaskId || aTaskId === "standalone") && (!bTaskId || bTaskId === "standalone")) connected = true;

      if (connected) union(i, j);
    }
  }

  const clusters = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(items[i]);
  }

  const grouped = [];
  clusters.forEach((groupItems) => {
    const sorted = [...groupItems].sort((a, b) => {
      const dateA = new Date(a.date || a.completionDate || a.updateDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.completionDate || b.updateDate || b.createdAt || 0).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return String(b._id || "").localeCompare(String(a._id || ""));
    });

    const latest = sorted[0];
    const latestStatus = latest.status || latest.phaseStatus || "Pending";
    const normKey = normalizeStatusKey(latestStatus);
    const calculatedDays = calculateWorkingDaysFromHistory(sorted, latestStatus, holidaysList, leavesList);

    const effectiveWorkingDays = (latest.workingDays !== undefined && latest.workingDays !== null && Number(latest.workingDays) > 0)
      ? Number(latest.workingDays)
      : (latest.phaseWorkingDays !== undefined && latest.phaseWorkingDays !== null && Number(latest.phaseWorkingDays) > 0)
        ? Number(latest.phaseWorkingDays)
        : (calculatedDays || 1);

    grouped.push({
      ...latest,
      taskTitle: latest.taskTitle || latest.displayTitle || latest.name || latest.title || "Untitled Task",
      displayTitle: latest.taskTitle || latest.displayTitle || latest.name || latest.title || "Untitled Task",
      latestDate: latest.date || latest.completionDate || latest.updateDate || latest.createdAt,
      latestStatus: latestStatus,
      workingDays: effectiveWorkingDays,
      isCompleted: normKey === "completed",
      isInProcess: normKey === "inprocess",
      history: sorted,
    });
  });

  grouped.sort((a, b) => {
    const dateA = new Date(a.latestDate || 0).getTime();
    const dateB = new Date(b.latestDate || 0).getTime();
    return dateB - dateA;
  });

  return grouped;
};

const getPhaseWorkingDays = (phase) => {
  if (phase?.workingDays !== undefined && phase?.workingDays !== null && Number(phase.workingDays) > 0) {
    return Number(phase.workingDays);
  }
  if (phase?.phaseWorkingDays !== undefined && phase?.phaseWorkingDays !== null && Number(phase.phaseWorkingDays) > 0) {
    return Number(phase.phaseWorkingDays);
  }
  if (phase?.overallTaskWorkingDays !== undefined && phase?.overallTaskWorkingDays !== null && Number(phase.overallTaskWorkingDays) > 0) {
    return Number(phase.overallTaskWorkingDays);
  }

  const history = Array.isArray(phase?.history) && phase.history.length > 0 ? phase.history : (phase ? [phase] : []);
  const distinctDates = new Set();
  history.forEach((h) => {
    const rawStatus = (h.status || h.phaseStatus || "").toLowerCase().replace(/[-_\s]/g, "");
    if (rawStatus !== "hold" && rawStatus !== "onhold" && rawStatus !== "pending") {
      const dVal = h.date || h.completionDate || h.updateDate || h.createdAt;
      if (dVal) {
        const dObj = new Date(dVal);
        if (!isNaN(dObj.getTime())) {
          distinctDates.add(dObj.toISOString().split("T")[0]);
        }
      }
    }
  });

  if (distinctDates.size > 0) {
    return distinctDates.size;
  }

  return history.length > 0 ? 1 : 0;
};

const getLocalDateString = (val) => {
  if (!val) return null;
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return val.trim();
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getProjectTotalWorkingDays = (items) => {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const distinctDates = new Set();
  items.forEach((item) => {
    const records = Array.isArray(item?.history) && item.history.length > 0 ? item.history : (item ? [item] : []);
    records.forEach((h) => {
      const rawStatus = (h?.status || h?.phaseStatus || item?.latestStatus || item?.status || "").toLowerCase().replace(/[-_\s]/g, "");
      if (rawStatus !== "hold" && rawStatus !== "onhold") {
        const dVal = h?.date || h?.completionDate || h?.updateDate || h?.createdAt || item?.latestDate || item?.date;
        const key = getLocalDateString(dVal);
        if (key) {
          distinctDates.add(key);
        }
      }
    });
  });

  return distinctDates.size;
};


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const TIME_OPTIONS = [];
for (let i = 0; i < 24; i++) {
  for (let j = 0; j < 60; j += 30) {
    const period = i >= 12 ? "PM" : "AM";
    const hour = i % 12 === 0 ? 12 : i % 12;
    const min = j === 0 ? "00" : "30";
    const timeStr = `${hour.toString().padStart(2, "0")}:${min} ${period}`;
    TIME_OPTIONS.push({ label: timeStr, value: timeStr });
  }
}

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // â”€â”€ DASHBOARD STATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [employee, setEmployee] = useState(null);
  const [loginTime, setLoginTime] = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [isNewEmployee, setIsNewEmployee] = useState(false);
  const [showPwdBanner, setShowPwdBanner] = useState(false);
  const [expiryDate, setExpiryDate] = useState(null);
  const [dailySlogan, setDailySlogan] = useState("");

  const [kural, setKural] = useState(null);
  const [kuralLoading, setKuralLoading] = useState(true);
  const [language, setLanguage] = useState("tamil");
  const [kuralDotIndex, setKuralDotIndex] = useState(0);

  // â”€â”€ BIRTHDAY & WISH STATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [showBirthdayAnimation, setShowBirthdayAnimation] = useState(false);
  const [showMascotModal, setShowMascotModal] = useState(false);
  const [todayBirthdays, setTodayBirthdays] = useState([]);
  const [sentWishes, setSentWishes] = useState([]);
  const [receivedWishes, setReceivedWishes] = useState([]);
  const [showWishModal, setShowWishModal] = useState(false);
  const [selectedEmpForWish, setSelectedEmpForWish] = useState(null);
  const [wishMessage, setWishMessage] = useState("");
  const [sendingWish, setSendingWish] = useState(false);
  const [replyInputMap, setReplyInputMap] = useState({});
  const [replyingWishId, setReplyingWishId] = useState(null);
  const [receivedWishesPage, setReceivedWishesPage] = useState(1);

  // â”€â”€ ATTENDANCE STATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [liveDuration, setLiveDuration] = useState("00h:00m:00s");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionType, setPermissionType] = useState("");
  const [permissionData, setPermissionData] = useState({
    fromTime: "",
    toTime: "",
    reason: "",
    informedVia: "Mobile Call",
    permissionType: "",
  });
  const [hasInformPermission, setHasInformPermission] = useState(false);
  const [permissionTypeToday, setPermissionTypeToday] = useState(null);
  const [showPermissionTypeDropdown, setShowPermissionTypeDropdown] = useState(false);
  const permissionDropdownRef = useRef(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // ─── MORNING INFORM HALF-DAY CONFIRMATION STATES ───
  const [showHalfDayConfirmModal, setShowHalfDayConfirmModal] = useState(false);
  const [halfDayConfirmLoading, setHalfDayConfirmLoading] = useState(false);
  const [pendingMorningInformData, setPendingMorningInformData] = useState(null);

  // ===== IP VALIDATION START =====
  const [showIPReasonModal, setShowIPReasonModal] = useState(false);
  const [ipReason, setIpReason] = useState("");
  const [pendingLateReason, setPendingLateReason] = useState("");
  const [isCheckoutIP, setIsCheckoutIP] = useState(false);
  const [isHalfDayConfirmIP, setIsHalfDayConfirmIP] = useState(false);
  // ===== IP VALIDATION END =====

  // â”€â”€ NON-WORKING DAY STATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [isNonWorkingDay, setIsNonWorkingDay] = useState(false);
  const [nonWorkingReason, setNonWorkingReason] = useState("");
  const [monthlyData, setMonthlyData] = useState(null);
  const [govHolidays, setGovHolidays] = useState(new Set());
  const [loading, setLoading] = useState(false);

  // â”€â”€ ATTENDANCE DERIVED STATE â”€â”€
  const hasCheckedIn =
    !!todayAttendance?.checkIn1 ||
    !!todayAttendance?.checkIn2 ||
    !!todayAttendance?.checkInTime;

  const canReCheckIn =
    (!!todayAttendance?.checkIn1 || !!todayAttendance?.checkInTime) &&
    (!!todayAttendance?.checkOut1 || !!todayAttendance?.checkOutTime) &&
    !todayAttendance?.checkIn2;

  const isCurrentlyCheckedIn =
    (
      (todayAttendance?.checkIn1 || todayAttendance?.checkInTime) &&
      !(todayAttendance?.checkOut1 || todayAttendance?.checkOutTime)
    ) ||
    (
      todayAttendance?.checkIn2 &&
      !todayAttendance?.checkOut2
    );

  const showCheckOutTime =
    !!(todayAttendance?.checkOutTime || todayAttendance?.checkOut1 || todayAttendance?.checkOut2) &&
    !isCurrentlyCheckedIn;

  const hasCheckedOut =
    !!todayAttendance?.checkOut2 ||
    (!!(todayAttendance?.checkOut1 || todayAttendance?.checkOutTime) && !todayAttendance?.checkIn2 && !canReCheckIn);

  const hasCheckOutContent =
    !!showCheckOutTime ||
    !!(
      todayAttendance?.checkIn1 &&
      todayAttendance?.checkOut1 &&
      todayAttendance?.checkIn2
    );

  // â”€â”€ NOTIFICATION STATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [notifications, setNotifications] = useState([]);
  const [dueTasksAlerts, setDueTasksAlerts] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);

  // â”€â”€ SPECIAL DAYS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [todaySpecialDays, setTodaySpecialDays] = useState([]);
  const [specialDaysAll, setSpecialDaysAll] = useState([]);

  // â”€â”€ PENDING TASKS CARD + MODAL STATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [pendingTasks, setPendingTasks] = useState([]);
  const [pendingTasksLoading, setPendingTasksLoading] = useState(false);
  const [projectDetails, setProjectDetails] = useState([]);
  const [projectDetailsLoading, setProjectDetailsLoading] = useState(true);
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showPhasesModal, setShowPhasesModal] = useState(false);
  const [projExpandedCards, setProjExpandedCards] = useState({});
  const [projectPhases, setProjectPhases] = useState([]);
  const [phasesLoading, setPhasesLoading] = useState(false);
  const [activePhaseProject, setActivePhaseProject] = useState(null);
  const [projectCurrentPage, setProjectCurrentPage] = useState(1);
  const [projectItemsPerPage, setProjectItemsPerPage] = useState(6);

  // â”€â”€ QUICK ACTION POPUP STATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const [showCreatPopup, setShowCreatPopup] = useState(false);

  // â”€â”€ TO-DO STATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoDescription, setTodoDescription] = useState("");
  const [todoDate, setTodoDate] = useState("");
  const [todos, setTodos] = useState([]);
  const [todoLoading, setTodoLoading] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [todoCurrentPage, setTodoCurrentPage] = useState(1);
  const todoItemsPerPage = 5;
  const [isEditMode, setIsEditMode] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const ITEMS_PER_PAGE = 7;

  // âœ… EDIT MODAL STATES
  const [editStatus, setEditStatus] = useState("pending");
  const [showEditStatusDropdown, setShowEditStatusDropdown] = useState(false);
  const editStatusRef = useRef(null);
  const todoDateInputRef = useRef(null);

  const [todoStatusFilter, setTodoStatusFilter] = useState("all");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const [todoDateFilter, setTodoDateFilter] = useState("all");
  const [todoCustomFromDate, setTodoCustomFromDate] = useState("");
  const [todoCustomToDate, setTodoCustomToDate] = useState("");

  const [lateReason, setLateReason] = useState("");


  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [showProjectStatusDropdown, setShowProjectStatusDropdown] = useState(false);

  const dateOptions = [
    { label: "All", value: "all" },
    { label: "Today", value: "today" },
    { label: "This Week", value: "this_week" },
    { label: "This Month", value: "this_month" },
    { label: "Custom", value: "custom" },
  ];


  const filterDropdownRef = useRef(null);
  const dateDropdownRef = useRef(null);
  const projectStatusRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target)
      ) {
        setShowStatusDropdown(false);
      }
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(event.target)
      ) {
        setIsDateDropdownOpen(false);
      }
      if (
        editStatusRef.current &&
        !editStatusRef.current.contains(event.target)
      ) {
        setShowEditStatusDropdown(false);
      }
      if (
        projectStatusRef.current &&
        !projectStatusRef.current.contains(event.target)
      ) {
        setShowProjectStatusDropdown(false);
      }
      if (
        permissionDropdownRef.current &&
        !permissionDropdownRef.current.contains(event.target)
      ) {
        setShowPermissionTypeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (showAssignPopup || showCreatPopup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAssignPopup, showCreatPopup]);

  const todayStr = new Date().toDateString();

  const sessionRaw = sessionStorage.getItem("Erti-Portal");
  const sessionData = sessionRaw ? JSON.parse(sessionRaw) : {};
  const token = sessionData?.token;
  const loggedInUserId =
    sessionData?.user?._id || (token ? getUserIdFromToken(token) : null);


  const formatAttendanceTime = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatWorkingHours = (minutes) => {
    if (!minutes || minutes <= 0) return "00:00:00";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}h:${String(m).padStart(2, "0")}m:${String(s).padStart(2, "0")}s`;
  };

  useEffect(() => {
    let intervalId;

    const hasActiveSession =
      ((todayAttendance?.checkIn1 || todayAttendance?.checkInTime) && !(todayAttendance?.checkOut1 || todayAttendance?.checkOutTime)) ||
      (todayAttendance?.checkIn2 && !todayAttendance?.checkOut2);

    if (hasActiveSession) {
      intervalId = setInterval(() => {
        let totalMs = 0;

        const s1In = todayAttendance?.checkIn1 || todayAttendance?.checkInTime;
        const s1Out = todayAttendance?.checkOut1 || todayAttendance?.checkOutTime;

        if (s1In) {
          if (s1Out) {
            totalMs += new Date(s1Out).getTime() - new Date(s1In).getTime();
          } else {
            totalMs += Date.now() - new Date(s1In).getTime();
          }
        }

        if (todayAttendance?.checkIn2) {
          if (todayAttendance?.checkOut2) {
            totalMs += new Date(todayAttendance.checkOut2).getTime() - new Date(todayAttendance.checkIn2).getTime();
          } else {
            totalMs += Date.now() - new Date(todayAttendance.checkIn2).getTime();
          }
        }

        const diffSeconds = Math.floor(totalMs / 1000);
        setLiveDuration(formatDuration(diffSeconds));
      }, 1000);
    } else {
      let totalMins = 0;

      const s1In = todayAttendance?.checkIn1 || todayAttendance?.checkInTime;
      const s1Out = todayAttendance?.checkOut1 || todayAttendance?.checkOutTime;
      if (s1In && s1Out) {
        totalMins += Math.floor((new Date(s1Out).getTime() - new Date(s1In).getTime()) / 60000);
      }

      if (todayAttendance?.checkIn2 && todayAttendance?.checkOut2) {
        totalMins += Math.floor((new Date(todayAttendance.checkOut2).getTime() - new Date(todayAttendance.checkIn2).getTime()) / 60000);
      }

      setLiveDuration(formatWorkingHours(totalMins));
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [todayAttendance]);


  useEffect(() => {
    const session = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
    const alreadyDismissed =
      sessionStorage.getItem("pwdExpiryDismissed") === "true";
    if (session.passwordExpiringSoon && !alreadyDismissed) {
      setShowPwdBanner(true);
      setExpiryDate(session.passwordExpiresAt || null);
    }
  }, []);


  useEffect(() => {
    const storedLoginTime = sessionStorage.getItem("loginTime");
    if (storedLoginTime) setLoginTime(new Date(storedLoginTime));
  }, []);


  const checkNonWorkingDay = useCallback((data) => {
    if (!data?.calendarDays) return { status: false, reason: "" };

    const today = new Date();
    const todayDate = today.getDate();
    const todayData = data.calendarDays.find(
      (d) => d.day === todayDate && d.month === "current"
    );

    if (!todayData) return { status: false, reason: "" };

    const status = todayData.status?.toLowerCase();

    if (status === "approved" || status === "approved leave") {
      return { status: true, reason: "Approved Leave" };
    }
    if (status === "holiday") {
      return { status: true, reason: "Government Holiday" };
    }
    if (
      todayData.isSunday ||
      todayData.isSecondSaturday ||
      todayData.isFourthSaturday ||
      todayData.status === "week"
    ) {
      return { status: true, reason: "Weekend" };
    }

    return { status: false, reason: "" };
  }, []);

  const fetchMonthlyAttendance = async () => {
    const now = new Date();
    const MONTHS = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const month = MONTHS[now.getMonth()];
    const year = now.getFullYear();

    try {
      const res = await portalInstance.get(
        `/portal/attendance/monthly?month=${month}&year=${year}`
      );
      const data = res.data.data || null;
      setMonthlyData(data);
      return data;
    } catch (err) {
      console.error("Monthly attendance fetch failed", err);
      return null;
    }
  };

  const fetchGovHolidays = async () => {
    const year = new Date().getFullYear();
    try {
      const res = await portalInstance.get(`/holidays/get-yearly/${year}`);
      const months = res.data?.data?.months || [];
      const allDates = [];
      months.forEach((m) => {
        (m.governmentHolidays || []).forEach((h) => {
          if (h.date) allDates.push(h.date);
        });
      });
      setGovHolidays(new Set(allDates));
    } catch (err) {
      console.error("Gov holidays fetch failed", err);
    }
  };

  const initAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const todayRes = await portalInstance.get("/portal/attendance/today");
      const todayRecord = todayRes.data.data || null;
      setTodayAttendance(todayRecord);
      if (todayRes.data.hasValidCheckInPermission) {
        setHasInformPermission(true);
      }
      setPermissionTypeToday(todayRes.data.permissionType || null);

      const mData = await fetchMonthlyAttendance();
      await fetchGovHolidays();

      if (mData) {
        const check = checkNonWorkingDay(mData);
        setIsNonWorkingDay(check.status);
        setNonWorkingReason(check.reason);

        if (!check.status && !(todayRecord?.checkInTime || todayRecord?.checkIn1)) {
          setShowCheckInModal(true);
        } else {
          setShowCheckInModal(false);
        }
      } else {
        if (!(todayRecord?.checkInTime || todayRecord?.checkIn1)) setShowCheckInModal(true);
      }
    } catch (err) {
      console.error("Attendance initialization error:", err);
    } finally {
      setLoading(false);
    }
  }, [checkNonWorkingDay]);

  useEffect(() => {
    initAttendance();
  }, [initAttendance]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // HIGH-FIDELITY EXCEL EXPORTS (XML Based)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const exportToExcel = (data, filename, type = "projects") => {
    if (!data || data.length === 0) {
      toast.info("No data available to export");
      return;
    }

    let headers = [];
    let colWidths = [];
    let worksheetName = "";

    if (type === "projects") {
      headers = ["S.No", "Project Name", "Category", "Status"];
      colWidths = [40, 250, 150, 100];
      worksheetName = "My Projects";
    } else {
      headers = ["S.No", "Task Title", "Date", "Status", "Work Summary"];
      colWidths = [40, 200, 100, 100, 400];
      worksheetName = "Project Phases";
    }

    // Dynamic Width Adjustment
    const baseWidth = 7;
    data.forEach((item) => {
      if (type === "projects") {
        const name = item.projectName || "N/A";
        if (name.length * baseWidth > colWidths[1]) colWidths[1] = Math.min(name.length * baseWidth, 350);
      } else {
        const title = item.taskTitle || item.name || "N/A";
        const summary = item.name || "N/A";
        if (title.length * baseWidth > colWidths[1]) colWidths[1] = Math.min(title.length * baseWidth, 300);
        if (summary.length * (baseWidth * 0.4) > colWidths[4]) colWidths[4] = Math.min(summary.length * (baseWidth * 0.4), 600);
      }
    });

    const escape = (str) =>
      String(str).replace(/[<>&'"]/g, (c) =>
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
      );

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="12" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#5977F8" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="Cell">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="CellBold">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#3A466D"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="CellAccent">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#5977F8"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${worksheetName}">
  <Table>
   ${colWidths.map((w) => `<Column ss:Width="${w}"/>`).join("")}
   <Row ss:Height="25">
    ${headers.map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>`).join("")}
   </Row>
   ${data
        .map((item, idx) => {
          if (type === "projects") {
            return `
   <Row ss:AutoFitHeight="1">
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellBold"><Data ss:Type="String">${escape(item.projectName || "N/A")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(item.category || "N/A")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(item.status || "N/A")}</Data></Cell>
   </Row>`;
          } else {
            const itemDate = item.latestDate || item.date || item.completionDate || item.updateDate || item.createdAt;
            const formattedDate = itemDate && !isNaN(new Date(itemDate).getTime())
              ? new Date(itemDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
              : "N/A";
            return `
   <Row ss:AutoFitHeight="1">
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellAccent"><Data ss:Type="String">${escape(item.taskTitle || item.name || "N/A")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(formattedDate)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(item.status || "N/A")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(item.name || "N/A")}</Data></Cell>
   </Row>`;
          }
        })
        .join("")}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Excel Exported!");
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FETCH EMPLOYEE DETAILS + PROFILE COMPLETION
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const empRes = await portalInstance.get("/users/get-details");
        let currentEmp = null;
        if (empRes.data.success) {
          currentEmp = empRes.data.data;
          setEmployee(currentEmp);
        }

        const pcRes = await portalInstance.get("/data/completion");
        if (pcRes.data.success) {
          const completion = Number(pcRes.data.profileCompletion || 0);
          setProfileCompletion(completion);
          setIsNewEmployee(completion === 0);
        }
        const bdays = await fetchTodayBirthdays();
        fetchSentWishes();
        fetchReceivedWishes();

        // 🎂 Trigger birthday celebration animation on login if employee has birthday today
        if (shouldTriggerCelebration(currentEmp, bdays, loggedInUserId)) {
          setShowBirthdayAnimation(true);
          markCelebrationPlayedInSession(currentEmp, loggedInUserId);
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      }
    };
    fetchDashboardData();
  }, [loggedInUserId]);

  const fetchTodayBirthdays = async () => {
    try {
      const res = await portalInstance.get("/users/today-birthdays");
      if (res.data?.success) {
        const list = res.data.data || [];
        setTodayBirthdays(list);
        return list;
      }
    } catch (err) {
      console.error("Fetch today birthdays error:", err);
    }
    return [];
  };

  // Watch for employee & todayBirthdays updates to trigger animation if not already fired
  useEffect(() => {
    if (employee || (todayBirthdays && todayBirthdays.length > 0)) {
      if (shouldTriggerCelebration(employee, todayBirthdays, loggedInUserId)) {
        setShowBirthdayAnimation(true);
        markCelebrationPlayedInSession(employee, loggedInUserId);
      }
    }
  }, [employee, todayBirthdays, loggedInUserId]);

  const fetchSentWishes = async () => {
    try {
      const res = await portalInstance.get("/users/birthday-wish/sent");
      if (res.data?.success) {
        setSentWishes(res.data.data || []);
      }
    } catch (err) {
      console.error("Fetch sent wishes error:", err);
    }
  };

  const fetchReceivedWishes = async () => {
    try {
      const res = await portalInstance.get("/users/birthday-wish/received");
      if (res.data?.success) {
        setReceivedWishes(res.data.data || []);
      }
    } catch (err) {
      console.error("Fetch received wishes error:", err);
    }
  };

  const [targetEmpsForWish, setTargetEmpsForWish] = useState([]);

  const handleOpenWishModal = (empOrEmps) => {
    const otherEmps = todayBirthdays.filter(
      (emp) => String(emp._id) !== String(employee?._id)
    );
    const empsList = Array.isArray(empOrEmps)
      ? empOrEmps
      : empOrEmps
        ? [empOrEmps]
        : otherEmps;
    setTargetEmpsForWish(empsList);
    setWishMessage(
      "Wishing you a very Happy Birthday! May your year ahead be filled with success, happiness, and great health!"
    );
    setShowWishModal(true);
  };

  const handleSendWish = async () => {
    if (!targetEmpsForWish.length || !wishMessage.trim()) return;
    try {
      setSendingWish(true);
      await Promise.all(
        targetEmpsForWish.map((emp) =>
          portalInstance.post("/users/birthday-wish/send", {
            receiverId: emp._id,
            message: wishMessage.trim(),
          })
        )
      );
      toast.success("Birthday wishes sent successfully!");
      setShowWishModal(false);
      fetchSentWishes();
    } catch (err) {
      console.error("Send wish error:", err);
      toast.error(err.response?.data?.message || "Failed to send wishes");
    } finally {
      setSendingWish(false);
    }
  };

  const handleSendReply = async (wishId) => {
    const replyText = replyInputMap[wishId] !== undefined
      ? replyInputMap[wishId]
      : "Thank you so much for your warm birthday wishes!";
    if (!replyText || !replyText.trim()) return;
    try {
      setReplyingWishId(wishId);
      const res = await portalInstance.post("/users/birthday-wish/reply", {
        wishId,
        reply: replyText.trim(),
      });
      if (res.data?.success) {
        toast.success("Thank you reply sent!");
        fetchReceivedWishes();
      }
    } catch (err) {
      console.error("Send reply error:", err);
      toast.error(err.response?.data?.message || "Failed to send reply");
    } finally {
      setReplyingWishId(null);
    }
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // BIRTHDAY CHECK
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ─── BIRTHDAY CHECK (RUNS ON EVERY LOGIN) ─────────────────────────────────


  // Window helper for development / previewing
  useEffect(() => {
    window.__previewBirthdayAnimation = () => setShowBirthdayAnimation(true);
    window.__resetBirthdayAnimation = () => {
      resetCelebrationForTesting();
      setShowBirthdayAnimation(true);
    };
    window.__show3DMascot = () => setShowMascotModal(true);
    return () => {
      delete window.__previewBirthdayAnimation;
      delete window.__resetBirthdayAnimation;
      delete window.__show3DMascot;
    };
  }, []);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FETCH PENDING TASKS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const fetchPendingTasks = useCallback(async () => {
    setPendingTasksLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("status", "pending");
      params.append("status", "Pending");

      const res = await portalInstance.get(
        `/creat/tasks/dashboard?${params.toString()}`
      );
      const allPending = res.data.data || [];

      const filteredTasks = allPending.filter((task) => {
        const isAssignedToMe = task.assignedMembers?.some((member) => {
          const memberId = typeof member === "object" ? member._id : member;
          return memberId?.toString() === loggedInUserId?.toString();
        });

        const createdById = task.createdBy?._id || task.createdBy;
        const isCreatedByMe =
          createdById?.toString() === loggedInUserId?.toString();

        const isOthersAssigned = task.assignedMembers?.some((member) => {
          const memberId = typeof member === "object" ? member._id : member;
          return memberId?.toString() !== loggedInUserId?.toString();
        });

        const shouldShow =
          isAssignedToMe || (isCreatedByMe && !isOthersAssigned);
        const isPending = task.status?.toLowerCase().trim() === "pending";

        return isPending && shouldShow;
      });

      const sorted = filteredTasks.sort((a, b) => {
        const dateA = new Date(a.dueDate || a.startDate || a.createdAt);
        const dateB = new Date(b.dueDate || b.startDate || b.createdAt);
        return dateB - dateA;
      });

      setPendingTasks(sorted.slice(0, 2));
    } catch (err) {
      console.error("Pending tasks fetch error:", err);
      setPendingTasks([]);
    } finally {
      setPendingTasksLoading(false);
    }
  }, [loggedInUserId]);

  useEffect(() => {
    fetchPendingTasks();
  }, [fetchPendingTasks]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FETCH PROJECT DETAILS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const fetchProjectDetails = useCallback(async () => {
    try {
      setProjectDetailsLoading(true);
      const res = await portalInstance.get("/creat/tasks/project-details");
      if (res.data.success) {
        const rawList = res.data.data || [];
        const dedupedMap = new Map();
        rawList.forEach((p) => {
          const key = `${(p.category || "").trim().toLowerCase()}___${(p.projectName || "").trim().toLowerCase()}`;
          if (!dedupedMap.has(key)) {
            dedupedMap.set(key, p);
          } else {
            const existing = dedupedMap.get(key);
            if (p.projectName && /[A-Z]/.test(p.projectName) && !/[A-Z]/.test(existing.projectName)) {
              existing.projectName = p.projectName;
            }
          }
        });
        setProjectDetails(Array.from(dedupedMap.values()));
      }
    } catch (err) {
      console.error("Project details fetch error:", err);
    } finally {
      setProjectDetailsLoading(false);
    }
  }, []);

  const fetchProjectPhases = async (projectName, category) => {
    try {
      setPhasesLoading(true);
      setShowPhasesModal(true);
      setActivePhaseProject({ projectName, category });
      const res = await portalInstance.get("/creat/tasks/project-phases", {
        params: { projectName, category },
      });
      if (res.data.success) {
        const grouped = groupTasksWithHistory(res.data.data || [], res.data.holidays || [], res.data.leaves || []);
        setProjectPhases(grouped);
      }
    } catch (err) {
      console.error("Phases fetch error:", err);
    } finally {
      setPhasesLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!projectDetails || projectDetails.length === 0) {
      toast.info("No data available to export");
      return;
    }

    const filteredData = projectDetails.filter(
      (p) =>
        projectStatusFilter === "all" ||
        p.status?.toLowerCase() === projectStatusFilter
    );
    if (filteredData.length === 0) {
      toast.info("No data found for the current filter");
      return;
    }

    const headers = ["S.No", "Project Name", "Category", "Status"];
    const rows = filteredData.map((p, idx) => [
      idx + 1,
      p.projectName || "N/A",
      p.category || "N/A",
      p.status || "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `My_Projects_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Exported successfully!");
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SPECIAL DAYS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const fetchTodaySpecialDays = useCallback(async () => {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const currentDate = today.getDate();

      const res = await portalInstance.get(
        `/holiday-assignments/special-days/${currentYear}`
      );
      if (!res.data?.success || !res.data.data) {
        setTodaySpecialDays([]);
        setSpecialDaysAll([]);
        return;
      }

      const flatData = Array.isArray(res.data.data) ? res.data.data : [];
      const grouped = Array.isArray(res.data.grouped) ? res.data.grouped : [];
      const allDays = [];

      for (const sd of flatData) {
        const parsedDate = sd.date ? new Date(sd.date) : null;
        if (!parsedDate || Number.isNaN(parsedDate.getTime())) continue;
        allDays.push({
          _id: sd._id,
          name: sd.name,
          date: sd.date,
          day: parsedDate.getDate(),
          month: parsedDate.getMonth() + 1,
          year: parsedDate.getFullYear(),
        });
      }

      for (const monthData of grouped) {
        if (!Array.isArray(monthData.specialDays)) continue;
        for (const sd of monthData.specialDays) {
          const parsedDate = sd.date ? new Date(sd.date) : null;
          if (!parsedDate || Number.isNaN(parsedDate.getTime())) continue;
          const normalized = {
            _id: sd._id || `${monthData.month}-${sd.date}-${sd.name}`,
            name: sd.name,
            date: sd.date,
            day: parsedDate.getDate(),
            month: Number(monthData.month),
            year: currentYear,
          };
          const exists = allDays.some((item) =>
            item._id && normalized._id
              ? item._id === normalized._id
              : item.date === normalized.date && item.name === normalized.name
          );
          if (!exists) allDays.push(normalized);
        }
      }

      const foundToday = allDays.filter(
        (sd) =>
          sd.year === currentYear &&
          sd.month === currentMonth &&
          sd.day === currentDate
      );
      setSpecialDaysAll(allDays);
      setTodaySpecialDays(foundToday);
    } catch (err) {
      console.error("Fetch special days error:", err);
      setTodaySpecialDays([]);
      setSpecialDaysAll([]);
    }
  }, []);

  useEffect(() => {
    fetchTodaySpecialDays();
    const specialInterval = setInterval(fetchTodaySpecialDays, 60000);
    return () => clearInterval(specialInterval);
  }, [fetchTodaySpecialDays]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TO-DO FETCH
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const fetchTodos = async () => {
    setTodoLoading(true);
    try {
      const res = await portalInstance.get("/todo/all", {
        params: {
          statusFilter: todoStatusFilter,
          dateFilter: todoDateFilter,
          fromDate: todoCustomFromDate,
          toDate: todoCustomToDate,
        },
      });
      if (res.data.success) setTodos(res.data.data || []);
    } catch (err) {
      console.error("Fetch todos error:", err);
    } finally {
      setTodoLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  useEffect(() => {
    if (todoDateFilter !== "custom") {
      fetchTodos();
      return;
    }
    if (todoCustomFromDate && todoCustomToDate) {
      fetchTodos();
    }
  }, [todoStatusFilter, todoDateFilter, todoCustomFromDate, todoCustomToDate]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // HOLIDAY ASSIGNMENTS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const fetchHolidayAssignments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await portalInstance.get("/holiday-assignments/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const assignments = res.data.data || [];
        setPendingAssignments(assignments);
      }
    } catch (err) {
      console.error("Error fetching holiday assignments:", err);
    }
  }, [token]);

  useEffect(() => {
    fetchHolidayAssignments();
  }, [fetchHolidayAssignments]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // NOTIFICATIONS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const fetchNotifications = useCallback(async () => {
    if (!token || !loggedInUserId) return;
    try {
      const dismissedIds = JSON.parse(
        localStorage.getItem(`dismissedNotifications_${loggedInUserId}`) ||
        localStorage.getItem("dismissedNotifications") ||
        "[]"
      );

      let taskNotifs = [];
      let dueNotifs = [];
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
                ? task.taskTitle + (task.taskDetails ? "  " : "")
                : "") + (task.taskDetails || "No details provided."),
          }));

        // â”€â”€ Due Date Notifications & Alerts for Active Tasks â”€â”€
        const nowTime = new Date().getTime();
        const upcomingDueTasks = allTasks.filter((task) => {
          if (!task.dueDate) return false;
          const statusLower = String(task.status || "").toLowerCase();
          const assignedStatusLower = String(task.assignedStatus || "").toLowerCase();
          // Never show if task is completed, ignored, or rejected
          if (
            statusLower === "completed" ||
            statusLower === "ignored" ||
            statusLower === "rejected" ||
            assignedStatusLower === "rejected"
          ) {
            return false;
          }
          const isForMe = task.assignedMembers?.some((member) => {
            const mId = typeof member === "object" ? member._id : member;
            return mId?.toString() === loggedInUserId?.toString();
          });
          if (!isForMe) return false;

          const dueTime = new Date(task.dueDate).getTime();
          const diffHours = (dueTime - nowTime) / (1000 * 60 * 60);
          // Approaching due date: within next 48 hours or due today / tomorrow
          return diffHours <= 48 && diffHours >= -24;
        });

        setDueTasksAlerts(upcomingDueTasks);

        dueNotifs = upcomingDueTasks
          .filter((task) => !dismissedIds.includes(`due-${task._id}`))
          .map((task) => ({
            id: `due-${task._id}`,
            taskId: task._id,
            type: "TASK_DUE",
            title: "Task Due Date Reminder",
            message: task.taskTitle,
            subtext: `Due: ${new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}`,
            timestamp: task.dueDate || task.createdAt,
            isDueSoon: true,
            priority: task.priority,
            description: `Task "${task.taskTitle}" is due on ${new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}. Please complete and submit it before the deadline.`,
          }));
      } catch (err) {
        console.log("Tasks fetch error:", err);
      }

      let leaveNotifs = [];
      try {
        // BE filters isNotified:false + approved/rejected status in DB
        const leaveRes = await portalInstance.get("/api/leaves?notify=true");
        const allLeaves = Array.isArray(leaveRes.data)
          ? leaveRes.data
          : leaveRes.data?.data || [];
        leaveNotifs = allLeaves
          .filter(
            (leave) =>
              leave &&
              !dismissedIds.includes(leave._id)
          )
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
              type: notifType,
              title,
              message: `${leave.reasonType} (${leave.dayType})`,
              subtext: `${new Date(
                leave.fromDate
              ).toLocaleDateString()} - ${new Date(
                leave.toDate
              ).toLocaleDateString()}`,
              timestamp: leave.updatedAt || leave.createdAt,
            };
          });
      } catch (err) {
        console.log("Leaves fetch error:", err);
      }

      // â”€â”€ Calendar Notifications (Pending + Approved for this user) â”€â”€
      const myAssignments = pendingAssignments.filter((a) => {
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
          assignmentId: assignment._id,
          type: "HOLIDAY_CALENDAR",
          title: "Holiday Calendar Assigned",
          message: `Please fill the Holiday Calendar for ${assignment.year}`,
          subtext: `Status: ${assignment.status === "pending" ? "Not Started" : "In Progress"
            }`,
          timestamp: assignment.assignedDate,
        }));

      const approvedOnly = myAssignments.filter((a) => a.status === "approved");
      const approvedCalendarNotifs = approvedOnly
        .filter((a) => !dismissedIds.includes(`calendar-approved-${a._id}`))
        .map((assignment) => ({
          id: `calendar-approved-${assignment._id}`,
          assignmentId: assignment._id,
          type: "HOLIDAY_CALENDAR_APPROVED",
          title: "Holiday Calendar Approved",
          message: `Your Holiday Calendar for ${assignment.year} has been approved!`,
          subtext: "Approved by Admin",
          timestamp: assignment.reviewedDate || assignment.updatedAt || assignment.assignedDate,
        }));

      const calendarNotifs = [...pendingCalendarNotifs, ...approvedCalendarNotifs];

      const combined = [...taskNotifs, ...dueNotifs, ...leaveNotifs, ...calendarNotifs].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      setNotifications(combined);
    } catch (err) {
      console.error("Notification Fetch Error:", err);
    }
  }, [token, loggedInUserId, pendingAssignments]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const fetchKural = async () => {
      try {
        setKuralLoading(true);
        const res = await portalInstance.get("/thirukkural/current");
        if (res.data.success) {
          setKural(res.data.data);
        }
      } catch (err) {
        console.error("Kural fetch error:", err);
      } finally {
        setKuralLoading(false);
      }
    };
    fetchKural();
  }, []);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // NOTIFICATION HANDLERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const handleDismiss = async (e, id) => {
    e.stopPropagation();

    // Find notification to check type
    const notif = notifications.find(n => n.id === id);

    // Backend Sync for Leaves
    if (notif && (notif.type === "APPROVED" || notif.type === "CANCEL")) {
      try {
        await portalInstance.put(`/api/leaves/${id}/dismiss`);
      } catch (err) {
        console.error("Failed to dismiss leave notification:", err);
      }
    }

    // Backend Sync for Holiday Assignments
    if (
      notif &&
      (notif.type === "HOLIDAY_CALENDAR_APPROVED" ||
        notif.type === "HOLIDAY_CALENDAR" ||
        (typeof notif.id === "string" && notif.id.startsWith("calendar-")))
    ) {
      try {
        const assignId = notif.assignmentId || notif.id.replace(/^calendar-(?:approved-)?/, "");
        await portalInstance.put(`/holiday-assignments/${assignId}/dismiss`);
      } catch (err) {
        console.error("Failed to dismiss holiday assignment notification:", err);
      }
    }

    const currentDismissed = JSON.parse(
      localStorage.getItem(`dismissedNotifications_${loggedInUserId}`) ||
      localStorage.getItem("dismissedNotifications") ||
      "[]"
    );
    if (!currentDismissed.includes(id)) {
      currentDismissed.push(id);
      localStorage.setItem(
        `dismissedNotifications_${loggedInUserId}`,
        JSON.stringify(currentDismissed)
      );
      localStorage.setItem(
        "dismissedNotifications",
        JSON.stringify(currentDismissed)
      );
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNotifClick = async (notif) => {
    // Backend Sync for Leaves
    if (notif && (notif.type === "APPROVED" || notif.type === "CANCEL")) {
      try {
        await portalInstance.put(`/api/leaves/${notif.id}/dismiss`);
      } catch (err) {
        console.error("Failed to dismiss leave notification:", err);
      }
    }

    // Backend Sync for Holiday Assignments
    if (
      notif &&
      (notif.type === "HOLIDAY_CALENDAR_APPROVED" ||
        notif.type === "HOLIDAY_CALENDAR" ||
        (typeof notif.id === "string" && notif.id.startsWith("calendar-")))
    ) {
      try {
        const assignId = notif.assignmentId || notif.id.replace(/^calendar-(?:approved-)?/, "");
        await portalInstance.put(`/holiday-assignments/${assignId}/dismiss`);
      } catch (err) {
        console.error("Failed to dismiss holiday assignment notification:", err);
      }
    }

    const currentDismissed = JSON.parse(
      localStorage.getItem(`dismissedNotifications_${loggedInUserId}`) ||
      localStorage.getItem("dismissedNotifications") ||
      "[]"
    );
    if (!currentDismissed.includes(notif.id)) {
      currentDismissed.push(notif.id);
      localStorage.setItem(
        `dismissedNotifications_${loggedInUserId}`,
        JSON.stringify(currentDismissed)
      );
      localStorage.setItem(
        "dismissedNotifications",
        JSON.stringify(currentDismissed)
      );
    }
    if (notif.type === "TASK" || notif.type === "TASK_DUE") {
      navigate("/emp/tasks");
    } else if (notif.type === "HOLIDAY_CALENDAR" || notif.type === "HOLIDAY_CALENDAR_APPROVED") {
      navigate("/emp/holiday-requests");
    } else {
      navigate("/emp/request-leave");
    }
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ATTENDANCE HANDLERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const handleDashboardCheckIn = async (reason = "", ip = "") => {
    if (checkInLoading || isCurrentlyCheckedIn || hasCheckedOut) return;
    setCheckInLoading(true);
    try {
      const res = await portalInstance.post("/portal/attendance/check-in", {
        lateReason: reason,
        ipReason: ip,
      });
      const data = res.data.data;
      setTodayAttendance(data);
      const now = new Date();
      sessionStorage.setItem("loginTime", now.toISOString());
      setLoginTime(now);
      setShowCheckInModal(false);
      if (location.pathname === "/emp/dashboard") {
        toast.success("Checked in at " + formatAttendanceTime(data.checkIn2 || data.checkIn1 || data.checkInTime));
      }
    } catch (err) {
      // ===== IP VALIDATION START =====
      if (err?.response?.data?.requireIPReason) {
        setPendingLateReason(reason);
        setIpReason("");
        setShowIPReasonModal(true);
      } else if (err?.response?.data?.requiresHalfDayConfirmation) {
        setPendingMorningInformData({
          permissionId: err.response.data.permissionId,
          lateReason: reason,
          ipReason: ip,
        });
        setShowCheckInModal(false);
        setShowHalfDayConfirmModal(true);
      } else {
        console.error("Dashboard check-in error:", err);
        toast.error(err?.response?.data?.message || "Check-in failed");
      }
      // ===== IP VALIDATION END =====
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckIn = async (reason = "", ip = "") => {
    if (isNonWorkingDay) {
      toast.error(nonWorkingReason);
      return;
    }
    if (actionLoading || isCurrentlyCheckedIn || hasCheckedOut) return;
    setActionLoading(true);
    try {
      const res = await portalInstance.post("/portal/attendance/check-in", {
        lateReason: reason,
        ipReason: ip,
      });
      const data = res.data.data;
      setTodayAttendance(data);
      const now = new Date();
      sessionStorage.setItem("loginTime", now.toISOString());
      setLoginTime(now);
      setShowCheckInModal(false);
      if (location.pathname === "/emp/dashboard") {
        toast.success("Checked in at " + formatAttendanceTime(data.checkIn2 || data.checkIn1 || data.checkInTime));
      }
    } catch (err) {
      // ===== IP VALIDATION START =====
      if (err?.response?.data?.requireIPReason) {
        setPendingLateReason(reason);
        setIpReason("");
        setShowIPReasonModal(true);
      } else if (err?.response?.data?.requiresHalfDayConfirmation) {
        setPendingMorningInformData({
          permissionId: err.response.data.permissionId,
          lateReason: reason,
          ipReason: ip,
        });
        setShowCheckInModal(false);
        setShowHalfDayConfirmModal(true);
      } else {
        toast.error(err?.response?.data?.message || "Check-in failed");
      }
      // ===== IP VALIDATION END =====
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async (ip = "") => {
    if (isNonWorkingDay) {
      toast.error(nonWorkingReason);
      return;
    }
    if (actionLoading || !hasCheckedIn || hasCheckedOut) return;
    setActionLoading(true);
    try {
      const res = await portalInstance.post("/portal/attendance/check-out", {
        ipReason: ip,
      });
      const data = res.data.data;
      setTodayAttendance(data);
      if (location.pathname === "/emp/dashboard") {
        let totalMins = 0;
        const s1In = data?.checkIn1 || data?.checkInTime;
        const s1Out = data?.checkOut1 || data?.checkOutTime;
        if (s1In && s1Out) {
          totalMins += Math.floor((new Date(s1Out).getTime() - new Date(s1In).getTime()) / 60000);
        }
        if (data?.checkIn2 && data?.checkOut2) {
          totalMins += Math.floor((new Date(data.checkOut2).getTime() - new Date(data.checkIn2).getTime()) / 60000);
        }
        toast.success(
          "Checked out. Working: " + formatWorkingHours(totalMins)
        );
      }
    } catch (err) {
      // ===== IP VALIDATION START =====
      if (err?.response?.data?.requireIPReason) {
        setIsCheckoutIP(true);
        setIpReason("");
        setShowIPReasonModal(true);
      } else {
        toast.error(err?.response?.data?.message || "Check-out failed");
      }
      // ===== IP VALIDATION END =====
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCheckOut = () => {
    setShowCheckoutModal(false);
    handleCheckOut();
  };

  const cancelCheckOut = () => {
    setShowCheckoutModal(false);
  };

  const handlePermissionClick = (type) => {
    if (isNonWorkingDay) {
      toast.error(nonWorkingReason);
      return;
    }
    if (hasInformPermission || todayAttendance?.hasPermission) {
      toast.warning("A permission request has already been submitted for today. Informed permission is not allowed.");
      return;
    }
    setPermissionType(type);
    setPermissionData({
      fromTime: "",
      toTime: "",
      reason: "",
      informedVia: "Mobile Call",
      permissionType: ""
    });
    setShowPermissionModal(true);
  };

  const handlePermissionSubmit = async () => {
    const { fromTime, toTime, reason, permissionType } = permissionData;
    if (!permissionType) {
      toast.warning("Please select the permission type");
      return;
    }
    if (!fromTime) {
      toast.warning("Please select From time");
      return;
    }
    if (!toTime) {
      toast.warning("Please select To time");
      return;
    }
    if (!reason || !reason.trim()) {
      toast.warning("Please enter reason");
      return;
    }

    const todayStr = moment().format("YYYY-MM-DD");
    const formattedFrom = moment(fromTime, ["h:mm A", "HH:mm"]).format("HH:mm");
    const formattedTo = moment(toTime, ["h:mm A", "HH:mm"]).format("HH:mm");

    if (formattedFrom < "10:00" || formattedTo > "18:30") {
      toast.error("Permission times must be within office hours (10:00 AM - 6:30 PM)");
      return;
    }
    const fromDate = `${todayStr}T${formattedFrom}`;
    const toDate = `${todayStr}T${formattedTo}`;

    if (moment(toDate).isSameOrBefore(moment(fromDate))) {
      toast.error("To time must be greater than From time");
      return;
    }

    const durationMinutes = moment(toDate).diff(moment(fromDate), "minutes");
    const isMorningInform = permissionData.permissionType === "MORNING" || (permissionType && permissionType.toLowerCase().includes("morning"));

    if (durationMinutes > 120) {
      if (isMorningInform) {
        setPendingMorningInformData({
          from: fromDate,
          to: toDate,
          reason: reason.trim(),
          type: permissionType,
          informedVia: "Mobile Call",
          permissionType: "MORNING",
          wasOpenedFromInformModal: true,
        });
        setShowPermissionModal(false);
        setShowHalfDayConfirmModal(true);
        return;
      }
      toast.error("Permission is allowed for a maximum of 2 hours only. If you require more than 2 hours, please apply for Half-Day Leave instead of Permission.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await portalInstance.post("/portal/attendance/inform-permission", {
        from: fromDate,
        to: toDate,
        reason: reason.trim(),
        type: permissionType,
        informedVia: "Mobile Call",
        permissionType: permissionData.permissionType,
      });

      if (res.data?.requiresHalfDayConfirmation) {
        setPendingMorningInformData({
          from: fromDate,
          to: toDate,
          reason: reason.trim(),
          type: permissionType,
          informedVia: "Mobile Call",
          permissionType: "MORNING",
          permissionId: res.data.permissionId,
          wasOpenedFromInformModal: true,
        });
        setShowPermissionModal(false);
        setShowHalfDayConfirmModal(true);
        return;
      }

      toast.success("Inform permission submitted successfully");
      setHasInformPermission(true);
      setShowPermissionModal(false);
      setPermissionData({ fromTime: "", toTime: "", reason: "", informedVia: "Mobile Call", permissionType: "" });
      initAttendance();
    } catch (err) {
      if (err?.response?.data?.requiresHalfDayConfirmation) {
        setPendingMorningInformData({
          from: fromDate,
          to: toDate,
          reason: reason.trim(),
          type: permissionType,
          informedVia: "Mobile Call",
          permissionType: "MORNING",
          permissionId: err.response.data.permissionId,
          wasOpenedFromInformModal: true,
        });
        setShowPermissionModal(false);
        setShowHalfDayConfirmModal(true);
      } else {
        toast.error(
          err?.response?.data?.message || "Failed to submit permission request"
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmHalfDayCheckIn = async (customIpReason = "") => {
    if (halfDayConfirmLoading) return;
    setHalfDayConfirmLoading(true);
    try {
      const activeIpReason = (typeof customIpReason === "string" && customIpReason.trim())
        ? customIpReason.trim()
        : (pendingMorningInformData?.ipReason || ipReason || "");

      const payload = {
        permissionId: pendingMorningInformData?.permissionId,
        permissionData: pendingMorningInformData?.from ? pendingMorningInformData : undefined,
        lateReason: pendingMorningInformData?.lateReason || "",
        ipReason: activeIpReason,
        confirmHalfDay: true,
      };

      const res = await portalInstance.post(
        "/portal/attendance/confirm-morning-inform-checkin",
        payload
      );

      const data = res.data.data;
      setTodayAttendance(data);
      const now = new Date();
      sessionStorage.setItem("loginTime", now.toISOString());
      setLoginTime(now);
      setShowHalfDayConfirmModal(false);
      setShowPermissionModal(false);
      setShowCheckInModal(false);
      setShowIPReasonModal(false);
      setIsHalfDayConfirmIP(false);
      setPendingMorningInformData(null);
      setHasInformPermission(true);

      const checkInTimeStr = data?.checkIn1 || data?.checkInTime || data?.checkIn2;
      toast.success(
        "Checked in at " + (checkInTimeStr ? formatAttendanceTime(checkInTimeStr) : "now") + " (Half-day leave deducted)"
      );

      // Refresh attendance state
      initAttendance();
    } catch (err) {
      if (err?.response?.data?.requireIPReason) {
        setShowHalfDayConfirmModal(false);
        setIsHalfDayConfirmIP(true);
        setIpReason("");
        setShowIPReasonModal(true);
      } else {
        console.error("Morning inform half-day confirmation error:", err);
        toast.error(
          err?.response?.data?.message || "Failed to process half-day check-in"
        );
      }
    } finally {
      setHalfDayConfirmLoading(false);
    }
  };

  const handleCancelHalfDayCheckIn = () => {
    if (halfDayConfirmLoading) return;
    const shouldReopenInformModal = pendingMorningInformData?.wasOpenedFromInformModal || pendingMorningInformData?.from;
    setShowHalfDayConfirmModal(false);
    setPendingMorningInformData(null);
    if (shouldReopenInformModal) {
      setShowPermissionModal(true);
    }
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TO-DO HANDLERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const handleOpenConfirm = (todo) => {
    setSelectedTodo(todo);
    setShowConfirmModal(true);
  };

  const handleConfirmComplete = async () => {
    if (!selectedTodo) return;
    try {
      await portalInstance.put(`/todo/complete/${selectedTodo._id}`);
      toast.success("Todo marked as completed successfully");
      setShowConfirmModal(false);
      setShowDetailModal(false);
      setSelectedTodo(null);
      fetchTodos();
    } catch (err) {
      console.error("Complete todo error:", err);
      toast.error("Failed to complete todo");
    }
  };

  const handleSaveTodo = async () => {

    if (!todoTitle.trim()) {
      toast.error("Please enter Title");
      return;
    }

    if (!todoDescription.trim()) {
      toast.error("Please enter Work Description");
      return;
    }

    if (!todoDate) {
      toast.error("Please select Due Date");
      return;
    }

    try {

      if (isEditMode && selectedTodo) {
        await portalInstance.put(`/todo/update/${selectedTodo._id}`, {
          title: todoTitle,
          description: todoDescription,
          date: todoDate,
          status: editStatus,
        });

        toast.success("Todo updated successfully");
      } else {
        await portalInstance.post("/todo/create", {
          title: todoTitle,
          description: todoDescription,
          date: todoDate,
          status: "pending",
        });

        toast.success("Todo created successfully");
      }

      setShowTodoModal(false);
      setTodoTitle("");
      setTodoDescription("");
      setTodoDate("");
      setIsEditMode(false);
      setSelectedTodo(null);

      fetchTodos();

    } catch (err) {
      console.error("Todo save error:", err);
      toast.error("Failed to save todo");
    }
  };

  const handleCloseTodoModal = () => {
    setShowTodoModal(false);
    setIsEditMode(false);
    setSelectedTodo(null);
    setTodoTitle("");
    setTodoDescription("");
    setTodoDate("");
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TASK HANDLERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const handleTaskClick = (taskId) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseTaskModal = () => {
    setSelectedTaskId(null);
    fetchPendingTasks();
  };

  const handleAcceptTaskBanner = async (e, taskId) => {
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
      setNotifications((prev) => prev.filter((notif) => notif.id !== taskId));
      fetchPendingTasks();
      if (typeof fetchNotifications === "function") {
        fetchNotifications();
      }
    } catch (err) {
      console.error("Accept task error:", err);
      toast.error("Failed to accept task.");
    }
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FORMATTING HELPERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const formattedDate =
    loginTime?.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    }) || "";

  const formatTodoDate = (date) => {
    const d = new Date(date);
    return {
      day: d.getDate(),
      month: d.toLocaleString("en-US", { month: "short" }),
    };
  };

  const formatFullDate = (date) => {
    const d = new Date(date);
    const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    return `${month} - ${d.getDate()}`;
  };

  const formatTaskCardDate = (dateStr) => {
    if (!dateStr) return { month: "", day: "" };
    const d = new Date(dateStr);
    return {
      month: d.toLocaleString("en-US", { month: "short" }),
      day: String(d.getDate()).padStart(2, "0"),
    };
  };

  const isToday = (date) => new Date(date).toDateString() === todayStr;

  const isPast = (date) => {
    const d = new Date(date);
    const today = new Date();
    d.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return d < today;
  };

  const isFuture = (date) => {
    const d = new Date(date);
    const today = new Date();
    d.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return d > today;
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // NOTIFICATION HELPERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const getNotifBorderClass = (type) => {
    switch (type) {
      case "TASK": return "border-task";
      case "APPROVED": return "border-approved";
      case "CANCEL": return "border-cancel";
      case "HOLIDAY_CALENDAR": return "border-calendar";
      default: return "";
    }
  };

  const getNotifTitleClass = (type) => {
    switch (type) {
      case "TASK": return "text-primary";
      case "APPROVED": return "text-success";
      case "CANCEL": return "text-danger";
      case "HOLIDAY_CALENDAR": return "text-warning";
      default: return "text-secondary";
    }
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TO-DO FILTERED DATA
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const pendingToday = todos.filter(
    (t) => isToday(t.date) && t.status?.toLowerCase() !== "completed"
  );
  const overdue = todos.filter(
    (t) => isPast(t.date) && t.status?.toLowerCase() !== "completed"
  );
  const completedToday = todos.filter(
    (t) => isToday(t.date) && t.status?.toLowerCase() === "completed"
  );
  const upcoming = todos.filter(
    (t) => isFuture(t.date) && t.status?.toLowerCase() !== "completed"
  );
  const totalUpcomingPages = Math.ceil(upcoming.length / ITEMS_PER_PAGE);
  const paginatedUpcoming = upcoming.slice(
    (upcomingPage - 1) * ITEMS_PER_PAGE,
    upcomingPage * ITEMS_PER_PAGE
  );

  // â”€â”€â”€ PAGINATION COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const TodoPagination = ({ currentPage, totalPages, onPageChange }) => {
    const pages = Array.from(
      { length: Math.max(1, totalPages) },
      (_, i) => i + 1
    );
    return (
      <div className="pagination-to-do-list">
        <button
          className="emp-todo-arrow"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <Icon icon="ep:arrow-left" width={16} />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            className={`emp-todo-page${currentPage === page ? " emp-todo-active" : ""}`}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
        <button
          className="emp-todo-arrow"
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <Icon icon="ep:arrow-right" width={16} />
        </button>
      </div>
    );
  };

  // (Derived state declarations moved to component mount level for scope sharing)
  const birthdayEmployeeName =
    employee?.name ||
    employee?.empId?.name ||
    sessionData?.name ||
    sessionData?.user?.name ||
    "Team Member";

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  return (
    <>
      <Sidebar />

      <div className="employeedashboard">
        <div className="employeedashboard-wrapper position-relative">
          <Container fluid>


            {showPwdBanner && (
              <PasswordExpiryBanner
                expiryDate={expiryDate}
                onDismiss={() => setShowPwdBanner(false)}
              />
            )}

            {/* HR UPCOMING YEAR HOLIDAY PREPARATION ALERT */}
            <HRHolidayAlertBanner />

            {/* HR UPCOMING YEAR LEAVE CATEGORY PREPARATION ALERT */}
            <HRLeaveCategoryAlertBanner />

            {/* DASHBOARD BANNER */}
            <div className="employee-dashboard-banner">
              <div className={`employee-dashboard-content ${language === "english" ? "lang-en" : ""}`}>

                <div className="employee-dashboard-left">

                  {/* KURAL CONTENT */}
                  {kuralLoading ? (
                    <p className="employee-dashboard-subtitle">Loading Kural...</p>
                  ) : kural ? (
                    <>
                      {language === "tamil" ? (
                        <>
                          <h2 className="employee-dashboard-title">
                            {kural.Line1}
                            <br />
                            {kural.Line2}
                          </h2>
                          <div className="kural-meanings">
                            {[kural.mv, kural.sp, kural.mk].filter(Boolean)[kuralDotIndex] && (
                              <p key={kuralDotIndex} className="kural-meaning-slide">
                                {[kural.mv, kural.sp, kural.mk].filter(Boolean)[kuralDotIndex]}
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <h2 className="employee-dashboard-title">
                            {kural.transliteration1 || kural.couplet || kural.Translation || ""}
                            <br />
                            {kural.transliteration2 || ""}
                          </h2>
                          <div className="kural-meanings">
                            <p className="kural-meaning-slide" style={{ maxWidth: "85%" }}>
                              {kural.explanation || kural.Translation || "No explanation available"}
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="employee-dashboard-subtitle">No Kural available</p>
                  )}

                  {/* LANGUAGE SWITCH */}
                  <div className="kural-language-switch">
                    <button
                      className={`kural-language-btn ${language === "tamil" ? "active" : ""}`}
                      onClick={() => setLanguage("tamil")}
                    >
                      தமிழ்
                    </button>
                    <button
                      className={`kural-language-btn ${language === "english" ? "active" : ""}`}
                      onClick={() => setLanguage("english")}
                    >
                      English
                    </button>
                  </div>

                </div>

                <div className="employee-dashboard-right">
                  {/* WHITE DOTS */}
                  {language === "tamil" && kural && (
                    <div className="kural-dots">
                      {[kural.mv, kural.sp, kural.mk].filter(Boolean).map((_, i) => (
                        <button
                          key={i}
                          className={`kural-dot${kuralDotIndex === i ? " kural-dot-active" : ""}`}
                          onClick={() => setKuralDotIndex(i)}
                          aria-label={`Definition ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                  <img
                    src="/Valluvar.png"
                    alt="Thirukkural"
                    className="employee-dashboard-img"
                  />
                </div>

              </div>
            </div>

            {/* â”€â”€ RECEIVED BIRTHDAY WISHES PANEL (FOR BIRTHDAY EMPLOYEE) â”€â”€ */}
            {receivedWishes.length > 0 && (() => {
              const sortedWishes = [...receivedWishes].sort((a, b) => {
                const aReplied = !!a.reply;
                const bReplied = !!b.reply;
                if (!aReplied && bReplied) return -1;
                if (aReplied && !bReplied) return 1;
                return new Date(b.createdAt) - new Date(a.createdAt);
              });
              const pageSize = 3;
              const totalItems = sortedWishes.length;
              const paginatedWishes = sortedWishes.slice(
                (receivedWishesPage - 1) * pageSize,
                receivedWishesPage * pageSize
              );

              return (
                <div className="emp-received-wishes-card mb-4 p-3">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div>
                      <h4 className="m-0 emp-received-wishes-title">
                        Happy Birthday! You Received {totalItems} Wish{totalItems > 1 ? "es" : ""} Today!
                      </h4>
                      <p className="m-0 text-muted emp-received-wishes-subtitle">
                        Your team members sent warm wishes for your birthday. Send them a reply!
                      </p>
                    </div>
                  </div>

                  <div className="emp-received-wishes-list d-flex flex-column gap-3">
                    {paginatedWishes.map((w) => (
                      <div key={w._id} className="emp-received-wish-item p-3 rounded-3">
                        <div className="d-flex align-items-start gap-3">
                          <img
                            src={w.senderPhoto || "/avatar.png"}
                            alt={w.senderName}
                            className="emp-received-wish-avatar"
                            onError={(e) => { e.target.src = "/avatar.png"; }}
                          />
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center justify-content-between">
                              <h6 className="m-0 emp-received-wish-sender">{w.senderName}</h6>
                              <small className="text-muted emp-received-wish-time">
                                {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </small>
                            </div>
                            <p className="mt-1 mb-2 emp-received-wish-msg">
                              "{w.message}"
                            </p>

                            {/* Reply Section */}
                            {w.reply ? (
                              <div className="emp-received-reply-box p-2 rounded-2">
                                <strong className="emp-received-reply-label">Your Reply:</strong> "{w.reply}"
                              </div>
                            ) : (
                              <div className="d-flex align-items-center gap-2 mt-2">
                                <Form.Control
                                  type="text"
                                  size="sm"
                                  placeholder="Type Thank You reply..."
                                  defaultValue={replyInputMap[w._id] !== undefined ? replyInputMap[w._id] : "Thank you so much for your warm birthday wishes!"}
                                  onChange={(e) => setReplyInputMap((prev) => ({ ...prev, [w._id]: e.target.value }))}
                                  className="emp-received-reply-input"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSendReply(w._id)}
                                  disabled={replyingWishId === w._id}
                                  className="common-modal-btn btn-update"
                                >
                                  {replyingWishId === w._id ? <Spinner animation="border" size="sm" /> : "Send Reply"}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalItems > pageSize && (
                    <div className="mt-3">
                      <Pagination
                        totalItems={totalItems}
                        pageSize={pageSize}
                        currentPage={receivedWishesPage}
                        onPageChange={(page) => setReceivedWishesPage(page)}
                        maxPagesInGroup={5}
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── EMPLOYEE BIRTHDAY CELEBRATION CARD (FOR CO-WORKERS) ── */}
            {todayBirthdays.filter((emp) => String(emp._id) !== String(employee?._id)).length > 0 && (
              <div className="admin-birthday-card">
                {/* Background Floating Festive Elements: Balloons, Cakes, Birthday Caps, Poppers, Candies */}
                <div className="admin-birthday-card__bg-item b1" title="Balloon">{"\u{1F388}"}</div>
                <div className="admin-birthday-card__bg-item b2" title="Cake">{"\u{1F382}"}</div>
                <div className="admin-birthday-card__bg-item b3" title="Birthday Cap">{"\u{1F973}"}</div>
                <div className="admin-birthday-card__bg-item b4" title="Popper">{"\u{1F389}"}</div>
                <div className="admin-birthday-card__bg-item b5" title="Candy">{"\u{1F36C}"}</div>
                <div className="admin-birthday-card__bg-item b6" title="Lollipop">{"\u{1F36D}"}</div>
                <div className="admin-birthday-card__bg-item b7" title="Balloon">{"\u{1F388}"}</div>
                <div className="admin-birthday-card__bg-item b8" title="Cake Slice">{"\u{1F370}"}</div>
                <div className="admin-birthday-card__bg-item b9" title="Party Cap">
                  <svg width="28" height="28" viewBox="0 0 36 36" fill="none" style={{ verticalAlign: "middle" }}>
                    <path d="M18 4L6 31C6 31 12 33 18 33C24 33 30 31 30 31L18 4Z" fill="#F43F5E" />
                    <path d="M12.5 16.5L8.2 26C11 27 14.5 27.5 18 27.5C21.5 27.5 25 27 27.8 26L23.5 16.5H12.5Z" fill="#FBBF24" />
                    <path d="M15 10.5L13.5 14H22.5L21 10.5H15Z" fill="#60A5FA" />
                    <circle cx="18" cy="4" r="3.5" fill="#FBBF24" />
                    <circle cx="13" cy="22" r="1.5" fill="#FFFFFF" />
                    <circle cx="18" cy="20" r="1.5" fill="#FFFFFF" />
                    <circle cx="23" cy="22" r="1.5" fill="#FFFFFF" />
                  </svg>
                </div>
                <div className="admin-birthday-card__bg-item b10" title="Confetti Popper">{"\u{1F38A}"}</div>
                <div className="admin-birthday-card__bg-item b11" title="Birthday Cake">{"\u{1F382}"}</div>
                <div className="admin-birthday-card__bg-item b12" title="Candy">{"\u{1F36C}"}</div>

                <div className="admin-birthday-card__header">
                  <div className="admin-birthday-card__icon-badge">
                    <FaBirthdayCake className="admin-birthday-card__cake-icon" />
                  </div>
                  <div className="admin-birthday-card__header-text">
                    <h4 className="admin-birthday-card__title">
                      Today's Employee Birthday{todayBirthdays.length > 1 ? "s" : ""}!
                    </h4>
                    <p className="admin-birthday-card__subtitle">
                      Celebrate and send warm birthday wishes to your team member{todayBirthdays.length > 1 ? "s" : ""} celebrating today!
                    </p>
                  </div>
                </div>

                {(() => {
                  const bdayEmps = todayBirthdays.filter((emp) => String(emp._id) !== String(employee?._id));
                  const bdayCount = bdayEmps.length;
                  const gridCols = bdayCount === 1 ? "1fr" : bdayCount === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)";
                  return (
                    <div className="admin-birthday-card__grid" style={{ gridTemplateColumns: gridCols }}>
                      {bdayEmps.map((emp, index) => {
                        const wishObj = sentWishes.find((w) => String(w.receiverId) === String(emp._id));
                        const hasReply = wishObj && !!wishObj.reply;

                        return (
                          <div
                            key={emp._id}
                            className="admin-birthday-card__item"
                            style={{ animationDelay: `${0.12 * (index + 1)}s` }}
                          >
                            <div className="admin-birthday-card__avatar-wrap">
                              <img
                                src={emp.photo || "/avatar.png"}
                                alt={emp.name}
                                className="admin-birthday-card__avatar"
                                onError={(e) => { e.target.src = "/avatar.png"; }}
                              />
                              {/* <span className="admin-birthday-card__confetti-badge">🎂</span> */}
                            </div>
                            <div className="admin-birthday-card__emp-details">
                              <h5 className="admin-birthday-card__emp-name">{emp.name}</h5>
                              <span className="admin-birthday-card__emp-id">{emp.empId}</span>
                              <div className="admin-birthday-card__emp-meta">
                                <span>{emp.designation}</span>
                              </div>
                              {hasReply && (
                                <div className="admin-birthday-card__reply-box mt-1">
                                  <span className="admin-birthday-card__reply-tag">Reply:</span> "{wishObj.reply}"
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Send Wishes Button at RIGHT BOTTOM CORNER (Only for other employees, not for self) */}
                {(() => {
                  const otherBirthdayEmps = todayBirthdays.filter(
                    (emp) => String(emp._id) !== String(employee?._id)
                  );
                  if (otherBirthdayEmps.length === 0) return null;
                  const hasWished = sentWishes.some((w) =>
                    otherBirthdayEmps.some((emp) => String(emp._id) === String(w.receiverId))
                  );
                  return (
                    <div className="admin-birthday-card__footer">
                      <button
                        className={`admin-birthday-card__wish-btn ${hasWished ? "wished" : ""}`}
                        disabled={hasWished}
                        onClick={() => !hasWished && handleOpenWishModal(otherBirthdayEmps)}
                      >
                        {hasWished ? "Wished " : "Send Wishes "}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* MISSING PROFILE DETAILS BANNER */}
            <MissingProfileBanner
              employee={employee}
              profileCompletion={profileCompletion}
            />

            {/* ATTENDANCE CARDS */}
            <Row className="dash-attendance-row">
              <Col lg={4} md={6}>
                <div className="dash-attn-card">
                  <div className="dash-attn-card-header">
                    <div className="dash-attn-card-left">
                      <div className="dash-attn-icon-box dash-attn-icon-in">
                        <img src={Checkin} alt="Check In" />
                      </div>
                      <span className="dash-attn-card-title">Check In</span>
                    </div>
                    <span
                      className={`dash-attn-permission-link${isNonWorkingDay ? " disabled" : ""}`}
                      onClick={() =>
                        !isNonWorkingDay &&
                        handlePermissionClick("CHECK_IN")
                      }
                    >
                      Inform Permission
                    </span>
                  </div>
                  {hasCheckedIn ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                        <div className="dash-attn-time" style={{ marginBottom: 0 }}>
                          {formatAttendanceTime(
                            todayAttendance?.checkIn2 ||
                            todayAttendance?.checkIn1 ||
                            todayAttendance?.checkInTime
                          )}
                        </div>
                        {todayAttendance?.checkIn1 &&
                          todayAttendance?.checkOut1 &&
                          todayAttendance?.checkIn2 && (
                            <div
                              style={{
                                fontSize: "10.5px",
                                color: "#7b7b7b",
                                whiteSpace: "nowrap"
                              }}
                            >
                              First Check-In : {formatAttendanceTime(todayAttendance?.checkIn1)}
                            </div>
                          )}
                        {canReCheckIn && (
                          <button
                            className="dash-attn-btn dash-attn-btn-in"
                            onClick={() => handleDashboardCheckIn("")}
                            disabled={actionLoading}
                            style={{ margin: 0, padding: "6px 12px", width: "auto", fontSize: "14px", height: "38px", whiteSpace: "nowrap" }}
                          >
                            {actionLoading ? "Checking In..." : "Check-In Again"}
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <button
                      className="dash-attn-btn dash-attn-btn-in"
                      onClick={() => {
                        const now = new Date();
                        const isLate =
                          now.getHours() > 10 ||
                          (now.getHours() === 10 && now.getMinutes() > 0);
                        if (isLate && !canReCheckIn && !hasInformPermission) {
                          setShowCheckInModal(true);
                        } else {
                          handleDashboardCheckIn("");
                        }
                      }}
                      disabled={actionLoading || hasCheckedOut || isNonWorkingDay}
                    >
                      {actionLoading ? "Checking In..." : "Check-in"}
                    </button>
                  )}
                </div>
              </Col>

              <Col lg={4} md={6}>
                <div className="dash-attn-card">
                  <div className="dash-attn-card-header">
                    <div className="dash-attn-card-left">
                      <div className="dash-attn-icon-box dash-attn-icon-out">
                        <img src={Checkout} alt="Check Out" />
                      </div>
                      <span className="dash-attn-card-title">Check Out</span>
                    </div>
                    <span
                      className={`dash-attn-permission-link${isNonWorkingDay ? " disabled" : ""}`}
                      onClick={() =>
                        !isNonWorkingDay &&
                        handlePermissionClick("CHECK_OUT")
                      }
                    >
                      Inform Permission
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px" }}>
                    {showCheckOutTime ? (
                      <div className="dash-attn-time">
                        {formatAttendanceTime(todayAttendance?.checkOut2 || todayAttendance?.checkOut1 || todayAttendance?.checkOutTime)}
                      </div>
                    ) : (
                      <button
                        className="dash-attn-btn dash-attn-btn-out"
                        onClick={() => {
                          if (!isCurrentlyCheckedIn) return;
                          if (isNonWorkingDay) {
                            toast.error(nonWorkingReason);
                            return;
                          }
                          setShowCheckoutModal(true);
                        }}
                        disabled={!isCurrentlyCheckedIn || actionLoading || isNonWorkingDay}
                        style={{ width: "50%", margin: 0, height: "40px", padding: "0 24px" }}
                      >
                        {actionLoading ? "Checking Out..." : "Check-out"}
                      </button>
                    )}

                    {todayAttendance?.checkIn1 &&
                      todayAttendance?.checkOut1 &&
                      todayAttendance?.checkIn2 && (
                        <div
                          style={{
                            fontSize: "9.5px",
                            color: "#7b7b7b",
                            paddingBottom: "10px",
                            whiteSpace: "nowrap"
                          }}
                        >
                          First Check-Out : {formatAttendanceTime(todayAttendance?.checkOut1)}
                        </div>
                      )}
                  </div>
                </div>
              </Col>

              <Col lg={4} md={12} className="mb-3">
                <div className="dash-attn-card">
                  <div className="dash-attn-card-header">
                    <div className="dash-attn-card-left">
                      <div className="dash-attn-icon-box dash-attn-icon-hours">
                        <img src={WorkingHours} alt="Working Hours" />
                      </div>
                      <span className="dash-attn-card-title">Working Hours</span>
                    </div>
                  </div>
                  <div className="dash-attn-time">
                    {showCheckOutTime || hasCheckedIn
                      ? liveDuration
                      : "00h:00m:00s"}
                  </div>
                </div>
              </Col>
            </Row>

            {/* LATE CHECK-IN INFO BANNER */}
            {todayAttendance?.status === "Late" && (
              <div className="dash-attn-info-banner">
                Late check-in after 10:00 AM requires a reason and will be marked as late.
                {todayAttendance.lateReason && (
                  <div className="mt-2 text-dark fw-bold">
                    Reason: {todayAttendance.lateReason}
                  </div>
                )}
              </div>
            )}



            {/* SPECIAL DAY BANNER */}
            {todaySpecialDays.length > 0 && (
              <div className="special-day-banner">
                <div className="special-day-icon-wrapper">
                  <FaGift className="special-day-icon" />
                </div>
                <div className="special-day-content">
                  <h4 className="special-day-title">
                    Today's Special Day{todaySpecialDays.length > 1 ? "s" : ""}!
                  </h4>
                  <div className="special-day-list">
                    {todaySpecialDays.map((day, idx) => (
                      <div key={day._id || idx} className="special-day-item">
                        <div className="special-day-info">
                          <span className="special-day-name">{day.name}</span>
                          <span className="special-day-date">
                            {getMonthName(day.month)} {day.date}, {day.year}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TASK DUE DATE & REMINDER BANNER */}
            <TaskBanner loggedInUserId={loggedInUserId} />

            {/* ASSIGNED TASKS + QUICK ACTIONS */}
            <Row className="mb-4 g-3">
              <Col lg={6} md={12}>
                <Card className="content-card h-100">
                  <Card.Body className="p-4">
                    <div className="dash-todo-header">
                      <h4 className="dash-todo-title">Assigned Tasks</h4>
                      <Button
                        variant="link"
                        className="text-decoration-none text-primary  p-0"
                        onClick={() => navigate("/emp/tasks")}
                        style={{ fontSize: "14px", fontWeight: "500", }}
                      >
                        See All
                      </Button>
                    </div>

                    {pendingTasksLoading ? (
                      <div className="d-flex justify-content-center py-4">
                        <Spinner animation="border" variant="primary" />
                      </div>
                    ) : pendingTasks.length === 0 ? (
                      <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center">
                        <p className="text-muted mb-0" style={{ fontSize: "11px", color: "#77728e" }}>
                          You're all caught up! No pending tasks for now.
                        </p>
                      </div>
                    ) : (
                      <div className="dash-task-list" style={{ maxHeight: "280px", overflowY: "auto" }}>
                        {pendingTasks.map((task) => {
                          const { month, day } = formatTaskCardDate(
                            task.dueDate || task.startDate || task.createdAt
                          );
                          const createdById = task.createdBy?._id || task.createdBy;
                          const isCreatedByMe =
                            createdById?.toString() === loggedInUserId?.toString();
                          return (
                            <div
                              key={task._id}
                              className="dash-task-item"
                              onClick={() => handleTaskClick(task._id)}
                            >
                              <div className="dash-task-item__left">
                                <div className="dash-task-date-bubble">
                                  <span className="task-date-month">{month}</span>
                                  <span className="task-date-day">{day}</span>
                                </div>
                                <div className="dash-task-info">
                                  <h5 className="dash-task-name">{task.taskTitle}</h5>
                                  <p className="dash-task-meta">
                                    {isCreatedByMe ? (
                                      <span className="dash-task-meta ">Created by you</span>
                                    ) : (
                                      <>Assigned by {task.createdBy?.name || "Admin"}</>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="dash-task-item__right">
                                <div className={`priority-badge priority-${task.priority?.toLowerCase()}`}>
                                  {task.priority || "Medium"}
                                </div>
                                <Icon icon="ep:arrow-right" className="task-item-arrow" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={6} md={12}>
                <div className="dash-quick-actions-card h-100">
                  <h6 className="dash-quick-actions-card__title">Quick Actions</h6>
                  <div className="dash-quick-actions-card__grid">
                    <button
                      className="dash-quick-action-item"
                      onClick={() => setShowCreatPopup(true)}
                    >
                      <div className="dash-quick-action-item__icon-wrap">
                        <img src="/Creat Task IA.svg" alt="Create Task" className="dash-quick-action-item__icon dash-quick-action-item__icon--inactive" />
                        <img src="/Creat Task A.svg" alt="Create Task" className="dash-quick-action-item__icon dash-quick-action-item__icon--active" />
                      </div>
                      <span className="dash-quick-action-item__label">Create Task</span>
                    </button>

                    <button
                      className="dash-quick-action-item"
                      onClick={() => setShowAssignPopup(true)}
                    >
                      <div className="dash-quick-action-item__icon-wrap">
                        <img src="/Assign Task ia.svg" alt="Assign Task" className="dash-quick-action-item__icon dash-quick-action-item__icon--inactive" />
                        <img src="/Assign Task A.svg" alt="Assign Task" className="dash-quick-action-item__icon dash-quick-action-item__icon--active" />
                      </div>
                      <span className="dash-quick-action-item__label">Assign Task</span>
                    </button>

                    <button
                      className="dash-quick-action-item"
                      onClick={() => navigate("/emp/request-leave")}
                    >
                      <div className="dash-quick-action-item__icon-wrap">
                        <img src="/Request Leave IA.svg" alt="Request Leave" className="dash-quick-action-item__icon dash-quick-action-item__icon--inactive" />
                        <img src="/Request Leave A.svg" alt="Request Leave" className="dash-quick-action-item__icon dash-quick-action-item__icon--active" />
                      </div>
                      <span className="dash-quick-action-item__label">Request Leave</span>
                    </button>
                  </div>
                </div>
              </Col>
            </Row>

            {/* MY PROJECT DETAILS SECTION */}
            <Row className="mb-4">
              <Col md={12}>
                <Card className="content-card">
                  <Card.Body className="p-3">
                    <div className="dash-project-header mb-2">
                      <div className="d-flex align-items-center gap-3">
                        <h4 className="dash-todo-title ">My Project Details</h4>
                      </div>
                      <div className="dash-project-actions d-flex align-items-center gap-3">
                        <div className="d-flex align-items-center gap-2">
                          <CustomDropdown
                            options={PROJECT_STATUS_OPTIONS}
                            value={projectStatusFilter}
                            onChange={(val) => {
                              setProjectStatusFilter(val);
                              setProjectCurrentPage(1);
                            }}
                            placeholder="Select Status"
                            style={{ width: "140px", height: "34px" }}
                          />
                        </div>

                        <Button
                          variant="outline-success"
                          className="excel-export-btn"
                          onClick={() => {
                            const filtered = projectDetails.filter(
                              (p) =>
                                projectStatusFilter === "all" ||
                                p.status?.toLowerCase() === projectStatusFilter
                            );
                            exportToExcel(
                              filtered,
                              `My_Projects_${new Date().toISOString().split("T")[0]}`,
                              "projects"
                            );
                          }}
                        >
                          Download Excel
                        </Button>

                        <div className="d-flex align-items-center gap-2">
                          <CustomDropdown
                            options={PROJECT_PAGE_SIZE_OPTIONS}
                            value={projectItemsPerPage}
                            onChange={(val) => {
                              setProjectItemsPerPage(Number(val));
                              setProjectCurrentPage(1);
                            }}
                            placeholder={String(projectItemsPerPage)}
                            style={{ width: "80px", height: "34px" }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="employee-activity-table dash-my-project-table">
                        <thead>
                          <tr className="admin-dash-table-header">
                            <th>S.No</th>
                            <th>Project Name</th>
                            <th>Category</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const filtered = projectDetails.filter(
                              (p) =>
                                projectStatusFilter === "all" ||
                                p.status?.toLowerCase() === projectStatusFilter
                            );
                            if (projectDetailsLoading) {
                              return (
                                <tr>
                                  <td colSpan={4} className="text-center py-4">
                                    <Spinner animation="border" size="sm" variant="primary" />
                                  </td>
                                </tr>
                              );
                            }
                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={4} className="text-center py-4 text-muted">
                                    No {projectStatusFilter === "all" ? "" : projectStatusFilter} projects found.
                                  </td>
                                </tr>
                              );
                            }
                            return filtered
                              .slice(
                                (projectCurrentPage - 1) * projectItemsPerPage,
                                projectCurrentPage * projectItemsPerPage
                              )
                              .map((proj, idx) => (
                                <tr
                                  key={idx}
                                  onClick={() => fetchProjectPhases(proj.projectName, proj.category)}
                                  style={{ cursor: "pointer" }}
                                  className="project-row-hover"
                                >
                                  <td>{(projectCurrentPage - 1) * projectItemsPerPage + idx + 1}</td>
                                  <td className="proj-name-cell">{proj.projectName}</td>
                                  <td className="proj-cat-cell">{proj.category}</td>
                                  <td>
                                    <span className={`project-status-badge status-${proj.status?.toLowerCase().replace(/\s+/g, "-")}`}>
                                      {proj.status}
                                    </span>
                                  </td>
                                </tr>
                              ));
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {(() => {
                      const filtered = projectDetails.filter(
                        (p) =>
                          projectStatusFilter === "all" ||
                          p.status?.toLowerCase() === projectStatusFilter
                      );
                      if (filtered.length === 0) return null;
                      return (
                        <div className="mt-3">
                          <Pagination
                            totalItems={filtered.length}
                            pageSize={projectItemsPerPage}
                            currentPage={projectCurrentPage}
                            onPageChange={(page) => setProjectCurrentPage(page)}
                          />
                        </div>
                      );
                    })()}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* TO-DO LIST */}
            <Row>
              <Col md={12}>
                <Card className="content-card mb-4">
                  <Card.Body className="p-4">
                    <div className="dash-todo-header">
                      <h4 className="dash-todo-title">To Do List</h4>
                      <div className="dash-todo-actions">
                        <Button
                          className="btn-todo-history"
                          onClick={() => navigate("/todo-list")}
                        >
                          History
                        </Button>
                        <Button
                          className="btn-todo-create"
                          onClick={() => setShowTodoModal(true)}
                        >
                          Create
                        </Button>
                      </div>
                    </div>

                    {(() => {
                      if (todoLoading) {
                        return (
                          <div className="d-flex justify-content-center align-items-center py-5">
                            <Spinner animation="border" variant="primary" />
                          </div>
                        );
                      }

                      const pendingTodos = todos
                        .filter((t) => t.status?.toLowerCase() === "pending")
                        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

                      if (pendingTodos.length === 0) {
                        return (
                          <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center">
                            <p className="text-muted mb-0">
                              No pending To Do List. Relax or create a new one!
                            </p>
                          </div>
                        );
                      }

                      const totalTodoPages = Math.max(1, Math.ceil(pendingTodos.length / todoItemsPerPage));
                      const activeTodoPage = todoCurrentPage > totalTodoPages ? 1 : todoCurrentPage;
                      const paginatedTodos = pendingTodos.slice(
                        (activeTodoPage - 1) * todoItemsPerPage,
                        activeTodoPage * todoItemsPerPage
                      );

                      return (
                        <>
                          <div className="dash-todo-list-container">
                            {paginatedTodos.map((todo) => (
                              <div
                                key={todo._id}
                                className="dash-todo-card"
                                onClick={() => {
                                  setSelectedTodo(todo);
                                  setShowDetailModal(true);
                                }}
                              >
                                <div className="dash-todo-content">
                                  <h5 className="dash-todo-item-title">{todo.title || todo.description.split("\n")[0]}</h5>
                                  <p className="dash-todo-item-desc">
                                    {todo.title ? todo.description : (todo.description.split("\n").slice(1).join("\n") || "Aliquam porta nisl dolor, molestie pellentesque elit molestie in. Morbi metus neque, elementum ullam")}
                                  </p>
                                </div>
                                <div className="dash-todo-right">
                                  <span className="todo-create-date">
                                    Due Date: {formatFullDate(todo.dueDate)}
                                  </span>
                                  <div className="dash-todo-status-badge">{todo.status || "Pending"}</div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {pendingTodos.length > 0 && (
                            <div className="mt-3">
                              <Pagination
                                totalItems={pendingTodos.length}
                                pageSize={todoItemsPerPage}
                                currentPage={activeTodoPage}
                                onPageChange={(page) => setTodoCurrentPage(page)}
                              />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

          </Container>
        </div>
      </div>



      {/* TO-DO: DETAIL MODAL */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered className="employee-todo-detail-modal">
        <Modal.Header className="border-0 pb-0 d-flex justify-content-between align-items-center">
          <h5 className="common-modal-title">{selectedTodo ? (selectedTodo.title || selectedTodo.description.split("\n")[0]) : "To Do Details"}</h5>
          <button className="common-modal-close-x" onClick={() => setShowDetailModal(false)}>✕</button>
        </Modal.Header>
        <Modal.Body className="common-modal-body">
          {selectedTodo && (
            <>
              <p className="todo-detail-text mb-4" style={{ fontSize: "13px", color: "#374151", lineHeight: "1.6" }}>
                {selectedTodo.description}
              </p>
              <div className="edit-modal-actions">
                {selectedTodo.status?.toLowerCase() !== "completed" ? (
                  <>
                    <button
                      className="common-modal-btn btn-small-cancel"
                      onClick={() => setShowDetailModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="common-modal-btn btn-update"
                      onClick={() => {
                        setIsEditMode(true);
                        setTodoTitle(selectedTodo.title || selectedTodo.description.split("\n")[0]);
                        setTodoDescription(selectedTodo.title ? selectedTodo.description : selectedTodo.description.split("\n").slice(1).join("\n"));
                        setTodoDate(selectedTodo.dueDate ? new Date(selectedTodo.dueDate).toISOString().split("T")[0] : "");
                        setEditStatus(selectedTodo.status || "pending");
                        setShowDetailModal(false);
                        setShowTodoModal(true);
                      }}
                    >
                      Edit
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-success fw-bold align-self-center me-3">Completed</span>
                    <button className="common-modal-btn btn-small-cancel" onClick={() => setShowDetailModal(false)}>
                      Close
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* TO-DO: CONFIRM COMPLETE MODAL */}
      <Modal
        show={showConfirmModal}
        onHide={() => setShowConfirmModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to mark this task as complete?
          <br />
          <small className="text-muted">
            {selectedTodo?.description?.substring(0, 80)}...
          </small>
        </Modal.Body>
        <Modal.Footer>
          <button className="common-modal-btn btn-small-cancel" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </button>
          <button className="common-modal-btn btn-confirm-success" onClick={handleConfirmComplete}>
            Yes, Complete
          </button>
        </Modal.Footer>
      </Modal>

      {/* TO-DO: ADD / EDIT MODAL (CUSTOM) */}
      {showTodoModal && (
        <div className="todo-modal-overlay">
          <div className="todo-modal-content edit-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="todo-modal-header modal-header">
              <h3 className="common-modal-title">{isEditMode ? "Update To Do List" : "To Do List"}</h3>
              <button className="common-modal-close-x" onClick={handleCloseTodoModal}>✕</button>
            </div>
            <div className="todo-modal-body common-modal-body">
              <div className="todo-form-group">
                <label>Title</label>
                <input
                  type="text"
                  placeholder="Enter title..."
                  value={todoTitle}
                  onChange={(e) => setTodoTitle(e.target.value)}
                />
              </div>
              <div className="todo-form-group">
                <label>Work Description</label>
                <textarea
                  placeholder="Enter your work..."
                  rows={4}
                  value={todoDescription}
                  onChange={(e) => setTodoDescription(e.target.value)}
                />
              </div>
              {isEditMode ? (
                <div className="todo-form-row">
                  <div className="todo-form-group">
                    <label>Due Date</label>
                    <div className="todo-date-field-wrapper">
                      <input
                        ref={todoDateInputRef}
                        type="date"
                        className="todo-date-direct-input"
                        value={todoDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setTodoDate(e.target.value)}
                      />

                      <img
                        src="/Calander.svg"
                        alt="calendar"
                        className="todo-calendar-icon-btn"
                        onClick={() => todoDateInputRef.current?.showPicker?.()}
                      />
                    </div>
                  </div>
                  <div className="todo-form-group">
                    <label>Status</label>
                    <div className="custom-dropdown-container status-dropdown-container" ref={editStatusRef}>
                      <div
                        className={`custom-dropdown-trigger ${showEditStatusDropdown ? "open" : ""}`}
                        onClick={() => setShowEditStatusDropdown(!showEditStatusDropdown)}
                        style={{
                          width: "100%",
                          height: "42px",
                          borderRadius: "10px",
                          border: "1px solid #E5E7EB",
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          cursor: "pointer"
                        }}
                      >
                        <span style={{ fontSize: "14px", color: "#374151", fontWeight: "400" }}>
                          {editStatus.charAt(0).toUpperCase() + editStatus.slice(1)}
                        </span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={`dropdown-arrow-icon ${showEditStatusDropdown ? "rotate" : ""}`}
                          style={{ width: "20px", height: "20px", color: "#374151" }}
                        />
                      </div>

                      {showEditStatusDropdown && (
                        <div className="custom-dropdown-menu" style={{ width: "100%", zIndex: 10 }}>
                          {["pending", "completed", "on-hold"].map((s) => (
                            <div
                              key={s}
                              className={`custom-dropdown-option ${editStatus.toLowerCase() === s ? "selected" : ""}`}
                              onClick={() => {
                                setEditStatus(s);
                                setShowEditStatusDropdown(false);
                              }}
                              style={{ fontSize: "14px", padding: "10px 14px" }}
                            >
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="todo-form-group">
                  <label>Due Date</label>
                  <div className="todo-date-field-wrapper">
                    <input
                      ref={todoDateInputRef}
                      type="date"
                      className="todo-date-direct-input"
                      value={todoDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setTodoDate(e.target.value)}
                    />

                    <img
                      src="/Calander.svg"
                      alt="calendar"
                      className="todo-calendar-icon-btn"
                      onClick={() => todoDateInputRef.current?.showPicker?.()}
                    />
                  </div>
                </div>
              )}
              <div className="todo-modal-footer modal-footer" style={{ marginTop: "20px" }}>
                <div className="edit-modal-actions">
                  <button className="common-modal-btn btn-small-cancel" onClick={handleCloseTodoModal}>
                    Cancel
                  </button>
                  <button className="common-modal-btn btn-update" onClick={handleSaveTodo}>
                    {isEditMode ? "Update" : "Schedule"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ATTENDANCE CHECK-IN MODAL */}
      <Modal
        show={showCheckInModal}
        onHide={() => {
          setShowCheckInModal(false);
          setLateReason("");
        }}
        centered
        className="checkin-modal"
      >
        <Modal.Body className="checkin-modal-body">
          <div className="checkin-modal-icon">
            <img src={Checkin} alt="check-in" className="check-in" />
          </div>
          <Modal.Title className="common-modal-title w-100 text-center" style={{ marginTop: "10px", marginBottom: "15px" }}>
            Mark Your Attendance
          </Modal.Title>
          {(() => {
            const now = new Date();
            const isLate =
              now.getHours() > 10 || (now.getHours() === 10 && now.getMinutes() > 0);
            return (isLate && !hasInformPermission) ? (
              <div className="late-reason-inline-box">
                <p className="late-entry-warning-text">
                  Check-in after 10:00 AM is considered late entry.
                </p>
                <label className="late-reason-label">Reason</label>
                <textarea
                  className="late-reason-textarea"
                  placeholder="Enter reason for late entry"
                  value={lateReason}
                  onChange={(e) => setLateReason(e.target.value)}
                />
              </div>
            ) : null;
          })()}
          <div className="border-0 checkin-modal-footer d-flex justify-content-center w-100">
            <button
              className="common-modal-btn btn-small-cancel"
              onClick={() => setShowCheckInModal(false)}
            >
              Close
            </button>
            <button
              className="common-modal-btn btn-confirm-success"
              onClick={() => {
                const now = new Date();
                const isLate =
                  now.getHours() > 10 || (now.getHours() === 10 && now.getMinutes() > 0);
                if (isLate && !hasInformPermission && !lateReason.trim()) {
                  toast.error("Please enter the reason");
                  return;
                }
                handleDashboardCheckIn((isLate && !hasInformPermission) ? lateReason.trim() : "");
              }}
              disabled={checkInLoading}
            >
              {checkInLoading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                  Checking In...
                </>
              ) : (
                "Check-in"
              )}
            </button>
          </div>
        </Modal.Body>
      </Modal>

      {/* CHECKOUT CONFIRMATION MODAL */}
      <Modal
        show={showCheckoutModal}
        onHide={cancelCheckOut}
        centered
        className="checkout-modal checkin-modal"
      >
        <Modal.Body className="checkin-modal-body">
          <div className="checkin-modal-icon">
            <img src={Checkout} alt="check-out" className="check-in" />
          </div>
          <Modal.Title className="common-modal-title w-100 text-center" style={{ marginTop: "10px", marginBottom: "15px" }}>
            Confirm Check-out
          </Modal.Title>
          <div className="late-reason-inline-box text-center">
            <p className="late-entry-warning-text">
              Are you sure you want to check-out?
            </p>
          </div>
          <div className="border-0 checkin-modal-footer d-flex justify-content-center w-100">
            <button
              className="common-modal-btn btn-small-cancel"
              onClick={() => {
                setShowCheckoutModal(false);
                handlePermissionClick("CHECK_OUT");
              }}
            >
              Inform Permission
            </button>
            <button
              className="common-modal-btn btn-confirm-success"
              onClick={confirmCheckOut}
            >
              Confirm
            </button>
          </div>
        </Modal.Body>
      </Modal>

      {/* PERMISSION MODAL */}
      <Modal
        show={showPermissionModal}
        onHide={() => {
          setShowPermissionModal(false);
          setPermissionType("");
          setPermissionData({ fromTime: "", toTime: "", reason: "", informedVia: "Mobile Call", permissionType: "" });
        }}
        centered
        backdrop="static"
        keyboard={true}
        className="emp-attendance-permission-popup"
      >
        <Modal.Header className="border-0 pb-0 position-relative d-flex justify-content-center align-items-center">
          <h2 className="emp-attendance-permission-title mb-0" style={{ marginTop: '10px' }}>Inform Permission</h2>
          <button
            className="common-modal-close-x position-absolute"
            style={{ right: '20px', top: '7px' }}
            onClick={() => {
              setShowPermissionModal(false);
              setPermissionType("");
              setPermissionData({ fromTime: "", toTime: "", reason: "", informedVia: "Mobile Call", permissionType: "" });
            }}
          >
            ✕
          </button>
        </Modal.Header>
        <Modal.Body className="p-4 pt-1">
          <p className="emp-attendance-permission-subtitle">
            This permission will be directly marked as informed.<br />No admin approval is required.
          </p>
          <div className="emp-attendance-permission-card">
            <div className="emp-attendance-permission-field emp-attendance-full mb-3">
              <label>Permission Type</label>
              <div className="custom-dropdown-container status-dropdown-container" ref={permissionDropdownRef}>
                <div
                  className={`custom-dropdown-trigger ${showPermissionTypeDropdown ? "open" : ""}`}
                  onClick={() => setShowPermissionTypeDropdown(!showPermissionTypeDropdown)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e1e4e8", background: "#ffffff", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontSize: "14px", color: permissionData.permissionType ? "#2d355f" : "#8c98a4" }}>
                    {permissionData.permissionType === "MORNING" && "Morning (Late Check-In)"}
                    {permissionData.permissionType === "AFTERNOON" && "Out & Return (Re-Check-In Allowed)"}
                    {permissionData.permissionType === "EVENING" && "Evening (Early Check-Out)"}
                    {!permissionData.permissionType && "Select the Permission Type"}
                  </span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={`dropdown-arrow-icon ${showPermissionTypeDropdown ? "rotate" : ""}`} style={{ pointerEvents: 'none' }}>
                    <path d="M6 9L12 15L18 9" stroke="#2D355F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {showPermissionTypeDropdown && (
                  <div className="custom-dropdown-menu" style={{ width: "100%", zIndex: 10, position: "absolute", top: "100%", left: "0", background: "#fff", border: "1px solid #e1e4e8", borderRadius: "8px", marginTop: "4px" }}>
                    {permissionType === "CHECK_IN" ? (
                      <div
                        className={`custom-dropdown-option ${permissionData.permissionType === "MORNING" ? "selected" : ""}`}
                        onClick={() => {
                          setPermissionData({ ...permissionData, permissionType: "MORNING", fromTime: "10:00", toTime: "" });
                          setShowPermissionTypeDropdown(false);
                        }}
                      >
                        Morning (Late Check-In)
                      </div>
                    ) : (
                      <>
                        <div
                          className={`custom-dropdown-option ${permissionData.permissionType === "AFTERNOON" ? "selected" : ""}`}
                          onClick={() => {
                            setPermissionData({ ...permissionData, permissionType: "AFTERNOON", fromTime: "", toTime: "" });
                            setShowPermissionTypeDropdown(false);
                          }}
                        >
                          Out & Return (Re-Check-In Allowed)
                        </div>
                        <div
                          className={`custom-dropdown-option ${permissionData.permissionType === "EVENING" ? "selected" : ""}`}
                          onClick={() => {
                            setPermissionData({ ...permissionData, permissionType: "EVENING", fromTime: "", toTime: "18:30" });
                            setShowPermissionTypeDropdown(false);
                          }}
                        >
                          Evening (Early Check-Out)
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="emp-attendance-permission-row">
              <div className="emp-attendance-permission-field">
                <label>From</label>
                <div className="emp-attendance-input-wrapper time-input-wrapper" style={{ position: "relative" }}>
                  <input
                    type="time"
                    className="employeeLeaveRequest-inputs inform-permission-time"
                    style={{ width: "100%", height: "35px", padding: "0 10px", borderRadius: "8px", border: "1px solid #e1e4e8", background: "#ffffff", boxSizing: "border-box" }}
                    value={permissionData.fromTime}
                    onChange={(e) => setPermissionData({ ...permissionData, fromTime: e.target.value })}
                  />
                  <FiClock className="time-icon" />
                </div>
              </div>

              <div className="emp-attendance-permission-field">
                <label>To</label>
                <div className="emp-attendance-input-wrapper time-input-wrapper" style={{ position: "relative" }}>
                  <input
                    type="time"
                    className="employeeLeaveRequest-inputs inform-permission-time"
                    style={{ width: "100%", height: "35px", padding: "0 10px", borderRadius: "8px", border: "1px solid #e1e4e8", background: "#ffffff", boxSizing: "border-box" }}
                    value={permissionData.toTime}
                    onChange={(e) => setPermissionData({ ...permissionData, toTime: e.target.value })}
                  />
                  <FiClock className="time-icon" />
                </div>
              </div>
            </div>

            <div className="emp-attendance-permission-field emp-attendance-full">
              <label>Reason</label>
              <textarea
                placeholder="write here...."
                value={permissionData.reason}
                onChange={(e) =>
                  setPermissionData({ ...permissionData, reason: e.target.value })
                }
                style={{ height: '80px', minHeight: '80px' }}
              />
            </div>

            <div className="emp-attendance-permission-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowPermissionModal(false);
                  setPermissionType("");
                  setPermissionData({ fromTime: "", toTime: "", reason: "", informedVia: "Mobile Call", permissionType: "" });
                }}
                className="btn-small-cancel"
                style={{ padding: '8px 24px', fontSize: '14px', borderRadius: '6px', minWidth: '120px', border: 'none' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermissionSubmit}
                disabled={actionLoading}
                className="btn-confirm-success"
                style={{ padding: '8px 24px', fontSize: '14px', borderRadius: '6px', minWidth: '120px', border: 'none' }}
              >
                {actionLoading ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </Modal.Body>
      </Modal>

      {/* ─── MORNING INFORM HALF-DAY CONFIRMATION MODAL ─── */}
      <Modal
        show={showHalfDayConfirmModal}
        onHide={handleCancelHalfDayCheckIn}
        centered
        className="morning-halfday-confirm-modal"
      >
        <Modal.Header closeButton className="border-0 p-0">
          <Modal.Title className="morning-halfday-modal-title">
            Half-Day Leave Deduction
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="morning-halfday-modal-content">
            <p className="morning-halfday-modal-message">
              Your Morning INFORM permission has reached the half-day threshold. To continue with check-in, half-day leave will be deducted from your leave balance. Do you want to continue?
            </p>
          </div>
          <div className="morning-halfday-modal-footer d-flex justify-content-end gap-2">
            <button
              type="button"
              className="common-modal-btn btn-small-cancel"
              onClick={handleCancelHalfDayCheckIn}
              disabled={halfDayConfirmLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="common-modal-btn btn-confirm-success"
              onClick={handleConfirmHalfDayCheckIn}
              disabled={halfDayConfirmLoading}
            >
              {halfDayConfirmLoading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                  Processing...
                </>
              ) : (
                "Confirm & Check In"
              )}
            </button>
          </div>
        </Modal.Body>
      </Modal>

      {/* TASK DETAILS MODAL */}
      {selectedTaskId && (
        <TaskDetailsModal taskId={selectedTaskId} onClose={handleCloseTaskModal} />
      )}

      {/* ASSIGN TASK POPUP */}
      {showAssignPopup && (
        <div className="empdb-popup-backdrop">
          <div className="empdb-popup-overlay" onClick={() => setShowAssignPopup(false)}>
            <div className="empdb-popup-container" onClick={(e) => e.stopPropagation()}>
              <AssignTask
                onClose={() => setShowAssignPopup(false)}
                onSuccess={fetchProjectDetails}
              />
            </div>
          </div>
        </div>
      )}

      {/* CREATE TASK POPUP */}
      {showCreatPopup && (
        <div className="empdb-popup-backdrop">
          <div className="empdb-popup-overlay" onClick={() => setShowCreatPopup(false)}>
            <div className="empdb-popup-container" style={{ width: "92%", maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
              <CreatTask
                onClose={() => setShowCreatPopup(false)}
                onSuccess={fetchProjectDetails}
              />
            </div>
          </div>
        </div>
      )}

      {/* PROJECT PHASES MODAL */}
      <Modal
        show={showPhasesModal}
        onHide={() => {
          setShowPhasesModal(false);
          setProjExpandedCards({});
        }}
        centered
        size="lg"
        className="project-phases-modal-custom"
      >
        <div className="project-details-modal-header border-0 pb-0 d-flex flex-column align-items-stretch">
          {/* Top Row: Title & Close Button */}
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="assign-task__members-title m-0">
              Work Details
            </h3>
            <button
              className="common-modal-close-x"
              onClick={() => {
                setShowPhasesModal(false);
                setProjExpandedCards({});
              }}
            >
              ✕
            </button>
          </div>
          {/* Bottom Row: Project/Category info & Working Days on Left, Export Excel on Right */}
          {(() => {
            const completedCount = projectPhases.filter(
              (p) => p.isCompleted || normalizeStatusKey(p.latestStatus || p.status) === "completed"
            ).length;
            const inProcessPhases = projectPhases.filter(
              (p) => p.isInProcess || normalizeStatusKey(p.latestStatus || p.status) === "inprocess"
            );
            const inProcessCount = inProcessPhases.length;
            const inProcessDays = getProjectTotalWorkingDays(inProcessPhases);
            const totalWorkingDays = getProjectTotalWorkingDays(projectPhases);

            return (
              <div className="d-flex justify-content-between align-items-center w-100 mt-2" style={{ paddingBottom: "10px", flexWrap: "wrap", gap: "12px" }}>
                <div className="project-details-modal-header-content d-flex align-items-center flex-wrap" style={{ gap: "16px" }}>
                  <div className="project-details-modal-item">
                    <span className="dwu-work-card__label">Project</span>
                    <span className="dwu-work-card__value">
                      {activePhaseProject?.projectName || "Project Details"}
                    </span>
                  </div>
                  <div className="project-details-modal-item">
                    <span className="dwu-work-card__label">Category</span>
                    <span className="dwu-work-card__value">
                      {activePhaseProject?.category || "General"}
                    </span>
                  </div>
                  <div className="d-flex align-items-center flex-wrap" style={{ gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid #bfdbfe",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      In Process: <strong>{inProcessDays || 0} Days</strong> ({inProcessCount || 0} tasks)
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        background: "#ecfdf5",
                        color: "#047857",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid #a7f3d0",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      Completed: <strong>{completedCount || 0} Tasks</strong>
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        background: "#f8fafc",
                        color: "#475569",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      Overall: <strong>{totalWorkingDays || 0} Days</strong>
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline-primary"
                  size="sm"
                  className="excel-export-btn"
                  onClick={() =>
                    exportToExcel(
                      projectPhases,
                      `${activePhaseProject?.projectName || "Project"}_Phases_${new Date().toISOString().split("T")[0]}`,
                      "phases"
                    )
                  }
                >
                  Export Excel
                </Button>
              </div>
            );
          })()}
        </div>

        <div className="empproject-details-modal-body">
          {phasesLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Loading project details...</p>
            </div>
          ) : projectPhases.length === 0 ? (
            <div className="text-center py-5 text-muted">
              No tasks found for this project.
            </div>
          ) : (
            <div className="project-phases-list">
              <div className="dwu-work-list" style={{ gap: "12px", display: "flex", flexDirection: "column" }}>
                {projectPhases.map((phase, idx) => {
                  const cardKey = phase._id || `phase-${idx}`;
                  const isExpanded = !!projExpandedCards[cardKey];
                  const normKey = normalizeStatusKey(phase.latestStatus || phase.status);
                  const isCompleted = normKey === "completed";
                  const hasMultipleUpdates = Array.isArray(phase.history) && phase.history.length > 1;

                  return (
                    <div
                      key={idx}
                      className="dwu-work-card"
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setProjExpandedCards((prev) => ({
                          ...prev,
                          [cardKey]: !isExpanded,
                        }));
                      }}
                    >
                      <div className="dwu-work-card__header" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 16px" }}>
                        <div className="dwu-work-card__field dwu-field-title" style={{ flex: 1, minWidth: 0 }}>
                          <span className="dwu-work-card__label">Task</span>
                          <span className="dwu-work-card__value" title={phase.taskTitle || phase.name} style={{ display: "block", wordBreak: "break-word", whiteSpace: "normal" }}>
                            {phase.taskTitle || phase.name}
                          </span>
                        </div>
                        <div className="dwu-work-card__field dwu-field-date" style={{ width: "80px", flexShrink: 0, textAlign: "left" }}>
                          <span className="dwu-work-card__label dwu-label-hide-mobile">Date</span>
                          <span className="dwu-work-card__value">
                            {(() => {
                              const rawDate = phase.latestDate || phase.date || phase.completionDate || phase.updateDate || phase.createdAt;
                              if (!rawDate) return "—";
                              const d = new Date(rawDate);
                              return isNaN(d.getTime())
                                ? "—"
                                : d.toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                });
                            })()}
                          </span>
                        </div>

                        <div
                          className="dwu-work-card__field dwu-field-working-days"
                          style={{ width: "95px", flexShrink: 0, textAlign: "left" }}
                        >
                          <span className="dwu-work-card__label dwu-label-hide-mobile">Working Days</span>
                          <span
                            className="dwu-work-card__value"
                            style={{
                              fontWeight: "600",
                              color: isCompleted ? "#059669" : "#4f46e5",
                            }}
                          >
                            {phase.workingDays || 0} {phase.workingDays === 1 ? "Day" : "Days"}
                          </span>
                        </div>

                        <div className="dwu-work-card__field dwu-field-status" style={{ width: "95px", flexShrink: 0, textAlign: "left" }}>
                          <span className="dwu-work-card__label dwu-label-hide-mobile">Status</span>
                          <span className={`dwu-admin__statusBadge dwu-admin__statusBadge--${normKey}`} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            {formatStatusLabel(phase.latestStatus || phase.status)}
                            {isCompleted && <span role="img" aria-label="locked" style={{ fontSize: "11px", lineHeight: 1 }}></span>}
                          </span>
                        </div>
                        <div
                          style={{
                            width: "20px",
                            marginBottom: "none",
                            flexShrink: 0,
                            display: "flex",
                            justifyContent: "flex-start",
                            alignItems: "center"
                          }}
                        >
                          <FaChevronDown
                            className="project-task-card-chevron"
                            style={{
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              fontSize: "12px",
                              color: "#94a3b8",
                              transition: "transform 0.25s ease"
                            }}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="dwu-work-card__section_phase" style={{ paddingTop: "12px", borderTop: "1px dashed #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
                          {hasMultipleUpdates ? (
                            /* ── Status History (multiple updates) ── */
                            <div className="dwu-task-history-section">
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>
                                  Status History ({phase.history.length})
                                </span>
                                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                  Latest First
                                </span>
                              </div>

                              <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", background: "#ffffff" }}>
                                <table className="dwu-status-history-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                  <thead>
                                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: "600" }}>
                                      <th className="dwu-history-th-date" style={{ padding: "10px 14px", textAlign: "left", width: "95px" }}>Date</th>
                                      <th className="dwu-history-th-status" style={{ padding: "10px 14px", textAlign: "left", width: "125px" }}>Status</th>
                                      <th className="dwu-history-th-summary" style={{ padding: "10px 14px", textAlign: "left" }}>Work Summary</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {phase.history.map((h, hIdx) => {
                                      const hStatusRaw = h.status || h.phaseStatus || "Pending";
                                      const hKey = normalizeStatusKey(hStatusRaw);
                                      const hLocked = hKey === "completed";
                                      const dateVal = h.date || h.completionDate || h.updateDate || h.createdAt;
                                      const dateStr = dateVal
                                        ? new Date(dateVal).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                                        : "—";

                                      return (
                                        <tr
                                          key={hIdx}
                                          className="dwu-history-tr"
                                          style={{
                                            borderBottom: hIdx === phase.history.length - 1 ? "none" : "1px solid #f1f5f9",
                                            background: hIdx % 2 === 0 ? "#ffffff" : "#fcfdfe"
                                          }}
                                        >
                                          <td className="dwu-history-td-date" style={{ padding: "12px 14px", verticalAlign: "top", fontWeight: "500", color: "#334155" }}>
                                            {dateStr}
                                          </td>
                                          <td className="dwu-history-td-status" style={{ padding: "12px 14px", verticalAlign: "top" }}>
                                            <span
                                              className={`dwu-admin__statusBadge dwu-admin__statusBadge--${hKey}`}
                                              style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "3px 9px",
                                                fontSize: "11px",
                                                whiteSpace: "nowrap"
                                              }}
                                              title={hLocked ? "Completed update is final and read-only" : ""}
                                            >
                                              {formatStatusLabel(hStatusRaw)}
                                              {hLocked && <span role="img" aria-label="locked" style={{ fontSize: "11px", lineHeight: 1 }}></span>}
                                            </span>
                                          </td>
                                          <td className="dwu-history-td-summary" style={{ padding: "12px 14px", verticalAlign: "top", color: "#334155", lineHeight: "1.6" }}>
                                            {(() => {
                                              const mainTitle = (phase.taskTitle || phase.displayTitle || phase.name || phase.title || "").trim();
                                              const hTitle = (h.title || h.taskTitle || h.displayTitle || h.name || h.phase || "").trim();
                                              const isTitleChanged = Boolean(hTitle && mainTitle && hTitle.toLowerCase() !== mainTitle.toLowerCase());
                                              return isTitleChanged ? (
                                                <div style={{ fontWeight: "600", color: "#1e293b", marginBottom: "4px", fontSize: "13px" }}>
                                                  {hTitle}
                                                </div>
                                              ) : null;
                                            })()}
                                            <div style={{ wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: "pre-wrap", fontSize: "13px" }}>
                                              {h.note || h.description || h.details || "—"}
                                            </div>
                                            {Array.isArray(h.pages) && h.pages.length > 0 && (
                                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                                                {h.pages.map((p, pI) => (
                                                  <span key={pI} style={{ fontSize: "11px", background: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: "4px", fontWeight: "500" }}>
                                                    {p}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            /* ── Single update: show description & work summary ── */
                            <div style={{ padding: "8px 6px 12px 6px" }}>
                              <span className="dwu-work-card__label mt-0 d-block mb-1">Work Summary</span>
                              <p
                                className="dwu-work-card__text"
                                style={{
                                  wordBreak: "break-word",
                                  overflowWrap: "anywhere",
                                  whiteSpace: "pre-wrap",
                                  margin: 0,
                                  paddingRight: "8px",
                                  fontSize: "13px",
                                  lineHeight: "1.6",
                                  color: "#334155"
                                }}
                              >
                                {phase.history?.[0]?.note || phase.history?.[0]?.description || phase.history?.[0]?.details || phase.description || phase.phase || phase.details || phase.note || "No description provided."}
                              </p>
                              {Array.isArray(phase.history?.[0]?.pages) && phase.history[0].pages.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                                  {phase.history[0].pages.map((p, pI) => (
                                    <span key={pI} style={{ fontSize: "11px", background: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: "4px", fontWeight: "500" }}>
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="border-0 d-flex justify-content-end" style={{ paddingTop: "10px" }}>
          <Button
            variant="light"
            onClick={() => {
              setShowPhasesModal(false);
              setProjExpandedCards({});
            }}
            className="hrms-common-btn-cancel "
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* ===== IP VALIDATION START ===== */}
      <Modal
        show={showIPReasonModal}
        onHide={() => {
          setShowIPReasonModal(false);
          setIpReason("");
          setIsCheckoutIP(false);
          if (isHalfDayConfirmIP) {
            setIsHalfDayConfirmIP(false);
            setShowHalfDayConfirmModal(true);
          }
        }}
        centered
        className="checkin-modal"
      >
        <Modal.Body className="checkin-modal-body">
          <div className="checkin-modal-icon">
            <img src={Checkin} alt="check-in" className="check-in" />
          </div>
          <Modal.Title className="common-modal-title w-100 text-center" style={{ marginTop: "10px", marginBottom: "6px" }}>
            Different Network Detected
          </Modal.Title>
          <div className="late-reason-inline-box">
            <p className="late-entry-warning-text">
              You are checking {isCheckoutIP ? "out" : "in"} from a different network. Please enter the reason.
            </p>
            <label className="late-reason-label">Reason</label>
            <textarea
              className="late-reason-textarea"
              placeholder="e.g. Working from home, Client site, etc."
              value={ipReason}
              onChange={(e) => setIpReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="border-0 checkin-modal-footer d-flex justify-content-center w-100">
            <button
              className="common-modal-btn btn-small-cancel"
              onClick={() => {
                setShowIPReasonModal(false);
                setIpReason("");
                setIsCheckoutIP(false);
                if (isHalfDayConfirmIP) {
                  setIsHalfDayConfirmIP(false);
                  setShowHalfDayConfirmModal(true);
                }
              }}
            >
              Cancel
            </button>
            <button
              className="common-modal-btn btn-confirm-success"
              onClick={() => {
                if (!ipReason.trim()) {
                  toast.warning("Please enter a reason to continue.");
                  return;
                }
                const reason = ipReason.trim();
                setShowIPReasonModal(false);
                setIpReason("");
                if (isCheckoutIP) {
                  setIsCheckoutIP(false);
                  handleCheckOut(reason);
                } else if (isHalfDayConfirmIP) {
                  setIsHalfDayConfirmIP(false);
                  handleConfirmHalfDayCheckIn(reason);
                } else {
                  handleCheckIn(pendingLateReason, reason);
                }
              }}
              disabled={actionLoading || checkInLoading || halfDayConfirmLoading}
            >
              {actionLoading || checkInLoading || halfDayConfirmLoading ? (isCheckoutIP ? "Checking Out..." : "Checking In...") : (isCheckoutIP ? "Check-out" : "Check-in")}
            </button>
          </div>
        </Modal.Body>
      </Modal>
      {/* ===== IP VALIDATION END ===== */}

      {/* Send Birthday Wish Modal for Employees */}
      <Modal
        show={showWishModal}
        onHide={() => setShowWishModal(false)}
        backdrop="static"
        keyboard={false}
        centered
        className="birthday-wish-modal-custom"
      >
        <Modal.Header closeButton className="bday-modal__header">
          <Modal.Title className="bday-modal__title">
            <span>Send Birthday Wish</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bday-modal__body">
          {targetEmpsForWish.length > 0 && (
            <div
              className="bday-modal__user-cards-container"
              style={{
                display: "grid",
                gridTemplateColumns: targetEmpsForWish.length === 1 ? "1fr" : "repeat(2, 1fr)",
                gap: "10px",
                maxHeight: "220px",
                overflowY: "auto",
                marginBottom: "14px"
              }}
            >
              {targetEmpsForWish.map((emp) => (
                <div key={emp._id} className="bday-modal__user-card" style={{ marginBottom: 0 }}>
                  <img
                    src={emp.photo || "/avatar.png"}
                    alt={emp.name}
                    className="bday-modal__user-img"
                    onError={(e) => { e.target.src = "/avatar.png"; }}
                  />
                  <div>
                    <h6 className="bday-modal__user-name">{emp.name}</h6>
                    <small className="bday-modal__user-info">{emp.empId} â€¢ {emp.designation || "Employee"}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Form.Group className="mb-2">
            <Form.Label className="bday-modal__label">
              Wish Message (Default pre-filled, customize as you like):
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={wishMessage}
              onChange={(e) => setWishMessage(e.target.value)}
              placeholder="Type your birthday message here..."
              className="bday-modal__textarea"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="bday-modal__footer">
          <Button variant="light" onClick={() => setShowWishModal(false)} className="common-modal-btn btn-small-cancel">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSendWish}
            disabled={sendingWish || !wishMessage.trim()}
            className="common-modal-btn btn-update"
          >
            {sendingWish ? <Spinner animation="border" size="sm" /> : "Send Wish"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 🎂 CINEMATIC BIRTHDAY CELEBRATION ANIMATION OVERLAY 🎂 */}
      {showBirthdayAnimation && (
        <BirthdayCelebration
          employeeName={birthdayEmployeeName}
          onComplete={() => setShowBirthdayAnimation(false)}
        />
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
};

export default EmployeeDashboard;
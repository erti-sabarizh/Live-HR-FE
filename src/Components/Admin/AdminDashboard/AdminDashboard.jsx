import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { portalInstance } from "../../../Services/instance";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { Button, Badge, Spinner, Modal, Form, Card, Table } from "react-bootstrap";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaClock,
  FaEdit,
  FaCheck,
  FaTimes,
  FaUser,
  FaEnvelope,
  FaCalendarAlt,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaEllipsisH,
  FaStar,
  FaGift,
  FaBirthdayCake,
  FaPlusCircle,
  FaFilter,
  FaInfoCircle,
} from "react-icons/fa";
import { Icon } from "@iconify/react";
import "./DashBoard.css";
import "./AdminEditRequests.css";
import "./AdminDashboard.css";
import "../Task/DailyWorkUpdatePage.css";
import "../../Employee/EmployeeDashboard/EmployeeDashboard.css";
import CustomDropdown from "../../Common/CustomDropdown";
import Pagination from "../../Employee/Pagination/Pagination";
import PasswordExpiryBanner from "../../PasswordExpiry/PasswordExpiryBanner";
import HolidayAssignmentBanner from "../Holiday/HolidayAssignmentBanner";
import LeaveCategoryBanner from "../LeaveManagement/LeaveCategoryBanner";

import closeIcon from "../../../assets/close.png";
import "../../../Globel/Layout.css"
const DEFAULT_AVATAR =
  "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg";

const slogansData = {
  messages: [
    { icon: "🚀", text: "Great leaders inspire action — lead by example today." },
    { icon: "💡", text: "Every problem is an opportunity in disguise." },
    { icon: "🌟", text: "Excellence is not a destination but a continuous journey." },
    { icon: "🎯", text: "Focus on progress, not perfection." },
    { icon: "🤝", text: "Teamwork divides the task and multiplies the success." },
    { icon: "🌱", text: "Growth begins at the edge of your comfort zone." },
    { icon: "🔥", text: "Passion is the fuel that drives exceptional work." },
    { icon: "✨", text: "Small steps every day lead to big achievements." },
    { icon: "💪", text: "Challenges are what make life interesting — overcoming them is what makes it meaningful." },
    { icon: "🏆", text: "Success is the sum of small efforts repeated day in and day out." },
    { icon: "🧠", text: "The best investment you can make is in your people." },
    { icon: "🌈", text: "Diversity in thought is the seed of innovation." },
    { icon: "⚡", text: "Move fast, learn faster, adapt always." },
    { icon: "🎖️", text: "Recognition fuels motivation — celebrate every win." },
    { icon: "🌍", text: "A great culture attracts great talent." },
    { icon: "🛡️", text: "Integrity is doing the right thing even when no one is watching." },
    { icon: "📈", text: "Data-driven decisions lead to better outcomes." },
    { icon: "🤲", text: "Empathy is the cornerstone of great management." },
    { icon: "🎓", text: "Invest in learning — it pays the best dividends." },
    { icon: "🌅", text: "Every day is a new opportunity to make a positive impact." },
    { icon: "🔑", text: "Clear communication unlocks team potential." },
    { icon: "💎", text: "Quality over quantity — always." },
    { icon: "🧩", text: "Each team member is a vital piece of the puzzle." },
    { icon: "🕊️", text: "A calm leader creates a focused team." },
    { icon: "🌊", text: "Adaptability is the most important skill of our time." },
    { icon: "🦁", text: "Courage is not the absence of fear — it's acting despite it." },
    { icon: "🎵", text: "A harmonious team produces the best results." },
    { icon: "🌻", text: "Positivity is contagious — spread it generously." },
    { icon: "🔭", text: "Vision without action is a dream — act on yours today." },
    { icon: "🧲", text: "Strong values attract the right opportunities." },
  ]
};

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

const groupTasksWithHistory = (items) => {
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

    grouped.push({
      ...latest,
      taskTitle: latest.taskTitle || latest.displayTitle || latest.name || latest.title || "Untitled Task",
      displayTitle: latest.taskTitle || latest.displayTitle || latest.name || latest.title || "Untitled Task",
      latestDate: latest.date || latest.completionDate || latest.updateDate || latest.createdAt,
      latestStatus: latest.status || latest.phaseStatus || "Pending",
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

const AdminDashboard = () => {
  const navigate = useNavigate();

  // ── Core states ──────────────────────────────────────────────
  const [adminName, setAdminName] = useState("Admin");
  const [editRequests, setEditRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loginTime, setLoginTime] = useState(null);
  const [dailySlogan, setDailySlogan] = useState("");

  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateCheckins: 0,
    leaveToday: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [employeeActivity, setEmployeeActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [expandedPermissionRows, setExpandedPermissionRows] = useState({});

  const togglePermissionDropdown = (key) => {
    setExpandedPermissionRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const [selectedDateRange, setSelectedDateRange] = useState("today");
  const [customDate, setCustomDate] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");

  // ── Notifications ────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);

  // ── Today's Special Days ─────────────────────────────────────
  const [todaySpecialDays, setTodaySpecialDays] = useState([]);

  // ── Today's Birthdays & Wishes ───────────────────────────────
  const [todayBirthdays, setTodayBirthdays] = useState([]);
  const [sentWishes, setSentWishes] = useState([]);
  const [showWishModal, setShowWishModal] = useState(false);
  const [selectedEmpForWish, setSelectedEmpForWish] = useState(null);
  const [wishMessage, setWishMessage] = useState("");
  const [sendingWish, setSendingWish] = useState(false);



  // ── Password Expiry Banner ───────────────────────────────────
  const [showPwdBanner, setShowPwdBanner] = useState(false);
  const [expiryDate, setExpiryDate] = useState(null);

  // ── Todo States ──────────────────────────────────────────────
  const [todos, setTodos] = useState([]);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoDescription, setTodoDescription] = useState("");
  const [todoDate, setTodoDate] = useState("");
  const [todoLoading, setTodoLoading] = useState(true);
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showTodoConfirmModal, setShowTodoConfirmModal] = useState(false);
  const [editStatus, setEditStatus] = useState("pending");
  const [showEditStatusDropdown, setShowEditStatusDropdown] = useState(false);
  const editStatusRef = useRef(null);
  const todoDateInputRef = useRef(null);

  // ── STEP 1: Single unified pagination state (filteredPage only) ──
  const [filteredPage, setFilteredPage] = useState(1);
  const TODO_PAGE_SIZE = 5;

  // ── Todo Date Filter States ───────────────────────────────────
  const [todoDateFilter, setTodoDateFilter] = useState("all");
  const [todoCustomFromDate, setTodoCustomFromDate] = useState("");
  const [todoCustomToDate, setTodoCustomToDate] = useState("");

  // ── Todo Status Filter State ──────────────────────────────────
  const [todoStatusFilter, setTodoStatusFilter] = useState("all");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef(null);

  // ── Project Details States ────────────────────────────────────
  const [projectDetails, setProjectDetails] = useState([]);
  const [projectDetailsLoading, setProjectDetailsLoading] = useState(true);
  const [selectedProjectInfo, setSelectedProjectInfo] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectUpdates, setProjectUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [recentProjectUpdates, setRecentProjectUpdates] = useState([]);
  const [recentUpdatesLoading, setRecentUpdatesLoading] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  const [showUpdateDetailModal, setShowUpdateDetailModal] = useState(false);
  const [projSelectedEmpId, setProjSelectedEmpId] = useState(null);
  const [projExpandedCards, setProjExpandedCards] = useState({});
  const [selectedEmpUpdates, setSelectedEmpUpdates] = useState(null);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileOrTablet(window.innerWidth <= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Pagination for Project Details
  const [projectCurrentPage, setProjectCurrentPage] = useState(1);
  const projectItemsPerPage = 5;

  // ── Kural states ─────────────────────────────────────────────
  const [kural, setKural] = useState(null);
  const [kuralLoading, setKuralLoading] = useState(true);
  const [language, setLanguage] = useState("tamil");
  const [kuralDotIndex, setKuralDotIndex] = useState(0);

  // ✅ TIMEZONE-SAFE DATE FUNCTIONS
  const normalizeDate = (date) => {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const todayNormalized = normalizeDate(new Date());

  const isToday = (date) => {
    return normalizeDate(date).getTime() === todayNormalized.getTime();
  };

  const isPast = (date) => {
    return normalizeDate(date) < todayNormalized;
  };

  const isFuture = (date) => {
    return normalizeDate(date) > todayNormalized;
  };

  // ── Pagination for Employee Activity ─────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedConversionRecord, setSelectedConversionRecord] = useState(null);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionRemarks, setConversionRemarks] = useState("");
  const [conversionLoading, setConversionLoading] = useState(false);
  const ITEMS_PER_PAGE = 5;

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, selectedDateRange, customDate]);


  // ── Export to Excel ──────────────────────────────────────────
  const exportToExcel = (data, filename) => {
    if (!data || data.length === 0) return;

    const headers = ["S.No", "Employee Name", "Emp ID", "Task Title", "Date", "Status", "Work Description"];

    const baseWidth = 7;
    const colWidths = [40, 150, 80, 180, 100, 100, 400];

    data.forEach((u) => {
      const name = u.employeeDetails?.name || "N/A";
      const title = u.displayTitle || u.task?.taskTitle || u.standaloneTitle || "Work Summary";
      const desc = u.description || u.phase || u.details || u.note || "No details provided";

      if (name.length * baseWidth > colWidths[1]) colWidths[1] = Math.min(name.length * baseWidth, 250);
      if (title.length * baseWidth > colWidths[3]) colWidths[3] = Math.min(title.length * baseWidth, 300);
      if (desc.length * (baseWidth * 0.4) > colWidths[6]) colWidths[6] = Math.min(desc.length * (baseWidth * 0.4), 500);
    });

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
  <Style ss:ID="CellName">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#3A466D"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="CellTitle">
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
 <Worksheet ss:Name="Project Updates">
  <Table>
   ${colWidths.map((w) => `<Column ss:Width="${w}"/>`).join("")}
   <Row ss:Height="25">
    ${headers.map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>`).join("")}
   </Row>
   ${data
        .map((u, idx) => {
          const dateVal = u.completionDate || u.date || u.createdAt;
          const formattedDate = dateVal
            ? new Date(dateVal).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "N/A";
          const title = u.displayTitle || u.task?.taskTitle || u.standaloneTitle || "Work Summary";
          const name = u.employeeDetails?.name || "N/A";
          const empId = u.employeeDetails?.empId || "N/A";
          const status = u.phaseStatus || "Pending";
          const desc = u.description || u.phase || u.details || u.note || "No details provided";

          const escape = (str) =>
            String(str).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

          return `
   <Row>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellName"><Data ss:Type="String">${escape(name)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(empId)}</Data></Cell>
    <Cell ss:StyleID="CellTitle"><Data ss:Type="String">${escape(title)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(formattedDate)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(status)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(desc)}</Data></Cell>
   </Row>`;
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
  };

  // ── Close status dropdown on outside click ───────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutsideStatus = (e) => {
      if (editStatusRef.current && !editStatusRef.current.contains(e.target)) {
        setShowEditStatusDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideStatus);
    return () => document.removeEventListener("mousedown", handleClickOutsideStatus);
  }, []);

  // ── Fetch Kural ──────────────────────────────────────────────
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

  // ── Check password expiry on mount ───────────────────────────
  useEffect(() => {
    const session = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
    const alreadyDismissed = sessionStorage.getItem("pwdExpiryDismissed") === "true";
    if (session.passwordExpiringSoon && !alreadyDismissed) {
      setShowPwdBanner(true);
      setExpiryDate(session.passwordExpiresAt || null);
    }
  }, []);

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

  // ── FETCH FUNCTIONS ──────────────────────────────────────────

  const fetchDashboardStats = async () => {
    try {
      setStatsLoading(true);
      const res = await portalInstance.get("/portal/admin/dashboard-stats");
      if (res.data?.success) setStats(res.data.data || {});
    } catch (err) {
      console.error("❌ Dashboard stats error:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleOpenConversionModal = (record) => {
    setSelectedConversionRecord(record);
    setConversionRemarks("");
    setShowConversionModal(true);
  };

  const handleApproveConversion = async () => {
    if (!selectedConversionRecord?.permissionId) return;
    try {
      setConversionLoading(true);
      const res = await portalInstance.post(
        `/api/leaves/permission/${selectedConversionRecord.permissionId}/approve-conversion`,
        { remarks: conversionRemarks }
      );
      if (res.data?.success) {
        toast.success(res.data.message || "Half-Day leave conversion approved");
        setShowConversionModal(false);
        fetchEmployeeActivity();
      } else {
        toast.error(res.data?.message || "Failed to approve conversion");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to approve conversion");
    } finally {
      setConversionLoading(false);
    }
  };

  const handleRejectConversion = async () => {
    if (!selectedConversionRecord?.permissionId) return;
    if (!conversionRemarks || !conversionRemarks.trim()) {
      toast.warning("Remarks are mandatory when rejecting half-day conversion");
      return;
    }
    try {
      setConversionLoading(true);
      const res = await portalInstance.post(
        `/api/leaves/permission/${selectedConversionRecord.permissionId}/reject-conversion`,
        { remarks: conversionRemarks }
      );
      if (res.data?.success) {
        toast.success(res.data.message || "Half-Day leave conversion rejected");
        setShowConversionModal(false);
        fetchEmployeeActivity();
      } else {
        toast.error(res.data?.message || "Failed to reject conversion");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reject conversion");
    } finally {
      setConversionLoading(false);
    }
  };

  const fetchEmployeeActivity = async () => {
    try {
      setActivityLoading(true);
      const params = { status: selectedStatus };

      if (selectedDateRange === "custom") {
        if (customDate) params.date = customDate;
        else return setActivityLoading(false);
      } else {
        params.date = selectedDateRange;
      }

      const res = await portalInstance.get("/portal/admin/employee-activity", { params });
      if (res.data?.success) {
        setEmployeeActivity(res.data.data || []);
      }
    } catch (err) {
      console.error("❌ Employee activity fetch error:", err);
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchEditRequests = async () => {
    try {
      setRequestsLoading(true);
      const res = await portalInstance.get("/profile/admin/edit-requests/pending");
      if (res.data?.success) setEditRequests(res.data.requests || []);
    } catch (err) {
      console.error("❌ Edit requests fetch error:", err);
    } finally {
      setRequestsLoading(false);
    }
  };

  const fetchProjectDetails = async () => {
    try {
      setProjectDetailsLoading(true);
      const res = await portalInstance.get("/creat/task-meta");
      if (res.data?.success) {
        const raw = res.data.data.fullProjects || [];
        const dedupedMap = new Map();
        raw.forEach((p) => {
          const cat = (p.categoryId?.name || "").trim().toLowerCase();
          const proj = (p.name || "").trim().toLowerCase();
          const key = `${cat}___${proj}`;
          if (!dedupedMap.has(key)) {
            dedupedMap.set(key, p);
          } else {
            const existing = dedupedMap.get(key);
            if (p.name && /[A-Z]/.test(p.name) && !/[A-Z]/.test(existing.name)) {
              existing.name = p.name;
            }
          }
        });
        setProjectDetails(Array.from(dedupedMap.values()));
      }
    } catch (err) {
      console.error("❌ Project details meta fetch error:", err);
    } finally {
      setProjectDetailsLoading(false);
    }
  };

  const handleProjectClick = async (proj) => {
    try {
      const projectName = proj.name;
      const categoryName = proj.categoryId?.name || "";

      setSelectedProjectInfo(`${categoryName} - ${projectName}`);
      setProjectUpdates([]);
      setShowProjectModal(true);
      setUpdatesLoading(true);

      const res = await portalInstance.get("/creat/daily-update/standalone-updates", {
        params: { project: projectName, category: categoryName },
      });

      if (res.data?.success) {
        setProjectUpdates(res.data.data || []);
      }
    } catch (err) {
      console.error("❌ Fetch project updates error:", err);
    } finally {
      setUpdatesLoading(false);
    }
  };

  const fetchRecentProjectUpdates = async () => {
    try {
      setRecentUpdatesLoading(true);
      const res = await portalInstance.get("/creat/daily-update/standalone-updates");
      if (res.data?.success) {
        setRecentProjectUpdates(res.data.data?.slice(0, 10) || []);
      }
    } catch (err) {
      console.error("❌ Fetch recent updates error:", err);
    } finally {
      setRecentUpdatesLoading(false);
    }
  };

  const fetchTodaySpecialDays = async () => {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const currentDate = today.getDate();

      const res = await portalInstance.get(`/holiday-assignments/special-days/${currentYear}`);
      if (!res.data?.success) {
        setTodaySpecialDays([]);
        return;
      }

      const flatData = Array.isArray(res.data.data) ? res.data.data : [];
      const grouped = Array.isArray(res.data.grouped) ? res.data.grouped : [];
      const allDays = [];

      for (const sd of flatData) {
        if (!sd?.date) continue;
        const dateObj = new Date(sd.date);
        if (Number.isNaN(dateObj.getTime())) continue;
        allDays.push({
          _id: sd._id,
          name: sd.name,
          date: sd.date,
          day: dateObj.getDate(),
          month: dateObj.getMonth() + 1,
          year: dateObj.getFullYear(),
          createdAt: sd.createdAt || null,
          updatedAt: sd.updatedAt || null,
        });
      }

      for (const monthData of grouped) {
        if (!Array.isArray(monthData.specialDays)) continue;
        const monthNumber = Number(monthData.month);

        for (const sd of monthData.specialDays) {
          if (!sd?.date) continue;
          const dateObj = new Date(sd.date);
          if (Number.isNaN(dateObj.getTime())) continue;

          const normalized = {
            _id: sd._id || `${monthNumber}-${sd.date}-${sd.name}`,
            name: sd.name,
            date: sd.date,
            day: dateObj.getDate(),
            month: monthNumber,
            year: dateObj.getFullYear(),
            createdAt: sd.createdAt || null,
            updatedAt: sd.updatedAt || null,
          };

          const exists = allDays.some(
            (item) =>
              (item._id && normalized._id && item._id === normalized._id) ||
              (item.date === normalized.date && item.name === normalized.name)
          );
          if (!exists) allDays.push(normalized);
        }
      }

      const foundToday = allDays.filter(
        (sd) => sd.year === currentYear && sd.month === currentMonth && sd.day === currentDate
      );
      setTodaySpecialDays(foundToday);
    } catch (err) {
      console.error("❌ Fetch special days error:", err);
      setTodaySpecialDays([]);
    }
  };

  const fetchTodayBirthdays = async () => {
    try {
      const res = await portalInstance.get("/users/today-birthdays");
      if (res.data?.success) {
        setTodayBirthdays(res.data.data || []);
      }
    } catch (err) {
      console.error("❌ Fetch today birthdays error:", err);
      setTodayBirthdays([]);
    }
  };

  const fetchSentWishes = async () => {
    try {
      const res = await portalInstance.get("/users/birthday-wish/sent");
      if (res.data?.success) {
        setSentWishes(res.data.data || []);
      }
    } catch (err) {
      console.error("❌ Fetch sent wishes error:", err);
    }
  };

  const [targetEmpsForWish, setTargetEmpsForWish] = useState([]);

  const handleOpenWishModal = (empOrEmps) => {
    const empsList = Array.isArray(empOrEmps)
      ? empOrEmps
      : empOrEmps
        ? [empOrEmps]
        : todayBirthdays;
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
      console.error("❌ Send wish error:", err);
      toast.error(err.response?.data?.message || "Failed to send wishes");
    } finally {
      setSendingWish(false);
    }
  };

  const checkForNewLeaves = async () => {
    try {
      const [leaveRes, wfhRes] = await Promise.all([
        portalInstance.get("/api/leaves/admin/all"),
        portalInstance.get("/api/leaves/admin/wfh"),
      ]);

      const leaves = Array.isArray(leaveRes.data?.data) ? leaveRes.data.data : [];
      const wfhRequests = Array.isArray(wfhRes.data?.data) ? wfhRes.data.data : [];

      const allRequests = [
        ...leaves.map((l) => ({ ...l, requestType: "leave" })),
        ...wfhRequests.map((w) => ({ ...w, requestType: "wfh" })),
      ];

      const dismissed = JSON.parse(localStorage.getItem("dismissedNotificationKeys") || "[]");

      const actionable = allRequests.filter((l) => {
        const key = `${l.requestType}-${l._id}-${l.status}`;
        return (l.status === "Pending" || l.status === "Leave Cancel") && !dismissed.includes(key);
      });

      actionable.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      return actionable.map((l) => ({
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
      console.error("Leave polling error:", err);
      return [];
    }
  };

  const checkForHolidayAssignments = async () => {
    try {
      const res = await portalInstance.get("/holiday-assignments/my");
      let assignments = res.data?.data || res.data?.assignments || res.data || [];

      const dismissed = JSON.parse(localStorage.getItem("dismissedNotificationKeys") || "[]");

      const submitted = assignments.filter((a) => {
        const key = `holiday-${a._id}-${a.status}`;
        return (a.status === "submitted" || a.status === "Submitted") && !dismissed.includes(key);
      });

      submitted.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      return submitted.map((a) => ({
        id: a._id,
        uniqueKey: `holiday-${a._id}-${a.status}`,
        name: a.employee?.name || "Unknown",
        photo: buildFileUrl(a.employee?.photo) || DEFAULT_AVATAR,
        holidayName: a.holidayName || a.holiday?.name || "Government Holiday",
        holidayDate: a.holidayDate || a.holiday?.date || "",
        status: a.status,
        category: "holiday",
        time: a.updatedAt || a.createdAt,
      }));
    } catch (err) {
      console.error("Holiday polling error:", err);
      return [];
    }
  };

  const checkForSecurityRequests = async () => {
    try {
      const res = await portalInstance.get("/security/pending-for-me");
      const requests = Array.isArray(res.data?.data) ? res.data.data : [];

      const dismissed = JSON.parse(localStorage.getItem("dismissedNotificationKeys") || "[]");

      const actionable = requests.filter((r) => {
        const key = `security-${r._id}-${r.status}`;
        return !dismissed.includes(key);
      });

      return actionable.map((r) => ({
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
      console.error("Security polling error:", err);
      return [];
    }
  };

  const fetchAllNotifications = async () => {
    try {
      const [leaves, holidays, securities] = await Promise.all([
        checkForNewLeaves(),
        checkForHolidayAssignments(),
        checkForSecurityRequests(),
      ]);
      const incoming = [...leaves, ...holidays, ...securities];

      setNotifications((prev) => {
        const map = new Map();
        prev.forEach((n) => map.set(n.uniqueKey, n));
        incoming.forEach((n) => {
          if (!JSON.parse(localStorage.getItem("dismissedNotificationKeys") || "[]").includes(n.uniqueKey)) {
            map.set(n.uniqueKey, n);
          }
        });
        return Array.from(map.values())
          .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
          .slice(0, 20);
      });
    } catch (err) {
      console.error("Notifications fetch failed:", err);
    }
  };

  // ── Todo Functions ───────────────────────────────────────────

  const fetchTodos = async () => {
    try {
      setTodoLoading(true);
      const res = await portalInstance.get("/todo/all", {
        params: {
          dateFilter: todoDateFilter,
          statusFilter: todoStatusFilter,
          fromDate: todoCustomFromDate,
          toDate: todoCustomToDate,
        },
      });
      if (res.data.success) {
        setTodos(res.data.data || []);
      }
    } catch (err) {
      console.error("Fetch todos error:", err);
      setTodos([]);
    } finally {
      setTodoLoading(false);
    }
  };

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

  const handleOpenTodoConfirm = (todo) => {
    setSelectedTodo(todo);
    setShowTodoConfirmModal(true);
  };

  const handleConfirmComplete = async () => {
    if (!selectedTodo) return;
    try {
      await portalInstance.put(`/todo/complete/${selectedTodo._id}`);
      toast.success("Todo marked as completed successfully");
      await fetchTodos();
      setShowTodoConfirmModal(false);
      setShowDetailModal(false);
      setSelectedTodo(null);
    } catch (err) {
      console.error("Complete todo error:", err);
      toast.error("Failed to complete todo");
    }
  };

  const handleSaveTodo = async () => {
    if (!todoTitle || !todoTitle.trim()) {
      toast.error("Please enter Title");
      return;
    }

    if (!todoDescription || !todoDescription.trim()) {
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

  // ── EFFECTS ──────────────────────────────────────────────────

  useEffect(() => {
    setFilteredPage(1);
    if (todoDateFilter !== "custom") {
      fetchTodos();
      return;
    }
    if (todoCustomFromDate && todoCustomToDate) {
      fetchTodos();
    }
  }, [todoDateFilter, todoStatusFilter, todoCustomFromDate, todoCustomToDate]);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("Erti-Portal");
    if (sessionData) {
      try {
        const { name } = JSON.parse(sessionData);
        setAdminName(name || "Admin");
      } catch { }
    }

    const storedLoginTime = sessionStorage.getItem("loginTime");
    if (storedLoginTime) {
      setLoginTime(new Date(storedLoginTime));
    }

    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const slogans = slogansData.messages;

    if (Array.isArray(slogans) && slogans.length > 0) {
      const seed = today.getFullYear() + dayOfYear;
      const index = seed % slogans.length;
      const slogan = slogans[index] || {};
      setDailySlogan(`${slogan.icon || "✨"} ${slogan.text || "Stay productive today"}`);
    }



    fetchDashboardStats();
    fetchEmployeeActivity();
    fetchEditRequests();
    fetchTodos();
    fetchProjectDetails();
    fetchRecentProjectUpdates();
    fetchAllNotifications();
    fetchTodaySpecialDays();
    fetchTodayBirthdays();
    fetchSentWishes();

    const editInterval = setInterval(fetchEditRequests, 30000);
    const notifInterval = setInterval(fetchAllNotifications, 10000);
    const specialInterval = setInterval(fetchTodaySpecialDays, 60000);
    const bdayInterval = setInterval(fetchTodayBirthdays, 60000);

    return () => {
      clearInterval(editInterval);
      clearInterval(notifInterval);
      clearInterval(specialInterval);
      clearInterval(bdayInterval);
    };
  }, []);

  useEffect(() => {
    fetchEmployeeActivity();
  }, [selectedDateRange, customDate, selectedStatus]);

  // ── ACTION HANDLERS ──────────────────────────────────────────

  const handleActionClick = (request, action) => {
    setSelectedRequest(request);
    setActionType(action);
    setRejectReason("");
    setShowConfirmModal(true);
  };

  const processAction = async () => {
    if (!selectedRequest || !actionType) return;
    if (actionType === "rejected" && !rejectReason.trim()) {
      alert("Please provide a reason for rejecting the edit request.");
      return;
    }
    try {
      setActionLoading(selectedRequest._id);
      const payload =
        actionType === "approved"
          ? { status: "approved", approvedFields: selectedRequest.requestedFields || [], adminNote: "" }
          : { status: "rejected", adminNote: rejectReason.trim() };

      const res = await portalInstance.put(`/profile/admin/edit-request/${selectedRequest._id}`, payload);

      if (res.data?.success) {
        setEditRequests((prev) => prev.filter((r) => r._id !== selectedRequest._id));
        setShowConfirmModal(false);
        setSelectedRequest(null);
        setActionType(null);
        setRejectReason("");
      }
    } catch (err) {
      console.error("❌ Process action error:", err);
      alert(err.response?.data?.message || "Failed to process request.");
    } finally {
      setActionLoading(null);
    }
  };

  const markAsSeen = (uniqueKey) => {
    const keys = JSON.parse(localStorage.getItem("dismissedNotificationKeys") || "[]");
    if (!keys.includes(uniqueKey)) {
      keys.push(uniqueKey);
      localStorage.setItem("dismissedNotificationKeys", JSON.stringify(keys));
    }
    setNotifications((prev) => prev.filter((n) => n.uniqueKey !== uniqueKey));
  };

  const handleCardClick = (notif) => {
    markAsSeen(notif.uniqueKey);
    if (notif.category === "holiday") navigate("/admin/holiday-assignments");
    else if (notif.category === "security") navigate("/admin/checker-dashboard");
    else navigate("/admin/leaves");
  };

  const handleDismiss = (e, uniqueKey) => {
    e.stopPropagation();
    markAsSeen(uniqueKey);
  };

  // ── FORMAT HELPERS ───────────────────────────────────────────

  const formatDate = (dateString) => {
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

  const formatTime = (date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const formatDateDisplay = (date) =>
    date.toLocaleDateString("en-US", { day: "2-digit", month: "short" });

  const getStatusClass = (status) => {
    if (!status) return "status-default";
    const s = status.toLowerCase().trim();
    if (s === "-") return "status-neutral";
    if (s.includes("wfh")) return "status-present";
    if (s.includes("late") && s.includes("wfh")) return "status-present";
    if (s.includes("late")) return "status-late";
    if (s.includes("present")) return "status-present";
    if (s.includes("leave")) return "status-leave-approved";
    if (s.includes("leave")) return "status-leave";
    if (s.includes("absent")) return "status-absent";
    if (s.includes("holiday")) return "status-holiday";
    return "status-default";
  };

  const formatNotifDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getMonthName = (monthNum) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[monthNum - 1] || "";
  };

  // ── Todo derived data ─────────────────────────────────────────

  const filteredTodos = Array.isArray(todos) ? todos : [];

  const totalTodoItems = filteredTodos.length;
  const paginatedTodos = filteredTodos.slice(
    (filteredPage - 1) * TODO_PAGE_SIZE,
    filteredPage * TODO_PAGE_SIZE
  );

  const isFilteredView =
    todoDateFilter !== "all" ||
    todoStatusFilter !== "all" ||
    !!todoCustomFromDate ||
    !!todoCustomToDate;

  const pendingToday = paginatedTodos.filter((t) => isToday(t.date) && t.status?.toLowerCase() !== "completed");
  const overdue = paginatedTodos.filter((t) => isPast(t.date) && t.status?.toLowerCase() !== "completed");
  const completedToday = paginatedTodos.filter((t) => isToday(t.date) && t.status?.toLowerCase() === "completed");
  const upcoming = paginatedTodos.filter((t) => isFuture(t.date) && t.status?.toLowerCase() !== "completed");
  const completedOther = paginatedTodos.filter((t) => !isToday(t.date) && t.status?.toLowerCase() === "completed");

  const totalPages = Math.max(1, Math.ceil(employeeActivity.length / ITEMS_PER_PAGE));
  const paginatedData = employeeActivity.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <>
      <Modal
        show={showProjectModal}
        onHide={() => { setShowProjectModal(false); setProjSelectedEmpId(null); setProjExpandedCards({}); }}
        centered
        size="lg"
        className="project-phases-modal-custom project-phases-modal-custom-admin"
      >
        <Modal.Header className="project-details-modal-header border-0 pb-0 d-flex flex-column align-items-stretch">
          {/* Top Row: Title & Close Button */}
          <div className="d-flex justify-content-between align-items-center mb-0 w-100 flex-nowrap">
            <h3 className="assign-task__members-title m-0" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
              Employee Work Details
            </h3>
            <button
              type="button"
              className="common-modal-close-x"
              onClick={() => { setShowProjectModal(false); setProjSelectedEmpId(null); setProjExpandedCards({}); }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {/* <div style={{ borderBottom: "1px solid #f1f5f9" }}></div> */}
          {/* Bottom Row: Category/Project on Left, Export Excel on Right */}
          <div className="d-flex justify-content-between align-items-center w-100 mb-3 mt-3 project-details-modal-subheader-row">
            <div className="project-details-modal-header-content d-flex align-items-center">
              <div className="project-details-modal-item">
                <span className="dwu-work-card__label">Project</span>
                <span className="dwu-work-card__value">
                  {selectedProjectInfo?.split(" - ")[1] || "Project Details"}
                </span>
              </div>
              <div className="project-details-modal-item">
                <span className="dwu-work-card__label">Category</span>
                <span className="dwu-work-card__value">
                  {selectedProjectInfo?.split(" - ")[0] || "General"}
                </span>
              </div>
            </div>

            <Button
              variant="outline-primary"
              size="sm"
              className="excel-export-btn"
              onClick={() =>
                exportToExcel(
                  projectUpdates,
                  `Project_Details_${selectedProjectInfo?.replace(/\s+/g, "_") || "Export"}`
                )
              }
            >
              Export Excel
            </Button>
          </div>
        </Modal.Header>
        <Modal.Body className="project-details-modal-body">
          {updatesLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted" style={{ fontSize: "13px" }}>Analyzing project data...</p>
            </div>
          ) : projectUpdates.length === 0 ? (
            <div className="project-details-no-work-container">
              <h5 className="project-details-no-work-title">No Work Recorded</h5>
              <p className="text-muted small">No specific work summaries have been logged for this project yet.</p>
            </div>
          ) : (() => {
            const empMap = {};
            projectUpdates.forEach((u) => {
              const empId = u.employeeDetails?.empId || u.employeeDetails?.name || "unknown";
              if (!empMap[empId]) {
                empMap[empId] = {
                  empId,
                  name: u.employeeDetails?.name || "N/A",
                  designation: u.employeeDetails?.designation || "",
                  photo: buildFileUrl(u.employeeDetails?.photo),
                  latestDate: u.completionDate,
                  updates: [],
                };
              }
              empMap[empId].updates.push(u);
              if (new Date(u.completionDate) > new Date(empMap[empId].latestDate)) {
                empMap[empId].latestDate = u.completionDate;
              }
            });

            const empList = Object.values(empMap);
            if (empList.length > 1) {
              const allLatestDate = projectUpdates.reduce((max, u) => {
                const d = new Date(u.completionDate);
                return d > max ? d : max;
              }, new Date(0));
              empList.unshift({
                empId: "all",
                name: "All Employees",
                designation: "Project Overview",
                photo: null,
                latestDate: allLatestDate,
                updates: projectUpdates,
                isAll: true,
              });
            }

            const activeEmpId = projSelectedEmpId || empList[0]?.empId;
            const activeEmp =
              activeEmpId === "all" ? { name: "All Employees", updates: projectUpdates } : empMap[activeEmpId];

            return (
              <div className="project-details-two-panel">
                {/* ════ LEFT PANEL: Employee List ════ */}
                <div className="project-details-left-panel">
                  <div className="project-details-left-header">
                    <span style={{ width: "40px" }}>S.No</span>
                    <span style={{ flex: 1 }}>Employee Name</span>
                  </div>
                  <div className="project-details-left-list">
                    {empList.map((emp, idx) => (
                      <div
                        key={emp.empId}
                        onClick={() => {
                          if (isMobileOrTablet) {
                            setSelectedEmpUpdates(emp);
                          } else {
                            setProjSelectedEmpId(emp.empId);
                            setProjExpandedCards({});
                          }
                        }}
                        className={`project-details-emp-item ${activeEmpId === emp.empId ? "active" : ""}`}
                      >
                        <span className="project-details-emp-index">{String(idx + 1).padStart(2, "0")}</span>
                        <div className="project-details-emp-avatar-box">
                          {emp.isAll ? (
                            <div className="project-details-emp-initials" style={{ background: "#5977f8", color: "white" }}>
                              <Icon icon="solar:users-group-rounded-bold" width={20} />
                            </div>
                          ) : emp.photo ? (
                            <img src={emp.photo} alt="" className="project-details-emp-photo" onError={(e) => { e.target.src = "/avatar.png"; }} />
                          ) : (
                            <div className="project-details-emp-initials">{emp.name?.charAt(0) || "?"}</div>
                          )}
                          <div className="project-details-emp-info">
                            <span className="project-details-emp-name">{emp.name}</span>
                            <span className="project-details-emp-designation">{emp.designation}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ════ RIGHT PANEL: Work Details ════ */}
                {!isMobileOrTablet && (

                  <div className="project-details-right-panel">
                    {activeEmp ? (
                      <>
                        <div className="project-details-right-header">
                          <span className="project-details-right-header-title">{activeEmp.name} Working Status</span>
                        </div>
                        <div className="project-details-right-list">
                          {groupTasksWithHistory(activeEmp.updates).map((u, idx) => {
                            const cardKey = `${activeEmpId}-${idx}`;
                            const hasMultipleUpdates = Array.isArray(u.history) && u.history.length > 1;
                            const isExpanded = !!projExpandedCards[cardKey];
                            const normKey = normalizeStatusKey(u.latestStatus);
                            const isCompleted = normKey === "completed";

                            return (
                              <div
                                key={idx}
                                className={`dwu-work-card ${isExpanded ? "expanded" : ""}`}
                                style={{ cursor: "pointer", margin: "10px" }}
                                onClick={() => {
                                  setProjExpandedCards((prev) => ({ ...prev, [cardKey]: !isExpanded }));
                                }}
                              >
                                <div className="dwu-work-card__header" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 12px" }}>
                                  <div className="dwu-work-card__field dwu-field-title" style={{ flex: 1, minWidth: 0 }}>
                                    <span className="dwu-work-card__label">
                                      {activeEmpId === "all" ? (u.employeeDetails?.name || "Employee") : "Task"}
                                    </span>
                                    <span className="dwu-work-card__value" title={u.displayTitle || u.taskTitle || "Task Title"} style={{ display: "block", wordBreak: "break-word", whiteSpace: "normal" }}>
                                      {u.displayTitle || u.taskTitle || "Task Title"}
                                    </span>
                                  </div>
                                  <div className="dwu-work-card__field dwu-field-date" style={{ width: "70px", flexShrink: 0, textAlign: "left" }}>
                                    <span className="dwu-work-card__label dwu-label-hide-mobile">Date</span>
                                    <span className="dwu-work-card__value">
                                      {u.latestDate
                                        ? new Date(u.latestDate).toLocaleDateString("en-GB", {
                                          day: "2-digit",
                                          month: "short",
                                        })
                                        : "—"}
                                    </span>
                                  </div>

                                  <div className="dwu-work-card__field dwu-field-status" style={{ width: "95px", flexShrink: 0, textAlign: "left" }}>
                                    <span className="dwu-work-card__label dwu-label-hide-mobile">Status</span>
                                    <span className={`dwu-admin__statusBadge dwu-admin__statusBadge--${normKey}`} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                      {formatStatusLabel(u.latestStatus)}
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
                                      alignItems: "start"
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
                                  <div className="dwu-work-card__section_phase" style={{ paddingTop: "8px", borderTop: "1px dashed #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
                                    {hasMultipleUpdates ? (
                                      <div className="dwu-task-history-section">
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                                          <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>
                                            Status History ({u.history.length})
                                          </span>
                                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                            Latest First
                                          </span>
                                        </div>

                                        <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", background: "#f8fafc" }}>
                                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                            <thead>
                                              <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: "600" }}>
                                                <th style={{ padding: "6px 10px", textAlign: "left", width: "85px" }}>Date</th>
                                                <th style={{ padding: "6px 10px", textAlign: "left", width: "115px" }}>Status</th>
                                                <th style={{ padding: "6px 10px", textAlign: "left" }}>Work Summary</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {u.history.map((h, hIdx) => {
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
                                                    style={{
                                                      borderBottom: hIdx === u.history.length - 1 ? "none" : "1px solid #e2e8f0",
                                                      background: hIdx % 2 === 0 ? "#ffffff" : "#f8fafc",
                                                      cursor: "pointer"
                                                    }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setSelectedUpdate(h);
                                                      setShowUpdateDetailModal(true);
                                                    }}
                                                  >
                                                    <td style={{ padding: "7px 10px", verticalAlign: "top", fontWeight: "500", color: "#334155" }}>
                                                      {dateStr}
                                                    </td>
                                                    <td style={{ padding: "7px 10px", verticalAlign: "top" }}>
                                                      <span
                                                        className={`dwu-admin__statusBadge dwu-admin__statusBadge--${hKey}`}
                                                        style={{
                                                          display: "inline-flex",
                                                          alignItems: "center",
                                                          gap: "4px",
                                                          padding: "2px 8px",
                                                          fontSize: "11px",
                                                          whiteSpace: "nowrap"
                                                        }}
                                                        title={hLocked ? "Completed update is final and read-only" : ""}
                                                      >
                                                        {formatStatusLabel(hStatusRaw)}
                                                        {hLocked && <span role="img" aria-label="locked" style={{ fontSize: "11px", lineHeight: 1 }}></span>}
                                                      </span>
                                                    </td>
                                                    <td style={{ padding: "7px 10px", verticalAlign: "top", color: "#475569" }}>
                                                      {(() => {
                                                        const mainTitle = (u.taskTitle || u.displayTitle || u.name || u.title || "").trim();
                                                        const hTitle = (h.title || h.taskTitle || h.displayTitle || h.name || h.phase || "").trim();
                                                        const isTitleChanged = Boolean(hTitle && mainTitle && hTitle.toLowerCase() !== mainTitle.toLowerCase());
                                                        return isTitleChanged ? (
                                                          <div style={{ fontWeight: "600", color: "#1e293b", marginBottom: "4px", fontSize: "12px" }}>
                                                            {hTitle}
                                                          </div>
                                                        ) : null;
                                                      })()}
                                                      <div style={{ wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                                                        {h.note || h.description || h.details || "—"}
                                                      </div>
                                                      {Array.isArray(h.pages) && h.pages.length > 0 && (
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                                                          {h.pages.map((p, pI) => (
                                                            <span key={pI} style={{ fontSize: "10px", background: "#e0e7ff", color: "#3730a3", padding: "1px 6px", borderRadius: "4px", fontWeight: "500" }}>
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
                                      <div style={{ padding: "4px 0 8px 0" }}>
                                        <span className="dwu-work-card__label mt-0 d-block mb-1">Work Summary</span>
                                        <p
                                          className="dwu-work-card__text"
                                          style={{
                                            wordBreak: "break-word",
                                            overflowWrap: "anywhere",
                                            whiteSpace: "pre-wrap",
                                            margin: 0,
                                            paddingRight: "8px",
                                            fontSize: "12px",
                                            color: "#475569"
                                          }}
                                        >
                                          {u.history?.[0]?.note || u.history?.[0]?.description || u.history?.[0]?.details || u.description || u.details || u.note || "No description provided."}
                                        </p>
                                        {Array.isArray(u.history?.[0]?.pages) && u.history[0].pages.length > 0 && (
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                                            {u.history[0].pages.map((p, pI) => (
                                              <span key={pI} style={{ fontSize: "10px", background: "#e0e7ff", color: "#3730a3", padding: "1px 6px", borderRadius: "4px", fontWeight: "500" }}>
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
                      </>
                    ) : (
                      <div className="project-details-select-emp-placeholder">
                        <p>Select an employee to view updates.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-3 pb-0 pe-0 project-details-modal-footer-custom">
          <Button
            variant="light"
            onClick={() => { setShowProjectModal(false); setProjSelectedEmpId(null); setProjExpandedCards({}); }}
            className="project-details-modal-cancel-btn"
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal >

      {/* ── Employee specific updates modal for mobile/tablet screen ── */}
      < Modal
        show={!!selectedEmpUpdates
        }
        onHide={() => setSelectedEmpUpdates(null)}
        centered
        size="md"
        className="project-phases-modal-custom project-phases-modal-custom-admin"
      >
        <Modal.Header className="project-details-modal-header border-0 pb-0 d-flex flex-column align-items-stretch">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h4 className="assign-task__members-title m-0">
              {selectedEmpUpdates?.name} Updates
            </h4>
            <button
              type="button"
              className="common-modal-close-x"
              onClick={() => setSelectedEmpUpdates(null)}
              aria-label="Close"
              style={{ background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "#6b7280" }}
            >
              ✕
            </button>
          </div>
          <div style={{ borderBottom: "1px solid #f1f5f9" }}></div>
        </Modal.Header>
        <Modal.Body className="project-details-modal-body px-4 pt-0 pb-4" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {selectedEmpUpdates && (
            <div className="project-details-right-list">
              {groupTasksWithHistory(selectedEmpUpdates.updates).map((u, idx) => {
                const cardKey = `popup-${selectedEmpUpdates.empId}-${idx}`;
                const hasMultipleUpdates = Array.isArray(u.history) && u.history.length > 1;
                const isExpanded = !!projExpandedCards[cardKey];
                const normKey = normalizeStatusKey(u.latestStatus);
                const isCompleted = normKey === "completed";

                return (
                  <div
                    key={idx}
                    className={`dwu-work-card ${isExpanded ? "expanded" : ""}`}
                    style={{ cursor: "pointer", margin: "10px 0" }}
                    onClick={() => {
                      setProjExpandedCards((prev) => ({ ...prev, [cardKey]: !isExpanded }));
                    }}
                  >
                    <div className="dwu-work-card__header" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 12px" }}>
                      <div className="dwu-work-card__field dwu-field-title" style={{ flex: 1, minWidth: 0 }}>
                        <span className="dwu-work-card__label">
                          {selectedEmpUpdates.isAll ? (u.employeeDetails?.name || "Employee") : "Task"}
                        </span>
                        <span className="dwu-work-card__value" title={u.displayTitle || u.taskTitle || "Task Title"} style={{ display: "block", wordBreak: "break-word", whiteSpace: "normal" }}>
                          {u.displayTitle || u.taskTitle || "Task Title"}
                        </span>
                      </div>
                      <div className="dwu-work-card__field dwu-field-date" style={{ width: "70px", flexShrink: 0, textAlign: "left" }}>
                        <span className="dwu-work-card__label">Date</span>
                        <span className="dwu-work-card__value">
                          {u.latestDate
                            ? new Date(u.latestDate).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                            })
                            : "—"}
                        </span>
                      </div>

                      <div className="dwu-work-card__field dwu-field-status" style={{ width: "95px", flexShrink: 0, textAlign: "left" }}>
                        <span className="dwu-work-card__label">Status</span>
                        <span className={`dwu-admin__statusBadge dwu-admin__statusBadge--${normKey}`} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {formatStatusLabel(u.latestStatus)}
                          {isCompleted && <span role="img" aria-label="locked" style={{ fontSize: "11px", lineHeight: 1 }}></span>}
                        </span>
                      </div>
                      <div style={{ width: "20px", flexShrink: 0, display: "flex", justifyContent: "flex-start", alignItems: "start" }}>
                        <FaChevronDown
                          className="project-task-card-chevron"
                          style={{
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            fontSize: "12px",
                            color: "#94a3b8",
                            transition: "transform 0.2s"
                          }}
                        />
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="dwu-work-card__expanded-content" style={{ padding: "0 12px 12px 12px", borderTop: "1px dashed #e2e8f0", marginTop: "8px", paddingTop: "8px" }} onClick={(e) => e.stopPropagation()}>
                        {hasMultipleUpdates ? (
                          /* Status History */
                          <div className="dwu-task-history-section" style={{ marginTop: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                              <span style={{ fontSize: "11px", fontWeight: "600", color: "#475569" }}>
                                Status History ({u.history.length})
                              </span>
                              <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                                Latest First
                              </span>
                            </div>
                            <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden", background: "#f8fafc" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                                <thead>
                                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                                    <th style={{ padding: "5px 8px", textAlign: "left", width: "75px" }}>Date</th>
                                    <th style={{ padding: "5px 8px", textAlign: "left", width: "100px" }}>Status</th>
                                    <th style={{ padding: "5px 8px", textAlign: "left" }}>Work Summary</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {u.history.map((h, hIdx) => {
                                    const hStatusRaw = h.status || h.phaseStatus || "Pending";
                                    const hKey = normalizeStatusKey(hStatusRaw);
                                    const hLocked = hKey === "completed";
                                    const dateVal = h.date || h.completionDate || h.updateDate || h.createdAt;
                                    const dateStr = dateVal ? new Date(dateVal).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";
                                    return (
                                      <tr key={hIdx} style={{ borderBottom: hIdx === u.history.length - 1 ? "none" : "1px solid #e2e8f0" }}>
                                        <td style={{ padding: "5px 8px", verticalAlign: "top", color: "#334155" }}>{dateStr}</td>
                                        <td style={{ padding: "5px 8px", verticalAlign: "top" }}>
                                          <span className={`dwu-admin__statusBadge dwu-admin__statusBadge--${hKey}`} style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "10px", padding: "1px 6px" }}>
                                            {formatStatusLabel(hStatusRaw)}
                                            {hLocked && <span></span>}
                                          </span>
                                        </td>
                                        <td style={{ padding: "5px 8px", verticalAlign: "top", color: "#475569" }}>
                                          {(() => {
                                            const mainTitle = (u.taskTitle || u.displayTitle || u.name || u.title || "").trim();
                                            const hTitle = (h.title || h.taskTitle || h.displayTitle || h.name || h.phase || "").trim();
                                            const isTitleChanged = Boolean(hTitle && mainTitle && hTitle.toLowerCase() !== mainTitle.toLowerCase());
                                            return isTitleChanged ? (
                                              <div style={{ fontWeight: "600", color: "#1e293b", marginBottom: "3px", fontSize: "11px" }}>
                                                {hTitle}
                                              </div>
                                            ) : null;
                                          })()}
                                          <div>{h.note || h.description || h.details || "—"}</div>
                                          {Array.isArray(h.pages) && h.pages.length > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                                              {h.pages.map((p, pI) => (
                                                <span key={pI} style={{ fontSize: "9px", background: "#e0e7ff", color: "#3730a3", padding: "1px 4px", borderRadius: "4px", fontWeight: "500" }}>
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
                          /* Single update: show description */
                          <div style={{ padding: "4px 0 4px 0" }}>
                            <span className="dwu-work-card__label mt-0 d-block mb-1">Work Summary</span>
                            <p
                              className="dwu-work-card__text"
                              style={{
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                                whiteSpace: "pre-wrap",
                                margin: 0,
                                fontSize: "12px",
                                color: "#475569"
                              }}
                            >
                              {u.history?.[0]?.note || u.history?.[0]?.description || u.history?.[0]?.details || u.description || u.details || u.note || "No description provided."}
                            </p>
                            {Array.isArray(u.history?.[0]?.pages) && u.history[0].pages.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                                {u.history[0].pages.map((p, pI) => (
                                  <span key={pI} style={{ fontSize: "10px", background: "#e0e7ff", color: "#3730a3", padding: "1px 6px", borderRadius: "4px", fontWeight: "500" }}>
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
          )}
        </Modal.Body>
      </Modal >

      <Sidebar />

      <div className="Admindashboard dashboard-page">
        <div className="dashboard-content-wrapper">
          {showPwdBanner && (
            <PasswordExpiryBanner expiryDate={expiryDate} onDismiss={() => setShowPwdBanner(false)} />
          )}


          <HolidayAssignmentBanner />

          <LeaveCategoryBanner />
          

          {/* ── Kural Banner ── */}
          <div className="employee-dashboard-banner">
            <div className={`employee-dashboard-content ${language === "english" ? "lang-en" : ""}`}>
              <div className="employee-dashboard-left">
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
                          {kural.transliteration1 || kural.couplet || kural.Translation || "—"}
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
                {language === "tamil" && kural && (
                  <div className="kural-dots">
                    {[kural.mv, kural.sp, kural.mk].filter(Boolean).map((_, i) => (
                      <button
                        key={i}
                        className={`kural-dot${kuralDotIndex === i ? " kural-dot-active" : ""}`}
                        onClick={() => setKuralDotIndex(i)}
                      />
                    ))}
                  </div>
                )}
                <img src="/Valluvar.png" alt="Thirukkural" className="employee-dashboard-img" />
              </div>
            </div>
          </div>



          {/* Today's Special Days Banner */}
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
                          {getMonthName(day.month)} {day.date}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Employee Birthday Celebration Card ── */}
          {todayBirthdays.length > 0 && (
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
                    Intimation for Employees Birthday: Celebrate and send warm wishes to team member{todayBirthdays.length > 1 ? "s" : ""} celebrating today!
                  </p>
                </div>
              </div>

              {(() => {
                const bdayCount = todayBirthdays.length;
                const gridCols = bdayCount === 1 ? "1fr" : bdayCount === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)";
                return (
                  <div className="admin-birthday-card__grid" style={{ gridTemplateColumns: gridCols }}>
                    {todayBirthdays.map((emp, index) => {
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

              {/* Send Wishes Button at the RIGHT BOTTOM CORNER */}
              <div className="admin-birthday-card__footer">
                <button
                  className={`admin-birthday-card__wish-btn ${sentWishes.length > 0 ? "wished" : ""}`}
                  disabled={sentWishes.length > 0}
                  onClick={() => sentWishes.length === 0 && handleOpenWishModal(todayBirthdays)}
                >
                  {sentWishes.length > 0 ? "Wished " : "Send Wishes"}
                </button>
              </div>
            </div>
          )}

          {/* Send Birthday Wish Modal */}
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
                        <small className="bday-modal__user-info">{emp.empId} • {emp.designation || "Employee"}</small>
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

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon blue"><FaUsers /></div>
              <div>
                <p>Total Employees</p>
                <h3>{stats.totalEmployees || 0}</h3>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"><FaUserCheck /></div>
              <div>
                <p>Present Today</p>
                <h3>{stats.presentToday || 0}</h3>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red"><FaUserTimes /></div>
              <div>
                <p>Absent Today</p>
                <h3>{stats.absentToday || 0}</h3>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange"><FaCalendarAlt /></div>
              <div>
                <p>Leave Today</p>
                <h3>{stats.leaveToday || 0}</h3>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple"><FaClock /></div>
              <div>
                <p>Late Check-ins</p>
                <h3>{stats.lateCheckins || 0}</h3>
              </div>
            </div>
          </div>

          {/* Profile Update Requests */}
          {!requestsLoading && editRequests.length > 0 && (
            <div className="dashboard-card admin-editrequest-card">
              <div className="admin-editrequest-card-header-row">
                <div className="admin-editrequest-header-left">
                  <div className="admin-editrequest-header-icon"><FaEdit /></div>
                  <div>
                    <h5>Profile Update Requests</h5>
                    <p>Review and manage employee edit requests</p>
                  </div>
                </div>
                <Badge bg="warning" className="admin-editrequest-request-count-badge">
                  {editRequests.length} Pending
                </Badge>
              </div>

              <div className="admin-editrequest-requests-list">
                {editRequests.map((request) => (
                  <div key={request._id} className="admin-editrequest-request-item">
                    <div className="admin-editrequest-request-avatar">
                      {request.employeeId?.picture || request.employeeId?.photo || request.employeeId?.profilePicture ? (
                        <img
                          src={request.employeeId?.picture || request.employeeId?.photo || request.employeeId?.profilePicture}
                          alt="avatar"
                          style={{ width: "100%", height: "100%", borderRadius: "12px", objectFit: "cover" }}
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <FaUser style={{ display: (request.employeeId?.picture || request.employeeId?.photo || request.employeeId?.profilePicture) ? 'none' : 'block' }} />
                    </div>

                    <div className="admin-editrequest-request-info">
                      <div className="admin-editrequest-request-header">
                        <h6>{request.employeeId?.name || "Unknown Employee"}</h6>
                      </div>
                      <p className="admin-editrequest-request-emp-id">
                        <strong>Emp ID:</strong>{" "}
                        {request.employeeId?.empId || request.employeeId?.empIdString || request.empIdString || "-"}
                      </p>
                      <div className="admin-editrequest-request-message">
                        <FaEnvelope className="me-1" /> {request.requestMessage}
                      </div>
                    </div>

                    <div className="admin-editrequest-request-right">
                      <div className="admin-editrequest-request-time">
                        <FaCalendarAlt className="me-1" /> {formatDate(request.createdAt)}
                      </div>
                      <div className="admin-editrequest-request-actions">
                        <button
                          className="common-modal-btn btn-reject"
                          onClick={() => handleActionClick(request, "rejected")}
                          disabled={actionLoading === request._id}
                        >
                          Reject
                        </button>
                        <button
                          className="common-modal-btn btn-confirm-success"
                          onClick={() => handleActionClick(request, "approved")}
                          disabled={actionLoading === request._id}
                        >
                          {actionLoading === request._id ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <>Approve</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Employee Activity ── */}
          <div className="dashboard-card employee-activity-card">
            <div className="employee-activity-header">
              <h4>Employee Activity</h4>
              <div className="employee-activity-filters">
                <CustomDropdown
                  options={[
                    { label: "Today", value: "today" },
                    { label: "Yesterday", value: "yesterday" },
                    { label: "Select Date", value: "custom" },
                  ]}
                  value={selectedDateRange}
                  onChange={(val) => {
                    setSelectedDateRange(val);
                    if (val !== "custom") setCustomDate("");
                  }}
                  placeholder="Date"
                  className="activity-date-dropdown"
                />
                {selectedDateRange === "custom" && (
                  <input
                    type="date"
                    className="date-picker-input"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                  />
                )}
                <CustomDropdown
                  options={[
                    { label: "All", value: "All" },
                    { label: "Present", value: "Present" },
                    { label: "Absent", value: "Absent" },
                    { label: "Leave", value: "Leave" },
                  ]}
                  value={selectedStatus}
                  onChange={(val) => setSelectedStatus(val)}
                  placeholder="Status"
                  className="activity-status-dropdown"
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="employee-activity-table">
                <thead>
                  <tr className="admin-dash-table-header">
                    <th>S.NO</th>
                    <th>Emp.ID</th>
                    <th>Employee Name</th>
                    <th>In Time</th>
                    <th>Out Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4">
                        <Spinner animation="border" size="sm" variant="primary" />
                      </td>
                    </tr>
                  ) : employeeActivity.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No employee activity found
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((emp, idx) => {
                      const empKey = emp._id || emp.employeeId || idx;
                      const isExpanded = !!expandedPermissionRows[empKey];

                      return (
                        <React.Fragment key={empKey}>
                          <tr>
                            <td>
                              <div className="emp-activity-sno-cell">
                                <span>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</span>
                                {emp.hasPermission && (
                                  <span
                                    className={`emp-activity-perm-toggle ${isExpanded ? "active" : ""}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePermissionDropdown(empKey);
                                    }}
                                    title={isExpanded ? "Click to collapse permission details" : "Click to view permission details"}
                                  >
                                    <FaChevronDown
                                      className={`emp-activity-perm-chevron ${isExpanded ? "rotated" : ""}`}
                                    />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>{emp.empId}</td>
                            <td>
                              <span className="emp-activity-emp-name">{emp.name}</span>
                            </td>
                            <td title={emp.checkIn1 && emp.checkIn2 && emp.checkIn1 !== "-" && emp.checkIn2 !== "-" ? `1st In: ${emp.checkIn1} | Re-Check-In: ${emp.checkIn2}` : undefined}>
                              {emp.inTime || "-"}
                            </td>
                            <td title={emp.checkOut1 && emp.checkOut2 && emp.checkOut1 !== "-" && emp.checkOut2 !== "-" ? `1st Out: ${emp.checkOut1} | Final Out: ${emp.checkOut2}` : undefined}>
                              {emp.outTime || "-"}
                            </td>
                            <td>
                              <div className="admin-dash-status-wrapper">
                                <div className="admin-dash-status-row">
                                  <span className={`admin-dash-status ${getStatusClass(emp.status)}`}>
                                    {emp.status && emp.status.toLowerCase().includes("wfh") ? (
                                      <>
                                        {emp.status.replace(/-?\s*wfh/i, "").trim()}
                                        <span className="wfh-badge">WFH</span>
                                      </>
                                    ) : emp.status === "-" ? "-" : emp.status || "Unknown"}
                                  </span>

                                  {emp.status?.toLowerCase().includes("late") && emp.lateEntryReason && (
                                    <div className="late-reason-tooltip-wrapper">
                                      <FaInfoCircle className="late-reason-info-icon" />
                                      <div className="late-reason-tooltip-box">Reason: {emp.lateEntryReason}</div>
                                    </div>
                                  )}
                                </div>

                                {/* Badges / Review Conversion Buttons */}
                                {emp.halfDayConversionStatus === "Pending Review" && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenConversionModal(emp)}
                                    className="admin-dash-conversion-btn"
                                  >
                                    Review Conversion
                                  </button>
                                )}

                                {emp.halfDayConversionStatus === "Approved" && emp.policyStatus !== "Half-Day Leave Covered" && (
                                  <span className="admin-dash-converted-badge">
                                    Converted (0.5d)
                                  </span>
                                )}

                                {emp.halfDayConversionStatus === "Rejected" && (
                                  <span
                                    className="admin-dash-conversion-rejected-badge"
                                    title={emp.adminRemarks ? `Remark: ${emp.adminRemarks}` : "Rejected"}
                                  >
                                    Conversion Rejected
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Full row format for permission details displayed across all columns */}
                          {emp.hasPermission && isExpanded && (
                            <tr key={`${empKey}-expanded`} className="permission-expanded-row">
                              <td colSpan={6} className="permission-expanded-cell">
                                <div className="permission-expanded-card">
                                  <div className="permission-expanded-header">
                                    <div className="permission-expanded-item">
                                      <span className="permission-expanded-label">Permission Applied:</span>
                                      <span className="permission-expanded-val-applied">
                                        {emp.requestedFrom && emp.requestedTo && emp.requestedFrom !== "-" ? `${emp.requestedFrom} - ${emp.requestedTo}` : "-"}
                                        {emp.requestedDurationMinutes > 0 ? ` (${emp.requestedDurationMinutes} mins)` : ""}
                                      </span>
                                    </div>

                                    <div className="permission-expanded-item">
                                      <span className="permission-expanded-label">Permission Used:</span>
                                      <span
                                        className={`permission-expanded-val-used ${
                                          emp.actualDurationMinutes > 120
                                            ? "used-exceeded"
                                            : emp.actualDurationMinutes > (emp.requestedDurationMinutes || 120)
                                            ? "used-warning"
                                            : "used-regular"
                                        }`}
                                      >
                                        {emp.actualCheckout && emp.actualCheckout !== "-" && emp.actualRecheckIn && emp.actualRecheckIn !== "-"
                                          ? `${emp.actualCheckout} - ${emp.actualRecheckIn} (${emp.actualDurationMinutes} mins)`
                                          : emp.actualCheckout && emp.actualCheckout !== "-"
                                          ? `${emp.actualCheckout} - In Progress`
                                          : emp.actualDurationMinutes > 0
                                          ? `${emp.actualDurationMinutes} mins`
                                          : "Not Used Yet"}
                                      </span>
                                    </div>
                                  </div>

                                  <div
                                    className={`permission-expanded-note ${
                                      emp.actualDurationMinutes > 120 || emp.policyStatus === "Limit Exceeded" || emp.policyStatus === "Half-Day Leave Covered"
                                        ? "note-exceeded"
                                        : "note-regular"
                                    }`}
                                  >
                                    <strong>Note: </strong>
                                    {emp.actualDurationMinutes > 120 || emp.policyStatus === "Limit Exceeded" || emp.policyStatus === "Half-Day Leave Covered"
                                      ? `Employee utilized permission beyond the 2-hour daily limit (${emp.actualCheckout || "Out"} – ${emp.actualRecheckIn || "In"}). Converted to 0.5-day Half-Day Leave per policy.`
                                      : emp.actualDurationMinutes > 0
                                      ? `Employee utilized permission from ${emp.actualCheckout} to ${emp.actualRecheckIn} (${emp.actualDurationMinutes} mins), within the permitted 2-hour limit. Regular attendance maintained.`
                                      : emp.actualCheckout && emp.actualCheckout !== "-"
                                      ? `Permission currently active since ${emp.actualCheckout}. Daily allowance is limited to 2 hours.`
                                      : "Permission approved for the scheduled duration. Regular attendance applies upon timely return."}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>

              <div className="admin-dash-pagination-container">
                <Pagination
                  totalItems={employeeActivity.length}
                  pageSize={ITEMS_PER_PAGE}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />
              </div>

            </div>
          </div>

          {/* ── Project Details Section ── */}
          <div className="admin-to-do-list-card content-card mb-2 p-3">
            <div className="dash-project-header mb-2 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-3">
                <h4 className="dash-project-title m-0">Project Details</h4>
              </div>
              <button
                className="common-modal-btn btn-update"
                onClick={() => navigate("/admin/project-details")}
                style={{ padding: "5px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: "500", cursor: "pointer" }}
              >
                View All
              </button>
            </div>

            <div className="table-responsive">
              <table className="project-details-table">
                <thead>
                  <tr className="admin-dash-table-header">
                    <th>S.No</th>
                    <th>Category</th>
                    <th>Project Name</th>
                  </tr>
                </thead>
                <tbody>
                  {projectDetailsLoading ? (
                    <tr>
                      <td colSpan={3} className="text-center py-5">
                        <Spinner animation="border" size="sm" variant="primary" />
                      </td>
                    </tr>
                  ) : projectDetails.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-5 text-muted">No active projects found.</td>
                    </tr>
                  ) : (
                    projectDetails
                      .slice((projectCurrentPage - 1) * projectItemsPerPage, projectCurrentPage * projectItemsPerPage)
                      .map((proj, idx) => (
                        <tr
                          key={idx}
                          className="project-row-hover"
                          onClick={() => handleProjectClick(proj)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>{(projectCurrentPage - 1) * projectItemsPerPage + idx + 1}</td>
                          <td className="proj-cat-cell">{proj.categoryId?.name || "Uncategorized"}</td>
                          <td className="proj-name-cell">{proj.name}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {projectDetails.length > projectItemsPerPage && (
              <div className="admin-dash-pagination-container">
                <Pagination
                  totalItems={projectDetails.length}
                  pageSize={projectItemsPerPage}
                  currentPage={projectCurrentPage}
                  onPageChange={setProjectCurrentPage}
                />
              </div>
            )}
          </div>

          {/* ── To Do List ── */}
          <div className="admin-to-do-list-card content-card mb-4 p-4">
            <div className="dash-todo-header">
              <h4 className="dash-todo-title">To Do List</h4>
              <div className="dash-todo-actions">
                <Button className="btn-todo-history" onClick={() => navigate("/todo-list")}>History</Button>
                <Button className="btn-todo-create" onClick={() => setShowTodoModal(true)}>Create</Button>
              </div>
            </div>

            {todoLoading ? (
              <div className="d-flex justify-content-center align-items-center py-5">
                <Spinner animation="border" variant="primary" />
              </div>
            ) : todos.filter((t) => t.status?.toLowerCase() === "pending").length === 0 ? (
              <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center">
                <p className="text-muted mb-0">No pending tasks. Relax or create a new one!</p>
              </div>
            ) : (
              <div className="dash-todo-list-container">
                {todos
                  .filter((t) => t.status?.toLowerCase() === "pending")
                  .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                  .map((todo) => (
                    <div
                      key={todo._id}
                      className="dash-todo-card"
                      onClick={() => { setSelectedTodo(todo); setShowDetailModal(true); }}
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
            )}
          </div>
        </div>
      </div>

      {/* ── Todo Detail Modal ── */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered className="admin-todo-detail-modal">
        <Modal.Header className="border-0 pb-0 d-flex justify-content-between align-items-center">

          <h5 className="common-modal-title">{selectedTodo ? (selectedTodo.title || selectedTodo.description.split("\n")[0]) : "To Do Details"}</h5>
          <button className="common-modal-close-x" onClick={() => setShowDetailModal(false)}>✕</button>
        </Modal.Header>
        <Modal.Body className="common-modal-body">
          {selectedTodo && (
            <>
              <p className="todo-detail-text" style={{ fontSize: "13px", color: "#374151", lineHeight: "1.6" }}>
                {selectedTodo.description}
              </p>
              <div className="edit-modal-actions">
                {selectedTodo.status !== "completed" ? (
                  <>
                    <button className="common-modal-btn btn-small-cancel" onClick={() => setShowDetailModal(false)}>
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

      {/* ── Todo Confirm Complete Modal ── */}
      <Modal show={showTodoConfirmModal} onHide={() => setShowTodoConfirmModal(false)} centered backdrop="static" className="common-modal-standard">
        <Modal.Header className="border-0 pb-0">
          <Modal.Title className="common-modal-title">Confirm Action</Modal.Title>
        </Modal.Header>
        <Modal.Body className="common-modal-body">
          Are you sure you want to mark this task as complete?
          <br />
          <small className="text-muted">{selectedTodo?.description.substring(0, 80)}...</small>
        </Modal.Body>
        <Modal.Footer className="modal-footer border-0">
          <div className="edit-modal-actions w-100">
            <button className="common-modal-btn btn-small-cancel" onClick={() => setShowTodoConfirmModal(false)}>
              Cancel
            </button>
            <button className="common-modal-btn btn-update" onClick={handleConfirmComplete}>
              Yes, Complete
            </button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* ── Add / Edit Todo Modal ── */}
      {
        showTodoModal && (
          <div className="todo-modal-overlay">
            <div className="todo-modal-content edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="todo-modal-header modal-header">
                <h3 className="common-modal-title">{isEditMode ? "Update To Do List" : "To Do List"}</h3>
                <button className="common-modal-close-x" onClick={handleCloseTodoModal}>✕</button>
              </div>

              <div className="todo-modal-body common-modal-body">
                <div className="todo-form-group">
                  <label>Title</label>
                  <input type="text" placeholder="Enter title..." value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} />
                </div>
                <div className="todo-form-group">
                  <label>Work Description</label>
                  <textarea rows={4} placeholder="Enter your work..." value={todoDescription} onChange={(e) => setTodoDescription(e.target.value)} />
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
                  <div className="edit-modal-actions" style={{ marginLeft: "auto" }}>
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
        )
      }

      {/* ── Edit Request Confirmation Modal ── */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered className="admin-editrequest-confirm-action-modal">
        <Modal.Header className="border-0 d-flex justify-content-between align-items-center">
          <Modal.Title>{actionType === "approved" ? "Approve Request" : "Reject Request"}</Modal.Title>
          <button className="hrms-common-close-btn" onClick={() => setShowConfirmModal(false)} type="button">
            <img src={closeIcon} alt="close" />
          </button>
        </Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <div className="admin-editrequest-confirm-content">

              <p>
                Are you sure you want to <strong>{actionType === "approved" ? "approve" : "reject"}</strong> the edit request from:
              </p>
              <div className="admin-editrequest-request-summary">
                <p><strong>Employee:</strong> {selectedRequest.employeeId?.name || "Unknown"}</p>
                <p><strong>ID:</strong> {selectedRequest.employeeId?.empId || selectedRequest.employeeId?.empIdString || selectedRequest.empIdString || "-"}</p>
                <p><strong>Message:</strong> {selectedRequest.requestMessage}</p>
              </div>
              {actionType === "approved" ? (
                <p className="admin-editrequest-approval-note">
                  The employee will be able to edit their profile after approval.
                </p>
              ) : (
                <div className="mt-3">
                  <label className="form-label mb-1" style={{ fontWeight: "600", fontSize: "14px", color: "#374151" }}>
                    Reason for Rejection <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Enter reason for rejecting this edit request..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    style={{ resize: "vertical", fontSize: "14px" }}
                  />
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="common-modal-btn btn-small-cancel"
            onClick={() => setShowConfirmModal(false)}
            style={{ backgroundColor: "#6b7280", color: "#ffffff", border: "none" }}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`common-modal-btn ${actionType === "approved" ? "btn-update" : "btn-reject"}`}
            onClick={processAction}
            disabled={actionLoading || (actionType === "rejected" && !rejectReason.trim())}
          >
            {actionLoading ? <Spinner animation="border" size="sm" /> : `Yes, ${actionType === "approved" ? "Approve" : "Reject"}`}
          </button>
        </Modal.Footer>
      </Modal>

      {/* ── Summary Detail Modal ── */}
      <Modal show={showUpdateDetailModal} onHide={() => setShowUpdateDetailModal(false)} centered size="lg" className="project-phases-modal-custom">
        <Modal.Header className="border-0 d-flex justify-content-between align-items-center">
          <Modal.Title style={{ fontSize: "16px", fontWeight: "700", color: "#3A466D" }}>Work Summary Details</Modal.Title>
          <button className="hrms-common-close-btn" onClick={() => setShowUpdateDetailModal(false)} type="button">
            <img src={closeIcon} alt="close" />
          </button>
        </Modal.Header>
        <Modal.Body className="p-4 pt-0">
          {selectedUpdate && (
            <div className=" border rounded-3" style={{ background: "#ffffff", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
              <div className="d-flex justify-content-between align-items-start mb-4">
                <div className="d-flex align-items-center gap-3">
                  <img
                    src={selectedUpdate.employeeDetails?.photo ? `${portalInstance.defaults.baseURL}${selectedUpdate.employeeDetails.photo}` : "/avatar.png"}
                    alt="emp"
                    style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover", border: "2px solid #f1f5f9" }}
                    onError={(e) => { e.target.src = "/avatar.png"; }}
                  />
                  <div>
                    <h5 className="mb-0" style={{ color: "#3A466D", fontWeight: "700" }}>{selectedUpdate.employeeDetails?.name}</h5>
                    <p className="mb-0 text-muted" style={{ fontSize: "12px" }}>
                      {selectedUpdate.employeeDetails?.empId} • {selectedUpdate.type === "standalone" ? "Standalone Update" : "Task Update"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="row g-4">
                <div className="col-md-8">
                  <div className="mb-4">
                    <label className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: "10px", letterSpacing: "0.5px" }}>Title</label>
                    <h6 style={{ color: "#3A466D", fontWeight: "600", fontSize: "15px" }}>{selectedUpdate.title || selectedUpdate.displayTitle || selectedUpdate.taskTitle}</h6>
                  </div>
                  <div className="mb-0">
                    <label className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: "10px", letterSpacing: "0.5px" }}>Full Work Summary</label>
                    <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.7", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #f1f5f9", whiteSpace: "pre-wrap", maxHeight: "300px", overflowY: "auto" }}>
                      {selectedUpdate.phase || selectedUpdate.details || selectedUpdate.note || "No details provided"}
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-4 rounded-4" style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                    <div className="mb-4">
                      <label className="text-muted d-block mb-2" style={{ fontSize: "11px", fontWeight: "600" }}>CURRENT STATUS</label>
                      <span className={`adminTaskPage__statusBadge adminTaskPage__statusBadge--${(selectedUpdate.phaseStatus || "pending").toLowerCase()}`} style={{ fontSize: "12px", fontWeight: "600", padding: "6px 15px", borderRadius: "20px" }}>
                        {selectedUpdate.phaseStatus || "In Process"}
                      </span>
                    </div>
                    <div className="mb-0">
                      <label className="text-muted d-block mb-2" style={{ fontSize: "11px", fontWeight: "600" }}>LAST UPDATED ON</label>
                      <div className="d-flex flex-column">
                        <span style={{ fontSize: "14px", fontWeight: "700", color: "#3A466D" }}>
                          {new Date(selectedUpdate.completionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                        </span>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          {new Date(selectedUpdate.completionDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 d-flex justify-content-between align-items-center">
          <Button
            variant="outline-primary"
            className="d-flex align-items-center gap-2"
            onClick={() => { if (selectedUpdate) exportToExcel([selectedUpdate], `Work_Summary_${selectedUpdate?.employeeDetails?.name || "Detail"}`); }}
            style={{ borderRadius: "8px", fontSize: "12px", fontWeight: "600" }}
          >
            <Icon icon="solar:file-download-bold-duotone" width={18} />
            Export to Excel
          </Button>
          <Button variant="secondary" onClick={() => setShowUpdateDetailModal(false)} style={{ borderRadius: "8px", fontSize: "12px" }}>
            Close Details
          </Button>
        </Modal.Footer>
      </Modal>
      {/* ── HALF-DAY CONVERSION REVIEW MODAL ── */}
      <Modal
        show={showConversionModal}
        onHide={() => setShowConversionModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937" }}>
            Review Half-Day Leave Conversion
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {selectedConversionRecord && (
            <div>
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>Employee:</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>
                    {selectedConversionRecord.name} ({selectedConversionRecord.empId})
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>Requested Time:</span>
                  <span style={{ fontSize: "13px", color: "#374151" }}>
                    {selectedConversionRecord.requestedFrom} - {selectedConversionRecord.requestedTo} ({selectedConversionRecord.requestedDurationMinutes} mins)
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>Actual Checkout / Return:</span>
                  <span style={{ fontSize: "13px", color: "#374151" }}>
                    {selectedConversionRecord.actualCheckout} - {selectedConversionRecord.actualRecheckIn}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>Actual Absence Duration:</span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#dc2626" }}>
                    {selectedConversionRecord.actualDurationMinutes} mins (Max allowed: 120 mins)
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>Excess Absence Beyond 2h:</span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#b91c1c" }}>
                    {Math.max(0, (selectedConversionRecord.actualDurationMinutes || 0) - 120)} mins
                  </span>
                </div>
              </div>

              <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "6px", padding: "10px", marginBottom: "14px", fontSize: "12px", color: "#92400e" }}>
                <strong>Policy Rule:</strong> The employee exceeded the 2-hour daily permission limit. Approving will convert this overrun into a Half-Day Leave and deduct <strong>0.5 day</strong> from their leave balance.
              </div>

              <div className="mb-2">
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "4px", display: "block" }}>
                  Admin Remarks {conversionRemarks.trim() ? "" : "(Mandatory if rejecting)"}:
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={conversionRemarks}
                  onChange={(e) => setConversionRemarks(e.target.value)}
                  placeholder="Enter reason or review remarks..."
                  style={{ fontSize: "13px" }}
                />
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 d-flex justify-content-between">
          <button
            type="button"
            className="common-modal-btn btn-cancel"
            onClick={() => setShowConversionModal(false)}
            disabled={conversionLoading}
            style={{ padding: "6px 14px", fontSize: "13px" }}
          >
            Cancel
          </button>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={handleRejectConversion}
              disabled={conversionLoading}
              style={{ padding: "6px 14px", fontSize: "13px", borderRadius: "6px" }}
            >
              Reject Conversion
            </button>
            <button
              type="button"
              className="common-modal-btn btn-confirm-success"
              onClick={handleApproveConversion}
              disabled={conversionLoading}
              style={{ padding: "6px 16px", fontSize: "13px" }}
            >
              {conversionLoading ? "Processing..." : "Approve (0.5d Leave)"}
            </button>
          </div>
        </Modal.Footer>
      </Modal>

      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
};

export default AdminDashboard;
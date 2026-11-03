import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { portalInstance } from "../../../Services/instance";
import CustomDropdown from "../../Common/CustomDropdown";
import FilterIconImg from "../../../../public/Filter.svg?url";
import Pagination from "../../Employee/Pagination/Pagination";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../../Globel/Layout.css";
import { FileSpreadsheet, RefreshCw, Download } from "lucide-react";
import { Icon } from "@iconify/react";
import { Button } from "react-bootstrap";
import "./DailyWorkUpdatePage.css";
import "../../../Globel/Layout.css"
const PAGE_SIZE = 10;
const EMP_PAGE_SIZE = 5;

const DATE_MODE_OPTIONS = [
  { value: "All", label: "All Time" },
  { value: "Today", label: "Today" },
  { value: "Yesterday", label: "Yesterday" },
  { value: "Specific", label: "Specific Date" },
  { value: "This Week", label: "This Week" },
  { value: "This Month", label: "This Month" },
  { value: "This Year", label: "This Year" },
  { value: "Custom", label: "Custom Range" },
];

const DailyWorkUpdatePage = () => {
  // --- 1. User Session & Roles ---
  const sessionData = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("Erti-Portal");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed.user || parsed;
    } catch { return {}; }
  }, []);

  const userRole = (sessionData?.role || "employee").toLowerCase();
  const loggedInUserId = sessionData?._id || sessionData?.id;

  // --- 2. Filter State ---
  const [updates, setUpdates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Filters
  const [employeeId, setEmployeeId] = useState("");
  const [dateMode, setDateMode] = useState("Today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [category, setCategory] = useState("");
  const [project, setProject] = useState("");

  // "Applied" filters (only used for API calls)
  const [appliedFilters, setAppliedFilters] = useState({
    employeeId: "",
    category: "",
    project: "",
    dateMode: "Today",
    fromDate: "",
    toDate: ""
  });

  // Metadata
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);

  const filterRef = useRef(null);
  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);
  const todayStr = new Date().toISOString().split("T")[0];

  // --- 3. Data Fetching ---

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await portalInstance.get("/users/all-employee");
      const fetched = res.data.data || [];
      const activeEmployees = fetched.filter(
        (emp) =>
          emp &&
          emp.employmentStatus !== "relieved" &&
          emp.employmentStatus !== "relived" &&
          emp.status !== "relieved" &&
          emp.status !== "relived"
      );
      setEmployees(activeEmployees);
    } catch (error) {
      console.error("EMPLOYEE FETCH ERROR:", error);
    }
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const res = await portalInstance.get("/creat/task-meta");
      if (res.data?.success) {
        setCategories(res.data.data.categories || []);
        setProjects(res.data.data.projects || []);
      }
    } catch (err) {
      console.error("META FETCH ERROR:", err);
    }
  }, []);

  // Mobile view state
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 767.98);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 767.98);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleEmpClick = (id) => {
    setSelectedEmpId(id);
    if (isMobile) {
      setShowMobileModal(true);
    }
  };

  const fetchUpdates = useCallback(async (isInitial = false) => {
    try {
      if (!isInitial) setLoading(true);
      const params = new URLSearchParams();
      if (appliedFilters.employeeId) params.append("employeeId", appliedFilters.employeeId);
      if (appliedFilters.dateMode === "Today") params.append("today", "true");
      else if (appliedFilters.dateMode === "Yesterday") params.append("yesterday", "true");
      else if (appliedFilters.dateMode === "Specific" && appliedFilters.fromDate) {
        params.append("fromDate", appliedFilters.fromDate);
        params.append("toDate", appliedFilters.fromDate);
      }
      else if (appliedFilters.dateMode === "This Week") params.append("thisWeek", "true");
      else if (appliedFilters.dateMode === "This Month") params.append("thisMonth", "true");
      else if (appliedFilters.dateMode === "This Year") params.append("year", new Date().getFullYear());
      else if (appliedFilters.dateMode === "Custom" && appliedFilters.fromDate && appliedFilters.toDate) {
        params.append("fromDate", appliedFilters.fromDate);
        params.append("toDate", appliedFilters.toDate);
      }
      if (appliedFilters.category) params.append("category", appliedFilters.category);
      if (appliedFilters.project) params.append("project", appliedFilters.project);

      const res = await portalInstance.get(`/creat/daily-update/all?${params.toString()}`);
      setUpdates(sortUpdatesWithPhaseOrder(res.data.data || []));
    } catch (error) {
      console.error("FETCH UPDATES ERROR:", error);
      toast.error("Failed to load work updates");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  const buildFileUrl = useCallback((fileUrl) => {
    if (!fileUrl) return null;
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      return fileUrl;
    }
    const base = (portalInstance.defaults.baseURL || "").replace(/\/+$/, "");
    const path = fileUrl.replace(/^\/+/, "");
    return `${base}/${path}`;
  }, []);

  // --- 4. Effects ---
  useEffect(() => {
    fetchEmployees();
    fetchMeta();
    fetchUpdates(true);
  }, [fetchEmployees, fetchMeta, fetchUpdates]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target) && !e.target.closest(".dwu-filter-toggle-btn") && !e.target.closest(".dwu-employee-filter-icon")) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApplyFilters = () => {
    setAppliedFilters({ employeeId, category, project, dateMode, fromDate, toDate });
    setEmpListPage(1);
  };

  const handleResetFilters = () => {
    setEmployeeId("");
    setCategory("");
    setProject("");
    setDateMode("Today");
    setFromDate("");
    setToDate("");
    setAppliedFilters({ employeeId: "", category: "", project: "", dateMode: "Today", fromDate: "", toDate: "" });
    setEmpListPage(1);
    setShowFilterMenu(false);
  };

  const handleExport = () => {
    if (updates.length === 0) return toast.info("No data to export");
    try {
      const headers = ['S.No', 'Date', 'Employee', 'Category', 'Project', 'Pages', 'Type', 'Task Title', 'Phase Title', 'Work Description', 'Status', 'Working Days', 'Overall Task Days'];
      const columnWidths = [40, 90, 150, 120, 140, 140, 140, 200, 160, 350, 90, 120, 140];

      const escape = (str) => String(str).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

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
 <Worksheet ss:Name="Daily Updates">
  <Table>
   ${columnWidths.map(w => `<Column ss:Width="${w}"/>`).join('')}
   <Row ss:Height="25">
    ${headers.map(h => `<Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>`).join('')}
   </Row>
    ${updates.map((u, i) => {
        const userObj = u.updatedBy || u.userId;
        const isTaskPhase = Boolean(u.task?._id && u.task._id !== "standalone" && (u.phaseId || u.taskPhaseId || u.referenceId));
        return `
   <Row ss:AutoFitHeight="1">
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${i + 1}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(formatDate(u.updateDate))}</Data></Cell>
    <Cell ss:StyleID="CellBold"><Data ss:Type="String">${escape(userObj?.name || "Unknown")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(u.task?.category || u.category || "—")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(u.task?.project || u.project || "—")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(u.pages && u.pages.length > 0 ? u.pages.join(", ") : "—")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(formatWorkType(u.workType) || "—")}</Data></Cell>
    <Cell ss:StyleID="CellAccent"><Data ss:Type="String">${escape(isTaskPhase ? (u.task?.taskTitle || u.title || "N/A") : (u.title || u.task?.taskTitle || "N/A"))}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(isTaskPhase ? (u.title || u.phase || "—") : "—")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(u.description || u.note || u.phase || "—")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(u.status || u.phaseStatus || "Pending")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape((u.workingDays !== undefined && u.workingDays !== null && u.workingDays > 0) ? String(u.workingDays) : (u.phaseWorkingDays ? String(u.phaseWorkingDays) : "1"))}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(u.overallTaskWorkingDays !== undefined && u.overallTaskWorkingDays !== null ? String(u.overallTaskWorkingDays) : "1")}</Data></Cell>
   </Row>`;
      }).join('')}
  </Table>
 </Worksheet>
</Workbook>`;

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Work_Updates_${new Date().toISOString().split('T')[0]}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Excel Exported!");
    } catch (error) { toast.error("Export failed"); }
  };

  const getPhaseNumber = (u, allUpdates = []) => {
    if (!u) return 1;
    if (typeof u.phaseNumber === "number" && u.phaseNumber > 0) {
      return u.phaseNumber;
    }
    if (u.task && Array.isArray(u.task.phases) && u.task.phases.length > 0) {
      const pIdStr = (u.phaseId || u.taskPhaseId || u.referenceId)
        ? String(u.phaseId || u.taskPhaseId || u.referenceId)
        : null;
      const pTitleStr = (u.title || u.phase || "").trim().toLowerCase();

      const idx = u.task.phases.findIndex(p => {
        if (!p) return false;
        const currentPId = p._id ? String(p._id) : null;
        if (pIdStr && currentPId && currentPId === pIdStr) return true;
        if (pTitleStr && p.phaseTitle && p.phaseTitle.trim().toLowerCase() === pTitleStr) return true;
        return false;
      });

      if (idx !== -1) {
        return idx + 1;
      }
    }

    const titleToCheck = u.title || u.phase || "";
    const match = titleToCheck.match(/(?:^|\b)phase\s*(\d+)\b/i);
    if (match) {
      return parseInt(match[1], 10);
    }

    if (allUpdates && allUpdates.length > 0) {
      const taskIdStr = String(u.task?._id || u.taskId || (typeof u.task === "string" ? u.task : "") || "");
      const taskTitleStr = (u.task?.taskTitle || "").trim().toLowerCase();

      const taskUpdates = allUpdates.filter(it => {
        if (!it) return false;
        const itTaskId = String(it.task?._id || it.taskId || (typeof it.task === "string" ? it.task : "") || "");
        if (taskIdStr && taskIdStr !== "standalone" && itTaskId && itTaskId !== "standalone") {
          return itTaskId === taskIdStr;
        }
        const itTaskTitle = (it.task?.taskTitle || "").trim().toLowerCase();
        if (taskTitleStr && itTaskTitle) {
          return itTaskTitle === taskTitleStr;
        }
        return false;
      });

      if (taskUpdates.length > 0) {
        const uniquePhases = [];
        const chronSorted = [...taskUpdates].sort((a, b) => {
          const tA = new Date(a.updateDate || a.createdAt || 0).getTime();
          const tB = new Date(b.updateDate || b.createdAt || 0).getTime();
          if (tA !== tB) return tA - tB;
          return String(a._id || "").localeCompare(String(b._id || ""));
        });
        chronSorted.forEach(it => {
          const key = String(it.phaseId || it.taskPhaseId || it.referenceId || it.title || it.phase || "").trim().toLowerCase();
          if (key && !uniquePhases.includes(key)) {
            uniquePhases.push(key);
          }
        });
        const myKey = String(u.phaseId || u.taskPhaseId || u.referenceId || u.title || u.phase || "").trim().toLowerCase();
        const phaseIndex = uniquePhases.indexOf(myKey);
        if (phaseIndex !== -1) {
          return phaseIndex + 1;
        }
      }
    }

    return 1;
  };

  const sortUpdatesWithPhaseOrder = (list) => {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
      const taskIdA = (a.task?._id && a.task._id !== "standalone") ? String(a.task._id) : (a.taskId ? String(a.taskId) : null);
      const taskIdB = (b.task?._id && b.task._id !== "standalone") ? String(b.task._id) : (b.taskId ? String(b.taskId) : null);
      const titleA = (a.task?.taskTitle || "").trim().toLowerCase();
      const titleB = (b.task?.taskTitle || "").trim().toLowerCase();

      const isSameTask = Boolean(
        (taskIdA && taskIdB && taskIdA === taskIdB) ||
        (titleA && titleB && titleA === titleB)
      );

      // If both belong to the same task, sort in ascending phase order (Phase 1, Phase 2, Phase 3, Phase 4, Phase 5)
      if (isSameTask) {
        const numA = getPhaseNumber(a, list);
        const numB = getPhaseNumber(b, list);
        if (numA !== numB) return numA - numB;
        const timeA = new Date(a.updateDate || a.createdAt || 0).getTime();
        const timeB = new Date(b.updateDate || b.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return String(a._id || "").localeCompare(String(b._id || ""));
      }

      const formatDateStr = (d) => {
        if (!d) return "";
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return "";
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
      };

      const dateStrA = formatDateStr(a.updateDate || a.createdAt);
      const dateStrB = formatDateStr(b.updateDate || b.createdAt);
      if (dateStrA !== dateStrB) return dateStrB.localeCompare(dateStrA);

      // On same date, if both have phase numbers, sort by phase number ascending (Phase 1, Phase 2, Phase 3...)
      const numA = getPhaseNumber(a, list);
      const numB = getPhaseNumber(b, list);
      const isPhaseA = Boolean(a.phaseId || a.taskPhaseId || a.referenceId || a.task?.phases?.length);
      const isPhaseB = Boolean(b.phaseId || b.taskPhaseId || b.referenceId || b.task?.phases?.length);
      if (isPhaseA && isPhaseB && numA !== numB) {
        return numA - numB;
      }

      return getUpdateTimestamp(a) - getUpdateTimestamp(b);
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    if (typeof dateStr === "string" && dateStr.includes("T")) {
      const datePart = dateStr.split("T")[0];
      const parts = datePart.split("-");
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const getDisplayDateHeader = (emp) => {
    if (!emp) return "";
    if (appliedFilters.dateMode === "All") return "All Time";
    if (appliedFilters.dateMode === "This Month") return "This Month";
    if (appliedFilters.dateMode === "This Week") return "This Week";
    if (appliedFilters.dateMode === "This Year") return "This Year";
    if (appliedFilters.dateMode === "Specific" && appliedFilters.fromDate) {
      return formatDate(appliedFilters.fromDate);
    }
    if (appliedFilters.dateMode === "Custom" && appliedFilters.fromDate && appliedFilters.toDate) {
      return `${formatDate(appliedFilters.fromDate)} - ${formatDate(appliedFilters.toDate)}`;
    }
    return formatDate(emp.latestDate);
  };

  const formatWorkType = (wt) => {
    if (!wt) return "";
    const clean = wt.trim();
    const upper = clean.toUpperCase().replace(/\s+/g, " ");
    if (
      upper === "FE & BE" ||
      upper === "FE AND BE" ||
      upper === "BE & FE" ||
      upper === "BE AND FE" ||
      upper === "FRONT END AND BACK END" ||
      upper === "FRONT END & BACK END" ||
      upper === "FRONTEND AND BACKEND" ||
      upper === "FRONTEND & BACKEND"
    ) {
      return "Frontend and Backend";
    }
    if (upper === "BE" || upper === "BACK END" || upper === "BACKEND") return "Backend";
    if (upper === "FE" || upper === "FRONT END" || upper === "FRONTEND") return "Frontend";
    return wt;
  };

  const getUpdateTimestamp = (u) => {
    if (u?.createdAt) {
      const t = new Date(u.createdAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (u?._id && typeof u._id === "string" && u._id.length >= 8) {
      const t = parseInt(u._id.substring(0, 8), 16) * 1000;
      if (!isNaN(t) && t > 0) return t;
    }
    if (u?.updateDate) {
      const t = new Date(u.updateDate).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    return 0;
  };

  // --- 8. Admin Two-Panel Logic ---
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [empListPage, setEmpListPage] = useState(1);

  const employeeUpdateMap = useMemo(() => {
    const map = {};
    updates.forEach(u => {
      const userObj = u.updatedBy || u.userId;
      const empId = userObj?._id || userObj?.id;
      if (!empId) return;

      // Fallback: look up in employees list if photo is missing
      const empFromList = employees.find(e => (e._id || e.id) === empId);

      // Skip relieved employees (who are filtered out of the active employees list)
      if (employees.length > 0 && !empFromList) return;

      // Prioritize S3 signed URLs (starting with http/https) from empFromList or userObj
      let photoPath = "";
      if (empFromList?.photo && (empFromList.photo.startsWith("http://") || empFromList.photo.startsWith("https://"))) {
        photoPath = empFromList.photo;
      } else if (userObj?.photo && (userObj.photo.startsWith("http://") || userObj.photo.startsWith("https://"))) {
        photoPath = userObj.photo;
      } else {
        photoPath = userObj?.photo || userObj?.avatar || empFromList?.photo || empFromList?.avatar || "";
      }

      const uTime = getUpdateTimestamp(u);

      if (!map[empId]) {
        map[empId] = {
          empId,
          name: userObj?.name || empFromList?.name || "Unknown",
          employeeId: userObj?.employeeId || empFromList?.employeeId || "",
          photo: photoPath,
          designation: userObj?.designation || empFromList?.designation || userObj?.employeeId || "",
          latestDate: u.updateDate,
          firstSubmittedAt: uTime,
          updates: []
        };
      } else {
        if (new Date(u.updateDate) > new Date(map[empId].latestDate)) {
          map[empId].latestDate = u.updateDate;
          map[empId].firstSubmittedAt = uTime;
        } else if (
          new Date(u.updateDate).toDateString() === new Date(map[empId].latestDate).toDateString() &&
          uTime && (!map[empId].firstSubmittedAt || uTime < map[empId].firstSubmittedAt)
        ) {
          map[empId].firstSubmittedAt = uTime;
        }
      }
      map[empId].updates.push(u);
    });

    // Ensure each employee's updates are ordered with phases in order: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5
    Object.values(map).forEach(emp => {
      emp.updates = sortUpdatesWithPhaseOrder(emp.updates);
    });

    return map;
  }, [updates, employees]);

  const empList = useMemo(() => {
    const list = Object.values(employeeUpdateMap);
    return list.sort((a, b) => {
      const dateA = new Date(a.latestDate).setHours(0, 0, 0, 0);
      const dateB = new Date(b.latestDate).setHours(0, 0, 0, 0);
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      return (a.firstSubmittedAt || 0) - (b.firstSubmittedAt || 0);
    });
  }, [employeeUpdateMap]);
  const paginatedEmpList = empList.slice((empListPage - 1) * EMP_PAGE_SIZE, empListPage * EMP_PAGE_SIZE);

  useEffect(() => {
    if (empList.length > 0 && (!selectedEmpId || !empList.some(e => e.empId === selectedEmpId))) {
      setSelectedEmpId(empList[0].empId);
    }
  }, [empList, selectedEmpId]);

  useEffect(() => {
    setEmpListPage(1);
  }, [empList.length]);

  const selectedEmpData = selectedEmpId ? employeeUpdateMap[selectedEmpId] : null;

  // --- 9. Modal for Mobile Details ---
  const MobileDetailsModal = () => {
    if (!showMobileModal || !selectedEmpData) return null;
    return (
      <div className="dwu-mobile-modal-overlay animate-in" onClick={() => setShowMobileModal(false)}>
        <div className="dwu-mobile-modal-content" onClick={e => e.stopPropagation()}>
          <div className="dwu-mobile-modal-header">
            <div className="dwu-mobile-modal-emp-info">
              <img
                src={selectedEmpData.photo ? buildFileUrl(selectedEmpData.photo) : "/avatar.png"}
                alt=""
                className="dwu-mobile-avatar"
                onError={(e) => { e.target.src = "/avatar.png"; }}
              />
              <div>
                <h6 className="m-0">{selectedEmpData.name}</h6>
                <small>{getDisplayDateHeader(selectedEmpData)}</small>
              </div>
            </div>
            <button className="dwu-mobile-modal-close" onClick={() => setShowMobileModal(false)}>✕</button>
          </div>
          <div className="dwu-mobile-modal-body">
            {selectedEmpData.updates.map((u, idx) => {
              const isTaskPhase = Boolean(u.task?._id && u.task._id !== "standalone" && (u.phaseId || u.taskPhaseId || u.referenceId));
              return (
              <div key={u._id} className="dwu-work-card mb-3">
                <div className="dwu-work-card__header">
                  <div className="dwu-work-card__field"><span className="dwu-work-card__label">S.NO</span><span className="dwu-work-card__value">{idx + 1}</span></div>
                  <div className="dwu-work-card__field"><span className="dwu-work-card__label">Date</span><span className="dwu-work-card__value" style={{ color: "#3A466D", fontWeight: 600 }}>{formatDate(u.updateDate || u.createdAt)}</span></div>
                  <div className="dwu-work-card__field"><span className="dwu-work-card__label">Category</span><span className="dwu-work-card__value">{(u.task?.category || u.category || "—").toUpperCase()}</span></div>
                  <div className="dwu-work-card__field"><span className="dwu-work-card__label">Project</span><span className="dwu-work-card__value">{u.task?.project ? (u.task.project.charAt(0).toUpperCase() + u.task.project.slice(1).toLowerCase()) : (u.project ? (u.project.charAt(0).toUpperCase() + u.project.slice(1).toLowerCase()) : "—")}</span></div>
                  {u.workType && (
                    <div className="dwu-work-card__field"><span className="dwu-work-card__label">Type</span><span className="dwu-work-card__value" style={{ color: "#5977f8", fontWeight: 600 }}>{formatWorkType(u.workType)}</span></div>
                  )}
                  <div className="dwu-work-card__field"><span className="dwu-work-card__label">Working Days</span><span className="dwu-work-card__value" style={{ color: "#2563eb", fontWeight: 600 }}>{(u.workingDays !== undefined && u.workingDays !== null && u.workingDays > 0) ? `${u.workingDays} ${u.workingDays === 1 ? 'day' : 'days'}` : (u.phaseWorkingDays !== undefined && u.phaseWorkingDays !== null && u.phaseWorkingDays > 0 ? `${u.phaseWorkingDays} ${u.phaseWorkingDays === 1 ? 'day' : 'days'}` : "1 day")}</span></div>
                  {isTaskPhase && u.overallTaskWorkingDays !== undefined && u.overallTaskWorkingDays !== null && (
                    <div className="dwu-work-card__field"><span className="dwu-work-card__label">Overall Days</span><span className="dwu-work-card__value" style={{ color: "#059669", fontWeight: 600 }}>{`${u.overallTaskWorkingDays} ${u.overallTaskWorkingDays === 1 ? 'day' : 'days'}`}</span></div>
                  )}
                  {/* Status hidden here on mobile as requested */}
                </div>
                <div className="dwu-work-card__section">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div style={{ flex: 1 }}>
                      <span className="dwu-work-card__section-label">Task Title</span>
                      <div className="d-flex align-items-center flex-wrap gap-2">
                        <p className="dwu-work-card__text mb-0">{isTaskPhase ? (u.task?.taskTitle || u.title || "N/A") : (u.title || u.task?.taskTitle || "N/A")}</p>
                        {isTaskPhase && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              fontSize: "10px",
                              fontWeight: "600",
                              color: "#5977f8",
                              background: "#eef2ff",
                              border: "1px solid #c7d2fe",
                              borderRadius: "4px",
                              padding: "1px 6px",
                              letterSpacing: "0.2px",
                              whiteSpace: "nowrap",
                              lineHeight: "14px"
                            }}
                            title="This update originates from a Task Phase"
                          >
                            Task Phase
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`dwu-admin__statusBadge dwu-admin__statusBadge--${(u.status || u.phaseStatus || "pending").toLowerCase()}`} style={{ marginTop: "4px" }}>
                      {u.status || u.phaseStatus || "Pending"}
                    </span>
                  </div>
                  {isTaskPhase && u.title && (
                    <div className="mt-2">
                      <span className="dwu-work-card__section-label">Phase {getPhaseNumber(u, selectedEmpData?.updates || updates)}</span>
                      <p className="dwu-work-card__text mb-0" style={{ fontWeight: 600, color: "#4f46e5" }}>{u.title}</p>
                    </div>
                  )}
                </div>
                {((u.pages && u.pages.length > 0) || (u.task?.pages && u.task.pages.length > 0)) && (
                  <div className="dwu-work-card__section">
                    <span className="dwu-work-card__section-label">Pages</span>
                    <p className="dwu-work-card__text" style={{ color: "#2563eb" }}>
                      {Array.isArray(u.pages && u.pages.length > 0 ? u.pages : u.task?.pages)
                        ? (u.pages && u.pages.length > 0 ? u.pages : u.task?.pages).join(", ")
                        : (u.pages || u.task?.pages)}
                    </p>
                  </div>
                )}
                <div className="dwu-work-card__section">
                  <span className="dwu-work-card__section-label">Work Description</span>
                  <p className="dwu-work-card__text">{u.description || u.note || u.phase || "—"}</p>
                  <div className="d-flex justify-content-end align-items-center mt-2 pt-2" style={{ borderTop: "1px dashed #e2e8f0" }}>
                    <div className="dwu-card-date-badge" title="Created Date" style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <Icon icon="solar:calendar-linear" width="14" height="14" style={{ color: "#94a3b8" }} />
                      <span>Date: <strong style={{ color: "#3A466D", fontWeight: 600 }}>{formatDate(u.updateDate || u.createdAt)}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Sidebar />
      <div className="common-page-container ">
        <div className="dwu-admin-root">
          <header className="dwu-admin__header">
            <div className="d-flex justify-content-between align-items-center flex-wrap " style={{ gap: "12px" }}>
              <div>
                <h4 className="dwu-admin__title">Work Update Report</h4>
              </div>
              <div className="d-flex align-items-center gap-3 gap-sm-4">
                {/* 1. Filter Button */}
                <div
                  className={`dwu-employee-filter-icon ${showFilterMenu ? "active" : ""}`}
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  title="Toggle Filters"
                >
                  <img src={FilterIconImg} alt="filter" />
                </div>

                {/* 2. Excel Button */}
                <Button
                  variant="outline-primary"
                  className="excel-export-btn"
                  onClick={handleExport}
                >
                  Download Excel
                </Button>
              </div>
            </div>
          </header>

          {showFilterMenu && (
            <div className="dwu-filter-row animate-slide-down mb-4" ref={filterRef} style={{ padding: '20px', borderRadius: '12px', background: '#f6f6f6', marginTop: '20px' }}>
              <div className="row g-3 align-items-end">
                {/* 1. Timeframe */}
                <div className="col-12 col-md-4 col-lg">
                  <label className="dwu-filter-label">Date Range</label>
                  <CustomDropdown options={DATE_MODE_OPTIONS} value={dateMode} onChange={setDateMode} />
                </div>

                {/* 2. Custom/Specific Dates */}
                {(dateMode === "Custom" || dateMode === "Specific") && (
                  <>
                    <div className="col-12 col-md-4 col-lg">
                      <label className="dwu-filter-label">{dateMode === "Specific" ? "Date" : "From"}</label>
                      <div className="dwu-custom-date-picker-wrap">
                        <input
                          ref={fromDateRef}
                          type="date"
                          className="form-control dwu-date-input"
                          max={todayStr}
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                        />
                        <img
                          src="/Calander.svg"
                          alt="calendar"
                          className="dwu-custom-calendar-icon"
                          onClick={() => fromDateRef.current?.showPicker ? fromDateRef.current.showPicker() : fromDateRef.current?.focus()}
                        />
                      </div>
                    </div>
                    {dateMode === "Custom" && (
                      <div className="col-12 col-md-4 col-lg">
                        <label className="dwu-filter-label">To</label>
                        <div className="dwu-custom-date-picker-wrap">
                          <input
                            ref={toDateRef}
                            type="date"
                            className="form-control dwu-date-input"
                            min={fromDate}
                            max={todayStr}
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                          />
                          <img
                            src="/Calander.svg"
                            alt="calendar"
                            className="dwu-custom-calendar-icon"
                            onClick={() => toDateRef.current?.showPicker ? toDateRef.current.showPicker() : toDateRef.current?.focus()}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 3. Employee */}
                <div className="col-12 col-md-4 col-lg">
                  <label className="dwu-filter-label">Employee</label>
                  <CustomDropdown options={[{ value: "", label: "All Employees" }, ...employees.map(e => ({ value: e._id || e.id, label: e.name }))]} value={employeeId} onChange={setEmployeeId} />
                </div>

                {/* 4. Category */}
                <div className="col-12 col-md-4 col-lg">
                  <label className="dwu-filter-label">Category</label>
                  <CustomDropdown options={[{ value: "", label: "All" }, ...categories.filter(c => c && c.toLowerCase() !== "add").map(c => ({ value: c, label: (c || "").toUpperCase() }))]} value={category} onChange={(v) => { setCategory(v); setProject(""); }} />
                </div>

                {/* 5. Project */}
                <div className="col-12 col-md-4 col-lg">
                  <label className="dwu-filter-label">Project</label>
                  <CustomDropdown options={[{ value: "", label: "All" }, ...projects.filter(p => p && p.toLowerCase() !== "add").map(p => ({ value: p, label: p ? (p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()) : p }))]} value={project} onChange={setProject} />
                </div>

                {/* 6. Actions */}
                <div className="col-12 d-flex justify-content-end mt-2">
                  <div className="d-flex mt-2" style={{ gap: "12px" }}>
                    <button className="hrms-common-btn-cancel " onClick={handleResetFilters}>Cancel</button>
                    <button className="hrms-common-btn-primary" onClick={handleApplyFilters}>Search</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <section className="dwu-admin-panels mt-1">
            <div className="dwu-emp-panel">
              <div className="dwu-emp-panel__header">
                <div className="dwu-emp-panel__headerCell" style={{ width: "50px" }}>S.No</div>
                <div className="dwu-emp-panel__headerCell" style={{ flex: 1 }}>Employee Name</div>
                <div className="dwu-emp-panel__headerCell" style={{ width: "80px", textAlign: "center" }}>Date</div>
              </div>
              <div className="dwu-emp-panel__list">
                {loading ? (
                  <div className="dwu-admin__empty"><RefreshCw className="animate-spin mb-2" /><p>Loading...</p></div>
                ) : paginatedEmpList.length === 0 ? (
                  <div className="dwu-admin__empty" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "200px" }}><p>No data found.</p></div>
                ) : (
                  paginatedEmpList.map((emp, idx) => (
                    <div key={emp.empId} className={`dwu-emp-panel__row ${selectedEmpId === emp.empId ? "dwu-emp-panel__row--active" : ""}`} onClick={() => handleEmpClick(emp.empId)}>
                      <div className="dwu-emp-panel__cell" style={{ width: "50px" }}><span className="dwu-emp-sno">{String((empListPage - 1) * EMP_PAGE_SIZE + idx + 1).padStart(2, '0')}</span></div>
                      <div className="dwu-emp-panel__cell" style={{ flex: 1 }}>
                        <div className="dwu-emp-info">
                          <img
                            src={emp.photo ? buildFileUrl(emp.photo) : "/avatar.png"}
                            alt=""
                            className="dwu-emp-avatar"
                            onError={(e) => { e.target.src = "/avatar.png"; }}
                          />
                          <div className="dwu-emp-name-block"><span className="dwu-emp-name">{emp.name}</span><span className="dwu-emp-desg">{emp.designation}</span></div>
                        </div>
                      </div>
                      <div className="dwu-emp-panel__cell" style={{ width: "80px", textAlign: "center" }}>
                        <span className="dwu-emp-date">{getDisplayDateHeader(emp)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {empList.length > EMP_PAGE_SIZE && (
                <Pagination totalItems={empList.length} pageSize={EMP_PAGE_SIZE} currentPage={empListPage} onPageChange={setEmpListPage} maxPagesInGroup={5} />
              )}
            </div>

            {!isMobile && (
              <div className="dwu-detail-panel">
                <div className="dwu-detail-panel__header">
                  <span className="dwu-detail-panel__title">
                    {selectedEmpData ? `${selectedEmpData.name} Working Status` : "Working Status"}
                  </span>
                  {selectedEmpData && (
                    <span className="dwu-detail-panel__date">
                      {getDisplayDateHeader(selectedEmpData)}
                    </span>
                  )}
                </div>
                {selectedEmpData ? (
                  <div className="dwu-detail-panel__body">
                    {selectedEmpData.updates.map((u, idx) => {
                      const isTaskPhase = Boolean(u.task?._id && u.task._id !== "standalone" && (u.phaseId || u.taskPhaseId || u.referenceId));
                      return (
                      <div key={u._id} className="dwu-work-card">
                        <div className="dwu-work-card__header">
                          <div className="dwu-work-card__field"><span className="dwu-work-card__label">S.NO</span><span className="dwu-work-card__value">{idx + 1}</span></div>
                          <div className="dwu-work-card__field"><span className="dwu-work-card__label">Date</span><span className="dwu-work-card__value" style={{ color: "#3A466D", fontWeight: 600 }}>{formatDate(u.updateDate || u.createdAt)}</span></div>
                          <div className="dwu-work-card__field"><span className="dwu-work-card__label">Category</span><span className="dwu-work-card__value">{(u.task?.category || u.category || "—").toUpperCase()}</span></div>
                          <div className="dwu-work-card__field"><span className="dwu-work-card__label">Project</span><span className="dwu-work-card__value">{u.task?.project ? (u.task.project.charAt(0).toUpperCase() + u.task.project.slice(1).toLowerCase()) : (u.project ? (u.project.charAt(0).toUpperCase() + u.project.slice(1).toLowerCase()) : "—")}</span></div>
                          {u.workType && (
                            <div className="dwu-work-card__field"><span className="dwu-work-card__label">Type</span><span className="dwu-work-card__value" style={{ color: "#5977f8", fontWeight: 600 }}>{formatWorkType(u.workType)}</span></div>
                          )}
                          <div className="dwu-work-card__field"><span className="dwu-work-card__label">Status</span><span className={`dwu-admin__statusBadge dwu-admin__statusBadge--${(u.status || u.phaseStatus || "pending").toLowerCase()}`}>{u.status || u.phaseStatus || "Pending"}</span></div>
                          <div className="dwu-work-card__field"><span className="dwu-work-card__label">Working Days</span><span className="dwu-work-card__value" style={{ color: "#2563eb", fontWeight: 600 }}>{(u.workingDays !== undefined && u.workingDays !== null && u.workingDays > 0) ? `${u.workingDays} ${u.workingDays === 1 ? 'day' : 'days'}` : (u.phaseWorkingDays !== undefined && u.phaseWorkingDays !== null && u.phaseWorkingDays > 0 ? `${u.phaseWorkingDays} ${u.phaseWorkingDays === 1 ? 'day' : 'days'}` : "1 day")}</span></div>
                          {isTaskPhase && u.overallTaskWorkingDays !== undefined && u.overallTaskWorkingDays !== null && (
                            <div className="dwu-work-card__field"><span className="dwu-work-card__label">Overall Days</span><span className="dwu-work-card__value" style={{ color: "#059669", fontWeight: 600 }}>{`${u.overallTaskWorkingDays} ${u.overallTaskWorkingDays === 1 ? 'day' : 'days'}`}</span></div>
                          )}
                        </div>
                        <div className="dwu-work-card__section">
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div>
                              <span className="dwu-work-card__section-label">Task Title</span>
                              <div className="d-flex align-items-center flex-wrap gap-2">
                                <p className="dwu-work-card__text mb-0">{isTaskPhase ? (u.task?.taskTitle || u.title || "N/A") : (u.title || u.task?.taskTitle || "N/A")}</p>
                                {isTaskPhase && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      fontSize: "10px",
                                      fontWeight: "600",
                                      color: "#5977f8",
                                      background: "#eef2ff",
                                      border: "1px solid #c7d2fe",
                                      borderRadius: "4px",
                                      padding: "1px 6px",
                                      letterSpacing: "0.2px",
                                      whiteSpace: "nowrap",
                                      lineHeight: "14px"
                                    }}
                                    title="This update originates from a Task Phase"
                                  >
                                    Task Phase
                                  </span>
                                )}
                              </div>
                            </div>
                            {isTaskPhase && u.title && (
                              <div>
                                <span className="dwu-work-card__section-label">Phase {getPhaseNumber(u, selectedEmpData?.updates || updates)}</span>
                                <p className="dwu-work-card__text mb-0" style={{ fontWeight: 600, color: "#4f46e5" }}>{u.title}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        {((u.pages && u.pages.length > 0) || (u.task?.pages && u.task.pages.length > 0)) && (
                          <div className="dwu-work-card__section">
                            <span className="dwu-work-card__section-label">Pages</span>
                            <p className="dwu-work-card__text" style={{ color: "#2563eb" }}>
                              {Array.isArray(u.pages && u.pages.length > 0 ? u.pages : u.task?.pages)
                                ? (u.pages && u.pages.length > 0 ? u.pages : u.task?.pages).join(", ")
                                : (u.pages || u.task?.pages)}
                            </p>
                          </div>
                        )}
                        <div className="dwu-work-card__section">
                          <span className="dwu-work-card__section-label">Work Description</span>
                          <p className="dwu-work-card__text">{u.description || u.note || u.phase || "—"}</p>
                          <div className="d-flex justify-content-end align-items-center mt-2 pt-2" style={{ borderTop: "1px dashed #e2e8f0" }}>
                            <div className="dwu-card-date-badge" title="Created Date" style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <Icon icon="solar:calendar-linear" width="14" height="14" style={{ color: "#94a3b8" }} />
                              <span>Date: <strong style={{ color: "#3A466D", fontWeight: 600 }}>{formatDate(u.updateDate || u.createdAt)}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="dwu-admin__empty" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100% - 60px)", minHeight: "200px" }}><p>Select an employee to view updates.</p></div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      <MobileDetailsModal />
      <ToastContainer />
    </>
  );
};

export default DailyWorkUpdatePage;

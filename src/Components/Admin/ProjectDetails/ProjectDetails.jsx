import React, { useEffect, useState, useRef } from "react";
import { portalInstance } from "../../../Services/instance";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { Button, Spinner, Modal } from "react-bootstrap";
import { FaChevronDown, FaArrowLeft } from "react-icons/fa";
import { Icon } from "@iconify/react";
import Pagination from "../../Employee/Pagination/Pagination";
import CustomDropdown from "../../Common/CustomDropdown";
import "../AdminDashboard/DashBoard.css";
import "./ProjectDetails.css";
import "../../../Globel/Layout.css";

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

const DATE_RANGE_OPTIONS = [
  { value: "All", label: "All Time" },
  { value: "Today", label: "Today" },
  { value: "This Week", label: "This Week" },
  { value: "This Month", label: "This Month" },
  { value: "Custom", label: "Custom Date Range" },
];

const STATUS_OPTIONS = [
  { value: "All", label: "All Statuses" },
  { value: "Completed", label: "Completed" },
  { value: "In Progress", label: "In Progress" },
  { value: "Pending", label: "Pending" },
  { value: "Blocked", label: "Blocked" },
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

const groupTasksWithHistory = (items, holidaysList = [], leavesByEmp = {}) => {
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
    const empId = latest.employeeDetails?._id || latest.userId?._id || latest.userId || "";
    const empLeaves = (leavesByEmp && leavesByEmp[String(empId)]) || [];
    const calculatedDays = calculateWorkingDaysFromHistory(sorted, latestStatus, holidaysList, empLeaves);

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

const calculateDistinctWorkingDays = (items) => {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const distinctDates = new Set();
  items.forEach((item) => {
    const records = (Array.isArray(item?.history) && item.history.length > 0)
      ? item.history
      : (item ? [item] : []);
    records.forEach((h) => {
      const rawStatus = (h?.status || h?.phaseStatus || item?.latestStatus || item?.status || "").toLowerCase().replace(/[-_\s]/g, "");
      if (rawStatus !== "hold" && rawStatus !== "onhold") {
        const dVal = h?.completionDate || h?.date || h?.updateDate || h?.createdAt || item?.latestDate || item?.completionDate || item?.date;
        const key = getLocalDateString(dVal);
        if (key) {
          distinctDates.add(key);
        }
      }
    });
  });

  return distinctDates.size;
};

const ProjectDetails = () => {
  // ── States ────────────────────────────────────────────────────────
  const [projectList, setProjectList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // ── Filter States ────────────────────────────────────────────────
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDateRange, setFilterDateRange] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Applied filter values (applied on clicking "Search")
  const [appliedFilters, setAppliedFilters] = useState({
    category: "All",
    status: "All",
    dateRange: "All",
    fromDate: "",
    toDate: "",
  });

  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);

  // ── Modal & Drill-down States ────────────────────────────────────
  const [selectedProjectInfo, setSelectedProjectInfo] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectUpdates, setProjectUpdates] = useState([]);
  const [projectHolidays, setProjectHolidays] = useState([]);
  const [projectLeaves, setProjectLeaves] = useState({});
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [projSelectedEmpId, setProjSelectedEmpId] = useState(null);
  const [projExpandedCards, setProjExpandedCards] = useState({});
  const [selectedEmpUpdates, setSelectedEmpUpdates] = useState(null);
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  const [showUpdateDetailModal, setShowUpdateDetailModal] = useState(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(window.innerWidth <= 1024);
  const [projTaskStatusFilter, setProjTaskStatusFilter] = useState("all");

  const handleBackFromUpdateDetail = () => {
    setShowUpdateDetailModal(false);
    setSelectedUpdate(null);
  };

  const handleCancelUpdateDetail = () => {
    setShowUpdateDetailModal(false);
    setSelectedUpdate(null);
    setShowProjectModal(false);
    setSelectedEmpUpdates(null);
    setProjSelectedEmpId(null);
    setProjExpandedCards({});
  };

  // ── Pagination States ────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const handleResize = () => {
      setIsMobileOrTablet(window.innerWidth <= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Fetch Projects ───────────────────────────────────────────────
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await portalInstance.get("/creat/task-meta");
      if (res.data?.success && res.data?.data?.fullProjects) {
        const rawProjects = res.data.data.fullProjects || [];
        const dedupedMap = new Map();
        rawProjects.forEach((p) => {
          const catName = (p.categoryId?.name || "").trim().toLowerCase();
          const projName = (p.name || "").trim().toLowerCase();
          const key = `${catName}___${projName}`;
          if (!dedupedMap.has(key)) {
            dedupedMap.set(key, p);
          } else {
            const existing = dedupedMap.get(key);
            if (p.name && /[A-Z]/.test(p.name) && !/[A-Z]/.test(existing.name)) {
              existing.name = p.name;
            }
          }
        });
        setProjectList(Array.from(dedupedMap.values()));
      }
    } catch (err) {
      console.error("❌ Failed to fetch project list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // ── Handle Filter Search & Reset ─────────────────────────────────
  const handleApplyFilters = () => {
    setAppliedFilters({
      category: filterCategory,
      status: filterStatus,
      dateRange: filterDateRange,
      fromDate,
      toDate,
    });
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilterCategory("All");
    setFilterStatus("All");
    setFilterDateRange("All");
    setFromDate("");
    setToDate("");
    setSearchTerm("");
    setAppliedFilters({
      category: "All",
      status: "All",
      dateRange: "All",
      fromDate: "",
      toDate: "",
    });
    setCurrentPage(1);
  };

  // ── Handle Project Click / Open Modal ────────────────────────────
  const handleProjectClick = async (proj) => {
    try {
      const projectName = proj.name;
      const categoryName = proj.categoryId?.name || "";

      setSelectedProjectInfo(`${categoryName} - ${projectName}`);
      setProjectUpdates([]);
      setShowProjectModal(true);
      setUpdatesLoading(true);
      setProjSelectedEmpId(null);
      setProjExpandedCards({});
      setProjTaskStatusFilter("all");

      const params = { project: projectName, category: categoryName };
      if (appliedFilters.employee && appliedFilters.employee !== "All") {
        params.empId = appliedFilters.employee;
      }

      const res = await portalInstance.get("/creat/daily-update/standalone-updates", { params });

      if (res.data?.success) {
        setProjectUpdates(res.data.data || []);
        setProjectHolidays(res.data.holidays || []);
        setProjectLeaves(res.data.leavesByEmp || {});
      }
    } catch (err) {
      console.error("❌ Fetch project updates error:", err);
    } finally {
      setUpdatesLoading(false);
    }
  };

  // ── Export to Excel ──────────────────────────────────────────────
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
   <Interior ss:Color="#4F46E5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
   </Borders>
  </Style>
  <Style ss:ID="Data">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Project Updates">
  <Table>
   ${colWidths.map((w) => `<Column ss:Width="${w}"/>`).join("\n   ")}
   <Row ss:Height="25">
    ${headers.map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>`).join("")}
   </Row>`;

    data.forEach((u, i) => {
      const name = (u.employeeDetails?.name || "N/A").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const empId = (u.employeeDetails?.empId || "N/A").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const title = (u.displayTitle || u.task?.taskTitle || u.standaloneTitle || "Work Summary").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const date = u.completionDate ? new Date(u.completionDate).toLocaleDateString("en-GB") : "—";
      const status = (u.phaseStatus || "Pending").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const desc = (u.description || u.phase || u.details || u.note || "No details provided").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      xml += `
   <Row ss:Height="30">
    <Cell ss:StyleID="Data"><Data ss:Type="Number">${i + 1}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${name}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${empId}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${title}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${date}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${status}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${desc}</Data></Cell>
   </Row>`;
    });

    xml += `
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename || "Project_Details_Export"}.xls`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // ── Dropdown Options ─────────────────────────────────────────────
  const categoryOptions = [
    { value: "All", label: "All Categories" },
    ...Array.from(new Set(projectList.map((p) => p.categoryId?.name).filter(Boolean))).map((cat) => ({
      value: cat,
      label: cat,
    })),
  ];

  const employeeOptions = [
    { value: "All", label: "All Employees" },
    ...employeesList.map((emp) => ({
      value: emp.empId || emp._id,
      label: `${emp.name || emp.employeeName} (${emp.empId || "—"})`,
    })),
  ];

  // ── Filtered Projects ────────────────────────────────────────────
  const filteredProjects = projectList.filter((proj) => {
    const catName = proj.categoryId?.name || "Uncategorized";
    const matchesCategory =
      appliedFilters.category === "All" || catName.toLowerCase() === appliedFilters.category.toLowerCase();
    const matchesSearch =
      proj.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      catName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const paginatedProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <Sidebar />
      <div className="common-page-container">
        <div className="project-details-container">
          {/* Header */}
          <div className="project-details-page-header">
            <div>
              <p className="project-details-page-subtitle">
                Overview of all company projects and employee working status updates
              </p>
            </div>
            <div className="project-details-stats-badge">
              Total Projects: <strong>{filteredProjects.length}</strong>
            </div>
          </div>

          {/* Top Search & Filter Toggle Control */}
          <div className="project-details-top-controls">
            <div className="project-details-search-box">
              <Icon icon="solar:magnifer-linear" width="18" color="#94a3b8" />
              <input
                type="text"
                placeholder="Search by project name or category..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchTerm && (
                <Icon
                  icon="solar:close-circle-bold"
                  width="16"
                  color="#94a3b8"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSearchTerm("")}
                />
              )}
            </div>

            <div className="project-details-right-actions">
              <button
                type="button"
                className={`dwu-employee-filter-icon ${showFilterMenu ? "active" : ""}`}
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                title="Toggle Filters"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  border: showFilterMenu ? "1px solid #5977f8" : "1px solid #cbd5e1",
                  background: showFilterMenu ? "#eff6ff" : "#ffffff",
                  transition: "all 0.2s ease",
                  flexShrink: 0,
                }}
              >
                <img src="/Filter.svg" alt="filter" style={{ width: "20px", height: "20px" }} />
              </button>
            </div>
          </div>

          {/* Expandable Filter Panel */}
          {showFilterMenu && (
            <div className="project-details-filter-panel">
              <div className="project-details-filter-grid">
                {/* 1. Category */}
                <div className="project-filter-field">
                  <label className="project-filter-label">Category</label>
                  <CustomDropdown
                    options={categoryOptions}
                    value={filterCategory}
                    onChange={setFilterCategory}
                    placeholder="All Categories"
                    style={{ height: "38px" }}
                  />
                </div>

                {/* 2. Status */}
                <div className="project-filter-field">
                  <label className="project-filter-label">Status</label>
                  <CustomDropdown
                    options={STATUS_OPTIONS}
                    value={filterStatus}
                    onChange={setFilterStatus}
                    placeholder="All Statuses"
                    style={{ height: "38px" }}
                  />
                </div>

                {/* 3. Date Range */}
                <div className="project-filter-field">
                  <label className="project-filter-label">Date Range</label>
                  <CustomDropdown
                    options={DATE_RANGE_OPTIONS}
                    value={filterDateRange}
                    onChange={setFilterDateRange}
                    placeholder="All Time"
                    style={{ height: "38px" }}
                  />
                </div>

                {/* Custom Dates */}
                {filterDateRange === "Custom" && (
                  <>
                    <div className="project-filter-field">
                      <label className="project-filter-label">From Date</label>
                      <div className="project-filter-date-wrap">
                        <input
                          ref={fromDateRef}
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                        />
                        <img
                          src="/Calander.svg"
                          alt="calendar"
                          className="project-filter-calendar-icon"
                          onClick={() => (fromDateRef.current?.showPicker ? fromDateRef.current.showPicker() : fromDateRef.current?.focus())}
                        />
                      </div>
                    </div>
                    <div className="project-filter-field">
                      <label className="project-filter-label">To Date</label>
                      <div className="project-filter-date-wrap">
                        <input
                          ref={toDateRef}
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                        />
                        <img
                          src="/Calander.svg"
                          alt="calendar"
                          className="project-filter-calendar-icon"
                          onClick={() => (toDateRef.current?.showPicker ? toDateRef.current.showPicker() : toDateRef.current?.focus())}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="project-filter-actions">
                <button
                  type="button"
                  className="common-modal-btn btn-small-cancel"
                  onClick={handleResetFilters}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="common-modal-btn btn-update"
                  onClick={handleApplyFilters}
                >
                  Search
                </button>
              </div>
            </div>
          )}

          {/* Projects Table Card */}
          <div className="admin-to-do-list-card content-card p-3 mb-4">
            <div className="table-responsive">
              <table className="project-details-table">
                <thead>
                  <tr className="admin-dash-table-header">
                    <th style={{ width: "80px" }}>S.No</th>
                    <th style={{ width: "220px" }}>Category</th>
                    <th>Project Name</th>
                    <th style={{ width: "160px" }}>Project Status</th>
                    <th style={{ width: "160px", textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-5">
                        <Spinner animation="border" size="sm" variant="primary" />
                        <span className="ms-2 text-muted" style={{ fontSize: "13px" }}>Loading projects...</span>
                      </td>
                    </tr>
                  ) : paginatedProjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-5 text-muted">
                        No projects found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedProjects.map((proj, idx) => (
                      <tr
                        key={proj._id || idx}
                        className="project-row-hover"
                        style={{ cursor: "pointer" }}
                        onClick={() => handleProjectClick(proj)}
                      >
                        <td>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                        <td className="proj-cat-cell">
                          <span className="project-category-tag">
                            {proj.categoryId?.name || "Uncategorized"}
                          </span>
                        </td>
                        <td className="proj-name-cell">
                          <span className="project-name-text">{proj.name}</span>
                        </td>
                        <td className="proj-status-cell">
                          <span className={`project-status-tag ${proj.status ? proj.status.toLowerCase().replace(/\s+/g, "-") : "active"}`}>
                            {proj.status || "Active"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="common-modal-btn btn-update"
                            style={{ minWidth: "110px", padding: "6px 14px", fontSize: "12px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProjectClick(proj);
                            }}
                          >
                            View Updates
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredProjects.length > itemsPerPage && (
              <div className="admin-dash-pagination-container">
                <Pagination
                  totalItems={filteredProjects.length}
                  pageSize={itemsPerPage}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PROJECT DETAILS 2-PANEL MODAL ── */}
      <Modal
        show={showProjectModal && !showUpdateDetailModal}
        onHide={() => {
          setShowProjectModal(false);
          setProjSelectedEmpId(null);
          setProjExpandedCards({});
        }}
        centered
        size="xl"
        className="project-phases-modal-custom project-phases-modal-custom-admin"
      >
        <Modal.Header className="project-details-modal-header border-0 pb-0 d-flex flex-column align-items-stretch">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h4 className="common-modal-title m-0">Project Details</h4>
            <button
              type="button"
              className="common-modal-close-x"
              onClick={() => {
                setShowProjectModal(false);
                setProjSelectedEmpId(null);
                setProjExpandedCards({});
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Subheader: Category/Project on Left, Export Excel on Right */}
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
              <p className="mt-3 text-muted" style={{ fontSize: "13px" }}>
                Analyzing project data...
              </p>
            </div>
          ) : projectUpdates.length === 0 ? (
            <div className="project-details-no-work-container">
              <h5 className="project-details-no-work-title">No Work Recorded</h5>
              <p className="text-muted small">
                No specific work summaries have been logged for this project yet.
              </p>
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

            Object.values(empMap).forEach((emp) => {
              const grouped = groupTasksWithHistory(emp.updates, projectHolidays, projectLeaves);
              emp.groupedTasks = grouped;
              emp.completedTasks = grouped.filter((t) => t.isCompleted);
              emp.completedTasksCount = emp.completedTasks.length;
              emp.inProcessTasks = grouped.filter((t) => t.isInProcess);
              emp.inProcessTasksCount = emp.inProcessTasks.length;
              emp.totalWorkingDays = calculateDistinctWorkingDays(emp.updates || grouped);
              emp.inProcessDays = calculateDistinctWorkingDays(emp.inProcessTasks);
            });

            const empList = Object.values(empMap);
            if (empList.length > 1) {
              const allGrouped = groupTasksWithHistory(projectUpdates, projectHolidays, projectLeaves);
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
                groupedTasks: allGrouped,
                completedTasks: allGrouped.filter((t) => t.isCompleted),
                completedTasksCount: allGrouped.filter((t) => t.isCompleted).length,
                inProcessTasks: allGrouped.filter((t) => t.isInProcess),
                inProcessTasksCount: allGrouped.filter((t) => t.isInProcess).length,
                totalWorkingDays: calculateDistinctWorkingDays(projectUpdates || allGrouped),
                inProcessDays: calculateDistinctWorkingDays(allGrouped.filter((t) => t.isInProcess)),
              });
            }

            const activeEmpId = projSelectedEmpId || empList[0]?.empId;
            const activeEmp =
              activeEmpId === "all"
                ? empList.find((e) => e.isAll) || {
                    name: "All Employees",
                    updates: projectUpdates,
                    groupedTasks: groupTasksWithHistory(projectUpdates, projectHolidays, projectLeaves),
                    completedTasksCount: 0,
                    inProcessTasksCount: 0,
                    totalWorkingDays: calculateDistinctWorkingDays(projectUpdates),
                    inProcessDays: 0,
                  }
                : empMap[activeEmpId];

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
                            setProjTaskStatusFilter("all");
                          }
                        }}
                        className={`project-details-emp-item ${activeEmpId === emp.empId ? "active" : ""}`}
                      >
                        <span className="project-details-emp-index">{String(idx + 1).padStart(2, "0")}</span>
                        <div className="project-details-emp-avatar-box">
                          {emp.isAll ? (
                            <div
                              className="project-details-emp-initials"
                              style={{ background: "#5977f8", color: "white" }}
                            >
                              <Icon icon="solar:users-group-rounded-bold" width={20} />
                            </div>
                          ) : emp.photo ? (
                            <img
                              src={emp.photo}
                              alt=""
                              className="project-details-emp-photo"
                              onError={(e) => {
                                e.target.src = "/avatar.png";
                              }}
                            />
                          ) : (
                            <div className="project-details-emp-initials">{emp.name?.charAt(0) || "?"}</div>
                          )}
                          <div className="project-details-emp-info">
                            <span className="project-details-emp-name">{emp.name}</span>
                            <span className="project-details-emp-designation">{emp.designation}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "600",
                                  background: "#eff6ff",
                                  color: "#2563eb",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid #bfdbfe",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                                title="Days in Process"
                              >
                                {emp.inProcessDays || 0}d in process
                              </span>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "600",
                                  background: "#ecfdf5",
                                  color: "#059669",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid #a7f3d0",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                                title="Completed Tasks"
                              >
                                {emp.completedTasksCount || 0} done
                              </span>
                            </div>
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
                        <div
                          className="project-details-right-header"
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "8px",
                            padding: "10px 14px",
                          }}
                        >
                          <span
                            className="project-details-right-header-title"
                            style={{ fontSize: "12px", fontWeight: "600", color: "#1e293b" }}
                          >
                            {activeEmp.name} — Work & Days Breakdown
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
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
                              In Process: <strong>{activeEmp.inProcessDays || 0} Days</strong> ({activeEmp.inProcessTasksCount || 0} tasks)
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
                              Completed: <strong>{activeEmp.completedTasksCount || 0} Tasks</strong>
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
                              Overall: <strong>{activeEmp.totalWorkingDays || 0} Days</strong>
                            </span>
                          </div>
                        </div>

                        {/* Filter Tabs: All Tasks, In Process, Completed */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 14px",
                            borderBottom: "1px solid #e5e7eb",
                            background: "#fafafa",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setProjTaskStatusFilter("all")}
                            style={{
                              border: "none",
                              background: projTaskStatusFilter === "all" ? "#5977f8" : "transparent",
                              color: projTaskStatusFilter === "all" ? "#ffffff" : "#64748b",
                              padding: "3px 10px",
                              borderRadius: "14px",
                              fontSize: "11px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            All Tasks ({(activeEmp.groupedTasks || []).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setProjTaskStatusFilter("inprocess")}
                            style={{
                              border: "none",
                              background: projTaskStatusFilter === "inprocess" ? "#2563eb" : "transparent",
                              color: projTaskStatusFilter === "inprocess" ? "#ffffff" : "#64748b",
                              padding: "3px 10px",
                              borderRadius: "14px",
                              fontSize: "11px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            In Process ({activeEmp.inProcessTasksCount || 0})
                          </button>
                          <button
                            type="button"
                            onClick={() => setProjTaskStatusFilter("completed")}
                            style={{
                              border: "none",
                              background: projTaskStatusFilter === "completed" ? "#059669" : "transparent",
                              color: projTaskStatusFilter === "completed" ? "#ffffff" : "#64748b",
                              padding: "3px 10px",
                              borderRadius: "14px",
                              fontSize: "11px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            Completed ({activeEmp.completedTasksCount || 0})
                          </button>
                        </div>

                        <div className="project-details-right-list">
                          {(activeEmp.groupedTasks || groupTasksWithHistory(activeEmp.updates, projectHolidays, projectLeaves))
                            .filter((t) => {
                              if (projTaskStatusFilter === "inprocess") return t.isInProcess;
                              if (projTaskStatusFilter === "completed") return t.isCompleted;
                              return true;
                            })
                            .map((u, idx) => {
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
                                <div
                                  className="dwu-work-card__header"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "16px",
                                    padding: "12px 12px",
                                  }}
                                >
                                  <div
                                    className="dwu-work-card__field dwu-field-title"
                                    style={{ flex: 1, minWidth: 0 }}
                                  >
                                    <span className="dwu-work-card__label">
                                      {activeEmpId === "all"
                                        ? u.employeeDetails?.name || "Employee"
                                        : "Task"}
                                    </span>
                                    <span
                                      className="dwu-work-card__value"
                                      title={u.displayTitle || u.taskTitle || "Task Title"}
                                      style={{
                                        display: "block",
                                        wordBreak: "break-word",
                                        whiteSpace: "normal",
                                      }}
                                    >
                                      {u.displayTitle || u.taskTitle || "Task Title"}
                                    </span>
                                  </div>
                                  <div
                                    className="dwu-work-card__field dwu-field-date"
                                    style={{ width: "70px", flexShrink: 0, textAlign: "left" }}
                                  >
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

                                  <div
                                    className="dwu-work-card__field dwu-field-working-days"
                                    style={{ width: "105px", flexShrink: 0, textAlign: "left" }}
                                  >
                                    <span className="dwu-work-card__label dwu-label-hide-mobile">Overall Days</span>
                                    <span
                                      className="dwu-work-card__value"
                                      style={{
                                        fontWeight: "600",
                                        color: isCompleted ? "#059669" : "#4f46e5",
                                      }}
                                    >
                                      {u.workingDays || 0} {u.workingDays === 1 ? "Day" : "Days"}
                                    </span>
                                  </div>

                                  <div
                                    className="dwu-work-card__field dwu-field-status"
                                    style={{ width: "95px", flexShrink: 0, textAlign: "left" }}
                                  >
                                    <span className="dwu-work-card__label dwu-label-hide-mobile">Status</span>
                                    <span
                                      className={`dwu-admin__statusBadge dwu-admin__statusBadge--${normKey}`}
                                      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                                    >
                                      {formatStatusLabel(u.latestStatus)}
                                      {isCompleted && (
                                        <span role="img" aria-label="locked" style={{ fontSize: "11px", lineHeight: 1 }}>

                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      width: "20px",
                                      marginBottom: "none",
                                      flexShrink: 0,
                                      display: "flex",
                                      justifyContent: "flex-start",
                                      alignItems: "start",
                                    }}
                                  >
                                    <FaChevronDown
                                      className="project-task-card-chevron"
                                      style={{
                                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                        fontSize: "12px",
                                        color: "#94a3b8",
                                        transition: "transform 0.25s ease",
                                      }}
                                    />
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div
                                    className="dwu-work-card__section_phase"
                                    style={{ paddingTop: "8px", borderTop: "1px dashed #e2e8f0" }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {hasMultipleUpdates ? (
                                      <div
                                        className="dwu-task-history-section"
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            marginBottom: "8px",
                                          }}
                                        >
                                          <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>
                                            Status History ({u.history.length})
                                          </span>
                                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                            Latest First
                                          </span>
                                        </div>

                                        <div
                                          style={{
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "8px",
                                            overflow: "hidden",
                                            background: "#f8fafc",
                                          }}
                                        >
                                          <table
                                            style={{
                                              width: "100%",
                                              borderCollapse: "collapse",
                                              fontSize: "12px",
                                            }}
                                          >
                                            <thead>
                                              <tr
                                                style={{
                                                  background: "#f1f5f9",
                                                  borderBottom: "1px solid #e2e8f0",
                                                  color: "#64748b",
                                                  fontWeight: "600",
                                                }}
                                              >
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
                                                  ? new Date(dateVal).toLocaleDateString("en-GB", {
                                                    day: "2-digit",
                                                    month: "short",
                                                  })
                                                  : "—";

                                                return (
                                                  <tr
                                                    key={hIdx}
                                                    style={{
                                                      borderBottom:
                                                        hIdx === u.history.length - 1
                                                          ? "none"
                                                          : "1px solid #e2e8f0",
                                                      background:
                                                        hIdx % 2 === 0 ? "#ffffff" : "#f8fafc",
                                                      cursor: "pointer",
                                                    }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setSelectedUpdate(h);
                                                      setShowUpdateDetailModal(true);
                                                    }}
                                                  >
                                                    <td
                                                      style={{
                                                        padding: "7px 10px",
                                                        verticalAlign: "top",
                                                        fontWeight: "500",
                                                        color: "#334155",
                                                      }}
                                                    >
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
                                                          whiteSpace: "nowrap",
                                                        }}
                                                        title={
                                                          hLocked
                                                            ? "Completed update is final and read-only"
                                                            : ""
                                                        }
                                                      >
                                                        {formatStatusLabel(hStatusRaw)}
                                                        {hLocked && (
                                                          <span
                                                            role="img"
                                                            aria-label="locked"
                                                            style={{ fontSize: "11px", lineHeight: 1 }}
                                                          >

                                                          </span>
                                                        )}
                                                      </span>
                                                    </td>
                                                    <td
                                                      style={{
                                                        padding: "7px 10px",
                                                        verticalAlign: "top",
                                                        color: "#475569",
                                                      }}
                                                    >
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
                                                      <div
                                                        style={{
                                                          wordBreak: "break-word",
                                                          overflowWrap: "anywhere",
                                                          whiteSpace: "pre-wrap",
                                                        }}
                                                      >
                                                        {h.note ||
                                                          h.description ||
                                                          h.details ||
                                                          "—"}
                                                      </div>
                                                      {Array.isArray(h.pages) && h.pages.length > 0 && (
                                                        <div
                                                          style={{
                                                            display: "flex",
                                                            flexWrap: "wrap",
                                                            gap: "4px",
                                                            marginTop: "4px",
                                                          }}
                                                        >
                                                          {h.pages.map((p, pI) => (
                                                            <span
                                                              key={pI}
                                                              style={{
                                                                fontSize: "10px",
                                                                background: "#e0e7ff",
                                                                color: "#3730a3",
                                                                padding: "1px 6px",
                                                                borderRadius: "4px",
                                                                fontWeight: "500",
                                                              }}
                                                            >
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
            onClick={() => {
              setShowProjectModal(false);
              setProjSelectedEmpId(null);
              setProjExpandedCards({});
            }}
            className="project-details-modal-cancel-btn"
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Employee specific updates modal for mobile/tablet screen ── */}
      <Modal
        show={!!selectedEmpUpdates && !showUpdateDetailModal}
        onHide={() => setSelectedEmpUpdates(null)}
        centered
        size="md"
        className="project-phases-modal-custom project-phases-modal-custom-admin"
      >
        <Modal.Header className="project-details-modal-header border-0 pb-0 d-flex flex-column align-items-stretch">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div>
              <h4 className="assign-task__members-title m-0">
                {selectedEmpUpdates?.name} Updates
              </h4>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "10px", fontWeight: "600", background: "#eff6ff", color: "#1d4ed8", padding: "1px 6px", borderRadius: "4px", border: "1px solid #bfdbfe" }}>
                  In Process: {selectedEmpUpdates?.inProcessDays || 0}d
                </span>
                <span style={{ fontSize: "10px", fontWeight: "600", background: "#ecfdf5", color: "#047857", padding: "1px 6px", borderRadius: "4px", border: "1px solid #a7f3d0" }}>
                  Completed: {selectedEmpUpdates?.completedTasksCount || 0} tasks
                </span>
                <span style={{ fontSize: "10px", fontWeight: "600", background: "#f8fafc", color: "#475569", padding: "1px 6px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                  Overall: {selectedEmpUpdates?.totalWorkingDays || 0}d
                </span>
              </div>
            </div>
            <button
              type="button"
              className="common-modal-close-x"
              onClick={() => setSelectedEmpUpdates(null)}
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                fontSize: "16px",
                cursor: "pointer",
                color: "#6b7280",
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ borderBottom: "1px solid #f1f5f9" }}></div>
        </Modal.Header>
        <Modal.Body
          className="project-details-modal-body px-4 pt-0 pb-4"
          style={{ maxHeight: "60vh", overflowY: "auto" }}
        >
          {selectedEmpUpdates && (
            <div className="project-details-right-list">
              {(selectedEmpUpdates.groupedTasks || groupTasksWithHistory(selectedEmpUpdates.updates, projectHolidays, projectLeaves)).map((u, idx) => {
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
                      setProjExpandedCards((prev) => ({
                        ...prev,
                        [cardKey]: !isExpanded,
                      }));
                    }}
                  >
                    <div
                      className="dwu-work-card__header"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        padding: "12px 12px",
                      }}
                    >
                      <div
                        className="dwu-work-card__field dwu-field-title"
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <span className="dwu-work-card__label">
                          {selectedEmpUpdates.isAll
                            ? u.employeeDetails?.name || "Employee"
                            : "Task"}
                        </span>
                        <span
                          className="dwu-work-card__value"
                          title={u.displayTitle || u.taskTitle || "Task Title"}
                          style={{
                            display: "block",
                            wordBreak: "break-word",
                            whiteSpace: "normal",
                          }}
                        >
                          {u.displayTitle || u.taskTitle || "Task Title"}
                        </span>
                      </div>
                      <div
                        className="dwu-work-card__field dwu-field-date"
                        style={{ width: "70px", flexShrink: 0, textAlign: "left" }}
                      >
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

                      <div
                        className="dwu-work-card__field dwu-field-working-days"
                        style={{ width: "95px", flexShrink: 0, textAlign: "left" }}
                      >
                        <span className="dwu-work-card__label">Overall Days</span>
                        <span
                          className="dwu-work-card__value"
                          style={{
                            fontWeight: "600",
                            color: isCompleted ? "#059669" : "#4f46e5",
                          }}
                        >
                          {u.workingDays || 0} {u.workingDays === 1 ? "Day" : "Days"}
                        </span>
                      </div>

                      <div
                        className="dwu-work-card__field dwu-field-status"
                        style={{ width: "95px", flexShrink: 0, textAlign: "left" }}
                      >
                        <span className="dwu-work-card__label">Status</span>
                        <span
                          className={`dwu-admin__statusBadge dwu-admin__statusBadge--${normKey}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          {formatStatusLabel(u.latestStatus)}
                          {isCompleted && (
                            <span role="img" aria-label="locked" style={{ fontSize: "11px", lineHeight: 1 }}>

                            </span>
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          width: "20px",
                          flexShrink: 0,
                          display: "flex",
                          justifyContent: "flex-start",
                          alignItems: "start",
                        }}
                      >
                        <FaChevronDown
                          className="project-task-card-chevron"
                          style={{
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            fontSize: "12px",
                            color: "#94a3b8",
                            transition: "transform 0.2s",
                          }}
                        />
                      </div>
                    </div>
                    {isExpanded && (
                      <div
                        className="dwu-work-card__expanded-content"
                        style={{
                          padding: "0 12px 12px 12px",
                          borderTop: "1px dashed #e2e8f0",
                          marginTop: "8px",
                          paddingTop: "8px",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
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
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                                {u.history[0].pages.map((p, pI) => (
                                  <span key={pI} style={{ fontSize: "9px", background: "#e0e7ff", color: "#3730a3", padding: "1px 4px", borderRadius: "4px", fontWeight: "500" }}>
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
        <Modal.Footer className="border-0 pt-0">
          <Button
            variant="light"
            onClick={() => setSelectedEmpUpdates(null)}
            className="common-modal-btn btn-small-cancel w-100"
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Work Update Deep-Dive Details Modal ── */}
      <Modal
        show={showUpdateDetailModal}
        onHide={handleBackFromUpdateDetail}
        centered
        size="lg"
        className="work-update-detail-modal-custom"
      >
        <Modal.Header className="border-0 pb-0 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <span
              onClick={handleBackFromUpdateDetail}
              title="Back"
              aria-label="Back"
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
                color: "#1e293b",
                fontSize: "17px",
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateX(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateX(0)")}
            >
              <FaArrowLeft />
            </span>
            <h4 className="common-modal-title m-0">Work Update Details</h4>
          </div>
          <button
            type="button"
            className="common-modal-close-x"
            onClick={handleCancelUpdateDetail}
            aria-label="Close"
          >
            ✕
          </button>
        </Modal.Header>
        <Modal.Body className="px-4 py-3">
          {selectedUpdate && (
            <div className="d-flex flex-column gap-3">
              <div className="work-update-detail-info-grid">
                <div>
                  <span className="dwu-work-card__label d-block">Employee</span>
                  <span className="fw-semibold text-dark" style={{ wordBreak: "break-word" }}>
                    {selectedUpdate.employeeDetails?.name || "N/A"} ({selectedUpdate.employeeDetails?.empId || "—"})
                  </span>
                </div>
                <div>
                  <span className="dwu-work-card__label d-block">Completion Date</span>
                  <span className="fw-semibold text-dark">
                    {selectedUpdate.completionDate
                      ? new Date(selectedUpdate.completionDate).toLocaleDateString("en-GB")
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="dwu-work-card__label d-block">Phase Status</span>
                  <span
                    className={`dwu-admin__statusBadge dwu-admin__statusBadge--${(
                      selectedUpdate.phaseStatus || "pending"
                    )
                      .toLowerCase()
                      .replace(/\s+/g, "")}`}
                  >
                    {selectedUpdate.phaseStatus || "Pending"}
                  </span>
                </div>
              </div>

              <div>
                <span className="dwu-work-card__label d-block mb-1">Task Title</span>
                <p className="fw-medium text-dark m-0" style={{ wordBreak: "break-word" }}>
                  {selectedUpdate.title ||
                    selectedUpdate.displayTitle ||
                    selectedUpdate.task?.taskTitle ||
                    selectedUpdate.standaloneTitle ||
                    "—"}
                </p>
              </div>

              <div>
                <span className="dwu-work-card__label d-block mb-1">Detailed Description</span>
                <div
                  className="p-3 border rounded-3 bg-white"
                  style={{
                    maxHeight: "280px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    color: "#334155",
                  }}
                >
                  {selectedUpdate.description ||
                    selectedUpdate.phase ||
                    selectedUpdate.details ||
                    selectedUpdate.note ||
                    "No detailed description provided."}
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-2 pb-3 pe-4 d-flex justify-content-end align-items-center">
          <Button
            variant="light"
            onClick={handleCancelUpdateDetail}
            className="common-modal-btn btn-small-cancel"
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectDetails;

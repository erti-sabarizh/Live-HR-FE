import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { portalInstance } from "../../../Services/instance";
import CustomDropdown from "../../Common/CustomDropdown";
import FilterIconImg from "../../../../public/Filter.svg?url";
import Pagination from "../../Employee/Pagination/Pagination";
import "../../Employee/Pagination/Pagination.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";
import { Trash2, AlertTriangle, Edit2, Clock, ExternalLink, Lock } from "lucide-react";
import { FaPlusCircle } from "react-icons/fa";
import closeIcon from "../../../assets/close.png";
import "./EmployeeDailyWorkUpdate.css";

import "../../../Globel/Layout.css";

const PAGE_SIZE_OPTIONS = [
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "15", value: 15 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
];

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

const EmployeeDailyWorkUpdate = () => {
  const navigate = useNavigate();
  // --- 1. User Session ---
  const sessionData = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("Erti-Portal");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed.user || parsed;
    } catch { return {}; }
  }, []);

  const loggedInUserId = sessionData?._id || sessionData?.id;

  // --- 2. State ---
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);

  // Filters
  const [dateMode, setDateMode] = useState("Today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [category, setCategory] = useState("");
  const [project, setProject] = useState("");

  // "Applied" filters (only used for API calls)
  const [appliedFilters, setAppliedFilters] = useState({
    category: "",
    project: "",
    dateMode: "Today",
    fromDate: "",
    toDate: ""
  });

  // Metadata for dropdowns
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [fullCategories, setFullCategories] = useState([]);
  const [fullProjects, setFullProjects] = useState([]);
  const [projectPages, setProjectPages] = useState([]);
  const [pageToDelete, setPageToDelete] = useState(null);
  const [showPageDeleteConfirm, setShowPageDeleteConfirm] = useState(false);

  // Pending Reminders for Incomplete Previous Work Updates
  const [pendingReminders, setPendingReminders] = useState([]);
  const [showPendingBanner, setShowPendingBanner] = useState(false);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [activeStatusDropdown, setActiveStatusDropdown] = useState(null);
  const [recentSaves, setRecentSaves] = useState([]);

  const isStackEligibleCategory = (cat) => {
    if (!cat) return false;
    const normalized = cat.trim().toLowerCase().replace(/[-_]/g, " ");
    return (
      normalized === "website" ||
      normalized === "app" ||
      normalized === "client projects" ||
      normalized === "client project" ||
      normalized === "dashboard" ||
      normalized === "dashbaord"
    );
  };

  const formatWorkType = (wt) => {
    if (!wt) return "";
    const upper = wt.trim().toUpperCase();
    if (upper === "BE") return "BE - Back End";
    if (upper === "FE") return "FE - Front End";
    if (upper === "FE & BE" || upper === "FE AND BE" || upper === "BE & FE" || upper === "BE AND FE") {
      return "FE & BE - Front End and Back End";
    }
    if (upper === "DESIGN") return "Design";
    return wt;
  };

  const emptyEntry = () => ({
    taskId: "",
    project: "",
    category: "",
    workType: "",
    status: "inprocess",
    description: "",
    updateDate: new Date().toISOString().split("T")[0],
    isNewTask: true,
    title: "",
    hasPages: false,
    pages: []
  });

  const [formEntries, setFormEntries] = useState([emptyEntry()]);
  const [activeOtherField, setActiveOtherField] = useState(null); // { idx, type: 'category'|'project' }
  const [newOtherVal, setNewOtherVal] = useState("");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [isPointByPoint, setIsPointByPoint] = useState(false);

  const filterRef = useRef(null);
  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);
  const todayStr = new Date().toISOString().split("T")[0];

  const isTodayUpdate = (dateVal) => {
    if (!dateVal) return false;
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    if (typeof dateVal === "string" && dateVal.includes("T")) {
      const [year, month, day] = dateVal.split("T")[0].split("-").map(Number);
      if (year && month && day) {
        return year === todayYear && (month - 1) === todayMonth && day === todayDate;
      }
    } else if (typeof dateVal === "string" && dateVal.includes("-")) {
      const [year, month, day] = dateVal.split("-").map(Number);
      if (year && month && day) {
        return year === todayYear && (month - 1) === todayMonth && day === todayDate;
      }
    }

    const targetDate = new Date(dateVal);
    if (isNaN(targetDate.getTime())) return false;
    return (
      targetDate.getFullYear() === todayYear &&
      targetDate.getMonth() === todayMonth &&
      targetDate.getDate() === todayDate
    );
  };

  const getStatusKey = (v) => {
    const s = (v || "").toString().toLowerCase().replace(/\s+/g, "");
    if (s === "inprocess" || s === "in-process" || s === "in_process") return "inprocess";
    if (s === "hold" || s === "onhold" || s === "on-hold" || s === "on_hold") return "hold";
    return s;
  };

  const getStatusLabel = (v) => {
    const key = getStatusKey(v);
    if (key === "inprocess") return "In Process";
    if (key === "hold") return "On Hold";
    return (v || "Pending").toString().charAt(0).toUpperCase() + (v || "Pending").toString().slice(1);
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

      // If both updates belong to the same task, sort in ascending phase order (Phase 1, Phase 2, Phase 3, Phase 4, Phase 5)
      if (isSameTask) {
        const numA = getPhaseNumber(a, list);
        const numB = getPhaseNumber(b, list);
        if (numA !== numB) return numA - numB;
        const timeA = new Date(a.updateDate || a.createdAt || 0).getTime();
        const timeB = new Date(b.updateDate || b.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return String(a._id || "").localeCompare(String(b._id || ""));
      }

      // Otherwise sort by date descending
      const getLocalDateStr = (d) => {
        if (!d) return "";
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return "";
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
      };

      const dateStrA = getLocalDateStr(a.updateDate || a.createdAt);
      const dateStrB = getLocalDateStr(b.updateDate || b.createdAt);
      if (dateStrA !== dateStrB) return dateStrB.localeCompare(dateStrA);

      // On same date, if both have phase numbers, sort by phase number ascending (1, 2, 3...)
      const numA = getPhaseNumber(a, list);
      const numB = getPhaseNumber(b, list);
      const isPhaseA = Boolean(a.phaseId || a.taskPhaseId || a.referenceId || a.task?.phases?.length);
      const isPhaseB = Boolean(b.phaseId || b.taskPhaseId || b.referenceId || b.task?.phases?.length);
      if (isPhaseA && isPhaseB && numA !== numB) {
        return numA - numB;
      }

      return String(a._id || "").localeCompare(String(b._id || ""));
    });
  };

  const totalItems = (updates || []).length;

  const paginatedDisplayUpdates = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return (updates || []).slice(startIndex, startIndex + pageSize);
  }, [updates, currentPage, pageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil((updates || []).length / pageSize));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [updates.length, pageSize, currentPage]);

  // --- 3. Data Fetching ---

  const fetchMeta = useCallback(async () => {
    try {
      const res = await portalInstance.get("/creat/task-meta");
      if (res.data?.success) {
        setCategories(res.data.data.categories || []);
        setProjects(res.data.data.projects || []);
        setFullCategories(res.data.data.fullCategories || []);
        setFullProjects(res.data.data.fullProjects || []);
        setProjectPages(res.data.data.projectPages || []);
      }
    } catch (err) {
      console.error("META FETCH ERROR:", err);
    }
  }, []);

  const fetchPendingReminders = useCallback(async () => {
    if (!loggedInUserId) return;
    try {
      const params = new URLSearchParams();
      params.append("employeeId", loggedInUserId);
      params.append("limit", "150");

      const res = await portalInstance.get(`/creat/daily-update/all?${params.toString()}`);
      if (res.data?.success) {
        const allList = res.data.data || [];

        // Sort newest first by date and _id
        const sorted = [...allList].sort((a, b) => {
          const dateA = new Date(a.updateDate || a.createdAt || 0).getTime();
          const dateB = new Date(b.updateDate || b.createdAt || 0).getTime();
          if (dateA !== dateB) return dateB - dateA;
          return String(b._id || "").localeCompare(String(a._id || ""));
        });

        // 1. Map each phaseId to its known referenceId (if one exists)
        // so that records for the same phase are linked even if referenceId was added later
        const phaseToRefMap = new Map();
        sorted.forEach(item => {
          const rId = item.referenceId ? String(item.referenceId) : null;
          const pId = (item.phaseId || item.taskPhaseId) ? String(item.phaseId || item.taskPhaseId) : null;
          if (pId && rId) {
            phaseToRefMap.set(pId, rId);
          }
        });

        // 2. Group historical records:
        // Priority 1: referenceId links all records for a phase history
        // Priority 2: phaseId (if referenceId was absent)
        // Priority 3: workUpdateRefId links standalone updates across days
        // Priority 4: category + project + title for standalone updates

        // Build connected components for workUpdateRefId across all days
        const workRefParent = new Map();
        const getWorkRefRoot = (id) => {
          if (!id) return null;
          let curr = String(id);
          while (workRefParent.has(curr) && workRefParent.get(curr) !== curr) {
            curr = workRefParent.get(curr);
          }
          return curr;
        };
        const unionWorkRef = (id1, id2) => {
          if (!id1 || !id2) return;
          const s1 = String(id1);
          const s2 = String(id2);
          if (!workRefParent.has(s1)) workRefParent.set(s1, s1);
          if (!workRefParent.has(s2)) workRefParent.set(s2, s2);
          const r1 = getWorkRefRoot(s1);
          const r2 = getWorkRefRoot(s2);
          if (r1 !== r2) {
            workRefParent.set(r1, r2);
          }
        };

        sorted.forEach(item => {
          const id = item._id ? String(item._id) : null;
          const ref = (item.workUpdateRefId && typeof item.workUpdateRefId === "object")
            ? String(item.workUpdateRefId._id || item.workUpdateRefId)
            : (item.workUpdateRefId ? String(item.workUpdateRefId) : null);
          if (id && ref) {
            unionWorkRef(id, ref);
          }
        });

        const groups = new Map();
        sorted.forEach(item => {
          const rId = item.referenceId ? String(item.referenceId) : null;
          const pId = (item.phaseId || item.taskPhaseId) ? String(item.phaseId || item.taskPhaseId) : null;
          const rawWorkRef = (item.workUpdateRefId && typeof item.workUpdateRefId === "object")
            ? String(item.workUpdateRefId._id || item.workUpdateRefId)
            : (item.workUpdateRefId ? String(item.workUpdateRefId) : null);
          const wRefId = rawWorkRef
            ? getWorkRefRoot(rawWorkRef)
            : (item._id && workRefParent.has(String(item._id)) ? getWorkRefRoot(String(item._id)) : null);

          let groupKey = "";
          if (rId) {
            groupKey = `ref:${rId}`;
          } else if (pId && phaseToRefMap.has(pId)) {
            groupKey = `ref:${phaseToRefMap.get(pId)}`;
          } else if (pId) {
            groupKey = `phase:${pId}`;
          } else if (wRefId) {
            groupKey = `workUpdateRef:${wRefId}`;
          } else {
            const normTitle = (item.title || item.task?.taskTitle || "").trim().toLowerCase();
            const normCat = (item.category || item.task?.category || "").trim().toLowerCase();
            const normProj = (item.project || item.task?.project || "").trim().toLowerCase();

            // Match existing standalone group in the same category & project by exact title, prefix, or containment
            let matchedKey = null;
            for (const existingKey of groups.keys()) {
              if (existingKey.startsWith(`standalone:${normCat}|${normProj}|`)) {
                const existingTitle = existingKey.split("|")[2];
                if (
                  existingTitle === normTitle ||
                  (normTitle.length >= 4 && existingTitle.startsWith(normTitle)) ||
                  (existingTitle.length >= 4 && normTitle.startsWith(existingTitle)) ||
                  (normTitle.length >= 5 && existingTitle.includes(normTitle)) ||
                  (existingTitle.length >= 5 && normTitle.includes(existingTitle))
                ) {
                  matchedKey = existingKey;
                  break;
                }
              }
            }
            groupKey = matchedKey || `standalone:${normCat}|${normProj}|${normTitle}`;
          }

          if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
          }
          groups.get(groupKey).push(item);
        });

        // 3. For each group, check the latest status and history:
        const activePending = [];
        groups.forEach(recordsInGroup => {
          // Since sorted was newest first, recordsInGroup[0] is the latest record
          const latestRecord = recordsInGroup[0];
          const latestStatus = getStatusKey(latestRecord.status);

          // Check if the corresponding phase/task is completed:
          // A phase is completed if:
          // - The latest record status is 'completed'
          // - OR any historical record in this reference group is marked 'completed'
          // - OR the task's corresponding phaseStatus is 'completed'
          const isPhaseCompleted =
            latestStatus === "completed" ||
            recordsInGroup.some(r => {
              const s = getStatusKey(r.status);
              const ps = getStatusKey(r.phaseStatus);
              const tps = getStatusKey(r.taskPhaseStatus);
              return s === "completed" || ps === "completed" || tps === "completed";
            });

          // Rule: If the phase is completed, remove its previous pending work reminder
          if (isPhaseCompleted) {
            return;
          }

          // Rule: If a phase is still inprocess or otherwise unfinished (pending, inprocess, hold)
          const isPendingStatus = ["pending", "inprocess", "hold"].includes(latestStatus);
          const isUpdatedToday = isTodayUpdate(latestRecord.updateDate || latestRecord.createdAt);

          // If from a previous day and still unfinished, show in Previous Pending Work Reminders
          if (isPendingStatus && !isUpdatedToday) {
            activePending.push(latestRecord);
          }
        });

        setPendingReminders(sortUpdatesWithPhaseOrder(activePending));
      }
    } catch (err) {
      console.error("FETCH PENDING REMINDERS ERROR:", err);
    }
  }, [loggedInUserId]);

  const fetchUpdates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (loggedInUserId) params.append("employeeId", loggedInUserId);

      if (appliedFilters.dateMode === "Today") params.append("today", "true");
      else if (appliedFilters.dateMode === "Yesterday") params.append("yesterday", "true");
      else if (appliedFilters.dateMode === "Specific" && appliedFilters.fromDate) {
        params.append("fromDate", appliedFilters.fromDate);
        params.append("toDate", appliedFilters.fromDate); // Same date for specific day
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
      if (res.data?.success) {
        const fetched = res.data.data || [];
        const sorted = sortUpdatesWithPhaseOrder(fetched);
        setUpdates(sorted);
      }
    } catch (error) {
      console.error("FETCH UPDATES ERROR:", error);
      toast.error("Failed to load work updates");
    } finally {
      setLoading(false);
    }
  }, [loggedInUserId, appliedFilters]);

  // --- 4. Effects ---
  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    fetchPendingReminders();
  }, [fetchPendingReminders]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  // Manual search handlers (matches AdminTaskPage logic)
  const handleSearch = () => {
    if (dateMode === "Custom" && (!fromDate || !toDate)) {
      return toast.warning("Please select both From and To dates");
    }
    setAppliedFilters({ category, project, dateMode, fromDate, toDate });
    setCurrentPage(1);
    // Kept open: filter only closes when clicking Cancel or the filter icon
  };

  const handleReset = () => {
    setCategory("");
    setProject("");
    setDateMode("Today");
    setFromDate("");
    setToDate("");
    setAppliedFilters({ category: "", project: "", dateMode: "Today", fromDate: "", toDate: "" });
    setCurrentPage(1);
    setShowFilterMenu(false);
  };

  // --- 5. Page Helpers & Handlers ---
  const getPagesForProject = (catName, projName) => {
    if (!catName || !projName) return [];
    const normCat = (catName || "").trim().toLowerCase();
    const normProj = (projName || "").trim().toLowerCase();
    const found = projectPages.find(
      pp =>
        (pp.category || "").trim().toLowerCase() === normCat &&
        (pp.project || "").trim().toLowerCase() === normProj
    );
    return found?.pages || [];
  };

  const handleTogglePagesRadio = (idx) => {
    const current = !!formEntries[idx]?.hasPages;
    const nextVal = !current;
    setFormEntries(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        hasPages: nextVal,
        pages: nextVal ? (updated[idx].pages || []) : []
      };
      return updated;
    });
  };

  const handlePageSelect = (idx, selectedVal) => {
    if (!selectedVal) return;
    if (selectedVal === "Add") {
      setActiveOtherField({ idx, type: "page" });
      setNewOtherVal("");
      return;
    }
    const currentPages = formEntries[idx]?.pages || [];
    if (currentPages.includes(selectedVal)) {
      toast.info(`"${selectedVal}" is already selected`);
      return;
    }
    updateFormEntry(idx, "pages", [...currentPages, selectedVal]);
  };

  const handlePromptDeletePage = (entryIdx, pageName) => {
    setPageToDelete({ entryIdx, pageName });
    setShowPageDeleteConfirm(true);
  };

  const confirmDeletePage = () => {
    if (!pageToDelete) return;
    const { entryIdx, pageName } = pageToDelete;
    setFormEntries(prev => {
      const updated = [...prev];
      const currentPages = updated[entryIdx]?.pages || [];
      updated[entryIdx] = {
        ...updated[entryIdx],
        pages: currentPages.filter(p => p !== pageName)
      };
      return updated;
    });
    setShowPageDeleteConfirm(false);
    setPageToDelete(null);
    toast.success(`Page "${pageName}" removed`);
  };

  const [pageToDeleteFromProject, setPageToDeleteFromProject] = useState(null); // { pageName, category, project, entryIdx }

  const handlePromptDeleteProjectPage = (pageName, category, project, entryIdx) => {
    if (!pageName || !project || !category) return;
    setPageToDeleteFromProject({ pageName, category, project, entryIdx });
  };

  const confirmDeleteProjectPage = async () => {
    if (!pageToDeleteFromProject) return;
    const { pageName, category, project } = pageToDeleteFromProject;
    try {
      const res = await portalInstance.delete("/creat/task-meta/page", {
        data: { category, project, page: pageName }
      });
      if (res.data?.success) {
        toast.success(`Page "${pageName}" deleted successfully!`);
        const updatedPages = res.data.data?.pages;
        setProjectPages(prev => {
          const normCat = (category || "").trim().toLowerCase();
          const normProj = (project || "").trim().toLowerCase();
          return prev.map(pp => {
            if (
              (pp.category || "").trim().toLowerCase() === normCat &&
              (pp.project || "").trim().toLowerCase() === normProj
            ) {
              return {
                ...pp,
                pages: updatedPages || (pp.pages || []).filter(p => p.toLowerCase() !== pageName.toLowerCase())
              };
            }
            return pp;
          });
        });

        // Remove from selected pages if it was selected in any form entry
        setFormEntries(prev => prev.map(entry => ({
          ...entry,
          pages: Array.isArray(entry.pages) ? entry.pages.filter(p => p.toLowerCase() !== pageName.toLowerCase()) : []
        })));

        await fetchMeta();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete page");
    } finally {
      setPageToDeleteFromProject(null);
    }
  };

  // --- 6. Form Submission Handlers ---
  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    // Premium strict form validation for all required fields
    for (let i = 0; i < formEntries.length; i++) {
      const entry = formEntries[i];
      if (!entry.category?.trim()) {
        toast.warning("Category is required. Please select a Category.");
        return;
      }
      if (!entry.project?.trim()) {
        toast.warning("Project is required. Please select a Project.");
        return;
      }
      if (!entry.title?.trim()) {
        toast.warning("Task Title is required. Please enter a Task Title.");
        return;
      }
      if (!entry.status?.trim()) {
        toast.warning("Status is required. Please select a Status.");
        return;
      }
      if (!entry.description?.trim()) {
        toast.warning("Description is required. Please enter a Description.");
        return;
      }
    }

    const validEntries = formEntries.filter(entry => entry.title?.trim());
    if (validEntries.length === 0) return toast.error("Please fill at least one entry");

    try {
      setCreateLoading(true);

      const entry = validEntries[0];
      const isEditing = !!editingUpdate;
      const isEditingToday = isEditing && isTodayUpdate(editingUpdate.updateDate || editingUpdate.createdAt);

      const formattedCategory = entry.category ? entry.category.toUpperCase() : entry.category;
      const formattedProject = entry.project ? (entry.project.charAt(0).toUpperCase() + entry.project.slice(1).toLowerCase()) : entry.project;
      const formattedWorkType = isStackEligibleCategory(entry.category) ? (entry.workType || "").trim() : "";
      const formattedPages = entry.hasPages && Array.isArray(entry.pages) ? entry.pages : [];

      const isCompleted = getStatusKey(editingUpdate?.status || editingUpdate?.phaseStatus) === "completed";
      const isCompletedPastEdit = isEditing && isCompleted && !isEditingToday;
      if (isCompletedPastEdit) {
        toast.error("Completed work updates from previous days cannot be edited.");
        return;
      }

      if (isEditing && isEditingToday) {
        const isItemTaskPhase = Boolean(
          (editingUpdate?.task?._id && editingUpdate.task._id !== "standalone" && (editingUpdate.phaseId || editingUpdate.taskPhaseId || editingUpdate.referenceId)) ||
          (entry.taskId && entry.taskId !== "standalone" && !entry.isNewTask)
        );
        const rawWorkUpdateRef = editingUpdate?.workUpdateRefId?._id || editingUpdate?.workUpdateRefId;
        const resolvedWorkUpdateRefId = (!isItemTaskPhase && rawWorkUpdateRef)
          ? rawWorkUpdateRef
          : undefined;

        const submitData = {
          ...entry,
          taskId: entry.taskId || "standalone",
          title: entry.title?.trim(),
          description: entry.description?.trim() || undefined,
          phaseStatus: entry.status,
          status: entry.status,
          employeeId: loggedInUserId,
          updateDate: entry.updateDate,
          category: formattedCategory,
          project: formattedProject,
          workType: formattedWorkType,
          pages: formattedPages,
          taskPhaseId: editingUpdate.phaseId || editingUpdate.taskPhaseId || editingUpdate.referenceId,
          workUpdateRefId: resolvedWorkUpdateRefId
        };

        const response = await portalInstance.put(`/creat/daily-update/${editingUpdate._id}`, submitData);
        if (response.data?.success) {
          const updatedObj = response.data.data;
          setUpdates(prev => prev.map(u => {
            if (u._id === editingUpdate._id) {
              return {
                ...u,
                ...updatedObj,
                title: submitData.title,
                description: submitData.description,
                status: submitData.status,
                category: submitData.category,
                project: submitData.project,
                workType: submitData.workType,
                pages: submitData.pages,
                task: {
                  ...u?.task,
                  taskTitle: submitData.title,
                  category: submitData.category,
                  project: submitData.project
                }
              };
            }
            return u;
          }));
          toast.success("Work update updated successfully!");
        }
        setShowCreateModal(false);
        resetCreateForm();
        fetchUpdates();
        fetchPendingReminders();
        return;
      }

      // Either a NEW creation OR editing a PAST record (which creates a NEW record for TODAY)
      const newEntries = [];
      for (const entry of validEntries) {
        const cat = entry.category ? entry.category.toUpperCase() : entry.category;
        const proj = entry.project ? (entry.project.charAt(0).toUpperCase() + entry.project.slice(1).toLowerCase()) : entry.project;
        const wt = isStackEligibleCategory(entry.category) ? (entry.workType || "").trim() : "";
        const formattedPages = entry.hasPages && Array.isArray(entry.pages) ? entry.pages : [];
        const isItemTaskPhase = Boolean(
          (editingUpdate?.task?._id && editingUpdate.task._id !== "standalone" && (editingUpdate.phaseId || editingUpdate.taskPhaseId || editingUpdate.referenceId)) ||
          (entry.taskId && entry.taskId !== "standalone" && !entry.isNewTask)
        );
        const rawWorkUpdateRef = editingUpdate?.workUpdateRefId?._id || editingUpdate?.workUpdateRefId;
        const resolvedWorkUpdateRefId = (!isItemTaskPhase && editingUpdate)
          ? (rawWorkUpdateRef || editingUpdate._id)
          : undefined;

        const submitData = {
          ...entry,
          taskId: entry.taskId || "standalone",
          title: entry.title?.trim(),
          description: entry.description?.trim() || undefined,
          phaseStatus: entry.status,
          status: entry.status,
          employeeId: loggedInUserId,
          updateDate: todayStr, // Always save to today's date
          category: cat,
          project: proj,
          workType: wt,
          pages: formattedPages,
          taskPhaseId: editingUpdate ? (editingUpdate.phaseId || editingUpdate.taskPhaseId || editingUpdate.referenceId) : undefined,
          workUpdateRefId: resolvedWorkUpdateRefId
        };
        const response = await portalInstance.post("/creat/daily-update", submitData);
        if (response.data?.success && response.data.data) {
          const savedEntry = response.data.data;
          const formattedEntry = {
            ...savedEntry,
            pages: submitData.pages,
            userId: {
              _id: loggedInUserId,
              name: sessionData?.name || "Me",
              photo: sessionData?.photo || null
            },
            updatedBy: {
              _id: loggedInUserId,
              name: sessionData?.name || "Me",
              photo: sessionData?.photo || null
            },
            task: {
              _id: submitData.taskId,
              taskTitle: submitData.title,
              category: submitData.category,
              project: submitData.project
            }
          };
          newEntries.push(formattedEntry);
        }
      }

      // If editing a past record, also sync the title, category, project, and workUpdateRefId to the past record
      if (isEditing && !isEditingToday && editingUpdate?._id) {
        try {
          const firstValid = validEntries[0];
          const isItemTaskPhase = Boolean(
            (editingUpdate?.task?._id && editingUpdate.task._id !== "standalone" && (editingUpdate.phaseId || editingUpdate.taskPhaseId || editingUpdate.referenceId)) ||
            (firstValid.taskId && firstValid.taskId !== "standalone" && !firstValid.isNewTask)
          );
          const resolvedWorkUpdateRefId = (!isItemTaskPhase && editingUpdate)
            ? (editingUpdate.workUpdateRefId || editingUpdate._id)
            : undefined;

          // For the past record, do not store workUpdateRefId on itself if it's the root creation
          const pastRecordRefId = (editingUpdate?.workUpdateRefId && String(editingUpdate.workUpdateRefId) !== String(editingUpdate._id))
            ? editingUpdate.workUpdateRefId
            : undefined;

          if (firstValid && firstValid.title?.trim()) {
            await portalInstance.put(`/creat/daily-update/${editingUpdate._id}`, {
              title: firstValid.title.trim(),
              category: firstValid.category ? firstValid.category.toUpperCase() : undefined,
              project: firstValid.project ? (firstValid.project.charAt(0).toUpperCase() + firstValid.project.slice(1).toLowerCase()) : undefined,
              workType: firstValid.workType || undefined,
              workUpdateRefId: pastRecordRefId
            });
          }
        } catch (syncErr) {
          console.warn("Could not sync past record title:", syncErr);
        }
      }

      toast.success(editingUpdate ? "Work update recorded for today!" : "Work update recorded successfully!");

      setRecentSaves(prev => [...validEntries, ...prev]);
      resetCreateForm();
      setShowCreateModal(false);

      if (newEntries.length > 0) {
        setUpdates(prev => {
          const combinedList = [...newEntries, ...prev];
          return sortUpdatesWithPhaseOrder(combinedList);
        });
      }

      // Reset filters and refresh to today
      setCategory("");
      setProject("");
      setDateMode("Today");
      setFromDate("");
      setToDate("");
      setAppliedFilters({
        category: "",
        project: "",
        dateMode: "Today",
        fromDate: "",
        toDate: ""
      });
      setCurrentPage(1);
      fetchUpdates();
      fetchPendingReminders();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save update");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditClick = (u) => {
    const isCompleted = getStatusKey(u.status || u.phaseStatus) === "completed";
    const isToday = isTodayUpdate(u.updateDate || u.createdAt);
    if (isCompleted && !isToday) {
      toast.info("Completed work updates from previous days are locked and cannot be edited.");
      return;
    }

    const isItemTaskPhase = Boolean(
      (u.task?._id && u.task._id !== "standalone" && !u.isNewTask && (u.phaseId || u.taskPhaseId || u.referenceId)) ||
      (u.task && typeof u.task === "string" && u.task !== "standalone" && (u.phaseId || u.taskPhaseId || u.referenceId)) ||
      (u.task_id && u.task_id !== "standalone" && (u.phaseId || u.taskPhaseId || u.referenceId)) ||
      (!u.isNewTask && u.task && u.task !== "standalone" && (u.phaseId || u.referenceId))
    );
    if (isItemTaskPhase) {
      const targetTaskId = (u.task?._id && u.task._id !== "standalone")
        ? (typeof u.task._id === "object" ? (u.task._id._id || u.task._id.toString()) : u.task._id)
        : (u.task && u.task !== "standalone"
          ? (typeof u.task === "object" ? (u.task._id || u.task.toString()) : u.task)
          : (u.task_id && u.task_id !== "standalone"
            ? (typeof u.task_id === "object" ? (u.task_id._id || u.task_id.toString()) : u.task_id)
            : (u.taskId || null)));
      if (targetTaskId) {
        navigate("/emp/tasks", { state: { selectedTaskId: targetTaskId } });
      } else {
        navigate("/emp/tasks");
      }
      return;
    }

    const isStandalone = u.task?._id === "standalone" || !u.task?._id;
    const desc = u.description || "";
    const rawPages = Array.isArray(u.pages)
      ? u.pages
      : (typeof u.pages === "string" && u.pages.trim() ? [u.pages.trim()] : []);
    const hasPages = rawPages.length > 0;
    setEditingUpdate(u);
    setIsPointByPoint(/^\s*1[\.\)]/m.test(desc));
    setFormEntries([{
      taskId: isStandalone ? "" : (u.task?._id || ""),
      project: u.task?.project || u.project || "",
      category: u.task?.category || u.category || "",
      workType: u.workType || "",
      hasPages: hasPages,
      pages: [...rawPages],
      status: u.status || "pending",
      description: desc,
      updateDate: u.updateDate ? new Date(u.updateDate).toISOString().split("T")[0] : todayStr,
      title: u.title || u.task?.taskTitle || "",
      isNewTask: isStandalone
    }]);
    setShowCreateModal(true);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const handleDeleteUpdate = async (e, id) => {
    e.stopPropagation();
    const target = updates.find(u => u._id === id);
    if (!target) return;
    if (!isTodayUpdate(target.updateDate || target.createdAt)) {
      toast.info("Work updates from previous days are locked and cannot be deleted.");
      return;
    }
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const target = updates.find(u => u._id === deleteTargetId);
    if (!target || !isTodayUpdate(target.updateDate || target.createdAt)) {
      toast.error("Work updates from previous days are locked and cannot be deleted.");
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      return;
    }
    try {
      const res = await portalInstance.delete(`/creat/daily-update/${deleteTargetId}`);
      if (res.data.success) {
        toast.success("Update deleted");
        setUpdates(prev => prev.filter(u => u._id !== deleteTargetId));
        fetchUpdates();
        fetchPendingReminders();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete update");
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
    }
  };

  const formatToNumberedPoints = (text) => {
    if (!text || !text.trim()) return "• ";
    const rawLines = text.split("\n");
    const cleaned = rawLines
      .map(line => line.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim())
      .filter(Boolean);

    if (cleaned.length === 0) return "• ";
    return cleaned.map(line => `• ${line}`).join("\n");
  };

  const removeNumberedPoints = (text) => {
    if (!text) return "";
    return text
      .split("\n")
      .map(line => line.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim())
      .filter(Boolean)
      .join("\n");
  };

  const handleTogglePointByPoint = (idx = 0) => {
    const nextMode = !isPointByPoint;
    setIsPointByPoint(nextMode);

    const currentDesc = formEntries[idx]?.description || "";
    if (nextMode) {
      const formatted = formatToNumberedPoints(currentDesc);
      updateFormEntry(idx, "description", formatted);
    } else {
      const unformatted = removeNumberedPoints(currentDesc);
      updateFormEntry(idx, "description", unformatted);
    }
  };

  const handleDescriptionKeyDown = (e, idx) => {
    if (!isPointByPoint) return;

    if (e.key === "Enter") {
      e.preventDefault();
      const textarea = e.target;
      const { selectionStart, selectionEnd, value } = textarea;

      const textBeforeCursor = value.substring(0, selectionStart);
      const textAfterCursor = value.substring(selectionEnd);

      const linesBefore = textBeforeCursor.split("\n");
      const currentLine = linesBefore[linesBefore.length - 1];

      const match = currentLine.match(/^([•\-\*]|\d+[\.\)])\s*(.*)$/);

      if (match) {
        const content = match[2];

        // If current line is just "• " without content, clear the bullet
        if (!content.trim()) {
          const newLines = linesBefore.slice(0, -1);
          const newBefore = newLines.length > 0 ? newLines.join("\n") + "\n" : "";
          const newText = newBefore + textAfterCursor;
          updateFormEntry(idx, "description", newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
          return;
        }

        const insertion = "\n• ";
        const newText = textBeforeCursor + insertion + textAfterCursor;
        const newCursorPos = selectionStart + insertion.length;

        updateFormEntry(idx, "description", newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        }, 0);
      } else {
        const insertion = "\n• ";
        const newText = textBeforeCursor + insertion + textAfterCursor;
        const newCursorPos = selectionStart + insertion.length;

        updateFormEntry(idx, "description", newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        }, 0);
      }
    }
  };

  const handleDescriptionPaste = (e, idx) => {
    if (!isPointByPoint) return;

    const pastedText = e.clipboardData?.getData("text");
    if (!pastedText || !pastedText.includes("\n")) return;

    e.preventDefault();
    const textarea = e.target;
    const { selectionStart, selectionEnd, value } = textarea;

    const textBefore = value.substring(0, selectionStart);
    const textAfter = value.substring(selectionEnd);

    const rawLines = pastedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return;

    const linesBefore = textBefore.split("\n");
    const currentLine = linesBefore[linesBefore.length - 1];
    const match = currentLine.match(/^([•\-\*]|\d+[\.\)])\s*/);

    let formattedPaste = "";
    if (match && (currentLine.trim() === match[1] || currentLine.trim() === `${match[1]}.`)) {
      formattedPaste = rawLines.map((l, i) => {
        const clean = l.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim();
        return i === 0 ? clean : `• ${clean}`;
      }).join("\n");
    } else {
      formattedPaste = rawLines.map((l) => {
        const clean = l.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim();
        return `• ${clean}`;
      }).join("\n");
      if (textBefore && !textBefore.endsWith("\n") && !match) {
        formattedPaste = "\n" + formattedPaste;
      }
    }

    const newText = textBefore + formattedPaste + textAfter;
    updateFormEntry(idx, "description", newText);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = (textBefore + formattedPaste).length;
    }, 0);
  };

  const updateFormEntry = (idx, field, value) => {
    setFormEntries(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleCategoryToggle = (idx, cat) => {
    setShowAllProjects(false);
    if (cat === "Add") {
      setActiveOtherField({ idx, type: "category" });
      setNewOtherVal("");
      updateFormEntry(idx, "category", "");
      updateFormEntry(idx, "project", "");
      updateFormEntry(idx, "workType", "");
      updateFormEntry(idx, "pages", []);
    } else if (cat === "Back") {
      setActiveOtherField(null);
      updateFormEntry(idx, "category", "");
      updateFormEntry(idx, "project", "");
      updateFormEntry(idx, "workType", "");
      updateFormEntry(idx, "pages", []);
    } else {
      setActiveOtherField(null);
      const catVal = cat ? cat.toUpperCase() : "";
      updateFormEntry(idx, "category", catVal);
      updateFormEntry(idx, "project", "");
      updateFormEntry(idx, "pages", []);
      if (!isStackEligibleCategory(catVal)) {
        updateFormEntry(idx, "workType", "");
      }
    }
  };

  const handleProjectToggle = (idx, proj) => {
    const currentCat = formEntries[idx]?.category;
    if (!currentCat || (activeOtherField?.idx === idx && activeOtherField?.type === "category")) {
      toast.warning("Please save or select a category first");
      return;
    }
    if (proj === "See All Values") {
      setShowAllProjects(true);
      return;
    }
    if (proj === "Add") {
      setActiveOtherField({ idx, type: "project" });
      setNewOtherVal("");
      updateFormEntry(idx, "project", "");
      updateFormEntry(idx, "pages", []);
      return;
    }
    setActiveOtherField(null);
    const formattedProj = proj ? (proj.charAt(0).toUpperCase() + proj.slice(1).toLowerCase()) : "";
    updateFormEntry(idx, "project", formattedProj);
    updateFormEntry(idx, "pages", []);
  };

  const handleAddOther = async (idx, type) => {
    let val = newOtherVal.trim();
    if (!val) return;

    if (type === "category") {
      val = val.toUpperCase();
      const exists = categories.some(c => c && c.toUpperCase() === val) || fullCategories.some(c => c && (c.name || "").toUpperCase() === val);
      if (exists) {
        toast.info(`"${val}" is already available.`);
        updateFormEntry(idx, "category", val);
        setActiveOtherField(null);
        setNewOtherVal("");
        setShowAllProjects(false);
        return;
      }
      // Store in local categories list only; DO NOT save category to TaskMeta module
      setCategories(prev => prev.includes(val) ? prev : [...prev, val]);
      updateFormEntry(idx, "category", val);
      setActiveOtherField(null);
      setNewOtherVal("");
      setShowAllProjects(false);
      return;
    } else if (type === "project") {
      val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
      const exists = fullProjects.some(p => p && (p.name || "").toLowerCase() === val.toLowerCase());
      if (exists) {
        toast.info(`"${val}" is already available.`);
        updateFormEntry(idx, "project", val);
        setActiveOtherField(null);
        setNewOtherVal("");
        return;
      }
    } else if (type === "page") {
      const catName = formEntries[idx]?.category;
      const projName = formEntries[idx]?.project;
      if (!catName || !projName) {
        return toast.error("Please select Category and Project first");
      }
      const existingProjectPages = getPagesForProject(catName, projName);
      const exists = existingProjectPages.some(p => (p || "").toLowerCase() === val.toLowerCase());
      if (exists) {
        const matchingPage = existingProjectPages.find(p => (p || "").toLowerCase() === val.toLowerCase()) || val;
        setFormEntries(prev => {
          const updated = [...prev];
          const currentPages = updated[idx]?.pages || [];
          if (!currentPages.includes(matchingPage)) {
            updated[idx] = { ...updated[idx], pages: [...currentPages, matchingPage] };
          }
          return updated;
        });
        toast.info(`"${matchingPage}" is already available in the dropdown.`);
        setActiveOtherField(null);
        setNewOtherVal("");
        return;
      }
    }

    try {
      if (type === "project") {
        const catName = formEntries[idx].category;
        if (!catName) return toast.error("Please select a category first");
        const catObj = fullCategories.find(c => (c.name || "").toUpperCase() === (catName || "").toUpperCase());
        await portalInstance.post("/creat/task-meta/project", {
          name: val,
          categoryId: catObj?._id,
          categoryName: catName
        });
        await fetchMeta();
        updateFormEntry(idx, type, val);
      } else if (type === "page") {
        const catName = formEntries[idx]?.category;
        const projName = formEntries[idx]?.project;
        const res = await portalInstance.post("/creat/task-meta/page", {
          category: catName,
          project: projName,
          name: val
        });
        if (res.data?.success && res.data.data) {
          const updatedPages = res.data.data.pages || [val];
          setProjectPages(prev => {
            const normCat = (catName || "").trim().toLowerCase();
            const normProj = (projName || "").trim().toLowerCase();
            const existing = prev.find(
              pp =>
                (pp.category || "").trim().toLowerCase() === normCat &&
                (pp.project || "").trim().toLowerCase() === normProj
            );
            if (existing) {
              return prev.map(pp =>
                (pp.category || "").trim().toLowerCase() === normCat &&
                  (pp.project || "").trim().toLowerCase() === normProj
                  ? { ...pp, pages: updatedPages }
                  : pp
              );
            } else {
              return [...prev, { category: catName, project: projName, pages: updatedPages }];
            }
          });
        }
        await fetchMeta();
        setFormEntries(prev => {
          const updated = [...prev];
          const currentPages = updated[idx]?.pages || [];
          if (!currentPages.includes(val)) {
            updated[idx] = { ...updated[idx], pages: [...currentPages, val] };
          }
          return updated;
        });
      }

      setActiveOtherField(null);
      setNewOtherVal("");
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} "${val}" added!`);
    } catch (err) {
      if (err.response?.status === 409) {
        toast.info(`"${val}" already exists in the dropdown.`);
        await fetchMeta();
        if (type === "page") {
          setFormEntries(prev => {
            const updated = [...prev];
            const currentPages = updated[idx]?.pages || [];
            if (!currentPages.includes(val)) {
              updated[idx] = { ...updated[idx], pages: [...currentPages, val] };
            }
            return updated;
          });
        }
        setActiveOtherField(null);
        setNewOtherVal("");
      } else {
        toast.error(err.response?.data?.message || `Failed to add ${type}`);
      }
    }
  };

  const resetCreateForm = () => {
    setFormEntries([emptyEntry()]);
    setEditingUpdate(null);
    setIsPointByPoint(false);
    setActiveOtherField(null);
    setNewOtherVal("");
    setShowAllProjects(false);
  };

  const handleExport = () => {
    if (updates.length === 0) return toast.info("No data to export");
    try {
      const headers = ['S.No', 'Date', 'Category', 'Project', 'Task Title', 'Work Description', 'Status', 'Working Days', 'Overall Task Days'];

      // Dynamic Width Calculation
      const baseWidth = 7;
      const colWidths = [40, 100, 120, 140, 200, 400, 100, 120, 140];

      updates.forEach(u => {
        const title = u.task?.taskTitle || "N/A";
        const note = u.description || u.phase || u.note || "N/A";
        if (title.length * baseWidth > colWidths[4]) colWidths[4] = Math.min(title.length * baseWidth, 300);
        if (note.length * (baseWidth * 0.4) > colWidths[5]) colWidths[5] = Math.min(note.length * (baseWidth * 0.4), 500);
      });

      const xmlStyles = `
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
 </Styles>`;

      const escape = (str) => String(str).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 ${xmlStyles}
 <Worksheet ss:Name="My Updates">
  <Table>
   ${colWidths.map(w => `<Column ss:Width="${w}"/>`).join('')}
   <Row ss:Height="25">
    ${headers.map(h => `<Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>`).join('')}
   </Row>
   ${updates.map((u, i) => `
   <Row>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${i + 1}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(formatDate(u.updateDate))}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(u.task?.category || u.category || "—")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(u.task?.project || u.project || "—")}</Data></Cell>
    <Cell ss:StyleID="CellTitle"><Data ss:Type="String">${escape(u.title || u.task?.taskTitle || "N/A")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(u.description || "—")}</Data></Cell>
    <Cell ss:StyleID="CellBold"><Data ss:Type="String">${escape(u.status || "Pending")}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape((u.workingDays !== undefined && u.workingDays !== null && u.workingDays > 0) ? String(u.workingDays) : (u.phaseWorkingDays ? String(u.phaseWorkingDays) : "1"))}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escape(u.overallTaskWorkingDays !== undefined && u.overallTaskWorkingDays !== null ? String(u.overallTaskWorkingDays) : "—")}</Data></Cell>
   </Row>`).join('')}
  </Table>
 </Worksheet>
</Workbook>`;

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `My_Work_Updates_${new Date().toISOString().split('T')[0]}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Excel Downloaded!");
    } catch (error) { toast.error("Export failed"); }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    if (typeof dateStr === "string" && dateStr.includes("T")) {
      const datePart = dateStr.split("T")[0];
      const parts = datePart.split("-");
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const renderDescription = (desc) => {
    if (!desc || !desc.trim()) return "—";

    let lines = [];
    if (desc.includes("\n")) {
      lines = desc.split("\n").map(l => l.trim()).filter(Boolean);
    } else if (/(?:^|\s)1[\.\)]\s+.*(?:\s)2[\.\)]\s+/.test(desc)) {
      lines = desc.split(/(?=(?:^|\s)\d+[\.\)]\s+)/).map(l => l.trim()).filter(Boolean);
    } else {
      lines = [desc.trim()];
    }

    if (lines.length > 1) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", textAlign: "left" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ lineHeight: "1.45", wordBreak: "break-word" }}>
              {line}
            </div>
          ))}
        </div>
      );
    }

    return <div style={{ whiteSpace: "pre-line", wordBreak: "break-word", lineHeight: "1.45", textAlign: "left" }}>{desc}</div>;
  };

  return (
    <>
      <Sidebar />
      <div className="common-container">
        <div className="dwu-emp-root">
          <header className="dwu-emp__header">
            <div className="d-flex justify-content-between align-items-center flex-wrap mb-1" style={{ gap: "12px" }}>
              <div>
                <h4 className="assign-task__members-title mt-0 mb-1">My Daily Updates</h4>
              </div>
              <div className="d-flex align-items-center  mt-0 " style={{ gap: "12px" }}>
                {/* 0. Pending Reminders Toggle Icon (Left side of Filter Icon) */}
                <div>
                  <div
                    className={`dwu-pending-toggle-icon ${showPendingBanner ? "active" : ""}`}
                    onClick={() => {
                      if (!pendingReminders || pendingReminders.length === 0) {
                        toast.info("No pending work reminders from previous days.");
                        return;
                      }
                      setShowPendingBanner(prev => !prev);
                    }}
                    title={
                      pendingReminders && pendingReminders.length > 0
                        ? `${pendingReminders.length} Pending Work Reminder${pendingReminders.length > 1 ? "s" : ""}`
                        : "No Pending Work Reminders"
                    }
                  >
                    <Clock size={20} />
                    {pendingReminders && pendingReminders.length > 0 && (
                      <span className="dwu-pending-count-badge">
                        {pendingReminders.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* 1. Filter Button with Label */}
                <div>
                  <div
                    className={`dwu-employee-filter-icon ${showFilterMenu ? "active" : ""}`}
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    title="Toggle Filters"
                  >
                    <img src={FilterIconImg} alt="filter" />
                  </div>
                </div>

                {/* 2. New Update Button with Label */}
                <div className="d-flex flex-column align-items-center" style={{ gap: '2px' }}>
                  <div
                    className="dwu-header-action-icon "
                    onClick={() => { resetCreateForm(); setRecentSaves([]); setShowCreateModal(true); }}
                    title="New Update"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <button style={{
                      color: '#ffff', background: '#5977f8', borderRadius: "6px",
                      height: "32px",
                      width: "120px",
                      fontSize: "11px",
                      fontWeight: " 500", border: "none"

                    }}>Add</button>
                  </div>
                </div>

                {/* Page Per Record Dropdown (Left side of Download Excel) */}
                <div className="dwu-page-size-wrap" title="Records per page">
                  <CustomDropdown
                    options={PAGE_SIZE_OPTIONS}
                    value={pageSize}
                    onChange={(val) => {
                      setPageSize(Number(val));
                      setCurrentPage(1);
                    }}
                    className="ta-page-size-dropdown"
                    placeholder="5"
                  />
                </div>

                {/* 3. Excel Button */}
                <Button
                  variant="outline-success"
                  className="excel-export-btn"
                  onClick={handleExport}
                >
                  Download Excel
                </Button>
              </div>
            </div>
          </header>

          {showFilterMenu && (
            <div className="dwu-filter-row animate-slide-down mb-4" ref={filterRef} style={{ padding: '20px', borderRadius: '12px', background: '#ffffff', marginTop: '20px' }}>
              <div className="row g-3 align-items-end">
                {/* 1. Timeframe */}
                <div className="col-12 col-md">
                  <label className="dwu-filter-label">Date Range</label>
                  <CustomDropdown options={DATE_MODE_OPTIONS} value={dateMode} onChange={setDateMode} />
                </div>

                {/* 2. Custom/Specific Dates */}
                {(dateMode === "Custom" || dateMode === "Specific") && (
                  <>
                    <div className="col-12 col-md">
                      <label className="dwu-filter-label">{dateMode === "Specific" ? "Date" : "From"}</label>
                      <div className="dwu-custom-date-picker-wrap">
                        <input
                          ref={fromDateRef}
                          type="date"
                          className="dwu-date-input"
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
                      <div className="col-12 col-md">
                        <label className="dwu-filter-label">To</label>
                        <div className="dwu-custom-date-picker-wrap">
                          <input
                            ref={toDateRef}
                            type="date"
                            className="dwu-date-input"
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

                {/* 3. Category */}
                <div className="col-12 col-md">
                  <label className="dwu-filter-label">Category</label>
                  <CustomDropdown options={[{ value: "", label: "All" }, ...categories.filter(c => c && c.toLowerCase() !== "add").map(c => ({ value: c, label: (c || "").toUpperCase() }))]} value={category} onChange={(v) => { setCategory(v); setProject(""); }} />
                </div>

                {/* 4. Project */}
                <div className="col-12 col-md">
                  <label className="dwu-filter-label">Project</label>
                  <CustomDropdown options={[{ value: "", label: "All" }, ...projects.filter(p => p && p.toLowerCase() !== "add").map(p => ({ value: p, label: p ? (p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()) : p }))]} value={project} onChange={setProject} />
                </div>

                {/* 5. Actions */}
                <div className="col-12 d-flex justify-content-end mt-2">
                  <div className="d-flex gap-4 mt-2">
                    <button className="hrms-common-btn-cancel " onClick={handleReset} >Cancel</button>
                    <button className="hrms-common-btn-primary" onClick={handleSearch} >Search</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <section className="dwu-emp__panel ">
            {/* Reminder indication for Pending / In Progress / On Hold updates from previous days */}
            {showPendingBanner && pendingReminders && pendingReminders.length > 0 && (
              <div className="dwu-reminder-banner animate-fade-in mb-3">
                <div className="dwu-reminder-banner__header d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <div>
                      <h6 className="dwu-reminder-heading mb-0">Previous Pending Work Reminders</h6>
                      <span className="dwu-reminder-subheading">
                        You have {pendingReminders.length} unfinished {pendingReminders.length === 1 ? "work update" : "work updates"} from previous days. Click <strong>Edit</strong> to update details and save for today.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dwu-page-confirm-close-btn"
                    onClick={() => setShowPendingBanner(false)}
                    title="Close reminders banner"
                    style={{ position: "static", width: "24px", height: "24px", fontSize: "13px" }}
                  >
                    ✕
                  </button>
                </div>

                <div className="dwu-reminder-items-grid">
                  {pendingReminders.map((item) => {
                    const getRawTaskId = (it) => {
                      if (!it) return null;
                      if (it.task?._id && it.task._id !== "standalone") return String(it.task._id?._id || it.task._id);
                      if (it.task && typeof it.task === "string" && it.task !== "standalone") return String(it.task);
                      if (it.task_id && it.task_id !== "standalone") return String(it.task_id?._id || it.task_id);
                      if (it.taskId && it.taskId !== "standalone") return String(it.taskId);
                      return null;
                    };
                    const targetTaskId = getRawTaskId(item);
                    const isTaskPhase = Boolean(
                      targetTaskId && !item.isNewTask && (item.phaseId || item.taskPhaseId || item.referenceId)
                    );

                    return (
                      <div key={item._id} className="dwu-reminder-item-card">
                        <div className="dwu-reminder-item-content">
                          <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                            <div className="d-flex flex-column gap-1 overflow-hidden" style={{ flex: 1 }}>
                              <div className="d-flex align-items-center gap-2 overflow-hidden flex-wrap">
                                <strong
                                  className="dwu-reminder-item-title"
                                  title={isTaskPhase ? (item.task?.taskTitle || item.title || "N/A") : (item.title || item.task?.taskTitle || "N/A")}
                                >
                                  {isTaskPhase ? (item.task?.taskTitle || item.title || "N/A") : (item.title || item.task?.taskTitle || "N/A")}
                                </strong>
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
                              {isTaskPhase && item.title && (
                                <div style={{ fontSize: "11px", color: "#4f46e5", fontWeight: 600 }}>
                                  <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "normal", marginRight: "4px" }}>Phase {getPhaseNumber(item, pendingReminders)}:</span>
                                  {item.title}
                                </div>
                              )}
                            </div>
                            <span className={`employeeTaskPage__statusBadge employeeTaskPage__badge--status-${getStatusKey(item.status || item.phaseStatus)}`}>
                              {getStatusLabel(item.status || item.phaseStatus)}
                            </span>
                          </div>

                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-2">
                            <div className="d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: "11px", color: "#64748b" }}>
                              {(item.task?.category || item.category) && (
                                <span className="dwu-reminder-tag">
                                  {(item.task?.category || item.category || "").toUpperCase()}
                                  {(item.task?.project || item.project) ? ` / ${item.task?.project || item.project}` : ""}
                                </span>
                              )}
                              <span style={{ color: "#94a3b8" }}>•</span>
                              <span>{formatDate(item.updateDate || item.createdAt)}</span>
                            </div>

                            {isTaskPhase ? (
                              <button
                                type="button"
                                className="dwu-reminder-edit-action-btn"
                                onClick={() => {
                                  if (targetTaskId) {
                                    navigate("/emp/tasks", { state: { selectedTaskId: targetTaskId } });
                                  } else {
                                    navigate("/emp/tasks");
                                  }
                                }}
                                title="Go to Task to update, edit or delete this phase"
                              >
                                <span>Task</span>
                                <ExternalLink size={12} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="dwu-reminder-edit-action-btn"
                                onClick={() => handleEditClick(item)}
                                title="Edit this work update and save for today"
                              >
                                <Edit2 size={13} />
                                <span>Edit</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="employeeTaskPage__tableCard mt-2">
              <div className="table-responsives">
                <div className="employeeTaskPage__table">
                  {loading ? (
                    <div className="employeeTaskPage__tableEmpty">Fetching data...</div>
                  ) : paginatedDisplayUpdates.length === 0 ? (
                    <div className="employeeTaskPage__tableEmpty">No updates found.</div>
                  ) : (
                    paginatedDisplayUpdates.map((u, idx) => {
                      const getRawTaskId = (it) => {
                        if (!it) return null;
                        if (it.task?._id && it.task._id !== "standalone") {
                          return typeof it.task._id === "object" ? (it.task._id._id || it.task._id.toString()) : String(it.task._id);
                        }
                        if (it.task && typeof it.task === "string" && it.task !== "standalone") return String(it.task);
                        if (it.task_id && it.task_id !== "standalone") {
                          return typeof it.task_id === "object" ? (it.task_id._id || it.task_id.toString()) : String(it.task_id);
                        }
                        if (it.taskId && it.taskId !== "standalone") return String(it.taskId);
                        return null;
                      };

                      const targetTaskId = getRawTaskId(u);
                      const isTaskPhase = Boolean(
                        targetTaskId && !u.isNewTask && (u.phaseId || u.taskPhaseId || u.referenceId || (u.task?.phases && u.task.phases.length > 0) || u.phase)
                      );
                      const phaseNum = getPhaseNumber(u, updates);
                      const phaseTitle = isTaskPhase
                        ? (u.title || u.phase || (u.task?.phases ? u.task.phases.find(p => String(p._id) === String(u.phaseId || u.taskPhaseId || u.referenceId))?.phaseTitle : null) || `Phase ${phaseNum}`)
                        : null;
                      const taskTitle = u.task?.taskTitle || "";
                      const pagesList = ((u.pages && u.pages.length > 0) ? u.pages : (u.task?.pages && u.task.pages.length > 0 ? u.task.pages : []));
                      const workType = u.workType || u.task?.workType;
                      const categoryName = u.task?.category || u.category || "—";
                      const projectName = (() => {
                        const p = u.task?.project || u.project;
                        return p ? (p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()) : "—";
                      })();

                      return (
                        <div
                          key={u._id}
                          className="employeeTaskPage__tableRow dwu-card-row"
                        >
                          {/* ── Top Meta Grid (S.NO, Category, Project, Status, Action) ── */}
                          <div className="dwu-card-meta-grid">
                            <div className="dwu-card-meta-col employeeTaskPage__col--sno">
                              <span className="dwu-card-meta-label">S.NO</span>
                              <span className="dwu-card-meta-value dwu-card-sno-val">
                                {(currentPage - 1) * pageSize + idx + 1}
                              </span>
                            </div>

                            <div className="dwu-card-meta-col employeeTaskPage__col--catproj">
                              <span className="dwu-card-meta-label">Category</span>
                              <span className="dwu-card-meta-value">
                                {categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}
                              </span>
                            </div>

                            <div className="dwu-card-meta-col employeeTaskPage__col--project">
                              <span className="dwu-card-meta-label">Project</span>
                              <span className="dwu-card-meta-value" style={{ whiteSpace: "nowrap" }}>
                                {projectName}
                              </span>
                            </div>

                            <div className="dwu-card-meta-col employeeTaskPage__col--workingdays">
                              <span className="dwu-card-meta-label">Working Days</span>
                              <span className="dwu-card-meta-value" style={{ color: "#2563eb", fontWeight: 600 }}>
                                {(u.workingDays !== undefined && u.workingDays !== null && u.workingDays > 0)
                                  ? `${u.workingDays} ${u.workingDays === 1 ? 'day' : 'days'}`
                                  : (u.phaseWorkingDays !== undefined && u.phaseWorkingDays !== null && u.phaseWorkingDays > 0)
                                    ? `${u.phaseWorkingDays} ${u.phaseWorkingDays === 1 ? 'day' : 'days'}`
                                    : "1 day"}
                              </span>
                            </div>

                            <div className="dwu-card-meta-col employeeTaskPage__col--status">
                              <span className="dwu-card-meta-label">Status</span>
                              <div className="dwu-card-meta-value">
                                <span className={`employeeTaskPage__statusBadge employeeTaskPage__badge--status-${getStatusKey(u.status || u.phaseStatus)}`}>
                                  {getStatusLabel(u.status || u.phaseStatus)}
                                </span>
                              </div>
                            </div>

                            <div className="dwu-card-meta-col employeeTaskPage__col--action">
                              <span className="dwu-card-meta-label">Action</span>
                              <div className="dwu-card-meta-value dwu-card-actions-wrapper">
                                {isTaskPhase ? (
                                  <button
                                    type="button"
                                    className="dwu-row-navigate-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (targetTaskId && !targetTaskId.startsWith("title:")) {
                                        navigate("/emp/tasks", { state: { selectedTaskId: targetTaskId } });
                                      } else {
                                        navigate("/emp/tasks");
                                      }
                                    }}
                                    title="Go to Task to update, edit or delete this phase"
                                  >
                                    <span>Task</span>
                                    <ExternalLink size={12} />
                                  </button>
                                ) : !isTodayUpdate(u.updateDate || u.createdAt) ? (
                                  <span
                                    className="dwu-row-locked-icon"
                                    title="Work updates from previous days cannot be edited or deleted"
                                  >
                                    <Lock size={15} />
                                  </span>
                                ) : (
                                  <>
                                    <div
                                      className="dwu-row-edit-icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClick(u);
                                      }}
                                      title="Edit Update"
                                    >
                                      <Edit2 size={15} />
                                    </div>

                                    <div
                                      className="dwu-row-delete-icon"
                                      onClick={(e) => handleDeleteUpdate(e, u._id)}
                                      title="Delete Update"
                                    >
                                      <Trash2 size={15} />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* ── Card Divider ── */}
                          <div className="dwu-card-divider" />

                          {/* ── Content Section ── */}
                          <div className="dwu-card-body-section">
                            {isTaskPhase ? (
                              <>
                                {/* Phase Title & Task Origin Indication */}
                                <div className="dwu-card-field-block">
                                  <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                    <span className="dwu-card-field-label" style={{ marginBottom: 0 }}>
                                      Phase {phaseNum} Title
                                    </span>
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        fontSize: "10.5px",
                                        fontWeight: "500",
                                        color: "#5977f8",
                                        background: "#eef2ff",
                                        border: "1px solid #c7d2fe",
                                        borderRadius: "4px",
                                        padding: "1px 6px",
                                        lineHeight: "14px"
                                      }}
                                      title="This work update comes from a Task Phase"
                                    >
                                      Task Phase
                                    </span>
                                    {/* {taskTitle && (
                                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "500", marginLeft: "6px" }} title={`Originating Task: ${taskTitle}`}>
                                        Task: <span style={{ color: "#475569", fontWeight: "500" }}>{taskTitle}</span>
                                      </span>
                                    )} */}
                                  </div>
                                  <div className="dwu-card-field-title">
                                    {phaseTitle}
                                  </div>
                                </div>

                                {/* Work Description */}
                                {u.description && u.description.trim() && (
                                  <div className="dwu-card-field-block">
                                    <span className="dwu-card-field-label">Description</span>
                                    <div className="dwu-card-field-desc employeeTaskPage__tableCell--description">
                                      {renderDescription(u.description)}
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="dwu-card-field-block">
                                  <div className="dwu-card-field-title dwu-card-field-title--standalone">
                                    {u.title || "N/A"}
                                  </div>
                                </div>

                                {u.description && u.description.trim() && (
                                  <div className="dwu-card-field-block">
                                    <div className="dwu-card-field-desc employeeTaskPage__tableCell--description">
                                      {renderDescription(u.description)}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            {/* ── Card Footer: Chips on left, Date on right ── */}
                            <div className="dwu-card-footer-row">
                              {(pagesList.length > 0 || workType) ? (
                                <div className="dwu-card-chips-row">
                                  {workType && (
                                    <span className="dwu-card-chip" title={formatWorkType(workType)}>
                                      {workType}
                                    </span>
                                  )}
                                  {pagesList.map((pName, pIdx) => (
                                    <span
                                      key={pIdx}
                                      className="dwu-card-chip"
                                      title={`Page: ${pName}`}
                                    >
                                      {pName}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div />
                              )}

                              <div className="dwu-card-date-badge" title="Work Update Date">
                                <span>{formatDate(u.updateDate || u.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <Pagination
                totalItems={totalItems}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageChange={(p) => setCurrentPage(p)}
                maxPagesInGroup={5}
              />
            </div>
          </section>
        </div>
      </div>

      {showCreateModal && (
        <div className="dwu-modal-overlay">
          <div className="dwu-modal-container animate-fade-in">
            <div className="dwu-modal-header d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="assign-task__members-title">
                    {editingUpdate ? "Edit Update" : "New Daily Update"}
                  </span>
                  <span className="dwu-modal-title-sep">|</span>
                  <span className="assign-task__members-title">
                    {formatDate(editingUpdate ? editingUpdate.updateDate : new Date())}
                  </span>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  className="hrms-common-close-btn"
                  onClick={() => setShowCreateModal(false)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="dwu-modal-body">
                {formEntries.slice(0, 1).map((entry, idx) => {
                  const isCategoryActive = !!entry.category && !(activeOtherField?.idx === idx && activeOtherField?.type === "category");
                  const categoryProjects = isCategoryActive
                    ? fullProjects.filter(p => (p.categoryId?.name || "").toUpperCase() === (entry.category || "").toUpperCase()).map(p => p.name)
                    : [];
                  const allUniqueProjects = Array.from(
                    new Set(fullProjects.map(p => p.name).filter(Boolean))
                  );
                  const activeProjectList = showAllProjects ? allUniqueProjects : categoryProjects;
                  const projectDropdownOptions = [
                    ...activeProjectList
                      .filter(p => p && p.toLowerCase() !== "add" && p.toLowerCase() !== "see all values")
                      .map(p => ({
                        value: p ? (p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()) : p,
                        label: p ? (p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()) : p
                      })),
                    ...(!showAllProjects ? [{ value: "See All Values", label: "See All Values", keepOpen: true }] : []),
                    { value: "Add", label: "Add" }
                  ];

                  return (
                    <div key={idx} className="dwu-form-entry position-relative">
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="dwu-meta-label">Category</label>
                          {activeOtherField?.idx === idx && activeOtherField?.type === "category" ? (
                            <div className="atMeta__inlineAdd animate-fade-in">
                              <input
                                type="text"
                                className="atMeta__addInput"
                                placeholder="NEW CATEGORY..."
                                value={newOtherVal}
                                autoFocus
                                style={{ textTransform: "uppercase" }}
                                onChange={(e) => setNewOtherVal(e.target.value.toUpperCase())}
                                onKeyDown={(e) => { if (e.key === "Enter") handleAddOther(idx, "category"); }}
                              />
                              <button type="button" className="atMeta__saveBtn" onClick={() => handleAddOther(idx, "category")}>Save</button>
                            </div>
                          ) : (
                            <CustomDropdown
                              options={[
                                ...categories.filter(c => c && c.toLowerCase() !== "add" && c.toLowerCase() !== "back").map((c) => ({
                                  value: c ? c.toUpperCase() : c,
                                  label: (c || "").toUpperCase()
                                })),
                                ...(entry.category ? [{ value: "Back", label: "Back" }] : []),
                                { value: "Add", label: "Add" }
                              ]}
                              value={entry.category}
                              placeholder="Select Category"
                              onChange={(v) => handleCategoryToggle(idx, v)}
                            />
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="dwu-meta-label">Project</label>
                          {activeOtherField?.idx === idx && activeOtherField?.type === "project" ? (
                            <div className="atMeta__inlineAdd animate-fade-in">
                              <input
                                type="text"
                                className="atMeta__addInput"
                                placeholder="New project..."
                                value={newOtherVal}
                                autoFocus
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const formatted = v ? (v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()) : "";
                                  setNewOtherVal(formatted);
                                }}
                                onKeyDown={(e) => { if (e.key === "Enter") handleAddOther(idx, "project"); }}
                                disabled={!isCategoryActive}
                              />
                              <button type="button" className="atMeta__saveBtn" onClick={() => handleAddOther(idx, "project")} disabled={!isCategoryActive}>Save</button>
                            </div>
                          ) : (
                            <CustomDropdown
                              options={projectDropdownOptions}
                              value={entry.project}
                              placeholder={isCategoryActive ? "Select Project" : "Select Category First"}
                              onChange={(v) => handleProjectToggle(idx, v)}
                              disabled={!isCategoryActive}
                            />
                          )}
                        </div>
                        {isStackEligibleCategory(entry.category) && (
                          <div className="col-12 animate-fade-in">
                            <label className="dwu-meta-label mb-1">Work Type</label>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 1fr)",
                                gap: "8px",
                                width: "100%",
                                padding: "1px 0"
                              }}
                            >
                              {[
                                { value: "BE", title: "BE", desc: "Back End" },
                                { value: "FE", title: "FE", desc: "Front End" },
                                { value: "FE & BE", title: "FE & BE", desc: "Front & Back End" },
                                { value: "Design", title: "Design", desc: "Design" }
                              ].map((opt) => {
                                const isSelected = entry.workType === opt.value;
                                return (
                                  <div
                                    key={opt.value}
                                    onClick={() => updateFormEntry(idx, "workType", isSelected ? "" : opt.value)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      border: isSelected ? "1.5px solid #5977f8" : "1px solid #e2e8f0",
                                      background: isSelected ? "#f0f4ff" : "#ffffff",
                                      cursor: "pointer",
                                      transition: "all 0.2s ease",
                                      userSelect: "none",
                                      boxShadow: isSelected ? "0 1px 4px rgba(89, 119, 248, 0.1)" : "none"
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`workType_${idx}`}
                                      checked={isSelected}
                                      onChange={() => { }}
                                      style={{
                                        accentColor: "#5977f8",
                                        cursor: "pointer",
                                        width: "13px",
                                        height: "13px",
                                        margin: 0,
                                        flexShrink: 0,
                                        pointerEvents: "none"
                                      }}
                                    />
                                    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          fontWeight: isSelected ? "600" : "500",
                                          color: isSelected ? "#5977f8" : "#2d3748"
                                        }}
                                      >
                                        {opt.title}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "9px",
                                          color: isSelected ? "#5977f8" : "#8c9ba5",
                                          marginTop: "1px",
                                          fontWeight: "400"
                                        }}
                                      >
                                        {opt.desc}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {/* Pages Radio Button & Multi-select Section */}
                        <div className="col-12">
                          <div className="dwu-pages-radio-wrapper" style={{ display: "flex", alignItems: "center", margin: "6px 0 2px 0" }}>
                            <label
                              className="dwu-pages-radio-label"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: "500",
                                color: "#334155",
                                lineHeight: "1",
                                userSelect: "none"
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                handleTogglePagesRadio(idx);
                              }}
                            >
                              <input
                                type="radio"
                                name={`pagesRadio_${idx}`}
                                checked={!!entry.hasPages}
                                readOnly
                                style={{
                                  accentColor: "#5977f8",
                                  width: "16px",
                                  height: "16px",
                                  margin: 0,
                                  cursor: "pointer",
                                  flexShrink: 0,
                                  pointerEvents: "none"
                                }}
                              />
                              <span style={{ display: "inline-block", lineHeight: "1", verticalAlign: "middle" }}>
                                Pages
                              </span>
                            </label>
                          </div>
                        </div>

                        {entry.hasPages && (
                          <div className="col-12 animate-fade-in">
                            <label className="dwu-meta-label">Select Page</label>
                            {activeOtherField?.idx === idx && activeOtherField?.type === "page" ? (
                              <div className="atMeta__inlineAdd animate-fade-in">
                                <input
                                  type="text"
                                  className="atMeta__addInput"
                                  placeholder="New page name..."
                                  value={newOtherVal}
                                  autoFocus
                                  onChange={(e) => setNewOtherVal(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleAddOther(idx, "page"); }}
                                  disabled={!entry.project}
                                />
                                <button
                                  type="button"
                                  className="atMeta__saveBtn"
                                  onClick={() => handleAddOther(idx, "page")}
                                  disabled={!entry.project}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    background: "#f1f5f9",
                                    border: "none",
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    color: "#475569",
                                    marginLeft: "4px",
                                    cursor: "pointer"
                                  }}
                                  onClick={() => {
                                    setActiveOtherField(null);
                                    setNewOtherVal("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <CustomDropdown
                                options={[
                                  ...getPagesForProject(entry.category, entry.project).filter(p => p && p.toLowerCase() !== "add").map(p => ({
                                    value: p,
                                    label: p,
                                    onDelete: () => handlePromptDeleteProjectPage(p, entry.category, entry.project, idx)
                                  })),
                                  { value: "Add", label: "Add" }
                                ]}
                                value=""
                                placeholder={entry.project ? "Select Page" : "Select Project First"}
                                onChange={(v) => handlePageSelect(idx, v)}
                                disabled={!entry.project}
                              />
                            )}

                            {/* Selected pages separate cards */}
                            {Array.isArray(entry.pages) && entry.pages.length > 0 && (
                              <div className="dwu-selected-pages-container">
                                {entry.pages.map((pName) => (
                                  <div key={pName} className="dwu-page-card">
                                    <span className="dwu-page-card-name">{pName}</span>
                                    <button
                                      type="button"
                                      className="dwu-page-card-delete-btn"
                                      title={`Remove ${pName}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handlePromptDeletePage(idx, pName);
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="col-md-8 ">
                          <label className="dwu-meta-label">Task Title</label>
                          <input
                            type="text"
                            className="form-control"
                            value={entry.title}
                            onChange={(e) => updateFormEntry(idx, "title", e.target.value)}
                            placeholder="Task Name"
                          />
                        </div>
                        <div className="col-md-4 ">
                          <label className="dwu-meta-label">Status</label>
                          <CustomDropdown
                            options={[
                              { value: "pending", label: "Pending" },
                              { value: "inprocess", label: "In Process" },
                              { value: "hold", label: "On Hold" },
                              { value: "completed", label: "Completed" }
                            ]}
                            value={entry.status}
                            onChange={(v) => updateFormEntry(idx, "status", v)}
                          />
                        </div>
                        <div className="col-12 ">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <label className="dwu-meta-label mb-0">Description</label>

                            <label
                              className="d-flex align-items-center gap-1"
                              onClick={(e) => {
                                e.preventDefault();
                                handleTogglePointByPoint(idx);
                              }}
                              style={{
                                fontSize: "11px",
                                fontWeight: "500",
                                color: isPointByPoint ? "#5977f8" : "#77728e",
                                cursor: "pointer",
                                userSelect: "none",
                                margin: 0
                              }}
                              title="Format description as bullet points (• Point)"
                            >
                              <input
                                type="radio"
                                name={`descFormatMode-${idx}`}
                                checked={isPointByPoint}
                                readOnly
                                tabIndex={-1}
                                style={{
                                  cursor: "pointer",
                                  accentColor: "#5977f8",
                                  width: "13px",
                                  height: "13px",
                                  margin: 0,
                                  pointerEvents: "none"
                                }}
                              />
                              <span>Point by Point</span>
                            </label>

                          </div>
                          <textarea
                            className="form-control"
                            rows="3"
                            value={entry.description}
                            onChange={(e) => updateFormEntry(idx, "description", e.target.value)}
                            onKeyDown={(e) => handleDescriptionKeyDown(e, idx)}
                            onPaste={(e) => handleDescriptionPaste(e, idx)}
                            placeholder={isPointByPoint ? "• Enter first point..." : "Detailed work summary..."}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "end", paddingTop: "15px", gap: "10px" }}>
                <button type="button" className="hrms-common-btn-cancel " onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="hrms-common-btn-primary" disabled={createLoading}>{createLoading ? "Saving..." : "Save Updates"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ToastContainer
        position="top-right"
      />
      {showDeleteConfirm && (
        <div className="dwu-delete-overlay">
          <div className="dwu-delete-modal animate-fade-in" onClick={e => e.stopPropagation()}>

            <h3 className="dwu-delete-title">Delete Update?</h3>
            <p className="dwu-delete-message">
              This work update will be permanently deleted.<br />
              This action cannot be undone.
            </p>
            <div className="dwu-delete-buttons">
              <button className="hrms-common-btn-cancel " onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="hrms-common-btn-delete" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showPageDeleteConfirm && (
        <div className="dwu-page-confirm-overlay" onClick={() => setShowPageDeleteConfirm(false)}>
          <div className="dwu-page-confirm-modal animate-fade-in" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="dwu-page-confirm-close-btn"
              onClick={() => setShowPageDeleteConfirm(false)}
              title="Close"
              aria-label="Close"
            >
              ✕
            </button>
            <h3 className="dwu-page-confirm-title">Remove Selected Page?</h3>
            <p className="dwu-page-confirm-text">
              Are you sure you want to remove <strong>"{pageToDelete?.pageName}"</strong> from this work update?
            </p>
            <div className="dwu-page-confirm-actions">
              <button
                type="button"
                className="hrms-common-btn-cancel"
                onClick={() => setShowPageDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hrms-common-btn-delete"
                onClick={confirmDeletePage}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {pageToDeleteFromProject && (
        <div className="dwu-page-confirm-overlay" onClick={() => setPageToDeleteFromProject(null)} style={{ zIndex: 30000 }}>
          <div className="dwu-page-confirm-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ background: "#ffffff", padding: "20px 24px", borderRadius: "16px", width: "90%", maxWidth: "340px", textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", position: "relative" }}>
            <button
              type="button"
              className="dwu-page-confirm-close-btn"
              onClick={() => setPageToDeleteFromProject(null)}
              title="Close"
              aria-label="Close"
            >
              ✕
            </button>
            <h3 className="dwu-page-confirm-title" style={{ fontSize: "16px", fontWeight: "600", color: "#1e293b", marginBottom: "8px" }}>Delete Page?</h3>
            <p className="dwu-page-confirm-text" style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.5", marginBottom: "20px" }}>
              Are you sure you want to delete <strong>"{pageToDeleteFromProject.pageName}"</strong>? This will permanently delete it from project <strong>"{pageToDeleteFromProject.project}"</strong>.
            </p>
            <div className="dwu-page-confirm-actions" style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                className="hrms-common-btn-cancel"
                onClick={() => setPageToDeleteFromProject(null)}
                style={{ flex: 1, padding: "8px 16px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hrms-common-btn-delete"
                onClick={confirmDeleteProjectPage}
                style={{ flex: 1, padding: "8px 16px" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dwu-delete-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 20000;
        }
        .dwu-delete-modal {
          background: #ffffff;
          padding: 15px;
          border-radius: 16px;
          width: 90%;
          max-width: 330px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }
        .dwu-delete-title {
          font-size: 15px;
          font-weight: 500;
          color: #3a466d;
          margin-bottom: 12px;
        }
        .dwu-delete-message {
          font-size: 14px;
          color: #4a5568;
          line-height: 1.6;
          margin-bottom: 25px;
        }
        .dwu-delete-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .dwu-delete-btn {
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          min-width: 130px;
        }
        .dwu-delete-btn--cancel {
          background: #f7fafc;
          color: #4a5568;
          border: 1px solid #e2e8f0;
        }
        .dwu-delete-btn--cancel:hover {
          background: #edf2f7;
        }
        .dwu-delete-btn--confirm {
          background: #ff4d4f;
          color: #ffffff;
        }
        .dwu-delete-btn--confirm:hover {
          background: #ff7875;
          box-shadow: 0 4px 12px rgba(255, 77, 79, 0.3);
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
};

export default EmployeeDailyWorkUpdate;

import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { portalInstance } from "../../../Services/instance";
import { ToastContainer, toast } from "react-toastify";
import Sidebar from "../../HeaderSidebar/Sidebar";
import "../AdminLeaveRequest/AdminLeaveRequest.css";
import "../AdminLeaveRequest/AdminLeaveRequestModal.css";
import "../../Employee/EmployeeAttendance/AttendancePage.css";
import CustomDropdown from "../../Common/CustomDropdown";
import ApprovalBanner from "../../Common/ApprovalBanner";
import { Icon } from "@iconify/react";
import { useUser } from "../../UserContext";
import "../../Todolist/Todolist.css";
import "./Leavemanagement.css";

const LeaveManagement = () => {
  const location = useLocation();
  const getCurrentFinancialYear = (date = new Date()) => {
    const d = new Date(date);
    const month = d.getMonth();
    const year = d.getFullYear();
    return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(
    location.state?.targetYear || getCurrentFinancialYear()
  );
  const [yearStatus, setYearStatus] = useState("pending");
  const [isReviewed, setIsReviewed] = useState(false);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [submittingToAdmin, setSubmittingToAdmin] = useState(false);
  const [approvingYear, setApprovingYear] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [reminderNotifications, setReminderNotifications] = useState([]);
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [catToDeleteId, setCatToDeleteId] = useState(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [prevYearHasData, setPrevYearHasData] = useState(false);
  const categoryCacheRef = useRef({});

  const { user } = useUser() || {};
  const storedUser = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
  const isHrUser = (user?.role || storedUser?.role) === "employee" || Boolean(user?.isHr ?? storedUser?.isHr);
  const isAdminUser = (user?.role || storedUser?.role) === "admin";

  const [userPermissions, setUserPermissions] = useState(() => {
    return user?.permissions || storedUser?.permissions || [];
  });

  useEffect(() => {
    const fetchLatestPermissions = async () => {
      try {
        const res = await portalInstance.get("/profile/get-profile");
        if (res.data?.data?.permissions) {
          setUserPermissions(res.data.data.permissions);
          const updated = {
            ...storedUser,
            ...res.data.data,
            permissions: res.data.data.permissions,
          };
          sessionStorage.setItem("Erti-Portal", JSON.stringify(updated));
        }
      } catch (e) {
        console.error("Failed to fetch user permissions in LeaveManagement:", e);
      }
    };
    fetchLatestPermissions();
  }, []);

  const canWrite = React.useMemo(() => {
    const activeRole = user?.role || storedUser?.role;
    if (activeRole === "admin") return true;

    const perms = userPermissions && userPermissions.length > 0
      ? userPermissions
      : (user?.permissions || storedUser?.permissions || []);

    const clean = (str) =>
      (str || "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/leaves/g, "leave")
        .replace(/\s+/g, "")
        .replace(/-/g, "")
        .replace(/_/g, "");

    const targetMod = clean("Leaves & Holidays");
    const targetSub = clean("Manage Leaves");

    const matched = perms.find((p) => {
      const pMod = clean(p.module);
      if (pMod !== targetMod && !pMod.includes("leave")) return false;
      if (!p.subMenu) return true;
      const pSub = clean(p.subMenu);
      return (
        pSub === targetSub ||
        pSub === "manageleave" ||
        pSub === "manageleaves" ||
        pSub === "leavemanagement"
      );
    });

    if (matched) {
      const p = (matched.permission || "").toUpperCase();
      return p === "WRITE" || p === "BOTH" || p === "FULL_ACCESS";
    }

    const isHr = Boolean(user?.isHr ?? storedUser?.isHr);
    if (isHr) {
      return true;
    }

    return false;
  }, [user, storedUser, userPermissions]);

  const getPreviousFinancialYear = (yearStr) => {
    if (!yearStr || !yearStr.includes("-")) return "";
    const parts = yearStr.split("-");
    const start = parseInt(parts[0], 10);
    if (isNaN(start)) return "";
    return `${start - 1}-${start}`;
  };

  const createDefaultCategoryItem = (name = "") => ({
    name,
    isProbationTiered: false,
    probationAllLeaveCount: "",
    probationTiers: [
      { fromYear: "", fromMonth: "", toYear: "", toMonth: "", leaveCount: "" }
    ],
    probationOthersLeaveCount: "",

    isPermanentTiered: false,
    permanentAllLeaveCount: "",
    permanentTiers: [
      { fromYear: "", fromMonth: "", toYear: "", toMonth: "", leaveCount: "" }
    ],
    permanentOthersLeaveCount: "",
  });

  const [categoryItems, setCategoryItems] = useState([createDefaultCategoryItem()]);

  const getYearOptions = () => {
    const d = new Date();
    const currentYearNum = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    const options = [];
    for (let start = 2024; start <= currentYearNum; start++) {
      options.push(`${start}-${start + 1}`);
    }
    return options;
  };

  const fetchCategories = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        delete categoryCacheRef.current[selectedYear];
      }

      const cached = !forceRefresh ? categoryCacheRef.current[selectedYear] : null;
      if (cached) {
        setCategories(cached.categories);
        setYearStatus(cached.yearStatus);
        setIsReviewed(cached.isReviewed);
        setAdminRemarks(cached.adminRemarks);
        setPrevYearHasData(cached.prevYearHasData);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const prevYear = getPreviousFinancialYear(selectedYear);
      const reqUrl = isHrUser
        ? "/hr-approval/my-requests"
        : isAdminUser
        ? "/hr-approval/requests?targetModule=LEAVE_CATEGORY"
        : null;

      // Parallelize all network requests concurrently
      const [currYearRes, prevYearRes, hrReqRes] = await Promise.allSettled([
        portalInstance.get(`/leave-categories?year=${selectedYear}`),
        prevYear ? portalInstance.get(`/leave-categories?year=${prevYear}`) : Promise.resolve(null),
        reqUrl ? portalInstance.get(reqUrl) : Promise.resolve(null),
      ]);

      const res = currYearRes.status === "fulfilled" ? currYearRes.value : null;
      let liveList = res?.data?.data || res?.data || [];
      if (!Array.isArray(liveList)) liveList = [];
      const newYearStatus = res?.data?.status || "pending";
      const newIsReviewed = res?.data?.isReviewed || false;
      const newAdminRemarks = res?.data?.adminRemarks || "";

      setYearStatus(newYearStatus);
      setIsReviewed(newIsReviewed);
      setAdminRemarks(newAdminRemarks);

      // Check if previous financial year has data
      let newPrevYearHasData = false;
      if (prevYear && prevYearRes.status === "fulfilled" && prevYearRes.value) {
        const prevList = prevYearRes.value.data?.data || prevYearRes.value.data || [];
        newPrevYearHasData = Array.isArray(prevList) && prevList.length > 0;
      }
      setPrevYearHasData(newPrevYearHasData);

      let finalCategories = liveList;

      if (reqUrl && hrReqRes.status === "fulfilled" && hrReqRes.value) {
        const reqList = hrReqRes.value.data?.data || [];

        // 1. Pending/Rejected Create Requests
        const pendingCreateRows = [];
        reqList
          .filter(
            (r) =>
              r.targetModule === "LEAVE_CATEGORY" &&
              r.actionType === "CREATE_LEAVE_CATEGORY" &&
              r.status !== "APPROVED"
          )
          .forEach((r) => {
            if (Array.isArray(r.payload?.categories) && r.payload.categories.length > 0) {
              r.payload.categories.forEach((catItem, cIdx) => {
                pendingCreateRows.push({
                  _id: `pending_${r._id}_${cIdx}`,
                  requestId: r._id,
                  batchIndex: cIdx,
                  name: catItem.name || "New Category",
                  tiers: catItem.tiers || [],
                  probationOthersLeaveCount: catItem.probationOthersLeaveCount || 0,
                  permanentOthersLeaveCount: catItem.permanentOthersLeaveCount || 0,
                  leaveCount: catItem.tiers?.[0]?.leaveCount || catItem.leaveCount || 0,
                  eligibleMonths: catItem.tiers?.[0]?.eligibleMonths || 0,
                  isPendingHr: true,
                  hrStatus: r.status, // "PENDING" or "REJECTED"
                  adminNote: r.adminNote,
                });
              });
            } else {
              pendingCreateRows.push({
                _id: `pending_${r._id}`,
                requestId: r._id,
                name: r.payload?.name || "New Category",
                tiers: r.payload?.tiers || [],
                probationOthersLeaveCount: r.payload?.probationOthersLeaveCount || 0,
                permanentOthersLeaveCount: r.payload?.permanentOthersLeaveCount || 0,
                leaveCount: r.payload?.tiers?.[0]?.leaveCount || r.payload?.leaveCount || 0,
                eligibleMonths: r.payload?.tiers?.[0]?.eligibleMonths || 0,
                isPendingHr: true,
                hrStatus: r.status, // "PENDING" or "REJECTED"
                adminNote: r.adminNote,
              });
            }
          });

        // 2. Mark existing live categories with pending action
        const markedLiveList = liveList.map((cat) => {
          const pendingAction = reqList.find(
            (r) =>
              r.targetModule === "LEAVE_CATEGORY" &&
              (r.payload?.id === cat._id || r.payload?._id === cat._id) &&
              r.status === "PENDING"
          );
          if (pendingAction) {
            return {
              ...cat,
              hrStatus: "PENDING",
              pendingActionType: pendingAction.actionType,
            };
          }
          return { ...cat, hrStatus: "APPROVED" };
        });

        finalCategories = [...pendingCreateRows, ...markedLiveList];
      }

      setCategories(finalCategories);

      // Save into in-memory cache for instant switching
      categoryCacheRef.current[selectedYear] = {
        categories: finalCategories,
        yearStatus: newYearStatus,
        isReviewed: newIsReviewed,
        adminRemarks: newAdminRemarks,
        prevYearHasData: newPrevYearHasData,
      };
    } catch (err) {
      console.error(err);
      toast.error("Failed to load leave categories");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToAdmin = async () => {
    if (categories.length === 0) {
      toast.warning("Cannot submit an empty leave category list. Please add at least one category.");
      return;
    }
    try {
      setSubmittingToAdmin(true);
      const res = await portalInstance.post("/leave-categories/submit", { year: selectedYear });
      if (res.data?.success) {
        toast.success(`Leave categories for FY ${selectedYear} submitted to Admin for approval!`);
        fetchCategories(true);
      } else {
        toast.error(res.data?.message || "Failed to submit");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error submitting leave categories");
    } finally {
      setSubmittingToAdmin(false);
    }
  };

  const handleApproveYear = async () => {
    try {
      setApprovingYear(true);
      const res = await portalInstance.put("/leave-categories/approve", { year: selectedYear });
      if (res.data?.success) {
        toast.success(`Leave categories for FY ${selectedYear} approved successfully!`);
        fetchCategories(true);
      } else {
        toast.error(res.data?.message || "Failed to approve");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error approving leave categories");
    } finally {
      setApprovingYear(false);
    }
  };

  const handleRejectYear = async () => {
    const remarks = window.prompt("Enter rejection reason / feedback for HR (Mandatory):");
    if (remarks === null) return;
    if (!remarks.trim()) {
      toast.warning("Rejection remarks are required to reject the leave categories.");
      return;
    }
    try {
      setApprovingYear(true);
      const res = await portalInstance.post("/leave-categories/reject", {
        year: selectedYear,
        remarks: remarks.trim(),
      });
      if (res.data?.success) {
        toast.success(`Leave categories for FY ${selectedYear} rejected with feedback.`);
        fetchCategories(true);
      } else {
        toast.error(res.data?.message || "Failed to reject");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error rejecting leave categories");
    } finally {
      setApprovingYear(false);
    }
  };

  const handleUsePreviousYearData = async () => {
    try {
      setInitLoading(true);
      const res = await portalInstance.post("/leave-categories/init-draft", { year: selectedYear });
      if (res.data?.success) {
        toast.success(`Previous year leave categories copied for FY ${selectedYear}!`);
        fetchCategories(true);
      } else {
        toast.error(res.data?.message || "Failed to copy previous year data");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to copy previous year data");
    } finally {
      setInitLoading(false);
    }
  };

  const handleEditAndUploadNewData = async () => {
    try {
      setInitLoading(true);
      const prevYear = getPreviousFinancialYear(selectedYear);
      let itemsToLoad = [];
      if (prevYear) {
        const res = await portalInstance.get(`/leave-categories?year=${prevYear}`);
        const prevCategories = res.data?.data || res.data || [];
        if (Array.isArray(prevCategories) && prevCategories.length > 0) {
          itemsToLoad = prevCategories.map(convertCategoryToItem);
        }
      }
      setIsEdit(false);
      setCurrentId(null);
      if (itemsToLoad.length > 0) {
        setCategoryItems(itemsToLoad);
      } else {
        setCategoryItems([createDefaultCategoryItem()]);
      }
      setShowModal(true);
    } catch (err) {
      console.error("Failed to load previous year categories:", err);
      setIsEdit(false);
      setCurrentId(null);
      setCategoryItems([createDefaultCategoryItem()]);
      setShowModal(true);
    } finally {
      setInitLoading(false);
    }
  };

  const handleClearForm = () => {
    setCategoryItems([createDefaultCategoryItem()]);
  };

  const fetchReminder = async () => {
    try {
      const res = await portalInstance.get("api/notifications");
      if (res.data.success) {
        const systemReminders = res.data.data.filter(
          (n) => n.type === "SYSTEM_REMINDER"
        );
        if (systemReminders.length > 0) {
          setReminderNotifications(systemReminders);
          // Check isReviewed for the current financial year's categories
          try {
            const catRes = await portalInstance.get(`/leave-categories/status?year=${getCurrentFinancialYear()}`);
            if (catRes.data.success) {
              setShowReminderBanner(!catRes.data.isReviewed);
            } else {
              setShowReminderBanner(true);
            }
          } catch {
            setShowReminderBanner(true);
          }
        } else {
          setReminderNotifications([]);
          setShowReminderBanner(false);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchReminder();
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [selectedYear]);

  // Hide banner once categories are reviewed (after any CRUD on leave categories)
  useEffect(() => {
    if (showReminderBanner && reminderNotifications.length > 0) {
      portalInstance.get(`/leave-categories/status?year=${getCurrentFinancialYear()}`)
        .then((catRes) => {
          if (catRes.data.success && catRes.data.isReviewed) {
            setShowReminderBanner(false);
          }
        })
        .catch(() => {});
    }
  }, [categories]);

  const handleConfirmCurrentSettings = async () => {
    const ok = window.confirm(`Are you sure you want to keep the previous leave settings and copy them to the financial year ${selectedYear}?`);
    if (!ok) return;
    try {
      const res = await portalInstance.put(`/leave-categories/confirm`, {
        year: selectedYear
      });
      if (res.data.success) {
        toast.success("Previous leave settings confirmed and retained!");
        setShowReminderBanner(false);
        fetchCategories();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to confirm settings");
    }
  };

  const handleCategoryItemChange = (catIdx, field, value) => {
    setCategoryItems((prev) => {
      const updated = [...prev];
      updated[catIdx] = { ...updated[catIdx], [field]: value };
      return updated;
    });
  };

  const handleAddAnotherCategory = (presetName = "") => {
    setCategoryItems((prev) => [...prev, createDefaultCategoryItem(presetName)]);
  };

  const handleRemoveCategoryItem = (catIdx) => {
    setCategoryItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== catIdx);
    });
  };

  const handleApplyPreset = (presetName) => {
    setCategoryItems((prev) => {
      if (prev.length === 1 && !prev[0].name.trim()) {
        const updated = [...prev];
        updated[0] = { ...updated[0], name: presetName };
        return updated;
      }
      const alreadyExists = prev.some((c) => c.name.trim().toLowerCase() === presetName.toLowerCase());
      if (alreadyExists) {
        toast.info(`"${presetName}" is already in the list.`);
        return prev;
      }
      return [...prev, createDefaultCategoryItem(presetName)];
    });
  };

  // Probation Tiers Handlers per category
  const handleItemProbationTierChange = (catIdx, tierIdx, field, value) => {
    setCategoryItems((prev) => {
      const updated = [...prev];
      const cat = { ...updated[catIdx] };
      const newTiers = [...cat.probationTiers];
      let val = value.replace(/[^0-9]/g, "");
      if (val.length > 1 && val.startsWith("0")) {
        val = val.replace(/^0+/, "") || "0";
      }
      newTiers[tierIdx] = { ...newTiers[tierIdx], [field]: val };
      cat.probationTiers = newTiers;
      updated[catIdx] = cat;
      return updated;
    });
  };

  const handleItemAddProbationTier = (catIdx, prevTierIdx) => {
    setCategoryItems((prev) => {
      const updated = [...prev];
      const cat = { ...updated[catIdx] };

      if (!cat.isProbationTiered) {
        cat.isProbationTiered = true;
        cat.probationOthersLeaveCount = cat.probationOthersLeaveCount || cat.probationAllLeaveCount || "";
        cat.probationTiers = [
          { fromYear: "", fromMonth: "", toYear: "", toMonth: "", leaveCount: "" }
        ];
        updated[catIdx] = cat;
        return updated;
      }

      const referenceTier = typeof prevTierIdx === "number" && cat.probationTiers[prevTierIdx]
        ? cat.probationTiers[prevTierIdx]
        : cat.probationTiers[cat.probationTiers.length - 1];

      let nextFromY = 0;
      let nextFromM = 1;

      if (referenceTier && (referenceTier.toYear !== "" || referenceTier.toMonth !== "")) {
        const toY = parseInt(referenceTier.toYear, 10) || 0;
        const toM = parseInt(referenceTier.toMonth, 10) || 0;
        if (toM >= 12) {
          nextFromY = toY + 1;
          nextFromM = 1;
        } else {
          nextFromY = toY;
          nextFromM = toM + 1;
        }
      }

      const nextToY = nextFromY;
      const nextToM = Math.min(12, nextFromM + 5);

      const newTier = {
        fromYear: String(nextFromY),
        fromMonth: String(nextFromM),
        toYear: String(nextToY),
        toMonth: String(nextToM),
        leaveCount: "",
      };

      const newTiers = [...cat.probationTiers];
      if (typeof prevTierIdx === "number") {
        newTiers.splice(prevTierIdx + 1, 0, newTier);
      } else {
        newTiers.push(newTier);
      }

      cat.probationTiers = newTiers;
      updated[catIdx] = cat;
      return updated;
    });
  };

  const handleItemRemoveProbationTier = (catIdx, tierIdx) => {
    setCategoryItems((prev) => {
      const updated = [...prev];
      const cat = { ...updated[catIdx] };
      const remaining = cat.probationTiers.filter((_, i) => i !== tierIdx);
      if (remaining.length === 0) {
        cat.isProbationTiered = false;
        cat.probationAllLeaveCount = cat.probationOthersLeaveCount || "";
        cat.probationTiers = [{ fromYear: "", fromMonth: "", toYear: "", toMonth: "", leaveCount: "" }];
      } else {
        cat.probationTiers = remaining;
      }
      updated[catIdx] = cat;
      return updated;
    });
  };

  // Permanent Tiers Handlers per category
  const handleItemPermanentTierChange = (catIdx, tierIdx, field, value) => {
    setCategoryItems((prev) => {
      const updated = [...prev];
      const cat = { ...updated[catIdx] };
      const newTiers = [...cat.permanentTiers];
      let val = value.replace(/[^0-9]/g, "");
      if (val.length > 1 && val.startsWith("0")) {
        val = val.replace(/^0+/, "") || "0";
      }
      newTiers[tierIdx] = { ...newTiers[tierIdx], [field]: val };
      cat.permanentTiers = newTiers;
      updated[catIdx] = cat;
      return updated;
    });
  };

  const handleItemAddPermanentTier = (catIdx, prevTierIdx) => {
    setCategoryItems((prev) => {
      const updated = [...prev];
      const cat = { ...updated[catIdx] };

      if (!cat.isPermanentTiered) {
        cat.isPermanentTiered = true;
        cat.permanentOthersLeaveCount = cat.permanentOthersLeaveCount || cat.permanentAllLeaveCount || "";
        cat.permanentTiers = [
          { fromYear: "", fromMonth: "", toYear: "", toMonth: "", leaveCount: "" }
        ];
        updated[catIdx] = cat;
        return updated;
      }

      const referenceTier = typeof prevTierIdx === "number" && cat.permanentTiers[prevTierIdx]
        ? cat.permanentTiers[prevTierIdx]
        : cat.permanentTiers[cat.permanentTiers.length - 1];

      let nextFromY = 0;
      let nextFromM = 1;

      if (referenceTier && (referenceTier.toYear !== "" || referenceTier.toMonth !== "")) {
        const toY = parseInt(referenceTier.toYear, 10) || 0;
        const toM = parseInt(referenceTier.toMonth, 10) || 0;
        if (toM >= 12) {
          nextFromY = toY + 1;
          nextFromM = 1;
        } else {
          nextFromY = toY;
          nextFromM = toM + 1;
        }
      }

      const nextToY = nextFromY;
      const nextToM = Math.min(12, nextFromM + 5);

      const newTier = {
        fromYear: String(nextFromY),
        fromMonth: String(nextFromM),
        toYear: String(nextToY),
        toMonth: String(nextToM),
        leaveCount: "",
      };

      const newTiers = [...cat.permanentTiers];
      if (typeof prevTierIdx === "number") {
        newTiers.splice(prevTierIdx + 1, 0, newTier);
      } else {
        newTiers.push(newTier);
      }

      cat.permanentTiers = newTiers;
      updated[catIdx] = cat;
      return updated;
    });
  };

  const handleItemRemovePermanentTier = (catIdx, tierIdx) => {
    setCategoryItems((prev) => {
      const updated = [...prev];
      const cat = { ...updated[catIdx] };
      const remaining = cat.permanentTiers.filter((_, i) => i !== tierIdx);
      if (remaining.length === 0) {
        cat.isPermanentTiered = false;
        cat.permanentAllLeaveCount = cat.permanentOthersLeaveCount || "";
        cat.permanentTiers = [{ fromYear: "", fromMonth: "", toYear: "", toMonth: "", leaveCount: "" }];
      } else {
        cat.permanentTiers = remaining;
      }
      updated[catIdx] = cat;
      return updated;
    });
  };

  const convertCategoryToItem = (cat) => {
    const pTiers = [];
    const permTiers = [];

    if (cat.tiers && cat.tiers.length > 0) {
      cat.tiers.forEach((t) => {
        let empType = t.employeeType;
        if (empType !== "Probationary Employee" && empType !== "Permanent Employee") {
          const unit = t.durationUnit || "months";
          const m = Number(t.eligibleMonths || 0);
          empType = (unit === "years" || m > 12) ? "Permanent Employee" : "Probationary Employee";
        }

        let fY = t.fromYear !== undefined && t.fromYear !== null && t.fromYear !== "" ? Number(t.fromYear) : 0;
        let fM = t.fromMonth !== undefined && t.fromMonth !== null && t.fromMonth !== "" ? Number(t.fromMonth) : 0;
        let tY = t.toYear !== undefined && t.toYear !== null && t.toYear !== "" ? Number(t.toYear) : 0;
        let tM = t.toMonth !== undefined && t.toMonth !== null && t.toMonth !== "" ? Number(t.toMonth) : 0;

        const fromTotal = Number(t.minDuration !== undefined && t.minDuration !== "" ? t.minDuration : (t.eligibleMonths || 0));
        const toTotal = Number(t.maxDuration !== undefined && t.maxDuration !== "" ? t.maxDuration : (t.maxEligibleMonths || 0));

        if (fY === 0 && fM === 0 && fromTotal > 0) {
          fY = Math.floor(fromTotal / 12);
          fM = fromTotal % 12;
        }
        if (tY === 0 && tM === 0 && toTotal > 0) {
          tY = Math.floor(toTotal / 12);
          tM = toTotal % 12;
        }

        const tierObj = {
          fromYear: String(fY),
          fromMonth: String(fM),
          toYear: String(tY),
          toMonth: String(tM),
          leaveCount: t.leaveCount !== undefined && t.leaveCount !== null ? String(t.leaveCount) : "",
          isAllModeTier: fromTotal === 0 && toTotal === 0 && fY === 0 && fM === 0 && tY === 0 && tM === 0,
        };

        if (empType === "Probationary Employee") {
          pTiers.push(tierObj);
        } else {
          permTiers.push(tierObj);
        }
      });
    }

    const hasProbTiers = pTiers.length > 0 && !(pTiers.length === 1 && pTiers[0].isAllModeTier);
    const hasPermTiers = permTiers.length > 0 && !(permTiers.length === 1 && permTiers[0].isAllModeTier);

    return {
      name: cat.name || "",
      isProbationTiered: hasProbTiers,
      probationAllLeaveCount: !hasProbTiers ? String(cat.probationOthersLeaveCount ?? (pTiers[0]?.leaveCount || cat.leaveCount || "")) : "",
      probationOthersLeaveCount: cat.probationOthersLeaveCount !== undefined && cat.probationOthersLeaveCount !== null ? String(cat.probationOthersLeaveCount) : "",
      probationTiers: hasProbTiers ? pTiers : [{ fromYear: "", fromMonth: "", toYear: "", toMonth: "", leaveCount: "" }],

      isPermanentTiered: hasPermTiers,
      permanentAllLeaveCount: !hasPermTiers ? String(cat.permanentOthersLeaveCount ?? (permTiers[0]?.leaveCount || cat.leaveCount || "")) : "",
      permanentOthersLeaveCount: cat.permanentOthersLeaveCount !== undefined && cat.permanentOthersLeaveCount !== null ? String(cat.permanentOthersLeaveCount) : "",
      permanentTiers: hasPermTiers ? permTiers : [{ fromYear: "", fromMonth: "", toYear: "", toMonth: "", leaveCount: "" }],
    };
  };

  const handleAddClick = () => {
    if (!canWrite) {
      toast.warning("You have Read-only access to Leave Management.");
      return;
    }
    setIsEdit(false);
    setCurrentId(null);
    setCategoryItems([createDefaultCategoryItem()]);
    setShowModal(true);
  };

  const handleEditClick = (cat) => {
    if (!canWrite) {
      toast.warning("You have Read-only access to Leave Management.");
      return;
    }
    setIsEdit(true);
    setCurrentId(cat._id);
    setCategoryItems([convertCategoryToItem(cat)]);
    setShowModal(true);
  };

  const handleDeleteClick = (id) => {
    if (!canWrite) {
      toast.warning("You have Read-only access to Leave Management.");
      return;
    }
    setCatToDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!canWrite) {
      toast.error("You do not have write permission to delete leave categories.");
      return;
    }
    if (!catToDeleteId) return;
    const stored = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
    const isHrUser = stored?.role === "employee" || Boolean(stored?.isHr);
    try {
      if (String(catToDeleteId).startsWith("pending_")) {
        const targetCat = categories.find((c) => c._id === catToDeleteId);
        const reqId = targetCat?.requestId || String(catToDeleteId).replace(/^pending_/, "").split("_")[0];
        await portalInstance.delete(`/hr-approval/request/${reqId}`);
        toast.success("Pending leave category request cancelled!");
      } else if (isHrUser) {
        const categoryObj = categories.find((c) => c._id === catToDeleteId);
        await portalInstance.post("/hr-approval/submit", {
          actionType: "DELETE_LEAVE_CATEGORY",
          targetModule: "LEAVE_CATEGORY",
          summary: `Delete Leave Category: "${categoryObj?.name || "Category"}"`,
          payload: { id: catToDeleteId },
        });
        toast.success("Leave category deletion submitted for Admin approval!");
      } else {
        await portalInstance.delete(`/leave-categories/${catToDeleteId}`);
        toast.success("Leave category deleted");
      }
      setShowDeleteModal(false);
      setCatToDeleteId(null);
      fetchCategories(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  const handleSelectAll = () => {
    if (selectedCategoryIds.length === categories.length) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds(categories.map((c) => c._id));
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const confirmBulkDelete = async () => {
    if (!canWrite) {
      toast.error("You do not have write permission to delete leave categories.");
      return;
    }
    if (selectedCategoryIds.length === 0) return;
    const stored = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
    const isHrUser = stored?.role === "employee" || Boolean(stored?.isHr);

    try {
      if (isHrUser) {
        await portalInstance.post("/hr-approval/submit", {
          actionType: "BULK_DELETE_LEAVE_CATEGORY",
          targetModule: "LEAVE_CATEGORY",
          summary: `Bulk Delete (${selectedCategoryIds.length}) Leave Categories`,
          payload: { ids: selectedCategoryIds },
        });
        toast.success("Bulk delete request submitted for Admin approval!");
      } else {
        for (const id of selectedCategoryIds) {
          if (String(id).startsWith("pending_")) {
            const reqId = id.replace("pending_", "");
            await portalInstance.delete(`/hr-approval/request/${reqId}`);
          } else {
            await portalInstance.delete(`/leave-categories/${id}`);
          }
        }
        toast.success("Selected leave categories deleted successfully");
      }
      setSelectedCategoryIds([]);
      setShowBulkDeleteModal(false);
      fetchCategories(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to bulk delete");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canWrite) {
      toast.error("You do not have write permission to modify leave categories.");
      return;
    }

    const stored = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
    const isHrUser = stored?.role === "employee" || Boolean(stored?.isHr);

    // Validate all categories
    const validatedCategories = [];
    const usedNames = new Set();

    for (let cIdx = 0; cIdx < categoryItems.length; cIdx++) {
      const item = categoryItems[cIdx];
      const itemLabel = categoryItems.length > 1 ? `Category ${cIdx + 1}` : "Category";
      const catName = item.name ? item.name.trim() : "";

      if (!catName) {
        toast.error(`${itemLabel}: Category name is required.`);
        return;
      }

      if (usedNames.has(catName.toLowerCase())) {
        toast.error(`Duplicate category name "${catName}" in your list.`);
        return;
      }
      usedNames.add(catName.toLowerCase());

      // Check if category name already exists for this financial year
      const existingCat = categories.find(
        (cat) =>
          cat.name.toLowerCase() === catName.toLowerCase() &&
          (!isEdit || cat._id !== currentId)
      );

      if (!isEdit && existingCat) {
        toast.error(`Category "${catName}" already exists for ${selectedYear}. Please use Edit to update it.`);
        return;
      }

      // Validate Tiers
      const validatedTiers = [];

      // Process Probation Tiers
      if (!item.isProbationTiered) {
        if (item.probationAllLeaveCount !== "" && item.probationAllLeaveCount !== undefined) {
          const count = Number(item.probationAllLeaveCount);
          if (isNaN(count) || count < 0 || !Number.isInteger(count)) {
            toast.error(`${itemLabel} (${catName}) - Probationary Rule: Please enter a valid leave count.`);
            return;
          }
          validatedTiers.push({
            employeeType: "Probationary Employee",
            fromYear: 0,
            fromMonth: 0,
            toYear: 0,
            toMonth: 0,
            minDuration: 0,
            maxDuration: 0,
            durationUnit: "months",
            eligibleMonths: 0,
            maxEligibleMonths: 0,
            leaveCount: count,
          });
        }
      } else {
        for (let i = 0; i < (item.probationTiers || []).length; i++) {
          const tier = item.probationTiers[i];
          if (tier.leaveCount === "" || tier.leaveCount === undefined) continue;

          const count = Number(tier.leaveCount);
          if (isNaN(count) || count < 0 || !Number.isInteger(count)) {
            toast.error(`${itemLabel} (${catName}) - Probationary Rule ${i + 1}: Please enter a valid leave count.`);
            return;
          }

          const fY = Number(tier.fromYear) || 0;
          const fM = Number(tier.fromMonth) || 0;
          const tY = Number(tier.toYear) || 0;
          const tM = Number(tier.toMonth) || 0;

          if (fM > 12) {
            toast.error(`${itemLabel} (${catName}) - Probationary Rule ${i + 1}: 'From' month must be between 0 and 12.`);
            return;
          }
          if (tM > 12) {
            toast.error(`${itemLabel} (${catName}) - Probationary Rule ${i + 1}: 'To' month must be between 0 and 12.`);
            return;
          }

          const fromMonths = (fY * 12) + fM;
          const toMonths = (tY * 12) + tM;

          if (toMonths < fromMonths) {
            toast.error(`${itemLabel} (${catName}) - Probationary Rule ${i + 1}: "To" duration cannot be less than "From" duration.`);
            return;
          }

          validatedTiers.push({
            employeeType: "Probationary Employee",
            fromYear: fY,
            fromMonth: fM,
            toYear: tY,
            toMonth: tM,
            minDuration: fromMonths,
            maxDuration: toMonths,
            durationUnit: "months",
            eligibleMonths: fromMonths,
            maxEligibleMonths: toMonths,
            leaveCount: count,
          });
        }
      }

      // Process Permanent Tiers
      if (!item.isPermanentTiered) {
        if (item.permanentAllLeaveCount !== "" && item.permanentAllLeaveCount !== undefined) {
          const count = Number(item.permanentAllLeaveCount);
          if (isNaN(count) || count < 0 || !Number.isInteger(count)) {
            toast.error(`${itemLabel} (${catName}) - Permanent Rule: Please enter a valid leave count.`);
            return;
          }
          validatedTiers.push({
            employeeType: "Permanent Employee",
            fromYear: 0,
            fromMonth: 0,
            toYear: 0,
            toMonth: 0,
            minDuration: 0,
            maxDuration: 0,
            durationUnit: "months",
            eligibleMonths: 0,
            maxEligibleMonths: 0,
            leaveCount: count,
          });
        }
      } else {
        for (let i = 0; i < (item.permanentTiers || []).length; i++) {
          const tier = item.permanentTiers[i];
          if (tier.leaveCount === "" || tier.leaveCount === undefined) continue;

          const count = Number(tier.leaveCount);
          if (isNaN(count) || count < 0 || !Number.isInteger(count)) {
            toast.error(`${itemLabel} (${catName}) - Permanent Rule ${i + 1}: Please enter a valid leave count.`);
            return;
          }

          const fY = Number(tier.fromYear) || 0;
          const fM = Number(tier.fromMonth) || 0;
          const tY = Number(tier.toYear) || 0;
          const tM = Number(tier.toMonth) || 0;

          if (fM > 12) {
            toast.error(`${itemLabel} (${catName}) - Permanent Rule ${i + 1}: 'From' month must be between 0 and 12.`);
            return;
          }
          if (tM > 12) {
            toast.error(`${itemLabel} (${catName}) - Permanent Rule ${i + 1}: 'To' month must be between 0 and 12.`);
            return;
          }

          const fromMonths = (fY * 12) + fM;
          const toMonths = (tY * 12) + tM;

          if (toMonths < fromMonths) {
            toast.error(`${itemLabel} (${catName}) - Permanent Rule ${i + 1}: "To" duration cannot be less than "From" duration.`);
            return;
          }

          validatedTiers.push({
            employeeType: "Permanent Employee",
            fromYear: fY,
            fromMonth: fM,
            toYear: tY,
            toMonth: tM,
            minDuration: fromMonths,
            maxDuration: toMonths,
            durationUnit: "months",
            eligibleMonths: fromMonths,
            maxEligibleMonths: toMonths,
            leaveCount: count,
          });
        }
      }

      if (validatedTiers.length === 0) {
        toast.error(`${itemLabel} (${catName}): At least one leave count rule is required.`);
        return;
      }

      // Overlap validation for Probation Tiers
      if (item.isProbationTiered) {
        const probTiers = validatedTiers.filter((t) => t.employeeType === "Probationary Employee");
        probTiers.sort((a, b) => a.eligibleMonths - b.eligibleMonths);
        for (let j = 1; j < probTiers.length; j++) {
          if (probTiers[j].eligibleMonths <= probTiers[j - 1].maxEligibleMonths) {
            toast.error(`${itemLabel} (${catName}) - Probationary Rules overlap: Rule ranges cannot overlap each other.`);
            return;
          }
        }
      }

      // Overlap validation for Permanent Tiers
      if (item.isPermanentTiered) {
        const permTiers = validatedTiers.filter((t) => t.employeeType === "Permanent Employee");
        permTiers.sort((a, b) => a.eligibleMonths - b.eligibleMonths);
        for (let j = 1; j < permTiers.length; j++) {
          if (permTiers[j].eligibleMonths <= permTiers[j - 1].maxEligibleMonths) {
            toast.error(`${itemLabel} (${catName}) - Permanent Rules overlap: Rule ranges cannot overlap each other.`);
            return;
          }
        }
      }

      validatedCategories.push({
        name: catName,
        tiers: validatedTiers,
        probationOthersLeaveCount: !item.isProbationTiered
          ? (Number(item.probationAllLeaveCount) || 0)
          : (item.probationOthersLeaveCount !== "" && item.probationOthersLeaveCount !== undefined ? Number(item.probationOthersLeaveCount) : 0),
        permanentOthersLeaveCount: !item.isPermanentTiered
          ? (Number(item.permanentAllLeaveCount) || 0)
          : (item.permanentOthersLeaveCount !== "" && item.permanentOthersLeaveCount !== undefined ? Number(item.permanentOthersLeaveCount) : 0),
        year: selectedYear,
      });
    }

    try {
      if (isEdit) {
        const submitData = validatedCategories[0];
        const targetCatId = currentId;
        if (isHrUser) {
          if (String(targetCatId).startsWith("pending_")) {
            const targetCat = categories.find((c) => c._id === targetCatId);
            const reqId = targetCat?.requestId || String(targetCatId).replace(/^pending_/, "").split("_")[0];
            await portalInstance.put(`/hr-approval/request/${reqId}`, {
              payload: submitData,
              summary: `Create Leave Category: "${submitData.name}"`
            });
            toast.success("Pending leave category request updated!");
          } else {
            await portalInstance.post("/hr-approval/submit", {
              actionType: "UPDATE_LEAVE_CATEGORY",
              targetModule: "LEAVE_CATEGORY",
              summary: `Update Leave Category: "${submitData.name}"`,
              payload: { id: targetCatId, ...submitData },
            });
            toast.success("Leave category change submitted for Admin approval!");
          }
        } else {
          await portalInstance.put(`/leave-categories/${targetCatId}`, submitData);
          toast.success(`Leave category "${submitData.name}" updated successfully`);
        }
      } else {
        if (isHrUser) {
          if (validatedCategories.length === 1) {
            const submitData = validatedCategories[0];
            await portalInstance.post("/hr-approval/submit", {
              actionType: "CREATE_LEAVE_CATEGORY",
              targetModule: "LEAVE_CATEGORY",
              summary: `Create Leave Category: "${submitData.name}"`,
              payload: submitData,
            });
          } else {
            const namesList = validatedCategories.map((c) => `"${c.name}"`).join(", ");
            await portalInstance.post("/hr-approval/submit", {
              actionType: "CREATE_LEAVE_CATEGORY",
              targetModule: "LEAVE_CATEGORY",
              summary: `Create ${validatedCategories.length} Leave Categories: ${namesList}`,
              payload: {
                year: selectedYear,
                categories: validatedCategories,
              },
            });
          }
        } else {
          for (const submitData of validatedCategories) {
            await portalInstance.post("/leave-categories", submitData);
          }
        }
        if (isHrUser) {
          toast.success(
            validatedCategories.length > 1
              ? `${validatedCategories.length} leave categories submitted for Admin approval!`
              : `Leave category "${validatedCategories[0].name}" submitted for Admin approval!`
          );
        } else {
          toast.success(
            validatedCategories.length > 1
              ? `${validatedCategories.length} leave categories created successfully!`
              : `Leave category "${validatedCategories[0].name}" created successfully!`
          );
        }
      }
      setShowModal(false);
      fetchCategories(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save category");
    }
  };

  return (
    <>
      <Sidebar />
      <div className="lm-page-wrapper">
          <ApprovalBanner moduleName="LEAVE_CATEGORY" onRefresh={() => fetchCategories(true)} />

          {/* ── Rejection Remarks Banner for HR ── */}
          {yearStatus === "rejected" && adminRemarks && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <Icon icon="solar:danger-circle-bold" width="22" color="#dc2626" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#991b1b", marginBottom: "2px" }}>
                  Leave Categories Rejected by Admin (FY {selectedYear})
                </div>
                <div style={{ fontSize: "13px", color: "#7f1d1d" }}>
                  <strong>Reason for Rejection:</strong> "{adminRemarks}"
                </div>
                <div style={{ fontSize: "11px", color: "#991b1b", marginTop: "4px" }}>
                  Please update the leave categories for this financial year and click <strong>Submit to Admin</strong> to re-submit for approval.
                </div>
              </div>
            </div>
          )}

          {/* ── Banner for Empty / New Financial Year: Use Previous Year Data or Edit & Upload New Data ── */}
          {!loading && categories.length === 0 && canWrite && (
            <div className="lm-reminder-banner" style={{ marginTop: "12px", marginBottom: "16px" }}>
              <div className="lm-reminder-banner-text">
                <h6>Configure Leave Categories for FY {selectedYear}</h6>
                <p>
                  {prevYearHasData
                    ? `You can use the previous financial year's leave categories, or edit and upload new leave categories for FY ${selectedYear}.`
                    : `Configure and upload new leave categories for FY ${selectedYear}.`}
                </p>
              </div>
              <div className="lm-reminder-banner-actions">
                {prevYearHasData && (
                  <button
                    className="lm-reminder-btn lm-reminder-btn--outline"
                    onClick={handleUsePreviousYearData}
                    disabled={initLoading}
                  >
                    <Icon icon="solar:copy-bold" width="16" />
                    {initLoading ? "Loading..." : "Use Previous Year Data"}
                  </button>
                )}
                <button
                  className="lm-reminder-btn lm-reminder-btn--filled"
                  onClick={handleEditAndUploadNewData}
                  disabled={initLoading}
                >
                  <Icon icon="solar:pen-new-square-bold" width="16" />
                  Edit & Upload New Data
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              TABLE SECTION
          ───────────────────────────────────────────────────────── */}
          <div className="adminLeaveRequest-panel lm-table-panel">
            {/* Page Header Row */}
            <div className="lm-header-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              {canWrite && selectedCategoryIds.length > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#6366f1", backgroundColor: "#e0e7ff", padding: "6px 12px", borderRadius: "6px" }}>
                    {selectedCategoryIds.length} Selected
                  </span>
                  <button
                    className="common-modal-btn btn-reject"
                    style={{ padding: "6px 14px", fontSize: "13px" }}
                    onClick={() => setShowBulkDeleteModal(true)}
                  >
                    Delete Selected
                  </button>
                </div>
              ) : <div></div>}

              <div className="lm-header-row-controls" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div className="lm-year-selector">
                  <span className="lm-year-selector-label">FY:</span>
                  <div className="lm-year-dropdown">
                    <CustomDropdown
                      options={getYearOptions().map((yr) => ({ label: yr, value: yr }))}
                      value={selectedYear}
                      onChange={(val) => setSelectedYear(val)}
                    />
                  </div>
                </div>

                {/* Status Badge (shown for submitted or changes requested) */}
                {(yearStatus === "submitted" || yearStatus === "rejected") && (
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      textTransform: "capitalize",
                      background: yearStatus === "submitted" ? "#fef3c7" : "#fee2e2",
                      color: yearStatus === "submitted" ? "#b45309" : "#991b1b",
                      border: `1px solid ${
                        yearStatus === "submitted" ? "#fde68a" : "#fca5a5"
                      }`,
                    }}
                  >
                    {yearStatus === "submitted"
                      ? "Submitted (Pending Approval)"
                      : "Changes Requested"}
                  </span>
                )}

                {/* Admin Approve & Reject Buttons */}
                {isAdminUser && yearStatus === "submitted" && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="hrms-common-btn-primary"
                      style={{ height: "34px", padding: "0 14px", fontSize: "12px", whiteSpace: "nowrap" }}
                      onClick={handleApproveYear}
                      disabled={approvingYear}
                    >
                      {approvingYear ? "Approving..." : "Approve Categories"}
                    </button>
                    <button
                      className="hrms-common-btn-delete"
                      style={{ height: "34px", padding: "0 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                      onClick={handleRejectYear}
                      disabled={approvingYear}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {canWrite && (
                  <button
                    className="admin-leave-btn admin-btn-approve lm-add-btn"
                    onClick={handleAddClick}
                  >
                    + Add Category
                  </button>
                )}
              </div>
            </div>

            <div className="adminLeaveRequest-tableCard">
              <div className="table-responsive">
                <div className="commonTableLayout adminLeaveRequest-table lm-table-grid">

                  <div className={`adminLeaveRequest-tableHeader lm-table-cols ${!canWrite ? "lm-table-cols--readonly" : ""}`}>
                    {canWrite && (
                      <div className="adminLeaveRequest-headerCell" style={{ justifyContent: "center" }}>
                        <input
                          type="checkbox"
                          style={{ cursor: "pointer", width: "16px", height: "16px" }}
                          checked={selectedCategoryIds.length === categories.length && categories.length > 0}
                          onChange={handleSelectAll}
                        />
                      </div>
                    )}
                    <div className="adminLeaveRequest-headerCell">S.No</div>
                    <div className="adminLeaveRequest-headerCell">Name</div>
                    <div className="adminLeaveRequest-headerCell">Leave Count</div>
                    <div className="adminLeaveRequest-headerCell">Configured Rules (Type & Duration)</div>
                    <div className="adminLeaveRequest-headerCell">{canWrite ? "Actions" : "Status"}</div>
                  </div>

                  <div className="adminLeaveRequest-tableBody">
                    {loading ? (
                      <div className="adminLeaveRequest-tableRow lm-table-cols">
                        <div
                          className="adminLeaveRequest-bodyCell"
                          style={{ gridColumn: "1 / -1", justifyContent: "center" }}
                        >
                          Loading categories...
                        </div>
                      </div>
                    ) : categories.length === 0 ? (
                      <div className="adminLeaveRequest-tableRow lm-table-cols">
                        <div
                          className="adminLeaveRequest-bodyCell"
                          style={{
                            gridColumn: "1 / -1",
                            padding: "36px 20px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          <span style={{ fontSize: "14.5px", fontWeight: "600", color: "#475569" }}>
                            No leave categories found for FY {selectedYear}.
                          </span>
                          <span style={{ fontSize: "13px", color: "#64748b" }}>
                            Use the configuration banner above to configure categories for this financial year.
                          </span>
                        </div>
                      </div>
                    ) : (
                      categories.map((cat, idx) => (
                        <div
                          className={`adminLeaveRequest-tableRow lm-table-cols ${!canWrite ? "lm-table-cols--readonly" : ""}`}
                          key={cat._id}
                        >
                          {canWrite && (
                            <div className="adminLeaveRequest-tableCell" style={{ justifyContent: "center" }}>
                              <input
                                type="checkbox"
                                style={{ cursor: "pointer", width: "16px", height: "16px" }}
                                checked={selectedCategoryIds.includes(cat._id)}
                                onChange={() => handleToggleSelectRow(cat._id)}
                              />
                            </div>
                          )}
                          <div className="adminLeaveRequest-tableCell">{idx + 1}</div>
                          <div className="adminLeaveRequest-tableCell" style={{ fontWeight: "600", color: "#1e293b" }}>{cat.name}</div>
                          <div className="adminLeaveRequest-tableCell">
                            {cat.tiers && cat.tiers.length > 0 ? (
                              <div className="lm-count-pill-group">
                                {(() => {
                                  const counts = cat.tiers.map((t) => Number(t.leaveCount || 0));
                                  const minC = Math.min(...counts);
                                  const maxC = Math.max(...counts);
                                  return (
                                    <>
                                      <span className="lm-count-range-badge">
                                        {minC === maxC ? `${minC} Leaves` : `${minC} – ${maxC} Leaves`}
                                      </span>
                                      <span className="lm-count-subtext">
                                        {cat.tiers.length} {cat.tiers.length === 1 ? "rule" : "rules"}
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            ) : (
                              <span className="lm-count-range-badge">{cat.leaveCount || 0} Leaves</span>
                            )}
                          </div>
                          <div className="adminLeaveRequest-tableCell">
                            {cat.tiers && cat.tiers.length > 0 ? (
                              <div className="lm-rules-display">
                                {(() => {
                                  const probTiers = cat.tiers.filter((t) => {
                                    const type = t.employeeType;
                                    if (type) return type === "Probationary Employee" || type === "Probation";
                                    return (t.durationUnit || "months") === "months" && Number(t.eligibleMonths || 0) <= 12;
                                  });
                                  const permTiers = cat.tiers.filter((t) => {
                                    const type = t.employeeType;
                                    if (type) return type === "Permanent Employee" || type === "Permanent";
                                    return (t.durationUnit || "months") === "years" || Number(t.eligibleMonths || 0) > 12;
                                  });

                                  const formatTierText = (t) => {
                                    let fY = t.fromYear !== undefined && t.fromYear !== null && t.fromYear !== "" ? Number(t.fromYear) : 0;
                                    let fM = t.fromMonth !== undefined && t.fromMonth !== null && t.fromMonth !== "" ? Number(t.fromMonth) : 0;
                                    let tY = t.toYear !== undefined && t.toYear !== null && t.toYear !== "" ? Number(t.toYear) : 0;
                                    let tM = t.toMonth !== undefined && t.toMonth !== null && t.toMonth !== "" ? Number(t.toMonth) : 0;

                                    const fromTotal = Number(t.minDuration !== undefined && t.minDuration !== "" ? t.minDuration : (t.eligibleMonths || 0));
                                    const toTotal = Number(t.maxDuration !== undefined && t.maxDuration !== "" ? t.maxDuration : (t.maxEligibleMonths || 0));

                                    if (fY === 0 && fM === 0 && fromTotal > 0) {
                                      fY = Math.floor(fromTotal / 12);
                                      fM = fromTotal % 12;
                                    }
                                    if (tY === 0 && tM === 0 && toTotal > 0) {
                                      tY = Math.floor(toTotal / 12);
                                      tM = toTotal % 12;
                                    }

                                    const fromStr = fY > 0 ? (fM > 0 ? `${fY}Y ${fM}M` : `${fY}Y`) : `${fM}M`;
                                    if (toTotal > 0 || tY > 0 || tM > 0) {
                                      const toStr = tY > 0 ? (tM > 0 ? `${tY}Y ${tM}M` : `${tY}Y`) : `${tM}M`;
                                      if (fromStr === toStr) return fromStr;
                                      return `${fromStr} – ${toStr}`;
                                    }
                                    return `${fromStr}+`;
                                  };

                                  return (
                                    <>
                                      {(probTiers.length > 0 || (cat.probationOthersLeaveCount !== undefined && cat.probationOthersLeaveCount !== null && cat.probationOthersLeaveCount !== "")) ? (
                                        <div className="lm-rule-group lm-rule-group--probation">
                                          <span className="lm-rule-group-title">Probation:</span>
                                          <div className="lm-rule-pills">
                                            {probTiers.map((t, pIdx) => (
                                              <span className="lm-rule-pill lm-pill-prob" key={`pt_${pIdx}`} title={`Probationary Employee (${formatTierText(t)}): ${t.leaveCount} Leaves`}>
                                                {formatTierText(t)} → <strong>{t.leaveCount}</strong>
                                              </span>
                                            ))}
                                            {(cat.probationOthersLeaveCount !== undefined && cat.probationOthersLeaveCount !== null && cat.probationOthersLeaveCount !== "") ? (
                                              <span className="lm-rule-pill lm-pill-others" title={`Probation Others: ${cat.probationOthersLeaveCount} Leaves`}>
                                                Others → <strong>{cat.probationOthersLeaveCount}</strong>
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      ) : null}

                                      {(permTiers.length > 0 || (cat.permanentOthersLeaveCount !== undefined && cat.permanentOthersLeaveCount !== null && cat.permanentOthersLeaveCount !== "")) ? (
                                        <div className="lm-rule-group lm-rule-group--permanent">
                                          <span className="lm-rule-group-title">Permanent:</span>
                                          <div className="lm-rule-pills">
                                            {permTiers.map((t, prIdx) => (
                                              <span className="lm-rule-pill lm-pill-perm" key={`pr_${prIdx}`} title={`Permanent Employee (${formatTierText(t)}): ${t.leaveCount} Leaves`}>
                                                {formatTierText(t)} → <strong>{t.leaveCount}</strong>
                                              </span>
                                            ))}
                                            {(cat.permanentOthersLeaveCount !== undefined && cat.permanentOthersLeaveCount !== null && cat.permanentOthersLeaveCount !== "") ? (
                                              <span className="lm-rule-pill lm-pill-others" title={`Permanent Others: ${cat.permanentOthersLeaveCount} Leaves`}>
                                                Others → <strong>{cat.permanentOthersLeaveCount}</strong>
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      ) : null}
                                    </>
                                  );
                                })()}
                              </div>
                            ) : (
                              <span style={{ color: "#64748b", fontSize: "12px" }}>All Employees</span>
                            )}
                          </div>
                          <div className="adminLeaveRequest-tableCell d-flex gap-2 align-items-center">
                            {cat.isPendingHr ? (
                              <>
                                {cat.hrStatus === "REJECTED" ? (
                                  <span style={{ backgroundColor: "#fee2e2", color: "#dc2626", fontSize: "12px", fontWeight: "600", padding: "4px 10px", borderRadius: "12px" }} title={cat.adminNote || "Rejected by Admin"}>
                                    Rejected
                                  </span>
                                ) : (
                                  <span style={{ backgroundColor: "#fef3c7", color: "#d97706", fontSize: "12px", fontWeight: "600", padding: "4px 10px", borderRadius: "12px" }}>
                                    Pending Approval
                                  </span>
                                )}
                                {canWrite && (
                                  <>
                                    <button
                                      className="lm-action-btn lm-action-btn--edit"
                                      onClick={() => handleEditClick(cat)}
                                      title="Edit"
                                    >
                                      <Icon icon="lucide:edit" width="18" height="18" />
                                    </button>
                                    <button
                                      className="lm-action-btn lm-action-btn--delete"
                                      onClick={() => handleDeleteClick(cat._id)}
                                      title="Delete"
                                    >
                                      <Icon icon="lucide:trash-2" width="18" height="18" />
                                    </button>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {cat.pendingActionType ? (
                                  <span style={{ backgroundColor: "#e0e7ff", color: "#4f46e5", fontSize: "12px", fontWeight: "600", padding: "4px 10px", borderRadius: "12px" }}>
                                    {cat.pendingActionType === "UPDATE_LEAVE_CATEGORY" ? "Pending Edit" : "Pending Delete"}
                                  </span>
                                ) : (
                                  <span style={{ backgroundColor: "#d1fae5", color: "#059669", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "10px" }}>
                                    Approved
                                  </span>
                                )}
                                {canWrite && (
                                  <>
                                    <button
                                      className="lm-action-btn lm-action-btn--edit"
                                      onClick={() => handleEditClick(cat)}
                                      title="Edit"
                                    >
                                      <Icon icon="lucide:edit" width="18" height="18" />
                                    </button>
                                    <button
                                      className="lm-action-btn lm-action-btn--delete"
                                      onClick={() => handleDeleteClick(cat._id)}
                                      title="Delete"
                                    >
                                      <Icon icon="lucide:trash-2" width="18" height="18" />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Add / Edit Leave Category */}
        {showModal && (
          <div className="todo-modal-overlay edit-modal-overlay" onClick={() => setShowModal(false)}>
            <div
              className="lm-edit-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="lm-modal-header">
                <h3 className="common-modal-title lm-modal-title">
                  {isEdit
                    ? "Edit Leave Category"
                    : (categoryItems.length > 1
                        ? `Add Leave Categories (${categoryItems.length})`
                        : "Add Leave Category")}
                </h3>
                <button
                  type="button"
                  className="common-modal-close-x"
                  onClick={() => setShowModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="lm-scroll-body">
                  {/* Quick Preset Chips (in Add Mode) */}
                  {/* {!isEdit && (
                    <div className="lm-presets-container">
                      <span className="lm-presets-label">Quick Add Categories:</span>
                      <div className="lm-presets-chips">
                        {[
                          "Annual Leave",
                          "Sick Leave",
                          "Casual Leave",
                          "Paternity Leave",
                          "Maternity Leave",
                          "Compensatory Off",
                          "Bereavement Leave"
                        ].map((preset) => {
                          const isAdded = categoryItems.some(
                            (c) => c.name.trim().toLowerCase() === preset.toLowerCase()
                          );
                          return (
                            <button
                              key={preset}
                              type="button"
                              className={`lm-preset-chip ${isAdded ? "lm-preset-chip--active" : ""}`}
                              onClick={() => handleApplyPreset(preset)}
                              title={isAdded ? "Already added" : `Add ${preset}`}
                            >
                              {isAdded ? "✓ " : "+ "}
                              {preset}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )} */}

                  {/* Category Items List */}
                  {categoryItems.map((item, catIdx) => (
                    <div
                      className={`lm-multi-cat-card ${categoryItems.length > 1 ? "lm-multi-cat-card--multiple" : ""}`}
                      key={`cat_card_${catIdx}`}
                    >
                      {/* Card Header (if multiple categories) */}
                      {!isEdit && categoryItems.length > 1 && (
                        <div className="lm-cat-card-header">
                          <div className="lm-cat-badge">
                            Category {catIdx + 1}
                            {item.name ? ` — ${item.name}` : ""}
                          </div>
                          <button
                            type="button"
                            className="lm-cat-remove-btn"
                            onClick={() => handleRemoveCategoryItem(catIdx)}
                            title="Remove this category"
                          >
                            <Icon icon="lucide:trash-2" width="14" height="14" />
                            Remove
                          </button>
                        </div>
                      )}

                      {/* Category Name */}
                      <div className="todo-form-group" style={{ marginBottom: "16px" }}>
                        <label style={{ fontSize: "13px", fontWeight: "500", color: "#3A466D", marginBottom: "6px", display: "block" }}>
                          Category Name
                        </label>
                        <input
                          type="text"
                          className="todo-form-input lm-category-input"
                          value={item.name}
                          onChange={(e) => handleCategoryItemChange(catIdx, "name", e.target.value)}
                          placeholder="Enter category name (e.g. Annual Leave, Sick Leave, Paternity Leave, Casual Leave)..."
                        />
                      </div>

                      {/* 1. Probationary Employee Rules Section */}
                      <div style={{ marginBottom: "18px" }}>
                        <div className="lm-section-header">
                          <label style={{ fontSize: "13.5px", fontWeight: "600", color: "#3A466D", margin: 0 }}>
                            Probationary Employee Rules
                          </label>
                        </div>

                        {!item.isProbationTiered ? (
                          <div className="lm-all-row">
                            <label className="lm-all-label">
                              <span>All</span>
                            </label>
                            <div className="lm-all-right">
                              <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "500", margin: 0, whiteSpace: "nowrap" }}>Leave Count:</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="lm-count-input"
                                style={{ width: "80px" }}
                                placeholder="Count"
                                value={item.probationAllLeaveCount}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/[^0-9]/g, "");
                                  if (val.length > 1 && val.startsWith("0")) val = val.replace(/^0+/, "") || "0";
                                  handleCategoryItemChange(catIdx, "probationAllLeaveCount", val);
                                }}
                              />
                              <button
                                type="button"
                                className="lm-tier-btn lm-tier-btn--add"
                                onClick={() => handleItemAddProbationTier(catIdx)}
                                title="Add range rule"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {item.probationTiers.map((tier, idx) => (
                              <div className="lm-tier-row" key={`prob_${catIdx}_${idx}`}>
                                {/* From */}
                                <div className="todo-form-group lm-tier-field">
                                  <label style={{ fontSize: "11px", fontWeight: "500", color: "#64748b", marginBottom: "4px", display: "block" }}>
                                    From
                                  </label>
                                  <div className="lm-ym-group">
                                    <div className="lm-ym-item">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        className="lm-ym-input"
                                        placeholder="0"
                                        value={tier.fromYear}
                                        onChange={(e) => handleItemProbationTierChange(catIdx, idx, "fromYear", e.target.value)}
                                      />
                                      <span className="lm-ym-unit">Y</span>
                                    </div>
                                    <div className="lm-ym-item">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        className="lm-ym-input"
                                        placeholder="1"
                                        value={tier.fromMonth}
                                        onChange={(e) => handleItemProbationTierChange(catIdx, idx, "fromMonth", e.target.value)}
                                      />
                                      <span className="lm-ym-unit">M</span>
                                    </div>
                                  </div>
                                </div>

                                {/* To */}
                                <div className="todo-form-group lm-tier-field">
                                  <label style={{ fontSize: "11px", fontWeight: "500", color: "#64748b", marginBottom: "4px", display: "block" }}>
                                    To
                                  </label>
                                  <div className="lm-ym-group">
                                    <div className="lm-ym-item">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        className="lm-ym-input"
                                        placeholder="0"
                                        value={tier.toYear}
                                        onChange={(e) => handleItemProbationTierChange(catIdx, idx, "toYear", e.target.value)}
                                      />
                                      <span className="lm-ym-unit">Y</span>
                                    </div>
                                    <div className="lm-ym-item">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        className="lm-ym-input"
                                        placeholder="6"
                                        value={tier.toMonth}
                                        onChange={(e) => handleItemProbationTierChange(catIdx, idx, "toMonth", e.target.value)}
                                      />
                                      <span className="lm-ym-unit">M</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Leave Count */}
                                <div className="todo-form-group lm-tier-field">
                                  <label style={{ fontSize: "11px", fontWeight: "500", color: "#64748b", marginBottom: "4px", display: "block" }}>
                                    Leave Count
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="lm-count-input"
                                    placeholder="Count"
                                    value={tier.leaveCount}
                                    onChange={(e) => handleItemProbationTierChange(catIdx, idx, "leaveCount", e.target.value)}
                                  />
                                </div>

                                {/* Actions */}
                                <div className="lm-tier-compact-actions">
                                  <button
                                    type="button"
                                    className="lm-tier-btn lm-tier-btn--add"
                                    onClick={() => handleItemAddProbationTier(catIdx, idx)}
                                    title="Add next rule"
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    className="lm-tier-btn lm-tier-btn--remove"
                                    onClick={() => handleItemRemoveProbationTier(catIdx, idx)}
                                    title="Remove rule"
                                  >
                                    −
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Others Leave Count for Probationary Employees */}
                            <div className="lm-others-row">
                              <label className="lm-others-label">Others Leave Count</label>
                              <div className="lm-others-input-wrapper">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  className="lm-count-input lm-others-input"
                                  placeholder="Count"
                                  value={item.probationOthersLeaveCount}
                                  onChange={(e) => {
                                    let val = e.target.value.replace(/[^0-9]/g, "");
                                    if (val.length > 1 && val.startsWith("0")) val = val.replace(/^0+/, "") || "0";
                                    handleCategoryItemChange(catIdx, "probationOthersLeaveCount", val);
                                  }}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* 2. Permanent Employee Rules Section */}
                      <div>
                        <div className="lm-section-header">
                          <label style={{ fontSize: "13.5px", fontWeight: "600", color: "#3A466D", margin: 0 }}>
                            Permanent Employee Rules
                          </label>
                        </div>

                        {!item.isPermanentTiered ? (
                          <div className="lm-all-row">
                            <label className="lm-all-label">
                              <span>All</span>
                            </label>
                            <div className="lm-all-right">
                              <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "500", margin: 0, whiteSpace: "nowrap" }}>Leave Count:</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="lm-count-input"
                                style={{ width: "80px" }}
                                placeholder="Count"
                                value={item.permanentAllLeaveCount}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/[^0-9]/g, "");
                                  if (val.length > 1 && val.startsWith("0")) val = val.replace(/^0+/, "") || "0";
                                  handleCategoryItemChange(catIdx, "permanentAllLeaveCount", val);
                                }}
                              />
                              <button
                                type="button"
                                className="lm-tier-btn lm-tier-btn--add"
                                onClick={() => handleItemAddPermanentTier(catIdx)}
                                title="Add range rule"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {item.permanentTiers.map((tier, idx) => (
                              <div className="lm-tier-row" key={`perm_${catIdx}_${idx}`}>
                                {/* From */}
                                <div className="todo-form-group lm-tier-field">
                                  <label style={{ fontSize: "11px", fontWeight: "500", color: "#64748b", marginBottom: "4px", display: "block" }}>
                                    From
                                  </label>
                                  <div className="lm-ym-group">
                                    <div className="lm-ym-item">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        className="lm-ym-input"
                                        placeholder="0"
                                        value={tier.fromYear}
                                        onChange={(e) => handleItemPermanentTierChange(catIdx, idx, "fromYear", e.target.value)}
                                      />
                                      <span className="lm-ym-unit">Y</span>
                                    </div>
                                    <div className="lm-ym-item">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        className="lm-ym-input"
                                        placeholder="1"
                                        value={tier.fromMonth}
                                        onChange={(e) => handleItemPermanentTierChange(catIdx, idx, "fromMonth", e.target.value)}
                                      />
                                      <span className="lm-ym-unit">M</span>
                                    </div>
                                  </div>
                                </div>

                                {/* To */}
                                <div className="todo-form-group lm-tier-field">
                                  <label style={{ fontSize: "11px", fontWeight: "500", color: "#64748b", marginBottom: "4px", display: "block" }}>
                                    To
                                  </label>
                                  <div className="lm-ym-group">
                                    <div className="lm-ym-item">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        className="lm-ym-input"
                                        placeholder="0"
                                        value={tier.toYear}
                                        onChange={(e) => handleItemPermanentTierChange(catIdx, idx, "toYear", e.target.value)}
                                      />
                                      <span className="lm-ym-unit">Y</span>
                                    </div>
                                    <div className="lm-ym-item">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        className="lm-ym-input"
                                        placeholder="6"
                                        value={tier.toMonth}
                                        onChange={(e) => handleItemPermanentTierChange(catIdx, idx, "toMonth", e.target.value)}
                                      />
                                      <span className="lm-ym-unit">M</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Leave Count */}
                                <div className="todo-form-group lm-tier-field">
                                  <label style={{ fontSize: "11px", fontWeight: "500", color: "#64748b", marginBottom: "4px", display: "block" }}>
                                    Leave Count
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="lm-count-input"
                                    placeholder="Count"
                                    value={tier.leaveCount}
                                    onChange={(e) => handleItemPermanentTierChange(catIdx, idx, "leaveCount", e.target.value)}
                                  />
                                </div>

                                {/* Actions */}
                                <div className="lm-tier-compact-actions">
                                  <button
                                    type="button"
                                    className="lm-tier-btn lm-tier-btn--add"
                                    onClick={() => handleItemAddPermanentTier(catIdx, idx)}
                                    title="Add next rule"
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    className="lm-tier-btn lm-tier-btn--remove"
                                    onClick={() => handleItemRemovePermanentTier(catIdx, idx)}
                                    title="Remove rule"
                                  >
                                    −
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Others Leave Count for Permanent Employees */}
                            <div className="lm-others-row">
                              <label className="lm-others-label">Others Leave Count</label>
                              <div className="lm-others-input-wrapper">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  className="lm-count-input lm-others-input"
                                  placeholder="Count"
                                  value={item.permanentOthersLeaveCount}
                                  onChange={(e) => {
                                    let val = e.target.value.replace(/[^0-9]/g, "");
                                    if (val.length > 1 && val.startsWith("0")) val = val.replace(/^0+/, "") || "0";
                                    handleCategoryItemChange(catIdx, "permanentOthersLeaveCount", val);
                                  }}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* + Add Another Category Button (Add Mode) */}
                  {!isEdit && (
                    <button
                      type="button"
                      className="lm-add-another-cat-btn"
                      onClick={() => handleAddAnotherCategory()}
                    >
                      <Icon icon="lucide:plus-circle" width="18" height="18" />
                      Add Another Category
                    </button>
                  )}
                </div>

                <div className="lm-modal-footer">
                  <div className="lm-modal-footer-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <button
                      type="button"
                      className="common-modal-btn lm-clear-btn"
                      onClick={handleClearForm}
                      title="Clear all fields in this form"
                    >
                      <Icon icon="lucide:rotate-ccw" width="15" height="15" />
                      Clear
                    </button>
                    <div className="edit-modal-actions" style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="button"
                        className="common-modal-btn btn-small-cancel"
                        onClick={() => setShowModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="common-modal-btn btn-update lm-save-btn"
                      >
                        {isHrUser
                          ? (categoryItems.length > 1
                              ? `Send (${categoryItems.length}) for Approval`
                              : "Send for Approval")
                          : (isEdit
                              ? "Update"
                              : (categoryItems.length > 1
                                  ? `Save (${categoryItems.length}) Categories`
                                  : "Save"))}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* ── Delete Confirm Modal ── */}
      {showDeleteModal && (
        <div className="todo-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div
            className="todo-modal-content common-modal-content todo-delete-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="todo-modal-header">
              <h3 className="common-modal-title lm-modal-title">Confirm Delete</h3>
              <button
                className="common-modal-close-x"
                onClick={() => setShowDeleteModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="todo-modal-body common-modal-body">
              <p className="lm-delete-desc">
                Are you sure you want to delete this category? This action cannot be undone.
              </p>
              <div className="todo-modal-footer todo-delete-modal-footer lm-delete-footer">
                <div className="todo-delete-btn-group">
                  <button
                    className="todo-modal-btn btn-small-cancel common-modal-btn"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="todo-modal-btn btn-delete common-modal-btn"
                    onClick={confirmDelete}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Confirm Modal ── */}
      {showBulkDeleteModal && (
        <div className="todo-modal-overlay" onClick={() => setShowBulkDeleteModal(false)}>
          <div
            className="todo-modal-content common-modal-content todo-delete-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="todo-modal-header">
              <h3 className="common-modal-title lm-modal-title">Confirm Bulk Delete</h3>
              <button
                className="common-modal-close-x"
                onClick={() => setShowBulkDeleteModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="todo-modal-body common-modal-body">
              <p className="lm-delete-desc">
                Are you sure you want to delete <strong>{selectedCategoryIds.length}</strong> selected leave categories? This action cannot be undone.
              </p>
              <div className="todo-modal-footer todo-delete-modal-footer lm-delete-footer">
                <div className="todo-delete-btn-group">
                  <button
                    className="todo-modal-btn btn-small-cancel common-modal-btn"
                    onClick={() => setShowBulkDeleteModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="todo-modal-btn btn-delete common-modal-btn"
                    onClick={confirmBulkDelete}
                  >
                    Delete ({selectedCategoryIds.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </>
  );
};

export default LeaveManagement;
import React, { useState, useRef, useEffect, useMemo } from "react";
import Sidebar from "../../HeaderSidebar/Sidebar";
import "./RequestLeave.css";
import DateIcon from "../../../assets/uiw_date.svg";
import { portalInstance } from "../../../Services/instance";
import EmployeeLeaveRequestModal from "../../../Components/Employee/Employeeleave-request/EmployeeLeaveRequestModal";
import Pagination from "../Pagination/Pagination";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CustomDropdown from "../../Common/CustomDropdown";
import { FiClock, FiChevronDown, FiChevronUp } from "react-icons/fi";
import "../../../Globel/Layout.css";

const initialFormState = {
  leaveType: "",
  dayType: "Half Day",
  fromDate: "",
  toDate: "",
  startTime: "",
  endTime: "",
  noOfDays: "0.5",
  reasonType: "Personal Work",
  otherReason: "",
  createdAt: "",
  detailedReason: "",
  otherLeaveType: "",
  leaveDates: [],
  permissionType: "", // MORNING | AFTERNOON | EVENING
};

const PAGE_SIZE = 5;

const EmployeeRequestLeave = () => {
  const fromRef = useRef(null);
  const toRef = useRef(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [originalFormData, setOriginalFormData] = useState(initialFormState);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("leave");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState(null);
  const [govHolidays, setGovHolidays] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({});
  const [probationInfo, setProbationInfo] = useState({ inProbation: false, probationEndDate: null });
  const [permissionConfig, setPermissionConfig] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showSpecificBalances, setShowSpecificBalances] = useState(false);
  const [combinedIntimationModal, setCombinedIntimationModal] = useState(null);

  const dayOptions = [
    { value: "Half Day", label: "Half Day" },
    { value: "1 Day", label: "1 Day" },
    { value: "2 Days", label: "2 Days" },
    { value: "More than 3 Days", label: "More than 3 Days" },
  ];

  const [leaveCategories, setLeaveCategories] = useState([]);

  useEffect(() => {
    const fetchLeaveCategories = async () => {
      try {
        const getFinYear = (date = new Date()) => {
          const month = date.getMonth();
          const year = date.getFullYear();
          return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        };
        const finYear = getFinYear();
        const res = await portalInstance.get(`/leave-categories?year=${finYear}`);
        if (res.data.success) {
          setLeaveCategories(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch leave categories", err);
      }
    };
    fetchLeaveCategories();
  }, []);

  const leaveTypeOptions = [
    ...leaveCategories.map(cat => ({ value: cat.name, label: cat.name })),
    { value: "Others", label: "Others" },
  ];

  const leaveReasons = [
    { value: "Medical Leave", label: "Medical Leave" },
    { value: "Personal Work", label: "Personal Work" },
    { value: "Family Function/Emergency", label: "Family Function/Emergency" },
    { value: "Vacation/Planned Leave", label: "Vacation/Planned Leave" },
    { value: "Others", label: "Others" },
  ];

  const wfhReasons = [
    { value: "Work from Home", label: "Work from Home" },
    { value: "Meeting/Urgent Work", label: "Meeting/Urgent Work" },
    { value: "System Issue", label: "System Issue" },
    { value: "Others", label: "Others" },
  ];

  const permissionReasons = [
    { value: "Official Work", label: "Official Work" },
    { value: "Personal Work", label: "Personal Work" },
    { value: "Bank Work", label: "Bank Work" },
    { value: "Medical Visit", label: "Medical Visit" },
    { value: "Others", label: "Others" },
  ];

  // SELECT REASONS BASED ON ACTIVE TAB
  const reasonOptions =
    activeTab === "leave"
      ? leaveReasons
      : activeTab === "wfh"
        ? wfhReasons
        : permissionReasons;

  const today = new Date();
  const currentYear = today.getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState("All");

  const allMonthsList = [
    { label: "January", value: "01" },
    { label: "February", value: "02" },
    { label: "March", value: "03" },
    { label: "April", value: "04" },
    { label: "May", value: "05" },
    { label: "June", value: "06" },
    { label: "July", value: "07" },
    { label: "August", value: "08" },
    { label: "September", value: "09" },
    { label: "October", value: "10" },
    { label: "November", value: "11" },
    { label: "December", value: "12" },
  ];

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => (currentYear - i).toString()).map(
        (y) => ({ value: y, label: y })
      ),
    [currentYear]
  );

  const availableMonths = useMemo(() => {
    const result = [{ label: "All Months", value: "All" }];
    const isCurrentYear = selectedYear === currentYear.toString();

    if (isCurrentYear) {
      const currentMonthIndex = today.getMonth();
      const endLimit = Math.min(11, currentMonthIndex + 3);
      for (let i = 0; i <= endLimit; i++) {
        result.push(allMonthsList[i]);
      }
    } else {
      result.push(...allMonthsList);
    }

    return result;
  }, [selectedYear, currentYear]);

  const handleYearFilterSelect = (year) => {
    setSelectedYear(year);
    setSelectedMonth("All");
    setCurrentPage(1);
  };

  const handleMonthFilterSelect = (val) => {
    setSelectedMonth(val);
    setCurrentPage(1);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setStatusFilter("All");
  };

  const fetchGovHolidays = async (year) => {
    try {
      const res = await portalInstance.get(
        `/holiday-assignments/gov-holidays/${year}`
      );
      if (res.data?.success) {
        setGovHolidays(res.data.data.map((h) => h.date));
      }
    } catch (err) {
      console.error("Failed to fetch gov holidays", err);
    }
  };

  useEffect(() => {
    const year = formData.fromDate
      ? new Date(formData.fromDate).getFullYear()
      : currentYear;
    fetchGovHolidays(year);
  }, [formData.fromDate]);

  const isSecondOrFourthSaturday = (date) => {
    const d = new Date(date);
    if (d.getDay() !== 6) return false;
    const dayOfMonth = d.getDate();
    return (
      (dayOfMonth >= 8 && dayOfMonth <= 14) ||
      (dayOfMonth >= 22 && dayOfMonth <= 28)
    );
  };

  const isSunday = (date) => {
    return new Date(date).getDay() === 0;
  };

  const calculateLeaveDetails = (startStr, endStr) => {
    if (!startStr) return { count: 0, dates: [] };
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : start;
    const leaveDates = [];
    let count = 0;

    const current = new Date(start);
    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;

      const isHoliday = govHolidays.includes(dateStr);
      const isWeekend =
        isSunday(current) || isSecondOrFourthSaturday(current);

      if (!isHoliday && !isWeekend) {
        count++;
        leaveDates.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    if (formData.dayType === "Half Day") {
      return {
        count: count > 0 ? 0.5 : 0,
        dates: count > 0 ? [startStr] : [],
      };
    }

    return { count, dates: leaveDates };
  };

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getMaxDate = () => {
    const today = new Date();
    today.setMonth(today.getMonth() + 3);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    return dateStr === getTodayDate();
  };

  const getCurrentTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getMinStartTime = () => {
    if (isToday(formData.fromDate)) {
      return getCurrentTime();
    }
    return "";
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, "0");
    const month = d.toLocaleString("en-GB", { month: "short" });
    return `${day} ${month}`;
  };

  const formatShortDateRange = (start, end) => {
    if (!start) return "-";
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    const dayS = s.getDate().toString().padStart(2, "0");
    const monthS = s.toLocaleString("en-GB", { month: "short" });
    const yearS = s.getFullYear();

    if (!e || s.toDateString() === e.toDateString()) {
      return `${dayS} ${monthS}`;
    }

    const dayE = e.getDate().toString().padStart(2, "0");
    const monthE = e.toLocaleString("en-GB", { month: "short" });
    const yearE = e.getFullYear();

    if (monthS === monthE && yearS === yearE) {
      return `${dayS}-${dayE} ${monthS}`;
    }

    return `${dayS} ${monthS} - ${dayE} ${monthE}`;
  };


  useEffect(() => {
    if (
      (formData.dayType === "More than 3 Days" ||
        formData.dayType === "2 Days" ||
        formData.dayType === "1 Day") &&
      formData.fromDate
    ) {
      const { count, dates } = calculateLeaveDetails(
        formData.fromDate,
        formData.toDate || formData.fromDate
      );

      setFormData((prev) => ({
        ...prev,
        noOfDays: count.toString(),
        leaveDates: dates,
      }));
    } else if (formData.dayType === "Half Day" && formData.fromDate) {
      const { count, dates } = calculateLeaveDetails(
        formData.fromDate,
        formData.fromDate
      );
      setFormData((prev) => ({
        ...prev,
        noOfDays: count.toString(),
        leaveDates: dates,
      }));
    }
  }, [formData.fromDate, formData.toDate, formData.dayType, govHolidays]);

  useEffect(() => {
    if (isToday(formData.fromDate)) {
      const currentTime = getCurrentTime();

      if (formData.startTime && formData.startTime < currentTime) {
        setFormData((prev) => ({
          ...prev,
          startTime: "",
          endTime: "",
        }));
        toast.warning(
          "Previous time selections were in the past and have been reset"
        );
      }
    }
  }, [formData.fromDate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "startTime") {
      if (isToday(formData.fromDate)) {
        const currentTime = getCurrentTime();
        if (value < currentTime) {
          toast.error(
            "Cannot select a past time. Please choose a future time"
          );
          return;
        }
      }

      if (value && formData.endTime) {
        if (value >= formData.endTime) {
          toast.error("From Time must be before To Time");
          return;
        }
      }
    }

    if (name === "endTime") {
      if (isToday(formData.fromDate)) {
        const currentTime = getCurrentTime();
        if (value <= currentTime) {
          toast.error(
            "Cannot select a past time. Please choose a future time"
          );
          return;
        }
      }

      if (value && formData.startTime) {
        if (value <= formData.startTime) {
          toast.error("To Time must be after From Time");
          return;
        }
      }
    }

    if (name === "fromDate" || name === "toDate") {
      const maxDate = getMaxDate();
      if (value > maxDate) {
        toast.error("Cannot select a date more than 3 months from today");
        return;
      }

      const parts = value.split("-");
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const dateStr = value;

      if (
        isSunday(d) ||
        isSecondOrFourthSaturday(d) ||
        govHolidays.includes(dateStr)
      ) {
        toast.error(
          "Holidays and weekends cannot be selected as a start or end date for leave"
        );
        return;
      }
    }

    if (name === "fromDate" && formData.dayType === "2 Days") {
      const from = value;
      let to = "";
      if (from) {
        const d = new Date(from);
        let workingDaysFound = 0;
        let current = new Date(d);

        const isWorkDay = (date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, "0");
          const dayStr = String(date.getDate()).padStart(2, "0");
          const ds = `${y}-${m}-${dayStr}`;
          return (
            !govHolidays.includes(ds) &&
            date.getDay() !== 0 &&
            !isSecondOrFourthSaturday(date)
          );
        };

        if (isWorkDay(current)) {
          workingDaysFound = 1;
        }

        let safetyCount = 0;
        while (workingDaysFound < 2 && safetyCount < 30) {
          current.setDate(current.getDate() + 1);
          if (isWorkDay(current)) {
            workingDaysFound++;
          }
          safetyCount++;
        }

        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, "0");
        const day = String(current.getDate()).padStart(2, "0");
        const toDateStr = `${y}-${m}-${day}`;

        const maxDate = getMaxDate();
        if (toDateStr > maxDate) {
          toast.error(
            "The calculated 2-day range exceeds the 3-month limit. Please select an earlier date"
          );
          return;
        }

        to = toDateStr;
      }
      setFormData((prev) => ({
        ...prev,
        fromDate: from,
        toDate: to,
        startTime: "",
        endTime: "",
      }));
      return;
    }

    if (name === "fromDate" && formData.dayType === "More than 3 Days") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        toDate: "",
        startTime: "",
        endTime: "",
      }));
      return;
    }

    if (name === "fromDate" && formData.dayType === "Half Day") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        startTime: "",
        endTime: "",
      }));
      return;
    }

    if (name === "fromDate" && formData.dayType === "1 Day") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getMinEndTime = () => {
    if (!formData.startTime) {
      if (isToday(formData.fromDate)) {
        return getCurrentTime();
      }
      return "";
    }
    const [hours, minutes] = formData.startTime.split(":");
    const startDate = new Date();
    startDate.setHours(parseInt(hours), parseInt(minutes) + 1);

    const minEnd = `${String(startDate.getHours()).padStart(2, "0")}:${String(
      startDate.getMinutes()
    ).padStart(2, "0")}`;

    if (isToday(formData.fromDate)) {
      const currentTime = getCurrentTime();
      return minEnd > currentTime ? minEnd : currentTime;
    }

    return minEnd;
  };

  const handleDayTypeSelect = (val) => {
    let days = "1";
    if (val === "Half Day") days = "0.5";
    else if (val === "2 Days") days = "2";
    else if (val === "More than 3 Days") days = "0";

    setFormData({
      ...formData,
      dayType: val,
      noOfDays: days,
      fromDate: "",
      toDate: "",
      startTime: "",
      endTime: "",
    });
  };

  const handleReasonSelect = (val) => {
    setFormData((prev) => ({ ...prev, reasonType: val }));
  };

  const handleLeaveTypeSelect = (val) => {
    setFormData((prev) => ({
      ...prev,
      leaveType: val,
    }));
  };

  const getMinToDate = () => {
    if (!formData.fromDate) return getTodayDate();

    if (formData.dayType === "More than 3 Days") {
      const d = new Date(formData.fromDate);
      d.setDate(d.getDate() + 2);
      return d.toISOString().slice(0, 10);
    }

    return formData.fromDate;
  };

  const getMaxToDate = () => {
    return getMaxDate();
  };

  const fetchLeaveBalances = async () => {
    try {
      setBalanceLoading(true);
      const getFinYear = (date = new Date()) => {
        const month = date.getMonth();
        const year = date.getFullYear();
        return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      };
      const finYear = getFinYear();
      const res = await portalInstance.get(`/api/leaves/balance?year=${finYear}`);
      if (res.data?.success) {
        setLeaveBalances(res.data.data || {});
        setProbationInfo({
          inProbation: !!res.data.inProbation,
          probationEndDate: res.data.probationEndDate || null,
        });
        if (res.data.permissionConfig) {
          setPermissionConfig(res.data.permissionConfig);
        }
      }
    } catch (err) {
      console.error("Failed to fetch leave balances", err);
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      setError("");

      let res;

      if (activeTab === "permission") {
        // Permissions are stored in a separate collection — use dedicated endpoint
        const params = {};
        if (statusFilter && statusFilter !== "All") {
          params.status = statusFilter;
        }
        res = await portalInstance.get("/api/leaves/my-permissions", { params });
      } else {
        const params = {
          requestType: activeTab,
        };
        if (statusFilter && statusFilter !== "All") {
          params.status = statusFilter;
        }
        res = await portalInstance.get("/api/leaves", { params });
      }

      let data = res.data?.data || [];
      if (activeTab === "permission") {
        data = data.map((item) => {
          if (item.from && item.to) {
            const fromD = new Date(item.from);
            const toD = new Date(item.to);
            if (!isNaN(fromD.getTime()) && !isNaN(toD.getTime())) {
              const startH = String(fromD.getHours()).padStart(2, "0");
              const startM = String(fromD.getMinutes()).padStart(2, "0");
              const endH = String(toD.getHours()).padStart(2, "0");
              const endM = String(toD.getMinutes()).padStart(2, "0");
              return {
                ...item,
                startTime: `${startH}:${startM}`,
                endTime: `${endH}:${endM}`,
              };
            }
          }
          return item;
        });
      }

      setLeaveRequests(data);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
    fetchLeaveBalances();
  }, [activeTab, statusFilter]);

  const validateForm = () => {
    if (!formData.fromDate) {
      toast.error(
        activeTab === "permission"
          ? "Please select Permission Date"
          : "Please select From Date"
      );
      return false;
    }

    if (activeTab === "permission") {
      if (!formData.startTime || !formData.endTime) {
        toast.error("Please select From Time and To Time");
        return false;
      }
      if (formData.startTime >= formData.endTime) {
        toast.error("To Time must be after From Time");
        return false;
      }
      if (formData.startTime < "10:00" || formData.startTime > "18:30" || formData.endTime < "10:00" || formData.endTime > "18:30") {
        toast.error("Permission times must be exactly within office hours (10:00 AM - 6:30 PM)");
        return false;
      }
      if (!formData.detailedReason) {
        toast.error("Please enter a reason");
        return false;
      }
      return true;
    }

    const maxDate = getMaxDate();
    if (formData.fromDate > maxDate) {
      toast.error("From Date cannot be more than 3 months from today");
      return false;
    }

    if (formData.toDate && formData.toDate > maxDate) {
      toast.error("To Date cannot be more than 3 months from today");
      return false;
    }

    if (formData.dayType === "Half Day") {
      if (!formData.startTime || !formData.endTime) {
        toast.error("Please select From Time and To Time for Half Day");
        return false;
      }
      if (formData.startTime >= formData.endTime) {
        toast.error("To Time must be after From Time");
        return false;
      }

      if (isToday(formData.fromDate)) {
        const currentTime = getCurrentTime();
        if (formData.startTime < currentTime) {
          toast.error("From Time cannot be in the past");
          return false;
        }
        if (formData.endTime <= currentTime) {
          toast.error("To Time cannot be in the past");
          return false;
        }
      }
    }

    if (formData.dayType === "2 Days") {
      if (!formData.toDate) {
        toast.error("To Date is required for 2 Days");
        return false;
      }
    }

    if (formData.dayType === "More than 3 Days") {
      if (!formData.toDate) {
        toast.error("Please select To Date");
        return false;
      }
      if (parseFloat(formData.noOfDays || "0") < 3) {
        toast.error("Please select at least 3 days for this duration");
        return false;
      }
    }

    if (formData.leaveType === "Others" && !formData.otherLeaveType.trim()) {
      toast.error("Please specify Leave Type");
      return false;
    }

    if (formData.reasonType === "Others" && !formData.otherReason.trim()) {
      toast.error("Please enter specific reason");
      return false;
    }

    return true;
  };

  const handleConfirmCombined = async () => {
    setCombinedIntimationModal(null);
    const permPayload = {
      fromDate: formData.fromDate,
      fromTime: formData.startTime,
      toTime: formData.endTime,
      reasonType: formData.reasonType,
      detailedReason: formData.detailedReason,
      permissionType: formData.permissionType,
      isCombinedHalfDay: true,
    };
    try {
      setLoading(true);
      await portalInstance.post("/api/leaves/permission", permPayload);
      toast.success("Combined Permission & Half-Day Leave request submitted successfully");
      handleFormClose();
      fetchLeaveRequests();
      fetchLeaveBalances();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToHalfDay = () => {
    setCombinedIntimationModal(null);
    setActiveTab("leave");
    setFormData((prev) => ({ ...prev, dayType: "Half Day" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      setError("");

      if (activeTab === "permission") {
        if (!formData.permissionType) {
          toast.error("Please select Permission Type (Morning / Out & Return / Evening)");
          return;
        }

        const permPayload = {
          fromDate: formData.fromDate,
          fromTime: formData.startTime,
          toTime: formData.endTime,
          reasonType: formData.reasonType,
          detailedReason: formData.detailedReason,
          permissionType: formData.permissionType,
        };
        await portalInstance.post("/api/leaves/permission", permPayload);
        toast.success("Permission sent successfully");
        handleFormClose();
        fetchLeaveRequests();
        fetchLeaveBalances();
        return;
      } else {
        const payload = {
          requestType: activeTab,
          leaveType: activeTab === "leave" ? formData.leaveType : null,
          otherLeaveType:
            formData.leaveType === "Others" ? formData.otherLeaveType : "",
          dayType: formData.dayType,
          fromDate: formData.fromDate,
          toDate:
            formData.dayType === "2 Days" ||
              formData.dayType === "More than 3 Days"
              ? formData.toDate
              : formData.fromDate,
          startTime:
            formData.dayType === "Half Day" ? formData.startTime : "",
          endTime: formData.dayType === "Half Day" ? formData.endTime : "",
          noOfDays: parseFloat(formData.noOfDays || "0"),
          reasonType: formData.reasonType,
          otherReason:
            formData.reasonType === "Others" ? formData.otherReason : "",
          detailedReason: formData.detailedReason,
          leaveDates: formData.leaveDates,
        };

        if (editingLeaveId) {
          await portalInstance.put(`/api/leaves/${editingLeaveId}`, payload);
          const type = activeTab === "leave" ? "Leave" : "WFH";
          toast.success(`${type} updated successfully`);
        } else {
          await portalInstance.post("/api/leaves", payload);
          const type = activeTab === "leave" ? "Leave" : "WFH";
          toast.success(`${type} requested successfully`);
        }
      }

      await fetchLeaveRequests();

      setFormData(initialFormState);
      setOriginalFormData(initialFormState);
      setShowForm(false);
      setEditingLeaveId(null);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || "Failed to submit request";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (leave) => {
    setSelectedLeave(leave);
    setShowLeaveModal(true);
  };

  const limitWords = (text = "", wordLimit = 10) => {
    const words = text.split(" ");
    if (words.length <= wordLimit) return text;
    return words.slice(0, wordLimit).join(" ") + " ...";
  };

  const handleModalUpdate = () => {
    if (!selectedLeave) return;
    const l = selectedLeave;

    setEditingLeaveId(l._id || l.id);

    const leaveRequestType = l.requestType || "leave";
    setActiveTab(leaveRequestType);

    const reasonValues = reasonOptions.map((r) => r.value);
    const isStandardReason = reasonValues.includes(l.reasonType);

    const newFormData = {
      leaveType: l.leaveType || "",
      dayType: l.dayType || "Half Day",
      fromDate: l.fromDate ? l.fromDate.slice(0, 10) : "",
      toDate: l.toDate ? l.toDate.slice(0, 10) : "",
      startTime: l.startTime || "",
      endTime: l.endTime || "",
      noOfDays: String(l.noOfDays || "0.5"),
      reasonType: isStandardReason ? l.reasonType : "Others",
      otherReason: isStandardReason ? l.otherReason || "" : l.reasonType,
      detailedReason: l.detailedReason || "",
      otherLeaveType: l.otherLeaveType || "",
      leaveDates: l.leaveDates || [],
    };

    setFormData(newFormData);
    setOriginalFormData(newFormData);
    setShowForm(true);
    setShowLeaveModal(false);
  };

  // ✅ ISSUE 5 FIX — Cancel message now handles permission type
  const handleRequestCancel = async () => {
    if (!selectedLeave) return;
    try {
      setLoading(true);
      setError("");
      await portalInstance.put(
        `/api/leaves/${selectedLeave._id || selectedLeave.id}/status`,
        { status: "Cancelled" }
      );
      const type =
        selectedLeave.requestType === "permission"
          ? "Permission"
          : selectedLeave.requestType === "leave"
            ? "Leave"
            : "WFH";
      toast.success(`${type} cancelled successfully`);
      setShowLeaveModal(false);
      await fetchLeaveRequests();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || "Failed to cancel request";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingLeaveId(null);
    setFormData(initialFormState);
    setOriginalFormData(initialFormState);
  };

  const filteredRequests = useMemo(() => {
    if (!Array.isArray(leaveRequests)) return [];

    return leaveRequests.filter((item) => {
      const dateStr = item.fromDate || item.toDate || item.createdAt;
      if (!dateStr) return false;

      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return false;

      const year = d.getFullYear().toString();
      const month = (d.getMonth() + 1).toString().padStart(2, "0");

      const matchesYear = year === selectedYear;
      const matchesMonth = selectedMonth === "All" || month === selectedMonth;

      return matchesYear && matchesMonth;
    });
  }, [leaveRequests, selectedYear, selectedMonth]);

  const paginatedData = filteredRequests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const getFormTitle = () => {
    return activeTab === "leave"
      ? "Request Leave"
      : activeTab === "permission"
        ? "Request Permission"
        : "Request WFH";
  };

  const getTableTitle = () => {
    return activeTab === "leave"
      ? "My Leave Requests"
      : activeTab === "permission"
        ? "My Permission Requests"
        : "My WFH Requests";
  };

  const leaveTypeLabels = leaveCategories.reduce((acc, cat) => {
    acc[cat.name] = cat.name;
    return acc;
  }, { Others: "Others" });

  const leaveTotals = useMemo(() => {
    return Object.values(leaveBalances).reduce(
      (acc, curr) => {
        acc.total += curr.total || 0;
        acc.used += curr.used || 0;
        acc.remaining += curr.remaining || 0;
        return acc;
      },
      { total: 0, used: 0, remaining: 0 }
    );
  }, [leaveBalances]);

  // ── Calculate dynamic Permission Quota & Usage ──
  // Rule:
  // - Informed permissions (status: "INFORMED" / "Informed"): Admin does not approve/reject, counts as used immediately.
  // - Normal permissions: Admin must Approve or Reject. Counts as used ONLY when status is "APPROVED" / "Approved".
  //   Pending requests do NOT reduce the count.
  const permissionUsage = useMemo(() => {
    const totalAllowed =
      permissionConfig?.allowedFreeCount ??
      (probationInfo?.inProbation
        ? permissionConfig?.probationFreeCount
        : permissionConfig?.permanentFreeCount) ??
      2;

    if (activeTab !== "permission") {
      return { total: totalAllowed, used: 0, remaining: totalAllowed };
    }

    const isCountedPermission = (p) => {
      const s = (p.status || "").toUpperCase();
      return s === "INFORMED" || s === "APPROVED";
    };

    const parsePermDate = (p) => {
      const dateStr = p.fromDate || p.from || p.createdAt;
      if (!dateStr) return null;
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    // If a specific month is selected (e.g. "09" for September)
    if (selectedMonth && selectedMonth !== "All") {
      const count = (leaveRequests || []).filter((p) => {
        const d = parsePermDate(p);
        if (!d) return false;
        const year = d.getFullYear().toString();
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        return year === selectedYear && month === selectedMonth && isCountedPermission(p);
      }).length;

      return {
        total: totalAllowed,
        used: count,
        remaining: Math.max(0, totalAllowed - count),
      };
    }

    // When "All Months" is selected:
    // 1. Check if the current calendar month has any used permissions:
    const now = new Date();
    const curYearStr = now.getFullYear().toString();
    const curMonthStr = (now.getMonth() + 1).toString().padStart(2, "0");

    const curMonthCount = (leaveRequests || []).filter((p) => {
      const d = parsePermDate(p);
      if (!d) return false;
      return (
        d.getFullYear().toString() === curYearStr &&
        (d.getMonth() + 1).toString().padStart(2, "0") === curMonthStr &&
        isCountedPermission(p)
      );
    }).length;

    if (curMonthCount > 0) {
      return {
        total: totalAllowed,
        used: curMonthCount,
        remaining: Math.max(0, totalAllowed - curMonthCount),
      };
    }

    // 2. If no permissions in current month, check all used permissions for the selected year
    const yearUsedPerms = (leaveRequests || []).filter((p) => {
      const d = parsePermDate(p);
      if (!d) return false;
      return d.getFullYear().toString() === selectedYear && isCountedPermission(p);
    });

    if (yearUsedPerms.length > 0) {
      // Find the most recent month with permission records:
      const monthCounts = {};
      yearUsedPerms.forEach((p) => {
        const d = parsePermDate(p);
        const mKey = (d.getMonth() + 1).toString().padStart(2, "0");
        monthCounts[mKey] = (monthCounts[mKey] || 0) + 1;
      });
      const sortedMonths = Object.keys(monthCounts).sort().reverse();
      const latestMonth = sortedMonths[0];
      const count = monthCounts[latestMonth] || 0;
      return {
        total: totalAllowed,
        used: count,
        remaining: Math.max(0, totalAllowed - count),
      };
    }

    // Fallback to permissionConfig if available
    const fallbackUsed = permissionConfig?.currentMonthCount ?? 0;
    return {
      total: totalAllowed,
      used: fallbackUsed,
      remaining: Math.max(0, totalAllowed - fallbackUsed),
    };
  }, [activeTab, leaveRequests, selectedMonth, selectedYear, permissionConfig, probationInfo]);

  const getLeaveTypeDisplay = (item) => {
    if (item.requestType === "permission") {
      const pType = item.permissionType || item.reasonType;
      return pType === "AFTERNOON" ? "Out & Return" : (pType === "MORNING" ? "Morning Permission" : (pType === "EVENING" ? "Evening Permission" : "Permission"));
    }

    if (item.requestType === "wfh") {
      return "Work From Home";
    }

    if (item.leaveType === "Others") {
      return item.otherLeaveType || "Other Leave";
    }

    return item.leaveType || "Leave";
  };

  return (
    <>
      <ToastContainer />
      <Sidebar />
      <div className="employeeLeaveRequest-wrapper">
        <div className="employeeLeaveRequest-container container-fluid">

          {/* ── Balance Cards Panel (Separate Container) ────────────────── */}
          {activeTab === "leave" && (
            <div className="employeeLeaveRequest-panel mb-4 employeeLeaveRequest-balanceCards-container">
              <div className="employeeLeaveRequest-balanceCards">
                {[
                  ...leaveCategories.map(cat => ({
                    key: cat.name,
                    item: leaveBalances[cat.name] || { total: 0, used: 0, remaining: 0 }
                  })),
                  { key: "Others", item: leaveBalances["Others"] || { used: 0 } }
                ].filter(({ key, item }) => {
                  const name = leaveTypeLabels[key] || key;
                  const hideList = ["ML", "PL", "COMP_OFF", "Maternity Leave", "Paternity Leave", "Comp Off"];
                  const isTargetCat = hideList.includes(key) || hideList.includes(name);

                  if (isTargetCat && (item.used || 0) === 0) {
                    return false;
                  }
                  return true;
                }).map(({ key, item }) => (
                  <div
                    key={key}
                    className="employeeLeaveRequest-balanceCard"
                  >
                    <div className="employeeLeaveRequest-balanceTitle">
                      {leaveTypeLabels[key] || key}
                    </div>

                    <div className="employeeLeaveRequest-balanceValue">
                      {key === "Others" ? (item.used || 0) : `${item.used || 0}/${item.total || 0}`}
                    </div>

                    <div className="employeeLeaveRequest-balanceLabel">
                      {key === "Others" ? "Approved" : "Used"}
                    </div>

                    {key !== "Others" && (
                      <div className="employeeLeaveRequest-balanceFooter">
                        <span>Available : {(item.total || 0) - (item.used || 0)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Permission Quota & Policy Banner for Employees (with Total, Used, and Remaining) ── */}
          {activeTab === "permission" && permissionConfig && (
            <div className="employeeLeaveRequest-panel mb-4">
              <div style={{
                background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                borderRadius: "12px",
                padding: "16px 20px",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "260px" }}>
                  <div>
                    <div style={{ fontSize: "14.5px", fontWeight: "500", color: "#3A466D" }}>
                      Monthly avilable Permission: {permissionUsage.total} Free Permissions
                    </div>
                    <div style={{ fontSize: "12px", color: "#868585", marginTop: "3px", lineHeight: "1.4" }}>
                      Employment Status: {probationInfo.inProbation ? "Probationary Employee" : "Permanent Employee"} From the {permissionUsage.total + 1}th permission onwards, each excess permission converts to {permissionConfig.leaveDaysPerPermission || 0.5} day of leave deducted from {permissionConfig.deductCategoryName || "Annual Leave"}.
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div style={{
                    background: "#ffffff",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    fontWeight: "500",
                    color: "#334155"
                  }}>
                    Total Permission: <span style={{ color: "#4f46e5", fontWeight: "700" }}>{permissionUsage.total}</span>
                  </div>

                  <div style={{
                    background: "#ffffff",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    fontWeight: "500",
                    color: "#334155"
                  }}>
                    Used: <span style={{ color: "#d97706", fontWeight: "700" }}>{permissionUsage.used}</span>
                  </div>

                  <div style={{
                    background: permissionUsage.remaining === 0 ? "#fef2f2" : "#f0fdf4",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${permissionUsage.remaining === 0 ? "#fca5a5" : "#86efac"}`,
                    fontSize: "12.5px",
                    fontWeight: "600",
                    color: permissionUsage.remaining === 0 ? "#dc2626" : "#16a34a"
                  }}>
                    Remaining: <span style={{ fontWeight: "500" }}>{permissionUsage.remaining}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Create Request Form Panel (Separate Container) ────────────────── */}
          {showForm && (
            <div className="employeeLeaveRequest-panel mb-4 animate-slide-down employeeLeaveRequest-form-panel">
              <div className="employeeLeaveRequest-form-body">
                <div className="d-flex justify-content-between align-items-center mb-3 employeeLeaveRequest-form-header">
                  <h4 className="common-modal-title m-0">
                    {activeTab === "permission"
                      ? "Request Permission"
                      : getFormTitle()}
                  </h4>
                  <button
                    className="common-modal-close-x"
                    onClick={handleFormClose}
                    type="button"
                  >
                    ✕
                  </button>
                </div>

                {error && (
                  <div className="alert alert-danger py-2">{error}</div>
                )}

                <form onSubmit={handleSubmit} id="leaveRequestForm">
                  {/* Intimation warning banner when employee has reached or exceeded their free quota */}
                  {activeTab === "permission" && permissionConfig && permissionUsage.used >= permissionUsage.total && (
                    <div style={{
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "#92400e"
                    }}>
                      <span style={{ fontSize: "18px", flexShrink: 0 }}>⚠️</span>
                      <div style={{ fontSize: "12.5px", lineHeight: "1.4" }}>
                        <div style={{ fontWeight: "700", marginBottom: "2px" }}>
                          Monthly Free Permission Limit Reached
                        </div>
                        <div>
                          Free limit ({permissionUsage.total}) exceeded. This request is allowed and will deduct <strong>{permissionConfig.leaveDaysPerPermission || 0.5} day leave</strong> from <strong>{permissionConfig.deductCategoryName || "Annual Leave"}</strong> upon approval.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="row mb-3 employeeLeaveRequest-formRow employeeLeaveRequest-formRow--schedule">
                    {activeTab === "leave" && (
                      <div className="col-12 col-sm-7 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-formCol--duration">
                        <label className="employeeLeaveRequest-label">
                          Leave Type
                        </label>
                        <CustomDropdown
                          options={leaveTypeOptions}
                          value={formData.leaveType}
                          onChange={handleLeaveTypeSelect}
                          placeholder="Select Leave Type"
                          className="employeeLeaveRequest__customDropdown employeeLeaveRequest__customDropdown--duration"
                        />
                      </div>
                    )}

                    {activeTab === "leave" &&
                      formData.leaveType === "Others" && (
                        <div className="col-12 col-sm-6 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-formCol--duration">
                          <label className="employeeLeaveRequest-label">
                            Specify Leave Type
                          </label>
                          <input
                            type="text"
                            name="otherLeaveType"
                            className="employeeLeaveRequest-inputs"
                            placeholder="Enter Leave Type"
                            value={formData.otherLeaveType}
                            onChange={handleInputChange}
                          />
                        </div>
                      )}

                    {activeTab !== "permission" && (
                      <div className="col-12 col-sm-7 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-formCol--duration">
                        <label className="employeeLeaveRequest-label">
                          Select Duration
                        </label>
                        <CustomDropdown
                          options={dayOptions}
                          value={formData.dayType}
                          onChange={handleDayTypeSelect}
                          placeholder="Select Duration"
                          className="employeeLeaveRequest__customDropdown employeeLeaveRequest__customDropdown--duration"
                        />
                      </div>
                    )}

                    {(activeTab === "permission" ||
                      formData.dayType === "Half Day" ||
                      formData.dayType === "1 Day") && (
                        <div className="col-12 col-sm-5 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-formCol--singleDate">
                          <label className="employeeLeaveRequest-label">
                            {activeTab === "permission"
                              ? "Permission Date"
                              : "Date"}
                          </label>
                          <div className="employeeLeaveRequest-dateInputWrapper">
                            <input
                              ref={fromRef}
                              type="date"
                              name="fromDate"
                              className="employeeLeaveRequest-input hide-default-icon"
                              value={formData.fromDate}
                              onChange={handleInputChange}
                              min={getTodayDate()}
                              max={getMaxDate()}
                            />
                            <img
                              src={DateIcon}
                              alt="cal"
                              className="employeeLeaveRequest-dateIcon"
                              onClick={() => fromRef.current?.showPicker()}
                            />
                          </div>
                        </div>
                      )}

                    {activeTab !== "permission" &&
                      (formData.dayType === "2 Days" ||
                        formData.dayType === "More than 3 Days") && (
                        <>
                          <div className="col-12 col-sm-6 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-formCol--rangeDate">
                            <label className="employeeLeaveRequest-label">
                              From Date
                            </label>
                            <div className="employeeLeaveRequest-dateInputWrapper">
                              <input
                                ref={fromRef}
                                type="date"
                                name="fromDate"
                                className="employeeLeaveRequest-input hide-default-icon"
                                value={formData.fromDate}
                                onChange={handleInputChange}
                                min={getTodayDate()}
                                max={getMaxDate()}
                              />
                              <img
                                src={DateIcon}
                                alt="cal"
                                className="employeeLeaveRequest-dateIcon"
                                onClick={() => fromRef.current?.showPicker()}
                              />
                            </div>
                          </div>
                          <div className="col-12 col-sm-6 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-formCol--rangeDate">
                            <label className="employeeLeaveRequest-label">
                              To Date
                            </label>
                            <div className="employeeLeaveRequest-dateInputWrapper">
                              <input
                                ref={toRef}
                                type="date"
                                name="toDate"
                                className="employeeLeaveRequest-input hide-default-icon"
                                value={formData.toDate}
                                onChange={handleInputChange}
                                min={getMinToDate()}
                                max={getMaxToDate()}
                                disabled={formData.dayType === "2 Days"}
                              />
                              <img
                                src={DateIcon}
                                alt="cal"
                                className="employeeLeaveRequest-dateIcon"
                                onClick={() =>
                                  formData.dayType !== "2 Days" &&
                                  toRef.current?.showPicker()
                                }
                              />
                            </div>
                          </div>
                        </>
                      )}

                    {activeTab !== "permission" &&
                      formData.dayType === "More than 3 Days" && (
                        <div className="col-12 col-sm-6 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-formCol--totalDays">
                          <label className="employeeLeaveRequest-label">
                            Total Days Calculated
                          </label>
                          <input
                            type="text"
                            name="noOfDays"
                            className="employeeLeaveRequest-input bg-light"
                            value={formData.noOfDays}
                            readOnly
                          />
                        </div>
                      )}

                    {/* Permission Type selector — shown ONLY on Permission tab */}
                    {activeTab === "permission" && (
                      <div className="col-12 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-formCol--reason">
                        <label className="employeeLeaveRequest-label">
                          Permission Type <span style={{ color: "red" }}>*</span>
                        </label>
                        <CustomDropdown
                          options={[
                            { value: "MORNING", label: "Morning Permission" },
                            { value: "AFTERNOON", label: "Out & Return" },
                            { value: "EVENING", label: "Evening Permission" },
                          ]}
                          value={formData.permissionType}
                          onChange={(val) => {
                            setFormData((prev) => {
                              const updates = { permissionType: val };
                              if (val === "MORNING") {
                                updates.startTime = "10:00";
                                updates.endTime = "";
                              } else if (val === "EVENING") {
                                updates.startTime = "";
                                updates.endTime = "18:30";
                              } else if (val === "AFTERNOON") {
                                updates.startTime = "";
                                updates.endTime = "";
                              }
                              return { ...prev, ...updates };
                            });
                          }}
                          placeholder="Permission Type"
                          className="employeeLeaveRequest__customDropdown employeeLeaveRequest__customDropdown--reason"
                        />
                      </div>
                    )}

                    {(activeTab === "permission" ||
                      formData.dayType === "Half Day") && (
                        <>
                          <div className="col-6 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-timeCol">
                            <label className="employeeLeaveRequest-label">
                              From Time
                            </label>
                            <div className="time-input-wrapper">
                              <input
                                type="time"
                                name="startTime"
                                className="employeeLeaveRequest-inputs custom-time"
                                value={formData.startTime}
                                onChange={handleInputChange}
                                min={activeTab === "permission" ? (getMinStartTime() > "10:00" ? getMinStartTime() : "10:00") : getMinStartTime()}
                                max={activeTab === "permission" ? "18:30" : undefined}
                              />
                              <FiClock className="time-icon" />
                            </div>
                          </div>
                          <div className="col-6 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-timeCol">
                            <label className="employeeLeaveRequest-label">
                              To Time
                            </label>
                            <div className="time-input-wrapper">
                              <input
                                type="time"
                                name="endTime"
                                className="employeeLeaveRequest-inputs custom-time"
                                value={formData.endTime}
                                onChange={handleInputChange}
                                min={activeTab === "permission" ? (getMinEndTime() > "10:00" ? getMinEndTime() : "10:00") : getMinEndTime()}
                                max={activeTab === "permission" ? "18:30" : undefined}
                              />
                              <FiClock className="time-icon" />
                            </div>
                          </div>
                        </>
                      )}
                  </div>

                  <div className="row mb-3 employeeLeaveRequest-formRow employeeLeaveRequest-formRow--reason">


                    {/* ✅ ISSUE 2 FIX — Reason dropdown now shown for ALL tabs including permission */}
                    <div className="col-12 col-md-auto employeeLeaveRequest-formCol employeeLeaveRequest-formCol--reason">
                      <label className="employeeLeaveRequest-label">
                        {activeTab === "permission"
                          ? "Permission Reason"
                          : "Reason Type"}
                      </label>
                      <CustomDropdown
                        options={reasonOptions}
                        value={formData.reasonType}
                        onChange={handleReasonSelect}
                        placeholder="Select Reason"
                        className="employeeLeaveRequest__customDropdown employeeLeaveRequest__customDropdown--reason"
                      />
                    </div>

                    {formData.reasonType === "Others" && (
                      <div className="col-12 employeeLeaveRequest-formCol employeeLeaveRequest-formCol--specifyReason">
                        <label className="employeeLeaveRequest-label">
                          Specify Reason
                        </label>
                        <input
                          type="text"
                          name="otherReason"
                          className="employeeLeaveRequest-inputs"
                          placeholder="Please enter your specific reason..."
                          value={formData.otherReason}
                          onChange={handleInputChange}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mb-4 employeeLeaveRequest-descriptionWrap">
                    <label className="employeeLeaveRequest-label">
                      {activeTab === "permission"
                        ? "Reason"
                        : "Request Description"}
                    </label>
                    <textarea
                      name="detailedReason"
                      className="employeeLeaveRequest-textarea"
                      placeholder="Explain your reason..."
                      rows={4}
                      value={formData.detailedReason}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="modal-footer security-maker-modal-footer employeeLeaveRequest-form-footer">
                    <button
                      type="button"
                      className="common-modal-btn btn-small-cancel"
                      onClick={handleFormClose}
                    >
                      Close Form
                    </button>
                    <button
                      type="submit"
                      className="common-modal-btn btn-update"
                      disabled={loading}
                    >
                      {loading
                        ? editingLeaveId
                          ? "Updating..."
                          : "Submitting..."
                        : editingLeaveId
                          ? activeTab === "leave"
                            ? "Update Leave"
                            : activeTab === "permission"
                              ? "Update Permission"
                              : "Update WFH"
                          : activeTab === "leave"
                            ? "Request Leave"
                            : activeTab === "permission"
                              ? "Request Permission"
                              : "Request WFH"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="employeeLeaveRequest-panel">
            {/* TOP BAR */}

            <div className="employeeLeaveRequest-tableTopBar">
              <div className="employeeLeaveRequest-tabContainer">
                {/* ✅ ISSUE 1 FIX — All three buttons properly closed */}
                <div className="employeeLeaveRequest-tabs">
                  <button
                    className={`employeeLeaveRequest-tab ${activeTab === "leave"
                        ? "employeeLeaveRequest-tab--active"
                        : ""
                      }`}
                    onClick={() => handleTabChange("leave")}
                  >
                    <span
                      className={`employeeLeaveRequest-tabCircle ${activeTab === "leave" ? "active" : ""
                        }`}
                    ></span>
                    Leave Requests
                  </button>

                  <button
                    className={`employeeLeaveRequest-tab ${activeTab === "wfh"
                        ? "employeeLeaveRequest-tab--active"
                        : ""
                      }`}
                    onClick={() => handleTabChange("wfh")}
                  >
                    <span
                      className={`employeeLeaveRequest-tabCircle ${activeTab === "wfh" ? "active" : ""
                        }`}
                    ></span>
                    Work From Home
                  </button>

                  <button
                    className={`employeeLeaveRequest-tab ${activeTab === "permission"
                        ? "employeeLeaveRequest-tab--active"
                        : ""
                      }`}
                    onClick={() => handleTabChange("permission")}
                  >
                    <span
                      className={`employeeLeaveRequest-tabCircle ${activeTab === "permission" ? "active" : ""
                        }`}
                    ></span>
                    Permission
                  </button>
                </div>
              </div>

              <div className="employeeLeaveRequest-tableTopBarRight">
                <CustomDropdown
                  options={yearOptions}
                  value={selectedYear}
                  onChange={handleYearFilterSelect}
                  placeholder={currentYear.toString()}
                  className="employeeLeaveRequest__customDropdown employeeLeaveRequest__filterDropdown year-dropdown"
                />
                <CustomDropdown
                  options={availableMonths}
                  value={selectedMonth}
                  onChange={handleMonthFilterSelect}
                  placeholder="All Months"
                  className="employeeLeaveRequest__customDropdown employeeLeaveRequest__filterDropdown month-dropdown"
                />
                {!showForm && (
                  <button
                    className="employeeLeaveRequest-submitBtn"
                    onClick={() => {
                      setEditingLeaveId(null);
                      setFormData(initialFormState);
                      setOriginalFormData(initialFormState);
                      setShowForm(true);
                                    }}
                  >
                    Create Request
                  </button>
                )}
              </div>
            </div>

            {error && !showForm && (
              <div className="alert alert-danger py-2">{error}</div>
            )}

            {/* TABLE */}
            <div className="employeeLeaveRequest-tableCard">
              <div className="table-responsive">
                <div className="commonTableLayout">
                  <div className={`employeeLeaveRequest-tableHeader ${activeTab === "permission" ? "employeeLeaveRequest-tableHeader--permission" : ""}`}>
                    <div className="employeeLeaveRequest-headerCell">S.No</div>

                    {/* ✅ ISSUE 3 FIX — Dynamic header labels for permission tab */}
                    <div className="employeeLeaveRequest-headerCell">
                      {activeTab === "permission"
                        ? "Permission Date"
                        : "Date Range"}
                    </div>
                    <div className="employeeLeaveRequest-headerCell">
                      {activeTab === "permission" ? "Duration" : "Total Days"}
                    </div>

                    <div className="employeeLeaveRequest-tableCell--start">
                      Reason
                    </div>
                    {activeTab === "permission" ? (
                      <>
                        <div className="employeeLeaveRequest-headerCell">From</div>
                        <div className="employeeLeaveRequest-headerCell">To</div>
                      </>
                    ) : (
                      <div className="employeeLeaveRequest-headerCell">Applied On</div>
                    )}
                    <div className="employeeLeaveRequest-tableCell--start">
                      Description
                    </div>
                    <div className="employeeLeaveRequest-headerCell employeeLeaveRequest-headerCell--center">
                      Status
                    </div>
                  </div>

                  {loading && (
                    <div className="p-3 employeeLeaveRequest-tableCell">
                      Loading requests...
                    </div>
                  )}

                  {!loading && paginatedData.length === 0 && (
                    <div className="p-3 employeeLeaveRequest-tableCell">
                      No requests found.
                    </div>
                  )}

                  {!loading &&
                    paginatedData.map((item, index) => (
                      <div
                        key={item._id || item.id}
                        className={`employeeLeaveRequest-tableRow ${activeTab === "permission" ? "employeeLeaveRequest-tableRow--permission" : ""}`}
                        onClick={() => handleOpenModal(item)}
                      >
                        <div className="employeeLeaveRequest-tableCell">
                          {String(
                            (currentPage - 1) * PAGE_SIZE + index + 1
                          ).padStart(2, "0")}
                        </div>
                        <div className="employeeLeaveRequest-tableCell">
                          {formatShortDateRange(item.fromDate, item.toDate)}
                        </div>

                        {/* Duration: hours & minutes for permission, days for leave/wfh */}
                        <div className="employeeLeaveRequest-tableCell">
                          {item.requestType === "permission"
                            ? (() => {
                              if (!item.startTime || !item.endTime) return "-";
                              const [sh, sm] = item.startTime.split(":").map(Number);
                              const [eh, em] = item.endTime.split(":").map(Number);
                              const totalMins = (eh * 60 + em) - (sh * 60 + sm);
                              if (totalMins <= 0) return "-";
                              const hrs = Math.floor(totalMins / 60);
                              const mins = totalMins % 60;
                              return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                            })()
                            : `${item.noOfDays} ${item.noOfDays > 1 ? "Days" : "Day"
                            }`}
                        </div>

                        <div className="employeeLeaveRequest-tableCell employeeLeaveRequest-tableCell--start">
                          {getLeaveTypeDisplay(item)}
                        </div>
                        {item.requestType === "permission" ? (
                          <>
                            <div className="employeeLeaveRequest-tableCell">
                              {item.from ? (() => {
                                const d = new Date(item.from);
                                return isNaN(d.getTime()) ? (item.startTime || "-") : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                              })() : item.startTime || "-"}
                            </div>
                            <div className="employeeLeaveRequest-tableCell">
                              {item.to ? (() => {
                                const d = new Date(item.to);
                                return isNaN(d.getTime()) ? (item.endTime || "-") : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                              })() : item.endTime || "-"}
                            </div>
                          </>
                        ) : (
                          <div className="employeeLeaveRequest-tableCell">
                            {formatShortDate(item.createdAt)}
                          </div>
                        )}
                        <div className="employeeLeaveRequest-tableCell employeeLeaveRequest-tableCell--reason">
                          {limitWords(
                            item.detailedReason ||
                            item.otherReason ||
                            item.reasonType,
                            6
                          )}
                        </div>
                        <div className="employeeLeaveRequest-tableCell employeeLeaveRequest-tableCell--center">
                          <span
                            className={`employeeLeaveRequest-badge employeeLeaveRequest-badge--${(
                              item.status || "Pending"
                            )
                              .toLowerCase()
                              .replace(" ", "-")}`}
                          >
                            {item.status || "Pending"}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <Pagination
              totalItems={filteredRequests.length}
              pageSize={PAGE_SIZE}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              maxPagesInGroup={5}
            />
          </div>

          {/* ── COMBINED PERMISSION + HALF-DAY INTIMATION MODAL ── */}
          {combinedIntimationModal && (
            <Modal
              show={true}
              onHide={() => setCombinedIntimationModal(null)}
              centered
              backdrop="static"
            >
              <Modal.Header closeButton className="border-0 pb-0">
                <Modal.Title style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937" }}>
                  Permission Limit Notice (2-Hour Policy)
                </Modal.Title>
              </Modal.Header>
              <Modal.Body className="pt-2">
                <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "14px", borderRadius: "8px", marginBottom: "16px" }}>
                  <p style={{ fontSize: "14px", color: "#92400e", marginBottom: "8px", fontWeight: "500" }}>
                    Your requested duration is <strong>{combinedIntimationModal.durationText}</strong>. A maximum of 2 hours will be considered Permission. Any additional absence will be treated as Half-Day Leave.
                  </p>
                  <p style={{ fontSize: "12px", color: "#b45309", margin: 0 }}>
                    Permission is allowed for a maximum of 2 hours only. If you require more than 2 hours, please apply for Half-Day Leave instead of Permission.
                  </p>
                </div>
                <p style={{ fontSize: "13px", color: "#4b5563", marginBottom: 0 }}>
                  Would you like to submit this as a combined Permission + Half-Day Leave request for Admin approval, or switch to a Half-Day Leave application?
                </p>
              </Modal.Body>
              <Modal.Footer className="border-0 pt-0 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="common-modal-btn btn-cancel"
                  onClick={() => setCombinedIntimationModal(null)}
                  style={{ padding: "6px 14px", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="common-modal-btn btn-update"
                  onClick={handleSwitchToHalfDay}
                  style={{ padding: "6px 14px", fontSize: "13px" }}
                >
                  Apply Half-Day Leave
                </button>
                <button
                  type="button"
                  className="common-modal-btn btn-confirm-success"
                  onClick={handleConfirmCombined}
                  style={{ padding: "6px 16px", fontSize: "13px" }}
                >
                  Submit Combined Request
                </button>
              </Modal.Footer>
            </Modal>
          )}

          {showLeaveModal && selectedLeave && (
            <EmployeeLeaveRequestModal
              leaveCategories={leaveCategories}
              leaveData={{
                requestType: selectedLeave.requestType,
                employee: selectedLeave.employee,
                leaveType: selectedLeave.leaveType,
                otherLeaveType: selectedLeave.otherLeaveType,
                reasonType: selectedLeave.reasonType,
                startDate: selectedLeave.from || selectedLeave.fromDate,
                endDate: selectedLeave.to || selectedLeave.toDate,
                from: selectedLeave.from,
                to: selectedLeave.to,
                permissionType: selectedLeave.permissionType,
                totalDays: selectedLeave.noOfDays,
                reason:
                  selectedLeave.detailedReason ||
                  selectedLeave.otherReason ||
                  selectedLeave.reasonType,
                status: selectedLeave.status,
                rejectionRemark: selectedLeave.remark,
                startTime: selectedLeave.startTime,
                endTime: selectedLeave.endTime,
                createdAt: selectedLeave.createdAt,
                updatedAt: selectedLeave.updatedAt,
              }}
              onClose={() => setShowLeaveModal(false)}
              onUpdate={handleModalUpdate}
              onRequestCancel={handleRequestCancel}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default EmployeeRequestLeave;
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Container, Row, Col, Card, Modal } from "react-bootstrap";
import Sidebar from "../../HeaderSidebar/Sidebar";
import "./AttendancePage.css";
import { Icon } from "@iconify/react";
import { FiClock } from "react-icons/fi";
import Checkin from "../../../../public/Login.svg?url";
import Checkout from "../../../../public/Out.svg?url";
import WorkingHours from "../../../../public/Working.svg?url";
import workingdays from "../../../../public/Working day.svg";
import daypresent from "../../../../public/Day present.svg";
import leavetaken from "../../../../public/Leave taken.svg";
import attend from "../../../../public/Attend.svg";
import permission from "../../../../public/Permission.svg";
import { portalInstance } from "../../../Services/instance";
import CustomDropdown from "../../Common/CustomDropdown";
import moment from "moment";
import Pagination from "../Pagination/Pagination";
import { toast, ToastContainer } from "react-toastify";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

function AttendancePage() {
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();

  const [isNonWorkingDay, setIsNonWorkingDay] = useState(false);
  const [nonWorkingReason, setNonWorkingReason] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[currentMonthIndex]);
  const [joiningDate, setJoiningDate] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attendanceTableLoading, setAttendanceTableLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDayLimit, setSelectedDayLimit] = useState(10);
  const [showLateReasonModal, setShowLateReasonModal] = useState(false);
  const [lateReason, setLateReason] = useState("");
  const [hasInformPermission, setHasInformPermission] = useState(false);
  const [permissionTypeToday, setPermissionTypeToday] = useState(null);
  const [showPermissionTypeDropdown, setShowPermissionTypeDropdown] = useState(false);
  const permissionDropdownRef = useRef(null);
  const [liveDuration, setLiveDuration] = useState("00h:00m:00s");
  const [permissionType, setPermissionType] = useState("");
  const [permissionData, setPermissionData] = useState({
    fromTime: "",
    toTime: "",
    reason: "",
    informedVia: "Mobile Call",
    permissionType: "",
  });
  const [govHolidays, setGovHolidays] = useState(new Set());

  // ===== IP VALIDATION START =====
  const [showIPReasonModal, setShowIPReasonModal] = useState(false);
  const [ipReason, setIpReason] = useState("");
  const [pendingLateReason, setPendingLateReason] = useState("");
  const [isCheckoutIP, setIsCheckoutIP] = useState(false);
  // ===== IP VALIDATION END =====

  // ── DERIVED STATE ──────────────────────────────────────────
  const hasCheckedIn =
    !!todayAttendance?.checkIn1 ||
    !!todayAttendance?.checkIn2 ||
    !!todayAttendance?.checkInTime;

  const canReCheckIn =
    (!!todayAttendance?.checkIn1 || !!todayAttendance?.checkInTime) &&
    (!!todayAttendance?.checkOut1 || !!todayAttendance?.checkOutTime) &&
    !todayAttendance?.checkIn2 &&
    permissionTypeToday === "AFTERNOON";

  const isCurrentlyCheckedIn =
    (
      (todayAttendance?.checkIn1 || todayAttendance?.checkInTime) &&
      !(todayAttendance?.checkOut1 || todayAttendance?.checkOutTime)
    ) ||
    (todayAttendance?.checkIn2 && !todayAttendance?.checkOut2);

  const showCheckOutTime =
    !!(todayAttendance?.checkOutTime || todayAttendance?.checkOut1 || todayAttendance?.checkOut2) &&
    !isCurrentlyCheckedIn;

  const hasCheckedOut =
    !!todayAttendance?.checkOut2 ||
    (!!(todayAttendance?.checkOut1 || todayAttendance?.checkOutTime) &&
      !todayAttendance?.checkIn2 &&
      !canReCheckIn);

  const isSuspicious = !!todayAttendance?.suspiciousActivity;

  const START_YEAR = 2024;
  const START_MONTH_INDEX = 2;

  const YEARS = Array.from(
    { length: Math.max(1, currentYear - START_YEAR + 1) },
    (_, i) => currentYear - i
  );

  const getAvailableMonths = (year) => {
    if (year === currentYear && currentYear === START_YEAR) {
      return MONTHS.slice(START_MONTH_INDEX, currentMonthIndex + 1);
    }
    if (year === currentYear) {
      return MONTHS.slice(0, currentMonthIndex + 1);
    }
    if (year === START_YEAR) {
      return MONTHS.slice(START_MONTH_INDEX);
    }
    if (year > START_YEAR && year < currentYear) {
      return MONTHS;
    }
    return [];
  };

  const availableMonths = getAvailableMonths(selectedYear);

  useEffect(() => {
    const months = getAvailableMonths(selectedYear);
    if (!months.includes(selectedMonth)) {
      setSelectedMonth(months[months.length - 1] || "");
    }
  }, [selectedYear]);

  const formatTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatWorkingHours = (minutes) => {
    if (!minutes || minutes <= 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}h:${String(m).padStart(2, "0")}m:${String(s).padStart(2, "0")}s`;
  };

  // ── LIVE TIMER ────────────────────────────────────────────
  useEffect(() => {
    let intervalId;
    if (isCurrentlyCheckedIn) {
      const tick = () => {
        let totalMs = 0;
        const s1In = todayAttendance?.checkIn1 || todayAttendance?.checkInTime;
        const s1Out = todayAttendance?.checkOut1 || todayAttendance?.checkOutTime;
        if (s1In && s1Out) {
          totalMs += new Date(s1Out).getTime() - new Date(s1In).getTime();
        } else if (s1In && !s1Out) {
          totalMs += Date.now() - new Date(s1In).getTime();
        }
        if (todayAttendance?.checkIn2) {
          if (todayAttendance?.checkOut2) {
            totalMs += new Date(todayAttendance.checkOut2).getTime() - new Date(todayAttendance.checkIn2).getTime();
          } else {
            totalMs += Date.now() - new Date(todayAttendance.checkIn2).getTime();
          }
        }
        setLiveDuration(formatDuration(Math.floor(totalMs / 1000)));
      };
      tick();
      intervalId = setInterval(tick, 1000);
    } else if (hasCheckedOut) {
      let totalMs = 0;
      const s1In = todayAttendance?.checkIn1 || todayAttendance?.checkInTime;
      const s1Out = todayAttendance?.checkOut1 || todayAttendance?.checkOutTime;
      if (s1In && s1Out) totalMs += new Date(s1Out).getTime() - new Date(s1In).getTime();
      if (todayAttendance?.checkIn2 && todayAttendance?.checkOut2) {
        totalMs += new Date(todayAttendance.checkOut2).getTime() - new Date(todayAttendance.checkIn2).getTime();
      }
      setLiveDuration(formatDuration(Math.floor(totalMs / 1000)));
    } else {
      setLiveDuration("00h:00m:00s");
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [todayAttendance]);

  const checkNonWorkingDay = () => {
    if (!monthlyData?.calendarDays) return { status: false, reason: "" };
    const today = new Date();
    const todayDate = today.getDate();
    const todayData = monthlyData.calendarDays.find(
      (d) => d.day === todayDate && d.month === "current"
    );
    if (!todayData) return { status: false, reason: "" };
    const status = todayData.status?.toLowerCase();
    if (status === "approved" || status === "approved leave") return { status: true, reason: "Leave" };
    if (status === "holiday") return { status: true, reason: "Government Holiday" };
    if (todayData.isSunday || todayData.isSecondSaturday || todayData.isFourthSaturday) {
      return { status: true, reason: "Week Off" };
    }
    return { status: false, reason: "" };
  };

  const fetchTodayAttendance = async () => {
    try {
      const res = await portalInstance.get("/portal/attendance/today");
      setTodayAttendance(res.data.data || null);
      if (res.data.hasValidCheckInPermission) setHasInformPermission(true);
      setPermissionTypeToday(res.data.permissionType || null);
      if (res.data.user?.joiningDate) setJoiningDate(new Date(res.data.user.joiningDate));
    } catch (err) {
      console.error("Today attendance fetch failed", err);
    }
  };

  const fetchMonthlyAttendance = async (
    month = selectedMonth,
    year = selectedYear
  ) => {
    if (!month || !year) return;
    setAttendanceTableLoading(true);
    try {
      const res = await portalInstance.get(
        `/portal/attendance/monthly?month=${month}&year=${year}`
      );
      setMonthlyData(res.data.data || null);
    } catch (err) {
      console.error("Monthly attendance fetch failed", err);
      setMonthlyData(null);
    } finally {
      setAttendanceTableLoading(false);
    }
  };

  const fetchGovHolidays = async (year = selectedYear) => {
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
      setGovHolidays(new Set());
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchMonthlyAttendance();
      await fetchGovHolidays();
      await fetchTodayAttendance();
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      fetchMonthlyAttendance(selectedMonth, selectedYear);
      fetchGovHolidays(selectedYear);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, selectedYear, selectedDayLimit]);

  useEffect(() => {
    if (!monthlyData?.calendarDays) return;
    const check = checkNonWorkingDay();
    setIsNonWorkingDay(check.status);
    setNonWorkingReason(check.reason);
  }, [monthlyData, todayAttendance]);

  // ── CHECK-IN ──────────────────────────────────────────────
  const handleCheckIn = async (reason = "", ip = "") => {
    if (actionLoading || loading || isCurrentlyCheckedIn || hasCheckedOut) return;
    setActionLoading(true);
    try {
      const res = await portalInstance.post("/portal/attendance/check-in", {
        lateReason: reason,
        ipReason: ip,
      });
      const data = res.data.data;
      setTodayAttendance(data);
      setShowLateReasonModal(false);
      const now = new Date();
      const currentMonthName = MONTHS[now.getMonth()];
      const currentYearValue = now.getFullYear();
      if (selectedMonth === currentMonthName && selectedYear === currentYearValue) {
        await fetchMonthlyAttendance(selectedMonth, selectedYear);
        setCurrentPage(1);
      }
      toast.success("Checked in at " + formatTime(data.checkIn2 || data.checkIn1 || data.checkInTime));
    } catch (err) {
      // ===== IP VALIDATION START =====
      if (err?.response?.data?.requireIPReason) {
        setPendingLateReason(reason);
        setIpReason("");
        setShowIPReasonModal(true);
      } else {
        toast.error(err?.response?.data?.message || "Check-in failed");
      }
      // ===== IP VALIDATION END =====
    } finally {
      setActionLoading(false);
    }
  };

  // ── CHECK-OUT ─────────────────────────────────────────────
  const handleCheckOut = async (ip = "") => {
    if (actionLoading || loading || !hasCheckedIn || hasCheckedOut) return;
    setActionLoading(true);
    try {
      const res = await portalInstance.post("/portal/attendance/check-out", {
        ipReason: ip,
      });
      const data = res.data.data;
      setTodayAttendance(data);
      setMonthlyData((prev) => {
        if (!prev) return prev;
        const today = new Date().getDate();
        return {
          ...prev,
          attendanceRecords: prev.attendanceRecords.map((r) =>
            parseInt(r.date) === today
              ? {
                ...r,
                logout: formatTime(data.checkOut2 || data.checkOut1 || data.checkOutTime),
                workingHours: (() => {
                  let totalMins = 0;
                  const s1In = data?.checkIn1 || data?.checkInTime;
                  const s1Out = data?.checkOut1 || data?.checkOutTime;
                  if (s1In && s1Out) totalMins += Math.floor((new Date(s1Out) - new Date(s1In)) / 60000);
                  if (data?.checkIn2 && data?.checkOut2) totalMins += Math.floor((new Date(data.checkOut2) - new Date(data.checkIn2)) / 60000);
                  return formatWorkingHours(totalMins);
                })(),
                remarks: data.remarks || "—",
              }
              : r
          ),
        };
      });
      await fetchMonthlyAttendance(selectedMonth, selectedYear);
      toast.success("Checked out successfully");
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

  const cancelCheckOut = () => setShowCheckoutModal(false);

  // ── PERMISSION ────────────────────────────────────────────
  const handlePermissionClick = () => {
    let type = "CHECK_IN";
    if (hasCheckedIn) type = "CHECK_OUT";
    setPermissionType(type);
    setPermissionData((prev) => ({
      ...prev,
      permissionType: "",
    }));
    setShowPermissionModal(true);
  };

  const handleClosePermissionModal = () => {
    setShowPermissionModal(false);
    setPermissionType("");
    setPermissionData({ fromTime: "", toTime: "", reason: "", informedVia: "Mobile Call", permissionType: "" });
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
    const formattedFrom = moment(fromTime, ["h:mm A", "HH:mm"]).format("HH:mm");
    const formattedTo = moment(toTime, ["h:mm A", "HH:mm"]).format("HH:mm");
    if (formattedFrom < "10:00" || formattedFrom > "18:30" || formattedTo < "10:00" || formattedTo > "18:30") {
      toast.error("Permission times must be exactly within office hours (10:00 AM - 6:30 PM)");
      return;
    }
    const todayStr = moment().format("YYYY-MM-DD");
    const fromDate = `${todayStr}T${formattedFrom}`;
    const toDate = `${todayStr}T${formattedTo}`;
    if (moment(toDate).isSameOrBefore(moment(fromDate))) {
      toast.error("To time must be greater than From time");
      return;
    }
    try {
      setActionLoading(true);
      await portalInstance.post("/portal/attendance/inform-permission", {
        from: fromDate,
        to: toDate,
        reason: reason.trim(),
        type: permissionType,
        informedVia: "Mobile Call",
        permissionType: permissionData.permissionType,
      });
      toast.success("Inform permission submitted successfully");
      setHasInformPermission(true);
      handleClosePermissionModal();
      fetchTodayAttendance();
      fetchMonthlyAttendance();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit permission request");
    } finally {
      setActionLoading(false);
    }
  };

  // ── TABLE DATA ────────────────────────────────────────────
  const attendanceRecords = monthlyData?.attendanceRecords ?? [];
  const calendarDays = monthlyData?.calendarDays ?? [];

  const filteredRecords = React.useMemo(() => {
    return attendanceRecords.filter((r) => {
      if (!r || !r.date) return false;
      return (
        r.status === "Present" ||
        r.status === "Half Day" ||
        r.status === "Absent" ||
        r.status === "Leave" ||
        r.status === "leave" ||
        r.status === "Half Day Leave" ||
        r.status === "half day leave"
      );
    });
  }, [attendanceRecords]);

  const sortedRecords = React.useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const dateA = moment(`${a.date} ${selectedYear}`, "DD MMM YYYY");
      const dateB = moment(`${b.date} ${selectedYear}`, "DD MMM YYYY");
      return dateB.valueOf() - dateA.valueOf();
    });
  }, [filteredRecords, selectedYear]);

  const ROWS_PER_PAGE = selectedDayLimit;
  const totalPages = Math.ceil(sortedRecords.length / ROWS_PER_PAGE);
  const paginatedRecords = sortedRecords.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  // ── CALENDAR HELPERS ──────────────────────────────────────
  const getDotClass = (status) => {
    switch (status?.toLowerCase()) {
      case "present": return "emp-attendance-dot-present";
      case "absent": return "emp-attendance-dot-absent";
      case "approved":
      case "leave": return "emp-attendance-dot-approved";
      case "holiday": return "emp-attendance-dot-holiday";
      default: return "";
    }
  };

  const isWeekOffCell = (d) => {
    if (d.month !== "current") return false;
    if (d.status === "week") return true;
    if (d.isSunday || d.isSecondSaturday || d.isFourthSaturday) return true;
    return false;
  };

  const isBeforeJoiningCell = (d) => d.month === "current" && d.status === "before-joining";

  const isGovHolidayCell = (d) => {
    if (d.month !== "current") return false;
    const MONTHS_NUM = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    const monthNum = MONTHS_NUM[selectedMonth];
    if (!monthNum) return false;
    const dayStr = String(d.day).padStart(2, "0");
    const dateStr = `${selectedYear}-${monthNum}-${dayStr}`;
    return govHolidays.has(dateStr);
  };

  const attendancePercentage = monthlyData?.attendancePercentage ?? "0%";
  const computedLeavesTotalDisplay = (
    Number(monthlyData?.leaves || 0) + Number(monthlyData?.absentDays || 0)
  ).toString().padStart(2, "0");

  // ── CLICK OUTSIDE ─────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (permissionDropdownRef.current && !permissionDropdownRef.current.contains(event.target)) {
        setShowPermissionTypeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── RENDER ────────────────────────────────────────────────
  return (
    <>
      <Sidebar />
      <div className="emp-attendance-page-wrapper">
        <Container fluid className="emp-attendance-container">

          {isSuspicious && (
            <Row className="mb-3">
              <Col>
                <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "8px", padding: "12px 18px", display: "flex", alignItems: "center", gap: "10px", color: "#856404", fontWeight: 500, fontSize: "14px" }}>
                  <Icon icon="solar:danger-triangle-bold" width={20} color="#ffc107" />
                  <span>Security Alert: Your check-in and check-out were detected from different locations. If this was not you, please contact your admin immediately.</span>
                </div>
              </Col>
            </Row>
          )}

          {/* ── TOP CARDS ── */}
          <Row className="emp-attendance-top-cards-row">
            {/* CHECK IN */}
            <Col lg={4} md={6} className="mb-4">
              <Card className="emp-attendance-card emp-attendance-check-in-card">
                <Card.Body>
                  <div className="emp-attendance-card-header-section" style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className="emp-attendance-icon-box emp-attendance-check-in-icon">
                        <img src={Checkin} alt="Check In" />
                      </div>
                      <span className="emp-attendance-card-title">Check In</span>
                    </div>
                    <span className="emp-attendance-permission-text" onClick={handlePermissionClick} style={{ cursor: "pointer" }}>
                      Inform Permission
                    </span>
                  </div>

                  {loading ? (
                    <div className="emp-attendance-time-display">Loading...</div>
                  ) : hasCheckedIn ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                        <div className="emp-attendance-time-display" style={{ marginBottom: 0 }}>
                          {formatTime(todayAttendance?.checkIn2 || todayAttendance?.checkIn1 || todayAttendance?.checkInTime)}
                        </div>
                        {todayAttendance?.checkIn1 && todayAttendance?.checkOut1 && todayAttendance?.checkIn2 && (
                          <div style={{ fontSize: "10px", color: "#7b7b7b", whiteSpace: "nowrap" }}>
                            First Check-In : {formatTime(todayAttendance?.checkIn1)}
                          </div>
                        )}
                        {canReCheckIn && (
                          <button
                            type="button"
                            className="emp-attendance-check-in-btn"
                            onClick={() => handleCheckIn()}
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
                      type="button"
                      className="emp-attendance-check-in-btn"
                      onClick={() => {
                        if (isNonWorkingDay) { toast.error(nonWorkingReason); return; }
                        const now = moment();
                        const hour = now.hour();
                        const minute = now.minute();
                        if ((hour > 10 || (hour === 10 && minute > 0)) && !canReCheckIn && !hasInformPermission) {
                          setShowLateReasonModal(true);
                          return;
                        }
                        handleCheckIn();
                      }}
                      disabled={isNonWorkingDay || actionLoading || isCurrentlyCheckedIn || hasCheckedOut}
                    >
                      {actionLoading ? "Checking In..." : canReCheckIn ? "Check-In Again" : "Check-In"}
                    </button>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* CHECK OUT */}
            <Col lg={4} md={6} className="mb-4">
              <Card className="emp-attendance-card emp-attendance-check-out-card">
                <Card.Body>
                  <div className="emp-attendance-card-header-section" style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className="emp-attendance-icon-box emp-attendance-check-out-icon">
                        <img src={Checkout} alt="Check Out" />
                      </div>
                      <span className="emp-attendance-card-title">Check Out</span>
                    </div>
                    <span className="emp-attendance-permission-text" onClick={handlePermissionClick} style={{ cursor: "pointer" }}>
                      Inform Permission
                    </span>
                  </div>

                  {loading ? (
                    <button className="emp-attendance-logout-btn" disabled>Loading...</button>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                        {showCheckOutTime ? (
                          <div className="emp-attendance-time-display" style={{ marginBottom: 0 }}>
                            {formatTime(todayAttendance?.checkOut2 || todayAttendance?.checkOut1 || todayAttendance?.checkOutTime)}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="emp-attendance-logout-btn"
                            onClick={() => {
                              if (!isCurrentlyCheckedIn) return;
                              if (isNonWorkingDay) { toast.error(nonWorkingReason); return; }
                              setShowCheckoutModal(true);
                            }}
                            disabled={!isCurrentlyCheckedIn || actionLoading || isNonWorkingDay}
                            style={{ width: "50%", margin: 0 }}
                          >
                            {actionLoading ? "Checking Out..." : "Check-out"}
                          </button>
                        )}
                        {todayAttendance?.checkIn1 && todayAttendance?.checkOut1 && todayAttendance?.checkIn2 && (
                          <div style={{ fontSize: "10px", color: "#7b7b7b", whiteSpace: "nowrap" }}>
                            First Check-Out : {formatTime(todayAttendance?.checkOut1)}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* WORKING HOURS */}
            <Col lg={4} md={6} className="mb-4">
              <Card className="emp-attendance-card emp-attendance-working-hours-card">
                <Card.Body>
                  <div className="emp-attendance-card-header-section" style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className="emp-attendance-icon-box emp-attendance-check-in-icon">
                        <img src={WorkingHours} alt="Working Hours" />
                      </div>
                      <span className="emp-attendance-card-title">Working Hours</span>
                    </div>
                  </div>
                  <div className="emp-attendance-time-display">
                    {loading ? "Loading..." : (showCheckOutTime || hasCheckedIn) ? liveDuration : "00h:00m:00s"}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* INFO BANNER */}
          <Row className="emp-attendance-info-banner-row">
            <Col>
              <div className="emp-attendance-info-banner">
                Late check-in after 10:00 AM will be marked as late.
              </div>
            </Col>
          </Row>

          {/* MAIN CONTENT */}
          <Row className="emp-attendance-main-content-row">

            {/* ATTENDANCE TABLE */}
            <Col lg={7} className="mb-4">
              <Card className="emp-attendance-details-card">
                <Card.Body>
                  <div className="emp-attendance-details-header">
                    <h4 className="emp-attendance-details-title">Attendance Details</h4>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <div className="attendance-dropdown-wrapper">
                        <CustomDropdown
                          options={[10, 21, 31].map((d) => ({ label: d, value: d }))}
                          value={selectedDayLimit}
                          onChange={(val) => setSelectedDayLimit(val)}
                          placeholder="Days"
                          className="emp-attendance-month-dropdown"
                        />
                      </div>
                      <div className="attendance-dropdown-wrapper">
                        <CustomDropdown
                          options={YEARS.map((y) => ({ label: y, value: y }))}
                          value={selectedYear}
                          onChange={(val) => setSelectedYear(val)}
                          placeholder="Year"
                          className="emp-attendance-month-dropdown"
                        />
                      </div>
                      <div className="attendance-dropdown-wrapper">
                        <CustomDropdown
                          options={availableMonths.map((m) => ({ label: m, value: m }))}
                          value={selectedMonth}
                          onChange={(val) => setSelectedMonth(val)}
                          placeholder="Select month"
                          className="emp-attendance-month-dropdown"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="emp-attendance-figma-table-container">
                    <div className="emp-attendance-table-wrapper">
                      {attendanceTableLoading && (
                        <div className="emp-attendance-table-loader-overlay">
                          <div className="emp-attendance-loader-spinner"></div>
                          <span>Loading...</span>
                        </div>
                      )}
                      <table className="emp-attendance-figma-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Check in</th>
                            <th>Check out</th>
                            <th>Status</th>
                            <th className="emp-attendance-nowrap">Working Hours</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRecords.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-4 text-muted">
                                {attendanceTableLoading ? "" : `No attendance records found for ${selectedMonth} ${selectedYear}`}
                              </td>
                            </tr>
                          ) : (
                            paginatedRecords.map((row, i) => {
                              const checkInReasonText = row.checkInIPReason || (row.checkOutIPReason ? null : row.ipReason);
                              const checkOutReasonText = row.checkOutIPReason;
                              const hasCheckInIP = !!checkInReasonText;
                              const hasCheckOutIP = !!checkOutReasonText;
                              const hasIPReason = hasCheckInIP || hasCheckOutIP;

                              return (
                                <tr
                                  key={i}
                                  className={`emp-attendance-table-row ${hasIPReason ? "has-ip-reason" : ""}`}
                                  title={
                                    hasCheckInIP
                                      ? `Check-in IP Reason: ${checkInReasonText}`
                                      : hasCheckOutIP
                                      ? `Check-out IP Reason: ${checkOutReasonText}`
                                      : undefined
                                  }
                                >
                                  <td className="emp-attendance-date-cell">
                                    {hasIPReason ? (
                                      <span className="emp-ip-date-gradient-badge">
                                        <span>{row.date.split(" ")[0]}</span>
                                        <small>{row.date.split(" ")[1]}</small>
                                      </span>
                                    ) : (
                                      <>
                                        <span>{row.date.split(" ")[0]}</span>
                                        <small>{row.date.split(" ")[1]}</small>
                                      </>
                                    )}

                                    {hasIPReason && (
                                      <div className="emp-attendance-row-hover-tooltip">
                                        {hasCheckInIP && hasCheckOutIP ? (
                                          <>
                                            <div className="emp-ip-tooltip-header">Different IP Check-in / Check-out</div>
                                            <div><strong>Check-in Reason:</strong> {checkInReasonText}</div>
                                            <hr style={{ margin: "6px 0", borderColor: "rgba(255,255,255,0.2)" }} />
                                            <div><strong>Check-out Reason:</strong> {checkOutReasonText}</div>
                                          </>
                                        ) : hasCheckInIP ? (
                                          <>
                                            <div className="emp-ip-tooltip-header">Different IP Check-in</div>
                                            <div><strong>IP Reason:</strong> {checkInReasonText}</div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="emp-ip-tooltip-header">Different IP Check-out</div>
                                            <div><strong>IP Reason:</strong> {checkOutReasonText}</div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td>{row.login || "—"}</td>
                                  <td>{row.logout || "—"}</td>
                                  <td>
                                    <span className={`emp-attendance-figma-status-pill ${
                                      (row.status === "Present" || row.status === "Half Day" || row.status === "Half Day Leave" || row.status === "half day leave") ? "emp-attendance-present"
                                        : row.status === "Absent" ? "emp-attendance-absent"
                                          : (row.status === "Leave" || row.status === "leave") ? "emp-attendance-approved"
                                            : "emp-attendance-neutral"
                                    }`}>
                                      {(row.status === "Present" || row.status === "Half Day" || row.status === "Half Day Leave" || row.status === "half day leave") ? "Present"
                                        : row.status === "Absent" ? "Absent"
                                          : (row.status === "Leave" || row.status === "leave") ? "Leave"
                                            : "—"}
                                    </span>
                                  </td>
                                  <td className="emp-attendance-nowrap">{row.workingHours || "—"}</td>
                                  <td className="emp-attendance-figma-remarks">
                                    {row.remarks && row.remarks !== "—" ? (
                                      (() => {
                                        const remark = row.remarks.toLowerCase();
                                        if (remark.includes("wfh")) {
                                          let cleanText = row.remarks.replace(/-?\s*wfh/i, "").trim();
                                          return (
                                            <>
                                              {cleanText && <span>{cleanText}</span>}
                                              <span className="wfh-badge" style={{ marginLeft: "6px" }}>WFH</span>
                                            </>
                                          );
                                        }
                                        if (remark.includes("auto checkout")) {
                                          return <span className="auto-checkout-badge">Auto Checkout</span>;
                                        }
                                        return row.remarks;
                                      })()
                                    ) : "-"}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    {sortedRecords.length > ROWS_PER_PAGE && (
                      <Pagination
                        totalItems={sortedRecords.length}
                        pageSize={ROWS_PER_PAGE}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                      />
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* MONTHLY OVERVIEW */}
            <Col lg={5} className="mb-4">
              <Card className="emp-attendance-overview-card emp-attendance-figma-overview">
                <Card.Body>
                  <div className="emp-attendance-overview-header">
                    <h5 className="emp-attendance-overview-title">Monthly Attendance Overview</h5>
                  </div>

                  <div className="emp-attendance-overview-stats-grid">
                    <div className="emp-attendance-overview-stat emp-attendance-blue">
                      <div className="emp-attendance-stat-icon"><img src={workingdays} alt="Working Days" /></div>
                      <div className="emp-attendance-label">Working Days</div>
                      <div className="emp-attendance-value emp-attendance-blue">{monthlyData?.workingDays ?? "—"}</div>
                    </div>
                    <div className="emp-attendance-overview-stat emp-attendance-green">
                      <div className="emp-attendance-stat-icon"><img src={daypresent} alt="Days Present" /></div>
                      <div className="emp-attendance-label">Days Present</div>
                      <div className="emp-attendance-value emp-attendance-green">{monthlyData?.presentDays ?? "—"}</div>
                    </div>
                    <div className="emp-attendance-overview-stat emp-attendance-orange">
                      <div className="emp-attendance-stat-icon"><img src={leavetaken} alt="Leaves Taken" /></div>
                      <div className="emp-attendance-label">Total Leave</div>
                      <div className="emp-attendance-value emp-attendance-orange">{monthlyData ? computedLeavesTotalDisplay : "—"}</div>
                    </div>
                  </div>

                  <div className="emp-attendance-wide-row" style={{ marginBottom: "15px" }}>
                    <div className="emp-attendance-stat emp-attendance-wide">
                      <div className="emp-attendance-stat-left" style={{ paddingLeft: "12px", paddingBottom: "8px" }}>
                        <div className="emp-attendance-stat-label">Leave</div>
                      </div>
                      <div className="emp-attendance-stat-value emp-attendance-grey" style={{ paddingRight: "12px" }}>
                        {monthlyData ? String(monthlyData.leaves || 0).padStart(2, "0") : "—"}
                      </div>
                    </div>
                    <div className="emp-attendance-stat emp-attendance-wide">
                      <div className="emp-attendance-stat-left" style={{ paddingLeft: "12px", paddingBottom: "8px" }}>
                        <div className="emp-attendance-stat-label">Absent Days</div>
                      </div>
                      <div className="emp-attendance-stat-value emp-attendance-grey" style={{ paddingRight: "12px" }}>
                        {monthlyData ? String(monthlyData.absentDays || 0).padStart(2, "0") : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="emp-attendance-wide-row">
                    <div className="emp-attendance-stat emp-attendance-wide emp-attendance-grey">
                      <div className="emp-attendance-stat-left">
                        <img src={permission} alt="Permission" />
                        <div className="emp-attendance-stat-label">Permissions</div>
                      </div>
                      <div className="emp-attendance-stat-value emp-attendance-grey">{monthlyData?.permissions ?? "—"}</div>
                    </div>
                    <div className="emp-attendance-stat emp-attendance-wide emp-attendance-purple">
                      <div className="emp-attendance-stat-left">
                        <img src={attend} alt="Attendance" />
                        <div className="emp-attendance-stat-label">Attendance</div>
                      </div>
                      <div className="emp-attendance-stat-value emp-attendance-purple">{attendancePercentage}</div>
                    </div>
                  </div>

                  {/* CALENDAR */}
                  <div className="emp-attendance-overview-calendar-row">
                    <div className="emp-attendance-figma-calendar">
                      <div className="emp-attendance-figma-cal-date-header">
                        <div className="emp-attendance-cal-date-left">
                          <span className="emp-attendance-cal-day-num">{new Date().getDate()}</span>
                          <span className="emp-attendance-cal-day-name">{new Date().toLocaleDateString("en-US", { weekday: "long" })}</span>
                        </div>
                        <div className="emp-attendance-cal-date-right">
                          <span className="emp-attendance-cal-year">{selectedYear}</span>
                          <span className="emp-attendance-cal-month">{selectedMonth}</span>
                        </div>
                      </div>
                      <div className="emp-attendance-figma-calendar-header">
                        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>
                      <div className="emp-attendance-figma-calendar-grid">
                        {calendarDays.length === 0 ? (
                          <div className="text-center py-4 text-muted" style={{ gridColumn: "1 / -1" }}>Calendar loading...</div>
                        ) : (
                          calendarDays.map((d, i) => {
                            const isHoliday = (d.status === "holiday" || (isGovHolidayCell(d) && !d.isActive)) && !d.isActive;
                            return (
                              <div
                                key={i}
                                className={[
                                  "emp-attendance-calendar-cell",
                                  d.month !== "current" ? "emp-attendance-muted" : "",
                                  getDotClass(d.status),
                                  isWeekOffCell(d) && !d.isActive ? "emp-attendance-weekend-blue" : "",
                                  isBeforeJoiningCell(d) && !d.isActive ? "emp-attendance-before-joining" : "",
                                ].filter(Boolean).join(" ")}
                              >
                                {d.isActive ? (
                                  <span className="emp-attendance-active-day">{d.day}</span>
                                ) : isHoliday ? (
                                  <span className="emp-cal-inner emp-attendance-holiday-circle">{d.day}</span>
                                ) : d.day}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="emp-attendance-figma-legend">
                      <div className="emp-attendance-legend-item">
                        <span className="emp-attendance-legend-pill emp-attendance-present"></span>
                        <span className="emp-attendance-legend-label">Present</span>
                      </div>
                      <div className="emp-attendance-legend-item">
                        <span className="emp-attendance-legend-pill emp-attendance-absent"></span>
                        <div className="emp-attendance-legend-text-group">
                          <span className="emp-attendance-legend-label">Absent</span>
                          <small className="emp-attendance-legend-subtext">( No Intimation)</small>
                        </div>
                      </div>
                      <div className="emp-attendance-legend-item">
                        <span className="emp-attendance-legend-pill emp-attendance-approved"></span>
                        <div className="emp-attendance-legend-text-group">
                          <span className="emp-attendance-legend-label">Leave</span>
                          <small className="emp-attendance-legend-subtext">( Leave Approved )</small>
                        </div>
                      </div>
                      <div className="emp-attendance-legend-item">
                        <span className="emp-attendance-legend-pill emp-attendance-holiday"></span>
                        <span className="emp-attendance-legend-label">Holidays</span>
                      </div>
                    </div>
                  </div>

                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>

      {/* CHECKOUT CONFIRM MODAL */}
      <Modal show={showCheckoutModal} onHide={cancelCheckOut} centered className="checkout-modal checkin-modal">
        <Modal.Body className="checkin-modal-body">
          <div className="checkin-modal-icon"><img src={Checkout} alt="check-out" className="check-in" /></div>
          <Modal.Title className="common-modal-title w-100 text-center" style={{ marginTop: "10px", marginBottom: "15px" }}>Confirm Check-out</Modal.Title>
          <div className="late-reason-inline-box text-center">
            <p className="late-entry-warning-text">Are you sure you want to check out?</p>
          </div>
          <div className="border-0 checkin-modal-footer d-flex justify-content-center w-100">
            <button
              className="common-modal-btn btn-small-cancel"
              onClick={() => {
                setShowCheckoutModal(false);
                handlePermissionClick();
              }}
            >
              Inform Permission
            </button>
            <button className="common-modal-btn btn-confirm-success" onClick={confirmCheckOut}>Check-out</button>
          </div>
        </Modal.Body>
      </Modal>

      {/* LATE REASON MODAL */}
      <Modal
        show={showLateReasonModal}
        onHide={() => { setShowLateReasonModal(false); setLateReason(""); }}
        centered
        className="checkin-modal"
      >
        <Modal.Body className="checkin-modal-body">
          <div className="checkin-modal-icon"><img src={Checkin} alt="check-in" className="check-in" /></div>
          <Modal.Title className="common-modal-title w-100 text-center" style={{ marginTop: "10px", marginBottom: "15px" }}>Mark Your Attendance</Modal.Title>
          <div className="late-reason-inline-box">
            <p className="late-entry-warning-text">Check-in after 10:00 AM is considered late entry.</p>
            <label className="late-reason-label">Reason</label>
            <textarea
              className="late-reason-textarea"
              placeholder="Enter reason for late entry"
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
            />
          </div>
          <div className="border-0 checkin-modal-footer d-flex justify-content-center w-100">
            <button className="common-modal-btn btn-small-cancel" onClick={() => { setShowLateReasonModal(false); setLateReason(""); }}>Close</button>
            <button
              className="common-modal-btn btn-confirm-success"
              onClick={() => {
                if (!lateReason.trim()) { toast.warning("Please enter the reason"); return; }
                const reason = lateReason.trim();
                setShowLateReasonModal(false);
                setLateReason("");
                handleCheckIn(reason);
              }}
              disabled={actionLoading}
            >
              {actionLoading ? "Checking In..." : "Check-in"}
            </button>
          </div>
        </Modal.Body>
      </Modal>

      {/* ===== IP VALIDATION START ===== */}
      <Modal
        show={showIPReasonModal}
        onHide={() => { setShowIPReasonModal(false); setIpReason(""); setIsCheckoutIP(false); }}
        centered
        className="checkin-modal"
      >
        <Modal.Body className="checkin-modal-body">
          <div className="checkin-modal-icon"><img src={Checkin} alt="check-in" className="check-in" /></div>
          <Modal.Title className="common-modal-title w-100 text-center" style={{ marginTop: "10px", marginBottom: "6px" }}>Different Network Detected</Modal.Title>
          <div className="late-reason-inline-box">
            <p className="late-entry-warning-text">You are checking {isCheckoutIP ? "out" : "in"} from a different network. Please enter the reason.</p>
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
            <button className="common-modal-btn btn-small-cancel" onClick={() => { setShowIPReasonModal(false); setIpReason(""); setIsCheckoutIP(false); }}>Cancel</button>
            <button
              className="common-modal-btn btn-confirm-success"
              onClick={() => {
                if (!ipReason.trim()) { toast.warning("Please enter a reason to continue."); return; }
                const reason = ipReason.trim();
                setShowIPReasonModal(false);
                setIpReason("");
                if (isCheckoutIP) {
                  setIsCheckoutIP(false);
                  handleCheckOut(reason);
                } else {
                  handleCheckIn(pendingLateReason, reason);
                }
              }}
              disabled={actionLoading}
            >
              {actionLoading ? (isCheckoutIP ? "Checking Out..." : "Checking In...") : (isCheckoutIP ? "Check-out" : "Check-in")}
            </button>
          </div>
        </Modal.Body>
      </Modal>
      {/* ===== IP VALIDATION END ===== */}

      {/* INFORM PERMISSION MODAL */}
      <Modal
        show={showPermissionModal}
        onHide={handleClosePermissionModal}
        centered
        backdrop="static"
        keyboard={true}
        className="emp-attendance-permission-popup"
      >
        <Modal.Header className="border-0 pb-0 position-relative d-flex justify-content-start align-items-center">
          <h2 className="emp-attendance-permission-title mb-0" style={{ marginTop: '0px' }}>Inform Permission</h2>
          <button
            className="common-modal-close-x position-absolute"
            style={{ right: '20px', top: '7px' }}
            onClick={handleClosePermissionModal}
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
                onClick={handleClosePermissionModal}
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

      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default AttendancePage;
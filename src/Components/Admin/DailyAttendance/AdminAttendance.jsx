import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Sidebar from "../../HeaderSidebar/Sidebar";
import "./AdminAttendance.css";
import "../../Common/CustomDropdown.css";
import { portalInstance } from "../../../Services/instance";
import { Icon } from "@iconify/react";
import { BarChart } from "@mui/x-charts/BarChart";
import CustomDropdown from "../../Common/CustomDropdown";
import Pagination from "../../Employee/Pagination/Pagination";
import { useUser } from "../../UserContext";
import { canHrDailyAttendance } from "../../../utils/hrAccessHelper";

const AdminAttendance = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const canDaily = canHrDailyAttendance(user);
  const [hZoom, setHZoom] = useState(1);
  const chartRef = useRef(null);

  if (user?.isHr && user?.role !== "admin" && !canDaily) {
    return (
      <div className="admin-attendance-page">
        <Sidebar />
        <div className="admin-attendance-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "48px 32px", maxWidth: "560px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "44px", marginBottom: "16px" }}>🔒</div>
            <h3 style={{ color: "#1e293b", fontSize: "20px", marginBottom: "10px", fontWeight: "700" }}>Access Restricted</h3>
            <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
              Daily attendance reporting is currently disabled for HR accounts per the Portal Access Configuration.
            </p>
            <button
              onClick={() => navigate("/")}
              style={{ background: "#3A466D", color: "#fff", border: "none", padding: "10px 24px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }


  const formatTime = (iso) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getWorkingHours = (row) => {
    if ((row.checkIn2 && !row.checkOut2) || (row.checkIn1 && !row.checkOut1 && !row.checkIn2)) {
      return "-";
    }
    let totalMs = 0;
    if (row.checkIn1 && row.checkOut1) {
      totalMs += new Date(row.checkOut1) - new Date(row.checkIn1);
    }
    if (row.checkIn2 && row.checkOut2) {
      totalMs += new Date(row.checkOut2) - new Date(row.checkIn2);
    }

    // Fallback if detailed session data is missing or it's a single continuous session
    if (totalMs === 0) {
      if (!row.login || !row.logout) return "-";
      totalMs = new Date(row.logout) - new Date(row.login);
    }

    if (isNaN(totalMs) || totalMs <= 0) return "-";
    const diffHrs = Math.floor(totalMs / (1000 * 60 * 60));
    const diffMins = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHrs}h ${diffMins}m`;
  };

  const todayISO = new Date().toISOString().split("T")[0];

  /* ────────────────────────────────
     STATE
  ──────────────────────────────── */
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [analyticsData, setAnalyticsData] = useState([]);
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [dailyLeaves, setDailyLeaves] = useState([]);

  // Pagination
  const [attendancePage, setAttendancePage] = useState(1);
  const [leavesPage, setLeavesPage] = useState(1);
  const recordsPerPage = 5;

  // Table Filters
  const [leaveTableFilter, setLeaveTableFilter] = useState("Leave");
  const [showLeaveDropdown, setShowLeaveDropdown] = useState(false);
  const leaveDropdownRef = useRef(null);

  // Permission Modal
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);

  const handleRowClick = (row) => {
    if (row.hasPermission) {
      setSelectedPermission(row);
      setShowPermissionModal(true);
    }
  };

  /* ────────────────────────────────
     API CALLS
  ──────────────────────────────── */
  const fetchMonthlyAnalytics = async () => {
    try {
      const res = await portalInstance.get(
        `/portal/admin/analytics?month=${selectedMonth}&year=${selectedYear}`
      );
      setAnalyticsData(res.data?.data || []);
    } catch (err) {
      console.error("Analytics fetch failed", err);
    }
  };

  const fetchDailyAttendance = async () => {
    try {
      const res = await portalInstance.get(`/portal/admin/daily?date=${selectedDate}`);
      setDailyAttendance(res.data?.data || []);
      setAttendancePage(1);
    } catch (err) {
      console.error("Daily attendance fetch failed", err);
    }
  };

  const fetchDailyLeaves = async () => {
    try {
      const res = await portalInstance.get(`/portal/admin/leaves?date=${selectedDate}`);
      setDailyLeaves(res.data?.data || []);
      setLeavesPage(1);
    } catch (err) {
      console.error("Daily leaves fetch failed", err);
    }
  };

  /* ────────────────────────────────
     EFFECTS
  ──────────────────────────────── */
  useEffect(() => {
    fetchMonthlyAnalytics();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchDailyAttendance();
    fetchDailyLeaves();
  }, [selectedDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (leaveDropdownRef.current && !leaveDropdownRef.current.contains(event.target)) {
        setShowLeaveDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    const stopBrowserZoom = (e) => {
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0 || Math.abs(e.deltaX) > 0) {
        e.preventDefault();
        const zoomSpeed = 0.08;
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        const direction = delta > 0 ? -1 : 1;
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const relativeX = mouseX / rect.width;

        setHZoom((prev) => {
          const nextZoom = prev + direction * zoomSpeed;
          const newZoom = Math.max(1, Math.min(nextZoom, 6));
          requestAnimationFrame(() => {
            const newWidth = el.scrollWidth;
            const scrollTarget = relativeX * newWidth - mouseX;
            el.scrollLeft = Math.max(0, scrollTarget);
          });
          return newZoom;
        });
      }
    };

    el.addEventListener("wheel", stopBrowserZoom, { passive: false });
    return () => el.removeEventListener("wheel", stopBrowserZoom);
  }, []);

  /* ────────────────────────────────
     PAGINATION CALCULATIONS
  ──────────────────────────────── */
  const totalAttendancePages = Math.ceil(dailyAttendance.length / recordsPerPage);

  const filteredLeaves = dailyLeaves.filter((item) => {
    if (leaveTableFilter === "Leave") {
      return item.type === "Leave" || item.type === "Half Day Leave";
    }
    return item.type === leaveTableFilter;
  });

  const totalLeavesPages = Math.ceil(filteredLeaves.length / recordsPerPage);

  const currentAttendance = dailyAttendance.slice(
    (attendancePage - 1) * recordsPerPage,
    attendancePage * recordsPerPage
  );

  const currentLeaves = filteredLeaves.slice(
    (leavesPage - 1) * recordsPerPage,
    leavesPage * recordsPerPage
  );

  const renderPageNumbers = (current, total, setter) => {
    const pages = [];
    for (let i = 1; i <= total; i++) {
      pages.push(
        <span
          key={i}
          className={`figma-page-item ${current === i ? "active" : ""}`}
          onClick={() => setter(i)}
        >
          {i}
        </span>
      );
    }
    return pages;
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    label: new Date(0, i).toLocaleString("en", { month: "short" }),
    value: i + 1,
  }));

  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = 2024; y <= currentYear; y++) {
    yearOptions.push({ label: String(y), value: y });
  }

  /* ────────────────────────────────
     RENDER
  ──────────────────────────────── */
  return (
    <>
      <Sidebar />

      <main className="admin-attendance-page-redesign">

        {/* Monthly Analytics */}
        <div className="figma-analytics-card">
          <div className="figma-analytics-header">
            <h5 className="figma-analytics-title">Monthly Analytics</h5>
            <div className="figma-analytics-controls">
              <div className="figma-dropdown-wrapper" style={{ width: '90px' }}>
                <CustomDropdown
                  options={monthOptions}
                  value={selectedMonth}
                  onChange={(val) => setSelectedMonth(Number(val))}
                  placeholder="Month"
                />
              </div>

              <div className="figma-dropdown-wrapper" style={{ width: '85px' }}>
                <CustomDropdown
                  options={yearOptions}
                  value={selectedYear}
                  onChange={(val) => setSelectedYear(Number(val))}
                  placeholder="Year"
                />
              </div>
            </div>
          </div>

          <div
            className="figma-chart-container"
            ref={chartRef}
            style={{
              overflowX: "scroll",
              overflowY: "hidden",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div
              className="figma-chart-inner"
              style={{
                width: `${100 * hZoom}%`,
                transition: "width 0.1s ease-out",
              }}
            >
              {(() => {
                const maxVal = Math.max(
                  ...analyticsData.map(item =>
                    Math.max(item.ontime || 0, item.permission || 0, item.leave || 0, item.absent || 0)
                  ),
                  1
                );

                const processedAnalytics = analyticsData.map((item) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  const itemDate = new Date(item.date);
                  itemDate.setHours(0, 0, 0, 0);

                  if ((item.isHoliday || item.isWeekend) && itemDate <= today) {
                    return {
                      ...item,
                      weekOff: item.isWeekend && !item.isHoliday ? maxVal : 0,
                      holiday: item.isHoliday ? maxVal : 0,
                      nonWorking: 0,
                      ontime: 0,
                      permission: 0,
                      leave: 0,
                      absent: 0,
                    };
                  }

                  return {
                    ...item,
                    weekOff: 0,
                    holiday: 0,
                    nonWorking: 0,
                  };
                });

                return (
                  <BarChart
                    height={320}
                    dataset={processedAnalytics}
                    xAxis={[
                      {
                        dataKey: "date",
                        scaleType: "band",
                        categoryGapRatio: 0.2,
                        barGapRatio: 0.05,
                        valueFormatter: (value, context) => {
                          if (context.location !== "tick") return value;
                          const d = new Date(value);
                          return `${d.getDate()}`;
                        },
                      },
                    ]}
                    yAxis={[{ disableLine: true }]}
                    series={[
                      { dataKey: "ontime", label: "Present", color: "#13E213" },
                      { dataKey: "leave", label: "Leave", color: "#d46ae7ff" },
                      { dataKey: "permission", label: "Permission", color: "#3b82f6" },
                      { dataKey: "absent", label: "Absent", color: "#ef4444" },
                      { dataKey: "weekOff", label: "Week Off", color: "#9ca3af" },
                      { dataKey: "holiday", label: "Holiday", color: "#f472b6" },
                    ]}
                    slotProps={{ legend: { hidden: true } }}
                    margin={{ left: -15, right: 10, top: 20, bottom: 25 }}
                    sx={{
                      ".MuiChartsAxis-tickLabel": {
                        fill: "#A29CC1 !important",
                        fontSize: 10,
                        transition: "all 0.2s ease",
                      },
                      ".MuiBarElement-root": {
                        transition: "all 0.2s ease",
                        rx: 0,
                      },
                      ".MuiChartsAxis-bottom .MuiChartsAxis-line": {
                        stroke: "rgba(31, 31, 31, 0.02)", // Very, very light border
                        strokeWidth: 1,
                      },
                      ".MuiChartsAxis-bottom .MuiChartsAxis-tick": {
                        stroke: "none",
                      },
                      ".MuiChartsAxis-left .MuiChartsAxis-line": { stroke: "none" },
                      ".MuiChartsAxis-left .MuiChartsAxis-tick": { stroke: "none" },
                      ".MuiChartsGrid-line": {
                        stroke: "#F0F0F0",
                        strokeDasharray: "0",
                      },
                    }}
                    grid={{ horizontal: true }}
                  />
                );
              })()}

              <div className="figma-chart-legend">
                <div className="figma-legend-item">
                  <span className="figma-legend-dot ontime"></span> Present
                </div>
                <div className="figma-legend-item">
                  <span className="figma-legend-dot permission"></span> Permission
                </div>
                <div className="figma-legend-item">
                  <span className="figma-legend-dot leave"></span> Leave
                </div>
                <div className="figma-legend-item">
                  <span className="figma-legend-dot absent"></span> Absent
                </div>
                <div className="figma-legend-item">
                  <span className="figma-legend-dot" style={{ background: "#9ca3af" }}></span> Week Off
                </div>
                <div className="figma-legend-item">
                  <span className="figma-legend-dot" style={{ background: "#f472b6" }}></span> Holiday
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TABLES ROW */}
        <div className="row figma-tables-row">

          {/* Attendance Table */}
          <div className="col-lg-7 col-md-12 figma-col">
            <div className="figma-table-card">
              <div className="figma-table-header">
                <div className="figma-present-title-group">
                  <h5 className="figma-title">Present</h5>
                  <div className="figma-present-pills-legend">
                    <span className="figma-present-pill figma-present-pill-ip">
                      <span className="figma-present-pill-dot ip-dot"></span>
                      Different IP
                    </span>
                    <span className="figma-present-pill figma-present-pill-perm">
                      <span className="figma-present-pill-dot perm-dot"></span>
                      Permission
                    </span>
                  </div>
                </div>
                <div
                  className="figma-date-picker"
                  onClick={(e) => e.currentTarget.querySelector('input').showPicker()}
                >
                  <input
                    type="date"
                    className="figma-date-input"
                    max={todayISO}
                    value={selectedDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && val > todayISO) return;
                      setSelectedDate(val);
                    }}
                    
                  />
                  <span className="figma-date-text">
                    {selectedDate ? new Date(selectedDate).toLocaleDateString("en-GB").replace(/\//g, "-") : "Select Date"}
                  </span>
                  <img src="/Calander.svg" alt="calendar" className="figma-calendar-icon" />
                </div>
              </div>

              <div className="figma-table-wrapper">
                <div className="figma-responsive-table">
                  <table className="figma-table">
                    <thead>
                      <tr>
                        <th className="figma-th-sno" style={{ textAlign: "center" }}>S.No</th>
                        <th className="figma-th-name" style={{ textAlign: "left" }}>Employee Name</th>
                        <th className="figma-th-login" style={{ textAlign: "center" }}>Check-in</th>
                        <th className="figma-th-logout" style={{ textAlign: "center" }}>Check-out</th>
                        <th className="figma-th-logout" style={{ textAlign: "center" }}>Working Hours</th>
                        <th className="figma-th-remarks" style={{ textAlign: "center" }}>Remarks</th>
                        <th className="figma-th-perm" style={{ textAlign: "center" }}>Permission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="figma-no-records">
                            No records found for this date
                          </td>
                        </tr>
                      ) : (
                        currentAttendance.map((row, i) => {
                          const hasCheckInIPReason = !!(row.checkInIPReason || row.checkInIPAddress);
                          const hasCheckOutIPReason = !!(row.checkOutIPReason || row.checkOutIPAddress);
                          const hasIPReason = hasCheckInIPReason || hasCheckOutIPReason;
                          const snoStr = String((attendancePage - 1) * recordsPerPage + i + 1).padStart(2, "0");

                          return (
                            <tr
                              key={i}
                              className={`figma-attendance-row ${hasIPReason ? "has-ip-reason" : ""}`}
                              style={{
                                background: row.suspicious ? "#fff7ed" : "inherit",
                                cursor: row.hasPermission ? "pointer" : "default",
                                position: "relative"
                              }}
                              onClick={() => handleRowClick(row)}
                              title={
                                hasCheckInIPReason
                                  ? `Check-in IP: ${row.checkInIPAddress || "-"} | Reason: ${row.checkInIPReason || "-"}`
                                  : hasCheckOutIPReason
                                  ? `Check-out IP: ${row.checkOutIPAddress || "-"} | Reason: ${row.checkOutIPReason || "-"}`
                                  : undefined
                              }
                            >
                              <td className="figma-td-sno" style={{ textAlign: "center" }}>
                                {hasIPReason && row.hasPermission ? (
                                  <span className="admin-ip-permission-split-sno-badge">
                                    {snoStr}
                                  </span>
                                ) : hasIPReason ? (
                                  <span className="admin-ip-sno-circle-badge">
                                    {snoStr}
                                  </span>
                                ) : row.hasPermission ? (
                                  <span className="figma-sno-permission-badge">
                                    {snoStr}
                                  </span>
                                ) : (
                                  snoStr
                                )}
                              </td>
                              <td className="figma-td-name" style={{ textAlign: "left", position: "relative" }}>
                                <div className="figma-emp-info">
                                  <div className="figma-emp-name">
                                    {row.employeeName}
                                  </div>
                                  <div className="figma-emp-role">
                                    {row.designation ? row.designation : "-"}
                                  </div>
                                </div>

                                {hasIPReason && (
                                  <div className={`admin-ip-row-hover-tooltip ${i > 0 && i >= currentAttendance.length - 2 ? "admin-ip-row-hover-tooltip--top" : ""}`}>
                                    {hasCheckInIPReason && hasCheckOutIPReason ? (
                                      <>
                                        <div className="admin-ip-tooltip-header">Different IP Check-in / Check-out</div>
                                        <div><strong>Check-in IP:</strong> {row.checkInIPAddress || "Different Network"}</div>
                                        <div><strong>Check-in Reason:</strong> {row.checkInIPReason || "-"}</div>
                                        <hr style={{ margin: "6px 0", borderColor: "rgba(255,255,255,0.2)" }} />
                                        <div><strong>Check-out IP:</strong> {row.checkOutIPAddress || "Different Network"}</div>
                                        <div><strong>Check-out Reason:</strong> {row.checkOutIPReason || "-"}</div>
                                      </>
                                    ) : hasCheckInIPReason ? (
                                      <>
                                        <div className="admin-ip-tooltip-header">Different IP Check-in</div>
                                        <div><strong>IP Address:</strong> {row.checkInIPAddress || "Different Network"}</div>
                                        <div><strong>Reason:</strong> {row.checkInIPReason || "-"}</div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="admin-ip-tooltip-header">Different IP Check-out</div>
                                        <div><strong>IP Address:</strong> {row.checkOutIPAddress || "Different Network"}</div>
                                        <div><strong>Reason:</strong> {row.checkOutIPReason || "-"}</div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="figma-td-time" style={{ textAlign: "center" }}>{formatTime(row.login)}</td>
                              <td className="figma-td-time" style={{ textAlign: "center" }}>{formatTime(row.logout)}</td>
                              <td className="figma-td-time" style={{ textAlign: "center" }}>
                                {getWorkingHours(row)}
                              </td>
                              <td className="figma-td-remarks" style={{ textAlign: "center" }}>
                                {row.remarks === "Auto checkout on next login" || row.remarks === "Auto checkout"
                                  ? "Auto Check out"
                                  : (row.remarks || "-")}
                              </td>
                              <td
                                className="figma-td-perm"
                                style={{
                                  textAlign: "center",
                                  color: row.hasPermission ? "#3b82f6" : "inherit",
                                  fontWeight: row.hasPermission ? "bold" : "normal"
                                }}
                              >
                                {row.hasPermission ? `${row.permissionMinutes} min` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {totalAttendancePages > 1 && (
                  <div className="figma-pagination">
                    <Icon
                      icon="heroicons:chevron-left-20-solid"
                      className="figma-page-arrow"
                      onClick={() => setAttendancePage((p) => Math.max(1, p - 1))}
                      style={{ opacity: attendancePage === 1 ? 0.4 : 1 }}
                    />
                    {renderPageNumbers(attendancePage, totalAttendancePages, setAttendancePage)}
                    <Icon
                      icon="heroicons:chevron-right-20-solid"
                      className="figma-page-arrow"
                      onClick={() => setAttendancePage((p) => Math.min(totalAttendancePages, p + 1))}
                      style={{ opacity: attendancePage === totalAttendancePages ? 0.4 : 1 }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Leaves Table */}
          <div className="col-lg-5 col-md-12 figma-col">
            <div className="figma-table-card">
              <div className="figma-table-header">
                <div className="figma-title-dropdown-container" ref={leaveDropdownRef}>
                  <h5
                    className="figma-title figma-title-interactive"
                    onClick={() => setShowLeaveDropdown(!showLeaveDropdown)}
                  >
                    {leaveTableFilter === "Leave" ? "Leaves" : "Absent"}
                    <img
                      src="/Down Arrow.svg"
                      alt="arrow"
                      className={`figma-title-arrow ${showLeaveDropdown ? "open" : ""}`}
                    />
                  </h5>
                  {showLeaveDropdown && (
                    <div className="figma-custom-dropdown-menu">
                      <div
                        className={`figma-dropdown-item ${leaveTableFilter === "Absent" ? "active" : ""}`}
                        onClick={() => {
                          setLeaveTableFilter("Absent");
                          setShowLeaveDropdown(false);
                          setLeavesPage(1);
                        }}
                      >
                        Absent
                      </div>
                      <div
                        className={`figma-dropdown-item ${leaveTableFilter === "Leave" ? "active" : ""}`}
                        onClick={() => {
                          setLeaveTableFilter("Leave");
                          setShowLeaveDropdown(false);
                          setLeavesPage(1);
                        }}
                      >
                        Leaves
                      </div>
                    </div>
                  )}
                </div>
                <div
                  className="figma-date-picker"
                  onClick={(e) => e.currentTarget.querySelector('input').showPicker()}
                >
                  <input
                    type="date"
                    className="figma-date-input"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                  <span className="figma-date-text">
                    {selectedDate ? new Date(selectedDate).toLocaleDateString("en-GB").replace(/\//g, "-") : "Select Date"}
                  </span>
                  <img src="/Calander.svg" alt="calendar" className="figma-calendar-icon" />
                </div>
              </div>

              <div className="figma-table-wrapper">
                <div className="figma-responsive-table">
                  <table className="figma-table">
                    <thead>
                      <tr>
                        <th className="figma-th-sno">S.No</th>
                        <th className="figma-th-name" style={{ textAlign: "left" }}>Employee Name</th>
                        <th className="figma-th-status">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentLeaves.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="figma-no-records">
                            No leaves on this date
                          </td>
                        </tr>
                      ) : (
                        currentLeaves.map((row, i) => (
                          <tr key={i}>
                            <td className="figma-td-sno">
                              {String((leavesPage - 1) * recordsPerPage + i + 1).padStart(2, "0")}
                            </td>
                            <td className="figma-td-name">
                              <div className="figma-emp-info">
                                <div className="figma-emp-name">{row.employeeName}</div>
                                <div className="figma-emp-role">{row.designation}</div>
                              </div>
                            </td>
                            <td className="figma-td-status">
                              <span
                                className={`figma-leave-badge ${(row.type === "Leave" || row.type === "Half Day Leave") ? "approved" :
                                  row.type === "Absent" ? "absent" : ""
                                  }`}
                              >
                                {row.type}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalLeavesPages > 1 && (
                  <div className="figma-pagination">
                    <Pagination
                      totalItems={filteredLeaves.length}
                      pageSize={recordsPerPage}
                      currentPage={leavesPage}
                      onPageChange={setLeavesPage}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </main>

      {showPermissionModal && selectedPermission && (
        <div className="admin-leave-overlay" onClick={() => setShowPermissionModal(false)}>
          <div className="admin-leave-container popup-blink" onClick={(e) => e.stopPropagation()}>
            <div className="admin-leave-header">
              <h4 className="assign-task__members-title admin-leave-title">
                Permission Details
              </h4>
              <button className="common-modal-close-x" onClick={() => setShowPermissionModal(false)} aria-label="Close">✕</button>
            </div>

            <div className="admin-leave-body common-modal-body">
              <div className="admin-leave-card">
                <div className="admin-leave-profile-row">
                  <div className="admin-leave-profile">
                    <img
                      src={selectedPermission.avatar || "/avatar.png"}
                      alt="Profile"
                      className="admin-leave-avatar"
                      onError={(e) => (e.target.src = "/avatar.png")}
                    />
                    <div className="admin-leave-profile-text">
                      <div className="admin-leave-emp-name">
                        {selectedPermission.employeeName}
                      </div>
                      <div className="admin-leave-emp-role">
                        {selectedPermission.designation}
                      </div>
                    </div>
                  </div>
                  <div className="leave-status approved">
                    {selectedPermission.permissionDetails.status}
                  </div>
                </div>

                <div className="admin-leave-info-grid">
                  <div className="admin-leave-info-row">
                    <div className="admin-leave-label">Permission Type</div>
                    <div className="admin-leave-value">
                      {selectedPermission.permissionDetails.permissionType === "AFTERNOON" ? "Out & Return" : (selectedPermission.permissionDetails.permissionType || (selectedPermission.permissionDetails.status === "INFORMED" ? "Informed" : "-"))}
                    </div>
                  </div>

                  <div className="admin-leave-info-row">
                    <div className="admin-leave-label">Time Duration</div>
                    <div className="admin-leave-value">
                      {formatTime(selectedPermission.permissionDetails.from)} - {formatTime(selectedPermission.permissionDetails.to)} ({selectedPermission.permissionMinutes} mins)
                    </div>
                  </div>

                  {selectedPermission.permissionDetails.permissionType === "MORNING" && (
                    <div className="admin-leave-info-row">
                      <div className="admin-leave-label">Check-in Time</div>
                      <div className="admin-leave-value">
                        {formatTime(selectedPermission.checkIn1 || selectedPermission.checkInTime || selectedPermission.login)}
                      </div>
                    </div>
                  )}

                  {(selectedPermission.permissionDetails.permissionType === "AFTERNOON" || selectedPermission.permissionDetails.permissionType === "Out & Return" || selectedPermission.permissionDetails.status === "INFORMED" || (!["MORNING", "EVENING"].includes(selectedPermission.permissionDetails.permissionType))) && (
                    <>
                      <div className="admin-leave-info-row">
                        <div className="admin-leave-label">Check-out Time</div>
                        <div className="admin-leave-value">
                          {formatTime(selectedPermission.checkOut1 || selectedPermission.checkOutTime || selectedPermission.logout)}
                        </div>
                      </div>
                      <div className="admin-leave-info-row">
                        <div className="admin-leave-label">Check-in Time</div>
                        <div className="admin-leave-value">
                          {formatTime(selectedPermission.checkIn2)}
                        </div>
                      </div>
                    </>
                  )}

                  {selectedPermission.permissionDetails.permissionType === "EVENING" && (
                    <div className="admin-leave-info-row">
                      <div className="admin-leave-label">Check-out Time</div>
                      <div className="admin-leave-value">
                        {formatTime(selectedPermission.checkOut2 || selectedPermission.checkOut1 || selectedPermission.checkOutTime || selectedPermission.logout)}
                      </div>
                    </div>
                  )}

                  {/* Actual Time Used and Extra/Excess Time Used */}
                  {(() => {
                    const checkoutDateVal = selectedPermission.checkOut1 || selectedPermission.checkOutTime || selectedPermission.logout;
                    const checkinDateVal = selectedPermission.checkIn2;

                    let actualDurationMinutes = selectedPermission.actualDurationMinutes || selectedPermission.permissionDetails?.actualDurationMinutes || 0;
                    if (!actualDurationMinutes && checkoutDateVal && checkinDateVal) {
                      actualDurationMinutes = Math.max(0, Math.round((new Date(checkinDateVal) - new Date(checkoutDateVal)) / 60000));
                    }

                    let excessDurationMinutes = selectedPermission.excessDurationMinutes || selectedPermission.permissionDetails?.excessDurationMinutes || 0;
                    if (!excessDurationMinutes && actualDurationMinutes > 0) {
                      const reqMins = selectedPermission.permissionMinutes || 120;
                      if (actualDurationMinutes > reqMins) {
                        excessDurationMinutes = actualDurationMinutes - reqMins;
                      }
                    }

                    return (
                      <>
                        {actualDurationMinutes > 0 && (
                          <div className="admin-leave-info-row">
                            <div className="admin-leave-label">Actual Time Used</div>
                            <div
                              className="admin-leave-value"
                              style={{
                                fontWeight: 600,
                                color: actualDurationMinutes > 120 ? "#dc2626" : (excessDurationMinutes > 0 ? "#d97706" : "#059669")
                              }}
                            >
                              {actualDurationMinutes} mins {actualDurationMinutes >= 60 ? `(${Math.floor(actualDurationMinutes / 60)}h ${actualDurationMinutes % 60}m)` : ""}
                            </div>
                          </div>
                        )}

                        {excessDurationMinutes > 0 && (
                          <div className="admin-leave-info-row">
                            <div className="admin-leave-label">Extra Time Used</div>
                            <div
                              className="admin-leave-value"
                              style={{ fontWeight: 600, color: "#dc2626" }}
                            >
                              +{excessDurationMinutes} mins ({excessDurationMinutes >= 60 ? `${Math.floor(excessDurationMinutes / 60)}h ${excessDurationMinutes % 60}m` : `${excessDurationMinutes}m`} excess)
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <div className="admin-leave-info-row">
                    <div className="admin-leave-label">Detailed Reason</div>
                    <div className="admin-leave-reason-text">
                      {selectedPermission.permissionDetails.reason}
                    </div>
                  </div>
                </div>

                <div className="admin-leave-footer">
                  <div className="admin-leave-footer-buttons">
                    <button
                      className="admin-leave-btn admin-btn-cancel"
                      onClick={() => setShowPermissionModal(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminAttendance;
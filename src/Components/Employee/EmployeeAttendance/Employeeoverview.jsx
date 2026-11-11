import React, { useEffect, useState, useMemo } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../Admin/AttendanceReport/AttendanceOverview.css";
import "../../Common/CustomDropdown.css";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { Icon } from "@iconify/react";
import { portalInstance } from "../../../Services/instance";
import CustomDropdown from "../../Common/CustomDropdown";
import Pagination from "../Pagination/Pagination";

/* =============================
   STATIC FALLBACK DATA
============================= */
const fallbackEmployee = {
    name: "Employee",
    designation: "Employee",
    avatar: "/avatar.png",
};

const fallbackStats = {
    workingDays: 0,
    daysPresent: 0,
    leavesTaken: 0,
    absentDays: 0,
    totalLeave: 0,
    permissions: 0,
    attendancePercentage: "0%",
    policyTotal: 0,
    policyUsed: 0,
    policyRemaining: 0,
};

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
    "April", "May", "June", "July",
    "August", "September", "October", "November",
    "December", "January", "February", "March"
];

const CALENDAR_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

/* =============================
   MINI CALENDAR (Memoized)
============================= */
const MiniCalendar = React.memo(function MiniCalendar({ month, calendarData = [], year, filter = null }) {
    const realMonthIndexMap = {
        January: 0,
        February: 1,
        March: 2,
        April: 3,
        May: 4,
        June: 5,
        July: 6,
        August: 7,
        September: 8,
        October: 9,
        November: 10,
        December: 11,
    };

    const monthIndex = realMonthIndexMap[month];
    const actualYear = year;

    const cells = useMemo(() => {
        const daysInMonth = new Date(actualYear, monthIndex + 1, 0).getDate();
        const firstDayWeekday = new Date(actualYear, monthIndex, 1).getDay();
        const calendarMap = new Map((calendarData || []).map(d => [d.day, d]));
        const result = [];

        // ─── PREVIOUS MONTH PADDING ───
        for (let i = 0; i < firstDayWeekday; i++) {
            result.push({ type: "empty" });
        }

        // ─── CURRENT MONTH DAYS ───
        for (let day = 1; day <= daysInMonth; day++) {
            const record = calendarMap.get(day);

            const dateObj = new Date(actualYear, monthIndex, day);
            const weekday = dateObj.getDay();

            const isSunday = weekday === 0;
            const isSecondSaturday = weekday === 6 && Math.ceil(day / 7) === 2;
            const isFourthSaturday = weekday === 6 && Math.ceil(day / 7) === 4;

            let status = record?.status || null;

            if (!status) {
                if (isSunday || isSecondSaturday || isFourthSaturday) {
                    status = "weekend";
                }
            }

            result.push({
                type: "day",
                day,
                status,
                isToday: record?.isToday || false,
            });
        }

        // ─── NEXT MONTH PADDING — FORCE 42 CELLS ───
        let nextMonthDay = 1;
        while (result.length < 42) {
            result.push({
                type: "next",
                day: nextMonthDay++,
                status: "inactive",
            });
        }

        return result;
    }, [actualYear, monthIndex, calendarData]);

    return (
        <div className="attendanceoverview-month-card">
            <div className="attendanceoverview-month-header">
                <h3>{month} <strong>{actualYear}</strong></h3>
                <div className="header-underline"></div>
            </div>

            <div className="attendanceoverview-weekdays">
                {WEEKDAYS.map(d => (
                    <span key={d}>{d}</span>
                ))}
            </div>

            <div className="attendanceoverview-days">
                {cells.map((cell, i) => {
                    if (cell.type === "empty" || cell.type === "next") {
                        return (
                            <div
                                key={i}
                                className="attendanceoverview-day inactive"
                            >
                                {cell.day || ""}
                            </div>
                        );
                    }

                    const normalizedStatus = cell.status ? String(cell.status).toLowerCase().trim() : "";

                    if (!filter) {
                        let cls = "attendanceoverview-day";
                        if (normalizedStatus === "weekend") cls += " weekend";

                        return (
                            <div key={i} className={cls}>
                                <span className={`day-number ${cell.isToday ? "today-highlight" : ""} ${normalizedStatus === "holiday" ? "holiday-highlight" : ""}`}>
                                    {cell.day}
                                </span>
                            </div>
                        );
                    }

                    let isMatch = false;
                    let highlightClass = "";

                    if (filter === "present") {
                        if (
                            normalizedStatus === "present" ||
                            normalizedStatus === "wfh" ||
                            normalizedStatus.includes("present") ||
                            normalizedStatus.includes("wfh") ||
                            normalizedStatus.includes("late entry")
                        ) {
                            isMatch = true;
                            highlightClass = "filter-highlight-present";
                        }
                    } else if (filter === "absent") {
                        if (
                            normalizedStatus === "absent" ||
                            normalizedStatus === "not checked-in"
                        ) {
                            isMatch = true;
                            highlightClass = "filter-highlight-absent";
                        }
                    } else if (filter === "leave") {
                        if (
                            !normalizedStatus.includes("half") &&
                            (normalizedStatus === "leave" ||
                             normalizedStatus === "approved" ||
                             normalizedStatus.includes("leave"))
                        ) {
                            isMatch = true;
                            highlightClass = "filter-highlight-leave";
                        }
                    } else if (filter === "half-day") {
                        if (normalizedStatus.includes("half")) {
                            isMatch = true;
                            highlightClass = "filter-highlight-half-day";
                        }
                    }

                    return (
                        <div key={i} className="attendanceoverview-day">
                            <span className={`day-number ${isMatch ? highlightClass : ""}`}>
                                {cell.day}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

/* =============================
   MAIN COMPONENT
============================= */
function EmployeeOverview() {
    const getCurrentFinancialYear = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        return m >= 3 ? y : y - 1;
    };

    const formatFinancialYear = (y) => {
        if (typeof y !== "number") return y;
        return `${y}`;
    };

    const generateFinancialYears = () => {
        const startYear = 2024;
        const currentFY = getCurrentFinancialYear();
        const years = [];
        for (let y = startYear; y <= currentFY; y++) {
            years.push(y);
        }
        return years;
    };

    const [year, setYear] = useState(getCurrentFinancialYear());
    const [employee, setEmployee] = useState(fallbackEmployee);
    const [stats, setStats] = useState(fallbackStats);
    const [monthlyData, setMonthlyData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);
    const [attendanceFilter, setAttendanceFilter] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    const handleFilterToggle = (status) => {
        setAttendanceFilter((prev) => (prev === status ? null : status));
        setCurrentPage(1);
    };

    const pageSizeOptions = [
        { label: "5", value: 5 },
        { label: "10", value: 10 },
        { label: "20", value: 20 },
        { label: "30", value: 30 },
    ];

    const formatRecordDate = (dateStr) => {
        if (!dateStr) return { formatted: "-", weekday: "" };
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return { formatted: dateStr, weekday: "" };
            const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
            const day = d.getDate();
            const month = d.toLocaleDateString("en-US", { month: "short" });
            const yearVal = d.getFullYear();
            return {
                formatted: `${day < 10 ? "0" + day : day} ${month} ${yearVal}`,
                weekday,
            };
        } catch {
            return { formatted: dateStr, weekday: "" };
        }
    };

    const filterDetails = useMemo(() => {
        if (attendanceFilter !== "leave" && attendanceFilter !== "absent") {
            return null;
        }

        const records = [];
        const seenDates = new Set();

        monthlyData.forEach((monthDays) => {
            if (!Array.isArray(monthDays)) return;
            monthDays.forEach((cell) => {
                if (!cell || !cell.date || !cell.status) return;
                const norm = String(cell.status).toLowerCase().trim();

                if (attendanceFilter === "leave") {
                    const isLeaveMatch = !norm.includes("half") && (norm === "leave" || norm === "approved" || norm.includes("leave"));
                    if (isLeaveMatch && !seenDates.has(cell.date)) {
                        seenDates.add(cell.date);
                        records.push({
                            date: cell.date,
                            day: cell.day,
                            type: cell.leaveType || "Leave Approved",
                            reason: cell.reason || "Approved Leave",
                            dayType: cell.dayType || "1 Day",
                            status: "Approved",
                        });
                    }
                } else if (attendanceFilter === "absent") {
                    const isAbsentMatch = norm === "absent" || norm === "not checked-in";
                    if (isAbsentMatch && !seenDates.has(cell.date)) {
                        seenDates.add(cell.date);
                        records.push({
                            date: cell.date,
                            day: cell.day,
                            type: cell.leaveType || "Absent",
                            reason: cell.reason || "No Intimation",
                            dayType: cell.dayType || "Full Day",
                            status: "Absent",
                        });
                    }
                }
            });
        });

        records.sort((a, b) => new Date(a.date) - new Date(b.date));

        return {
            filterType: attendanceFilter,
            records,
        };
    }, [monthlyData, attendanceFilter]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const [fromMonth, setFromMonth] = useState("April");
    const [toMonth, setToMonth] = useState("March");
    const [fromYear, setFromYear] = useState(getCurrentFinancialYear());
    const [toYear, setToYear] = useState(getCurrentFinancialYear() + 1);

    const [fromMonthDropdownOpen, setFromMonthDropdownOpen] = useState(false);
    const [toMonthDropdownOpen, setToMonthDropdownOpen] = useState(false);
    const [fromYearDropdownOpen, setFromYearDropdownOpen] = useState(false);
    const [toYearDropdownOpen, setToYearDropdownOpen] = useState(false);
    const [pageSizeDropdownOpen, setPageSizeDropdownOpen] = useState(false);

    // ✅ VALIDATION: Disable "To" months before "From" month strictly based on CALENDAR_MONTHS array
    const getDisabledToMonths = () => {
        if (toYear > fromYear) return [];
        if (toYear < fromYear) return CALENDAR_MONTHS;
        const fromIdx = CALENDAR_MONTHS.indexOf(fromMonth);
        return CALENDAR_MONTHS.filter((_, idx) => idx < fromIdx);
    };

    // ✅ Effect to reset invalid toMonth
    useEffect(() => {
        if (toYear < fromYear) {
            setToMonth(fromMonth);
        } else if (toYear === fromYear) {
            const fromIdx = CALENDAR_MONTHS.indexOf(fromMonth);
            const toIdx = CALENDAR_MONTHS.indexOf(toMonth);
            if (toIdx < fromIdx) {
                setToMonth(fromMonth);
            }
        }
    }, [fromMonth, toMonth, fromYear, toYear]);

    // ✅ Close all dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest(".custom-dropdown-container")) {
                setFromMonthDropdownOpen(false);
                setToMonthDropdownOpen(false);
                setFromYearDropdownOpen(false);
                setToYearDropdownOpen(false);
                setPageSizeDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const ReusableDropdown = ({
        value,
        options,
        isOpen,
        setIsOpen,
        onChange,
        showCustomOption = false,
        onCustomClick = () => { },
        disabledOptions = [],
    }) => {
        return (
            <div className="custom-dropdown-container">
                <div
                    className={`custom-dropdown-trigger ${isOpen ? "open" : ""}`}
                    onClick={() => {
                        // Close others before toggling this one
                        if (!isOpen) {
                            setFromMonthDropdownOpen(false);
                            setToMonthDropdownOpen(false);
                            setFromYearDropdownOpen(false);
                            setToYearDropdownOpen(false);
                            setPageSizeDropdownOpen(false);
                        }
                        setIsOpen(!isOpen);
                    }}
                >
                    <span>
                        {value
                            ? (typeof value === "number" ? formatFinancialYear(value) : value)
                            : "Select"}
                    </span>
                    <Icon
                        icon="iconamoon:arrow-down-2-fill"
                        className={`dropdown-arrow-icon ${isOpen ? "rotate" : ""}`}
                    />
                </div>

                {isOpen && (
                    <div className="custom-dropdown-menu">
                        {options.map((opt) => {
                            const label = typeof opt === "object" ? opt.label : opt;
                            const val = typeof opt === "object" ? opt.value : opt;
                            const isDisabled = disabledOptions.includes(val);
                            return (
                                <div
                                    key={val}
                                    className={`custom-dropdown-option ${value === val ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isDisabled) return;
                                        onChange(val);
                                        setIsOpen(false);
                                    }}
                                >
                                    {label}
                                </div>
                            );
                        })}

                        {showCustomOption && (
                            <div
                                className="custom-dropdown-option custom-btn-option"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCustomClick();
                                    setIsOpen(false);
                                }}
                            >
                                Custom
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    useEffect(() => {
        const fetchAttendance = async () => {
            setLoading(true);
            try {
                const monthIndexMap = {
                    January: 0,
                    February: 1,
                    March: 2,
                    April: 3,
                    May: 4,
                    June: 5,
                    July: 6,
                    August: 7,
                    September: 8,
                    October: 9,
                    November: 10,
                    December: 11,
                };

                if (!fromMonth || !toMonth) {
                    setLoading(false);
                    return;
                }

                const res = await portalInstance.get("/portal/employee/attendance-overview", {
                    params: {
                        year: fromYear,
                        fromMonth: monthIndexMap[fromMonth],
                        toMonth: monthIndexMap[toMonth],
                    }
                });

                const data = res.data?.data || {};

                if (data.employee) setEmployee(data.employee);
                if (data.summary) {
                    setStats({
                        workingDays: data.summary.workingDays || 0,
                        daysPresent: data.summary.daysPresent || 0,
                        leavesTaken: data.summary.leavesTaken ?? data.summary.leaves ?? 0,
                        absentDays: data.summary.absentDays || 0,
                        totalLeave: data.summary.totalLeave || 0,
                        permissions: data.summary.permissions || 0,
                        attendancePercentage: data.summary.attendancePercentage || "0%",

                        policyTotal: data.summary.policyTotal || 0,
                        policyUsed: data.summary.policyUsed || 0,
                        policyRemaining: data.summary.policyRemaining || 0,
                    });
                }
                if (data.calendar && typeof data.calendar === "object") {
                    // Build month indices from fromMonth → toMonth (handles wrap-around)
                    const fm = monthIndexMap[fromMonth];
                    const tm = monthIndexMap[toMonth];

                    const orderedMonthIndices = [];
                    let cur = fm;
                    while (true) {
                        orderedMonthIndices.push(cur);
                        if (cur === tm) break;
                        cur = (cur + 1) % 12;
                        if (orderedMonthIndices.length > 12) break;
                    }

                    const orderedMonths = orderedMonthIndices.map(
                        (monthIndex) => data.calendar[monthIndex] || []
                    );

                    setMonthlyData(orderedMonths);
                }

            } catch (err) {
                console.error("Failed to load attendance:", err);
                // keep fallback data
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();
    }, [fromYear, fromMonth, toMonth]);

    return (
        <>
            <Sidebar />

            <div className="attendanceoverview">

                {/* ===== SUMMARY CARD ===== */}
                <div className="attendanceoverview-summary">

                    <div className="attendanceoverview-header">
                        <div className="attendanceoverview-profile">
                            <div className="attendanceoverview-avatar">
                                <img
                                    src={employee.avatar || "/avatar.png"}
                                    alt={employee.name}
                                    onError={(e) => {
                                        e.target.src = "/avatar.png";
                                    }}
                                />
                            </div>

                            <div className="attendanceoverview-info">
                                <h2>{employee.name}</h2>
                                <p>{employee.designation}</p>
                            </div>
                        </div>

                        {/* ✅ NEW 4-SELECTOR FILTER UI */}
                        <div className="attendanceoverview-filters">

                            {/* FROM SECTION */}
                            <div className="range-group">
                                <span className="range-label">From</span>
                                <ReusableDropdown
                                    value={fromMonth}
                                    options={CALENDAR_MONTHS}
                                    isOpen={fromMonthDropdownOpen}
                                    setIsOpen={setFromMonthDropdownOpen}
                                    onChange={setFromMonth}
                                />
                                <ReusableDropdown
                                    value={fromYear}
                                    options={generateFinancialYears()}
                                    isOpen={fromYearDropdownOpen}
                                    setIsOpen={setFromYearDropdownOpen}
                                    onChange={(v) => {
                                        setFromYear(Number(v));
                                        setToYear(Number(v) + 1);
                                    }}
                                />
                            </div>

                            {/* TO SECTION */}
                            <div className="range-group">
                                <span className="range-label">To</span>
                                <ReusableDropdown
                                    value={toMonth}
                                    options={CALENDAR_MONTHS}
                                    isOpen={toMonthDropdownOpen}
                                    setIsOpen={setToMonthDropdownOpen}
                                    onChange={setToMonth}
                                    disabledOptions={getDisabledToMonths()}
                                />
                                <ReusableDropdown
                                    value={toYear}
                                    options={generateFinancialYears()}
                                    isOpen={toYearDropdownOpen}
                                    setIsOpen={setToYearDropdownOpen}
                                    onChange={(v) => setToYear(Number(v))}
                                />
                            </div>

                        </div>
                    </div>

                    {loading ? (
                        <div className="attendanceoverview-stats">
                            <p>Loading attendance data...</p>
                        </div>
                    ) : isMobile ? (
                        <div className="attendanceoverview-stats">
                            <div className="attendanceoverview-stat-item">
                                <p className="stat-label">Working Days</p>
                                <p className="stat-value">{stats.workingDays ?? "-"}</p>
                            </div>

                            <div className="attendanceoverview-stat-item">
                                <p className="stat-label">Days Present</p>
                                <p className="stat-value">{stats.daysPresent ?? "-"}</p>
                            </div>

                            <div className="attendanceoverview-stat-item">
                                <p className="stat-label">Leave</p>
                                <p className="stat-value">{stats.leavesTaken ?? "-"}</p>
                            </div>

                            <div className="attendanceoverview-stat-item">
                                <p className="stat-label">Absent</p>
                                <p className="stat-value">{stats.absentDays ?? 0}</p>
                            </div>

                            <div className="attendanceoverview-stat-item">
                                <p className="stat-label">Total Leave</p>
                                <p className="stat-value">{stats.totalLeave ?? 0}</p>
                            </div>

                            <div className="attendanceoverview-stat-item">
                                <p className="stat-label">Permissions</p>
                                <p className="stat-value">{stats.permissions ?? "-"}</p>
                            </div>

                            <div className="attendanceoverview-stat-item">
                                <p className="stat-label">Attendance %</p>
                                <p className="stat-value">{stats.attendancePercentage ?? "-"}</p>
                            </div>

                            <div className="attendanceoverview-stat-item">
                                <p className="stat-label">Available Leave</p>
                                <p className="stat-value">{stats.policyTotal ?? 0}</p>
                            </div>

                            <div className="attendanceoverview-stat-item">
                                <p className="stat-label">Leave Taken</p>
                                <p className="stat-value">{stats.policyUsed ?? 0}</p>
                            </div>

                            <div className="attendanceoverview-stat-item">
                                <p className="stat-label">Remaining Leaves</p>
                                <p className="stat-value">{stats.policyRemaining ?? 0}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ===== FIRST ROW ===== */}
                            <div className="attendanceoverview-stats">
                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Working Days</p>
                                    <p className="stat-value">{stats.workingDays ?? "-"}</p>
                                </div>

                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Days Present</p>
                                    <p className="stat-value">{stats.daysPresent ?? "-"}</p>
                                </div>

                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Leave</p>
                                    <p className="stat-value">{stats.leavesTaken ?? "-"}</p>
                                </div>

                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Absent</p>
                                    <p className="stat-value">{stats.absentDays ?? 0}</p>
                                </div>

                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Total Leave</p>
                                    <p className="stat-value">{stats.totalLeave ?? 0}</p>
                                </div>

                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Permissions</p>
                                    <p className="stat-value">{stats.permissions ?? "-"}</p>
                                </div>

                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Attendance %</p>
                                    <p className="stat-value">{stats.attendancePercentage ?? "-"}</p>
                                </div>
                            </div>

                            {/* ===== SECOND ROW : LEAVE POLICY ===== */}
                            <div
                                className="attendanceoverview-stats policy-row"
                                style={{
                                    marginTop: "24px",
                                    borderTop: "1px solid rgba(255,255,255,0.1)",
                                    paddingTop: "20px",
                                }}
                            >
                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Available Leave</p>
                                    <p className="stat-value">{stats.policyTotal ?? 0}</p>
                                </div>

                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Leave Taken</p>
                                    <p className="stat-value">{stats.policyUsed ?? 0}</p>
                                </div>

                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Remaining Leaves</p>
                                    <p className="stat-value">{stats.policyRemaining ?? 0}</p>
                                </div>

                                {/* Empty columns for alignment */}
                                <div className="attendanceoverview-stat-item"></div>
                                <div className="attendanceoverview-stat-item"></div>
                                <div className="attendanceoverview-stat-item"></div>
                                <div className="attendanceoverview-stat-item"></div>
                            </div>
                        </>
                    )}

                </div>

                {/* ===== CALENDAR CARD WRAPPER ===== */}
                <div className="attendanceoverview-calendar-card">
                    {/* ── Attendance Legend ── */}
                    <div className="emp-attendance-overview-legend">
                        <div
                            className="emp-attendance-legend-item clickable"
                            onClick={() => handleFilterToggle("present")}
                        >
                            <input
                                type="radio"
                                className="emp-attendance-legend-radio radio-present"
                                checked={attendanceFilter === "present"}
                                readOnly
                            />
                            <span className="emp-attendance-legend-pill emp-attendance-present"></span>
                            <span className="emp-attendance-legend-label">Present</span>
                        </div>
                        <div
                            className="emp-attendance-legend-item clickable"
                            onClick={() => handleFilterToggle("absent")}
                        >
                            <input
                                type="radio"
                                className="emp-attendance-legend-radio radio-absent"
                                checked={attendanceFilter === "absent"}
                                readOnly
                            />
                            <span className="emp-attendance-legend-pill emp-attendance-absent"></span>
                            <div className="emp-attendance-legend-text-group">
                                <span className="emp-attendance-legend-label">Absent</span>
                                <small className="emp-attendance-legend-subtext">( No Intimation)</small>
                            </div>
                        </div>
                        <div
                            className="emp-attendance-legend-item clickable"
                            onClick={() => handleFilterToggle("leave")}
                        >
                            <input
                                type="radio"
                                className="emp-attendance-legend-radio radio-leave"
                                checked={attendanceFilter === "leave"}
                                readOnly
                            />
                            <span className="emp-attendance-legend-pill emp-attendance-approved"></span>
                            <div className="emp-attendance-legend-text-group">
                                <span className="emp-attendance-legend-label">Leave</span>
                                <small className="emp-attendance-legend-subtext">( Leave Approved )</small>
                            </div>
                        </div>
                        <div
                            className="emp-attendance-legend-item clickable"
                            onClick={() => handleFilterToggle("half-day")}
                        >
                            <input
                                type="radio"
                                className="emp-attendance-legend-radio radio-half-day"
                                checked={attendanceFilter === "half-day"}
                                readOnly
                            />
                            <span className="emp-attendance-legend-pill emp-attendance-half-day"></span>
                            <div className="emp-attendance-legend-text-group">
                                <span className="emp-attendance-legend-label">Half Day</span>
                                <small className="emp-attendance-legend-subtext">( Half Day Leave )</small>
                            </div>
                        </div>
                        <div className="emp-attendance-legend-item">
                            <span className="emp-attendance-legend-pill emp-attendance-holiday"></span>
                            <span className="emp-attendance-legend-label">Holidays</span>
                        </div>
                    </div>

                    {/* ===== CALENDAR GRID ===== */}
                    <div className="attendanceoverview-calendar-grid">
                        {(() => {
                            if (!fromMonth || !toMonth) {
                                return (
                                    <div className="no-range-selected">
                                        <p>Please select a month range to view attendance data.</p>
                                    </div>
                                );
                            }

                            const monthNames = [
                                "January",
                                "February",
                                "March",
                                "April",
                                "May",
                                "June",
                                "July",
                                "August",
                                "September",
                                "October",
                                "November",
                                "December",
                            ];

                            const fromMonthIndex = monthNames.indexOf(fromMonth);
                            const toMonthIndex = monthNames.indexOf(toMonth);

                            const calendars = [];

                            let currentMonth = fromMonthIndex;
                            let currentYear = fromYear;
                            let dataIndex = 0;

                            while (
                                currentYear < toYear ||
                                (currentYear === toYear && currentMonth <= toMonthIndex)
                            ) {
                                calendars.push(
                                    <MiniCalendar
                                        key={`${monthNames[currentMonth]}-${currentYear}`}
                                        month={monthNames[currentMonth]}
                                        year={currentYear}
                                        calendarData={monthlyData[dataIndex] || []}
                                        filter={attendanceFilter}
                                    />
                                );

                                dataIndex++;

                                currentMonth++;

                                if (currentMonth > 11) {
                                    currentMonth = 0;
                                    currentYear++;
                                }
                            }

                            return calendars;
                        })()}
                    </div>
                </div>

                {/* ===== LEAVE & ABSENT DETAILS CONTAINER ===== */}
                {filterDetails && (
                    <div className={`attendance-filter-details-container ${filterDetails.filterType}`}>
                        {/* ── Separate Leave Details Header Card ── */}
                        <div className={`filter-details-header-card ${filterDetails.filterType}`}>
                            <div className="filter-details-header-left">
                                <div className="filter-details-icon-wrapper">
                                    <img
                                        src="/Personal Details.png"
                                        alt="Details"
                                        className="filter-details-header-img"
                                    />
                                </div>
                                <div>
                                    <h3 className="filter-details-title">
                                        {filterDetails.filterType === "leave" ? "Leave Details" : "Absent Details"}
                                    </h3>
                                    <p className="filter-details-subtitle">
                                        {filterDetails.filterType === "leave"
                                            ? "Showing all approved leave dates, types, and reasons"
                                            : "Showing all unexcused absent dates and records"}
                                    </p>
                                </div>
                            </div>
                            <div className="filter-details-header-right">
                                <span className={`filter-details-count-pill ${filterDetails.filterType}`}>
                                    Total: {filterDetails.records.length} {filterDetails.records.length === 1 ? "Day" : "Days"}
                                </span>

                                <div className="filter-details-page-size-selector">
                                    <span className="filter-details-page-size-label">Rows:</span>
                                    <div className="filter-details-page-size-dropdown">
                                        <ReusableDropdown
                                            value={pageSize}
                                            options={[5, 10, 20, 30]}
                                            isOpen={pageSizeDropdownOpen}
                                            setIsOpen={setPageSizeDropdownOpen}
                                            onChange={(val) => {
                                                setPageSize(Number(val));
                                                setCurrentPage(1);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Separate Table Card Under Header ── */}
                        <div className={`filter-details-table-card ${filterDetails.filterType}`}>
                            {filterDetails.records.length === 0 ? (
                                <div className="filter-details-empty">
                                    <p>No {filterDetails.filterType} records found for the selected period.</p>
                                </div>
                            ) : (
                                (() => {
                                    const indexOfLastRecord = currentPage * pageSize;
                                    const indexOfFirstRecord = indexOfLastRecord - pageSize;
                                    const currentRecords = filterDetails.records.slice(indexOfFirstRecord, indexOfLastRecord);

                                    return (
                                        <>
                                            <div className="filter-details-table-wrapper">
                                                <table className="filter-details-table">
                                                    <thead>
                                                        <tr>
                                                            <th className="filter-details-th-sno">S.No</th>
                                                            <th className="filter-details-th-date">Date</th>
                                                            <th className="filter-details-th-type">Type</th>
                                                            <th className="filter-details-th-reason">Reason</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {currentRecords.map((rec, idx) => {
                                                            const dateInfo = formatRecordDate(rec.date);
                                                            return (
                                                                <tr key={rec.date || idx}>
                                                                    <td className="filter-details-td-sno">{indexOfFirstRecord + idx + 1}</td>
                                                                    <td className="filter-details-td-date">
                                                                        <div className="date-main">{dateInfo.formatted}</div>
                                                                        <div className="date-weekday">{dateInfo.weekday}</div>
                                                                    </td>
                                                                    <td>
                                                                        <span className={`filter-details-type-tag ${filterDetails.filterType}`}>
                                                                            {rec.type}
                                                                        </span>
                                                                    </td>
                                                                    <td className="filter-details-td-reason">
                                                                        {rec.reason}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {filterDetails.records.length > 0 && (
                                                <div className="filter-details-pagination-wrapper">
                                                    <Pagination
                                                        totalItems={filterDetails.records.length}
                                                        pageSize={pageSize}
                                                        currentPage={currentPage}
                                                        onPageChange={(page) => setCurrentPage(page)}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    );
                                })()
                            )}
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}

export default EmployeeOverview;
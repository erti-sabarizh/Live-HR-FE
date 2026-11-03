import React, { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./AttendanceOverview.css";
import "../../Common/CustomDropdown.css";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { Icon } from "@iconify/react";
import { portalInstance } from "../../../Services/instance";
import { useUser } from "../../UserContext";
import { canHrMonthlyAttendance } from "../../../utils/hrAccessHelper";

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
    permissions: 0,
    attendancePercentage: 0,
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
   MINI CALENDAR
============================= */
function MiniCalendar({ month, calendarData = [], year, filter = null }) {
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

    const daysInMonth = new Date(actualYear, monthIndex + 1, 0).getDate();
    const firstDayWeekday = new Date(actualYear, monthIndex, 1).getDay();

    const cells = [];

    // ─── PREVIOUS MONTH PADDING ───
    for (let i = 0; i < firstDayWeekday; i++) {
        cells.push({ type: "empty" });
    }

    // ─── CURRENT MONTH DAYS ───
    for (let day = 1; day <= daysInMonth; day++) {
        const record = calendarData.find((d) => d.day === day);

        const dateObj = new Date(actualYear, monthIndex, day);
        const weekday = dateObj.getDay();

        const isSunday = weekday === 0;
        const isSecondSaturday = weekday === 6 && Math.ceil(day / 7) === 2;
        const isFourthSaturday = weekday === 6 && Math.ceil(day / 7) === 4;

        let status = record?.status || null;

        // Fallback weekend detection if backend didn't send status
        if (!status) {
            if (isSunday || isSecondSaturday || isFourthSaturday) {
                status = "weekend";
            }
        }

        cells.push({
            type: "day",
            day,
            status,
            isToday: record?.isToday || false,
        });
    }

    // ─── NEXT MONTH PADDING — FORCE 42 CELLS ───
    let nextMonthDay = 1;
    while (cells.length < 42) {
        cells.push({
            type: "next",
            day: nextMonthDay++,
            status: "inactive",
        });
    }

    return (
        <div className="attendanceoverview-month-card">
            {/* ── Month/Year Header (Figma Style) ── */}
            <div className="attendanceoverview-month-header">
                <h3>{month} <strong>{actualYear}</strong></h3>
                <div className="header-underline"></div>
            </div>

            {/* ── Weekday Headers ── */}
            <div className="attendanceoverview-weekdays">
                {WEEKDAYS.map((d) => (
                    <span key={d}>{d}</span>
                ))}
            </div>

            {/* ── Day Cells ── */}
            <div className="attendanceoverview-days">
                {cells.map((cell, i) => {
                    if (cell.type === "empty" || cell.type === "next") {
                        return (
                            <div key={i} className="attendanceoverview-day inactive">
                                {cell.day || ""}
                            </div>
                        );
                    }

                    let cls = "attendanceoverview-day";
                    if (cell.status === "inactive") cls += " inactive";

                    const normalizedStatus = cell.status ? String(cell.status).toLowerCase().trim() : "";

                    if (!filter) {
                        if (normalizedStatus === "weekend") cls += " weekend";

                        return (
                            <div key={i} className={cls}>
                                <span
                                    className={`day-number ${cell.isToday ? "today-highlight" : ""} ${normalizedStatus === "holiday" ? "holiday-highlight" : ""}`}
                                >
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
                        <div key={i} className={cls}>
                            <span className={`day-number ${isMatch ? highlightClass : ""}`}>
                                {cell.day}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* =============================
   MAIN COMPONENT
============================= */
function AttendanceOverview() {
    const navigate = useNavigate();
    const { user } = useUser();
    const canMonthly = canHrMonthlyAttendance(user);
    const [searchParams, setSearchParams] = useSearchParams();
    const dropdownRef = useRef(null);
    const employeeId = searchParams.get("employeeId");

    if (user?.isHr && user?.role !== "admin" && !canMonthly) {
        return (
            <div className="attendance-overview-page">
                <Sidebar />
                <div className="attendance-overview-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
                    <div style={{ background: "#ffffff", borderRadius: "12px", padding: "48px 32px", maxWidth: "560px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                        <div style={{ fontSize: "44px", marginBottom: "16px" }}>🔒</div>
                        <h3 style={{ color: "#1e293b", fontSize: "20px", marginBottom: "10px", fontWeight: "700" }}>Access Restricted</h3>
                        <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
                            Monthly attendance overview is currently disabled for HR accounts per the Portal Access Configuration.
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

    const handleBack = () => {
        navigate("/admin/attendance-report");
    };

    if (!employeeId || employeeId === "undefined") {
        console.error("Invalid employeeId in URL");
    }
    const getCurrentFinancialYear = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        return month >= 3 ? year : year - 1;
    };

    const urlYear = Number(searchParams.get("year")) || getCurrentFinancialYear();

    const [year, setYear] = useState(urlYear);
    const [employee, setEmployee] = useState(fallbackEmployee);
    const [stats, setStats] = useState(fallbackStats);
    const [monthlyData, setMonthlyData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);
    const [attendanceFilter, setAttendanceFilter] = useState(null);

    const handleFilterToggle = (status) => {
        setAttendanceFilter((prev) => (prev === status ? null : status));
    };

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

    // ✅ NEW STATES FOR FROM-TO MONTH FILTER
    const [fromMonth, setFromMonth] = useState("April");
    const [toMonth, setToMonth] = useState("March");
    const [fromYear, setFromYear] = useState(urlYear);
    const [toYear, setToYear] = useState(urlYear + 1);

    const isFinancialYear = fromMonth === "April" && toMonth === "March" && toYear === fromYear + 1;

    const [fromMonthDropdownOpen, setFromMonthDropdownOpen] = useState(false);
    const [toMonthDropdownOpen, setToMonthDropdownOpen] = useState(false);
    const [fromYearDropdownOpen, setFromYearDropdownOpen] = useState(false);
    const [toYearDropdownOpen, setToYearDropdownOpen] = useState(false);

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

    /* =============================
       ✅ HELPER FUNCTIONS (FINANCIAL YEAR)
    ============================= */
    const generateFinancialYears = () => {
        const startYear = 2024;
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Detect current financial year (April is index 3)
        let currentFY = currentMonth >= 3 ? currentYear : currentYear - 1;

        const years = [];
        for (let y = startYear; y <= currentFY; y++) {
            years.push(y);
        }
        return years;
    };

    const formatFinancialYear = (y) => {
        if (typeof y !== "number") return y;
        return `${y}`;
    };

    /* =============================
       ✅ REUSABLE CUSTOM DROPDOWN
    ============================= */
    const CustomDropdown = ({
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
                        if (!isOpen) {
                            setFromMonthDropdownOpen(false);
                            setToMonthDropdownOpen(false);
                            setFromYearDropdownOpen(false);
                            setToYearDropdownOpen(false);
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
                            const isDisabled = disabledOptions.includes(opt);
                            return (
                                <div
                                    key={opt}
                                    className={`custom-dropdown-option ${value === opt ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isDisabled) return;
                                        onChange(opt);
                                        setIsOpen(false);
                                    }}
                                >
                                    {typeof opt === "number"
                                        ? formatFinancialYear(opt)
                                        : opt}
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

    /* =============================
       ✅ UPDATE URL PARAMS WITH MONTH FILTERS
    ============================= */
    useEffect(() => {
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

        if (!fromMonth || !toMonth || !fromYear || !toYear) return;

        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);

            next.set("year", fromYear);
            next.set("fromYear", fromYear);
            next.set("toYear", toYear);
            next.set("fromMonth", monthIndexMap[fromMonth]);
            next.set("toMonth", monthIndexMap[toMonth]);

            if (employeeId && employeeId !== "undefined") {
                next.set("employeeId", employeeId);
            }

            return next;
        }, { replace: true });
    }, [fromYear, fromMonth, toMonth, employeeId, setSearchParams]);

    /* =============================
       FETCH ATTENDANCE DATA
    ============================= */
    useEffect(() => {
        if (!employeeId || employeeId === "undefined" || !fromMonth || !toMonth || !fromYear) {
            setLoading(false);
            return;
        }

        const fetchAttendance = async () => {
            setLoading(true);
            try {
                // ✅ FIX 1: Correct month mapping (DO NOT use indexOf)
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

                const res = await portalInstance.get("/portal/admin/attendance-preview", {
                    params: {
                        employeeId,
                        year: fromYear,
                        fromYear,
                        toYear,
                        fromMonth: monthIndexMap[fromMonth],
                        toMonth: monthIndexMap[toMonth],
                    },
                });

                const data = res.data?.data || {};

                // ✅ BASIC DATA
                if (data.employee) setEmployee(data.employee);
                if (data.summary) setStats(data.summary);

                // Build calendar data keyed by JS month index (0-11)
                if (data.calendar && typeof data.calendar === "object") {
                    // Build month order from fromMonth to toMonth (handles wrap-around Apr→Mar)
                    const monthIndexMap = {
                        January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
                        July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
                    };
                    const fm = monthIndexMap[fromMonth];
                    const tm = monthIndexMap[toMonth];

                    // Generate ordered month indices from fromMonth → toMonth
                    const orderedMonthIndices = [];
                    let cur = fm;
                    while (true) {
                        orderedMonthIndices.push(cur);
                        if (cur === tm) break;
                        cur = (cur + 1) % 12;
                        if (orderedMonthIndices.length > 12) break; // safety
                    }

                    // Map each ordered month index to its calendar data
                    const orderedMonths = orderedMonthIndices.map(
                        (monthIndex) => data.calendar[monthIndex] || []
                    );

                    setMonthlyData(orderedMonths);
                }

            } catch (err) {
                console.error("Failed to load attendance:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();
    }, [employeeId, fromYear, toYear, fromMonth, toMonth]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest(".custom-dropdown-container")) {
                setFromMonthDropdownOpen(false);
                setToMonthDropdownOpen(false);
                setFromYearDropdownOpen(false);
                setToYearDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <>
            <Sidebar />

            <div className="attendanceoverview">

                {/* ===== SUMMARY CARD ===== */}
                <div className="attendanceoverview-summary">

                    <div className="attendanceoverview-header">
                        <div className="attendanceoverview-profile">
                            <button
                                type="button"
                                className="attendance-overview-back-btn"
                                onClick={handleBack}
                                title="Go Back"
                                aria-label="Go Back"
                            >
                                <Icon icon="ion:arrow-back" className="attendance-overview-back-icon" />
                            </button>
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
                                <div className="attendanceoverview-dates">
                                    <span>Joined: {employee.joiningDate || "-"}</span>
                                    {employee.relievingDate && (
                                        <span className="relieving-date"> | Relieved: {employee.relievingDate}</span>
                                    )}
                                </div>
                                <p>{employee.designation}</p>
                            </div>
                        </div>

                        {/* ✅ NEW 4-SELECTOR FILTER UI */}
                        <div className="attendanceoverview-filters" ref={dropdownRef}>

                            {/* FROM SECTION */}
                            <div className="range-group">
                                <span className="range-label">From</span>
                                <CustomDropdown
                                    value={fromMonth}
                                    options={CALENDAR_MONTHS}
                                    isOpen={fromMonthDropdownOpen}
                                    setIsOpen={setFromMonthDropdownOpen}
                                    onChange={setFromMonth}
                                />
                                <CustomDropdown
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
                                <CustomDropdown
                                    value={toMonth}
                                    options={CALENDAR_MONTHS}
                                    isOpen={toMonthDropdownOpen}
                                    setIsOpen={setToMonthDropdownOpen}
                                    onChange={setToMonth}
                                    disabledOptions={getDisabledToMonths()}
                                />
                                <CustomDropdown
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
                                <p className="stat-value">{stats.approvedLeave ?? stats.leavesTaken ?? 0}</p>
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

                            {/* Conditional Policy Stats */}
                            {isFinancialYear ? (
                                <>
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
                                </>
                            ) : (
                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Leave Taken</p>
                                    <p className="stat-value">{stats.policyUsed ?? 0}</p>
                                </div>
                            )}

                            {stats.maternityLeave?.used > 0 && (
                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Maternity Leave</p>
                                    <p className="stat-value">{stats.maternityLeave.used}</p>
                                </div>
                            )}
                            {stats.paternityLeave?.used > 0 && (
                                <div className="attendanceoverview-stat-item">
                                    <p className="stat-label">Paternity Leave</p>
                                    <p className="stat-value">{stats.paternityLeave.used}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
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
                                    <p className="stat-value">{stats.approvedLeave ?? stats.leavesTaken ?? 0}</p>
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
                                {!isFinancialYear && (
                                    <div className="attendanceoverview-stat-item mobile-only-stat">
                                        <p className="stat-label">Leave Taken</p>
                                        <p className="stat-value">{stats.policyUsed ?? 0}</p>
                                    </div>
                                )}
                            </div>

                            {/* ✅ SECOND ROW: LEAVE POLICY STATS */}
                            {!isFinancialYear ? (
                                <div className="attendanceoverview-stats policy-row desktop-only-policy-row" style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                                    <div className="attendanceoverview-stat-item">
                                        <p className="stat-label">Leave Taken</p>
                                        <p className="stat-value">{stats.policyUsed ?? 0}</p>
                                    </div>
                                    <div className="attendanceoverview-stat-item"></div>
                                    <div className="attendanceoverview-stat-item"></div>
                                    {stats.maternityLeave?.used > 0 && (
                                        <div className="attendanceoverview-stat-item">
                                            <p className="stat-label">Maternity Leave</p>
                                            <p className="stat-value">{stats.maternityLeave.used}</p>
                                        </div>
                                    )}
                                    {stats.paternityLeave?.used > 0 && (
                                        <div className="attendanceoverview-stat-item">
                                            <p className="stat-label">Paternity Leave</p>
                                            <p className="stat-value">{stats.paternityLeave.used}</p>
                                        </div>
                                    )}
                                    {/* Fillers to keep alignment */}
                                    <div className="attendanceoverview-stat-item"></div>
                                    <div className="attendanceoverview-stat-item"></div>
                                    <div className="attendanceoverview-stat-item"></div>
                                    <div className="attendanceoverview-stat-item"></div>
                                </div>
                            ) : (
                                <div className="attendanceoverview-stats policy-row" style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
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
                                    {stats.maternityLeave?.used > 0 && (
                                        <div className="attendanceoverview-stat-item">
                                            <p className="stat-label">Maternity Leave</p>
                                            <p className="stat-value">{stats.maternityLeave.used}</p>
                                        </div>
                                    )}
                                    {stats.paternityLeave?.used > 0 && (
                                        <div className="attendanceoverview-stat-item">
                                            <p className="stat-label">Paternity Leave</p>
                                            <p className="stat-value">{stats.paternityLeave.used}</p>
                                        </div>
                                    )}
                                    {/* Fillers to keep alignment */}
                                    <div className="attendanceoverview-stat-item"></div>
                                    <div className="attendanceoverview-stat-item"></div>
                                    <div className="attendanceoverview-stat-item"></div>
                                    <div className="attendanceoverview-stat-item"></div>
                                </div>
                            )}
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
                                <small className="emp-attendance-legend-subtext">( No Intimation )</small>
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

                    {/* ===== CALENDAR GRID WITH MONTH FILTER ===== */}
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

                    {/* ===== LEAVE & ABSENT DETAILS CONTAINER ===== */}
                    {filterDetails && (
                        <div className={`attendance-filter-details-container ${filterDetails.filterType}`}>
                            <div className="filter-details-header">
                                <div className="filter-details-header-left">
                                    <div className={`filter-details-icon-wrapper ${filterDetails.filterType}`}>
                                        {filterDetails.filterType === "leave" ? (
                                            <Icon icon="mdi:calendar-check" width="22" height="22" />
                                        ) : (
                                            <Icon icon="mdi:alert-circle" width="22" height="22" />
                                        )}
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
                                    <button
                                        type="button"
                                        className="filter-details-close-btn"
                                        onClick={() => setAttendanceFilter(null)}
                                        title="Close details"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {filterDetails.records.length === 0 ? (
                                <div className="filter-details-empty">
                                    <p>No {filterDetails.filterType} records found for the selected period.</p>
                                </div>
                            ) : (
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
                                            {filterDetails.records.map((rec, idx) => {
                                                const dateInfo = formatRecordDate(rec.date);
                                                return (
                                                    <tr key={rec.date || idx}>
                                                        <td className="filter-details-td-sno">{idx + 1}</td>
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
                            )}
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}

export default AttendanceOverview;
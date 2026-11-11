// AttendanceReport.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Attendancereport.css";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { Icon } from "@iconify/react";
import { portalInstance } from "../../../Services/instance";
import Search from "../../../../public/search.svg";
import arrow from "../../../../public/Down Arrow.svg";
import filter from "../../../../public/Filter.svg";
import Pagination from "../../Employee/Pagination/Pagination";

/* ─────────────────────────────────────────────
   MONTH MAPPING (DO NOT CHANGE)
───────────────────────────────────────────── */
const monthMap = {
  "All Months": "ALL",
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};
import CustomDropdown from "../../Common/CustomDropdown";
import { useUser } from "../../UserContext";
import { canHrMonthlyAttendance, canHrExportAttendance } from "../../../utils/hrAccessHelper";

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
function AttendanceReport() {
  const navigate = useNavigate();
  const { user } = useUser();
  const canMonthly = canHrMonthlyAttendance(user);
  const canExport = canHrExportAttendance(user);

  if (user?.isHr && user?.role !== "admin" && !canMonthly) {
    return (
      <div className="attendance-report-page">
        <Sidebar />
        <div className="attendance-report-content-wrapper" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
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

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ⚡ Debounce search input to avoid keystroke flooding
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const currentDate = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [selectedMonth, setSelectedMonth] = useState(monthNames[currentDate.getMonth()]);
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));

  const [showFilter, setShowFilter] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");

  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showSearchActive, setShowSearchActive] = useState(false);
  const [departmentEmployees, setDepartmentEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const downloadMenuRef = useRef(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  // FIX: MAX_VISIBLE_PAGES is now only used for how many page buttons to show
  // in the pagination UI at once. Navigation uses the real totalPages derived
  // from employees.length. Previously MAX_VISIBLE_PAGES was wrongly used as
  // the navigation ceiling too, making employees on page 6+ unreachable.
  const MAX_VISIBLE_PAGES = 5;

  const months = [
    "All Months", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const years = ["2024", "2025", "2026", "2027"];

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await portalInstance.get("/portal/admin/departments");
        if (res.data?.success) {
          setDepartments(res.data.data);
        }
      } catch (err) {
        console.error("Department fetch failed", err);
      }
    };

    fetchDepartments();
  }, []);

  useEffect(() => {
    const fetchAttendanceReport = async () => {
      try {
        setLoading(true);
        setCurrentPage(1);

        const response = await portalInstance.get(
          "/portal/admin/attendance-report",
          {
            params: {
              month: monthMap[selectedMonth],
              year: selectedYear,
              search: debouncedSearch,
              department: selectedDepartment || undefined,
            },
          }
        );

        if (response.data?.success) {
          setEmployees(response.data.data);
        } else {
          setEmployees([]);
        }
      } catch (error) {
        console.error("Failed to fetch attendance report:", error);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceReport();
  }, [selectedMonth, selectedYear, debouncedSearch, selectedDepartment]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(event.target)
      ) {
        setShowDownloadMenu(false);
      }
    };

    if (showDownloadMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDownloadMenu]);

  useEffect(() => {
    if (!selectedDepartment) {
      setDepartmentEmployees([]);
      return;
    }

    const unique = {};
    employees.forEach((emp) => {
      if (emp.name && !unique[emp.name]) {
        unique[emp.name] = emp;
      }
    });

    setDepartmentEmployees(Object.values(unique));
  }, [employees, selectedDepartment]);

  const handlePreview = (employeeId) => {
    if (!employeeId) {
      console.error("❌ Invalid employeeId:", employeeId);
      return;
    }

    navigate(
      `/admin/attendance-preview?employeeId=${encodeURIComponent(employeeId)}&year=${selectedYear}`
    );
  };

  const handleEmployeeSummaryDownload = async (employeeId) => {
    if (!canExport) {
      alert("Attendance export is disabled for HR by Administrator Configuration.");
      return;
    }
    try {
      const monthValue = monthMap[selectedMonth];

      const response = await portalInstance.get(
        "/portal/download/employee-summary",
        {
          params: {
            employeeId,
            month: monthValue,
            year: selectedYear,
          },
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `employee_summary_${selectedMonth}_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Employee summary download failed", error);
      alert("Download failed");
    }
  };

  const handleAllEmployeesSummaryDownload = async () => {
    if (!canExport) {
      alert("Attendance export is disabled for HR by Administrator Configuration.");
      return;
    }
    try {
      const monthValue = monthMap[selectedMonth];

      const response = await portalInstance.get(
        "/portal/download/all-summary",
        {
          params: {
            month: monthValue,
            year: selectedYear,
          },
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `all_employees_summary_${selectedMonth}_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Overall summary download failed", error);
      alert("Download failed");
    }
  };

  // FIX: totalPages is derived from actual employee count, not hardcoded MAX
  const totalPages = Math.ceil(employees.length / itemsPerPage);

  // FIX: Build the visible page numbers window around the current page
  const getVisiblePages = () => {
    if (totalPages <= MAX_VISIBLE_PAGES) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    // Center the window around currentPage
    let start = Math.max(1, currentPage - Math.floor(MAX_VISIBLE_PAGES / 2));
    let end = start + MAX_VISIBLE_PAGES - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - MAX_VISIBLE_PAGES + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const monthOptions = months.map((m) => ({ label: m, value: m }));
  const yearOptions = years.map((y) => ({ label: y, value: y }));
  const departmentOptions = [
    { label: "All Departments", value: "" },
    ...departments.map((d) => ({ label: d, value: d })),
  ];
  const employeeOptions = [
    { label: "Select Employee", value: "" },
    ...departmentEmployees.map((emp) => ({ label: emp.name, value: emp.name })),
  ];

  return (
    <>
      <Sidebar />

      <div className="attendance-report-container">
        <div className="attendance-content">

          <div className="attendance-header-section">
            <h1 className="attendance-main-title">
              Employee Attendance Status
            </h1>

            <div className="attendance-controls">

              <div className="controls-top-row">

                <div className="dropdown-wrapper">
                  <CustomDropdown
                    options={monthOptions}
                    value={selectedMonth}
                    onChange={(val) => setSelectedMonth(val)}
                    placeholder="Month"
                    className="month-dropdown"
                  />
                </div>

                <div className="dropdown-wrapper">
                  <CustomDropdown
                    options={yearOptions}
                    value={selectedYear}
                    onChange={(val) => setSelectedYear(val)}
                    placeholder="Year"
                    className="year-dropdown"
                  />
                </div>

                <div className="controls-icon-group">
                  <div
                    className="search-icon-wrapper"
                    onClick={() => {
                      setShowSearchActive((prev) => !prev);
                      setShowEmployeeDropdown(false);
                      if (!showSearchActive) {
                        setSearchTerm("");
                      }
                    }}
                  >
                    <img src={Search} alt="search" className="search-icon-toggle" />
                  </div>

                  <div
                    className="filter-wrapper"
                    onClick={() => setShowFilter((prev) => !prev)}
                  >
                    <img src={filter} alt="filter" className="filter-icon" />
                  </div>

                  {canExport && (
                    <div className="three-dot-menu-container" ref={downloadMenuRef}>
                      <div
                        className="three-dot-btn"
                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      >
                        <Icon icon="bi:three-dots" width={24} color="#3A466D" />
                      </div>

                      {showDownloadMenu && (
                        <div className="download-dropdown-menu">
                          <div
                            className="download-menu-item"
                            onClick={() => {
                              setShowDownloadMenu(false);
                              handleAllEmployeesSummaryDownload();
                            }}
                          >
                            Download Report
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {(showSearchActive || (showEmployeeDropdown && departmentEmployees.length > 0)) && (
                <div className="dynamic-controls-area">
                  {showSearchActive && (
                    <div className="search-box-wrapper bottom-search">
                      <input
                        type="text"
                        className="search-input-field"
                        placeholder="Search employee"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <img src={Search} alt="search bar" className="search-icon-input" />
                    </div>
                  )}

                  {!showSearchActive && showEmployeeDropdown && departmentEmployees.length > 0 && (
                    <div className="employee-dropdown">
                      <CustomDropdown
                        options={employeeOptions}
                        value={selectedEmployee}
                        onChange={(val) => {
                          setSelectedEmployee(val);
                          setSearchTerm(val);
                        }}
                        placeholder="Select Employee"
                        className="employee-select-dropdown"
                      />
                    </div>
                  )}
                </div>
              )}

            </div>

            {showFilter && (
              <div className="filter-panel">
                <div className="filter-header">
                  <label>Department</label>
                  <Icon
                    icon="material-symbols:close"
                    className="close-filter-icon"
                    onClick={() => setShowFilter(false)}
                  />
                </div>

                <CustomDropdown
                  options={departmentOptions}
                  value={selectedDepartment}
                  onChange={(val) => {
                    setSelectedDepartment(val);
                    setShowFilter(false);
                    setShowEmployeeDropdown(!!val);
                    setShowSearchActive(false);
                    setSelectedEmployee("");
                    setSearchTerm("");
                  }}
                  placeholder="Select Department"
                  className="department-dropdown"
                />
              </div>
            )}
          </div>

          <div className="attendance-table-wrapper">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th className="th-sno">S.No</th>
                  <th className="th-employee">Employee Name</th>
                  <th className="th-working">Working Days</th>
                  <th className="th-present">Days Present</th>
                  <th className="th-leaves">Leaves Taken</th>
                  <th className="th-permissions">Permissions</th>
                  <th className="th-percentage">Attendance %</th>
                  <th className="th-preview">Preview</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlnign: "center" }}>
                      Loading...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center" }}>
                      No records found
                    </td>
                  </tr>
                ) : (
                  employees
                    .slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage
                    )
                    .map((emp, index) => (
                      <tr key={emp.employeeId}>
                        <td className="td-sno">
                          {String(
                            (currentPage - 1) * itemsPerPage + index + 1
                          ).padStart(2, "0")}
                        </td>

                        <td className="td-employee">
                          <div className="employee-info">
                            <div className={`employee-avatar ${emp.employmentStatus === 'relieved' ? 'relieved-border' : 'active-border'}`}>
                              <img
                                src={emp.avatar || "/avatar.png"}
                                alt={emp.name}
                                onError={(e) => {
                                  e.target.src = "/avatar.png";
                                }}
                              />
                            </div>
                            <div className="employee-details">
                              <span className="employee-name">
                                {emp.name}
                              </span>
                              <span className="employee-designation">
                                {emp.designation}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="td-working">{emp.workingDays}</td>
                        <td className="td-present">{emp.daysPresent}</td>
                        <td className="td-leaves">{emp.leavesTaken}</td>
                        <td className="td-permissions">{emp.permissions}</td>
                        <td className="td-percentage">{emp.attendancePercentage || "0%"}</td>

                        <td className="td-preview">
                          <button
                            className="preview-btn"
                            onClick={() => handlePreview(emp.employeeId || emp._id)}
                          >
                            Preview
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>

            {/* FIX: Pagination now uses real totalPages for navigation.
                Only the visible page buttons are windowed to MAX_VISIBLE_PAGES. */}
            <div className="pagination-container">
              <Pagination
                totalItems={employees.length}
                pageSize={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default AttendanceReport;
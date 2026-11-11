import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Sidebar from "../../HeaderSidebar/Sidebar";
import "./Remainder.css";
import zoom from "../../../../public/Zoom.svg";
import work from "../../../../public/Work.svg";
import sub from "../../../../public/Submission.svg";
import filter from "../../../../public/Filter.svg";
import { portalInstance } from "../../../Services/instance";
import { useSearchParams } from "react-router-dom";
import CustomDropdown from "../../../Components/Common/CustomDropdown";
import moment from "moment";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const START_YEAR = 2024;
const MONTHS = [
  { label: "Jan", value: "January" },
  { label: "Feb", value: "February" },
  { label: "Mar", value: "March" },
  { label: "Apr", value: "April" },
  { label: "May", value: "May" },
  { label: "Jun", value: "June" },
  { label: "Jul", value: "July" },
  { label: "Aug", value: "August" },
  { label: "Sep", value: "September" },
  { label: "Oct", value: "October" },
  { label: "Nov", value: "November" },
  { label: "Dec", value: "December" },
];

// ── Helper: check if a date is 2nd or 4th Saturday ──────────────
function isSecondOrFourthSaturday(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (date.getDay() !== 6) return false; // not Saturday
  const weekOfMonth = Math.ceil(day / 7);
  return weekOfMonth === 2 || weekOfMonth === 4;
}

function Remainder() {
  const today = new Date();
  const todayStr = new Date().toLocaleDateString("en-CA");
  const currentYear = today.getFullYear().toString();
  const currentMonthNum = today.getMonth();
  const currentMonthName = today.toLocaleString("default", { month: "long" });
  const currentDay = today.getDate();
  const [showFilterList, setShowFilterList] = useState(false);

  const [month, setMonth] = useState(currentMonthName);
  const [year, setYear] = useState(currentYear);
  const [monthNum, setMonthNum] = useState(currentMonthNum + 1);
  const [reminders, setReminders] = useState({});
  const [showPopup, setShowPopup] = useState(false);
  const [showAllPopup, setShowAllPopup] = useState(false);
  const [showViewPopup, setShowViewPopup] = useState(false);
  const [activeReminderId, setActiveReminderId] = useState(null);
  const [viewReminderData, setViewReminderData] = useState(null);
  const [allMonthReminders, setAllMonthReminders] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchParams] = useSearchParams();
  const selectedDate = searchParams.get("date");

  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState("Meeting");
  const [customCategory, setCustomCategory] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [leaveCalendar, setLeaveCalendar] = useState({});
  const [specialDays, setSpecialDays] = useState({});

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === "--:--") return "--:-- --";
    if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
    try {
      const [hours, minutes] = timeStr.split(":");
      const h = parseInt(hours);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, "0")}:${minutes} ${ampm}`;
    } catch (e) {
      return timeStr || "--:-- --";
    }
  };

  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeResults, setEmployeeResults] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const openPopupOnMount = React.useRef(false);

  useEffect(() => {
    fetchReminders();
    fetchLeaveCalendar();
    fetchSpecialDays();
  }, [monthNum, year]);

  useEffect(() => {
    if (!showViewPopup || !activeReminderId) return;
    const fetchReminderDetails = async () => {
      try {
        const res = await portalInstance.get(`/reminders/${activeReminderId}`);
        if (res.data.success) {
          // console.log("API RESPONSE:", res.data.data);
          setViewReminderData(res.data.data);
        }
      } catch (err) {
        console.error("Failed to load reminder details", err);
      }
    };
    fetchReminderDetails();
  }, [showViewPopup, activeReminderId]);

  useEffect(() => {
    const isAnyPopupOpen = showPopup || showAllPopup || showViewPopup;
    if (isAnyPopupOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [showPopup, showAllPopup, showViewPopup]);

  const fetchLeaveCalendar = async () => {
    try {
      const res = await portalInstance.get(
        `/users/attendance/govholidays?year=${year}`
      );
      if (!res.data?.success) return;
      const holidays = res.data.data || [];
      const map = {};
      holidays.forEach((h) => {
        const d = new Date(h.date);
        const holidayYear = d.getFullYear();
        const holidayMonth = d.getMonth() + 1;
        const holidayDay = d.getDate();
        if (holidayYear == year && holidayMonth == monthNum) {
          map[holidayDay] = {
            isGovtHoliday: true,
            name: h.name,
          };
        }
      });
      setLeaveCalendar(map);
    } catch (err) {
      console.error("Failed to load leave calendar", err);
    }
  };

  const fetchSpecialDays = async () => {
    try {
      const res = await portalInstance.get(
        `/holiday-assignments/special-days/${year}`
      );
      if (!res.data?.success) return;
      const data = res.data.data || [];
      const map = {};
      data.forEach((sd) => {
        if (sd.year == year && sd.month == monthNum) {
          map[sd.day] = sd.name;
        }
      });
      setSpecialDays(map);
    } catch (err) {
      console.error("Failed to load special days", err);
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await portalInstance.get("/get-reminders", {
        params: { month: monthNum, year },
      });
      if (res.data.success) {
        setAllMonthReminders(res.data.data);
        const grouped = {};
        res.data.data.forEach((rem) => {
          const dateKey = moment.utc(rem.date).format("YYYY-MM-DD");
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push({
            _id: rem._id,
            time: rem.time,
            text: rem.title,
            details: rem.details,
            category: rem.category,
            type:
              rem.category === "Submission"
                ? "red"
                : rem.category === "Meeting"
                  ? "blue"
                  : rem.category === "Work"
                    ? "green"
                    : "gray",
          });
        });
        Object.keys(grouped).forEach((key) => {
          grouped[key].sort((a, b) => {
            if (!a.time || a.time === "--:--") return 1;
            if (!b.time || b.time === "--:--") return -1;
            return moment(a.time, "hh:mm A") - moment(b.time, "hh:mm A");
          });
        });
        setReminders(grouped);
      }
    } catch (err) {
      console.error("Failed to load reminders:", err);
      alert("Could not load reminders. Please try again.");
    }
  };

  useEffect(() => {
    if (!employeeQuery.trim() || employeeQuery.trim().length < 2) {
      setEmployeeResults([]);
      setShowFilterList(false)
      return;
    }
    setShowFilterList(true); 
    const delay = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await portalInstance.get("/search-employees", {
          params: { query: employeeQuery },
        });
        if (res.data.success) {
          setEmployeeResults(res.data.data);
        }
      } catch (err) {
        console.error("Employee search failed", err);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(delay);
  }, [employeeQuery]);

  useEffect(() => {
    if (selectedDate && !openPopupOnMount.current) {
      openPopupOnMount.current = true;
      try {
        const d = new Date(selectedDate);
        if (!isNaN(d.getTime())) {
          const mName = d.toLocaleString("default", { month: "long" });
          // setDate(selectedDate);
          setMonth(mName);
          setYear(d.getFullYear().toString());
          setMonthNum(d.getMonth() + 1);
        }
      } catch (e) {
        console.warn("Invalid date in URL", e);
      }
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!showSuccessToast) return;
    const timer = setTimeout(() => {
      setShowSuccessToast(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [showSuccessToast]);

  const generateCalendar = (year, monthIndex) => {
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay();
    const prevMonthDays = startWeekday;
    const totalCells = 35;
    let cells = [];
    const prevLastDay = new Date(year, monthIndex, 0).getDate();
    for (let i = prevLastDay - prevMonthDays + 1; i <= prevLastDay; i++) {
      cells.push({ day: i, isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ day: i, isCurrentMonth: true });
    }
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, isCurrentMonth: false });
    }
    return cells;
  };

  const calendarCells = generateCalendar(year, monthNum - 1);

  const handleCreate = async () => {
    if (!title || !category || !date || !time) {
      toast.error("Title, category, event date and event time are required.");
      return;
    }
    if (notifications.length === 0) {
      toast.error("Add at least one notification");
      return;
    }
    for (const n of notifications) {
      if (!n.date || !n.time) {
        toast.error("All notifications must have date and time");
        return;
      }
    }
    if (category === "Other" && !customCategory) {
      toast.error("Please enter custom category.");
      return;
    }
    try {
      const payload = {
        title,
        details,
        category,
        customCategory: category === "Other" ? customCategory : undefined,
        eventDate: date,
        eventTime: formatTime(time),
        notifications: notifications.map((n) => ({
          ...n,
          time: formatTime(n.time),
        })),
        participantIds: selectedEmployees.map((e) => e._id),
      };
      const res = await portalInstance.post("/reminders", payload);
      if (res.data.success) {
        toast.success("Reminder created successfully");
        setShowPopup(false);
        setTitle("");
        setDetails("");
        setCategory("Meeting");
        setCustomCategory("");
        setDate("");
        setTime("");
        setNotifications([]);
        setEmployeeQuery("");
        setEmployeeResults([]);
        setSelectedEmployees([]);
        fetchReminders();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create reminder.");
    }
  };

  const handleMonthChange = (newMonthName) => {
    setMonth(newMonthName);
    const newMonthNum = new Date(`${newMonthName} 1, ${year}`).getMonth() + 1;
    setMonthNum(newMonthNum);
  };

  const handleYearChange = (newYear) => {
    setYear(newYear);
  };

  const handleDeleteReminder = async () => {
    if (!activeReminderId) return;

    try {
      const res = await portalInstance.delete(`/reminders/${activeReminderId}`);

      if (res.data.success) {
        setShowDeleteModal(false);
        setShowViewPopup(false);
        setActiveReminderId(null);

        // refresh data
        fetchReminders();

        toast.success("Reminder deleted successfully");
      }
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Failed to delete reminder");
    }
  };


const handleFilterClick = async () => {
  // 🔁 TOGGLE
  if (showFilterList) {
    setShowFilterList(false);
    setEmployeeResults([]);
    return;
  }

  setShowFilterList(true);

  try {
    setSearchLoading(true);

    const res = await portalInstance.get("/search-employees", {
      params: { query: "" }
    });

    if (res.data.success) {
      setEmployeeResults(res.data.data);
    }

  } catch (err) {
    console.error("Filter fetch failed", err);
  } finally {
    setSearchLoading(false);
  }
};

  return (
    <>
      <Sidebar />
      <div className="remainder-page-container">

      <div className="remainder-page">
        <button className="remainder-more-btn" onClick={() => setShowAllPopup(true)}>
          ⋯
        </button>

        {/* ── Top bar: Remainder btn + dropdowns + legend ── */}
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-3 gap-3">
          <button
            className="common-modal-btn btn-update"
            onClick={() => setShowPopup(true)}
          >
             Create Remainder
          </button>

          {/* ── Legend ── */}
          <div className="remainder-legend">
            <span className="legend-item">
              <span className="legend-dot legend-holiday"></span>
              Government Holiday
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-weekend"></span>
              2nd/4th Sat &amp; Sunday
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-both"></span>
              Holiday + Weekend
            </span>
          </div>

          <div className="d-flex gap-2 flex-nowrap align-items-center remainder-dropdowns-container">
            <div className="attendance-dropdown-wrapper">
              <CustomDropdown
                options={MONTHS.map((m) => ({ label: m.label, value: m.value }))}
                value={month}
                onChange={handleMonthChange}
                placeholder="Month"
                className="emp-attendance-month-dropdown"
              />
            </div>

            <div className="attendance-dropdown-wrapper">
              <CustomDropdown
                options={Array.from(
                  { length: Number(currentYear) - START_YEAR + 1 },
                  (_, i) => START_YEAR + i
                ).map((y) => ({ label: y.toString(), value: y.toString() }))}
                value={year.toString()}
                onChange={handleYearChange}
                placeholder="Year"
                className="emp-attendance-month-dropdown"
              />
            </div>
          </div>
        </div>

        <div className="remainder-grid remainder-days d-none d-md-grid">
          {days.map((d) => (
            <div key={d} className="remainder-day-cell">
              {d}
            </div>
          ))}
        </div>

        <div className="remainder-grid remainder-days d-md-none">
          {days.map((d) => (
            <div key={d} className="remainder-day-cell">
              {d.substring(0, 3)}
            </div>
          ))}
        </div>

        <div className="remainder-grid remainder-calendar">
          {calendarCells.map((cell, i) => {
            const dateKey = cell.isCurrentMonth
              ? `${year}-${String(monthNum).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`
              : null;

            const isToday =
              cell.isCurrentMonth &&
              cell.day === currentDay &&
              monthNum === currentMonthNum + 1 &&
              year === currentYear;

            const leave = cell.isCurrentMonth ? leaveCalendar[cell.day] : null;
            const specialDayName = cell.isCurrentMonth ? specialDays[cell.day] : null;

            // ── Determine if Sunday or 2nd/4th Saturday ──
            const isSunday = cell.isCurrentMonth &&
              new Date(year, monthNum - 1, cell.day).getDay() === 0;

            const is2nd4thSat = cell.isCurrentMonth &&
              isSecondOrFourthSaturday(Number(year), monthNum, cell.day);

            const isWeekend = isSunday || is2nd4thSat;

            // Both holiday AND weekend
            const isBoth = leave?.isGovtHoliday && isWeekend;

            return (
              <div
                key={i}
                className={`remainder-date-cell 
                  ${!cell.isCurrentMonth ? "muted" : ""}
${cell.isCurrentMonth && !leave?.isGovtHoliday && !isWeekend ? "working-day" : ""}
                  ${isBoth ? "remainder-leave-both" : leave?.isGovtHoliday ? "remainder-leave-holiday" : isWeekend ? "remainder-leave-weekoff" : ""}
                  ${isToday && !leave?.isGovtHoliday && !isWeekend ? "today-highlight" : ""}
                  ${dateKey && reminders[dateKey]?.length > 0 ? "has-reminders" : ""}`}
              >
                {/* ── Special Day name (e.g. Father's Day) ── */}
                {cell.isCurrentMonth && specialDayName && (
                  <span className="remainder-special-day-name" title={specialDayName}>
                    {specialDayName}
                  </span>
                )}

                {/* ── Holiday name top-left ── */}
                {cell.isCurrentMonth && leave?.isGovtHoliday && (
                  <span className="remainder-holiday-name">{leave.name}</span>
                )}

                <span className="date-number">{cell.day}</span>

                {/* Case 1: Single Reminder */}
                {dateKey && reminders[dateKey]?.length === 1 &&
                  reminders[dateKey].map((r, idx) => {
                    let iconSrc;
                    if (r.category === "Meeting") iconSrc = zoom;
                    else if (r.category === "Submission") iconSrc = sub;
                    else if (r.category === "Work") iconSrc = work;
                    else iconSrc = null;

                    return (
                      <div
                        key={idx}
                        className={`remainder-event ${r.type}`}
                        onClick={() => {
                          setActiveReminderId(r._id);
                          setShowViewPopup(true);
                        }}
                      >
                        <div className="event-header">
                          {iconSrc && (
                            <img src={iconSrc} alt="icon" className="event-icon" />
                          )}
                          <span className="time">{formatTime(r.time)}</span>
                        </div>
                        <span className="text">{r.text}</span>
                      </div>
                    );
                  })}

                {/* Case 2: Multiple Reminders */}
                {dateKey && reminders[dateKey]?.length > 1 && (
                  <div className="multi-reminder-icons">
                    {reminders[dateKey].map((r, idx) => {
                      let iconSrc;
                      if (r.category === "Meeting") iconSrc = zoom;
                      else if (r.category === "Submission") iconSrc = sub;
                      else if (r.category === "Work") iconSrc = work;
                      else iconSrc = null;

                      return iconSrc ? (
                        <img
                          key={idx}
                          src={iconSrc}
                          alt="icon"
                          className="multi-icon"
                          onClick={() => setShowAllPopup(true)}
                        />
                      ) : null;
                    })}
                  </div>
                )}

                {dateKey && reminders[dateKey]?.length > 0 && (
                  <div className="cell-underline-wrapper">
                    {(() => {
                      const dayRems = reminders[dateKey];
                      const uniqueColors = [...new Set(dayRems.map((r) => r.type))];
                      if (uniqueColors.length === 1) {
                        return (
                          <div className={`cell-underline ${uniqueColors[0]}`} />
                        );
                      } else {
                        return (
                          <div className="cell-underline-multi">
                            {uniqueColors.map((color, idx) => (
                              <div
                                key={idx}
                                className={`cell-underline-segment ${color}`}
                                style={{
                                  backgroundColor:
                                    color === "blue"
                                      ? "#1E93E2"
                                      : color === "red"
                                        ? "#FB5939"
                                        : color === "green"
                                          ? "#00D40E"
                                          : "#808080",
                                }}
                              />
                            ))}
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
</div>


      {showPopup && (
        <div className="remainder-popup-backdrop">
          <div className="remainder-popup">
            <div className="remainder-popup-header">
              <h4>Create Remainder</h4>
              <button
  type="button"
  className="reminder-close-btn"
  onClick={() => setShowPopup(false)}
>
  ✕
</button>
            </div>

            <div className="remainder-popup-body">
              <div className="popup-left">
                <h6>Add Members</h6>
                <div className="popup-search-row">
                  <input
                    type="text"
                    placeholder="Search"
                    value={employeeQuery}
                    onChange={(e) => setEmployeeQuery(e.target.value)}
                  />
                  <img
  className="filter-remainder"
  src={filter}
  alt="filter"
  onClick={handleFilterClick}
/>
                  {/* <span className="filter-text">Filters</span> */}
                </div>

                {searchLoading && <p className="small">Searching...</p>}

                {showFilterList && employeeResults.map((emp) => (
                  <div
                    key={emp._id}
                    className="popup-member"
                    onClick={() => {
                      if (!selectedEmployees.find((e) => e._id === emp._id)) {
                        setSelectedEmployees([...selectedEmployees, emp]);
                      }
                      setEmployeeResults([]);
                      setEmployeeQuery("");
                      setShowFilterList(false);
                    }}
                  >
                    <img
                      src={emp.avatar || "/avatar.png"}
                      alt={emp.name}
                      onError={(e) => (e.target.src = "/avatar.png")}
                    />
                    <div>
                      <strong>{emp.name}</strong>
                      <span>{emp.designation}</span>
                      {/* <small>{emp.email}</small> */}
                    </div>
                  </div>
                ))}

                {selectedEmployees.map((emp) => (
                  <div key={emp._id} className="popup-member">
                    <img
                      src={emp.avatar || "/avatar.png"}
                      alt={emp.name}
                      onError={(e) => (e.target.src = "/avatar.png")}
                    />
                    <div>
                      <strong>{emp.name}</strong>
                      <span>{emp.designation}</span>
                    </div>
                    <button
                      onClick={() =>
                        setSelectedEmployees(selectedEmployees.filter((e) => e._id !== emp._id))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="popup-right">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    placeholder="write here...."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Details</label>
                  <textarea
                    placeholder="write here...."
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <div className="popup-category">
                    <CustomDropdown
                      options={[
                        { label: "Submission", value: "Submission" },
                        { label: "Meeting", value: "Meeting" },
                        { label: "Work", value: "Work" },
                        { label: "Other", value: "Other" },
                      ]}
                      value={category}
                      onChange={setCategory}
                      placeholder="Select Category"
                    />

                    {category === "Other" && (
                      <input
                        type="text"
                        className="form-control mt-2"
                        placeholder="Enter custom category"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Notification</label>
                  <div className="notification-section">
                    {notifications.map((n, index) => (
                      <div className="notification-row" key={index}>
                        <input
                          type="date"
                          value={n.date}
                          min={todayStr}
                          onChange={(e) => {
                            const copy = [...notifications];
                            copy[index].date = e.target.value;
                            setNotifications(copy);
                          }}
                        />
                        <input
                          type="time"
                          value={n.time}
                          onChange={(e) => {
                            const copy = [...notifications];
                            copy[index].time = e.target.value;
                            setNotifications(copy);
                          }}
                        />
                        <button
                          className="notification-remove-btn"
                          onClick={() =>
                            setNotifications(notifications.filter((_, i) => i !== index))
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      className="add-notification-btn"
                      onClick={() =>
                        setNotifications([...notifications, { date: "", time: "" }])
                      }
                    >
                      + Add Notification
                    </button>
                  </div>
                </div>

                <div className="popup-datetime">
                  <div className="form-group">
                    <label>Event Date</label>
                    <input
                      type="date"
                      value={date}
                      min={todayStr}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Event Time</label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="popup-actions">
                  <button className="common-modal-btn btn-small-cancel" onClick={() => setShowPopup(false)}>
                    Cancel
                  </button>
                  <button className="common-modal-btn btn-update" onClick={handleCreate}>
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showViewPopup && (
        <div className="view-remainder-backdrop">
          <div className="view-remainder-popup">
            <div className="view-remainder-header">
              <h3>Remainder</h3>
<div className="view-more-wrapper">
  <button
    className="view-remainder-more"
    onClick={(e) => {
      e.stopPropagation();
      const menu = document.getElementById("view-more-menu");
      if (menu) menu.classList.toggle("show");
    }}
  >
    ⋯
  </button>

  <div id="view-more-menu" className="view-more-menu">
    <button
      className="delete-btn"
      onClick={(e) => {
        e.stopPropagation();
        const menu = document.getElementById("view-more-menu");
        if (menu) menu.classList.remove("show");
        setShowDeleteModal(true);
      }}
    >
      Delete
    </button>
  </div>
</div>
            </div>

            <div className="view-remainder-body">
              <div className="view-remainder-members">
  <p className="view-members-label">Members</p>

  {viewReminderData?.participants?.length > 0 ? (
    viewReminderData.participants.map((p, index) => (
      <div key={index} className="view-remainder-member">
        <img
          src={p.avatar}
          alt={p.name}
          onError={(e) => (e.target.src = "/avatar.png")}
        />
        <div>
          <strong className="view-member-name">{p.name || "-"}</strong>
          <span className="view-member-role">{p.designation || "-"}</span>
        </div>
      </div>
    ))
  ) : (
    <p className="small text-muted">No members added</p>
  )}
</div>

              <div className="view-remainder-divider" />

              <div className="view-remainder-details">
                <div className="view-remainder-meta">
                  <div className="view-meta-item">
                    <span className="view-meta-label">Date</span>
                    <span className="view-meta-value">
                      {viewReminderData?.date
                        ? moment.utc(viewReminderData.date).format("DD MMM")
                        : "-"}
                    </span>
                  </div>

                  <div className="view-meta-item">
                    <span className="view-meta-label">Time</span>
                    <span className="view-meta-value">
                      {formatTime(viewReminderData?.time)}
                    </span>
                  </div>

                  <div className="view-meta-item">
                    <span className="view-meta-label">Type</span>
                    <span className={`view-remainder-type ${viewReminderData?.category?.toLowerCase() || ""}`}>
                      {viewReminderData?.category || "-"}
                    </span>
                  </div>
                </div>

                <hr className="view-remainder-hr" />

                <div className="view-remainder-content">
                  <h4>{viewReminderData?.title || "Loading..."}</h4>
                  <p>{viewReminderData?.details || "-"}</p>
                </div>

                <div className="view-remainder-actions">
                  <button className="common-modal-btn btn-small-cancel" onClick={() => setShowViewPopup(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAllPopup && (
        <div className="remainder-popup-backdrop" onClick={() => setShowAllPopup(false)}>
          <div className="remainder-popup remainder-all-popup" onClick={(e) => e.stopPropagation()}>
            <div className="remainder-popup-header">
              <h4>Remainder</h4>
              <button
                type="button"
                className="reminder-close-btn"
                onClick={() => setShowAllPopup(false)}
              >
                ✕
              </button>
            </div>

            <div className="remainder-all-body-wrapper">
              <table className="remainder-all-table">
                <thead>
                  <tr className="remainder-all-header">
                    <th className="remainder-all-col-member">Member</th>
                    <th className="remainder-all-col-title">Task Title</th>
                    <th className="remainder-all-col-date">Date</th>
                    <th className="remainder-all-col-category">Category</th>
                  </tr>
                </thead>

                <tbody>
                  {allMonthReminders && allMonthReminders.length > 0 ? (
                    allMonthReminders.map((rem) => (
                      <tr
                        key={rem._id}
                        className="remainder-all-row"
                        onClick={() => {
                          setActiveReminderId(rem._id);
                          setShowAllPopup(false);
                          setShowViewPopup(true);
                        }}
                      >
                        <td className="remainder-all-col-member remainder-all-avatars">
                          <img
                            src={rem.participants?.[0]?.avatar || "/avatar.png"}
                            alt="avatar"
                            onError={(e) => (e.target.src = "/avatar.png")}
                          />
                        </td>

                        <td className="remainder-all-col-title remainder-all-content">
                          <div className="remainder-all-title">{rem.title}</div>
                          {rem.details && (
                            <div className="remainder-all-desc">{rem.details}</div>
                          )}
                        </td>

                        <td className="remainder-all-col-date remainder-all-date">
                          {moment.utc(rem.date).format("DD MMM")}
                        </td>

                        <td className="remainder-all-col-category">
                          <span
                            className={`remainder-all-badge ${
                              rem.category === "Submission"
                                ? "submission"
                                : rem.category === "Meeting"
                                  ? "meeting"
                                  : "work"
                            }`}
                          >
                            {rem.category}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="remainder-all-empty-row">
                      <td colSpan="4">No reminders found for this month.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="remainder-all-footer">
              <button className="common-modal-btn btn-small-cancel" onClick={() => setShowAllPopup(false)}>
                Cancel
              </button>
              <button
                className="common-modal-btn btn-update"
                onClick={() => {
                  setShowAllPopup(false);
                  setShowPopup(true);
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="todo-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="todo-modal-content common-modal-content todo-delete-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="todo-modal-header">
              <h3 className="common-modal-title">Confirm Delete</h3>
              <button className="common-modal-close-x" onClick={() => setShowDeleteModal(false)}>✕</button>
            </div>
            <div className="todo-modal-body common-modal-body">
              <p style={{ color: "#A29CC1" }}>Are you sure you want to delete this reminder? This action cannot be undone.</p>
            </div>
            <div className="todo-modal-footer todo-delete-modal-footer">
              <div className="todo-delete-btn-group">
                <button className="common-modal-btn btn-small-cancel" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button className="common-modal-btn btn-delete" onClick={handleDeleteReminder}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default Remainder;
import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../HeaderSidebar/Sidebar";
import CustomDropdown from "../../Common/CustomDropdown";
import ApprovalBanner from "../../Common/ApprovalBanner";
import "./Payslip.css";
import { portalInstance } from "../../../Services/instance";
import Pagination from "../../../Components/Employee/Pagination/Pagination";
import "../../../Components/Employee/Pagination/Pagination.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import arrow from "../../../../public/Down Arrow.svg";
import JSZip from "jszip";
import { useUser } from "../../UserContext";
import { canHrGenerateSlips, canHrDeleteSlips } from "../../../utils/hrAccessHelper";


const LocalPayslipDropdown = ({ options, value, onChange, placeholder, style, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`custom-dropdown-container ${className || ""}`} ref={dropdownRef} style={style}>
      <div className={`custom-dropdown-trigger ${isOpen ? "open" : ""}`} onClick={() => setIsOpen(!isOpen)}>
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <img
          src={arrow}
          alt="arrow"
          className={`dropdown-arrow-icon ${isOpen ? "rotate" : ""}`}
        />
      </div>
      {isOpen && (
        <div className="custom-dropdown-menu">
          {options.map((option) => (
            <div
              key={option.value}
              className={`custom-dropdown-option ${option.value === value ? "selected" : ""} ${option.disabled ? "disabled disabled-option" : ""}`}
              onClick={() => handleSelect(option)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const maskAccountNumber = (acc) => {
  if (!acc || acc === "-") return "-";
  const str = String(acc).replace(/\s+/g, "");
  if (str.length <= 4) return str;
  return "•".repeat(str.length - 4) + str.slice(-4);
};

const now = new Date();

/* ───────────────────────────────────────────── */
const DeleteConfirmationModal = ({ isOpen, onCancel, onConfirm, loading, count = 1, isBulk = false }) => {
  if (!isOpen) return null;

  return (
    <div className="custom-modal-overlay">
      <div className="custom-modal-container">
        <div className="custom-modal-header">
          <h3 style={{ fontSize: "16px" }}>Confirm Delete</h3>
        </div>
        <div className="custom-modal-body">
          <p>
            {isBulk
              ? `Are you sure you want to delete ${count} selected salary slip${count > 1 ? "s" : ""}?`
              : "Are you sure you want to delete this salary slip?"}
          </p>
        </div>
        <div className="custom-modal-footer">
          <button className="common-modal-btn btn-small-cancel" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="common-modal-btn btn-reject" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   BULK MODAL COMPONENT
───────────────────────────────────────────── */
const BulkPayslipModal = ({ onClose, onGenerated, employees, form, fetchEmployees }) => {
  const [selected, setSelected] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const [activeEmployees, setActiveEmployees] = useState([]);
  const [step, setStep] = useState("selection");

  const [deductionsMap, setDeductionsMap] = useState({});
  const [relievedModesMap, setRelievedModesMap] = useState({});
  const [customDaysMap, setCustomDaysMap] = useState({});
  const [lopConfirmModal, setLopConfirmModal] = useState(null);
  const [lopPopupModes, setLopPopupModes] = useState({});

  const [taxEditEmployee, setTaxEditEmployee] = useState(null);
  const [tempDeductions, setTempDeductions] = useState([]);

  const [allPT, setAllPT] = useState(false);

  const calculateDefaultDeductions = (emp, month, year, includePT, deductLop = true) => {
    const history = emp.salaryHistory || emp.details?.salaryHistory || [];
    const row = getApplicableSalary(history, month, year);
    const basic = Number(emp.overrideSalary ?? row?.basicSalary ?? 0);
    const allowances = (emp.overrideAllowances ?? row?.allowances ?? [])
      .reduce((sum, a) => sum + Number(a.amount ?? a.value ?? 0), 0);
    const totalSalary = Number(row?.totalSalary || (basic + allowances));

    const deductions = [];

    if (totalSalary > 0) {
      // EPF: 12% of Other Salary (50% of totalSalary)
      const otherSalary = Number((totalSalary * 0.5).toFixed(2));
      const epfAmount = Number((otherSalary * 0.12).toFixed(2));
      if (epfAmount > 0) {
        deductions.push({ label: "EPF", amount: epfAmount });
      }

      // ESI: 0.75% of Total Salary ONLY if totalSalary <= 20000
      if (totalSalary <= 20000) {
        const esiAmount = Number((totalSalary * 0.0075).toFixed(2));
        if (esiAmount > 0) {
          deductions.push({ label: "ESI", amount: esiAmount });
        }
      }
    }

    if (includePT) {
      const gross = basic + allowances;
      const m = Number(month);
      let ptAmount = 0;
      if (gross > 3500) {
        if (gross <= 5000) ptAmount = 22.50;
        else if (gross <= 7500) ptAmount = 52.50;
        else if (gross <= 10000) ptAmount = 115;
        else if (gross <= 12500) ptAmount = 171;
        else ptAmount = (m === 9 || m === 3) ? 210 : 208;
      }
      if (ptAmount > 0) {
        deductions.push({ label: "Professional Tax", amount: ptAmount });
      }
    }

    if (deductLop && emp.lopAmount && Number(emp.lopAmount) > 0) {
      deductions.push({ label: "Loss of Pay (LOP)", amount: Number(emp.lopAmount) });
    }

    return deductions;
  };

  const applyPTToEmployees = (empList, isChecked, mVal, yVal) => {
    setAllPT(isChecked);
    const month = mVal || selectedMonth;
    const year = yVal || selectedYear;
    setDeductionsMap((prev) => {
      const next = { ...prev };
      empList.forEach((emp) => {
        const empId = emp._id;
        const existing = next[empId] || calculateDefaultDeductions(emp, month, year, false);
        if (isChecked) {
          const hasPT = existing.some(d => d.label === "Professional Tax" || d.label === "PT");
          if (!hasPT) {
            const history = emp.salaryHistory || emp.details?.salaryHistory || [];
            const row = getApplicableSalary(history, month, year);
            const basic = Number(emp.overrideSalary ?? row?.basicSalary ?? 0);
            const allowances = (emp.overrideAllowances ?? row?.allowances ?? [])
              .reduce((sum, a) => sum + Number(a.amount ?? a.value ?? 0), 0);
            const gross = basic + allowances;

            const m = Number(month);
            let ptAmount = 0;
            if (gross > 3500) {
              if (gross <= 5000) ptAmount = 22.50;
              else if (gross <= 7500) ptAmount = 52.50;
              else if (gross <= 10000) ptAmount = 115;
              else if (gross <= 12500) ptAmount = 171;
              else ptAmount = (m === 9 || m === 3) ? 210 : 208;
            }

            if (ptAmount > 0) {
              next[empId] = [...existing, { label: "Professional Tax", amount: ptAmount }];
            } else {
              next[empId] = existing;
            }
          }
        } else {
          next[empId] = existing.filter(d => d.label !== "Professional Tax" && d.label !== "PT");
        }
      });
      return next;
    });
  };

  const handleToggleAllPT = (checked) => {
    applyPTToEmployees(activeEmployees, checked, selectedMonth, selectedYear);
    if (checked) {
      toast.success("Applied Professional Tax to employees");
    } else {
      toast.info("Removed Professional Tax from all employees");
    }
  };

  const [bulkTaxMode, setBulkTaxMode] = useState(false);
  const [bulkTaxData, setBulkTaxData] = useState({ label: "", amount: 0 });

  const handleBulkAddTax = () => {
    if (!bulkTaxData.label || !bulkTaxData.amount) {
      toast.warn("Please enter both label and amount");
      return;
    }
    setDeductionsMap((prev) => {
      const next = { ...prev };
      selected.forEach((id) => {
        const existing = next[id] || [];
        next[id] = [...existing, { ...bulkTaxData }];
      });
      return next;
    });
    setBulkTaxMode(false);
    setBulkTaxData({ label: "", amount: 0 });
    toast.success(`Added "${bulkTaxData.label}" to ${selected.length} employees`);
  };

  const handleTaxEditClick = (emp) => {
    setTaxEditEmployee(emp);
    setTempDeductions([...(deductionsMap[emp._id] || [])]);
  };

  const handleSaveTaxEdit = () => {
    setDeductionsMap((prev) => ({
      ...prev,
      [taxEditEmployee._id]: tempDeductions,
    }));
    setTaxEditEmployee(null);
  };
  const [selectedMonth, setSelectedMonth] = useState(form.month);
  const [selectedYear, setSelectedYear] = useState(form.year);

  const [editEmployee, setEditEmployee] = useState(null);
  const [editData, setEditData] = useState({
    basicSalary: 0,
    allowances: []
  });

  const monthOptions = monthNames;
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = 2024; y <= currentYear; y++) {
    yearOptions.push(y);
  }

  const monthDropdownOptions = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    return monthOptions.map((m, i) => {
      const monthVal = i + 1;
      const yearVal = Number(selectedYear);
      let disabled = false;

      if (yearVal) {
        // Rule: Cannot be before April 2024
        if (yearVal === 2024 && monthVal < 4) disabled = true;
        // Rule: Current ongoing month is not selectable until completed!
        if (yearVal > curYear) disabled = true;
        else if (yearVal === curYear && monthVal >= curMonth) disabled = true;
      }

      return { label: m, value: monthVal.toString(), disabled };
    });
  }, [monthOptions, selectedYear]);

  const yearDropdownOptions = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();

    return [
      { label: "Year", value: "" },
      ...yearOptions.map(y => {
        // Rule: Year cannot be greater than current year
        const disabled = y > curYear;
        return { label: y.toString(), value: y.toString(), disabled };
      })
    ];
  }, [yearOptions]);

  const handleAddPT = (empId) => {
    // 1. Get the employee object to calculate their gross salary
    const emp = activeEmployees.find(e => e._id === empId);
    if (!emp) return;

    // 2. Calculate Gross Salary (Basic + Allowances)
    const history = emp.salaryHistory || [];
    const row = getApplicableSalary(history, selectedMonth, selectedYear);
    const basic = Number(emp.overrideSalary ?? row?.basicSalary ?? 0);
    const allowances = (emp.overrideAllowances ?? row?.allowances ?? [])
      .reduce((sum, a) => sum + Number(a.amount ?? a.value ?? 0), 0);
    const gross = basic + allowances;

    // 3. PT Calculation Logic from Slab Image
    const m = Number(selectedMonth);
    let ptAmount = 0;
    if (gross <= 3500) ptAmount = 0;
    else if (gross <= 5000) ptAmount = 22.50;
    else if (gross <= 7500) ptAmount = 52.50;
    else if (gross <= 10000) ptAmount = 115;
    else if (gross <= 12500) ptAmount = 171;
    else ptAmount = (m === 9 || m === 3) ? 210 : 208;

    if (ptAmount === 0) {
      toast.info(`Gross ₹${gross.toLocaleString("en-IN")} is below threshold. No PT applied.`);
      return;
    }

    // 4. Add to Deductions Map
    setDeductionsMap((prev) => {
      const existing = prev[empId] || [];
      const hasPT = existing.some(d => d.label === "Professional Tax" || d.label === "PT");
      if (hasPT) {
        toast.info("PT already added for this employee");
        return prev;
      }
      return {
        ...prev,
        [empId]: [...existing, { label: "Professional Tax", amount: ptAmount }]
      };
    });
    toast.success(`₹${ptAmount} Professional Tax added (Gross: ₹${gross.toLocaleString("en-IN")})`);
  };

  const handleNext = async () => {
    if (!selectedMonth || !selectedYear) {
      alert("Please select both month and year");
      return;
    }
    setBulkLoading(true);
    try {
      // Fetch fresh employee list and use returned data directly (avoid stale state)
      const freshEmployees = await fetchEmployees(selectedMonth, selectedYear);

      setActiveEmployees(freshEmployees);

      // Auto-check PT Tax from January 2026 onwards (year >= 2026), leave unchecked for years < 2026
      const is2026OrFuture = Number(selectedYear) >= 2026;
      setAllPT(is2026OrFuture);

      const initialDeductions = {};
      freshEmployees.forEach((emp) => {
        initialDeductions[emp._id] = calculateDefaultDeductions(
          emp,
          selectedMonth,
          selectedYear,
          is2026OrFuture,
          true
        );
      });
      setDeductionsMap(initialDeductions);
      setSelected([]);

      setStep("table");
    } catch (err) {
      console.error("Error preparing bulk table:", err);
      setStep("table");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleEditClick = (emp) => {
    setEditEmployee(emp);

    const mode = relievedModesMap[emp._id] || "full";
    const history = emp.salaryHistory || [];
    const row = getApplicableSalary(history, selectedMonth, selectedYear) || history[0] || {};

    const hasExistingOverride = emp.overrideSalary !== undefined || emp.overrideAllowances !== undefined;

    if (hasExistingOverride) {
      setEditData({
        basicSalary: emp.overrideSalary !== undefined ? emp.overrideSalary : (row?.basicSalary || 0),
        allowances: (emp.overrideAllowances !== undefined ? emp.overrideAllowances : (row?.allowances || [])).map((a) => ({
          label: a.label || a.name || "",
          amount: Number(a.amount ?? a.value ?? 0),
        })),
      });
    } else if (mode === "deduct") {
      const rawBasic = row?.basicSalary || 0;
      const rawAllowances = row?.allowances || [];
      const m = Number(selectedMonth);
      const y = Number(selectedYear);
      const monthDays = new Date(y, m, 0).getDate() || 30;

      let payableDays = customDaysMap[emp._id];
      if (payableDays === undefined || payableDays === null) {
        if (emp.dateRelieved) {
          const d = new Date(emp.dateRelieved);
          if (!isNaN(d.getTime()) && (d.getMonth() + 1 === m) && (d.getFullYear() === y)) {
            payableDays = d.getDate();
          }
        } else if (emp.dateJoined) {
          const d = new Date(emp.dateJoined);
          if (!isNaN(d.getTime()) && (d.getMonth() + 1 === m) && (d.getFullYear() === y)) {
            payableDays = monthDays - d.getDate() + 1;
          }
        } else if (emp.deductedSalary?.payableDays) {
          payableDays = emp.deductedSalary.payableDays;
        } else {
          payableDays = monthDays;
        }
      }

      const ratio = Math.min(1, Math.max(0, payableDays / monthDays));
      const deductedBasic = Math.round(rawBasic * ratio);
      const deductedAllowances = rawAllowances.map((a) => ({
        label: a.label || a.name || "",
        amount: Math.round(Number(a.amount ?? a.value ?? 0) * ratio),
      }));

      setEditData({
        basicSalary: deductedBasic,
        allowances: deductedAllowances,
      });
    } else {
      const rawBasic = row?.basicSalary || 0;
      const rawAllowances = row?.allowances || [];
      setEditData({
        basicSalary: rawBasic,
        allowances: rawAllowances.map((a) => ({
          label: a.label || a.name || "",
          amount: Number(a.amount ?? a.value ?? 0),
        })),
      });
    }
  };

  const handleSaveEdit = () => {
    const updatedEmp = {
      ...editEmployee,
      overrideSalary: editData.basicSalary,
      overrideAllowances: editData.allowances,
    };
    setActiveEmployees((prev) =>
      prev.map((emp) => (emp._id === editEmployee._id ? updatedEmp : emp))
    );
    setDeductionsMap((prev) => ({
      ...prev,
      [editEmployee._id]: calculateDefaultDeductions(updatedEmp, selectedMonth, selectedYear, allPT, true)
    }));
    setEditEmployee(null);
  };

  const selectableEmployees = activeEmployees.filter(e => !e.hasGeneratedSlip);
  const allSelected =
    selectableEmployees.length > 0 &&
    selectableEmployees.every((e) => selected.includes(String(e._id)));

  const toggleSelectAll = () => {
    if (allSelected) {
      const currentIds = new Set(selectableEmployees.map((e) => String(e._id)));
      setSelected((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const currentIds = selectableEmployees.map((e) => String(e._id));
      setSelected((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const toggleRow = (id, emp) => {
    if (emp && emp.hasGeneratedSlip) {
      const monthName = monthNames[Number(selectedMonth) - 1] || selectedMonth;
      toast.warn(`Salary slip for ${monthName} ${selectedYear} has already been generated for ${emp.name || "this employee"}.`);
      return;
    }
    const idStr = String(id);
    setSelected((prev) =>
      prev.includes(idStr) ? prev.filter((x) => x !== idStr) : [...prev, idStr]
    );
  };

  const getApplicableSalary = (history = [], month, year) => {
    month = Number(month);
    year = Number(year);
    if (!history.length) return null;

    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    return history.find((row) => {
      if (!row.fromDate) return false;
      const from = new Date(row.fromDate).getTime();
      const to = row.toDate ? new Date(row.toDate).getTime() : Infinity;

      return from <= end && to >= start;
    });
  };

  const getEarningsSummary = (emp) => {
    const history = emp.salaryHistory || [];
    const row = getApplicableSalary(history, selectedMonth, selectedYear);

    if (!row && emp.overrideSalary === undefined) return "-";

    const hasOverride = emp.overrideSalary !== undefined || emp.overrideAllowances !== undefined;

    let basic = Number(emp.overrideSalary ?? row?.basicSalary ?? 0);
    let allowances = (emp.overrideAllowances ?? row?.allowances ?? [])
      .reduce((sum, a) => sum + Number(a.value ?? a.amount ?? 0), 0);

    const mode = relievedModesMap[emp._id] || "full";
    if (mode === "deduct" && !hasOverride) {
      const m = Number(selectedMonth);
      const y = Number(selectedYear);
      const monthDays = new Date(y, m, 0).getDate() || 30;

      let payableDays = customDaysMap[emp._id];
      if (payableDays === undefined || payableDays === null) {
        if (emp.dateRelieved) {
          const d = new Date(emp.dateRelieved);
          if (!isNaN(d.getTime()) && (d.getMonth() + 1 === m) && (d.getFullYear() === y)) {
            payableDays = d.getDate();
          }
        } else if (emp.dateJoined) {
          const d = new Date(emp.dateJoined);
          if (!isNaN(d.getTime()) && (d.getMonth() + 1 === m) && (d.getFullYear() === y)) {
            payableDays = monthDays - d.getDate() + 1;
          }
        } else {
          payableDays = monthDays;
        }
      }
      const ratio = Math.min(1, Math.max(0, payableDays / monthDays));
      basic = Math.round(basic * ratio);
      allowances = Math.round(allowances * ratio);
    }

    const total = basic + allowances;

    return `₹${total.toLocaleString("en-IN")}`;
  };

  const getApplicableBank = (history = [], month, year) => {
    month = Number(month);
    year = Number(year);
    if (!history.length) return null;

    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    return history.find((row) => {
      if (!row.fromDate) return false;
      const from = new Date(row.fromDate).getTime();
      const to = row.toDate ? new Date(row.toDate).getTime() : Infinity;

      return from <= end && to >= start;
    });
  };

  const getAllowancesSummary = (emp) => {
    const history = emp.salaryHistory || [];
    const row = getApplicableSalary(history, selectedMonth, selectedYear);

    if (!row) return "-";

    const allowances = row.allowances || [];
    if (!allowances.length) return "None";

    return allowances
      .map((a) => a.label || a.name || "Allowance")
      .join(", ");
  };

  const callBulkApi = async (ids, lopDecision = true) => {
    setBulkLoading(true);
    setBulkResult(null);

    try {
      const isLopLabel = (label) =>
        /^(loss of pay|loss of pay \(lop\)|lop)$/i.test((label || "").trim());

      // Update deductionsMap locally for any employee set to not deduct
      setDeductionsMap((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          let deduct = true;
          if (typeof lopDecision === "boolean") {
            deduct = lopDecision;
          } else if (lopDecision && typeof lopDecision === "object") {
            deduct = (lopDecision[id] || "yes") === "yes";
          }
          if (!deduct && next[id]) {
            next[id] = next[id].filter((d) => !isLopLabel(d.label));
          }
        });
        return next;
      });

      const res = await portalInstance.post(
        "/salary-slip/admin/generate-multiple-salary-slip",
        {
          month: Number(selectedMonth),
          year: Number(selectedYear),
          regenerate: false,
          employeeData: activeEmployees
            .filter(emp => {
              const isSelected = ids.includes(String(emp._id));
              if (!isSelected) return false;

              if (emp.hasGeneratedSlip) {
                const monthName = monthNames[Number(selectedMonth) - 1] || selectedMonth;
                toast.warn(`Salary slip for ${emp.name} already generated for ${monthName} ${selectedYear}. Skipped.`);
                return false;
              }

              const hasSalary =
                emp.overrideSalary !== undefined ||
                (emp.salaryHistory && emp.salaryHistory.length > 0);

              if (!hasSalary) {
                toast.warn(`No salary found for ${emp.name}. Skipped.`);
                return false;
              }
              return true;
            })
            .map(emp => {
              const m = Number(selectedMonth);
              const y = Number(selectedYear);
              const totalMonthDays = new Date(y, m, 0).getDate();

              let defaultDays = totalMonthDays;
              if (emp.dateRelieved) {
                const d = new Date(emp.dateRelieved);
                if (!isNaN(d.getTime()) && (d.getMonth() + 1 === m) && (d.getFullYear() === y)) {
                  defaultDays = d.getDate();
                }
              } else if (emp.dateJoined) {
                const d = new Date(emp.dateJoined);
                if (!isNaN(d.getTime()) && (d.getMonth() + 1 === m) && (d.getFullYear() === y)) {
                  defaultDays = totalMonthDays - d.getDate() + 1;
                }
              }

              const customDays = customDaysMap[emp._id];
              const resolvedPayableDays = (customDays !== undefined && customDays !== null && customDays !== "")
                ? Number(customDays)
                : defaultDays;

              const hasLop = Boolean(emp.hasLop && (emp.lopDays > 0 || Number(emp.lopAmount) > 0));
              let shouldDeductLop = false;
              if (hasLop) {
                if (typeof lopDecision === "boolean") {
                  shouldDeductLop = lopDecision;
                } else if (lopDecision && typeof lopDecision === "object") {
                  shouldDeductLop = (lopDecision[emp._id] || "yes") === "yes";
                }
              }

              let empDeductions = deductionsMap[emp._id] || [];
              if (!shouldDeductLop) {
                empDeductions = empDeductions.filter(d => !isLopLabel(d.label));
              } else if (hasLop && emp.lopAmount > 0) {
                const hasEntry = empDeductions.some(d => isLopLabel(d.label));
                if (!hasEntry) {
                  empDeductions = [...empDeductions, { label: "Loss of Pay (LOP)", amount: Number(emp.lopAmount) }];
                }
              }

              return {
                empId: emp._id,
                overrideSalary: emp.overrideSalary,
                overrideAllowances: emp.overrideAllowances,
                deductions: empDeductions,
                relievedSalaryMode: relievedModesMap[emp._id] || "full",
                customPayableDays: resolvedPayableDays,
                deductLop: shouldDeductLop
              };
            })
        }
      );
      if (res.data?.success) {
        setBulkResult({
          success: true,
          message: `Generated: ${res.data.generated}, Failed: ${res.data.failed.length}`,
          failed: res.data.failed // Store failed array for error display
        });
        toast.success("Salary slip(s) generated successfully!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });

        // If only one employee was selected and generated, auto-preview it
        if (ids.length === 1 && res.data.generated === 1 && onGenerated) {
          setTimeout(() => {
            onGenerated(ids[0], selectedMonth, selectedYear);
          }, 1500);
          return;
        }

        // If all succeeded and multiple, reload or close
        if (res.data.failed.length === 0) {
          setTimeout(() => {
            onGenerated(null, selectedMonth, selectedYear);
            onClose();
          }, 1500);
        }
        // If some failed, don't auto-close/reload so admin can see errors

      } else {
        setBulkResult({
          success: false,
          message: res.data?.message || "Bulk generation failed.",
        });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Failed to generate bulk payslips.";
      setBulkResult({ success: false, message: msg });
      console.error("Bulk payslip error:", err);
    } finally {
      setBulkLoading(false);
    }
  };

  const triggerGeneration = (ids) => {
    const eligibleTargetEmployees = activeEmployees.filter(
      (e) => ids.includes(String(e._id)) && !e.hasGeneratedSlip
    );
    const lopTargetEmployees = eligibleTargetEmployees.filter(
      (e) => Boolean(e.hasLop && (e.lopDays > 0 || Number(e.lopAmount) > 0))
    );

    if (lopTargetEmployees.length > 0) {
      const initialModes = {};
      lopTargetEmployees.forEach((emp) => {
        initialModes[emp._id] = "yes";
      });
      setLopPopupModes(initialModes);
      setLopConfirmModal({
        ids: eligibleTargetEmployees.map((e) => String(e._id)),
        employees: lopTargetEmployees
      });
    } else {
      callBulkApi(eligibleTargetEmployees.map((e) => String(e._id)), false);
    }
  };

  const handleGenerateSelected = () => {
    if (!selected.length) return;
    triggerGeneration(selected);
  };

  const handleGenerateAll = () => {
    const allIds = activeEmployees
      .filter((e) => !e.hasGeneratedSlip)
      .map((e) => String(e._id));
    if (!allIds.length) return;
    triggerGeneration(allIds);
  };

  /* trap scroll behind modal */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <div className="bulk-modal-overlay">
        <div className={`bulk-modal-container ${step === "selection" ? "bulk-modal-container--selection" : "bulk-modal-container--table"}`}>
          {/* Modal Header */}
          <div className="bulk-modal-header" style={step === "selection" ? { borderBottom: "none" } : {}}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {step === "table" && (
                  <button
                    type="button"
                    className="bulk-modal-back-arrow-btn"
                    onClick={() => {
                      setStep("selection");
                      setSelected([]);
                      setActiveTab("payslip");
                    }}
                    aria-label="Back"
                    title="Back"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h2>Payslip Generation</h2>
              </div>
              {step === "table" && (
                <p className="bulk-modal-subtitle">
                  {`${monthNames[Number(selectedMonth) - 1]} ${selectedYear} — ${activeEmployees.length} eligible employee${activeEmployees.length !== 1 ? "s" : ""}`}
                </p>
              )}
            </div>

            {step === "table" && (
              <div className="bulk-modal-header-actions">

                <label className="bulk-pt-label">
                  <input
                    type="checkbox"
                    checked={allPT}
                    onChange={(e) => handleToggleAllPT(e.target.checked)}
                    className="bulk-pt-checkbox"
                  />
                  PT Tax
                </label>
                <button
                  className="bulk-modal-btn bulk-add-deduction-btn"
                  onClick={() => {
                    if (selected.length === 0) return toast.warn("Select employees first");
                    setBulkTaxMode(true);
                  }}
                  disabled={bulkLoading || selected.length === 0}
                >
                  Add Deduction
                </button>
              </div>
            )}

            <button className="bulk-modal-btn--close" onClick={onClose} aria-label="Close">✕</button>
          </div>

          {step === "selection" ? (
            <div className="bulk-selection-container">
              <h4 className="bulk-selection-title">Select Period for Generation</h4>
              <div className="bulk-selection-dropdown-group">
                <div className="bulk-dropdown-col">
                  <LocalPayslipDropdown
                    options={monthDropdownOptions}
                    value={selectedMonth.toString()}
                    onChange={(val) => setSelectedMonth(val)}
                    placeholder="Month"
                    className="bulk-dropdown-inner"
                  />
                </div>
                <div className="bulk-dropdown-col">
                  <LocalPayslipDropdown
                    options={yearDropdownOptions}
                    value={selectedYear.toString()}
                    onChange={(val) => setSelectedYear(val)}
                    placeholder="Year"
                    className="bulk-dropdown-inner"
                  />
                </div>
              </div>
              <button
                onClick={handleNext}
                disabled={bulkLoading}
                className="common-modal-btn btn-update"
              >
                {bulkLoading ? "Preparing..." : "Continue"}
              </button>
            </div>
          ) : (
            <>
              {/* Result Banner */}
              {bulkResult && (
                <div className={`bulk-modal-banner ${bulkResult.success && (!bulkResult.failed || bulkResult.failed.length === 0) ? "bulk-modal-banner--success" : "bulk-modal-banner--error"}`}>
                  <span>{bulkResult.success && (!bulkResult.failed || bulkResult.failed.length === 0) ? "✓" : "✕"}</span>
                  <div>
                    <p>{bulkResult.message}</p>
                    {bulkResult.failed && bulkResult.failed.length > 0 && (
                      <div className="bulk-modal-errors">
                        {bulkResult.failed.map((f, i) => (
                          <div key={i} className="bulk-error-item">
                            • {f.error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="bulk-modal-table-wrapper">
                {activeEmployees.length === 0 ? (
                  <div className="bulk-modal-empty">
                    No eligible employees found for this period.
                  </div>
                ) : (
                  <table className="bulk-modal-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={toggleSelectAll}
                              className="cursor-pointer"
                              title={allSelected ? "Deselect All" : "Select All"}
                            />
                          </th>
                          <th>Emp ID</th>
                          <th>Employee Name</th>
                          <th>Account No</th>
                          <th>Bank Name</th>
                          <th>Salary Details</th>
                          <th>Allowances</th>
                          <th>Deductions</th>
                          <th>Final Salary</th>
                          <th className="text-center">Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeEmployees.map((emp, idx) => {
                          const id = String(emp._id);
                          const isChecked = selected.includes(id);
                          return (
                            <tr
                              key={`bulk-emp-${id}-${idx}`}
                              className={`${isChecked ? "bulk-modal-row--selected" : ""} ${emp.hasGeneratedSlip ? "bulk-modal-row--disabled" : ""}`}
                              onClick={() => toggleRow(id, emp)}
                              style={emp.hasGeneratedSlip ? { opacity: 0.65, backgroundColor: "#f8fafc", cursor: "not-allowed" } : {}}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={emp.hasGeneratedSlip}
                                  readOnly
                                />
                              </td>
                              <td className="bulk-modal-empid">{emp.empId || "-"}</td>
                              <td className="bulk-modal-empname">
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <span>{emp.name || "-"}</span>
                                  {emp.hasGeneratedSlip && (
                                    <span style={{
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      fontWeight: "600",
                                      backgroundColor: "#e2e8f0",
                                      color: "#475569"
                                    }}>
                                      Already Generated
                                    </span>
                                  )}
                                  {Boolean(emp.hasLop && (emp.lopDays > 0 || Number(emp.lopAmount) > 0)) && (
                                    <span className="bulk-lop-text-only">LOP</span>
                                  )}
                                </div>
                                {(() => {
                                  const m = Number(selectedMonth);
                                  const y = Number(selectedYear);

                                  let isRelievedThisMonth = false;
                                  if (emp.dateRelieved) {
                                    const d = new Date(emp.dateRelieved);
                                    if (!isNaN(d.getTime())) {
                                      isRelievedThisMonth = (d.getMonth() + 1 === m) && (d.getFullYear() === y);
                                    }
                                  }

                                  let isJoinedThisMonth = false;
                                  if (emp.dateJoined) {
                                    const d = new Date(emp.dateJoined);
                                    if (!isNaN(d.getTime())) {
                                      isJoinedThisMonth = (d.getMonth() + 1 === m) && (d.getFullYear() === y);
                                    }
                                  }

                                  if (!isRelievedThisMonth && !isJoinedThisMonth) return null;

                                  const badgeLabel = isRelievedThisMonth ? "Relieved:" : "Joined:";
                                  const badgeColor = isRelievedThisMonth ? "#dc2626" : "#2563eb";

                                  return (
                                    <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", position: "relative", zIndex: 9999 }} onClick={(e) => e.stopPropagation()}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span style={{ fontSize: "11px", color: badgeColor, fontWeight: "600", whiteSpace: "nowrap" }}>{badgeLabel}</span>
                                        <CustomDropdown
                                          options={[
                                            { label: "Full Salary", value: "full" },
                                            { label: "Deduction Salary", value: "deduct" }
                                          ]}
                                          value={relievedModesMap[id] || "full"}
                                          onChange={(val) => {
                                            setRelievedModesMap((prev) => ({ ...prev, [id]: val }));
                                          }}
                                          direction="up"
                                          className="relieved-mode-dropdown"
                                          style={{ width: "140px", position: "relative", zIndex: 9999 }}
                                        />
                                      </div>
                                      {relievedModesMap[id] === "deduct" && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                                          <span style={{ fontSize: "11px", color: "#475569", fontWeight: "600", whiteSpace: "nowrap" }}>Worked Days:</span>
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={customDaysMap[id] ?? (() => {
                                              const totalMonthDays = new Date(y, m, 0).getDate();
                                              if (isRelievedThisMonth && emp.dateRelieved) {
                                                const d = new Date(emp.dateRelieved);
                                                return !isNaN(d.getTime()) ? d.getDate() : totalMonthDays;
                                              }
                                              if (isJoinedThisMonth && emp.dateJoined) {
                                                const d = new Date(emp.dateJoined);
                                                return !isNaN(d.getTime()) ? totalMonthDays - d.getDate() + 1 : totalMonthDays;
                                              }
                                              return totalMonthDays;
                                            })()}
                                            onChange={(e) => {
                                              const raw = e.target.value.replace(/[^0-9]/g, "");
                                              if (raw === "") {
                                                setCustomDaysMap((prev) => ({ ...prev, [id]: "" }));
                                                return;
                                              }
                                              const monthDays = new Date(y, m, 0).getDate();
                                              const val = Math.max(1, Math.min(monthDays, Number(raw)));
                                              setCustomDaysMap((prev) => ({ ...prev, [id]: val }));
                                            }}
                                            onWheel={(e) => e.target.blur()}
                                            onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }}
                                            style={{
                                              width: "50px",
                                              padding: "2px 4px",
                                              fontSize: "11px",
                                              borderRadius: "4px",
                                              border: "1px solid #cbd5e1",
                                              textAlign: "center",
                                              outline: "none",
                                              fontWeight: "600"
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td>
                                {(() => {
                                  const row = getApplicableBank(emp.bankHistory, selectedMonth, selectedYear);
                                  return maskAccountNumber(row?.accountNumber);
                                })()}
                              </td>
                              <td>
                                {(() => {
                                  const row = getApplicableBank(emp.bankHistory, selectedMonth, selectedYear);
                                  return row?.bankName || "-";
                                })()}
                              </td>
                              <td>{getEarningsSummary(emp)}</td>
                              <td className="bulk-modal-allowances">
                                {getAllowancesSummary(emp)}
                              </td>

                              {(() => {
                                const history = emp.salaryHistory || emp.details?.salaryHistory || [];
                                const row = getApplicableSalary(history, selectedMonth, selectedYear);
                                const hasOverride = emp.overrideSalary !== undefined || emp.overrideAllowances !== undefined;

                                const mode = relievedModesMap[id] || "full";
                                let basic = Number(
                                  emp.overrideSalary ?? row?.basicSalary ?? 0
                                );
                                let allowances = (
                                  emp.overrideAllowances ??
                                  row?.allowances ??
                                  []
                                ).reduce(
                                  (sum, a) => sum + Number(a.amount ?? a.value ?? 0),
                                  0
                                );

                                if (mode === "deduct" && !hasOverride) {
                                  const m = Number(selectedMonth);
                                  const y = Number(selectedYear);
                                  const monthDays = new Date(y, m, 0).getDate() || 30;

                                  let payableDays = customDaysMap[id];
                                  if (payableDays === undefined || payableDays === null) {
                                    if (emp.dateRelieved) {
                                      const d = new Date(emp.dateRelieved);
                                      if (!isNaN(d.getTime()) && (d.getMonth() + 1 === m) && (d.getFullYear() === y)) {
                                        payableDays = d.getDate();
                                      }
                                    } else if (emp.dateJoined) {
                                      const d = new Date(emp.dateJoined);
                                      if (!isNaN(d.getTime()) && (d.getMonth() + 1 === m) && (d.getFullYear() === y)) {
                                        payableDays = monthDays - d.getDate() + 1;
                                      }
                                    } else {
                                      payableDays = monthDays;
                                    }
                                  }
                                  const ratio = Math.min(1, Math.max(0, payableDays / monthDays));
                                  basic = Math.round(basic * ratio);
                                  allowances = Math.round(allowances * ratio);
                                }

                                const total = basic + allowances;

                                const totalDeductions = (deductionsMap[id] || []).reduce(
                                  (sum, d) => sum + Number(d.amount || 0),
                                  0
                                );
                                const finalSalary = Math.max(0, total - totalDeductions);

                                return (
                                  <>
                                    <td onClick={(e) => e.stopPropagation()}>
                                      {totalDeductions > 0 ? `₹${totalDeductions.toLocaleString("en-IN")}` : "₹0"}
                                    </td>
                                    <td>₹{finalSalary.toLocaleString("en-IN")}</td>
                                  </>
                                );
                              })()}

                              <td onClick={(e) => e.stopPropagation()} className="text-center">
                                {emp.hasGeneratedSlip ? (
                                  <span style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                                    Payslip Generated
                                  </span>
                                ) : (
                                  <div className="bulk-table-actions-group">
                                    <button
                                      className="bulk-modal-edit-btn"
                                      type="button"
                                      onClick={() => handleEditClick(emp)}
                                    >
                                      Salary Edit
                                    </button>
                                    <button
                                      className="bulk-modal-edit-btn bulk-modal-edit-deductions-btn"
                                      type="button"
                                      onClick={() => handleTaxEditClick(emp)}
                                    >
                                      Edit Deductions
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                )}
              </div>

              {/* Footer Actions */}
              <div className="bulk-modal-footer">
                <div className="bulk-modal-selection-info">
                  {selected.length > 0 && (
                    <span>{selected.length} selected</span>
                  )}
                </div>
                <div className="bulk-modal-footer-actions">
                  <button
                    className="bulk-modal-btn bulk-modal-btn--all"
                    onClick={handleGenerateAll}
                    disabled={bulkLoading || activeEmployees.length === 0}
                  >
                    {bulkLoading ? "Generating..." : "Generate All"}
                  </button>
                  <button
                    className="bulk-modal-btn bulk-modal-btn--selected"
                    onClick={handleGenerateSelected}
                    disabled={bulkLoading || selected.length === 0}
                  >
                    {bulkLoading ? "Generating..." : `Generate Selected${selected.length ? ` (${selected.length})` : ""}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Modal Popup - Moved OUTSIDE bulk-modal div */}
      {editEmployee && (
        <div className="edit-modal-overlay">
          <div className="edit-modal">
            <h3>Edit Salary (This Month Only)</h3>
            <p><strong>{editEmployee.name}</strong></p>

            <div className="edit-modal-field">
              <label>Basic Salary</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editData.basicSalary !== undefined && editData.basicSalary !== null ? editData.basicSalary : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setEditData({ ...editData, basicSalary: raw === "" ? "" : Number(raw) });
                }}
                onWheel={(e) => e.target.blur()}
                onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }}
              />
            </div>

            <div className="edit-modal-field">
              <label>Allowances</label>
              <div className="edit-modal-allowances-list">
                {editData.allowances.map((a, index) => (
                  <div key={index} className="allowance-row">
                    <input
                      type="text"
                      placeholder="Label"
                      value={a.label || a.name || ""}
                      onChange={(e) => {
                        const updated = [...editData.allowances];
                        updated[index] = { ...updated[index], label: e.target.value };
                        setEditData({ ...editData, allowances: updated });
                      }}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Amount"
                      value={a.amount !== undefined && a.amount !== null ? a.amount : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        const updated = [...editData.allowances];
                        updated[index] = { ...updated[index], amount: raw === "" ? "" : Number(raw) };
                        setEditData({ ...editData, allowances: updated });
                      }}
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...editData.allowances];
                        updated.splice(index, 1);
                        setEditData({ ...editData, allowances: updated });
                      }}
                      className="edit-modal-remove-allowance-btn"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24"><path fill="currentColor" d="M7 21q-.825 0-1.412-.587T5 19V6q-.425 0-.712-.288T4 5t.288-.712T5 4h4q0-.425.288-.712T10 3h4q.425 0 .713.288T15 4h4q.425 0 .713.288T20 5t-.288.713T19 6v13q0 .825-.587 1.413T17 21zm3.713-4.288Q11 16.426 11 16V9q0-.425-.288-.712T10 8t-.712.288T9 9v7q0 .425.288.713T10 17t.713-.288m4 0Q15 16.426 15 16V9q0-.425-.288-.712T14 8t-.712.288T13 9v7q0 .425.288.713T14 17t.713-.288"></path></svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="edit-modal-add-btn"
                onClick={() =>
                  setEditData({
                    ...editData,
                    allowances: [...editData.allowances, { label: "", amount: "" }]
                  })
                }
              >
                + Add Allowance
              </button>
            </div>

            <div className="edit-actions">
              <button className="edit-modal-btn edit-modal-btn--cancel" onClick={() => setEditEmployee(null)}>Cancel</button>
              <button className="edit-modal-btn edit-modal-btn--save" onClick={handleSaveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {taxEditEmployee && (
        <div className="edit-modal-overlay">
          <div className="edit-modal">
            <h3>Edit Deductions (This Month Only)</h3>
            <p><strong>{taxEditEmployee.name}</strong></p>

            <div className="edit-modal-field">
              <label>Deductions</label>
              <div className="edit-modal-allowances-list">
                {tempDeductions.map((d, index) => (
                  <div key={index} className="allowance-row">
                    <input
                      type="text"
                      placeholder="Tax Name"
                      value={d.label}
                      onChange={(e) => {
                        const updated = [...tempDeductions];
                        updated[index] = { ...updated[index], label: e.target.value };
                        setTempDeductions(updated);
                      }}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Amount"
                      value={d.amount !== undefined && d.amount !== null ? d.amount : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        const updated = [...tempDeductions];
                        updated[index] = { ...updated[index], amount: raw === "" ? "" : Number(raw) };
                        setTempDeductions(updated);
                      }}
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...tempDeductions];
                        updated.splice(index, 1);
                        setTempDeductions(updated);
                      }}
                      className="edit-modal-remove-allowance-btn"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24"><path fill="currentColor" d="M7 21q-.825 0-1.412-.587T5 19V6q-.425 0-.712-.288T4 5t.288-.712T5 4h4q0-.425.288-.712T10 3h4q.425 0 .713.288T15 4h4q.425 0 .713.288T20 5t-.288.713T19 6v13q0 .825-.587 1.413T17 21zm3.713-4.288Q11 16.426 11 16V9q0-.425-.288-.712T10 8t-.712.288T9 9v7q0 .425.288.713T10 17t.713-.288m4 0Q15 16.426 15 16V9q0-.425-.288-.712T14 8t-.712.288T13 9v7q0 .425.288.713T14 17t.713-.288"></path></svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="edit-modal-add-btn"
                onClick={() => setTempDeductions([...tempDeductions, { label: "", amount: "" }])}
              >
                + Add Tax
              </button>
            </div>

            <div className="edit-actions">
              <button className="edit-modal-btn edit-modal-btn--cancel" onClick={() => setTaxEditEmployee(null)}>Cancel</button>
              <button className="edit-modal-btn edit-modal-btn--save" onClick={handleSaveTaxEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {bulkTaxMode && (
        <div className="edit-modal-overlay">
          <div className="edit-modal">
            <h3>Add Deduction</h3>
            <p>This will be added to <strong>{selected.length} selected employees</strong>.</p>

            <div className="edit-modal-field">
              <label>Tax/Deduction Name</label>
              <input
                type="text"
                placeholder="e.g. Bonus, Recovery, etc."
                value={bulkTaxData.label}
                onChange={(e) => setBulkTaxData({ ...bulkTaxData, label: e.target.value })}
              />
            </div>

            <div className="edit-modal-field">
              <label>Amount (₹)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={bulkTaxData.amount !== undefined && bulkTaxData.amount !== null ? bulkTaxData.amount : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setBulkTaxData({ ...bulkTaxData, amount: raw === "" ? "" : Number(raw) });
                }}
                onWheel={(e) => e.target.blur()}
                onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }}
              />
            </div>

            <div className="edit-actions">
              <button className="edit-modal-btn edit-modal-btn--cancel" onClick={() => setBulkTaxMode(false)}>Cancel</button>
              <button className="edit-modal-btn edit-modal-btn--save" onClick={handleBulkAddTax}>Add to Selected</button>
            </div>
          </div>
        </div>
      )}

      {/* LOP Confirmation Modal Popup */}
      {lopConfirmModal && (
        <div className="lop-confirm-modal-overlay">
          <div className="lop-confirm-modal">
            <div className="lop-confirm-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setLopConfirmModal(null)}
                  className="bulk-modal-back-arrow-btn"
                  aria-label="Back"
                  title="Back"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h3 style={{ margin: 0 }}>Loss of Pay (LOP) Confirmation</h3>
                  <p style={{ margin: "4px 0 0" }}>
                    The following employee{lopConfirmModal.employees.length > 1 ? "s have" : " has"} Loss of Pay (LOP) for {monthNames[Number(selectedMonth) - 1]} {selectedYear}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="bulk-modal-btn--close"
                onClick={() => setLopConfirmModal(null)}
                title="Close"
                aria-label="Close"
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <img
                  src="/close.png"
                  alt="Close"
                  style={{ width: "22px", height: "23px", objectFit: "contain" }}
                />
              </button>
            </div>

            <div className="lop-confirm-modal-body">
              <div className="lop-confirm-table-wrapper">
                <table className="lop-confirm-table">
                  <thead>
                    <tr>
                      <th style={{ width: "60px", textAlign: "center" }}>S.No</th>
                      <th style={{ width: "90px" }}>Emp ID</th>
                      <th>Employee Name</th>
                      <th style={{ textAlign: "center", width: "110px" }}>LOP Days</th>
                      <th style={{ textAlign: "right", width: "130px" }}>LOP Amount</th>
                      <th style={{ textAlign: "center", width: "150px" }}>Deduct LOP?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lopConfirmModal.employees.map((emp, idx) => {
                      const empId = String(emp._id);
                      const isDeduct = (lopPopupModes[empId] || "yes") === "yes";
                      return (
                        <tr key={`lop-confirm-${empId}-${idx}`}>
                          <td style={{ textAlign: "center", color: "#64748b", fontWeight: "600" }}>
                            {idx + 1}
                          </td>
                          <td style={{ fontWeight: 600, color: "#475569" }}>
                            {emp.empId || "-"}
                          </td>
                          <td style={{ fontWeight: 600, color: "#1e293b" }}>
                            {emp.name || "-"}
                          </td>
                          <td style={{ textAlign: "center", color: "#374151" }}>
                            {emp.lopDays} {emp.lopDays === 1 ? "day" : "days"}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "600", color: "#374151" }}>
                            ₹{Number(emp.lopAmount || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2
                            })}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div className="lop-confirm-radio-group">
                              <label className={`lop-confirm-radio-label ${isDeduct ? "active" : ""}`}>
                                <input
                                  type="radio"
                                  name={`lop-popup-radio-${empId}`}
                                  value="yes"
                                  checked={isDeduct}
                                  onChange={() => setLopPopupModes((prev) => ({ ...prev, [empId]: "yes" }))}
                                />
                                <span>Yes</span>
                              </label>
                              <label className={`lop-confirm-radio-label ${!isDeduct ? "active" : ""}`}>
                                <input
                                  type="radio"
                                  name={`lop-popup-radio-${empId}`}
                                  value="no"
                                  checked={!isDeduct}
                                  onChange={() => setLopPopupModes((prev) => ({ ...prev, [empId]: "no" }))}
                                />
                                <span>No</span>
                              </label>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lop-confirm-modal-footer" style={{ justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="common-modal-btn btn-update"
                onClick={() => {
                  const ids = lopConfirmModal.ids;
                  setLopConfirmModal(null);
                  callBulkApi(ids, lopPopupModes);
                }}
                disabled={bulkLoading}
              >
                {bulkLoading ? "Generating..." : "Generate Slip"}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

/* ─────────────────────────────────────────────
   MAIN PAYSLIP PAGE
───────────────────────────────────────────── */
const Payslip = () => {
  const { user } = useUser();
  const canGenerateSlips = useMemo(() => canHrGenerateSlips(user), [user]);
  const canDeleteSlips = useMemo(() => canHrDeleteSlips(user), [user]);

  const [loading, setLoading] = useState(false);
  const [slipLoading, setSlipLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [slip, setSlip] = useState(null);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, slipId: null, isBulk: false, count: 0 });
  const [selectedSlips, setSelectedSlips] = useState([]);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [viewingId, setViewingId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

  const now = new Date();
  const defaultPrevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultPrevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [filterMode, setFilterMode] = useState("monthly"); // Default: monthly
  const [appliedFilterMode, setAppliedFilterMode] = useState("monthly");

  const [form, setForm] = useState({
    empId: "",
    month: defaultPrevMonth,
    year: defaultPrevYear,
    regenerate: false,
  });

  const [deductions, setDeductions] = useState([]);

  // Filter State - Default to Previous Month
  const [filters, setFilters] = useState({
    month: defaultPrevMonth.toString(),
    year: defaultPrevYear.toString(),
    fromMonth: "",
    toMonth: "",
    fromYear: "",
    toYear: "",
    empId: "",
    department: "",
    designation: ""
  });

  const [appliedFilters, setAppliedFilters] = useState({
    month: defaultPrevMonth.toString(),
    year: defaultPrevYear.toString(),
    fromMonth: "",
    toMonth: "",
    fromYear: "",
    toYear: "",
    empId: "",
    department: "",
    designation: ""
  });

  const [slipList, setSlipList] = useState([]);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const yearOptions = useMemo(() => {
    const list = [];
    for (let y = 2024; y <= currentYear + 1; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  const monthDropdownOptions = useMemo(() => {
    return [
      ...monthNames.map((m, i) => {
        const monthVal = i + 1;
        const yearVal = Number(filters.year) || currentYear;
        let disabled = false;

        if (yearVal === 2024 && monthVal < 4) disabled = true;
        if (yearVal > currentYear) disabled = true;
        else if (yearVal === currentYear && monthVal > currentMonth) disabled = true;

        return { label: m, value: monthVal.toString(), disabled };
      })
    ];
  }, [filters.year, currentYear, currentMonth]);

  const fromMonthDropdownOptions = useMemo(() => {
    const fromYearVal = Number(filters.fromYear) || 2024;
    return monthNames.map((m, i) => {
      const monthVal = i + 1;
      let disabled = false;
      if (fromYearVal === 2024 && monthVal < 4) disabled = true;
      if (fromYearVal > currentYear) disabled = true;
      else if (fromYearVal === currentYear && monthVal > currentMonth) disabled = true;
      return { label: m, value: monthVal.toString(), disabled };
    });
  }, [filters.fromYear, currentYear, currentMonth]);

  const fromYearDropdownOptions = useMemo(() => {
    return [
      { label: "Year", value: "" },
      ...yearOptions.map(y => ({
        label: y.toString(),
        value: y.toString(),
        disabled: y < 2024 || y > currentYear
      }))
    ];
  }, [yearOptions, currentYear]);

  const toMonthDropdownOptions = useMemo(() => {
    const fromYearVal = Number(filters.fromYear) || 2024;
    const fromMonthVal = Number(filters.fromMonth) || 4;
    const toYearVal = Number(filters.toYear) || fromYearVal;

    return monthNames.map((m, i) => {
      const monthVal = i + 1;
      let disabled = false;
      if (toYearVal === 2024 && monthVal < 4) disabled = true;
      if (toYearVal === fromYearVal && monthVal < fromMonthVal) disabled = true;
      if (toYearVal > currentYear) disabled = true;
      else if (toYearVal === currentYear && monthVal > currentMonth) disabled = true;
      return { label: m, value: monthVal.toString(), disabled };
    });
  }, [filters.fromYear, filters.fromMonth, filters.toYear, currentYear, currentMonth]);

  const toYearDropdownOptions = useMemo(() => {
    const fromYearVal = Number(filters.fromYear) || 2024;
    return [
      { label: "Year", value: "" },
      ...yearOptions.map(y => ({
        label: y.toString(),
        value: y.toString(),
        disabled: y < fromYearVal || y > currentYear
      }))
    ];
  }, [yearOptions, filters.fromYear, currentYear]);

  const yearDropdownOptions = useMemo(() => [
    { label: "Year", value: "" },
    ...yearOptions.map(y => ({
      label: y.toString(),
      value: y.toString(),
      disabled: y < 2024 || y > currentYear
    }))
  ], [yearOptions, currentYear]);

  const handleFromMonthChange = (val) => {
    setFilters(prev => {
      const next = { ...prev, fromMonth: val };
      const fromY = Number(next.fromYear) || 2024;
      const fromM = Number(val) || 4;
      const toY = Number(next.toYear) || fromY;
      const toM = Number(next.toMonth);

      if (!next.toYear) {
        next.toYear = next.fromYear || "2024";
      }

      if (toY < fromY || (toY === fromY && toM && toM < fromM)) {
        next.toMonth = val;
      }
      return next;
    });
  };

  const handleFromYearChange = (val) => {
    setFilters(prev => {
      const next = { ...prev, fromYear: val };
      const fromY = Number(val) || 2024;
      const fromM = Number(next.fromMonth) || 4;
      const toY = Number(next.toYear);
      const toM = Number(next.toMonth);

      if (!next.toYear || toY < fromY) {
        next.toYear = val;
      }
      if (next.toYear === val && toM && toM < fromM) {
        next.toMonth = fromM.toString();
      }
      return next;
    });
  };

  const departmentOptions = useMemo(() => {
    const depts = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort();
    return [
      { label: "All Departments", value: "" },
      ...depts.map(d => ({ label: d, value: d }))
    ];
  }, [employees]);

  const designationOptions = useMemo(() => {
    let list = employees;
    if (filters.department) {
      list = list.filter(e => (e.department || "").toLowerCase() === filters.department.toLowerCase());
    }
    const desgs = Array.from(new Set(list.map(e => e.designation).filter(Boolean))).sort();
    return [
      { label: "All Designations", value: "" },
      ...desgs.map(d => ({ label: d, value: d }))
    ];
  }, [employees, filters.department]);

  const employeeOptions = useMemo(() => {
    let list = employees;
    if (filters.department) {
      list = list.filter(e => (e.department || "").toLowerCase() === filters.department.toLowerCase());
    }
    if (filters.designation) {
      list = list.filter(e => (e.designation || "").toLowerCase() === filters.designation.toLowerCase());
    }
    return [
      { label: "Select Employee", value: "" },
      ...list.map(e => ({
        label: e.name ? (e.empId ? `${e.name} (${e.empId})` : e.name) : (e.empId || "-"),
        value: e._id || e.id
      }))
    ];
  }, [employees, filters.department, filters.designation]);

  const handleDepartmentChange = (val) => {
    setFilters(prev => {
      const next = { ...prev, department: val };
      if (val && prev.designation) {
        const isValidDesg = employees.some(
          e => (e.department || "").toLowerCase() === val.toLowerCase() &&
            (e.designation || "").toLowerCase() === prev.designation.toLowerCase()
        );
        if (!isValidDesg) next.designation = "";
      }
      if (val && prev.empId) {
        const isValidEmp = employees.some(
          e => (e.department || "").toLowerCase() === val.toLowerCase() &&
            String(e._id || e.id) === String(prev.empId)
        );
        if (!isValidEmp) next.empId = "";
      }
      return next;
    });
  };

  const handleDesignationChange = (val) => {
    setFilters(prev => {
      const next = { ...prev, designation: val };
      if (val && prev.empId) {
        const isValidEmp = employees.some(
          e => (e.designation || "").toLowerCase() === val.toLowerCase() &&
            (!prev.department || (e.department || "").toLowerCase() === prev.department.toLowerCase()) &&
            String(e._id || e.id) === String(prev.empId)
        );
        if (!isValidEmp) next.empId = "";
      }
      return next;
    });
  };

  const handlePrevMonth = () => {
    let currentM = Number(appliedFilters.month) || defaultPrevMonth;
    let currentY = Number(appliedFilters.year) || defaultPrevYear;

    let newM = currentM - 1;
    let newY = currentY;
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }

    const updatedFilters = {
      ...filters,
      month: newM.toString(),
      year: newY.toString()
    };
    setFilterMode("monthly");
    setFilters(updatedFilters);
    setAppliedFilterMode("monthly");
    setAppliedFilters(updatedFilters);
    setCurrentPage(1);
    fetchSlipHistory(true, updatedFilters, "monthly");
  };

  const handleNextMonth = () => {
    let currentM = Number(appliedFilters.month) || defaultPrevMonth;
    let currentY = Number(appliedFilters.year) || defaultPrevYear;

    let newM = currentM + 1;
    let newY = currentY;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }

    const updatedFilters = {
      ...filters,
      month: newM.toString(),
      year: newY.toString()
    };
    setFilterMode("monthly");
    setFilters(updatedFilters);
    setAppliedFilterMode("monthly");
    setAppliedFilters(updatedFilters);
    setCurrentPage(1);
    fetchSlipHistory(true, updatedFilters, "monthly");
  };

  const fetchSlipHistory = async (showLoader = true, appliedF = null, appliedMode = null) => {
    if (showLoader) setSlipLoading(true);
    const activeF = appliedF || appliedFilters;
    const activeMode = appliedMode || appliedFilterMode;

    try {
      const params = new URLSearchParams();
      params.append("mode", activeMode);

      if (activeMode === "monthly") {
        if (activeF.month && activeF.month !== "all") params.append("month", activeF.month);
        if (activeF.year) params.append("year", activeF.year);
      } else if (activeMode === "custom") {
        if (activeF.fromMonth) params.append("fromMonth", activeF.fromMonth);
        if (activeF.toMonth) params.append("toMonth", activeF.toMonth);
        if (activeF.fromYear) params.append("fromYear", activeF.fromYear);
        if (activeF.toYear) params.append("toYear", activeF.toYear);
      }

      if (activeF.empId) params.append("empId", activeF.empId);
      if (activeF.department) params.append("department", activeF.department);
      if (activeF.designation) params.append("designation", activeF.designation);

      const res = await portalInstance.get(`/salary-slip/admin/salary-slip-history-all?${params.toString()}`);
      let data = res.data?.data || [];

      setSlipList(data);
      return data;
    } catch (err) {
      console.error("Error fetching slips", err);
      return [];
    } finally {
      if (showLoader) setSlipLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setAppliedFilterMode(filterMode);
    setCurrentPage(1);
    fetchSlipHistory(true, filters, filterMode);
  };

  const handleResetFilters = () => {
    const defaultFilters = {
      month: defaultPrevMonth.toString(),
      year: defaultPrevYear.toString(),
      fromMonth: "",
      toMonth: "",
      fromYear: "",
      toYear: "",
      empId: "",
      department: "",
      designation: ""
    };
    setFilterMode("monthly");
    setFilters(defaultFilters);
    setAppliedFilterMode("monthly");
    setAppliedFilters(defaultFilters);
    setCurrentPage(1);
    fetchSlipHistory(true, defaultFilters, "monthly");
  };

  // Auto-polling effect to update PDF statuses in real time
  useEffect(() => {
    if (!isPolling) return;

    let pollCount = 0;
    const interval = setInterval(async () => {
      pollCount++;
      const currentList = await fetchSlipHistory(false);
      const hasPendingPdfs = currentList.some(s => !s.pdfUrl);

      if (!hasPendingPdfs || pollCount >= 10) {
        setIsPolling(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPolling]);

  useEffect(() => {
    const initialFilters = {
      month: defaultPrevMonth.toString(),
      year: defaultPrevYear.toString(),
      fromMonth: "",
      toMonth: "",
      fromYear: "",
      toYear: "",
      empId: "",
      department: "",
      designation: ""
    };
    fetchSlipHistory(true, initialFilters, "monthly");
  }, []);

  useEffect(() => {
    fetchEmployees(form.month, form.year);
  }, []);

  const fetchEmployees = async (month, year) => {
    try {
      setEmployeesLoading(true);
      const res = await portalInstance.get(
        `/salary-slip/admin/payroll-employees?month=${month}&year=${year}`
      );
      const list = res?.data?.data || [];
      const safeList = Array.isArray(list) ? list : [];
      const sortedList = [...safeList].sort((a, b) =>
        (a.empId || "").localeCompare(b.empId || "", undefined, { numeric: true, sensitivity: "base" })
      );
      setEmployees(sortedList);
      return sortedList; // ✅ Return data so callers don't rely on stale state
    } catch (error) {
      console.error("Error fetching employees:", error);
      return [];
    } finally {
      setEmployeesLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const addDeduction = () => {
    setDeductions((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), label: "", amount: 0 },
    ]);
  };

  const removeDeduction = (id) => {
    setDeductions((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDeduction = (id, key, value) => {
    setDeductions((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, [key]: key === "amount" ? Number(value || 0) : value } : d
      )
    );
  };

  const handleViewSlip = async (slipId) => {
    const slip = slipList.find(s => s._id === slipId);
    if (slip && !slip.pdfUrl) {
      toast.info("Compiling PDF... Please wait a moment while your document is being prepared.");
    }
    try {
      setViewingId(slipId);
      const res = await portalInstance.get(`/salary-slip/admin/download/${slipId}`);

      if (res.data?.success && res.data?.url) {
        window.open(res.data.url, "_blank");
        fetchSlipHistory(false);
      } else {
        toast.error("Payslip URL not found");
      }
    } catch (error) {
      console.error("Failed to view payslip", error);
      toast.error("Failed to open payslip preview");
    } finally {
      setViewingId("");
    }
  };

  const closePdfModal = () => {
    setPdfModalOpen(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
  };

  // Filtered Slips (Ensures accurate client-side filtering matching applied search filters)
  const filteredSlips = useMemo(() => {
    return slipList.filter((s) => {
      if (appliedFilterMode === "monthly") {
        if (appliedFilters.month && appliedFilters.month !== "all" && Number(s.month) !== Number(appliedFilters.month)) {
          return false;
        }
        if (appliedFilters.year && appliedFilters.year !== "all" && Number(s.year) !== Number(appliedFilters.year)) {
          return false;
        }
      } else if (appliedFilterMode === "custom") {
        const fromVal = (Number(appliedFilters.fromYear) || 2024) * 100 + (Number(appliedFilters.fromMonth) || 1);
        const toVal = (Number(appliedFilters.toYear) || 2099) * 100 + (Number(appliedFilters.toMonth) || 12);
        const slipVal = (Number(s.year) || 0) * 100 + (Number(s.month) || 0);
        if (appliedFilters.fromYear && appliedFilters.fromMonth && slipVal < fromVal) return false;
        if (appliedFilters.toYear && appliedFilters.toMonth && slipVal > toVal) return false;
      }

      if (appliedFilters.department && appliedFilters.department !== "all") {
        const sDept = (s.department || s.empId?.department || "").toLowerCase();
        if (sDept !== appliedFilters.department.toLowerCase()) return false;
      }

      if (appliedFilters.designation && appliedFilters.designation !== "all") {
        const sDesg = (s.designation || s.empId?.designation || "").toLowerCase();
        if (sDesg !== appliedFilters.designation.toLowerCase()) return false;
      }

      if (appliedFilters.empId && appliedFilters.empId !== "all") {
        const sId = String(s.empId?._id || s.empId?.id || s.empId || "");
        if (sId !== String(appliedFilters.empId)) return false;
      }

      return true;
    });
  }, [slipList, appliedFilterMode, appliedFilters]);

  // Paginated History Data
  const paginatedSlips = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSlips.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSlips, currentPage]);

  const totalPages = Math.ceil(filteredSlips.length / itemsPerPage);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const isAllSelected = paginatedSlips.length > 0 && paginatedSlips.every((s) => selectedSlips.includes(s._id));

  const handleSelectAllSlips = (e) => {
    if (e.target.checked) {
      const pageIds = paginatedSlips.map((s) => s._id);
      setSelectedSlips((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = new Set(paginatedSlips.map((s) => s._id));
      setSelectedSlips((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleToggleSelectSlip = (id) => {
    setSelectedSlips((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSlip = async () => {
    if (deleteModal.isBulk) {
      if (!selectedSlips.length) return;
      try {
        setLoading(true);
        const res = await portalInstance.post("/salary-slip/admin/delete-multiple-salary-slips", {
          slipIds: selectedSlips,
        });
        if (res.data?.success) {
          toast.success(res.data.message || `Deleted ${selectedSlips.length} salary slip(s) successfully`);
          setDeleteModal({ isOpen: false, slipId: null, isBulk: false, count: 0 });
          setSelectedSlips([]);
          fetchSlipHistory(false);
        }
      } catch (error) {
        console.error("Error bulk deleting slips:", error);
        toast.error(error?.response?.data?.message || "Failed to delete selected salary slips");
      } finally {
        setLoading(false);
      }
      return;
    }

    const slipId = deleteModal.slipId;
    if (!slipId) return;

    try {
      setLoading(true);
      const res = await portalInstance.delete(`/salary-slip/admin/salary-slip/${slipId}`);
      if (res.data?.success) {
        toast.success("Salary Slip deleted successfully");
        setDeleteModal({ isOpen: false, slipId: null, isBulk: false, count: 0 });
        setSlipList((prev) => prev.filter((s) => s._id !== slipId));
        setSelectedSlips((prev) => prev.filter((id) => id !== slipId));
        fetchSlipHistory(false);
      }
    } catch (error) {
      console.error("Error deleting slip:", error);
      toast.error(error?.response?.data?.message || "Failed to delete salary slip");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSlip = async (slipId) => {
    const slip = slipList.find(s => s._id === slipId);
    if (slip && !slip.pdfUrl) {
      toast.info("Compiling PDF... Please wait a moment while your document is being prepared.");
    }
    try {
      setDownloadingId(slipId);
      const res = await portalInstance.get(`/salary-slip/admin/download/${slipId}?download=true`);
      if (res.data?.success && res.data?.url) {
        window.open(res.data.url, "_blank");
        fetchSlipHistory(false);
      } else {
        toast.error("Download URL not found");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error(error?.response?.data?.message || "Failed to download payslip");
    } finally {
      setDownloadingId("");
    }
  };

  const handleDownloadZip = async () => {
    if (!filteredSlips || filteredSlips.length === 0) {
      toast.warn("No payslips to download for the selected filter.");
      return;
    }

    try {
      setZipLoading(true);
      toast.info("Preparing ZIP file, please wait...");

      const zip = new JSZip();
      let addedCount = 0;

      for (let i = 0; i < filteredSlips.length; i++) {
        const slip = filteredSlips[i];
        try {
          const res = await portalInstance.get(`/salary-slip/admin/download/${slip._id}?download=true`);
          const downloadUrl = res.data?.url || slip.pdfUrl;

          if (downloadUrl) {
            const fileRes = await fetch(downloadUrl);
            const blob = await fileRes.blob();
            const mName = monthNames[Number(slip.month) - 1] || slip.month;
            const empNameClean = (slip.employeeName || slip.empCode || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
            const fileName = `${empNameClean}_${mName}_${slip.year}_Payslip.pdf`;
            zip.file(fileName, blob);
            addedCount++;
          }
        } catch (err) {
          console.warn(`Could not add slip ${slip._id} to zip:`, err);
        }
      }

      if (addedCount === 0) {
        toast.error("No payslip PDFs available to download for this selection.");
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const mName = filters.month && filters.month !== "all" ? monthNames[Number(filters.month) - 1] : "";
      const yName = filters.year && filters.year !== "all" ? filters.year : "";
      const zipFileName = `Payslips_${mName ? mName + "_" : ""}${yName ? yName : "All"}.zip`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.setAttribute("download", zipFileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);

      toast.success(`Downloaded ${addedCount} payslip(s) in ${zipFileName}!`);
    } catch (err) {
      console.error("Failed to download ZIP file:", err);
      toast.error(err?.message || "Failed to download ZIP file");
    } finally {
      setZipLoading(false);
    }
  };

  const money = (n) => Number(n || 0).toLocaleString("en-IN");

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-IN");
  };

  const tableRows = useMemo(() => {
    if (!slip?.pdf) return [];
    const earn = slip.pdf.earnings || [];
    const ded = slip.pdf.deductions || [];
    const max = Math.max(earn.length, ded.length);
    return Array.from({ length: max }, (_, i) => ({
      earning: earn[i],
      deduction: ded[i],
    }));
  }, [slip]);

  const hasDeductions = (slip?.pdf?.deductions || []).length > 0;

  return (
    <div className="pay-slip-generator-page">
      <Sidebar />

      <main className="pay-slip-generator-main">
        <div className="pay-slip-generator-wrapper">

          {/* ADMIN CONFIGURATION CARD */}
          <div className="pay-slip-generator-card">
            {/* FILTERS & HISTORY TABLE - Replacing Additional Deductions */}
            <div className="pay-slip-generator-section">
              <div className="payslip-header-bar">
                <div className="payslip-header-title-row">
                  <h4 className="payslip-header-title">Slip History</h4>
                  <div
                    className={`dwu-employee-filter-icon payslip-mobile-filter-icon ${showFilterPanel ? "active" : ""}`}
                    onClick={() => setShowFilterPanel(prev => !prev)}
                    title="Toggle Filters"
                    style={{ cursor: "pointer" }}
                  >
                    <img src="/Filter.svg" alt="filter" />
                  </div>
                </div>

                <div className="payslip-header-actions">
                  {selectedSlips.length > 0 && canDeleteSlips && (
                    <button
                      className="payslip-bulk-delete-btn"
                      type="button"
                      onClick={() => setDeleteModal({ isOpen: true, slipId: null, isBulk: true, count: selectedSlips.length })}
                      title="Delete selected salary slips"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      <span>Delete Selected ({selectedSlips.length})</span>
                    </button>
                  )}

                  {canGenerateSlips && (
                    <button
                      className="common-modal-btn btn-update payslip-header-btn payslip-header-btn--generate"
                      onClick={() => setShowBulkModal(true)}
                      type="button"
                    >
                      Generate Pay Slip
                    </button>
                  )}

                  <button
                    className="common-modal-btn btn-confirm-success payslip-header-btn payslip-header-btn--zip"
                    type="button"
                    onClick={handleDownloadZip}
                    disabled={zipLoading || filteredSlips.length === 0}
                    title="Download filtered payslips as ZIP"
                  >
                    {zipLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: "14px", height: "14px", borderWidth: "2px" }}></span>
                        <span>Downloading ZIP...</span>
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>Download ZIP</span>
                      </>
                    )}
                  </button>

                  <div
                    className={`dwu-employee-filter-icon payslip-desktop-filter-icon ${showFilterPanel ? "active" : ""}`}
                    onClick={() => setShowFilterPanel(prev => !prev)}
                    title="Toggle Filters"
                    style={{ cursor: "pointer" }}
                  >
                    <img src="/Filter.svg" alt="filter" />
                  </div>
                </div>
              </div>

              {showFilterPanel && (
                <div className="payslip-filters animate-slide-down">
                  <div className="payslip-filters-grid">
                    {/* 1. Date Range Mode */}
                    <div className="payslip-filter-field">
                      <label className="payslip-filter-label">Date Range</label>
                      <LocalPayslipDropdown
                        options={[
                          { label: "All Time", value: "all" },
                          { label: "Monthly", value: "monthly" },
                          { label: "Custom Range", value: "custom" }
                        ]}
                        value={filterMode}
                        onChange={(val) => setFilterMode(val)}
                        placeholder="Date Range"
                      />
                    </div>

                    {filterMode === "monthly" && (
                      <>
                        <div className="payslip-filter-field">
                          <label className="payslip-filter-label">Month</label>
                          <LocalPayslipDropdown
                            options={monthDropdownOptions}
                            value={filters.month}
                            onChange={(val) => setFilters({ ...filters, month: val })}
                            placeholder="Month"
                          />
                        </div>
                        <div className="payslip-filter-field">
                          <label className="payslip-filter-label">Year</label>
                          <LocalPayslipDropdown
                            options={yearDropdownOptions}
                            value={filters.year}
                            onChange={(val) => setFilters({ ...filters, year: val })}
                            placeholder="Year"
                          />
                        </div>
                      </>
                    )}

                    {filterMode === "custom" && (
                      <>
                        <div className="payslip-filter-field">
                          <label className="payslip-filter-label">From</label>
                          <div className="payslip-filter-dual-dropdown">
                            <LocalPayslipDropdown
                              options={fromMonthDropdownOptions}
                              value={filters.fromMonth}
                              onChange={handleFromMonthChange}
                              placeholder="Month"
                            />
                            <LocalPayslipDropdown
                              options={fromYearDropdownOptions}
                              value={filters.fromYear}
                              onChange={handleFromYearChange}
                              placeholder="Year"
                            />
                          </div>
                        </div>
                        <div className="payslip-filter-field">
                          <label className="payslip-filter-label">To</label>
                          <div className="payslip-filter-dual-dropdown">
                            <LocalPayslipDropdown
                              options={toMonthDropdownOptions}
                              value={filters.toMonth}
                              onChange={(val) => setFilters({ ...filters, toMonth: val })}
                              placeholder="Month"
                            />
                            <LocalPayslipDropdown
                              options={toYearDropdownOptions}
                              value={filters.toYear}
                              onChange={(val) => setFilters({ ...filters, toYear: val })}
                              placeholder="Year"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* 2. Department */}
                    <div className="payslip-filter-field">
                      <label className="payslip-filter-label">Department</label>
                      <LocalPayslipDropdown
                        options={departmentOptions}
                        value={filters.department}
                        onChange={handleDepartmentChange}
                        placeholder="All Departments"
                      />
                    </div>

                    {/* 3. Designation */}
                    <div className="payslip-filter-field">
                      <label className="payslip-filter-label">Designation</label>
                      <LocalPayslipDropdown
                        options={designationOptions}
                        value={filters.designation}
                        onChange={handleDesignationChange}
                        placeholder="All Designations"
                      />
                    </div>

                    {/* 4. Select Employee */}
                    <div className="payslip-filter-field">
                      <label className="payslip-filter-label">Select Employee</label>
                      <LocalPayslipDropdown
                        options={employeeOptions}
                        value={filters.empId}
                        onChange={(val) => setFilters(prev => ({ ...prev, empId: val }))}
                        placeholder="Select Employee"
                      />
                    </div>
                  </div>

                  <div className="payslip-filter-actions">
                    <button
                      type="button"
                      className="hrms-common-btn-cancel"
                      onClick={handleResetFilters}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="hrms-common-btn-primary"
                      onClick={handleApplyFilters}
                      disabled={slipLoading}
                    >
                      Search
                    </button>
                  </div>
                </div>
              )}

              {slipLoading ? (
                <div className="payslip-table-loading" style={{ textAlign: "center", width: "100%", padding: "50px 0" }}>
                  <div
                    className="spinner-border text-primary"
                    role="status"
                    style={{
                      width: "2.2rem",
                      height: "2.2rem",
                      borderWidth: "3px",
                      display: "inline-block",
                      marginBottom: "10px",
                    }}
                  >
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "14px", color: "#6c757d", fontWeight: 500 }}>
                    Loading salary slips...
                  </p>
                </div>
              ) : filteredSlips.length > 0 ? (
                <>
                  <div className="pay-slip-generator-table-wrapper">
                    <table className="payslip-table-main">
                      <thead className="payslip-table-header">
                        <tr>
                          {canDeleteSlips && (
                            <th className="payslip-table-header-cell text-center" style={{ width: "45px", padding: "8px 10px" }}>
                              <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={handleSelectAllSlips}
                                style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "#4f46e5" }}
                                title="Select All"
                              />
                            </th>
                          )}
                          <th className="payslip-table-header-cell">S.No</th>
                          <th className="payslip-table-header-cell">Employee</th>
                          <th className="payslip-table-header-cell">Month</th>
                          <th className="payslip-table-header-cell">Year</th>
                          <th className="payslip-table-header-cell">Net Pay</th>
                          <th className="payslip-table-header-cell">Generated On</th>
                          <th className="payslip-table-header-cell text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSlips.map((row, index) => (
                          <tr key={row._id} className="payslip-table-row">
                            {canDeleteSlips && (
                              <td className="payslip-table-cell text-center" style={{ width: "45px", padding: "8px 10px" }}>
                                <input
                                  type="checkbox"
                                  checked={selectedSlips.includes(row._id)}
                                  onChange={() => handleToggleSelectSlip(row._id)}
                                  style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "#4f46e5" }}
                                />
                              </td>
                            )}
                            <td className="payslip-table-cell payslip-table-cell--muted">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                            <td className="payslip-table-cell payslip-table-cell--bold">{row.employeeName || row.empCode || "-"}</td>
                            <td className="payslip-table-cell payslip-table-cell--muted">{monthNames[row.month - 1]}</td>
                            <td className="payslip-table-cell payslip-table-cell--muted">{row.year}</td>
                            <td className="payslip-table-cell payslip-table-cell--bold">₹{Number(row.netPay).toLocaleString("en-IN")}</td>
                            <td className="payslip-table-cell payslip-table-cell--muted">{new Date(row.generatedAt || row.createdAt).toLocaleDateString("en-IN")}</td>
                            <td className="payslip-table-cell">
                              <div className="payslip-row-actions-group">
                                <button
                                  className="payslip-btn payslip-btn-view"
                                  onClick={() => handleViewSlip(row._id)}
                                  disabled={viewingId === row._id}
                                  title={!row.pdfUrl ? "PDF is compiling. Click to open or retry..." : "View Payslip"}
                                >
                                  {viewingId === row._id ? "Opening..." : !row.pdfUrl ? "Preparing..." : "View"}
                                </button>
                                <button
                                  className="payslip-btn payslip-btn-download"
                                  onClick={() => handleDownloadSlip(row._id)}
                                  disabled={downloadingId === row._id}
                                  title={!row.pdfUrl ? "PDF is compiling. Click to download or retry..." : "Download Payslip"}
                                >
                                  {downloadingId === row._id ? "Downloading..." : !row.pdfUrl ? "Preparing..." : "Download"}
                                </button>
                                {canDeleteSlips && (
                                  <button
                                    className="payslip-btn payslip-btn-delete"
                                    onClick={() => setDeleteModal({ isOpen: true, slipId: row._id, isBulk: false, count: 1 })}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="payslip-pagination-wrapper" style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", marginTop: "20px" }}>
                    <Pagination
                      totalItems={filteredSlips.length}
                      pageSize={itemsPerPage}
                      currentPage={currentPage}
                      onPageChange={handlePageChange}
                    />
                  </div>
                </>
              ) : (
                <p className="payslip-no-history" style={{ textAlign: "center", width: "100%", padding: "20px 0" }}>No slip history found.</p>
              )}
            </div>


          </div>

          {/* PDF PREVIEW MODAL */}
          {pdfModalOpen && (
            <div className="salary-slip-modal-overlay">
              <div className="salary-slip-modal-box">
                <div className="salary-slip-modal-header">
                  <h3>Payslip Preview</h3>
                  <button className="salary-slip-modal-close" onClick={closePdfModal}>×</button>
                </div>
                <iframe
                  src={pdfUrl}
                  title="Payslip PDF"
                  className="salary-slip-pdf-frame"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* NEW: Bulk Payslip Modal — rendered as portal at page root */}
      {showBulkModal && (
        <BulkPayslipModal
          onClose={() => setShowBulkModal(false)}
          onGenerated={(empId, m, y) => {
            setShowBulkModal(false);
            if (m && y) {
              const updated = { ...filters, month: m.toString(), year: y.toString() };
              setFilters(updated);
              setAppliedFilters(updated);
              setAppliedFilterMode("monthly");
              fetchSlipHistory(true, updated, "monthly");
            } else {
              fetchSlipHistory(true, appliedFilters, appliedFilterMode);
            }
            setIsPolling(true);
          }}
          employees={employees}
          form={form}
          fetchEmployees={fetchEmployees}
        />
      )}

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, slipId: null, isBulk: false, count: 0 })}
        onConfirm={handleDeleteSlip}
        loading={loading}
        count={deleteModal.count}
        isBulk={deleteModal.isBulk}
      />

      <ToastContainer />
    </div>
  );
};

export default Payslip;
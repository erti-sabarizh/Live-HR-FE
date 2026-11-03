import React, { useEffect, useState, useMemo } from "react";
import LetterTemplateEditor from "./LetterTemplateEditor";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { portalInstance } from "../../../Services/instance";
import { toast, ToastContainer } from "react-toastify";
import { Icon } from "@iconify/react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useUser } from "../../UserContext";
import "./IncrementLetter.css";
import "../../Common/CustomDropdown.css";
import CustomDropdown from "../../Common/CustomDropdown";
import Pagination from "../../Employee/Pagination/Pagination";
import "../../Employee/Pagination/Pagination.css";

// ─── Indian Currency Number Formatting Helpers ────────────────────────────────
const formatIndianNumber = (val) => {
  if (val === null || val === undefined || val === "") return "";
  const str = String(val).replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!str) return "";
  const parts = str.split(".");
  const intPart = parts[0];
  const decPart = parts.length > 1 ? "." + parts[1] : "";
  if (!intPart) return decPart ? "0" + decPart : "";
  const formattedInt = Number(intPart).toLocaleString("en-IN");
  return formattedInt + decPart;
};

const parseRawNumber = (val) => {
  if (!val) return "";
  return String(val).replace(/,/g, "").replace(/[^\d.]/g, "");
};

// ─── HELPER ──────────────────────────────────────────────────────────────────
const fmtDate = (dateStr) => {
  if (!dateStr || dateStr === "—") return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const getHtmlBlocks = (htmlStr) => {
  if (!htmlStr || !htmlStr.trim()) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlStr, 'text/html');
  const children = Array.from(doc.body.children);
  if (children.length > 0) {
    return children.map(c => c.outerHTML);
  }
  return htmlStr.split('\n\n').filter(p => p.trim()).map(p => `<p>${p}</p>`);
};

const compileTemplateToHtml = (templateStr, data, isTemplatePreview = false) => {
  if (!templateStr) return "";
  let res = templateStr;
  res = res
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

  // When previewing the template directly, keep placeholders as-is
  if (isTemplatePreview) {
    if (!res.trim().startsWith('<')) {
      res = res.replace(/\n/g, '<br />');
    }
    return res;
  }

  // Strip any <p> wrapper TipTap places around {allowancesTable} to prevent
  // invalid nested HTML (<p><table>…</table></p>) which pushes the table to the next page
  res = res.replace(/<p[^>]*>\s*\{allowancesTable\}\s*<\/p>/gi, "{allowancesTable}");


  const formattedIssueDate = fmtDate(data.dateOfIssue);
  const rawPrevSalary = String(data.previousSalary || 0).replace(/,/g, "");
  const rawNewSalary = String(data.newSalary || 0).replace(/,/g, "");
  const formattedPrevSalary = parseFloat(rawPrevSalary || 0).toLocaleString("en-IN");
  const formattedNewSalary = parseFloat(rawNewSalary || 0).toLocaleString("en-IN");

  // Sum of allowances for Gross Monthly Salary
  let grossSalary = 0;
  if (Array.isArray(data.allowances)) {
    data.allowances.forEach((al) => {
      const rawAlAmt = String(al?.amount || 0).replace(/,/g, "");
      grossSalary += parseFloat(rawAlAmt || 0);
    });
  }
  const formattedGrossSalary = grossSalary.toLocaleString("en-IN");

  // Calculate increment amount: newSalary - previousSalary
  const incrementAmt = Math.max(0, parseFloat(rawNewSalary || 0) - parseFloat(rawPrevSalary || 0));
  const formattedIncrementAmt = `₹ ${incrementAmt.toLocaleString("en-IN")}`;

  let tableFontSize = data.tableFontSize || "11px";
  const fontSizeMatch = res.match(/(?:font-size:\s*([\d.]+px)[^"'>]*>[^<]*)\{allowancesTable\}/i) ||
                        res.match(/<[^>]*style="[^"]*font-size:\s*([\d.]+px)[^"]*"[^>]*>\s*\{allowancesTable\}/i) ||
                        res.match(/\{allowancesTable:([\d.]+px)\}/i);
  if (fontSizeMatch && fontSizeMatch[1]) {
    tableFontSize = fontSizeMatch[1];
  }

  // Compile Allowances Table matching user image exactly
  let allowancesTableHtml = "";
  if (Array.isArray(data.allowances) && data.allowances.length > 0) {
    allowancesTableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; border: 1px solid #cbd5e1; text-align: center; font-family: sans-serif; font-size: ${tableFontSize}; background-color: #ffffff;">
        <thead>
          <tr style="border-bottom: 1px solid #cbd5e1; background-color: #f8fafc;">
            <th style="padding: 7px 8px; font-weight: 700; color: #000000; border: 1px solid #cbd5e1; text-align: center; width: 60%; font-size: ${tableFontSize}; background-color: #f8fafc;">Component</th>
            <th style="padding: 7px 8px; font-weight: 700; color: #000000; border: 1px solid #cbd5e1; text-align: center; width: 40%; font-size: ${tableFontSize}; background-color: #f8fafc;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody style="background-color: #ffffff;">
    `;
    data.allowances.forEach((al) => {
      if (al && al.label) {
        const rawAmt = String(al?.amount || 0).replace(/,/g, "");
        const amt = parseFloat(rawAmt || 0).toLocaleString("en-IN");
        allowancesTableHtml += `
          <tr style="border-bottom: 1px solid #cbd5e1; background-color: #ffffff;">
            <td style="padding: 6px 8px; color: #000000; border: 1px solid #cbd5e1; text-align: center; font-size: ${tableFontSize}; background-color: #ffffff;">${al.label}</td>
            <td style="padding: 6px 8px; color: #000000; border: 1px solid #cbd5e1; text-align: center; font-size: ${tableFontSize}; background-color: #ffffff;">₹ ${amt}</td>
          </tr>
        `;
      }
    });
    allowancesTableHtml += `
          <tr style="font-weight: bold; background-color: #ffffff; border-top: 1px solid #cbd5e1;">
            <td style="padding: 6px 8px; color: #000000; border: 1px solid #cbd5e1; text-align: center; font-size: ${tableFontSize}; background-color: #ffffff;">Gross Monthly Salary</td>
            <td style="padding: 6px 8px; color: #000000; border: 1px solid #cbd5e1; text-align: center; font-size: ${tableFontSize}; background-color: #ffffff;">₹ ${formattedGrossSalary}</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  const values = {
    "{employeeName}": data.employeeName || "—",
    "{designation}": data.designation || "—",
    "{department}": data.department || "—",
    "{dateOfIssue}": formattedIssueDate,
    "{effectiveFrom}": data.effectiveFrom || "—",
    "{previousSalary}": `₹ ${formattedPrevSalary}/-`,
    "{incrementPercentage}": data.incrementPercentage || "—",
    "{newSalary}": `₹ ${formattedNewSalary}/-`,
    "{incrementAmount}": formattedIncrementAmt,
    "{allowancesTable}": allowancesTableHtml || "<i>No allowances specified.</i>",
  };

  Object.entries(values).forEach(([placeholder, val]) => {
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    res = res.replace(regex, val);
  });

  // Convert newlines to break tags (skip if content is already HTML)
  if (!res.trim().startsWith('<')) {
    res = res.replace(/\n/g, '<br />');
  }

  return res;
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const IncrementLetter = () => {
  const { user } = useUser();

  // Tab & letter type
  const [activeTab, setActiveTab] = useState("generate");
  const [letterType] = useState("increment");

  // Custom template editor state
  const [editingTemplateType, setEditingTemplateType] = useState(null);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [templateTexts, setTemplateTexts] = useState({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // History table states
  const [historyList, setHistoryList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCreateSlipModal, setShowCreateSlipModal] = useState(false);
  const [showSelectEmployeeModal, setShowSelectEmployeeModal] = useState(false);
  const [empSearchTerm, setEmpSearchTerm] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("");
  const [showDeptFilterPopover, setShowDeptFilterPopover] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [letterToDelete, setLetterToDelete] = useState(null);
  const [isDeletingLetter, setIsDeletingLetter] = useState(false);

  // Inline edit state for preview popup
  const [inlineHasChanges, setInlineHasChanges] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [isGenerateMode, setIsGenerateMode] = useState(false);
  const generatingPDFRef = React.useRef(false);
  const previewRef = React.useRef(null);
  const inlineEditRef = React.useRef(null);

  // ── Multi-employee queue ──────────────────────────────────────────
  const [employeeQueue, setEmployeeQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);

  // Reset filter popovers and dropdown states when any modal opens/closes
  useEffect(() => {
    setShowDeptFilterPopover(false);
  }, [showSelectEmployeeModal, showCreateSlipModal, showPreviewModal]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".filter-popover-container") && !e.target.closest(".custom-dropdown-container")) {
        setShowDeptFilterPopover(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  // Form Data
  const [formData, setFormData] = useState({
    employeeName: "",
    designation: "",
    department: "",
    dateOfIssue: new Date().toISOString().slice(0, 10),
    effectiveFrom: "",
    signatoryName: "Jayaprakash. R",
    signatoryTitle: "Director",
    previousSalary: "",
    newSalary: "",
    incrementPercentage: "",
    tableFontSize: "11px",
    allowances: [{ label: "Basic Salary", amount: "" }],
  });

  const effectiveFromPickerRef = React.useRef(null);

  const formatSelectedDateToText = (dateStr) => {
    if (!dateStr) return "";
    const [yr, mo, dy] = dateStr.split("-");
    if (!yr || !mo || !dy) return dateStr;
    const dateObj = new Date(parseInt(yr), parseInt(mo) - 1, parseInt(dy));
    const dayNum = parseInt(dy, 10);

    let suffix = "th";
    if (dayNum % 10 === 1 && dayNum % 100 !== 11) suffix = "st";
    else if (dayNum % 10 === 2 && dayNum % 100 !== 12) suffix = "nd";
    else if (dayNum % 10 === 3 && dayNum % 100 !== 13) suffix = "rd";

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[dateObj.getMonth()];

    return `${dayNum}${suffix} ${monthName} ${yr}`;
  };

  const handleEffectiveFromDatePick = (e) => {
    const rawVal = e.target.value;
    if (rawVal) {
      const formatted = formatSelectedDateToText(rawVal);
      setFormData((prev) => ({ ...prev, effectiveFrom: formatted }));
    }
  };

  const openEffectiveFromDatePicker = () => {
    if (effectiveFromPickerRef.current) {
      if (typeof effectiveFromPickerRef.current.showPicker === "function") {
        effectiveFromPickerRef.current.showPicker();
      } else {
        effectiveFromPickerRef.current.click();
      }
    }
  };

  // Check authorization: Admin, HR, or employees with menu permission
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    if (user.role === "admin" || user.isHr === true) return true;
    const clean = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return (user.permissions || []).some((p) => {
      if (!p || p.permission === "NO_ACCESS") return false;
      const mod = clean(p.module);
      const sub = clean(p.subMenu);
      if (mod.includes("slip") || mod.includes("letter")) {
        if (!sub || sub === "" || sub.includes("entiremenu") || sub.includes("increment")) {
          return true;
        }
      }
      return false;
    });
  }, [user]);

  // Load template from backend
  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await portalInstance.get("/appointment/letter/templates");
      if (res.data?.success && res.data?.data) {
        setTemplateTexts(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
      toast.error("Failed to load templates.");
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Load generated increment letters history list
  const fetchHistory = async (page = 1, limit = 50) => {
    try {
      setLoadingHistory(true);
      const res = await portalInstance.get(`/appointment/letter/history?type=increment&page=${page}&limit=${limit}`);
      if (res.data?.success && res.data?.data) {
        setHistoryList(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch letters history:", err);
      toast.error("Failed to load increment letters history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch employee list for Increment Letter from dedicated LetterController endpoint
  const fetchEmployeesList = async () => {
    try {
      let res = await portalInstance.get("/appointment/letter/employees");
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setEmployeesList(res.data.data);
      } else {
        res = await portalInstance.get("/salary-slip/admin/payroll-employees");
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setEmployeesList(res.data.data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch employees for letter generation:", err);
    }
  };

  useEffect(() => {
    fetchHistory(1, 50);
    fetchTemplates();
    fetchEmployeesList();
  }, []);

  useEffect(() => {
    if (activeTab === "generate") {
      fetchHistory(1, 50);
    }
  }, [activeTab]);

  // Extract unique departments for Department filter
  const uniqueDepartments = useMemo(() => {
    if (!Array.isArray(employeesList)) return [];
    const depts = employeesList
      .map((e) => e.department || e.dept || "")
      .filter((d) => d && typeof d === "string" && d.trim() !== "")
      .map((d) => d.trim());
    return Array.from(new Set(depts));
  }, [employeesList]);

  // Filtered employees for Select Employee popup table
  const filteredSelectableEmployees = useMemo(() => {
    if (!Array.isArray(employeesList)) return [];
    const list = employeesList.filter((emp) => {
      // Role check: Only show employees with role === 'employee' (exclude admins)
      if (emp.role && emp.role.toLowerCase() !== "employee") {
        return false;
      }

      // Department filter check
      if (selectedDeptFilter && selectedDeptFilter.trim()) {
        const empDept = (emp.department || emp.dept || "").trim().toLowerCase();
        const targetDept = selectedDeptFilter.trim().toLowerCase();
        if (empDept !== targetDept) return false;
      }

      // Search term check (Name, empId, Email, Department, Designation)
      if (empSearchTerm && empSearchTerm.trim()) {
        const term = empSearchTerm.toLowerCase().trim();
        const name = (emp.name || emp.employeeName || "").toLowerCase();
        const empId = (emp.empId || emp.employeeId || emp._id || "").toString().toLowerCase();
        const email = (emp.email || "").toLowerCase();
        const dept = (emp.department || "").toLowerCase();
        const desig = (emp.designation || "").toLowerCase();

        const isMatch =
          name.includes(term) ||
          empId.includes(term) ||
          email.includes(term) ||
          dept.includes(term) ||
          desig.includes(term);

        if (!isMatch) return false;
      }
      return true;
    });
    return list.slice(0, 100);
  }, [employeesList, selectedDeptFilter, empSearchTerm]);

  // Toggle selection for an individual employee
  const handleToggleEmployee = (emp) => {
    setSelectedEmployees((prev) => {
      const empKey = emp._id || emp.empId;
      const exists = prev.some((e) => (e._id || e.empId) === empKey);
      if (exists) {
        return prev.filter((e) => (e._id || e.empId) !== empKey);
      } else {
        return [...prev, emp];
      }
    });
  };

  // Select all or deselect all visible filtered employees
  const handleToggleSelectAll = () => {
    if (!filteredSelectableEmployees || filteredSelectableEmployees.length === 0) return;
    const allSelected = filteredSelectableEmployees.every((emp) =>
      selectedEmployees.some((e) => (e._id || e.empId) === (emp._id || emp.empId))
    );
    if (allSelected) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees([...filteredSelectableEmployees]);
    }
  };

  // Proceed from Select Employee modal to Creation Form
  const handleProceedWithSelectedEmployees = () => {
    if (!selectedEmployees || selectedEmployees.length === 0) {
      toast.error("Please select at least one employee.");
      return;
    }

    // Build the queue of form data for each selected employee
    const initialQueue = selectedEmployees.map((emp) => {
      const activeSal = emp.basicSalary || emp.previousSalary || "";
      return {
        empId: emp.empId || emp._id,
        employeeName: emp.employeeName || emp.name || "",
        designation: emp.designation || "",
        department: emp.department || "",
        dateOfIssue: new Date().toISOString().slice(0, 10),
        effectiveFrom: "",
        signatoryName: "Jayaprakash. R",
        signatoryTitle: "Director",
        previousSalary: activeSal ? String(activeSal) : "",
        newSalary: "",
        incrementPercentage: "",
        tableFontSize: "11px",
        allowances: [{ label: "Basic Salary", amount: "" }],
      };
    });

    setEmployeeQueue(initialQueue);
    setCurrentQueueIndex(0);
    setFormData(initialQueue[0]);

    setShowSelectEmployeeModal(false);
    setShowDeptFilterPopover(false);
    setShowCreateSlipModal(true);
  };

  // Filtering by search term
  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return historyList;
    const term = searchTerm.toLowerCase();
    return historyList.filter(
      (letter) =>
        letter.employeeName?.toLowerCase().includes(term) ||
        letter.designation?.toLowerCase().includes(term)
    );
  }, [historyList, searchTerm]);

  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredHistory.length, totalPages, currentPage]);

  const currentItems = useMemo(() => {
    const offset = (currentPage - 1) * pageSize;
    return filteredHistory.slice(offset, offset + pageSize);
  }, [filteredHistory, currentPage, pageSize]);

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!letterToDelete) return;
    setIsDeletingLetter(true);
    try {
      await portalInstance.delete(`/appointment/letter/delete/${letterToDelete._id}`);
      toast.success("Letter deleted successfully.");
      setShowDeleteModal(false);
      setLetterToDelete(null);
      fetchHistory();
    } catch (err) {
      console.error("Failed to delete letter:", err);
      toast.error("Failed to delete letter.");
    } finally {
      setIsDeletingLetter(false);
    }
  };

  // Handle Input Changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle Employee Name Change with active salary auto-fill from EmployeeDetails
  const handleEmployeeNameChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => {
      const updated = { ...prev, employeeName: val };
      if (employeesList && employeesList.length > 0) {
        const found = employeesList.find(
          (emp) =>
            ((emp.employeeName || emp.name || "").toLowerCase() === val.trim().toLowerCase()) ||
            ((emp.empId || emp.employeeId || emp._id || "").toString().toLowerCase() === val.trim().toLowerCase())
        );
        if (found) {
          setSelectedEmployee(found);
          updated.employeeName = found.employeeName || found.name || val;
          updated.designation = found.designation || prev.designation || "";
          updated.department = found.department || prev.department || "";

          // Auto-fill active salary from backend response (basicSalary / totalSalary / salary / salaryHistory)
          let activeSal =
            found.basicSalary ||
            found.totalSalary ||
            found.salary;

          if (!activeSal && Array.isArray(found.salaryHistory) && found.salaryHistory.length > 0) {
            const sortedHistory = [...found.salaryHistory].sort(
              (a, b) => new Date(b.fromDate || b.addedAt || 0) - new Date(a.fromDate || a.addedAt || 0)
            );
            const latest = sortedHistory[0];
            activeSal = latest?.basicSalary || latest?.totalSalary || latest?.salary || "";
          }

          if (activeSal !== undefined && activeSal !== null && activeSal !== "") {
            updated.previousSalary = String(activeSal);
          }
        } else {
          setSelectedEmployee(null);
        }
      } else {
        setSelectedEmployee(null);
      }
      return updated;
    });
  };

  // Handle salary inputs with raw number parsing & 50% Basic Salary auto-calculation
  const handleSalaryInputChange = (e) => {
    const { name, value } = e.target;
    const rawNum = parseRawNumber(value);

    setFormData((prev) => {
      const updated = { ...prev, [name]: rawNum };

      if (name === "newSalary") {
        const newSalVal = parseFloat(rawNum || 0);
        const autoBasic = newSalVal > 0 ? String(Math.round(newSalVal * 0.5)) : "";

        let copyAllowances = [...(prev.allowances || [])];
        if (copyAllowances.length === 0) {
          copyAllowances = [{ label: "Basic Salary", amount: autoBasic }];
        } else {
          const basicIdx = copyAllowances.findIndex(
            (a) => (a.label || "").toLowerCase().trim() === "basic salary"
          );
          if (basicIdx !== -1) {
            copyAllowances[basicIdx] = { ...copyAllowances[basicIdx], amount: autoBasic };
          } else {
            copyAllowances[0] = { ...copyAllowances[0], label: "Basic Salary", amount: autoBasic };
          }
        }
        updated.allowances = copyAllowances;

        const prevSalNum = parseFloat(prev.previousSalary || 0);
        if (prevSalNum > 0 && newSalVal > 0) {
          const pct = Math.round(((newSalVal - prevSalNum) / prevSalNum) * 100);
          updated.incrementPercentage = `${pct}%`;
        }
      }

      return updated;
    });
  };

  // Calculate total allowances and remaining tally amount
  const totalAllowancesAmount = useMemo(() => {
    if (!Array.isArray(formData.allowances)) return 0;
    return formData.allowances.reduce(
      (sum, a) => sum + (parseFloat(a.amount || 0) || 0),
      0
    );
  }, [formData.allowances]);

  const newSalaryNum = useMemo(() => {
    return parseFloat(formData.newSalary || 0) || 0;
  }, [formData.newSalary]);

  const remainingAllowanceAmount = useMemo(() => {
    return newSalaryNum - totalAllowancesAmount;
  }, [newSalaryNum, totalAllowancesAmount]);

  // Allowance handlers
  const handleAllowanceChange = (index, field, value) => {
    setFormData((prev) => {
      const copy = [...prev.allowances];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, allowances: copy };
    });
  };

  const handleAllowanceAmountChange = (index, value) => {
    const rawNum = parseRawNumber(value);
    handleAllowanceChange(index, "amount", rawNum);
  };

  const addAllowanceRow = () => {
    setFormData((prev) => ({
      ...prev,
      allowances: [...prev.allowances, { label: "", amount: "" }],
    }));
  };

  const deleteAllowanceRow = (index) => {
    setFormData((prev) => {
      const copy = prev.allowances.filter((_, idx) => idx !== index);
      return { ...prev, allowances: copy };
    });
  };

  // Template editor handlers
  const handleSaveTemplate = async ({ subject, html } = {}) => {
    try {
      let cleanHtml = html;
      if (cleanHtml === "<p></p>" || cleanHtml === "<p><br></p>" || cleanHtml?.trim() === "") {
        cleanHtml = "";
      }
      const payload = {
        letterType: "increment",
        subject,
        html: cleanHtml,
      };
      const res = await portalInstance.put("/appointment/letter/templates", payload);
      if (res.data?.success) {
        setTemplateTexts((prev) => ({
          ...prev,
          increment: {
            ...prev.increment,
            subject,
            html: cleanHtml,
            customHtml: cleanHtml,
            isCustomized: true,
          },
        }));
        setEditingTemplateType(null);
        toast.success("Custom template saved successfully!");
      }
    } catch (err) {
      console.error("Failed to save template:", err);
      toast.error(err.response?.data?.message || "Failed to save template.");
    }
  };

  const handleEditorPreview = ({ subject, html } = {}) => {
    setTemplateTexts((prev) => ({
      ...prev,
      increment: {
        ...prev.increment,
        subject: subject || prev.increment?.subject,
        html,
      },
    }));
    setIsGenerateMode(false);
    setShowPreviewModal(true);
  };

  const handleResetTemplate = async () => {
    try {
      let tData = null;
      try {
        const res = await portalInstance.post("/appointment/letter/templates/reset", {
          letterType: "increment",
        });
        if (res.data?.success && res.data?.data) {
          tData = res.data.data;
        }
      } catch (postErr) {
        if (postErr?.response?.status === 404) {
          const defaultHtml = templateTexts?.increment?.defaultHtml || DEFAULT_INCREMENT_TEMPLATE;
          const putRes = await portalInstance.put("/appointment/letter/templates", {
            letterType: "increment",
            html: defaultHtml,
            isDefault: false,
            reset: true
          });
          if (putRes.data?.success) {
            tData = {
              ...putRes.data.data,
              letterType: "increment",
              defaultHtml: defaultHtml,
              html: defaultHtml,
              isCustomized: false,
              isDefault: true
            };
          }
        } else {
          throw postErr;
        }
      }

      if (tData) {
        const defaultHtml = tData.defaultHtml || tData.html || DEFAULT_INCREMENT_TEMPLATE;
        setTemplateTexts((prev) => ({
          ...prev,
          increment: {
            ...prev.increment,
            subject: tData.subject || "",
            html: defaultHtml,
            customHtml: "",
            isCustomized: false,
          },
        }));
        setEditorResetKey((k) => k + 1);
        toast.success("Reset to original default template successfully!");
        return tData;
      }
    } catch (err) {
      console.error("Failed to reset template:", err);
      toast.error("Failed to reset template to default.");
    }
  };

  const handleClosePreviewModal = () => {
    setShowPreviewModal(false);
    setInlineHasChanges(false);
    setPreviewHtml(null);
    setIsGenerateMode(false);
  };

  const validateSingleFormData = (data) => {
    const name = (data.employeeName || "").trim();
    if (!name) {
      toast.error("Please enter the employee name.");
      return false;
    }
    if (name.length > 100) {
      toast.error("Employee name must not exceed 100 characters.");
      return false;
    }
    if (!data.dateOfIssue) {
      toast.error(`Please select the Increment Effective Date for ${data.employeeName || "employee"}.`);
      return false;
    }
    if (!data.effectiveFrom || !data.effectiveFrom.trim()) {
      toast.error(`Please select the Effective From date for ${data.employeeName || "employee"}.`);
      return false;
    }

    const prevSalRaw = String(data.previousSalary || "").replace(/,/g, "").trim();
    const prevSalNum = parseFloat(prevSalRaw);
    if (isNaN(prevSalNum) || prevSalNum <= 0) {
      toast.error(`Please enter a valid positive previous salary for ${data.employeeName || "employee"}.`);
      return false;
    }

    const newSalRaw = String(data.newSalary || "").replace(/,/g, "").trim();
    const newSalNum = parseFloat(newSalRaw);
    if (isNaN(newSalNum) || newSalNum <= 0) {
      toast.error(`Please enter a valid positive new salary for ${data.employeeName || "employee"}.`);
      return false;
    }

    if (!data.incrementPercentage || !data.incrementPercentage.toString().trim()) {
      toast.error(`Please enter increment percentage for ${data.employeeName || "employee"}.`);
      return false;
    }

    const pctNum = parseFloat(String(data.incrementPercentage || "").replace(/[^0-9.]/g, "")) || 0;
    if (pctNum > 0 && newSalNum <= prevSalNum) {
      toast.error(`New Salary (₹${newSalNum.toLocaleString("en-IN")}) must be greater than Previous Salary (₹${prevSalNum.toLocaleString("en-IN")}) for ${data.employeeName}.`);
      return false;
    }

    // Tally Validation: Allowance Breakdown total must equal New Salary
    const totalAllowances = (data.allowances || []).reduce(
      (sum, a) => sum + (parseFloat(String(a.amount || 0).replace(/,/g, "")) || 0),
      0
    );

    if (newSalNum > 0 && Math.abs(totalAllowances - newSalNum) > 0.01) {
      const diff = newSalNum - totalAllowances;
      if (diff > 0) {
        toast.error(`Allowance breakdown total (₹${totalAllowances.toLocaleString("en-IN")}) for ${data.employeeName} is less than New Salary (₹${newSalNum.toLocaleString("en-IN")}). Remaining: ₹${diff.toLocaleString("en-IN")}`);
      } else {
        toast.error(`Allowance breakdown total (₹${totalAllowances.toLocaleString("en-IN")}) for ${data.employeeName} exceeds New Salary (₹${newSalNum.toLocaleString("en-IN")}) by ₹${Math.abs(diff).toLocaleString("en-IN")}`);
      }
      return false;
    }

    return true;
  };

  const handlePreviousEmployeeForm = () => {
    if (currentQueueIndex > 0) {
      const updatedQueue = [...employeeQueue];
      updatedQueue[currentQueueIndex] = formData;
      setEmployeeQueue(updatedQueue);

      const prevIdx = currentQueueIndex - 1;
      setCurrentQueueIndex(prevIdx);
      setFormData(updatedQueue[prevIdx]);
    }
  };

  const handleNextEmployeeForm = () => {
    if (!validateSingleFormData(formData)) return;

    const updatedQueue = [...employeeQueue];
    updatedQueue[currentQueueIndex] = formData;
    setEmployeeQueue(updatedQueue);

    const nextIdx = currentQueueIndex + 1;
    if (nextIdx < updatedQueue.length) {
      setCurrentQueueIndex(nextIdx);
      setFormData(updatedQueue[nextIdx]);
    }
  };

  const handleConfirmAllFormDetails = () => {
    if (!validateSingleFormData(formData)) return;

    const updatedQueue = [...employeeQueue];
    if (updatedQueue.length > 0) {
      updatedQueue[currentQueueIndex] = formData;
      setEmployeeQueue(updatedQueue);
    }

    setShowCreateSlipModal(false);
    setIsGenerateMode(true);
    setShowPreviewModal(true);
  };

  const handleSaveInlineEdit = () => {
    if (!inlineEditRef.current) return;
    const editedHtml = inlineEditRef.current.innerHTML;
    setTemplateTexts((prev) => ({
      ...prev,
      increment: { ...prev.increment, html: editedHtml },
    }));
    setInlineHasChanges(false);
    toast.success("Changes saved! Click \"Generate Letter\" to create the PDF.");
  };

  const handleGeneratePDF = async () => {
    if (generatingPDFRef.current || generatingPDF) return;
    generatingPDFRef.current = true;
    setGeneratingPDF(true);

    const formsToGenerate = employeeQueue.length > 0 ? employeeQueue : [formData];
    let successCount = 0;

    try {
      // Find all rendered .inc-letter-page elements in the modal
      const previewModalBody = document.querySelector(".inc-modal-body");
      const letterPages = previewModalBody
        ? Array.from(previewModalBody.querySelectorAll(".inc-letter-page"))
        : [];

      for (let i = 0; i < formsToGenerate.length; i++) {
        const curForm = formsToGenerate[i];
        const pageEl = letterPages[i] || letterPages[0];

        if (!pageEl) {
          console.warn(`Page element not found for index ${i}`);
          continue;
        }

        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          width: 794,
          height: 1123,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.85);
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");

        // Download individual PDF separately
        pdf.save(`Increment_Letter_${curForm.employeeName || "Employee"}.pdf`);

        const pdfBlob = pdf.output("blob");
        const formDataToSend = new FormData();
        formDataToSend.append("file", pdfBlob, `Increment_Letter_${curForm.employeeName || "Employee"}.pdf`);
        formDataToSend.append("letterType", "increment");
        formDataToSend.append("employeeName", curForm.employeeName);
        formDataToSend.append("dateOfIssue", curForm.dateOfIssue);
        formDataToSend.append("designation", curForm.designation);
        formDataToSend.append("department", curForm.department || "");
        formDataToSend.append("signatoryName", curForm.signatoryName || "");
        formDataToSend.append("signatoryTitle", curForm.signatoryTitle || "");
        formDataToSend.append("effectiveFrom", curForm.effectiveFrom || "");
        formDataToSend.append(
          "data",
          JSON.stringify({
            previousSalary: curForm.previousSalary,
            newSalary: curForm.newSalary,
            incrementPercentage: curForm.incrementPercentage,
            effectiveFrom: curForm.effectiveFrom || "",
            allowances: curForm.allowances,
          })
        );

        try {
          await portalInstance.post("/appointment/letter/save", formDataToSend, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });
          successCount++;
        } catch (saveErr) {
          console.error(`Failed to save letter record for ${curForm.employeeName}:`, saveErr);
          const errMsg = saveErr.response?.data?.message || saveErr.message || "Failed to save record to server.";
          toast.error(`Database save failed for ${curForm.employeeName}: ${errMsg}`);
        }

        // Brief delay between downloads so the browser can handle multiple file triggers
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (successCount > 0) {
        toast.success(`Successfully generated ${successCount} Increment ${successCount > 1 ? "Letters" : "Letter"}!`);
      }
      fetchHistory(currentPage, 50);
      setShowPreviewModal(false);
      setEmployeeQueue([]);
      setCurrentQueueIndex(0);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error(err.response?.data?.message || "Failed to generate PDF.");
    } finally {
      generatingPDFRef.current = false;
      setGeneratingPDF(false);
    }
  };

  // Render Document HTML structure
  const renderDocument = (onReady) => {
    return <HtmlLetterPage formData={formData} templateTexts={templateTexts} letterType="increment" onReady={onReady} previewRef={previewRef} isTemplatePreview={!isGenerateMode} />;
  };

  return (
    <div className="inc-letter-layout">
      <Sidebar />
      <div className="inc-letter-container">
        {/* <div className="inc-letter-header">
          <p>Generate, edit, and review increment letters for employees.</p>
        </div> */}

        <div className="inc-page-content-card">
          <div className="inc-tab-bar-container">
            <div className="inc-tab-radio-group">
              <button
                className={`inc-tab-radio-btn ${activeTab === "generate" ? "active" : ""}`}
                onClick={() => setActiveTab("generate")}
              >
                <span className={`inc-tab-radio-circle ${activeTab === "generate" ? "active" : ""}`} />
                Generate Letter
              </button>
              <button
                className={`inc-tab-radio-btn ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                <span className={`inc-tab-radio-circle ${activeTab === "settings" ? "active" : ""}`} />
                Templates &amp; Settings
              </button>
            </div>

            {activeTab === "generate" && (
              <button
                className="inc-add-btn"
                style={{ borderStyle: "solid", background: "#5977f8", color: "#ffffff" }}
                onClick={() => {
                  fetchEmployeesList();
                  setSelectedEmployees([]);
                  setEmpSearchTerm("");
                  setSelectedDeptFilter("");
                  setShowDeptFilterPopover(false);
                  setShowSelectEmployeeModal(true);
                }}
              >
                <Icon icon="lucide:plus" width="16" /> Create Increment Slip
              </button>
            )}
          </div>

          {/* TAB 1: GENERATE */}
          {activeTab === "generate" && (
            <div>
              {/* <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                <div style={{ position: "relative", width: "250px" }}>
                  <Icon icon="lucide:search" style={{ position: "absolute", left: "10px", top: "12px", color: "#94a3b8" }} width="16" />
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: "100%", height: "38px", paddingLeft: "32px", paddingRight: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }}
                  />
                </div>
              </div> */}

              <div className="inc-table-wrapper">
                <table className="inc-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Employee Name</th>
                      <th>Designation</th>
                      <th>Previous Salary</th>
                      <th>New Salary</th>
                      <th>Percentage</th>
                      <th style={{ textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                          Loading increment letters history...
                        </td>
                      </tr>
                    ) : currentItems.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                          No generated increment letters found.
                        </td>
                      </tr>
                    ) : (
                      currentItems.map((letter, idx) => (
                        <tr key={letter._id}>
                          <td>{String((currentPage - 1) * pageSize + idx + 1).padStart(2, "0")}</td>
                          <td>{letter.employeeName}</td>
                          <td>{letter.designation}</td>
                          <td>₹{parseFloat(letter.previousSalary || 0).toLocaleString("en-IN")}</td>
                          <td>₹{parseFloat(letter.newSalary || 0).toLocaleString("en-IN")}</td>
                          <td>{letter.incrementPercentage}</td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                              {letter.fileUrl && (
                                <a
                                  href={letter.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "#ffffff",
                                    background: "#2563eb",
                                    border: "1px solid #2563eb",
                                    borderRadius: "6px",
                                    padding: "4px 12px",
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    cursor: "pointer",
                                  }}
                                >
                                  View
                                </a>
                              )}
                              <button
                                type="button"
                                style={{
                                  color: "#ffffff",
                                  background: "#dc2626",
                                  border: "1px solid #dc2626",
                                  borderRadius: "6px",
                                  padding: "4px 12px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                                onClick={() => {
                                  setLetterToDelete(letter);
                                  setShowDeleteModal(true);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                totalItems={Math.max(1, filteredHistory.length)}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}

          {/* TAB 2: TEMPLATES & SETTINGS */}
          {activeTab === "settings" && (
            <div className="inc-template-settings-area">
              {editingTemplateType ? (
                <LetterTemplateEditor
                  key={`increment-${editorResetKey}`}
                  letterType="increment"
                  initialHtml={templateTexts.increment?.html || ""}
                  subjectValue={templateTexts.increment?.subject || ""}
                  isCustomized={!!templateTexts.increment?.isCustomized}
                  onSave={handleSaveTemplate}
                  onPreview={handleEditorPreview}
                  onReset={handleResetTemplate}
                  onBack={() => setEditingTemplateType(null)}
                />
              ) : (
                <>
                  <p className="inc-template-settings-desc">
                    Preview and manage the Increment Letter template. Click{" "}
                    <strong>Preview Template</strong> to see a sample, or{" "}
                    <strong>Customize</strong> to edit.
                  </p>

                  <div className="inc-template-cards">
                    {/* Single Increment Letter card */}
                    <div
                      className="inc-template-card"
                      style={{ "--inc-card-accent": "#5977f8" }}
                    >
                      <div className="inc-template-card-header">
                        <div className="inc-template-icon">
                          <Icon icon="lucide:trending-up" width="28" />
                        </div>
                        <div>
                          <h3>Increment Letter</h3>
                          <p>Salary revision letter with allowances breakdown table and signatory block.</p>
                        </div>
                      </div>

                      <div className="inc-template-card-footer">
                        <button
                          id="btn-preview-inc-template"
                          className="inc-template-preview-btn"
                          onClick={() => {
                            setPreviewHtml(null);
                            setIsGenerateMode(false);
                            setShowPreviewModal(true);
                          }}
                        >
                          <Icon icon="lucide:eye" width="14" /> Preview
                        </button>
                        <button
                          id="btn-customize-inc-template"
                          className="inc-template-customize-btn"
                          onClick={() => {
                            setEditingTemplateType("increment");
                            setEditorResetKey((k) => k + 1);
                          }}
                        >
                          <Icon icon="lucide:layout-template" width="14" /> Customize
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* MODAL: Select Employee Popup */}
        {showSelectEmployeeModal && (
          <div className="inc-modal-overlay">
            <div className="inc-modal-content" style={{ maxWidth: "780px", width: "90%" }}>
              <div className="inc-modal-header">
                <h3 className="inc-modal-title">Select Employee</h3>
                <button
                  className="inc-modal-close"
                  onClick={() => {
                    setShowSelectEmployeeModal(false);
                    setShowDeptFilterPopover(false);
                  }}
                >
                  &times;
                </button>
              </div>

              <div className="inc-modal-body" style={{ background: "transparent", border: "none", padding: 0 }}>
                {/* Search & Filter Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "16px",
                    position: "relative",
                  }}
                >
                  {/* Search Input Box */}
                  <div style={{ position: "relative", flex: 1, maxWidth: "340px" }}>
                    <Icon
                      icon="lucide:search"
                      style={{ position: "absolute", left: "12px", top: "11px", color: "#94a3b8" }}
                      width="16"
                    />
                    <input
                      type="text"
                      placeholder="Search by name, ID, or email..."
                      value={empSearchTerm}
                      onChange={(e) => setEmpSearchTerm(e.target.value)}
                      style={{
                        width: "100%",
                        height: "38px",
                        paddingLeft: "36px",
                        paddingRight: "12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Filter Icon Only Button */}
                  <div className="filter-popover-container" style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setShowDeptFilterPopover((prev) => !prev)}
                      title="Filter by Department"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img src="/Filter.svg" alt="Filter" style={{ width: "20px", height: "20px" }} />
                    </button>

                    {/* Department Filter Popover */}
                    {showDeptFilterPopover && (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "44px",
                          width: "220px",
                          background: "#ffffff",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          padding: "12px",
                          zIndex: 100,
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
                          Filter by Department
                        </div>
                        <CustomDropdown
                          options={[
                            { value: "", label: "All Departments" },
                            ...uniqueDepartments.map((dept) => ({ value: dept, label: dept }))
                          ]}
                          value={selectedDeptFilter}
                          onChange={(val) => {
                            setSelectedDeptFilter(val);
                            setShowDeptFilterPopover(false);
                          }}
                          placeholder="All Departments"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Searchable Employee Table */}
                <div
                  style={{
                    maxHeight: "360px",
                    overflowY: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                >
                  <table className="inc-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 5 }}>
                      <tr>
                        <th style={{ width: "50px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={
                              filteredSelectableEmployees.length > 0 &&
                              filteredSelectableEmployees.every((emp) =>
                                selectedEmployees.some((e) => (e._id || e.empId) === (emp._id || emp.empId))
                              )
                            }
                            onChange={handleToggleSelectAll}
                            style={{ cursor: "pointer", width: "16px", height: "16px" }}
                            title="Select / Deselect All"
                          />
                        </th>
                        <th>Employee ID</th>
                        <th>Employee Name</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Designation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSelectableEmployees.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                            No employees found.
                          </td>
                        </tr>
                      ) : (
                        filteredSelectableEmployees.map((emp) => {
                          const isSelected = selectedEmployees.some(
                            (e) => (e._id || e.empId) === (emp._id || emp.empId)
                          );
                          return (
                            <tr
                              key={emp._id || emp.empId}
                              style={{
                                cursor: "pointer",
                                background: isSelected ? "#f0f7ff" : "transparent",
                              }}
                              onClick={() => handleToggleEmployee(emp)}
                            >
                              <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleEmployee(emp)}
                                  style={{ cursor: "pointer", width: "16px", height: "16px" }}
                                />
                              </td>
                              <td>
                                <strong>{emp.empId || emp.employeeId || "—"}</strong>
                              </td>
                              <td>{emp.employeeName || emp.name || "—"}</td>
                              <td style={{ color: "#64748b" }}>{emp.email || "—"}</td>
                              <td>{emp.department || "—"}</td>
                              <td>{emp.designation || "—"}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer action bar for multi-selection */}
                <div
                  style={{
                    marginTop: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "#475569", fontWeight: 500 }}>
                    {selectedEmployees.length > 0
                      ? `${selectedEmployees.length} employee${selectedEmployees.length > 1 ? "s" : ""} selected`
                      : "Select one or more employees"}
                  </span>
                  <button
                    className="inc-add-btn"
                    disabled={selectedEmployees.length === 0}
                    onClick={handleProceedWithSelectedEmployees}
                    style={{
                      background: selectedEmployees.length > 0 ? "#5977f8" : "#94a3b8",
                      color: "#ffffff",
                      borderStyle: "solid",
                      padding: "8px 20px",
                    }}
                  >
                    Proceed with Selected ({selectedEmployees.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Create Increment Slip Form */}
        {showCreateSlipModal && (
          <div className="inc-modal-overlay">
            <div className="inc-modal-content" style={{ maxWidth: "700px" }}>
              <div className="inc-modal-header">
                <h3 className="inc-modal-title">
                  Create Increment Letter
                  {employeeQueue.length > 1 && (
                    <span style={{ fontSize: "13px", fontWeight: 400, color: "#64748b", marginLeft: "10px" }}>
                      ({currentQueueIndex + 1} of {employeeQueue.length})
                    </span>
                  )}
                </h3>
                <button className="inc-modal-close" onClick={() => setShowCreateSlipModal(false)}>&times;</button>
              </div>
              <div className="inc-modal-body">
                <div className="inc-form-grid">
                  <div className="inc-form-section-title">
                     Employee Details
                  </div>
                  <div className="inc-form-row">
                    <div className="inc-form-group">
                      <label>Employee Name *</label>
                      <input
                        name="employeeName"
                        value={formData.employeeName}
                        onChange={handleEmployeeNameChange}
                        placeholder="Full Name"
                        list="inc-employee-datalist"
                        autoComplete="off"
                      />
                      <datalist id="inc-employee-datalist">
                        {employeesList.map((emp) => (
                          <option
                            key={emp._id || emp.empId}
                            value={emp.employeeName || emp.name}
                          >
                            {emp.designation ? `${emp.designation} (${emp.department || ""})` : ""}
                          </option>
                        ))}
                      </datalist>
                    </div>
                    <div className="inc-form-group">
                      <label>Designation *</label>
                      <input
                        name="designation"
                        value={formData.designation}
                        onChange={handleInputChange}
                        placeholder="e.g. Software Engineer"
                      />
                    </div>
                  </div>

                  <div className="inc-form-row">
                    <div className="inc-form-group">
                      <label>Department</label>
                      <input
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        placeholder="e.g. IT"
                      />
                    </div>
                    <div className="inc-form-group">
                      <label>Date of Issue *</label>
                      <input
                        type="date"
                        name="dateOfIssue"
                        value={formData.dateOfIssue}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="inc-form-section-title">
                     Salary Revision Details
                  </div>
                  <div className="inc-form-row">
                    <div className="inc-form-group">
                      <label>Previous Salary (₹/month) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="previousSalary"
                        value={formatIndianNumber(formData.previousSalary)}
                        onChange={handleSalaryInputChange}
                        placeholder="e.g. 50,000"
                      />
                    </div>
                    <div className="inc-form-group">
                      <label>New Salary (₹/month) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="newSalary"
                        value={formatIndianNumber(formData.newSalary)}
                        onChange={handleSalaryInputChange}
                        placeholder="e.g. 60,000"
                      />
                    </div>
                  </div>
                  <div className="inc-form-row">
                    <div className="inc-form-group">
                      <label>Increment Percentage *</label>
                      <input
                        name="incrementPercentage"
                        value={formData.incrementPercentage}
                        onChange={handleInputChange}
                        placeholder="e.g. 20%"
                      />
                    </div>
                    <div className="inc-form-group">
                      <label>Effective From *</label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <input
                          type="text"
                          name="effectiveFrom"
                          value={formData.effectiveFrom || ""}
                          onChange={handleInputChange}
                          placeholder="Select Effective Date"
                          style={{ paddingRight: "38px", width: "100%" }}
                        />
                        <img
                          src="/Calander.svg"
                          alt="Calendar"
                          title="Pick date from calendar"
                          onClick={openEffectiveFromDatePicker}
                          style={{
                            position: "absolute",
                            right: "10px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            cursor: "pointer",
                            width: "18px",
                            height: "18px",
                            userSelect: "none",
                          }}
                        />
                        <input
                          type="date"
                          ref={effectiveFromPickerRef}
                          onChange={handleEffectiveFromDatePick}
                          style={{
                            position: "absolute",
                            opacity: 0,
                            pointerEvents: "none",
                            width: 0,
                            height: 0,
                            left: 0,
                            bottom: 0,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="inc-form-section-title" style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                     Allowance Breakdown
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {newSalaryNum > 0 && (
                        <span
                          style={{
                            padding: "4px 12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            background: remainingAllowanceAmount === 0 ? "#dcfce7" : remainingAllowanceAmount < 0 ? "#fee2e2" : "#fef3c7",
                            color: remainingAllowanceAmount === 0 ? "#15803d" : remainingAllowanceAmount < 0 ? "#b91c1c" : "#b45309",
                            border: remainingAllowanceAmount === 0 ? "1px solid #bbf7d0" : remainingAllowanceAmount < 0 ? "1px solid #fca5a5" : "1px solid #fde68a",
                          }}
                        >
                          Remaining: ₹{formatIndianNumber(remainingAllowanceAmount)}
                        </span>
                      )}
                      <button className="inc-add-btn" type="button" onClick={addAllowanceRow} style={{ padding: "4px 10px" }}>
                        Add Allowance
                      </button>
                    </div>
                  </div>

                  <div className="inc-allowances-container">
                    {formData.allowances.map((allowance, idx) => (
                      <div key={idx} className="inc-allowance-row">
                        <input
                          type="text"
                          placeholder="Allowance Label (e.g. Basic Salary)"
                          value={allowance.label}
                          onChange={(e) => handleAllowanceChange(idx, "label", e.target.value)}
                          style={{ height: "38px", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0 10px", fontSize: "13px" }}
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Amount (₹)"
                          value={formatIndianNumber(allowance.amount)}
                          onChange={(e) => handleAllowanceAmountChange(idx, e.target.value)}
                          style={{ height: "38px", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0 10px", fontSize: "13px" }}
                        />
                        <button
                          type="button"
                          className="inc-delete-btn"
                          onClick={() => deleteAllowanceRow(idx)}
                          disabled={formData.allowances.length <= 1}
                        >
                          <Icon icon="lucide:trash-2" width="16" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="inc-form-section-title" style={{ marginTop: "20px" }}>
                    Signatory Details
                  </div>
                  <div className="inc-form-row">
                    <div className="inc-form-group">
                      <label>Signatory Name</label>
                      <input
                        name="signatoryName"
                        value={formData.signatoryName}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="inc-form-group">
                      <label>Signatory Title</label>
                      <input
                        name="signatoryTitle"
                        value={formData.signatoryTitle}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="inc-modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  {employeeQueue.length > 1 && currentQueueIndex > 0 && (
                    <button
                      type="button"
                      className="common-modal-btn btn-small-cancel"
                      onClick={handlePreviousEmployeeForm}
                    >
                      ← Previous Employee
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" className="common-modal-btn btn-small-cancel" onClick={() => setShowCreateSlipModal(false)}>Cancel</button>
                  {employeeQueue.length > 1 && currentQueueIndex < employeeQueue.length - 1 ? (
                    <button
                      type="button"
                      className="inc-add-btn"
                      onClick={handleNextEmployeeForm}
                      style={{ background: "#5977f8", color: "#ffffff", borderStyle: "solid" }}
                    >
                      Next Employee ({currentQueueIndex + 2} of {employeeQueue.length}) →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inc-add-btn"
                      onClick={handleConfirmAllFormDetails}
                      style={{ background: "#5977f8", color: "#ffffff", borderStyle: "solid" }}
                    >
                      {employeeQueue.length > 1 ? `Confirm & Preview All (${employeeQueue.length} Letters)` : "Confirm & Preview"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Preview Modal */}
        {showPreviewModal && (
          <div className="inc-modal-overlay">
            <div className="inc-modal-content" style={{ maxWidth: "850px", height: "90vh" }}>
              <div className="inc-modal-header">
                <h3 className="inc-modal-title">
                  Letter Preview
                  {employeeQueue.length > 1 && (
                    <span style={{ fontSize: "13px", fontWeight: 400, color: "#64748b", marginLeft: "10px" }}>
                      ({employeeQueue.length} Letters)
                    </span>
                  )}
                </h3>
                <button className="inc-modal-close" onClick={handleClosePreviewModal}>&times;</button>
              </div>
              <div
                className="inc-modal-body"
                style={{
                  background: "#cbd5e1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "30px",
                  padding: "24px 10px",
                }}
              >
                {employeeQueue.length > 1 ? (
                  employeeQueue.map((itemForm, idx) => (
                    <div key={idx} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ marginBottom: "10px", fontWeight: "600", fontSize: "14px", color: "#1e293b", background: "#f1f5f9", padding: "4px 14px", borderRadius: "20px", border: "1px solid #cbd5e1" }}>
                        Letter {idx + 1} of {employeeQueue.length}: <strong>{itemForm.employeeName}</strong> ({itemForm.designation})
                      </div>
                      <HtmlLetterPage
                        formData={itemForm}
                        templateTexts={templateTexts}
                        letterType="increment"
                      />
                    </div>
                  ))
                ) : (
                  <HtmlLetterPage
                    formData={formData}
                    templateTexts={templateTexts}
                    letterType="increment"
                    previewRef={previewRef}
                    isTemplatePreview={!isGenerateMode}
                  />
                )}
              </div>
              <div className="inc-modal-footer">
                <button
                  type="button"
                  className="common-modal-btn btn-small-cancel"
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPreviewHtml(null);
                    setInlineHasChanges(false);
                    if (isGenerateMode) {
                      setShowCreateSlipModal(true);
                    }
                  }}
                  style={{
                    marginRight: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <Icon icon="lucide:arrow-left" width="14" />
                  Back
                </button>
                {inlineHasChanges && (
                  <button
                    className="inc-add-btn"
                    onClick={handleSaveInlineEdit}
                    style={{ background: "#10b981", color: "#ffffff", borderStyle: "solid" }}
                  >
                    Save Changes
                  </button>
                )}
                {isGenerateMode && (
                  <button
                    className="inc-add-btn"
                    disabled={generatingPDF}
                    onClick={handleGeneratePDF}
                    style={{ background: "#5977f8", color: "#ffffff", borderStyle: "solid" }}
                  >
                    {generatingPDF ? "Generating..." : employeeQueue.length > 1 ? `Generate All Letters (${employeeQueue.length})` : "Generate Letter"}
                  </button>
                )}
                <button
                  className="inc-add-btn"
                  onClick={() => window.print()}
                  style={{ background: "#0f172a", color: "#ffffff", borderStyle: "solid", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Icon icon="lucide:printer" width="14" />
                  Print
                </button>
                <button className="common-modal-btn btn-small-cancel" onClick={handleClosePreviewModal}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Delete Letter */}
        {showDeleteModal && (
          <div className="inc-modal-overlay">
            <div className="inc-modal-content" style={{ maxWidth: "440px" }}>
              <div className="inc-modal-header">
                <h3 className="inc-modal-title" style={{ color: "#ef4444" }}>Delete Letter</h3>
                <button className="inc-modal-close" onClick={() => setShowDeleteModal(false)}>&times;</button>
              </div>
              <div className="inc-modal-body">
                <p>Are you sure you want to delete the letter for <strong>{letterToDelete?.employeeName}</strong>?</p>
                <p style={{ color: "#64748b", fontSize: "12px" }}>This will permanently delete the record and its PDF. This action cannot be undone.</p>
              </div>
              <div className="inc-modal-footer">
                <button className="common-modal-btn btn-small-cancel" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button
                  className="common-modal-btn btn-reject"
                  disabled={isDeletingLetter}
                  onClick={handleDeleteConfirm}
                  style={{ background: "#ef4444", color: "#ffffff", borderStyle: "solid" }}
                >
                  {isDeletingLetter ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </div>
  );
};

/** Single-page increment letter renderer — no pagination.
 *  All content is placed on one A4 page; signature sits at the bottom
 *  via the .inc-sig-block CSS (margin-top: 270px / auto).           */
const HtmlLetterPage = ({ formData, templateTexts, letterType, onReady, previewRef, isTemplatePreview = false }) => {
  const containerRef = React.useRef(null);

  const templateHtml = templateTexts[letterType]?.html;
  const contentText = templateHtml || `
<p style="text-align: center; font-size: 15px; letter-spacing: 0.05em; margin-bottom: 20px;"><strong>GSTIN - 33AAGCE8342L1ZF</strong></p>
<p>Dear <strong>{employeeName}</strong>,</p>
<p>Congratulations!</p>
<p>We are pleased to inform you that, based on your performance and contributions to the organization, your monthly salary has been revised with an increment of <strong>{incrementAmount}</strong>, effective from <strong>{dateOfIssue}</strong>.</p>
<p><strong>Revised Salary Details:</strong></p>
<ul>
  <li><strong>Previous Monthly Salary:</strong> {previousSalary}</li>
  <li><strong>% Increment:</strong> {incrementPercentage}</li>
  <li><strong>New Monthly Salary:</strong> {newSalary}</li>
</ul>
<p>We sincerely appreciate your dedication and the value you bring to our team. We look forward to your continued contributions and success in your role. Should you have any questions or require further clarification, please feel free to reach out.</p>
<p>Compensation package: The details of your monthly compensation are as follows:</p>
{allowancesTable}
<p>We look forward to your continued energetic contribution and many years of rewarding association with Organization.</p>
  `;

  const compiledHtml = compileTemplateToHtml(contentText, formData, isTemplatePreview);
  const blocks = React.useMemo(() => getHtmlBlocks(compiledHtml), [compiledHtml]);

  // Fire onReady after blocks render so the preview HTML is captured
  React.useEffect(() => {
    if (onReady && containerRef.current) {
      onReady(containerRef.current.innerHTML);
    }
  }, [blocks]); // eslint-disable-line

  const sigBlock = (
    <div className="inc-sig-block">
      <div className="inc-sig-left">
        <p className="inc-sig-wishes">With Best Wishes,</p>
        <img src="/sign 1.png" alt="CEO Signature" className="inc-sig-img" />
        <strong className="inc-sig-name">
          {formData.signatoryName || "Jayaprakash. R"}
        </strong>
        <p className="inc-sig-title">
          {formData.signatoryTitle || "Managing Director & CEO"}
        </p>
      </div>
      <div>
        <img src="/seal.png" alt="Company Seal" className="inc-seal-img" />
      </div>
    </div>
  );

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (previewRef) previewRef.current = el;
      }}
      className="inc-letter-page-wrapper"
    >
      {/* Single A4 page — no pagination */}
      <div className="inc-letter-page">
        <img src="/Letterpad.svg" className="inc-letter-bg" alt="" aria-hidden="true" />
        <div className="inc-letter-body-content">
          <div className="inc-letter-date">
            Date: {isTemplatePreview ? "{dateOfIssue}" : fmtDate(formData.dateOfIssue)}
          </div>

          {/* All content blocks on the same page */}
          <div style={{ flex: "none" }}>
            {blocks.map((htmlStr, idx) => (
              <div key={idx} dangerouslySetInnerHTML={{ __html: htmlStr }} />
            ))}
          </div>

          {/* Signature pinned to bottom by .inc-sig-block CSS */}
          {sigBlock}
        </div>
      </div>
    </div>
  );
};

export default IncrementLetter;


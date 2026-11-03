import React, { useEffect, useState, useMemo } from "react";
import LetterTemplateEditor from "./LetterTemplateEditor";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { portalInstance } from "../../../Services/instance";
import { toast, ToastContainer } from "react-toastify";
import { Icon } from "@iconify/react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useUser } from "../../UserContext";
import AdditionalInformationPage from "./components/LetterPages/AdditionalInformationPage";
import "./AppointmentLetter.css";
import "../../Common/CustomDropdown.css";
import Pagination from "../../Employee/Pagination/Pagination";
import "../../Employee/Pagination/Pagination.css";

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

const LetterBg = () => (
  <img src="/Letterpad.svg" className="letter-bg-img" alt="" aria-hidden="true" />
);

// ─── LETTER TYPE CARD CONFIG ──────────────────────────────────────────────────
const LETTER_TYPES = [
  {
    id: "internship",
    icon: "lucide:graduation-cap",
    title: "Internship Letter",
    desc: "For students joining as interns with a monthly stipend.",
    color: "#6366f1",
  },
  {
    id: "appointment",
    icon: "lucide:file-badge",
    title: "Direct Appointment",
    desc: "For employees joining directly in a full-time role.",
    color: "#0ea5e9",
  },
  {
    id: "intern-to-fulltime",
    icon: "lucide:arrow-up-circle",
    title: "Intern → Full-time",
    desc: "Convert an existing intern to a permanent full-time employee.",
    color: "#10b981",
  },
  {
    id: "additional-info",
    icon: "lucide:settings",
    title: "Additional Information",
    desc: "Page 2 template featuring key responsibilities and acceptance sections.",
    color: "#f59e0b",
  },
];



const decompileHtmlToTemplate = (htmlStr, data) => {
  if (!htmlStr) return "";
  let res = htmlStr;

  const formattedDoj = fmtDate(data.dateOfJoining);
  const formattedStartDate = fmtDate(data.internshipStartDate);
  const formattedEndDate = fmtDate(data.internshipEndDate);
  const formattedConvertedDoj = fmtDate(data.convertedJoiningDate);

  const formattedStipend = parseFloat(data.stipend || 0).toLocaleString("en-IN");
  const formattedCtc = parseFloat(data.ctc || 0).toLocaleString("en-IN");
  const formattedConvertedCtc = parseFloat(data.convertedCtc || 0).toLocaleString("en-IN");

  const rawMappings = [
    { placeholder: "{employeeName}", val: data.employeeName },
    { placeholder: "{convertedDesignation}", val: data.convertedDesignation },
    { placeholder: "{designation}", val: data.designation },
    { placeholder: "{department}", val: data.department },
    { placeholder: "{officeLocation}", val: data.officeLocation },
    { placeholder: "{internshipStartDate}", val: formattedStartDate },
    { placeholder: "{internshipEndDate}", val: formattedEndDate },
    { placeholder: "{internshipDuration}", val: data.internshipDuration },
    { placeholder: "{workingHours}", val: data.workingHours },
    { placeholder: "{stipend}", val: `₹${formattedStipend}` },
    { placeholder: "{stipend}", val: formattedStipend },
    { placeholder: "{dateOfJoining}", val: formattedDoj },
    { placeholder: "{convertedJoiningDate}", val: formattedConvertedDoj },
    { placeholder: "{probationPeriod}", val: data.probationPeriod },
    { placeholder: "{ctc}", val: `INR ${formattedCtc}` },
    { placeholder: "{ctc}", val: formattedCtc },
    { placeholder: "{convertedCtc}", val: `INR ${formattedConvertedCtc}` },
    { placeholder: "{convertedCtc}", val: formattedConvertedCtc },
    { placeholder: "{reportingTo}", val: data.reportingTo },
    { placeholder: "{monthlySalary}", val: data.monthlySalary },
    { placeholder: "{job type}", val: "Full time" },
    { placeholder: "{doj}", val: formattedDoj },
    { placeholder: "{reporting}", val: data.reportingTo },
    { placeholder: "{INR amount /-}", val: `INR ${data.monthlySalary}/-` },
    { placeholder: "{INR amount /-}", val: `${data.monthlySalary}/-` },
  ];

  const mappings = [];
  rawMappings.forEach(m => {
    if (m.val && m.val !== "—") {
      mappings.push({ placeholder: m.placeholder, val: `<strong>${m.val}</strong>` });
      mappings.push({ placeholder: m.placeholder, val: `${m.val}` });
    }
  });

  res = res.replace(/<br\s*\/?>/gi, "\n");
  mappings.sort((a, b) => b.val.length - a.val.length);

  mappings.forEach(({ placeholder, val }) => {
    const escapedVal = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedVal, 'g');
    res = res.replace(regex, placeholder);
  });

  res = res.replace(/<\/?[^>]+(>|$)/g, "");

  res = res
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  return res.trim();
};

const compileTemplateToHtml = (templateStr, data, letterType = "", isTemplatePreview = false) => {
  if (!templateStr) return "";
  let res = templateStr;
  res = res
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

  if (isTemplatePreview) {
    // In Template Preview mode, display placeholders instead of default/fallback values (like '—' or dummy dates)
    res = res.replace(/Dear\s+(—|sabari|Sabari|sample employee|Sample Employee|\[Employee Name\])/gi, "Dear {employeeName}");
    res = res.replace(/(effective from\s+)?[A-Za-z]+\s+\d{1,2},\s+\d{4}\s+to\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}/gi, (match, p1) => (p1 ? p1 : "") + "{internshipStartDate} to {internshipEndDate}");
    res = res.replace(/(Working Hours|workingHours)\s*:\s*(<strong>)?(—|10:00 AM to 06:30 PM)*(<\/strong>)?/gi, "Working Hours : {workingHours}");
    res = res.replace(/(Internship Duration|internshipDuration)\s*:\s*(<strong>)?(—|\s*)*(<\/strong>)?/gi, "Internship Duration : {internshipDuration}");
    res = res.replace(/Department\s*:\s*(<strong>)?(—)*(<\/strong>)?/gi, "Department : {department}");
    res = res.replace(/(Reporting to|Reporting To|reportingTo)\s*:\s*(<strong>)?(—)*(<\/strong>)?/gi, "Reporting To : {reportingTo}");
    res = res.replace(/(Stipend|stipend)\s*:\s*(<strong>)?(₹0 per month|₹10,000 per month|—)*(<\/strong>)?/gi, "Stipend : {stipend}");
    res = res.replace(/(Position|Postition)\s*:\s*(<strong>)?(—|\.-|—\.)+(<\/strong>)?/gi, "Position : {designation}");

    if (!res.trim().startsWith('<')) {
      res = res.replace(/\n/g, '<br />');
    }
    return res;
  }

  const formattedDoj = fmtDate(data.dateOfJoining);
  const formattedStartDate = fmtDate(data.internshipStartDate);
  const formattedEndDate = fmtDate(data.internshipEndDate);
  const formattedConvertedDoj = fmtDate(data.convertedJoiningDate);

  const formattedStipend = parseFloat(data.stipend || 0).toLocaleString("en-IN");
  const formattedCtc = parseFloat(data.ctc || 0).toLocaleString("en-IN");
  const formattedConvertedCtc = parseFloat(data.convertedCtc || 0).toLocaleString("en-IN");

  let formattedProbation = "";
  if (data.hasProbation === "yes") {
    const val = data.probationValue || data.probationPeriod || "";
    const unit = data.probationUnit || "months";
    formattedProbation = val ? `${val} ${unit}` : "";
  } else if (data.hasProbation === "no") {
    formattedProbation = "";
  } else if (data.probationPeriod) {
    formattedProbation = data.probationPeriod.includes("month") || data.probationPeriod.includes("year")
      ? data.probationPeriod
      : `${data.probationPeriod} months`;
  }

  const activeDesignation = data.designation || "—";

  const values = {
    "{employeeName}": data.employeeName || "—",
    "{designation}": activeDesignation,
    "{position}": activeDesignation,
    "{Position}": activeDesignation,
    "{Postition}": activeDesignation,
    "{convertedDesignation}": activeDesignation,
    "{department}": data.department || "—",
    "{officeLocation}": data.officeLocation || "—",
    "{internshipStartDate}": formattedStartDate,
    "{internshipEndDate}": formattedEndDate,
    "{internshipDuration}": data.internshipDuration || "—",
    "{workingHours}": data.workingHours || "—",
    "{stipend}": data.hasStipend === "no" ? "Unpaid" : `₹${formattedStipend}`,
    "{dateOfJoining}": formattedDoj,
    "{startDate}": formattedDoj,
    "{start Date}": formattedDoj,
    "{Start Date}": formattedDoj,
    "{convertedJoiningDate}": formattedConvertedDoj,
    "{probationPeriod}": formattedProbation || "",
    "{ctc}": `INR ${formattedCtc}`,
    "{convertedCtc}": `INR ${formattedConvertedCtc}`,
    "{reportingTo}": data.reportingTo || "—",
    "{Reporting to}": data.reportingTo || "—",
    "{reporting}": data.reportingTo || "—",
    "{monthlySalary}": data.monthlySalary || "—",
    "{Monthly Salary}": data.monthlySalary || "—",
    "{job type}": data.jobType || "Fulltime",
    "{jobType}": data.jobType || "Fulltime",
    "{doj}": formattedDoj,
    "{INR amount /-}": data.monthlySalary || "—",
    "{dateOfIssue}": fmtDate(data.dateOfIssue),
  };

  Object.entries(values).forEach(([placeholder, val]) => {
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    res = res.replace(regex, val);
  });

  // Repair stale literal placeholders if previously saved inline
  if (data.employeeName) {
    res = res.replace(/Dear\s+(—|sabari|Sabari|sample employee|Sample Employee)/gi, `Dear ${data.employeeName}`);
  }
  if (data.designation) {
    res = res.replace(/(Postition|Position)\s*:\s*(<strong>)?(—|\.-|—\.)+(<\/strong>)?/gi, `Position : ${data.designation}`);
  }
  if (data.department) {
    res = res.replace(/Department\s*:\s*(<strong>)?(—|\.-|—\.)+(<\/strong>)?/gi, `Department : ${data.department}`);
  }
  if (formattedDoj && formattedDoj !== "—") {
    res = res.replace(/(start Date|startDate|Date of Joining)\s*:\s*(<strong>)?(—|\.-|—\.)+(<\/strong>)?/gi, `start Date : ${formattedDoj}`);
  }
  if (data.reportingTo) {
    res = res.replace(/(Reporting to|reportingTo)\s*:\s*(<strong>)?(—|\.-|—\.)+(<\/strong>)?/gi, `Reporting to : ${data.reportingTo}`);
  }
  if (data.monthlySalary) {
    const formattedMonthly = Number(data.monthlySalary).toLocaleString("en-IN");
    res = res.replace(/Monthly Salary\s*:\s*(INR)?\s*(<strong>)?(—|INR\s*—)+(<\/strong>)?/gi, `Monthly Salary : INR ${formattedMonthly}/-`);
  }
  if (data.jobType) {
    res = res.replace(/(Job type|jobType|Job Type)\s*:\s*(<strong>)?(—|\.-|—\.)+(<\/strong>)?/gi, `Job type : ${data.jobType}`);
  }
  if (data.internshipDuration) {
    res = res.replace(/(Internship Duration|internshipDuration|Duration)\s*:\s*(<strong>)?(?:[^<]+|<strong>.*?<\/strong>)*(<\/strong>)?/gi, `Internship Duration : ${data.internshipDuration}`);
    res = res.replace(/(for a period of|period of)\s+(?:<strong>)?[^<]+?(?:<\/strong>)?\s+(from|effective from)/gi, `$1 <strong>${data.internshipDuration}</strong> $2`);
  }
  if (data.workingHours) {
    res = res.replace(/(Working Hours|workingHours)\s*:\s*(<strong>)?(?:[^<]+|<strong>.*?<\/strong>)*(<\/strong>)?/gi, `Working Hours : ${data.workingHours}`);
  }
  if (data.hasStipend === "no") {
    // If without stipend, remove the Stipend bullet/line from the letter
    res = res.replace(/<p[^>]*>\s*(?:<span[^>]*>)?\s*<strong>\s*(?:Stipend|stipend)\s*<\/strong>\s*:[^<]*(?:<\/span>)?\s*<\/p>/gi, "");
    res = res.replace(/<p[^>]*>\s*(?:<span[^>]*>)?\s*(?:Stipend|stipend)\s*:[^<]*(?:<\/span>)?\s*<\/p>/gi, "");
    res = res.replace(/(?:Stipend|stipend)\s*:\s*(?:<strong>)?(?:[^<]+|<strong>.*?<\/strong>)*(?:<\/strong>)?(?:<br\s*\/?>)?/gi, "");
  } else if (data.stipend) {
    const formattedStipend = parseFloat(data.stipend || 0).toLocaleString("en-IN");
    res = res.replace(/(Stipend|stipend)\s*:\s*(<strong>)?(?:[^<]+|<strong>.*?<\/strong>)*(<\/strong>)?/gi, `Stipend : ₹${formattedStipend} per month`);
  }

  // Conditional Probation Period template section logic
  if (data.hasProbation === "no") {
    let normalized = res;
    // Split combined paragraphs separated by double line breaks into proper separate paragraph tags
    normalized = normalized.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, content) => {
      const parts = content.split(/<br\s*\/?>\s*<br\s*\/?>/i);
      return parts.map(part => `<p${attrs}>${part}</p>`).join("");
    });

    // 1. Remove heading containing "Probation Period" or "Probation" (allows nested tags and styles)
    normalized = normalized.replace(/<(h[1-6]|p|div)[^>]*>(?:(?!<\/\1>)[\s\S])*\bprobation\b(?:(?!<\/\1>)[\s\S])*<\/\1>\s*/gi, "");

    // 2. Remove paragraph/block containing probation details or placeholder keyword (allows nested tags and styles)
    normalized = normalized.replace(/<(p|div|li)[^>]*>(?:(?!<\/\1>)[\s\S])*(?:probationary period|probation period|subject to a probation|probationary period of|\{probationPeriod\})(?:(?!<\/\1>)[\s\S])*<\/\1>\s*/gi, "");

    // Clean up only standalone leftover empty tags from the probation deletion
    normalized = normalized.replace(/<p>\s*<\/p>\s*<p>\s*<\/p>/gi, "<p></p>");

    res = normalized;
  }

  // Convert newlines to break tags (skip if content is already HTML)
  if (!res.trim().startsWith('<')) {
    res = res.replace(/\n/g, '<br />');
  }

  return res;
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const AppointmentLetter = () => {
  const { user } = useUser();

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
        if (!sub || sub === "" || sub.includes("entiremenu") || sub.includes("appointment")) {
          return true;
        }
      }
      return false;
    });
  }, [user]);

  // Tab & letter type
  const [activeTab, setActiveTab] = useState("generate");
  const [letterType, setLetterType] = useState(null);

  // Custom template editor state
  const [editingTemplateType, setEditingTemplateType] = useState(null);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [templateTexts, setTemplateTexts] = useState({});
  const [tempEditorTexts, setTempEditorTexts] = useState({});
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // History table states
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedLetterId, setSelectedLetterId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);
  const [templateTextsBackup, setTemplateTextsBackup] = useState(null);
  const [showSelectTypeModal, setShowSelectTypeModal] = useState(false);
  const [showCreateSlipModal, setShowCreateSlipModal] = useState(false);
  const [hasSavedPreview, setHasSavedPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [letterToDelete, setLetterToDelete] = useState(null);
  const [isDeletingLetter, setIsDeletingLetter] = useState(false);
  const [jobTypeDropdownOpen, setJobTypeDropdownOpen] = useState(false);
  const [letterTypeDropdownOpen, setLetterTypeDropdownOpen] = useState(false);
  const [probationUnitDropdownOpen, setProbationUnitDropdownOpen] = useState(false);
  const [designationDropdownOpen, setDesignationDropdownOpen] = useState(false);
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const [reportingToDropdownOpen, setReportingToDropdownOpen] = useState(false);
  const [durationDropdownOpen, setDurationDropdownOpen] = useState(false);
  const [stipendOptionDropdownOpen, setStipendOptionDropdownOpen] = useState(false);
  const [workingHoursDropdownOpen, setWorkingHoursDropdownOpen] = useState(false);
  const [startAmPmDropdownOpen, setStartAmPmDropdownOpen] = useState(false);
  const [endAmPmDropdownOpen, setEndAmPmDropdownOpen] = useState(false);

  const [isCustomDesignation, setIsCustomDesignation] = useState(false);
  const [isCustomDepartment, setIsCustomDepartment] = useState(false);
  const [isCustomReportingTo, setIsCustomReportingTo] = useState(false);
  const [durationOption, setDurationOption] = useState("");
  const [workingHoursOption, setWorkingHoursOption] = useState("");
  const [customStartTime, setCustomStartTime] = useState("10:00");
  const [customStartAmPm, setCustomStartAmPm] = useState("AM");
  const [customEndTime, setCustomEndTime] = useState("06:30");
  const [customEndAmPm, setCustomEndAmPm] = useState("PM");

  const [employeesList, setEmployeesList] = useState([]);

  // Inline edit state for the preview popup
  const [inlineHasChanges, setInlineHasChanges] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [isGenerateMode, setIsGenerateMode] = useState(false); // true = Generate tab popup, false = Template preview popup
  const captureRef = React.useRef(null);
  const inlineEditRef = React.useRef(null); // visible editable div
  const generatingPDFRef = React.useRef(false);

  // Fetch employee & admin list from backend
  const fetchEmployeesList = async () => {
    try {
      const res = await portalInstance.get("/appointment/letter/employees");
      if (res.data?.success && res.data?.data) {
        setEmployeesList(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch employees list:", err);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchEmployeesList();
    }
  }, [isAuthorized]);

  const uniqueDesignations = useMemo(() => {
    const set = new Set();
    employeesList.forEach((e) => {
      if (e.designation && typeof e.designation === "string" && e.designation.trim() !== "") {
        set.add(e.designation.trim());
      }
    });
    return Array.from(set).sort();
  }, [employeesList]);

  const uniqueDepartments = useMemo(() => {
    const set = new Set();
    employeesList.forEach((e) => {
      if (e.department && typeof e.department === "string" && e.department.trim() !== "") {
        set.add(e.department.trim());
      }
    });
    return Array.from(set).sort();
  }, [employeesList]);

  const reportingToOptions = useMemo(() => {
    const set = new Set();
    employeesList.forEach((e) => {
      const name = e.employeeName || e.name;
      if (name && typeof name === "string" && name.trim() !== "") {
        set.add(name.trim());
      }
    });
    return Array.from(set).sort();
  }, [employeesList]);

  const closeAllDropdowns = () => {
    setJobTypeDropdownOpen(false);
    setLetterTypeDropdownOpen(false);
    setProbationUnitDropdownOpen(false);
    setDesignationDropdownOpen(false);
    setDepartmentDropdownOpen(false);
    setReportingToDropdownOpen(false);
    setDurationDropdownOpen(false);
    setStipendOptionDropdownOpen(false);
    setWorkingHoursDropdownOpen(false);
    setStartAmPmDropdownOpen(false);
    setEndAmPmDropdownOpen(false);
  };

  const toggleDropdown = (targetSetter, currentState) => {
    const nextState = !currentState;
    closeAllDropdowns();
    if (nextState) {
      targetSetter(true);
    }
  };

  // Reset all custom dropdown states when any modal opens/closes
  useEffect(() => {
    closeAllDropdowns();
  }, [showSelectTypeModal, showCreateSlipModal, showPreviewModal]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".custom-dropdown-container")) {
        closeAllDropdowns();
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  // Stipend formatting with commas
  const formatStipendDisplay = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const raw = String(val).replace(/,/g, "").replace(/[^\d.]/g, "");
    if (!raw) return "";
    const num = parseFloat(raw);
    return isNaN(num) ? "" : num.toLocaleString("en-IN");
  };

  const handleStipendChange = (e) => {
    const raw = e.target.value.replace(/,/g, "").replace(/[^\d.]/g, "");
    setFormData((prev) => ({ ...prev, stipend: raw }));
  };

  // Duration option & end date calculation helper
  const handleDurationOptionSelect = (option, startDateVal = formData.internshipStartDate) => {
    setDurationOption(option);
    if (option === "Custom") {
      setFormData((prev) => ({ ...prev, internshipDuration: prev.internshipDuration || "" }));
      return;
    }
    let months = 3;
    if (option === "1 Month") months = 1;
    if (option === "3 Months") months = 3;
    if (option === "6 Months") months = 6;

    const formattedDuration = `${months} Month${months > 1 ? "s" : ""}`;
    const startStr = startDateVal || new Date().toISOString().slice(0, 10);
    const startDate = new Date(startStr);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    setFormData((prev) => ({
      ...prev,
      internshipDuration: formattedDuration,
      internshipStartDate: startStr,
      internshipEndDate: endDate.toISOString().slice(0, 10),
    }));
  };

  const handleStartDateWithPreset = (startDateVal, currentOption = durationOption) => {
    if (currentOption === "Custom") {
      setFormData((prev) => ({ ...prev, internshipStartDate: startDateVal }));
      return;
    }
    handleDurationOptionSelect(currentOption, startDateVal);
  };

  // Unified form data for all letter types
  const [formData, setFormData] = useState({
    // Employee info
    employeeName: "",
    employeeEmail: "",
    employeePhone: "",
    // Common
    dateOfIssue: new Date().toISOString().slice(0, 10),
    designation: "",
    department: "",
    officeLocation: "",
    signatoryName: "Jayaprakash. R",
    signatoryTitle: "Director",
    // Appointment specific
    dateOfJoining: "",
    reportingTo: "Jayaprakash. R",
    monthlySalary: "",
    hasProbation: "yes",
    probationValue: "",
    probationUnit: "months",
    probationPeriod: "",
    ctc: "600000",
    // Internship specific
    internshipStartDate: new Date().toISOString().slice(0, 10),
    internshipDuration: "",
    hasStipend: "yes",
    stipend: "",
    workingHours: "",
    // Intern → Full-time specific
    internshipEndDate: "",
    convertedDesignation: "",
    convertedCtc: "600000",
    convertedJoiningDate: "",
    jobType: "Internship",
    includeKeyResponsibilities: false,
    includeAcknowledgment: false,
  });

  const letterTypeOptions = [
    { value: "internship", label: "Internship Offer Letter" },
    { value: "appointment", label: "Direct Appointment Letter" },
    { value: "intern-to-fulltime", label: "Intern to Full-Time Conversion" }
  ];

  // Load templates from Backend database
  useEffect(() => {
    if (!isAuthorized) return;

    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const res = await portalInstance.get("/appointment/letter/templates");
        if (res.data?.success && res.data?.data) {
          setTemplateTexts(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch templates from backend:", err);
        toast.error("Failed to load custom templates from server. Using defaults.");
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [isAuthorized]);

  // Load generated letters history list
  const fetchHistory = async (page = 1, limit = 50) => {
    if (!isAuthorized) return;
    try {
      setLoadingHistory(true);
      const res = await portalInstance.get(`/appointment/letter/history?page=${page}&limit=${limit}`);
      if (res.data?.success && res.data?.data) {
        setHistoryList(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch letters history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "generate") {
      setCurrentPage(1);
      fetchHistory(1, 50);
    }
  }, [isAuthorized, activeTab]);

  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(historyList.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [historyList.length, totalPages, currentPage]);

  const currentItems = useMemo(() => {
    const offset = (currentPage - 1) * pageSize;
    return historyList.slice(offset, offset + pageSize);
  }, [historyList, currentPage, pageSize]);

  // Delete a generated letter (DB record + S3 PDF)
  const handleDeleteConfirm = async () => {
    if (!letterToDelete) return;
    setIsDeletingLetter(true);
    try {
      await portalInstance.delete(`/appointment/letter/delete/${letterToDelete._id}`);
      toast.success("Letter deleted successfully.");
      setShowDeleteModal(false);
      setLetterToDelete(null);
      fetchHistory(currentPage, 50);
    } catch (err) {
      console.error("Failed to delete letter:", err);
      toast.error("Failed to delete letter. Please try again.");
    } finally {
      setIsDeletingLetter(false);
    }
  };

  // Dynamically set default signatory and jobType info based on letterType
  useEffect(() => {
    if (letterType === "appointment") {
      setFormData((prev) => ({
        ...prev,
        jobType: "Fulltime",
        signatoryName: "Jayaprakash. R",
        signatoryTitle: "Director",
      }));
    } else if (letterType === "intern-to-fulltime") {
      setFormData((prev) => ({
        ...prev,
        jobType: "Fulltime",
        signatoryName: "Jayaprakash",
        signatoryTitle: "Director",
      }));
    } else if (letterType === "internship") {
      setFormData((prev) => ({
        ...prev,
        jobType: "Internship",
        signatoryName: "Jayaprakash",
        signatoryTitle: "Director",
      }));
    }
  }, [letterType]);

  // Accurate calculation helper for Internship Duration based on start and end dates
  const calculateInternshipDuration = (startStr, endStr) => {
    if (!startStr || !endStr) return "";
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return "";

    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const dayDiff = end.getDate() - start.getDate();
    if (dayDiff >= 15) {
      months += 1;
    } else if (dayDiff < -15) {
      months -= 1;
    }

    if (months <= 0) {
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      months = Math.max(1, Math.round(diffDays / 30.4375));
    }

    return `${months} ${months === 1 ? "Month" : "Months"}`;
  };

  // Automatically calculate Internship Duration based on start and end dates
  useEffect(() => {
    if (letterType === "internship" && formData.internshipStartDate && formData.internshipEndDate) {
      const durationStr = calculateInternshipDuration(formData.internshipStartDate, formData.internshipEndDate);
      if (durationStr) {
        setFormData((prev) => {
          if (prev.internshipDuration !== durationStr) {
            return { ...prev, internshipDuration: durationStr };
          }
          return prev;
        });
      }
    }
  }, [letterType, formData.internshipStartDate, formData.internshipEndDate]);

  // CTC breakdown
  const salaryComponents = useMemo(() => {
    const ctcVal =
      letterType === "intern-to-fulltime" ? formData.convertedCtc : formData.ctc;
    const annualCTC = parseFloat(ctcVal) || 0;
    const monthlyCTC = Math.round(annualCTC / 12);
    const basic = Math.round(monthlyCTC * 0.5);
    const hra = Math.round(basic * 0.5);
    const specialAllowance = Math.max(0, monthlyCTC - (basic + hra));
    return {
      monthlyCTC,
      basic,
      hra,
      specialAllowance,
      annualBasic: basic * 12,
      annualHra: hra * 12,
      annualSpecial: specialAllowance * 12,
      annualCTC,
    };
  }, [formData.ctc, formData.convertedCtc, letterType]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  // Formats a raw numeric string into Indian comma notation (e.g. 1500000 → "15,00,000")
  const formatSalaryDisplay = (rawValue) => {
    const digits = String(rawValue).replace(/[^\d]/g, "");
    if (!digits) return "";
    const num = parseInt(digits, 10);
    return num.toLocaleString("en-IN");
  };

  // Handles salary input — strips commas, stores raw number, displays formatted
  const handleSalaryChange = (e) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    setFormData((prev) => ({ ...prev, monthlySalary: raw }));
  };

  // ── Template Editor Handlers ──────────────────────────────────────────────
  const handleStartCustomize = (type) => {
    setEditingTemplateType(type);
    setTempEditorTexts({ ...templateTexts[type] });
  };

  const handleEditorChange = (key, val) => {
    setTempEditorTexts((prev) => ({ ...prev, [key]: val }));
  };

  // Updated: accepts custom Page 2 settings from LetterTemplateEditor
  const handleSaveTemplate = async ({
    subject,
    html,
    keyResponsibilitiesText,
    keyResponsibilitiesFontSize,
    acknowledgmentText,
    acknowledgmentFontSize
  } = {}) => {
    try {
      let cleanHtml = html;

      if (
        cleanHtml === "<p></p>" ||
        cleanHtml === "<p><br></p>" ||
        cleanHtml?.trim() === ""
      ) {
        cleanHtml = "";
      }
      const payload = {
        letterType: editingTemplateType,
        subject,
        html: cleanHtml,
        keyResponsibilitiesText,
        keyResponsibilitiesFontSize,
        acknowledgmentText,
        acknowledgmentFontSize
      };
      const res = await portalInstance.put("/appointment/letter/templates", payload);
      if (res.data?.success) {
        setTemplateTexts((prev) => ({
          ...prev,
          [editingTemplateType]: {
            ...prev[editingTemplateType],
            subject,
            html: cleanHtml,
            customHtml: cleanHtml,
            isCustomized: true,
            keyResponsibilitiesText,
            keyResponsibilitiesFontSize,
            acknowledgmentText,
            acknowledgmentFontSize
          }
        }));
        setEditingTemplateType(null);
        toast.success("Custom template saved successfully!");
      }
    } catch (err) {
      console.error("Failed to save template to backend:", err);
      toast.error(err.response?.data?.message || "Failed to save template to server.");
    }
  };

  const handleSaveTemplateDirect = async () => {
    try {
      // If user edited via the unified textarea (content key), split back into body1...
      let textsToSave = { ...templateTexts[letterType] };
      if (textsToSave.content !== undefined) {
        // Split the unified content back into body/term keys
        const raw = textsToSave.content;
        delete textsToSave.content;
        const blocks = raw.split(/\n\n+/).map(b => b.trim()).filter(b => b.length > 0);
        // Find where Terms start
        const termsHeaderIdx = blocks.findIndex(b => /^Terms and Conditions:/i.test(b));
        let bodyBlocks = [];
        let termLines = [];
        if (termsHeaderIdx === -1) {
          bodyBlocks = blocks;
        } else {
          bodyBlocks = blocks.slice(0, termsHeaderIdx);
          const termsBlock = blocks.slice(termsHeaderIdx).join("\n\n");
          // Each line that starts with a number is a term
          const lines = termsBlock.split("\n").filter(l => l.trim() && !/^Terms and Conditions:/i.test(l));
          termLines = lines.map(l => l.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
        }
        bodyBlocks.forEach((b, i) => { textsToSave[`body${i + 1}`] = b; });
        termLines.forEach((t, i) => { textsToSave[`term${i + 1}`] = t; });
      }

      const res = await portalInstance.put("/appointment/letter/templates", {
        letterType: letterType,
        ...textsToSave
      });
      if (res.data?.success) {
        setTemplateTexts(prev => ({ ...prev, [letterType]: textsToSave }));
        setTemplateTextsBackup(JSON.parse(JSON.stringify(textsToSave)));
        setHasChanges(false);
        toast.success("Template saved successfully to database!");
      }
    } catch (err) {
      console.error("Failed to save template from modal:", err);
      toast.error(err.response?.data?.message || "Failed to save template to server.");
    }
  };

  const handleLiveEditorChange = (key, value) => {
    setTemplateTexts(prev => ({
      ...prev,
      [letterType]: {
        ...prev[letterType],
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const handleDeleteParagraphDirect = (keyToDelete) => {
    setTemplateTexts(prev => {
      const copy = { ...prev[letterType] };
      delete copy[keyToDelete];
      return {
        ...prev,
        [letterType]: copy
      };
    });
    setHasChanges(true);
    toast.info("Paragraph removed.");
  };

  const handleDeleteTermDirect = (keyToDelete) => {
    setTemplateTexts(prev => {
      const copy = { ...prev[letterType] };
      delete copy[keyToDelete];
      return {
        ...prev,
        [letterType]: copy
      };
    });
    setHasChanges(true);
    toast.info("Term clause removed.");
  };

  const handleAddParagraphDirect = () => {
    setTemplateTexts((prev) => {
      const currentTemplate = prev[letterType];
      const keys = Object.keys(currentTemplate).filter(k => k.startsWith("body"));
      let maxNum = 0;
      keys.forEach(k => {
        const num = parseInt(k.replace("body", "")) || 0;
        if (num > maxNum) maxNum = num;
      });
      const nextKey = `body${maxNum + 1}`;

      return {
        ...prev,
        [letterType]: {
          ...currentTemplate,
          [nextKey]: "New paragraph content. Edit me."
        }
      };
    });
    setHasChanges(true);
    toast.success("New paragraph added!");
  };

  const handleAddTermDirect = () => {
    setTemplateTexts((prev) => {
      const currentTemplate = prev[letterType];
      const keys = Object.keys(currentTemplate).filter(k => k.startsWith("term"));
      let maxNum = 0;
      keys.forEach(k => {
        const num = parseInt(k.replace("term", "")) || 0;
        if (num > maxNum) maxNum = num;
      });
      const nextKey = `term${maxNum + 1}`;

      return {
        ...prev,
        [letterType]: {
          ...currentTemplate,
          [nextKey]: "New term / clause content. Edit me."
        }
      };
    });
    setHasChanges(true);
    toast.success("New term/clause added!");
  };

  const handleResetTemplate = async () => {
    try {
      let tData = null;
      try {
        const res = await portalInstance.post("/appointment/letter/templates/reset", {
          letterType: editingTemplateType
        });
        if (res.data?.success && res.data?.data) {
          tData = res.data.data;
        }
      } catch (postErr) {
        console.warn("Template reset endpoint error:", postErr);
      }

      if (tData) {
        const defaultHtml = tData.defaultHtml || tData.html || '';
        setTemplateTexts((prev) => ({
          ...prev,
          [editingTemplateType]: {
            ...prev[editingTemplateType],
            subject: tData.subject || '',
            html: defaultHtml,
            customHtml: '',
            isCustomized: false,
            defaultHtml: defaultHtml,
            isDefault: true,
          }
        }));
        setTempEditorTexts({
          ...tData,
          html: defaultHtml,
          customHtml: '',
          defaultHtml: defaultHtml,
          isCustomized: false,
          isDefault: true,
        });
        setEditorResetKey((k) => k + 1);
        toast.success("Reset to original default template successfully!");
        return {
          ...tData,
          defaultHtml,
          html: defaultHtml,
          customHtml: '',
          isCustomized: false,
          isDefault: true,
        };
      } else {
        toast.error("Failed to reset template to default.");
      }
    } catch (err) {
      console.error("Failed to reset template:", err);
      toast.error("Failed to reset template to default.");
    }
  };

  const sortedEditorKeys = useMemo(() => {
    const keys = Object.keys(tempEditorTexts);
    const subjectKey = keys.filter(k => k === "subject");
    const bodyKeys = keys.filter(k => k.startsWith("body")).sort((a, b) => {
      const numA = parseInt(a.replace("body", "")) || 0;
      const numB = parseInt(b.replace("body", "")) || 0;
      return numA - numB;
    });
    const termKeys = keys.filter(k => k.startsWith("term")).sort((a, b) => {
      const numA = parseInt(a.replace("term", "")) || 0;
      const numB = parseInt(b.replace("term", "")) || 0;
      return numA - numB;
    });
    const closingKey = keys.filter(k => k === "closing");

    // Any remaining keys
    const otherKeys = keys.filter(k => k !== "subject" && k !== "closing" && !k.startsWith("body") && !k.startsWith("term"));

    return [...subjectKey, ...bodyKeys, ...termKeys, ...closingKey, ...otherKeys];
  }, [tempEditorTexts]);

  const handleDeleteField = (keyToDelete) => {
    setTempEditorTexts((prev) => {
      const copy = { ...prev };
      delete copy[keyToDelete];
      return copy;
    });
    toast.info(`Field deleted. Click 'Save Template' to commit.`);
  };

  const handleAddParagraph = () => {
    setTempEditorTexts((prev) => {
      const keys = Object.keys(prev).filter(k => k.startsWith("body"));
      let maxNum = 0;
      keys.forEach(k => {
        const num = parseInt(k.replace("body", "")) || 0;
        if (num > maxNum) maxNum = num;
      });
      const nextKey = `body${maxNum + 1}`;
      return {
        ...prev,
        [nextKey]: ""
      };
    });
    toast.success("New paragraph textarea added at the bottom!");
  };

  const handleAddTerm = () => {
    setTempEditorTexts((prev) => {
      const keys = Object.keys(prev).filter(k => k.startsWith("term"));
      let maxNum = 0;
      keys.forEach(k => {
        const num = parseInt(k.replace("term", "")) || 0;
        if (num > maxNum) maxNum = num;
      });
      const nextKey = `term${maxNum + 1}`;
      return {
        ...prev,
        [nextKey]: ""
      };
    });
    toast.success("New Term / Clause textarea added!");
  };

  // Updated: accepts { subject, html } from LetterTemplateEditor
  const handleEditorPreview = ({ subject, html } = {}) => {
    setIsCustomizeMode(false); // plain preview, not split-screen
    setIsGenerateMode(false);
    setTemplateTextsBackup(JSON.parse(JSON.stringify(templateTexts[editingTemplateType])));
    // Apply editor's current content temporarily for preview
    if (html !== undefined) {
      setTemplateTexts((prev) => ({
        ...prev,
        [editingTemplateType]: {
          ...prev[editingTemplateType],
          subject: subject || prev[editingTemplateType]?.subject,
          html
        }
      }));
    }
    setLetterType(editingTemplateType);
    setFormData((prev) => ({
      ...prev,
      employeeName: prev.employeeName || "",
      designation:
        editingTemplateType === "internship"
          ? "Software Intern"
          : editingTemplateType === "intern-to-fulltime"
            ? "Software Intern"
            : "Software Engineer",
      convertedDesignation: "Software Engineer",
      department: "IT",
      jobType: "Fulltime",
      reportingTo: "Jayaprakash R",
      monthlySalary: "5000",
      probationPeriod: "",
      probationValue: "",
      dateOfJoining: new Date().toISOString().slice(0, 10),
      internshipStartDate: new Date().toISOString().slice(0, 10),
      internshipEndDate: new Date().toISOString().slice(0, 10),
      convertedJoiningDate: new Date().toISOString().slice(0, 10),
      dateOfIssue: new Date().toISOString().slice(0, 10),
    }));
    setShowPreviewModal(true);
  };

  const getFieldLabel = (key) => {
    if (key === "subject") return "Letter Subject / Title";
    if (key.startsWith("body")) return `Paragraph ${key.replace("body", "")}`;
    if (key.startsWith("term")) return `Term / Clause ${key.replace("term", "")}`;
    if (key === "closing") return "Closing Paragraph";
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  const handleClosePreviewModal = () => {
    if (isCustomizeMode && templateTextsBackup) {
      setTemplateTexts((prev) => ({
        ...prev,
        [letterType]: templateTextsBackup
      }));
    }
    setShowPreviewModal(false);
    setHasChanges(false);
    setInlineHasChanges(false);
    setPreviewHtml(null);
    setIsGenerateMode(false);
    setTemplateTextsBackup(null);
  };

  // Capture rendered letter HTML for inline-editable preview
  // We render into a hidden div first, then set innerHTML on the editable div
  // (avoids React contentEditable + dangerouslySetInnerHTML conflict that shows raw tags)
  React.useEffect(() => {
    if (!showPreviewModal || isCustomizeMode) return;
    setPreviewHtml(null); // reset on every open
  }, [showPreviewModal, isCustomizeMode, letterType]);

  // ── Template preview (Settings tab) ─────────────────────────────────────
  const handleTemplatePreview = (type, isCustomize = false) => {
    setLetterType(type);
    setIsCustomizeMode(isCustomize);
    setTemplateTextsBackup(JSON.parse(JSON.stringify(templateTexts[type])));
    setFormData((prev) => ({
      ...prev,
      employeeName: prev.employeeName || "",
      designation:
        type === "internship"
          ? "Software Intern"
          : type === "intern-to-fulltime"
            ? "Software Intern"
            : "Software Engineer",
      convertedDesignation: "Software Engineer",
      department: "IT",
      jobType: "Fulltime",
      reportingTo: "Jayaprakash R",
      monthlySalary: "5000",
      probationPeriod: "",
      probationValue: "",
      hasProbation: "yes",
      dateOfJoining: new Date().toISOString().slice(0, 10),
      internshipStartDate: new Date().toISOString().slice(0, 10),
      internshipEndDate: new Date().toISOString().slice(0, 10),
      convertedJoiningDate: new Date().toISOString().slice(0, 10),
      dateOfIssue: new Date().toISOString().slice(0, 10),
    }));
    setIsGenerateMode(false); // template preview — no Generate Letter button
    setShowPreviewModal(true);
  };

  const handleInlineEditTemplate = (type) => {
    // Open the customize split-screen modal directly for editing the full content
    handleTemplatePreview(type, true);
  };

  // ── Centralized Form Validation ─────────────────────────────────────────
  const validateLetterFormData = (type, data) => {
    if (!type) {
      toast.error("Please select a letter type first.");
      return false;
    }

    const checkText = (val, fieldName, action = "enter", maxLen = 100) => {
      if (typeof val !== "string" || !val.trim()) {
        toast.error(`Please ${action} ${fieldName}.`);
        return false;
      }
      if (val.trim().length > maxLen) {
        toast.error(`${fieldName} must not exceed ${maxLen} characters.`);
        return false;
      }
      return true;
    };

    const checkSalary = (val, fieldName) => {
      if (!val && val !== 0) {
        toast.error(`Please enter ${fieldName}.`);
        return false;
      }
      const cleanVal = String(val || "").replace(/,/g, "").trim();
      const num = parseFloat(cleanVal);
      if (isNaN(num) || num <= 0) {
        toast.error(`Please enter a valid positive ${fieldName}.`);
        return false;
      }
      return true;
    };

    const checkDateSanity = (dateStr, fieldName) => {
      if (!dateStr || !String(dateStr).trim()) {
        toast.error(`Please select ${fieldName}.`);
        return false;
      }
      const d = new Date(dateStr);
      const year = d.getFullYear();
      if (isNaN(year) || year < 2000 || year > 2040) {
        toast.error(`Please select a valid date for ${fieldName}.`);
        return false;
      }
      return true;
    };

    // Ensure default signatory info is always present
    if (!data.signatoryName?.trim()) data.signatoryName = "Jayaprakash. R";
    if (!data.signatoryTitle?.trim()) data.signatoryTitle = "Director";

    // 1. Common Employee Information validations
    if (!checkText(data.employeeName, "Employee Full Name", "enter")) return false;
    if (!checkText(data.designation, "Designation", "select")) return false;
    if (!checkText(data.department, "Department", "select")) return false;
    if (!checkDateSanity(data.dateOfIssue, "Date of Issue")) return false;
    if (!checkText(data.reportingTo, "Reporting Manager", "select")) return false;

    // 2. Internship Offer Letter validation
    if (type === "internship") {
      if (!data.internshipDuration?.toString().trim()) {
        toast.error("Please select or enter Internship Duration.");
        return false;
      }
      if (data.hasStipend !== "no") {
        if (!checkSalary(data.stipend, "Monthly Stipend")) return false;
      }
      if (!checkDateSanity(data.internshipStartDate, "Internship Start Date")) return false;
      if (!checkDateSanity(data.internshipEndDate, "Internship End Date")) return false;
      if (!data.workingHours?.toString().trim()) {
        toast.error("Please select or enter Working Hours.");
        return false;
      }
    }

    // 3. Direct Appointment Letter validation
    if (type === "appointment") {
      if (!checkDateSanity(data.dateOfJoining, "Date of Joining")) return false;
      if (!checkSalary(data.monthlySalary, "Monthly Salary")) return false;
      if (data.hasProbation === "yes") {
        const probVal = parseInt(String(data.probationValue || data.probationPeriod || "").trim(), 10);
        if (isNaN(probVal) || probVal <= 0) {
          toast.error("Please enter a valid positive Probation Period.");
          return false;
        }
        if (!data.probationUnit?.trim()) {
          toast.error("Please select Probation Period Unit.");
          return false;
        }
      }
    }

    // 4. Intern to Full-Time Conversion Letter validation
    if (type === "intern-to-fulltime") {
      if (!checkDateSanity(data.convertedJoiningDate, "Effective From Date")) return false;
      if (!checkSalary(data.monthlySalary || data.convertedCtc, "Monthly Salary")) return false;
      if (data.hasProbation === "yes") {
        const probVal = parseInt(String(data.probationValue || data.probationPeriod || "").trim(), 10);
        if (isNaN(probVal) || probVal <= 0) {
          toast.error("Please enter a valid positive Probation Period.");
          return false;
        }
        if (!data.probationUnit?.trim()) {
          toast.error("Please select Probation Period Unit.");
          return false;
        }
      }
    }

    return true;
  };

  // ── Modal Form Confirm & Save ───────────────────────────────────────────
  const handleConfirmFormDetails = () => {
    if (!validateLetterFormData(letterType, formData)) return;

    setShowCreateSlipModal(false);
    setHasSavedPreview(false);
    setIsGenerateMode(true); // generate letter tab — show Generate Letter button
    setShowPreviewModal(true);
  };

  const handleSavePreviewDetails = () => {
    if (!validateLetterFormData(letterType, formData)) return;

    setHasSavedPreview(true);
    toast.success("Document preview updated successfully!");
  };

  const renderFormFields = () => {
    if (!letterType) {
      return (
        <div style={{ textAlign: "center", color: "#64748b", padding: "40px 0" }}>
          Please select a letter type above to load the details form.
        </div>
      );
    }

    return (
      <div className="al-form-grid">
        <div className="al-form-section">
          {/* Employee Info */}
          <h4 className="al-form-section-title">
            <Icon icon="lucide:user" width="14" /> Employee Information
          </h4>
          <div className="al-form-row">
            <div className="al-form-group" style={{ gridColumn: "span 2" }}>
              <label>Full Name <span className="al-required">*</span></label>
              <input
                name="employeeName"
                value={formData.employeeName}
                onChange={handleInputChange}
                placeholder="Employee full name"
              />
            </div>
          </div>

          <div className="al-form-row">
            <div className="al-form-group">
              <label>Designation <span className="al-required">*</span></label>
              <div className={`custom-dropdown-container ${designationDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "100%" }}>
                <div
                  className={`custom-dropdown-trigger ${designationDropdownOpen ? "open" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown(setDesignationDropdownOpen, designationDropdownOpen);
                  }}
                  style={{ padding: "8px 12px", height: "40px" }}
                >
                  <span style={{ color: "#334155" }}>
                    {isCustomDesignation ? "Custom" : (formData.designation || "Select Designation")}
                  </span>
                  <Icon icon="lucide:chevron-down" className={`dropdown-arrow-icon ${designationDropdownOpen ? "rotate" : ""}`} style={{ color: "#64748b", width: "16px", height: "16px" }} />
                </div>
                {designationDropdownOpen && (
                  <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute", maxHeight: "200px", overflowY: "auto" }}>
                    {uniqueDesignations.map((desig) => (
                      <div
                        key={desig}
                        className={`custom-dropdown-option ${!isCustomDesignation && formData.designation === desig ? "selected" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCustomDesignation(false);
                          setFormData((prev) => ({ ...prev, designation: desig }));
                          setDesignationDropdownOpen(false);
                        }}
                      >
                        {desig}
                      </div>
                    ))}
                    <div
                      className={`custom-dropdown-option ${isCustomDesignation ? "selected" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCustomDesignation(true);
                        setFormData((prev) => ({ ...prev, designation: "" }));
                        setDesignationDropdownOpen(false);
                      }}
                    >
                      Custom
                    </div>
                  </div>
                )}
              </div>
              {isCustomDesignation && (
                <input
                  style={{ marginTop: "8px" }}
                  name="designation"
                  value={formData.designation}
                  onChange={handleInputChange}
                  placeholder="Enter custom designation"
                />
              )}
            </div>

            <div className="al-form-group">
              <label>Department <span className="al-required">*</span></label>
              <div className={`custom-dropdown-container ${departmentDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "100%" }}>
                <div
                  className={`custom-dropdown-trigger ${departmentDropdownOpen ? "open" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown(setDepartmentDropdownOpen, departmentDropdownOpen);
                  }}
                  style={{ padding: "8px 12px", height: "40px" }}
                >
                  <span style={{ color: "#334155" }}>
                    {isCustomDepartment ? "Custom" : (formData.department || "Select Department")}
                  </span>
                  <Icon icon="lucide:chevron-down" className={`dropdown-arrow-icon ${departmentDropdownOpen ? "rotate" : ""}`} style={{ color: "#64748b", width: "16px", height: "16px" }} />
                </div>
                {departmentDropdownOpen && (
                  <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute", maxHeight: "200px", overflowY: "auto" }}>
                    {uniqueDepartments.map((dept) => (
                      <div
                        key={dept}
                        className={`custom-dropdown-option ${!isCustomDepartment && formData.department === dept ? "selected" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCustomDepartment(false);
                          setFormData((prev) => ({ ...prev, department: dept }));
                          setDepartmentDropdownOpen(false);
                        }}
                      >
                        {dept}
                      </div>
                    ))}
                    <div
                      className={`custom-dropdown-option ${isCustomDepartment ? "selected" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCustomDepartment(true);
                        setFormData((prev) => ({ ...prev, department: "" }));
                        setDepartmentDropdownOpen(false);
                      }}
                    >
                      Custom
                    </div>
                  </div>
                )}
              </div>
              {isCustomDepartment && (
                <input
                  style={{ marginTop: "8px" }}
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  placeholder="Enter custom department"
                />
              )}
            </div>
          </div>

          {/* Letter Details — varies by type */}
          <h4 className="al-form-section-title" style={{ marginTop: "24px" }}>
            <Icon icon="lucide:file-text" width="14" /> Letter Details
          </h4>

          {letterType === "appointment" && (
            <>
              <div className="al-form-row">
                <div className="al-form-group">
                  <label>Date of Issue</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
                    <input
                      type="date"
                      name="dateOfIssue"
                      value={formData.dateOfIssue}
                      onChange={handleInputChange}
                      style={{ width: "100%", paddingRight: "35px" }}
                    />
                    <img
                      src="/Calander.svg"
                      alt="calendar"
                      style={{
                        position: "absolute",
                        right: "12px",
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                        zIndex: 2
                      }}
                      onClick={(e) => {
                        const inputEl = e.currentTarget.parentElement.querySelector('input');
                        if (inputEl && typeof inputEl.showPicker === 'function') {
                          inputEl.showPicker();
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="al-form-group">
                  <label>Job Type</label>
                  <div className="custom-dropdown-container" style={{ width: "100%" }}>
                    <div
                      className="custom-dropdown-trigger"
                      style={{ padding: "8px 12px", height: "40px", background: "#f8fafc", cursor: "default" }}
                    >
                      <span style={{ color: "#334155", fontWeight: "600" }}>Full Time</span>
                      <Icon icon="lucide:lock" style={{ color: "#94a3b8", width: "16px", height: "16px" }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="al-form-row">
                <div className="al-form-group">
                  <label>Date of Joining</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
                    <input
                      type="date"
                      name="dateOfJoining"
                      value={formData.dateOfJoining}
                      onChange={handleInputChange}
                      style={{ width: "100%", paddingRight: "35px" }}
                    />
                    <img
                      src="/Calander.svg"
                      alt="calendar"
                      style={{
                        position: "absolute",
                        right: "12px",
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                        zIndex: 2
                      }}
                      onClick={(e) => {
                        const inputEl = e.currentTarget.parentElement.querySelector('input');
                        if (inputEl && typeof inputEl.showPicker === 'function') {
                          inputEl.showPicker();
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="al-form-group">
                  <label>Reporting To <span className="al-required">*</span></label>
                  <div className={`custom-dropdown-container ${reportingToDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "100%" }}>
                    <div
                      className={`custom-dropdown-trigger ${reportingToDropdownOpen ? "open" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(setReportingToDropdownOpen, reportingToDropdownOpen);
                      }}
                      style={{ padding: "8px 12px", height: "40px" }}
                    >
                      <span style={{ color: "#334155" }}>
                        {isCustomReportingTo ? "Custom" : (formData.reportingTo || "Select Reporting Manager")}
                      </span>
                      <Icon icon="lucide:chevron-down" className={`dropdown-arrow-icon ${reportingToDropdownOpen ? "rotate" : ""}`} style={{ color: "#64748b", width: "16px", height: "16px" }} />
                    </div>
                    {reportingToDropdownOpen && (
                      <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute", maxHeight: "200px", overflowY: "auto" }}>
                        {reportingToOptions.map((name) => (
                          <div
                            key={name}
                            className={`custom-dropdown-option ${!isCustomReportingTo && formData.reportingTo === name ? "selected" : ""}`}
                            onClick={() => {
                              setIsCustomReportingTo(false);
                              setFormData((prev) => ({ ...prev, reportingTo: name }));
                              setReportingToDropdownOpen(false);
                            }}
                          >
                            {name}
                          </div>
                        ))}
                        <div
                          className={`custom-dropdown-option ${isCustomReportingTo ? "selected" : ""}`}
                          onClick={() => {
                            setIsCustomReportingTo(true);
                            setReportingToDropdownOpen(false);
                          }}
                        >
                          Custom
                        </div>
                      </div>
                    )}
                  </div>
                  {isCustomReportingTo && (
                    <input
                      style={{ marginTop: "8px" }}
                      name="reportingTo"
                      value={formData.reportingTo}
                      onChange={handleInputChange}
                      placeholder="Enter manager name"
                    />
                  )}
                </div>
              </div>
              <div className="al-form-row">
                <div className="al-form-group">
                  <label>Monthly Salary (₹)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="monthlySalary"
                    value={formatSalaryDisplay(formData.monthlySalary)}
                    onChange={handleSalaryChange}
                    placeholder="e.g. 15,000"
                  />
                </div>
                <div className="al-form-group" style={{ gridColumn: "span 2" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
                    <label style={{ margin: 0, fontWeight: "600", fontSize: "14px" }}>Probation Period</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "13px" }}>
                        <input
                          type="radio"
                          name="hasProbation"
                          value="yes"
                          checked={formData.hasProbation === "yes"}
                          onChange={handleInputChange}
                        />
                        Yes
                      </label>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "13px" }}>
                        <input
                          type="radio"
                          name="hasProbation"
                          value="no"
                          checked={formData.hasProbation === "no" || !formData.hasProbation}
                          onChange={handleInputChange}
                        />
                        No
                      </label>
                    </div>
                  </div>

                  {formData.hasProbation === "yes" && (
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <input
                        type="number"
                        name="probationValue"
                        value={formData.probationValue !== undefined ? formData.probationValue : (formData.probationPeriod || "")}
                        onChange={handleInputChange}
                        placeholder="e.g. 6"
                        style={{ flex: 1 }}
                      />
                      <div className={`custom-dropdown-container ${probationUnitDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "110px" }}>
                        <div
                          className={`custom-dropdown-trigger ${probationUnitDropdownOpen ? "open" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDropdown(setProbationUnitDropdownOpen, probationUnitDropdownOpen);
                          }}
                          style={{ padding: "8px 12px", height: "40px", borderRadius: "8px", border: "1px solid #1F1F1F1F" }}
                        >
                          <span style={{ color: "#1e293b", fontSize: "13px" }}>
                            {formData.probationUnit === "years" ? "Years" : "Months"}
                          </span>
                          <Icon
                            icon="lucide:chevron-down"
                            className={`dropdown-arrow-icon ${probationUnitDropdownOpen ? "rotate" : ""}`}
                            style={{ color: "#64748b", width: "16px", height: "16px" }}
                          />
                        </div>
                        {probationUnitDropdownOpen && (
                          <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute" }}>
                            <div
                              className={`custom-dropdown-option ${formData.probationUnit !== "years" ? "selected" : ""}`}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, probationUnit: "months" }));
                                setProbationUnitDropdownOpen(false);
                              }}
                            >
                              Months
                            </div>
                            <div
                              className={`custom-dropdown-option ${formData.probationUnit === "years" ? "selected" : ""}`}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, probationUnit: "years" }));
                                setProbationUnitDropdownOpen(false);
                              }}
                            >
                              Years
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="al-form-row">
                <div className="al-form-group" style={{ gridColumn: "span 2", display: "flex", gap: "10px", marginTop: "10px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}>
                    <input
                      type="checkbox"
                      name="includeKeyResponsibilities"
                      checked={!!formData.includeKeyResponsibilities}
                      onChange={handleInputChange}
                    />
                    Include Key Responsibilities
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}>
                    <input
                      type="checkbox"
                      name="includeAcknowledgment"
                      checked={!!formData.includeAcknowledgment}
                      onChange={handleInputChange}
                    />
                    Include Acknowledgment &amp; Acceptance
                  </label>
                </div>
              </div>
            </>
          )}

          {letterType === "internship" && (
            <>
              <div className="al-form-row">
                <div className="al-form-group" style={{ gridColumn: "span 2" }}>
                  <label>Date of Issue</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
                    <input
                      type="date"
                      name="dateOfIssue"
                      value={formData.dateOfIssue}
                      onChange={handleInputChange}
                      style={{ width: "100%", paddingRight: "35px" }}
                    />
                    <img
                      src="/Calander.svg"
                      alt="calendar"
                      style={{
                        position: "absolute",
                        right: "12px",
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                        zIndex: 2
                      }}
                      onClick={(e) => {
                        const inputEl = e.currentTarget.parentElement.querySelector('input');
                        if (inputEl && typeof inputEl.showPicker === 'function') {
                          inputEl.showPicker();
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="al-form-row">
                <div className="al-form-group">
                  <label>Internship Duration <span className="al-required">*</span></label>
                  <div className={`custom-dropdown-container ${durationDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "100%" }}>
                    <div
                      className={`custom-dropdown-trigger ${durationDropdownOpen ? "open" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(setDurationDropdownOpen, durationDropdownOpen);
                      }}
                      style={{ padding: "8px 12px", height: "40px" }}
                    >
                      <span style={{ color: "#334155" }}>
                        {durationOption === "Custom"
                        ? (formData.internshipDuration ? `Custom (${formData.internshipDuration})` : "Custom")
                        : (durationOption || "Select Duration")}
                      </span>
                      <Icon icon="lucide:chevron-down" className={`dropdown-arrow-icon ${durationDropdownOpen ? "rotate" : ""}`} style={{ color: "#64748b", width: "16px", height: "16px" }} />
                    </div>
                    {durationDropdownOpen && (
                      <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute" }}>
                        {["1 Month", "3 Months", "6 Months", "Custom"].map((opt) => (
                          <div
                            key={opt}
                            className={`custom-dropdown-option ${durationOption === opt ? "selected" : ""}`}
                            onClick={() => {
                              handleDurationOptionSelect(opt);
                              setDurationDropdownOpen(false);
                            }}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="al-form-group">
                  <label>Stipend Option <span className="al-required">*</span></label>
                  <div className={`custom-dropdown-container ${stipendOptionDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "100%" }}>
                    <div
                      className={`custom-dropdown-trigger ${stipendOptionDropdownOpen ? "open" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(setStipendOptionDropdownOpen, stipendOptionDropdownOpen);
                      }}
                      style={{ padding: "8px 12px", height: "40px" }}
                    >
                      <span style={{ color: "#334155" }}>
                        {formData.hasStipend === "no" ? "Without Stipend (Unpaid)" : "With Stipend"}
                      </span>
                      <Icon icon="lucide:chevron-down" className={`dropdown-arrow-icon ${stipendOptionDropdownOpen ? "rotate" : ""}`} style={{ color: "#64748b", width: "16px", height: "16px" }} />
                    </div>
                    {stipendOptionDropdownOpen && (
                      <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute" }}>
                        <div
                          className={`custom-dropdown-option ${formData.hasStipend !== "no" ? "selected" : ""}`}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, hasStipend: "yes" }));
                            setStipendOptionDropdownOpen(false);
                          }}
                        >
                          With Stipend
                        </div>
                        <div
                          className={`custom-dropdown-option ${formData.hasStipend === "no" ? "selected" : ""}`}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, hasStipend: "no", stipend: "" }));
                            setStipendOptionDropdownOpen(false);
                          }}
                        >
                          Without Stipend (Unpaid)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {formData.hasStipend !== "no" && (
                <div className="al-form-row">
                  <div className="al-form-group" style={{ gridColumn: "span 2" }}>
                    <label>Monthly Stipend (₹) <span className="al-required">*</span></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      name="stipend"
                      value={formatStipendDisplay(formData.stipend)}
                      onChange={handleStipendChange}
                      placeholder="5,000"
                    />
                  </div>
                </div>
              )}

              <div className="al-form-row">
                <div className="al-form-group">
                  <label>Internship Start Date <span className="al-required">*</span></label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
                    <input
                      type="date"
                      name="internshipStartDate"
                      value={formData.internshipStartDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (durationOption === "Custom") {
                          const calc = calculateInternshipDuration(val, formData.internshipEndDate);
                          setFormData((prev) => ({
                            ...prev,
                            internshipStartDate: val,
                            ...(calc ? { internshipDuration: calc } : {})
                          }));
                        } else {
                          handleStartDateWithPreset(val, durationOption);
                        }
                      }}
                      style={{ width: "100%", paddingRight: "35px" }}
                    />
                    <img
                      src="/Calander.svg"
                      alt="calendar"
                      style={{ position: "absolute", right: "12px", width: "16px", height: "16px", cursor: "pointer", zIndex: 2 }}
                      onClick={(e) => {
                        const inputEl = e.currentTarget.parentElement.querySelector('input');
                        if (inputEl && typeof inputEl.showPicker === 'function') inputEl.showPicker();
                      }}
                    />
                  </div>
                </div>
                <div className="al-form-group">
                  <label>Internship End Date <span className="al-required">*</span></label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
                    <input
                      type="date"
                      name="internshipEndDate"
                      value={formData.internshipEndDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        const calc = calculateInternshipDuration(formData.internshipStartDate, val);
                        setFormData((prev) => ({
                          ...prev,
                          internshipEndDate: val,
                          ...(calc ? { internshipDuration: calc } : {})
                        }));
                      }}
                      style={{ width: "100%", paddingRight: "35px" }}
                    />
                    <img
                      src="/Calander.svg"
                      alt="calendar"
                      style={{ position: "absolute", right: "12px", width: "16px", height: "16px", cursor: "pointer", zIndex: 2 }}
                      onClick={(e) => {
                        const inputEl = e.currentTarget.parentElement.querySelector('input');
                        if (inputEl && typeof inputEl.showPicker === 'function') inputEl.showPicker();
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="al-form-row">
                <div className="al-form-group">
                  <label>Job Type</label>
                  <div className="custom-dropdown-container" style={{ width: "100%" }}>
                    <div
                      className="custom-dropdown-trigger"
                      style={{ padding: "8px 12px", height: "40px", background: "#f8fafc", cursor: "default" }}
                    >
                      <span style={{ color: "#334155", fontWeight: "600" }}>Internship</span>
                      <Icon icon="lucide:lock" style={{ color: "#94a3b8", width: "16px", height: "16px" }} />
                    </div>
                  </div>
                </div>

                <div className="al-form-group">
                  <label>Reporting To <span className="al-required">*</span></label>
                  <div className={`custom-dropdown-container ${reportingToDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "100%" }}>
                    <div
                      className={`custom-dropdown-trigger ${reportingToDropdownOpen ? "open" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(setReportingToDropdownOpen, reportingToDropdownOpen);
                      }}
                      style={{ padding: "8px 12px", height: "40px" }}
                    >
                      <span style={{ color: "#334155" }}>
                        {isCustomReportingTo ? "Custom" : (formData.reportingTo || "Select Reporting Manager")}
                      </span>
                      <Icon icon="lucide:chevron-down" className={`dropdown-arrow-icon ${reportingToDropdownOpen ? "rotate" : ""}`} style={{ color: "#64748b", width: "16px", height: "16px" }} />
                    </div>
                    {reportingToDropdownOpen && (
                      <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute", maxHeight: "200px", overflowY: "auto" }}>
                        {reportingToOptions.map((name) => (
                          <div
                            key={name}
                            className={`custom-dropdown-option ${!isCustomReportingTo && formData.reportingTo === name ? "selected" : ""}`}
                            onClick={() => {
                              setIsCustomReportingTo(false);
                              setFormData((prev) => ({ ...prev, reportingTo: name }));
                              setReportingToDropdownOpen(false);
                            }}
                          >
                            {name}
                          </div>
                        ))}
                        <div
                          className={`custom-dropdown-option ${isCustomReportingTo ? "selected" : ""}`}
                          onClick={() => {
                            setIsCustomReportingTo(true);
                            setReportingToDropdownOpen(false);
                          }}
                        >
                          Custom
                        </div>
                      </div>
                    )}
                  </div>
                  {isCustomReportingTo && (
                    <input
                      style={{ marginTop: "8px" }}
                      name="reportingTo"
                      value={formData.reportingTo}
                      onChange={handleInputChange}
                      placeholder="Enter manager name"
                    />
                  )}
                </div>
              </div>

              <div className="al-form-row">
                <div className="al-form-group" style={{ gridColumn: "span 2" }}>
                  <label>Working Hours</label>
                  <div className={`custom-dropdown-container ${workingHoursDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "100%" }}>
                    <div
                      className={`custom-dropdown-trigger ${workingHoursDropdownOpen ? "open" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(setWorkingHoursDropdownOpen, workingHoursDropdownOpen);
                      }}
                      style={{ padding: "8px 12px", height: "40px" }}
                    >
                      <span style={{ color: workingHoursOption ? "#334155" : "#94a3b8" }}>
                        {workingHoursOption || "Select Working Hours"}
                      </span>
                      <Icon icon="lucide:chevron-down" className={`dropdown-arrow-icon ${workingHoursDropdownOpen ? "rotate" : ""}`} style={{ color: "#64748b", width: "16px", height: "16px" }} />
                    </div>
                    {workingHoursDropdownOpen && (
                      <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute" }}>
                        {["10:00 AM to 06:30 PM", "09:30 AM to 06:00 PM", "09:00 AM to 05:30 PM", "Custom"].map((opt) => (
                          <div
                            key={opt}
                            className={`custom-dropdown-option ${workingHoursOption === opt ? "selected" : ""}`}
                            onClick={() => {
                              setWorkingHoursOption(opt);
                              setWorkingHoursDropdownOpen(false);
                              if (opt !== "Custom") {
                                setFormData((prev) => ({ ...prev, workingHours: opt }));
                              } else {
                                setFormData((prev) => ({
                                  ...prev,
                                  workingHours: `${customStartTime} ${customStartAmPm} to ${customEndTime} ${customEndAmPm}`
                                }));
                              }
                            }}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {workingHoursOption === "Custom" && (
                    <div className="al-form-row" style={{ marginTop: "12px" }}>
                      <div className="al-form-group">
                        <label>Start Time</label>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            style={{ flex: 1 }}
                            type="text"
                            value={customStartTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomStartTime(val);
                              setFormData((prev) => ({ ...prev, workingHours: `${val} ${customStartAmPm} to ${customEndTime} ${customEndAmPm}` }));
                            }}
                            placeholder="e.g. 10:00"
                          />
                          <div className={`custom-dropdown-container ${startAmPmDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "90px" }}>
                            <div
                              className={`custom-dropdown-trigger ${startAmPmDropdownOpen ? "open" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDropdown(setStartAmPmDropdownOpen, startAmPmDropdownOpen);
                              }}
                              style={{ padding: "8px 12px", height: "40px" }}
                            >
                              <span style={{ color: "#334155" }}>{customStartAmPm}</span>
                              <Icon icon="lucide:chevron-down" className={`dropdown-arrow-icon ${startAmPmDropdownOpen ? "rotate" : ""}`} style={{ color: "#64748b", width: "16px", height: "16px" }} />
                            </div>
                            {startAmPmDropdownOpen && (
                              <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute" }}>
                                {["AM", "PM"].map((opt) => (
                                  <div
                                    key={opt}
                                    className={`custom-dropdown-option ${customStartAmPm === opt ? "selected" : ""}`}
                                    onClick={() => {
                                      setCustomStartAmPm(opt);
                                      setStartAmPmDropdownOpen(false);
                                      setFormData((prev) => ({ ...prev, workingHours: `${customStartTime} ${opt} to ${customEndTime} ${customEndAmPm}` }));
                                    }}
                                  >
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="al-form-group">
                        <label>End Time</label>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            style={{ flex: 1 }}
                            type="text"
                            value={customEndTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomEndTime(val);
                              setFormData((prev) => ({ ...prev, workingHours: `${customStartTime} ${customStartAmPm} to ${val} ${customEndAmPm}` }));
                            }}
                            placeholder="e.g. 06:30"
                          />
                          <div className={`custom-dropdown-container ${endAmPmDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "90px" }}>
                            <div
                              className={`custom-dropdown-trigger ${endAmPmDropdownOpen ? "open" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDropdown(setEndAmPmDropdownOpen, endAmPmDropdownOpen);
                              }}
                              style={{ padding: "8px 12px", height: "40px" }}
                            >
                              <span style={{ color: "#334155" }}>{customEndAmPm}</span>
                              <Icon icon="lucide:chevron-down" className={`dropdown-arrow-icon ${endAmPmDropdownOpen ? "rotate" : ""}`} style={{ color: "#64748b", width: "16px", height: "16px" }} />
                            </div>
                            {endAmPmDropdownOpen && (
                              <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute" }}>
                                {["AM", "PM"].map((opt) => (
                                  <div
                                    key={opt}
                                    className={`custom-dropdown-option ${customEndAmPm === opt ? "selected" : ""}`}
                                    onClick={() => {
                                      setCustomEndAmPm(opt);
                                      setEndAmPmDropdownOpen(false);
                                      setFormData((prev) => ({ ...prev, workingHours: `${customStartTime} ${customStartAmPm} to ${customEndTime} ${opt}` }));
                                    }}
                                  >
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="al-form-row">
                <div className="al-form-group" style={{ gridColumn: "span 2", display: "flex", gap: "10px", marginTop: "10px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}>
                    <input
                      type="checkbox"
                      name="includeKeyResponsibilities"
                      checked={!!formData.includeKeyResponsibilities}
                      onChange={handleInputChange}
                    />
                    Include Key Responsibilities
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}>
                    <input
                      type="checkbox"
                      name="includeAcknowledgment"
                      checked={!!formData.includeAcknowledgment}
                      onChange={handleInputChange}
                    />
                    Include Acknowledgment &amp; Acceptance
                  </label>
                </div>
              </div>
            </>
          )}

          {letterType === "intern-to-fulltime" && (
            <>
              <div className="al-form-row">
                <div className="al-form-group">
                  <label>Date of Issue</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
                    <input
                      type="date"
                      name="dateOfIssue"
                      value={formData.dateOfIssue}
                      onChange={handleInputChange}
                      style={{ width: "100%", paddingRight: "35px" }}
                    />
                    <img
                      src="/Calander.svg"
                      alt="calendar"
                      style={{
                        position: "absolute",
                        right: "12px",
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                        zIndex: 2
                      }}
                      onClick={(e) => {
                        const inputEl = e.currentTarget.parentElement.querySelector('input');
                        if (inputEl && typeof inputEl.showPicker === 'function') {
                          inputEl.showPicker();
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="al-form-group">
                  <label>Effective From Date</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
                    <input
                      type="date"
                      name="convertedJoiningDate"
                      value={formData.convertedJoiningDate}
                      onChange={handleInputChange}
                      style={{ width: "100%", paddingRight: "35px" }}
                    />
                    <img
                      src="/Calander.svg"
                      alt="calendar"
                      style={{
                        position: "absolute",
                        right: "12px",
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                        zIndex: 2
                      }}
                      onClick={(e) => {
                        const inputEl = e.currentTarget.parentElement.querySelector('input');
                        if (inputEl && typeof inputEl.showPicker === 'function') {
                          inputEl.showPicker();
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="al-form-row">
                <div className="al-form-group">
                  <label>Job Type</label>
                  <div className="custom-dropdown-container" style={{ width: "100%" }}>
                    <div
                      className="custom-dropdown-trigger"
                      style={{ padding: "8px 12px", height: "40px", background: "#f8fafc", cursor: "default" }}
                    >
                      <span style={{ color: "#334155", fontWeight: "600" }}>Full Time</span>
                      <Icon icon="lucide:lock" style={{ color: "#94a3b8", width: "16px", height: "16px" }} />
                    </div>
                  </div>
                </div>
                <div className="al-form-group">
                  <label>Reporting To <span className="al-required">*</span></label>
                  <div className={`custom-dropdown-container ${reportingToDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "100%" }}>
                    <div
                      className={`custom-dropdown-trigger ${reportingToDropdownOpen ? "open" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(setReportingToDropdownOpen, reportingToDropdownOpen);
                      }}
                      style={{ padding: "8px 12px", height: "40px" }}
                    >
                      <span style={{ color: "#334155" }}>
                        {isCustomReportingTo ? "Custom" : (formData.reportingTo || "Select Reporting Manager")}
                      </span>
                      <Icon icon="lucide:chevron-down" className={`dropdown-arrow-icon ${reportingToDropdownOpen ? "rotate" : ""}`} style={{ color: "#64748b", width: "16px", height: "16px" }} />
                    </div>
                    {reportingToDropdownOpen && (
                      <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute", maxHeight: "200px", overflowY: "auto" }}>
                        {reportingToOptions.map((name) => (
                          <div
                            key={name}
                            className={`custom-dropdown-option ${!isCustomReportingTo && formData.reportingTo === name ? "selected" : ""}`}
                            onClick={() => {
                              setIsCustomReportingTo(false);
                              setFormData((prev) => ({ ...prev, reportingTo: name }));
                              setReportingToDropdownOpen(false);
                            }}
                          >
                            {name}
                          </div>
                        ))}
                        <div
                          className={`custom-dropdown-option ${isCustomReportingTo ? "selected" : ""}`}
                          onClick={() => {
                            setIsCustomReportingTo(true);
                            setReportingToDropdownOpen(false);
                          }}
                        >
                          Custom
                        </div>
                      </div>
                    )}
                  </div>
                  {isCustomReportingTo && (
                    <input
                      style={{ marginTop: "8px" }}
                      name="reportingTo"
                      value={formData.reportingTo}
                      onChange={handleInputChange}
                      placeholder="Enter manager name"
                    />
                  )}
                </div>
              </div>
              <div className="al-form-row">
                <div className="al-form-group">
                  <label>Monthly Salary (₹)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="monthlySalary"
                    value={formatSalaryDisplay(formData.monthlySalary)}
                    onChange={handleSalaryChange}
                    placeholder="e.g. 15,000"
                  />
                </div>
                <div className="al-form-group" style={{ gridColumn: "span 2" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
                    <label style={{ margin: 0, fontWeight: "600", fontSize: "14px" }}>Probation Period</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "13px" }}>
                        <input
                          type="radio"
                          name="hasProbation"
                          value="yes"
                          checked={formData.hasProbation === "yes"}
                          onChange={handleInputChange}
                        />
                        Yes
                      </label>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "13px" }}>
                        <input
                          type="radio"
                          name="hasProbation"
                          value="no"
                          checked={formData.hasProbation === "no" || !formData.hasProbation}
                          onChange={handleInputChange}
                        />
                        No
                      </label>
                    </div>
                  </div>

                  {formData.hasProbation === "yes" && (
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <input
                        type="number"
                        name="probationValue"
                        value={formData.probationValue !== undefined ? formData.probationValue : (formData.probationPeriod || "")}
                        onChange={handleInputChange}
                        placeholder="e.g. 6"
                        style={{ flex: 1 }}
                      />
                      <div className={`custom-dropdown-container ${probationUnitDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "110px" }}>
                        <div
                          className={`custom-dropdown-trigger ${probationUnitDropdownOpen ? "open" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDropdown(setProbationUnitDropdownOpen, probationUnitDropdownOpen);
                          }}
                          style={{ padding: "8px 12px", height: "40px", borderRadius: "8px", border: "1px solid #1F1F1F1F" }}
                        >
                          <span style={{ color: "#1e293b", fontSize: "13px" }}>
                            {formData.probationUnit === "years" ? "Years" : "Months"}
                          </span>
                          <Icon
                            icon="lucide:chevron-down"
                            className={`dropdown-arrow-icon ${probationUnitDropdownOpen ? "rotate" : ""}`}
                            style={{ color: "#64748b", width: "16px", height: "16px" }}
                          />
                        </div>
                        {probationUnitDropdownOpen && (
                          <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute" }}>
                            <div
                              className={`custom-dropdown-option ${formData.probationUnit !== "years" ? "selected" : ""}`}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, probationUnit: "months" }));
                                setProbationUnitDropdownOpen(false);
                              }}
                            >
                              Months
                            </div>
                            <div
                              className={`custom-dropdown-option ${formData.probationUnit === "years" ? "selected" : ""}`}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, probationUnit: "years" }));
                                setProbationUnitDropdownOpen(false);
                              }}
                            >
                              Years
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="al-form-row">
                <div className="al-form-group" style={{ gridColumn: "span 2", display: "flex", gap: "20px", marginTop: "10px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}>
                    <input
                      type="checkbox"
                      name="includeKeyResponsibilities"
                      checked={!!formData.includeKeyResponsibilities}
                      onChange={handleInputChange}
                    />
                    Include Key Responsibilities
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}>
                    <input
                      type="checkbox"
                      name="includeAcknowledgment"
                      checked={!!formData.includeAcknowledgment}
                      onChange={handleInputChange}
                    />
                    Include Acknowledgment &amp; Acceptance
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Signatory */}
          <h4 className="al-form-section-title" style={{ marginTop: "24px" }}>
            <Icon icon="lucide:pen-line" width="14" /> Signatory Details
          </h4>
          <div className="al-form-row">
            <div className="al-form-group">
              <label>Signatory Name</label>
              <input
                name="signatoryName"
                value={formData.signatoryName}
                onChange={handleInputChange}
              />
            </div>
            <div className="al-form-group">
              <label>Title / Designation</label>
              <input
                name="signatoryTitle"
                value={formData.signatoryTitle}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>
      </div >
    );
  };

  // ── PDF Generation ───────────────────────────────────────────────────────
  // ── Inline edit handler: saves the edited HTML back into templateTexts
  const handleSaveInlineEdit = () => {
    if (!inlineEditRef.current) return;
    const editedHtml = inlineEditRef.current.innerHTML;
    setTemplateTexts((prev) => ({
      ...prev,
      [letterType]: { ...prev[letterType], html: editedHtml }
    }));
    setInlineHasChanges(false);
    toast.success("Changes saved! Click \"Generate Letter\" to create the PDF.");
  };

  const handleGeneratePDF = async () => {
    if (generatingPDFRef.current || generatingPDF) return;
    generatingPDFRef.current = true;
    // Use the editable div's pages (not document-wide, to avoid picking up hidden capture divs)
    const root = inlineEditRef.current || document;
    const pages = Array.from(root.querySelectorAll(".appointment-letter-page")).filter(page => {
      let parent = page.parentElement;
      while (parent) {
        if (parent.style && (parent.style.visibility === "hidden" || parent.style.position === "absolute")) {
          return false;
        }
        parent = parent.parentElement;
      }
      return true;
    });
    if (!pages.length) {
      generatingPDFRef.current = false;
      return;
    }

    setGeneratingPDF(true);

    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage("a4", "portrait");
        const canvas = await html2canvas(pages[i], {
          scale: 2,   // scale 2 = crisp A4 quality; scale 4 produced oversized PDFs (>50MB)
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: 794,
          height: 1123,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.85);
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      const prefix =
        letterType === "internship"
          ? "Internship_Letter"
          : letterType === "intern-to-fulltime"
            ? "Conversion_Letter"
            : "Appointment_Letter";

      pdf.save(`${prefix}_${formData.employeeName || "Employee"}.pdf`);

      // Record letter details to backend database (with PDF upload to S3)
      try {
        const pdfBlob = pdf.output("blob");

        const formDataToSend = new FormData();
        formDataToSend.append("file", pdfBlob, `${prefix}_${formData.employeeName || "Employee"}.pdf`);
        formDataToSend.append("letterType", letterType);
        formDataToSend.append("employeeName", formData.employeeName);
        formDataToSend.append("dateOfIssue", formData.dateOfIssue);
        formDataToSend.append("designation", formData.designation);
        formDataToSend.append("department", formData.department || "");
        formDataToSend.append("signatoryName", formData.signatoryName || "");
        formDataToSend.append("signatoryTitle", formData.signatoryTitle || "");
        formDataToSend.append("data", JSON.stringify({
          monthlySalary: formData.monthlySalary,
          jobType: formData.jobType,
          ctc: formData.ctc,
          stipend: formData.stipend,
          probationPeriod: formData.probationPeriod,
          internshipStartDate: formData.internshipStartDate,
          internshipDuration: formData.internshipDuration,
          internshipEndDate: formData.internshipEndDate,
          convertedDesignation: formData.convertedDesignation,
          convertedCtc: formData.convertedCtc,
          convertedJoiningDate: formData.convertedJoiningDate,
          workingHours: formData.workingHours,
        }));

        await portalInstance.post("/appointment/letter/save", formDataToSend, {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        });
        toast.success("Appointment Letter Generated Successfully!");
        fetchHistory(currentPage, 50);
      } catch (err) {
        console.error("Failed to save letter record to server:", err);
        const errMsg = err.response?.data?.message || err.message || "Failed to save record to server.";
        toast.error(`Database save failed: ${errMsg}`);
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF letter.");
    } finally {
      generatingPDFRef.current = false;
      setGeneratingPDF(false);
    }
  };

  const renderDocument = (onReady) => {
    const isTemplatePreview = !isGenerateMode;
    if (letterType === "internship")
      return <InternshipLetterDoc formData={formData} templateTexts={templateTexts} onReady={onReady} isTemplatePreview={isTemplatePreview} />;
    if (letterType === "intern-to-fulltime")
      return <InternToFullTimeDoc formData={formData} components={salaryComponents} templateTexts={templateTexts} onReady={onReady} isTemplatePreview={isTemplatePreview} />;
    if (letterType === "additional-info") {
      return (
        <AdditionalInformationPage
          includeKeyResponsibilities={false}
          includeAcknowledgment={false}
          formData={formData}
          templateTexts={templateTexts}
          onReady={onReady}
          isTemplatePreview={isTemplatePreview}
        />
      );
    }
    return <AppointmentLetterDoc formData={formData} templateTexts={templateTexts} onReady={onReady} isTemplatePreview={isTemplatePreview} />;
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="letter-gen-main-layout">
        <Sidebar />
        <div className="letter-gen-container al-access-denied-wrapper">
          <Icon icon="lucide:shield-alert" className="al-denied-icon" width="60" />
          <h2 className="al-denied-title">Access Denied</h2>
          <p className="al-denied-desc">
            You do not have the required permissions to view this page. This area is restricted to HR and Admin roles only.
          </p>
        </div>
      </div>
    );
  }

  if (loadingTemplates) {
    return (
      <div className="letter-gen-main-layout">
        <Sidebar />
        <div className="letter-gen-container al-centered-loader-wrapper">
          <Icon icon="lucide:loader-2" className="al-spin al-loader-icon" width="40" />
          <p className="al-loader-text">Loading letter templates from database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="letter-gen-main-layout">
      <Sidebar />

      <div className="letter-gen-container">
        {/* Page Header */}
        {/* <div className="letter-gen-header">
          <p className="letter-gen-description">
            Generate and download appointment letters for employees.
          </p>
        </div> */}

        <div className="al-page-content-card">
          {/* Tab Bar */}
          <div className="al-tab-bar-container">
            <div className="al-tab-radio-group">
              <button
                id="tab-generate"
                className={`al-tab-radio-btn${activeTab === "generate" ? " active" : ""}`}
                onClick={() => setActiveTab("generate")}
              >
                <span className={`al-tab-radio-circle${activeTab === "generate" ? " active" : ""}`} />
                Generate Letter
              </button>
              <button
                id="tab-settings"
                className={`al-tab-radio-btn${activeTab === "settings" ? " active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                <span className={`al-tab-radio-circle${activeTab === "settings" ? " active" : ""}`} />
                Templates &amp; Settings
              </button>
            </div>

            {activeTab === "generate" && (
              <button
                id="btn-open-create-slip-modal"
                className="common-modal-btn btn-update"
                onClick={() => {
                  setLetterType(null);
                  setIsCustomDesignation(false);
                  setIsCustomDepartment(false);
                  setIsCustomReportingTo(false);
                  setDurationOption("");
                  setWorkingHoursOption("");
                  setFormData(prev => ({
                    ...prev,
                    employeeName: "",
                    employeeEmail: "",
                    employeePhone: "",
                    designation: "",
                    department: "",
                    officeLocation: "",
                    dateOfJoining: "",
                    reportingTo: "",
                    monthlySalary: "",
                    hasStipend: "yes",
                    stipend: "",
                    internshipStartDate: "",
                    internshipEndDate: "",
                    convertedDesignation: "",
                    convertedJoiningDate: "",
                    jobType: "Fulltime",
                    probationPeriod: "6",
                    workingHours: "",
                  }));
                  setShowSelectTypeModal(true);
                }}
              >
                <Icon icon="lucide:plus" width="16" /> Create Letter Slip
              </button>
            )}
          </div>

          {/* ─── TAB 1: GENERATE ─────────────────────────────────────────────── */}
          {activeTab === "generate" && (
            <div className="al-generate-area" style={{ paddingTop: "10px" }}>
              <div className="al-table-wrapper">
                <table className="al-table">
                  <thead>
                    <tr>
                      <th className="al-th-sno">S.No</th>
                      <th className="al-th-employee">Employee Name</th>
                      <th className="al-th-designation">Designation</th>
                      <th className="al-th-salary">Compensation</th>
                      <th className="al-th-doj">Date of Issue</th>
                      <th className="al-th-jobtype">Letter Type</th>
                      <th className="al-th-preview">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "30px" }}>
                          <Icon icon="lucide:loader-2" className="al-spin" width="24" />
                          <span style={{ marginLeft: "8px" }}>Loading generated letters...</span>
                        </td>
                      </tr>
                    ) : historyList.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                          No records found
                        </td>
                      </tr>
                    ) : (
                      currentItems.map((letter, idx) => {
                        // Determine salary/stipend display
                        let comp = "-";
                        if (letter.data?.monthlySalary) {
                          comp = `₹${Number(letter.data.monthlySalary).toLocaleString("en-IN")}/mo`;
                        } else if (letter.letterType === "internship") {
                          comp = letter.data?.stipend ? `₹${Number(letter.data.stipend).toLocaleString("en-IN")}/mo` : "-";
                        } else if (letter.letterType === "appointment") {
                          comp = letter.data?.ctc ? `₹${(Number(letter.data.ctc) / 12).toLocaleString("en-IN", { maximumFractionDigits: 0 })}/mo` : "-";
                        } else if (letter.letterType === "intern-to-fulltime") {
                          comp = letter.data?.convertedCtc ? `₹${Number(letter.data.convertedCtc).toLocaleString("en-IN")}/yr` : "-";
                        }

                        // Determine job/letter type badge display
                        let badgeClass = "jobtype-intern";
                        let typeLabel = "Internship Offer";
                        if (letter.letterType === "appointment") {
                          badgeClass = "jobtype-full-time";
                          typeLabel = "Direct Appointment";
                        } else if (letter.letterType === "intern-to-fulltime") {
                          badgeClass = "jobtype-probation";
                          typeLabel = "Intern → Full-time";
                        }

                        return (
                          <tr key={letter._id}>
                            <td className="al-td-sno">
                              {String((currentPage - 1) * pageSize + idx + 1).padStart(2, "0")}
                            </td>
                            <td className="al-td-employee">
                              <span className="al-employee-name" style={{ fontWeight: "500", color: "#1e293b" }}>
                                {letter.employeeName}
                              </span>
                            </td>
                            <td className="al-td-designation">
                              {letter.designation}
                            </td>
                            <td className="al-td-salary" style={{ textAlign: "center" }}>
                              {comp}
                            </td>
                            <td className="al-td-doj" style={{ textAlign: "center" }}>
                              {fmtDate(letter.dateOfIssue)}
                            </td>
                            <td className="al-td-jobtype" style={{ textAlign: "center" }}>
                              <span className={`letter-jobtype-badge ${badgeClass}`}>
                                {typeLabel}
                              </span>
                            </td>
                            <td className="al-td-preview" style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", gap: "8px", justifyContent: "center", alignItems: "center" }}>
                                {letter.fileUrl ? (
                                  <a
                                    href={letter.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="payslip-btn payslip-btn-view"
                                    style={{ textDecoration: "none", minWidth: "auto", padding: "6px 14px" }}
                                  >
                                    View
                                  </a>
                                ) : (
                                  "-"
                                )}
                                <button
                                  id={`btn-delete-letter-${letter._id}`}
                                  className="payslip-btn"
                                  style={{
                                    minWidth: "auto",
                                    padding: "6px 14px",
                                    background: "#dc2626",
                                    color: "#ffffff",

                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                    fontSize: "13px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                totalItems={Math.max(1, historyList.length)}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageChange={(page) => setCurrentPage(page)}
              />

              {/* MODAL 1a: Select Letter Type Modal */}
              {showSelectTypeModal && (
                <div className="al-form-modal-overlay">
                  <div className="al-form-modal-content" style={{ maxWidth: "480px", overflow: "visible" }}>
                    <div className="al-modal-header">
                      <h3 className="al-modal-title">Select Letter Type</h3>
                      <button
                        className="al-modal-close-btn-x"
                        onClick={() => setShowSelectTypeModal(false)}
                      >
                        &times;
                      </button>
                    </div>

                    <div className="al-modal-body" style={{ overflow: "visible" }}>
                      <div className="al-modal-select-wrapper" style={{ position: "relative" }}>
                        <label className="al-modal-select-label">Letter Type</label>
                        <div className={`custom-dropdown-container ${letterTypeDropdownOpen ? "dropdown-open" : ""}`} style={{ width: "100%", marginBottom: "14px" }}>
                          <div
                            className={`custom-dropdown-trigger ${letterTypeDropdownOpen ? "open" : ""}`}
                            onClick={() => setLetterTypeDropdownOpen(!letterTypeDropdownOpen)}
                            style={{ padding: "8px 12px", height: "40px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                          >
                            <span style={{ color: "#334155" }}>
                              {letterTypeOptions.find(opt => opt.value === letterType)?.label || "-- Choose Type --"}
                            </span>
                            <Icon
                              icon="lucide:chevron-down"
                              className={`dropdown-arrow-icon ${letterTypeDropdownOpen ? "rotate" : ""}`}
                              style={{ color: "#64748b", width: "16px", height: "16px" }}
                            />
                          </div>
                          {letterTypeDropdownOpen && (
                            <div className="custom-dropdown-menu" style={{ border: "1px solid #cbd5e1", borderRadius: "6px", zIndex: 99999, position: "absolute" }}>
                              <div
                                className={`custom-dropdown-option ${!letterType ? "selected" : ""}`}
                                onClick={() => {
                                  setLetterType(null);
                                  setLetterTypeDropdownOpen(false);
                                }}
                              >
                                -- Choose Type --
                              </div>
                              {letterTypeOptions.map((opt) => (
                                <div
                                  key={opt.value}
                                  className={`custom-dropdown-option ${letterType === opt.value ? "selected" : ""}`}
                                  onClick={() => {
                                    setLetterType(opt.value);
                                    setLetterTypeDropdownOpen(false);
                                  }}
                                >
                                  {opt.label}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="al-modal-footer">
                      <button
                        className="common-modal-btn btn-small-cancel"
                        onClick={() => setShowSelectTypeModal(false)}
                      >
                        Close
                      </button>
                      {letterType && (
                        <button
                          className="common-modal-btn btn-update"
                          onClick={() => {
                            setShowSelectTypeModal(false);
                            setShowCreateSlipModal(true);
                          }}
                        >
                          Next
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 1b: Create Slip Form Modal */}
              {showCreateSlipModal && (
                <div className="al-form-modal-overlay">
                  <div className="al-form-modal-content" style={{ maxWidth: "700px", maxHeight: "85vh" }}>
                    <div className="al-modal-header">
                      <h3 className="al-modal-title">
                        Create {letterTypeOptions.find(opt => opt.value === letterType)?.label || "Letter Slip"}
                      </h3>
                      <button
                        className="al-modal-close-btn-x"
                        onClick={() => setShowCreateSlipModal(false)}
                      >
                        &times;
                      </button>
                    </div>

                    <div className="al-modal-body">
                      {renderFormFields()}
                    </div>

                    <div className="al-modal-footer">
                      <button
                        className="common-modal-btn btn-small-cancel"
                        style={{ marginRight: "auto" }}
                        onClick={() => {
                          setShowCreateSlipModal(false);
                          setShowSelectTypeModal(true);
                        }}
                      >
                        Back
                      </button>
                      <button
                        className="common-modal-btn btn-small-cancel"
                        onClick={() => setShowCreateSlipModal(false)}
                      >
                        Close
                      </button>
                      {letterType && (
                        <button
                          id="btn-confirm-slip-details"
                          className="al-btn-primary"
                          onClick={handleConfirmFormDetails}
                        >
                          Confirm Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 2: Delete Confirmation Modal */}
              {showDeleteModal && (
                <div className="al-form-modal-overlay" style={{ zIndex: 1100 }}>
                  <div className="al-form-modal-content" style={{ maxWidth: "440px" }}>
                    <div className="al-modal-header">
                      <h3 className="al-modal-title" style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: "8px" }}>
                        Delete Letter
                      </h3>
                      <button
                        className="al-modal-close-btn-x"
                        onClick={() => { setShowDeleteModal(false); setLetterToDelete(null); }}
                      >
                        &times;
                      </button>
                    </div>
                    <div className="al-modal-body" style={{ padding: "0px" }}>
                      <p style={{ margin: 0, fontSize: "14px", color: "#374151", lineHeight: "1.6" }}>
                        Are you sure you want to delete the letter for{" "}
                        <strong style={{ color: "#1e293b" }}>{letterToDelete?.employeeName}</strong>?
                        <br />
                        <span style={{ color: "#6b7280", fontSize: "13px" }}>
                          This will permanently delete the record and the PDF from storage. This action cannot be undone.
                        </span>
                      </p>
                    </div>
                    <div className="al-modal-footer" style={{ gap: "10px" }}>
                      <button
                        className="common-modal-btn btn-small-cancel"
                        disabled={isDeletingLetter}
                        onClick={() => { setShowDeleteModal(false); setLetterToDelete(null); }}
                      >
                        Cancel
                      </button>
                      <button
                        id="btn-confirm-delete-letter"
                        disabled={isDeletingLetter}
                        onClick={handleDeleteConfirm}
                        style={{
                          background: "#dc2626",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 20px",
                          fontWeight: "600",
                          fontSize: "14px",
                          cursor: isDeletingLetter ? "not-allowed" : "pointer",
                          opacity: isDeletingLetter ? 0.7 : 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {isDeletingLetter ? (
                          <> Deleting…</>
                        ) : (
                          <> Confirm Delete</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ─── TAB 2: SETTINGS / TEMPLATES ─────────────────────────────────── */}
          {activeTab === "settings" && (
            <div className="al-settings-area">
              {editingTemplateType ? (
                // ── NEW: Tiptap Rich Text Editor ──────────────────────────────
                <LetterTemplateEditor
                  key={`${editingTemplateType}-${editorResetKey}`}
                  letterType={editingTemplateType}
                  initialHtml={
                    templateTexts[editingTemplateType]?.html ??
                    (() => {
                      const t = templateTexts[editingTemplateType] || {};

                      if (!t) return "";

                      let html = "";

                      // body paragraphs
                      const bodyKeys = Object.keys(t)
                        .filter(k => k.startsWith("body"))
                        .sort(
                          (a, b) =>
                            (parseInt(a.replace("body", "")) || 0) -
                            (parseInt(b.replace("body", "")) || 0)
                        );

                      bodyKeys.forEach(k => {
                        if (!t[k]) return;

                        const lines = t[k].split("\n").filter(l => l.trim());

                        if (
                          lines.length >= 3 &&
                          lines.every(l => l.includes(":") || l.includes(";"))
                        ) {
                          html +=
                            "<ul>" +
                            lines.map(l => `<li>${l}</li>`).join("") +
                            "</ul>";
                        } else {
                          html += `<p>${t[k].replace(/\n/g, "<br>")}</p>`;
                        }
                      });

                      const termKeys = Object.keys(t)
                        .filter(k => k.startsWith("term"))
                        .sort(
                          (a, b) =>
                            (parseInt(a.replace("term", "")) || 0) -
                            (parseInt(b.replace("term", "")) || 0)
                        );

                      if (termKeys.length > 0) {
                        html += "<p><strong>Terms and Conditions:</strong></p><ol>";

                        termKeys.forEach(k => {
                          if (t[k]) {
                            html += `<li>${t[k]}</li>`;
                          }
                        });

                        html += "</ol>";
                      }

                      if (t.closing) {
                        html += `<p>${t.closing}</p>`;
                      }

                      return html;
                    })()
                  }
                  subjectValue={templateTexts[editingTemplateType]?.subject || ''}
                  isCustomized={!!templateTexts[editingTemplateType]?.isCustomized}
                  onSave={handleSaveTemplate}
                  onPreview={handleEditorPreview}
                  onReset={handleResetTemplate}
                  onBack={() => setEditingTemplateType(null)}
                />
              ) : (
                <>
                  <p className="al-settings-desc">
                    Preview and manage the three letter templates. Click{" "}
                    <strong>Preview Template</strong> to see a sample with dummy data.
                  </p>

                  <div className="al-template-cards">
                    {LETTER_TYPES.map((card) => (
                      <div
                        key={card.id}
                        className="al-template-card"
                        style={{ "--card-accent": card.color }}
                      >
                        <div className="al-template-card-header">
                          <div className="al-template-icon">
                            <Icon icon={card.icon} width="30" />
                          </div>
                          <div>
                            <h3>{card.title}</h3>
                            <p>{card.desc}</p>
                          </div>
                        </div>

                        <div className="al-template-card-footer">
                          <button
                            id={`btn-preview-template-${card.id}`}
                            className="al-template-preview-btn"
                            onClick={() => handleTemplatePreview(card.id, false)}
                          >
                            <Icon icon="lucide:eye" width="14" /> Preview
                          </button>
                          {/* <button
                            id={`btn-edit-template-${card.id}`}
                            className="al-template-customize-btn"
                            onClick={() => {
                              setEditingTemplateType(card.id);
                              setEditorResetKey(k => k + 1);
                            }}
                            style={{ background: "#6366f1", color: "#fff", border: "none" }}
                          >
                            <Icon icon="lucide:pencil-line" width="14" /> Edit
                          </button> */}
                          <button
                            id={`btn-customize-template-${card.id}`}
                            className="al-template-customize-btn"
                            onClick={() => {
                              setEditingTemplateType(card.id);
                              setEditorResetKey(k => k + 1);
                            }}
                          >
                            <Icon icon="lucide:layout-template" width="14" /> Customize
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── PREVIEW MODAL ────────────────────────────────────────────────── */}
        {showPreviewModal && (
          <div className="letter-preview-modal-overlay">
            <div
              className={isCustomizeMode ? "al-split-modal-content" : "letter-preview-modal-content"}
              onClick={(e) => e.stopPropagation()}
              style={isCustomizeMode ? { width: "95%", maxWidth: "1400px", height: "90vh" } : {}}
            >
              <div className="todo-modal-header">
                <h3 className="al-modal-title">{isCustomizeMode ? "Customize Template" : "Letter Preview"}</h3>
                <div className="al-modal-header-actions">
                  <button
                    onClick={handleClosePreviewModal}
                    className="al-modal-close-btn"
                  >
                    ×
                  </button>
                </div>
              </div>

              {isCustomizeMode ? (
                /* Split screen modal body for customization */
                <div className="al-split-modal-body">
                  {/* Left Side: Word-like Editor Pane */}
                  <div className="al-split-editor-pane">
                    <div className="al-split-editor-header">
                      <Icon icon="lucide:pencil" width="16" /> Edit Template Fields
                    </div>

                    <div style={{ fontSize: "12px", color: "#64748b", background: "#f8fafc", padding: "10px", borderRadius: "6px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
                      <strong>Tip:</strong> Edit fields directly. Use placeholders like <code>{"{employeeName}"}</code>, <code>{"{designation}"}</code>, <code>{"{department}"}</code>, etc.
                    </div>

                    {/* Subject */}
                    <div className="al-editor-group" style={{ marginBottom: "16px" }}>
                      <label className="al-editor-label" style={{ fontWeight: "600", fontSize: "13px", display: "block", marginBottom: "6px" }}>
                        Subject / Title
                      </label>
                      <input
                        type="text"
                        className="al-modal-select-input"
                        style={{ background: "#ffffff", border: "1px solid #cbd5e1" }}
                        value={templateTexts[letterType]?.subject || ""}
                        onChange={(e) => handleLiveEditorChange("subject", e.target.value)}
                      />
                    </div>

                    {/* Template Content */}
                    <div className="al-editor-group" style={{ marginBottom: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
                      <label className="al-editor-label" style={{ fontWeight: "600", fontSize: "13px", display: "block", marginBottom: "6px" }}>
                        Letter Content
                      </label>
                      <textarea
                        className="al-modal-select-input"
                        style={{ background: "#ffffff", flex: 1, minHeight: "350px", fontFamily: "inherit", resize: "vertical", border: "1px solid #cbd5e1", lineHeight: "1.6", padding: "12px" }}
                        value={templateTexts[letterType]?.content !== undefined ? templateTexts[letterType].content : getMergedContent(templateTexts[letterType] || {})}
                        onChange={(e) => handleLiveEditorChange("content", e.target.value)}
                        placeholder="Type entire letter content here..."
                      />
                    </div>
                  </div>

                  {/* Right Side: Live A4 PDF Layout Preview Pane */}
                  <div className="al-split-preview-pane">
                    <div
                      ref={previewRef}
                      style={{ transform: "scale(0.85)", transformOrigin: "top center", width: "794px" }}
                    >
                      {renderDocument()}
                    </div>
                  </div>
                </div>
              ) : (
                /* Simple Preview modal body — two-phase: capture then editable */
                <div className="letter-preview-modal-body">
                  {/* Phase 1: hidden React render — we grab its HTML then remove it */}
                  {previewHtml === null && (
                    <div
                      ref={captureRef}
                      style={{
                        position: "absolute",
                        left: "-9999px",
                        top: 0,
                        visibility: "hidden",
                        pointerEvents: "none",
                      }}
                    >
                      {renderDocument(setPreviewHtml)}
                    </div>
                  )}

                  {/* Phase 2: editable preview (innerHTML set via ref, not React children) */}
                  {previewHtml !== null ? (
                    <InlineLetterPreview
                      key={`${letterType}-${formData.employeeName}`}
                      renderedHtml={previewHtml}
                      onInput={() => setInlineHasChanges(true)}
                      editRef={(el) => {
                        inlineEditRef.current = el;
                      }}
                    />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px", color: "#64748b" }}>
                      <Icon icon="lucide:loader-2" className="al-spin" width="24" />
                      <span style={{ marginLeft: "12px" }}>Loading preview…</span>
                    </div>
                  )}
                </div>
              )}

              <div className="al-modal-footer">
                {isCustomizeMode ? (
                  <>
                    <button
                      className="al-btn-primary"
                      onClick={handleAddParagraphDirect}
                      style={{ marginRight: "12px" }}
                    >
                      <Icon icon="lucide:plus" width="14" style={{ marginRight: "6px" }} />
                      Add Paragraph
                    </button>
                    <button
                      className="al-btn-primary"
                      onClick={handleAddTermDirect}
                      style={{ marginRight: "auto" }}
                    >
                      <Icon icon="lucide:plus" width="14" style={{ marginRight: "6px" }} />
                      Add Term
                    </button>
                    {hasChanges && (
                      <button
                        className="al-btn-success"
                        onClick={handleSaveTemplateDirect}
                        style={{ marginRight: "12px" }}
                      >
                        <Icon icon="lucide:save" width="14" style={{ marginRight: "6px" }} />
                        Save Template
                      </button>
                    )}
                    <button
                      className="common-modal-btn btn-small-cancel"
                      onClick={handleClosePreviewModal}
                    >
                      Close
                    </button>
                  </>
                ) : (
                  /* Simple preview footer — edit hint + conditionally Generate Letter */
                  <>
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
                        className="al-btn-success"
                        onClick={handleSaveInlineEdit}
                        style={{ marginRight: "10px" }}
                      >
                        <Icon icon="lucide:check" width="14" style={{ marginRight: "6px" }} />
                        Save Changes
                      </button>
                    )}
                    {/* Generate Letter button: ONLY for the Generate tab popup */}
                    {isGenerateMode && (
                      <button
                        id="btn-generate-letter"
                        className="al-btn-primary"
                        onClick={handleGeneratePDF}
                        style={{ marginRight: "10px" }}
                        disabled={generatingPDF}
                      >
                        {generatingPDF ? (
                          <>
                            <Icon icon="lucide:loader-2" className="al-spin" width="14" style={{ marginRight: "6px" }} />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Icon icon="lucide:file-down" width="14" style={{ marginRight: "6px" }} />
                            Generate Letter
                          </>
                        )}
                      </button>
                    )}
                    <button
                      id="btn-print-letter"
                      className="al-btn-print"
                      onClick={() => window.print()}
                      style={{ marginRight: "10px", background: "#0f172a", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 500 }}
                    >
                      <Icon icon="lucide:printer" width="14" />
                      Print
                    </button>
                    <button
                      className="common-modal-btn btn-small-cancel"
                      onClick={handleClosePreviewModal}
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </div>
  );
};

// ─── INLINE-EDITABLE PREVIEW COMPONENT ───────────────────────────────────────
// Cannot use dangerouslySetInnerHTML inside contentEditable (React escapes tags).
// Solution: set innerHTML directly via ref in useEffect (bypasses React DOM management).
const InlineLetterPreview = ({ renderedHtml, onInput, editRef }) => {
  const divRef = React.useRef(null);

  // Set innerHTML once (and whenever renderedHtml changes)
  React.useEffect(() => {
    if (divRef.current && renderedHtml !== undefined) {
      divRef.current.innerHTML = renderedHtml;
    }
  }, [renderedHtml]);

  const handleInput = (e) => {
    if (divRef.current) {
      const allPages = Array.from(divRef.current.querySelectorAll(".appointment-letter-page"));
      if (allPages.length > 0) {
        const page1Content = allPages[0].querySelector(".al-content-container");
        if (page1Content && page1Content.scrollHeight > 590) {
          let page2 = allPages[1];
          if (!page2) {
            const newPage = document.createElement("div");
            newPage.className = "appointment-letter-page";
            newPage.innerHTML = `
              <img src="/Letterpad.svg" class="letter-bg-img" alt="" aria-hidden="true" />
              <div class="al-header-container"></div>
              <div class="al-content-container"></div>
              <div class="al-footer-container"></div>
            `;
            divRef.current.appendChild(newPage);
            page2 = newPage;
          }
          const page2Content = page2.querySelector(".al-content-container");
          if (page2Content && page1Content.lastElementChild) {
            page2Content.insertBefore(page1Content.lastElementChild, page2Content.firstChild);
          }
        }
      }
    }
    if (onInput) onInput(e);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      let node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

      const currentPage = node.closest ? node.closest(".appointment-letter-page") : null;
      if (!currentPage) return;

      const allPages = Array.from(divRef.current.querySelectorAll(".appointment-letter-page"));
      const isFirstPage = allPages[0] === currentPage;

      if (isFirstPage) {
        const contentContainer = currentPage.querySelector(".al-content-container");
        if (contentContainer) {
          const contentH = contentContainer.scrollHeight;
          const isAtEnd = !node.nextElementSibling || node === contentContainer.lastElementChild;

          if (contentH >= 560 || isAtEnd) {
            let page2 = allPages[1];
            if (!page2) {
              const newPage = document.createElement("div");
              newPage.className = "appointment-letter-page";
              newPage.innerHTML = `
                <img src="/Letterpad.svg" class="letter-bg-img" alt="" aria-hidden="true" />
                <div class="al-header-container"></div>
                <div class="al-content-container"><p><br></p></div>
                <div class="al-footer-container"></div>
              `;
              divRef.current.appendChild(newPage);
              page2 = newPage;
            }

            const page2Content = page2.querySelector(".al-content-container");
            if (page2Content) {
              e.preventDefault();
              let firstP = page2Content.querySelector("p, div, h1, h2, h3, h4, h5, h6, ul, ol");
              if (!firstP) {
                firstP = document.createElement("p");
                firstP.innerHTML = "<br>";
                page2Content.insertBefore(firstP, page2Content.firstChild);
              }
              const newRange = document.createRange();
              newRange.setStart(firstP, 0);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
              firstP.scrollIntoView({ behavior: "smooth", block: "center" });
              if (onInput) onInput(e);
            }
          }
        }
      }
    }
  };

  return (
    <div
      ref={(el) => {
        divRef.current = el;
        if (editRef) editRef(el);
      }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      style={{ outline: "none", cursor: "text" }}
    />
  );
};

// ─── DOCUMENT COMPONENTS ─────────────────────────────────────────────────────

const getMergedContent = (texts) => {
  if (!texts) return "";
  if (texts.html) return texts.html;  // ← NEW: HTML from Tiptap editor
  if (texts.content) return texts.content;

  // Merge body paragraphs
  const bodyParts = Object.keys(texts)
    .filter(k => k.startsWith("body"))
    .sort((a, b) => (parseInt(a.replace("body", "")) || 0) - (parseInt(b.replace("body", "")) || 0))
    .map(k => texts[k]);

  // Merge terms
  const termParts = Object.keys(texts)
    .filter(k => k.startsWith("term"))
    .sort((a, b) => (parseInt(a.replace("term", "")) || 0) - (parseInt(b.replace("term", "")) || 0))
    .map((k, idx) => `${idx + 1}. ${texts[k]}`);

  let merged = bodyParts.join("\n\n");
  if (termParts.length > 0) {
    merged += "\n\nTerms and Conditions:\n" + termParts.join("\n");
  }
  if (texts.closing) {
    merged += "\n\n" + texts.closing;
  }
  return merged;
};

const getParagraphHeight = (p, formData) => {
  const lines = p.split("\n").filter(line => line.trim() !== "");
  const hasLabelValues = lines.length >= 3 && lines.every(line => line.includes(":") || line.includes(";"));
  if (hasLabelValues) {
    return lines.length * 32 + 20;
  }
  const text = compileTemplateToHtml(p, formData).replace(/<[^>]*>/g, "");
  const paragraphLines = Math.ceil(text.length / 75) || 1;
  return paragraphLines * 24 + 16;
};

const renderParagraph = (p, idx, formData) => {
  const lines = p.split("\n").filter(line => line.trim() !== "");
  const hasLabelValues = lines.length >= 3 && lines.every(line => line.includes(":") || line.includes(";"));

  if (hasLabelValues) {
    return (
      <div key={idx} className="doc-details-block">
        <table className="al-doc-details-table">
          <tbody>
            {lines.map((line, lIdx) => {
              const compiledLine = compileTemplateToHtml(line, formData);
              let colonIdx = compiledLine.indexOf(":");
              if (colonIdx === -1) colonIdx = compiledLine.indexOf(";");

              if (colonIdx === -1) {
                return (
                  <tr key={lIdx}>
                    <td colSpan="2" className="al-doc-details-full-width" dangerouslySetInnerHTML={{ __html: compiledLine }} />
                  </tr>
                );
              }
              const label = compiledLine.substring(0, colonIdx).trim();
              const value = compiledLine.substring(colonIdx + 1).trim();
              return (
                <tr key={lIdx}>
                  <td className="al-doc-details-label">{label} :</td>
                  <td className="al-doc-details-value" dangerouslySetInnerHTML={{ __html: value }} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <p
      key={idx}
      className="al-doc-paragraph"
      dangerouslySetInnerHTML={{ __html: compileTemplateToHtml(p, formData) }}
    />
  );
};

// ─── HTML Content Helpers ─────────────────────────────────────────────────────
const isHtmlContent = (str) => str && typeof str === 'string' && str.trim().startsWith('<');

// Helper to split compiled HTML into top-level block HTML strings for exact measurement
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

const DEFAULT_ADDITIONAL_INFO_FALLBACK = `<p><span style="font-family: Roboto, sans-serif; font-size: 13px;"><strong>Key Responsibilities</strong></span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">➢ Design and Develop: Build and maintain efficient, reusable, and reliable code for both front-end and back-end components of web and mobile applications.</span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">➢ Collaborate with Teams: Work closely with other developers to define, design, and implement new features and enhancements.</span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">➢ API Development & Integration: Design and implement robust APIs to facilitate interaction between different systems and components.</span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">➢ Database Management: Develop and manage databases using SQL and NoSQL technologies (e.g., MySQL, MongoDB).</span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">➢ Performance Optimization: Ensure the application’s performance, scalability, and security by writing optimized code and testing across devices and browsers.</span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">➢ Troubleshooting & Debugging: Identify bottlenecks, bugs, and other issues and provide timely solutions.</span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">➢ Maintain & Update Codebase: Continuously monitor, maintain, and improve the existing codebase.</span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">➢ Testing: Write and maintain automated tests for applications to ensure code reliability and robustness.</span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">➢ Stay Updated: Keep up with the latest industry trends, technologies, and best practices in both front-end and back-end development.</span></p><p><span style="font-family: Roboto, sans-serif; font-size: 13px;"><strong>Acknowledgment and Acceptance</strong></span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">I, {employeeName}, accept the offer as {designation} with Ertitech Solutions Private Limited under the terms and conditions outlined above.</span></p><p style="line-height: 1.75;"><span style="font-family: Roboto, sans-serif; font-size: 13px;">Employee Signature: {employeeName}</span></p>`;

/** Shared HTML letter page — auto-paginates content & signature across unlimited pages */
const HtmlLetterPage = ({ formData, templateTexts, letterType, onReady, isTemplatePreview = false }) => {
  const containerRef = React.useRef(null);
  const templateHtml = templateTexts[letterType]?.html;
  const contentText = templateHtml || getTemplateHtml(templateTexts[letterType]);

  const hasAdditionalInfo = Boolean(formData.includeKeyResponsibilities || formData.includeAcknowledgment);

  // 1. Main Letter Content Blocks
  const mainCompiledHtml = React.useMemo(() => {
    return compileTemplateToHtml(contentText, formData, letterType, isTemplatePreview);
  }, [contentText, formData, letterType, isTemplatePreview]);

  const mainBlocks = React.useMemo(() => getHtmlBlocks(mainCompiledHtml), [mainCompiledHtml]);

  // 2. Additional Info Blocks (Key Responsibilities & Acknowledgment)
  const addCompiledHtml = React.useMemo(() => {
    if (!hasAdditionalInfo) return "";
    const rawAddHtml = templateTexts["additional-info"]?.html || DEFAULT_ADDITIONAL_INFO_FALLBACK;
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawAddHtml, "text/html");
    const children = Array.from(doc.body.children);
    let currentSection = "other";

    const showKR = formData.includeKeyResponsibilities;
    const showAck = formData.includeAcknowledgment;

    children.forEach((child) => {
      const text = (child.textContent || "").toLowerCase().trim();
      const isHeading = child.tagName.startsWith("H") || child.querySelector("strong") || child.tagName === "P";

      if (isHeading && (text.includes("key responsibilities") || text.includes("responsibilities"))) {
        currentSection = "responsibilities";
        child.setAttribute("style", "margin-top: 20px !important; margin-bottom: 12px !important; font-weight: 700;");
      } else if (isHeading && (text.includes("acknowledgment") || text.includes("acceptance"))) {
        currentSection = "acknowledgment";
        child.setAttribute("style", "margin-top: 25px !important; margin-bottom: 14px !important; font-weight: 700;");
      }

      let keep = true;
      if (currentSection === "responsibilities" && !showKR) {
        keep = false;
      }
      if (currentSection === "acknowledgment" && !showAck) {
        keep = false;
      }

      if (!keep) {
        child.remove();
      }
    });

    return compileTemplateToHtml(doc.body.innerHTML, formData, "additional-info", isTemplatePreview);
  }, [hasAdditionalInfo, templateTexts, formData, isTemplatePreview]);

  const addBlocks = React.useMemo(() => getHtmlBlocks(addCompiledHtml), [addCompiledHtml]);

  const allBlocks = React.useMemo(() => {
    return [...mainBlocks, ...addBlocks];
  }, [mainBlocks, addBlocks]);

  const hiddenRef = React.useRef(null);
  const [paginatedPages, setPaginatedPages] = React.useState(null);

  React.useEffect(() => {
    if (paginatedPages && onReady && containerRef.current) {
      onReady(containerRef.current.innerHTML);
    }
  }, [paginatedPages, onReady]);

  const MAX_PAGE_CONTENT_H = 750; // Available content height per A4 page container

  React.useLayoutEffect(() => {
    if (!hiddenRef.current) return;
    const children = Array.from(hiddenRef.current.children);
    if (!children.length) {
      setPaginatedPages({ pageBlocks: [[]], mainLastPageIdx: 0 });
      return;
    }

    const pages = [[]];
    let pageIdx = 0;
    let currentH = 0;

    const mainCount = mainBlocks.length;

    // Paginate main letter blocks
    for (let i = 0; i < mainCount; i++) {
      const child = children[i];
      if (!child) continue;
      const style = window.getComputedStyle(child);
      const marginTop = parseFloat(style.marginTop) || 0;
      const marginBottom = parseFloat(style.marginBottom) || 0;
      const blockH = child.offsetHeight + marginTop + marginBottom;

      if (currentH + blockH > MAX_PAGE_CONTENT_H && pages[pageIdx].length > 0) {
        pageIdx++;
        pages[pageIdx] = [mainBlocks[i]];
        currentH = blockH;
      } else {
        pages[pageIdx].push(mainBlocks[i]);
        currentH += blockH;
      }
    }

    const mainLastPageIdx = pageIdx;

    // For Intern-to-Fulltime with Key Responsibilities / Acknowledgment:
    // FORCE additional info to ALWAYS start on a separate page (Page 2)!
    if (hasAdditionalInfo && addBlocks.length > 0) {
      pageIdx++;
      pages[pageIdx] = [];
      currentH = 0;

      for (let j = 0; j < addBlocks.length; j++) {
        const child = children[mainCount + j];
        if (!child) continue;
        const style = window.getComputedStyle(child);
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        const blockH = child.offsetHeight + marginTop + marginBottom;

        if (currentH + blockH > MAX_PAGE_CONTENT_H && pages[pageIdx].length > 0) {
          pageIdx++;
          pages[pageIdx] = [addBlocks[j]];
          currentH = blockH;
        } else {
          pages[pageIdx].push(addBlocks[j]);
          currentH += blockH;
        }
      }
    }

    setPaginatedPages({ pageBlocks: pages, mainLastPageIdx });
  }, [mainBlocks, addBlocks, hasAdditionalInfo]);

  const sigBlock = (
    <div className="al-doc-signatures-section-offset">
      <div className="al-doc-seal-center">
        <img src="/seal.png" alt="Company Seal" className="al-doc-seal-img" />
      </div>
      <div className="al-doc-signature-block-right">
        <p style={{ margin: "0 0 5px 0", fontSize: "14px", color: "#1e293b" }}>Sincerely,</p>
        <img src="/sign 1.png" alt="CEO Signature" className="al-doc-signature-image-right" />
        <strong className="al-doc-signatory-name">
          {formData.signatoryName || "Jayaprakash. R"}
        </strong>
        <p className="al-doc-signatory-title">
          [{formData.signatoryTitle || "Director"}]
        </p>
      </div>
    </div>
  );

  // Offscreen container used solely for measuring exact DOM element heights with correct stylesheet rules applied
  const hiddenMeasurer = (
    <div
      style={{
        position: "absolute",
        left: "-9999px",
        top: 0,
        visibility: "hidden",
        pointerEvents: "none"
      }}
    >
      <div className="appointment-letter-page" style={{ height: "auto", minHeight: "auto", padding: "0 !important" }}>
        <div className="al-content-container" ref={hiddenRef} style={{ height: "auto", minHeight: "auto", flex: "none" }}>
          {allBlocks.map((htmlStr, idx) => (
            <div key={idx} dangerouslySetInnerHTML={{ __html: htmlStr }} />
          ))}
        </div>
      </div>
    </div>
  );

  const letterTitle = compileTemplateToHtml(templateTexts?.subject || "Appointment Letter", formData, letterType, isTemplatePreview);

  if (!paginatedPages) {
    return (
      <div ref={containerRef} className="appointment-letter-container">
        {hiddenMeasurer}
        <div className="appointment-letter-page">
          <img src="/Letterpad.svg" className="letter-bg-img" alt="" aria-hidden="true" />

          <div className="al-header-container">
            <div className="al-header-date" style={letterType === "internship" ? { marginTop: "55px" } : {}}>
              Date : {isTemplatePreview ? "{dateOfIssue}" : fmtDate(formData.dateOfIssue)}
            </div>
          </div>

          <div className="al-content-container" />

          <div className="al-signature-container">
            {sigBlock}
          </div>

          <div className="al-footer-container" />
        </div>
      </div>
    );
  }

  const { pageBlocks, mainLastPageIdx } = paginatedPages;

  return (
    <div ref={containerRef} className="appointment-letter-container">
      {hiddenMeasurer}

      {/* Render all content pages */}
      {pageBlocks.map((bList, idx) => {
        const showSigHere = (idx === mainLastPageIdx);

        return (
          <div className="appointment-letter-page" key={idx}>
            <img src="/Letterpad.svg" className="letter-bg-img" alt="" aria-hidden="true" />

            <div className="al-header-container">
              <div className="al-header-date" style={letterType === "internship" ? { marginTop: "55px" } : {}}>
                Date : {isTemplatePreview ? "{dateOfIssue}" : fmtDate(formData.dateOfIssue)}
              </div>
            </div>

            <div className="al-content-container" style={idx > 0 ? { paddingTop: "30px" } : {}}>
              {bList.map((htmlStr, bIdx) => (
                <div key={bIdx} dangerouslySetInnerHTML={{ __html: htmlStr }} />
              ))}
            </div>

            {showSigHere ? (
              <div className="al-signature-container">
                {sigBlock}
              </div>
            ) : null}

            <div className="al-footer-container" />
          </div>
        );
      })}
    </div>
  );
};

/* ── 1. INTERNSHIP LETTER (1 page) ──────────────────────────────────────── */
const InternshipLetterDoc = ({ formData, templateTexts, onReady, isTemplatePreview = false }) => {
  return <HtmlLetterPage formData={formData} templateTexts={templateTexts} letterType="internship" onReady={onReady} isTemplatePreview={isTemplatePreview} />;
};

/* ── 2. DIRECT APPOINTMENT LETTER (1 page) ──────────────────────────────── */
const AppointmentLetterDoc = ({ formData, templateTexts, onReady, isTemplatePreview = false }) => {
  return <HtmlLetterPage formData={formData} templateTexts={templateTexts} letterType="appointment" onReady={onReady} isTemplatePreview={isTemplatePreview} />;
};

/* ── 3. INTERN → FULL-TIME LETTER (2 pages) ──────────────────────────────── */
const InternToFullTimeDoc = ({ formData, components, templateTexts, onReady, isTemplatePreview = false }) => {
  return <HtmlLetterPage formData={formData} templateTexts={templateTexts} letterType="intern-to-fulltime" onReady={onReady} isTemplatePreview={isTemplatePreview} />;
};

export default AppointmentLetter;

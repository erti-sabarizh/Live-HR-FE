import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../HeaderSidebar/Sidebar";
import "./EmployeeManage.css";
import "./Salarymodal.css";
import CustomDropdown from "../../Common/CustomDropdown";
import { portalInstance } from "../../../Services/instance";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Pagination from "../../Employee/Pagination/Pagination";
import { useUser } from "../../UserContext";
import ApprovalBanner from "../../Common/ApprovalBanner";
import { FaUpload, FaCheckCircle, FaFileAlt, FaCalendarAlt, FaEye, FaEdit, FaSpinner, FaTrash } from "react-icons/fa";
import { canHrEditEmployee, canHrViewEmployee } from "../../../utils/hrAccessHelper";

// ⚡ Global in-memory cache for bank IFSC lookups
const ifscGlobalCache = new Map();

// ─── Salary Modal Component ───────────────────────────────────────────────────
const SalaryModal = ({ emp, onClose }) => {
  const { user } = useUser();
  const empId = emp?.id || emp?.empId || emp?.employeeId;

  const initialAllowances = [
    { label: "House Rent Allowance (HRA)", value: "0" },
    { label: "Conveyance Allowance", value: "0" },
    { label: "Medical Allowance", value: "0" },
    { label: "Special Allowance", value: "0" },
  ];

  const getCleanEmpCode = () => {
    const raw = emp?.empIdString || emp?.empId || "";
    if (!raw || /^[0-9a-fA-F]{24}$/.test(raw)) return "";
    return ` (${raw})`;
  };

  const buildSalaryChanges = (prevSal, newSal, currentAllowances, attachedDocs) => {
    const list = [];

    const prevBasic = prevSal?.basicSalary != null ? Number(prevSal.basicSalary) : null;
    const newBasic = newSal?.basicSalary != null ? Number(newSal.basicSalary) : null;
    const prevTotal = prevSal?.totalSalary != null ? Number(prevSal.totalSalary) : null;
    const newTotal = newSal?.totalSalary != null ? Number(newSal.totalSalary) : null;

    const prevAllowances = prevSal?.allowances || [];
    const newAllowances = currentAllowances || newSal?.allowances || [];

    const allowanceLabels = Array.from(new Set([
      ...prevAllowances.map(a => a.label),
      ...newAllowances.map(a => a.label)
    ]));

    let hasSalaryChange = false;
    if (prevBasic !== newBasic || prevTotal !== newTotal) {
      hasSalaryChange = true;
    }

    const allowanceDiffs = [];
    allowanceLabels.forEach(label => {
      const prevA = prevAllowances.find(a => a.label === label);
      const newA = newAllowances.find(a => a.label === label);
      const valPrev = prevA ? Number(prevA.value || 0) : null;
      const valNew = newA ? Number(newA.value || 0) : 0;
      if (valPrev !== valNew) {
        hasSalaryChange = true;
      }
      allowanceDiffs.push({
        fieldName: label,
        from: valPrev !== null ? valPrev : "-",
        to: valNew
      });
    });

    if (hasSalaryChange) {
      if (prevBasic !== newBasic) {
        list.push({ fieldName: "Basic Salary", from: prevSal?.basicSalary != null ? prevSal.basicSalary : "-", to: newSal.basicSalary });
      }
      if (prevTotal !== newTotal) {
        list.push({ fieldName: "Total Salary", from: prevSal?.totalSalary != null ? prevSal.totalSalary : "-", to: newSal.totalSalary });
      }
      allowanceDiffs.forEach(diff => {
        if (diff.from !== diff.to) {
          list.push(diff);
        }
      });
    }

    // Include increment documents
    if (incrementLetterFile && attachedDocs?.incrementLetter?.fileName) {
      list.push({
        fieldName: "Increment Letter",
        from: existingDocForYear?.incrementLetter?.fileName || "-",
        to: attachedDocs.incrementLetter.fileName,
        fileKey: attachedDocs.incrementLetter.fileKey || null,
        isDocument: true
      });
    } else if (attachedDocs?.incrementLetter?.fileName && !hasExistingIncLetter) {
      list.push({
        fieldName: "Increment Letter",
        from: "-",
        to: attachedDocs.incrementLetter.fileName,
        fileKey: attachedDocs.incrementLetter.fileKey || null,
        isDocument: true
      });
    }

    if (performanceFormFile && attachedDocs?.performanceForm?.fileName) {
      list.push({
        fieldName: "Performance Form",
        from: existingDocForYear?.performanceForm?.fileName || "-",
        to: attachedDocs.performanceForm.fileName,
        fileKey: attachedDocs.performanceForm.fileKey || null,
        isDocument: true
      });
    } else if (attachedDocs?.performanceForm?.fileName && !hasExistingPerfForm) {
      list.push({
        fieldName: "Performance Form",
        from: "-",
        to: attachedDocs.performanceForm.fileName,
        fileKey: attachedDocs.performanceForm.fileKey || null,
        isDocument: true
      });
    }

    if (list.length === 0) {
      list.push(
        { fieldName: "Basic Salary", from: prevSal?.basicSalary != null ? prevSal.basicSalary : "-", to: newSal.basicSalary },
        { fieldName: "Total Salary", from: prevSal?.totalSalary != null ? prevSal.totalSalary : "-", to: newSal.totalSalary }
      );
    }

    return list;
  };

  const [salaryList, setSalaryList] = useState([]);
  const [form, setForm] = useState({
    fromDate: "",
    toDate: "",
    basicSalary: "",
    targetTotal: "",
    allowances: initialAllowances,
  });
  const [newSalaryForm, setNewSalaryForm] = useState({
    targetTotal: "",
    basicSalary: "",
    allowances: initialAllowances,
    fromDate: ""
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [salCurrentPage, setSalCurrentPage] = useState(1);
  const [selYearFrom, setSelYearFrom] = useState("");
  const [selMonthFrom, setSelMonthFrom] = useState("");
  const [selYear, setSelYear] = useState("");
  const [selMonth, setSelMonth] = useState("");

  // ── Increment Documents State & Month/Year Selectors ──
  const [incrementLetterFile, setIncrementLetterFile] = useState(null);
  const [performanceFormFile, setPerformanceFormFile] = useState(null);
  const [existingIncrementDocs, setExistingIncrementDocs] = useState([]);
  const [isEditingIncLetter, setIsEditingIncLetter] = useState(false);
  const [isEditingPerfForm, setIsEditingPerfForm] = useState(false);
  const [viewingDocKey, setViewingDocKey] = useState(null);
  const incLetterInputRef = useRef(null);
  const perfFormInputRef = useRef(null);
  const [docToDelete, setDocToDelete] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(false);



  // ✅ Scoped Toast Logic: Dismisses when modal closes
  const isMounted = useRef(true);
  const toastIdRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      isMounted.current = false;
      document.body.style.overflow = originalOverflow;
      if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    };
  }, []);

  // ── Derived: Unique allowance names for suggestions ────────────────────────
  const allowanceSuggestions = useMemo(() => {
    const names = new Set();
    initialAllowances.forEach(a => names.add(a.label));
    salaryList.forEach(entry => {
      entry.allowances?.forEach(a => names.add(a.label));
    });
    return Array.from(names);
  }, [salaryList, initialAllowances]);

  // ── Derived: auto-calculate totals & remaining ──────────────────────────────
  const sumAllowances = form.allowances.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
  const netTotal = (Number(form.basicSalary) || 0) + sumAllowances;
  const remaining = form.targetTotal ? Number(form.targetTotal) - netTotal : 0;

  const isTransition = !editingId && salaryList.length > 0 && !salaryList[0].toDate;
  const sumNewAllowances = newSalaryForm.allowances.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
  const newRemaining = newSalaryForm.targetTotal ? Number(newSalaryForm.targetTotal) - (Number(newSalaryForm.basicSalary) || 0) - sumNewAllowances : 0;

  const updateNewAllowance = (index, field, val) => {
    setNewSalaryForm(prev => {
      const updated = [...prev.allowances];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, allowances: updated };
    });
  };

  const addNewAllowanceRow = () => {
    setNewSalaryForm(prev => ({
      ...prev,
      allowances: [...prev.allowances, { label: "", value: "0" }]
    }));
  };

  const removeNewAllowanceRow = (index) => {
    setNewSalaryForm(prev => ({
      ...prev,
      allowances: prev.allowances.filter((_, i) => i !== index)
    }));
  };

  const handleNewTargetTotalChange = (val) => {
    const raw = fromIndian(val);
    const num = Number(raw) || 0;
    const newBasic = Math.floor(num * 0.5);
    setNewSalaryForm(prev => ({
      ...prev,
      targetTotal: raw,
      basicSalary: String(newBasic)
    }));
  };

  useEffect(() => {
    if (form.toDate) {
      const nextDay = getNextDay(form.toDate);
      setNewSalaryForm(prev => ({ ...prev, fromDate: nextDay }));
    }
  }, [form.toDate]);





  const fetchSalary = async () => {
    if (!empId) {
      setSalaryList([]);
      setFetchLoading(false);
      return;
    }
    setFetchLoading(true);
    try {
      const res = await portalInstance.get(`/users/employee/salary/${empId}`);
      const data = res.data.data || [];
      setSalaryList(data);

    } catch (err) {
      console.error("Fetch salary error:", err);
      setSalaryList([]);
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchIncrementDocs = async () => {
    const targetId = empId || emp?.empId || emp?.empIdString || emp?._id;
    if (!targetId) return;
    try {
      const res = await portalInstance.get(`/users/employee/increment-documents/${targetId}`);
      if (res.data?.success) {
        setExistingIncrementDocs(res.data.data || []);
      }
    } catch (err) {
      console.error("Fetch increment docs error:", err);
    }
  };

  useEffect(() => {
    fetchSalary();
    fetchIncrementDocs();
  }, [empId]);

  useEffect(() => {
    if (!editingId) {
      resetForm();
    }
  }, [salaryList, editingId]);



  const getNextDay = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const resetForm = () => {
    setEditingId(null);

    // Cumulative: Show all unique allowances ever used for this employee as defaults
    const latestAllowances = allowanceSuggestions.map(label => ({ label, value: "0" }));

    let defaultFromDate = "";
    if (salaryList.length === 0) {
      // 1) First time: Default to dateJoined
      defaultFromDate = emp?.dateJoined?.slice(0, 10) || "";
    } else {
      // 2) Subsequent: Default to previous toDate + 1 day
      const lastRecord = salaryList[0]; // Assuming newest is first
      if (lastRecord.toDate) {
        defaultFromDate = getNextDay(lastRecord.toDate.slice(0, 10));
      }
    }

    setForm({
      fromDate: defaultFromDate,
      toDate: "",
      basicSalary: "",
      targetTotal: "",
      allowances: latestAllowances,
    });

    setNewSalaryForm({
      targetTotal: "",
      basicSalary: "",
      allowances: latestAllowances,
      fromDate: ""
    });

    // Synchronize Year/Month dropdowns
    if (defaultFromDate) {
      const [y, m] = defaultFromDate.split("-");
      setSelYear(y);
      setSelMonth(String(parseInt(m) - 1));
    } else {
      setSelYear("");
      setSelMonth("");
    }

    setIncrementLetterFile(null);
    setPerformanceFormFile(null);
    setIsEditingIncLetter(false);
    setIsEditingPerfForm(false);
    if (incLetterInputRef.current) incLetterInputRef.current.value = "";
    if (perfFormInputRef.current) perfFormInputRef.current.value = "";
  };

  const currentFinancialYear = useMemo(() => {
    const activeFrom = isTransition ? newSalaryForm.fromDate : form.fromDate;
    const activeTo = isTransition ? (newSalaryForm.toDate || form.toDate) : form.toDate;

    if (activeFrom) {
      const d = new Date(activeFrom);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = d.getMonth(); // 0 = Jan, 3 = Apr
        const startY = m >= 3 ? y : y - 1;

        if (activeTo) {
          const dTo = new Date(activeTo);
          if (!isNaN(dTo.getTime())) {
            const toY = dTo.getFullYear();
            if (toY > startY) {
              return `${startY}–${toY}`;
            }
          }
        }
        return `${startY}–${startY + 1}`;
      }
    }

    const cur = new Date();
    const curYear = cur.getFullYear();
    const curMonth = cur.getMonth();
    return curMonth >= 3 ? `${curYear}–${curYear + 1}` : `${curYear - 1}–${curYear}`;
  }, [isTransition, newSalaryForm.fromDate, newSalaryForm.toDate, form.fromDate, form.toDate]);

  const salaryPeriodDisplay = useMemo(() => {
    const activeFrom = isTransition ? newSalaryForm.fromDate : form.fromDate;
    const activeTo = isTransition ? (newSalaryForm.toDate || "") : form.toDate;

    if (!activeFrom) return "";
    const dFrom = new Date(activeFrom);
    if (isNaN(dFrom.getTime())) return "";

    const fromFormatted = dFrom.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (activeTo) {
      const dTo = new Date(activeTo);
      if (!isNaN(dTo.getTime())) {
        const toFormatted = dTo.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
        return `${fromFormatted} – ${toFormatted}`;
      }
    }
    return `From ${fromFormatted}`;
  }, [isTransition, newSalaryForm.fromDate, newSalaryForm.toDate, form.fromDate, form.toDate]);

  const normalizeFY = (fy) => String(fy || "").replace(/[\u2013\u2014–-]/g, "–").trim();

  const existingDocForYear = useMemo(() => {
    if (!existingIncrementDocs || existingIncrementDocs.length === 0) return null;
    return (
      existingIncrementDocs.find(
        (d) => normalizeFY(d.financialYear) === normalizeFY(currentFinancialYear)
      ) || null
    );
  }, [existingIncrementDocs, currentFinancialYear]);

  const existingIncLetter = existingDocForYear?.incrementLetter;
  const hasExistingIncLetter = Boolean(existingIncLetter?.fileKey || existingIncLetter?.fileName);

  const existingPerfForm = existingDocForYear?.performanceForm;
  const hasExistingPerfForm = Boolean(existingPerfForm?.fileKey || existingPerfForm?.fileName);

  useEffect(() => {
    setIsEditingIncLetter(false);
    setIsEditingPerfForm(false);
    setIncrementLetterFile(null);
    setPerformanceFormFile(null);
    if (incLetterInputRef.current) incLetterInputRef.current.value = "";
    if (perfFormInputRef.current) perfFormInputRef.current.value = "";
  }, [currentFinancialYear]);

  const handleViewExistingDoc = async (docObj, docField = "incrementLetter") => {
    if (!docObj) return;
    const targetKey = docObj.fileKey;
    const directUrl = docObj.fileUrl;

    setViewingDocKey(targetKey || docField);
    try {
      if (targetKey) {
        const payload = {
          key: targetKey,
          empId: empId || emp?.empId || emp?.empIdString || emp?._id,
        };
        const res = await portalInstance.post("/users/document-view-url", payload);
        if (res.data?.success && res.data?.url) {
          window.open(res.data.url, "_blank", "noopener,noreferrer");
          return;
        }
      }
      if (directUrl) {
        window.open(directUrl, "_blank", "noopener,noreferrer");
        return;
      }
      flash("Unable to open document. URL not available.", true);
    } catch (err) {
      console.error("View doc error:", err);
      if (directUrl) {
        window.open(directUrl, "_blank", "noopener,noreferrer");
      } else {
        flash("Failed to open document preview.", true);
      }
    } finally {
      setViewingDocKey(null);
    }
  };

  const handleIncrementLetterChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        flash("File size must be less than 10MB.", true);
        return;
      }
      setIncrementLetterFile(file);
      flash("Increment Letter selected.");
    }
  };

  const handlePerformanceFormChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        flash("File size must be less than 10MB.", true);
        return;
      }
      setPerformanceFormFile(file);
      flash("Performance Form selected.");
    }
  };

  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete || !existingDocForYear) return;
    setDeletingDoc(true);

    const isHrUser = user?.isHr && user?.role !== "admin";
    if (isHrUser) {
      try {
        const docObj = docToDelete.docType === "incrementLetter" ? existingIncLetter : existingPerfForm;
        const reqPayload = {
          actionType: "DELETE_DOCUMENT",
          targetModule: "EMPLOYEE",
          summary: `Delete ${docToDelete.title} for ${emp?.name || "Employee"}${getCleanEmpCode()}`,
          payload: {
            empId: empId,
            empIdString: emp?.empIdString || emp?.empId || empId,
            empName: emp?.name,
            isGeneral: false,
            documentType: docToDelete.docType,
            documentLabel: docToDelete.title,
            fileKey: docObj?.fileKey || null,
            fileUrl: docObj?.fileUrl || null,
            financialYear: existingDocForYear.financialYear,
            docId: existingDocForYear._id || null,
            docType: docToDelete.docType,
            changes: [
              {
                fieldName: docToDelete.title,
                from: docObj?.fileName || docObj?.fileKey?.split("/").pop() || "Uploaded File",
                to: "Deleted (Removal Requested)",
                fileKey: docObj?.fileKey || null,
                isDocument: true,
              },
            ],
          },
        };
        await portalInstance.post("/hr-approval/submit", reqPayload);
        flash("Document deletion request submitted for Admin approval!");
        setDocToDelete(null);
      } catch (err) {
        console.error("Error submitting document deletion request:", err);
        flash(err?.response?.data?.message || `Failed to submit delete request for ${docToDelete.title}.`, true);
      } finally {
        setDeletingDoc(false);
      }
      return;
    }

    try {
      const targetDocId = existingDocForYear._id || encodeURIComponent(existingDocForYear.financialYear);
      const query = `?docType=${docToDelete.docType}`;
      await portalInstance.delete(`/users/employee/increment-documents/${empId}/${targetDocId}${query}`);
      flash(`${docToDelete.title} deleted successfully from database and S3.`);
      setDocToDelete(null);
      fetchIncrementDocs();
    } catch (err) {
      console.error("Error deleting document:", err);
      flash(err?.response?.data?.message || `Failed to delete ${docToDelete.title}.`, true);
    } finally {
      setDeletingDoc(false);
    }
  };

  const flash = (msg, isError = false) => {
    if (!isMounted.current) return;
    // Dismiss previous to keep the modal edge clean
    if (toastIdRef.current) toast.dismiss(toastIdRef.current);

    toastIdRef.current = isError
      ? toast.error(msg, { containerId: "sal-modal-toast" })
      : toast.success(msg, { containerId: "sal-modal-toast" });
  };

  // ── Reverse Split Logic ────────────────────────────────────────────────────
  const handleTargetTotalChange = (val) => {
    const raw = fromIndian(val);
    const num = Number(raw) || 0;
    // Auto-fill Basic as 50% of the Total Salary
    const newBasic = Math.floor(num * 0.5);
    setForm({ ...form, targetTotal: raw, basicSalary: String(newBasic) });
  };

  // ── Manage Allowances ──────────────────────────────────────────────────────
  const addAllowanceRow = () => {
    setForm({
      ...form,
      allowances: [...form.allowances, { label: "", value: "0" }],
    });
    flash("New allowance row added.");
  };

  const removeAllowanceRow = (index) => {
    const updated = form.allowances.filter((_, i) => i !== index);
    setForm({ ...form, allowances: updated });
  };

  const updateAllowance = (index, field, val) => {
    const updated = [...form.allowances];
    updated[index][field] = val;
    setForm({ ...form, allowances: updated });
  };

  // ── Submit (Add or Update) ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    // ── Check mandatory file uploads ──────────────────────────
    if (hasExistingIncLetter) {
      if (isEditingIncLetter && !incrementLetterFile) {
        flash("Please select a new Increment Letter to replace, or click Cancel to keep the existing document.", true);
        return;
      }
    } else {
      if (!incrementLetterFile) {
        flash("Please upload the Increment Letter.", true);
        return;
      }
    }

    if (isTransition) {
      let { toDate } = form;
      let { fromDate, basicSalary, allowances, targetTotal } = newSalaryForm;

      if (!empId) {
        flash("Employee ID is missing.", true);
        return;
      }

      if (!toDate) {
        flash("Previous Salary End Date (To Date) is required.", true);
        return;
      }

      if (!fromDate) {
        flash("New Salary Active From Date is required.", true);
        return;
      }

      // Process new salary split
      let finalBasic = Number(basicSalary) || 0;
      if (targetTotal && Number(targetTotal) > 0) {
        const target = Number(targetTotal);
        const currentSum = allowances.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
        finalBasic = target - currentSum;
      }

      if (finalBasic < 0) {
        flash("Sum of new allowances exceeds target total. Please adjust.", true);
        return;
      }

      const processedAllowances = allowances
        .filter(a => a.label.trim() !== "" && Number(a.value) > 0)
        .map(a => ({ label: a.label.trim(), value: Number(a.value) }));

      setLoading(true);
      try {
        const previousSalary = salaryList[0];
        const previousPayload = {
          ...previousSalary,
          toDate: toDate
        };

        const totalCalculated = targetTotal ? Number(targetTotal) : (finalBasic + processedAllowances.reduce((sum, a) => sum + a.value, 0));

        const formData = new FormData();
        formData.append("empId", empId);
        formData.append("fromDate", fromDate);
        if (toDate) formData.append("toDate", toDate);
        formData.append("basicSalary", String(finalBasic));
        formData.append("allowances", JSON.stringify(processedAllowances));
        formData.append("totalSalary", String(totalCalculated));
        formData.append("financialYear", currentFinancialYear);
        if (previousSalary?._id) formData.append("salaryId", previousSalary._id);
        if (incrementLetterFile) formData.append("incrementLetter", incrementLetterFile);
        if (performanceFormFile) formData.append("performanceForm", performanceFormFile);

        const newPayload = {
          empId,
          fromDate,
          toDate: null,
          basicSalary: finalBasic,
          allowances: processedAllowances,
          totalSalary: totalCalculated
        };

        if (user?.isHr && user?.role !== "admin") {
          let uploadRes = null;
          if (incrementLetterFile || performanceFormFile) {
            try {
              uploadRes = await portalInstance.post("/users/employee/increment-documents", formData);
            } catch (uploadErr) {
              console.error("Increment docs upload error:", uploadErr);
            }
          }

          const docData = uploadRes?.data?.data;
          const attachedDocs = {
            financialYear: docData?.financialYear || currentFinancialYear,
            incrementLetter: docData?.incrementLetter || (incrementLetterFile ? {
              fileName: incrementLetterFile.name,
            } : existingIncLetter || null),
            performanceForm: docData?.performanceForm || (performanceFormFile ? {
              fileName: performanceFormFile.name,
            } : existingPerfForm || null),
          };

          const isBasicChanged = previousSalary ? Number(previousSalary.basicSalary) !== Number(newPayload.basicSalary) : true;
          const isTotalChanged = previousSalary ? Number(previousSalary.totalSalary) !== Number(newPayload.totalSalary) : true;
          const prevAllowances = previousSalary?.allowances || [];
          const newAllowances = newPayload.allowances || [];
          const isAllowancesChanged = 
            prevAllowances.length !== newAllowances.length ||
            newAllowances.some(na => {
              const pa = prevAllowances.find(p => p.label === na.label);
              return !pa || Number(pa.value) !== Number(na.value);
            });
          const hasSalaryChange = isBasicChanged || isTotalChanged || isAllowancesChanged;
          const isDocUploaded = Boolean(attachedDocs.incrementLetter || attachedDocs.performanceForm);

          let reqSummary = `Transition salary for ${emp?.name || "Employee"}${getCleanEmpCode()}`;
          if (!hasSalaryChange && isDocUploaded) {
            reqSummary = `Update increment document for ${emp?.name || "Employee"}${getCleanEmpCode()}`;
          } else if (hasSalaryChange && isDocUploaded) {
            reqSummary = `Transition salary & increment document for ${emp?.name || "Employee"}${getCleanEmpCode()}`;
          }

          const reqPayload = {
            actionType: "UPDATE_SALARY",
            targetModule: "EMPLOYEE",
            summary: reqSummary,
            payload: {
              empId,
              empName: emp?.name,
              empIdString: getCleanEmpCode().replace(/[() ]/g, "") || empId,
              isTransition: true,
              previousSalary,
              newSalary: newPayload,
              documents: attachedDocs,
              previousData: {
                basicSalary: previousSalary?.basicSalary ?? "-",
                totalSalary: previousSalary?.totalSalary ?? "-",
                allowances: previousSalary?.allowances ?? [],
              },
              updatedData: {
                basicSalary: newPayload.basicSalary,
                totalSalary: newPayload.totalSalary,
                allowances: newPayload.allowances,
              },
              changes: buildSalaryChanges(previousSalary, newPayload, processedAllowances, attachedDocs)
            }
          };
          await portalInstance.post("/hr-approval/submit", reqPayload);
          flash("Salary transition request submitted for Admin approval!");
          setTimeout(() => onClose(), 1200);
          return;
        }

        // Step 1: Update the previous active salary's toDate
        await portalInstance.put(`/users/employee/salary/${empId}/${previousSalary._id}`, previousPayload);

        // Step 2: Post the new active salary details with uploaded files
        await portalInstance.post("/users/employee/salary", formData);

        flash("Salary transitioned successfully!");
        setActiveTab("history");
        resetForm();
        fetchSalary();
        fetchIncrementDocs();
      } catch (err) {
        flash(err?.response?.data?.message || "Failed to transition salary.", true);
      } finally {
        setLoading(false);
      }

    } else {
      let { fromDate, toDate, basicSalary, allowances, targetTotal } = form;

      if (!empId) {
        flash("Employee ID is missing.", true);
        return;
      }

      if (!fromDate) {
        flash("From Date is required.", true);
        return;
      }

      let finalBasic = Number(basicSalary) || 0;
      if (targetTotal && Number(targetTotal) > 0) {
        const target = Number(targetTotal);
        const currentSum = allowances.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
        finalBasic = target - currentSum;
      }

      if (finalBasic < 0) {
        flash("Sum of allowances exceeds target total. Please adjust.", true);
        return;
      }

      const processedAllowances = allowances
        .filter(a => a.label.trim() !== "" && Number(a.value) > 0)
        .map(a => ({ label: a.label.trim(), value: Number(a.value) }));

      const totalCalculated = targetTotal ? Number(targetTotal) : (finalBasic + sumAllowances);

      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("empId", empId);
        formData.append("fromDate", fromDate);
        if (toDate) formData.append("toDate", toDate);
        formData.append("basicSalary", String(finalBasic));
        formData.append("allowances", JSON.stringify(processedAllowances));
        formData.append("totalSalary", String(totalCalculated));
        formData.append("financialYear", currentFinancialYear);
        if (editingId) formData.append("salaryId", editingId);
        if (incrementLetterFile) formData.append("incrementLetter", incrementLetterFile);
        if (performanceFormFile) formData.append("performanceForm", performanceFormFile);

        const payload = {
          empId,
          fromDate,
          toDate: toDate || null,
          basicSalary: finalBasic,
          allowances: processedAllowances,
          totalSalary: totalCalculated,
        };

        if (user?.isHr && user?.role !== "admin") {
          let uploadRes = null;
          if (incrementLetterFile || performanceFormFile) {
            try {
              uploadRes = await portalInstance.post("/users/employee/increment-documents", formData);
            } catch (uploadErr) {
              console.error("Increment docs upload error:", uploadErr);
            }
          }

          const docData = uploadRes?.data?.data;
          const attachedDocs = {
            financialYear: docData?.financialYear || currentFinancialYear,
            incrementLetter: docData?.incrementLetter || (incrementLetterFile ? {
              fileName: incrementLetterFile.name,
            } : existingIncLetter || null),
            performanceForm: docData?.performanceForm || (performanceFormFile ? {
              fileName: performanceFormFile.name,
            } : existingPerfForm || null),
          };

          const currentRec = editingId ? salaryList.find(s => s._id === editingId) : salaryList[0];

          const isBasicChanged = currentRec ? Number(currentRec.basicSalary) !== Number(payload.basicSalary) : true;
          const isTotalChanged = currentRec ? Number(currentRec.totalSalary) !== Number(payload.totalSalary) : true;
          const prevAllowances = currentRec?.allowances || [];
          const newAllowances = payload.allowances || [];
          const isAllowancesChanged = 
            prevAllowances.length !== newAllowances.length ||
            newAllowances.some(na => {
              const pa = prevAllowances.find(p => p.label === na.label);
              return !pa || Number(pa.value) !== Number(na.value);
            });
          const hasSalaryChange = isBasicChanged || isTotalChanged || isAllowancesChanged;
          const isDocUploaded = Boolean(attachedDocs.incrementLetter || attachedDocs.performanceForm);

          let reqSummary = `${editingId ? "Update" : "Add"} salary for ${emp?.name || "Employee"}${getCleanEmpCode()}`;
          if (!hasSalaryChange && isDocUploaded) {
            reqSummary = `Update increment document for ${emp?.name || "Employee"}${getCleanEmpCode()}`;
          } else if (hasSalaryChange && isDocUploaded) {
            reqSummary = `${editingId ? "Update" : "Add"} salary & increment document for ${emp?.name || "Employee"}${getCleanEmpCode()}`;
          }

          const reqPayload = {
            actionType: "UPDATE_SALARY",
            targetModule: "EMPLOYEE",
            summary: reqSummary,
            payload: {
              empId,
              empName: emp?.name,
              empIdString: getCleanEmpCode().replace(/[() ]/g, "") || empId,
              isTransition: false,
              editingId: editingId || null,
              newSalary: payload,
              documents: attachedDocs,
              previousData: {
                basicSalary: currentRec?.basicSalary ?? "-",
                totalSalary: currentRec?.totalSalary ?? "-",
                allowances: currentRec?.allowances ?? [],
              },
              updatedData: {
                basicSalary: payload.basicSalary,
                totalSalary: payload.totalSalary,
                allowances: payload.allowances,
              },
              changes: buildSalaryChanges(currentRec, payload, payload.allowances, attachedDocs)
            }
          };
          await portalInstance.post("/hr-approval/submit", reqPayload);
          flash("Salary update request submitted for Admin approval!");
          setTimeout(() => onClose(), 1200);
          return;
        }

        if (editingId) {
          await portalInstance.put(`/users/employee/salary/${empId}/${editingId}`, formData);
          flash("Salary updated in Indian Format successfully!");
          setActiveTab("history");
        } else {
          await portalInstance.post("/users/employee/salary", formData);
          flash("Salary record saved with perfect split!");
          setActiveTab("history");
        }

        resetForm();
        fetchSalary();
        fetchIncrementDocs();
      } catch (err) {
        flash(err?.response?.data?.message || "Action failed.", true);
      } finally {
        setLoading(false);
      }
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────

  const handleEdit = (entry) => {
    setEditingId(entry._id);
    const dateStr = entry.fromDate?.slice(0, 10) || "";
    setForm({
      fromDate: dateStr,
      toDate: entry.toDate?.slice(0, 10) || "",
      basicSalary: entry.basicSalary || "",
      targetTotal: entry.totalSalary || "",
      allowances: entry.allowances?.length > 0
        ? entry.allowances.map(a => ({ label: a.label, value: String(a.value) }))
        : initialAllowances,
    });

    // Synchronize Year/Month dropdowns
    if (dateStr) {
      const [y, m] = dateStr.split("-");
      setSelYear(y);
      setSelMonth(String(parseInt(m) - 1)); // 0-indexed months
    } else {
      setSelYear("");
      setSelMonth("");
    }

    setActiveTab("form");
    setTimeout(() => {
      const container = document.querySelector(".sal-scroll-container");
      if (container) {
        container.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 100);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (salaryId) => {
    setDeleteConfirm(salaryId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setLoading(true);
    try {
      await portalInstance.delete(`/users/employee/salary/${empId}/${deleteConfirm}`);
      flash("Record removed successfully.");
      setDeleteConfirm(null);
      fetchSalary();
    } catch (err) {
      flash("Delete failed.", true);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");

  // ── Date Selection Helpers ────────────────────────────────────────────────
  const getYears = () => {
    const years = [];
    const now = new Date();
    const startDate = emp?.dateJoined ? new Date(emp.dateJoined) : new Date(now.getFullYear() - 5, 0, 1);
    const startYear = startDate.getFullYear();
    const currentYear = now.getFullYear() + 1; // Allow selecting next year for future records

    for (let y = startYear; y <= currentYear; y++) {
      years.push(y);
    }
    return years;
  };

  const getMonths = (year) => {
    if (!year) return [];
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return monthNames.map((name, index) => ({ label: name, value: index }));
  };

  const getStartOfMonthStr = (year, month) => {
    const y = parseInt(year);
    const m = String(parseInt(month) + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const getEndOfMonthStr = (year, month) => {
    const y = parseInt(year);
    const m = parseInt(month);
    const d = new Date(y, m + 1, 0); // Last day of selected month
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleYearMonthChange = (year, month) => {
    setSelYear(year);
    setSelMonth(month);
    if (year !== "" && month !== "") {
      const endDay = getEndOfMonthStr(year, month);
      setForm(prev => ({ ...prev, toDate: endDay }));
    }
  };

  const getYearsForToDate = () => {
    const years = [];
    const now = new Date();
    const fromDate = form.fromDate ? new Date(form.fromDate) : null;
    const startYear = fromDate ? fromDate.getFullYear() : (emp?.dateJoined ? new Date(emp.dateJoined).getFullYear() : now.getFullYear() - 5);
    const currentYear = now.getFullYear();

    for (let y = startYear; y <= currentYear; y++) {
      years.push(y);
    }
    return years;
  };

  const handleYearMonthChangeFrom = (year, month) => {
    setSelYear(year);
    setSelMonth(month);
    if (year !== "" && month !== "") {
      const startDay = getStartOfMonthStr(year, month);
      setForm(prev => ({ ...prev, fromDate: startDay }));
    }
  };

  // ── Indian Format Helpers ──────────────────────────────────────────────────
  const toIndian = (val) => {
    if (!val && val !== 0) return "";
    const clean = String(val).replace(/[^0-9]/g, "");
    if (!clean) return "";
    return Number(clean).toLocaleString("en-IN");
  };

  const fromIndian = (val) => String(val).replace(/[^0-9]/g, "");

  const formatCurrency = (n) => {
    if (n == null || n === "") return "₹0";
    return `₹${Number(n).toLocaleString("en-IN")}`;
  };

  const [activeTab, setActiveTab] = useState("form");

  // ── Stats for History ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (salaryList.length === 0) return { highest: 0, latest: "-", starting: 0, current: 0 };
    const totals = salaryList.map(s => s.totalSalary || 0);
    const highest = Math.max(...totals);
    const latestDate = salaryList[0]?.fromDate;
    const currentSalary = salaryList[0]?.totalSalary || 0;
    const startingSalary = salaryList[salaryList.length - 1]?.totalSalary || 0;

    return {
      highest,
      latest: formatDate(latestDate),
      starting: startingSalary,
      current: currentSalary
    };
  }, [salaryList]);

  const paginatedSalaryList = useMemo(() => {
    const startIndex = (salCurrentPage - 1) * 5;
    return salaryList.slice(startIndex, startIndex + 5);
  }, [salaryList, salCurrentPage]);

  useEffect(() => {
    setSalCurrentPage(1);
  }, [salaryList]);

  const handleExport = () => {
    if (salaryList.length === 0) return;
    const headers = ["Period From", "Period To", "Basic Salary", "Allowances", "Total Salary", "Created At"];
    const rows = salaryList.map(s => [
      formatDate(s.fromDate),
      s.toDate ? formatDate(s.toDate) : "Present",
      s.basicSalary,
      s.allowances?.map(a => `${a.label}:${a.value}`).join("; ") || "None",
      s.totalSalary,
      new Date(s.addedAt || s.createdAt).toLocaleString("en-IN")
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers, ...rows].map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Salary_History_${emp?.name?.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="sal-overlay">
      <div className="sal-modal sal-modal-premium" onClick={(e) => e.stopPropagation()}>
        {/* Local Toast Container: Shows toasts exactly at the modal edge */}
        <ToastContainer
          containerId="sal-modal-toast"
          position="top-right"
          autoClose={2500}
          hideProgressBar
          style={{ position: "absolute", zIndex: 9999, top: "10px", right: "10px", width: "auto" }}
        />

        {/* Document Delete Confirmation Overlay */}
        {docToDelete && (
          <div className="sal-delete-confirm-overlay animate-in" style={{ background: "rgba(0,0,0,0.5)", zIndex: 10000 }}>
            <div className="sal-delete-confirm-modal">
              <h3>Delete Document?</h3>
              <p>Are you sure you want to permanently delete this <strong>{docToDelete.title}</strong> from database and S3?</p>
              <div className="sal-delete-confirm-actions">
                <button className="sal-confirm-cancel" onClick={() => setDocToDelete(null)} disabled={deletingDoc}>
                  Cancel
                </button>
                <button className="sal-confirm-delete" onClick={handleConfirmDeleteDoc} disabled={deletingDoc}>
                  {deletingDoc ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="sal-header-new">
          <div className="sal-header-left">
            <div>
              <h2 className="sal-title-new">Salary Details</h2>
              <p className="sal-subtitle-new">Configure compensation for <strong>{emp?.name}</strong></p>
            </div>
          </div>
          <div className="sal-header-actions">
            <div className="sal-tabs">
              <button className={`sal-tab ${activeTab === "form" ? "is-active" : ""}`} onClick={() => setActiveTab("form")}>
                {editingId ? "Edit Salary" : "Add Salary"}
              </button>
              <button className={`sal-tab ${activeTab === "history" ? "is-active" : ""}`} onClick={() => setActiveTab("history")}>
                View Details
              </button>
            </div>
            <button className="sal-close-new" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="sal-scroll-container">
          {activeTab === "form" ? (
            <div className="sal-content-view animate-in">
              <div className="sal-card-main sal-salary-card" id="sal-form-section">
                <div className="sal-card-header d-flex align-items-center flex-wrap" style={{ justifyContent: "flex-start", gap: "10px" }}>
                  <h3 className="m-0">
                    {isTransition ? "Salary Transition (Add New Salary)" : (editingId ? "Update Salary Details" : "Add Salary Details")}
                  </h3>
                  {!editingId && salaryList.length > 0 && (
                    <div className="sal-todate-info" style={{ width: "auto", margin: 0, padding: "6px 12px", marginLeft: "10px" }}>
                      <span className="sal-date-label">Current Active:</span>
                      <strong>{formatDate(salaryList[0].fromDate)} — ₹{toIndian(salaryList[0].totalSalary || 0)}</strong>
                    </div>
                  )}
                </div>

                <div className="sal-form-grid">
                  <div className="sal-period-grid" style={{ gridColumn: "1 / -1" }}>
                    <div className="sal-input-group" style={{ gridColumn: "1 / -1" }}>
                      <label>
                        {isTransition
                          ? `Previous Salary End Date (To Date) [Active Salary: ₹${toIndian(salaryList[0]?.totalSalary || 0)}]`
                          : (editingId ? "Edit Salary Period" : "Salary Active Period")}
                        <span className="sal-req">*</span>
                      </label>
                      <div className="sal-todate-section" style={{ width: "100%" }}>
                        <div className="sal-todate-info sal-todate-info-from" style={{ borderBottom: "none", marginBottom: 0, paddingBottom: "14px", flexDirection: "row", gap: "24px", width: "100%", alignItems: "stretch" }}>

                          {/* Left Side: From Date */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                            <span className="sal-date-label sal-date-label-block" style={{ margin: 0, fontWeight: "500" }}>
                              {isTransition ? "Previous Salary Active From:" : (editingId ? "Edit Active From Date:" : "Salary Active From:")}
                            </span>
                            <div className="sal-select-box sal-custom-date-box" style={{ width: "100%" }}>
                              <label>From</label>
                              <div className="sal-input-wrapper sal-custom-date-pick">
                                <input
                                  type="date"
                                  value={isTransition ? (salaryList[0]?.fromDate?.slice(0, 10) || "") : form.fromDate}
                                  onChange={(e) => {
                                    if (!isTransition) {
                                      setForm({ ...form, fromDate: e.target.value });
                                      setSelYearFrom(""); setSelMonthFrom("");
                                    }
                                  }}
                                  disabled={isTransition}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Vertical Divider */}
                          <div className="sal-divider-vertical"></div>

                          {/* Right Side: To Date */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                            <span className="sal-date-label sal-date-label-block" style={{ margin: 0, fontWeight: "500" }}>
                              {isTransition ? "Previous Salary End Date:" : (editingId ? "Edit Period To Date:" : "Period To:")}
                            </span>
                            <div className="sal-select-box sal-custom-date-box" style={{ width: "100%" }}>
                              <label>To</label>
                              <div className="sal-input-wrapper sal-custom-date-pick">
                                <input
                                  className="sal-detail-input"
                                  type="date"
                                  value={form.toDate}
                                  onChange={(e) => {
                                    setForm({ ...form, toDate: e.target.value });
                                    setSelYear(""); setSelMonth("");
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                        </div>

                        <div style={{ display: "flex", gap: "24px", marginTop: "8px", width: "100%" }}>
                          {form.fromDate && !isTransition && (
                            <div className="sal-todate-preview" style={{ flex: 1, margin: 0 }}>
                              <span>Starts: <strong>{formatDate(form.fromDate)}</strong></span>
                            </div>
                          )}
                          {isTransition && salaryList[0]?.fromDate && (
                            <div className="sal-todate-preview" style={{ flex: 1, margin: 0 }}>
                              <span>Starts: <strong>{formatDate(salaryList[0].fromDate)}</strong></span>
                            </div>
                          )}
                          {form.toDate && (
                            <div className="sal-todate-preview" style={{ flex: 1, margin: 0 }}>
                              <span>Ends: <strong>{formatDate(form.toDate)}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {isTransition && (
                  <div className="sal-new-bank-section" style={{ marginTop: "24px", paddingTop: "20px", borderTop: "2px solid #e2e8f0", gridColumn: "1 / -1" }}>
                    <h4 className="sal-section-title" style={{ fontSize: "16px", fontWeight: "500", color: "#3A4B71", marginBottom: "16px" }}>
                      New Salary Details (Starts Active on the Next Day)
                    </h4>
                    <div className="sal-form-grid" style={{ padding: 0 }}>
                      <div className="sal-input-group">
                        <label>New Salary Active From</label>
                        <div className="sal-input-wrapper sal-custom-date-pick">
                          <input
                            type="date"
                            value={newSalaryForm.fromDate}
                            onChange={(e) => setNewSalaryForm({ ...newSalaryForm, fromDate: e.target.value })}
                          />
                        </div>
                        {newSalaryForm.fromDate && (
                          <div className="sal-todate-preview" style={{ marginTop: "4px" }}>
                            <span>Starts: <strong>{formatDate(newSalaryForm.fromDate)}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="sal-form-grid-2">
                  <div className="sal-input-group">
                    <label>{isTransition ? "New Target Total Salary" : "Target Total Salary"}</label>
                    <div className="sal-input-wrapper is-highlight">
                      <span className="sal-currency-label">₹</span>
                      <input
                        type="text"
                        placeholder="e.g.20,000"
                        value={toIndian(isTransition ? newSalaryForm.targetTotal : form.targetTotal)}
                        onChange={(e) => isTransition ? handleNewTargetTotalChange(e.target.value) : handleTargetTotalChange(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="sal-input-group">
                    <label>{isTransition ? "New Basic Salary" : "Basic Salary"} <span className="sal-req">*</span></label>
                    <div className="sal-input-wrapper">
                      <span className="sal-currency-label">₹</span>
                      <input
                        type="text"
                        value={toIndian(isTransition ? newSalaryForm.basicSalary : form.basicSalary)}
                        onChange={(e) => {
                          const val = fromIndian(e.target.value);
                          if (isTransition) {
                            setNewSalaryForm({ ...newSalaryForm, basicSalary: val });
                          } else {
                            setForm({ ...form, basicSalary: val });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="sal-allowance-section">
                  <div className="sal-allowance-header-row">
                    <div className="sal-card-header">
                      <h3>{isTransition ? "New Allowances & Benefits" : "Allowances & Benefits"}</h3>
                    </div>
                    <div className="sal-header-right-tools">
                      {(isTransition ? newSalaryForm.targetTotal : form.targetTotal) && (
                        <div className={`sal-balance-tag ${(isTransition ? newRemaining : remaining) < 0 ? 'is-exceeded' : 'is-remaining'}`}>
                          {(isTransition ? newRemaining : remaining) < 0 ? `Extra: ${formatCurrency(Math.abs(isTransition ? newRemaining : remaining))}` :
                            (isTransition ? newRemaining : remaining) > 0 ? `Remaining: ${formatCurrency(isTransition ? newRemaining : remaining)}` :
                              "Perfectly Balanced"}
                        </div>
                      )}
                      <button className="sal-add-btn" onClick={isTransition ? addNewAllowanceRow : addAllowanceRow}>+ Add Allowance</button>
                    </div>
                  </div>

                  <div className="sal-allowance-list-new">
                    {(isTransition ? newSalaryForm.allowances : form.allowances).map((al, idx) => (
                      <div className="sal-allowance-row-new" key={idx}>
                        <span className="sal-drag-handle">::</span>
                        <input
                          type="text"
                          className="sal-label-input"
                          placeholder="Allowance Name"
                          value={al.label}
                          onChange={(e) => isTransition ? updateNewAllowance(idx, 'label', e.target.value) : updateAllowance(idx, 'label', e.target.value)}
                          list="allowance-names"
                        />
                        <div className="sal-value-input-wrap">
                          <span className="sal-curr">₹</span>
                          <input
                            type="text"
                            className="sal-value-input"
                            value={toIndian(al.value)}
                            onChange={(e) => isTransition ? updateNewAllowance(idx, 'value', fromIndian(e.target.value)) : updateAllowance(idx, 'value', fromIndian(e.target.value))}
                          />
                        </div>
                        <button className="common-modal-btn btn-reject" onClick={() => isTransition ? removeNewAllowanceRow(idx) : removeAllowanceRow(idx)}>Delete</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Increment Documents (Increment Letter & Performance Form) ── */}
                <div className="sal-increment-docs-section">
                  <div className="sal-docs-header-row">
                    <div className="sal-card-header mb-0">
                      <h3 className="m-0">Increment Documents</h3>
                    </div>
                    <div className="sal-fy-badge">
                      <FaCalendarAlt style={{ fontSize: "12px" }} />
                      <span>
                        Financial Year: <strong>{currentFinancialYear}</strong>
                        {salaryPeriodDisplay ? ` (${salaryPeriodDisplay})` : ""}
                      </span>
                    </div>
                  </div>

                  <p className="sal-docs-hint">
                    Increment Letter is mandatory for updating salary details for Financial Year <strong>{currentFinancialYear}</strong>{salaryPeriodDisplay ? ` (${salaryPeriodDisplay})` : ""}. Performance Form is optional.
                  </p>

                  <div className="sal-upload-grid">
                    {/* Increment Letter */}
                    <div className={`sal-upload-card ${hasExistingIncLetter && !isEditingIncLetter ? 'has-existing-doc' : ''} ${isEditingIncLetter ? 'is-editing' : ''} ${incrementLetterFile ? 'has-file' : ''}`}>
                      <div className="sal-upload-header">
                        <label className="sal-upload-label">
                          <FaFileAlt style={{ color: "#3b82f6" }} />
                          Increment Letter <span className="sal-req">*</span>
                        </label>
                        {hasExistingIncLetter && !isEditingIncLetter && (
                          <span className="sal-upload-status-badge">
                            <FaCheckCircle className="me-1" /> Uploaded
                          </span>
                        )}
                        {isEditingIncLetter && (
                          <div className="d-flex align-items-center gap-2">
                            <span className="sal-edit-mode-badge">
                              Replace Mode
                            </span>
                            <button
                              type="button"
                              className="sal-btn-cancel-edit"
                              onClick={() => {
                                setIsEditingIncLetter(false);
                                setIncrementLetterFile(null);
                                if (incLetterInputRef.current) incLetterInputRef.current.value = "";
                              }}
                              title="Cancel replacement and keep existing document"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {!hasExistingIncLetter && incrementLetterFile && (
                          <span className="sal-upload-status-badge">
                            <FaCheckCircle className="me-1" /> Ready
                          </span>
                        )}
                      </div>

                      {hasExistingIncLetter && !isEditingIncLetter ? (
                        /* Existing Document Preview & Edit Actions */
                        <div className="sal-existing-doc-preview">
                          <div className="sal-existing-doc-info">
                            <div className="sal-file-icon">📄</div>
                            <div className="sal-file-meta">
                              <span className="sal-file-name" title={existingIncLetter?.fileName || "Increment Letter"}>
                                {existingIncLetter?.fileName || "Increment Letter"}
                              </span>
                              <span className="sal-file-sub-status">
                                {existingIncLetter?.uploadedAt
                                  ? `Uploaded on ${new Date(existingIncLetter.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                                  : "Document on file"}
                              </span>
                            </div>
                          </div>
                          <div className="sal-existing-doc-actions">
                            <button
                              type="button"
                              className="sal-btn-view-doc"
                              onClick={() => handleViewExistingDoc(existingIncLetter, "incrementLetter")}
                              disabled={viewingDocKey === (existingIncLetter?.fileKey || "incrementLetter")}
                              title="View Increment Letter in new tab"
                            >
                              {viewingDocKey === (existingIncLetter?.fileKey || "incrementLetter") ? (
                                <>
                                  <FaSpinner className="sal-spin me-1" /> Loading...
                                </>
                              ) : (
                                <>
                                  <FaEye className="me-1" /> View
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              className="sal-btn-edit-doc"
                              onClick={() => setIsEditingIncLetter(true)}
                              title="Upload a new document to replace this one"
                            >
                              <FaEdit className="me-1" /> Edit / Replace
                            </button>
                            <button
                              type="button"
                              className="sal-btn-delete-doc"
                              onClick={() => setDocToDelete({ docType: "incrementLetter", title: "Increment Letter" })}
                              title="Delete Increment Letter"
                            >
                              <FaTrash className="me-1" /> Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Upload Dropzone (shown when editing or when no existing document) */
                        <div
                          className="sal-file-dropzone"
                          onClick={() => incLetterInputRef.current?.click()}
                        >
                          <input
                            type="file"
                            ref={incLetterInputRef}
                            style={{ display: "none" }}
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={handleIncrementLetterChange}
                          />
                          {incrementLetterFile ? (
                            <div className="sal-file-selected-info">
                              <div className="sal-file-icon">📄</div>
                              <div className="sal-file-meta">
                                <span className="sal-file-name" title={incrementLetterFile.name}>
                                  {incrementLetterFile.name}
                                </span>
                                <span className="sal-file-size">
                                  {(incrementLetterFile.size / 1024).toFixed(1)} KB {isEditingIncLetter ? "• New file" : ""}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="sal-file-remove-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIncrementLetterFile(null);
                                  if (incLetterInputRef.current) incLetterInputRef.current.value = "";
                                }}
                                title="Remove file"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="sal-file-placeholder">
                              <div className="sal-upload-icon-wrap">
                                <FaUpload />
                              </div>
                              <span className="sal-dropzone-text">
                                {isEditingIncLetter ? "Click to choose new Increment Letter" : "Click to upload Increment Letter"}
                              </span>
                              <span className="sal-dropzone-sub">PDF, DOC, DOCX, PNG, JPG (Max 10MB)</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Performance Form */}
                    <div className={`sal-upload-card ${hasExistingPerfForm && !isEditingPerfForm ? 'has-existing-doc' : ''} ${isEditingPerfForm ? 'is-editing' : ''} ${performanceFormFile ? 'has-file' : ''}`}>
                      <div className="sal-upload-header">
                        <label className="sal-upload-label">
                          <FaFileAlt style={{ color: "#8b5cf6" }} />
                          Performance Form <span className="sal-optional-tag">(Optional)</span>
                        </label>
                        {hasExistingPerfForm && !isEditingPerfForm && (
                          <span className="sal-upload-status-badge">
                            <FaCheckCircle className="me-1" /> Uploaded
                          </span>
                        )}
                        {isEditingPerfForm && (
                          <div className="d-flex align-items-center gap-2">
                            <span className="sal-edit-mode-badge">
                              Replace Mode
                            </span>
                            <button
                              type="button"
                              className="sal-btn-cancel-edit"
                              onClick={() => {
                                setIsEditingPerfForm(false);
                                setPerformanceFormFile(null);
                                if (perfFormInputRef.current) perfFormInputRef.current.value = "";
                              }}
                              title="Cancel replacement and keep existing document"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {!hasExistingPerfForm && performanceFormFile && (
                          <span className="sal-upload-status-badge">
                            <FaCheckCircle className="me-1" /> Ready
                          </span>
                        )}
                      </div>

                      {hasExistingPerfForm && !isEditingPerfForm ? (
                        /* Existing Document Preview & Edit Actions */
                        <div className="sal-existing-doc-preview">
                          <div className="sal-existing-doc-info">
                            <div className="sal-file-icon">📋</div>
                            <div className="sal-file-meta">
                              <span className="sal-file-name" title={existingPerfForm?.fileName || "Performance Form"}>
                                {existingPerfForm?.fileName || "Performance Form"}
                              </span>
                              <span className="sal-file-sub-status">
                                {existingPerfForm?.uploadedAt
                                  ? `Uploaded on ${new Date(existingPerfForm.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                                  : "Document on file"}
                              </span>
                            </div>
                          </div>
                          <div className="sal-existing-doc-actions">
                            <button
                              type="button"
                              className="sal-btn-view-doc"
                              onClick={() => handleViewExistingDoc(existingPerfForm, "performanceForm")}
                              disabled={viewingDocKey === (existingPerfForm?.fileKey || "performanceForm")}
                              title="View Performance Form in new tab"
                            >
                              {viewingDocKey === (existingPerfForm?.fileKey || "performanceForm") ? (
                                <>
                                  <FaSpinner className="sal-spin me-1" /> Loading...
                                </>
                              ) : (
                                <>
                                  <FaEye className="me-1" /> View
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              className="sal-btn-edit-doc"
                              onClick={() => setIsEditingPerfForm(true)}
                              title="Upload a new document to replace this one"
                            >
                              <FaEdit className="me-1" /> Edit / Replace
                            </button>
                            <button
                              type="button"
                              className="sal-btn-delete-doc"
                              onClick={() => setDocToDelete({ docType: "performanceForm", title: "Performance Form" })}
                              title="Delete Performance Form"
                            >
                              <FaTrash className="me-1" /> Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Upload Dropzone (shown when editing or when no existing document) */
                        <div
                          className="sal-file-dropzone"
                          onClick={() => perfFormInputRef.current?.click()}
                        >
                          <input
                            type="file"
                            ref={perfFormInputRef}
                            style={{ display: "none" }}
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={handlePerformanceFormChange}
                          />
                          {performanceFormFile ? (
                            <div className="sal-file-selected-info">
                              <div className="sal-file-icon">📋</div>
                              <div className="sal-file-meta">
                                <span className="sal-file-name" title={performanceFormFile.name}>
                                  {performanceFormFile.name}
                                </span>
                                <span className="sal-file-size">
                                  {(performanceFormFile.size / 1024).toFixed(1)} KB {isEditingPerfForm ? "• New file" : ""}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="sal-file-remove-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPerformanceFormFile(null);
                                  if (perfFormInputRef.current) perfFormInputRef.current.value = "";
                                }}
                                title="Remove file"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="sal-file-placeholder">
                              <div className="sal-upload-icon-wrap">
                                <FaUpload />
                              </div>
                              <span className="sal-dropzone-text">
                                {isEditingPerfForm ? "Click to choose new Performance Form" : "Click to upload Performance Form"}
                              </span>
                              <span className="sal-dropzone-sub">Optional • PDF, DOC, DOCX, PNG, JPG (Max 10MB)</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="sal-form-footer">
                  <div className="sal-summary-totals"></div>
                  <div className="sal-footer-btns ">
                    <button className="common-modal-btn btn-small-cancel" onClick={onClose}>Cancel</button>
                    <button
                      className="common-modal-btn btn-update"
                      onClick={handleSubmit}
                      disabled={loading || (isTransition ? (newSalaryForm.targetTotal && newRemaining !== 0) : (form.targetTotal && remaining !== 0))}
                      title={(isTransition ? newRemaining : remaining) !== 0 ? "Please balance the total amount before saving" : ""}
                    >
                      {loading ? "Saving..." : (editingId ? "Update Record" : "Save Record")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="sal-content-view animate-in">
              {deleteConfirm && (
                <div className="sal-delete-confirm-overlay animate-in" style={{ background: "rgba(0,0,0,0.5)" }}>
                  <div className="sal-delete-confirm-modal">
                    <h3>Confirm Deletion</h3>
                    <p>Are you sure you want to permanently remove this salary record? This action cannot be undone.</p>
                    <div className="sal-delete-confirm-actions">
                      <button className="sal-confirm-cancel" onClick={() => setDeleteConfirm(null)}>No, Keep it</button>
                      <button className="sal-confirm-delete" onClick={confirmDelete} disabled={loading}>
                        {loading ? "Deleting..." : "Yes, Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="sal-card-main">
                <div className="sal-card-header">
                  <div className="sal-header-title-wrap">
                    <div>
                      <h3>Salary Details History</h3>
                      <p className="sal-header-desc">View all salary records and revisions</p>
                    </div>
                  </div>
                  <div className="sal-header-right-btns">
                    <button className="sal-add-record-direct" onClick={() => { resetForm(); setActiveTab("form"); }}>+ Add Salary</button>
                    <button className="sal-export-btn" onClick={handleExport}>Export</button>
                  </div>
                </div>

                <div className="sal-stats-grid">
                  <div className="sal-stat-card is-current-stat">
                    <div className="sal-stat-info">
                      <span className="sal-stat-label">Current Salary</span>
                      <strong className="sal-stat-value">{formatCurrency(stats.current)}</strong>
                      <span className="sal-stat-sub">Active compensation</span>
                    </div>
                  </div>
                  <div className="sal-stat-card">
                    <div className="sal-stat-info">
                      <span className="sal-stat-label">Starting Salary</span>
                      <strong className="sal-stat-value">{formatCurrency(stats.starting)}</strong>
                      <span className="sal-stat-sub">Initial record</span>
                    </div>
                  </div>
                  <div className="sal-stat-card">
                    <div className="sal-stat-info">
                      <span className="sal-stat-label">Highest Salary</span>
                      <strong className="sal-stat-value">{formatCurrency(stats.highest)}</strong>
                      <span className="sal-stat-sub">Monthly CTC</span>
                    </div>
                  </div>
                  <div className="sal-stat-card">
                    <div className="sal-stat-info">
                      <span className="sal-stat-label">Latest Update</span>
                      <strong className="sal-stat-value">{stats.latest}</strong>
                      <span className="sal-stat-sub">Most recent record</span>
                    </div>
                  </div>
                </div>

                <div className="sal-table-controls">
                  <h3>Salary History</h3>
                </div>

                <div className="sal-table-wrapper-new">
                  <table className="sal-history-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Basic Salary</th>
                        <th>Allowances</th>
                        <th>Total CTC</th>
                        <th>Updated Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSalaryList.map((entry, idx) => (
                        <tr key={entry._id || idx}>
                          <td>
                            <div className="sal-period-cell">
                              <span className={`sal-status-dot ${(salCurrentPage === 1 && idx === 0) ? "is-current" : "is-previous"}`}></span>
                              <div>
                                <strong>{formatDate(entry.fromDate)} - {entry.toDate ? formatDate(entry.toDate) : "Present"}</strong>

                              </div>
                            </div>
                          </td>
                          <td>{formatCurrency(entry.basicSalary)}</td>
                          <td>
                            <div className="sal-tags-wrap">
                              {entry.allowances?.map((al, i) => (
                                <span key={i} className="sal-tag">{al.label}: {toIndian(al.value)}</span>
                              ))}
                            </div>
                          </td>
                          <td><strong className="sal-text-green">{formatCurrency(entry.totalSalary)}</strong></td>
                          <td>
                            <div className="sal-date-cell">
                              <div>
                                <div>{formatDate(entry.addedAt || entry.createdAt)}</div>
                                <span className="sal-time-sm">{new Date(entry.addedAt || entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="sal-row-actions">
                              <button className="sal-edit-btn" onClick={() => handleEdit(entry)}>Edit</button>
                              <button className="sal-delete-btn" onClick={() => handleDelete(entry._id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="sal-pagination d-flex justify-content-center align-items-center mt-1">
                    <Pagination
                      totalItems={salaryList.length}
                      pageSize={5}
                      currentPage={salCurrentPage}
                      onPageChange={setSalCurrentPage}
                    />
                  </div>
                </div>

                {/* BANK HISTORY SECTION REMOVED FROM HERE */}
              </div>
            </div>
          )}
        </div>


        <datalist id="allowance-names">
          {allowanceSuggestions.map((name, i) => (
            <option key={i} value={name} />
          ))}
        </datalist>
      </div>
    </div>
  );
};

// ─── Bank Details Modal Component ─────────────────────────────────────────────
const BankDetailsModal = ({ emp, onClose }) => {
  const { user } = useUser();
  const empId = emp?.id || emp?.empId || emp?.employeeId;

  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    ifscCode: "",
    branch: "",
    fromDate: "",
    toDate: ""
  });
  const [newBankForm, setNewBankForm] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    ifscCode: "",
    branch: "",
    activeFrom: ""
  });
  const [newFieldErrors, setNewFieldErrors] = useState({});
  const [originalBank, setOriginalBank] = useState(null);
  const [bankHistory, setBankHistory] = useState([]);
  const [isBankEditing, setIsBankEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [lastBankUpdate, setLastBankUpdate] = useState(null);
  const [accountCreatedAt, setAccountCreatedAt] = useState(null);
  const [isIFSCFetching, setIsIFSCFetching] = useState(false);
  const [isIFSCVerified, setIsIFSCVerified] = useState(false);
  const [selYear, setSelYear] = useState("");
  const [selMonth, setSelMonth] = useState("");
  const [selYearFrom, setSelYearFrom] = useState("");
  const [selMonthFrom, setSelMonthFrom] = useState("");
  const [activeTab, setActiveTab] = useState("form");
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // ✅ Scoped Toast Logic: Dismisses when modal closes
  const isMounted = useRef(true);
  const toastIdRef = useRef(null);
  const activeDatePickerRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      isMounted.current = false;
      document.body.style.overflow = originalOverflow;
      if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    };
  }, []);

  const flash = (msg, isError = false) => {
    if (!isMounted.current) return;
    if (toastIdRef.current) toast.dismiss(toastIdRef.current);

    toastIdRef.current = isError
      ? toast.error(msg, { containerId: "bank-modal-toast" })
      : toast.success(msg, { containerId: "bank-modal-toast" });
  };

  // ── Validation Rules ──────────────────────────────────────────────
  const validateField = (name, value, isNew = false) => {
    switch (name) {
      case "bankName":
        if (!value.trim()) return "Bank Name is required";
        if (!/^[A-Za-z\s.&'-]{2,80}$/.test(value.trim())) return "Only letters, spaces, dots allowed (2-80 chars)";
        return "";
      case "accountHolder":
        if (!value.trim()) return "Account Holder Name is required";
        if (!/^[A-Za-z\s.'-]{2,80}$/.test(value.trim())) return "Only letters and spaces allowed (2-80 chars)";
        return "";
      case "accountNumber":
        if (!value.trim()) return "Account Number is required";
        if (!/^\d{9,18}$/.test(value.trim())) return "Must be 9-18 digits only";
        return "";
      case "ifscCode":
        if (!value.trim()) return "IFSC Code is required";
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.trim().toUpperCase())) return "Format: ABCD0XXXXXX (e.g. SBIN0001234)";
        return "";
      case "toDate":
        if (!isNew && originalBank && originalBank.accountNumber && !value) return "To Date is required when changing bank";
        return "";
      case "branch":
        if (!value.trim()) return "Branch Name is required";
        return "";
      default:
        return "";
    }
  };

  const validateAll = () => {
    const errors = {};
    const newErrors = {};

    const isTransition = isBankEditing && originalBank?.accountNumber;

    if (isTransition) {
      // Transition mode: old account is locked and only needs toDate validation
      errors.toDate = validateField("toDate", bankForm.toDate);

      // New account fields must be validated
      newErrors.bankName = validateField("bankName", newBankForm.bankName, true);
      newErrors.accountHolder = validateField("accountHolder", newBankForm.accountHolder, true);
      newErrors.accountNumber = validateField("accountNumber", newBankForm.accountNumber, true);
      newErrors.ifscCode = validateField("ifscCode", newBankForm.ifscCode, true);
      newErrors.branch = validateField("branch", newBankForm.branch, true);
    } else {
      // Normal setup/edit mode
      errors.bankName = validateField("bankName", bankForm.bankName);
      errors.accountHolder = validateField("accountHolder", bankForm.accountHolder);
      errors.accountNumber = validateField("accountNumber", bankForm.accountNumber);
      errors.ifscCode = validateField("ifscCode", bankForm.ifscCode);
      errors.branch = validateField("branch", bankForm.branch);

      if (editingHistoryId) {
        errors.toDate = validateField("toDate", bankForm.toDate);
      }
    }

    setFieldErrors(errors);
    setNewFieldErrors(newErrors);

    const hasOldErrors = Object.values(errors).some(e => e);
    const hasNewErrors = Object.values(newErrors).some(e => e);
    return !hasOldErrors && !hasNewErrors;
  };

  const handleFieldChange = async (name, value) => {
    let finalValue = value;

    if (["bankName", "branch", "accountHolder"].includes(name)) {
      finalValue = value.replace(/[0-9]/g, "");
    }

    setBankForm(prev => {
      const nextState = { ...prev, [name]: finalValue };
      if (name === "toDate" && !editingHistoryId && finalValue) {
        const nextDay = getNextDayStr(finalValue);
        nextState.fromDate = nextDay;

        const d = new Date(nextDay);
        setSelYearFrom(String(d.getFullYear()));
        setSelMonthFrom(String(d.getMonth()));
      }
      return nextState;
    });

    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: "" }));
    }

    if (name === "ifscCode" && value.length === 11) {
      const codeUpper = value.toUpperCase();
      if (ifscGlobalCache.has(codeUpper)) {
        const cached = ifscGlobalCache.get(codeUpper);
        setBankForm(prev => ({
          ...prev,
          bankName: cached.BANK || prev.bankName,
          branch: cached.BRANCH || prev.branch
        }));
        setIsIFSCVerified(true);
        setFieldErrors(prev => ({ ...prev, bankName: "", branch: "", ifscCode: "" }));
      } else {
        try {
          setIsIFSCFetching(true);
          setIsIFSCVerified(false);
          fetch(`https://ifsc.razorpay.com/${codeUpper}`)
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                ifscGlobalCache.set(codeUpper, data);
                setBankForm(prev => ({
                  ...prev,
                  bankName: data.BANK || prev.bankName,
                  branch: data.BRANCH || prev.branch
                }));
                setIsIFSCVerified(true);
                setFieldErrors(prev => ({ ...prev, bankName: "", branch: "", ifscCode: "" }));
              } else {
                flash("Invalid IFSC Code", true);
                setIsIFSCVerified(false);
              }
            })
            .catch((error) => {
              console.error("Error fetching IFSC details:", error);
              setIsIFSCVerified(false);
            })
            .finally(() => {
              setIsIFSCFetching(false);
            });
        } catch (error) {
          console.error("Error fetching IFSC details:", error);
          setIsIFSCVerified(false);
          setIsIFSCFetching(false);
        }
      }
    } else if (name === "ifscCode") {
      setIsIFSCVerified(false);
    }
  };

  const handleNewFieldChange = async (name, value) => {
    let finalValue = value;

    if (["bankName", "branch", "accountHolder"].includes(name)) {
      finalValue = value.replace(/[0-9]/g, "");
    }

    setNewBankForm(prev => ({ ...prev, [name]: finalValue }));

    if (newFieldErrors[name]) {
      setNewFieldErrors(prev => ({ ...prev, [name]: "" }));
    }

    if (name === "ifscCode" && value.length === 11) {
      const codeUpper = value.toUpperCase();
      if (ifscGlobalCache.has(codeUpper)) {
        const cached = ifscGlobalCache.get(codeUpper);
        setNewBankForm(prev => ({
          ...prev,
          bankName: cached.BANK || prev.bankName,
          branch: cached.BRANCH || prev.branch
        }));
        setIsIFSCVerified(true);
        setNewFieldErrors(prev => ({ ...prev, bankName: "", branch: "", ifscCode: "" }));
      } else {
        try {
          setIsIFSCFetching(true);
          setIsIFSCVerified(false);
          fetch(`https://ifsc.razorpay.com/${codeUpper}`)
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                ifscGlobalCache.set(codeUpper, data);
                setNewBankForm(prev => ({
                  ...prev,
                  bankName: data.BANK || prev.bankName,
                  branch: data.BRANCH || prev.branch
                }));
                setIsIFSCVerified(true);
                setNewFieldErrors(prev => ({ ...prev, bankName: "", branch: "", ifscCode: "" }));
              } else {
                flash("Invalid IFSC Code", true);
                setIsIFSCVerified(false);
              }
            })
            .catch((error) => {
              console.error("Error fetching IFSC details:", error);
              setIsIFSCVerified(false);
            })
            .finally(() => {
              setIsIFSCFetching(false);
            });
        } catch (error) {
          console.error("Error fetching IFSC details:", error);
          setIsIFSCVerified(false);
          setIsIFSCFetching(false);
        }
      }
    } else if (name === "ifscCode") {
      setIsIFSCVerified(false);
    }
  };

  const handleFieldBlur = (name) => {
    const error = validateField(name, bankForm[name]);
    setFieldErrors(prev => ({ ...prev, [name]: error }));
  };

  const fetchBankDetails = async () => {
    if (!empId) { setFetchLoading(false); return; }
    setFetchLoading(true);
    try {
      const res = await portalInstance.get(`/users/employee/salary/${empId}`);
      const bankData = res.data.bankDetails || {};
      const history = bankData.bankHistory || [];

      // ── Intelligent Date Logic ──────────────────────────────────────────────
      let defaultFromDate = "";
      if (history.length === 0) {
        // 1) First time: Default to dateJoined
        defaultFromDate = emp?.dateJoined?.slice(0, 10) || "";
      } else {
        // 2) Subsequent: Default to previous toDate + 1 day
        const last = history[0];
        if (last.toDate) {
          defaultFromDate = getNextDayStr(last.toDate.slice(0, 10));
        }
      }

      // If there is an active bank details entry in the history, use its fromDate.
      const activeEntry = history.find(h => !h.toDate);
      const activeFromDate = activeEntry && activeEntry.fromDate ? new Date(activeEntry.fromDate).toISOString().slice(0, 10) : "";

      const formData = {
        bankName: bankData.bankName || "",
        accountHolder: bankData.accountHolder || "",
        accountNumber: bankData.accountNumber || "",
        ifscCode: bankData.ifscCode || "",
        branch: bankData.branch || "",
        fromDate: activeFromDate || defaultFromDate,
        toDate: ""
      };

      setBankForm(formData);
      setOriginalBank(bankData.accountNumber ? { ...formData } : null);
      setBankHistory(history);
      setLastBankUpdate(bankData.lastBankUpdate || null);
      setAccountCreatedAt(bankData.createdAt || null);

      // Auto-enable edit mode if no bank account is currently configured
      if (!bankData.accountNumber) {
        setIsBankEditing(true);
      }

      // Synchronize From dropdowns
      if (defaultFromDate) {
        const d = new Date(defaultFromDate);
        setSelYearFrom(String(d.getFullYear()));
        setSelMonthFrom(String(d.getMonth()));
      }
    } catch (err) {
      console.error("Fetch bank details error:", err);
      // Fallback for 404 (or other errors) - Initialize clean/empty form
      const defaultFromDate = emp?.dateJoined?.slice(0, 10) || "";
      const formData = {
        bankName: "",
        accountHolder: "",
        accountNumber: "",
        ifscCode: "",
        branch: "",
        fromDate: defaultFromDate,
        toDate: ""
      };
      setBankForm(formData);
      setOriginalBank(null);
      setBankHistory([]);
      setLastBankUpdate(null);
      setAccountCreatedAt(null);
      setIsBankEditing(true); // Automatically set edit mode to true for new setups

      if (defaultFromDate) {
        const d = new Date(defaultFromDate);
        setSelYearFrom(String(d.getFullYear()));
        setSelMonthFrom(String(d.getMonth()));
      }
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => { fetchBankDetails(); }, [empId]);

  // Auto-sync activeFrom when toDate changes
  useEffect(() => {
    if (bankForm.toDate) {
      const nextDay = getNextDayStr(bankForm.toDate);
      setNewBankForm(prev => ({ ...prev, activeFrom: nextDay }));
    }
  }, [bankForm.toDate]);

  const handleBankUpdate = async () => {
    if (!validateAll()) return;
    try {
      setLoading(true);
      const isTransition = isBankEditing && originalBank?.accountNumber;

      const payload = isTransition ? {
        bankName: newBankForm.bankName,
        accountHolder: newBankForm.accountHolder,
        accountNumber: newBankForm.accountNumber,
        ifscCode: newBankForm.ifscCode,
        branch: newBankForm.branch,
        fromDate: newBankForm.activeFrom || getNextDayStr(bankForm.toDate) || null,
        toDate: bankForm.toDate || null,
        oldFromDate: bankForm.fromDate || null
      } : {
        bankName: bankForm.bankName,
        accountHolder: bankForm.accountHolder,
        accountNumber: bankForm.accountNumber,
        ifscCode: bankForm.ifscCode,
        branch: bankForm.branch,
        fromDate: bankForm.fromDate || null,
        toDate: bankForm.toDate || null
      };

      if (user?.isHr && user?.role !== "admin") {
        const changes = [
          { fieldName: "Bank Name", from: originalBank?.bankName || "-", to: payload.bankName },
          { fieldName: "Account Holder", from: originalBank?.accountHolder || "-", to: payload.accountHolder },
          { fieldName: "Account Number", from: originalBank?.accountNumber || "-", to: payload.accountNumber },
          { fieldName: "IFSC Code", from: originalBank?.ifscCode || "-", to: payload.ifscCode },
          { fieldName: "Branch", from: originalBank?.branch || "-", to: payload.branch },
        ].filter(c => String(c.from) !== String(c.to));

        const reqPayload = {
          actionType: "UPDATE_BANK",
          targetModule: "EMPLOYEE",
          summary: `Update bank details for ${emp?.name || "Employee"} (${emp?.empIdString || emp?.empId || empId})`,
          payload: {
            empId,
            empName: emp?.name,
            empIdString: emp?.empIdString || emp?.empId,
            bankPayload: payload,
            isTransition,
            previousData: originalBank || {},
            updatedData: payload,
            changes: changes.length > 0 ? changes : [{ fieldName: "Bank Details", from: "Previous", to: "Updated" }]
          }
        };
        await portalInstance.post("/hr-approval/submit", reqPayload);
        flash("Bank details update submitted for Admin approval!");
        setTimeout(() => onClose(), 1200);
        return;
      }

      await portalInstance.put(`/users/employee/bank/${empId}`, payload);
      flash("Bank details updated successfully!");
      setIsBankEditing(false);
      setFieldErrors({});
      setNewFieldErrors({});

      setNewBankForm({
        bankName: "",
        accountHolder: "",
        accountNumber: "",
        ifscCode: "",
        branch: "",
        activeFrom: ""
      });

      fetchBankDetails();
      setEditingHistoryId(null);
      setSelYear(""); setSelMonth("");
      setSelYearFrom(""); setSelMonthFrom("");
    } catch (err) {
      flash(err?.response?.data?.message || "Failed to update bank details.", true);
    } finally {
      setLoading(false);
    }
  };

  const handleBankHistoryUpdate = async () => {
    if (!validateAll()) return;
    setLoading(true);
    try {
      const res = await portalInstance.put(`/users/employee/bank-history/${empId}/${editingHistoryId}`, {
        bankName: bankForm.bankName,
        accountHolder: bankForm.accountHolder,
        accountNumber: bankForm.accountNumber,
        ifscCode: bankForm.ifscCode,
        branch: bankForm.branch,
        fromDate: bankForm.fromDate,
        toDate: bankForm.toDate
      });
      flash("Bank history record updated successfully!");
      setBankHistory(res.data.bankHistory || []);
      setEditingHistoryId(null);
      setActiveTab("history");
      setBankForm({
        bankName: "", accountHolder: "", accountNumber: "", ifscCode: "", branch: "", fromDate: "", toDate: ""
      });
      setSelYear(""); setSelMonth("");
      setSelYearFrom(""); setSelMonthFrom("");
    } catch (err) {
      flash(err?.response?.data?.message || "Failed to update history record.", true);
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryEdit = (bh) => {
    if (bh._id === "current") {
      setEditingHistoryId(null);
      setIsBankEditing(true);
    } else {
      setEditingHistoryId(bh._id);
      setIsBankEditing(false);
    }

    setBankForm({
      bankName: bh.bankName || "",
      accountHolder: bh.accountHolder || "",
      accountNumber: bh.accountNumber || "", // Note: this is masked from API currently, backend needs to handle this or we need to fetch original
      ifscCode: bh.ifscCode || "",
      branch: bh.branch || "",
      fromDate: bh.fromDate ? new Date(bh.fromDate).toISOString().slice(0, 10) : "",
      toDate: bh.toDate ? new Date(bh.toDate).toISOString().slice(0, 10) : ""
    });

    if (bh.fromDate) {
      const d = new Date(bh.fromDate);
      setSelYearFrom(String(d.getFullYear()));
      setSelMonthFrom(String(d.getMonth()));
    } else {
      setSelYearFrom(""); setSelMonthFrom("");
    }

    if (bh.toDate) {
      const d = new Date(bh.toDate);
      setSelYear(String(d.getFullYear()));
      setSelMonth(String(d.getMonth()));
    } else {
      setSelYear(""); setSelMonth("");
    }

    setActiveTab("form");
    setTimeout(() => {
      const container = document.querySelector(".sal-scroll-container");
      if (container) {
        container.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 100);
  };

  const handleHistoryDelete = async (historyId) => {
    try {
      setLoading(true);
      const res = await portalInstance.delete(`/users/employee/bank-history/${empId}/${historyId}`);
      flash("History record removed successfully!");
      setBankHistory(res.data.bankHistory || []);
      setShowDeleteConfirm(null);
    } catch (err) {
      flash(err?.response?.data?.message || "Failed to delete history record.", true);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

  // ── Account Number Masking ────────────────────────────────────────
  const maskAccountNumber = (accNo) => {
    if (!accNo || accNo.length < 3) return accNo || "-";
    const last3 = accNo.slice(-3);
    const masked = "X".repeat(accNo.length - 3) + last3;
    return masked;
  };

  const getTodayStr = () => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  };

  const getEndOfMonthStr = (year, month) => {
    const d = (year !== undefined && month !== undefined)
      ? new Date(year, month + 1, 0)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getNextDayStr = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Helpers for Year/Month selection
  const getYears = () => {
    const years = [];
    const now = new Date();
    const startDate = lastBankUpdate ? new Date(lastBankUpdate) : (accountCreatedAt ? new Date(accountCreatedAt) : new Date());
    const startYear = startDate.getFullYear();
    const currentYear = now.getFullYear();

    for (let y = startYear; y <= currentYear; y++) {
      years.push(y);
    }
    return years;
  };

  const getYearsForToDate = () => {
    const years = [];
    const now = new Date();
    const fromDate = bankForm.fromDate ? new Date(bankForm.fromDate) : null;
    const startYear = fromDate ? fromDate.getFullYear() : (accountCreatedAt ? new Date(accountCreatedAt).getFullYear() : now.getFullYear() - 5);
    const currentYear = now.getFullYear();

    for (let y = startYear; y <= currentYear; y++) {
      years.push(y);
    }
    return years;
  };

  const getMonths = (year) => {
    if (!year) return [];
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return monthNames.map((name, index) => ({ label: name, value: index }));
  };

  const handleYearMonthChange = (year, month) => {
    setSelYear(year);
    setSelMonth(month);
    if (year !== "" && month !== "") {
      const endDay = getEndOfMonthStr(parseInt(year), parseInt(month));
      handleFieldChange("toDate", endDay);
    }
  };

  const getStartOfMonthStr = (year, month) => {
    const y = parseInt(year);
    const m = String(parseInt(month) + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const handleYearMonthChangeFrom = (year, month) => {
    setSelYearFrom(year);
    setSelMonthFrom(month);
    if (year !== "" && month !== "") {
      const startDay = getStartOfMonthStr(year, month);
      handleFieldChange("fromDate", startDay);
    }
  };

  const yearOptions = [
    { value: "", label: "Year" },
    ...getYearsForToDate().map(y => ({ value: String(y), label: String(y) }))
  ];

  const monthOptions = [
    { value: "", label: "Month" },
    ...(selYear ? getMonths(parseInt(selYear)).map(m => ({ value: String(m.value), label: m.label })) : [])
  ];

  return (
    <div className="sal-overlay">
      <div className="sal-modal sal-modal-premium" onClick={(e) => e.stopPropagation()}>
        {/* Local Toast Container: Shows toasts exactly at the modal edge */}
        <ToastContainer
          containerId="bank-modal-toast"
          position="top-right"
          autoClose={2500}
          hideProgressBar
          style={{ position: "absolute", zIndex: 9999, top: "10px", right: "10px", width: "auto" }}
        />
        <div className="sal-header-new">
          <div className="sal-header-left">
            <div>
              <h2 className="sal-title-new">Bank Details Management</h2>
              <p className="sal-subtitle-new">Managing records for <strong>{emp?.name}</strong></p>
            </div>
          </div>
          <div className="sal-header-actions">
            <div className="sal-tabs">
              <button
                className={`sal-tab ${activeTab === "form" ? "is-active" : ""}`}
                onClick={() => setActiveTab("form")}
              >
                {editingHistoryId ? "Edit Bank" : "Configure Bank"}
              </button>
              <button
                className={`sal-tab ${activeTab === "history" ? "is-active" : ""}`}
                onClick={() => setActiveTab("history")}
              >
                View Details
              </button>
            </div>
            <button className="sal-close-new" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="sal-scroll-container">
          <div className="sal-content-view animate-in">
            {fetchLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#94a3b8",
                }}
              >
                Loading bank details...
              </div>
            ) : (
              <>
                {activeTab === "form" ? (
                  /* ── Section 1: Current Account / Edit Form ── */
                  <div
                    className="sal-card-main sal-bank-card"
                    id="bank-form-section"
                  >
                    <div className="sal-card-header">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <h3>
                          {editingHistoryId
                            ? "Edit Historical Account"
                            : (isBankEditing ? "Update Bank Account Information" : "Current Bank Account Info")}
                        </h3>
                        {(lastBankUpdate || accountCreatedAt) && !isBankEditing && !editingHistoryId && (
                          <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "normal", marginLeft: "10px" }}>
                            Active since: <strong>{formatDate(lastBankUpdate || accountCreatedAt)}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="sal-form-grid">
                      {/* 1. Account Holder Name */}
                      <div className="sal-input-group">
                        <label>Account Holder Name <span className="sal-req">*</span></label>
                        <div className={`sal-input-wrapper ${fieldErrors.accountHolder ? "is-error-border" : ""}`}>
                          <input type="text" placeholder="Name as per Bank" value={bankForm.accountHolder}
                            onChange={(e) => handleFieldChange("accountHolder", e.target.value)}
                            onBlur={() => handleFieldBlur("accountHolder")}
                            disabled={!isBankEditing && !editingHistoryId || (isBankEditing && !!originalBank?.accountNumber)} />
                        </div>
                        {fieldErrors.accountHolder && <span className="sal-field-error">{fieldErrors.accountHolder}</span>}
                      </div>

                      {/* 2. Account Number */}
                      <div className="sal-input-group">
                        <label>Account Number <span className="sal-req">*</span></label>
                        <div className={`sal-input-wrapper ${fieldErrors.accountNumber ? "is-error-border" : ""}`}>
                          <input type="text" placeholder="9-18 digit Number"
                            value={isBankEditing || editingHistoryId ? bankForm.accountNumber : maskAccountNumber(bankForm.accountNumber)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              handleFieldChange("accountNumber", val);
                            }}
                            onBlur={() => handleFieldBlur("accountNumber")}
                            disabled={!isBankEditing && !editingHistoryId || (isBankEditing && !!originalBank?.accountNumber)}
                            maxLength={18} />
                        </div>
                        {fieldErrors.accountNumber && <span className="sal-field-error">{fieldErrors.accountNumber}</span>}
                      </div>

                      {/* 3. IFSC Code */}
                      <div className="sal-input-group">
                        <label>IFSC Code <span className="sal-req">*</span></label>
                        <div className={`sal-input-wrapper ${fieldErrors.ifscCode ? "is-error-border" : ""} ${isIFSCFetching ? "is-fetching" : ""} ${isIFSCVerified ? "is-verified" : ""}`}>
                          <input type="text" placeholder="e.g. SBIN0001234" value={bankForm.ifscCode}
                            onChange={(e) => handleFieldChange("ifscCode", e.target.value.toUpperCase())}
                            onBlur={() => handleFieldBlur("ifscCode")}
                            disabled={!isBankEditing && !editingHistoryId || (isBankEditing && !!originalBank?.accountNumber)}
                            maxLength={11} />
                          {isIFSCFetching && <div className="sal-input-loader"></div>}
                          {isIFSCVerified && <div className="sal-input-verified">✓</div>}
                        </div>
                        {fieldErrors.ifscCode && <span className="sal-field-error">{fieldErrors.ifscCode}</span>}
                      </div>

                      {/* 4. Branch Name */}
                      <div className="sal-input-group">
                        <label>Branch Name <span className="sal-req">*</span></label>
                        <div className={`sal-input-wrapper ${fieldErrors.branch ? "is-error-border" : ""}`}>
                          <input type="text" placeholder="Branch Name" value={bankForm.branch}
                            onChange={(e) => handleFieldChange("branch", e.target.value)}
                            onBlur={() => handleFieldBlur("branch")}
                            disabled={!isBankEditing && !editingHistoryId || (isBankEditing && !!originalBank?.accountNumber)} />
                        </div>
                        {fieldErrors.branch && <span className="sal-field-error">{fieldErrors.branch}</span>}
                      </div>

                      {/* 5. Bank Name */}
                      <div className="sal-input-group">
                        <label>Bank Name <span className="sal-req">*</span></label>
                        <div className={`sal-input-wrapper ${fieldErrors.bankName ? "is-error-border" : ""}`}>
                          <input type="text" placeholder="e.g. State Bank of India" value={bankForm.bankName}
                            onChange={(e) => handleFieldChange("bankName", e.target.value)}
                            onBlur={() => handleFieldBlur("bankName")}
                            disabled={!isBankEditing && !editingHistoryId || (isBankEditing && !!originalBank?.accountNumber)} />
                        </div>
                        {fieldErrors.bankName && <span className="sal-field-error">{fieldErrors.bankName}</span>}
                      </div>

                      {(isBankEditing && originalBank?.accountNumber || editingHistoryId) && (
                        <div className="sal-input-group" style={{ gridColumn: "1 / -1" }}>
                          <label>{editingHistoryId ? "Edit History Dates" : "Previous Account End Date (To Date)"} <span className="sal-req">*</span></label>
                          <div className="sal-todate-section" style={{ width: "100%" }}>
                            <div className="sal-todate-info sal-todate-info-from" style={{ borderBottom: "none", marginBottom: 0, paddingBottom: "14px", flexDirection: "row", gap: "24px", width: "100%", alignItems: "stretch" }}>
                              {/* Left Side: From Date */}
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                                <span className="sal-date-label sal-date-label-block" style={{ margin: 0, fontWeight: "500" }}>
                                  {editingHistoryId ? "Edit History From Date:" : "Previous Account Active From:"}
                                </span>
                                <div className="sal-select-box sal-custom-date-box" style={{ width: "100%" }}>
                                  <label>From</label>
                                  <div className={`sal-input-wrapper sal-custom-date-pick ${fieldErrors.fromDate ? "is-error-border" : ""}`}>
                                    <input
                                      type="date"
                                      value={bankForm.fromDate}
                                      onChange={(e) => {
                                        handleFieldChange("fromDate", e.target.value);
                                        setSelYearFrom(""); setSelMonthFrom("");
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Vertical Divider */}
                              <div className="sal-divider-vertical"></div>

                              {/* Right Side: To Date */}
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                                <span className="sal-date-label sal-date-label-block" style={{ margin: 0, fontWeight: "500" }}>
                                  {editingHistoryId ? "Edit History To Date:" : "Previous Account End Date:"}
                                </span>
                                <div className="sal-select-box sal-custom-date-box" style={{ width: "100%" }}>
                                  <label>To</label>
                                  <div className={`sal-input-wrapper sal-custom-date-pick ${fieldErrors.toDate ? "is-error-border" : ""}`}>
                                    <input
                                      className={`sal-detail-input ${fieldErrors.toDate ? "is-error-border" : ""}`}
                                      type="date" value={bankForm.toDate}
                                      onChange={(e) => {
                                        handleFieldChange("toDate", e.target.value);
                                        setSelYear(""); setSelMonth("");
                                      }}
                                      onBlur={() => handleFieldBlur("toDate")} />
                                  </div>
                                </div>
                              </div>
                            </div>
                            {fieldErrors.toDate && <span className="sal-field-error">{fieldErrors.toDate}</span>}
                            {bankForm.toDate && (
                              <div className="sal-todate-preview" style={{ marginTop: "8px" }}>
                                <span>Old account ends: <strong>{formatDate(bankForm.toDate)}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {isBankEditing && originalBank?.accountNumber && (
                      <div className="sal-new-bank-section" style={{ marginTop: "24px", paddingTop: "20px", borderTop: "2px solid #e2e8f0" }}>
                        <h4 className="sal-section-title" style={{ fontSize: "16px", fontWeight: "500", color: "#3A4B71", marginBottom: "16px" }}>
                          New Bank Details (Starts Active on the Next Day)
                        </h4>

                        <div className="sal-form-grid">
                          <div className="sal-input-group">
                            <label>New Bank Name <span className="sal-req">*</span></label>
                            <div className={`sal-input-wrapper ${newFieldErrors.bankName ? "is-error-border" : ""}`}>
                              <input type="text" placeholder="e.g. HDFC Bank" value={newBankForm.bankName}
                                onChange={(e) => handleNewFieldChange("bankName", e.target.value)} />
                            </div>
                            {newFieldErrors.bankName && <span className="sal-field-error">{newFieldErrors.bankName}</span>}
                          </div>

                          <div className="sal-input-group">
                            <label>New Account Holder <span className="sal-req">*</span></label>
                            <div className={`sal-input-wrapper ${newFieldErrors.accountHolder ? "is-error-border" : ""}`}>
                              <input type="text" placeholder="Name as per Bank" value={newBankForm.accountHolder}
                                onChange={(e) => handleNewFieldChange("accountHolder", e.target.value)} />
                            </div>
                            {newFieldErrors.accountHolder && <span className="sal-field-error">{newFieldErrors.accountHolder}</span>}
                          </div>

                          <div className="sal-input-group">
                            <label>New Account Number <span className="sal-req">*</span></label>
                            <div className={`sal-input-wrapper ${newFieldErrors.accountNumber ? "is-error-border" : ""}`}>
                              <input type="text" placeholder="9-18 digit Number" value={newBankForm.accountNumber}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "");
                                  handleNewFieldChange("accountNumber", val);
                                }}
                                maxLength={18} />
                            </div>
                            {newFieldErrors.accountNumber && <span className="sal-field-error">{newFieldErrors.accountNumber}</span>}
                          </div>

                          <div className="sal-input-group">
                            <label>New IFSC Code <span className="sal-req">*</span></label>
                            <div className={`sal-input-wrapper ${newFieldErrors.ifscCode ? "is-error-border" : ""} ${isIFSCFetching ? "is-fetching" : ""} ${isIFSCVerified ? "is-verified" : ""}`}>
                              <input type="text" placeholder="e.g. HDFC0000123" value={newBankForm.ifscCode}
                                onChange={(e) => handleNewFieldChange("ifscCode", e.target.value.toUpperCase())}
                                maxLength={11} />
                              {isIFSCFetching && <div className="sal-input-loader"></div>}
                              {isIFSCVerified && <div className="sal-input-verified">✓</div>}
                            </div>
                            {newFieldErrors.ifscCode && <span className="sal-field-error">{newFieldErrors.ifscCode}</span>}
                          </div>

                          <div className="sal-input-group">
                            <label>New Branch Name <span className="sal-req">*</span></label>
                            <div className={`sal-input-wrapper ${newFieldErrors.branch ? "is-error-border" : ""}`}>
                              <input type="text" placeholder="Branch Name" value={newBankForm.branch}
                                onChange={(e) => handleNewFieldChange("branch", e.target.value)} />
                            </div>
                            {newFieldErrors.branch && <span className="sal-field-error">{newFieldErrors.branch}</span>}
                          </div>

                          <div className="sal-input-group">
                            <label>New Account Active From</label>
                            <div className="sal-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="dd-mm-yyyy"
                                value={newBankForm.activeFrom ? newBankForm.activeFrom.split('-').reverse().join('-') : ''}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^0-9-]/g, '');
                                  // Accept dd-mm-yyyy and convert to yyyy-mm-dd for internal state
                                  const parts = raw.split('-');
                                  if (parts.length === 3 && parts[2].length === 4) {
                                    const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                                    setNewBankForm(prev => ({ ...prev, activeFrom: iso }));
                                  } else {
                                    // Store raw for typing in-progress
                                    setNewBankForm(prev => ({ ...prev, activeFrom: raw }));
                                  }
                                }}
                                style={{ paddingRight: '36px' }}
                              />
                              {/* Hidden native date picker */}
                              <input
                                ref={activeDatePickerRef}
                                type="date"
                                value={newBankForm.activeFrom && newBankForm.activeFrom.length === 10 && newBankForm.activeFrom.includes('-') && newBankForm.activeFrom.split('-')[0].length === 4 ? newBankForm.activeFrom : ''}
                                onChange={(e) => setNewBankForm(prev => ({ ...prev, activeFrom: e.target.value }))}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                              />
                              <img
                                src="/Calander.svg"
                                alt="calendar"
                                style={{ position: 'absolute', right: '10px', width: '18px', height: '18px', cursor: 'pointer', opacity: 0.6 }}
                                onClick={() => activeDatePickerRef.current?.showPicker?.()}
                              />
                            </div>
                            {newBankForm.activeFrom && newBankForm.activeFrom.length === 10 && (
                              <div className="sal-todate-preview" style={{ marginTop: "4px" }}>
                                <span>Starts: <strong>{formatDate(newBankForm.activeFrom)}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── FOOTER ACTIONS (4 BUTTONS) ── */}
                    <div className="sal-bank-footer">
                      <button className="common-modal-btn btn-small-cancel" onClick={onClose}>Back</button>

                      {!isBankEditing && !editingHistoryId ? (
                        <button
                          className="common-modal-btn btn-update"
                          onClick={() => setIsBankEditing(true)}
                        >
                          {originalBank?.accountNumber ? "Modify Current Account" : "Set Up Bank Account"}
                        </button>
                      ) : (
                        // Only show Cancel Edit if there is actually an original bank account to fall back to
                        originalBank?.accountNumber && (
                          <button className="common-modal-btn btn-small-cancel" onClick={() => {
                            setIsBankEditing(false);
                            setEditingHistoryId(null);
                            setFieldErrors({});
                            setNewFieldErrors({});
                            setNewBankForm({
                              bankName: "",
                              accountHolder: "",
                              accountNumber: "",
                              ifscCode: "",
                              branch: ""
                            });
                            fetchBankDetails();
                          }}>Remove Edit</button>
                        )
                      )}

                      {(isBankEditing || editingHistoryId) && (
                        <button className="common-modal-btn btn-update" onClick={editingHistoryId ? handleBankHistoryUpdate : handleBankUpdate} disabled={loading}>
                          {loading ? "Saving..." : (editingHistoryId ? "Update History" : "Save Changes")}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── Section 2: Bank History Table ── */
                  <div className="sal-card-main" id="bank-history-table">
                    {showDeleteConfirm && (
                      <div className="sal-delete-confirm-overlay animate-in" style={{ background: "rgba(0,0,0,0.5)" }}>
                        <div className="sal-delete-confirm-modal">
                          <h3>Confirm Deletion</h3>
                          <p>Are you sure you want to permanently remove this bank history record? This action cannot be undone.</p>
                          <div className="sal-delete-confirm-actions">
                            <button className="sal-confirm-cancel" onClick={() => setShowDeleteConfirm(null)}>No, Keep it</button>
                            <button className="sal-confirm-delete" onClick={() => handleHistoryDelete(showDeleteConfirm)}>Yes, Delete</button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="sal-card-header">
                      <h3>Bank Account History</h3>
                      <span className="sal-count-badge">{bankHistory.length} records</span>
                    </div>

                    {bankHistory.length > 0 ? (
                      <div className="sal-table-wrapper-new">
                        <table className="sal-history-table">
                          <thead>
                            <tr>
                              <th>Bank Name</th>
                              <th>Account Holder</th>
                              <th>Account Number</th>
                              <th>IFSC Code</th>
                              <th>Branch</th>
                              <th>Active Period</th>
                              <th>Updated Date</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bankHistory.map((bh, idx) => (
                              <tr key={bh._id || idx} className={editingHistoryId === bh._id ? "is-editing-row" : ""}>
                                <td>{bh.bankName || "-"}</td>
                                <td>{bh.accountHolder || "-"}</td>
                                <td>{maskAccountNumber(bh.accountNumber)}</td>
                                <td>{bh.ifscCode || "-"}</td>
                                <td>{bh.branch || "-"}</td>
                                <td>{formatDate(bh.fromDate)} — {formatDate(bh.toDate)}</td>
                                <td>
                                  <div className="sal-date-cell">
                                    <div>
                                      <div>{formatDate(bh.addedAt || bh.createdAt)}</div>
                                      <span className="sal-time-sm">
                                        {bh.addedAt || bh.createdAt ? new Date(bh.addedAt || bh.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="sal-row-actions">
                                    <button className="sal-edit-btn" onClick={() => {
                                      handleHistoryEdit(bh);
                                    }}>Edit</button>
                                    {bh._id !== "current" && (
                                      <button className="sal-delete-btn" onClick={() => setShowDeleteConfirm(bh._id)}>Delete</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>No historical records found.</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main ManageEmployee Page ─────────────────────────────────────────────────
const ManageEmployee = () => {
  const [employees, setEmployees] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [search, setSearch] = useState("");
  const [copiedEmails, setCopiedEmails] = useState(new Set());
  const [filter, setFilter] = useState("full-time");
  const [showFilter, setShowFilter] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Salary modal state ─────────────────────────────────────────────────────
  const [salaryEmp, setSalaryEmp] = useState(null);
  // ── Bank details modal state ───────────────────────────────────────────────
  const [bankDetailsEmp, setBankDetailsEmp] = useState(null);

  const navigate = useNavigate();
  const { user } = useUser();
  const filterRef = useRef(null);

  const toggleMenu = (index) => setOpenMenu(openMenu === index ? null : index);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenu !== null && !e.target.closest(".erti-card-menu") && !e.target.closest(".erti-more-btn")) {
        setOpenMenu(null);
      }
      if (showFilter && filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilter(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenu, showFilter]);

  const fetchEmployees = async () => {
    try {
      const res = await portalInstance.get("/users/all-employee");
      setEmployees(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load employees", { containerId: "manage-employee-toast" });
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleCopyEmail = (email) => {
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmails((prev) => new Set([...prev, email]));
      toast.success("Email copied to clipboard!", { autoClose: 1500, position: "top-center" });
      setTimeout(() => {
        setCopiedEmails((prev) => { const n = new Set(prev); n.delete(email); return n; });
      }, 1800);
    });
  };

  const getStatusClass = (s = "") => s.toLowerCase().replace(/[_\s]+/g, "-");
  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN") : "-";
  const getProfileClass = (pc = 0) => pc >= 80 ? "high" : pc >= 40 ? "medium" : "low";
  const getEmployeeId = (emp) => emp?.empId || emp?.employeeId;

  const filterOptions = [
    { label: "All", value: "all" },
    { label: "Full-time", value: "full-time" },
    { label: "Part-time", value: "part-time" },
    { label: "Relieved", value: "relieved" },
  ];

  const filteredEmployees = employees
    .filter((emp) => {
      const key = search.toLowerCase();
      const empId = getEmployeeId(emp)?.toLowerCase() || "";
      return emp.name?.toLowerCase().includes(key) || emp.email?.toLowerCase().includes(key) || empId.includes(key);
    })
    .filter((emp) => {
      if (filter === "all") return true;
      return (emp.status || "").toLowerCase().replace(/[_\s]+/g, "-") === filter;
    })
    .sort((a, b) => (getEmployeeId(a) || "").localeCompare(getEmployeeId(b) || "", undefined, { numeric: true }));

  const canEdit = canHrEditEmployee(user);
  const canView = canHrViewEmployee(user);

  const handleViewProfile = (emp) => navigate(`/admin/employees/view/${getEmployeeId(emp)}`);
  const handleEditEmployee = (emp) => {
    if (!canEdit) {
      toast.warning("Your HR permissions do not allow editing employee details directly.", { containerId: "manage-employee-toast" });
      handleViewProfile(emp);
      return;
    }
    navigate(`/admin/employees/${getEmployeeId(emp)}/edit`);
  };

  const handleToggleHr = async (emp) => {
    try {
      const empId = emp.id || emp._id;
      const res = await portalInstance.put("/hr-approval/assign-hr", { employeeId: empId });
      if (res.data.success) {
        toast.success(res.data.message, { containerId: "manage-employee-toast" });
        fetchEmployees();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign HR role", { containerId: "manage-employee-toast" });
    }
  };

  const handleDeleteClick = (emp, e) => {
    e.stopPropagation();
    setEmployeeToDelete(emp);
    setShowDeleteModal(true);
    setOpenMenu(null);
  };

  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;
    const employeeId = getEmployeeId(employeeToDelete);
    setDeleteLoading(true);
    try {
      if (user?.isHr && user?.role !== "admin") {
        const reqPayload = {
          actionType: "DELETE_EMPLOYEE",
          targetModule: "EMPLOYEE",
          summary: `Delete employee ${employeeToDelete.name} (${employeeId})`,
          payload: {
            empId: employeeToDelete.id || employeeToDelete._id,
            empIdString: employeeId,
            empName: employeeToDelete.name,
            previousData: {
              name: employeeToDelete.name,
              email: employeeToDelete.email,
              department: employeeToDelete.department,
              designation: employeeToDelete.designation,
              status: employeeToDelete.status
            },
            updatedData: {
              status: "deleted"
            },
            changes: [
              { fieldName: "Status", from: employeeToDelete.status || "active", to: "deleted" }
            ]
          }
        };
        await portalInstance.post("/hr-approval/submit", reqPayload);
        toast.success(`Delete request for "${employeeToDelete.name}" submitted for Admin approval!`, { containerId: "manage-employee-toast" });
        setShowDeleteModal(false);
        setEmployeeToDelete(null);
        return;
      }

      await portalInstance.delete(`/users/delete-employee/${employeeId}`);
      setEmployees((prev) => prev.filter((e) => getEmployeeId(e) !== employeeId));
      toast.success(`Employee "${employeeToDelete.name}" deleted successfully!`, { containerId: "manage-employee-toast" });
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete employee.", { containerId: "manage-employee-toast" });
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (user?.isHr && user?.role !== "admin" && !canView) {
    return (
      <div className="erti-employee-page">
        <Sidebar />
        <div className="erti-employee-content" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "48px 32px", maxWidth: "560px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "44px", marginBottom: "16px" }}>🔒</div>
            <h3 style={{ color: "#1e293b", fontSize: "20px", marginBottom: "10px", fontWeight: "700" }}>Access Restricted</h3>
            <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
              Employee directory viewing is currently disabled for HR accounts per the Portal Access Configuration.
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

  return (
    <div className="erti-employee-page">
      <Sidebar />

      <div className="erti-employee-content">
        {/* APPROVAL BANNER FOR EMPLOYEE MODULE */}
        <ApprovalBanner moduleName="EMPLOYEE" onRefresh={fetchEmployees} />


        {/* TOP BAR */}
        <div className="erti-topbar">
          <div />
          <div className="erti-actions">
            <div className="erti-search-box">
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="erti-search-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
            </div>

            <div className="erti-filter-wrapper" ref={filterRef}>
              <button className="erti-filter-btn" type="button"
                onClick={(e) => { e.stopPropagation(); setShowFilter((p) => !p); }}>
                <span className="erti-filter-icon">
                  <img src="/Filter.svg" alt="Filter" className="erti-filter-icn" />
                </span>
              </button>
              {showFilter && (
                <div className="erti-filter-dropdown">
                  {filterOptions.map((opt) => (
                    <button key={opt.value}
                      className={`erti-filter-option ${filter === opt.value ? "erti-filter-active" : ""}`}
                      onClick={() => { setFilter(opt.value); setShowFilter(false); }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* EMPLOYEE GRID */}
        <div className="erti-employee-grid">
          {filteredEmployees.length === 0 && (
            <p className="erti-no-data">No employees found</p>
          )}

          {filteredEmployees.map((emp, index) => {
            const employeeId = getEmployeeId(emp);
            const isEmailCopied = copiedEmails.has(emp.email);
            const currentHrEmployee = employees.find((e) => e.isHr);

            const isProfileReviewNeeded =
              (Number(emp.profileCompletion) >= 100 || emp.profileApprovalStatus === "pending") &&
              emp.profileApprovalStatus !== "approved" &&
              !emp.isProfileCompleted;

            return (
              <div
                className="erti-employee-card"
                key={employeeId || index}
              >
                <div className={`erti-card-top ${getStatusClass(emp.status)}`}>
                  <div
                    className={`erti-profile-completion ${getProfileClass(emp.profileCompletion || 0)}`}
                    title={`${emp.profileCompletion || 0}% Completed`}
                  >
                    {emp.profileCompletion || 0}%
                  </div>

                  {/* Small blue jumping/bouncing button shown in the employee profile image top */}
                  {isProfileReviewNeeded && (
                    <button
                      type="button"
                      className="erti-card-review-bounce-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewProfile(emp);
                      }}
                      title="Profile 100% Completed — Click to review profile"
                    >
                      Review Profile
                    </button>
                  )}

                  <button className="erti-more-btn"
                    onClick={(e) => { e.stopPropagation(); toggleMenu(index); }}>
                    ⋯
                  </button>

                  {openMenu === index && (
                    <div className="erti-card-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleViewProfile(emp)}>View Profile</button>
                      {canEdit && (
                        <button onClick={() => handleEditEmployee(emp)}>Edit Employee</button>
                      )}
                      <button onClick={() => { setSalaryEmp(emp); setOpenMenu(null); }}>Salary Details</button>
                      <button onClick={() => { setBankDetailsEmp(emp); setOpenMenu(null); }}>Bank Details</button>
                      {user?.role === "admin" && (
                        <>
                          {emp.isHr ? (
                            <button style={{ color: "#ef4444" }} onClick={() => { handleToggleHr(emp); setOpenMenu(null); }}>
                              Revoke HR Role
                            </button>
                          ) : !currentHrEmployee ? (
                            <button style={{ color: "#8b5cf6", fontWeight: "600" }} onClick={() => { handleToggleHr(emp); setOpenMenu(null); }}>
                              Assign as HR
                            </button>
                          ) : null}
                          <button className="erti-danger" onClick={(e) => handleDeleteClick(emp, e)}>Delete Profile</button>
                        </>
                      )}
                    </div>
                  )}

                  <img
                    src={emp.avatar || emp.photo || "/avatar.png"}
                    alt={emp.name}
                    className="erti-profile-img"
                    onError={(e) => (e.target.src = "/avatar.png")}
                  />
                  <h5 className="erti-employee-name">{emp.name || "-"}</h5>
                  <p className="erti-employee-role">{emp.designation || "-"}</p>

                  {/* Badge + Manage Salary button side by side */}
                  <div className="erti-badge-row" style={{ display: "flex", gap: "8px", justifyContent: "center", alignItems: "center" }}>
                    <span className={`erti-badge ${getStatusClass(emp.status)}`}>
                      {emp.status
                        ? emp.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                        : "Unknown"}
                    </span>
                    {emp.isHr && (
                      <span className="erti-badge" style={{ backgroundColor: "#8b5cf6", color: "#ffffff", fontWeight: "600" }}>
                        ★ Designated HR
                      </span>
                    )}
                  </div>
                </div>

                <div className="erti-employee-info">
                  <p><span>Employee ID</span><span>{employeeId || "-"}</span></p>
                  <p className="erti-email-row">
                    <span>Email Id</span>
                    <span className="erti-email-text" title="Click to copy"
                      onClick={() => handleCopyEmail(emp.email)}>
                      {emp.email || "-"}
                      {isEmailCopied && <span className="erti-copy-feedback">Copied!</span>}
                    </span>
                  </p>
                  <p><span>Department</span><span>{emp.department || "-"}</span></p>
                  <p><span>Date Joined</span><span>{formatDate(emp.dateJoined)}</span></p>

                  {canEdit ? (
                    <button className="erti-edit-btn" onClick={() => handleEditEmployee(emp)}>
                      Edit Employee
                    </button>
                  ) : (
                    <button
                      className="erti-edit-btn"
                      style={{ background: "#c5e0ff"}}
                      onClick={() => handleViewProfile(emp)}
                    >
                      View Profile
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="erti-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="erti-delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Employee</h3>
            <p>Are you sure you want to delete <strong>{employeeToDelete?.name}</strong>?</p>
            <div className="erti-modal-info">
              <p><span>Employee ID:</span> {getEmployeeId(employeeToDelete)}</p>
              <p><span>Email:</span> {employeeToDelete?.email}</p>
              <p><span>Department:</span> {employeeToDelete?.department || "-"}</p>
            </div>
            <div className="erti-modal-actions">
              <button className="common-modal-btn btn-small-cancel" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>Cancel</button>
              <button className="common-modal-btn btn-reject" onClick={handleConfirmDelete} disabled={deleteLoading}>
                {deleteLoading ? "Deleting..." : "Remove Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SALARY MODAL */}
      {salaryEmp && (
        <SalaryModal emp={salaryEmp} onClose={() => setSalaryEmp(null)} />
      )}

      {/* BANK DETAILS MODAL */}
      {bankDetailsEmp && (
        <BankDetailsModal emp={bankDetailsEmp} onClose={() => setBankDetailsEmp(null)} />
      )}

      {/* Main Page Toast Container */}
      <ToastContainer containerId="manage-employee-toast" position="top-right" autoClose={3000} />
    </div>
  );
};

export default ManageEmployee;
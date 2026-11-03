import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import searchIcon from "../../../assets/Vector.png";
import plusIcon from "../../../assets/plus.png";
import closeIcon from "../../../assets/close.png";
import attachIcon from "../../../assets/ant-design_file-add-filled.png";
import { portalInstance } from "../../../Services/instance";
import "./UpdateTask.css";
import CustomDropdown from "../../Common/CustomDropdown";
import DateIcon from "../../../assets/uiw_date.svg";
import Document from "../../../../public/document.svg?url";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../../Globel/Layout.css";
/* â”€â”€â”€ Lock Icon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const LockIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ marginLeft: 5, verticalAlign: "middle", flexShrink: 0 }}>
    <rect x="5" y="11" width="14" height="10" rx="2" fill="#BBBBBB" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#BBBBBB" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1.5" fill="#fff" />
  </svg>
);

/* â”€â”€â”€ FieldWrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function FieldWrapper({ label, locked, children }) {
  return (
    <div className={`form-group${locked ? " field-locked-wrapper" : ""}`}>
      <div className="field-label-row">
        <span className="field-label-text">{label}</span>
        {locked && <LockIcon />}
      </div>
      {children}
    </div>
  );
}

/* â”€â”€â”€ Locked Dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function LockedDropdown({ options, value }) {
  const label = options.find(o => o.value === value)?.label || value;
  return (
    <div className="locked-dropdown">
      <span>{label}</span>
      <svg width="10" height="6" viewBox="0 0 10 6">
        <path d="M1 1l4 4 4-4" stroke="#ccc" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* â”€â”€â”€ Phase status options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const PHASE_STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "#f59e0b" },
  { value: "inprocess", label: "In Process", color: "#3b82f6" },
  { value: "hold", label: "Hold", color: "#ef4444" },
  { value: "completed", label: "Completed", color: "#22c55e" },
];

/* ─── PhaseRow ──────────────────────────────────────────────────────────── */
function PhaseRow({ phaseTitle, phaseDescription, phaseStatus, isSaved, index, onChange, onRemove, onSave, onEdit, canEdit }) {
  if (isSaved) {
    const statusOption = PHASE_STATUS_OPTIONS.find(o => o.value === (phaseStatus || "").toLowerCase()) || { label: phaseStatus || "Pending", color: "#f59e0b" };
    const isPhaseCompleted = (phaseStatus || "").toLowerCase() === "completed";
    const canEditRow = canEdit && !isPhaseCompleted;
    return (
      <div className="atPhase__item animate-fade-in" style={{ padding: "12px 16px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>Phase {index + 1}</span>
            <strong style={{ fontSize: "13px", color: "#1e293b", fontWeight: "600" }}>{phaseTitle}</strong>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: statusOption.color,
                background: `${statusOption.color}18`,
                border: `1px solid ${statusOption.color}40`,
                padding: "1px 8px",
                borderRadius: "12px",
                textTransform: "capitalize"
              }}
            >
              {statusOption.label}
            </span>
          </div>
          {canEditRow && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                className="hrms-common-edit-btn"
                onClick={() => onEdit(index)}
                title="Edit phase"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#5977f8",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M0 0h24v24H0z" fill="none" />
                  <path d="M15 3c1.295 0 2.494.412 3.475 1.11l-9.132 9.134a1 1 0 0 0 1.414 1.414l9.133-9.133A6 6 0 0 1 21 9.001v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5.242-.656a1.001 1.001 0 0 1 1.415 1.414L19.89 5.524a6 6 0 0 0-1.414-1.414z" />
                </svg>
              </button>
              <button
                type="button"
                className="hrms-common-close-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove(index);
                }}
                title="Remove phase"
                style={{ margin: 0 }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
        {phaseDescription && (
          <p style={{ fontSize: "12px", color: "#64748b", margin: 0, whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
            {phaseDescription}
          </p>
        )}
      </div>
    );
  }

  const [isPointByPoint, setIsPointByPoint] = useState(() => {
    return /^([•\-\*]|\d+[\.\)])\s*/.test((phaseDescription || "").trim());
  });

  const formatToNumberedPoints = (text) => {
    if (!text || !text.trim()) return "• ";
    const rawLines = text.split("\n");
    const cleaned = rawLines
      .map(line => line.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim())
      .filter(Boolean);

    if (cleaned.length === 0) return "• ";
    return cleaned.map(line => `• ${line}`).join("\n");
  };

  const removeNumberedPoints = (text) => {
    if (!text) return "";
    return text
      .split("\n")
      .map(line => line.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim())
      .filter(Boolean)
      .join("\n");
  };

  const handleTogglePointByPoint = () => {
    const nextMode = !isPointByPoint;
    setIsPointByPoint(nextMode);
    const currentDesc = phaseDescription || "";
    if (nextMode) {
      onChange(index, "phaseDescription", formatToNumberedPoints(currentDesc));
    } else {
      onChange(index, "phaseDescription", removeNumberedPoints(currentDesc));
    }
  };

  const handleDescriptionKeyDown = (e) => {
    if (!isPointByPoint) return;

    if (e.key === "Enter") {
      e.preventDefault();
      const textarea = e.target;
      const { selectionStart, selectionEnd, value } = textarea;

      const textBeforeCursor = value.substring(0, selectionStart);
      const textAfterCursor = value.substring(selectionEnd);

      const linesBefore = textBeforeCursor.split("\n");
      const currentLine = linesBefore[linesBefore.length - 1];

      const match = currentLine.match(/^([•\-\*]|\d+[\.\)])\s*(.*)$/);

      if (match) {
        const content = match[2];

        if (!content.trim()) {
          const newLines = linesBefore.slice(0, -1);
          const newBefore = newLines.length > 0 ? newLines.join("\n") + "\n" : "";
          const newText = newBefore + textAfterCursor;
          onChange(index, "phaseDescription", newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
          return;
        }

        const insertion = "\n• ";
        const newText = textBeforeCursor + insertion + textAfterCursor;
        const newCursorPos = selectionStart + insertion.length;

        onChange(index, "phaseDescription", newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        }, 0);
      } else {
        const insertion = "\n• ";
        const newText = textBeforeCursor + insertion + textAfterCursor;
        const newCursorPos = selectionStart + insertion.length;

        onChange(index, "phaseDescription", newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        }, 0);
      }
    }
  };

  const handleDescriptionPaste = (e) => {
    if (!isPointByPoint) return;

    const pastedText = e.clipboardData?.getData("text");
    if (!pastedText || !pastedText.includes("\n")) return;

    e.preventDefault();
    const textarea = e.target;
    const { selectionStart, selectionEnd, value } = textarea;

    const textBefore = value.substring(0, selectionStart);
    const textAfter = value.substring(selectionEnd);

    const pastedLines = pastedText
      .split(/\r?\n/)
      .map((l) => l.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim())
      .filter(Boolean);

    if (pastedLines.length === 0) return;

    const linesBefore = textBefore.split("\n");
    const currentLine = linesBefore[linesBefore.length - 1];
    const match = currentLine.match(/^([•\-\*]|\d+[\.\)])\s*/);

    let formattedPaste = "";
    if (match && (currentLine.trim() === match[1] || currentLine.trim() === `${match[1]}.`)) {
      formattedPaste = pastedLines.map((l, i) => (i === 0 ? l : `• ${l}`)).join("\n");
    } else {
      formattedPaste = pastedLines.map((l) => `• ${l}`).join("\n");
      if (textBefore && !textBefore.endsWith("\n") && !match) {
        formattedPaste = "\n" + formattedPaste;
      }
    }

    const newText = textBefore + formattedPaste + textAfter;
    onChange(index, "phaseDescription", newText);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd =
        (textBefore + formattedPaste).length;
    }, 0);
  };

  return (
    <div className="atPhase__item animate-fade-in" style={{ marginBottom: "10px" }}>
      {/* Row 1: Close button on the right end */}
      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
          <button
            type="button"
            className="hrms-common-close-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(index);
            }}
            title="Remove phase"
            style={{ margin: 0 }}
          >✕
          </button>
        </div>
      )}

      {/* Row 2: Title and Status select option */}
      <div className="atPhase__topRow">
        <input
          type="text"
          className="atPhase__input hrms-common-input"
          placeholder={`Phase ${index + 1} Title…`}
          value={phaseTitle}
          disabled={!canEdit}
          onChange={e => onChange(index, "phaseTitle", e.target.value)}
        />
        <div className="atPhase__statusWrapper">
          {canEdit ? (
            <CustomDropdown
              options={PHASE_STATUS_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
              value={phaseStatus}
              onChange={val => onChange(index, "phaseStatus", val)}
              className="atPhase__customDrop"
              placeholder="Status"
            />
          ) : (
            <div className="locked-dropdown atPhase__customDrop" style={{ height: '32px', display: 'flex', alignItems: 'center', padding: '0 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <span style={{ fontSize: '12px', color: '#374151' }}>
                {PHASE_STATUS_OPTIONS.find(o => o.value === phaseStatus)?.label || phaseStatus}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Description with Point by Point */}
      <div className="d-flex justify-content-between align-items-center mb-1 mt-2">
        <label style={{ fontSize: "11px", fontWeight: "500", color: "#64748b", margin: 0 }}>Description</label>
        {canEdit && (
          <label
            className="d-flex align-items-center gap-1"
            onClick={handleTogglePointByPoint}
            style={{
              fontSize: "11px",
              fontWeight: "500",
              color: isPointByPoint ? "#5977f8" : "#77728e",
              cursor: "pointer",
              userSelect: "none",
              margin: 0
            }}
            title="Format description as bullet points (• Point)"
          >
            <input
              type="radio"
              name={`phaseRowPointByPoint-${index}`}
              checked={isPointByPoint}
              readOnly
              style={{
                cursor: "pointer",
                accentColor: "#5977f8",
                width: "12px",
                height: "12px",
                margin: 0
              }}
            />
            <span>Point by Point</span>
          </label>
        )}
      </div>
      <textarea
        className="atPhase__input hrms-common-textarea"
        placeholder={isPointByPoint ? "• Enter first point..." : `Phase ${index + 1} Description…`}
        value={phaseDescription}
        disabled={!canEdit}
        onChange={e => onChange(index, "phaseDescription", e.target.value)}
        onKeyDown={handleDescriptionKeyDown}
        onPaste={handleDescriptionPaste}
        rows={4}
        style={{ minHeight: "90px", height: "90px" }}
      />

      {canEdit && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            width: "100%",
            marginTop: "8px",
          }}
        >
          <button
            className="phase-post-btn"
            title="Save phase"
            type="button"
            onClick={() => onSave(index)}
            style={{ marginLeft: "auto" }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}


/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN COMPONENT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function UpdateTask({ taskId, onClose, onSuccess }) {
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [task, setTask] = useState(null);

  const [formData, setFormData] = useState({
    taskTitle: "", taskDetails: "",
    priority: "Select", status: "Select",
    startDate: "", endDate: "", dueDate: "",
  });

  /* phases: array of { phaseTitle: string, phaseDescription: string, phaseStatus: string } */
  const [phases, setPhases] = useState([]);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [postingPhase, setPostingPhase] = useState(null);
  const [workHistory, setWorkHistory] = useState([]); // Work updates list

  const initialDataRef = useRef(null);
  const timerRef = useRef(null);

  const DEFAULT_AVATAR = "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const priorityOptions = [
    { value: "Select", label: "Select Priority" },
    { value: "High", label: "High" },
    { value: "Mid", label: "Mid" },
    { value: "Low", label: "Low" },
  ];
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "inprocess", label: "In Process" },
    { value: "hold", label: "Hold" },
    { value: "Completed", label: "Completed" },

  ];

  /* ── Token ── */
  const token = useMemo(() => {
    try { const r = sessionStorage.getItem("Erti-Portal"); return r ? JSON.parse(r)?.token : ""; }
    catch { return ""; }
  }, []);

  /* ── Current user from JWT ── */
  const currentUserId = useMemo(() => {
    try {
      const r = sessionStorage.getItem("Erti-Portal");
      const parsed = r ? JSON.parse(r) : null;
      if (parsed?.user?._id) return parsed.user._id;
      if (parsed?.user?.id) return parsed.user.id;
    } catch { }
    if (!token) return null;
    try {
      const d = jwtDecode(token);
      return d?.id || d?._id || d?.userId || d?.user_id || d?.sub || null;
    } catch { return null; }
  }, [token]);

  /* â”€â”€ Creator ID â”€â”€ */
  const taskCreatorId = useMemo(() => {
    if (!task) return null;
    const cb = task?.createdBy;
    if (!cb) return null;
    if (typeof cb === "string") return cb;
    return cb?._id || cb?.id || cb?.userId || cb?.user_id || null;
  }, [task]);

  /* â”€â”€ Role flags â”€â”€ */
  const isCreator = useMemo(() => {
    if (!currentUserId || !taskCreatorId) return false;
    return String(currentUserId).trim() === String(taskCreatorId).trim();
  }, [currentUserId, taskCreatorId]);

  const isAssignedMember = useMemo(() => {
    if (!currentUserId || !task?.assignedMembers) return false;
    return task.assignedMembers.some(m => {
      const id = typeof m === "string" ? m : m?._id || m?.id || m?.userId || "";
      return String(id).trim() === String(currentUserId).trim();
    });
  }, [currentUserId, task]);

  const myMemberStatus = useMemo(() => {
    if (!currentUserId) return null;
    if (Array.isArray(task?.memberStatuses) && task.memberStatuses.length > 0) {
      const ms = task.memberStatuses.find(
        m => (m.employeeId?._id || m.employeeId || "").toString() === String(currentUserId)
      );
      if (ms) return (ms.assignedStatus || "").toLowerCase();
    }
    return (task?.assignedStatus || "").toLowerCase();
  }, [task, currentUserId]);

  const isTaskCompleted = useMemo(() => {
    const s = (task?.status || "").toLowerCase().replace(/[\s\-_]/g, "");
    return s === "completed";
  }, [task?.status]);

  /* ── Field-level access ── */
  const canEditField = useCallback((field) => {
    if (isTaskCompleted) return false;
    if (field === "endDate") return false;
    if (isCreator) return true;
    if (isAssignedMember) {
      if (myMemberStatus === "rejected" || myMemberStatus === "allocated") return false;
      return ["status", "startDate"].includes(field);
    }
    return false;
  }, [isCreator, isAssignedMember, myMemberStatus, isTaskCompleted]);

  const canEditPhases = !isTaskCompleted && (isCreator || (isAssignedMember && myMemberStatus === "accepted"));

  /* â”€â”€ Work History â”€â”€ */
  const fetchWorkHistory = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await portalInstance.get(`/creat/daily-update/${taskId}`);
      setWorkHistory(res.data.data || []);
    } catch (err) {
      console.error("HISTORY FETCH ERROR:", err);
    }
  }, [taskId]);

  /* â”€â”€ Helpers â”€â”€ */
  const buildFileUrl = useCallback((fileUrl) => {
    if (!fileUrl) return null;
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) return fileUrl;
    const base = (portalInstance.defaults.baseURL || "").replace(/\/+$/, "");
    return `${base}/${fileUrl.replace(/^\/+/, "")}`;
  }, []);

  const getFileIcon = useCallback((fileName) => {
    if (!fileName) return "FILE";
    const ext = fileName.split(".").pop()?.toLowerCase();
    return ({
      pdf: "PDF", doc: "DOC", docx: "DOCX", xls: "XLS", xlsx: "XLSX",
      png: "IMG", jpg: "IMG", jpeg: "IMG", gif: "IMG",
      zip: "ZIP", rar: "RAR", txt: "TXT", csv: "CSV", ppt: "PPT", pptx: "PPTX",
    })[ext] || "FILE";
  }, []);

  const getFileSize = useCallback((size) => {
    if (!size) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const formatLastUpdated = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  /* â”€â”€ Download â”€â”€ */
  const handleDownload = useCallback(async (doc) => {
    if (!doc?.fileUrl) { toast.error("File URL is missing"); return; }
    const fullUrl = buildFileUrl(doc.fileUrl);
    const fileId = doc.fileUrl;
    const fileName = doc.fileName || "download";
    try {
      setDownloadingFileId(fileId);
      const dlToast = toast.info(`Downloading ${fileName}`, { autoClose: false });
      const res = await portalInstance.get(doc.fileUrl, { responseType: "blob" });
      let finalName = fileName;
      const cd = res.headers?.["content-disposition"];
      if (cd) {
        const m = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (m?.[1]) finalName = m[1].replace(/['"]/g, "");
      }
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = Object.assign(document.createElement("a"), {
        href: blobUrl, download: finalName, style: "display:none"
      });
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(blobUrl); }, 100);
      toast.dismiss(dlToast);
      toast.success(`${finalName} downloaded successfully`);
    } catch {
      window.open(fullUrl, "_blank", "noopener,noreferrer");
      toast.info("File opened in new tab");
    } finally {
      setDownloadingFileId(null);
    }
  }, [buildFileUrl]);

  /* â”€â”€ Remove existing doc â”€â”€ */
  const handleRemoveExistingDoc = useCallback(async (doc) => {
    const docId = doc?._id || doc?.id || doc;
    if (!docId) { toast.error("Document ID missing"); return; }
    try {
      await portalInstance.delete(`/creat/task/${taskId}/document/${encodeURIComponent(docId)}`);
      setTask(prev => ({
        ...prev,
        documents: prev.documents.filter(d => (d?._id || d?.id || d) !== docId),
      }));
      toast.success("Document removed successfully");
    } catch { toast.error("Failed to remove document"); }
  }, [taskId]);

  /* ── File upload ── */
  const handleFileUpload = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = []; const errors = [];
    files.forEach(f => {
      if (f.size > MAX_FILE_SIZE) errors.push(`${f.name} exceeds 10MB`);
      else if (uploadedFiles.some(u => u.name === f.name && u.size === f.size)) errors.push(`${f.name} already added`);
      else valid.push(f);
    });
    errors.forEach(err => toast.error(err));
    if (valid.length) {
      setUploadedFiles(p => [...p, ...valid]);
      toast.success(valid.length === 1 ? `${valid[0].name} added` : `${valid.length} files added`);
    }
    e.target.value = "";
  }, [uploadedFiles]);

  const handleRemoveUploadedFile = useCallback((index) => {
    const name = uploadedFiles[index]?.name || "File";
    setUploadedFiles(p => p.filter((_, i) => i !== index));
    toast.info(`${name} removed`);
  }, [uploadedFiles]);

  /* ──────────────────────────────────────────────────────────────────────────────────────────────────
     PHASE HANDLERS
  ────────────────────────────────────────────────────────────────────────────────────────────────── */
  const handlePhaseChange = useCallback((index, field, value) => {
    setPhases(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setIsDirty(true);
  }, []);

  const handleAddPhase = useCallback(() => {
    if (isTaskCompleted) return;
    setPhases(prev => [...prev, { phaseTitle: "", phaseDescription: "", phaseStatus: "pending", isSaved: false }]);
    setIsDirty(true);
  }, [isTaskCompleted]);

  const handleRemovePhase = useCallback((index) => {
    if (isTaskCompleted) return;
    if ((phases[index]?.phaseStatus || "").toLowerCase() === "completed") {
      toast.warning("Completed phase cannot be removed.");
      return;
    }
    setPhases(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, [isTaskCompleted, phases]);

  const handleSavePhase = useCallback((index) => {
    if (isTaskCompleted) {
      toast.warning("Completed tasks cannot be modified.");
      return;
    }
    const phase = phases[index];
    if (!phase || !phase.phaseTitle?.trim()) {
      toast.error("Please enter the phase title");
      return;
    }

    setPhases(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        phaseTitle: updated[index].phaseTitle.trim(),
        phaseDescription: (updated[index].phaseDescription || "").trim(),
        phaseStatus: updated[index].phaseStatus || "pending",
        isSaved: true
      };
      return updated;
    });

    setIsDirty(true);
    toast.dismiss();
    toast.success("Phase saved successfully", { autoClose: 1500 });
  }, [phases, isTaskCompleted]);

  const handleEditPhase = useCallback((index) => {
    if ((phases[index]?.phaseStatus || "").toLowerCase() === "completed") {
      toast.warning("Completed phase cannot be edited.");
      return;
    }
    setPhases(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isSaved: false };
      return updated;
    });
  }, [phases]);

  /* ── Lifecycle ── */
  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!taskId) return;
    (async () => {
      try {
        setFetching(true);
        const res = await portalInstance.get(`/creat/tasks/${taskId}`);
        const td = res.data.data;
        setTask(td);

        const myMemberStatus = Array.isArray(td.memberStatuses) && currentUserId
          ? td.memberStatuses.find(ms => (ms.employeeId?._id || ms.employeeId || "").toString() === String(currentUserId))
          : null;

        const isUserCreator = (currentUserId && td.createdBy) && String(currentUserId) === String(typeof td.createdBy === "string" ? td.createdBy : (td.createdBy._id || td.createdBy.id));

        const loaded = {
          taskTitle: td.taskTitle || "",
          taskDetails: td.taskDetails || "",
          priority: td.priority || "Select",
          status: (!isUserCreator && myMemberStatus?.status) ? myMemberStatus.status : (td.status || "Select"),
          startDate: (!isUserCreator && myMemberStatus?.startDate !== undefined && myMemberStatus?.startDate !== null)
            ? (myMemberStatus.startDate ? myMemberStatus.startDate.slice(0, 10) : "")
            : (td.startDate ? td.startDate.slice(0, 10) : ""),
          endDate: (!isUserCreator && myMemberStatus?.endDate !== undefined && myMemberStatus?.endDate !== null)
            ? (myMemberStatus.endDate ? myMemberStatus.endDate.slice(0, 10) : "")
            : (td.endDate ? td.endDate.slice(0, 10) : ""),
          dueDate: td.dueDate ? td.dueDate.slice(0, 10) : "",
        };
        setFormData(loaded);
        setSelectedEmployees(td.assignedMembers || []);

        /* ── Phases: Load Previous Phases ── */
        const isAssigned = (td.assignedMembers || []).some(m => {
          const id = typeof m === "string" ? m : m?._id || m?.id || m?.userId || "";
          return String(id).trim() === String(currentUserId).trim();
        });

        const rawPhases = Array.isArray(td.phases) ? td.phases : [];
        const memberPhases = (!isUserCreator && isAssigned && currentUserId)
          ? rawPhases.filter(p => {
              if (typeof p !== "object" || !p) return true;
              const ownerId = (p.employeeId?._id || p.employeeId || "").toString();
              return !ownerId || ownerId === String(currentUserId);
            })
          : rawPhases;

        const initialPhases = memberPhases
          .map(p => {
            if (typeof p === "string") {
              const trimmed = p.trim();
              return trimmed ? {
                phaseTitle: trimmed,
                phaseDescription: "",
                phaseStatus: "pending",
                isSaved: true,
              } : null;
            }
            const title = (p.phaseTitle || p.phase || "").trim();
            if (!title) return null;
            return {
              _id: p._id,
              phaseTitle: title,
              phaseDescription: (p.phaseDescription || p.description || "").trim(),
              phaseStatus: p.phaseStatus || p.status || "pending",
              employeeId: p.employeeId?._id || p.employeeId || undefined,
              updateDate: p.updateDate,
              isSaved: true,
            };
          })
          .filter(Boolean);

        setPhases(initialPhases);

        initialDataRef.current = {
          formData: loaded,
          members: td.assignedMembers || [],
          phases: initialPhases,
        };
        setIsDirty(false);
      } catch { toast.error("Failed to load task details"); }
      finally { setFetching(false); }
    })();
    fetchWorkHistory();
  }, [taskId, fetchWorkHistory]);

  useEffect(() => {
    (async () => {
      try {
        const res = await portalInstance.get("/data/employees?role=employee");
        const fetched = res.data.data || [];
        const activeEmployees = fetched.filter(
          (emp) =>
            emp &&
            (emp.role || "").toLowerCase() !== "admin" &&
            emp.employmentStatus !== "relieved" &&
            emp.employmentStatus !== "relived" &&
            emp.status !== "relieved" &&
            emp.status !== "relived"
        );
        setAllEmployees(activeEmployees);
      } catch { toast.error("Failed to load employees"); }
    })();
  }, []);

  useEffect(() => {
    if (!initialDataRef.current) return;
    const initIds = initialDataRef.current.members.map(m => m._id).sort();
    const curIds = selectedEmployees.map(m => m._id).sort();
    const phasesDiff = JSON.stringify(initialDataRef.current.phases) !== JSON.stringify(phases);
    setIsDirty(
      JSON.stringify(initialDataRef.current.formData) !== JSON.stringify(formData) ||
      JSON.stringify(initIds) !== JSON.stringify(curIds) ||
      uploadedFiles.length > 0 ||
      phasesDiff
    );
  }, [formData, selectedEmployees, uploadedFiles, phases]);

  /* ── Event handlers ── */
  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleAddEmployee = emp => {
    if (!selectedEmployees.some(e => e._id === emp._id)) {
      setSelectedEmployees([...selectedEmployees, emp]);
      toast.success(`${emp.name} added to task`);
    }
  };
  const handleRemoveEmployee = id => {
    const emp = selectedEmployees.find(e => e._id === id);
    setSelectedEmployees(selectedEmployees.filter(e => e._id !== id));
    if (emp) toast.info(`${emp.name} removed from task`);
  };
  const handleCancel = () => isDirty ? setShowConfirmModal(true) : onClose();

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (isTaskCompleted) {
      toast.warning("Completed tasks cannot be modified.");
      return;
    }
    // 1. If no changes were made at all, just notify and stop
    if (!isDirty) {
      toast.info("No changes detected to update.");
      return;
    }

    // 2. Validation: If they modified a phase status but left the title empty
    const emptyPhaseWithStatus = phases.find(p => !(p.phaseTitle || "").trim() && ((p.phaseDescription || "").trim() || (p.phaseStatus && p.phaseStatus !== "pending")));
    if (emptyPhaseWithStatus) {
      toast.warning("Please enter the phase title before updating.");
      return;
    }

    if (!formData.taskTitle.trim()) { toast.warning("Please enter a task title"); return; }

    if (task?.createdDate) {
      const taskCreatedStr = task.createdDate.slice(0, 10);
      if (formData.startDate && formData.startDate < taskCreatedStr) {
        toast.warning(`Start date cannot be before the task creation date (${taskCreatedStr})`);
        return;
      }
    }

    const isCompleted = (formData.status || "").toLowerCase() === "completed";
    if (isCompleted && !formData.endDate) {
      const todayStr = new Date().toISOString().split("T")[0];
      formData.endDate = task?.endDate ? task.endDate.slice(0, 10) : todayStr;
    }

    if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      toast.warning("Start date cannot be after end date");
      return;
    }

    const toastId = toast.loading("Updating task...");
    setLoading(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(k => {
        if (k !== "phases" && k !== "assignedMembers") {
          data.append(k, formData[k]);
        }
      });
      data.append("assignedMembers", JSON.stringify(selectedEmployees.map(e => e._id)));

      // Filter and standardize phases (tagging with loggedInUserId for per-member isolation)
      const loggedInUserId = currentUserId || localStorage.getItem("userId") || sessionStorage.getItem("userId") || "";
      const filteredPhases = phases
        .filter(p => p.phaseTitle?.trim())
        .map(p => {
          const empId = p.employeeId?._id || p.employeeId || loggedInUserId || undefined;
          return {
            ...(p._id ? { _id: p._id } : {}),
            phaseTitle: p.phaseTitle.trim(),
            phaseDescription: (p.phaseDescription || "").trim(),
            phaseStatus: p.phaseStatus || "pending",
            updateDate: p.updateDate || new Date().toISOString(),
            ...(empId ? { employeeId: empId } : {}),
          };
        });

      data.append("phases", JSON.stringify(filteredPhases));



      uploadedFiles.forEach(f => data.append("files", f));

      await portalInstance.put(`/creat/task/${taskId}`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.update(toastId, {
        render: "Task updated successfully",
        type: "success", isLoading: false, autoClose: 3000,
      });
      setIsDirty(false);
      timerRef.current = setTimeout(() => {
        if (onSuccess) onSuccess();
        else onClose();
      }, 1500);
    } catch (err) {
      toast.update(toastId, {
        render: err.response?.data?.message || "Failed to update task",
        type: "error", isLoading: false, autoClose: 5000,
      });
    } finally { setLoading(false); }
  };

  /* â”€â”€ Derived â”€â”€ */
  const availableEmployees = allEmployees
    .filter(emp => !selectedEmployees.some(s => s._id === emp._id))
    .filter(emp => search ? emp.name.toLowerCase().includes(search.toLowerCase()) : false);

  const roleLabel = isCreator ? "" : isAssignedMember ? "" : "";
  const roleBadgeCls = isCreator ? "" : isAssignedMember ? "" : "";

  if (fetching) return (
    <div className="admin-task-details-update-container"
      style={{ minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="p-5 text-center">
        <div className="spinner-border text-primary mb-3" />
        <p>Loading Task Details...</p>
      </div>
    </div>
  );

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     RENDER
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  return (
    <>
      <div className="admin-task-details-update-container">
        <ToastContainer
          position="top-right"
          autoClose={1500}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          style={{ zIndex: 99999999 }}
        />
        {/* Header */}
        <div className="admin-task-details-update-header">
          <div className="header-top-row">
            <div className="d-flex align-items-center gap-3">
              <h4 className="assign-task__members-title">Update Task</h4>
              <div className="header-meta">
                <span className={`role-badge ${roleBadgeCls}`}>{roleLabel}</span>
                {task?.updatedAt && (
                  <span className="last-updated-text">
                    Last updated: {formatLastUpdated(task.updatedAt)}
                  </span>
                )}
              </div>
            </div>
            <button className="hrms-common-close-btn" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="admin-task-details-update-body">

          {!isCreator && (
            <div
              className={`admin-task-details-update-members-panel${!isCreator ? " panel-disabled" : ""}`}
              style={{ opacity: isCreator ? 1 : 0.5, pointerEvents: isCreator ? "auto" : "none" }}
            >
              <h6>
                Assign Members
              </h6>
              {isCreator && (
                <div className="adminAssignTask__searchFilter">
                  <div className="adminAssignTask__searchBox">
                    <input type="text" placeholder="Search to add employees..."
                      value={search} onChange={e => setSearch(e.target.value)} disabled={!isCreator} />
                    <img src={searchIcon} alt="search" />
                  </div>
                </div>
              )}
              <div className="members-list">
                {(isCreator ? selectedEmployees : selectedEmployees.filter(emp => (emp?._id || emp).toString() === String(currentUserId))).map(emp => (
                  <div className="member selected" key={emp._id}>
                    <img
                      src={emp?.avatar || emp?.pictureUrl || emp?.photoUrl || (emp?.photo ? buildFileUrl(emp.photo) : DEFAULT_AVATAR)}
                      className="member-avatar" alt={emp.name}
                      onError={e => { e.target.src = DEFAULT_AVATAR; }}
                    />
                    <div className="member-info">
                      <p className="member-name">{emp.name}</p>
                      <p className="member-role">{emp.designation || "Employee"}</p>
                    </div>
                    {isCreator && (
                      <img src={closeIcon} className="member-action" alt="Remove"
                        onClick={() => handleRemoveEmployee(emp._id)} />
                    )}
                  </div>
                ))}
                {search && isCreator && selectedEmployees.length > 0 && availableEmployees.length > 0 && (
                  <hr className="member-divider" />
                )}
                {search && isCreator && availableEmployees.map(emp => (
                  <div className="member" key={emp._id} onClick={() => handleAddEmployee(emp)}>
                    <img
                      src={emp?.avatar || emp?.pictureUrl || emp?.photoUrl || (emp?.photo ? buildFileUrl(emp.photo) : DEFAULT_AVATAR)}
                      className="member-avatar" alt={emp.name}
                      onError={e => { e.target.src = DEFAULT_AVATAR; }}
                    />
                    <div className="member-info"><p className="member-name">{emp.name}</p></div>
                    <img src={plusIcon} className="member-action" alt="Add" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ RIGHT: Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="admin-task-details-update-form">

            {(task?.category || task?.project || task?.workType || (task?.pages && task.pages.length > 0)) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "16px", background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                {(task?.category || task?.project) && (
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    <span style={{ fontWeight: "600", color: "#334155" }}>Project: </span>
                    <span>{(task?.category || "").toUpperCase()} / {task?.project || ""}</span>
                  </div>
                )}
                {task?.workType && (
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#5977f8", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "4px", padding: "2px 8px" }}>
                    {task.workType}
                  </span>
                )}
                {task?.pages && task.pages.length > 0 && task.pages.map((pg, pIdx) => (
                  <span key={pIdx} style={{ fontSize: "11px", fontWeight: "500", color: "#334155", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "2px 8px" }}>
                    {pg}
                  </span>
                ))}
              </div>
            )}

            <FieldWrapper label="Task Title">
              <input type="text" name="taskTitle" value={formData.taskTitle}
                onChange={handleChange} disabled={!canEditField("taskTitle")}
                className={!canEditField("taskTitle") ? "field-disabled" : ""} />
            </FieldWrapper>

            <FieldWrapper label="Task Details">
              <textarea name="taskDetails" value={formData.taskDetails}
                onChange={handleChange} disabled={!canEditField("taskDetails")}
                className={!canEditField("taskDetails") ? "field-disabled" : ""} />
            </FieldWrapper>


            <div className="form-row mb-0">
              <FieldWrapper label="Start Date *">
                <div className="date-inputsbut position-relative">
                  <input type="text" name="startDate" id="startDate" placeholder="YYYY-MM-DD"
                    value={formData.startDate || ""} onChange={handleChange}
                    disabled={!canEditField("startDate")}
                    className={!canEditField("startDate") ? "field-disabled" : "custom-date"} />
                  {canEditField("startDate") && (
                    <>
                      <img src={DateIcon} alt="calendar" className="date-icon cursor-pointer"
                        onClick={() => { const el = document.getElementById("startDate_picker"); if (el) { try { el.showPicker(); } catch (e) { } } }} />
                      <input id="startDate_picker" type="date"
                        min={task?.createdDate ? task.createdDate.slice(0, 10) : ""}
                        value={formData.startDate || ""}
                        onChange={(e) => handleChange({ target: { name: "startDate", value: e.target.value } })}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                      />
                    </>
                  )}
                </div>
              </FieldWrapper>

              <FieldWrapper label="End Date *">
                <div className="date-inputsbut position-relative">
                  <input type="text" name="endDate" id="endDate" placeholder="YYYY-MM-DD"
                    value={formData.endDate || ""}
                    readOnly={true}
                    disabled={true}
                    className="hrms-unified-input-style custom-date field-disabled" />
                  <img src={DateIcon} alt="calendar" className="date-icon opacity-50 cursor-not-allowed"
                    style={{ pointerEvents: "none" }} />
                </div>
              </FieldWrapper>

              <FieldWrapper label="Due Date">
                <div className="date-inputsbut position-relative">
                  <input type="text" name="dueDate" id="dueDate" placeholder="YYYY-MM-DD"
                    value={formData.dueDate || ""} onChange={handleChange}
                    disabled={!canEditField("dueDate")}
                    className={!canEditField("dueDate") ? "field-disabled" : "custom-date"} />
                  {canEditField("dueDate") && (
                    <>
                      <img src={DateIcon} alt="calendar" className="date-icon cursor-pointer"
                        onClick={() => { const el = document.getElementById("dueDate_picker"); if (el) { try { el.showPicker(); } catch (e) { } } }} />
                      <input id="dueDate_picker" type="date"
                        value={formData.dueDate || ""}
                        onChange={(e) => handleChange({ target: { name: "dueDate", value: e.target.value } })}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                      />
                    </>
                  )}
                </div>
              </FieldWrapper>
            </div>

            <div className="form-row mb-0">
              <FieldWrapper label="Priority">
                <div className="date-inputsbut">
                  {canEditField("priority") ? (
                    <CustomDropdown options={priorityOptions} value={formData.priority}
                      onChange={val => setFormData({ ...formData, priority: val })} disabled={false} />
                  ) : (
                    <LockedDropdown options={priorityOptions} value={formData.priority} />
                  )}
                </div>
              </FieldWrapper>

              <FieldWrapper label="Task Status">
                <div className="date-inputsbut">
                  <CustomDropdown options={statusOptions} value={formData.status}
                    onChange={val => {
                      const isCompleted = (val || "").toLowerCase() === "completed";
                      const todayStr = new Date().toISOString().split("T")[0];
                      setFormData(prev => ({
                        ...prev,
                        status: val,
                        endDate: isCompleted ? (task?.endDate ? task.endDate.slice(0, 10) : todayStr) : "",
                      }));
                      setIsDirty(true);
                    }}
                    disabled={!canEditField("status")} />
                </div>
              </FieldWrapper>

              {/* Spacer container to align columns with the 3-column row above */}
              <div className="form-group update-task-spacer-col" style={{ flex: 1 }}></div>
            </div>


            <div className="phases-section">
              <div className="atPhase__header">
                <label className="update-task-section-label">Phase</label>

                {canEditPhases && (
                  <button className="atPhase__addBtnupdate" onClick={handleAddPhase} type="button">
                    + Add Phase
                  </button>
                )}
              </div>

              <div className="atPhase__list">
                {phases.map((p, index) => (
                  <PhaseRow
                    key={p._id || index}
                    index={index}
                    phaseTitle={p.phaseTitle}
                    phaseDescription={p.phaseDescription}
                    phaseStatus={p.phaseStatus}
                    isSaved={p.isSaved}
                    onChange={handlePhaseChange}
                    onRemove={handleRemovePhase}
                    onSave={handleSavePhase}
                    onEdit={handleEditPhase}
                    canEdit={canEditPhases}
                  />
                ))}
              </div>
            </div>

            <div className="update-task-docs-section">
              <label className="update-task-section-label">Documents</label>
              {(isCreator || isAssignedMember) && (
                <label htmlFor="updateTaskUpload" className="hrms-common-upload-box">
                  <img src={attachIcon} alt="Add" className="update-task-attach-icon" />
                  <span>Add File</span>
                  <input type="file" id="updateTaskUpload" hidden multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.xlsm,.xlsb,.ods,.txt,.png,.jpg,.jpeg,.webp,.zip"
                    onChange={handleFileUpload} />
                </label>
              )}

              {task?.documents?.length > 0 && (
                <div className="hrms-common-file-list mt-3">
                  {task.documents.map((doc, index) => {
                    const fileUrl = doc?.fileUrl || doc;
                    const fileName = doc?.fileName || String(fileUrl).split("/").pop() || "Unnamed File";
                    const isDL = downloadingFileId === fileUrl;
                    return (
                      <div key={index} className={`hrms-common-file-item${isDL ? " downloading" : ""}`}>
                        <div className="d-flex align-items-center gap-2 overflow-hidden" role="button" tabIndex={0}
                          style={{ cursor: 'pointer', flex: 1 }}
                          onClick={() => !isDL && handleDownload(doc)}
                          onKeyDown={e => { if (e.key === "Enter" && !isDL) handleDownload(doc); }}>
                          <img src={Document} alt="Doc" className="update-task-attach-icon" />
                          <span className="hrms-common-file-name">{fileName}</span>
                          {doc?.fileSize && <span className="file-size-text" style={{ fontSize: '10px', color: '#94a3b8' }}>({getFileSize(doc.fileSize)})</span>}
                        </div>
                        {(isCreator || isAssignedMember) && (
                          <button className="hrms-common-file-remove"
                            onClick={e => { e.stopPropagation(); handleRemoveExistingDoc(doc); }}>
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {uploadedFiles.length > 0 && (
                <div className="hrms-common-file-list mt-3">
                  <p className="docs-sub-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '5px' }}>New Files to Upload</p>
                  {uploadedFiles.map((file, index) => (
                    <div key={`new-${index}`} className="hrms-common-file-item">
                      <div className="d-flex align-items-center gap-2 overflow-hidden" style={{ flex: 1 }}>
                        <span className="file-icon-text" style={{ fontSize: '10px', background: '#e2e8f0', padding: '2px 4px', borderRadius: '4px' }}>{getFileIcon(file.name)}</span>
                        <span className="hrms-common-file-name">{file.name}</span>
                        <span className="new-badge" style={{ fontSize: '9px', background: '#dcfce7', color: '#166534', padding: '1px 4px', borderRadius: '3px' }}>NEW</span>
                      </div>
                      <button className="hrms-common-file-remove" onClick={() => handleRemoveUploadedFile(index)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {(!task?.documents || task.documents.length === 0) && uploadedFiles.length === 0 && (
                <p className="no-docs-message">No documents attached yet.</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="admin-task-details-update-form-actions">
              <button className="hrms-common-btn-cancel" onClick={handleCancel}>Cancel</button>
              {!isTaskCompleted && (
                <button className="hrms-common-btn-primary"
                  onClick={handleSubmit} disabled={loading}>
                  {loading ? "Updating..." : "Update Task"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Modal */}
      {showConfirmModal && (
        <div className="unsaved-confirm-overlay">
          <div className="unsaved-confirm-modal" onClick={e => e.stopPropagation()}>
            <h4 className="unsaved-title">Unsaved Changes</h4>
            <p className="unsaved-message">You have modified this task. Discard changes?</p>
            <div className="confirm-btn-container">
              <button className="confirm-btn discard" onClick={onClose}>Discard</button>
              <button className="confirm-btn keep" onClick={() => setShowConfirmModal(false)}>Keep Editing</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* â”€â”€ Role badge â”€â”€ */
        .role-badge { font-size:12px; font-weight:600; margin-left:10px; padding:4px 12px; border-radius:20px; }
        .role-badge.creator  { color:#2e7d32; background:#e8f5e9; }
        .role-badge.assignee { color:#1565c0; background:#e3f2fd; }
        .role-badge.viewer   { color:#6d4c41; background:#efebe9; }
        /* â”€â”€ Field labels â”€â”€ */
        .field-label-row { display:flex; align-items:center; margin-bottom:6px; }
        .field-label-text { font-size:10px; color:#868585; line-height:100%; letter-spacing:0.1px; }
        .field-locked-wrapper input,
        .field-locked-wrapper textarea {
          background-color:#f7f7f8 !important; color:#b8b8c0 !important;
          cursor:not-allowed !important; border-color:#e8e8ec !important; pointer-events:none;
        }
        .locked-dropdown {
          width:100%; padding:8px 15px; border:1px solid #e8e8ec; border-radius:5px;
          font-size:11px; color:#b8b8c0; background:#f7f7f8;
          display:flex; align-items:center; justify-content:space-between;
          cursor:not-allowed; user-select:none; min-height:32px; box-sizing:border-box;
        }
        .view-only-label { font-size:11px; color:#f44336; margin-left:8px; font-weight:normal; }
        /* â”€â”€ Docs â”€â”€ */
        .file-icon-text {
          font-size:10px; font-weight:600; padding:2px 6px;
          background:#e3f2fd; border-radius:4px; color:#1976d2;
        }
        .remove-doc-btn {
          background:#ef5350; color:white; border:none;
          padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px;
        }
        .remove-doc-btn:hover { background:#e53935; }

        /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
           PHASES STYLES
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
        .phases-section {
          margin: 18px 0 14px;
          border: 1px solid #e8e8ec;
          border-radius: 8px;
          padding: 14px 16px;
          background: #fafbfc;
        }
        .phases-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .phases-hint {
          font-size: 11px;
          color: #9ca3af;
          margin-bottom: 10px;
        }
        .add-phase-btn {
          font-size: 12px;
          padding: 4px 12px;
          border: 1px dashed #6366f1;
          border-radius: 20px;
          background: #eef2ff;
          color: #6366f1;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.15s;
        }
        .add-phase-btn:hover { background:#e0e7ff; }

        .phases-list { display: flex; flex-direction: column; gap: 8px; }

        /* â”€â”€ Phase row â”€â”€ */
        .phase-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          border: 1px solid #e8e8ec;
          border-radius: 7px;
          padding: 7px 10px;
        }
        .phase-status-selector {
          display: flex;
          align-items: center;
          gap: 5px;
          min-width: 120px;
          flex-shrink: 0;
        }
        .phase-status-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .phase-status-select {
          font-size: 11px;
          border: none;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          outline: none;
          padding: 2px 0;
          max-width: 100px;
        }
        .phase-status-label { font-size: 11px; font-weight: 600; }

        .phase-input {
          flex: 1;
          border: none;
          border-bottom: 1px solid #e5e7eb;
          font-size: 12px;
          padding: 4px 6px;
          outline: none;
          background: transparent;
          color: #9ca3af;
          min-width: 0;
        }
        .phase-input:focus { border-bottom-color: #6366f1; }
        .phase-input:disabled { color: #9ca3af; cursor: not-allowed; }

        .phase-post-btn {
          font-size: 11px;
          padding: 4px 11px;
          border: none;
          border-radius: 5px;
          background: #6366f1;
          color: white;
          cursor: pointer;
          font-weight: 600;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .phase-post-btn:hover:not(:disabled) { background: #4f46e5; }
        .phase-post-btn:disabled { background: #c7d2fe; cursor: not-allowed; }

        .phase-remove-btn {
          background: transparent;
          border: none;
          color: #ef4444;
          cursor: pointer;
          font-size: 13px;
          padding: 2px 5px;
          border-radius: 4px;
          flex-shrink: 0;
          line-height: 1;
        }
        .phase-remove-btn:hover { background: #fee2e2; }
      `}</style>
    </>
  );
}

export default UpdateTask;

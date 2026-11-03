// AssignTask.jsx — MODIFIED: Create Security Request
import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import searchIcon from "../../../assets/Vector.png";
import filterIcon from "../../../assets/mage_filter-square-fill.svg";
import plusIcon from "../../../assets/plus.png";
import closeIcon from "../../../assets/close.png";
import Dropdown from "../../../assets/dropdown.png";
import { portalInstance } from "../../../Services/instance";
import CustomDropdown from "../../Common/CustomDropdown";
import { Icon } from "@iconify/react";
import "./Security.css";

// ─── Request-type conditional fields config ───────────────────────────────
const REQUEST_TYPE_FIELDS = {
  CODE: ["repo", "branch", "commitId"],
  GIT: ["repo", "branch", "commitId", "category", "changeType", "requestedBy", "riskLevel"],
  SERVER: ["serverName"],
  AWS: ["environment", "awsCategory", "awsType", "awsRiskLevel", "platformService"],
  MONGODB: ["dbName"],
  OTHER: ["customType"], // description already in base form
};

void 0; // line removed
const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes) || Number(bytes) <= 0) return "";
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

function StateAssign({ onClose, editData }) {
  const [employees, setEmployees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedChecker, setSelectedChecker] = useState([]); // multiple checkers
  const [selectedCc, setSelectedCc] = useState([]); // multiple CCs
  const [showAllEmployees, setShowAllEmployees] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showApproverList, setShowApproverList] = useState(false);
  const [showCcList, setShowCcList] = useState(false);
  const [showRequestTypeList, setShowRequestTypeList] = useState(false);
  const [searchCc, setSearchCc] = useState("");
  const [isPointByPoint, setIsPointByPoint] = useState(false);

  // Base form
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requestType: "",
    dueDate: "",
  });

  // Conditional fields (repo, branch, commitId, serverName)
  const [requestData, setRequestData] = useState({
    repo: "",
    branch: "",
    commitId: "",
    category: "",
    changeType: "",
    requestedBy: "",
    riskLevel: "",
    serverName: "",
    environment: "",
    awsCategory: "",
    awsType: "",
    awsRiskLevel: "",
    platformService: "",
    dbName: "",
    customType: "",
  });

  const [files, setFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);

  // Custom Prompt Modal State
  const [promptConfig, setPromptConfig] = useState({ isOpen: false, title: "", field: "", value: "" });

  const handlePromptSubmit = () => {
    if (promptConfig.value.trim()) {
      setRequestData({ ...requestData, [promptConfig.field]: promptConfig.value.trim() });
    }
    setPromptConfig({ isOpen: false, title: "", field: "", value: "" });
  };

  const handlePromptCancel = () => {
    setPromptConfig({ isOpen: false, title: "", field: "", value: "" });
  };

  const DEFAULT_AVATAR = "/avatar.png";

  const todayStr = new Date().toISOString().split("T")[0];

  // ─── Fetch data ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await portalInstance.get("/data/employees");
        setEmployees(res.data.data || []);
      } catch {
        toast.error("Failed to load employee list");
      }
    };
    const fetchProfile = async () => {
      try {
        const res = await portalInstance.get("/users/get-details");
        setCurrentUser(res.data.data);
      } catch {
        console.error("Profile fetch failed");
      }
    };
    fetchEmployees();
    fetchProfile();
  }, []);

  // ─── Initialize for Edit Mode ──────────────────────────────────────
  useEffect(() => {
    if (editData) {
      const desc = editData.description || "";
      const hasPoints = /(^|\n)[•\-\*]\s/.test(desc);
      setIsPointByPoint(hasPoints);

      setFormData({
        title: editData.title || "",
        description: editData.description || "",
        requestType: editData.requestType || "",
        dueDate: editData.dueDate ? new Date(editData.dueDate).toISOString().split("T")[0] : "",
      });
      setRequestData({
        repo: editData.requestData?.repo || "",
        branch: editData.requestData?.branch || "",
        commitId: editData.requestData?.commitId || "",
        category: editData.requestData?.category || "",
        changeType: editData.requestData?.changeType || "",
        requestedBy: editData.requestData?.requestedBy || "",
        riskLevel: editData.requestData?.riskLevel || "",
        serverName: editData.requestData?.serverName || "",
        environment: editData.requestData?.environment || "",
        awsCategory: editData.requestData?.awsCategory || "",
        awsType: editData.requestData?.awsType || "",
        awsRiskLevel: editData.requestData?.awsRiskLevel || "",
        platformService: editData.requestData?.platformService || "",
        dbName: editData.requestData?.dbName || "",
        customType: editData.requestData?.customType || "",
      });
      if (editData.checkerId) {
        setSelectedChecker(Array.isArray(editData.checkerId) ? editData.checkerId : [editData.checkerId]);
      } else {
        setSelectedChecker([]);
      }
      if (editData.ccId) {
        setSelectedCc(Array.isArray(editData.ccId) ? editData.ccId : [editData.ccId]);
      } else {
        setSelectedCc([]);
      }
      if (editData.files) {
        setExistingFiles(editData.files);
      } else {
        setExistingFiles([]);
      }
    }
  }, [editData]);

  // ─── Filtered employee list for Checker (exclude self and CC) ────────
  const filteredCheckerEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(search.toLowerCase()) &&
      emp._id !== currentUser?._id &&
      !selectedChecker.some((c) => c._id === emp._id) &&
      !selectedCc.some((cc) => cc._id === emp._id)
  );

  // ─── Filtered employee list for CC (exclude self and Checker) ────────
  const filteredCcEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchCc.toLowerCase()) &&
      emp._id !== currentUser?._id &&
      !selectedChecker.some((c) => c._id === emp._id) &&
      !selectedCc.some((cc) => cc._id === emp._id)
  );

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const formatToNumberedPoints = (text) => {
    if (!text || !text.trim()) return "• ";
    const rawLines = text.split("\n");
    const cleaned = rawLines
      .map((line) => line.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim())
      .filter(Boolean);

    if (cleaned.length === 0) return "• ";
    return cleaned.map((line) => `• ${line}`).join("\n");
  };

  const removeNumberedPoints = (text) => {
    if (!text) return "";
    return text
      .split("\n")
      .map((line) => line.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim())
      .filter(Boolean)
      .join("\n");
  };

  const handleTogglePointByPoint = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsPointByPoint((prevMode) => {
      const nextMode = !prevMode;
      const currentDesc = formData.description || "";
      if (nextMode) {
        setFormData((prev) => ({
          ...prev,
          description: formatToNumberedPoints(currentDesc),
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          description: removeNumberedPoints(currentDesc),
        }));
      }
      return nextMode;
    });
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
          setFormData((prev) => ({ ...prev, description: newText }));
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
          return;
        }

        const insertion = "\n• ";
        const newText = textBeforeCursor + insertion + textAfterCursor;
        const newCursorPos = selectionStart + insertion.length;

        setFormData((prev) => ({ ...prev, description: newText }));
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        }, 0);
      } else {
        const insertion = "\n• ";
        const newText = textBeforeCursor + insertion + textAfterCursor;
        const newCursorPos = selectionStart + insertion.length;

        setFormData((prev) => ({ ...prev, description: newText }));
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
      .split("\n")
      .map((l) => l.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim())
      .filter(Boolean);

    const formattedPaste = pastedLines
      .map((line) => `• ${line}`)
      .join("\n");

    const newText = textBefore + formattedPaste + textAfter;
    setFormData((prev) => ({ ...prev, description: newText }));
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = (textBefore + formattedPaste).length;
    }, 0);
  };

  const handleRequestDataChange = (e) =>
    setRequestData({ ...requestData, [e.target.name]: e.target.value });

  const selectChecker = (emp) => {
    setSelectedChecker((prev) => [...prev, emp]);
    setSearch("");
  };

  const selectCc = (emp) => {
    setSelectedCc((prev) => [...prev, emp]);
    setSearchCc("");
  };

  // ─── Active conditional fields based on requestType ─────────────────
  const activeFields = REQUEST_TYPE_FIELDS[formData.requestType] || [];

  // ─── Validate & Submit ────────────────────────────────────────────────
  const createRequest = async () => {
    // ── Required base fields ──────────────────────────────────────────
    if (!formData.title.trim()) {
      toast.error("Request Title is required"); return;
    }
    if (!formData.dueDate) {
      toast.error("Due Date is required"); return;
    }
    if (formData.dueDate < todayStr) {
      toast.error("Due Date cannot be in the past"); return;
    }
    if (!formData.description.trim()) {
      toast.error("Description is required"); return;
    }
    if (!selectedChecker || selectedChecker.length === 0) {
      toast.error("Approver Selection is required"); return;
    }
    if (!formData.requestType) {
      toast.error("Request Type is required"); return;
    }

    // ── Required sub-fields per Request Type ──────────────────────────
    if (formData.requestType === "CODE") {
      if (!requestData.repo.trim()) {
        toast.error("Repository is required for CODE requests"); return;
      }
      if (!requestData.branch.trim()) {
        toast.error("Branch is required for CODE requests"); return;
      }
      if (!requestData.commitId.trim()) {
        toast.error("Commit ID is required for CODE requests"); return;
      }
    }

    if (formData.requestType === "GIT") {
      if (!requestData.repo.trim()) {
        toast.error("Repository is required for GIT requests"); return;
      }
      if (!requestData.branch.trim()) {
        toast.error("Branch is required for GIT requests"); return;
      }
    }

    if (formData.requestType === "SERVER") {
      if (!requestData.serverName.trim()) {
        toast.error("Server Name is required for SERVER requests"); return;
      }
    }

    if (formData.requestType === "AWS") {
      if (!requestData.environment.trim()) {
        toast.error("Environment is required for AWS requests"); return;
      }
      if (!requestData.awsCategory.trim()) {
        toast.error("Category is required for AWS requests"); return;
      }
    }

    if (formData.requestType === "MONGODB") {
      if (!requestData.dbName.trim()) {
        toast.error("Database Name is required for MONGODB requests"); return;
      }
    }

    if (formData.requestType === "OTHER") {
      if (!requestData.customType.trim()) {
        toast.error("Custom Request Type is required"); return;
      }
    }

    setLoading(true);
    try {
      // Build requestData payload — only include fields for this type
      const filteredRequestData = {};
      activeFields.forEach((field) => {
        if (requestData[field]) filteredRequestData[field] = requestData[field];
      });

      const formDataPayload = new FormData();
      formDataPayload.append("title", formData.title.trim());
      formDataPayload.append("description", formData.description.trim());
      formDataPayload.append("requestType", formData.requestType);
      formDataPayload.append("checkerId", JSON.stringify(selectedChecker.map((c) => c._id)));
      formDataPayload.append("ccId", JSON.stringify(selectedCc.map((cc) => cc._id)));
      formDataPayload.append("dueDate", formData.dueDate);
      formDataPayload.append("requestData", JSON.stringify(filteredRequestData));
      if (editData) {
        formDataPayload.append("existingFiles", JSON.stringify(existingFiles));
      }

      if (files && files.length > 0) {
        files.forEach((file) => {
          formDataPayload.append("files", file);
        });
      }

      // ★ CHANGED API endpoint
      let res;
      if (editData) {
        res = await portalInstance.put(`/security/request/${editData._id}`, formDataPayload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await portalInstance.post("/security/request", formDataPayload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      if (res.status === 200 || res.status === 201) {
        const ticketId = res.data.data?.ticketId;

        toast.success(editData ? "Request updated successfully!" : `Request created! Ticket ID: ${ticketId}`);

        setTimeout(() => {
          if (onClose) onClose();
        }, 1500);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create request";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── UI ──────────────────────────────────────────────────────────────
  return (
    <div className="security-maker-assign-task-page">
      <div className="security-maker-assign-task-container">
        {/* Header */}
        <div className="security-maker-task-header modal-header border-0 pb-0 d-flex justify-content-between align-items-center">
          <h4 className="common-modal-title">{editData ? "Edit Security Request" : "Create Security Request"}</h4>
          <button className="common-modal-close-x" onClick={onClose}>✕</button>
        </div>

        <div className="security-maker-task-body">
          {/* ── LEFT PANEL: Select Checker ─────────────────────────────── */}
          {/* ── LEFT PANEL: REMOVED ─────────────────────────────── */}

          {/* ── RIGHT FORM ─────────────────────────────────────────────── */}
          <div className="security-maker-task-form">

            {/* Title Row */}
            <div className="form-row">
              <div className="security-maker-form-group title-field" style={{ width: "100%" }}>
                <label>Request Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter request title..."
                />
              </div>
            </div>

            {/* Description */}
            <div className="security-maker-form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label >Description *</label>
                <div
                  onClick={handleTogglePointByPoint}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "12px",
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
                    name="stateAssignPointByPoint"
                    checked={isPointByPoint}
                    readOnly
                    tabIndex={-1}
                    style={{
                      cursor: "pointer",
                      accentColor: "#5977f8",
                      width: "13px",
                      height: "13px",
                      margin: 0,
                      pointerEvents: "none"
                    }}
                  />
                  <span>Point by Point</span>
                </div>
              </div>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                onKeyDown={handleDescriptionKeyDown}
                onPaste={handleDescriptionPaste}
                placeholder={isPointByPoint ? "• Enter first point..." : "Describe this request..."}
                style={{ minHeight: "90px" }}
              />
            </div>

            {/* ── DUE DATE, APPROVER & CC SELECTION ──────────────────── */}
            <div className="form-row" style={{ gap: "24px", alignItems: "flex-start" }}>

              {/* Left Column: Due Date */}
              <div className="security-maker-form-group date-field security-maker-form-group--flex">
                <label style={{ marginTop: 0 }}>Due Date *</label>
                <div className="security-maker-due-date-wrapper">
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleChange}
                    min={todayStr}
                  />
                  <img
                    src="/Calander.svg"
                    alt="calendar"
                    className="security-maker-calendar-icon"
                  />
                </div>
              </div>

              {/* Center Column: Approver Selection */}
              <div className="security-maker-form-group security-maker-form-group--flex" style={{ position: "relative" }}>
                <label style={{ marginTop: 0 }}>Approver Selection *</label>
                <div
                  onClick={() => {
                    setShowApproverList(!showApproverList);
                    setShowCcList(false);
                    setShowRequestTypeList(false);
                  }}
                  className={`security-dropdown-trigger-input ${showApproverList ? "active" : ""}`}
                >
                  <span style={{ color: selectedChecker.length > 0 ? "#334155" : "#A29CC1" }}>
                    {selectedChecker.length > 0 ? `${selectedChecker.length} Selected` : "Select Approver"}
                  </span>
                  <img src="/Down Arrow.svg" alt="arrow" className="security-maker-trigger-arrow" />
                </div>

                {selectedChecker.length > 0 && (
                  <div className="security-maker-selected-grid">
                    {selectedChecker.map((checker) => (
                      <div className="security-selected-approver-card security-selected-approver-card--compact" key={checker._id}>
                        <img
                          src={checker?.avatar || DEFAULT_AVATAR}
                          alt="approver"
                          className="security-maker-card-avatar"
                          onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                        />
                        <div className="security-maker-card-text">
                          <p className="security-maker-card-name" title={checker.name}>{checker.name}</p>
                          <p className="security-maker-card-role" title={checker.role?.toLowerCase() === "admin" ? checker.role : (checker.designation || "Employee")}>
                            {checker.role?.toLowerCase() === "admin"
                              ? checker.role
                              : (checker.designation || "Employee")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedChecker(selectedChecker.filter(c => c._id !== checker._id)); }}
                          className="security-maker-card-remove-btn"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showApproverList && (
                  <div className="security-maker-members-list-container security-maker-dropdown-list-container mt-2">
                    <div className="security-maker-members-list security-maker-dropdown-list-inner">
                      <div className="security-dropdown-search-wrapper security-dropdown-search-wrapper--inner">
                        <input
                          type="text"
                          placeholder="Search members..."
                          className="security-dropdown-search-input security-dropdown-search-inner-input"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowApproverList(false)}
                          className="security-dropdown-close-btn"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="security-dropdown-members-list">
                        {filteredCheckerEmployees.map((emp) => (
                          <div className="security-dropdown-member-row security-dropdown-member-row--styled" key={emp._id}
                            onClick={() => selectChecker(emp)}>
                            <div className="security-dropdown-member-info">
                              <img
                                src={emp?.avatar || DEFAULT_AVATAR} alt={emp.name}
                                className="security-dropdown-member-avatar"
                                onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                              />
                              <div>
                                <p className="security-dropdown-member-name">{emp.name}</p>
                                <p className="security-dropdown-member-role">
                                  {emp.role?.toLowerCase() === "admin"
                                    ? emp.role
                                    : (emp.designation || "Employee")}
                                </p>
                              </div>
                            </div>
                            <span className="security-dropdown-member-plus">+</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Center Column: CC Selection */}
              <div className="security-maker-form-group security-maker-form-group--flex" style={{ position: "relative" }}>
                <label style={{ marginTop: 0 }}>CC Selection</label>
                <div
                  onClick={() => {
                    setShowCcList(!showCcList);
                    setShowApproverList(false);
                    setShowRequestTypeList(false);
                  }}
                  className={`security-dropdown-trigger-input ${showCcList ? "active" : ""}`}
                >
                  <span style={{ color: selectedCc.length > 0 ? "#334155" : "#A29CC1" }}>
                    {selectedCc.length > 0 ? `${selectedCc.length} Selected` : "Select CC Employee"}
                  </span>
                  <img src="/Down Arrow.svg" alt="arrow" className="security-maker-trigger-arrow" />
                </div>

                {selectedCc.length > 0 && (
                  <div className="security-maker-selected-grid">
                    {selectedCc.map((cc) => (
                      <div className="security-selected-approver-card security-selected-approver-card--compact" key={cc._id}>
                        <img
                          src={cc?.avatar || DEFAULT_AVATAR}
                          alt="cc"
                          className="security-maker-card-avatar"
                          onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                        />
                        <div className="security-maker-card-text">
                          <p className="security-maker-card-name" title={cc.name}>{cc.name}</p>
                          <p className="security-maker-card-role" title={cc.role?.toLowerCase() === "admin" ? cc.role : (cc.designation || "Employee")}>
                            {cc.role?.toLowerCase() === "admin"
                              ? cc.role
                              : (cc.designation || "Employee")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedCc(selectedCc.filter(c => c._id !== cc._id)); }}
                          className="security-maker-card-remove-btn"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showCcList && (
                  <div className="security-maker-members-list-container security-maker-dropdown-list-container mt-2">
                    <div className="security-maker-members-list security-maker-dropdown-list-inner">
                      <div className="security-dropdown-search-wrapper security-dropdown-search-wrapper--inner">
                        <input
                          type="text"
                          placeholder="Search members..."
                          className="security-dropdown-search-input security-dropdown-search-inner-input"
                          value={searchCc}
                          onChange={(e) => setSearchCc(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowCcList(false)}
                          className="security-dropdown-close-btn"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="security-dropdown-members-list">
                        {filteredCcEmployees.map((emp) => (
                          <div className="security-dropdown-member-row security-dropdown-member-row--styled" key={emp._id}
                            onClick={() => selectCc(emp)}>
                            <div className="security-dropdown-member-info">
                              <img
                                src={emp?.avatar || DEFAULT_AVATAR} alt={emp.name}
                                className="security-dropdown-member-avatar"
                                onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                              />
                              <div>
                                <p className="security-dropdown-member-name">{emp.name}</p>
                                <p className="security-dropdown-member-role">
                                  {emp.role?.toLowerCase() === "admin"
                                    ? emp.role
                                    : (emp.designation || "Employee")}
                                </p>
                              </div>
                            </div>
                            <span className="security-dropdown-member-plus">+</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* ── REQUEST TYPE & UPLOAD FILES ROW ────────────────────────── */}
            <div className="form-row" style={{ gap: "24px", marginTop: "12px", alignItems: "flex-start" }}>

              {/* Left Column: Request Type */}
              <div className="security-maker-form-group security-maker-form-group--flex" style={{ position: "relative" }}>
                <label style={{ marginTop: 0 }}>Request Type *</label>
                <CustomDropdown
                  options={[
                    { value: "CODE", label: "CODE" },
                    { value: "GIT", label: "GIT" },
                    { value: "SERVER", label: "SERVER" },
                    { value: "AWS", label: "AWS" },
                    { value: "MONGODB", label: "MONGODB" },
                    { value: "OTHER", label: "OTHER" },
                  ]}
                  value={formData.requestType}
                  onChange={(val) => setFormData({ ...formData, requestType: val })}
                  placeholder="Select Type"
                  className="security-maker-customDropdown-field"
                  isOpen={showRequestTypeList}
                  onToggle={(val) => {
                    setShowRequestTypeList(val);
                    if (val) {
                      setShowApproverList(false);
                      setShowCcList(false);
                    }
                  }}
                />
              </div>

              {/* Right Column: Upload Files */}
              <div className="security-maker-form-group security-maker-form-group--flex">
                <label style={{ marginTop: 0, marginBottom: "6px" }}>Upload Files (Optional)</label>
                <div className="security-file-input-wrapper">
                  <Icon icon="material-symbols:attach-file" width="18" color="#64748b" />
                  <span className="security-file-count" style={{ color: files.length > 0 ? "#334155" : "#A29CC1" }}>
                    {files.length > 0 ? `${files.length} file(s) selected` : "Select files..."}
                  </span>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setFiles([...files, ...Array.from(e.target.files)])}
                  />
                </div>

                {/* Existing Files List */}
                {existingFiles.length > 0 && (
                  <div className="security-uploaded-files-list" style={{ marginTop: "8px", display: "flex", flexFlow: "row wrap", gap: "8px", width: "100%" }}>
                    {existingFiles.map((file, idx) => (
                      <div key={idx} className="security-uploaded-file-item" style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f1f5f9", padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "fit-content", maxWidth: "100%" }}>
                        <Icon icon="material-symbols:attach-file" width="14" color="#64748b" />
                        <span style={{ fontSize: "12px", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "150px" }} title={file.originalName}>
                          {file.originalName}
                        </span>
                        {(file.size || file.fileSize) && (
                          <span style={{ fontSize: "10px", color: "#64748b" }}>
                            ({formatFileSize(file.size || file.fileSize)})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setExistingFiles(existingFiles.filter((_, i) => i !== idx))}
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px", fontWeight: "600", padding: "0 4px" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Uploaded Files List in Row format */}
                {files.length > 0 && (
                  <div className="security-uploaded-files-list" style={{ marginTop: "8px", display: "flex", flexFlow: "row wrap", gap: "8px", width: "100%" }}>
                    {files.map((file, idx) => (
                      <div key={idx} className="security-uploaded-file-item" style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "6px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", width: "fit-content", maxWidth: "100%" }}>
                        <span style={{ fontSize: "12px", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "150px" }}>
                          {file.name}
                        </span>
                        {file.size && (
                          <span style={{ fontSize: "10px", color: "#64748b" }}>
                            ({formatFileSize(file.size)})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px", fontWeight: "600", padding: "0 4px" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* ★ Conditional Fields based on requestType */}
            {formData.requestType && (
              <div className="security-maker-conditional-box">
                <p className="security-maker-conditional-heading">
                  {formData.requestType} Request Details
                </p>

                {/* CODE fields */}
                {formData.requestType === "CODE" && (
                  <>
                    <div className="security-maker-form-group">
                      <label>Repository *</label>
                      <input
                        type="text" name="repo"
                        value={requestData.repo}
                        onChange={handleRequestDataChange}
                        placeholder="e.g. org/repo-name"
                      />
                    </div>
                    <div className="form-row">
                      <div className="security-maker-form-group security-maker-form-group--flex">
                        <label>Branch *</label>
                        <input
                          type="text" name="branch"
                          value={requestData.branch}
                          onChange={handleRequestDataChange}
                          placeholder="e.g. feature/login"
                        />
                      </div>
                      <div className="security-maker-form-group security-maker-form-group--flex">
                        <label>Commit ID *</label>
                        <input
                          type="text" name="commitId"
                          value={requestData.commitId}
                          onChange={handleRequestDataChange}
                          placeholder="e.g. a1b2c3d"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* GIT fields */}
                {formData.requestType === "GIT" && (() => {
                  const reqByOptions = [
                    { value: "Development Team", label: "Development Team" },
                    { value: "Security Team", label: "Security Team" },
                    { value: "Operation Team", label: "Operation Team" },
                    { value: "Add New...", label: "+ Add New..." }
                  ];
                  if (requestData.requestedBy && !reqByOptions.find(o => o.value === requestData.requestedBy)) {
                    reqByOptions.splice(3, 0, { value: requestData.requestedBy, label: requestData.requestedBy });
                  }

                  return (
                    <>
                      <div className="form-row">
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Repository *</label>
                          <input
                            type="text" name="repo"
                            value={requestData.repo}
                            onChange={handleRequestDataChange}
                            placeholder="e.g. org/repo-name"
                          />
                        </div>
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Branch *</label>
                          <input
                            type="text" name="branch"
                            value={requestData.branch}
                            onChange={handleRequestDataChange}
                            placeholder="e.g. main"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Commit ID</label>
                          <input
                            type="text" name="commitId"
                            value={requestData.commitId}
                            onChange={handleRequestDataChange}
                            placeholder="e.g. a1b2c3d"
                          />
                        </div>
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Category</label>
                          <input
                            type="text" name="category"
                            value={requestData.category}
                            onChange={handleRequestDataChange}
                            placeholder="e.g. Bugfix, Feature"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Change Type</label>
                          <CustomDropdown
                            options={[
                              { value: "Normal", label: "Normal" },
                              { value: "Standard", label: "Standard" },
                              { value: "Emergency", label: "Emergency" }
                            ]}
                            value={requestData.changeType}
                            onChange={(val) => setRequestData({ ...requestData, changeType: val })}
                            placeholder="Select Type"
                          />
                        </div>
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Requested By</label>
                          <CustomDropdown
                            options={reqByOptions}
                            value={requestData.requestedBy}
                            onChange={(val) => {
                              if (val === "Add New...") {
                                setPromptConfig({ isOpen: true, title: "Enter new Requested By team:", field: "requestedBy", value: "" });
                              } else {
                                setRequestData({ ...requestData, requestedBy: val });
                              }
                            }}
                            placeholder="Select Team"
                          />
                        </div>
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Risk Level</label>
                          <CustomDropdown
                            options={[
                              { value: "Low", label: "Low" },
                              { value: "Medium", label: "Medium" },
                              { value: "High", label: "High" }
                            ]}
                            value={requestData.riskLevel}
                            onChange={(val) => setRequestData({ ...requestData, riskLevel: val })}
                            placeholder="Select Risk"
                          />
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* SERVER fields */}
                {formData.requestType === "SERVER" && (
                  <div className="security-maker-form-group">
                    <label>Server Name *</label>
                    <input
                      type="text" name="serverName"
                      value={requestData.serverName}
                      onChange={handleRequestDataChange}
                      placeholder="e.g. prod-server-01"
                    />
                  </div>
                )}

                {/* OTHER — description already in base form */}
                {formData.requestType === "OTHER" && (
                  <div className="security-maker-form-group">
                    <label>Custom Request Type *</label>
                    <input
                      type="text"
                      name="customType"
                      value={requestData.customType}
                      onChange={handleRequestDataChange}
                      placeholder="Type custom request"
                    />
                  </div>
                )}

                {/* AWS fields */}
                {formData.requestType === "AWS" && (() => {
                  const awsCatOptions = [
                    { value: "Security Infrastructure", label: "Security Infrastructure" },
                    { value: "Deployment", label: "Deployment" },
                    { value: "Monitoring", label: "Monitoring" },
                    { value: "Add Category...", label: "+ Add Category..." }
                  ];
                  if (requestData.awsCategory && !awsCatOptions.find(o => o.value === requestData.awsCategory)) {
                    awsCatOptions.splice(3, 0, { value: requestData.awsCategory, label: requestData.awsCategory });
                  }

                  const awsTypeOptions = [
                    { value: "Deployment", label: "Deployment" },
                    { value: "Implementation", label: "Implementation" },
                    { value: "Hardening", label: "Hardening" },
                    { value: "Add Type...", label: "+ Add Type..." }
                  ];
                  if (requestData.awsType && !awsTypeOptions.find(o => o.value === requestData.awsType)) {
                    awsTypeOptions.splice(3, 0, { value: requestData.awsType, label: requestData.awsType });
                  }

                  return (
                    <>
                      <div className="security-maker-form-group">
                        <label>Platform / Service</label>
                        <input
                          type="text"
                          name="platformService"
                          value={requestData.platformService}
                          onChange={handleRequestDataChange}
                          placeholder="e.g. EC2, S3, RDS"
                        />
                      </div>
                      <div className="form-row">
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Environment</label>
                          <CustomDropdown
                            options={[
                              { value: "Production", label: "Production" },
                              { value: "UAT", label: "UAT" }
                            ]}
                            value={requestData.environment}
                            onChange={(val) => setRequestData({ ...requestData, environment: val })}
                            placeholder="Select Environment"
                          />
                        </div>
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Category</label>
                          <CustomDropdown
                            options={awsCatOptions}
                            value={requestData.awsCategory}
                            onChange={(val) => {
                              if (val === "Add Category...") {
                                setPromptConfig({ isOpen: true, title: "Enter new Category:", field: "awsCategory", value: "" });
                              } else {
                                setRequestData({ ...requestData, awsCategory: val });
                              }
                            }}
                            placeholder="Select Category"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Type</label>
                          <CustomDropdown
                            options={awsTypeOptions}
                            value={requestData.awsType}
                            onChange={(val) => {
                              if (val === "Add Type...") {
                                setPromptConfig({ isOpen: true, title: "Enter new Type:", field: "awsType", value: "" });
                              } else {
                                setRequestData({ ...requestData, awsType: val });
                              }
                            }}
                            placeholder="Select Type"
                          />
                        </div>
                        <div className="security-maker-form-group" style={{ flex: 1 }}>
                          <label>Risk Level</label>
                          <CustomDropdown
                            options={[
                              { value: "Low", label: "Low" },
                              { value: "Medium", label: "Medium" },
                              { value: "High", label: "High" }
                            ]}
                            value={requestData.awsRiskLevel}
                            onChange={(val) => setRequestData({ ...requestData, awsRiskLevel: val })}
                            placeholder="Select Risk"
                          />
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* MongoDB fields */}
                {formData.requestType === "MONGODB" && (
                  <div className="security-maker-form-group">
                    <label>Database Name *</label>
                    <input
                      type="text"
                      name="dbName"
                      value={requestData.dbName}
                      onChange={handleRequestDataChange}
                      placeholder="e.g. production-db"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="modal-footer security-maker-modal-footer">
              <button className="common-modal-btn btn-small-cancel" type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="common-modal-btn btn-update" type="button" onClick={createRequest} disabled={loading}>
                {loading ? "Submitting..." : editData ? "Update Request" : "Submit"}
              </button>
            </div>
          </div>{/* end security-maker-task-form */}
        </div>{/* end security-maker-task-body */}
      </div>{/* end security-maker-assign-task-container */}

      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      {/* Custom Prompt Modal */}
      {promptConfig.isOpen && (
        <div className="security-maker-custom-prompt-overlay">
          <div className="security-maker-custom-prompt-modal">
            <h4 className="security-maker-prompt-heading">{promptConfig.title}</h4>
            <input
              type="text"
              autoFocus
              value={promptConfig.value}
              onChange={(e) => setPromptConfig({ ...promptConfig, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePromptSubmit();
                if (e.key === 'Escape') handlePromptCancel();
              }}
              className="security-maker-prompt-input"
              placeholder="Type your option here..."
            />
            <div className="security-maker-prompt-buttons">
              <button
                onClick={handlePromptCancel}
                className="security-maker-prompt-btn-cancel">
                Cancel
              </button>
              <button
                onClick={handlePromptSubmit}
                className="security-maker-prompt-btn-ok">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StateAssign;
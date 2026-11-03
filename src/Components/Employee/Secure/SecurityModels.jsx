// SecurityModels.jsx — with full timestamps for Maker, Checker, Executor
import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./Security.css";
import { jwtDecode } from "jwt-decode";
import { portalInstance } from "../../../Services/instance";
import { ToastContainer, toast } from "react-toastify";
import { Icon } from "@iconify/react";
import AssignTask from "./StateAssign";

// ─── Badge styles ─────────────────────────────────────────────────────────
const STATUS_STYLE = {
  PENDING_APPROVAL: { background: "#FFF3CD", color: "#856404" },
  APPROVED:         { background: "#D1FAE5", color: "#065F46" },
  REJECTED:         { background: "#FFE4E4", color: "#B91C1C" },
};


const TYPE_STYLE = {
  CODE:   { background: "#EDE9FE", color: "#6D28D9" },
  GIT:    { background: "#FEF3C7", color: "#D97706" },
  SERVER: { background: "#DBEAFE", color: "#2563EB" },
  OTHER:  { background: "#F3F4F6", color: "#374151" },
};

const LOG_ACTION_STYLE = {
  CREATED:  "#5977f8",
  APPROVED: "#059669",
  REJECTED: "#DC2626",
  EDITED:   "#2563EB",
};

// ─── Format: 03-02-2025 | 4:34 PM ────────────────────────────────────────
const formatDateTime = (d) => {
  if (!d) return "N/A";
  const dt = new Date(d);
  if (isNaN(dt)) return "N/A";
  const date = dt.toLocaleDateString("en-GB").replace(/\//g, "-");
  const time = dt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} | ${time}`;
};

// ─── Format date only: 03 Feb 2025 ───────────────────────────────────────
const formatDate = (d) => {
  if (!d) return "N/A";
  const dt = new Date(d);
  if (isNaN(dt)) return "N/A";
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ─── Format file size: 1.2 MB / 450 KB ────────────────────────────────────
const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes) || Number(bytes) <= 0) return "";
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// ─── Extract a specific log entry by action ───────────────────────────────
// Returns the LAST matching log for that action
const getLogByAction = (logs = [], action) => {
  return [...logs].reverse().find((l) => l.action === action) || null;
};

// ─── Render Description Point-by-Point ────────────────────────────────────
const renderDescription = (desc) => {
  if (!desc || !desc.trim()) return null;

  const rawLines = desc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const lines = [];
  rawLines.forEach(l => {
    if ((l.match(/•/g) || []).length > 1) {
      const sub = l.split(/(?=(?:^|\s+)•\s+)/).map(s => s.trim()).filter(Boolean);
      lines.push(...sub);
    } else if (/(?:^|\s+)\d+[\.\)]\s+/.test(l) && (l.match(/\d+[\.\)]/g) || []).length > 1) {
      const sub = l.split(/(?=(?:^|\s+)\d+[\.\)]\s+)/).map(s => s.trim()).filter(Boolean);
      lines.push(...sub);
    } else {
      lines.push(l);
    }
  });

  if (lines.length > 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left", width: "100%" }}>
        {lines.map((line, i) => (
          <div key={i} style={{ lineHeight: "1.5", wordBreak: "break-word", whiteSpace: "pre-line" }}>
            {line}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ whiteSpace: "pre-line", wordBreak: "break-word", lineHeight: "1.5", textAlign: "left" }}>
      {desc}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_AVATAR = "/avatar.png";

const SecurityModels = ({ requestId, onClose, onEdit }) => {
  const [request, setRequest]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [rejectRemark, setRejectRemark]   = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showEditForm, setShowEditForm]     = useState(false);

  // ─── Auth ──────────────────────────────────────────────────────────────
  const sessionData = sessionStorage.getItem("Erti-Portal");
  const token = sessionData ? JSON.parse(sessionData)?.token : "";

  const currentUserId = useMemo(() => {
    if (!token) return null;
    try {
      const decoded = jwtDecode(token);
      return decoded?.id || decoded?._id || decoded?.userId || null;
    } catch {
      return null;
    }
  }, [token]);

  const [timeLeft, setTimeLeft] = useState(180);

  // ─── Fetch request ─────────────────────────────────────────────────────
  const fetchRequest = useCallback(async () => {
    if (!requestId) return;
    try {
      setLoading(true);
      const res = await portalInstance.get(`/security/request/${requestId}`);
      setRequest(res.data.data);
    } catch (err) {
      setError("Failed to load request details.");
      toast.error("Failed to load request details.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { fetchRequest(); }, [fetchRequest]);

  // ─── Countdown Timer for File Links ────────────────────────────────────
  useEffect(() => {
    if (!request?.files?.length) return;
    
    setTimeLeft(180); // 3 minutes
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [request]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Permission flags ──────────────────────────────────────────────────
  const isChecker = Boolean(currentUserId) && request?.checkerId && (
    Array.isArray(request.checkerId)
      ? request.checkerId.some(c => String(c?._id || c) === String(currentUserId))
      : String(request.checkerId?._id || request.checkerId) === String(currentUserId)
  );

  const currentApprover = request?.approvers?.find(
    a => String(a.employee?._id || a.employee) === String(currentUserId)
  );
  const hasNotProcessed = currentApprover ? currentApprover.status === "PENDING" : true;

  const canApproveReject = isChecker && request?.status === "PENDING_APPROVAL" && hasNotProcessed;

  const makerId = request?.makerId?._id || request?.makerId;
  const isMaker = Boolean(currentUserId) && Boolean(makerId) &&
    String(currentUserId) === String(makerId);

  const canEdit = isMaker && request?.status === "PENDING_APPROVAL";

  // ─── Extract timestamps from logs ─────────────────────────────────────
  const createdLog  = getLogByAction(request?.logs, "CREATED");
  const approvedLog = getLogByAction(request?.logs, "APPROVED");
  const rejectedLog = getLogByAction(request?.logs, "REJECTED");

  // ─── Actions ───────────────────────────────────────────────────────────
  const handleApprove = async () => {
    try {
      setActionLoading("approve");
      await portalInstance.post(`/security/approve/${requestId}`);
      toast.success("Request approved successfully!");
      fetchRequest();
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed");
    } finally {
      setActionLoading("");
    }
  };

  const handleReject = async () => {
    if (!rejectRemark.trim()) {
      toast.error("Please provide a rejection remark"); return;
    }
    try {
      setActionLoading("reject");
      await portalInstance.post(`/security/reject/${requestId}`, { remark: rejectRemark });
      toast.success("Request rejected.");
      setShowRejectInput(false);
      fetchRequest();
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejection failed");
    } finally {
      setActionLoading("");
    }
  };



  // ─── Badge helpers ─────────────────────────────────────────────────────
  const StatusBadge = ({ s }) => {
    const style = STATUS_STYLE[s] || { background: "#F3F4F6", color: "#374151" };
    return (
      <span style={{
        ...style, padding: "3px 10px", borderRadius: "5px",
        fontSize: "11px", fontWeight: 500, display: "inline-block",
      }}>
        {s?.replace(/_/g, " ") || "-"}
      </span>
    );
  };

  const TypeBadge = ({ t }) => {
    const style = TYPE_STYLE[t] || TYPE_STYLE.OTHER;
    return (
      <span style={{
        ...style, padding: "3px 10px", borderRadius: "5px",
        fontSize: "11px", fontWeight: 600, display: "inline-block",
      }}>
        {t || "-"}
      </span>
    );
  };

  // ─── Timestamp row component ───────────────────────────────────────────
  // Shows a label + datetime in a clean pill style
  const TimeRow = ({ label, datetime, color = "#5977f8", show = true }) => {
    if (!show || !datetime) return null;
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        background: "#f8f9ff",
        border: `1px solid ${color}22`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "6px",
        marginBottom: "6px",
        width: "fit-content",
        minWidth: "170px"
      }}>
        <div style={{ flex: 1 }}>
          <span style={{
            fontSize: "9px", color: "#868585",
            fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.3px", display: "block",
            marginBottom: "1px",
          }}>
            {label}
          </span>
          <span style={{ fontSize: "11px", color: "#3A466D", fontWeight: 500 }}>
            {datetime}
          </span>
        </div>
      </div>
    );
  };

  // ─── Request-specific data rendering ─────────────────────────────────
  const renderRequestData = (type, data) => {
    if (!data || Object.keys(data).length === 0) return null;
    const fieldLabels = {
      repo: "Repository", branch: "Branch",
      commitId: "Commit ID", serverName: "Server Name",
    };
    return (
      <div style={{
        background: "#f8f9ff", border: "1px solid #e0e7ff",
        borderRadius: "8px", padding: "16px 24px", marginBottom: "16px",
      }}>
        <p style={{
          fontSize: "10px", color: "#5977f8", fontWeight: 600,
          margin: "0 0 10px", textTransform: "uppercase",
        }}>
          {type} Details
        </p>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {Object.entries(data).map(([key, val]) => (
            <div key={key}>
              <label style={{
                fontSize: "11px", color: "#868585",
                display: "block", marginBottom: "4px",
              }}>
                {fieldLabels[key] || key}
              </label>
              <code style={{
                fontSize: "12px", color: "#3A466D",
                background: "#eef2ff", padding: "2px 8px", borderRadius: "4px",
              }}>
                {val}
              </code>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Logs timeline ────────────────────────────────────────────────────
  const renderLogs = (logs) => {
    if (!logs || logs.length === 0) return (
      <p style={{ fontSize: "12px", color: "#9ca3af" }}>No activity yet.</p>
    );
    return (
      <div style={{ position: "relative", paddingLeft: "20px" }}>
        {logs.map((log, idx) => (
          <div key={idx} style={{
            position: "relative",
            marginBottom: idx === logs.length - 1 ? 0 : "16px",
          }}>
            {idx < logs.length - 1 && (
              <div style={{
                position: "absolute", left: "-13px", top: "18px",
                width: "1px", height: "calc(100% + 4px)", background: "#e5e7eb",
              }} />
            )}
            <div style={{
              position: "absolute", left: "-18px", top: "4px",
              width: "10px", height: "10px", borderRadius: "50%",
              background: LOG_ACTION_STYLE[log.action] || "#6B7280",
              border: "2px solid #fff",
              boxShadow: "0 0 0 2px " + (LOG_ACTION_STYLE[log.action] || "#6B7280") + "33",
            }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <span style={{
                  fontSize: "11px", fontWeight: 600,
                  color: LOG_ACTION_STYLE[log.action] || "#374151",
                }}>
                  {log.action}
                </span>
                {/* ★ TIME shown in log timeline */}
                <span style={{ fontSize: "10px", color: "#9ca3af" }}>
                  {formatDateTime(log.timestamp)}
                </span>
              </div>
              <p style={{ fontSize: "11px", color: "#6b7280", margin: "0 0 2px" }}>
                By: <strong style={{ color: "#3A466D" }}>{log.by?.name || "System"}</strong>
              </p>
              {log.remark && (
                <p style={{
                  fontSize: "11px", color: "#374151",
                  background: "#f9fafb", borderRadius: "4px",
                  padding: "4px 8px", margin: "4px 0 0",
                  border: "1px solid #e5e7eb",
                }}>
                  "{log.remark}"
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────
  return (
    <div className="security-maker-details-overlay">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <div className="security-maker-details-container">
        {loading ? (
          <div className="p-5 text-center">
            <div className="spinner-border text-primary"></div>
            <p className="mt-2">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-5 text-center text-danger">{error}</div>
        ) : request && (
          <>
            {/* ── Header ─────────────────────────────────────────────── */}
              <div className="security-maker-details-header">
                <div className="header-title-group" style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <h2 className="common-modal-title" style={{ margin: 0 }}>Request Details</h2>
                    <span className="header-ticket-id" style={{ margin: 0 }}>
                      Ticket ID: {request.ticketId || "-"}
                    </span>
                  </div>
                  {/* {request.status === "REJECTED" && (
                    <div style={{ fontSize: "12px", color: "#DC2626", marginTop: "6px", fontStyle: "italic" }}>
                      Reason: {request.approvers?.find(a => a.status === "REJECTED")?.remark || getLogByAction(request.logs, "REJECTED")?.remark || ""}
                    </div>
                  )} */}
                </div>
                <button className="common-modal-close-x" onClick={onClose}>✕</button>
              </div>

            {/* ── Body ───────────────────────────────────────────────── */}
            <div className="security-maker-details-body common-modal-body">

              {/* ── LEFT PANEL ─────────────────────────────────────────── */}
              <div className="security-maker-details-assigned-panel">

                {/* Maker */}
                <h6 className="security-maker-details-section-label">Maker</h6>
                <div className="security-maker-details-member-card">
                  <img
                    src={request.makerId?.avatar || DEFAULT_AVATAR}
                    onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                    alt={request.makerId?.name}
                    className="security-maker-details-avatar"
                  />
                  <div className="security-maker-details-member-info">
                    <div className="security-maker-details-member-name">
                      {request.makerId?.name || "-"}
                    </div>
                    <div className="security-maker-details-member-role">
                      {request.makerId?.designation || "Maker"}
                    </div>
                  </div>
                </div>

                {/* ★ MAKER CREATED TIME */}
                <TimeRow
                  label="Request Submitted"
                  datetime={formatDateTime(createdLog?.timestamp || request.createdAt)}
                  color="#5977f8"
                  show={true}
                />

                <div className="security-maker-details-horizontal-divider" />

                {/* Checker / Approver */}
                <h6 className="security-maker-details-section-label">Approver(s)</h6>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {Array.isArray(request.checkerId) ? (
                    request.checkerId.map((checker) => {
                      const isThisChecker = String(currentUserId) === String(checker?._id || checker);
                      const approverData = request?.approvers?.find(a => String(a.employee?._id || a.employee) === String(checker?._id || checker));
                      const status = approverData ? approverData.status : "PENDING";
                      const actionDate = approverData?.actionDate;
                      const remark = approverData?.remark;
                      
                      return (
                        <div className="security-maker-details-member-card" key={checker?._id || checker}>
                          <img
                            src={checker?.avatar || DEFAULT_AVATAR}
                            onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                            alt={checker?.name}
                            className="security-maker-details-avatar"
                          />
                          <div className="security-maker-details-member-info">
                            <div className="security-maker-details-member-name">
                              {checker?.name || "-"}
                            </div>
                            <div
                              className="security-maker-details-member-role"
                              style={{ color: isThisChecker ? "#5977f8" : undefined }}
                            >
                              {isThisChecker ? "You (Approver)" : checker?.designation || "Approver"}
                            </div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>
                              <span style={{ fontWeight: 600, color: status === 'APPROVED' ? '#059669' : status === 'REJECTED' ? '#DC2626' : '#D97706' }}>
                                {status}
                              </span>
                              {actionDate && <span style={{ color: '#64748b' }}> • {new Date(actionDate).toLocaleString()}</span>}
                              {remark && <div style={{ color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>"{remark}"</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    request.checkerId && (() => {
                      const approverData = request?.approvers?.find(a => String(a.employee?._id || a.employee) === String(request.checkerId?._id || request.checkerId));
                      const status = approverData ? approverData.status : (request.status === "APPROVED" || request.status === "REJECTED" ? request.status : "PENDING");
                      const actionDate = approverData?.actionDate;
                      const remark = approverData?.remark;

                      return (
                        <div className="security-maker-details-member-card">
                          <img
                            src={request.checkerId?.avatar || DEFAULT_AVATAR}
                            onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                            alt={request.checkerId?.name}
                            className="security-maker-details-avatar"
                          />
                          <div className="security-maker-details-member-info">
                            <div className="security-maker-details-member-name">
                              {request.checkerId?.name || "-"}
                            </div>
                            <div
                              className="security-maker-details-member-role"
                              style={{ color: isChecker ? "#5977f8" : undefined }}
                            >
                              {isChecker ? "You (Approver)" : request.checkerId?.designation || "Approver"}
                            </div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>
                              <span style={{ fontWeight: 600, color: status === 'APPROVED' ? '#059669' : status === 'REJECTED' ? '#DC2626' : '#D97706' }}>
                                {status}
                              </span>
                              {actionDate && <span style={{ color: '#64748b' }}> • {new Date(actionDate).toLocaleString()}</span>}
                              {remark && <div style={{ color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>"{remark}"</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* ★ CHECKER APPROVED TIME */}
                <TimeRow
                  label="Approved At"
                  datetime={formatDateTime(approvedLog?.timestamp)}
                  color="#059669"
                  show={!!approvedLog}
                />

                {/* ★ CHECKER REJECTED TIME */}
                <TimeRow
                  label="Rejected At"
                  datetime={formatDateTime(rejectedLog?.timestamp)}
                  color="#DC2626"
                  show={!!rejectedLog}
                />

                <div className="security-maker-details-horizontal-divider" />

                {/* CC (Carbon Copy) */}
                {((Array.isArray(request.ccId) && request.ccId.length > 0) || (!Array.isArray(request.ccId) && request.ccId)) && (
                  <>
                    <h6 className="security-maker-details-section-label" style={{ marginTop: "12px" }}>CC (Carbon Copy)</h6>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {Array.isArray(request.ccId) ? (
                        request.ccId.map((cc) => (
                          <div className="security-maker-details-member-card" key={cc?._id || cc}>
                            <img
                              src={cc?.avatar || DEFAULT_AVATAR}
                              onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                              alt={cc?.name}
                              className="security-maker-details-avatar"
                            />
                            <div className="security-maker-details-member-info">
                              <div className="security-maker-details-member-name">
                                {cc?.name || "-"}
                              </div>
                              <div className="security-maker-details-member-role">
                                {cc?.designation || "CC"}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="security-maker-details-member-card">
                          <img
                            src={request.ccId?.avatar || DEFAULT_AVATAR}
                            onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                            alt={request.ccId?.name}
                            className="security-maker-details-avatar"
                          />
                          <div className="security-maker-details-member-info">
                            <div className="security-maker-details-member-name">
                              {request.ccId?.name || "-"}
                            </div>
                            <div className="security-maker-details-member-role">
                              {request.ccId?.designation || "CC"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="security-maker-details-horizontal-divider" style={{ marginTop: "12px" }} />
                  </>
                )}
              </div>

              <div className="security-maker-details-divider" />

              {/* ── RIGHT PANEL ────────────────────────────────────────── */}
              <div className="security-maker-details-info-panel">

                {/* Info Stats */}
                <div className="security-maker-details-info-row">
                  <div className="security-maker-details-info-stat">
                    <label>Request Type</label>
                    <div className="security-maker-details-value">
                      <TypeBadge t={request.requestType} />
                    </div>
                  </div>

                  <div className="security-maker-details-info-stat">
                    <label>Status</label>
                    <div className="security-maker-details-value">
                      <StatusBadge s={request.status} />
                    </div>
                  </div>

                  <div className="security-maker-details-info-stat">
                    <label>Due Date</label>
                    <div
                      className="security-maker-details-value"
                      style={{
                        color: new Date(request.dueDate) < new Date() &&
                          request.status === "PENDING_APPROVAL"
                          ? "#dc2626" : "#3A466D",
                        fontSize: "12px",
                      }}
                    >
                      {formatDate(request.dueDate)}
                      {new Date(request.dueDate) < new Date() &&
                        request.status === "PENDING_APPROVAL" && (
                          <span style={{
                            display: "inline-block", marginLeft: "6px",
                            fontSize: "10px", background: "#FFE4E4",
                            color: "#DC2626", padding: "1px 6px", borderRadius: "4px",
                          }}>
                            OVERDUE
                          </span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="security-maker-details-horizontal-divider" />

                {/* Title + Description */}
                <div className="security-maker-details-content">
                  <h6 className="security-maker-details-section-label" style={{ marginBottom: "6px" }}>Title</h6>
                  <h5 className="security-maker-details-task-title">{request.title}</h5>
                  {request.description && (
                    <div style={{ marginTop: "16px" }}>
                      <h6 className="security-maker-details-section-label" style={{ marginBottom: "6px" }}>Description</h6>
                      <div className="security-maker-details-task-desc">{renderDescription(request.description)}</div>
                    </div>
                  )}

                  {/* Attached Files */}
                  {request.files && request.files.length > 0 && (
                    <div className="security-details-files-section" style={{ marginTop: "15px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <h6 className="security-maker-details-section-label" style={{ fontSize: "11px", margin: 0 }}>Attached Files</h6>
                        <span style={{ fontSize: "11px", color: timeLeft === 0 ? "#dc2626" : "#059669", fontWeight: "600" }}>
                          {timeLeft === 0 ? "Links Expired" : `Links expire in: ${formatTime(timeLeft)}`}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {request.files.map((file, idx) => {
                          const sizeStr = formatFileSize(file.size || file.fileSize);
                          return (
                            <div key={idx} className={`security-file-pill ${timeLeft === 0 ? "expired" : ""}`}>
                              <Icon icon="material-symbols:insert-drive-file-outline" width="18" style={{ flexShrink: 0 }} />
                              <div className="file-meta">
                                <span className="file-name" title={file.originalName}>{file.originalName}</span>
                                {sizeStr && (
                                  <span className="file-size">{sizeStr}</span>
                                )}
                              </div>
                              {timeLeft === 0 ? (
                                <span className="expired-label">Expired</span>
                              ) : (
                                <a 
                                  href={file.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="file-view-link"
                                  title="View file"
                                >
                                  <Icon icon="material-symbols:open-in-new" width="14" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Conditional request data */}
                {renderRequestData(request.requestType, request.requestData)}

                {/* Activity Log Timeline (Moved to Right Side) */}
                <div style={{ marginTop: "24px" }}>
                  <h6 className="security-maker-details-section-label" style={{ marginBottom: "16px" }}>Activity Log</h6>
                  {renderLogs(request.logs)}
                </div>

                {/* Reject remark input */}
                {showRejectInput && (
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{
                      fontSize: "11px", color: "#868585",
                      display: "block", marginBottom: "6px",
                    }}>
                      Rejection Reason *
                    </label>
                    <textarea
                      value={rejectRemark}
                      onChange={(e) => setRejectRemark(e.target.value)}
                      placeholder="Provide reason for rejection..."
                      style={{
                        width: "100%", minHeight: "70px", padding: "8px",
                        border: "1px solid #fca5a5", borderRadius: "6px",
                        fontSize: "12px", color: "#374151",
                        resize: "vertical", boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <button
                        onClick={handleReject}
                        disabled={actionLoading === "reject"}
                        className="common-modal-btn btn-reject"
                      >
                        {actionLoading === "reject" ? "Rejecting..." : "Confirm Reject"}
                      </button>
                      <button
                        className="common-modal-btn btn-small-cancel"
                        onClick={() => { setShowRejectInput(false); setRejectRemark(""); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="security-maker-details-footer">
                  <button className="common-modal-btn btn-small-cancel" onClick={onClose}>
                    Cancel
                  </button>

                  {canApproveReject && !showRejectInput && (
                    <>
                      <button
                        className="common-modal-btn btn-reject"
                        onClick={() => setShowRejectInput(true)}
                        disabled={!!actionLoading}
                      >
                        Reject
                      </button>
                      <button
                        className="common-modal-btn btn-confirm-success"
                        onClick={handleApprove}
                        disabled={actionLoading === "approve"}
                      >
                        {actionLoading === "approve" ? "Approving..." : " Approve"}
                      </button>
                    </>
                  )}

                  {canEdit && (
                    <button
                      className="common-modal-btn btn-update"
                      onClick={() => onEdit && onEdit(requestId)}
                    >
                      ✎ Edit Request
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Edit Form Popup */}
            {showEditForm && (
              <div className="security-maker-popup-backdrop" style={{ zIndex: 99999 }}>
                <div className="security-maker-popup-overlay">
                  <div className="security-maker-popup-container">
                    <AssignTask 
                      editData={request} 
                      onClose={() => { setShowEditForm(false); fetchRequest(); }} 
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .header-title-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      `}</style>
    </div>
  );
};

export default SecurityModels;
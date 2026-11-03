import React, { useEffect, useMemo, useState } from "react";
import { Button, Spinner, Modal, Form } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  FaPaperPlane,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaFileAlt,
  FaArrowDown,
  FaExclamationTriangle,
  FaTrash,
  FaUser,
  FaUsers,
  FaBriefcase,
  FaGraduationCap,
  FaUniversity,
  FaCertificate,
  FaIdCard,
  FaTimes,
  FaChevronLeft,
  FaChevronRight
} from "react-icons/fa";

import { useUser } from "../../UserContext";
import { portalInstance } from "../../../Services/instance";
import { checkProfileRestriction } from "../../../utils/profileCompletionRestriction";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { toast, ToastContainer } from "react-toastify";
import { canHrDeleteDocuments } from "../../../utils/hrAccessHelper";
import "react-toastify/dist/ReactToastify.css";
import "./DetailsView.css";
import "./EditRequest.css";

const REJECTABLE_CATEGORIES = [
  {
    category: "Education Section",
    items: [
      { id: "marksheet10", label: "10th Mark Sheet" },
      { id: "marksheet12", label: "12th Mark Sheet" },
      { id: "degreeCertificate", label: "Degree / Diploma Certificate" },
      { id: "school10", label: "10th School Name" },
      { id: "school12", label: "12th School Name" },
      { id: "marks10", label: "10th Marks / Percentage" },
      { id: "marks12", label: "12th Marks / Percentage" },
      { id: "courses", label: "College / Degree Details" },
    ],
  },
  {
    category: "KYC & Identity Section",
    items: [
      { id: "aadhaarFile", label: "Masked Aadhaar Card" },
      { id: "panFile", label: "PAN Card Document" },
      { id: "picture", label: "Profile Photo" },
      { id: "aadhaarNo", label: "Aadhaar Number" },
      { id: "panNo", label: "PAN Number" },
    ],
  },
  {
    category: "Bank Section",
    items: [
      { id: "passbookFile", label: "Bank Passbook Document" },
      { id: "accountNumber", label: "Bank Account Number" },
      { id: "ifscCode", label: "IFSC Code" },
      { id: "bankName", label: "Bank Name" },
      { id: "branch", label: "Branch Name" },
      { id: "accountHolder", label: "Account Holder Name" },
    ],
  },
  {
    category: "Personal & Contact Section",
    items: [
      { id: "phone", label: "Phone Number" },
      { id: "emergencyContact", label: "Emergency Contact" },
      { id: "address", label: "Residential Address" },
      { id: "dob", label: "Date of Birth" },
      { id: "bloodGroup", label: "Blood Group" },
      { id: "gender", label: "Gender" },
    ],
  },
  {
    category: "Family Section",
    items: [
      { id: "fatherName", label: "Father's Name & Occupation" },
      { id: "motherName", label: "Mother's Name & Occupation" },
      { id: "siblings", label: "Siblings Information" },
    ],
  },
  {
    category: "Work Experience Section",
    items: [
      { id: "previousExperiences", label: "Work Experience Documents & Details" },
    ],
  },
];

const ALL_REJECTABLE_ITEMS = REJECTABLE_CATEGORIES.flatMap((c) => c.items);

const getFieldFriendlyName = (fieldId) => {
  const found = ALL_REJECTABLE_ITEMS.find((it) => it.id === fieldId);
  if (found) return found.label;
  const legacyMap = {
    education: "Education Details",
    bank: "Bank Details",
    personal: "Personal Details",
    family: "Family Details",
    working: "Work Experience",
    work: "Work Details",
    department: "Department",
    designation: "Designation",
    experience: "Experience",
    previousExperiences: "Previous Experience",
    kyc: "KYC Documents",
    pf: "PF Details",
    basic: "Basic Details",
    marksheet10: "10th Mark Sheet",
    certificate10: "10th Mark Sheet",
    marksheet12: "12th Mark Sheet",
    certificate12: "12th Mark Sheet",
    school10: "10th School Name",
    school12: "12th School Name",
    marks10: "10th Marks / Percentage",
    marks12: "12th Marks / Percentage",
    degreeCertificate: "Degree / Diploma Certificate",
    courses: "College / Degree Details",
    aadhaarFile: "Masked Aadhaar Card",
    panFile: "PAN Card Document",
    picture: "Profile Photo",
    passbookFile: "Bank Passbook Document",
  };
  return legacyMap[fieldId] || fieldId;
};

const getFriendlyFieldNames = (fields) => {
  if (!Array.isArray(fields)) return [];
  const seen = new Set();
  const list = [];
  fields.forEach((f) => {
    let canonical = f;
    if (f === "certificate10") canonical = "marksheet10";
    if (f === "certificate12") canonical = "marksheet12";
    if (!seen.has(canonical)) {
      seen.add(canonical);
      list.push(getFieldFriendlyName(canonical));
    }
  });
  return list;
};

const DetailsView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { empId } = useParams();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestedFields, setRequestedFields] = useState([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [editRejectionReason, setEditRejectionReason] = useState("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [canEditProfile, setCanEditProfile] = useState(false);
  const [allowedFields, setAllowedFields] = useState([]);
  const [showApprovalToast, setShowApprovalToast] = useState(false);

  // ── Admin Profile Review States ──
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [rejectionRemark, setRejectionRemark] = useState("");
  const [selectedRejectedFields, setSelectedRejectedFields] = useState([]);
  const [rejectError, setRejectError] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  // Salary History States
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [salaryLoading, setSalaryLoading] = useState(false);

  // Progress states
  const [animatedProgress, setAnimatedProgress] = useState(null);
  const [strokeProgress, setStrokeProgress] = useState(0);

  // ── Document View & Delete Loading States ──
  const { user } = useUser() || {};
  const [docLoadingId, setDocLoadingId] = useState(null);
  const [docDeletingId, setDocDeletingId] = useState(null);
  const [showDeleteDocModal, setShowDeleteDocModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [highlightedField, setHighlightedField] = useState(null);

  // ── In-Page Document Viewer States (2-Minute Expiry) ──
  const [viewerDoc, setViewerDoc] = useState(null);
  const [viewerTimer, setViewerTimer] = useState(120);
  const [showContinueModal, setShowContinueModal] = useState(false);

  // ── Single Document Approve / Reject Review States ──
  const [docReviewLoading, setDocReviewLoading] = useState(false);
  const [docReviewAction, setDocReviewAction] = useState(null);
  const [showRejectDocModal, setShowRejectDocModal] = useState(false);
  const [docRejectRemark, setDocRejectRemark] = useState("");
  const [docRejectError, setDocRejectError] = useState(false);
  const [selectedRejectDocs, setSelectedRejectDocs] = useState([]);

  const storedUser = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("Erti-Portal");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, []);

  const currentUser = user || storedUser;
  const userRole = (currentUser?.role || "").toLowerCase();
  const isHrUser = Boolean(
    currentUser?.isHr === true ||
    currentUser?.isHr === "true" ||
    userRole === "hr"
  );
  const isAdminUser = Boolean(
    (userRole === "admin" || userRole === "superadmin") && !isHrUser
  );
  // Only Admin has access to delete uploaded employee documents unless enabled in Portal Configuration for HR
  const canDeleteFiles = Boolean(isAdminUser || (isHrUser && canHrDeleteDocuments(currentUser)));

  const initiateDeleteDocument = (doc) => {
    if (!canDeleteFiles) {
      toast.error("You are not authorized to delete uploaded documents per Portal Configuration.");
      return;
    }
    setDocToDelete(doc);
    setShowDeleteDocModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    const targetEmpId = empId || employee?.empIdString || employee?.empId || employee?._id;
    if (!targetEmpId) {
      toast.error("Employee ID is missing.");
      return;
    }

    try {
      setDocDeletingId(docToDelete.id);
      const payload = {
        field: docToDelete.field,
        key: docToDelete.key || undefined,
        courseId: docToDelete.courseId || undefined,
        courseIdx: docToDelete.courseIdx != null ? docToDelete.courseIdx : undefined,
        certId: docToDelete.certId || undefined,
        certIdx: docToDelete.certIdx != null ? docToDelete.certIdx : undefined,
      };

      const res = await portalInstance.delete(`/users/employee/document/${targetEmpId}`, {
        data: payload,
      });

      if (res.data?.success) {
        toast.success(res.data.message || "Document deleted successfully from DB and S3.");

        // Locally update employee state so UI immediately shows file as removed without page refresh
        setEmployee((prev) => {
          if (!prev) return prev;
          const updated = { ...prev };

          if (docToDelete.field === "marksheet10") {
            updated.marksheet10 = null;
            updated.marksheet10Url = null;
          } else if (docToDelete.field === "marksheet12") {
            updated.marksheet12 = null;
            updated.marksheet12Url = null;
          } else if (docToDelete.field === "aadhaarFile") {
            updated.aadhaarFile = null;
            updated.aadhaarFileUrl = null;
          } else if (docToDelete.field === "panFile") {
            updated.panFile = null;
            updated.panFileUrl = null;
          } else if (docToDelete.field === "passbookFile") {
            updated.passbookFile = null;
            updated.passbookFileUrl = null;
          } else if (docToDelete.field === "picture") {
            updated.picture = null;
            updated.pictureUrl = null;
            updated.photo = "avatar.png";
          } else if (docToDelete.field === "degreeCertificate") {
            updated.degreeCertificate = null;
            updated.degreeCertificateUrl = null;
          } else if (docToDelete.field === "ugDegreeCertificate") {
            updated.ugDegreeCertificate = null;
            updated.ugDegreeCertificateUrl = null;
          } else if (docToDelete.field === "pgDegreeCertificate") {
            updated.pgDegreeCertificate = null;
            updated.pgDegreeCertificateUrl = null;
          } else if (
            docToDelete.field?.startsWith("courses.") ||
            docToDelete.courseIdx != null ||
            docToDelete.courseId
          ) {
            if (Array.isArray(updated.courses)) {
              updated.courses = updated.courses.map((c, i) => {
                if (
                  (docToDelete.courseId && String(c._id) === String(docToDelete.courseId)) ||
                  i === docToDelete.courseIdx
                ) {
                  return { ...c, certificate: null, certificateUrl: null };
                }
                return c;
              });
            }
          } else if (
            docToDelete.field?.startsWith("professionalCertifications.") ||
            docToDelete.certIdx != null ||
            docToDelete.certId
          ) {
            if (Array.isArray(updated.professionalCertifications)) {
              updated.professionalCertifications = updated.professionalCertifications.map((c, i) => {
                if (
                  (docToDelete.certId && String(c._id) === String(docToDelete.certId)) ||
                  i === docToDelete.certIdx
                ) {
                  return { ...c, certificate: null, certificateUrl: null };
                }
                return c;
              });
            }
          } else if (docToDelete.field && updated[docToDelete.field] !== undefined) {
            updated[docToDelete.field] = null;
          }

          if (res.data.profileCompletion != null) {
            updated.profileCompletion = res.data.profileCompletion;
            if (res.data.profileCompletion < 100) {
              updated.isProfileCompleted = false;
            }
          }

          return updated;
        });

        setShowDeleteDocModal(false);
        setDocToDelete(null);
      } else {
        toast.error(res.data?.message || "Failed to delete document.");
      }
    } catch (err) {
      console.error("Delete document error:", err);
      toast.error(err.response?.data?.message || "Failed to delete document from database and S3.");
    } finally {
      setDocDeletingId(null);
    }
  };

  const handleScrollToRejectedFile = (fieldId) => {
    setHighlightedField(fieldId);

    let target =
      document.getElementById(`doc-card-${fieldId}`) ||
      document.getElementById(`field-item-${fieldId}`) ||
      document.getElementById(`field-wrapper-${fieldId}`);

    if (!target) {
      if (fieldId === "certificate10" || fieldId === "marksheet10") {
        target =
          document.getElementById("doc-card-marksheet10") ||
          document.getElementById("field-item-school10") ||
          document.getElementById("section-education");
      } else if (fieldId === "certificate12" || fieldId === "marksheet12") {
        target =
          document.getElementById("doc-card-marksheet12") ||
          document.getElementById("field-item-school12") ||
          document.getElementById("section-education");
      } else if (fieldId === "degreeCertificate" || fieldId === "courses") {
        target =
          document.getElementById("doc-card-degreeCertificate") ||
          document.getElementById("doc-card-course_0") ||
          document.getElementById("section-courses") ||
          document.getElementById("section-education");
      } else if (
        [
          "school10",
          "school12",
          "marks10",
          "marks12",
          "education",
        ].includes(fieldId)
      ) {
        target =
          document.getElementById(`field-item-${fieldId}`) ||
          document.getElementById("doc-card-marksheet10") ||
          document.getElementById("section-education");
      } else if (
        [
          "passbookFile",
          "accountNumber",
          "ifscCode",
          "bankName",
          "branch",
          "accountHolder",
          "bank",
        ].includes(fieldId)
      ) {
        target =
          document.getElementById("doc-card-passbookFile") ||
          document.getElementById(`field-item-${fieldId}`) ||
          document.getElementById("section-bank");
      } else if (["aadhaarFile", "panFile", "aadhaarNo", "panNo", "kyc"].includes(fieldId)) {
        target =
          document.getElementById(`doc-card-${fieldId}`) ||
          document.getElementById(`field-item-${fieldId}`) ||
          document.getElementById("doc-card-aadhaarFile") ||
          document.getElementById("doc-card-panFile") ||
          document.getElementById("section-documents") ||
          document.getElementById("section-bank");
      } else if (fieldId === "picture") {
        target =
          document.getElementById("doc-card-picture") ||
          document.querySelector(".detailsview-avatar-wrap") ||
          document.querySelector(".detailsview-header-avatar");
      } else if (["phone", "emergencyContact", "address", "dob", "bloodGroup", "gender", "personal"].includes(fieldId)) {
        target =
          document.getElementById(`field-item-${fieldId}`) ||
          document.getElementById("section-personal");
      } else if (["fatherName", "motherName", "siblings", "family"].includes(fieldId)) {
        target =
          document.getElementById(`field-item-${fieldId}`) ||
          document.getElementById("section-family") ||
          document.getElementById("section-siblings");
      } else if (["previousExperiences", "working"].includes(fieldId)) {
        target =
          document.getElementById("section-previousExperiences") ||
          document.getElementById("section-working");
      }
    }

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.remove("rejected-file-highlight-pulse");
      void target.offsetWidth; // force DOM reflow
      target.classList.add("rejected-file-highlight-pulse");
      setTimeout(() => {
        target.classList.remove("rejected-file-highlight-pulse");
      }, 5000);
    }
  };

  const isAdminView = useMemo(
    () => location.pathname.startsWith("/admin"),
    [location.pathname]
  );
  const isEmployeeView = useMemo(
    () => location.pathname.startsWith("/emp"),
    [location.pathname]
  );

  // ── Dynamically prepared uploaded documents list ──
  const uploadedDocuments = useMemo(() => {
    if (!employee) return [];
    const list = [];

    // 1. 10th Marksheet
    const has10 = Boolean(employee.marksheet10 || employee.marksheet10Url);
    list.push({
      id: "marksheet10",
      label: "10th Marksheet",
      field: "marksheet10",
      key: employee.marksheet10 || null,
      url: employee.marksheet10Url || null,
      isUploaded: has10,
      iconType: "education",
    });

    // 2. 12th Marksheet
    const has12 = Boolean(employee.marksheet12 || employee.marksheet12Url);
    const is12thRelevant = employee.educationPath === "12th" || has12 || employee.school12 || employee.marks12;
    if (is12thRelevant) {
      list.push({
        id: "marksheet12",
        label: "12th Marksheet",
        field: "marksheet12",
        key: employee.marksheet12 || null,
        url: employee.marksheet12Url || null,
        isUploaded: has12,
        iconType: "education",
      });
    }

    // 3. Courses / Degree Certificates
    if (Array.isArray(employee.courses) && employee.courses.length > 0) {
      employee.courses.forEach((course, idx) => {
        const hasCert = Boolean(course.certificate || course.certificateUrl);
        const cType = course.courseType || "College";
        const cName = course.courseName ? ` - ${course.courseName}` : (course.collegeName ? ` (${course.collegeName})` : "");
        list.push({
          id: `course_${course._id || course.id || idx}`,
          label: `${cType} Certificate${cName}`,
          field: `courses.${idx}.certificate`,
          key: course.certificate || null,
          url: course.certificateUrl || null,
          isUploaded: hasCert,
          iconType: "college",
          courseId: course._id || null,
          courseIdx: idx,
        });
      });
    }

    // Degree Certificate fallback if present outside courses array and not already included in courses
    const existingCertKeys = new Set(
      list.filter((d) => d.key || d.url).map((d) => d.key || d.url)
    );
    if (
      (employee.degreeCertificate || employee.degreeCertificateUrl) &&
      !existingCertKeys.has(employee.degreeCertificate || employee.degreeCertificateUrl)
    ) {
      list.push({
        id: "degreeCertificate",
        label: "Degree Certificate",
        field: "degreeCertificate",
        key: employee.degreeCertificate || null,
        url: employee.degreeCertificateUrl || null,
        isUploaded: true,
        iconType: "college",
      });
    }
    if (
      (employee.ugDegreeCertificate || employee.ugDegreeCertificateUrl) &&
      !existingCertKeys.has(employee.ugDegreeCertificate || employee.ugDegreeCertificateUrl)
    ) {
      list.push({
        id: "ugDegreeCertificate",
        label: "UG Degree Certificate",
        field: "ugDegreeCertificate",
        key: employee.ugDegreeCertificate || null,
        url: employee.ugDegreeCertificateUrl || null,
        isUploaded: true,
        iconType: "college",
      });
    }
    if (
      (employee.pgDegreeCertificate || employee.pgDegreeCertificateUrl) &&
      !existingCertKeys.has(employee.pgDegreeCertificate || employee.pgDegreeCertificateUrl)
    ) {
      list.push({
        id: "pgDegreeCertificate",
        label: "PG Degree Certificate",
        field: "pgDegreeCertificate",
        key: employee.pgDegreeCertificate || null,
        url: employee.pgDegreeCertificateUrl || null,
        isUploaded: true,
        iconType: "college",
      });
    }

    // 4. Aadhaar Document
    const hasAadhaar = Boolean(employee.aadhaarFile || employee.aadhaarFileUrl);
    list.push({
      id: "aadhaarFile",
      label: "Aadhaar Card Document",
      field: "aadhaarFile",
      key: employee.aadhaarFile || null,
      url: employee.aadhaarFileUrl || null,
      isUploaded: hasAadhaar,
      iconType: "kyc",
    });

    // 5. PAN Document
    const hasPan = Boolean(employee.panFile || employee.panFileUrl);
    list.push({
      id: "panFile",
      label: "PAN Card Document",
      field: "panFile",
      key: employee.panFile || null,
      url: employee.panFileUrl || null,
      isUploaded: hasPan,
      iconType: "kyc",
    });

    // 6. Bank Passbook Document
    const hasPassbook = Boolean(employee.passbookFile || employee.passbookFileUrl);
    list.push({
      id: "passbookFile",
      label: "Bank Passbook Document",
      field: "passbookFile",
      key: employee.passbookFile || null,
      url: employee.passbookFileUrl || null,
      isUploaded: hasPassbook,
      iconType: "bank",
    });

    // 7. Professional Certifications
    if (Array.isArray(employee.professionalCertifications) && employee.professionalCertifications.length > 0) {
      employee.professionalCertifications.forEach((cert, idx) => {
        const hasCert = Boolean(cert.certificate || cert.certificateUrl);
        list.push({
          id: `prof_cert_${idx}`,
          label: `Certificate: ${cert.courseName || "Additional Course"}`,
          field: `professionalCertifications.${idx}.certificate`,
          key: cert.certificate || null,
          url: cert.certificateUrl || cert.certificate || null,
          isUploaded: hasCert,
          iconType: "college",
          certId: cert._id || null,
          certIdx: idx,
        });
      });
    }

    return list;
  }, [employee]);

  // ── Document Navigation in Viewer Sidebar (Must be top-level hook before render guards) ──
  const viewableDocuments = useMemo(() => {
    return uploadedDocuments.filter((d) => d.isUploaded);
  }, [uploadedDocuments]);

  const currentDocIndex = useMemo(() => {
    if (!viewerDoc) return -1;
    if (
      typeof viewerDoc.docIndex === "number" &&
      viewerDoc.docIndex >= 0 &&
      viewerDoc.docIndex < viewableDocuments.length &&
      viewableDocuments[viewerDoc.docIndex]?.id === viewerDoc.id
    ) {
      return viewerDoc.docIndex;
    }
    const idxById = viewableDocuments.findIndex((d) => d.id === viewerDoc.id);
    if (idxById !== -1) return idxById;
    return viewableDocuments.findIndex(
      (d) => d.field && viewerDoc.field && d.field === viewerDoc.field
    );
  }, [viewerDoc, viewableDocuments]);

  const isLastDoc = useMemo(() => {
    return viewableDocuments.length > 0 && currentDocIndex === viewableDocuments.length - 1;
  }, [currentDocIndex, viewableDocuments.length]);

  const isProfileApproved = useMemo(() => {
    return employee?.profileApprovalStatus === "approved";
  }, [employee?.profileApprovalStatus]);

  /* ════════════════════════════════════════════════════════════
     EDIT SECTIONS — Dynamic based on DB status
  ════════════════════════════════════════════════════════════ */
  const EDIT_SECTIONS = useMemo(() => {
    return {
      personal: {
        label: "Personal Details",
        subLabel: "DOB · Gender · Phone · Emergency Contact · Blood Group · Address",
        fields: ["dob", "gender", "phone", "emergencyContact", "bloodGroup", "address"],
      },
      family: {
        label: "Family Details (add the siblings)",
        subLabel: "Father Details · Mother Details · Siblings",
        fields: ["fatherName", "fatherOccupation", "motherName", "motherOccupation", "siblings"],
      },
      work: {
        label: "Work Details",
        subLabel: "Department · Designation · Status · Experience · Previous Experiences",
        fields: ["department", "designation", "status", "experience", "salary", "previousExperiences"],
      },
      education: {
        label: "Education",
        subLabel: "10th & 12th Standard · Marks · Marksheets · Career Gaps",
        fields: [
          "school10", "marks10", "marksheet10", "certificate10", "passedOutYear10",
          "school12", "marks12", "marksheet12", "certificate12", "passedOutYear12",
          "educationPath", "careerGaps"
        ],
      },
      courses: {
        label: "Courses",
        subLabel: "College Courses · Degree Certificates",
        fields: ["courses", "degreeCertificate"],
      },
      kyc: {
        label: "KYC & Bank Details",
        subLabel: "Aadhaar Card · PAN Card · Bank Details · Passbook",
        fields: [
          "aadhaarNo", "panNo", "aadhaarFile", "panFile",
          "bankName", "accountHolder", "accountNumber", "ifscCode", "branch", "toDate", "passbookFile"
        ],
      },
      documents: {
        label: "Upload Document",
        subLabel: "Aadhaar Card · PAN Card · 10th Marksheet · 12th Marksheet · Degree Certificates · Bank Passbook",
        fields: [
          "aadhaarFile", "panFile", "marksheet10", "marksheet12",
          "courses", "degreeCertificate", "passbookFile"
        ],
      },
    };
  }, [employee]);

  /* ════════════════════════════════════════════════════════════
     FETCH EMPLOYEE DATA
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    const fetchEmployee = async () => {
      setLoading(true);
      setError("");
      try {
        let url;
        if (isAdminView && empId) {
          url = `/users/employee/${empId}`;
        } else if (isEmployeeView) {
          url = `/users/get-details`;
        } else {
          setError("Invalid access route");
          setLoading(false);
          return;
        }

        const res = await portalInstance.get(url);
        const data = res.data?.data;

        if (!data) {
          setEmployee(null);
          setIsNewUser(false);
        } else {
          setEmployee(data);
          setIsNewUser(false);
        }
      } catch (err) {
        console.error("Details fetch error:", err);
        setError(
          err.response?.data?.message || "Failed to fetch employee details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [empId, isAdminView, isEmployeeView]);

  /* ════════════════════════════════════════════════════════════
     FETCH SALARY HISTORY
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    const fetchSalary = async () => {
      //  FIX: Prioritize empIdString for employees to match security check
      const idToUse = isAdminView ? empId : employee?.empIdString;
      if (!idToUse) return;

      setSalaryLoading(true);
      try {
        const res = await portalInstance.get(`/users/employee/salary/${idToUse}`);
        setSalaryHistory(res.data.data || []);
      } catch (err) {
        console.error("Salary fetch error:", err);
      } finally {
        setSalaryLoading(false);
      }
    };

    if (employee) {
      fetchSalary();
    }
  }, [employee, isAdminView, empId]);

  /* ════════════════════════════════════════════════════════════
     PERMISSION CHECK — on mount
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!isEmployeeView) return;
    checkEditPermission();
  }, [isEmployeeView]);

  /* ════════════════════════════════════════════════════════════
     PERMISSION CHECK — when returning from edit page
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!isEmployeeView) return;
    if (location.state?.cameFromEdit === true) {
      checkEditPermission();
      window.history.replaceState({}, "", location.pathname);
    }
  }, [location.state, isEmployeeView]);

  const checkEditPermission = async () => {
    try {
      const res = await portalInstance.get("/profile/info/can-edit");
      // console.log("API RESPONSE:", res.data);
      const {
        canEdit,
        allowedFields = [],
        hasPendingRequest,
        wasRejected,
        rejectionReason: rejReason,
        message,
      } = res.data;

      const prevCanEdit = canEditProfile;

      // Always update base states
      setCanEditProfile(!!canEdit);
      setAllowedFields(allowedFields);

      // 🔴 IMPORTANT: Decide requestStatus PROPERLY

      // ✅ FIRST TIME USER (canEdit = true but NOT approved)
      if (canEdit && message === "First-time profile setup") {
        setRequestStatus(null);
        setStatusMessage("");
        setEditRejectionReason("");
        return;
      }

      // ✅ APPROVED → only when real approval message
      if (canEdit) {
        setRequestStatus("approved");
        setStatusMessage(message);
        setEditRejectionReason("");

        // show toast only when it becomes approved newly
        if (!prevCanEdit) {
          setShowApprovalToast(true);
          setTimeout(() => setShowApprovalToast(false), 5000);
        }
        return;
      }

      // ✅ PENDING
      if (hasPendingRequest) {
        setRequestStatus("pending");
        setStatusMessage(message || "Request pending");
        setEditRejectionReason("");
        return;
      }

      // ✅ REJECTED / USED
      // ✅ HANDLE USED (IMPORTANT FIX)
      if (message === "Request already used") {
        setRequestStatus(null);
        setStatusMessage("");
        setEditRejectionReason("");
        setShowStatusModal(false);
        return;
      }

      // ✅ REJECTED ONLY REAL REJECTION
      if (wasRejected) {
        setRequestStatus("rejected");
        setStatusMessage(message || "Request rejected");
        setEditRejectionReason(rejReason || "");

        if (!showStatusModal) {
          setShowStatusModal(true);
        }
        return;
      }

      // ✅ DEFAULT → LOCKED
      setRequestStatus(null);
      setStatusMessage("");
      setEditRejectionReason("");

    } catch (err) {
      console.error("Check edit permission error:", err);
    }
  };

  /* ════════════════════════════════════════════════════════════
     PROGRESS ANIMATION
  ════════════════════════════════════════════════════════════ */
  const progress = Math.min(employee?.profileCompletion || 0, 100);
  const RECT_SIZE = 96;
  const PERIMETER = 4 * RECT_SIZE;

  const progressColor = useMemo(() => {
    if (progress >= 80) return "#1DDC69";
    if (progress >= 40) return "#1D59DC";
    return "#FF7E33";
  }, [progress]);

  const profileRestriction = useMemo(() => {
    if (!employee) return null;
    return checkProfileRestriction({
      ...employee,
      role: "employee",
      profileCompletion: employee.profileCompletion ?? progress,
    });
  }, [employee, progress]);

  useEffect(() => {
    if (!employee || progress == null) return;
    setAnimatedProgress(progress);
    setStrokeProgress(0);
  }, [employee, progress]);

  useEffect(() => {
    if (strokeProgress >= progress) return;
    const duration = Math.max(600, progress * 12);
    const startTime = performance.now();
    const animate = (time) => {
      const elapsed = time - startTime;
      const ratio = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 3);
      setStrokeProgress(Math.round(progress * eased));
      if (ratio < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [progress, employee]);

  // ── 2-Minute Continuous Countdown Timer for In-Page Viewer ──
  useEffect(() => {
    if (!viewerDoc || showContinueModal) return;

    const interval = setInterval(() => {
      setViewerTimer((prev) => {
        if (prev <= 1) {
          setShowContinueModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [Boolean(viewerDoc), showContinueModal]);

  /* ════════════════════════════════════════════════════════════
     HANDLERS
  ════════════════════════════════════════════════════════════ */
  const scrollToBottomActions = () => {
    const footerActions =
      document.getElementById("detailsview-admin-actions") ||
      document.querySelector(".detailsview-footer");
    if (footerActions) {
      footerActions.scrollIntoView({ behavior: "smooth", block: "center" });
      footerActions.classList.add("highlight-footer-pulse");
      setTimeout(() => {
        footerActions.classList.remove("highlight-footer-pulse");
      }, 2500);
    }
  };

  const toggleRejectedField = (fieldId) => {
    setSelectedRejectedFields((prev) =>
      prev.includes(fieldId)
        ? prev.filter((f) => f !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleApproveProfile = async () => {
    try {
      setReviewLoading(true);
      const targetId = empId || employee?.empIdString || employee?.empId || employee?._id;
      const res = await portalInstance.put(`/users/admin/review-profile/${targetId}`, {
        action: "approve",
      });
      if (res.data?.success) {
        setEmployee((prev) => ({
          ...prev,
          profileApprovalStatus: "approved",
          isProfileCompleted: true,
          rejectionRemark: "",
          rejectedFields: [],
        }));
        setShowApproveModal(false);
        setToastMsg("Employee profile approved successfully!");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }
    } catch (err) {
      console.error("Approve profile error:", err);
      toast.error(err.response?.data?.message || "Failed to approve profile");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleRejectProfile = async () => {
    if (!rejectionRemark.trim()) {
      setRejectError(true);
      return;
    }
    setRejectError(false);
    try {
      setReviewLoading(true);
      const targetId = empId || employee?.empIdString || employee?.empId || employee?._id;
      const sanitizedFields = Array.from(new Set(selectedRejectedFields.map((f) => {
        if (f === "certificate10") return "marksheet10";
        if (f === "certificate12") return "marksheet12";
        return f;
      })));

      const res = await portalInstance.put(`/users/admin/review-profile/${targetId}`, {
        action: "reject",
        remark: rejectionRemark.trim(),
        rejectedFields: sanitizedFields,
      });
      if (res.data?.success) {
        setEmployee((prev) => ({
          ...prev,
          profileApprovalStatus: "rejected",
          isProfileCompleted: false,
          rejectionRemark: rejectionRemark.trim(),
          rejectedFields: sanitizedFields,
        }));
        setShowRejectModal(false);
        setToastMsg("Employee profile rejected. Rejection remark has been sent to the employee.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }
    } catch (err) {
      console.error("Reject profile error:", err);
      toast.error(err.response?.data?.message || "Failed to reject profile");
    } finally {
      setReviewLoading(false);
    }
  };

  const toggleSection = (fields) => {
    setRequestedFields((prev) =>
      fields.every((f) => prev.includes(f))
        ? prev.filter((f) => !fields.includes(f))
        : [...new Set([...prev, ...fields])]
    );
  };

  const handleSendRequest = async () => {
    if (!requestMessage.trim()) {
      toast.warning("Please enter a request message");
      return;
    }
    if (requestedFields.length === 0) {
      toast.warning("Please select at least one section to edit");
      return;
    }
    try {
      setRequestLoading(true);
      await portalInstance.post("/profile/employee/request-edit", {
        requestMessage: requestMessage.trim(),
        requestedFields,
      });
      setShowRequestModal(false);
      setRequestMessage("");
      setRequestedFields([]);
      setRequestStatus("pending");
      setStatusMessage("Your edit request has been sent to admin!");
      setShowStatusModal(true);
    } catch (err) {
      console.error("Send request error:", err);
      toast.error(err.response?.data?.message || "Failed to send request");
    } finally {
      setRequestLoading(false);
    }
  };

  const handleEdit = () => {
    if (isAdminView) {
      navigate(`/admin/employees/${empId}/edit`);
      return;
    }
    if (requestStatus === "pending") {
      setStatusMessage(
        "Your request is still pending. Please wait for admin approval."
      );
      setShowStatusModal(true);
      return;
    }
    if (requestStatus === "rejected") {
      setShowRequestModal(true);
      return;
    }
    if (requestStatus === "approved") {
      sessionStorage.setItem("allowedEditFields", JSON.stringify(allowedFields));
      navigate("/emp/my-details/edit", { state: { cameFromEdit: false } });
      return;
    }
    // ✅ NEW EMPLOYEE: profile not yet completed → allow free edit without request
    if (!employee?.isProfileCompleted || (employee?.profileCompletion ?? 0) < 100) {
      navigate("/emp/my-details/edit");
      return;
    }
    setShowRequestModal(true);
  };

  /* ════════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════════ */
  // ✅ S3: Use signed URL returned by backend (employee.photoUrl)
  const getPhotoUrl = () => {
    if (employee?.pictureUrl) return employee.pictureUrl;
    return "/avatar.png";
  };

  const getStatusClass = (status) => {
    if (!status) return "working";
    return status.toLowerCase().trim().replace(/\s+/g, "-").replace(/_/g, "-");
  };

  const formatStatusDisplay = (status) =>
    status
      ? status
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
      : "Working";

  const getHeaderBgClass = (status) => {
    if (!status) return "";
    const s = status.toLowerCase().trim();
    if (s.includes("full") && s.includes("time")) return "full-time";
    if (s.includes("part") && (s.includes("time") || s.includes("_") || s.includes("-"))) return "part-time";
    if (s === "parttime" || s === "part_time" || s === "part-time") return "part-time";
    if (s === "intern" || s === "internship") return "intern";
    if (s === "relived" || s === "relieved") return "relived";
    if (s === "active") return "active";
    if (s.includes("hold")) return "on-hold";
    return "";
  };

  // ✅ Calculate Company Experience from Date of Joining (DOJ)
  const calculateCompanyExperience = (emp) => {
    if (!emp) return "-";
    const doj = emp.dateJoined || emp.dateOfJoining || emp.joiningDate || emp.doj || emp.createdAt;
    if (!doj) {
      if (emp.experience) {
        return String(emp.experience).toLowerCase().includes("year")
          ? emp.experience
          : `${emp.experience} Years`;
      }
      return "-";
    }

    const start = new Date(doj);
    if (isNaN(start.getTime())) {
      return emp.experience ? String(emp.experience) : "-";
    }

    const end = emp.dateRelieved ? new Date(emp.dateRelieved) : new Date();
    if (isNaN(end.getTime()) || end < start) {
      return "0 Years";
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years > 0 && months > 0) {
      return `${years} ${years === 1 ? "Year" : "Years"} ${months} ${months === 1 ? "Month" : "Months"}`;
    } else if (years > 0) {
      return `${years} ${years === 1 ? "Year" : "Years"}`;
    } else if (months > 0) {
      return `${months} ${months === 1 ? "Month" : "Months"}`;
    } else {
      return "Less than 1 Month";
    }
  };

  /* ════════════════════════════════════════════════════════════
     RENDER GUARDS
  ════════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="dashboard-page">
        <Sidebar />
        <div
          className="detailsview-page d-flex justify-content-center align-items-center"
          style={{ minHeight: "80vh" }}
        >
          <Spinner animation="border" variant="primary" />
        </div>
      </div>
    );
  }

  if (!employee && isEmployeeView) {
    return (
      <div className="dashboard-page">
        <Sidebar />
        <div
          className="detailsview-page d-flex flex-column justify-content-center align-items-center"
          style={{ minHeight: "80vh", textAlign: "center" }}
        >
          <div className="text-center mb-5">
            <h3 style={{ color: "#1f2a44", fontWeight: "600" }}>Welcome!</h3>
            <p
              className="text-muted mt-3"
              style={{ fontSize: "16px", maxWidth: "500px" }}
            >
              Please fill in your details to complete your profile and get
              started.
            </p>
            <div className="mt-3 p-3 rounded" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", maxWidth: "500px", margin: "0 auto", fontSize: "14px" }}>
              <strong>7-Day Completion Period:</strong> You have 7 days to complete your profile 100%. Please complete all required details today to ensure uninterrupted access.
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => navigate("/emp/my-details/edit")}
            style={{ padding: "12px 32px", fontSize: "16px" }}
          >
            Fill Details
          </Button>
        </div>
      </div>
    );
  }

  if (error || (!employee && !isNewUser)) {
    return (
      <div className="dashboard-page">
        <Sidebar />
        <div
          className="detailsview-page d-flex flex-column align-items-center justify-content-center"
          style={{ minHeight: "70vh" }}
        >
          <p className="text-danger mb-4">{error || "Employee not found"}</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  //  Extra safety masking (frontend fallback)
  const maskAadhaar = (val) => {
    if (!val) return "-";
    if (val.includes("XXXX")) return val; // already masked
    return val.replace(/\d(?=\d{4})/g, "X");
  };

  const maskPAN = (val) => {
    if (!val) return "-";
    if (val.includes("X")) return val; // already masked
    return val.replace(/^([A-Z]{5})[0-9]{4}([A-Z])$/, "XXXXX1234$2");
  };

  // ✅ Mask phone: show only last 4 digits e.g. ******1234
  const maskPhone = (val) => {
    if (!val) return "-";
    const str = String(val).replace(/\D/g, "");
    if (str.length < 4) return "****";
    return str.slice(0, -4).replace(/./g, "*") + str.slice(-4);
  };

  // ✅ Mask email: show first 2 chars + domain e.g. sa*****@gmail.com
  const maskEmail = (val) => {
    if (!val) return "-";
    const [user, domain] = val.split("@");
    if (!domain) return val;
    const visible = user.slice(0, 2);
    const masked = "*".repeat(Math.max(3, user.length - 2));
    return `${visible}${masked}@${domain}`;
  };

  // ✅ Mask emergency contact same way as phone
  const maskEmergencyContact = (val) => {
    if (!val) return "-";
    const str = String(val).replace(/\D/g, "");
    if (str.length < 4) return "****";
    return str.slice(0, -4).replace(/./g, "*") + str.slice(-4);
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return "₹0";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (val) => {
    if (!val) return "-";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return String(val);
    }
  };

  // ── Helper: Detect if file is an image ──
  const isImageFile = (url, key) => {
    if (!url && !key) return false;
    const path = String(url || key).toLowerCase().split("?")[0];
    return (
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".png") ||
      path.endsWith(".webp") ||
      path.endsWith(".gif") ||
      path.endsWith(".bmp") ||
      path.endsWith(".svg")
    );
  };

  // ── Helper: Format seconds to M:SS (e.g. 2:58) ──
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // ── 2-Minute Countdown Timer for In-Page Viewer ──
  const handleCloseViewer = () => {
    setViewerDoc(null);
    setShowContinueModal(false);
    setShowRejectDocModal(false);
    setDocRejectRemark("");
    setDocRejectError(false);
    setSelectedRejectDocs([]);
    setViewerTimer(120);
  };

  const handleContinueViewer = async () => {
    setViewerTimer(120);
    setShowContinueModal(false);
    if (viewerDoc) {
      try {
        const payload = {
          key: viewerDoc.key || undefined,
          field: viewerDoc.field || undefined,
          empId: employee?.empIdString || employee?.empId || employee?._id,
        };
        const res = await portalInstance.post("/users/document-view-url", payload);
        if (res.data?.success && res.data?.url) {
          setViewerDoc((prev) => (prev ? { ...prev, url: res.data.url } : null));
        }
      } catch (e) {
        console.warn("Presigned URL refresh fallback:", e);
      }
    }
  };

  // ── Handle Document View with 2-Minute Expiry In-Page Viewer ──
  const handleViewDocument = async (doc, targetIndex = null) => {
    if (!doc || !doc.isUploaded) return;

    try {
      setDocLoadingId(doc.id);

      const resolvedIndex =
        typeof targetIndex === "number" && targetIndex >= 0
          ? targetIndex
          : viewableDocuments.findIndex((d) => d.id === doc.id);

      const payload = {
        key: doc.key || undefined,
        field: doc.field || undefined,
        empId: employee?.empIdString || employee?.empId || employee?._id,
      };

      const res = await portalInstance.post("/users/document-view-url", payload);
      const targetUrl = (res.data?.success && res.data?.url) ? res.data.url : doc.url;

      if (targetUrl) {
        setViewerDoc({
          id: doc.id,
          label: doc.label || "Document",
          key: doc.key,
          field: doc.field,
          url: targetUrl,
          docIndex: resolvedIndex >= 0 ? resolvedIndex : 0,
        });
        // Only start timer when viewer is initially opened; keep timer continuous when navigating between documents
        if (!viewerDoc) {
          setViewerTimer(120);
        }
        setShowContinueModal(false);
      } else {
        toast.error("Unable to open document. The file might not be available.");
      }
    } catch (err) {
      console.error("Error viewing document:", err);
      const resolvedIndex =
        typeof targetIndex === "number" && targetIndex >= 0
          ? targetIndex
          : viewableDocuments.findIndex((d) => d.id === doc.id);
      if (doc.url) {
        setViewerDoc({
          id: doc.id,
          label: doc.label || "Document",
          key: doc.key,
          field: doc.field,
          url: doc.url,
          docIndex: resolvedIndex >= 0 ? resolvedIndex : 0,
        });
        if (!viewerDoc) {
          setViewerTimer(120);
        }
        setShowContinueModal(false);
      } else {
        toast.error("Failed to load document view URL. Please try again.");
      }
    } finally {
      setDocLoadingId(null);
    }
  };

  // ── Document Navigation Handlers ──
  const handleNextDocument = () => {
    if (docLoadingId) return;
    if (currentDocIndex >= 0 && currentDocIndex < viewableDocuments.length - 1) {
      const nextIndex = currentDocIndex + 1;
      const nextDoc = viewableDocuments[nextIndex];
      if (nextDoc) {
        handleViewDocument(nextDoc, nextIndex);
      }
    }
  };

  const handlePrevDocument = () => {
    if (docLoadingId) return;
    if (currentDocIndex > 0) {
      const prevIndex = currentDocIndex - 1;
      const prevDoc = viewableDocuments[prevIndex];
      if (prevDoc) {
        handleViewDocument(prevDoc, prevIndex);
      }
    }
  };

  // ── Document Approval / Rejection Evaluation Helpers ──
  const isDocRejected = (doc) => {
    if (!employee || !doc) return false;
    const rf = Array.isArray(employee.rejectedFields) ? employee.rejectedFields : [];
    return (
      rf.includes(doc.id) ||
      rf.includes(doc.field) ||
      (doc.id === "marksheet10" && rf.includes("certificate10")) ||
      (doc.id === "marksheet12" && rf.includes("certificate12")) ||
      ((doc.id === "degreeCertificate" || (doc.id && String(doc.id).startsWith("course_"))) &&
        (rf.includes("degreeCertificate") || rf.includes("courses")))
    );
  };

  const isDocApproved = (doc) => {
    if (!employee || !doc) return false;
    if (isDocRejected(doc)) return false;
    const ap = Array.isArray(employee.approvedDocuments) ? employee.approvedDocuments : [];
    return (
      ap.includes(doc.id) ||
      ap.includes(doc.field) ||
      (doc.id === "marksheet10" && ap.includes("certificate10")) ||
      (doc.id === "marksheet12" && ap.includes("certificate12")) ||
      ((doc.id === "degreeCertificate" || (doc.id && String(doc.id).startsWith("course_"))) &&
        (ap.includes("degreeCertificate") || ap.includes("courses"))) ||
      ((doc.id && String(doc.id).startsWith("prof_cert_")) &&
        (ap.includes("professionalCertifications") || ap.includes(doc.field))) ||
      employee.profileApprovalStatus === "approved"
    );
  };

  const areAllDocsApproved = Boolean(
    viewableDocuments &&
    viewableDocuments.length > 0 &&
    viewableDocuments.every((d) => isDocApproved(d))
  );

  // ── Approve All Documents at Once (When on Last Document) ──
  // Note: Approving documents ONLY marks documents as approved and does NOT approve the whole profile!
  const handleApproveAllDocuments = async () => {
    try {
      setDocReviewLoading(true);
      setDocReviewAction("approve");
      const targetId = empId || employee?.empIdString || employee?.empId || employee?._id;

      const allDocKeys = [];
      viewableDocuments.forEach((d) => {
        if (d.id) allDocKeys.push(d.id);
        if (d.field) allDocKeys.push(d.field);
      });
      const uniqueDocKeys = Array.from(new Set(allDocKeys));

      const res = await portalInstance.put(`/users/admin/review-document/${targetId}`, {
        action: "approve",
        documentFields: uniqueDocKeys,
        documentIds: uniqueDocKeys,
      });

      if (res.data?.success) {
        const updatedApproved =
          res.data?.data?.approvedDocuments ||
          Array.from(new Set([...(employee?.approvedDocuments || []), ...uniqueDocKeys]));
        const updatedRejected =
          res.data?.data?.rejectedFields ||
          (employee?.rejectedFields || []).filter((f) => !uniqueDocKeys.includes(f));
        const updatedStatus =
          res.data?.data?.profileApprovalStatus || employee?.profileApprovalStatus || "pending";

        // ONLY approve documents — DO NOT set profileApprovalStatus = "approved" or isProfileCompleted = true
        setEmployee((prev) => ({
          ...prev,
          approvedDocuments: updatedApproved,
          rejectedFields: updatedRejected,
          profileApprovalStatus: updatedStatus,
        }));

        toast.success("Documents approved successfully!");
        setToastMsg("Documents approved successfully! You can approve the complete profile from the profile page bottom.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);

        // Closes the document viewer page
        handleCloseViewer();
      } else {
        toast.error(res.data?.message || "Failed to approve documents");
      }
    } catch (err) {
      console.error("Approve documents error:", err);
      toast.error(err.response?.data?.message || "Failed to approve documents");
    } finally {
      setDocReviewLoading(false);
      setDocReviewAction(null);
    }
  };

  const handleOpenRejectDocModal = () => {
    setDocRejectRemark("");
    setDocRejectError(false);
    // Pre-select all viewable documents so by default they can all be rejected, or Admin can uncheck
    setSelectedRejectDocs(viewableDocuments.map((d) => d.field || d.id));
    setShowRejectDocModal(true);
  };

  const handleConfirmRejectDoc = async () => {
    if (!docRejectRemark.trim()) {
      setDocRejectError(true);
      return;
    }
    setDocRejectError(false);
    try {
      setDocReviewLoading(true);
      setDocReviewAction("reject");
      const targetId = empId || employee?.empIdString || employee?.empId || employee?._id;

      const fieldsToReject = selectedRejectDocs.length > 0
        ? selectedRejectDocs
        : viewableDocuments.map((d) => d.field || d.id);

      const res = await portalInstance.put(`/users/admin/review-profile/${targetId}`, {
        action: "reject",
        remark: docRejectRemark.trim(),
        rejectedFields: fieldsToReject,
      });

      if (res.data?.success) {
        setEmployee((prev) => ({
          ...prev,
          profileApprovalStatus: "rejected",
          isProfileCompleted: false,
          rejectionRemark: docRejectRemark.trim(),
          rejectedFields: fieldsToReject,
          approvedDocuments: (prev?.approvedDocuments || []).filter((d) => !fieldsToReject.includes(d)),
        }));

        setShowRejectDocModal(false);
        setDocRejectRemark("");
        setSelectedRejectDocs([]);
        toast.warning("Documents rejected. Employee has been notified to re-upload.");

        // Closes the document viewer page
        handleCloseViewer();
      } else {
        toast.error(res.data?.message || "Failed to reject documents");
      }
    } catch (err) {
      console.error("Reject documents error:", err);
      toast.error(err.response?.data?.message || "Failed to reject documents");
    } finally {
      setDocReviewLoading(false);
      setDocReviewAction(null);
    }
  };

  /* ════════════════════════════════════════════════════════════
     MAIN RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="dashboard-page">
      <ToastContainer position="top-right" autoClose={3000} />
      <Sidebar />
      <div className="detailsview-page">

        {/* ── Approval Toast ── */}
        {isEmployeeView && showApprovalToast && (
          <div className="approval-toast">
            <div className="toast-content">
              <FaCheckCircle className="toast-icon" />
              <div className="toast-text">
                <strong>Upate Your Profile!</strong>
                {/* <p>{statusMessage}</p> */}
                <small>Click "Edit now" to update your details</small>
              </div>
            </div>
          </div>
        )}

        {/* ── Profile Header Banner (Figma UI Design) ── */}
        <div className={`detailsview-header ${getHeaderBgClass(employee.status)}`}>
          <div className="figma-header-profile-wrap">
            <div className="figma-avatar-container">
              <img
                src={getPhotoUrl()}
                alt={employee.name || "Employee"}
                className="figma-avatar-img"
                onError={(e) => (e.target.src = "/avatar.png")}
              />
              <div className="figma-completion-pill">
                {animatedProgress !== null ? animatedProgress : (progress || 0)}%
              </div>
            </div>

            <div className="figma-header-info">
              <h2 className="figma-employee-name">{employee.name || "Employee"}</h2>
              <p className="figma-employee-role">{employee.designation || "-"}</p>
              <p className="figma-employee-meta">{employee.empIdString || employee.empId || ""}</p>
              <p className="figma-employee-meta" id="field-item-phone">{employee.phone || ""}</p>
              <p className="figma-employee-meta">{employee.email || ""}</p>
            </div>
          </div>

          <div className="figma-header-right-side">
            <div className="figma-header-status-badge">
              {formatStatusDisplay(employee.status)}
            </div>

            {isEmployeeView && employee.profileApprovalStatus === "approved" && (
              <div className="employee-review-alert approved animate-in figma-header-approved-alert">
                <FaCheckCircle className="me-2 text-success" />
                <span>Your profile has been verified and approved by the Admin.</span>
              </div>
            )}

            {isEmployeeView && employee.profileApprovalStatus === "pending" && (
              <div className="employee-review-alert pending animate-in figma-header-pending-alert">
                <FaClock className="me-2" style={{ color: "#166534" }} />
                <span>Profile Submitted for Admin Review</span>
              </div>
            )}

            {isAdminView && employee.profileApprovalStatus === "approved" && (
              <div className="admin-review-badge approved animate-in figma-header-admin-approved">
                <FaCheckCircle className="me-1" /> Profile Verified & Approved by Admin
              </div>
            )}
          </div>
        </div>

        {/* ── Details Sections ── */}
        <div className="detailsview-wrapper">

          {/* ── Review Toast Alert ── */}
          {showToast && (
            <div className="profile-review-toast-alert animate-in mb-3">
              <FaCheckCircle className="me-2" />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* ── Admin Review Banners ── */}
          {isAdminView && (employee.profileApprovalStatus === "pending" || (!employee.profileApprovalStatus && employee.profileCompletion >= 100 && !employee.isProfileCompleted)) && (
            <div className="admin-review-banner pending animate-in mb-4">
              <div className="admin-review-content">
                <div className="admin-review-badge pending">
                  <FaClock className="me-1" /> Profile Ready for Review & Approval
                </div>
                <h4 className="admin-review-title">
                  Employee Profile Completed 100%
                </h4>
                <p className="admin-review-desc mb-0">
                  {employee.name} ({employee.empIdString || employee.empId || ""}) has submitted all required documents for review and approval.
                </p>
              </div>
              <div className="admin-review-actions">
                <button
                  type="button"
                  className="admin-scroll-down-btn"
                  onClick={scrollToBottomActions}
                  title="Scroll down to Approve & Reject"
                >
                  <FaArrowDown className="admin-scroll-arrow-icon" />
                </button>
              </div>
            </div>
          )}

          {isAdminView && employee.profileApprovalStatus === "rejected" && (
            <div className="admin-review-banner rejected animate-in mb-4">
              <div className="admin-review-content">
                <div className="admin-review-badge rejected">
                  Profile Currently Rejected
                </div>
                <h4 className="admin-review-title">
                  Rejection Remark Given to Employee
                </h4>
                <p className="admin-review-desc mb-2">
                  <strong>Reason:</strong> "{employee.rejectionRemark}"
                </p>
                {employee.rejectedFields && employee.rejectedFields.length > 0 && (
                  <div className="admin-review-items mb-0">
                    <strong>Requested Corrections:</strong>{" "}
                    {getFriendlyFieldNames(employee.rejectedFields).join(", ")}
                  </div>
                )}
              </div>
              <div className="admin-review-actions">
                <Button
                  variant="outline-danger"
                  className="common-modal-btn btn-update me-2"
                  onClick={() => {
                    setRejectionRemark(employee.rejectionRemark || "");
                    setSelectedRejectedFields(employee.rejectedFields || []);
                    setShowRejectModal(true);
                  }}
                >
                  Update Remark
                </Button>
                <Button
                  variant="success"
                  className="common-modal-btn btn-approve"
                  style={{ backgroundColor: "#16a34a", color: "#ffffff", borderColor: "#16a34a" }}
                  onClick={() => setShowApproveModal(true)}
                >
                  Approve Profile
                </Button>
              </div>
            </div>
          )}

          {/* ── Employee Review Banners ── */}
          {isEmployeeView && employee.profileApprovalStatus === "rejected" && (
            <div className="employee-review-alert rejected animate-in mb-4" style={{ display: "flex", width: "100%" }}>
              <div className="employee-review-alert-content">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                  <h4 className="employee-review-alert-title mb-0">
                    Profile Verification Action Required
                  </h4>
                  {profileRestriction && (
                    profileRestriction.isRestricted ? (
                      <span className="badge bg-danger text-white px-3 py-2" style={{ fontSize: "12px", borderRadius: "12px" }}>
                        Resubmission Deadline Passed
                      </span>
                    ) : profileRestriction.isLastDay ? (
                      <span className="badge bg-warning text-dark px-3 py-2" style={{ fontSize: "12px", borderRadius: "12px", fontWeight: "700" }}>
                        Today is your last day!
                      </span>
                    ) : (
                      <span className="badge bg-primary text-white px-3 py-2" style={{ fontSize: "12px", borderRadius: "12px" }}>
                        {profileRestriction.daysRemaining} Day{profileRestriction.daysRemaining === 1 ? "" : "s"} Remaining
                      </span>
                    )
                  )}
                </div>

                {profileRestriction && (
                  profileRestriction.isRestricted ? (
                    <div className="p-2 mb-2 rounded" style={{ background: "#fee2e2", border: "1px solid #f87171", color: "#991b1b", fontSize: "13px" }}>
                      <strong>Access Restricted:</strong> Your 7-day resubmission period has expired. You must complete your profile 100% and resubmit to access other pages.
                    </div>
                  ) : profileRestriction.isLastDay ? (
                    <div className="p-2 mb-2 rounded" style={{ background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", fontSize: "13px" }}>
                      <strong>Today is your last day!</strong> Please complete your profile today. If not completed today, access to other pages will be restricted until your profile is completed.
                    </div>
                  ) : (
                    <div className="p-2 mb-2 rounded" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", fontSize: "13px" }}>
                      <strong>7-Day Resubmission Period:</strong> You have {profileRestriction.daysRemaining} day{profileRestriction.daysRemaining === 1 ? "" : "s"} remaining to update and complete your profile.
                    </div>
                  )
                )}

                <div className="employee-review-alert-remark">
                  <strong>Admin Rejection Remark:</strong> "{employee.rejectionRemark}"
                </div>
                {employee.rejectedFields && employee.rejectedFields.length > 0 && (
                  <div className="employee-review-alert-corrections mt-2">
                    <strong>Document(s) Needing Correction:</strong>
                    <div className="rejected-items-action-list mt-2">
                      {employee.rejectedFields.map((f, i) => (
                        <div key={i} className="rejected-item-action-pill">
                          <span className="rejected-item-name">{getFieldFriendlyName(f)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="employee-review-alert-hint mt-2 mb-0">
                  Please update or re-upload only the required document/field and resubmit your profile for Admin review.
                </p>
              </div>
              <div
                className="employee-review-alert-action p-3 d-flex align-items-end justify-content-end"
                style={{ alignSelf: "flex-end" }}
              >
                <Button
                  variant="danger"
                  className="common-modal-btn btn-reject"
                  onClick={() => navigate("/emp/my-details/edit")}
                  style={{ whiteSpace: "nowrap" }}
                >
                  Update & Resubmit Profile
                </Button>
              </div>
            </div>
          )}

          {/* ── Employee Incomplete Profile Reminder / Deadline Banner ── */}
          {isEmployeeView &&
            employee.profileApprovalStatus !== "rejected" &&
            employee.profileApprovalStatus !== "pending" &&
            employee.profileApprovalStatus !== "approved" &&
            (employee.profileCompletion < 100 || !employee.isProfileCompleted) && (
              <div
                className={`employee-review-alert animate-in mb-4 ${profileRestriction?.isRestricted
                    ? "rejected"
                    : profileRestriction?.isLastDay
                      ? "last-day-alert"
                      : "incomplete"
                  }`}
                style={{
                  border: profileRestriction?.isRestricted
                    ? "1px solid #f87171"
                    : profileRestriction?.isLastDay
                      ? "1.5px solid #f59e0b"
                      : "1px solid #fde68a",
                  background: profileRestriction?.isRestricted
                    ? "#fff1f2"
                    : profileRestriction?.isLastDay
                      ? "#fffbeb"
                      : "#fffdf5",
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                  borderRadius: "16px",
                  padding: "16px 20px",
                  boxSizing: "border-box",
                }}
              >
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2 w-100">
                  <h4
                    className="employee-review-alert-title mb-0"
                    style={{
                      color: profileRestriction?.isRestricted
                        ? "#b91c1c"
                        : profileRestriction?.isLastDay
                          ? "#b45309"
                          : "#92400e",
                      fontSize: "16px",
                      fontWeight: "600",
                    }}
                  >
                    {profileRestriction?.isRestricted
                      ? "Profile Completion Required (Access Restricted)"
                      : profileRestriction?.isLastDay
                        ? "Profile Completion Required — Today is your last day!"
                        : "Profile Completion In Progress"}
                  </h4>
                  {profileRestriction && (
                    profileRestriction.isRestricted ? (
                      <span className="badge bg-danger text-white px-3 py-2" style={{ fontSize: "12px", borderRadius: "12px" }}>
                        Access Restricted
                      </span>
                    ) : profileRestriction.isLastDay ? (
                      <span className="badge bg-warning text-dark px-3 py-2" style={{ fontSize: "12px", borderRadius: "12px", fontWeight: "700" }}>
                        Today is your last day!
                      </span>
                    ) : (
                      <span
                        className="badge px-3 py-2"
                        style={{
                          fontSize: "12px",
                          borderRadius: "14px",
                          fontWeight: "600",
                          backgroundColor: "#fef3c7",
                          color: "#92400e",
                          border: "1px solid #fcd34d",
                        }}
                      >
                        {profileRestriction.daysRemaining} Day{profileRestriction.daysRemaining === 1 ? "" : "s"} Remaining
                      </span>
                    )
                  )}
                </div>

                {profileRestriction?.isRestricted ? (
                  <div className="p-2 mb-2 rounded w-100" style={{ background: "#fee2e2", border: "1px solid #f87171", color: "#991b1b", fontSize: "13px" }}>
                    <strong>Completion Deadline Passed:</strong> Your 7-day period has expired. You must complete your profile 100% to access other pages.
                  </div>
                ) : profileRestriction?.isLastDay ? (
                  <div className="p-2 mb-2 rounded w-100" style={{ background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", fontSize: "13px" }}>
                    <strong>Today is your last day!</strong> Please complete your profile 100% today. If not completed today, access to other pages will be restricted until your profile is completed.
                  </div>
                ) : (
                  <div className="p-2 mb-2 rounded w-100" style={{ background: "#ffffff", border: "1px solid #fde68a", color: "#92400e", fontSize: "13px" }}>
                    <strong style={{ color: "#78350f" }}>7-Day Completion Period:</strong> You have {profileRestriction?.daysRemaining} day{profileRestriction?.daysRemaining === 1 ? "" : "s"} remaining to complete your profile 100%. Complete the remaining details to maintain unrestricted access.
                  </div>
                )}

                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-2 w-100">
                  <p className="employee-review-alert-hint mb-0" style={{ fontSize: "13px", color: "#64748b" }}>
                    Your profile is currently {progress}% complete.
                  </p>
                  <button
                    type="button"
                    className="common-modal-btn btn-update ms-auto"
                    onClick={() => navigate("/emp/my-details/edit")}
                  >
                    {profileRestriction?.isLastDay ? "Complete Profile Today" : "Complete Profile Now"}
                  </button>
                </div>
              </div>
            )}



          {/* ── 8 Cards Grid (Figma UI Design) ── */}
          <div className="figma-cards-grid">
            {/* Card 1: Personal Details */}
            <div className="figma-card" id="section-personal">
              <div className="figma-card-header">
                <div className="figma-card-icon-badge">
                  <img src="/Personal Details.png" alt="Personal Details" className="figma-card-header-icon" />
                </div>
                <h3 className="figma-card-title">Personal Details</h3>
              </div>
              <div className="figma-card-body">
                <div className="figma-row" id="field-item-gender">
                  <span className="figma-label">Gender</span>
                  <span className="figma-value">{employee.gender || "-"}</span>
                </div>
                <div className="figma-row" id="field-item-status">
                  <span className="figma-label">Status</span>
                  <span className="figma-value">
                    {employee.status === "full_time" ? "Full-time" : formatStatusDisplay(employee.status)}
                  </span>
                </div>
                <div className="figma-row" id="field-item-emergencyContact">
                  <span className="figma-label">Emergency Contact</span>
                  <span className="figma-value">{employee.emergencyContact || "-"}</span>
                </div>
                <div className="figma-row" id="field-item-bloodGroup">
                  <span className="figma-label">Blood Group</span>
                  <span className="figma-value">{employee.bloodGroup || "-"}</span>
                </div>
                <div className="figma-row" id="field-item-dob">
                  <span className="figma-label">D.O.B</span>
                  <span className="figma-value">{formatDate(employee.dob)}</span>
                </div>
                <div className="figma-row" id="field-item-address">
                  <span className="figma-label">Address</span>
                  <span className="figma-value">{employee.address || "-"}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Family Details */}
            <div className="figma-card" id="section-family">
              <div className="figma-card-header">
                <div className="figma-card-icon-badge">
                  <img src="/Family Details.png" alt="Family Details" className="figma-card-header-icon" />
                </div>
                <h3 className="figma-card-title">Family Details</h3>
              </div>
              <div className="figma-card-body">
                <div className="figma-row" id="field-item-fatherName">
                  <span className="figma-label">Father Name</span>
                  <span className="figma-value">{employee.fatherName || "-"}</span>
                </div>
                <div className="figma-row" id="field-item-motherName">
                  <span className="figma-label">Mother Name</span>
                  <span className="figma-value">{employee.motherName || "-"}</span>
                </div>
                <div className="figma-row" id="field-item-fatherOccupation">
                  <span className="figma-label">Father Occupation</span>
                  <span className="figma-value">{employee.fatherOccupation || "-"}</span>
                </div>
                <div className="figma-row" id="field-item-motherOccupation">
                  <span className="figma-label">Mother Occupation</span>
                  <span className="figma-value">{employee.motherOccupation || "-"}</span>
                </div>
                {/* Siblings */}
                {(() => {
                  const validSiblings = (employee.siblings || []).filter(
                    (sib) =>
                      sib &&
                      ((sib.name && String(sib.name).trim() !== "") ||
                        (sib.occupation && String(sib.occupation).trim() !== ""))
                  );
                  if (validSiblings.length === 0) return null;

                  return validSiblings.map((sib, i) => {
                    const rel = (sib.relationship || "Sibling").trim();
                    const relBase = rel.replace(/\s*name$/i, "");
                    return (
                      <div key={i} className="figma-row" id={i === 0 ? "section-siblings" : undefined}>
                        <span className="figma-label">{relBase}</span>
                        <div className="figma-val-stack">
                          <span className="figma-value">{sib.name || "-"}</span>
                          {sib.occupation && <span className="figma-sub-val">{sib.occupation}</span>}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Card 3: Work Details */}
            <div className="figma-card" id="section-working">
              <div className="figma-card-header">
                <div className="figma-card-icon-badge">
                  <img src="/Work Details.png" alt="Work Details" className="figma-card-header-icon" />
                </div>
                <h3 className="figma-card-title">Work Details</h3>
              </div>
              <div className="figma-card-body">
                <div className="figma-row">
                  <span className="figma-label">Department</span>
                  <span className="figma-value">{employee.department || "-"}</span>
                </div>
                <div className="figma-row">
                  <span className="figma-label">Designation</span>
                  <span className="figma-value">{employee.designation || "-"}</span>
                </div>
                <div className="figma-row">
                  <span className="figma-label">Employment Type</span>
                  <span className="figma-value">
                    {employee.status === "full_time" ? "Full-time" : formatStatusDisplay(employee.status)}
                  </span>
                </div>
                <div className="figma-row">
                  <span className="figma-label">Experience</span>
                  <span className="figma-value">
                    {calculateCompanyExperience(employee)}
                  </span>
                </div>
                <div className="figma-row">
                  <span className="figma-label">Salary</span>
                  <span className="figma-value">
                    {(() => {
                      const activeSalary =
                        salaryHistory?.find((s) => !s.toDate || new Date(s.toDate) >= new Date()) ||
                        [...salaryHistory].sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate))[0];
                      const amount =
                        activeSalary?.totalSalary ??
                        (activeSalary ? Number(activeSalary.basicSalary || 0) + (activeSalary.allowances || []).reduce((sum, a) => sum + Number(a.value || a.amount || 0), 0) : employee.salary || null);
                      return amount !== null && amount !== undefined ? formatCurrency(amount) : (employee.salary ? formatCurrency(employee.salary) : "-");
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Previous Experience */}
            {Boolean(
              Array.isArray(employee.previousExperiences) &&
              employee.previousExperiences.length > 0 &&
              employee.previousExperiences.some(
                (exp) =>
                  exp &&
                  ((exp.previousCompany && String(exp.previousCompany).trim() !== "") ||
                    (exp.designation && String(exp.designation).trim() !== "") ||
                    (exp.department && String(exp.department).trim() !== "") ||
                    exp.dateOfJoining ||
                    exp.lastWorkingDate ||
                    exp.previousSalary)
              )
            ) && (
                <div className="figma-card" id="section-previousExperiences">
                  <div className="figma-card-header">
                    <div className="figma-card-icon-badge">
                      <img src="/Pervious Experince.png" alt="Previous Experience" className="figma-card-header-icon" />
                    </div>
                    <h3 className="figma-card-title">Previous Experience</h3>
                  </div>
                  <div className="figma-card-body">
                    {employee.previousExperiences.map((exp, i) => (
                      <div key={i} className={`figma-prev-exp-item ${i > 0 ? "figma-exp-divider" : ""}`}>
                        <div className="figma-row">
                          <span className="figma-label">Company</span>
                          <span className="figma-value">{exp.previousCompany || "-"}</span>
                        </div>
                        <div className="figma-row">
                          <span className="figma-label">Designation</span>
                          <span className="figma-value">{exp.designation || "-"}</span>
                        </div>
                        <div className="figma-row">
                          <span className="figma-label">Department</span>
                          <span className="figma-value">{exp.department || "-"}</span>
                        </div>
                        <div className="figma-row">
                          <span className="figma-label">Joining Date</span>
                          <span className="figma-value">{formatDate(exp.dateOfJoining)}</span>
                        </div>
                        <div className="figma-row">
                          <span className="figma-label">Last Working Date</span>
                          <span className="figma-value">{formatDate(exp.lastWorkingDate)}</span>
                        </div>
                        <div className="figma-row">
                          <span className="figma-label">Previous Salary</span>
                          <span className="figma-value">{exp.previousSalary ? formatCurrency(exp.previousSalary) : "-"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Card 5: Education */}
            <div className="figma-card" id="section-education">
              <div className="figma-card-header">
                <div className="figma-card-icon-badge">
                  <img src="/Education.png" alt="Education" className="figma-card-header-icon" />
                </div>
                <h3 className="figma-card-title">Education</h3>
              </div>
              <div className="figma-card-body">
                <div className="figma-row" id="field-item-school10">
                  <span className="figma-label">10th School</span>
                  <span className="figma-value">{employee.school10 || "-"}</span>
                </div>
                <div className="figma-row" id="field-item-marks10">
                  <span className="figma-label">10th Marks</span>
                  <span className="figma-value">
                    {employee.marks10 ? String(employee.marks10).replace(/%/g, "").trim() : "-"}
                  </span>
                </div>
                {Boolean(
                  employee.passedOutYear10 &&
                  String(employee.passedOutYear10).trim() !== "" &&
                  String(employee.passedOutYear10).trim() !== "-"
                ) && (
                    <div className="figma-row" id="field-item-passedOutYear10">
                      <span className="figma-label">10th Passed-Out Year</span>
                      <span className="figma-value">{employee.passedOutYear10}</span>
                    </div>
                  )}
                {employee.educationPath !== "Diploma" ? (
                  <>
                    <div className="figma-row" id="field-item-school12">
                      <span className="figma-label">12th School</span>
                      <span className="figma-value">{employee.school12 || "-"}</span>
                    </div>
                    <div className="figma-row" id="field-item-marks12">
                      <span className="figma-label">12th Marks</span>
                      <span className="figma-value">
                        {employee.marks12 ? String(employee.marks12).replace(/%/g, "").trim() : "-"}
                      </span>
                    </div>
                    {Boolean(
                      employee.passedOutYear12 &&
                      String(employee.passedOutYear12).trim() !== "" &&
                      String(employee.passedOutYear12).trim() !== "-"
                    ) && (
                        <div className="figma-row" id="field-item-passedOutYear12">
                          <span className="figma-label">12th Passed-Out Year</span>
                          <span className="figma-value">{employee.passedOutYear12}</span>
                        </div>
                      )}
                  </>
                ) : (
                  <>
                    <div className="figma-row">
                      <span className="figma-label">Diploma College</span>
                      <span className="figma-value">{employee.diplomaCollege || "-"}</span>
                    </div>
                    <div className="figma-row">
                      <span className="figma-label">Diploma Course</span>
                      <span className="figma-value">{employee.diplomaCourse || "-"}</span>
                    </div>
                    <div className="figma-row">
                      <span className="figma-label">Diploma Marks</span>
                      <span className="figma-value">
                        {employee.diplomaPercentage ? `${employee.diplomaPercentage}%` : "-"}
                      </span>
                    </div>
                    <div className="figma-row">
                      <span className="figma-label">Diploma Passed-Out Year</span>
                      <span className="figma-value">{employee.diplomaYear || "-"}</span>
                    </div>
                  </>
                )}

                {/* Career Gap if present */}
                {(() => {
                  const validGaps = (employee.careerGaps || []).filter(
                    (g) => g && Number(g.gapDuration) > 0 && g.reason && g.reason.trim().length > 0
                  );
                  if (validGaps.length === 0) return null;
                  return (
                    <div className="figma-career-gaps-wrap mt-2">
                      {validGaps.map((gap, idx) => (
                        <div key={idx} className="career-gap-review-card">
                          <div className="career-gap-review-header">
                            <div className="career-gap-review-title-badge">
                              <span>Career Gap ({gap.educationStage || "Education"})</span>
                            </div>
                          </div>
                          <div className="career-gap-review-grid">
                            <div className="career-gap-review-col">
                              <span className="career-gap-col-label">Duration</span>
                              <span className="career-gap-duration-pill">
                                {gap.gapDuration} {gap.gapDuration === 1 ? "Year" : "Years"}
                              </span>
                            </div>
                            <div className="career-gap-review-col" style={{ gridColumn: "span 2" }}>
                              <span className="career-gap-col-label">Reason</span>
                              <p className="career-gap-reason-text mb-0">{gap.reason}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Card 6: Degree */}
            <div className="figma-card" id="section-courses">
              <div className="figma-card-header">
                <div className="figma-card-icon-badge">
                  <img src="/Degree&course.png" alt="Degree" className="figma-card-header-icon" />
                </div>
                <h3 className="figma-card-title">Degree</h3>
              </div>
              <div className="figma-card-body">
                {employee.courses && employee.courses.length > 0 ? (
                  employee.courses.map((course, i) => (
                    <div key={i} className={`figma-degree-item ${i > 0 ? "figma-exp-divider" : ""}`}>
                      <div className="figma-row">
                        <span className="figma-label">Degree / Course</span>
                        <span className="figma-value">{course.courseName || "-"}</span>
                      </div>
                      <div className="figma-row">
                        <span className="figma-label">Course Type</span>
                        <span className="figma-value">{course.courseType || "College / Degree"}</span>
                      </div>
                      <div className="figma-row">
                        <span className="figma-label">College</span>
                        <span className="figma-value">{course.collegeName || "-"}</span>
                      </div>
                      <div className="figma-row">
                        <span className="figma-label">CGPA / Percentage</span>
                        <span className="figma-value">
                          {course.cgpa ? `${course.cgpa}${String(course.cgpa).includes('%') || String(course.cgpa).toLowerCase().includes('cgpa') ? '' : ' CGPA'}` : "-"}
                        </span>
                      </div>
                      <div className="figma-row">
                        <span className="figma-label">Passed-Out Year</span>
                        <span className="figma-value">{course.passedOutYear || "-"}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="figma-empty-placeholder">
                    No degree details added
                  </div>
                )}
              </div>
            </div>

            {/* Card 7: Courses */}
            {Boolean(
              Array.isArray(employee.professionalCertifications) &&
              employee.professionalCertifications.length > 0 &&
              employee.professionalCertifications.some(
                (cert) =>
                  cert &&
                  ((cert.courseName && String(cert.courseName).trim() !== "") ||
                    (cert.institutionName && String(cert.institutionName).trim() !== "") ||
                    (cert.courseType && String(cert.courseType).trim() !== "") ||
                    cert.courseDuration ||
                    cert.durationValue ||
                    cert.certificate)
              )
            ) && (
                <div className="figma-card" id="section-certifications">
                  <div className="figma-card-header">
                    <div className="figma-card-icon-badge">
                      <img src="/Degree&course.png" alt="Courses" className="figma-card-header-icon" />
                    </div>
                    <h3 className="figma-card-title">Courses</h3>
                  </div>
                  <div className="figma-card-body">
                    {employee.professionalCertifications.map((cert, i) => (
                      <div key={i} className={`figma-cert-item ${i > 0 ? "figma-exp-divider" : ""}`}>
                        <div className="figma-row">
                          <span className="figma-label">Course Name</span>
                          <span className="figma-value">{cert.courseName || "-"}</span>
                        </div>
                        <div className="figma-row">
                          <span className="figma-label">Course Type</span>
                          <span className="figma-value">{cert.courseType || "Certification"}</span>
                        </div>
                        <div className="figma-row">
                          <span className="figma-label">Institution</span>
                          <span className="figma-value">{cert.institutionName || "-"}</span>
                        </div>
                        <div className="figma-row">
                          <span className="figma-label">Duration</span>
                          <span className="figma-value">
                            {cert.courseDuration || (cert.durationValue ? `${cert.durationValue} ${cert.durationUnit || "Months"}` : "-")}
                          </span>
                        </div>
                        {/* {cert.certificate && (
                          <div className="figma-row">
                            <span className="figma-label">Certificate</span>
                            <span className="figma-value">
                              <button
                                type="button"
                                onClick={() =>
                                  handleViewDocument({
                                    id: `prof_cert_${i}`,
                                    label: cert.courseName ? `${cert.courseName} Certificate` : "Course Certificate",
                                    key: cert.certificate,
                                    url: cert.certificate,
                                    field: `professionalCertifications.${i}.certificate`,
                                    isUploaded: true,
                                  })
                                }
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  color: "#3857db",
                                  textDecoration: "underline",
                                  cursor: "pointer",
                                  fontSize: "13.5px",
                                  fontWeight: 500,
                                }}
                              >
                                View Certificate
                              </button>
                            </span>
                          </div>
                        )} */}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Card 8: KYC & Bank Details */}
            <div className="figma-card" id="section-bank">
              <div className="figma-card-header">
                <div className="figma-card-icon-badge">
                  <img src="/KYC.png" alt="KYC & Bank Details" className="figma-card-header-icon" />
                </div>
                <h3 className="figma-card-title">KYC & Bank Details</h3>
              </div>
              <div className="figma-card-body">
                <div className="figma-row" id="field-item-aadhaarNo">
                  <span className="figma-label">Aadhaar No</span>
                  <span className="figma-value">{maskAadhaar(employee.aadhaarNo)}</span>
                </div>
                <div className="figma-row" id="field-item-panNo">
                  <span className="figma-label">PAN No</span>
                  <span className="figma-value">{maskPAN(employee.panNo)}</span>
                </div>
                {employee.pfNo && String(employee.pfNo).trim() !== "" && String(employee.pfNo).trim() !== "-" && (
                  <div className="figma-row">
                    <span className="figma-label">PF No</span>
                    <span className="figma-value">{employee.pfNo}</span>
                  </div>
                )}
                {(() => {
                  const sortedBank = (employee.bankHistory || [])
                    .slice()
                    .sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate));
                  const latestBank = sortedBank.find((b) => !b.toDate) || sortedBank[0];
                  return (
                    <>
                      <div className="figma-row" id="field-item-bankName">
                        <span className="figma-label">Bank Name</span>
                        <span className="figma-value">{latestBank?.bankName || "-"}</span>
                      </div>
                      <div className="figma-row" id="field-item-accountHolder">
                        <span className="figma-label">Account Holder</span>
                        <span className="figma-value">{latestBank?.accountHolder || "-"}</span>
                      </div>
                      <div className="figma-row" id="field-item-accountNumber">
                        <span className="figma-label">Account Number</span>
                        <span className="figma-value">{latestBank?.accountNumber || "-"}</span>
                      </div>
                      <div className="figma-row" id="field-item-ifscCode">
                        <span className="figma-label">IFSC Code</span>
                        <span className="figma-value">{latestBank?.ifscCode || "-"}</span>
                      </div>
                      <div className="figma-row" id="field-item-branch">
                        <span className="figma-label">Branch</span>
                        <span className="figma-value">{latestBank?.branch || "-"}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ── Uploaded Documents Section ── */}
          <Section id="section-documents" title="Upload Document" icon={<img src="/Upload.png" alt="Upload Document" className="figma-card-header-icon" />}>
            <div className="doc-view-grid">
              {uploadedDocuments.map((doc) => {
                const isDocRejected = employee?.profileApprovalStatus === "rejected" &&
                  (employee?.rejectedFields?.includes(doc.id) ||
                    employee?.rejectedFields?.includes(doc.field) ||
                    (doc.id === "marksheet10" && employee?.rejectedFields?.includes("certificate10")) ||
                    (doc.id === "marksheet12" && employee?.rejectedFields?.includes("certificate12")) ||
                    ((doc.id === "degreeCertificate" || doc.id.startsWith("course_")) &&
                      (employee?.rejectedFields?.includes("degreeCertificate") || employee?.rejectedFields?.includes("courses"))));

                const isTargetHighlighted = highlightedField === doc.id ||
                  (doc.field && highlightedField === doc.field) ||
                  (doc.id === "marksheet10" && highlightedField === "certificate10") ||
                  (doc.id === "marksheet12" && highlightedField === "certificate12") ||
                  (doc.id === "degreeCertificate" && (highlightedField === "courses" || highlightedField === "degreeCertificate")) ||
                  (doc.id.startsWith("course_") && highlightedField === "courses");

                return (
                  <div
                    key={doc.id}
                    id={`doc-card-${doc.id}`}
                    className={`doc-view-card ${doc.isUploaded ? "has-doc" : "no-doc"} ${isDocRejected ? "rejected-correction-card" : ""} ${isTargetHighlighted ? "rejected-file-highlight-pulse" : ""}`}
                  >
                    <div className="doc-view-card-left">
                      <div className={`doc-icon-badge ${doc.iconType} ${isDocRejected ? "rejected-badge" : ""}`}>
                        <FaFileAlt />
                      </div>
                      <div className="doc-view-details">
                        <span className="doc-view-title" title={doc.label}>{doc.label}</span>
                        <span className={`doc-status-tag ${isDocRejected ? "rejected" : (isDocApproved(doc) ? "approved" : (doc.isUploaded ? "uploaded" : "missing"))}`}>
                          {isDocRejected ? (
                            <>
                              <FaTimesCircle className="status-mini-icon" /> Correction Required
                            </>
                          ) : isDocApproved(doc) ? (
                            <>
                              <FaCheckCircle className="status-mini-icon" style={{ color: "#16a34a" }} /> Approved
                            </>
                          ) : doc.isUploaded ? (
                            <>
                              <FaCheckCircle className="status-mini-icon" /> Uploaded
                            </>
                          ) : (
                            <>
                              <FaTimesCircle className="status-mini-icon" /> Not Uploaded
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="doc-view-card-right">
                      {doc.isUploaded ? (
                        <div className="doc-view-actions-wrap d-flex align-items-center gap-2">
                          <button
                            type="button"
                            className="btn-doc-view"
                            onClick={() => handleViewDocument(doc)}
                            disabled={docLoadingId === doc.id || docDeletingId === doc.id}
                            title="View document (Expires in 2 minutes)"
                          >
                            {docLoadingId === doc.id ? (
                              <>
                                <Spinner animation="border" size="sm" className="me-1" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <FaEye className="me-1" /> View
                              </>
                            )}
                          </button>
                          {canDeleteFiles && (
                            <button
                              type="button"
                              className="btn-doc-delete"
                              onClick={() => initiateDeleteDocument(doc)}
                              disabled={docDeletingId === doc.id || docLoadingId === doc.id}
                              title="Delete document from DB & S3 (Admin only)"
                            >
                              {docDeletingId === doc.id ? (
                                <Spinner animation="border" size="sm" />
                              ) : (
                                <>
                                  <FaTrash className="me-1" /> Delete
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="doc-unavailable-text">No File</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ── Salary History Section ── */}
          <Section title="Salary Details History" icon={<img src="/Salary.png" alt="Salary Details History" className="figma-card-header-icon" />}>
            {salaryLoading ? (
              <div className="text-center py-5">
                <Spinner animation="border" size="md" variant="primary" />
                <p className="mt-2 text-muted">Fetching salary history...</p>
              </div>
            ) : salaryHistory.length > 0 ? (
              <div className="salary-history-table-wrapper animate-in">
                <table className="salary-history-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Period</th>
                      <th>Basic Salary</th>
                      <th>Allowances</th>
                      <th>Total CTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryHistory.map((s, idx) => (
                      <tr key={s._id || idx}>
                        <td>
                          <div className="period-badge-view">
                            {new Date(s.fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {s.toDate ? ` — ${new Date(s.toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : " — Present"}
                          </div>
                        </td>
                        <td className="salary-amt-cell">{formatCurrency(s.basicSalary)}</td>
                        <td className="allowances-cell">
                          <ul className="allowance-list-view">
                            {s.allowances?.map((a, i) => (
                              <li key={i}>
                                <span className="allowance-label">{a.label}:</span>
                                <span className="allowance-val">{formatCurrency(a.value)}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="salary-amt-cell total-ctc">
                          <strong>{formatCurrency(s.totalSalary)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-salary-state">
                <p>No salary records available yet.</p>
              </div>
            )}
          </Section>

          {/* ── Footer Buttons ── */}
          <div className="detailsview-footer" id="detailsview-admin-actions">
            <Button
              variant=""
              className="common-modal-btn btn-small-cancel"
              onClick={() => navigate(-1)}
            >
              Back
            </Button>

            {isAdminView && (employee?.profileApprovalStatus === "pending" || (!employee?.profileApprovalStatus && employee?.profileCompletion >= 100 && !employee?.isProfileCompleted)) && (
              <>
                <Button
                  variant="success"
                  className="common-modal-btn btn-approve"
                  style={{ backgroundColor: "#16a34a", color: "#ffffff", borderColor: "#16a34a" }}
                  onClick={() => setShowApproveModal(true)}
                >
                  Approve Profile
                </Button>
                <Button
                  variant="danger"
                  className="common-modal-btn btn-reject"
                  onClick={() => {
                    setRejectionRemark("");
                    setSelectedRejectedFields([]);
                    setRejectError(false);
                    setShowRejectModal(true);
                  }}
                >
                  Reject Profile
                </Button>
              </>
            )}

            <Button
              onClick={handleEdit}
              disabled={isEmployeeView && requestStatus === "pending"}
              className={`common-modal-btn ${isEmployeeView && requestStatus === "pending"
                ? "btn-disabled"
                : isEmployeeView && employee?.profileApprovalStatus === "rejected"
                  ? "btn-reject"
                  : "btn-update"
                }`}
            >
              {isEmployeeView && requestStatus === "pending" ? (
                <>
                  Request Pending
                </>
              ) : isEmployeeView && employee?.profileApprovalStatus === "pending" ? (
                <>
                  Pending Admin Approval
                </>
              ) : isEmployeeView && employee?.profileApprovalStatus === "rejected" ? (
                <>
                  Update & Resubmit
                </>
              ) : isEmployeeView && requestStatus === "approved" ? (
                <>
                  <FaCheckCircle className="me-2" /> Edit Now
                </>
              ) : isEmployeeView && requestStatus === "rejected" ? (
                <>
                  New Request
                </>
              ) : isAdminView ? (
                "Edit Profile"
              ) : isEmployeeView && (!employee?.isProfileCompleted || employee?.profileCompletion < 100) ? (
                "Edit Profile"
              ) : (
                "Request Edit"
              )}
            </Button>
          </div>
        </div>
        <Modal
          show={showRequestModal}
          onHide={() => setShowRequestModal(false)}
          centered
          className="edit-request-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              Request Profile Edit
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <p className="modal-description">
              Select the sections you want to update and provide a reason. The
              request will be reviewed by admin.
            </p>

            <Form.Group className="mb-2">
              <Form.Label>
                <div className="edit-title">Select sections to edit</div>
              </Form.Label>

              <div className="sections-grid-container">
                {Object.entries(EDIT_SECTIONS).map(([key, sec]) => {
                  const isChecked = sec.fields.every((f) =>
                    requestedFields.includes(f)
                  );
                  return (
                    <div
                      key={key}
                      className={`section-selection-item ${key === 'documents' ? 'full-width' : ''} ${isChecked ? 'selected' : ''}`}
                      onClick={() => toggleSection(sec.fields)}
                      role="button"
                      tabIndex={0}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        ...(key === "documents" ? { gridColumn: "1 / -1" } : {})
                      }}
                    >
                      <input
                        type="checkbox"
                        className="form-check-input me-2 mt-0"
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSection(sec.fields);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: "pointer", flexShrink: 0 }}
                      />
                      <div className="section-content-wrap" style={{ pointerEvents: "none" }}>
                        <div className="section-label">{sec.label}</div>
                        {sec.subLabel && (
                          <div className="section-sublabel">
                            {sec.subLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Form.Group>

            {/* ✅ Selected fields summary badge */}
            {requestedFields.length > 0 && (
              <div
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  marginBottom: "8px",
                  fontSize: "12px",
                  color: "#166534",
                }}
              >
                <strong>Selected:</strong> {requestedFields.join(", ")}
              </div>
            )}

            <Form.Group>
              <Form.Label>
                <div className="edit-title">Request Message</div>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="e.g., Need to update phone number, upload new Aadhaar card and add degree certificate..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                className="request-textarea"
              />
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <button
              onClick={() => setShowRequestModal(false)}
              className="common-modal-btn btn-small-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleSendRequest}
              disabled={requestLoading}
              className="common-modal-btn btn-update"
            >
              {requestLoading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Sending...
                </>
              ) : (
                <>Send Request</>
              )}
            </button>
          </Modal.Footer>
        </Modal>

        {/* ════════════════════════════════════════════════════════════
            STATUS MODAL
        ════════════════════════════════════════════════════════════ */}
        <Modal
          show={showStatusModal}
          onHide={() => setShowStatusModal(false)}
          centered
          className="status-modal"
        >
          <Modal.Body className="text-center py-4 px-4 position-relative">
            <button
              type="button"
              className="btn-close position-absolute top-0 end-0 m-3"
              onClick={() => setShowStatusModal(false)}
              aria-label="Close"
            />

            {requestStatus === "approved" && (
              <>
                <div className="status-icon approved">
                  <FaCheckCircle />
                </div>
                <h4 className="mt-4 mb-3">Request Approved!</h4>
                <p className="text-muted">{statusMessage}</p>
                <div className="d-flex justify-content-end mt-4">
                  <button
                    type="button"
                    className="common-modal-btn btn-confirm-success"
                    onClick={() => {
                      setShowStatusModal(false);
                      navigate("/emp/my-details/edit");
                    }}
                  >
                    Go to Edit Profile
                  </button>
                </div>
              </>
            )}

            {requestStatus === "rejected" && (
              <>
                <div className="status-icon rejected">
                  <FaTimesCircle />
                </div>
                <h4 className="mt-4 mb-3">Request Rejected</h4>
                <p className="text-muted">{statusMessage}</p>
                {editRejectionReason && (
                  <div className="p-3 my-3 rounded bg-light border text-start" style={{ borderColor: "#fee2e2" }}>
                    <strong className="text-secondary small d-block mb-1">Reason from Admin:</strong>
                    <div className="text-danger fw-semibold" style={{ fontSize: "14px", whiteSpace: "pre-wrap" }}>
                      {editRejectionReason}
                    </div>
                  </div>
                )}
                <div className="d-flex justify-content-end mt-4">
                  <button
                    type="button"
                    className="common-modal-btn btn-small-cancel"
                    onClick={() => setShowStatusModal(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {requestStatus === "pending" && (
              <>
                <div className="status-icon pending">
                  <FaClock />
                </div>
                <h4 className="mt-2 mb-1">Request Sent!</h4>
                <p className="text-muted">{statusMessage}</p>
                <div className="d-flex justify-content-end mt-4">
                  <button
                    type="button"
                    className="common-modal-btn btn-small-cancel"
                    onClick={() => setShowStatusModal(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </Modal.Body>
        </Modal>

        {/* ── Admin Approve Modal ── */}
        <Modal
          show={showApproveModal}
          onHide={() => !reviewLoading && setShowApproveModal(false)}
          centered
          className="admin-profile-review-modal"
        >
          <Modal.Header closeButton={!reviewLoading}>
            <Modal.Title className="common-modal-title">Approve Employee Profile</Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center py-4">
            <div className="approve-modal-icon-wrap mb-3">
              <FaCheckCircle style={{ fontSize: "3.5rem", color: "#10b981" }} />
            </div>
            <h5 className="mb-2" style={{ fontSize: "16px", fontWeight: "500" }}>Approve {employee?.name}'s Profile?</h5>
            <p className="text-muted mb-0" style={{ fontSize: "13px" }}>
              Are you sure you want to approve this employee profile? All submitted details and uploaded documents will be verified and marked as approved. The employee will be notified immediately.
            </p>
          </Modal.Body>
          <Modal.Footer className="admin-reject-modal-footer">
            <button
              type="button"
              className="common-modal-btn btn-small-cancel"
              onClick={() => setShowApproveModal(false)}
              disabled={reviewLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="common-modal-btn btn-confirm-success"
              onClick={handleApproveProfile}
              disabled={reviewLoading}
            >
              {reviewLoading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Approving...
                </>
              ) : (
                "Confirm Approval"
              )}
            </button>
          </Modal.Footer>
        </Modal>

        {/* ── Admin Reject Modal ── */}
        <Modal
          show={showRejectModal}
          onHide={() => !reviewLoading && setShowRejectModal(false)}
          centered
          scrollable
          className="admin-profile-review-modal"
        >
          <Modal.Header closeButton={!reviewLoading}>
            <Modal.Title className="common-modal-title">Reject Employee Profile</Modal.Title>
          </Modal.Header>
          <Modal.Body className="admin-reject-modal-body">
            <Form.Group className="mb-3">
              <Form.Label className="rejection-form-label">
                Rejection Remark / Reason <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="e.g. Masked Aadhaar document is missing. Please upload the clear Masked Aadhaar card copy."
                value={rejectionRemark}
                onChange={(e) => setRejectionRemark(e.target.value)}
                isInvalid={rejectError && !rejectionRemark.trim()}
              />
              {rejectError && !rejectionRemark.trim() && (
                <div className="text-danger small">
                  Please provide a rejection remark.
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-0">
              <Form.Label className="rejection-form-label mb-2">
                Select Specific File(s) or Document(s) Needing Correction:
              </Form.Label>
              <div className="rejection-categories-container">
                {REJECTABLE_CATEGORIES.map((catGroup) => (
                  <div key={catGroup.category} className="rejection-cat-block mb-3">
                    <div className="rejection-cat-title">
                      {catGroup.category}
                    </div>
                    <div className="rejection-items-grid">
                      {catGroup.items.map((item) => {
                        const isSelected = selectedRejectedFields.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`rejection-checkbox-item ${isSelected ? "selected" : ""}`}
                            onClick={() => toggleRejectedField(item.id)}
                          >
                            <input
                              type="checkbox"
                              className="form-check-input me-2 mt-0"
                              checked={isSelected}
                              onChange={() => toggleRejectedField(item.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="rejection-item-label">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="admin-reject-modal-footer">
            <button
              type="button"
              className="common-modal-btn btn-small-cancel"
              onClick={() => setShowRejectModal(false)}
              disabled={reviewLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="common-modal-btn btn-update"
              onClick={handleRejectProfile}
              disabled={reviewLoading}
            >
              {reviewLoading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Rejecting...
                </>
              ) : (
                "Submit Rejection"
              )}
            </button>
          </Modal.Footer>
        </Modal>

        {/* ── Delete Document Confirmation Modal (Admin & HR only) ── */}
        <Modal
          show={showDeleteDocModal}
          onHide={() => !docDeletingId && setShowDeleteDocModal(false)}
          centered
          className="admin-profile-review-modal"
        >
          <Modal.Header closeButton={!docDeletingId}>
            <Modal.Title className="common-modal-title text-danger">
              Delete Uploaded Document
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center py-4">
            {/* <div className="approve-modal-icon-wrap mb-3">
              <FaTimesCircle style={{ fontSize: "3.5rem", color: "#dc2626" }} />
            </div> */}
            <h5 className="mb-2" style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937" }}>
              Delete "{docToDelete?.label}"?
            </h5>
            <p className="text-muted mb-2" style={{ fontSize: "13.5px", lineHeight: "1.5" }}>
              Are you sure you want to delete this document for <strong>{employee?.name}</strong>?
            </p>
            {/* <div
              className="p-2 rounded text-start mx-auto"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "12.5px",
                maxWidth: "420px",
              }}
            >
              <strong>Permanent Action:</strong> This file will be permanently deleted from both the database and AWS S3 storage. Only Admin and HR are permitted to delete employee uploaded files.
            </div> */}
          </Modal.Body>
          <Modal.Footer className="admin-reject-modal-footer">
            <button
              type="button"
              className="common-modal-btn btn-small-cancel"
              onClick={() => {
                setShowDeleteDocModal(false);
                setDocToDelete(null);
              }}
              disabled={Boolean(docDeletingId)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="common-modal-btn btn-reject"
              style={{ backgroundColor: "#dc2626", color: "#ffffff", borderColor: "#dc2626" }}
              onClick={handleConfirmDelete}
              disabled={Boolean(docDeletingId)}
            >
              {docDeletingId ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Deleting...
                </>
              ) : (
                <>
                  Delete
                </>
              )}
            </button>
          </Modal.Footer>
        </Modal>

        {/* ── In-Page Document Viewer Overlay (Same Page, No URL Exposed, 2-Min Expiry) ── */}
        {viewerDoc && (
          <div className="doc-viewer-overlay">
            {/* Top Blue Header Bar */}
            <div className="doc-viewer-header">
              <div className="doc-viewer-title" title={viewerDoc.label}>
                {viewerDoc.label}
              </div>
              <div className="doc-viewer-header-right">
                <div className="doc-viewer-expiry-pill">
                  <FaClock className="me-1" />
                  <span>EXPIRES: {formatTimer(viewerTimer)}</span>
                </div>
                <button
                  type="button"
                  className="doc-viewer-close-btn"
                  onClick={handleCloseViewer}
                  title="Close Viewer"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Document Content Layout: Viewport on Left, Navigation Sidebar on Right */}
            <div className="doc-viewer-content-layout">
              {/* Document Viewport */}
              <div className="doc-viewer-body">
                {docLoadingId ? (
                  <div className="doc-viewer-loading-state">
                    <Spinner animation="border" variant="light" style={{ width: "2.8rem", height: "2.8rem" }} />
                    <span className="text-white mt-3" style={{ fontSize: "14px", fontWeight: "500" }}>
                      Loading document...
                    </span>
                  </div>
                ) : isImageFile(viewerDoc.url, viewerDoc.key) ? (
                  <img
                    key={viewerDoc.url}
                    src={viewerDoc.url}
                    alt={viewerDoc.label || "Document"}
                    className="doc-viewer-image"
                  />
                ) : (
                  <iframe
                    key={viewerDoc.url}
                    src={viewerDoc.url}
                    title={viewerDoc.label || "Document"}
                    className="doc-viewer-frame"
                  />
                )}
              </div>

              {/* Right Sidebar for Documents Navigation */}
              <div className="doc-viewer-sidebar">
                <div className="doc-viewer-sidebar-header">
                  <div className="doc-viewer-sidebar-title">
                    <FaFileAlt className="me-2" style={{ color: "#38bdf8" }} />
                    <span>Documents</span>
                  </div>
                  {viewableDocuments.length > 0 && (
                    <span className="doc-viewer-sidebar-badge">
                      {currentDocIndex >= 0 ? currentDocIndex + 1 : 1} / {viewableDocuments.length}
                    </span>
                  )}
                </div>

                <div className="doc-viewer-sidebar-list">
                  {viewableDocuments.map((doc, idx) => {
                    const isActive = idx === currentDocIndex;
                    const docRejected = isDocRejected(doc);
                    const docApproved = isDocApproved(doc);

                    return (
                      <div
                        key={doc.id || idx}
                        className={`doc-viewer-sidebar-item ${isActive ? "active" : ""} ${docRejected ? "is-rejected" : ""} ${docApproved ? "is-approved" : ""}`}
                        onClick={() => {
                          if (!isActive && !docLoadingId) {
                            handleViewDocument(doc, idx);
                          }
                        }}
                        title={doc.label}
                      >
                        <div className="doc-viewer-item-index">{idx + 1}</div>
                        <div className="doc-viewer-item-details">
                          <span className="doc-viewer-item-title">{doc.label}</span>
                          <span className="doc-viewer-item-status">
                            {docRejected
                              ? "Correction Required"
                              : docApproved
                              ? "Approved"
                              : isActive
                              ? "Currently viewing"
                              : "Click to view"}
                          </span>
                        </div>
                        {docRejected ? (
                          <FaTimesCircle className="ms-auto" style={{ fontSize: "14px", color: "#ef4444", flexShrink: 0 }} title="Document Rejected" />
                        ) : docApproved ? (
                          <FaCheckCircle className="ms-auto" style={{ fontSize: "14px", color: "#22c55e", flexShrink: 0 }} title="Document Approved" />
                        ) : isActive ? (
                          <FaCheckCircle className="ms-auto" style={{ fontSize: "14px", color: "#2563eb", flexShrink: 0 }} />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Controls: Approve & Reject buttons placed directly above Back & Next buttons */}
                <div className="doc-viewer-sidebar-footer">
                  {isAdminView && isLastDoc && !isProfileApproved && !areAllDocsApproved && (
                    <div className="doc-viewer-approval-actions">
                      <button
                        type="button"
                        className="common-modal-btn btn-confirm-success"
                        onClick={handleApproveAllDocuments}
                        disabled={docReviewLoading}
                        title="Approve All Documents"
                      >
                        {docReviewLoading && docReviewAction === "approve" ? (
                          <Spinner animation="border" size="sm" className="me-1" />
                        ) : (
                          <FaCheckCircle className="me-1" />
                        )}
                        Approve
                      </button>
                      <button
                        type="button"
                        className="common-modal-btn btn-reject"
                        onClick={handleOpenRejectDocModal}
                        disabled={docReviewLoading}
                        title="Reject Documents"
                      >
                        {docReviewLoading && docReviewAction === "reject" ? (
                          <Spinner animation="border" size="sm" className="me-1" />
                        ) : (
                          <FaTimesCircle className="me-1" />
                        )}
                        Reject
                      </button>
                    </div>
                  )}

                  <div className="doc-viewer-nav-actions">
                    <button
                      type="button"
                      className="doc-viewer-nav-btn btn-prev"
                      onClick={handlePrevDocument}
                      disabled={currentDocIndex <= 0 || Boolean(docLoadingId)}
                      title="Previous Document"
                    >
                      <FaChevronLeft className="me-1" /> Back
                    </button>
                    {isLastDoc ? (
                      <button
                        type="button"
                        className="doc-viewer-nav-btn btn-next"
                        onClick={handleCloseViewer}
                        title="Close Document Viewer"
                      >
                        Close <FaTimes className="ms-1" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="doc-viewer-nav-btn btn-next"
                        onClick={handleNextDocument}
                        disabled={Boolean(docLoadingId)}
                        title="Next Document"
                      >
                        Next <FaChevronRight className="ms-1" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 2-Minute Expiry Continue Popup Modal in Center ── */}
            {showContinueModal && (
              <div className="doc-viewer-modal-backdrop">
                <div className="doc-viewer-modal-dialog">
                  <div className="text-center p-4">
                    <div className="mb-3">
                      <FaClock style={{ fontSize: "44px", color: "#f59e0b" }} />
                    </div>
                    <h4 className="fw-bold text-dark mb-2" style={{ fontSize: "18px" }}>
                      Viewing Session Expired
                    </h4>
                    <p className="text-muted mb-4" style={{ fontSize: "13.5px", lineHeight: "1.5" }}>
                      The 2-minute viewing session for this document has ended. Would you like to continue viewing?
                    </p>
                    <div className="d-flex justify-content-center gap-3">
                      <Button
                        variant="secondary"
                        onClick={handleCloseViewer}
                        style={{
                          minWidth: "110px",
                          borderRadius: "8px",
                          fontSize: "13.5px",
                          fontWeight: 500
                        }}
                      >
                        Close
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleContinueViewer}
                        style={{
                          minWidth: "120px",
                          borderRadius: "8px",
                          backgroundColor: "#1D59DC",
                          borderColor: "#1D59DC",
                          fontSize: "13.5px",
                          fontWeight: 600
                        }}
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Single Document Reject Reason Modal (Rendered Directly OVER Document Viewer) ── */}
            {showRejectDocModal && (
              <div
                className="doc-viewer-modal-backdrop"
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: "100vw",
                  height: "100vh",
                  zIndex: 1000005,
                  backgroundColor: "rgba(0, 0, 0, 0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget && !docReviewLoading) {
                    setShowRejectDocModal(false);
                  }
                }}
              >
                <div
                  className="doc-viewer-modal-dialog"
                  style={{
                    maxWidth: "500px",
                    width: "92%",
                    padding: "24px",
                    borderRadius: "16px",
                    background: "#ffffff",
                    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5)",
                    position: "relative",
                    zIndex: 1000006,
                    maxHeight: "90vh",
                    overflowY: "auto",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "17px" }}>
                      Reject Documents
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => !docReviewLoading && setShowRejectDocModal(false)}
                      aria-label="Close"
                      disabled={docReviewLoading}
                      style={{ cursor: "pointer" }}
                    />
                  </div>

                  <p className="text-muted mb-3" style={{ fontSize: "13.5px", lineHeight: "1.5" }}>
                    Please provide a reason for rejecting. The employee will be required to re-upload only the rejected document(s), and the new file will replace the previous document in S3 storage.
                  </p>

                  {/* Select which documents need re-upload */}
                  {viewableDocuments.length > 0 && (
                    <div className="mb-3">
                      <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                        Select Document(s) Needing Re-upload:
                      </label>
                      <div
                        style={{
                          maxHeight: "140px",
                          overflowY: "auto",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          background: "#f8fafc",
                        }}
                      >
                        {viewableDocuments.map((d) => {
                          const docKey = d.field || d.id;
                          const isChecked = selectedRejectDocs.includes(docKey);
                          return (
                            <label
                              key={d.id || d.field}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "13px",
                                padding: "4px 0",
                                cursor: "pointer",
                                color: "#334155",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRejectDocs((prev) => [...prev, docKey]);
                                  } else {
                                    setSelectedRejectDocs((prev) => prev.filter((k) => k !== docKey));
                                  }
                                }}
                                style={{ cursor: "pointer" }}
                              />
                              <span>{d.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="fw-semibold text-dark mb-1" style={{ fontSize: "13px" }}>
                      Rejection Remark <span className="text-danger">*</span>
                    </label>
                    <textarea
                      rows={3}
                      className={`form-control ${docRejectError ? "is-invalid" : ""}`}
                      placeholder="e.g. Document is blurry or illegible. Please re-upload a clear copy."
                      value={docRejectRemark}
                      onChange={(e) => {
                        setDocRejectRemark(e.target.value);
                        if (docRejectError) setDocRejectError(false);
                      }}
                      style={{ fontSize: "13.5px" }}
                      autoFocus
                    />
                    {docRejectError && (
                      <div className="text-danger mt-1" style={{ fontSize: "12px" }}>
                        Please enter a reason for rejecting.
                      </div>
                    )}
                  </div>

                  <div className="d-flex justify-content-end gap-2 mt-4">
                    <button
                      type="button"
                      className="common-modal-btn btn-small-cancel"
                      onClick={() => setShowRejectDocModal(false)}
                      disabled={docReviewLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="common-modal-btn btn-reject"
                      onClick={handleConfirmRejectDoc}
                      disabled={docReviewLoading}
                    >
                      {docReviewLoading ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Rejecting...
                        </>
                      ) : (
                        "Confirm Rejection"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   REUSABLE SUB-COMPONENTS
════════════════════════════════════════════════════════════ */
const Section = ({ title, id, icon, children }) => (
  <div id={id} className="figma-card figma-card-full-width mt-4">
    <div className="figma-card-header">
      <div className="figma-card-icon-badge">
        {icon || <FaFileAlt />}
      </div>
      <h3 className="figma-card-title">{title}</h3>
    </div>
    <div className="figma-card-body">
      {children}
    </div>
  </div>
);

const Grid = ({ children }) => (
  <div className="detailsview-grid">{children}</div>
);

const Item = ({ id, label, value, full, className = "" }) => (
  <div id={id} className={`detailsview-item ${full ? "full" : ""} ${className}`}>
    <span>{label}</span>
    <p>{value || "-"}</p>
  </div>
);

export default DetailsView;
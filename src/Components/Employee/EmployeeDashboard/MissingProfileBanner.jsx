import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiChevronRight,
  FiFileText,
  FiUploadCloud,
  FiUser,
  FiBriefcase,
  FiBookOpen,
  FiCheckSquare
} from "react-icons/fi";
import { checkProfileRestriction } from "../../../utils/profileCompletionRestriction";

const MissingProfileBanner = ({ employee, profileCompletion = 0 }) => {
  const navigate = useNavigate();

  if (!employee) return null;

  const completion = Math.min(Math.max(Number(profileCompletion || employee.profileCompletion || 0), 0), 100);

  if (completion >= 100 || employee.isProfileCompleted === true) {
    return null;
  }

  const restriction = checkProfileRestriction({
    ...employee,
    role: "employee",
    profileCompletion: completion,
  });

  // Calculate Missing Fields
  const educationPath = employee.educationPath || (employee.school12 ? "12th" : "");

  const hasCourseCertificate =
    (Array.isArray(employee.courses) &&
      employee.courses.length > 0 &&
      employee.courses.some(
        (c) =>
          c &&
          ((c.certificate && (typeof c.certificate === "string" || c.certificate instanceof File) && (typeof c.certificate !== "string" || c.certificate.trim() !== "")) ||
            (c.certificateUrl && typeof c.certificateUrl === "string" && c.certificateUrl.trim() !== ""))
      )) ||
    (employee.degreeCertificate && typeof employee.degreeCertificate === "string" && employee.degreeCertificate.trim() !== "") ||
    (employee.degreeCertificateUrl && typeof employee.degreeCertificateUrl === "string" && employee.degreeCertificateUrl.trim() !== "") ||
    (employee.courseCertificate && typeof employee.courseCertificate === "string" && employee.courseCertificate.trim() !== "") ||
    (employee.courseCertificateUrl && typeof employee.courseCertificateUrl === "string" && employee.courseCertificateUrl.trim() !== "") ||
    (employee.ugDegreeCertificate && typeof employee.ugDegreeCertificate === "string" && employee.ugDegreeCertificate.trim() !== "") ||
    (employee.ugDegreeCertificateUrl && typeof employee.ugDegreeCertificateUrl === "string" && employee.ugDegreeCertificateUrl.trim() !== "") ||
    (employee.pgDegreeCertificate && typeof employee.pgDegreeCertificate === "string" && employee.pgDegreeCertificate.trim() !== "") ||
    (employee.pgDegreeCertificateUrl && typeof employee.pgDegreeCertificateUrl === "string" && employee.pgDegreeCertificateUrl.trim() !== "");

  const requiredFields = [
    { key: "emergencyContact", label: "Emergency Contact", type: "field", category: "Personal" },
    { key: "fatherOccupation", label: "Father Occupation", type: "field", category: "Family" },
    { key: "motherOccupation", label: "Mother Occupation", type: "field", category: "Family" },
    { key: "dob", label: "Date of Birth", type: "field", category: "Personal" },
    { key: "gender", label: "Gender", type: "field", category: "Personal" },
    { key: "phone", label: "Phone Number", type: "field", category: "Personal" },
    { key: "bloodGroup", label: "Blood Group", type: "field", category: "Personal" },
    { key: "address", label: "Address", type: "field", category: "Personal" },
    { key: "fatherName", label: "Father Name", type: "field", category: "Family" },
    { key: "motherName", label: "Mother Name", type: "field", category: "Family" },
    { key: "status", label: "Employment Status", type: "field", category: "Employment" },

    { key: "school10", label: "10th School", type: "field", category: "Education" },
    { key: "marks10", label: "10th Marks", type: "field", category: "Education" },
    { key: "marksheet10", label: "10th Marksheet", type: "document", category: "Education" },

    { key: "courses", label: "Course Details", type: "field", category: "Education" },
    { key: "degreeCertificate", label: "Degree Certificate", type: "document", category: "Education" },

    { key: "aadhaarNo", label: "Aadhaar Number", type: "field", category: "KYC" },
    { key: "panNo", label: "PAN Number", type: "field", category: "KYC" },
    { key: "aadhaarFile", label: "Aadhaar Upload", type: "document", category: "KYC" },
    { key: "panFile", label: "PAN Card Document", type: "document", category: "KYC" },

    { key: "bankName", label: "Bank Name", type: "field", category: "Bank" },
    { key: "accountHolder", label: "Account Holder", type: "field", category: "Bank" },
    { key: "accountNumber", label: "Account Number", type: "field", category: "Bank" },
    { key: "ifscCode", label: "IFSC Code", type: "field", category: "Bank" },
    { key: "branch", label: "Branch Name", type: "field", category: "Bank" },
    { key: "passbookFile", label: "Bank Passbook", type: "document", category: "Bank" },
  ];

  if (
    educationPath === "12th" ||
    (!educationPath && (employee.school12 || employee.marks12 || employee.marksheet12))
  ) {
    requiredFields.splice(
      14,
      0,
      { key: "school12", label: "12th School", type: "field", category: "Education" },
      { key: "marks12", label: "12th Marks", type: "field", category: "Education" },
      { key: "marksheet12", label: "12th Marksheet", type: "document", category: "Education" }
    );
  }

  const missingList = requiredFields.filter(({ key }) => {
    if (key === "degreeCertificate") {
      return !hasCourseCertificate;
    }
    const val = employee[key];
    if (val === null || val === undefined) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  });

  if (missingList.length === 0 || completion >= 100) return null;

  const handleNavigate = (fieldKey) => {
    navigate("/emp/my-details/edit", {
      state: { scrollToField: fieldKey || "emergencyContact" }
    });
  };

  // Dynamic icon selection
  const getItemIcon = (item) => {
    if (item.type === "document") {
      if (item.key.includes("aadhaar") || item.key.includes("Upload")) {
        return <FiUploadCloud className="dash-item-icon doc-icon" />;
      }
      return <FiFileText className="dash-item-icon doc-icon" />;
    }
    if (item.key.includes("Occupation") || item.key.includes("status")) {
      return <FiBriefcase className="dash-item-icon" />;
    }
    if (item.category === "Family" || item.category === "Personal") {
      return <FiUser className="dash-item-icon" />;
    }
    if (item.category === "Education") {
      return <FiBookOpen className="dash-item-icon" />;
    }
    return <FiFileText className="dash-item-icon" />;
  };

  // SVG Circular progress values
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * completion) / 100;

  return (
    <div className="dash-profile-center-container">
      {/* 1. TOP PROFILE SUMMARY AREA (1 ROW, 2 COLUMNS) */}
      <div className="dash-pc-top-grid">
        {/* Left Column: Complete Your Profile Card */}
        <div className="dash-pc-hero-card">
          <div className="dash-pc-hero-icon-box">
            <svg
              className="dash-pc-hero-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <polyline points="16 11 18 13 22 9" />
            </svg>
          </div>
          <div className="dash-pc-hero-text">
            <h4 className="dash-pc-hero-title">Complete Your Profile</h4>
            <p className="dash-pc-hero-status">
              Your profile is <span className="dash-pc-status-pct">{completion}%</span> complete
            </p>
            <p className="dash-pc-hero-desc">
              {restriction.isRestricted ? (
                <span style={{ color: "#dc2626", fontWeight: "600" }}>
                  <strong>Access Restricted:</strong> Your 7-day period has expired. You must complete your profile 100% to access other pages.
                </span>
              ) : restriction.isLastDay ? (
                <span style={{ color: "#b45309", fontWeight: "600" }}>
                  <strong>Today is your last day!</strong> Please complete your profile 100% today. If not completed today, access to other pages will be restricted until your profile is completed.
                </span>
              ) : restriction.daysRemaining > 0 ? (
                <span>
                  <strong style={{ color: "#64748b" , fontWeight:"500"}}>7-Day Completion Period:</strong> <span style={{ color: "#000000" }}>{restriction.daysRemaining}</span> day{restriction.daysRemaining === 1 ? "" : "s"} remaining to complete your profile to 100%. Complete the remaining details to maintain unrestricted access.
                </span>
              ) : (
                "Complete the remaining details and upload documents to finish your profile."
              )}
            </p>
          </div>
        </div>

        {/* Right Column: Circular Progress & Bar Chart at Right Corner */}
        <div className="dash-pc-metric-card">
          <div className="dash-pc-circle-wrap">
            <svg className="dash-pc-circle-svg" viewBox="0 0 68 68">
              <circle
                className="dash-pc-circle-bg"
                cx="34"
                cy="34"
                r={radius}
                strokeWidth="5.5"
              />
              <circle
                className="dash-pc-circle-progress"
                cx="34"
                cy="34"
                r={radius}
                strokeWidth="5.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="dash-pc-circle-text">{completion}%</div>
          </div>

          <div className="dash-pc-metric-details">
            <div className="dash-pc-bar-track">
              <div
                className="dash-pc-bar-fill"
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="dash-pc-remaining-text">
              <FiAlertCircle className="dash-pc-rem-icon" />
              <span>{missingList.length} items remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. "COMPLETE THESE DETAILS" SECTION */}
      <div className="dash-pc-details-section">
        <div className="dash-pc-details-header">
          <div className="dash-pc-details-header-left">
            <div className="dash-pc-details-icon-box">
              <FiCheckSquare className="dash-pc-details-icon" />
            </div>
            <div>
              <h5 className="dash-pc-details-title">Complete These Details</h5>
              <p className="dash-pc-details-subtitle">
                Finish the following items to complete your profile.
              </p>
            </div>
          </div>
          <div className="dash-pc-details-badge">
            <FiAlertCircle className="dash-pc-badge-icon" />
            <span>{missingList.length} items remaining</span>
          </div>
        </div>

        {/* 3. THREE-COLUMN ACTION ROWS */}
        <div className="dash-pc-rows-grid">
          {missingList.map((item, idx) => {
            const isDoc = item.type === "document";
            return (
              <div
                key={item.key || idx}
                className={`dash-pc-action-row ${isDoc ? "doc-row" : "field-row"}`}
                onClick={() => handleNavigate(item.key)}
                title={`Click to ${isDoc ? "upload" : "update"} ${item.label}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleNavigate(item.key);
                  }
                }}
              >
                <div className="dash-pc-row-left">
                  <div className={`dash-pc-row-icon-box ${isDoc ? "doc-icon-box" : "field-icon-box"}`}>
                    {getItemIcon(item)}
                  </div>
                  <div className="dash-pc-row-text">
                    <span className="dash-pc-row-name">{item.label}</span>
                    <span className={`dash-pc-row-tag ${isDoc ? "doc-tag" : "field-tag"}`}>
                      {isDoc ? "Document Upload" : "Required Detail"}
                    </span>
                  </div>
                </div>

                <div className="dash-pc-row-right">
                  <button
                    type="button"
                    className={`dash-pc-row-btn ${isDoc ? "doc-btn" : "field-btn"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNavigate(item.key);
                    }}
                  >
                    <span>{isDoc ? "Upload \u2192" : "Update \u2192"}</span>
                  </button>
                  <FiChevronRight className={`dash-pc-row-chevron ${isDoc ? "doc-chevron" : ""}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MissingProfileBanner;

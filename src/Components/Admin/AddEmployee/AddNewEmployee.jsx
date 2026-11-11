import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { portalInstance } from "../../../Services/instance";
import CustomDropdown from "../../Common/CustomDropdown";
import { useUser } from "../../UserContext";
import { canHrAddEmployee } from "../../../utils/hrAccessHelper";
import "./AddEmployee.css";

import "react-toastify/dist/ReactToastify.css";

const AddEmployee = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const canAdd = canHrAddEmployee(user);

  if (user?.isHr && user?.role !== "admin" && !canAdd) {
    return (
      <div className="addemployee-page">
        <Sidebar />
        <div className="addemployee-form-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "48px 32px", maxWidth: "560px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "44px", marginBottom: "16px" }}>🔒</div>
            <h3 style={{ color: "#1e293b", fontSize: "20px", marginBottom: "10px", fontWeight: "700" }}>Access Restricted</h3>
            <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
              Adding new employees is currently disabled for HR accounts per the Portal Access Configuration.
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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    dateJoined: "",
    status: "full_time",
    empId: "",
    probationPeriod: "no",
    probationPeriodMonths: "",
    gender: "male",
  });

  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [activeOtherField, setActiveOtherField] = useState(null);
  const [newDepartmentVal, setNewDepartmentVal] = useState("");
  const [newDesignationVal, setNewDesignationVal] = useState("");

  React.useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await portalInstance.get("/data/employees/basic");
        if (res.data?.success) {
          const emps = res.data.employees || [];

          const deptMap = new Map();
          const desigMap = new Map();

          const normalizeDept = (d) => {
            if (!d || typeof d !== "string") return "";
            const str = d.trim();
            const lower = str.toLowerCase();
            if (lower.includes("techical support") || lower.includes("technical support")) {
              return "Technical Support and API Integration";
            }
            return str;
          };

          const normalizeDesig = (d) => {
            if (!d || typeof d !== "string") return "";
            const str = d.trim();
            const lower = str.toLowerCase();
            if (lower === "mern stack" || lower === "mern stack developer" || lower === "mern stack dev") {
              return "MERN Stack Developer";
            }
            return str;
          };

          emps.forEach((e) => {
            if (e.department) {
              const norm = normalizeDept(e.department);
              if (norm && !deptMap.has(norm.toLowerCase())) {
                deptMap.set(norm.toLowerCase(), norm);
              }
            }
            if (e.designation) {
              const norm = normalizeDesig(e.designation);
              if (norm && !desigMap.has(norm.toLowerCase())) {
                desigMap.set(norm.toLowerCase(), norm);
              }
            }
          });

          setDepartments(Array.from(deptMap.values()).sort());
          setDesignations(Array.from(desigMap.values()).sort());
        }
      } catch (err) {
        console.error("Error fetching department metadata from backend:", err);
      }
    };
    fetchMeta();
  }, []);

  const handleDepartmentToggle = (val) => {
    if (val === "Add") {
      setActiveOtherField("department");
      setNewDepartmentVal("");
    } else {
      setActiveOtherField(null);
      setFormData((prev) => ({ ...prev, department: val }));
    }
  };

  const handleAddDepartment = () => {
    const trimmed = newDepartmentVal.trim();
    if (!trimmed) {
      toast.warning("Department name cannot be empty");
      return;
    }
    setDepartments((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setFormData((prev) => ({ ...prev, department: trimmed }));
    setActiveOtherField(null);
    setNewDepartmentVal("");
  };

  const handleDesignationToggle = (val) => {
    if (val === "Add") {
      setActiveOtherField("designation");
      setNewDesignationVal("");
    } else {
      setActiveOtherField(null);
      setFormData((prev) => ({ ...prev, designation: val }));
    }
  };

  const handleAddDesignation = () => {
    const trimmed = newDesignationVal.trim();
    if (!trimmed) {
      toast.warning("Designation name cannot be empty");
      return;
    }
    setDesignations((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setFormData((prev) => ({ ...prev, designation: trimmed }));
    setActiveOtherField(null);
    setNewDesignationVal("");
  };

  const showEmpId = formData.status === "part_time";

  const statusOptions = [
    { value: "full_time", label: "Full-Time" },
    { value: "part_time", label: "Part-Time" },
  ];

  const probationOptions = [
    { value: "no", label: "No (Direct Permanent)" },
    { value: "yes", label: "Yes (Probation Period)" },
  ];

  const genderOptions = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "empId") {
      return setFormData((prev) => ({
        ...prev,
        empId: value
          .replace(/\s+/g, "")
          .toUpperCase()
          .replace(/[^A-Z0-9-]/g, ""),
      }));
    }

    if (name === "status") {
      return setFormData((prev) => ({
        ...prev,
        status: value,
        empId: value === "full_time" ? "" : prev.empId,
      }));
    }

    if (name === "email") {
      return setFormData((prev) => ({
        ...prev,
        email: value.replace(/\s+/g, "").toLowerCase(),
      }));
    }

    if (name === "phone") {
      return setFormData((prev) => ({
        ...prev,
        phone: value.replace(/\D/g, "").slice(0, 10),
      }));
    }

    if (name === "name") {
      return setFormData((prev) => ({
        ...prev,
        name: value.replace(/[^a-zA-Z\s]/g, ""),
      }));
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return toast.warning("Please enter full name");
    if (!formData.email.trim()) return toast.warning("Please enter email");
    if (formData.phone.length !== 10)
      return toast.warning("Phone must be 10 digits");
    if (!formData.department.trim())
      return toast.warning("Please enter department");
    if (!formData.designation.trim())
      return toast.warning("Please enter designation");
    if (!formData.dateJoined) return toast.warning("Please select date joined");
    if (!formData.status) return toast.warning("Please select status");

    if (formData.probationPeriod === "yes") {
      const months = Number(formData.probationPeriodMonths);
      if (!formData.probationPeriodMonths || isNaN(months) || months <= 0) {
        return toast.warning("Please enter valid probation period in months (e.g. 3, 6)");
      }
    }

    if (formData.status === "part_time") {
      const empId = formData.empId.trim();

      if (!empId) {
        return toast.error("Please enter Employee ID");
      }

      if (!/^[A-Z0-9-]{3,20}$/.test(empId)) {
        return toast.error(
          "Employee ID must be 3–20 characters (A-Z, 0-9, hyphen only)"
        );
      }
    }

    try {
      setLoading(true);

      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name.trim());
      formDataToSend.append("email", formData.email.trim());
      formDataToSend.append("phone", formData.phone);
      formDataToSend.append("department", formData.department.trim());
      formDataToSend.append("designation", formData.designation.trim());
      formDataToSend.append("dateJoined", formData.dateJoined);
      formDataToSend.append("employmentType", formData.status);
      formDataToSend.append("probationPeriod", formData.probationPeriod);
      formDataToSend.append("gender", formData.gender);

      if (formData.probationPeriod === "yes") {
        formDataToSend.append("probationPeriodMonths", formData.probationPeriodMonths);
      }

      if (showEmpId) {
        formDataToSend.append("empId", formData.empId.trim());
      }

      const response = await portalInstance.post(
        "/users/add-employee",
        formDataToSend
      );

      toast.success(
        "Employee added successfully! An email has been sent to them.",
        {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          className: "success-slide-toast",
          bodyClassName: "toast-body-custom",
        }
      );

      setFormData({
        name: "",
        email: "",
        phone: "",
        department: "",
        designation: "",
        dateJoined: "",
        status: "full_time",
        empId: "",
        probationPeriod: "no",
        probationPeriodMonths: "",
        gender: "male",
      });

      setTimeout(() => {
        navigate("/admin/employees/manage-employee");
      }, 1800);
    } catch (err) {
      console.error("Add employee error:", err);
      const errorMsg =
        err?.response?.data?.message || "Failed to add employee";

      if (errorMsg.toLowerCase().includes("email already")) {
        toast.error("Email already registered", {
          position: "top-right",
          autoClose: 3500,
          className: "error-slide-toast",
        });
      } else if (
        errorMsg.toLowerCase().includes("phone") ||
        errorMsg.toLowerCase().includes("mobile")
      ) {
        toast.error("Mobile number already registered", {
          position: "top-right",
          autoClose: 3500,
          className: "error-slide-toast",
        });
      } else {
        toast.error(errorMsg, {
          position: "top-right",
          autoClose: 4000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatIndianNumber = (num) => {
    if (!num) return "";

    const x = num.toString();
    const lastThree = x.slice(-3);
    const otherNumbers = x.slice(0, -3);

    if (otherNumbers !== "") {
      return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
    }
    return lastThree;
  };

  const numberToWords = (num) => {
    if (!num || Number(num) === 0) return "";

    const a = [
      "", "One", "Two", "Three", "Four", "Five", "Six",
      "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
      "Thirteen", "Fourteen", "Fifteen", "Sixteen",
      "Seventeen", "Eighteen", "Nineteen"
    ];

    const b = [
      "", "", "Twenty", "Thirty", "Forty",
      "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ];

    const inWords = (n) => {
      if (n < 20) return a[n];
      if (n < 100)
        return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
      if (n < 1000)
        return (
          a[Math.floor(n / 100)] +
          " Hundred" +
          (n % 100 ? " " + inWords(n % 100) : "")
        );
      if (n < 100000)
        return (
          inWords(Math.floor(n / 1000)) +
          " Thousand" +
          (n % 1000 ? " " + inWords(n % 1000) : "")
        );
      if (n < 10000000)
        return (
          inWords(Math.floor(n / 100000)) +
          " Lakh" +
          (n % 100000 ? " " + inWords(n % 100000) : "")
        );

      return (
        inWords(Math.floor(n / 10000000)) +
        " Crore" +
        (n % 10000000 ? " " + inWords(n % 10000000) : "")
      );
    };

    return inWords(Number(num)) + " Rupees";
  };

  return (
    <div className="add-emp-layout">
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />

      <Sidebar />

      <main className="add-emp-main">
          {/* <div className="add-emp-header">
            <h1>New Employee Details</h1>
            <span className="add-emp-subheader">
              Fill in the basic details to get started
            </span>
          </div> */}

          <div className="add-emp-form-grid">
            <div className="add-emp-form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter full name"
              />
            </div>

            <div className="add-emp-form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@company.com"
              />
            </div>

            <div className="add-emp-form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter 10-digit number"
                maxLength={10}
              />
            </div>

            <div className="add-emp-form-group">
              <label>Department</label>
              {activeOtherField === "department" ? (
                <div className="add-emp-inline-add">
                  <input
                    type="text"
                    className="add-emp-inline-input"
                    placeholder="Type new department..."
                    value={newDepartmentVal}
                    autoFocus
                    onChange={(e) => setNewDepartmentVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddDepartment();
                    }}
                  />
                  <button
                    type="button"
                    className="add-emp-inline-save"
                    onClick={handleAddDepartment}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <CustomDropdown
                  options={[
                    ...departments.map((d) => ({ value: d, label: d })),
                    { value: "Add", label: "Add" },
                  ].filter((v, i, a) => a.findIndex((t) => t.value === v.value) === i)}
                  value={formData.department}
                  onChange={(val) => handleDepartmentToggle(val)}
                  placeholder="Select Department"
                />
              )}
            </div>

            <div className="add-emp-form-group">
              <label>Designation / Role</label>
              {activeOtherField === "designation" ? (
                <div className="add-emp-inline-add">
                  <input
                    type="text"
                    className="add-emp-inline-input"
                    placeholder="Type new designation..."
                    value={newDesignationVal}
                    autoFocus
                    onChange={(e) => setNewDesignationVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddDesignation();
                    }}
                  />
                  <button
                    type="button"
                    className="add-emp-inline-save"
                    onClick={handleAddDesignation}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <CustomDropdown
                  options={[
                    ...designations.map((d) => ({ value: d, label: d })),
                    { value: "Add", label: "Add" },
                  ].filter((v, i, a) => a.findIndex((t) => t.value === v.value) === i)}
                  value={formData.designation}
                  onChange={(val) => handleDesignationToggle(val)}
                  placeholder="Select Designation"
                />
              )}
            </div>

            <div className="add-emp-form-group">
              <label>Date of Joining</label>
              <input
                type="date"
                name="dateJoined"
                value={formData.dateJoined}
                onChange={handleChange}
              />
            </div>

            <div className="add-emp-form-group">
              <label>Employment Status</label>
              <CustomDropdown
                options={statusOptions}
                value={formData.status}
                onChange={(val) => handleChange({ target: { name: "status", value: val } })}
                placeholder="Select Status"
              />
            </div>

            <div className="add-emp-form-group">
              <label>Gender</label>
              <CustomDropdown
                options={genderOptions}
                value={formData.gender}
                onChange={(val) => handleChange({ target: { name: "gender", value: val } })}
                placeholder="Select Gender"
              />
            </div>

            <div className="add-emp-form-group" style={{ marginTop: "-6px" }}>
              <label>Probation Period</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", paddingTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#77728E", fontSize: "13px", fontWeight: "500" }}>
                  <input
                    type="radio"
                    name="probationPeriod"
                    value="no"
                    checked={formData.probationPeriod === "no"}
                    onChange={handleChange}
                    style={{ width: "16px", height: "16px", accentColor: "#4f46e5", cursor: "pointer" }}
                  />
                  No (Direct Permanent)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#77728E", fontSize: "13px", fontWeight: "500" }}>
                  <input
                    type="radio"
                    name="probationPeriod"
                    value="yes"
                    checked={formData.probationPeriod === "yes"}
                    onChange={handleChange}
                    style={{ width: "16px", height: "16px", accentColor: "#4f46e5", cursor: "pointer" }}
                  />
                  Yes (Probation Period)
                </label>
              </div>
            </div>

            {formData.probationPeriod === "yes" && (
              <div className="add-emp-form-group" style={{ marginTop: "-10px" }}>
                <label>Probation Duration (Months)</label>
                <input
                  type="number"
                  name="probationPeriodMonths"
                  value={formData.probationPeriodMonths}
                  onChange={handleChange}
                  placeholder="e.g. 3, 6, 12"
                  min="1"
                  max="48"
                  required
                />
              </div>
            )}

            {/* ✅ Conditionally rendered Employee ID field */}
            {showEmpId && (
              <div className="add-emp-form-group">
                <label>Employee ID</label>
                <input
                  type="text"
                  name="empId"
                  value={formData.empId}
                  onChange={handleChange}
                  placeholder={
                    formData.status === "intern"
                      ? "e.g. INT-001"
                      : "e.g. PT-001"
                  }
                  required
                />
              </div>
            )}
          </div>

          <div className="add-emp-actions">
            <button
              className="add-emp-btn-cancel"
              onClick={() => navigate(-1)}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="button"
              className="add-emp-btn-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Employee"}
            </button>
          </div>

      </main>
    </div>
  );
};

export default AddEmployee;
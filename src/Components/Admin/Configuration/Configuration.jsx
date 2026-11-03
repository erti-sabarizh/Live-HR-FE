import React, { useState, useEffect, useMemo, useRef } from "react";
import { portalInstance } from "../../../Services/instance";
import { toast, ToastContainer } from "react-toastify";
import Sidebar from "../../HeaderSidebar/Sidebar";
import { Icon } from "@iconify/react";
import CustomDropdown from "../../Common/CustomDropdown";
import "./Configuration.css";

const PORTAL_MENUS = [
  {
    module: "Employees",
    icon: "solar:users-group-two-rounded-bold",
    subItems: ["Add Employee", "Manage Employee"],
  },
  {
    module: "Attendance",
    icon: "solar:clock-circle-bold",
    subItems: ["Daily Report", "Attendance Report"],
  },
  {
    module: "Tasks",
    icon: "solar:checklist-minimalistic-bold",
    subItems: ["Task List", "Task Analytics"],
  },
  {
    module: "Daily Work Update",
    icon: "solar:document-text-bold",
    subItems: [],
  },
  {
    module: "Project Details",
    icon: "solar:folder-with-files-bold",
    subItems: [],
  },
  {
    module: "Leaves & Holidays",
    icon: "solar:calendar-bold",
    subItems: ["Leave Requests", "Manage Leaves", "Holiday List", "Holiday Configuration"],
  },
  {
    module: "Operation Hub",
    icon: "solar:widget-bold",
    subItems: [],
  },
  {
    module: "Slip Generation",
    icon: "solar:bill-list-bold",
    subItems: ["Payslip", "Appointment Letter", "Termination Letter", "Increment Letter"],
  },
  {
    module: "HR Requests",
    icon: "solar:inbox-in-bold",
    subItems: [],
  },
  {
    module: "Audit Dashboard",
    icon: "solar:shield-warning-bold",
    subItems: ["Access Control", "Payment Scripts", "Inscope Vendors"],
  },
  {
    module: "Web Crawler",
    icon: "solar:radar-bold",
    subItems: [],
  },
  {
    module: "My Details",
    icon: "solar:user-bold",
    subItems: [],
  },
];

const Configuration = () => {
  // ── Top Level Navigation Tabs ──
  const [activeTab, setActiveTab] = useState("policy-hr"); // "policy-hr" | "menu-access"

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permanentFreeCount, setPermanentFreeCount] = useState(2);
  const [probationFreeCount, setProbationFreeCount] = useState(2);
  const [deductCategoryName, setDeductCategoryName] = useState("Annual Leave");
  const [leaveDaysPerPermission, setLeaveDaysPerPermission] = useState(0.5);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [financialYear, setFinancialYear] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // ── Employee Menu Access State ──
  const [employeesList, setEmployeesList] = useState([]);
  const [menuAccessLoading, setMenuAccessLoading] = useState(false);
  const [menuAccessSubmitting, setMenuAccessSubmitting] = useState(false);

  // Form State for granting menu access
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedSubMenu, setSelectedSubMenu] = useState("");
  const [selectedPermission, setSelectedPermission] = useState("READ"); // "READ" | "WRITE"

  // Edit Menu Access Popup Modal State
  const [editModal, setEditModal] = useState({
    isOpen: false,
    item: null,
    module: "",
    subMenu: "",
    permission: "READ",
  });

  // Search & Filter & Pagination State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMenu, setFilterMenu] = useState("ALL");
  const [filterAccess, setFilterAccess] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Delete Confirmation Modal
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, item: null });

  const formCardRef = useRef(null);

  const defaultHrAccess = {
    slipAndLetter: "WRITE", // "READ" | "WRITE" | "FULL_ACCESS"
    hrRequests: "WRITE", // "READ" | "WRITE" | "FULL_ACCESS"
    leaveManagement: "MAKER", // "MAKER" | "READ" | "FULL_ACCESS"
    employeeManagement: {
      canAdd: true,
      canView: true,
      canEdit: true,
      canDeleteDocuments: false, // Admin can toggle enable/disable for HR
    },
    attendanceManagement: {
      dailyReport: true,
      monthlyOverview: true,
      exportAttendance: true,
    },
    holidays: "MAKER", // "MAKER" | "READ" | "FULL_ACCESS"
  };

  const [hrAccessConfig, setHrAccessConfig] = useState(defaultHrAccess);
  const [assignedHr, setAssignedHr] = useState(null);
  const [initialHrAccess, setInitialHrAccess] = useState(defaultHrAccess);
  const [isHrAccessOpen, setIsHrAccessOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);

  const [initialData, setInitialData] = useState({
    permanentFreeCount: 2,
    probationFreeCount: 2,
    deductCategoryName: "Annual Leave",
    leaveDaysPerPermission: 0.5,
  });

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await portalInstance.get("/api/leaves/permission-config");
      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        const permCount = typeof d.permanentFreeCount === "number" ? d.permanentFreeCount : 2;
        const probCount = typeof d.probationFreeCount === "number" ? d.probationFreeCount : 2;
        const catName = d.deductCategoryName || "Annual Leave";
        const rate = typeof d.leaveDaysPerPermission === "number" ? d.leaveDaysPerPermission : 0.5;

        setPermanentFreeCount(permCount);
        setProbationFreeCount(probCount);
        setDeductCategoryName(catName);
        setLeaveDaysPerPermission(rate);
        setAvailableCategories(
          d.availableCategories && d.availableCategories.length > 0
            ? d.availableCategories
            : ["Annual Leave", "Casual Leave", "Sick Leave"]
        );
        setFinancialYear(d.financialYear || "");

        if (d.hrAccessConfig) {
          const rawHr = d.hrAccessConfig;
          const normalized = {
            ...defaultHrAccess,
            ...rawHr,
            employeeManagement: {
              canAdd: rawHr.employeeManagement?.canAdd !== false,
              canView: rawHr.employeeManagement?.canView !== false,
              canEdit: rawHr.employeeManagement?.canEdit !== false,
              canDeleteDocuments: Boolean(rawHr.employeeManagement?.canDeleteDocuments),
            },
            attendanceManagement: {
              dailyReport: rawHr.attendanceManagement?.dailyReport !== false,
              monthlyOverview: rawHr.attendanceManagement?.monthlyOverview !== false,
              exportAttendance: rawHr.attendanceManagement?.exportAttendance !== false,
            },
          };
          setHrAccessConfig(normalized);
          setInitialHrAccess(normalized);
        }
        if (d.assignedHr) {
          setAssignedHr(d.assignedHr);
        }

        setInitialData({
          permanentFreeCount: permCount,
          probationFreeCount: probCount,
          deductCategoryName: catName,
          leaveDaysPerPermission: rate,
        });
        setHasChanges(false);
      }
    } catch (err) {
      console.error("Failed to load permission config:", err);
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuPermissions = async () => {
    try {
      setMenuAccessLoading(true);
      const res = await portalInstance.get("/menu-permission/all");
      if (res.data?.success && res.data.data) {
        setEmployeesList(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load menu permissions:", err);
      toast.error("Failed to load employee menu permissions");
    } finally {
      setMenuAccessLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchMenuPermissions();
  }, []);

  // Compute a flat list of granted menu permissions for the table
  const flatPermissionsList = useMemo(() => {
    const list = [];
    employeesList.forEach((emp) => {
      (emp.menus || []).forEach((m, idx) => {
        if (m.permission && m.permission !== "NO_ACCESS") {
          list.push({
            id: `${emp.employeeId}_${m.module}_${m.subMenu || "entire"}_${idx}`,
            employeeId: emp.employeeId,
            employeeName: emp.employeeName,
            empId: emp.empId,
            department: emp.department || "General",
            module: m.module,
            subMenu: m.subMenu || null,
            permission: m.permission,
          });
        }
      });
    });
    return list;
  }, [employeesList]);

  // Sub-items for the currently selected menu in the form
  const currentMenuSubItems = useMemo(() => {
    const found = PORTAL_MENUS.find((m) => m.module === selectedModule);
    return found ? found.subItems : [];
  }, [selectedModule]);

  // Dropdown options
  const employeeOptions = useMemo(() => [
    { label: "Choose Employee", value: "" },
    ...employeesList.map((emp) => ({
      label: emp.empId ? `${emp.employeeName} (${emp.empId})` : emp.employeeName,
      value: emp.employeeId,
    })),
  ], [employeesList]);

  const menuOptions = useMemo(() => [
    { label: "Choose Menu", value: "" },
    ...PORTAL_MENUS.map((m) => ({
      label: m.module,
      value: m.module,
    })),
  ], []);

  const subMenuOptions = useMemo(() => {
    if (!selectedModule) {
      return [{ label: "Select Menu First", value: "" }];
    }
    if (currentMenuSubItems.length > 0) {
      return [
        { label: "Entire Menu (All Submenus)", value: "" },
        ...currentMenuSubItems.map((sub) => ({ label: sub, value: sub })),
      ];
    }
    return [{ label: "(Single Menu - No Submenus)", value: "" }];
  }, [currentMenuSubItems, selectedModule]);

  const filterMenuOptions = useMemo(() => [
    { label: "All Menus", value: "ALL" },
    ...PORTAL_MENUS.map((m) => ({ label: m.module, value: m.module })),
  ], []);

  const filterAccessOptions = useMemo(() => [
    { label: "All Access Levels", value: "ALL" },
    { label: "Read Only", value: "READ" },
    { label: "Write", value: "WRITE" },
  ], []);

  // Sub-items and options for Edit Modal
  const editModalSubItems = useMemo(() => {
    const found = PORTAL_MENUS.find((m) => m.module === editModal.module);
    return found ? found.subItems : [];
  }, [editModal.module]);

  const editModalSubMenuOptions = useMemo(() => {
    if (!editModal.module) {
      return [{ label: "Select Menu First", value: "" }];
    }
    if (editModalSubItems.length > 0) {
      return [
        { label: "Entire Menu (All Submenus)", value: "" },
        ...editModalSubItems.map((sub) => ({ label: sub, value: sub })),
      ];
    }
    return [{ label: "(Single Menu - No Submenus)", value: "" }];
  }, [editModalSubItems, editModal.module]);

  // Filtered and Paginated records for Menu Permissions Table
  const filteredPermissions = useMemo(() => {
    return flatPermissionsList.filter((item) => {
      const search = searchTerm.trim().toLowerCase();
      const matchSearch =
        !search ||
        item.employeeName?.toLowerCase().includes(search) ||
        item.empId?.toLowerCase().includes(search) ||
        item.module?.toLowerCase().includes(search) ||
        (item.subMenu && item.subMenu.toLowerCase().includes(search));

      const matchMenu = filterMenu === "ALL" || item.module === filterMenu;
      const matchAccess = filterAccess === "ALL" || item.permission === filterAccess;

      return matchSearch && matchMenu && matchAccess;
    });
  }, [flatPermissionsList, searchTerm, filterMenu, filterAccess]);

  const totalPages = Math.max(1, Math.ceil(filteredPermissions.length / pageSize));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPermissions.slice(start, start + pageSize);
  }, [filteredPermissions, currentPage, pageSize]);

  // Handler: Assign Menu Permission (Top Card)
  const handleAssignOrUpdateMenuAccess = async (e) => {
    if (e) e.preventDefault();
    if (!selectedEmpId) {
      toast.error("Please select an employee");
      return;
    }
    if (!selectedModule) {
      toast.error("Please select a menu");
      return;
    }

    setMenuAccessSubmitting(true);
    try {
      const payload = {
        employeeId: selectedEmpId,
        module: selectedModule,
        subMenu: selectedSubMenu || null,
        permission: selectedPermission,
      };
      const res = await portalInstance.post("/menu-permission/assign", payload);
      if (res.data?.success) {
        toast.success("Menu access granted successfully!");
        setSelectedModule("");
        setSelectedSubMenu("");
        setSelectedPermission("READ");
        window.dispatchEvent(new Event("menuPermissionsUpdated"));
        fetchMenuPermissions();
      } else {
        toast.error(res.data?.message || "Failed to grant menu access");
      }
    } catch (err) {
      console.error("Error saving menu access:", err);
      toast.error(err.response?.data?.message || "Error saving menu access");
    } finally {
      setMenuAccessSubmitting(false);
    }
  };

  // Open Edit Popup Modal
  const handleStartEdit = (item) => {
    setEditModal({
      isOpen: true,
      item,
      module: item.module,
      subMenu: item.subMenu || "",
      permission: item.permission || "READ",
    });
  };

  // Save changes from Edit Popup Modal
  const handleSaveEditModal = async (e) => {
    if (e) e.preventDefault();
    if (!editModal.item) return;
    if (!editModal.module) {
      toast.error("Please select a menu");
      return;
    }

    setMenuAccessSubmitting(true);
    try {
      const payload = {
        employeeId: editModal.item.employeeId,
        oldModule: editModal.item.module,
        oldSubMenu: editModal.item.subMenu,
        module: editModal.module,
        subMenu: editModal.subMenu || null,
        permission: editModal.permission,
      };
      const res = await portalInstance.put("/menu-permission/update-menu", payload);
      if (res.data?.success) {
        toast.success("Menu access updated successfully!");
        setEditModal({ isOpen: false, item: null, module: "", subMenu: "", permission: "READ" });
        window.dispatchEvent(new Event("menuPermissionsUpdated"));
        fetchMenuPermissions();
      } else {
        toast.error(res.data?.message || "Failed to update menu access");
      }
    } catch (err) {
      console.error("Error updating menu access:", err);
      toast.error(err.response?.data?.message || "Error updating menu access");
    } finally {
      setMenuAccessSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmModal.item) return;
    const { employeeId, module, subMenu } = deleteConfirmModal.item;

    setMenuAccessSubmitting(true);
    try {
      const res = await portalInstance.post("/menu-permission/revoke", {
        employeeId,
        module,
        subMenu: subMenu || null,
      });
      if (res.data?.success) {
        toast.success("Menu access deleted successfully!");
        setDeleteConfirmModal({ isOpen: false, item: null });
        if (
          editModal.isOpen &&
          editModal.item?.employeeId === employeeId &&
          editModal.item?.module === module &&
          editModal.item?.subMenu === subMenu
        ) {
          setEditModal({ isOpen: false, item: null, module: "", subMenu: "", permission: "READ" });
        }
        window.dispatchEvent(new Event("menuPermissionsUpdated"));
        fetchMenuPermissions();
      } else {
        toast.error(res.data?.message || "Failed to delete menu access");
      }
    } catch (err) {
      console.error("Error revoking menu access:", err);
      toast.error(err.response?.data?.message || "Error deleting menu access");
    } finally {
      setMenuAccessSubmitting(false);
    }
  };

  // Track changes to enable the Save button when settings change
  useEffect(() => {
    const isPolicyDifferent =
      Number(permanentFreeCount) !== Number(initialData.permanentFreeCount) ||
      Number(probationFreeCount) !== Number(initialData.probationFreeCount) ||
      deductCategoryName.trim().toLowerCase() !== initialData.deductCategoryName.trim().toLowerCase() ||
      Number(leaveDaysPerPermission) !== Number(initialData.leaveDaysPerPermission);

    const isHrDifferent =
      JSON.stringify(hrAccessConfig) !== JSON.stringify(initialHrAccess);

    setHasChanges(isPolicyDifferent || isHrDifferent);
  }, [
    permanentFreeCount,
    probationFreeCount,
    deductCategoryName,
    leaveDaysPerPermission,
    initialData,
    hrAccessConfig,
    initialHrAccess,
  ]);

  const handleHrAccessChange = (moduleKey, value) => {
    setHrAccessConfig((prev) => ({
      ...prev,
      [moduleKey]: value,
    }));
  };

  const handleNestedAccessChange = (moduleKey, fieldKey, value) => {
    setHrAccessConfig((prev) => ({
      ...prev,
      [moduleKey]: {
        ...(typeof prev[moduleKey] === "object" ? prev[moduleKey] : {}),
        [fieldKey]: value,
      },
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    const pCount = permanentFreeCount === "" ? 0 : Number(permanentFreeCount);
    const probCount = probationFreeCount === "" ? 0 : Number(probationFreeCount);
    const rate = leaveDaysPerPermission === "" ? 0.5 : Number(leaveDaysPerPermission);

    if (pCount < 0 || probCount < 0) {
      toast.error("Permission counts cannot be negative");
      return;
    }

    if (rate < 0) {
      toast.error("Leave deduction count cannot be negative");
      return;
    }

    if (!deductCategoryName) {
      toast.error("Please select a leave category for deduction");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        permanentFreeCount: pCount,
        probationFreeCount: probCount,
        deductCategoryName: deductCategoryName.trim(),
        leaveDaysPerPermission: rate,
        hrAccessConfig,
      };

      const res = await portalInstance.put("/api/leaves/permission-config", payload);
      if (res.data?.success) {
        toast.success("Configuration & HR Access updated successfully!");
        sessionStorage.setItem("hrAccessConfig", JSON.stringify(hrAccessConfig));
        window.dispatchEvent(new Event("hrAccessConfigUpdated"));
        setPermanentFreeCount(pCount);
        setProbationFreeCount(probCount);
        setLeaveDaysPerPermission(rate);
        setInitialData({
          permanentFreeCount: pCount,
          probationFreeCount: probCount,
          deductCategoryName: deductCategoryName.trim(),
          leaveDaysPerPermission: rate,
        });
        setInitialHrAccess(hrAccessConfig);
        setHasChanges(false);
      } else {
        toast.error(res.data?.message || "Failed to update configuration");
      }
    } catch (err) {
      console.error("Error saving permission config:", err);
      toast.error(err.response?.data?.message || "Error saving configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPermanentFreeCount(initialData.permanentFreeCount);
    setProbationFreeCount(initialData.probationFreeCount);
    setDeductCategoryName(initialData.deductCategoryName);
    setLeaveDaysPerPermission(initialData.leaveDaysPerPermission);
    setHrAccessConfig(initialHrAccess);
    toast.info("Reverted all unsaved changes");
  };

  return (
    <>
      <Sidebar />
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="config-page-wrapper">
        <div className="config-container">
          {/* Top Level Navigation Tabs */}
          <div className="config-nav-tabs-wrapper">
            <button
              type="button"
              className={`config-nav-tab-btn ${activeTab === "policy-hr" ? "active" : ""}`}
              onClick={() => setActiveTab("policy-hr")}
            >
              <Icon icon="solar:shield-check-bold" width="18" />
              <span>Policy & HR Access</span>
            </button>
            <button
              type="button"
              className={`config-nav-tab-btn ${activeTab === "menu-access" ? "active" : ""}`}
              onClick={() => setActiveTab("menu-access")}
            >
              <Icon icon="solar:user-id-bold" width="18" />
              <span>Employee Menu Access</span>
            </button>
          </div>

          {activeTab === "policy-hr" && (
            loading ? (
              <div className="config-loading-card">
                <div className="config-spinner"></div>
                <span>Loading configuration...</span>
              </div>
            ) : (
              <>
              {/* Panel 1: Policy & Permission Configuration */}
              <div className="config-main-panel">
              {/* Header inside Panel 1 with bottom arrow */}
              <div
                className="config-panel-header config-collapsible-header"
                onClick={() => setIsPolicyOpen((prev) => !prev)}
              >
                <div className="config-collapsible-header-left">
                  <div className="config-header-text">
                    <h1 className="config-title" style={{ margin: 0 }}>Policy & Permission Configuration</h1>
                    <p className="config-subtitle">
                      Configure monthly free permission quotas and leave category deduction rules.
                    </p>
                  </div>
                </div>

                <div className="config-collapsible-header-right">
                  {financialYear && (
                    <div className="config-fy-chip">
                      <Icon icon="solar:calendar-date-bold" width="15" />
                      <span>FY {financialYear}</span>
                    </div>
                  )}

                  {/* Bottom Arrow Toggle Button */}
                  <button
                    type="button"
                    className={`config-toggle-arrow-btn ${isPolicyOpen ? "open" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPolicyOpen((prev) => !prev);
                    }}
                    aria-label="Toggle Policy & Permission Configuration"
                    title={isPolicyOpen ? "Collapse Configuration" : "Open Configuration"}
                  >
                    <Icon
                      icon={isPolicyOpen ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
                      width="20"
                    />
                  </button>
                </div>
              </div>

              {/* Collapsible Body */}
              {isPolicyOpen && (
                <>
                  <div className="config-panel-divider" />

              {/* Section 1: Monthly Free Permission Count */}
              <div className="config-section">
                <div className="config-section-title-row">
                  <div className="config-section-icon-box icon-purple">
                    <Icon icon="solar:shield-user-bold" width="18" />
                  </div>
                  <h2 className="config-section-title">Monthly Free Permission Count</h2>
                </div>

                <div className="config-fields-row">
                  {/* Permanent Employees */}
                  <div className="config-field-group">
                    <label className="config-label">
                      <Icon icon="solar:user-check-bold" width="16" color="#5977f8" />
                      <span className="config-label-text">Permanent Employees</span>
                    </label>
                    <div className="config-input-wrapper">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="config-number-input"
                        value={permanentFreeCount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setPermanentFreeCount("");
                          } else {
                            const num = parseInt(val, 10);
                            if (!isNaN(num) && num >= 0) {
                              setPermanentFreeCount(num);
                            }
                          }
                        }}
                        onBlur={() => {
                          if (permanentFreeCount === "" || isNaN(permanentFreeCount)) {
                            setPermanentFreeCount(0);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                            e.preventDefault();
                          }
                        }}
                        onWheel={(e) => e.target.blur()}
                        placeholder="2"
                      />
                      <span className="config-input-unit">per month</span>
                    </div>
                  </div>

                  {/* Probationary Employees */}
                  <div className="config-field-group">
                    <label className="config-label">
                      <Icon icon="solar:clock-circle-bold" width="16" color="#f59e0b" />
                      <span className="config-label-text">Probationary Employees</span>
                    </label>
                    <div className="config-input-wrapper">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="config-number-input"
                        value={probationFreeCount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setProbationFreeCount("");
                          } else {
                            const num = parseInt(val, 10);
                            if (!isNaN(num) && num >= 0) {
                              setProbationFreeCount(num);
                            }
                          }
                        }}
                        onBlur={() => {
                          if (probationFreeCount === "" || isNaN(probationFreeCount)) {
                            setProbationFreeCount(0);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                            e.preventDefault();
                          }
                        }}
                        onWheel={(e) => e.target.blur()}
                        placeholder="2"
                      />
                      <span className="config-input-unit">per month</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="config-panel-divider" />

              {/* Section 2: Excess Permission Leave Deduction */}
              <div className="config-section">
                <div className="config-section-title-row">
                  <div className="config-section-icon-box icon-blue">
                    <Icon icon="solar:calendar-minimalistic-bold" width="18" />
                  </div>
                  <h2 className="config-section-title">Excess Permission Leave Deduction</h2>
                </div>

                {/* Category Selection */}
                <div className="config-category-selector-group">
                  <label className="config-label mb-2">
                    <span className="config-label-text">Deduct From Category:</span>
                  </label>
                  <div className="config-category-chips">
                    {availableCategories.length === 0 ? (
                      <div className="config-category-chip selected">
                        <Icon icon="solar:check-circle-bold" width="16" />
                        <span>Annual Leave</span>
                      </div>
                    ) : (
                      availableCategories.map((catName) => {
                        const isSelected =
                          deductCategoryName.trim().toLowerCase() === catName.trim().toLowerCase();
                        return (
                          <button
                            key={catName}
                            type="button"
                            className={`config-category-chip ${isSelected ? "selected" : ""}`}
                            onClick={() => setDeductCategoryName(catName)}
                          >
                            {isSelected ? (
                              <Icon icon="solar:check-circle-bold" width="16" color="#5977f8" />
                            ) : (
                              <Icon icon="solar:tag-horizontal-bold" width="16" color="#94a3b8" />
                            )}
                            <span>{catName}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Deduction Rate Field */}
                <div className="config-field-group mt-3">
                  <label className="config-label">
                    <Icon icon="solar:calculator-minimalistic-bold" width="16" color="#5977f8" />
                    <span className="config-label-text">Leave Deduction Per Excess Permission</span>
                  </label>
                  <div className="config-input-wrapper">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      className="config-number-input"
                      value={leaveDaysPerPermission}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setLeaveDaysPerPermission("");
                        } else {
                          const num = parseFloat(val);
                          if (!isNaN(num) && num >= 0) {
                            setLeaveDaysPerPermission(val);
                          }
                        }
                      }}
                      onBlur={() => {
                        if (leaveDaysPerPermission === "" || isNaN(parseFloat(leaveDaysPerPermission))) {
                          setLeaveDaysPerPermission(0.5);
                        } else {
                          setLeaveDaysPerPermission(parseFloat(leaveDaysPerPermission));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                          e.preventDefault();
                        }
                      }}
                      onWheel={(e) => e.target.blur()}
                      placeholder="0.5"
                    />
                    <span className="config-input-unit">day(s) / permission</span>
                  </div>
                </div>

                {/* Alert Box */}
                <div className="config-alert-box">
                  <Icon icon="solar:info-circle-bold" width="18" color="#3b82f6" />
                  <div>
                    Exhausted <strong>{deductCategoryName}</strong> balances automatically overflow to <strong>Others / Loss of Pay (LOP)</strong>.
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="config-panel-divider" />

              {/* Action Buttons: Policy & Permission Configuration */}
              <div className="config-actions-bar">
                <button
                  type="button"
                  className="common-modal-btn btn-small-cancel"
                  onClick={handleReset}
                  disabled={saving || !hasChanges}
                >
                  Reset
                </button>

                <button
                  type="button"
                  className="common-modal-btn btn-update"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  {saving ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </>
          )}
        </div>

            {/* Panel 2: HR Access & Permissions Configuration */}
            <div className="config-main-panel config-hr-panel">
              {/* Collapsible Header with Bottom Arrow */}
              <div
                className="config-panel-header config-collapsible-header"
                onClick={() => setIsHrAccessOpen((prev) => !prev)}
              >
                <div className="config-collapsible-header-left">
                  <div className="config-section-icon-box icon-blue">
                    <Icon icon="solar:users-group-rounded-bold" width="18" />
                  </div>
                  <div className="config-header-text">
                    <h2 className="config-title" style={{ fontSize: "18px", margin: 0 }}>
                      HR Access & Permissions Configuration
                    </h2>
                    <p className="config-subtitle">
                      Configure granular access levels (Read, Write, Full Access, Maker-Checker) for the designated HR role.
                    </p>
                  </div>
                </div>

                <div className="config-collapsible-header-right">
                  {assignedHr ? (
                    <div className="config-assigned-hr-badge">
                      <span className="config-assigned-hr-label">Assigned HR:</span>{" "}
                      <span className="config-assigned-hr-value">
                        {assignedHr.name} ({assignedHr.empIdString || assignedHr.empId})
                      </span>
                    </div>
                  ) : (
                    <div className="config-no-hr-badge">
                      <Icon icon="solar:danger-triangle-bold" width="16" color="#f59e0b" />
                      <span>No HR currently assigned</span>
                    </div>
                  )}

                  {/* Bottom Arrow Button to open full table */}
                  <button
                    type="button"
                    className={`config-toggle-arrow-btn ${isHrAccessOpen ? "open" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsHrAccessOpen((prev) => !prev);
                    }}
                    aria-label="Toggle HR Access Table"
                    title={isHrAccessOpen ? "Collapse HR Access Table" : "Open Full HR Access Table"}
                  >
                    <Icon
                      icon={isHrAccessOpen ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
                      width="20"
                    />
                  </button>
                </div>
              </div>

              {/* Collapsible Full Table & Cards Content */}
              {isHrAccessOpen && (
                <>
                  <div className="config-panel-divider" />

                  <div className="config-hr-grid">
                    {/* Module 1: Slip & Letter Generation */}
                  <div className="config-hr-card">
                    <div className="config-hr-card-header">
                      <div className="config-hr-card-icon-box" style={{ background: "#eef2ff", color: "#5977f8" }}>
                        <Icon icon="solar:document-text-bold" width="18" />
                      </div>
                      <div className="config-hr-card-title-wrap">
                        <h3 className="config-hr-card-title">1. Slip & Letter Generation</h3>
                        <span className="config-hr-badge-current">
                          {hrAccessConfig.slipAndLetter === "FULL_ACCESS"
                            ? "Full Access"
                            : hrAccessConfig.slipAndLetter === "WRITE"
                            ? "Write Access"
                            : "Read Access"}
                        </span>
                      </div>
                    </div>
                    <div className="config-hr-pill-group">
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.slipAndLetter === "READ" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("slipAndLetter", "READ")}
                      >
                        Read
                      </button>
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.slipAndLetter === "WRITE" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("slipAndLetter", "WRITE")}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.slipAndLetter === "FULL_ACCESS" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("slipAndLetter", "FULL_ACCESS")}
                      >
                        Full Access
                      </button>
                    </div>
                    <p className="config-hr-card-desc">
                      {hrAccessConfig.slipAndLetter === "READ" && "View slips & letter issuance history."}
                      {hrAccessConfig.slipAndLetter === "WRITE" && "Generate payslips, calculate LOP deductions, & issue appointment/increment/termination letters."}
                      {hrAccessConfig.slipAndLetter === "FULL_ACCESS" && "Modify salary structures, delete slips, templates & letters."}
                    </p>
                  </div>

                  {/* Module 2: HR Requests */}
                  <div className="config-hr-card">
                    <div className="config-hr-card-header">
                      <div className="config-hr-card-icon-box" style={{ background: "#ecfdf5", color: "#10b981" }}>
                        <Icon icon="solar:inbox-in-bold" width="18" />
                      </div>
                      <div className="config-hr-card-title-wrap">
                        <h3 className="config-hr-card-title">2. HR Requests</h3>
                        <span className="config-hr-badge-current">
                          {hrAccessConfig.hrRequests === "FULL_ACCESS"
                            ? "Full Access"
                            : hrAccessConfig.hrRequests === "WRITE"
                            ? "Write Access"
                            : "Read Access"}
                        </span>
                      </div>
                    </div>
                    <div className="config-hr-pill-group">
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.hrRequests === "READ" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("hrRequests", "READ")}
                      >
                        Read
                      </button>
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.hrRequests === "WRITE" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("hrRequests", "WRITE")}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.hrRequests === "FULL_ACCESS" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("hrRequests", "FULL_ACCESS")}
                      >
                        Full Access
                      </button>
                    </div>
                    <p className="config-hr-card-desc">
                      {hrAccessConfig.hrRequests === "READ" && "View employee requests & queries in view-only mode."}
                      {hrAccessConfig.hrRequests === "WRITE" && "Approve, process & upload certificates (bonafide, experience, salary certificates)."}
                      {hrAccessConfig.hrRequests === "FULL_ACCESS" && "Delete tickets, configure request rules & certificates templates."}
                    </p>
                  </div>

                  {/* Module 3: Leave Management */}
                  <div className="config-hr-card">
                    <div className="config-hr-card-header">
                      <div className="config-hr-card-icon-box" style={{ background: "#f5f3ff", color: "#8b5cf6" }}>
                        <Icon icon="solar:calendar-bold" width="18" />
                      </div>
                      <div className="config-hr-card-title-wrap">
                        <h3 className="config-hr-card-title">3. Leave Management</h3>
                        <span className="config-hr-badge-current">
                          {hrAccessConfig.leaveManagement === "MAKER"
                            ? "Maker (Admin Approval)"
                            : hrAccessConfig.leaveManagement === "FULL_ACCESS"
                            ? "Full Access"
                            : "Read Access"}
                        </span>
                      </div>
                    </div>
                    <div className="config-hr-pill-group">
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.leaveManagement === "MAKER" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("leaveManagement", "MAKER")}
                      >
                        Maker (Approval)
                      </button>
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.leaveManagement === "READ" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("leaveManagement", "READ")}
                      >
                        Read
                      </button>
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.leaveManagement === "FULL_ACCESS" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("leaveManagement", "FULL_ACCESS")}
                      >
                        Full Access
                      </button>
                    </div>
                    <p className="config-hr-card-desc">
                      {hrAccessConfig.leaveManagement === "MAKER" && "HR creates leave category and submits to Admin; Admin reviews and Approves or Rejects."}
                      {hrAccessConfig.leaveManagement === "READ" && "HR can only view leave categories, allocations, and employee balances."}
                      {hrAccessConfig.leaveManagement === "FULL_ACCESS" && "HR can directly create, edit, and activate leave categories without Admin approval."}
                    </p>
                  </div>

                  {/* Module 6: Holidays */}
                  <div className="config-hr-card">
                    <div className="config-hr-card-header">
                      <div className="config-hr-card-icon-box" style={{ background: "#fdf2f8", color: "#ec4899" }}>
                        <Icon icon="solar:sun-bold" width="18" />
                      </div>
                      <div className="config-hr-card-title-wrap">
                        <h3 className="config-hr-card-title">6. Holidays</h3>
                        <span className="config-hr-badge-current">
                          {hrAccessConfig.holidays === "MAKER"
                            ? "Maker (Admin Approval)"
                            : hrAccessConfig.holidays === "FULL_ACCESS"
                            ? "Full Access"
                            : "Read Access"}
                        </span>
                      </div>
                    </div>
                    <div className="config-hr-pill-group">
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.holidays === "MAKER" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("holidays", "MAKER")}
                      >
                        Maker (Approval)
                      </button>
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.holidays === "READ" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("holidays", "READ")}
                      >
                        Read
                      </button>
                      <button
                        type="button"
                        className={`config-hr-pill ${hrAccessConfig.holidays === "FULL_ACCESS" ? "active" : ""}`}
                        onClick={() => handleHrAccessChange("holidays", "FULL_ACCESS")}
                      >
                        Full Access
                      </button>
                    </div>
                    <p className="config-hr-card-desc">
                      {hrAccessConfig.holidays === "MAKER" && "HR sends a holidays collection to Admin; Admin views it and Approves or Rejects."}
                      {hrAccessConfig.holidays === "READ" && "HR can only view the published holiday calendar."}
                      {hrAccessConfig.holidays === "FULL_ACCESS" && "HR can directly publish and modify holiday assignments without Admin approval."}
                    </p>
                  </div>

                  {/* Module 4: Employee Management */}
                  <div className="config-hr-card">
                    <div className="config-hr-card-header">
                      <div className="config-hr-card-icon-box" style={{ background: "#fffbeb", color: "#f59e0b" }}>
                        <Icon icon="solar:user-bold" width="18" />
                      </div>
                      <div className="config-hr-card-title-wrap">
                        <h3 className="config-hr-card-title">4. Employee Management</h3>
                        <span className="config-hr-badge-current">
                          {hrAccessConfig.employeeManagement?.canDeleteDocuments
                            ? "Doc Delete: Enabled"
                            : "Doc Delete: Restricted (Admin Only)"}
                        </span>
                      </div>
                    </div>

                    <div className="config-hr-toggle-list">
                      {/* Add Employee */}
                      <div className="config-hr-toggle-row">
                        <div className="config-hr-toggle-info">
                          <Icon icon="solar:user-plus-bold" width="16" color="#5977f8" className="toggle-icon" />
                          <span className="config-hr-toggle-title">Add Employee</span>
                        </div>
                        <div className="config-hr-switch-group">
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.employeeManagement?.canAdd !== false ? "active-enable" : ""}`}
                            onClick={() => handleNestedAccessChange("employeeManagement", "canAdd", true)}
                          >
                            <Icon icon="solar:check-circle-bold" width="13" />
                            <span>Enable</span>
                          </button>
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.employeeManagement?.canAdd === false ? "active-disable" : ""}`}
                            onClick={() => handleNestedAccessChange("employeeManagement", "canAdd", false)}
                          >
                            <Icon icon="solar:close-circle-bold" width="13" />
                            <span>Disable</span>
                          </button>
                        </div>
                      </div>

                      {/* View Details */}
                      <div className="config-hr-toggle-row">
                        <div className="config-hr-toggle-info">
                          <Icon icon="solar:eye-bold" width="16" color="#10b981" className="toggle-icon" />
                          <span className="config-hr-toggle-title">View Details</span>
                        </div>
                        <div className="config-hr-switch-group">
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.employeeManagement?.canView !== false ? "active-enable" : ""}`}
                            onClick={() => handleNestedAccessChange("employeeManagement", "canView", true)}
                          >
                            <Icon icon="solar:check-circle-bold" width="13" />
                            <span>Enable</span>
                          </button>
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.employeeManagement?.canView === false ? "active-disable" : ""}`}
                            onClick={() => handleNestedAccessChange("employeeManagement", "canView", false)}
                          >
                            <Icon icon="solar:close-circle-bold" width="13" />
                            <span>Disable</span>
                          </button>
                        </div>
                      </div>

                      {/* Edit Details Directly */}
                      <div className="config-hr-toggle-row">
                        <div className="config-hr-toggle-info">
                          <Icon icon="solar:pen-new-square-bold" width="16" color="#f59e0b" className="toggle-icon" />
                          <span className="config-hr-toggle-title">Edit Details Directly</span>
                        </div>
                        <div className="config-hr-switch-group">
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.employeeManagement?.canEdit !== false ? "active-enable" : ""}`}
                            onClick={() => handleNestedAccessChange("employeeManagement", "canEdit", true)}
                          >
                            <Icon icon="solar:check-circle-bold" width="13" />
                            <span>Enable</span>
                          </button>
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.employeeManagement?.canEdit === false ? "active-disable" : ""}`}
                            onClick={() => handleNestedAccessChange("employeeManagement", "canEdit", false)}
                          >
                            <Icon icon="solar:close-circle-bold" width="13" />
                            <span>Disable</span>
                          </button>
                        </div>
                      </div>

                      {/* Delete Uploaded Documents (Admin can toggle enable/disable for HR) */}
                      <div className="config-hr-toggle-row">
                        <div className="config-hr-toggle-info">
                          <Icon icon="solar:trash-bin-trash-bold" width="16" color="#ef4444" className="toggle-icon" />
                          <span className="config-hr-toggle-title">Delete Uploaded Documents</span>
                        </div>
                        <div className="config-hr-switch-group">
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.employeeManagement?.canDeleteDocuments ? "active-enable" : ""}`}
                            onClick={() => handleNestedAccessChange("employeeManagement", "canDeleteDocuments", true)}
                          >
                            <Icon icon="solar:check-circle-bold" width="13" />
                            <span>Enable</span>
                          </button>
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${!hrAccessConfig.employeeManagement?.canDeleteDocuments ? "active-disable" : ""}`}
                            onClick={() => handleNestedAccessChange("employeeManagement", "canDeleteDocuments", false)}
                          >
                            <Icon icon="solar:close-circle-bold" width="13" />
                            <span>Disable</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="config-hr-card-desc">
                      {hrAccessConfig.employeeManagement?.canDeleteDocuments
                        ? "HR can add, view, edit employees and is granted permission to delete uploaded documents."
                        : "HR can manage employee records per enabled permissions. Uploaded document deletion remains disabled for HR."}
                    </p>
                  </div>

                  {/* Module 5: Attendance Management */}
                  <div className="config-hr-card">
                    <div className="config-hr-card-header">
                      <div className="config-hr-card-icon-box" style={{ background: "#ecfeff", color: "#06b6d4" }}>
                        <Icon icon="solar:clock-circle-bold" width="18" />
                      </div>
                      <div className="config-hr-card-title-wrap">
                        <h3 className="config-hr-card-title">5. Attendance Management</h3>
                        <span className="config-hr-badge-current">
                          {[
                            hrAccessConfig.attendanceManagement?.dailyReport,
                            hrAccessConfig.attendanceManagement?.monthlyOverview,
                            hrAccessConfig.attendanceManagement?.exportAttendance,
                          ].filter(Boolean).length === 3
                            ? "Full Access (3/3 Enabled)"
                            : `${
                                [
                                  hrAccessConfig.attendanceManagement?.dailyReport,
                                  hrAccessConfig.attendanceManagement?.monthlyOverview,
                                  hrAccessConfig.attendanceManagement?.exportAttendance,
                                ].filter(Boolean).length
                              }/3 Actions Enabled`}
                        </span>
                      </div>
                    </div>

                    <div className="config-hr-toggle-list">
                      {/* Daily Report View */}
                      <div className="config-hr-toggle-row">
                        <div className="config-hr-toggle-info">
                          <Icon icon="solar:document-text-bold" width="16" color="#06b6d4" className="toggle-icon" />
                          <span className="config-hr-toggle-title">Daily Report View</span>
                        </div>
                        <div className="config-hr-switch-group">
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.attendanceManagement?.dailyReport !== false ? "active-enable" : ""}`}
                            onClick={() => handleNestedAccessChange("attendanceManagement", "dailyReport", true)}
                          >
                            <Icon icon="solar:check-circle-bold" width="13" />
                            <span>Enable</span>
                          </button>
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.attendanceManagement?.dailyReport === false ? "active-disable" : ""}`}
                            onClick={() => handleNestedAccessChange("attendanceManagement", "dailyReport", false)}
                          >
                            <Icon icon="solar:close-circle-bold" width="13" />
                            <span>Disable</span>
                          </button>
                        </div>
                      </div>

                      {/* Monthly Attendance Overview */}
                      <div className="config-hr-toggle-row">
                        <div className="config-hr-toggle-info">
                          <Icon icon="solar:chart-square-bold" width="16" color="#8b5cf6" className="toggle-icon" />
                          <span className="config-hr-toggle-title">Monthly Attendance Overview</span>
                        </div>
                        <div className="config-hr-switch-group">
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.attendanceManagement?.monthlyOverview !== false ? "active-enable" : ""}`}
                            onClick={() => handleNestedAccessChange("attendanceManagement", "monthlyOverview", true)}
                          >
                            <Icon icon="solar:check-circle-bold" width="13" />
                            <span>Enable</span>
                          </button>
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.attendanceManagement?.monthlyOverview === false ? "active-disable" : ""}`}
                            onClick={() => handleNestedAccessChange("attendanceManagement", "monthlyOverview", false)}
                          >
                            <Icon icon="solar:close-circle-bold" width="13" />
                            <span>Disable</span>
                          </button>
                        </div>
                      </div>

                      {/* Export Attendance */}
                      <div className="config-hr-toggle-row">
                        <div className="config-hr-toggle-info">
                          <Icon icon="solar:download-square-bold" width="16" color="#10b981" className="toggle-icon" />
                          <span className="config-hr-toggle-title">Export Attendance</span>
                        </div>
                        <div className="config-hr-switch-group">
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.attendanceManagement?.exportAttendance !== false ? "active-enable" : ""}`}
                            onClick={() => handleNestedAccessChange("attendanceManagement", "exportAttendance", true)}
                          >
                            <Icon icon="solar:check-circle-bold" width="13" />
                            <span>Enable</span>
                          </button>
                          <button
                            type="button"
                            className={`config-hr-switch-btn ${hrAccessConfig.attendanceManagement?.exportAttendance === false ? "active-disable" : ""}`}
                            onClick={() => handleNestedAccessChange("attendanceManagement", "exportAttendance", false)}
                          >
                            <Icon icon="solar:close-circle-bold" width="13" />
                            <span>Disable</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="config-hr-card-desc">
                      {hrAccessConfig.attendanceManagement?.exportAttendance !== false
                        ? "HR can view daily logs, examine monthly analytics, and export attendance records."
                        : "HR attendance permissions are customized per the enabled analytics tools above."}
                    </p>
                  </div>
                </div>

                  {/* HR Notification Notice Alert */}
                  {/* <div className="config-alert-box mt-3" style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
                    <Icon icon="solar:bell-bold" width="18" color="#16a34a" />
                    <div>
                      Saving changes to HR Access automatically delivers an in-app & push notification to the active HR employee.
                    </div>
                  </div> */}

                  {/* Divider */}
                  <div className="config-panel-divider" />

                  {/* Action Buttons: HR Access Configuration */}
                  <div className="config-actions-bar">
                    <button
                      type="button"
                      className="common-modal-btn btn-small-cancel"
                      onClick={handleReset}
                      disabled={saving || !hasChanges}
                    >
                      Reset
                    </button>

                    <button
                      type="button"
                      className="common-modal-btn btn-update"
                      onClick={handleSave}
                      disabled={saving || !hasChanges}
                    >
                      {saving ? "Saving..." : "Save Configuration"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )
      )}

          {/* Tab 2: Employee Menu Access */}
          {activeTab === "menu-access" && (
            <>
              {/* Form Card: Grant / Edit Menu Access */}
              <div
                ref={formCardRef}
                className="config-menu-form-card"
              >
                <div className="config-panel-header">
                  <div className="config-collapsible-header-left">
                    <div className="config-section-icon-box icon-purple">
                      <Icon icon="solar:shield-user-bold" width="20" />
                    </div>
                    <div className="config-header-text">
                      <h2 className="config-title" style={{  margin: 0 }}>
                        Grant Menu Access to Employee
                      </h2>

                    </div>
                  </div>
                </div>

                <form onSubmit={handleAssignOrUpdateMenuAccess} className="config-form-wrapper">
                  {/* Top Dropdowns Row: Select Employee, Select Menu, Select Sub-Menu */}
                  <div className="config-form-grid-3">
                    {/* Select Employee */}
                    <div className="config-field-group">
                      <label className="config-label">
                        <span className="config-label-text">Select Employee</span>
                      </label>
                      <CustomDropdown
                        className="config-field-dropdown"
                        options={employeeOptions}
                        value={selectedEmpId}
                        onChange={(val) => setSelectedEmpId(val)}
                        placeholder="Choose Employee"
                        disabled={menuAccessSubmitting}
                      />
                    </div>

                    {/* Select Menu */}
                    <div className="config-field-group">
                      <label className="config-label">
                        <span className="config-label-text">Select Menu / Tab</span>
                      </label>
                      <CustomDropdown
                        className="config-field-dropdown"
                        options={menuOptions}
                        value={selectedModule}
                        onChange={(val) => {
                          setSelectedModule(val);
                          setSelectedSubMenu("");
                        }}
                        placeholder="Choose Menu"
                        disabled={menuAccessSubmitting}
                      />
                    </div>

                    {/* Select Sub-Menu */}
                    <div className="config-field-group">
                      <label className="config-label">
                        <span className="config-label-text">Select Sub-Menu</span>
                      </label>
                      <CustomDropdown
                        className="config-field-dropdown"
                        options={subMenuOptions}
                        value={selectedSubMenu}
                        onChange={(val) => setSelectedSubMenu(val)}
                        placeholder={
                          !selectedModule
                            ? "Select Menu First"
                            : currentMenuSubItems.length > 0
                            ? "Entire Menu (All Submenus)"
                            : "(Single Menu - No Submenus)"
                        }
                        disabled={menuAccessSubmitting || !selectedModule || currentMenuSubItems.length === 0}
                      />
                    </div>
                  </div>

                  {/* Bottom Row: Access Permission */}
                  <div className="config-permission-bottom-row">
                    <div className="config-field-group">
                      <label className="config-label">
                        <span className="config-label-text">Access Permission</span>
                      </label>
                      <div className="config-access-type-group">
                        <button
                          type="button"
                          className={`config-access-type-btn ${selectedPermission === "READ" ? "active-read" : ""}`}
                          onClick={() => setSelectedPermission("READ")}
                        >
                          <Icon icon="solar:eye-bold" width="16" />
                          <span>Read</span>
                        </button>
                        <button
                          type="button"
                          className={`config-access-type-btn ${selectedPermission === "WRITE" ? "active-write" : ""}`}
                          onClick={() => setSelectedPermission("WRITE")}
                        >
                          <Icon icon="solar:pen-new-square-bold" width="16" />
                          <span>Write</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                {/* Form Action Buttons */}
                <div className="config-form-actions-bar">
                  <button
                    type="button"
                    className="common-modal-btn btn-update"
                    onClick={handleAssignOrUpdateMenuAccess}
                    disabled={menuAccessSubmitting || !selectedEmpId || !selectedModule}
                  >
                    {menuAccessSubmitting ? "Granting Access..." : "Grant Access"}
                  </button>
                </div>
              </div>

              {/* Table Panel: Configured Employee Menu Permissions */}
              <div className="config-table-panel">
                <div className="config-table-header-row">
                  <div className="config-collapsible-header-left">
                    <div className="config-section-icon-box icon-blue">
                      <Icon icon="solar:users-group-rounded-bold" width="18" />
                    </div>
                    <div>
                      <h2 className="config-title" style={{ margin: 0 }}>
                        Configured Employee Menu Permissions
                      </h2>
                    </div>
                  </div>

                  <div className="config-table-toolbar">
                    {/* Search by Employee, ID, or Menu */}
                    <div className="config-search-box">
                      <Icon icon="solar:magnifer-linear" width="16" color="#94a3b8" />
                      <input
                        type="text"
                        className="config-search-input"
                        placeholder="Search permissions..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                      />
                    </div>

                    {/* Filter by Menu */}
                    <CustomDropdown
                      className="config-filter-dropdown"
                      options={filterMenuOptions}
                      value={filterMenu}
                      onChange={(val) => {
                        setFilterMenu(val);
                        setCurrentPage(1);
                      }}
                      placeholder="All Menus"
                    />

                    {/* Filter by Access */}
                    <CustomDropdown
                      className="config-filter-dropdown"
                      options={filterAccessOptions}
                      value={filterAccess}
                      onChange={(val) => {
                        setFilterAccess(val);
                        setCurrentPage(1);
                      }}
                      placeholder="All Access Levels"
                    />
                  </div>
                </div>

                {/* Permissions Table */}
                {menuAccessLoading ? (
                  <div className="config-loading-card" style={{ padding: "40px" }}>
                    <div className="config-spinner"></div>
                    <span>Loading permissions...</span>
                  </div>
                ) : filteredPermissions.length === 0 ? (
                  <div className="config-empty-table">
                    <Icon icon="solar:shield-warning-bold" width="40" color="#cbd5e1" />
                    <p>No employee menu permissions found.</p>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {searchTerm || filterMenu !== "ALL" || filterAccess !== "ALL"
                        ? "Try adjusting your search or filters."
                        : "Use the form above to grant menu access to an employee."}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="config-permissions-table-wrap">
                      <table className="config-permissions-table">
                        <thead>
                          <tr>
                            <th style={{ width: "50px", textAlign: "center" }}>#</th>
                            <th>Employee</th>
                            <th>Department</th>
                            <th>Menu</th>
                            <th>Sub-Menu</th>
                            <th style={{ textAlign: "center" }}>Access Level</th>
                            <th style={{ textAlign: "center", width: "160px" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedList.map((item, idx) => {
                            const rowIndex = (currentPage - 1) * pageSize + idx + 1;
                            const isCurrentlyEditing =
                              editModal.isOpen &&
                              editModal.item?.employeeId === item.employeeId &&
                              editModal.item?.module === item.module &&
                              editModal.item?.subMenu === item.subMenu;

                            return (
                              <tr
                                key={item.id}
                                style={isCurrentlyEditing ? { background: "#f5f3ff" } : {}}
                              >
                                <td style={{ textAlign: "center", fontWeight: 600, color: "#64748b" }}>
                                  {rowIndex}
                                </td>
                                <td>
                                  <div className="config-emp-cell">
                                    <div className="config-emp-avatar">
                                      {item.employeeName?.charAt(0)?.toUpperCase() || "E"}
                                    </div>
                                    <div className="config-emp-meta">
                                      <span className="config-emp-name">{item.employeeName}</span>
                                      <span className="config-emp-id-chip">{item.empId}</span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="config-submenu-chip">{item.department}</span>
                                </td>
                                <td>
                                  <span className="config-module-chip">
                                    <span>{item.module}</span>
                                  </span>
                                </td>
                                <td>
                                  {item.subMenu ? (
                                    <span className="config-submenu-chip">{item.subMenu}</span>
                                  ) : (
                                    <span className="config-submenu-all-chip">Entire Menu</span>
                                  )}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  {item.permission === "WRITE" || item.permission === "BOTH" || item.permission === "FULL_ACCESS" ? (
                                    <span className="config-access-badge write">
                                      Write
                                    </span>
                                  ) : (
                                    <span className="config-access-badge read">
                                      Read
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <div className="config-table-actions" style={{ justifyContent: "center" }}>
                                    <button
                                      type="button"
                                      className="config-action-btn config-action-btn-edit"
                                      title="Edit Access"
                                      onClick={() => handleStartEdit(item)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="config-action-btn config-action-btn-delete"
                                      title="Revoke / Delete Access"
                                      onClick={() => setDeleteConfirmModal({ isOpen: true, item })}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Pagination Bar */}
                    <div className="config-pagination-bar">
                      <span>
                        Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{" "}
                        <strong>{Math.min(currentPage * pageSize, filteredPermissions.length)}</strong> of{" "}
                        <strong>{filteredPermissions.length}</strong> permissions
                      </span>

                      <div className="config-pagination-btns">
                        <button
                          type="button"
                          className="config-page-btn"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </button>
                        <span style={{ margin: "0 6px", fontWeight: 600 }}>
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          type="button"
                          className="config-page-btn"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Edit Menu Access Popup Modal */}
              {editModal.isOpen && editModal.item && (
                <div
                  className="config-modal-backdrop"
                  onClick={() => setEditModal({ isOpen: false, item: null, module: "", subMenu: "", permission: "READ" })}
                >
                  <div
                    className="config-modal-card config-edit-modal-card"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="config-edit-modal-header">
                      <div className="config-edit-modal-header-left">
                        <div>
                          <h3 className="config-edit-modal-title">Edit Menu Access</h3>
                          <p className="config-edit-modal-subtitle">
                            Modify menu permissions for <strong>{editModal.item.employeeName}</strong>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="config-edit-modal-close"
                        onClick={() => setEditModal({ isOpen: false, item: null, module: "", subMenu: "", permission: "READ" })}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="config-edit-modal-body">
                      {/* Employee Summary Chip */}
                      <div className="config-edit-emp-summary">
                        <div className="config-emp-avatar">
                          {editModal.item.employeeName?.charAt(0)?.toUpperCase() || "E"}
                        </div>
                        <div className="config-emp-meta">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="config-emp-name" style={{ fontSize: "14px", fontWeight: "600" }}>
                              {editModal.item.employeeName}
                            </span>
                            <span className="config-emp-id-chip">{editModal.item.empId}</span>
                          </div>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            {editModal.item.department || "General"}
                          </span>
                        </div>
                      </div>

                      {/* Menu Field */}
                      <div className="config-field-group">
                        <label className="config-label">
                          <span className="config-label-text">Select Menu / Tab</span>
                        </label>
                        <CustomDropdown
                          className="config-field-dropdown"
                          options={menuOptions}
                          value={editModal.module}
                          onChange={(val) => setEditModal((prev) => ({ ...prev, module: val, subMenu: "" }))}
                          placeholder="Choose Menu"
                          disabled={menuAccessSubmitting}
                        />
                      </div>

                      {/* Sub-Menu Field */}
                      <div className="config-field-group">
                        <label className="config-label">
                          <span className="config-label-text">Select Sub-Menu</span>
                        </label>
                        <CustomDropdown
                          className="config-field-dropdown"
                          options={editModalSubMenuOptions}
                          value={editModal.subMenu}
                          onChange={(val) => setEditModal((prev) => ({ ...prev, subMenu: val }))}
                          placeholder={editModalSubItems.length > 0 ? "Entire Menu (All Submenus)" : "(Single Menu - No Submenus)"}
                          disabled={menuAccessSubmitting || editModalSubItems.length === 0}
                        />
                      </div>

                      {/* Access Permission Field */}
                      <div className="config-field-group">
                        <label className="config-label">
                          <span className="config-label-text">Access Permission</span>
                        </label>
                        <div className="config-access-type-group">
                          <button
                            type="button"
                            className={`config-access-type-btn ${editModal.permission === "READ" ? "active-read" : ""}`}
                            onClick={() => setEditModal((prev) => ({ ...prev, permission: "READ" }))}
                          >
                            <Icon icon="solar:eye-bold" width="16" />
                            <span>Read</span>
                          </button>
                          <button
                            type="button"
                            className={`config-access-type-btn ${
                              editModal.permission === "WRITE" || editModal.permission === "BOTH" || editModal.permission === "FULL_ACCESS"
                                ? "active-write"
                                : ""
                            }`}
                            onClick={() => setEditModal((prev) => ({ ...prev, permission: "WRITE" }))}
                          >
                            <Icon icon="solar:pen-new-square-bold" width="16" />
                            <span>Write</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="config-modal-actions" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
                      <button
                        type="button"
                        className="common-modal-btn btn-small-cancel"
                        onClick={() => setEditModal({ isOpen: false, item: null, module: "", subMenu: "", permission: "READ" })}
                        disabled={menuAccessSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="common-modal-btn btn-update"
                        onClick={handleSaveEditModal}
                        disabled={menuAccessSubmitting || !editModal.module}
                        style={{ height: "38px", padding: "0 18px", fontSize: "13px" }}
                      >
                        {menuAccessSubmitting ? "Updating..." : "Update Access"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Revoke / Delete Confirmation Modal */}
              {deleteConfirmModal.isOpen && deleteConfirmModal.item && (
                <div
                  className="config-modal-backdrop"
                  onClick={() => setDeleteConfirmModal({ isOpen: false, item: null })}
                >
                  <div className="config-modal-card" onClick={(e) => e.stopPropagation()}>
                    <div className="config-modal-icon-wrap">
                      <Icon icon="solar:danger-triangle-bold" width="24" />
                    </div>
                    <div>
                      <h3 className="config-modal-title">Revoke Menu Access</h3>
                      <p className="config-modal-desc">
                        Are you sure you want to revoke access to{" "}
                        <strong>{deleteConfirmModal.item.module}</strong>
                        {deleteConfirmModal.item.subMenu
                          ? ` (${deleteConfirmModal.item.subMenu})`
                          : " (Entire Menu)"}{" "}
                        for <strong>{deleteConfirmModal.item.employeeName}</strong>?
                      </p>
                    </div>
                    <div className="config-modal-actions">
                      <button
                        type="button"
                        className="common-modal-btn btn-small-cancel"
                        onClick={() => setDeleteConfirmModal({ isOpen: false, item: null })}
                        disabled={menuAccessSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="config-modal-btn-delete"
                        onClick={handleConfirmDelete}
                        disabled={menuAccessSubmitting}
                      >
                        {menuAccessSubmitting ? "Revoking..." : "Yes, Revoke Access"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Configuration;

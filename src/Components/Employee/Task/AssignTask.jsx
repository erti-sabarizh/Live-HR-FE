import React, { useState, useEffect, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CustomDropdown from "../../Common/CustomDropdown";
import { portalInstance } from "../../../Services/instance";
import "../../Admin/Task/AssignTask.css";
import "../../../Globel/Layout.css";
import attachIcon from "../../../assets/ant-design_file-add-filled.png";
import closeIcon from "../../../assets/close.png";
import DateIcon from "../../../assets/uiw_date.svg";

const PRIORITY_OPTIONS = [
  { value: "High", label: "High" },
  { value: "Mid", label: "Mid" },
  { value: "Low", label: "Low" },
];

const TASK_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "inprocess", label: "In Process" },
  { value: "hold", label: "Hold" },
  { value: "completed", label: "Completed" },
];

const PHASE_STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "#f59e0b" },
  { value: "inprocess", label: "In Process", color: "#3b82f6" },
  { value: "hold", label: "Hold", color: "#ef4444" },
  { value: "completed", label: "Completed", color: "#22c55e" },
];

const getUserIdFromToken = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(base64));
    return payload.id || payload._id;
  } catch {
    return null;
  }
};

function AssignTask({ onClose, onSuccess }) {
  const sessionRaw = sessionStorage.getItem("Erti-Portal");
  const sessionData = sessionRaw ? JSON.parse(sessionRaw) : {};
  const token = sessionData?.token;
  const loggedInUserId =
    sessionData?.user?._id || (token ? getUserIdFromToken(token) : null);
  const todayStr = new Date().toISOString().split("T")[0];

  // ── Form state ──────────────────────────────────────────────
  const [formData, setFormData] = useState({
    taskTitle: "",
    taskDetails: "",
    priority: "Mid",
    startDate: "",
    dueDate: "",
    endDate: "",
    status: "pending",
    phases: [],
    category: "",
    project: "",
    workType: "",
    hasPages: false,
    pages: [],
  });

  const [projectPages, setProjectPages] = useState([]);
  const [newPageVal, setNewPageVal] = useState("");
  const [phasePointByPoint, setPhasePointByPoint] = useState({});
  const [isTaskPointByPoint, setIsTaskPointByPoint] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Meta lists ───────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [fullCategories, setFullCategories] = useState([]);
  const [fullProjects, setFullProjects] = useState([]);
  const [showAllProjects, setShowAllProjects] = useState(false);

  // ── Dropdown open flags ──────────────────────────────────────
  const [showCategoryDrop, setShowCategoryDrop] = useState(false);
  const [showProjectDrop, setShowProjectDrop] = useState(false);

  // ── Add-new input toggle + values ────────────────────────────
  const [showAddCatInput, setShowAddCatInput] = useState(false);
  const [showAddProjInput, setShowAddProjInput] = useState(false);
  const [newCategoryVal, setNewCategoryVal] = useState("");
  const [newProjectVal, setNewProjectVal] = useState("");

  // ── Refs for click-outside close ─────────────────────────────
  const categoryRef = useRef(null);
  const projectRef = useRef(null);

  const [activeOtherField, setActiveOtherField] = useState(null);
  const startDateRef = useRef(null);
  const dueDateRef = useRef(null);
  const endDateRef = useRef(null);

  // ── Fetch task-meta on mount ─────────────────────────────────
  useEffect(() => {
    portalInstance
      .get("/creat/task-meta")
      .then((r) => {
        if (r.data?.success) {
          const rawCats = r.data.data.categories || [];
          const sortedCats = [
            ...rawCats.filter((c) => c && c.toLowerCase() !== "add"),
            ...rawCats.filter((c) => c && c.toLowerCase() === "add"),
          ];

          const rawProjs = r.data.data.projects || [];
          const sortedProjs = [
            ...rawProjs.filter((p) => p && p.toLowerCase() !== "add"),
            ...rawProjs.filter((p) => p && p.toLowerCase() === "add"),
          ];

          setCategories(sortedCats);
          setProjects(sortedProjs);
          setFullCategories(r.data.data.fullCategories || []);
          setFullProjects(r.data.data.fullProjects || []);
          setProjectPages(r.data.data.projectPages || []);
        }
      })
      .catch(() => { });
  }, []);

  // ── Click-outside to close dropdowns ────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) {
        setShowCategoryDrop(false);
        setShowAddCatInput(false);
      }
      if (projectRef.current && !projectRef.current.contains(e.target)) {
        setShowProjectDrop(false);
        setShowAddProjInput(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Handlers ────────────────────────────────────────────────
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handlePriorityChange = (value) =>
    setFormData((prev) => ({ ...prev, priority: value }));

  const handleStatusChange = (value) =>
    setFormData((prev) => {
      const isCompleted = (value || "").toLowerCase() === "completed";
      return {
        ...prev,
        status: value,
        endDate: isCompleted ? todayStr : "",
      };
    });

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (i) =>
    setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i));

  // Category toggle
  const handleCategoryToggle = (cat) => {
    setShowAllProjects(false);
    if (cat === "Add") {
      setActiveOtherField("category");
    } else {
      setActiveOtherField(null);
    }
    setFormData((prev) => {
      const isSelected = prev.category === cat;
      const nextCategory = isSelected ? "" : cat;

      let nextProject = prev.project;
      if (nextCategory) {
        const projObj = fullProjects.find((p) => p.name === prev.project);
        const catName = projObj?.categoryId?.name;
        if (catName !== nextCategory) nextProject = "";
      } else {
        nextProject = "";
      }

      return {
        ...prev,
        category: nextCategory,
        project: nextProject,
        workType: isStackEligibleCategory(nextCategory) ? prev.workType : "",
        pages: []
      };
    });
  };

  const isStackEligibleCategory = (cat) => {
    if (!cat) return false;
    const normalized = cat.trim().toLowerCase();
    return (
      normalized === "website" ||
      normalized === "app" ||
      normalized === "client projects" ||
      normalized === "client project" ||
      normalized === "dashboard" ||
      normalized === "dashbaord"
    );
  };

  const getPagesForProject = (catName, projName) => {
    if (!catName || !projName) return [];
    const normCat = (catName || "").trim().toLowerCase();
    const normProj = (projName || "").trim().toLowerCase();
    const found = projectPages.find(
      pp =>
        (pp.category || "").trim().toLowerCase() === normCat &&
        (pp.project || "").trim().toLowerCase() === normProj
    );
    return found?.pages || [];
  };

  const handleTogglePagesRadio = () => {
    setFormData(prev => {
      const nextVal = !prev.hasPages;
      return {
        ...prev,
        hasPages: nextVal,
        pages: nextVal ? (prev.pages || []) : []
      };
    });
  };

  const handlePageSelect = (pageVal) => {
    if (!formData.project) {
      toast.warning("Please select a Project first");
      return;
    }
    if (pageVal === "Add") {
      setActiveOtherField("page");
      setNewPageVal("");
      return;
    }
    if (!pageVal) return;
    setFormData(prev => {
      const currentPages = prev.pages || [];
      if (currentPages.includes(pageVal)) return prev;
      return { ...prev, pages: [...currentPages, pageVal] };
    });
  };

  const removePage = (pageName) => {
    setFormData(prev => ({
      ...prev,
      pages: (prev.pages || []).filter(p => p !== pageName)
    }));
  };

  const handleAddPage = async () => {
    const val = newPageVal?.trim();
    if (!val) return;
    const catName = formData.category;
    const projName = formData.project;
    if (!catName || !projName) return toast.warning("Please select category and project first");

    const existingProjectPages = getPagesForProject(catName, projName);
    const exists = existingProjectPages.some(p => (p || "").toLowerCase() === val.toLowerCase());
    if (exists) {
      toast.info(`"${val}" is already available in the dropdown.`);
      setActiveOtherField(null);
      setNewPageVal("");
      return;
    }

    try {
      const res = await portalInstance.post("/creat/task-meta/page", {
        category: catName,
        project: projName,
        name: val
      });
      if (res.data?.success && res.data.data) {
        const updatedPages = res.data.data.pages || [val];
        setProjectPages(prev => {
          const normCat = (catName || "").trim().toLowerCase();
          const normProj = (projName || "").trim().toLowerCase();
          const existing = prev.find(
            pp =>
              (pp.category || "").trim().toLowerCase() === normCat &&
              (pp.project || "").trim().toLowerCase() === normProj
          );
          if (existing) {
            return prev.map(pp =>
              (pp.category || "").trim().toLowerCase() === normCat &&
              (pp.project || "").trim().toLowerCase() === normProj
                ? { ...pp, pages: updatedPages }
                : pp
            );
          } else {
            return [...prev, { category: catName, project: projName, pages: updatedPages }];
          }
        });
      }
      setFormData(prev => ({
        ...prev,
        pages: [...new Set([...(prev.pages || []), val])]
      }));
      setActiveOtherField(null);
      setNewPageVal("");
      toast.success(`Page "${val}" added`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add page");
    }
  };

  const [pageToDeleteFromProject, setPageToDeleteFromProject] = useState(null);

  const handlePromptDeleteProjectPage = (pageName, category, project) => {
    if (!pageName || !project || !category) return;
    setPageToDeleteFromProject({ pageName, category, project });
  };

  const confirmDeleteProjectPage = async () => {
    if (!pageToDeleteFromProject) return;
    const { pageName, category, project } = pageToDeleteFromProject;
    try {
      const res = await portalInstance.delete("/creat/task-meta/page", {
        data: { category, project, page: pageName }
      });
      if (res.data?.success) {
        toast.success(`Page "${pageName}" deleted successfully!`);
        const updatedPages = res.data.data?.pages;
        setProjectPages(prev => {
          const normCat = (category || "").trim().toLowerCase();
          const normProj = (project || "").trim().toLowerCase();
          return prev.map(pp => {
            if (
              (pp.category || "").trim().toLowerCase() === normCat &&
              (pp.project || "").trim().toLowerCase() === normProj
            ) {
              return {
                ...pp,
                pages: updatedPages || (pp.pages || []).filter(p => p.toLowerCase() !== pageName.toLowerCase())
              };
            }
            return pp;
          });
        });

        setFormData(prev => ({
          ...prev,
          pages: Array.isArray(prev.pages) ? prev.pages.filter(p => p.toLowerCase() !== pageName.toLowerCase()) : []
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete page");
    } finally {
      setPageToDeleteFromProject(null);
    }
  };

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

  const handleToggleTaskPointByPoint = () => {
    const nextMode = !isTaskPointByPoint;
    setIsTaskPointByPoint(nextMode);
    const currentDetails = formData.taskDetails || "";
    if (nextMode) {
      setFormData(prev => ({
        ...prev,
        taskDetails: formatToNumberedPoints(currentDetails)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        taskDetails: removeNumberedPoints(currentDetails)
      }));
    }
  };

  const handleTaskDetailsKeyDown = (e) => {
    if (!isTaskPointByPoint) return;

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
          setFormData(prev => ({ ...prev, taskDetails: newText }));
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
          return;
        }

        const insertion = "\n• ";
        const newText = textBeforeCursor + insertion + textAfterCursor;
        const newCursorPos = selectionStart + insertion.length;

        setFormData(prev => ({ ...prev, taskDetails: newText }));
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        }, 0);
      } else {
        const insertion = "\n• ";
        const newText = textBeforeCursor + insertion + textAfterCursor;
        const newCursorPos = selectionStart + insertion.length;

        setFormData(prev => ({ ...prev, taskDetails: newText }));
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        }, 0);
      }
    }
  };

  const handleTaskDetailsPaste = (e) => {
    if (!isTaskPointByPoint) return;

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

    const linesBefore = textBefore.split("\n");
    const currentLine = linesBefore[linesBefore.length - 1];
    const match = currentLine.match(/^([•\-\*]|\d+[\.\)])\s*/);

    const formattedPaste = pastedLines
      .map(line => `• ${line}`)
      .join("\n");

    const newText = textBefore + formattedPaste + textAfter;
    setFormData(prev => ({ ...prev, taskDetails: newText }));
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = (textBefore + formattedPaste).length;
    }, 0);
  };

  const handleTogglePhasePointByPoint = (index) => {
    const isCurrent = !!phasePointByPoint[index];
    const nextMode = !isCurrent;
    setPhasePointByPoint(prev => ({ ...prev, [index]: nextMode }));
    const currentDesc = formData.phases[index]?.phaseDescription || "";
    if (nextMode) {
      handlePhaseChange(index, "phaseDescription", formatToNumberedPoints(currentDesc));
    } else {
      handlePhaseChange(index, "phaseDescription", removeNumberedPoints(currentDesc));
    }
  };

  const handlePhaseDescKeyDown = (e, index) => {
    if (!phasePointByPoint[index]) return;

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
          handlePhaseChange(index, "phaseDescription", newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
          return;
        }

        const insertion = "\n• ";
        const newText = textBeforeCursor + insertion + textAfterCursor;
        const newCursorPos = selectionStart + insertion.length;

        handlePhaseChange(index, "phaseDescription", newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        }, 0);
      } else {
        const insertion = "\n• ";
        const newText = textBeforeCursor + insertion + textAfterCursor;
        const newCursorPos = selectionStart + insertion.length;

        handlePhaseChange(index, "phaseDescription", newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        }, 0);
      }
    }
  };

  const handlePhaseDescPaste = (e, index) => {
    if (!phasePointByPoint[index]) return;

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

    const linesBefore = textBefore.split("\n");
    const currentLine = linesBefore[linesBefore.length - 1];
    const match = currentLine.match(/^([•\-\*]|\d+[\.\)])\s*/);

    const formattedPaste = pastedLines
      .map(line => `• ${line}`)
      .join("\n");

    const newBefore = match
      ? textBefore.substring(0, textBefore.length - match[0].length)
      : textBefore;

    const newText = newBefore + formattedPaste + textAfter;
    handlePhaseChange(index, "phaseDescription", newText);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd =
        (newBefore + formattedPaste).length;
    }, 0);
  };

  // Project toggle
  const handleProjectToggle = (projName) => {
    if (
      formData.category.includes("Add") ||
      activeOtherField === "category"
    ) {
      toast.warning("Please finalize your category selection first.");
      return;
    }
    if (projName === "See All Values") {
      setShowAllProjects(true);
      return;
    }
    if (projName === "Add") {
      setActiveOtherField("project");
    } else {
      setActiveOtherField(null);
    }
    setFormData((prev) => {
      const isSelected = prev.project === projName;
      const nextProject = isSelected ? "" : projName;
      return { ...prev, project: nextProject };
    });
  };

  // Add new category
  const handleAddCategory = (overrideName = null) => {
    const name = (
      typeof overrideName === "string" ? overrideName : newCategoryVal
    ).trim();
    if (!name) return;

    const exists = categories.some(
      (c) => c && c.toLowerCase() === name.toLowerCase()
    ) || fullCategories.some(
      (c) => c && c.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      toast.info(`"${name}" is already available.`);
      setActiveOtherField(null);
      setFormData((prev) => ({ ...prev, category: name, project: "" }));
      setNewCategoryVal("");
      setShowAllProjects(false);
      return;
    }

    // Store in local categories list only; DO NOT save category to TaskMeta module
    setCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setActiveOtherField(null);
    setFormData((prev) => ({ ...prev, category: name, project: "" }));
    setNewCategoryVal("");
    setShowAllProjects(false);
  };

  // Add new project
  const handleAddProject = async (overrideName = null) => {
    const name = (
      typeof overrideName === "string" ? overrideName : newProjectVal
    ).trim();
    if (!name) return;

    const exists = projects.some(
      (p) => p && p.toLowerCase() === name.toLowerCase()
    ) || fullProjects.some(
      (p) => p && p.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      toast.info(`"${name}" is already available.`);
      setActiveOtherField(null);
      setFormData((prev) => ({ ...prev, project: name }));
      setNewProjectVal("");
      return;
    }

    const selectedCatName = formData.category;
    if (!selectedCatName) {
      toast.error("Please select a category first");
      return;
    }
    const catObj = fullCategories.find(
      (c) => c.name.toLowerCase() === selectedCatName.toLowerCase()
    );

    try {
      await portalInstance.post("/creat/task-meta/project", {
        name,
        categoryId: catObj?._id,
        categoryName: selectedCatName,
      });

      const r = await portalInstance.get("/creat/task-meta");
      if (r.data?.success) {
        setCategories(r.data.data.categories || []);
        setProjects(r.data.data.projects || []);
        setFullCategories(r.data.data.fullCategories || []);
        setFullProjects(r.data.data.fullProjects || []);
      }

      setActiveOtherField(null);
      setFormData((prev) => ({ ...prev, project: name }));
      setNewProjectVal("");
      toast.success(`Project "${name}" added & selected`);
    } catch (err) {
      if (err.response?.status === 409) {
        toast.info(`"${name}" already exists. Selected automatically.`);
        const r = await portalInstance.get("/creat/task-meta");
        if (r.data?.success) {
          setCategories(r.data.data.categories || []);
          setProjects(r.data.data.projects || []);
          setFullCategories(r.data.data.fullCategories || []);
          setFullProjects(r.data.data.fullProjects || []);
        }
        setActiveOtherField(null);
        setFormData((prev) => ({ ...prev, project: name }));
        setNewProjectVal("");
      } else {
        toast.error(err.response?.data?.message || "Failed to add project");
      }
    }
  };

  const handleCancel = () => {
    if (onClose) onClose();
  };

  // ── Phase handlers ───────────────────────────────────────────
  const addPhase = () => {
    if (!formData.category) {
      toast.info("Please select a Category first");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      phases: [
        ...prev.phases,
        { phaseTitle: "", phaseDescription: "", phaseStatus: "pending" },
      ],
    }));
  };

  const handlePhaseChange = (index, field, value) => {
    const updated = [...formData.phases];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev) => ({ ...prev, phases: updated }));
  };

  const removePhase = (index) => {
    setFormData((prev) => ({
      ...prev,
      phases: prev.phases.filter((_, i) => i !== index),
    }));
  };

  // ── Submit ───────────────────────────────────────────────────
  const createTask = async () => {
    if (!formData.category)
      return toast.error("Category is required");
    if (!formData.project)
      return toast.error("Project is required");
    if (!formData.taskTitle.trim())
      return toast.error("Task title is required");
    if (!formData.taskDetails.trim())
      return toast.error("Task details are required");
    if (!formData.startDate) return toast.error("Start date is required");
    const isCompletedStatus = (formData.status || "").toLowerCase() === "completed";
    if (isCompletedStatus && !formData.endDate) {
      formData.endDate = todayStr;
    }
    if (formData.startDate < todayStr)
      return toast.error("Start date cannot be in the past");
    if (formData.dueDate && formData.dueDate < formData.startDate)
      return toast.error("Due date cannot be before start date");
    if (isCompletedStatus && formData.endDate && formData.endDate < formData.startDate)
      return toast.error("End date cannot be before start date");

    setLoading(true);
    try {
      const data = new FormData();
      data.append("taskTitle", formData.taskTitle.trim());
      data.append("taskDetails", formData.taskDetails.trim());
      data.append("priority", formData.priority);
      data.append("startDate", formData.startDate);
      data.append("dueDate", formData.dueDate);
      data.append("endDate", formData.endDate);
      // Main task status starts as chosen status during creation
      data.append("status", formData.status || "pending");

      // Filter and standardize phases
      const filteredPhases = formData.phases
        .filter((p) => p.phaseTitle?.trim())
        .map((p) => ({
          phaseTitle: p.phaseTitle.trim(),
          phaseDescription: (p.phaseDescription || "").trim(),
          phaseStatus: p.phaseStatus || "pending",
          updateDate: new Date().toISOString(),
        }));

      if (filteredPhases.length > 0) {
        data.append("phases", JSON.stringify(filteredPhases));
      }
      data.append(
        "assignedMembers",
        JSON.stringify([loggedInUserId])
      );
      data.append("assignedStatus", "Accepted");
      data.append("category", formData.category);
      data.append("project", formData.project);

      const formattedWorkType = isStackEligibleCategory(formData.category) ? (formData.workType || "").trim() : "";
      const formattedPages = formData.hasPages && Array.isArray(formData.pages) ? formData.pages : [];
      if (formattedWorkType) data.append("workType", formattedWorkType);
      if (formattedPages.length > 0) data.append("pages", JSON.stringify(formattedPages));

      uploadedFiles.forEach((file) => data.append("files", file));

      // ✅ SINGLE API CALL ONLY — backend createTask already calls
      // syncPhaseToDailyWorkUpdate for every phase automatically.
      await portalInstance.post("/creat/task", data);

      toast.success("Task created successfully!");

      setFormData({
        taskTitle: "",
        taskDetails: "",
        priority: "Mid",
        status: "pending",
        startDate: "",
        dueDate: "",
        endDate: "",
        phases: [],
        category: "",
        project: "",
        workType: "",
        hasPages: false,
        pages: [],
      });
      setShowAllProjects(false);
      setPhasePointByPoint({});
      setIsTaskPointByPoint(false);
      setUploadedFiles([]);
      if (onSuccess) onSuccess();
      setTimeout(() => onClose && onClose(), 1500);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Task creation failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const categoryProjects = fullProjects
    .filter((p) => {
      if (!p.categoryId) return false;
      const catName =
        typeof p.categoryId === "object"
          ? p.categoryId.name
          : fullCategories.find(
            (c) => String(c._id) === String(p.categoryId)
          )?.name;
      return catName && (formData.category || "").toLowerCase() === catName.toLowerCase();
    })
    .map((p) => p.name);

  const allAvailableProjects = Array.from(
    new Set(fullProjects.map((p) => p.name).filter(Boolean))
  );

  const activeProjectList = showAllProjects ? allAvailableProjects : categoryProjects;

  const projectDropdownOptions = [
    ...activeProjectList
      .filter((p) => p && p.toLowerCase() !== "add" && p.toLowerCase() !== "see all values")
      .map((p) => ({ value: p, label: p })),
    ...(!showAllProjects ? [{ value: "See All Values", label: "See All Values", keepOpen: true }] : []),
    { value: "Add", label: "Add" },
  ].filter(
    (v, i, a) => a.findIndex((t) => t.value === v.value) === i
  );

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="assign-task-page employee-assign-task-page">
      <style>{`
        .employee-assign-task-page {
          overflow-x: hidden !important;
        }
        .phases-section {
          margin: 18px 0 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px 14px;
          background: #fafbfc;
        }
        .employee-assign-task-page .atPhase__addBtn {
          height: 28px;
          padding: 0 12px;
           background: #5977f8;
          border-color: #5977f8;
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .employee-assign-task-page .atPhase__addBtn:hover {
          background: #5977f8;
          border-color: #5977f8;
          color: #fff;
          box-shadow: 0 2px 8px rgba(89, 119, 248, 0.2);
        }
        .employee-assign-task-page .atPhase__addBtn:active {
          transform: scale(0.97);
        }
      `}</style>

      <div className="assign-task-container">

        {/* ── HEADER ── */}
        <div className="task-header">
          <h4 className="assign-task__members-title mb-2">Create New Task</h4>
          <button
            className="at-close-btn"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <img src={closeIcon} alt="close" />
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="task-body">


          {/* Right: Form */}
          <div className="task-form">

            {/* Category + Project Row */}
            <div className="form-row at-cat-proj-row">
              {/* Category */}
              <div className="form-group" ref={categoryRef}>
                <label className="mb-1">Category *</label>
                {activeOtherField === "category" ? (
                  <div className="atMeta__inlineAdd animate-fade-in">
                    <input
                      type="text"
                      className="hrms-unified-input-style atMeta__addInput"
                      placeholder="Type new category..."
                      value={newCategoryVal}
                      autoFocus
                      onChange={(e) => setNewCategoryVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddCategory();
                      }}
                    />
                    <button
                      type="button"
                      className="atMeta__saveBtn"
                      onClick={() => handleAddCategory()}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <CustomDropdown
                    options={[...new Set(categories), "Add"].map((c) => ({
                      value: c,
                      label: c,
                    }))}
                    value={formData.category}
                    onChange={(val) => handleCategoryToggle(val)}
                    placeholder="Select Category"
                    className="hrms-unified-dropdown-style atMeta__customDrop"
                  />
                )}
              </div>

              {/* Project */}
              <div className="form-group" ref={projectRef}>
                <label className="mb-1">Project *</label>
                {activeOtherField === "project" ? (
                  <div className="atMeta__inlineAdd animate-fade-in">
                    <input
                      type="text"
                      className="hrms-unified-input-style atMeta__addInput"
                      placeholder="Type new project..."
                      value={newProjectVal}
                      autoFocus
                      onChange={(e) => setNewProjectVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddProject();
                      }}
                    />
                    <button
                      type="button"
                      className="atMeta__saveBtn"
                      onClick={() => handleAddProject()}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <CustomDropdown
                    options={projectDropdownOptions}
                    value={formData.project}
                    onChange={(val) => handleProjectToggle(val)}
                    disabled={
                      !formData.category || formData.category === "Add"
                    }
                    placeholder={
                      !formData.category || formData.category === "Add"
                        ? "Select Category first"
                        : "Select Project"
                    }
                    className="hrms-unified-dropdown-style atMeta__customDrop"
                  />
                )}
              </div>
            </div>

            {/* Work Type */}
            {isStackEligibleCategory(formData.category) && (
              <div className="form-group animate-fade-in at-work-type-group" style={{ marginBottom: "8px" }}>
                <label className="mb-1" style={{ fontSize: "12px", fontWeight: "400", color: "#868585" }}>Work Type</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "8px",
                    width: "100%",
                    padding: "1px 0"
                  }}
                >
                  {[
                    { value: "BE", title: "BE", desc: "Back End" },
                    { value: "FE", title: "FE", desc: "Front End" },
                    { value: "FE & BE", title: "FE & BE", desc: "Front & Back End" },
                    { value: "Design", title: "Design", desc: "Design" }
                  ].map((opt) => {
                    const isSelected = formData.workType === opt.value;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => setFormData(prev => ({ ...prev, workType: isSelected ? "" : opt.value }))}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: isSelected ? "1.5px solid #5977f8" : "1px solid #e2e8f0",
                          background: isSelected ? "#f0f4ff" : "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          userSelect: "none",
                          boxShadow: isSelected ? "0 1px 4px rgba(89, 119, 248, 0.1)" : "none"
                        }}
                      >
                        <input
                          type="radio"
                          name="createTaskWorkType"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{
                            accentColor: "#5977f8",
                            cursor: "pointer",
                            width: "13px",
                            height: "13px",
                            margin: 0,
                            flexShrink: 0,
                            pointerEvents: "none"
                          }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: isSelected ? "600" : "500",
                              color: isSelected ? "#5977f8" : "#2d3748"
                            }}
                          >
                            {opt.title}
                          </span>
                          <span
                            style={{
                              fontSize: "9px",
                              color: isSelected ? "#5977f8" : "#8c9ba5",
                              marginTop: "1px",
                              fontWeight: "400"
                            }}
                          >
                            {opt.desc}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pages Radio & Multi-select */}
            <div className="form-group at-pages-radio-group" style={{ marginTop: isStackEligibleCategory(formData.category) ? "4px" : "8px", marginBottom: formData.hasPages ? "4px" : "8px" }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#334155",
                  lineHeight: "1",
                  userSelect: "none",
                  margin: 0
                }}
                onClick={(e) => {
                  e.preventDefault();
                  handleTogglePagesRadio();
                }}
              >
                <input
                  type="radio"
                  name="createTaskPagesRadio"
                  checked={!!formData.hasPages}
                  onChange={() => {}}
                  style={{
                    accentColor: "#5977f8",
                    width: "16px",
                    height: "16px",
                    margin: 0,
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                />
                <span>Pages</span>
              </label>
            </div>

            {formData.hasPages && (
              <div className="form-group animate-fade-in at-pages-select-group" style={{ marginTop: "4px", marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: "400", color: "#868585" }}>Select Page</label>
                {activeOtherField === "page" ? (
                  <div className="atMeta__inlineAdd animate-fade-in">
                    <input
                      type="text"
                      className="hrms-unified-input-style atMeta__addInput"
                      placeholder="New page name..."
                      value={newPageVal}
                      autoFocus
                      onChange={(e) => setNewPageVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddPage(); }}
                      disabled={!formData.project}
                    />
                    <button type="button" className="atMeta__saveBtn" onClick={handleAddPage} disabled={!formData.project}>
                      Save
                    </button>
                    <button
                      type="button"
                      style={{
                        background: "#f1f5f9",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        color: "#475569",
                        marginLeft: "4px",
                        cursor: "pointer"
                      }}
                      onClick={() => {
                        setActiveOtherField(null);
                        setNewPageVal("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <CustomDropdown
                    options={[
                      ...getPagesForProject(formData.category, formData.project).filter(p => p && p.toLowerCase() !== "add").map(p => ({
                        value: p,
                        label: p,
                        onDelete: () => handlePromptDeleteProjectPage(p, formData.category, formData.project)
                      })),
                      { value: "Add", label: "Add" }
                    ]}
                    value=""
                    placeholder={formData.project ? "Select Page" : "Select Project First"}
                    onChange={(v) => handlePageSelect(v)}
                    disabled={!formData.project}
                    className="hrms-unified-dropdown-style atMeta__customDrop"
                  />
                )}

                {/* Selected pages chips */}
                {Array.isArray(formData.pages) && formData.pages.length > 0 && (
                  <div className="dwu-selected-pages-container" style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                    {formData.pages.map((pName) => (
                      <div
                        key={pName}
                        className="dwu-page-card"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "#f0f4ff",
                          border: "1px solid #c7d2fe",
                          borderRadius: "4px",
                          padding: "2px 8px",
                          fontSize: "12px",
                          color: "#374151"
                        }}
                      >
                        <span>{pName}</span>
                        <button
                          type="button"
                          title={`Remove ${pName}`}
                          onClick={() => removePage(pName)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#6b7280",
                            cursor: "pointer",
                            fontSize: "11px",
                            padding: "0 2px"
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Task Title */}
            <div className="form-group">
              <label>Task Title *</label>
              <input
                type="text"
                name="taskTitle"
                value={formData.taskTitle}
                onChange={handleChange}
                placeholder="Enter task title..."
                className="hrms-unified-input-style"
              />
            </div>

            {/* Task Details */}
            <div className="form-group" style={{ marginBottom: "5px" }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label style={{ margin: 0 }}>Task Details *</label>
                <label
                  className="d-flex align-items-center gap-1"
                  onClick={handleToggleTaskPointByPoint}
                  style={{
                    fontSize: "11px",
                    fontWeight: "500",
                    color: isTaskPointByPoint ? "#5977f8" : "#77728e",
                    cursor: "pointer",
                    userSelect: "none",
                    margin: 0
                  }}
                  title="Format description as bullet points (• Point)"
                >
                  <input
                    type="radio"
                    name="employeeTaskDetailsPointByPoint"
                    checked={isTaskPointByPoint}
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
              </div>
              <textarea
                name="taskDetails"
                value={formData.taskDetails}
                onChange={handleChange}
                onKeyDown={handleTaskDetailsKeyDown}
                onPaste={handleTaskDetailsPaste}
                placeholder={isTaskPointByPoint ? "• Enter first point..." : "Describe the task..."}
                className="hrms-unified-input-style hrms-common-textarea"
              />
            </div>
            {/* Start Date + Due Date + End Date */}
            <div className="form-row " style={{ marginBottom: "14px" }}>
              <div className="form-group">
                <label>Start Date *</label>
                <div className="assign-date-wrapper position-relative">
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    name="startDate"
                    value={formData.startDate || ""}
                    onChange={handleChange}
                    className="hrms-unified-input-style custom-date"
                  />
                  <img
                    src={DateIcon}
                    alt="calendar"
                    className="date-icon cursor-pointer"
                    onClick={() => { if (startDateRef.current) { try { startDateRef.current.showPicker(); } catch (e) { } } }}
                  />
                  <input
                    ref={startDateRef}
                    type="date"
                    min={todayStr}
                    value={formData.startDate || ""}
                    onChange={(e) => handleChange({ target: { name: "startDate", value: e.target.value } })}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Due Date (Optional)</label>
                <div className="assign-date-wrapper position-relative">
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    name="dueDate"
                    value={formData.dueDate || ""}
                    onChange={handleChange}
                    className="hrms-unified-input-style custom-date"
                  />
                  <img
                    src={DateIcon}
                    alt="calendar"
                    className="date-icon cursor-pointer"
                    onClick={() => { if (dueDateRef.current) { try { dueDateRef.current.showPicker(); } catch (e) { } } }}
                  />
                  <input
                    ref={dueDateRef}
                    type="date"
                    min={todayStr}
                    value={formData.dueDate || ""}
                    onChange={(e) => handleChange({ target: { name: "dueDate", value: e.target.value } })}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>End Date *</label>
                <div className="assign-date-wrapper position-relative">
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    name="endDate"
                    value={formData.endDate || ""}
                    readOnly={true}
                    disabled={true}
                    className="hrms-unified-input-style custom-date field-disabled"
                  />
                  <img
                    src={DateIcon}
                    alt="calendar"
                    className="date-icon opacity-50 cursor-not-allowed"
                    style={{ pointerEvents: "none" }}
                  />
                </div>
              </div>
            </div>

            {/* Priority + Status */}
            <div className="form-row" style={{ marginBottom: "14px" }} >
              <div className="form-group">
                <label>Priority *</label>
                <CustomDropdown
                  options={PRIORITY_OPTIONS}
                  value={formData.priority}
                  onChange={handlePriorityChange}
                  placeholder="Select Priority"
                  className="hrms-unified-dropdown-style atMeta__customDrop"
                />
              </div>
              <div className="form-group">
                <label>Status *</label>
                <CustomDropdown
                  options={TASK_STATUS_OPTIONS}
                  value={formData.status}
                  onChange={handleStatusChange}
                  placeholder="Select Status"
                  className="hrms-unified-dropdown-style atMeta__customDrop"
                />
              </div>
            </div>



            {/* ── PHASES SECTION ── */}
            <div className="phases-section">
              <div className="atPhase__header">
                <label style={{ fontSize: "12px", fontWeight: "400", color: "#868585", margin: 0 }}>Phases *</label>
                <button
                  type="button"
                  className="atPhase__addBtn"
                  onClick={addPhase}
                >
                  + Add Phase
                </button>
              </div>

              <div className="atPhase__list">
                {formData.phases.map((p, index) => (
                  <div key={index} className="atPhase__item animate-fade-in">
                    {/* Row 1: Close button on the right end */}
                    {formData.phases.length > 0 && (
                      <div className="atPhase__closeWrapper">
                        <button
                          type="button"
                          className="hrms-common-close-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removePhase(index);
                          }}
                          title="Remove phase"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Row 2: Title and Status side-by-side */}
                    <div className="atPhase__topRow">
                      <input
                        type="text"
                        className="hrms-unified-input-style" style={{
                          fontSize: "13px",
                          color: "#374151"
                        }}
                        placeholder="Phase Title..."
                        value={p.phaseTitle}
                        onChange={(e) =>
                          handlePhaseChange(
                            index,
                            "phaseTitle",
                            e.target.value
                          )
                        }
                        disabled={!formData.category}
                      />
                      <div className="atPhase__statusWrapper">
                        <CustomDropdown
                          options={PHASE_STATUS_OPTIONS}
                          value={p.phaseStatus}
                          onChange={(val) =>
                            handlePhaseChange(index, "phaseStatus", val)
                          }
                          placeholder="Status"
                          disabled={!formData.category}
                          style={{
                            border: "none",
                            boxShadow: "none",
                            outline: "none",
                            background: "transparent",
                            width: "120px",
                            height: "35px",
                            minWidth: "120px",
                            marginBottom: "0",
                          }}
                        />
                      </div>
                    </div>

                    {/* Row 3: Description with Point by Point */}
                    <div className="d-flex justify-content-between align-items-center mb-1 mt-2">
                      <label style={{ fontSize: "11px", fontWeight: "500", color: "#64748b", margin: 0 }}>Description</label>
                      <label
                        className="d-flex align-items-center gap-1"
                        onClick={() => handleTogglePhasePointByPoint(index)}
                        style={{
                          fontSize: "11px",
                          fontWeight: "500",
                          color: phasePointByPoint[index] ? "#5977f8" : "#77728e",
                          cursor: "pointer",
                          userSelect: "none",
                          margin: 0
                        }}
                        title="Format description as bullet points (• Point)"
                      >
                        <input
                          type="radio"
                          name={`phaseDescFormat-${index}`}
                          checked={!!phasePointByPoint[index]}
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
                    </div>
                    <textarea
                      className="hrms-unified-input-style hrms-common-textarea" style={{
                        fontSize: "13px",
                        color: "#e2e8f0 "
                      }}

                      placeholder={phasePointByPoint[index] ? "• Enter first point..." : "Phase Description..."}

                      value={p.phaseDescription}
                      onChange={(e) =>
                        handlePhaseChange(
                          index,
                          "phaseDescription",
                          e.target.value
                        )
                      }
                      onKeyDown={(e) => handlePhaseDescKeyDown(e, index)}
                      onPaste={(e) => handlePhaseDescPaste(e, index)}
                      rows={2}

                      disabled={!formData.category}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Documents */}
            <div className="form-group " style={{ marginBottom: "0px" }} >
              <label>Documents</label>
              <label className="file-item">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.xlsm,.xlsb,.ods,.txt,.png,.jpg,.jpeg,.webp,.zip"
                  multiple
                  hidden
                />
                <div className="hrms-common-upload-box ">
                  <img
                    src={attachIcon}
                    alt="attach"
                    className="attach-icon"
                  />
                  <span>Add File</span>
                </div>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="hrms-common-file-list">
                {uploadedFiles.map((file, index) => (
                  <div className="hrms-common-file-item" key={index}>
                    <span className="hrms-common-file-name">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      className="hrms-common-file-remove"
                      onClick={() => removeFile(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="form-actions">
              <button
                className="hrms-common-btn-cancel"
                type="button"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                className="hrms-common-btn-primary"
                type="button"
                onClick={createTask}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {pageToDeleteFromProject && (
        <div className="dwu-page-confirm-overlay" onClick={() => setPageToDeleteFromProject(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 30000 }}>
          <div className="dwu-page-confirm-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ background: "#ffffff", padding: "20px 24px", borderRadius: "16px", width: "90%", maxWidth: "340px", textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", position: "relative" }}>
            <button
              type="button"
              className="dwu-page-confirm-close-btn"
              onClick={() => setPageToDeleteFromProject(null)}
              title="Close"
              aria-label="Close"
              style={{ position: "absolute", top: "12px", right: "12px", background: "transparent", border: "none", fontSize: "16px", color: "#94a3b8", cursor: "pointer" }}
            >
              ✕
            </button>
            <h3 className="dwu-page-confirm-title" style={{ fontSize: "16px", fontWeight: "600", color: "#1e293b", marginBottom: "8px" }}>Delete Page?</h3>
            <p className="dwu-page-confirm-text" style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.5", marginBottom: "20px" }}>
              Are you sure you want to delete <strong>"{pageToDeleteFromProject.pageName}"</strong>? This will permanently delete it from project <strong>"{pageToDeleteFromProject.project}"</strong>.
            </p>
            <div className="dwu-page-confirm-actions" style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                className="hrms-common-btn-cancel"
                onClick={() => setPageToDeleteFromProject(null)}
                style={{ flex: 1, padding: "8px 16px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hrms-common-btn-delete"
                onClick={confirmDeleteProjectPage}
                style={{ flex: 1, padding: "8px 16px" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} style={{ zIndex: 9999999 }} />
    </div>
  );
}

export default AssignTask;
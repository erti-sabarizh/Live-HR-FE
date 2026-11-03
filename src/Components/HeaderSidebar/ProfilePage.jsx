import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";
import Lottie from "lottie-react";
import ConfettiAnimation from "../../../Animation/Confetti.json";
import "./ProfilePage.css";
import { portalInstance } from "../../Services/instance";

const EDIT_STEP = {
  NONE: "none",
  SEND_OTP: "send_otp",
  VERIFY_OTP: "verify_otp",
  EDIT_FIELDS: "edit_fields",
};

const PASSWORD_STEP = {
  NONE: "none",
  SEND_OTP: "send_otp",
  VERIFY_OTP: "verify_otp",
};

const SPECIAL_CHAR_REGEX = /[!@#$%^&*?~\-_+=|[\]{};:'",./<>\\()]/;

const validatePassword = (pwd) => {
  return (
    pwd.length >= 12 &&
    /[A-Z]/.test(pwd) &&
    /[a-z]/.test(pwd) &&
    /[0-9]/.test(pwd) &&
    SPECIAL_CHAR_REGEX.test(pwd)
  );
};

const buildImageSrc = (photo, previewUrl = null) => {
  if (previewUrl) return previewUrl;
  if (!photo || photo === "avatar.png") {
    return "/avatar.png";
  }
  return photo;
};

const getCroppedImg = (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          const file = new File([blob], "cropped-profile.jpg", {
            type: "image/jpeg",
          });
          const previewUrl = URL.createObjectURL(blob);
          resolve({ file, previewUrl });
        },
        "image/jpeg",
        0.95
      );
    };
    image.onerror = (err) => reject(err);
    image.src = imageSrc;
  });
};

const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M9.778 21h4.444c3.121 0 4.682 0 5.803-.735a4.4 4.4 0 0 0 1.226-1.204c.749-1.1.749-2.633.749-5.697s0-4.597-.749-5.697a4.4 4.4 0 0 0-1.226-1.204c-.72-.473-1.622-.642-3.003-.702c-.659 0-1.226-.49-1.355-1.125A2.064 2.064 0 0 0 13.634 3h-3.268c-.988 0-1.839.685-2.033 1.636c-.129.635-.696 1.125-1.355 1.125c-1.38.06-2.282.23-3.003.702A4.4 4.4 0 0 0 2.75 7.667C2 8.767 2 10.299 2 13.364s0 4.596.749 5.697c.324.476.74.885 1.226 1.204C5.096 21 6.657 21 9.778 21M12 9.273c-2.301 0-4.167 1.831-4.167 4.09S9.7 17.456 12 17.456s4.167-1.832 4.167-4.091S14.3 9.273 12 9.273m0 1.636c-1.38 0-2.5 1.099-2.5 2.455c0 1.355 1.12 2.454 2.5 2.454s2.5-1.099 2.5-2.454s-1.12-2.455-2.5-2.455m4.722-.818c0-.452.373-.818.834-.818h1.11c.46 0 .834.366.834.818a.826.826 0 0 1-.833.818h-1.111a.826.826 0 0 1-.834-.818"
      clipRule="evenodd"
    />
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M12 17a2 2 0 0 0 2-2a2 2 0 0 0-2-2a2 2 0 0 0-2 2a2 2 0 0 0 2 2m6-9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 5-5a5 5 0 0 1 5 5v2zm-6-5a3 3 0 0 0-3 3v2h6V6a3 3 0 0 0-3-3"
    />
  </svg>
);

const AvatarBlock = ({
  photo,
  pendingPhotoPreview,
  pendingPhotoFile,
  photoUploading,
  onCameraClick,
  onUpdate,
  onCancel,
  fileInputRef,
  onFileChange,
  completionPercent = 0,
}) => {
  // SVG circle calculations
  const size = 116;            // SVG viewbox size
  const radius = 52; // Perfect radius for 116 container
  const strokeWidth = 3; // Thinner stroke for elegance
  const circumference = 2 * Math.PI * radius;
  const filledLength = (completionPercent / 100) * circumference;
  const gapLength = circumference - filledLength;

  return (
    <div className="profile-avatar-wrapper">
      <input
        type="file"
        accept="image/*"
        onChange={onFileChange}
        ref={fileInputRef}
        style={{ display: "none" }}
      />

      {/* Completion Ring + Avatar */}
      <div
        className="profile-completion-ring-wrapper"
        onClick={!pendingPhotoFile ? onCameraClick : undefined}
        style={{ cursor: pendingPhotoFile ? "default" : "pointer" }}
      >
        {/* SVG ring */}
        <svg
          className="profile-completion-svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background Track (Faint Ring) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(151, 170, 255, 0.2)"
            strokeWidth={strokeWidth}
          />
          {/* Filled arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(151, 170, 255, 1)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${filledLength} ${gapLength}`}
            strokeDashoffset={circumference * 0.25}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>

        {/* Avatar image inside */}
        <img
          src={buildImageSrc(photo, pendingPhotoPreview)}
          alt="Profile"
          className="profile-page-avatar"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/avatar.png";
          }}
        />
      </div>

      {!pendingPhotoFile && (
        <button
          type="button"
          className="profile-edit-badge profile-edit-badge--icon"
          onClick={onCameraClick}
          aria-label="Edit profile photo"
        >
          <CameraIcon />
        </button>
      )}

      {pendingPhotoFile && (
        <div className="profile-photo-actions">
          <button
            type="button"
            className="profile-page-save-btn"
            onClick={onUpdate}
            disabled={photoUploading}
            style={{ fontSize: "13px", padding: "6px 16px" }}
          >
            {photoUploading ? "Uploading..." : "Save"}
          </button>
          <button
            type="button"
            className="profile-page-cancel-btn"
            onClick={onCancel}
            disabled={photoUploading}
            style={{ fontSize: "13px", padding: "6px 16px" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

function ProfilePage({ isOpen, onClose, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("employee");
  const [editStep, setEditStep] = useState(EDIT_STEP.NONE);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    designation: "",
    photo: "",
    dob: "",
    isBirthday: false,
  });

  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpResendTimer, setOtpResendTimer] = useState(0);

  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
  });
  const [showPasswordBox, setShowPasswordBox] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [passwordStep, setPasswordStep] = useState(PASSWORD_STEP.NONE);
  const [passwordOtp, setPasswordOtp] = useState("");
  const [newPasswordOnly, setNewPasswordOnly] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordOtpTimer, setPasswordOtpTimer] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState("");

  const [toast, setToast] = useState(null);

  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const passwordTimerRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const clearExpiryFlag = () => {
    const session = JSON.parse(sessionStorage.getItem("Erti-Portal") || "{}");
    session.passwordExpiringSoon = false;
    sessionStorage.setItem("Erti-Portal", JSON.stringify(session));
    sessionStorage.removeItem("pwdExpiryDismissed");
  };

  useEffect(() => {
    if (otpResendTimer > 0) {
      timerRef.current = setTimeout(() => setOtpResendTimer((t) => t - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [otpResendTimer]);

  useEffect(() => {
    if (passwordOtpTimer > 0) {
      passwordTimerRef.current = setTimeout(
        () => setPasswordOtpTimer((t) => t - 1),
        1000
      );
    }
    return () => clearTimeout(passwordTimerRef.current);
  }, [passwordOtpTimer]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await portalInstance.get("/profile/get-profile");
        const data = res.data.data;
        setFormData({
          name: data.name || "",
          username: data.username || "",
          email: data.email || "",
          phone: data.phone || "",
          designation: data.designation || "",
          photo: data.photo || "",
          dob: data.dob || "",
          isBirthday: data.isBirthday || false,
        });
        setRole(data.role || "employee");
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setEditStep(EDIT_STEP.NONE);
      setShowPasswordBox(false);
      setPasswordStep(PASSWORD_STEP.NONE);
      setPasswordOtp("");
      setNewPasswordOnly("");
      setConfirmPassword("");
      setPasswordError("");
      setOtpCode("");
      setOtpError("");
      setPendingPhotoFile(null);
      setPendingPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setShowCropModal(false);
      setImageToCrop((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [isOpen]);

  const onCropComplete = useCallback((croppedArea, croppedAreaPx) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  const handleCropApply = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      const { file, previewUrl } = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setPendingPhotoFile(file);
      setPendingPhotoPreview(previewUrl);
      URL.revokeObjectURL(imageToCrop);
      setImageToCrop(null);
      setShowCropModal(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (err) {
      console.error("Crop failed:", err);
      showToast("Failed to crop image. Please try again.", "error");
    }
  };

  const handleCropCancel = () => {
    if (imageToCrop) URL.revokeObjectURL(imageToCrop);
    setImageToCrop(null);
    setShowCropModal(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleImageClick = () => {
    if (pendingPhotoFile) return;
    fileInputRef.current?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setShowCropModal(true);
  };

  const handlePhotoUpdate = async () => {
    if (!pendingPhotoFile) return;
    setPhotoUploading(true);
    try {
      const form = new FormData();
      form.append("photo", pendingPhotoFile);

      const res = await portalInstance.put("/profile/update-profile", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updatedPhotoKey = res?.data?.data?.photo;

      setFormData((prev) => ({
        ...prev,
        photo: updatedPhotoKey || prev.photo,
      }));

      URL.revokeObjectURL(pendingPhotoPreview);
      setPendingPhotoFile(null);
      setPendingPhotoPreview(null);

      showToast("Profile photo updated successfully!");
    } catch (err) {
      console.error("Image upload failed:", err);
      showToast("Image upload failed. Please try again.", "error");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoCancel = () => {
    if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
    setPendingPhotoFile(null);
    setPendingPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSendOtp = async () => {
    setOtpError("");
    if (!otpEmail) {
      setOtpError("Please enter your email");
      return;
    }
    try {
      setLoading(true);
      await portalInstance.post("/profile/send-profile-otp", { email: otpEmail });
      showToast("OTP sent successfully!");
      setOtpResendTimer(60);
      setEditStep(EDIT_STEP.VERIFY_OTP);
    } catch (err) {
      setOtpError(err?.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError("");
    if (!otpCode || otpCode.length < 6) {
      setOtpError("Enter the 6-digit OTP");
      return;
    }
    try {
      setLoading(true);
      await portalInstance.post("/profile/verify-profile-otp", {
        otp: otpCode,
        email: otpEmail,
        phone: formData.phone,
      });
      showToast("OTP verified successfully!");
      setOtpCode("");
      setEditStep(EDIT_STEP.EDIT_FIELDS);
    } catch (err) {
      setOtpError(err?.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const form = new FormData();
      form.append("name", formData.name);
      form.append("email", formData.email);
      if (formData.phone) form.append("phone", formData.phone);
      await portalInstance.put("/profile/update-profile", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showToast("Your update was made successfully!");
      setEditStep(EDIT_STEP.NONE);
      setOtpEmail("");
    } catch (err) {
      showToast("Failed to update profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!tempUsername.trim()) {
      showToast("Username cannot be empty", "error");
      return;
    }
    try {
      setLoading(true);
      await portalInstance.put("/profile/update-profile", {
        username: tempUsername.trim()
      });
      
      setFormData(prev => ({ ...prev, username: tempUsername.trim() }));
      setIsEditingUsername(false);
      showToast("Username updated successfully!");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update username", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminChangePassword = async () => {
    setPasswordError("");
    if (!passwordData.oldPassword || !passwordData.newPassword) {
      setPasswordError("Both fields are required");
      return;
    }
    if (!validatePassword(passwordData.newPassword)) {
      setPasswordError(
        "Password must be strong (12+, upper, lower, number, special character)"
      );
      return;
    }
    if (passwordData.oldPassword === passwordData.newPassword) {
      setPasswordError("New password cannot be same as old password");
      return;
    }
    try {
      setLoading(true);
      await portalInstance.put("/profile/change-password", passwordData);
      clearExpiryFlag();
      showToast("Password changed successfully!");
      setShowPasswordBox(false);
      setPasswordData({ oldPassword: "", newPassword: "" });
    } catch (err) {
      setPasswordError(
        err?.response?.data?.message || "Failed to change password"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordOtp = async () => {
    setPasswordError("");
    try {
      setLoading(true);
      const res = await portalInstance.post("/profile/send-password-change-otp");
      showToast(res.data.message || "OTP sent to your email!");
      setPasswordOtpTimer(60);
      setPasswordStep(PASSWORD_STEP.VERIFY_OTP);
    } catch (err) {
      setPasswordError(
        err?.response?.data?.message || "Failed to send OTP"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendPasswordOtp = async () => {
    setPasswordError("");
    try {
      setLoading(true);
      const res = await portalInstance.post("/profile/resend-password-change-otp");
      showToast(res.data.message || "New OTP sent!");
      setPasswordOtpTimer(60);
      setPasswordOtp("");
    } catch (err) {
      setPasswordError(
        err?.response?.data?.message || "Failed to resend OTP"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPasswordOtp = async () => {
    setPasswordError("");
    if (!passwordOtp || passwordOtp.length < 6) {
      setPasswordError("Enter the 6-digit OTP");
      return;
    }
    if (!newPasswordOnly) {
      setPasswordError("Enter your new password");
      return;
    }
    if (!validatePassword(newPasswordOnly)) {
      setPasswordError(
        "Password must be 12+ chars with upper, lower, number, and special character"
      );
      return;
    }
    if (newPasswordOnly !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    try {
      setLoading(true);
      await portalInstance.post("/profile/verify-otp-change-password", {
        otp: passwordOtp,
        newPassword: newPasswordOnly,
      });
      clearExpiryFlag();
      showToast("Password changed successfully!");
      handleCancelPasswordChange();
    } catch (err) {
      setPasswordError(
        err?.response?.data?.message || "Failed to change password"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setShowPasswordBox(false);
    setPasswordStep(PASSWORD_STEP.NONE);
    setPasswordOtp("");
    setNewPasswordOnly("");
    setConfirmPassword("");
    setPasswordError("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleInternalLogout = () => {
    sessionStorage.removeItem("Erti-Portal");
    sessionStorage.clear();
    navigate("/");
    if (onLogout) onLogout();
  };

  const handleCancelEdit = () => {
    setEditStep(EDIT_STEP.NONE);
    setOtpEmail("");
    setOtpCode("");
    setOtpError("");
  };

  if (!isOpen) return null;

  const isAdmin = role === "admin";
  const showConfetti = isOpen && formData.isBirthday;

  // Calculate profile completion percentage based on filled fields
  const profileFields = [formData.name, formData.email, formData.phone, formData.designation, formData.photo, formData.dob];
  const filledCount = profileFields.filter(f => f && f.trim && f.trim() !== '' && f !== 'avatar.png').length;
  const completionPercent = Math.round((filledCount / profileFields.length) * 100);

  const avatarProps = {
    photo: formData.photo,
    pendingPhotoPreview,
    pendingPhotoFile,
    photoUploading,
    onCameraClick: handleImageClick,
    onUpdate: handlePhotoUpdate,
    onCancel: handlePhotoCancel,
    fileInputRef,
    onFileChange: handleImageChange,
    completionPercent,
  };

  const renderSendOtpStep = () => (
    <div className="profile-otp-box">
      <p className="otp-box-title">Verify your identity</p>
      <p className="otp-box-subtitle">
        Enter your email to receive a one-time password
      </p>
      <input
        type="email"
        placeholder="Enter your email"
        value={otpEmail}
        onChange={(e) => {
          setOtpEmail(e.target.value);
          setOtpError("");
        }}
        className="otp-input"
        autoComplete="off"
      />
      {otpError && <div className="profile-error-text">{otpError}</div>}
      <div className="profile-page-footer" style={{ marginTop: 0 }}>
        <button
          className="profile-page-save-btn"
          onClick={handleSendOtp}
          disabled={loading}
        >
          {loading ? "Sending..." : "Send OTP"}
        </button>
        <button className="profile-page-cancel-btn" onClick={handleCancelEdit}>
          Cancel
        </button>
      </div>
    </div>
  );

  const renderVerifyOtpStep = () => (
    <div className="profile-otp-box">
      <p className="otp-box-title">Enter OTP</p>
      <p className="otp-box-subtitle">
        A 6-digit code was sent to <strong>{otpEmail}</strong>
      </p>
      <input
        type="text"
        placeholder="Enter 6-digit OTP"
        maxLength={6}
        value={otpCode}
        onChange={(e) => {
          setOtpCode(e.target.value.replace(/\D/g, ""));
          setOtpError("");
        }}
        className="otp-input otp-code-input"
        autoComplete="off"
      />
      {otpError && <div className="profile-error-text">{otpError}</div>}
      <div className="otp-resend-row">
        {otpResendTimer > 0 ? (
          <span className="otp-timer">Resend in {otpResendTimer}s</span>
        ) : (
          <button
            className="otp-resend-btn"
            onClick={() => {
              setEditStep(EDIT_STEP.SEND_OTP);
              setOtpCode("");
            }}
          >
            Resend OTP
          </button>
        )}
      </div>
      <div className="profile-page-footer" style={{ marginTop: 0 }}>
        <button
          className="profile-page-save-btn"
          onClick={handleVerifyOtp}
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
        <button className="profile-page-cancel-btn" onClick={handleCancelEdit}>
          Cancel
        </button>
      </div>
    </div>
  );

  const renderEditFieldsStep = () => (
    <>
      <div className="profile-page-top">
        <AvatarBlock {...avatarProps} />
        <div className="profile-name-wrapper">
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="edit-name-input"
            placeholder="Full name"
            autoComplete="off"
          />
          <p className="profile-designation">{formData.designation || "—"}</p>
          <div className="profile-contact-row">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email address"
              className="profile-contact-input"
              autoComplete="off"
            />
          </div>
          <div className="profile-contact-row">
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Phone number"
              className="profile-contact-input"
              autoComplete="off"
            />
          </div>
        </div>
      </div>
      <div className="profile-page-footer">
        <button
          className="profile-page-save-btn"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <button className="profile-page-cancel-btn" onClick={handleCancelEdit}>
          Cancel
        </button>
      </div>
    </>
  );

  const renderPasswordBox = () => {
    if (!showPasswordBox) return null;

    if (isAdmin) {
      return (
        <div className="profile-page-password-box">
          <div className="password-box-header">
            <LockIcon />
            <span>Change Password</span>
          </div>
          <div className="password-input-wrapper">
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder="Current Password"
              value={passwordData.oldPassword}
              onChange={(e) => {
                setPasswordData({ ...passwordData, oldPassword: e.target.value });
                setPasswordError("");
              }}
              autoComplete="off"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className="password-input-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="New Password"
              value={passwordData.newPassword}
              onChange={(e) => {
                setPasswordData({ ...passwordData, newPassword: e.target.value });
                setPasswordError("");
              }}
              autoComplete="off"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>
          <p className="password-hint">
            Must be 12+ characters with uppercase, lowercase, number &amp; special
            character (! @ # $ % &amp; * ? ~ - _ + = etc.)
          </p>
          {passwordError && (
            <div className="profile-error-text">{passwordError}</div>
          )}
          <div className="password-box-actions">
            <button
              className="profile-page-save-btn"
              onClick={handleAdminChangePassword}
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
            <button
              className="profile-page-cancel-btn"
              onClick={handleCancelPasswordChange}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (
      passwordStep === PASSWORD_STEP.NONE ||
      passwordStep === PASSWORD_STEP.SEND_OTP
    ) {
      return (
        <div className="profile-page-password-box">
          <div className="password-box-header">
            <LockIcon />
            <span>Change Password</span>
          </div>
          <p className="otp-box-subtitle">
            We'll send a verification code to your registered email
            <br />
            <strong>{formData.email}</strong>
          </p>
          {passwordError && (
            <div className="profile-error-text">{passwordError}</div>
          )}
          <div className="password-box-actions">
            <button
              className="profile-page-save-btn"
              onClick={handleSendPasswordOtp}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
            <button
              className="profile-page-cancel-btn"
              onClick={handleCancelPasswordChange}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (passwordStep === PASSWORD_STEP.VERIFY_OTP) {
      return (
        <div className="profile-page-password-box">
          <div className="password-box-header">
            <LockIcon />
            <span>Verify &amp; Change Password</span>
          </div>
          <p className="otp-box-subtitle">
            Enter the OTP sent to <strong>{formData.email}</strong>
          </p>
          <div className="otp-input-wrapper">
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              value={passwordOtp}
              onChange={(e) => {
                setPasswordOtp(e.target.value.replace(/\D/g, ""));
                setPasswordError("");
              }}
              className="otp-code-input"
              autoComplete="off"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div className="otp-resend-row">
            {passwordOtpTimer > 0 ? (
              <span className="otp-timer">
                Resend OTP in {passwordOtpTimer}s
              </span>
            ) : (
              <button
                className="otp-resend-btn"
                onClick={handleResendPasswordOtp}
                disabled={loading}
              >
                Resend OTP
              </button>
            )}
          </div>
          <div className="password-input-wrapper">
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder="New Password"
              value={newPasswordOnly}
              onChange={(e) => {
                setNewPasswordOnly(e.target.value);
                setPasswordError("");
              }}
              autoComplete="off"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className="password-input-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError("");
              }}
              autoComplete="off"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>
          <p className="password-hint">
            Must be 12+ characters with uppercase, lowercase, number &amp;
            special character (! @ # $ % &amp; * ? ~ - _ + = etc.)
          </p>
          {newPasswordOnly && (
            <div className="password-strength">
              <div className="strength-checks">
                <span
                  className={
                    newPasswordOnly.length >= 12 ? "valid" : "invalid"
                  }
                >
                  {newPasswordOnly.length >= 12 ? "✓" : "✗"} 12+ characters
                </span>
                <span
                  className={
                    /[A-Z]/.test(newPasswordOnly) ? "valid" : "invalid"
                  }
                >
                  {/[A-Z]/.test(newPasswordOnly) ? "✓" : "✗"} Uppercase
                </span>
                <span
                  className={
                    /[a-z]/.test(newPasswordOnly) ? "valid" : "invalid"
                  }
                >
                  {/[a-z]/.test(newPasswordOnly) ? "✓" : "✗"} Lowercase
                </span>
                <span
                  className={
                    /[0-9]/.test(newPasswordOnly) ? "valid" : "invalid"
                  }
                >
                  {/[0-9]/.test(newPasswordOnly) ? "✓" : "✗"} Number
                </span>
                <span
                  className={
                    SPECIAL_CHAR_REGEX.test(newPasswordOnly)
                      ? "valid"
                      : "invalid"
                  }
                >
                  {SPECIAL_CHAR_REGEX.test(newPasswordOnly) ? "✓" : "✗"}{" "}
                  Special (! @ # $ % &amp; * ? ~ - _ + = etc.)
                </span>
              </div>
            </div>
          )}
          {confirmPassword && (
            <div
              className={`password-match ${newPasswordOnly === confirmPassword ? "match" : "no-match"
                }`}
            >
              {newPasswordOnly === confirmPassword
                ? "✓ Passwords match"
                : "✗ Passwords do not match"}
            </div>
          )}
          {passwordError && (
            <div className="profile-error-text">{passwordError}</div>
          )}
          <div className="password-box-actions">
            <button
              className="profile-page-save-btn"
              onClick={handleVerifyPasswordOtp}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Change Password"}
            </button>
            <button
              className="profile-page-cancel-btn"
              onClick={handleCancelPasswordChange}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderViewMode = () => (
    <>
      {!showPasswordBox && (
        <div className="profile-page-top">
          <AvatarBlock {...avatarProps} />
          <div className="profile-name-wrapper">
            <div className="profile-username-badge-container">
              {isEditingUsername ? (
                <div className="profile-username-edit-row">
                  <input
                    type="text"
                    className="profile-username-input"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    autoFocus
                  />
                  <div className="profile-username-edit-actions">
                    <button 
                      className="username-save-btn"
                      onClick={handleUpdateUsername}
                      disabled={loading}
                    >
                      {loading ? "..." : "Update"}
                    </button>
                    <button 
                      className="username-cancel-btn"
                      onClick={() => setIsEditingUsername(false)}
                      disabled={loading}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="profile-username-badge">
                  <h4>{formData.username || formData.name || "User"}</h4>
                  {(isAdmin || role === "employee") && (
                    <button 
                      className="username-edit-btn"
                      onClick={() => {
                        setTempUsername(formData.username || formData.name || "");
                        setIsEditingUsername(true);
                      }}
                      title="Edit Username"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="profile-contact-row">
              <span className="profile-contact-text">
                {formData.email || "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {renderPasswordBox()}

      {!showPasswordBox && (
        <div className="profile-page-footer">
          {/* {(isAdmin || role === "employee") && (
            <button
              className="profile-page-outline-btn"
              onClick={() => {
                setOtpEmail(formData.email);
                setEditStep(EDIT_STEP.SEND_OTP);
              }}
              style={{ background: 'rgba(255, 255, 255, 1)', color: 'rgba(89, 119, 248, 1)', border: '1px solid rgba(89, 119, 248, 0.3)' }}
            >
              Edit Profile
            </button>
          )} */}
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button
              className="profile-page-outline-btn"
              style={{ flex: 1 }}
              onClick={() => {
                if (showPasswordBox) {
                  handleCancelPasswordChange();
                } else {
                  setShowPasswordBox(true);
                  setPasswordStep(PASSWORD_STEP.NONE);
                }
              }}
            >
              {showPasswordBox ? "Cancel" : "Update Password"}
            </button>
            <button
              className="profile-page-logout-btn"
              style={{ flex: 1 }}
              onClick={handleInternalLogout}
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );

  const renderCropModal = () => {
    if (!showCropModal || !imageToCrop) return null;

    return (
      <div
        className="crop-modal-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="crop-modal-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="crop-modal-header">
            <h4>Crop Photo</h4>
            <button
              type="button"
              className="crop-modal-close"
              onClick={handleCropCancel}
              aria-label="Close crop modal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
              >
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m7.757 16.243l8.486-8.486m0 8.486L7.757 7.757"
                />
              </svg>
            </button>
          </div>

          <div className="crop-modal-crop-area">
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="crop-modal-controls">
            <label>Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>

          <div className="crop-modal-actions">
            <button
              type="button"
              className="crop-modal-apply-btn"
              onClick={handleCropApply}
            >
              Apply
            </button>
            <button
              type="button"
              className="crop-modal-cancel-btn"
              onClick={handleCropCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Birthday Confetti Overlay */}


      <div className="profile-page-overlay" onClick={onClose}>
        {toast && (
          <div
            className={`profile-toast ${toast.type === "error" ? "profile-toast-error" : ""
              }`}
            onClick={(e) => e.stopPropagation()}
          >


            <span className="profile-toast-icon">
              {toast.type === "error" ? "✕" : "✓"}
            </span>
            {toast.message}
          </div>
        )}

        <div
          className={`profile-page-container ${isAdmin ? "admin-view" : "employee-view"
            }`}

          onClick={(e) => e.stopPropagation()}

        >
          {showConfetti && (
            <div className="birthday-confetti">
              <Lottie
                animationData={ConfettiAnimation}
                loop
                autoplay
              />
            </div>
          )}
          <div className="profile-page-header">
            <h3>
              {editStep === EDIT_STEP.SEND_OTP && "Verify Identity"}
              {editStep === EDIT_STEP.VERIFY_OTP && "Enter OTP"}
              {editStep === EDIT_STEP.EDIT_FIELDS && "Edit Profile"}
              {editStep === EDIT_STEP.NONE &&
                (showPasswordBox ? "Change Password" : "")}
            </h3>
            <button
              type="button"
              className="profile-close-btn"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <div className="profile-page-body">
            {editStep === EDIT_STEP.NONE && renderViewMode()}
            {editStep === EDIT_STEP.SEND_OTP && renderSendOtpStep()}
            {editStep === EDIT_STEP.VERIFY_OTP && renderVerifyOtpStep()}
            {editStep === EDIT_STEP.EDIT_FIELDS && renderEditFieldsStep()}
          </div>
        </div>
      </div>

      {renderCropModal()}
    </>
  );
}

export default ProfilePage;

import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import loginbgimg from "/loginbg-img.png";
import { MdLock, MdRemoveRedEye, MdEmail, MdVisibility, MdVisibilityOff } from "react-icons/md";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { authInstance } from '../../Services/instance';
import loginem from "/login-employee-m.png";
import loginam from "/login-a-m.png";
import logina from "/login-a.png";
import { useUser } from "../UserContext";
import { checkProfileRestriction } from "../../utils/profileCompletionRestriction";

function Login() {
  const { setUser } = useUser();
  // Initialize role from localStorage, default to 'employee'
  const [role, setRole] = useState(() => {
    return localStorage.getItem("savedRole") || "employee";
  });
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewType, setViewType] = useState(window.innerWidth <= 768 ? 'mobile' : window.innerWidth <= 1024 ? 'tablet' : 'desktop');
  const navigate = useNavigate();

  // Screen size detection
  React.useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width <= 768) setViewType('mobile');
      else if (width <= 1024) setViewType('tablet');
      else setViewType('desktop');
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Determine dynamic background image
  const getBackgroundImage = () => {
    if (viewType === 'mobile') {
      return role === "admin" ? loginam : loginem;
    }
    // Tablets and Desktop use high-res images
    return role === "admin" ? logina : loginbgimg;
  };

  // Save role to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem("savedRole", role);
  }, [role]);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!emailOrUsername) {
      toast.warning("Please enter Email / Username / Employee ID");
      emailRef.current.focus();
      return;
    }

    if (!password) {
      toast.warning("Please enter your Password");
      passwordRef.current.focus();
      return;
    }

    try {
      setIsLoading(true);

      const response = await authInstance.post('/data/login', {
        identifier: emailOrUsername.trim(),
        password: password,
        role: role
      });

      if (response.data.message.includes("Login success")) {
        const forceChangePassword = response.data.forceChangePassword === true;
        sessionStorage.clear();

        if (forceChangePassword) {
          const forceData = {
            _id: response.data._id,
            name: response.data.name,
            role: response.data.role,
            token: response.data.token,
            isHr: !!response.data.isHr,
            permissions: response.data.permissions || [],
            forceChangePassword: true,
            passwordExpiringSoon: false,
            passwordExpiresAt: response.data.passwordExpiresAt || null,
            daysRemaining: response.data.daysRemaining || null,
          };
          sessionStorage.setItem("Erti-Portal", JSON.stringify(forceData));
          setUser(forceData);
          toast.warning("You must change your password immediately");
          navigate("/change-password");
          return;
        }

        const userEmpId = response.data.empId || emailOrUsername.trim();
        const userUsername = response.data.username || emailOrUsername.trim();

        const isCompleted = response.data.isProfileCompleted === true || Number(response.data.profileCompletion ?? 0) >= 100;

        const restriction = checkProfileRestriction({
          role: response.data.role,
          profileCompletion: response.data.profileCompletion,
          isProfileCompleted: isCompleted,
          dateJoined: response.data.dateJoined,
          empId: userEmpId,
          username: userUsername,
        });

        const effectiveIsRestricted =
          response.data.isProfileRestricted === true || restriction.isRestricted === true;

        const userData = {
          _id: response.data._id,
          empId: userEmpId,
          username: userUsername,
          name: response.data.name,
          role: response.data.role,
          token: response.data.token,
          isHr: !!response.data.isHr,
          permissions: response.data.permissions || [],
          forceChangePassword: false,
          passwordExpiringSoon: response.data.passwordExpiringSoon || false,
          passwordExpiresAt: response.data.passwordExpiresAt || null,
          daysRemaining: response.data.daysRemaining || null,
          profileCompletion: response.data.profileCompletion ?? 0,
          dateJoined: response.data.dateJoined || null,
          isProfileCompleted: isCompleted,
          isProfileRestricted: effectiveIsRestricted,
          daysRemainingForProfile: restriction.daysRemaining,
          profileDeadline: restriction.deadline,
        };
        sessionStorage.setItem("Erti-Portal", JSON.stringify(userData));
        setUser(userData); // Update context immediately

        sessionStorage.setItem("loginTime", new Date().toISOString());
        sessionStorage.removeItem("birthdayAnimationShown");
        sessionStorage.removeItem("birthday_anim_played_session");
        sessionStorage.removeItem("birthday_animation_played_session");

        if (response.data.passwordExpiringSoon) {
          const expiresAt = response.data.passwordExpiresAt;
          let days = 7;
          if (expiresAt) {
            days = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
          }
          toast.info(`Your password will expire in ${days} days. Please update it.`);
        }

        toast.success("Login successful!");

        document.title =
          role === "admin"
            ? "Ertitech HR-Portal"
            : "Ertitech Employee-Portal";

        setEmailOrUsername("");
        setPassword("");

        if (role === "admin") {
          navigate("/admin/dashboard");
        } else if (effectiveIsRestricted) {
          toast.warning("Profile completion is required (100%). Please complete your profile to access the dashboard.");
          navigate("/emp/my-details/edit");
        } else {
          navigate("/emp/dashboard");
        }
      }

    } catch (error) {
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Login failed. Please try again.');
      }
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container" style={{ backgroundImage: `url(${getBackgroundImage()})` }}>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />

        {/* Top Left Role Selector */}
        <div className="role-selector-container">
          <div className="role-selector">
            <button
              type="button"
              className={`role-btn ${role === "admin" ? "active" : ""}`}
              onClick={() => setRole("admin")}
              disabled={isLoading}
            >
              Admin
            </button>
            <button
              type="button"
              className={`role-btn ${role === "employee" ? "active" : ""}`}
              onClick={() => setRole("employee")}
              disabled={isLoading}
            >
              Employee
            </button>
          </div>
        </div>

        {/* Right Side Login Box */}
        <div className="login-content-wrapper">
          <div className="login-box">
            <div className="logo-section">
              <img src="/HR portal logo.png" alt="logo" className="logo" />
            </div>

            <form onSubmit={handleLogin} autoComplete="off">
              <div className="mb-4 form-group">
                <div className="input-with-label">
                  <input
                    type="text"
                    className="form-control custom-input"
                    id="email-input"
                    placeholder=" "
                    value={emailOrUsername}
                    ref={emailRef}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    disabled={isLoading}
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        passwordRef.current.focus();
                      }
                    }}
                  />
                  <label htmlFor="email-input" className="floating-label">Email / Username / Employee ID</label>
                  <MdEmail className="input-icon" />
                </div>
              </div>

              <div className="mb-2 form-group">
                <div className="input-with-label">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control custom-input"
                    id="password-input"
                    placeholder=" "
                    value={password}
                    ref={passwordRef}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleLogin(e);
                      }
                    }}
                  />
                  <label htmlFor="password-input" className="floating-label">Password</label>
                  <span
                    className="toggle-password-icon"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                  </span>
                </div>
              </div>

              <div className="text-end forgot-password">
                <span
                  className="forgot-password"
                  onClick={() => !isLoading && navigate("/forgot")}
                  style={{ cursor: isLoading ? 'not-allowed' : 'pointer' }}
                >
                  Forgot Password?
                </span>
              </div>

              <div className="btn-container">
                <button
                  type="submit"
                  className="btn login-btn w-100"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
              </div>
            </form>

            <span className="security-note ">
              For security, do not save your password in the browser.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;






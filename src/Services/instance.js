import axios from "axios";

const baseURL = "https://hr.ertitech.com/";
// const baseURL = "http://localhost:5000/";

const authInstance = axios.create({
  baseURL: baseURL,
});

const portalInstance = axios.create({
  baseURL: baseURL,
});

portalInstance.interceptors.request.use((config) => {
  const portalData = sessionStorage.getItem("Erti-Portal");

  if (portalData) {
    try {
      const { token } = JSON.parse(portalData);
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error parsing portal data:", error);
    }
  }

  return config;
});

portalInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("Erti-Portal");
      sessionStorage.setItem("session_expired_notice", "true");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export { authInstance, portalInstance };
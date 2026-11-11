import React from "react";
import {
  Route,
  BrowserRouter as Router,
  Routes,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

import Login from "./Components/Login/Login";
import Forgot from "./Components/Login/Forgot";
import ResetPassword from "./Components/Login/ResetPassword";

import AdminDashboard from "./Components/Admin/AdminDashboard/AdminDashboard";
import AddEmployee from "./Components/Admin/AddEmployee/AddNewEmployee";
import ManageEmployee from "./Components/Admin/ManageEmployee/ManageEmployee";
import AdminAttendance from "./Components/Admin/DailyAttendance/AdminAttendance";
import AttendanceReport from "./Components/Admin/AttendanceReport/Attendancereport";
import AttendanceOverview from "./Components/Admin/AttendanceReport/AttendanceOverview";
import DailyWorkUpdatePage from "./Components/Admin/Task/DailyWorkUpdatePage";
import AdminTaskPage from "./Components/Admin/Task/AdminTaskPage";
import AssignTask from "./Components/Admin/Task/AssignTask";
import AdminLeaveRequest from "./Components/Admin/AdminLeaveRequest/AdminLeaveRequest";
import LeaveManagement from "./Components/Admin/LeaveManagement/LeaveManagement";
import Adminholiday from "./Components/Admin/Holiday/HolidayAssignmentAdmin";
import CheckerDashboard from "./Components/Admin/Approver/Checkerdashboard";
import ProjectDetails from "./Components/Admin/ProjectDetails/ProjectDetails";
import HrRequestsPage from "./Components/Admin/HrRequests/HrRequestsPage";
import Configuration from "./Components/Admin/Configuration/Configuration";


import EmployeeDashboard from "./Components/Employee/EmployeeDashboard/EmployeeDashboard";
import EmployeeDetails from "./Components/Employee/DetailsForm/EmployeeDetails";
import DetailsView from "./Components/Employee/MyDetails/DetailsView";
import AttendancePage from "./Components/Employee/EmployeeAttendance/AttendancePage";
import EmployeeOverview from "./Components/Employee/EmployeeAttendance/Employeeoverview";
import Holidays from "./Components/Employee/Holidays/Holidays";
import Remainder from "./Components/Employee/Remainder/Remainder";
import EmployeeDailyWorkUpdate from "./Components/Employee/Task/EmployeeDailyWorkUpdate";
import EmployeeTaskPage from "./Components/Employee/Task/EmployeeTaskPage";
import EmployeeAssignTask from "./Components/Employee/Task/EmployeeAssignTask";
import CreatTask from "./Components/Employee/Task/AssignTask";
import Updatetask from "./Components/Employee/Task/Updatetask";
import TaskAnalytics from "./Components/Admin/Task/TaskAnalytics";
import Emprequestleave from "./Components/Employee/Employeeleave-request/EmployeeRequestLeave";
import EmployeeHoliday from "./Components/Employee/Holiday/EmployeeHolidayDashboard";
import Securitiespage from "./Components/Employee/Secure/Securitiespage";
import SalarySlip from "./Components/Employee/Salaryslip/Salaryslip";

import Todolist from "./Components/Todolist/Todolist";
import NotificationHandler from "./Components/Common/NotificationHandler";
import { UserProvider } from "./Components/UserContext";
import EmployeeProfileGuard from "./Auth/EmployeeProfileGuard";

import AdminAuditManagement from "./pages/AdminAuditManagement";
import EmployeeAuditManagement from "./pages/EmployeeAuditManagement";
import PaymentScripts from "./pages/PaymentScripts";
import InscopeVendors from "./pages/InscopeVendors";

import PaySlip from "./Components/Admin/Pay Slip Generation/Payslip";
import AppointmentLetter from "./Components/Admin/Letters/AppointmentLetter";
import IncrementLetter from "./Components/Admin/Letters/IncrementLetter";
import TerminationLetter from "./Components/Admin/Letters/TerminationLetter";

// Import your hook/component
import useScrollToTop from "./Components/HeaderSidebar/useScrollToTop";
import PortalLayout from "./Components/HeaderSidebar/PortalLayout";


// ================= WEB CRAWLER =================
import CrawlerLayout from "./web crawling/layout/CrawlerLayout";
import CrawlerDashboard from "./web crawling/CrawlerDashboard";
import WebsiteAnalyzeForm from "./web crawling/WebsiteAnalyzeForm";
import CrawlerReportPage from "./web crawling/CrawlerReportPage";
import CrawlerRiskSummaryPage from "./web crawling/CrawlerRiskSummaryPage";
import CrawlerSEOSummaryPage from "./web crawling/CrawlerSEOSummaryPage";
import CrawlerComplianceSummaryPage from "./web crawling/CrawlerComplianceSummaryPage";
import CrawlerPagesSummaryPage from "./web crawling/CrawlerPagesSummaryPage";


function App() {
  return (
    <Router>
      <ScrollToTopWrapper>
        <UserProvider>
          <NotificationHandler />

          <EmployeeProfileGuard>
            <Routes>
              {/* ================= ALIAS / REDIRECTS ================= */}
              <Route path="/profile" element={<Navigate to="/emp/my-details/edit" replace />} />
              <Route path="/dashboard" element={<Navigate to="/emp/dashboard" replace />} />

              {/* ================= AUTH ================= */}
              <Route path="/" element={<Login />} />
              <Route path="/forgot" element={<Forgot />} />
              <Route path="/change-password" element={<ResetPassword />} />

              {/* ================= CPV MOBILE VERIFICATION (STANDALONE MOBILE UI) ================= */}

              {/* ================= PORTAL PERSISTENT LAYOUT (PERSISTENT SIDEBAR & HEADER) ================= */}
              <Route element={<PortalLayout />}>
                {/* ================= ADMIN ================= */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route
              path="/admin/employees/add-employee"
              element={<AddEmployee />}
            />
            <Route
              path="/admin/employees/manage-employee"
              element={<ManageEmployee />}
            />
            <Route
              path="/admin/employees/view/:empId"
              element={<DetailsView />}
            />
            <Route
              path="/admin/employees/:empId/edit"
              element={<EmployeeDetails isAdmin />}
            />
            <Route path="/admin/attendance" element={<AdminAttendance />} />
            <Route
              path="/admin/attendance-report"
              element={<AttendanceReport />}
            />
            <Route
              path="/admin/attendance-preview"
              element={<AttendanceOverview />}
            />
            <Route path="/emp/marker" element={<Securitiespage />} />
            <Route path="/admin/checker-dashboard" element={<CheckerDashboard />} />
            <Route path="/admin/project-details" element={<ProjectDetails />} />
            <Route path="/todo-list" element={<Todolist />} />
            <Route
              path="/admin/daily-work-updates"
              element={<DailyWorkUpdatePage />}
            />
            <Route path="/admin/audit" element={<AdminAuditManagement />} />
            <Route path="/admin/configuration" element={<Configuration />} />
            <Route
              path="/admin/payment-scripts"
              element={<Navigate to="/admin/audit" replace />}
            />
            <Route
              path="/admin/tasks"
              element={<AdminTaskPage />}
            />
            <Route
              path="/admin/tasks/analytics"
              element={<TaskAnalytics isAdmin={true} />}
            />
            <Route
              path="/admin/tasks/assign-task"
              element={<AssignTask />}
            />
            <Route path="/admin/leaves" element={<AdminLeaveRequest />} />
            <Route
              path="/admin/leave-management"
              element={<LeaveManagement />}
            />
            <Route
              path="/admin/holiday-management"
              element={<Adminholiday />}
            />
            <Route
              path="/admin/payslip-generator"
              element={<PaySlip />}
            />
            <Route
              path="/admin/appointment-letter"
              element={<AppointmentLetter />}
            />
            <Route
              path="/admin/increment-letter"
              element={<IncrementLetter />}
            />
            <Route
              path="/admin/termination-letter"
              element={<TerminationLetter />}
            />
            <Route
              path="/admin/hr-requests"
              element={<HrRequestsPage isAdmin={true} />}
            />
          

            {/* ================= EMPLOYEE ================= */}
            <Route path="/emp/dashboard" element={<EmployeeDashboard />} />
            <Route path="/emp/my-details" element={<DetailsView />} />
            <Route
              path="/emp/my-details/edit"
              element={<EmployeeDetails />}
            />
            <Route path="/emp/attendance" element={<AttendancePage />} />
            <Route
              path="/emp/attendance-overview"
              element={<EmployeeOverview />}
            />
            <Route path="/emp/holidays" element={<Holidays />} />
            <Route path="/admin/Holiday" element={<Holidays />} />
            <Route path="/emp/remainder" element={<Remainder />} />
            <Route
              path="/emp/holiday-requests"
              element={<EmployeeHoliday />}
            />
            <Route path="/emp/tasks" element={<EmployeeTaskPage />} />
            <Route
              path="/emp/tasks/analytics"
              element={<TaskAnalytics isAdmin={false} />}
            />
            <Route
              path="/emp/daily-work-updates"
              element={<EmployeeDailyWorkUpdate />}
            />
            <Route
              path="/emp/audit"
              element={<EmployeeAuditManagement />}
            />
            <Route
              path="/emp/payment-scripts"
              element={<PaymentScripts />}
            />
            <Route path="/emp/vendors" element={<InscopeVendors />} />
            <Route
              path="/emp/request-leave"
              element={<Emprequestleave />}
            />
            <Route
              path="/employee/tasks/assign-task"
              element={<EmployeeAssignTask />}
            />
            <Route
              path="/employee/tasks/create-task"
              element={<CreatTask />}
            />
            <Route
              path="/update-task/:taskId"
              element={<Updatetask />}
            />
            <Route
              path="/emp/salary-slip"
              element={<SalarySlip />}
            />
            <Route
              path="/emp/hr-requests"
              element={<HrRequestsPage isAdmin={false} />}
            />
          </Route>


            {/* ================= WEB CRAWLER ================= */}
            <Route element={<CrawlerLayout />}>
              <Route path="/crawler" element={<CrawlerDashboard />} />
              <Route path="/crawler/analyze" element={<WebsiteAnalyzeForm />} />
              <Route
                path="/crawler/analyze/:jobIdParam"
                element={<WebsiteAnalyzeForm />}
              />
              <Route
                path="/crawler/report/:id"
                element={<CrawlerReportPage />}
              />
              <Route
                path="/crawler/report/:id/risk"
                element={<CrawlerRiskSummaryPage />}
              />
              <Route
                path="/crawler/report/:id/seo"
                element={<CrawlerSEOSummaryPage />}
              />
              <Route
                path="/crawler/report/:id/compliance"
                element={<CrawlerComplianceSummaryPage />}
              />
              <Route
                path="/crawler/report/:id/pages"
                element={<CrawlerPagesSummaryPage />}
              />
            </Route>


            </Routes>
          </EmployeeProfileGuard>
        </UserProvider>
      </ScrollToTopWrapper>
    </Router>
  );
}

const ScrollToTopWrapper = ({ children }) => {
  useScrollToTop();
  return <>{children}</>;
};

export default App;
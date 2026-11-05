import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/NotFound";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminWizard from "@/pages/admin/AdminWizard";
import OfficerManagement from "@/pages/admin/OfficerManagement";
import OfficerDetails from "@/pages/admin/OfficerDetails";
import InmateOverview from "@/pages/admin/InmateOverview";
import DischargeApprovals from "@/pages/admin/DischargeApprovals";
import RoleManagement from "@/pages/admin/RoleManagement";
import DepartmentManagement from "@/pages/admin/DepartmentManagement";
import UserAssignmentManagement from "@/pages/admin/UserAssignmentManagement";
import DataExposureManagement from "@/pages/admin/DataExposureManagement";
import AuditTrail from "@/pages/admin/AuditTrail";
import SettingsPage from "@/pages/shared/Settings";
import ReceptionDashboard from "@/pages/reception/ReceptionDashboard";
import InmateRegistration from "@/pages/reception/InmateRegistration";
import OffenceRegistration from "@/pages/reception/OffenceRegistration";
import InmateList from "@/pages/reception/InmateList";
import RecordCourtOutcome from "@/pages/reception/RecordCourtOutcome";
import Courts from "@/pages/reception/Courts";
import Analysis from "@/pages/reception/Analysis";
import Discharge from "@/pages/reception/Discharge";
import Reclassification from "@/pages/reception/Reclassification";
import ReportBuilder from "@/pages/reception/ReportBuilder";
import StationConfig from "@/pages/reception/StationConfig";
import Lockup from "@/pages/reception/Lockup";
import Unlock from "@/pages/reception/Unlock";
import LockupHistory from "@/pages/reception/LockupHistory";
import UnlockHistory from "@/pages/reception/UnlockHistory";
import HealthDashboard from "@/pages/health/HealthDashboard";
import InmateHealth from "@/pages/health/InmateHealth";
import InmateHealthList from "@/pages/health/InmateHealthList";
import OPDVisitPage from "@/pages/health/OPDVisitPage";
import OPDRecordsPage from "@/pages/health/OPDRecordsPage";
import OPDRegister from "@/pages/health/OPDRegister";
import AdmissionAssessments from "@/pages/health/AdmissionAssessments";
import DischargeAssessments from "@/pages/health/DischargeAssessments";
import StoresDashboard from "@/pages/stores/StoresDashboard";
import FarmsDashboard from "@/pages/farms/FarmsDashboard";
import InmateDetails from "@/pages/shared/InmateDetails";
import { PrisonLayout } from "@/components/PrisonLayout";
import HqOverview from "@/pages/hq/HqOverview";
import HqOrganisation from "@/pages/hq/HqOrganisation";
import HqUsers from "@/pages/hq/HqUsers";
import HqUserDetail from "@/pages/hq/HqUserDetail";
import HqActivity from "@/pages/hq/HqActivity";
import HqStorage from "@/pages/hq/HqStorage";
import ChangePassword from "@/pages/shared/ChangePassword";
import { CONSOLE_ROLES, HQ_CONSOLE_ROLES } from "@/lib/auth";

// Messaging (and its rich-text editor) loads only when someone opens it.
const MailFolder = lazy(() => import("@/pages/messaging/MailFolder"));
const ThreadView = lazy(() => import("@/pages/messaging/ThreadView"));
const Compose = lazy(() => import("@/pages/messaging/Compose"));
const Drafts = lazy(() => import("@/pages/messaging/Drafts"));
const MessagingLoading = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading messages…</div>
);

const MESSAGING_ROLES = ["HQ_SYS_ADMIN","SUPER_ADMIN","PROV_SYS_ADMIN","ADMIN_OFFICER","RECEPTION_OFFICER","HEALTH_OFFICER","STORES_OFFICER","FARMS_OFFICER"];

/** One console page: role check + the standard app shell. Provincial admins see their province only. */
const hqPage = (title: string, description: string, page: JSX.Element, roles: string[] = CONSOLE_ROLES) => (
  <ProtectedRoute allowedRoles={roles}>
    <PrisonLayout title={title} description={description}>
      {page}
    </PrisonLayout>
  </ProtectedRoute>
);
import { getDefaultRouteForRole, getLandingRouteForUser } from "@/lib/auth";

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-[#d7a928]" />
        <p className="text-sm text-muted-foreground">Verifying authentication...</p>
      </div>
    </div>
  );
}

function RootRoute() {
  const { user, loading } = useAuth();

  if (loading && localStorage.getItem("auth_token")) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    const landing = getLandingRouteForUser(user.role, (user as any).orgUnitType || null, user.station?.id || null);
    return <Navigate to={landing} replace />;
  }

  return <LandingPage />;
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading && localStorage.getItem("auth_token")) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    const landing = getLandingRouteForUser(user.role, (user as any).orgUnitType || null, user.station?.id || null);
    return <Navigate to={landing} replace />;
  }

  return <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<LoginRoute />} />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/officers"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <PrisonLayout title="Officer Management">
                  <OfficerManagement />
                </PrisonLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/officers/:id"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <PrisonLayout title="Officer Details">
                  <OfficerDetails />
                </PrisonLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/wizard"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <AdminWizard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/inmates"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <PrisonLayout title="Inmate Overview">
                  <InmateOverview />
                </PrisonLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/inmates/discharges"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <PrisonLayout title="Discharge Approvals">
                  <DischargeApprovals />
                </PrisonLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <PrisonLayout title="Role Management" description="Manage system roles and access levels">
                  <RoleManagement />
                </PrisonLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/departments"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <PrisonLayout title="Department Management" description="Manage organizational departments">
                  <DepartmentManagement />
                </PrisonLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assignments"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <PrisonLayout title="User Assignments" description="Manage user roles and department access">
                  <UserAssignmentManagement />
                </PrisonLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/data-exposure"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <PrisonLayout title="Data Exposure Management" description="Manage data sharing policies between stations">
                  <DataExposureManagement />
                </PrisonLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-trail"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <PrisonLayout title="Audit Trail" description="Comprehensive system audit logs for accountability tracking">
                  <AuditTrail />
                </PrisonLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <ReportBuilder />
              </ProtectedRoute>
            }
          />

          {/* Reception routes */}
          <Route
            path="/reception"
            element={
              <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                <ReceptionDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reception/analysis"
            element={
              <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                <Analysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reception/register"
            element={
              <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                <InmateRegistration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reception/register-offences/:inmateId?"
            element={
              <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                <OffenceRegistration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reception/record-court-outcome/:inmateId/:offenceId"
            element={
              <ProtectedRoute allowedRoles={["RECEPTION_OFFICER", "SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <RecordCourtOutcome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reception/inmates"
            element={
              <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                <InmateList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reception/courts"
            element={
              <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                <Courts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reception/discharges"
            element={
              <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                <Discharge />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reception/reclassification"
            element={
              <ProtectedRoute allowedRoles={["RECEPTION_OFFICER", "ADMIN_OFFICER", "SUPER_ADMIN"]}>
                <Reclassification />
              </ProtectedRoute>
            }
          />
            <Route
              path="/reception/reports"
              element={
                <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                  <ReportBuilder />
                </ProtectedRoute>
              }
            />
            
            {/* Custody / Lockup Routes */}
            <Route
              path="/reception/station-config"
              element={
                <ProtectedRoute allowedRoles={["RECEPTION_OFFICER", "SUPER_ADMIN"]}>
                  <StationConfig />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reception/lockup"
              element={
                <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                  <Lockup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reception/unlock"
              element={
                <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                  <Unlock />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reception/lockup-history"
              element={
                <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                  <LockupHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reception/unlock-history"
              element={
                <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                  <UnlockHistory />
                </ProtectedRoute>
              }
            />

          {/* Health department routes */}
          <Route
            path="/health"
            element={
              <ProtectedRoute allowedRoles={["HEALTH_OFFICER"]}>
                <HealthDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health/inmates"
            element={
              <ProtectedRoute allowedRoles={["HEALTH_OFFICER"]}>
                <InmateHealthList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health/opd"
            element={
              <ProtectedRoute allowedRoles={["HEALTH_OFFICER"]}>
                <OPDRegister />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health/inmate/:id"
            element={
              <ProtectedRoute allowedRoles={["HEALTH_OFFICER"]}>
                <InmateHealth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health/inmate/:id/opd/new"
            element={
              <ProtectedRoute allowedRoles={["HEALTH_OFFICER"]}>
                <OPDVisitPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health/inmate/:id/opd"
            element={
              <ProtectedRoute allowedRoles={["HEALTH_OFFICER"]}>
                <OPDRecordsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health/assessments/admission"
            element={
              <ProtectedRoute allowedRoles={["HEALTH_OFFICER"]}>
                <AdmissionAssessments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health/assessments/discharge"
            element={
              <ProtectedRoute allowedRoles={["HEALTH_OFFICER"]}>
                <DischargeAssessments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health/reports"
            element={
              <ProtectedRoute allowedRoles={["HEALTH_OFFICER"]}>
                <ReportBuilder />
              </ProtectedRoute>
            }
          />

          {/* Stores routes */}
          <Route
            path="/stores"
            element={
              <ProtectedRoute allowedRoles={["STORES_OFFICER"]}>
                <StoresDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stores/reports"
            element={
              <ProtectedRoute allowedRoles={["STORES_OFFICER"]}>
                <ReportBuilder />
              </ProtectedRoute>
            }
          />

          {/* Farms routes */}
          <Route
            path="/farms"
            element={
              <ProtectedRoute allowedRoles={["FARMS_OFFICER"]}>
                <FarmsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farms/reports"
            element={
              <ProtectedRoute allowedRoles={["FARMS_OFFICER"]}>
                <ReportBuilder />
              </ProtectedRoute>
            }
          />

          {/* Shared routes */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HQ_SYS_ADMIN",
                  "SUPER_ADMIN",
                  "PROV_SYS_ADMIN",
                  "ADMIN_OFFICER",
                  "RECEPTION_OFFICER",
                  "HEALTH_OFFICER",
                  "STORES_OFFICER",
                  "FARMS_OFFICER"
                ]}
              >
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/inmates/:id"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "SUPER_ADMIN",
                  "ADMIN_OFFICER",
                  "RECEPTION_OFFICER",
                  "HEALTH_OFFICER",
                ]}
              >
                <InmateDetails />
              </ProtectedRoute>
            }
          />

          {/* 404 route */}
          {/* Messaging */}
          <Route
            path="/messaging"
            element={<Navigate to="/messaging/inbox" replace />}
          />
          <Route
            path="/messaging/compose"
            element={
              <ProtectedRoute allowedRoles={MESSAGING_ROLES}>
                <Suspense fallback={<MessagingLoading />}><Compose /></Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/messaging/drafts"
            element={
              <ProtectedRoute allowedRoles={MESSAGING_ROLES}>
                <Suspense fallback={<MessagingLoading />}><Drafts /></Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/messaging/threads/:id"
            element={
              <ProtectedRoute allowedRoles={MESSAGING_ROLES}>
                <Suspense fallback={<MessagingLoading />}><ThreadView /></Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/messaging/:folder"
            element={
              <ProtectedRoute allowedRoles={MESSAGING_ROLES}>
                <Suspense fallback={<MessagingLoading />}><MailFolder /></Suspense>
              </ProtectedRoute>
            }
          />
          {/* HQ System Admin console */}
          <Route path="/hq" element={hqPage("HQ System Administration", "The whole system at a glance", <HqOverview />)} />
          <Route path="/hq/organisation" element={hqPage("Provinces & Stations", "Provincial command centres and the stations under them", <HqOrganisation />)} />
          <Route path="/hq/users" element={hqPage("User Accounts", "Every account, its roles and its status", <HqUsers />)} />
          <Route path="/hq/users/:id" element={hqPage("User Account", "Details, roles, sessions and activity", <HqUserDetail />)} />
          <Route path="/hq/activity" element={hqPage("Activity & Sign-ins", "Who did what, when, and who is online", <HqActivity />)} />
          <Route path="/hq/storage" element={hqPage("Storage", "How much data each province and station holds", <HqStorage />)} />
          <Route path="/hq/roles" element={hqPage("Roles", "Built-in and custom roles", <RoleManagement />, HQ_CONSOLE_ROLES)} />
          <Route path="/hq/departments" element={hqPage("Departments", "Built-in and custom departments", <DepartmentManagement />, HQ_CONSOLE_ROLES)} />

          {/* Any signed-in user; required after an admin password reset */}
          <Route path="/change-password" element={<ChangePassword />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </AuthProvider>
  );
}

export default App;

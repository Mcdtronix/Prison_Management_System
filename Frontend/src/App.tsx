import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/NotFound";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import OfficerManagement from "@/pages/admin/OfficerManagement";
import InmateOverview from "@/pages/admin/InmateOverview";
import ReceptionDashboard from "@/pages/reception/ReceptionDashboard";
import InmateRegistration from "@/pages/reception/InmateRegistration";
import OffenceRegistration from "@/pages/reception/OffenceRegistration";
import InmateList from "@/pages/reception/InmateList";
import HealthDashboard from "@/pages/health/HealthDashboard";
import InmateHealth from "@/pages/health/InmateHealth";
import OPDVisitPage from "@/pages/health/OPDVisitPage";
import OPDRecordsPage from "@/pages/health/OPDRecordsPage";
import StoresDashboard from "@/pages/stores/StoresDashboard";
import FarmsDashboard from "@/pages/farms/FarmsDashboard";
import InmateDetails from "@/pages/shared/InmateDetails";
import { getDefaultRouteForRole } from "@/lib/auth";

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
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return <LandingPage />;
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading && localStorage.getItem("auth_token")) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
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
                <OfficerManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/inmates"
            element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN_OFFICER"]}>
                <InmateOverview />
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
            path="/reception/inmates"
            element={
              <ProtectedRoute allowedRoles={["RECEPTION_OFFICER"]}>
                <InmateList />
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

          {/* Stores routes */}
          <Route
            path="/stores"
            element={
              <ProtectedRoute allowedRoles={["STORES_OFFICER"]}>
                <StoresDashboard />
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

          {/* Shared routes */}
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </AuthProvider>
  );
}

export default App;

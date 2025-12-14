import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import JoinSession from "./pages/JoinSession";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminSounds from "./pages/admin/Sounds";

// Examiner pages
import ExaminerDashboard from "./pages/examiner/Dashboard";
import ExaminerSessions from "./pages/examiner/Sessions";
import ExaminerSessionControl from "./pages/examiner/SessionControl";
import ExaminerAnalytics from "./pages/examiner/Analytics";

// Examinee pages
import ExamineeDashboard from "./pages/examinee/Dashboard";
import ExamineeSession from "./pages/examinee/Session";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sounds"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminSounds />
                </ProtectedRoute>
              }
            />

            {/* Examiner Routes */}
            <Route
              path="/examiner"
              element={
                <ProtectedRoute requiredRole="examiner">
                  <ExaminerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/examiner/sessions"
              element={
                <ProtectedRoute requiredRole="examiner">
                  <ExaminerSessions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/examiner/session/:sessionId"
              element={
                <ProtectedRoute requiredRole="examiner">
                  <ExaminerSessionControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/examiner/analytics"
              element={
                <ProtectedRoute requiredRole="examiner">
                  <ExaminerAnalytics />
                </ProtectedRoute>
              }
            />

            {/* Examinee Routes */}
            <Route
              path="/examinee"
              element={
                <ProtectedRoute requiredRole="examinee">
                  <ExamineeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/examinee/session/:sessionId"
              element={
                <ProtectedRoute requiredRole="examinee">
                  <ExamineeSession />
                </ProtectedRoute>
              }
            />
            <Route path="/join/:sessionCode" element={<JoinSession />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Page components
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import InterviewRoom from './pages/InterviewRoom'
import InterviewList from './pages/InterviewList'
import CreateInterview from './pages/CreateInterview'
import CandidateList from './pages/CandidateList'
import CreateCandidate from './pages/CreateCandidate'
import EvaluationForm from './pages/EvaluationForm'
import InterviewerDashboard from './pages/InterviewerDashboard'
import CandidateDashboard from './pages/CandidateDashboard'
import InterviewerList from './pages/InterviewerList'
import CreateInterviewer from './pages/CreateInterviewer'
import EditInterviewer from './pages/EditInterviewer'
import TestsManagement from './pages/TestsManagement'
import QuestionBank from './pages/QuestionBank'
import TestEditor from './pages/TestEditor'
import TestInvitations from './pages/TestInvitations'
import CandidateTestInterface from './pages/CandidateTestInterface'
import TestComplete from './pages/TestComplete'
import AdminGradingDashboard from './pages/AdminGradingDashboard'
import CandidateProfile from './pages/CandidateProfile'
import AdminViolations from './pages/AdminViolations'
import TestOverview from './pages/TestOverview'
import DesignationsManager from './pages/DesignationsManager'
import EvaluationsHub from './pages/EvaluationsHub'
import EvaluationDetail from './pages/EvaluationDetail'
import UserManagement from './pages/UserManagement'
import PublicTestRegister from './pages/PublicTestRegister'
import TestAnalytics from './pages/TestAnalytics'

// Protected Route Component
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Dashboard Router - shows appropriate dashboard based on user role
function DashboardRouter() {
  const { user } = useAuthStore()

  if (user?.role === 'admin' || user?.role === 'sub_admin') {
    return <AdminDashboard />
  } else if (user?.role === 'interviewer') {
    return <InterviewerDashboard />
  } else if (user?.role === 'candidate') {
    return <CandidateDashboard />
  }

  return <AdminDashboard /> // default fallback
}

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Forgot Password (Coming Soon)</h1></div>} />

      {/* Protected Routes - Dashboard based on role */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardRouter />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/dashboard/interviews"
        element={
          <ProtectedRoute allowedRoles={['admin', 'interviewer']}>
            <InterviewList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/interviews/create"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <CreateInterview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/interviews/:id"
        element={
          <ProtectedRoute allowedRoles={['admin', 'interviewer']}>
            <div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Interview Details (Coming Soon)</h1></div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/interviews/:interviewId/evaluate"
        element={
          <ProtectedRoute allowedRoles={['admin', 'interviewer']}>
            <EvaluationForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/tests"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <TestsManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/tests/:testId/overview"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <TestOverview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/tests/:testId"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <TestEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/tests/:testId/invite"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <TestInvitations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/tests/:testId/sessions"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminGradingDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/tests/:testId/sessions/:sessionId/violations"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminViolations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/questions"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <QuestionBank />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/candidates"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <CandidateList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/candidates/create"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <CreateCandidate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/candidates/:id"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <CandidateProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/settings/designations"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DesignationsManager />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/evaluations"
        element={
          <ProtectedRoute allowedRoles={['admin', 'interviewer']}>
            <EvaluationsHub />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/evaluations/:sessionId"
        element={
          <ProtectedRoute allowedRoles={['admin', 'interviewer']}>
            <EvaluationDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/analytics"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Analytics (Coming Soon)</h1></div>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/settings"
        element={
          <ProtectedRoute>
            <div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Settings (Coming Soon)</h1></div>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/interviewers"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <InterviewerList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/interviewers/create"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <CreateInterviewer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/interviewers/:id/edit"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <EditInterviewer />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/availability"
        element={
          <ProtectedRoute allowedRoles={['interviewer']}>
            <div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Availability Settings (Coming Soon)</h1></div>
          </ProtectedRoute>
        }
      />

      {/* Interview Room - public route; authentication handled inside the component */}
      <Route path="/interview/:id" element={<InterviewRoom />} />

      {/* Public Test Routes (no authentication required) */}
      <Route path="/test/start" element={<CandidateTestInterface />} />
      <Route path="/test/complete" element={<TestComplete />} />
      {/* Public self-registration page for mass hiring */}
      <Route path="/test/:slug" element={<PublicTestRegister />} />

      {/* User Management (admin only) */}
      <Route
        path="/dashboard/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagement />
          </ProtectedRoute>
        }
      />

      {/* Per-test analytics (admin + sub_admin) */}
      <Route
        path="/dashboard/tests/:id/analytics"
        element={
          <ProtectedRoute allowedRoles={['admin', 'sub_admin']}>
            <TestAnalytics />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-4xl font-bold text-gray-900">404 - Not Found</h1></div>} />
    </Routes>
  )
}

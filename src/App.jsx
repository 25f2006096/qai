import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ProgressProvider } from './context/ProgressContext.jsx';
import Sidebar from './components/layout/Sidebar.jsx';

const LoginPage = lazy(() => import('./pages/Auth/AuthPages.jsx').then(module => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/Auth/AuthPages.jsx').then(module => ({ default: module.RegisterPage })));
const KnowledgeTest = lazy(() => import('./pages/KnowledgeTest/KnowledgeTest.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard.jsx'));
const Roadmap = lazy(() => import('./pages/Roadmap/Roadmap.jsx'));
const ModuleList = lazy(() => import('./pages/Module/ModuleList.jsx'));
const ModuleDetail = lazy(() => import('./pages/Module/ModuleDetail.jsx'));
const CircuitBuilder = lazy(() => import('./pages/CircuitBuilder/CircuitBuilder.jsx'));
const QuantumLab = lazy(() => import('./pages/QuantumLab/QuantumLab.jsx'));
const SkillMap = lazy(() => import('./pages/SkillMap/SkillMap.jsx'));
const Achievements = lazy(() => import('./pages/Achievements/Achievements.jsx'));
const AdminPanel = lazy(() => import('./pages/Admin/AdminPanel.jsx'));
const QuantumRace = lazy(() => import('./pages/QuantumRace/QuantumRace.jsx'));
const InstructorDashboard = lazy(() => import('./pages/Instructor/InstructorDashboard.jsx'));
const Contests = lazy(() => import('./pages/Contests/Contests.jsx'));
const WorldMap = lazy(() => import('./pages/WorldMap/WorldMap.jsx'));
const Profile = lazy(() => import('./pages/Profile/Profile.jsx'));
const Notifications = lazy(() => import('./pages/Notifications/Notifications.jsx'));

function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && !user.isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '16px', background: 'var(--bg-primary)',
    }}>
      <div style={{ fontSize: '2.5rem' }}>⚛</div>
      <div style={{
        width: '40px', height: '40px', border: '3px solid var(--border-glass)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
        Loading QuantumLearn...
      </div>
    </div>
  );
}

function MainLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading screen while checking auth session
  if (loading) return <LoadingScreen />;

  const authPages = ['/', '/login', '/register'];
  const isAuthPage = authPages.includes(location.pathname);

  // If user is logged in and on an auth page → smart redirect
  if (user && isAuthPage) {
    if (user.isInstructor) return <Navigate to="/instructor" replace />;
    // New user who hasn't done the knowledge assessment yet
    if (!user.knowledgeTestDone) {
      return <Navigate to="/test" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // If not logged in, show auth pages only
  if (!user) {
    return <Suspense fallback={<LoadingScreen />}><Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>;
  }

  if (user.isInstructor) {
    return <div className="app-container"><Sidebar /><main className="main-content"><Suspense fallback={<LoadingScreen />}><Routes>
      <Route path="/instructor" element={<InstructorDashboard />} />
      <Route path="*" element={<Navigate to="/instructor" replace />} />
    </Routes></Suspense></main></div>;
  }

  // If user is logged in but hasn't done the knowledge test, force /test
  // (unless they are already on /test)
  if (!user.knowledgeTestDone && location.pathname !== '/test') {
    return <Navigate to="/test" replace />;
  }

  // Knowledge test page — no sidebar
  if (location.pathname === '/test') {
    return <Suspense fallback={<LoadingScreen />}><Routes>
      <Route path="/test" element={<KnowledgeTest />} />
      <Route path="*" element={<Navigate to="/test" replace />} />
    </Routes></Suspense>;
  }

  // Main app with sidebar
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Suspense fallback={<LoadingScreen />}><Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/roadmap" element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />
          <Route path="/world-map" element={<ProtectedRoute><WorldMap /></ProtectedRoute>} />
          <Route path="/modules" element={<ProtectedRoute><ModuleList /></ProtectedRoute>} />
          <Route path="/modules/:id" element={<ProtectedRoute><ModuleDetail /></ProtectedRoute>} />
          <Route path="/circuit" element={<ProtectedRoute><CircuitBuilder /></ProtectedRoute>} />
          <Route path="/lab" element={<ProtectedRoute><QuantumLab /></ProtectedRoute>} />
          <Route path="/skillmap" element={<ProtectedRoute><SkillMap /></ProtectedRoute>} />
          <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/race" element={<ProtectedRoute><QuantumRace /></ProtectedRoute>} />
          <Route path="/contests" element={<ProtectedRoute><Contests /></ProtectedRoute>} />
          <Route path="/contests/:contestId" element={<ProtectedRoute><Contests /></ProtectedRoute>} />
          <Route path="/contests/:contestId/problems/:problemId" element={<ProtectedRoute><Contests /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminPanel /></ProtectedRoute>} />
          <Route path="/admin/*" element={<ProtectedRoute requireAdmin><AdminPanel /></ProtectedRoute>} />
          <Route path="/instructor" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes></Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <MainLayout />
      </ProgressProvider>
    </AuthProvider>
  );
}

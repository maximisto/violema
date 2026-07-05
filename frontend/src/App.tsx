import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Landing from './pages/Landing';
import ProtectedRoute from './components/ProtectedRoute';
import CalendlyAuditModal from './components/CalendlyAuditModal';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const FAQ = lazy(() => import('./pages/FAQ'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const Signup = lazy(() => import('./pages/Signup'));
const Login = lazy(() => import('./pages/Login'));
const Billing = lazy(() => import('./pages/Billing'));
const RunProof = lazy(() => import('./pages/RunProof'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const SlackSetup = lazy(() => import('./pages/SlackSetup'));
const AgentStudio = lazy(() => import('./pages/AgentStudio'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const viteEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
const enableLocalReviewRoutes = Boolean(viteEnv?.DEV)
  && typeof window !== 'undefined'
  && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

function RouteFallback() {
  return (
    <div className="min-h-screen bg-navy-950 px-4 py-10 text-sm text-slate-500">
      Loading Violema...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/plans" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
          <Route path="/pricing" element={<Billing />} />
          <Route path="/runs/:runId" element={<RunProof />} />
          <Route path="/settings/billing" element={<ProtectedRoute><Navigate to="/plans" replace /></ProtectedRoute>} />
          <Route path="/connect/slack" element={<ProtectedRoute><SlackSetup /></ProtectedRoute>} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute blockedRedirectPath="/login" requireAdmin><AdminDashboard /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/agents" element={<ProtectedRoute requireAdmin><AgentStudio /></ProtectedRoute>} />
          {enableLocalReviewRoutes && <Route path="/dashboard-preview" element={<Dashboard />} />}
          <Route path="/faq" element={<FAQ />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
        </Routes>
      </Suspense>
      <CalendlyAuditModal />
    </BrowserRouter>
  );
}

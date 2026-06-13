import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Landing from './pages/Landing';
import ProtectedRoute from './components/ProtectedRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const FAQ = lazy(() => import('./pages/FAQ'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const Signup = lazy(() => import('./pages/Signup'));
const Login = lazy(() => import('./pages/Login'));
const Billing = lazy(() => import('./pages/Billing'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const SlackSetup = lazy(() => import('./pages/SlackSetup'));
const AgentStudio = lazy(() => import('./pages/AgentStudio'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

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
          <Route path="/plans" element={<Billing />} />
          <Route path="/pricing" element={<Navigate to="/plans" replace />} />
          <Route path="/settings/billing" element={<Navigate to="/plans" replace />} />
          <Route path="/connect/slack" element={<ProtectedRoute><SlackSetup /></ProtectedRoute>} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute blockedRedirectPath="/login"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/agents" element={<ProtectedRoute><AgentStudio /></ProtectedRoute>} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

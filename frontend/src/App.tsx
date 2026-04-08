import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import FAQ from './pages/FAQ';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Billing from './pages/Billing';
import ProtectedRoute from './components/ProtectedRoute';
import IntegrationsPage from './pages/IntegrationsPage';
import SlackSetup from './pages/SlackSetup';
import AgentStudio from './pages/AgentStudio';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/plans" element={<Billing />} />
        <Route path="/settings/billing" element={<Navigate to="/plans" replace />} />
        <Route path="/connect/slack" element={<ProtectedRoute><SlackSetup /></ProtectedRoute>} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/agents" element={<ProtectedRoute><AgentStudio /></ProtectedRoute>} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
      </Routes>
    </BrowserRouter>
  );
}

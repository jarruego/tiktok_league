import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TeamDetail from './pages/TeamDetail';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<AuthGuard><HomePage /></AuthGuard>} />
        <Route path="/team/:id" element={<AuthGuard><TeamDetail /></AuthGuard>} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
      </Routes>
    </AuthProvider>
  );
}

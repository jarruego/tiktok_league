import { Routes, Route } from 'react-router-dom';
import TeamDetail from './pages/TeamDetail';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import { AdminGuard } from './components/AdminGuard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import TikTokCallback from './pages/TikTokCallback';
import AccountPage from './pages/AccountPage';
import LeaguesPage from './pages/LeaguesPage';
import MainHeader from './components/MainHeader';
import WelcomePage from './pages/WelcomePage';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <AuthProvider>
      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
        background: '#f5f6fa'
      }}>
        <MainHeader />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<AuthGuard><HomePage /></AuthGuard>} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/team/:id" element={<AuthGuard><TeamDetail /></AuthGuard>} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/tiktok-callback" element={<TikTokCallback />} />
            <Route path="/account" element={<AuthGuard><AccountPage /></AuthGuard>} />
            <Route path="/leagues" element={<AdminGuard><LeaguesPage /></AdminGuard>} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}

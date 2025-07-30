import { Routes, Route } from 'react-router-dom';
import MyTeamPage from './pages/MyTeamPage';
import TeamDetail from './pages/TeamDetail';
import TeamSquadPage from './pages/TeamSquadPage';
import DivisionView from './components/divisions/DivisionView';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import { AdminGuard } from './components/AdminGuard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import TikTokCallback from './pages/TikTokCallback';
import AccountPage from './pages/AccountPage';
import ConfigPage from './pages/ConfigPage';
import LeaguesPage from './pages/LeaguesPage';
import MatchesPage from './pages/MatchesPage';
import MatchDetailPage from './pages/MatchDetailPage';
import MainHeader from './components/MainHeader';
import WelcomePage from './pages/WelcomePage';
import HomePage from './pages/HomePage';
import { LoginScreen } from './components/LoginScreen';

export default function App() {
  return (
    <AuthProvider>
      <div style={{
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh',
        width: '100%',
        margin: 0,
        padding: 0,
        background: '#f5f6fa'
      }}>
        <MainHeader />
        <main style={{ flex: 1, width: '100%' }}>
          <Routes>
            <Route path="/" element={<AuthGuard><HomePage /></AuthGuard>} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/team/:id" element={<AuthGuard><TeamDetail /></AuthGuard>} />
            <Route path="/matches" element={<AuthGuard><MatchesPage /></AuthGuard>} />
            <Route path="/match/:matchId" element={<AuthGuard><MatchDetailPage /></AuthGuard>} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/tiktok-callback" element={<TikTokCallback />} />
            <Route path="/account" element={<AuthGuard><AccountPage /></AuthGuard>} />
            <Route path="/mi-equipo" element={<AuthGuard><MyTeamPage /></AuthGuard>} />
            <Route path="/alineacion" element={<AuthGuard><TeamSquadPage /></AuthGuard>} />
            <Route path="/config" element={<AdminGuard><ConfigPage /></AdminGuard>} />
            <Route path="/leagues" element={<AdminGuard><LeaguesPage /></AdminGuard>} />
            <Route path="/divisions" element={<AuthGuard><DivisionView /></AuthGuard>} />
            <Route path="/login" element={<LoginScreen />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}

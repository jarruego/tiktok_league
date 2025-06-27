import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TeamDetail from './pages/TeamDetail';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/team/:id" element={<TeamDetail />} />
      </Routes>
    </AuthProvider>
  );
}

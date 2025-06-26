import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TeamDetail from './pages/TeamDetail';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/team/:id" element={<TeamDetail />} />
    </Routes>
  );
}

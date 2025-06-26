import TeamsTable from '../components/teams/TeamsTable';
import '../styles/Ranking.css';

export default function HomePage() {
  return (
    <div className="ranking-container">
      <h1 className="ranking-title">Ranking de Equipos en TikTok</h1>
      <TeamsTable />
    </div>
  );
}

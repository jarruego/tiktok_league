import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { leagueApi } from '../api/leagueApi';
import type { Player, Lineup } from '../types/player.types';

const POSITIONS = {
  Goalkeeper: ['Goalkeeper'],
  Defence: ['Centre-Back', 'Right-Back', 'Left-Back', 'Defence'],
  Midfield: [
    'Central Midfield',
    'Defensive Midfield',
    'Attacking Midfield',
    'Midfield',
  ],
  Forward: ['Centre-Forward', 'Right Winger', 'Left Winger'],
};

const positionOrder = [
  'Goalkeeper',
  'Defence',
  'Midfield',
  'Forward',
];

const positionSelectCount = {
  Goalkeeper: 1,
  Defence: 5,
  Midfield: 5,
  Forward: 5,
};

function groupPlayers(players: Player[]): Record<string, Player[]> {
  const grouped: Record<string, Player[]> = {
    Goalkeeper: [],
    Defence: [],
    Midfield: [],
    Forward: [],
  };
  players.forEach((p) => {
    for (const key of positionOrder) {
      if ((POSITIONS as any)[key].includes(p.position)) {
        grouped[key].push(p);
        break;
      }
    }
  });
  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => a.name.localeCompare(b.name));
  });
  return grouped;
}

export default function TeamSquadPage() {
  function getTactic(selected: Lineup) {
    const counts: Record<string, number> = {
      Defence: 0,
      Midfield: 0,
      Forward: 0,
    };
    Object.entries(selected).forEach(([pos, arr]) => {
      if (pos !== 'Goalkeeper') {
        counts[pos] = (arr as string[]).filter(Boolean).length;
      }
    });
    return `${counts.Defence}-${counts.Midfield}-${counts.Forward}`;
  }

  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Player[]>>({});
  const [selected, setSelected] = useState<Lineup>({
    Goalkeeper: Array(positionSelectCount.Goalkeeper).fill(''),
    Defence: Array(positionSelectCount.Defence).fill(''),
    Midfield: Array(positionSelectCount.Midfield).fill(''),
    Forward: Array(positionSelectCount.Forward).fill(''),
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const teamId = user?.teamId;
      if (!teamId) {
        setPlayers([]);
        setGrouped({});
        setLoading(false);
        return;
      }
      const data = await leagueApi.getPlayersByTeam(teamId);
      setPlayers(data);
      setGrouped(groupPlayers(data));
      // Cargar alineación guardada
      const lineup = await leagueApi.getLineup(teamId);
      if (lineup) {
        setSelected(lineup);
      }
      setLoading(false);
    }
    fetchData();
  }, [user]);

  function handleSelect(pos: keyof Lineup, idx: number, value: string) {
    const updated: Lineup = { ...selected };
    updated[pos][idx] = value;
    const allSelected = Object.values(updated).flat().filter(Boolean);
    const uniqueSelected = Array.from(new Set(allSelected));
    if (uniqueSelected.length > 11) {
      setError('Solo puedes seleccionar un máximo de 11 jugadores.');
    } else {
      setError('');
      setSelected(updated);
    }
  }

  async function handleSave() {
    const allSelected = Object.values(selected).flat().filter(Boolean);
    const uniqueSelected = Array.from(new Set(allSelected));
    if (uniqueSelected.length !== 11) {
      setError('La alineación debe tener exactamente 11 jugadores.');
      return;
    }
    await leagueApi.saveLineup(user?.teamId!, {
      Goalkeeper: selected.Goalkeeper.map(String),
      Defence: selected.Defence.map(String),
      Midfield: selected.Midfield.map(String),
      Forward: selected.Forward.map(String),
    });
    setError('Alineación guardada correctamente.');
  }

  if (loading) return <div>Cargando...</div>;
  if (!players.length) return <div>No tienes jugadores en tu equipo.</div>;

  return (
    <div className="team-squad-page">
      <h2>Plantilla y Alineación Titular</h2>
      <div className="field-container">
        <div className="tactic">
          <strong>Esquema táctico:</strong> {getTactic(selected)}
        </div>
        <div className="football-field">
          {/* Portero */}
          <div className="field-row goalkeeper-row">
            {selected.Goalkeeper.map((val, idx) => (
              <select
                key={idx}
                value={val}
                onChange={(e) => handleSelect('Goalkeeper', idx, e.target.value)}
              >
                <option value="">Portero</option>
                {grouped.Goalkeeper.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ))}
          </div>
          {/* Defensas */}
          <div className="field-row defence-row">
            {selected.Defence.map((val, idx) => (
              <select
                key={idx}
                value={val}
                onChange={(e) => handleSelect('Defence', idx, e.target.value)}
              >
                <option value="">Defensa</option>
                {grouped.Defence.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ))}
          </div>
          {/* Medios */}
          <div className="field-row midfield-row">
            {selected.Midfield.map((val, idx) => (
              <select
                key={idx}
                value={val}
                onChange={(e) => handleSelect('Midfield', idx, e.target.value)}
              >
                <option value="">Medio</option>
                {grouped.Midfield.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ))}
          </div>
          {/* Delanteros */}
          <div className="field-row forward-row">
            {selected.Forward.map((val, idx) => (
              <select
                key={idx}
                value={val}
                onChange={(e) => handleSelect('Forward', idx, e.target.value)}
              >
                <option value="">Delantero</option>
                {grouped.Forward.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ))}
          </div>
        </div>
      </div>
      <button onClick={handleSave}>Guardar alineación</button>
      {error && <div className="error-message">{error}</div>}
      <hr />
      <h3>Jugadores por demarcación</h3>
      {positionOrder.map((pos) => (
        <div key={pos}>
          <h4>{pos}</h4>
          <ul>
            {grouped[pos]?.map((p) => (
              <li key={p.id}>{p.name} ({p.position})</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

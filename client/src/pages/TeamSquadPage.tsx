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
  // Para añadir jugadores manualmente
  const [manualPlayer, setManualPlayer] = useState({ name: '', position: '' });
  const [adding, setAdding] = useState(false);

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

  // Obtener football_data_id correctamente consultando el equipo
  const [teamFootballDataId, setTeamFootballDataId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTeamFootballDataId() {
      const teamId = user?.teamId;
      if (!teamId) {
        setTeamFootballDataId(null);
        return;
      }
      try {
        const response = await fetch(`/api/teams/${teamId}`);
        if (!response.ok) {
          setTeamFootballDataId(null);
          return;
        }
        const team = await response.json();
        setTeamFootballDataId(team.footballDataId || null);
      } catch {
        setTeamFootballDataId(null);
      }
    }
    fetchTeamFootballDataId();
  }, [user]);

  const hasFootballDataId = !!teamFootballDataId;

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

  // Si el equipo no tiene football_data_id, mostrar el formulario aunque no haya jugadores
  if (!hasFootballDataId && !players.length) {
    return (
      <div className="team-squad-page">
        <h2>Plantilla y Alineación Titular</h2>
        <div className="manual-add-player">
          <h3>Añadir jugador manualmente (máx. 30)</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!manualPlayer.name || !manualPlayer.position) {
                setError('Debes indicar nombre y posición');
                return;
              }
              if (players.length >= 30) {
                setError('Solo puedes añadir hasta 30 jugadores.');
                return;
              }
              setAdding(true);
              setError('');
              try {
                await leagueApi.addPlayer({
                  name: manualPlayer.name,
                  position: manualPlayer.position,
                  role: 'PLAYER',
                  nationality: 'Spain',
                  teamId: user?.teamId!,
                });
                setManualPlayer({ name: '', position: '' });
                // Refresca la lista de jugadores
                const data = await leagueApi.getPlayersByTeam(user?.teamId!);
                setPlayers(data);
                setGrouped(groupPlayers(data));
              } catch (err: any) {
                setError(err.message || 'Error al añadir jugador');
              }
              setAdding(false);
            }}
          >
            <input
              type="text"
              placeholder="Nombre"
              value={manualPlayer.name}
              onChange={e => setManualPlayer({ ...manualPlayer, name: e.target.value })}
              maxLength={40}
              required
            />
            <select
              value={manualPlayer.position}
              onChange={e => setManualPlayer({ ...manualPlayer, position: e.target.value })}
              required
            >
              <option value="">Posición</option>
              {Object.values(POSITIONS).flat().map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
            <button type="submit" disabled={adding}>Añadir jugador</button>
          </form>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="team-squad-page">
      <h2>Plantilla y Alineación Titular</h2>
      {/* Si el equipo NO tiene football_data_id, mostrar formulario para añadir jugadores manualmente */}
      {!hasFootballDataId && (
        <div className="manual-add-player">
          <h3>Añadir jugador manualmente (máx. 30)</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!manualPlayer.name || !manualPlayer.position) {
                setError('Debes indicar nombre y posición');
                return;
              }
              if (players.length >= 30) {
                setError('Solo puedes añadir hasta 30 jugadores.');
                return;
              }
              setAdding(true);
              setError('');
              try {
                await leagueApi.addPlayer({
                  name: manualPlayer.name,
                  position: manualPlayer.position,
                  role: 'PLAYER',
                  nationality: 'Spain',
                  teamId: user?.teamId!,
                });
                setManualPlayer({ name: '', position: '' });
                // Refresca la lista de jugadores
                const data = await leagueApi.getPlayersByTeam(user?.teamId!);
                setPlayers(data);
                setGrouped(groupPlayers(data));
              } catch (err: any) {
                setError(err.message || 'Error al añadir jugador');
              }
              setAdding(false);
            }}
          >
            <input
              type="text"
              placeholder="Nombre"
              value={manualPlayer.name}
              onChange={e => setManualPlayer({ ...manualPlayer, name: e.target.value })}
              maxLength={40}
              required
            />
            <select
              value={manualPlayer.position}
              onChange={e => setManualPlayer({ ...manualPlayer, position: e.target.value })}
              required
            >
              <option value="">Posición</option>
              {Object.values(POSITIONS).flat().map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
            <button type="submit" disabled={adding}>Añadir jugador</button>
          </form>
          {error && <div className="error-message">{error}</div>}
        </div>
      )}
      <div className="field-container">
        <div className="tactic">
          <strong>Esquema táctico:</strong> {getTactic(selected)}
        </div>
        <div className="football-field">
          {/* Portero */}
          <div className="field-row goalkeeper-row">
            {selected.Goalkeeper.map((val, idx) => {
              // ...existing code...
              const allSelected = Object.values(selected).flat().filter(Boolean);
              const options = Array.isArray(grouped.Goalkeeper) ? grouped.Goalkeeper : [];
              return (
                <select
                  key={idx}
                  value={val}
                  onChange={(e) => handleSelect('Goalkeeper', idx, e.target.value)}
                >
                  <option value="">Portero</option>
                  {options
                    .filter((p) => !allSelected.includes(String(p.id)) || String(p.id) === val)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              );
            })}
          </div>
          {/* Defensas */}
          <div className="field-row defence-row">
            {selected.Defence.map((val, idx) => {
              // ...existing code...
              const allSelected = Object.values(selected).flat().filter(Boolean);
              const options = Array.isArray(grouped.Defence) ? grouped.Defence : [];
              return (
                <select
                  key={idx}
                  value={val}
                  onChange={(e) => handleSelect('Defence', idx, e.target.value)}
                >
                  <option value="">Defensa</option>
                  {options
                    .filter((p) => !allSelected.includes(String(p.id)) || String(p.id) === val)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              );
            })}
          </div>
          {/* Medios */}
          <div className="field-row midfield-row">
            {selected.Midfield.map((val, idx) => {
              // ...existing code...
              const allSelected = Object.values(selected).flat().filter(Boolean);
              const options = Array.isArray(grouped.Midfield) ? grouped.Midfield : [];
              return (
                <select
                  key={idx}
                  value={val}
                  onChange={(e) => handleSelect('Midfield', idx, e.target.value)}
                >
                  <option value="">Medio</option>
                  {options
                    .filter((p) => !allSelected.includes(String(p.id)) || String(p.id) === val)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              );
            })}
          </div>
          {/* Delanteros */}
          <div className="field-row forward-row">
            {selected.Forward.map((val, idx) => {
              // ...existing code...
              const allSelected = Object.values(selected).flat().filter(Boolean);
              const options = Array.isArray(grouped.Forward) ? grouped.Forward : [];
              return (
                <select
                  key={idx}
                  value={val}
                  onChange={(e) => handleSelect('Forward', idx, e.target.value)}
                >
                  <option value="">Delantero</option>
                  {options
                    .filter((p) => !allSelected.includes(String(p.id)) || String(p.id) === val)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              );
            })}
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
            {(Array.isArray(grouped[pos]) ? grouped[pos] : []).map((p) => (
              <li key={p.id}>{p.name} ({p.position})</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

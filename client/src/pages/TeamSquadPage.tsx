
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { leagueApi } from '../api/leagueApi';
import type { Player, Lineup } from '../types/player.types';
// Icono SVG de papelera
const TrashIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', cursor: 'pointer' }}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);
const POSITION_TRANSLATIONS: Record<string, string> = {
  'Goalkeeper': 'Portero',
  'Centre-Back': 'Defensa central',
  'Right-Back': 'Lateral derecho',
  'Left-Back': 'Lateral izquierdo',
  'Defence': 'Defensa',
  'Central Midfield': 'Centrocampista central',
  'Defensive Midfield': 'Centrocampista defensivo',
  'Attacking Midfield': 'Centrocampista ofensivo',
  'Midfield': 'Centrocampista',
  'Centre-Forward': 'Delantero centro',
  'Right Winger': 'Extremo derecho',
  'Left Winger': 'Extremo izquierdo',
};

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
  // Estado para modal de confirmación de borrado
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);

  // Eliminar jugador
  async function handleDeletePlayer() {
    if (!playerToDelete) return;
    try {
      await leagueApi.deletePlayer(playerToDelete.id);
      setShowDeleteModal(false);
      setPlayerToDelete(null);
      // Refresca la lista de jugadores
      const data = await leagueApi.getPlayersByTeam(user?.teamId!);
      setPlayers(data);
      setGrouped(groupPlayers(data));
    } catch (err: any) {
      setError(err.message || 'Error al eliminar jugador');
      setShowDeleteModal(false);
      setPlayerToDelete(null);
    }
  }

  // Modal de confirmación
  const DeleteModal = () => (
    showDeleteModal && playerToDelete ? (
      <div className="modal-overlay" style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
        <div className="modal-content" style={{ background:'#fff', padding:24, borderRadius:8, minWidth:300, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
          <h4>Confirmar acción</h4>
          <p>¿Estás seguro de querer despedir al jugador <strong>{playerToDelete.name}</strong>?</p>
          <div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginTop:16 }}>
            <button onClick={() => { setShowDeleteModal(false); setPlayerToDelete(null); }}>Cancelar</button>
            <button style={{ background:'#d32f2f', color:'#fff' }} onClick={handleDeletePlayer}>Despedir</button>
          </div>
        </div>
      </div>
    ) : null
  );
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
              {positionOrder.map((groupKey) => (
                <optgroup key={groupKey} label={POSITION_TRANSLATIONS[groupKey] || groupKey}>
                  {POSITIONS[groupKey as keyof typeof POSITIONS].map((pos: string) => (
                    <option key={pos} value={pos}>{POSITION_TRANSLATIONS[pos] || pos}</option>
                  ))}
                </optgroup>
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
              {positionOrder.map((groupKey) => (
                <optgroup key={groupKey} label={POSITION_TRANSLATIONS[groupKey] || groupKey}>
                  {POSITIONS[groupKey as keyof typeof POSITIONS].map((pos: string) => (
                    <option key={pos} value={pos}>{POSITION_TRANSLATIONS[pos] || pos}</option>
                  ))}
                </optgroup>
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
      <>
        {positionOrder.map((pos) => (
          <div key={pos}>
            <h4>{POSITION_TRANSLATIONS[pos] || pos}</h4>
            <ul>
              {(Array.isArray(grouped[pos]) ? grouped[pos] : []).map((p) => (
                <li key={p.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {p.name} ({POSITION_TRANSLATIONS[p.position] || p.position})
                  {!hasFootballDataId && (
                    <span title="Despedir jugador" onClick={() => { setPlayerToDelete(p); setShowDeleteModal(true); }}>
                      <TrashIcon size={16} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <DeleteModal />
      </>
    </div>
  );
}

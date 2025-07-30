import { useEffect, useState } from 'react';
import { Card, Button, Typography, Divider, List, Modal, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { leagueApi } from '../api/leagueApi';
import type { Player, Lineup } from '../types/player.types';
const { Text } = Typography;
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
  'Forward': 'Delantero',
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
  Forward: ['Centre-Forward', 'Right Winger', 'Left Winger']
};

const positionOrder = [
  'Goalkeeper',
  'Defence',
  'Midfield',
  'Forward',
];
const TACTIC_TOOLTIPS: Record<string, string> = {
  '5-4-1': `⚔️ Defensiva\nDefensas (5): 3 centrales + 2 carrileros que bajan mucho.\nCentrocampistas (4): 2 pivotes defensivos + 2 interiores.\nDelantero (1): Referente arriba para aguantar balones.\n\nUso: Muy usada para resistir y contraatacar. Equipos pequeños frente a grandes.`,
  '4-5-1': `⚔️ Defensiva\nDefensas (4): Línea clásica de 4.\nCentrocampistas (5): 3 medios centrales + 2 extremos que ayudan en defensa.\nDelantero (1): Solo en punta.\n\nUso: Bloque medio o bajo, mucha gente en el medio campo para tapar líneas.`,
  '3-4-3': `⚽ Ofensiva\nDefensas (3): Centrales sólidos (necesitan buena cobertura).\nCentrocampistas (4): 2 pivotes + 2 carrileros ofensivos.\nDelanteros (3): 1 punta + 2 extremos muy abiertos.\n\nUso: Mucho juego por bandas y presión alta.`,
  '4-3-3': `⚽ Ofensiva\nDefensas (4): Línea de 4 estable.\nCentrocampistas (3): 1 pivote + 2 interiores con llegada.\nDelanteros (3): 1 centrodelantero + 2 extremos muy ofensivos.\n\nUso: Muy equilibrada, pero agresiva en ataque. Ideal para dominar con balón.`,
  '4-4-2': `⚖️ Neutra\nDefensas (4): Línea tradicional.\nCentrocampistas (4): 2 pivotes + 2 extremos.\nDelanteros (2): 1 más estático + 1 móvil o bajando al medio.`
};

const TACTICS = [
  { label: '5-4-1', value: { Defence: 5, Midfield: 4, Forward: 1 } },
  { label: '4-5-1', value: { Defence: 4, Midfield: 5, Forward: 1 } },
  { label: '3-4-3', value: { Defence: 3, Midfield: 4, Forward: 3 } },
  { label: '4-3-3', value: { Defence: 4, Midfield: 3, Forward: 3 } },
  { label: '4-4-2', value: { Defence: 4, Midfield: 4, Forward: 2 } }
];
const getInitialSelectCount = (tactic = TACTICS[0].value) => ({
  Goalkeeper: 1,
  Defence: tactic.Defence,
  Midfield: tactic.Midfield,
  Forward: tactic.Forward,
});

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
  // Estado para el esquema táctico seleccionado
  const defaultTactic = TACTICS.find(t => t.label === '4-3-3') || TACTICS[0];
  const [selectedTactic, setSelectedTactic] = useState(defaultTactic);

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

  // Modal de confirmación con Ant Design
  const DeleteModal = () => (
    <Modal
      open={showDeleteModal}
      title="Confirmar acción"
      onCancel={() => { setShowDeleteModal(false); setPlayerToDelete(null); }}
      onOk={handleDeletePlayer}
      okText="Despedir"
      cancelText="Cancelar"
      okButtonProps={{ danger: true }}
    >
      <Text>¿Estás seguro de querer despedir al jugador <b>{playerToDelete?.name}</b>?</Text>
    </Modal>
  );

  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Player[]>>({});
  const [selected, setSelected] = useState<Lineup>(() => {
    const counts = getInitialSelectCount(defaultTactic.value);
    return {
      Goalkeeper: Array(counts.Goalkeeper).fill(''),
      Defence: Array(counts.Defence).fill(''),
      Midfield: Array(counts.Midfield).fill(''),
      Forward: Array(counts.Forward).fill(''), // Solo 3
    };
  });
  const [error, setError] = useState('');
  // Ocultar mensajes de alineación tras 5 segundos
  useEffect(() => {
    if (
      error === 'Alineación guardada correctamente.' ||
      error === 'La alineación debe tener exactamente 11 jugadores.'
    ) {
      const timeout = setTimeout(() => setError(''), 4000);
      return () => clearTimeout(timeout);
    }
  }, [error]);
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
        // Inferir táctica del lineup guardado
        const defence = lineup.Defence ? lineup.Defence.length : 0;
        const midfield = lineup.Midfield ? lineup.Midfield.length : 0;
        const forward = lineup.Forward ? lineup.Forward.length : 0;
        const foundTactic = TACTICS.find(t => t.value.Defence === defence && t.value.Midfield === midfield && t.value.Forward === forward);
        if (foundTactic) {
          setSelectedTactic(foundTactic);
        } else {
          setSelectedTactic(defaultTactic);
        }
      } else {
        setSelectedTactic(defaultTactic);
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
    // Si el jugador ya está seleccionado en otro select, lo quitamos de ahí
    let updated: Lineup = { ...selected };
    if (value) {
      for (const key of Object.keys(updated) as (keyof Lineup)[]) {
        updated[key] = updated[key].map((v, i) => {
          // No borres de este mismo select
          if (key === pos && i === idx) return v;
          return v === value ? '' : v;
        });
      }
    }
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

  // Actualizar selects cuando cambia el esquema táctico
  useEffect(() => {
    const counts = getInitialSelectCount(selectedTactic.value);
    setSelected(prev => ({
      Goalkeeper: (prev.Goalkeeper || []).slice(0, counts.Goalkeeper).concat(Array(Math.max(0, counts.Goalkeeper - (prev.Goalkeeper?.length || 0))).fill('')),
      Defence: (prev.Defence || []).slice(0, counts.Defence).concat(Array(Math.max(0, counts.Defence - (prev.Defence?.length || 0))).fill('')),
      Midfield: (prev.Midfield || []).slice(0, counts.Midfield).concat(Array(Math.max(0, counts.Midfield - (prev.Midfield?.length || 0))).fill('')),
      Forward: (prev.Forward || []).slice(0, counts.Forward).concat(Array(Math.max(0, counts.Forward - (prev.Forward?.length || 0))).fill('')),
    }));
  }, [selectedTactic]);

  if (loading) return <div style={{textAlign:'center',marginTop:40}}><Text strong>Cargando...</Text></div>;



  return (
    <div style={{ width: '100%' }}>
      <h2 style={{ textAlign: 'center', fontWeight: 700, margin: '16px 0 8px 0' }}>Plantilla y Alineación Titular</h2>
      {/* Botones de esquemas tácticos */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        {TACTICS.map(tactic => (
          <Tooltip key={tactic.label} title={<span style={{ whiteSpace: 'pre-line' }}>{TACTIC_TOOLTIPS[tactic.label]}</span>} placement="top">
            <Button
              type={selectedTactic.label === tactic.label ? 'primary' : 'default'}
              style={{ fontWeight: 600, minWidth: 80, background: selectedTactic.label === tactic.label ? '#388e3c' : undefined, color: selectedTactic.label === tactic.label ? '#fff' : undefined }}
              onClick={() => setSelectedTactic(tactic)}
            >
              {tactic.label}
            </Button>
          </Tooltip>
        ))}
      </div>
      {/* Card verde simulando campo de fútbol */}
      <Card
        bodyStyle={{
          background: 'linear-gradient(180deg, #43a047 0%, #388e3c 100%)',
          padding: '10px 10px',
          borderRadius: 0,
          minHeight: 180,
        }}
        style={{
          margin: '0 0 16px 0',
          width: '100%',
          maxWidth: 800,
          boxShadow: '0 2px 8px rgba(60,120,60,0.10)',
          border: '1px solid #388e3c',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
      {/* Esquema táctico eliminado a petición del usuario */}
        <div style={{ width: '100%' }}>
          {positionOrder.map((groupKey) => {
            // Solo mostrar los selects de la cantidad necesaria según el esquema táctico
            const count = getInitialSelectCount(selectedTactic.value)[groupKey as keyof Lineup];
            if (!count) return null;
            const selects = (selected[groupKey as keyof Lineup] as string[]);
            // Para móvil: detecta si la pantalla es pequeña
            const isMobile = window.innerWidth <= 600;
            return (
              <div key={groupKey} style={{ width: '100%', marginBottom: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    gap: '2px',
                    width: '100%',
                    flexWrap: 'nowrap',
                  }}
                >
                  {selects.map((val: string, idx: number) => {
                    const options = Array.isArray(grouped[groupKey]) ? grouped[groupKey] : [];
                    // En móvil, portero tiene ancho mínimo, los demás se reparten
                    let selectStyle: React.CSSProperties = {
                      fontSize: isMobile ? '13px' : '15px',
                      padding: isMobile ? '2px 4px' : '4px 6px',
                      appearance: 'auto',
                      minWidth: '20%'
                    };
                    if (isMobile) {
                      if (groupKey === 'Goalkeeper') {
                        selectStyle.flex = '0 1 40px';
                        selectStyle.maxWidth = 60;
                      } else {
                        selectStyle.flex = '1 1 0';
                        selectStyle.maxWidth = undefined;
                      }
                    } else {
                      selectStyle.flex = 1;
                      selectStyle.maxWidth = 120;
                    }
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: selectStyle.flex, maxWidth: selectStyle.maxWidth, minWidth: selectStyle.minWidth }}>
                        <span role="img" aria-label="camiseta" style={{ fontSize: isMobile ? 44 : 56, marginBottom: 2 }}>👕</span>
                        <select
                          value={val}
                          onChange={e => handleSelect(groupKey as keyof Lineup, idx, e.target.value)}
                          style={{ ...selectStyle, width: '100%' }}
                        >
                          <option value="">{POSITION_TRANSLATIONS[groupKey] || groupKey}</option>
                          {options.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <Button
            type="primary"
            block
            size="large"
            onClick={handleSave}
            style={{
              marginTop: 8,
              maxWidth: 220,
              marginLeft: 'auto',
              marginRight: 'auto',
              display: 'block',
              background: '#fff',
              borderColor: '#388e3c',
              color: '#388e3c',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(56,142,60,0.10)'
            }}
          >
            Guardar alineación
          </Button>
        </div>
      </Card>
          {error && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <span
                style={{
                  background: error === 'Alineación guardada correctamente.' ? '#43a047' : '#d32f2f',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '6px 16px',
                  fontWeight: 600,
                  fontSize: 15,
                  textAlign: 'center',
                  transition: 'background 0.2s',
                }}
              >
                {error}
              </span>
            </div>
          )}
      {/* Formulario de añadir jugador manual siempre visible si no hay football_data_id */}
      {!hasFootballDataId ? (
        <div className="manual-add-player" style={{ width: '100%', margin: '24px 0 0 0' }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>Jugadores (máx. 30)</h3>
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
            style={{ display: 'flex', alignItems: 'center', gap: '2px', width: '100%' }}
          >
            <div style={{ display: 'flex', width: '100%', gap: '2px' }}>
              <input
                type="text"
                placeholder="Nombre"
                value={manualPlayer.name}
                onChange={e => setManualPlayer({ ...manualPlayer, name: e.target.value })}
                maxLength={40}
                required
                style={{ flex: 1, fontSize: '15px', padding: '4px 6px', minWidth: 0 }}
              />
              <select
                value={manualPlayer.position}
                onChange={e => setManualPlayer({ ...manualPlayer, position: e.target.value })}
                required
                style={{ flex: 1, fontSize: '15px', padding: '4px 6px', minWidth: 0, appearance: 'auto' }}
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
              <Button
                type="primary"
                htmlType="submit"
                icon={<PlusOutlined />}
                shape="circle"
                size="small"
                style={{ background: '#1890ff', borderColor: '#1890ff', color: '#fff', minWidth: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(24,144,255,0.10)' }}
                disabled={adding}
              />
            </div>
          </form>
          {error && <div className="error-message">{error}</div>}
        </div>
      ) : null}
      
      <Divider style={{ margin: '16px 0' }} />
      {/* Lista de jugadores por demarcación en Cards, apiladas en móvil y en línea en escritorio */}
      <div
        style={{
          display: 'flex',
          flexDirection: window.innerWidth <= 600 ? 'column' : 'row',
          width: '100%',
          gap: window.innerWidth <= 600 ? '0px' : '12px',
        }}
      >
        {positionOrder.map((pos) => (
          <div
            key={pos}
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              margin: window.innerWidth <= 600 ? '0 0 12px 0' : '0 4px 0 4px',
            }}
          >
            <Card
              size="small"
              title={POSITION_TRANSLATIONS[pos] || pos}
              style={{
                width: '100%',
                minWidth: 0,
                marginBottom: 0,
                background: '#f5f5f5',
                borderRadius: 10,
                boxShadow: '0 1px 4px rgba(60,120,60,0.07)',
                border: '1px solid #e0e0e0',
                padding: 0,
              }}
              headStyle={{
                background:
                  pos === 'Goalkeeper' ? '#1976d2' :
                  pos === 'Defence' ? '#388e3c' :
                  pos === 'Midfield' ? '#fbc02d' :
                  pos === 'Forward' ? '#d81b60' : '#333',
                borderRadius: '10px 10px 0 0',
                fontWeight: 600,
                textAlign: 'center',
                fontSize: '15px',
                color: '#fff',
                padding: '4px 0',
              }}
              bodyStyle={{ padding: '4px 0' }}
            >
              <List
                size="small"
                dataSource={Array.isArray(grouped[pos]) ? grouped[pos] : []}
                renderItem={(p: Player) => (
                  <List.Item
                    style={{ padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    actions={
                      !hasFootballDataId ? [
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                          onClick={() => { setPlayerToDelete(p); setShowDeleteModal(true); }}
                        />
                      ] : []
                    }
                  >
                    <span>{p.name} <Text type="secondary">({POSITION_TRANSLATIONS[p.position] || p.position})</Text></span>
                  </List.Item>
                )}
              />
            </Card>
          </div>
        ))}
      </div>
      <DeleteModal />
    </div>
  );
}

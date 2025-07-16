import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Descriptions, Avatar, Spin, message, Table } from 'antd';
import { ArrowLeftOutlined, TikTokOutlined, GlobalOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { formatNumber, formatFecha, calculateAge } from '../utils/formatters';
import { LayoutContainer } from '../components/LayoutContainer';
import { AdminGuard } from '../components/AdminGuard';

interface Team {
  id: number;
  name: string;
  tiktokId: string;
  displayName?: string;
  followers: number;
  following?: number;
  likes?: number;
  description?: string;
  profileUrl?: string;
  avatarUrl?: string;
  lastScrapedAt?: string;
  // Campos de Football-Data.org
  footballDataId?: number;
  competitionId?: number;
  shortName?: string;
  tla?: string;
  crest?: string;
  venue?: string;
  founded?: number;
  clubColors?: string;
  website?: string;
  // Información del área/país
  areaId?: number;
  areaName?: string;
  areaCode?: string;
  areaFlag?: string;
  createdAt?: string;
  updatedAt?: string;
  coach?: {
    id: number;
    name: string;
    nationality?: string;
    footballDataId?: number;
  };
}

interface Player {
  id: number;
  teamId: number;
  name: string;
  position: string;
  dateOfBirth?: string;
  nationality?: string;
  shirtNumber?: number;
  role: string;
  createdAt: string;
  updatedAt: string;
}

const playersColumns: ColumnsType<Player> = [
  {
    title: '#',
    dataIndex: 'shirtNumber',
    key: 'shirtNumber',
    width: 60,
    render: (shirtNumber: number | undefined) => shirtNumber || '-',
    sorter: (a, b) => (a.shirtNumber || 999) - (b.shirtNumber || 999),
  },
  {
    title: 'Nombre',
    dataIndex: 'name',
    key: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
  },
  {
    title: 'Posición',
    dataIndex: 'position',
    key: 'position',
    sorter: (a, b) => a.position.localeCompare(b.position),
  },
  {
    title: 'Edad',
    dataIndex: 'dateOfBirth',
    key: 'age',
    render: (dateOfBirth: string | undefined) => {
      const age = calculateAge(dateOfBirth);
      return age !== null ? `${age} años` : '-';
    },
    sorter: (a, b) => {
      const ageA = calculateAge(a.dateOfBirth) || 0;
      const ageB = calculateAge(b.dateOfBirth) || 0;
      return ageA - ageB;
    },
  },
  {
    title: 'Nacionalidad',
    dataIndex: 'nationality',
    key: 'nationality',
    render: (nationality: string | undefined) => nationality || '-',
    sorter: (a, b) => (a.nationality || '').localeCompare(b.nationality || ''),
  },
];

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // Cargar datos del equipo
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/teams/${id}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Equipo no encontrado');
        }
        return res.json();
      })
      .then(data => {
        setTeam(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching team:', error);
        message.error('Error al cargar los datos del equipo');
        setLoading(false);
      });

    // Cargar jugadores del equipo
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/players/team/${id}`)
      .then(res => res.json())
      .then(data => {
        setPlayers(data);
        setPlayersLoading(false);
      })
      .catch(error => {
        console.error('Error fetching players:', error);
        message.error('Error al cargar los jugadores');
        setPlayersLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!team) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Equipo no encontrado</h2>
        <Button type="primary" onClick={() => navigate('/')}>
          Volver al inicio
        </Button>
      </div>
    );
  }

  return (
    <LayoutContainer>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate('/')}
        style={{ marginBottom: '16px' }}
      >
        Volver a la tabla
      </Button>

      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
          <Avatar 
            size={80} 
            src={team.crest || team.avatarUrl} 
            style={{ backgroundColor: '#f0f0f0' }}
          >
            {(team.displayName || team.name).charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px' }}>
              {team.name}
              {team.areaFlag && team.areaCode && (
                <span style={{ marginLeft: '12px' }}>
                  <img 
                    src={team.areaFlag} 
                    alt={team.areaName || team.areaCode}
                    style={{ width: '24px', height: '16px', objectFit: 'cover', marginRight: '6px' }}
                  />
                  <span style={{ fontSize: '18px', color: '#888' }}>{team.areaCode}</span>
                </span>
              )}
            </h1>
            {team.displayName && team.displayName !== team.name && (
              <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>{team.displayName}</p>
            )}
            {team.shortName && (
              <p style={{ margin: 0, fontSize: '14px', color: '#888' }}>
                {team.shortName} {team.tla && `(${team.tla})`}
              </p>
            )}
            {/* Enlace a la clasificación de la liga/división del equipo */}
            <Button
              type="link"
              style={{ padding: 0, fontSize: '16px', color: '#1890ff', marginTop: '8px' }}
              onClick={() => navigate(`/divisions?teamId=${team.id}`)}
            >
              Ver clasificación de la liga/división
            </Button>
          </div>
        </div>

        {team.description && (
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px' }}>
            {team.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {team.profileUrl && (
            <Button 
              type="primary" 
              icon={<TikTokOutlined />}
              href={team.profileUrl}
              target="_blank"
            >
              Ver en TikTok
            </Button>
          )}
          {team.website && (
            <Button 
              icon={<GlobalOutlined />}
              href={team.website}
              target="_blank"
            >
              Sitio Web Oficial
            </Button>
          )}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* Información de TikTok */}
        <Card title="Información de TikTok" size="small">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Usuario">@{team.tiktokId}</Descriptions.Item>
            <Descriptions.Item label="Seguidores">{formatNumber(team.followers)}</Descriptions.Item>
            <Descriptions.Item label="Siguiendo">{formatNumber(team.following)}</Descriptions.Item>
            <Descriptions.Item label="Likes totales">{formatNumber(team.likes)}</Descriptions.Item>
            <Descriptions.Item label="Última actualización">
              {formatFecha(team.lastScrapedAt)}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Información del Club */}
        {(team.venue || team.founded || team.clubColors || team.coach || team.areaName) && (
          <Card title="Información del Club" size="small">
            <Descriptions column={1} size="small">
              {team.areaName && (
                <Descriptions.Item label="País">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {team.areaFlag && (
                      <img 
                        src={team.areaFlag} 
                        alt={team.areaName}
                        style={{ width: '20px', height: '14px', objectFit: 'cover' }}
                      />
                    )}
                    <span>{team.areaName}</span>
                    {team.areaCode && (
                      <span style={{ color: '#888', fontSize: '12px' }}>({team.areaCode})</span>
                    )}
                  </div>
                </Descriptions.Item>
              )}
              {team.venue && (
                <Descriptions.Item label="Estadio">{team.venue}</Descriptions.Item>
              )}
              {team.founded && (
                <Descriptions.Item label="Fundado">{team.founded}</Descriptions.Item>
              )}
              {team.clubColors && (
                <Descriptions.Item label="Colores">{team.clubColors}</Descriptions.Item>
              )}
              {team.coach && (
                <Descriptions.Item label="Entrenador">
                  {team.coach.name}
                  {team.coach.nationality && ` (${team.coach.nationality})`}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        {/* Información del Sistema */}
        <AdminGuard>
          <Card title="Información del Sistema" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="ID del equipo">{team.id}</Descriptions.Item>
              {team.footballDataId && (
                <Descriptions.Item label="ID Football-Data">{team.footballDataId}</Descriptions.Item>
              )}
              {team.competitionId && (
                <Descriptions.Item label="ID Competición">{team.competitionId}</Descriptions.Item>
              )}
              <Descriptions.Item label="Creado">
                {formatFecha(team.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Actualizado">
                {formatFecha(team.updatedAt)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </AdminGuard>
      </div>

      {/* Sección de Jugadores */}
      <Card 
        title={`Plantilla (${players.length} jugadores)`} 
        style={{ marginTop: '24px' }}
        size="small"
      >
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <Table
            columns={playersColumns}
            dataSource={players.map(player => ({ ...player, key: player.id }))}
            loading={playersLoading}
            pagination={false}
            scroll={{ x: '100%' }}
            size="small"
            locale={{
              emptyText: 'No hay jugadores registrados para este equipo'
            }}
          />
        </div>
      </Card>
    </LayoutContainer>
  );
}

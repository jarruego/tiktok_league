import { useEffect, useState } from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

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
  position?: number; // Agregamos position como opcional
}

function formatFecha(fechaIso?: string) {
  if (!fechaIso) return '-';
  const fecha = new Date(fechaIso);
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const dia = fecha.getDate();
  const mes = meses[fecha.getMonth()];
  const hora = fecha.getHours().toString().padStart(2, '0');
  const min = fecha.getMinutes().toString().padStart(2, '0');
  return `${dia} de ${mes} a las ${hora}:${min}`;
}

function formatNumber(num?: number) {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

const columns: ColumnsType<Team> = [
  { 
    title: 'Pos', 
    dataIndex: 'position', 
    key: 'position', 
    sorter: (a, b) => (a.position || 0) - (b.position || 0),
    render: (position: number) => position,
    width: 60
  },
  { 
    title: 'Equipo', 
    dataIndex: 'name', 
    key: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (name: string, record: Team) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {record.avatarUrl ? (
          <img 
            src={record.avatarUrl} 
            alt={record.displayName || record.name} 
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ 
            width: 40, 
            height: 40, 
            borderRadius: '50%', 
            backgroundColor: '#f0f0f0', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#666'
          }}>
            {(record.displayName || record.name).charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 'bold' }}>{name}</div>
          {record.displayName && record.displayName !== name && (
            <div style={{ fontSize: '12px', color: '#666' }}>{record.displayName}</div>
          )}
        </div>
      </div>
    )
  },
  { 
    title: 'Cuenta TikTok', 
    dataIndex: 'tiktokId', 
    key: 'tiktokId',
    render: (tiktokId: string, record: Team) => {
      const tiktokUrl = record.profileUrl || `https://www.tiktok.com/@${tiktokId}`;
      return (
        <a href={tiktokUrl} target="_blank" rel="noopener noreferrer">
          @{tiktokId}
        </a>
      );
    }
  },
  { 
    title: 'Seguidores', 
    dataIndex: 'followers', 
    key: 'followers', 
    sorter: (a, b) => b.followers - a.followers,
    render: (followers: number) => formatNumber(followers)
  },
  { 
    title: 'Siguiendo', 
    dataIndex: 'following', 
    key: 'following',
    sorter: (a, b) => (b.following || 0) - (a.following || 0),
    render: (following: number) => formatNumber(following) || '-'
  },
  { 
    title: 'Likes', 
    dataIndex: 'likes', 
    key: 'likes',
    sorter: (a, b) => (b.likes || 0) - (a.likes || 0),
    render: (likes: number) => formatNumber(likes) || '-'
  },
  { 
    title: 'Descripción', 
    dataIndex: 'description', 
    key: 'description',
    ellipsis: true,
    width: 200
  },
  { 
    title: 'Última Actualización', 
    dataIndex: 'lastScrapedAt', 
    key: 'lastScrapedAt', 
    sorter: (a, b) => {
      // Si alguno no tiene fecha, ponerlo al final
      if (!a.lastScrapedAt && !b.lastScrapedAt) return 0;
      if (!a.lastScrapedAt) return 1;
      if (!b.lastScrapedAt) return -1;
      // Comparar fechas (más reciente primero)
      return new Date(b.lastScrapedAt).getTime() - new Date(a.lastScrapedAt).getTime();
    },
    render: formatFecha,
    width: 150
  },
];

export default function TeamsTable() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:3000/teams')
      .then(res => res.json())
      .then(data => {
        setTeams(data.sort((a: Team, b: Team) => b.followers - a.followers));
        setLoading(false);
      });
  }, []);

  return (
    <Table
      columns={columns}
      dataSource={teams.map((t, i) => ({ ...t, key: t.id, position: i + 1 }))}
      loading={loading}
      pagination={false}
      className="ranking-table"
      scroll={{ x: 1200 }}
      size="middle"
    />
  );
}

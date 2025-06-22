import { useEffect, useState } from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface Team {
  id: number;
  name: string;
  tiktokId: string;
  followers: number;
  description?: string;
  lastScrapedAt?: string;
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

const columns: ColumnsType<Team> = [
  { title: 'Posición', dataIndex: 'position', key: 'position', render: (_, __, i) => i + 1 },
  { title: 'Equipo', dataIndex: 'name', key: 'name' },
  { title: 'Cuenta TikTok', dataIndex: 'tiktokId', key: 'tiktokId' },
  { title: 'Seguidores', dataIndex: 'followers', key: 'followers', sorter: (a, b) => b.followers - a.followers },
  { title: 'Descripción', dataIndex: 'description', key: 'description' },
  { title: 'Último Scrapeo', dataIndex: 'lastScrapedAt', key: 'lastScrapedAt', render: formatFecha },
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
    />
  );
}

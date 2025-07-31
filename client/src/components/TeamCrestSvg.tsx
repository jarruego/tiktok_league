import React from 'react';

interface TeamCrestSvgProps {
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
  name?: string;
  teamId?: number;
  team?: {
    id?: number;
    primaryColor?: string;
    secondaryColor?: string;
    name?: string;
  };
}

const TeamCrestSvg: React.FC<TeamCrestSvgProps> = ({
  size = 56,
  primaryColor,
  secondaryColor,
  name,
  teamId,
  team,
}) => {
  // Algoritmo para generar color desde id
  function idToColor(id: number, offset = 0): string {
    // Genera un color HSL único y brillante
    const hue = ((id * 137 + offset) % 360); // 137 = número primo para dispersión
    return `hsl(${hue}, 70%, 48%)`;
  }

  // Extraer id si existe
  const resolvedId = teamId || team?.id;

  // Si no hay color definido, generar por id
  let color1 = primaryColor || team?.primaryColor;
  let color2 = secondaryColor || team?.secondaryColor;
  if (!color1 && resolvedId) color1 = idToColor(resolvedId, 0);
  if (!color2 && resolvedId) color2 = idToColor(resolvedId, 180); // Complementario
  if (!color1) color1 = '#1e90ff';
  if (!color2) color2 = '#222222';

  const displayName = name || team?.name || '';
  const initial = displayName ? displayName[0].toUpperCase() : '';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Borde gris */}
      <path fill="#CCD6DD" d="M33 3c-7-3-15-3-15-3S10 0 3 3C0 18 3 31 18 36c15-5 18-18 15-33z" />
      {/* Lado izquierdo (color1) */}
      <path fill={color1} d="M18 33.884C6.412 29.729 1.961 19.831 4.76 4.444C11.063 2.029 17.928 2 18 2c.071 0 6.958.04 13.24 2.444c2.799 15.387-1.652 25.285-13.24 29.44z" />
      {/* Lado derecho (color2) */}
      <path fill={color2} d="M31.24 4.444C24.958 2.04 18.071 2 18 2v31.884c11.588-4.155 16.039-14.053 13.24-29.44z" />
      {/* Inicial sobre el escudo */}
      {initial && (
        <text x="50%" y="58%" textAnchor="middle" fontSize={size * 0.30} fontWeight="bold" fill="#fff" style={{dominantBaseline: 'middle', filter: 'drop-shadow(0 1px 2px #0008)'}}>
          {initial}
        </text>
      )}
    </svg>
  );
};

export default TeamCrestSvg;

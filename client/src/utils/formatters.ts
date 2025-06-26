// Funciones de utilidad compartidas

export function formatNumber(num?: number): string {
  if (!num || num === 0) return '0';
  
  if (num >= 1000000000) {
    const billions = num / 1000000000;
    return (billions % 1 === 0 ? billions.toFixed(0) : billions.toFixed(1)) + 'B';
  } else if (num >= 1000000) {
    const millions = num / 1000000;
    return (millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)) + 'M';
  } else if (num >= 1000) {
    const thousands = num / 1000;
    return (thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)) + 'K';
  }
  return num.toString();
}

export function formatFecha(fechaIso?: string): string {
  if (!fechaIso) return '-';
  const fecha = new Date(fechaIso);
  return fecha.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function calculateAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

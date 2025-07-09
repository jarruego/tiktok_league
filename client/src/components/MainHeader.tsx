import { Link } from 'react-router-dom';
import { AuthStatus } from './AuthStatus';
import { usePermissions } from '../hooks/usePermissions';
import { useState, useEffect } from 'react';

export default function MainHeader() {
  const { isAuthenticated } = usePermissions();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <header style={{
      background: '#fff', borderBottom: '1px solid #eee',
      boxShadow: '0 2px 8px #0001', zIndex: 10
    }}>
      <div style={{ padding: '0 16px', width: '100%', boxSizing: 'border-box' }}>
        {/* Primera fila: Logo (izquierda) y AuthStatus (derecha) */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          height: 64
        }}>
          {/* Logo siempre a la izquierda */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 32, lineHeight: 1 }} role="img" aria-label="balón de fútbol">⚽️</span>
            <Link to="/" style={{ fontWeight: 700, fontSize: 22, color: '#222', textDecoration: 'none' }}>
              Soccer Legends
            </Link>
          </div>
          
          {/* Espacio flexible para empujar el menú y el dropdown a la derecha */}
          <div style={{ flex: 1 }}></div>
          
          {/* Opciones de menú en escritorio (antes del dropdown) */}
          {isAuthenticated && !isMobile && (
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              marginRight: 16  // Margen derecho para separar del dropdown
            }}>
              <Link 
                to="/matches" 
                style={{ 
                  color: '#666', 
                  textDecoration: 'none', 
                  fontWeight: 500,
                  transition: 'color 0.3s',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => (e.target as HTMLElement).style.color = '#1890ff'}
                onMouseOut={(e) => (e.target as HTMLElement).style.color = '#666'}
              >
                Partidos
              </Link>
            </div>
          )}
          
          {/* AuthStatus (dropdown) siempre a la derecha */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <AuthStatus size="small" />
          </div>
        </div>
        
        {/* Segunda fila para móvil: opciones de menú centradas */}
        {isAuthenticated && isMobile && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            padding: '8px 0',
            borderTop: '1px solid #eee',
            width: '100%'
          }}>
            <Link 
              to="/matches" 
              style={{ 
                color: '#666', 
                textDecoration: 'none', 
                fontWeight: 500,
                transition: 'color 0.3s'
              }}
              onMouseOver={(e) => (e.target as HTMLElement).style.color = '#1890ff'}
              onMouseOut={(e) => (e.target as HTMLElement).style.color = '#666'}
            >
              Partidos
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

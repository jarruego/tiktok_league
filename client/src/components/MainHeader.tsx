import { Link } from 'react-router-dom';
import { AuthStatus } from './AuthStatus';
import { usePermissions } from '../hooks/usePermissions';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

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

  const { user } = useAuth();
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
              Social League
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
               marginRight: 16
             }}>
              {user && user.teamId && (
                <Link 
                  to="/mi-equipo" 
                  style={{ 
                    marginLeft: 16,
                    color: '#666',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'color 0.3s',
                    whiteSpace: 'nowrap',
                    fontSize: 18,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onMouseOver={(e) => (e.target as HTMLElement).style.color = '#1890ff'}
                  onMouseOut={(e) => (e.target as HTMLElement).style.color = '#666'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <path d="M12 3L4 6v6c0 5.25 4.5 8.25 8 9 3.5-.75 8-3.75 8-9V6z" />
                  </svg>
                  Mi Equipo
                </Link>
              )}
               <Link 
                 to="/divisions" 
                 style={{ 
                   color: '#666', 
                   textDecoration: 'none', 
                   fontWeight: 500,
                   transition: 'color 0.3s',
                   whiteSpace: 'nowrap',
                   fontSize: 18,
                   display: 'flex',
                   alignItems: 'center'
                 }}
                 onMouseOver={(e) => (e.target as HTMLElement).style.color = '#1890ff'}
                 onMouseOut={(e) => (e.target as HTMLElement).style.color = '#666'}
               >
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                   <rect x="3" y="3" width="18" height="18" rx="2"/>
                   <line x1="3" y1="9" x2="21" y2="9"/>
                   <line x1="3" y1="15" x2="21" y2="15"/>
                   <line x1="9" y1="3" x2="9" y2="21"/>
                   <line x1="15" y1="3" x2="15" y2="21"/>
                 </svg>
                 Clasificación
               </Link>
               <Link 
                 to="/matches" 
                 style={{ 
                   color: '#666', 
                   textDecoration: 'none', 
                   fontWeight: 500,
                   transition: 'color 0.3s',
                   whiteSpace: 'nowrap',
                   fontSize: 18,
                   display: 'flex',
                   alignItems: 'center'
                 }}
                 onMouseOver={(e) => (e.target as HTMLElement).style.color = '#1890ff'}
                 onMouseOut={(e) => (e.target as HTMLElement).style.color = '#666'}
               >
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                   <rect x="3" y="4" width="18" height="18" rx="3"/>
                   <line x1="16" y1="2" x2="16" y2="6"/>
                   <line x1="8" y1="2" x2="8" y2="6"/>
                   <line x1="3" y1="10" x2="21" y2="10"/>
                 </svg>
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
            justifyContent: 'space-around', 
            alignItems: 'center',
            padding: '8px 0',
            borderTop: '1px solid #eee',
            width: '100%'
          }}>
            {user && user.teamId && (
              <Link to="/mi-equipo" style={{ fontWeight: 500, whiteSpace: 'nowrap', fontSize: 28, display: 'flex', alignItems: 'center' }} aria-label="Mi Equipo">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                  <path d="M12 3L4 6v6c0 5.25 4.5 8.25 8 9 3.5-.75 8-3.75 8-9V6z" />
                </svg>
              </Link>
            )}
            <Link 
              to="/divisions" 
              style={{ 
                color: '#111', 
                textDecoration: 'none', 
                fontWeight: 500,
                transition: 'color 0.3s',
                whiteSpace: 'nowrap',
                fontSize: 28,
                display: 'flex',
                alignItems: 'center'
              }}
              aria-label="Clasificación"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <svg><line x1="3" y1="9" x2="21" y2="9"/></svg>
                <svg><line x1="3" y1="15" x2="21" y2="15"/></svg>
                <svg><line x1="9" y1="3" x2="9" y2="21"/></svg>
                <svg><line x1="15" y1="3" x2="15" y2="21"/></svg>
              </svg>
            </Link>
            <Link 
              to="/matches" 
              style={{ 
                color: '#111', 
                textDecoration: 'none', 
                fontWeight: 500,
                transition: 'color 0.3s',
                whiteSpace: 'nowrap',
                fontSize: 28,
                display: 'flex',
                alignItems: 'center'
              }}
              aria-label="Partidos"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                <rect x="3" y="4" width="18" height="18" rx="3"/>
                <svg><line x1="16" y1="2" x2="16" y2="6"/></svg>
                <svg><line x1="8" y1="2" x2="8" y2="6"/></svg>
                <svg><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </svg>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

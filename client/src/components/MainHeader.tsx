import { Link } from 'react-router-dom';
import { AuthStatus } from './AuthStatus';
import { usePermissions } from '../hooks/usePermissions';
import { LayoutMaxWidth } from './LayoutContainer';

export default function MainHeader() {
  const { isAuthenticated, canAdministrate } = usePermissions();

  return (
    <header style={{
      background: '#fff', borderBottom: '1px solid #eee',
      boxShadow: '0 2px 8px #0001', zIndex: 10
    }}>
      <LayoutMaxWidth>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 32, lineHeight: 1 }} role="img" aria-label="balón de fútbol">⚽️</span>
            <Link to="/" style={{ fontWeight: 700, fontSize: 22, color: '#222', textDecoration: 'none' }}>
              Soccer Legends
            </Link>
          </div>
          
          {isAuthenticated && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
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
              
              {canAdministrate && (
                <Link 
                  to="/leagues" 
                  style={{ 
                    color: '#666', 
                    textDecoration: 'none', 
                    fontWeight: 500,
                    transition: 'color 0.3s'
                  }}
                  onMouseOver={(e) => (e.target as HTMLElement).style.color = '#1890ff'}
                  onMouseOut={(e) => (e.target as HTMLElement).style.color = '#666'}
                >
                  Administrar
                </Link>
              )}
              
              <AuthStatus size="small" />
            </nav>
          )}
          
          {!isAuthenticated && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <AuthStatus size="small" />
            </nav>
          )}
        </div>
      </LayoutMaxWidth>
    </header>
  );
}

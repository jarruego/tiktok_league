import { Link } from 'react-router-dom';
import { AuthStatus } from './AuthStatus';
import { LayoutMaxWidth } from './LayoutContainer';

export default function MainHeader() {
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
          <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <AuthStatus size="small" />
          </nav>
        </div>
      </LayoutMaxWidth>
    </header>
  );
}

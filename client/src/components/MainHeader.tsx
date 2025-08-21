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
                <>
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
                  <Link 
                    to="/alineacion" 
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
                      <path d="M16.719 19.7519L16.0785 14.6279C15.8908 13.1266 14.6146 12 13.1017 12H12H10.8983C9.38538 12 8.10917 13.1266 7.92151 14.6279L7.28101 19.7519C7.1318 20.9456 8.06257 22 9.26556 22H12H14.7344C15.9374 22 16.8682 20.9456 16.719 19.7519Z" />
                      <circle cx="12" cy="5" r="3" />
                      <circle cx="4" cy="9" r="2" />
                      <circle cx="20" cy="9" r="2" />
                      <path d="M4 14H3.69425C2.71658 14 1.8822 14.7068 1.72147 15.6712L1.38813 17.6712C1.18496 18.8903 2.12504 20 3.36092 20H7" />
                      <path d="M20 14H20.3057C21.2834 14 22.1178 14.7068 22.2785 15.6712L22.6119 17.6712C22.815 18.8903 21.8751 20 20.6392 20C19.4775 20 18.0952 20 17 20" />
                    </svg>
                    Alineación
                  </Link>
                </>
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
                 to="/stats" 
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
                 <span style={{ display: 'flex', alignItems: 'center', marginRight: 6 }}>
                   <svg width="22" height="22" viewBox="0 0 476.473 476.474" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <g>
                       <g>
                         <path d="M463.468,227.853c-40.177-1.468-80.359-1.686-120.557-1.717c-0.492-43.122,0.635-70.609,0.122-113.731 c3.448-7.695-0.284-18.88-11.294-18.88c-53.537,0-122.828,3.951-176.335,1.915c-2.323-0.635-4.857-0.666-7.289-0.094 c-8.311,0.541-11.878,8.092-10.672,14.944c-1.828,25.624-1.823,51.295-2.214,76.967c-36.467,0.614-83.337,0.729-119.81,0.733 c-5.512,0-9.179,2.829-11.065,6.604c-2.194,2.084-3.661,5.06-3.671,8.996c-0.099,51.455-1.473,108.105-0.025,159.555 c-1.686,7.374,2.343,16.301,12.157,16.372c149.75,1.056,300.085,5.981,449.79,1.731c7.881-0.224,12.009-6.114,12.472-12.232 c0.857-1.682,1.396-3.646,1.396-5.967V243.452c0-1.417-0.239-2.666-0.584-3.845C475.213,233.702,471.095,228.134,463.468,227.853z  M450.468,355.508c-141.143,3.544-282.803-0.65-423.988-1.858c-0.972-44.823-0.094-94.852,0.13-139.686 c36.427-0.015,83.246-0.109,119.665-0.843c1.368-0.025,2.579-0.282,3.722-0.619c5.68-0.874,10.832-4.997,11.009-12.38 c0.625-26.157,0.452-52.326,1.795-78.45c46.169,1.295,108.059-1.482,154.264-2.034c0.34,44.453-0.898,73.278-0.061,117.746 c0.025,1.32,0.259,2.498,0.573,3.615c0.736,5.81,4.854,11.116,12.426,11.116c40.162,0,80.313,0.146,120.465,1.36V355.508z" fill="#666"/>
                         <path d="M243.48,134.334c-0.825,0.165-1.633,0.457-2.344,0.987c-7.81,5.819-15.861,11.314-23.244,17.685 c-7.627,6.583,3.453,17.564,11.029,11.029c3.187-2.75,6.52-5.299,9.899-7.795c-0.229,18.382-0.63,36.762-0.681,55.145 c-0.025,10.062,15.577,10.057,15.603,0c0.061-23.404,0.802-46.794,0.868-70.198C254.625,134.672,248.101,132.404,243.48,134.334z" fill="#666"/>
                         <path d="M112.476,285.919c-4.804,0-9.6,0.051-14.394,0.157c8.163-8.282,14.254-18.448,15.138-29.854 c1.991-25.755-32.042-21.235-47.017-16.818c-9.625,2.834-5.527,17.891,4.148,15.041c5.33-1.574,29.597-9.343,27.025,3.413 c-2.709,13.426-16.547,23.998-27.835,29.995c-2.471,1.311-3.61,3.296-3.829,5.383c-1.678,4.783,0.584,10.761,6.896,10.019 c13.253-1.548,26.535-1.731,39.867-1.731C122.538,301.519,122.538,285.919,112.476,285.919z" fill="#666"/>
                         <path d="M373.319,288.661c5.397-1.138,10.785-2.097,16.274-2.574c2.691-0.239,5.81-0.29,8.293-0.076 c-1.849,2.473-4.276,4.672-6.617,6.692c-1.533,0.178-3.017,0.873-4.296,2.234c-2.706,2.904-3.188,8.663,0,11.477 c4.611,4.082,9.217,8.43,12.294,13.989c0.264,0.493,0.503,0.99,0.736,1.498c0.041,0.122,0.066,0.214,0.173,0.519 c0.046,0.162,0.081,0.335,0.122,0.502c-0.082,0.021-0.117,0.031-0.152,0.041c-0.285,0.021-0.569,0.051-0.858,0.056 c-2.311,0.112-3.428-0.203-5.946-0.889c-6.586-1.787-12.578-5.57-18.215-9.526c-8.19-5.753-15.768,8.303-7.638,14.016 c11.004,7.733,31.316,19.565,43.646,8.201c10.456-9.644,1.818-23.704-6.683-33.139c8.079-8.161,16.188-20.125,4.769-28.854 c-4.397-3.356-11.167-3.301-16.296-3.164c-7.916,0.214-15.873,1.722-23.627,3.357 C359.725,275.032,363.788,290.672,373.319,288.661z" fill="#666"/>
                       </g>
                     </g>
                   </svg>
                 </span>
                 Estadísticas
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
              <>
                <Link to="/mi-equipo" style={{ fontWeight: 500, whiteSpace: 'nowrap', fontSize: 28, display: 'flex', alignItems: 'center' }} aria-label="Mi Equipo">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                    <path d="M12 3L4 6v6c0 5.25 4.5 8.25 8 9 3.5-.75 8-3.75 8-9V6z" />
                  </svg>
                </Link>
                <Link to="/alineacion" style={{ fontWeight: 500, whiteSpace: 'nowrap', fontSize: 28, display: 'flex', alignItems: 'center' }} aria-label="Alineación">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                    <path d="M16.719 19.7519L16.0785 14.6279C15.8908 13.1266 14.6146 12 13.1017 12H12H10.8983C9.38538 12 8.10917 13.1266 7.92151 14.6279L7.28101 19.7519C7.1318 20.9456 8.06257 22 9.26556 22H12H14.7344C15.9374 22 16.8682 20.9456 16.719 19.7519Z" />
                    <circle cx="12" cy="5" r="3" />
                    <circle cx="4" cy="9" r="2" />
                    <circle cx="20" cy="9" r="2" />
                    <path d="M4 14H3.69425C2.71658 14 1.8822 14.7068 1.72147 15.6712L1.38813 17.6712C1.18496 18.8903 2.12504 20 3.36092 20H7" />
                    <path d="M20 14H20.3057C21.2834 14 22.1178 14.7068 22.2785 15.6712L22.6119 17.6712C22.815 18.8903 21.8751 20 20.6392 20C19.4775 20 18.0952 20 17 20" />
                  </svg>
                </Link>
                <Link to="/stats" style={{ fontWeight: 500, whiteSpace: 'nowrap', fontSize: 28, display: 'flex', alignItems: 'center' }} aria-label="Estadísticas">
                  <span style={{ display: 'flex', alignItems: 'center', marginRight: 4 }}>
                    <svg width="28" height="28" viewBox="0 0 476.473 476.474" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g>
                        <g>
                          <path d="M463.468,227.853c-40.177-1.468-80.359-1.686-120.557-1.717c-0.492-43.122,0.635-70.609,0.122-113.731 c3.448-7.695-0.284-18.88-11.294-18.88c-53.537,0-122.828,3.951-176.335,1.915c-2.323-0.635-4.857-0.666-7.289-0.094 c-8.311,0.541-11.878,8.092-10.672,14.944c-1.828,25.624-1.823,51.295-2.214,76.967c-36.467,0.614-83.337,0.729-119.81,0.733 c-5.512,0-9.179,2.829-11.065,6.604c-2.194,2.084-3.661,5.06-3.671,8.996c-0.099,51.455-1.473,108.105-0.025,159.555 c-1.686,7.374,2.343,16.301,12.157,16.372c149.75,1.056,300.085,5.981,449.79,1.731c7.881-0.224,12.009-6.114,12.472-12.232 c0.857-1.682,1.396-3.646,1.396-5.967V243.452c0-1.417-0.239-2.666-0.584-3.845C475.213,233.702,471.095,228.134,463.468,227.853z  M450.468,355.508c-141.143,3.544-282.803-0.65-423.988-1.858c-0.972-44.823-0.094-94.852,0.13-139.686 c36.427-0.015,83.246-0.109,119.665-0.843c1.368-0.025,2.579-0.282,3.722-0.619c5.68-0.874,10.832-4.997,11.009-12.38 c0.625-26.157,0.452-52.326,1.795-78.45c46.169,1.295,108.059-1.482,154.264-2.034c0.34,44.453-0.898,73.278-0.061,117.746 c0.025,1.32,0.259,2.498,0.573,3.615c0.736,5.81,4.854,11.116,12.426,11.116c40.162,0,80.313,0.146,120.465,1.36V355.508z" fill="#111"/>
                          <path d="M243.48,134.334c-0.825,0.165-1.633,0.457-2.344,0.987c-7.81,5.819-15.861,11.314-23.244,17.685 c-7.627,6.583,3.453,17.564,11.029,11.029c3.187-2.75,6.52-5.299,9.899-7.795c-0.229,18.382-0.63,36.762-0.681,55.145 c-0.025,10.062,15.577,10.057,15.603,0c0.061-23.404,0.802-46.794,0.868-70.198C254.625,134.672,248.101,132.404,243.48,134.334z" fill="#111"/>
                          <path d="M112.476,285.919c-4.804,0-9.6,0.051-14.394,0.157c8.163-8.282,14.254-18.448,15.138-29.854 c1.991-25.755-32.042-21.235-47.017-16.818c-9.625,2.834-5.527,17.891,4.148,15.041c5.33-1.574,29.597-9.343,27.025,3.413 c-2.709,13.426-16.547,23.998-27.835,29.995c-2.471,1.311-3.61,3.296-3.829,5.383c-1.678,4.783,0.584,10.761,6.896,10.019 c13.253-1.548,26.535-1.731,39.867-1.731C122.538,301.519,122.538,285.919,112.476,285.919z" fill="#111"/>
                          <path d="M373.319,288.661c5.397-1.138,10.785-2.097,16.274-2.574c2.691-0.239,5.81-0.29,8.293-0.076 c-1.849,2.473-4.276,4.672-6.617,6.692c-1.533,0.178-3.017,0.873-4.296,2.234c-2.706,2.904-3.188,8.663,0,11.477 c4.611,4.082,9.217,8.43,12.294,13.989c0.264,0.493,0.503,0.99,0.736,1.498c0.041,0.122,0.066,0.214,0.173,0.519 c0.046,0.162,0.081,0.335,0.122,0.502c-0.082,0.021-0.117,0.031-0.152,0.041c-0.285,0.021-0.569,0.051-0.858,0.056 c-2.311,0.112-3.428-0.203-5.946-0.889c-6.586-1.787-12.578-5.57-18.215-9.526c-8.19-5.753-15.768,8.303-7.638,14.016 c11.004,7.733,31.316,19.565,43.646,8.201c10.456-9.644,1.818-23.704-6.683-33.139c8.079-8.161,16.188-20.125,4.769-28.854 c-4.397-3.356-11.167-3.301-16.296-3.164c-7.916,0.214-15.873,1.722-23.627,3.357 C359.725,275.032,363.788,290.672,373.319,288.661z" fill="#111"/>
                        </g>
                      </g>
                    </svg>
                  </span>
                </Link>
              </>
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

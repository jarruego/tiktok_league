import React from 'react';

const LoadingBallAnimation: React.FC<{ text?: string }> = ({ text = 'Cargando datos...' }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', width: '100%'
  }}>
    <div className="bouncing-ball-loader" style={{ marginBottom: 24 }}>
      <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="#f0f0f0" stroke="#000" strokeWidth="2" />
        <path d="M 20,50 C 35,30 65,30 80,50 65,70 35,70 20,50 Z" fill="none" stroke="#000" strokeWidth="2" />
        <path d="M 20,50 C 30,30 70,30 80,50 70,70 30,70 20,50 Z" fill="none" stroke="#000" strokeWidth="2" />
        <path d="M 20,50 C 25,40 75,40 80,50 75,60 25,60 20,50 Z" fill="none" stroke="#000" strokeWidth="2" />
      </svg>
    </div>
    <div style={{ fontSize: 20, color: '#1e90ff', fontWeight: 700, letterSpacing: 0.5 }}>{text}</div>
    <style>{`
      .bouncing-ball-loader {
        animation: bounce 1s infinite cubic-bezier(.28,.84,.42,1);
        display: inline-block;
      }
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        20% { transform: translateY(-30px); }
        40% { transform: translateY(-50px); }
        60% { transform: translateY(-30px); }
        80% { transform: translateY(-10px); }
      }
    `}</style>
  </div>
);

export default LoadingBallAnimation;

import React from 'react';

const AppLogo: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <img
    src="/favicon.png"
    alt="Logo Social League"
    width={size}
    height={size}
    style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: '12%' }}
  />
);

export default AppLogo;

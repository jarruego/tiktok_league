import React from 'react';
import '../styles/LayoutContainer.css';

export const LayoutContainer: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="layout-container">
    {children}
  </div>
);

export const LayoutMaxWidth: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="layout-maxwidth">
    {children}
  </div>
);

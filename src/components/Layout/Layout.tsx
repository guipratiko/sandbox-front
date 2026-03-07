import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, className = '' }) => {
  return (
    <div className={`min-h-screen bg-clerky-backendBg dark:bg-[#020617] ${className}`}>
      {children}
    </div>
  );
};

export default Layout;


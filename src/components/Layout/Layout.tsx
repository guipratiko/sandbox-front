import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`flex min-h-screen min-h-[100dvh] flex-col bg-clerky-backendBg dark:bg-[#020617] overscroll-none ${className}`}
    >
      {children}
    </div>
  );
};

export default Layout;


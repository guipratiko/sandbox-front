import React, { ReactNode, useState } from 'react';
import Layout from './Layout';
import Sidebar from './Sidebar';
import Header from './Header';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <Layout>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Conteúdo Principal */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Header */}
          <Header 
            onMenuClick={() => setSidebarOpen(true)}
          />

          {/* Conteúdo da Página */}
          <main className="flex-1 overflow-y-auto bg-clerky-backendBg dark:bg-[#020617] pt-[72px]">
            <div className="p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default AppLayout;


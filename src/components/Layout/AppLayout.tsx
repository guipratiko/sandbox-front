import React, { ReactNode, useState, useEffect, createContext } from 'react';
import Layout from './Layout';
import Sidebar from './Sidebar';
import Header from './Header';

/** Menu lateral recolhido — páginas (ex.: CRM) podem ajustar layout/overflow. */
export const SidebarCollapsedContext = createContext(false);

interface AppLayoutProps {
  children: ReactNode;
}

/** Persistido entre telas: cada página monta seu próprio AppLayout; sem isso o menu “reabria” ao navegar. */
const SIDEBAR_COLLAPSED_KEY = 'onlyflow.sidebarCollapsed.v1';

function readSidebarCollapsed(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* quota / private mode */
    }
  }, [sidebarCollapsed]);

  return (
    <SidebarCollapsedContext.Provider value={sidebarCollapsed}>
      <Layout>
        <div className="flex h-screen min-w-0 overflow-hidden">
          {/* Sidebar */}
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          {/* Conteúdo Principal */}
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Header */}
            <Header onMenuClick={() => setSidebarOpen(true)} />

            {/* Conteúdo da Página */}
            <main
              className={`min-w-0 flex-1 overflow-y-auto bg-clerky-backendBg pt-[72px] dark:bg-[#020617] ${
                sidebarCollapsed ? 'overflow-x-hidden' : ''
              }`}
            >
              <div className="min-w-0 max-w-full p-4 sm:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </Layout>
    </SidebarCollapsedContext.Provider>
  );
};

export default AppLayout;


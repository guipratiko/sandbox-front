import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import MobileRestrictedRoute from './components/Auth/MobileRestrictedRoute';
import PremiumRoute from './components/Auth/PremiumRoute';
import Login from './components/Login/Login';
import SignUp from './components/SignUp/SignUp';
import ForgotPassword from './components/ForgotPassword/ForgotPassword';
import ActivateAccount from './pages/ActivateAccount';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Instances from './pages/Instances';
import Dispatches from './pages/Dispatches';
import DispatchesOfficial from './pages/DispatchesOfficial';
import CRM from './pages/CRM';
import MindClerky from './pages/MindClerky';
import Integration from './pages/Integration';
import AIAgentPage from './pages/AIAgent';
import Documentation from './pages/Documentation';
import Settings from './pages/Settings';
import DeleteAccount from './pages/DeleteAccount';
import GroupManager from './pages/GroupManager';
import GerenciadorInstagram from './pages/GerenciadorInstagram';
import ScrapingFlow from './pages/ScrapingFlow';
import Admin from './pages/Admin';
import AdminRoute from './components/Auth/AdminRoute';
import News from './pages/News';
import { usePageTitle } from './hooks/usePageTitle';

function AppContent() {
  usePageTitle();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/ativar-conta" element={<ActivateAccount />} />
      <Route
        path="/inicio"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gerenciador-conexoes"
        element={
          <ProtectedRoute>
            <PremiumRoute>
            <Instances />
            </PremiumRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/disparos"
        element={
          <ProtectedRoute>
            <PremiumRoute>
            <Dispatches />
            </PremiumRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/disparo-api"
        element={
          <ProtectedRoute>
            <PremiumRoute>
              <DispatchesOfficial />
            </PremiumRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/crm"
        element={
          <ProtectedRoute>
            <PremiumRoute>
              <MobileRestrictedRoute>
            <CRM />
              </MobileRestrictedRoute>
            </PremiumRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/mindflow"
        element={
          <ProtectedRoute>
            <PremiumRoute>
              <MobileRestrictedRoute>
            <MindClerky />
              </MobileRestrictedRoute>
            </PremiumRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/integracao"
        element={
          <ProtectedRoute>
            <PremiumRoute>
            <Integration />
            </PremiumRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agente-ia"
        element={
          <ProtectedRoute>
            <PremiumRoute>
            <AIAgentPage />
            </PremiumRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/documentacao"
        element={
          <ProtectedRoute>
            <Documentation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/excluir-conta"
        element={
          <ProtectedRoute>
            <DeleteAccount />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gerenciador-grupos"
        element={
          <ProtectedRoute>
            <PremiumRoute>
            <GroupManager />
            </PremiumRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/gerenciador-instagram"
        element={
          <ProtectedRoute>
            <PremiumRoute>
            <GerenciadorInstagram />
            </PremiumRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/scraping"
        element={
          <ProtectedRoute>
            <PremiumRoute>
            <ScrapingFlow />
            </PremiumRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <Admin />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/novidades"
        element={
          <ProtectedRoute>
            <News />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Login />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;


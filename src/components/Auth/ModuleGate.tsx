import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { SubuserPermissions } from '../../services/api';

export type ModulePermissionKey = keyof SubuserPermissions;

interface ModuleGateProps {
  module: ModulePermissionKey;
  children: React.ReactElement;
}

/**
 * Redireciona subusuários sem permissão do módulo para o início.
 */
const ModuleGate: React.FC<ModuleGateProps> = ({ module, children }) => {
  const { user } = useAuth();
  if (user?.isSubuser && user.permissions && !user.permissions[module]) {
    return <Navigate to="/inicio" replace />;
  }
  return children;
};

export default ModuleGate;

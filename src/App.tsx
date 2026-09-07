/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { ExecutiveDashboard } from './pages/ExecutiveDashboard';
import { Demands } from './pages/Demands';
import { ClientList } from './pages/ClientList';
import { ClientNew } from './pages/ClientNew';
import { ClientDashboard } from './pages/ClientDashboard';
import { Reports } from './pages/Reports';
import { Management } from './pages/Management';
import { Commercial } from './pages/Commercial';
import { Settings } from './pages/Settings';
import { TrafficWorkspace } from './pages/TrafficWorkspace';
import { Processes } from './pages/Processes';
import { Users } from './pages/Users';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VisibilityProvider } from './contexts/VisibilityContext';
import { ErrorBoundary } from './components/ErrorBoundary';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!profile || !isAdmin) return <Navigate to="/dashboard-executivo" replace />;
  return <>{children}</>;
}

function ModuleRoute({ module, children }: { module: string; children: React.ReactNode }) {
  const { hasPermission, loading, logout } = useAuth();
  if (loading) return null;

  if (!hasPermission(module, 'view')) {
    // Find the first allowed module to redirect to
    const navItems = [
      { path: '/dashboard-executivo', module: 'dashboard' },
      { path: '/demandas', module: 'demandas' },
      { path: '/processos', module: 'processos' },
      { path: '/clientes', module: 'clientes' },
      { path: '/comercial', module: 'comercial' },
      { path: '/gestao', module: 'financeiro' },
      { path: '/relatorios', module: 'relatorios' },
      { path: '/trafego', module: 'trafego' },
      { path: '/configuracoes', module: 'configuracoes' },
    ];

    const firstAllowed = navItems.find(item => hasPermission(item.module, 'view'));
    if (firstAllowed && firstAllowed.module !== module) {
      return <Navigate to={firstAllowed.path} replace />;
    }

    // Fallback: render an elegant unauthorized state if they can't access any module
    return (
      <div className="min-h-screen bg-bg-base text-text-primary flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10">
          <span className="text-3xl text-accent-coral font-bold">!</span>
        </div>
        <h1 className="text-xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-text-secondary text-sm max-w-sm mb-6">
          Seu usuário não possui permissão para visualizar nenhum módulo do sistema. Entre em contato com o administrador.
        </p>
        <button 
          onClick={() => logout()}
          className="px-6 py-2.5 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-all cursor-pointer"
        >
          Sair da Conta
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <VisibilityProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Toaster 
            theme="dark" 
            position="top-right" 
            richColors 
            toastOptions={{
              style: { background: '#0A0A0B', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Navigate to="/dashboard-executivo" replace />} />
              <Route path="/dashboard-executivo" element={<ModuleRoute module="dashboard"><ErrorBoundary><ExecutiveDashboard /></ErrorBoundary></ModuleRoute>} />
              <Route path="/dashboard" element={<Navigate to="/dashboard-executivo" replace />} />
              <Route path="/demandas" element={<ModuleRoute module="demandas"><ErrorBoundary><Demands /></ErrorBoundary></ModuleRoute>} />
              <Route path="/processos" element={<ModuleRoute module="processos"><ErrorBoundary><Processes /></ErrorBoundary></ModuleRoute>} />
              <Route path="/clientes" element={<ModuleRoute module="clientes"><ErrorBoundary><ClientList /></ErrorBoundary></ModuleRoute>} />
              <Route path="/clientes/novo" element={<ModuleRoute module="clientes"><ErrorBoundary><ClientNew /></ErrorBoundary></ModuleRoute>} />
              <Route path="/clientes/:id" element={<ModuleRoute module="clientes"><ErrorBoundary><ClientDashboard /></ErrorBoundary></ModuleRoute>} />
              <Route path="/comercial" element={<ModuleRoute module="comercial"><ErrorBoundary><Commercial /></ErrorBoundary></ModuleRoute>} />
              <Route path="/gestao" element={<ModuleRoute module="financeiro"><ErrorBoundary><Management /></ErrorBoundary></ModuleRoute>} />
              <Route path="/relatorios" element={<ModuleRoute module="relatorios"><ErrorBoundary><Reports /></ErrorBoundary></ModuleRoute>} />
              <Route path="/trafego" element={<ModuleRoute module="trafego"><ErrorBoundary><TrafficWorkspace /></ErrorBoundary></ModuleRoute>} />
              <Route path="/configuracoes" element={<ModuleRoute module="configuracoes"><ErrorBoundary><Settings /></ErrorBoundary></ModuleRoute>} />
              <Route path="/usuarios" element={<AdminRoute><ErrorBoundary><Users /></ErrorBoundary></AdminRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </VisibilityProvider>
    </AuthProvider>
  );
}

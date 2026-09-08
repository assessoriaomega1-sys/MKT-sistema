import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  PlusCircle, 
  FileText, 
  Settings, 
  Search, 
  Plus, 
  LogOut,
  ChevronRight,
  Bell,
  Briefcase,
  Eye,
  EyeOff,
  DollarSign,
  Calendar,
  Globe,
  Target,
  Layers,
  Shield,
  Building2,
  Sparkles
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { storage } from '../lib/storage';
import { motion, AnimatePresence } from 'motion/react';
import { CommandPalette } from './CommandPalette';
import { CompanySetupModal } from './CompanySetupModal';
import { ThemeSelector } from './ThemeSelector';
import { useAuth } from '../contexts/AuthContext';
import { useVisibility } from '../contexts/VisibilityContext';
import { toast } from 'sonner';

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission, profile, isAdmin } = useAuth();
  const { isVisible, toggleVisibility } = useVisibility();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    storage.getSettings().then(setSettings);
  }, []);

  const handleOpenCommandPalette = () => {
    window.dispatchEvent(new CustomEvent('open-command-palette'));
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Até logo!');
      navigate('/login');
    } catch (error) {
      toast.error('Erro ao sair');
    }
  };

  const companyName = profile?.agencyName || settings?.agencyName || 'MKT';

  const navItems = [
    { label: 'Dashboard Executivo', icon: Target, path: '/dashboard-executivo', module: 'dashboard' },
    { label: 'Demandas', icon: Calendar, path: '/demandas', module: 'demandas' },
    { label: 'Processos', icon: Layers, path: '/processos', module: 'processos' },
    { label: 'Clientes', icon: Users, path: '/clientes', module: 'clientes' },
    { label: 'Comercial', icon: DollarSign, path: '/comercial', module: 'comercial' },
    { label: 'Gestão de Carteira', icon: Briefcase, path: '/gestao', module: 'financeiro' },
    { label: 'Relatórios', icon: FileText, path: '/relatorios', module: 'relatorios' },
    { label: 'Tráfego', icon: Globe, path: '/trafego', module: 'trafego' },
    { label: 'Configurações', icon: Settings, path: '/configuracoes', module: 'configuracoes' },
    { label: 'Usuários', icon: Shield, path: '/usuarios', module: 'usuarios' },
  ];

  const allowedNavItems = navItems.filter(item => hasPermission(item.module, 'view'));

  return (
    <div className="flex min-h-screen bg-bg-base text-text-primary overflow-x-hidden">
      <CommandPalette />
      <CompanySetupModal 
        isOpen={isCompanyModalOpen} 
        onClose={() => setIsCompanyModalOpen(false)} 
      />

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border-subtle bg-bg-elevated/50 backdrop-blur-xl sticky top-0 h-screen">
        <div className="p-6 border-b border-border-subtle/40">
          <Link to="/dashboard-executivo" className="flex items-center gap-3 group min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent-mint flex items-center justify-center text-bg-base font-black text-sm tracking-tight shadow-[0_0_20px_-5px_#00D9A3] shrink-0">
              MKT
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-base font-bold tracking-tight text-white block truncate">{companyName}</span>
              <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold truncate">
                {profile?.businessSector || 'Gestão & Tráfego'}
              </span>
            </div>
          </Link>

          {/* Quick link to customize company */}
          <button
            onClick={() => setIsCompanyModalOpen(true)}
            className="mt-3 w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-text-secondary hover:text-white transition-all border border-white/5 cursor-pointer"
          >
            <span className="flex items-center gap-1.5 truncate">
              <Building2 size={12} className="text-accent-mint shrink-0" />
              <span className="truncate">Dados da Empresa</span>
            </span>
            <span className="text-[10px] text-accent-mint font-semibold">Editar</span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
          {allowedNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/clientes' && location.pathname.startsWith('/clientes'));
            const itemId = `nav-link-${item.path.replace('/', '')}`;
            return (
              <Link
                key={item.path}
                id={itemId}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all group relative overflow-hidden select-none",
                  isActive 
                    ? "bg-accent-mint/10 text-white border border-accent-mint/25 shadow-sm shadow-accent-mint/10" 
                    : "text-text-secondary hover:bg-white/[0.04] hover:text-white border border-transparent"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-2 bottom-2 w-1 bg-accent-mint rounded-r-full shadow-[0_0_8px_rgba(4,221,114,0.6)]"
                  />
                )}
                <item.icon 
                  size={17} 
                  className={cn(
                    "transition-transform duration-200 group-hover:scale-110 shrink-0",
                    isActive ? "text-accent-mint" : "text-text-muted group-hover:text-white"
                  )} 
                />
                <span className="truncate flex-1">{item.label}</span>
                {item.path === '/trafego' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent-mint/15 text-accent-mint border border-accent-mint/20 font-mono uppercase tracking-wider">
                    Labs
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border-subtle">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-white/5 transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-accent-mint/20 border border-accent-mint/30 flex items-center justify-center text-xs font-bold text-accent-mint overflow-hidden shrink-0">
              {user?.photoURL ? <img src={user.photoURL} alt="User" /> : (user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'M').toUpperCase()}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-white truncate text-xs font-medium">{profile?.managerName || user?.displayName || settings?.managerName || 'Empresário'}</p>
              <p className="text-[10px] text-accent-mint uppercase tracking-wider truncate font-semibold">
                {profile?.companyRole || (isAdmin ? 'Empresário / Dono' : (profile?.roleName || 'Colaborador'))}
              </p>
            </div>
            <LogOut size={14} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-border-subtle bg-bg-base/80 backdrop-blur-md sticky top-0 z-30 flex items-center px-4 md:px-8 gap-4">
          <div className="flex items-center lg:hidden">
            <Link to="/dashboard-executivo" className="flex items-center gap-2 mr-3">
              <div className="w-7 h-7 rounded-md bg-accent-mint flex items-center justify-center text-black font-black text-xs">MKT</div>
              <span className="font-bold text-white text-sm truncate max-w-[120px]">{companyName}</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-text-muted uppercase tracking-widest">
            <span>Início</span>
            <ChevronRight size={12} />
            <span className="text-text-secondary">{location.pathname.split('/')[1]?.replace('-', ' ') === 'dashboard' ? 'Painel' : location.pathname.split('/')[1]?.replace('-', ' ')}</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            {/* Empresa badge on topbar */}
            <button
              onClick={() => setIsCompanyModalOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-accent-mint/40 text-text-secondary hover:text-white transition-all text-xs cursor-pointer group"
              title="Configurar informações da empresa"
            >
              <Building2 size={14} className="text-accent-mint" />
              <span className="font-medium text-white max-w-[140px] truncate">{companyName}</span>
            </button>

            <button 
              onClick={handleOpenCommandPalette}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:text-white transition-all text-sm group"
            >
              <Search size={16} />
              <span className="text-xs opacity-50 font-mono">⌘K</span>
            </button>

            {hasPermission('clientes', 'create') && (
              <Link 
                to="/clientes/novo"
                className="px-4 py-2 bg-accent-mint text-black font-semibold rounded-lg text-sm flex items-center gap-2 hover:bg-accent-mint/90 transition-all shadow-lg shadow-accent-mint/10"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Novo Cliente</span>
              </Link>
            )}

            <button 
              onClick={toggleVisibility}
              className="p-2 text-text-secondary hover:text-white transition-colors cursor-pointer"
              title={isVisible ? "Esconder valores" : "Mostrar valores"}
            >
              {isVisible ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>

            {/* Seletor de Tema e Cor no Topo para Qualquer Usuário */}
            <ThemeSelector />

            <div className="w-px h-8 bg-border-subtle mx-1" />

            <button className="p-2 text-text-secondary hover:text-white relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-accent-coral rounded-full ring-2 ring-bg-base" />
            </button>
          </div>
        </header>

        {/* Company Welcome Banner if not configured yet */}
        {profile && (!profile.companySetupCompleted && (!profile.agencyName || profile.agencyName === 'MKT')) && (
          <div className="bg-gradient-to-r from-accent-mint/15 via-accent-mint/10 to-transparent border-b border-accent-mint/20 px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-mint/20 border border-accent-mint/40 flex items-center justify-center text-accent-mint shrink-0">
                <Sparkles size={16} />
              </div>
              <p className="text-xs md:text-sm text-text-secondary">
                <strong className="text-white font-semibold">Organize a sua empresa no MKT:</strong> Defina o nome do seu negócio, nicho e metas para personalizar sua experiência.
              </p>
            </div>
            <button
              onClick={() => setIsCompanyModalOpen(true)}
              className="px-4 py-1.5 bg-accent-mint text-black font-bold text-xs rounded-lg hover:bg-accent-mint/90 transition-all shadow cursor-pointer shrink-0"
            >
              Configurar Empresa
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="p-4 md:p-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

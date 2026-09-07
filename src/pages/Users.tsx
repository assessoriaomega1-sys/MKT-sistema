import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users as UsersIcon, 
  Shield, 
  Activity, 
  Plus, 
  Search, 
  Edit, 
  Archive, 
  Check, 
  X, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  UserPlus, 
  HelpCircle,
  FileText,
  AlertTriangle,
  Layers,
  ChevronRight,
  Filter,
  Key,
  Copy,
  Share2
} from 'lucide-react';
import { storage } from '../lib/storage';
import { UserProfile, UserRole, ModulePermissions, ActivityLog, Client, Processo } from '../types';
import { DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

// Permissíveis modules e correspondente ícones e labels
const MODULES_METADATA = [
  { key: 'dashboard', label: 'Dashboard', desc: 'Acesso aos dashboards executivos', actions: ['view', 'edit'] },
  { key: 'clientes', label: 'Clientes', desc: 'Cadastro e visualização de clientes', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'demandas', label: 'Demandas', desc: 'Gerenciamento de tarefas e demandas', actions: ['view', 'create', 'edit', 'complete', 'delete'] },
  { key: 'processos', label: 'Processos', desc: 'Visualização e alteração de fluxos de processos', actions: ['view', 'createProcess', 'editProcess', 'moveCards', 'createCards', 'deleteCards'] },
  { key: 'comercial', label: 'Comercial', desc: 'Módulo comercial e metas de vendas', actions: ['view', 'createSale', 'editSale', 'deleteSale', 'editGoals'] },
  { key: 'financeiro', label: 'Financeiro / Gestão', desc: 'Fluxo financeiro, contas e MRR', actions: ['view', 'edit'] },
  { key: 'relatorios', label: 'Relatórios', desc: 'Relatórios analíticos gerais', actions: ['view'] },
  { key: 'trafego', label: 'Workspace de Tráfego', desc: 'Workspace incorporado de tráfego', actions: ['view'] },
  { key: 'configuracoes', label: 'Configurações', desc: 'Preferências do sistema', actions: ['view', 'edit'] },
  { key: 'usuarios', label: 'Usuários e Permissões', desc: 'Gerenciamento de colaboradores (RBAC)', actions: ['create', 'edit', 'delete', 'editPermissions'] }
];

const ACTION_LABELS: Record<string, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
  complete: 'Concluir',
  createProcess: 'Criar Processos',
  editProcess: 'Editar Processos',
  moveCards: 'Mover Cards',
  createCards: 'Criar Cards',
  deleteCards: 'Excluir Cards',
  createSale: 'Criar Venda',
  editSale: 'Editar Venda',
  deleteSale: 'Excluir Venda',
  editGoals: 'Alterar Metas',
  editPermissions: 'Alterar permissões'
};

const TEAM_OPTIONS = [
  'Diretoria',
  'Marketing',
  'Produção / Conteúdo',
  'Social Media',
  'Edição de Vídeo',
  'Design',
  'Tráfego Pago',
  'Atendimento / Suporte',
  'Comercial / Vendas',
  'Financeiro',
  'RH',
  'Tecnologia'
];

export function Users() {
  const { profile: currentUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'colaboradores' | 'cargos' | 'auditoria'>('colaboradores');
  
  // Data States
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [processes, setProcesses] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters and UI Search
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Modals / Editors
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [isAddingRole, setIsAddingRole] = useState(false);

  // Form states for creating/editing user
  const [userForm, setUserForm] = useState<Partial<UserProfile>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    roleName: 'Atendimento',
    team: 'Atendimento / Suporte',
    status: 'ACTIVE',
    customPermissions: {},
    restrictedClients: [],
    restrictedProcesses: []
  });

  // Form states for creating/editing role
  const [roleForm, setRoleForm] = useState<Partial<UserRole>>({
    name: '',
    permissions: {}
  });

  // Load Real-time Data
  useEffect(() => {
    const unsubUsers = storage.listenToUsers((data) => {
      setUsers(data);
    });

    const unsubRoles = storage.listenToRoles((data) => {
      setRoles(data);
    });

    const unsubLogs = storage.listenToActivityLogs((data) => {
      setLogs(data);
    });

    const unsubClients = storage.listenToClients((data) => {
      setClients(data);
    });

    const unsubProcesses = storage.listenToProcesses((data) => {
      setProcesses(data);
    });

    setLoading(false);

    return () => {
      unsubUsers();
      unsubRoles();
      unsubLogs();
      unsubClients();
      unsubProcesses();
    };
  }, []);

  // Sync edit states
  useEffect(() => {
    if (editingUser) {
      setUserForm({ ...editingUser });
    } else {
      setUserForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        roleName: 'Atendimento',
        team: 'Atendimento / Suporte',
        status: 'ACTIVE',
        customPermissions: {},
        restrictedClients: [],
        restrictedProcesses: []
      });
    }
  }, [editingUser, isAddingUser]);

  useEffect(() => {
    if (editingRole) {
      setRoleForm({ ...editingRole });
    } else {
      setRoleForm({
        name: '',
        permissions: {}
      });
    }
  }, [editingRole, isAddingRole]);

  // Handle User Save / Create
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.firstName || !userForm.lastName || !userForm.email) {
      toast.error('Preencha os campos obrigatórios (Nome, Sobrenome, E-mail)');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(userForm.email)) {
      toast.error('Por favor, informe um e-mail válido.');
      return;
    }

    const isNew = !userForm.id;
    const finalUserId = userForm.id || 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const userToSave: UserProfile = {
      id: finalUserId,
      managerName: `${userForm.firstName} ${userForm.lastName}`,
      theme: userForm.theme || 'light',
      firstName: userForm.firstName,
      lastName: userForm.lastName,
      email: userForm.email.toLowerCase().trim(),
      phone: userForm.phone || '',
      roleName: userForm.roleName || 'Atendimento',
      team: userForm.team || 'Atendimento / Suporte',
      status: userForm.status || 'ACTIVE',
      customPermissions: userForm.customPermissions || {},
      restrictedClients: userForm.restrictedClients || [],
      restrictedProcesses: userForm.restrictedProcesses || [],
      createdAt: userForm.createdAt || new Date().toISOString(),
      lastAccess: userForm.lastAccess || ''
    };

    try {
      await storage.saveUserProfile(userToSave);

      // Audit Logging
      const logDetails = isNew 
        ? `Colaborador cadastrado no sistema com o cargo ${userToSave.roleName}.`
        : `Cadastro atualizado. Cargo: ${userToSave.roleName}. Restrições: ${userToSave.restrictedClients?.length || 0} clientes, ${userToSave.restrictedProcesses?.length || 0} processos. Sobrescritas de permissão: ${Object.keys(userToSave.customPermissions || {}).length} módulos.`;

      const audit: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        actorId: currentUserProfile?.id || 'unknown',
        actorName: currentUserProfile?.managerName || 'Administrador',
        targetUserId: userToSave.id,
        targetUserName: userToSave.managerName,
        action: isNew ? 'Criação de Usuário' : 'Alteração de Permissões / Cadastro',
        details: logDetails,
        timestamp: new Date().toISOString()
      };

      await storage.saveActivityLog(audit);

      toast.success(isNew ? 'Colaborador adicionado com sucesso!' : 'Cadastro atualizado com sucesso!');
      setEditingUser(null);
      setIsAddingUser(false);
    } catch (err) {
      toast.error('Erro ao salvar colaborador.');
    }
  };

  // Toggle User Status Archive/Reactivate
  const handleToggleUserStatus = async (userProf: UserProfile) => {
    const isArchiving = userProf.status === 'ACTIVE';
    const newStatus = isArchiving ? 'INACTIVE' : 'ACTIVE';
    
    // Add confirmation warning
    const confirmMessage = isArchiving 
      ? `Tem certeza que deseja ARQUIVAR o colaborador ${userProf.managerName}? Ele perderá acesso ao sistema imediatamente.`
      : `Deseja REATIVAR o colaborador ${userProf.managerName}? Ele voltará a ter acesso ao sistema.`;

    if (!window.confirm(confirmMessage)) return;

    const updatedUser = {
      ...userProf,
      status: newStatus as 'ACTIVE' | 'INACTIVE'
    };

    try {
      await storage.saveUserProfile(updatedUser);

      // Log activity
      const audit: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        actorId: currentUserProfile?.id || 'unknown',
        actorName: currentUserProfile?.managerName || 'Administrador',
        targetUserId: userProf.id,
        targetUserName: userProf.managerName,
        action: isArchiving ? 'Arquivamento de Usuário' : 'Reativação de Usuário',
        details: isArchiving ? 'Usuário inativado na plataforma.' : 'Usuário reativado na plataforma.',
        timestamp: new Date().toISOString()
      };

      await storage.saveActivityLog(audit);
      toast.success(isArchiving ? 'Colaborador arquivado!' : 'Colaborador reativado!');
    } catch (err) {
      toast.error('Erro ao atualizar status do colaborador.');
    }
  };

  // Delete User permanently (with confirmation)
  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`ATENÇÃO: Deseja REALMENTE excluir permanentemente o cadastro de ${name}? Esta ação não pode ser desfeita e removerá todo o histórico desse usuário.`)) return;

    try {
      await storage.deleteUserProfile(id);

      // Audit Log
      const audit: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        actorId: currentUserProfile?.id || 'unknown',
        actorName: currentUserProfile?.managerName || 'Administrador',
        targetUserId: id,
        targetUserName: name,
        action: 'Exclusão de Usuário',
        details: 'Usuário deletado permanentemente do banco de dados.',
        timestamp: new Date().toISOString()
      };

      await storage.saveActivityLog(audit);
      toast.success('Colaborador excluído permanentemente!');
    } catch (err) {
      toast.error('Erro ao excluir colaborador.');
    }
  };

  // Handle Role Save / Create
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name) {
      toast.error('Informe o nome do cargo');
      return;
    }

    const isNew = !roleForm.id;
    const finalRoleId = roleForm.id || 'role_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const roleToSave: UserRole = {
      id: finalRoleId,
      name: roleForm.name,
      permissions: roleForm.permissions || {},
      createdAt: roleForm.createdAt || new Date().toISOString(),
      ownerId: roleForm.ownerId || currentUserProfile?.id || 'admin'
    };

    try {
      await storage.saveRole(roleToSave);

      // Log activity
      const audit: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        actorId: currentUserProfile?.id || 'unknown',
        actorName: currentUserProfile?.managerName || 'Administrador',
        targetUserId: roleToSave.id,
        targetUserName: roleToSave.name,
        action: isNew ? 'Criação de Cargo' : 'Alteração de Cargo',
        details: `Cargo ${roleToSave.name} salvo com matriz de permissões atualizada.`,
        timestamp: new Date().toISOString()
      };

      await storage.saveActivityLog(audit);

      toast.success(isNew ? 'Cargo criado com sucesso!' : 'Cargo atualizado com sucesso!');
      setEditingRole(null);
      setIsAddingRole(false);
    } catch (err) {
      toast.error('Erro ao salvar cargo.');
    }
  };

  // Delete Cargo/Role (with confirmation)
  const handleDeleteRole = async (id: string, name: string) => {
    // Check if any user holds this role name
    const countUsers = users.filter(u => u.roleName === name).length;
    if (countUsers > 0) {
      toast.error(`Não é possível excluir o cargo "${name}", pois existem ${countUsers} colaboradores associados a ele. Altere o cargo dos colaboradores primeiro.`);
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir o cargo "${name}"?`)) return;

    try {
      await storage.deleteRole(id);

      // Audit Log
      const audit: ActivityLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        actorId: currentUserProfile?.id || 'unknown',
        actorName: currentUserProfile?.managerName || 'Administrador',
        targetUserId: id,
        targetUserName: name,
        action: 'Exclusão de Cargo',
        details: `Cargo "${name}" removido do sistema.`,
        timestamp: new Date().toISOString()
      };

      await storage.saveActivityLog(audit);
      toast.success('Cargo excluído com sucesso!');
    } catch (err) {
      toast.error('Erro ao excluir cargo.');
    }
  };

  // Helper to toggle a specific action permission for a user (override) or role
  const handleTogglePermission = (
    type: 'user' | 'role',
    moduleKey: string,
    actionKey: string,
    currentValue: boolean | undefined
  ) => {
    const newValue = !currentValue;

    if (type === 'user') {
      const currentOverrides = { ...(userForm.customPermissions || {}) };
      if (!currentOverrides[moduleKey]) {
        currentOverrides[moduleKey] = { view: false };
      }
      currentOverrides[moduleKey] = {
        ...currentOverrides[moduleKey],
        [actionKey]: newValue
      };

      setUserForm({
        ...userForm,
        customPermissions: currentOverrides
      });
    } else {
      const currentPermissions = { ...(roleForm.permissions || {}) };
      if (!currentPermissions[moduleKey]) {
        currentPermissions[moduleKey] = { view: false };
      }
      currentPermissions[moduleKey] = {
        ...currentPermissions[moduleKey],
        [actionKey]: newValue
      };

      setRoleForm({
        ...roleForm,
        permissions: currentPermissions
      });
    }
  };

  // Clear specific user custom permission override
  const handleClearUserOverride = (moduleKey: string, actionKey: string) => {
    const currentOverrides = { ...(userForm.customPermissions || {}) };
    if (currentOverrides[moduleKey]) {
      const updatedModule = { ...currentOverrides[moduleKey] };
      delete updatedModule[actionKey as keyof ModulePermissions];

      if (Object.keys(updatedModule).length === 0) {
        delete currentOverrides[moduleKey];
      } else {
        currentOverrides[moduleKey] = updatedModule as ModulePermissions;
      }

      setUserForm({
        ...userForm,
        customPermissions: currentOverrides
      });
    }
  };

  // Helper to resolve effective user permissions in the preview
  const getEffectivePermissionText = (uProf: Partial<UserProfile>, moduleKey: string, actionKey: string): { active: boolean, source: 'role' | 'override' | 'default' } => {
    // 1. Overrides
    if (uProf.customPermissions?.[moduleKey]?.[actionKey as keyof ModulePermissions] !== undefined) {
      return { 
        active: !!uProf.customPermissions[moduleKey][actionKey as keyof ModulePermissions], 
        source: 'override' 
      };
    }

    // 2. Role DB
    const dbRole = roles.find(r => r.name === uProf.roleName);
    if (dbRole?.permissions?.[moduleKey]?.[actionKey as keyof ModulePermissions] !== undefined) {
      return { 
        active: !!dbRole.permissions[moduleKey][actionKey as keyof ModulePermissions], 
        source: 'role' 
      };
    }

    // 3. Fallback
    const fallback = DEFAULT_ROLE_PERMISSIONS[uProf.roleName || '']?.[moduleKey]?.[actionKey as keyof ModulePermissions];
    return { 
      active: !!fallback, 
      source: 'default' 
    };
  };

  // Client scoping toggle
  const handleToggleClientScope = (clientId: string) => {
    const list = [...(userForm.restrictedClients || [])];
    const index = list.indexOf(clientId);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(clientId);
    }
    setUserForm({ ...userForm, restrictedClients: list });
  };

  // Process scoping toggle
  const handleToggleProcessScope = (processId: string) => {
    const list = [...(userForm.restrictedProcesses || [])];
    const index = list.indexOf(processId);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(processId);
    }
    setUserForm({ ...userForm, restrictedProcesses: list });
  };

  // Filtered Users List
  const filteredUsers = users.filter(u => {
    const matchSearch = u.managerName.toLowerCase().includes(userSearch.toLowerCase()) || 
                        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                        (u.team || '').toLowerCase().includes(userSearch.toLowerCase());
    const matchStatus = userStatusFilter === 'ALL' || u.status === userStatusFilter;
    const matchRole = userRoleFilter === 'ALL' || u.roleName === userRoleFilter;

    return matchSearch && matchStatus && matchRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-mint" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight flex items-center gap-3">
            <Shield className="text-accent-mint" size={28} />
            Usuários e Permissões
          </h1>
          <p className="text-text-muted mt-1">Gerencie colaboradores, equipes, cargos e níveis de acesso (RBAC)</p>
        </div>
        
        <div className="flex items-center gap-2">
          {activeTab === 'colaboradores' && (
            <button 
              id="btn-add-colab"
              onClick={() => setIsAddingUser(true)}
              className="bg-accent-mint text-black font-semibold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-accent-mint/90 transition-all shadow-md shadow-accent-mint/10"
            >
              <UserPlus size={16} />
              Criar Colaborador
            </button>
          )}
          {activeTab === 'cargos' && (
            <button 
              id="btn-add-role"
              onClick={() => setIsAddingRole(true)}
              className="bg-accent-mint text-black font-semibold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-accent-mint/90 transition-all shadow-md shadow-accent-mint/10"
            >
              <Plus size={16} />
              Criar Cargo Personalizado
            </button>
          )}
        </div>
      </div>

      {/* STATS STRIP */}
      {activeTab === 'colaboradores' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass rounded-2xl p-5 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Total de Colaboradores</p>
              <h3 className="text-2xl font-bold mt-1 text-white">{users.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary">
              <UsersIcon size={20} />
            </div>
          </div>
          <div className="glass rounded-2xl p-5 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Usuários Ativos</p>
              <h3 className="text-2xl font-bold mt-1 text-green-400">{users.filter(u => u.status === 'ACTIVE').length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
              <Check size={20} />
            </div>
          </div>
          <div className="glass rounded-2xl p-5 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Usuários Arquivados</p>
              <h3 className="text-2xl font-bold mt-1 text-red-400">{users.filter(u => u.status === 'INACTIVE').length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Archive size={18} />
            </div>
          </div>
          <div className="glass rounded-2xl p-5 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Cargos Personalizados</p>
              <h3 className="text-2xl font-bold mt-1 text-accent-mint">{roles.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent-mint/10 flex items-center justify-center text-accent-mint">
              <Shield size={18} />
            </div>
          </div>
        </div>
      )}

      {/* TABS SELECTOR */}
      <div className="flex border-b border-white/10 gap-6">
        <button 
          id="tab-colaboradores"
          onClick={() => setActiveTab('colaboradores')}
          className={`pb-4 text-sm font-medium relative transition-all ${activeTab === 'colaboradores' ? 'text-accent-mint font-semibold' : 'text-text-muted hover:text-white'}`}
        >
          Colaboradores ({users.length})
          {activeTab === 'colaboradores' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-mint rounded-full" />}
        </button>
        <button 
          id="tab-cargos"
          onClick={() => setActiveTab('cargos')}
          className={`pb-4 text-sm font-medium relative transition-all ${activeTab === 'cargos' ? 'text-accent-mint font-semibold' : 'text-text-muted hover:text-white'}`}
        >
          Cargos e Níveis de Acesso
          {activeTab === 'cargos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-mint rounded-full" />}
        </button>
        <button 
          id="tab-auditoria"
          onClick={() => setActiveTab('auditoria')}
          className={`pb-4 text-sm font-medium relative transition-all ${activeTab === 'auditoria' ? 'text-accent-mint font-semibold' : 'text-text-muted hover:text-white'}`}
        >
          <span className="flex items-center gap-1.5">
            <Activity size={14} /> Auditoria de Permissões
          </span>
          {activeTab === 'auditoria' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-mint rounded-full" />}
        </button>
      </div>

      {/* MAIN CONTAINER */}
      <div>
        {/* TAB 1: USERS LIST */}
        {activeTab === 'colaboradores' && (
          <div className="space-y-6">
            {/* BANNER: CÓDIGO DE ACESSO DA EMPRESA */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-accent-mint/15 via-white/5 to-white/5 border border-accent-mint/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-accent-mint/5">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-accent-mint/20 border border-accent-mint/40 flex items-center justify-center text-accent-mint shrink-0">
                  <Key size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Código de Acesso da Equipe:</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-black/60 border border-accent-mint/40 text-accent-mint font-mono font-bold tracking-widest text-sm">
                      {currentUserProfile?.companyAccessCode || 'EMP-2026'}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Compartilhe este código com novos colaboradores para que eles se cadastrem na aba "Sou Colaborador".
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const code = currentUserProfile?.companyAccessCode || 'EMP-2026';
                    navigator.clipboard.writeText(code);
                    toast.success(`Código ${code} copiado com sucesso!`);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy size={13} />
                  Copiar Código
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const code = currentUserProfile?.companyAccessCode || 'EMP-2026';
                    const companyName = currentUserProfile?.agencyName || 'MKT';
                    const invite = `Olá! Para acessar o espaço da nossa empresa "${companyName}" no MKT, entre na tela de login, selecione a aba "Sou Colaborador" e use o nosso Código de Acesso:\n\n*${code}*\n\nSeja bem-vindo(a) à equipe!`;
                    navigator.clipboard.writeText(invite);
                    toast.success('Convite completo copiado! Envie no WhatsApp do colaborador.');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-accent-mint text-black font-bold text-xs flex items-center gap-1.5 hover:bg-accent-mint/90 transition-all shadow-md shadow-accent-mint/20 cursor-pointer"
                >
                  <Share2 size={13} />
                  Copiar Convite
                </button>
              </div>
            </div>

            {/* Search and Filters bar */}
            <div className="glass rounded-2xl p-4 border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:max-w-md">
                <Search size={18} className="absolute left-4 top-3 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Buscar colaborador, equipe ou e-mail..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2.5 text-sm outline-none focus:border-accent-mint/40 transition-all placeholder-text-muted"
                />
              </div>

              <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                  <Filter size={14} className="text-text-muted" />
                  <span className="text-xs text-text-muted">Status:</span>
                  <select 
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value as any)}
                    className="bg-transparent text-xs text-white outline-none border-none cursor-pointer pr-4"
                  >
                    <option value="ALL" className="bg-black text-white">Todos</option>
                    <option value="ACTIVE" className="bg-black text-green-400">Ativos</option>
                    <option value="INACTIVE" className="bg-black text-red-400">Arquivados</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                  <span className="text-xs text-text-muted">Cargo:</span>
                  <select 
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="bg-transparent text-xs text-white outline-none border-none cursor-pointer pr-4"
                  >
                    <option value="ALL" className="bg-black text-white">Todos</option>
                    {Object.keys(DEFAULT_ROLE_PERMISSIONS).map(rName => (
                      <option key={rName} value={rName} className="bg-black text-white">{rName}</option>
                    ))}
                    {roles.map(r => (
                      <option key={r.id} value={r.name} className="bg-black text-white">{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/5 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      <th className="px-6 py-4">Colaborador</th>
                      <th className="px-6 py-4">Cargo / Equipe</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Acesso / Criação</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-sm text-text-muted">
                          Nenhum colaborador encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors text-sm">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-accent-mint flex items-center justify-center text-black font-bold overflow-hidden">
                                {u.photoUrl ? (
                                  <img src={u.photoUrl} alt={u.managerName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                ) : (
                                  (u.firstName || u.managerName || '?').charAt(0)
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-white">{u.managerName}</p>
                                <p className="text-xs text-text-muted">{u.email}</p>
                                {u.phone && <p className="text-[10px] text-text-muted mt-0.5">{u.phone}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <span className="inline-block bg-accent-mint/10 text-accent-mint font-medium text-xs px-2.5 py-0.5 rounded-full border border-accent-mint/15">
                                {u.roleName}
                              </span>
                              <p className="text-xs text-text-muted mt-1">{u.team || 'Não definido'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {u.status === 'ACTIVE' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-green-400 font-medium">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-red-400 font-medium bg-red-400/5 px-2 py-0.5 rounded-md border border-red-500/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Arquivado
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <p className="text-white">
                              <span className="text-text-muted">Acesso:</span>{' '}
                              {u.lastAccess ? new Date(u.lastAccess).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                            </p>
                            <p className="text-text-muted mt-1">
                              Criação: {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => setEditingUser(u)}
                                className="p-2 text-text-muted hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                                title="Editar Colaborador / Permissões"
                              >
                                <Edit size={16} />
                              </button>
                              
                              <button 
                                onClick={() => handleToggleUserStatus(u)}
                                className={`p-2 rounded-lg transition-all ${
                                  u.status === 'ACTIVE' 
                                    ? 'text-yellow-400/80 hover:text-yellow-400 bg-yellow-400/5 hover:bg-yellow-400/15' 
                                    : 'text-green-400/80 hover:text-green-400 bg-green-400/5 hover:bg-green-400/15'
                                }`}
                                title={u.status === 'ACTIVE' ? 'Arquivar Colaborador' : 'Reativar Colaborador'}
                              >
                                {u.status === 'ACTIVE' ? <Archive size={16} /> : <Check size={16} />}
                              </button>

                              <button 
                                onClick={() => handleDeleteUser(u.id, u.managerName)}
                                className="p-2 text-red-400/80 hover:text-red-400 bg-red-500/5 hover:bg-red-500/15 rounded-lg transition-all"
                                title="Excluir Permanentemente"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ROLES AND MATRICES */}
        {activeTab === 'cargos' && (
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6 border border-white/5 space-y-4">
              <h2 className="text-xl font-medium flex items-center gap-2">
                <Shield className="text-accent-mint" size={20} />
                Níveis de Acesso por Cargo
              </h2>
              <p className="text-sm text-text-muted leading-relaxed">
                Aqui você visualiza e define as permissões que são herdadas automaticamente por todos os colaboradores que ocupam cada cargo. 
                Selecione um cargo para editar sua matriz de permissões ou crie um cargo customizado para atender às necessidades da sua agência.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Sidebar list of roles */}
              <div className="glass rounded-2xl p-4 border border-white/5 space-y-3 h-fit">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider px-2">Cargos do Sistema</p>
                <div className="space-y-1">
                  {/* Default/Hardcoded Roles */}
                  {Object.keys(DEFAULT_ROLE_PERMISSIONS).map((rName) => (
                    <button
                      key={rName}
                      onClick={() => {
                        // Check if we already have it in custom roles in DB
                        const inDb = roles.find(r => r.name === rName);
                        if (inDb) {
                          setEditingRole(inDb);
                        } else {
                          // Create a transient structure
                          setEditingRole({
                            id: 'default_' + rName,
                            name: rName,
                            permissions: DEFAULT_ROLE_PERMISSIONS[rName],
                            createdAt: ''
                          });
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all ${
                        editingRole?.name === rName 
                          ? 'bg-accent-mint/10 text-accent-mint border border-accent-mint/15' 
                          : 'text-text-secondary hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <span>{rName}</span>
                      <span className="text-[9px] uppercase tracking-wide bg-white/5 px-2 py-0.5 rounded text-text-muted">Padrão</span>
                    </button>
                  ))}

                  {/* Custom Roles */}
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setEditingRole(role)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all ${
                        editingRole?.id === role.id 
                          ? 'bg-accent-mint/10 text-accent-mint border border-accent-mint/15' 
                          : 'text-text-secondary hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <span className="truncate">{role.name}</span>
                      <span className="text-[9px] uppercase tracking-wide bg-accent-mint/10 px-2 py-0.5 rounded text-accent-mint">Personalizado</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Matrix of selected role */}
              <div className="md:col-span-3">
                {editingRole ? (
                  <form onSubmit={handleSaveRole} className="glass rounded-2xl p-6 md:p-8 border border-white/5 space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-white/10 gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs uppercase tracking-widest text-accent-mint font-bold">Matriz de Permissões</span>
                          {editingRole.id.startsWith('default_') && (
                            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-text-muted">Cargo Protegido</span>
                          )}
                        </div>
                        <h3 className="text-2xl font-medium mt-1 text-white">{editingRole.name}</h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {editingRole.id.startsWith('default_') ? (
                          <button
                            type="button"
                            onClick={() => {
                              // Duplicate default role as customizable role
                              setEditingRole({
                                id: '',
                                name: `${editingRole.name} Customizado`,
                                permissions: editingRole.permissions,
                                createdAt: new Date().toISOString()
                              });
                              setIsAddingRole(true);
                              toast.info('Modifique o nome do cargo e salve para torná-lo customizado!');
                            }}
                            className="bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs px-4 py-2 rounded-xl transition-all font-semibold"
                          >
                            Duplicar para Editar
                          </button>
                        ) : (
                          <>
                            <button
                              type="submit"
                              className="bg-accent-mint text-black hover:bg-accent-mint/90 text-xs px-4 py-2 rounded-xl transition-all font-bold shadow-md shadow-accent-mint/10"
                            >
                              Salvar Alterações
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(editingRole.id, editingRole.name)}
                              className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs px-4 py-2 rounded-xl transition-all font-semibold"
                            >
                              Excluir Cargo
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Role edit fields (if custom) */}
                    {!editingRole.id.startsWith('default_') && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Nome do Cargo Personalizado</label>
                        <input
                          type="text"
                          value={editingRole.name}
                          onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                          className="max-w-md w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none transition-all"
                          placeholder="Ex: Gestor de Tráfego Jr"
                        />
                      </div>
                    )}

                    {/* Permission table inside matrix */}
                    <div className="space-y-4">
                      <p className="text-xs text-text-muted">Abaixo estão os módulos da plataforma e as ações liberadas para este cargo.</p>

                      <div className="border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                        {MODULES_METADATA.map((mod) => {
                          const modPerms = editingRole.permissions[mod.key] || { view: false };

                          return (
                            <div key={mod.key} className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 hover:bg-white/[0.01] transition-colors">
                              <div>
                                <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
                                  {mod.label}
                                </h4>
                                <p className="text-xs text-text-muted mt-1 leading-relaxed">{mod.desc}</p>
                              </div>

                              <div className="md:col-span-2 flex flex-wrap gap-4 items-center">
                                {mod.actions.map((act) => {
                                  const isActive = !!modPerms[act as keyof ModulePermissions];

                                  return (
                                    <button
                                      type="button"
                                      disabled={editingRole.id.startsWith('default_')}
                                      onClick={() => handleTogglePermission('role', mod.key, act, isActive)}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                                        isActive
                                          ? 'bg-accent-mint/10 border-accent-mint/30 text-accent-mint'
                                          : 'bg-white/5 border-white/10 text-text-muted opacity-60 hover:opacity-100 disabled:opacity-40'
                                      }`}
                                    >
                                      {isActive ? <Check size={12} /> : <X size={12} />}
                                      {ACTION_LABELS[act] || act}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="glass rounded-2xl p-12 border border-white/5 text-center text-text-muted">
                    <Shield size={40} className="mx-auto text-white/10 mb-4" />
                    <p className="text-sm">Selecione um cargo na lista lateral para visualizar e personalizar suas permissões.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT HISTORY */}
        {activeTab === 'auditoria' && (
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6 border border-white/5">
              <h3 className="text-lg font-medium">Histórico de Alterações e Auditoria</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Log completo de atividades de segurança do sistema. Qualquer criação de colaboradores, inativações ou alteração pontual de privilégios e permissões é rastreada e auditada automaticamente.
              </p>
            </div>

            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/5 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      <th className="px-6 py-4">Data & Hora</th>
                      <th className="px-6 py-4">Quem realizou</th>
                      <th className="px-6 py-4">Usuário / Cargo Alvo</th>
                      <th className="px-6 py-4">Ação</th>
                      <th className="px-6 py-4">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-sm text-text-muted">
                          Nenhum registro de auditoria gravado até o momento.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-6 py-4 text-white font-mono">
                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-white">{log.actorName}</span>
                            <p className="text-[10px] text-text-muted font-mono">{log.actorId}</p>
                          </td>
                          <td className="px-6 py-4">
                            {log.targetUserName ? (
                              <>
                                <span className="font-medium text-white">{log.targetUserName}</span>
                                <p className="text-[10px] text-text-muted font-mono">{log.targetUserId}</p>
                              </>
                            ) : (
                              <span className="text-text-muted">Geral / Vários</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-block bg-white/5 px-2 py-1 rounded text-[10px] font-medium border border-white/10 uppercase tracking-wide">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-text-secondary leading-relaxed max-w-md">
                            {log.details}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT ROLE */}
      <AnimatePresence>
        {isAddingRole && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsAddingRole(false)}
                className="absolute right-4 top-4 text-text-muted hover:text-white"
              >
                <X size={20} />
              </button>

              <div>
                <h3 className="text-xl font-medium">Novo Cargo Personalizado</h3>
                <p className="text-xs text-text-muted mt-1">Crie um nível de acesso exclusivo com nomenclatura própria</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Nome do Cargo</label>
                  <input
                    type="text"
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none transition-all placeholder-text-muted text-white"
                    placeholder="Ex: Designer Sênior"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingRole(false)}
                  className="bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs font-semibold px-6 py-3 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveRole}
                  className="bg-accent-mint text-black hover:bg-accent-mint/90 text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-accent-mint/10"
                >
                  Criar Cargo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD / EDIT COLABORADOR (USER) */}
      <AnimatePresence>
        {(isAddingUser || editingUser) && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-zinc-950 border border-white/10 rounded-3xl p-6 md:p-8 max-w-4xl w-full space-y-8 shadow-2xl relative my-8"
            >
              <button 
                id="btn-close-colab-modal"
                onClick={() => {
                  setIsAddingUser(false);
                  setEditingUser(null);
                }}
                className="absolute right-6 top-6 text-text-muted hover:text-white"
              >
                <X size={20} />
              </button>

              <div>
                <h3 className="text-2xl font-medium flex items-center gap-2">
                  <UserPlus className="text-accent-mint" size={24} />
                  {editingUser ? 'Editar Colaborador' : 'Cadastrar Colaborador'}
                </h3>
                <p className="text-sm text-text-muted mt-1">Configure o perfil de acesso, equipe e restrições específicas do usuário.</p>
              </div>

              <form onSubmit={handleSaveUser} className="space-y-8 divide-y divide-white/10">
                {/* 1. Basic Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Nome <span className="text-red-500">*</span></label>
                    <input
                      name="colab-firstName"
                      type="text"
                      required
                      value={userForm.firstName}
                      onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none transition-all placeholder-text-muted text-white"
                      placeholder="Ex: João"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Sobrenome <span className="text-red-500">*</span></label>
                    <input
                      name="colab-lastName"
                      type="text"
                      required
                      value={userForm.lastName}
                      onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none transition-all placeholder-text-muted text-white"
                      placeholder="Ex: Silva"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">E-mail Corporativo / Google <span className="text-red-500">*</span></label>
                    <input
                      name="colab-email"
                      type="email"
                      required
                      disabled={!!editingUser}
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none transition-all placeholder-text-muted disabled:opacity-50 text-white"
                      placeholder="Ex: joao@mkt.com.br"
                    />
                    <p className="text-[10px] text-text-muted">Acesso autenticado via Google Sign-In com esse e-mail.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Telefone / WhatsApp</label>
                    <input
                      name="colab-phone"
                      type="text"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none transition-all placeholder-text-muted text-white"
                      placeholder="Ex: (11) 99999-9999"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Cargo principal (Role)</label>
                    <select
                      value={userForm.roleName}
                      onChange={(e) => setUserForm({ ...userForm, roleName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none transition-all text-white [&>option]:bg-zinc-950"
                    >
                      {Object.keys(DEFAULT_ROLE_PERMISSIONS).map(rName => (
                        <option key={rName} value={rName}>{rName}</option>
                      ))}
                      {roles.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Equipe / Departamento</label>
                    <select
                      value={userForm.team}
                      onChange={(e) => setUserForm({ ...userForm, team: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none transition-all text-white [&>option]:bg-zinc-950"
                    >
                      {TEAM_OPTIONS.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Client & Process restrictions */}
                <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
                        Restringir Clientes
                      </h4>
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        Selecione clientes específicos que este colaborador tem permissão para visualizar. 
                        <strong> Se nenhum for selecionado, ele acessará TODOS os clientes.</strong>
                      </p>
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-white/5 rounded-2xl bg-white/5 divide-y divide-white/5">
                      {clients.map(c => {
                        const isChecked = userForm.restrictedClients?.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/5 text-xs text-text-secondary select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleClientScope(c.id)}
                              className="accent-accent-mint rounded"
                            />
                            {c.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
                        Restringir Processos
                      </h4>
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        Selecione quadros de processos/pipelines que este colaborador pode visualizar. 
                        <strong> Se nenhum for selecionado, ele acessará TODOS os quadros de processo.</strong>
                      </p>
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-white/5 rounded-2xl bg-white/5 divide-y divide-white/5">
                      {processes.map(p => {
                        const isChecked = userForm.restrictedProcesses?.includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/5 text-xs text-text-secondary select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleProcessScope(p.id)}
                              className="accent-accent-mint rounded"
                            />
                            {p.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Personalized Permissions Overrides */}
                <div className="pt-6 space-y-4">
                  <div>
                    <h4 className="font-semibold text-white flex items-center gap-2 text-sm">
                      <Lock size={16} className="text-accent-mint" />
                      Permissões Personalizadas (Sobrescritas)
                    </h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Adicione ou revogue privilégios específicos exclusivamente para este colaborador, sem precisar alterar a regra geral do cargo dele. 
                      Sobrescritas ativas aparecem em verde (concedida) ou vermelho (revogada). Clique no botão do cargo para herdar a configuração do cargo novamente.
                    </p>
                  </div>

                  <div className="border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5 max-h-[30rem] overflow-y-auto">
                    {MODULES_METADATA.map((mod) => {
                      return (
                        <div key={mod.key} className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 hover:bg-white/[0.01] transition-colors">
                          <div>
                            <h5 className="font-semibold text-white text-xs">{mod.label}</h5>
                            <p className="text-[10px] text-text-muted mt-0.5">{mod.desc}</p>
                          </div>

                          <div className="md:col-span-2 flex flex-wrap gap-2.5 items-center">
                            {mod.actions.map((act) => {
                              const eff = getEffectivePermissionText(userForm, mod.key, act);
                              
                              return (
                                <div key={act} className="flex items-center gap-1 bg-white/5 rounded-xl border border-white/10 px-2.5 py-1">
                                  <span className="text-[10px] text-text-secondary font-medium mr-1">{ACTION_LABELS[act]}</span>
                                  
                                  {eff.source === 'override' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePermission('user', mod.key, act, eff.active)}
                                      className={`text-[9px] px-2 py-0.5 rounded-md font-bold transition-all uppercase ${
                                        eff.active 
                                          ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                      }`}
                                      title="Clique para inverter sobrescrita"
                                    >
                                      {eff.active ? 'Forçar Sim' : 'Forçar Não'}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePermission('user', mod.key, act, eff.active)}
                                      className="text-[9px] bg-white/5 text-text-muted px-2 py-0.5 rounded-md border border-white/5 hover:border-white/10 text-left"
                                      title="Clique para criar uma sobrescrita para este usuário"
                                    >
                                      Cargo: {eff.active ? 'Sim' : 'Não'}
                                    </button>
                                  )}

                                  {eff.source === 'override' && (
                                    <button
                                      type="button"
                                      onClick={() => handleClearUserOverride(mod.key, act)}
                                      className="text-text-muted hover:text-white ml-0.5"
                                      title="Herda valor padrão do cargo"
                                    >
                                      <X size={10} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submit buttons */}
                <div className="flex justify-end gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingUser(false);
                      setEditingUser(null);
                    }}
                    className="bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs font-semibold px-6 py-3 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-save-colab"
                    type="submit"
                    className="bg-accent-mint text-black hover:bg-accent-mint/90 text-xs font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-accent-mint/10"
                  >
                    Salvar Colaborador
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

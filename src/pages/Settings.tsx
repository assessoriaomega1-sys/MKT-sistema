import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, User, Shield, Bell, Palette, Globe, Building2, Briefcase, Phone, DollarSign, Key, Copy, Check, RefreshCw, Share2 } from 'lucide-react';
import { storage } from '../lib/storage';
import { UserSettings } from '../types';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const BUSINESS_SECTORS = [
  'E-commerce & Varejo',
  'Prestador de Serviços',
  'Negócio Local (Clínicas, Lojas, Restaurantes)',
  'Infoproduto, Cursos & Lançamentos',
  'B2B / Vendas Corporativas',
  'Imobiliário / Corretores',
  'Agência & Assessoria de Marketing',
  'Produção de Conteúdo & Audiovisual',
  'Saúde, Beleza & Estética',
  'Outro Segmento'
];

export function Settings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, profile, updateCompanySettings, updateCompanyAccessCode, isAdmin } = useAuth();
  const { theme, setTheme, accentColorId, setAccentColor, presets } = useTheme();
  
  // Access code management state
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [newCodeInput, setNewCodeInput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [savingCode, setSavingCode] = useState(false);

  useEffect(() => {
    storage.getSettings().then(data => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const agencyName = (formData.get('agencyName') as string)?.trim() || 'MKT';
    const managerName = (formData.get('managerName') as string)?.trim() || 'Empresário';
    const companyRole = (formData.get('companyRole') as string)?.trim() || 'Empresário / Dono';
    const businessSector = formData.get('businessSector') as string;
    const companyPhone = (formData.get('companyPhone') as string)?.trim() || '';
    const monthlyGoalRaw = formData.get('monthlyGoal') as string;
    const monthlyGoal = monthlyGoalRaw ? parseFloat(monthlyGoalRaw.replace(/[^\d.,]/g, '').replace(',', '.')) || 0 : undefined;
    const trafficPanelUrl = formData.get('trafficPanelUrl') as string;

    const newSettings: UserSettings = {
      agencyName,
      managerName,
      companyRole,
      businessSector,
      companyPhone,
      monthlyGoal,
      theme: settings?.theme || 'light',
      trafficPanelUrl
    };

    await storage.saveSettings(newSettings);
    await updateCompanySettings({
      agencyName,
      managerName,
      companyRole,
      businessSector,
      companyPhone,
      monthlyGoal,
      companySetupCompleted: true
    });

    setSettings(newSettings);
    toast.success('Configurações da empresa salvas com sucesso!');
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    if (settings) {
      const newSettings: UserSettings = {
        ...settings,
        theme: newTheme
      };
      setSettings(newSettings);
      await storage.saveSettings(newSettings);
    }
    toast.success(`Tema alterado para ${newTheme === 'dark' ? 'Escuro' : 'Claro'}!`);
  };

  if (loading || !settings) return null;

  const currentAgency = profile?.agencyName || settings.agencyName || 'MKT';
  const currentRole = profile?.companyRole || settings.companyRole || (isAdmin ? 'Empresário / Dono' : 'Colaborador');
  const currentCode = profile?.companyAccessCode || settings.companyAccessCode || 'EMP-2026';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setIsCopied(true);
    toast.success(`Código ${currentCode} copiado para a área de transferência!`);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShareInvite = () => {
    const inviteText = `Olá! Para acessar o espaço da nossa empresa "${currentAgency}" no MKT, acesse o link do app, selecione a aba "Sou Colaborador" e use nosso Código de Acesso:\n\n*${currentCode}*\n\nSeja bem-vindo(a) à equipe!`;
    navigator.clipboard.writeText(inviteText);
    toast.success('Convite completo copiado! Envie no WhatsApp ou e-mail da sua equipe.');
  };

  const handleSaveNewCode = async () => {
    const clean = newCodeInput.trim().toUpperCase();
    if (!clean) {
      toast.error('Informe um código válido.');
      return;
    }
    setSavingCode(true);
    try {
      await updateCompanyAccessCode(clean);
      setIsEditingCode(false);
      toast.success(`Código de acesso da empresa atualizado para: ${clean}`);
    } catch (err) {
      toast.error('Erro ao atualizar código de acesso.');
    } finally {
      setSavingCode(false);
    }
  };

  const handleGenerateRandomCode = () => {
    const random = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
    setNewCodeInput(random);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Configurações da Empresa</h1>
        <p className="text-text-muted">Gerencie as informações do seu negócio, perfil e preferências do painel MKT</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-2">
          <SettingsNavButton icon={Building2} label="Dados da Empresa" active />
          <SettingsNavButton icon={Palette} label="Aparência" />
          <SettingsNavButton icon={Globe} label="Integrações & Tráfego" />
          <SettingsNavButton icon={Shield} label="Segurança & Backup" />
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="glass rounded-3xl p-8 border border-white/5 space-y-8">
             <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-accent-mint/15 border border-accent-mint/30 flex items-center justify-center text-accent-mint text-2xl font-bold overflow-hidden shadow-lg shadow-accent-mint/10">
                  {user?.photoURL ? <img src={user.photoURL} alt="User" /> : (user?.displayName || currentAgency || '?').charAt(0)}
                </div>
                <div>
                   <h3 className="text-lg font-bold text-white">{currentAgency}</h3>
                   <p className="text-xs text-accent-mint font-semibold uppercase tracking-wider">{currentRole}</p>
                   <p className="text-xs text-text-muted mt-1">{user?.email}</p>
                </div>
             </div>

             {/* CARD DESTAQUE: CÓDIGO DE ACESSO DA EMPRESA */}
             <div className="p-5 rounded-2xl bg-gradient-to-br from-accent-mint/10 via-white/5 to-white/5 border border-accent-mint/30 space-y-3">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-accent-mint/20 flex items-center justify-center text-accent-mint shrink-0">
                     <Key size={20} />
                   </div>
                   <div>
                     <h4 className="text-sm font-bold text-white flex items-center gap-2">
                       Código de Acesso da Equipe
                       <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-mint/20 text-accent-mint font-bold uppercase tracking-wider">
                         Dono cria
                       </span>
                     </h4>
                     <p className="text-xs text-text-muted">
                       Seus colaboradores usam este código na tela de login (aba "Sou Colaborador") para entrar no seu espaço
                     </p>
                   </div>
                 </div>

                 {/* Current Code Display & Actions */}
                 <div className="flex items-center gap-2">
                   <div className="px-3.5 py-1.5 rounded-xl bg-black/50 border border-accent-mint/40 text-accent-mint font-mono font-bold tracking-widest text-base shadow-inner">
                     {currentCode}
                   </div>

                   <button
                     type="button"
                     onClick={handleCopyCode}
                     title="Copiar código"
                     className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                   >
                     {isCopied ? <Check size={16} className="text-accent-mint" /> : <Copy size={16} />}
                     <span className="hidden sm:inline">{isCopied ? 'Copiado!' : 'Copiar'}</span>
                   </button>

                   <button
                     type="button"
                     onClick={handleShareInvite}
                     title="Compartilhar convite para a equipe"
                     className="p-2.5 rounded-xl bg-accent-mint text-black hover:bg-accent-mint/90 font-bold transition-all shadow-md shadow-accent-mint/20 cursor-pointer flex items-center gap-1.5 text-xs"
                   >
                     <Share2 size={15} />
                     <span className="hidden sm:inline">Convite</span>
                   </button>
                 </div>
               </div>

               {/* Edit Code Section for Owner */}
               {isAdmin && (
                 <div className="pt-2 border-t border-white/5">
                   {!isEditingCode ? (
                     <button
                       type="button"
                       onClick={() => {
                         setNewCodeInput(currentCode);
                         setIsEditingCode(true);
                       }}
                       className="text-xs text-accent-mint hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                     >
                       ✏️ Deseja alterar o código de acesso da empresa? Clique aqui
                     </button>
                   ) : (
                     <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                       <input
                         type="text"
                         value={newCodeInput}
                         onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
                         placeholder="Novo código (ex: ALFA2026)"
                         className="w-full sm:w-64 px-3 py-1.5 bg-black/60 border border-accent-mint/50 rounded-xl text-accent-mint font-mono font-bold text-sm tracking-wider outline-none"
                       />
                       <button
                         type="button"
                         onClick={handleGenerateRandomCode}
                         className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-text-secondary border border-white/10 flex items-center gap-1 cursor-pointer"
                       >
                         <RefreshCw size={12} /> Gerar Aleatório
                       </button>
                       <button
                         type="button"
                         disabled={savingCode}
                         onClick={handleSaveNewCode}
                         className="px-4 py-1.5 rounded-xl bg-accent-mint text-black font-bold text-xs hover:bg-accent-mint/90 cursor-pointer disabled:opacity-50"
                       >
                         {savingCode ? 'Salvando...' : 'Salvar Novo Código'}
                       </button>
                       <button
                         type="button"
                         onClick={() => setIsEditingCode(false)}
                         className="px-3 py-1.5 rounded-xl text-xs text-text-muted hover:text-white cursor-pointer"
                       >
                         Cancelar
                       </button>
                     </div>
                   )}
                 </div>
               )}
             </div>

             <form onSubmit={handleSave} className="space-y-6 pt-6 border-t border-white/5">
               {/* Nome da Empresa */}
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                   <Building2 size={13} className="text-accent-mint" />
                   Nome da Empresa / Negócio *
                 </label>
                 <input 
                   name="agencyName"
                   type="text" 
                   required
                   defaultValue={currentAgency}
                   placeholder="Ex: Minha Empresa, Agência Alpha..."
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 transition-all outline-none text-white" 
                 />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <User size={13} className="text-accent-mint" />
                      Seu Nome (Responsável)
                    </label>
                    <input 
                      name="managerName"
                      type="text" 
                      defaultValue={profile?.managerName || user?.displayName || settings.managerName || ''}
                      placeholder="Ex: Carlos Silva"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 transition-all outline-none text-white" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Briefcase size={13} className="text-accent-mint" />
                      Seu Cargo / Função
                    </label>
                    <input 
                      name="companyRole"
                      type="text" 
                      defaultValue={currentRole}
                      placeholder="Ex: Empresário / Dono, CEO, Diretor"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 transition-all outline-none text-white" 
                    />
                  </div>
               </div>

               {/* Segmento */}
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                   Segmento Principal da Empresa
                 </label>
                 <select
                   name="businessSector"
                   defaultValue={profile?.businessSector || settings.businessSector || BUSINESS_SECTORS[0]}
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 transition-all outline-none text-white"
                 >
                   {BUSINESS_SECTORS.map(sec => (
                     <option key={sec} value={sec} className="bg-bg-elevated text-white">
                       {sec}
                     </option>
                   ))}
                 </select>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Phone size={13} className="text-accent-mint" />
                      WhatsApp / Contato
                    </label>
                    <input 
                      name="companyPhone"
                      type="text" 
                      defaultValue={profile?.companyPhone || settings.companyPhone || ''}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 transition-all outline-none text-white" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <DollarSign size={13} className="text-accent-mint" />
                      Meta Mensal de Faturamento (R$)
                    </label>
                    <input 
                      name="monthlyGoal"
                      type="number" 
                      defaultValue={profile?.monthlyGoal || settings.monthlyGoal || ''}
                      placeholder="Ex: 50000"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 transition-all outline-none text-white" 
                    />
                  </div>
               </div>

               <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">URL do Workspace de Tráfego (iframe)</label>
                  <input 
                    name="trafficPanelUrl"
                    type="text" 
                    placeholder="Ex: https://lookerstudio.google.com/embed/..."
                    defaultValue={settings.trafficPanelUrl || ''}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 transition-all outline-none font-sans text-white" 
                  />
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Personalize o painel exibido na aba &quot;Workspace de Tráfego&quot; inserindo o link compartilhável (Looker Studio, Planilhas, Notion, etc.).
                  </p>
               </div>

               <div className="flex justify-end pt-4">
                  <button type="submit" className="bg-accent-mint text-black font-bold px-8 py-3 rounded-xl hover:bg-accent-mint/90 transition-all shadow-lg shadow-accent-mint/20 cursor-pointer">
                    Salvar Alterações
                  </button>
               </div>
             </form>
          </div>

          <div className="glass rounded-3xl p-8 border border-white/5 space-y-6">
             <div className="flex items-center justify-between">
               <div>
                 <h4 className="font-bold text-white text-base flex items-center gap-2">
                   <Palette size={18} className="text-accent-mint" />
                   Aparência & Cores do Sistema
                 </h4>
                 <p className="text-xs text-text-muted mt-0.5">
                   Escolha seu tema preferido e cor de destaque (também acessível a qualquer momento no topo da tela).
                 </p>
               </div>
             </div>

             {/* Dark vs Light */}
             <div className="space-y-2">
               <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                 Modo de Exibição
               </label>
               <div className="grid grid-cols-2 gap-4">
                  <div 
                    onClick={() => handleThemeChange('dark')}
                    className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center justify-center gap-3 ${
                      theme !== 'light'
                        ? "border-accent-mint bg-white/10 opacity-100 shadow-md shadow-accent-mint/10" 
                        : "border-transparent bg-white/5 hover:border-white/10 opacity-60"
                    }`}
                  >
                     <div className="w-4 h-4 rounded-full bg-zinc-950 border border-white/20" />
                     <p className="text-sm font-semibold text-center text-white">Dark Mode (Escuro)</p>
                  </div>
                  <div 
                    onClick={() => handleThemeChange('light')}
                    className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center justify-center gap-3 ${
                      theme === 'light'
                        ? "border-accent-mint bg-white/10 opacity-100 shadow-md shadow-accent-mint/10" 
                        : "border-transparent bg-white/5 hover:border-white/10 opacity-60"
                    }`}
                  >
                     <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-300" />
                     <p className="text-sm font-semibold text-center text-white">Light Mode (Claro)</p>
                  </div>
               </div>
             </div>

             {/* Accent Colors */}
             <div className="space-y-2 pt-2 border-t border-white/10">
               <div className="flex items-center justify-between">
                 <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                   Paleta de Cor de Destaque
                 </label>
                 <span className="text-[10px] text-accent-mint font-semibold">
                   {presets.find(p => p.id === accentColorId)?.name || 'Padrão'}
                 </span>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                 {presets.map(preset => {
                   const isSelected = preset.id === accentColorId;
                   const colorHex = theme === 'light' ? preset.hexLight : preset.hexDark;
                   return (
                     <button
                       key={preset.id}
                       type="button"
                       onClick={() => {
                         setAccentColor(preset.id);
                         toast.success(`Cor alterada para ${preset.name}!`);
                       }}
                       className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer ${
                         isSelected
                           ? 'bg-white/15 border-white/40 text-white font-bold shadow-sm'
                           : 'bg-white/5 border-white/5 text-text-secondary hover:text-white hover:bg-white/10'
                       }`}
                     >
                       <span
                         className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center shadow-inner"
                         style={{ backgroundColor: colorHex }}
                       >
                         {isSelected && <Check size={10} className="text-black stroke-[3]" />}
                       </span>
                       <span className="truncate">{preset.name}</span>
                     </button>
                   );
                 })}
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsNavButton({ icon: Icon, label, active = false }: any) {
  return (
    <button className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
      active ? "bg-white/10 text-white" : "text-text-muted hover:bg-white/5 hover:text-text-secondary"
    )}>
      <Icon size={18} />
      {label}
    </button>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}


import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, User, Briefcase, DollarSign, Phone, Check, X, Sparkles, Key, Copy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface CompanySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFirstSetup?: boolean;
}

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

export function CompanySetupModal({ isOpen, onClose, isFirstSetup = false }: CompanySetupModalProps) {
  const { profile, updateCompanySettings, updateCompanyAccessCode } = useAuth();

  const [agencyName, setAgencyName] = useState(profile?.agencyName || '');
  const [managerName, setManagerName] = useState(profile?.managerName || profile?.firstName || '');
  const [companyRole, setCompanyRole] = useState(profile?.companyRole || 'Empresário / Dono');
  const [businessSector, setBusinessSector] = useState(profile?.businessSector || BUSINESS_SECTORS[0]);
  const [companyPhone, setCompanyPhone] = useState(profile?.companyPhone || profile?.phone || '');
  const [monthlyGoal, setMonthlyGoal] = useState<string>(profile?.monthlyGoal ? String(profile?.monthlyGoal) : '');
  const [accessCode, setAccessCode] = useState(profile?.companyAccessCode || `EMP-${Math.floor(1000 + Math.random() * 9000)}`);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyName.trim()) {
      toast.error('Informe o nome da sua empresa.');
      return;
    }

    const cleanCode = accessCode.trim().toUpperCase();

    setLoading(true);
    try {
      await updateCompanySettings({
        agencyName: agencyName.trim(),
        managerName: managerName.trim() || 'Empresário',
        companyRole: companyRole.trim() || 'Empresário / Dono',
        companyAccessCode: cleanCode,
        businessSector,
        companyPhone: companyPhone.trim(),
        monthlyGoal: monthlyGoal ? parseFloat(monthlyGoal.replace(/[^\d.,]/g, '').replace(',', '.')) || 0 : undefined,
        companySetupCompleted: true
      });

      if (cleanCode) {
        await updateCompanyAccessCode(cleanCode);
      }

      toast.success('Informações da empresa salvas com sucesso!');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar informações da empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(accessCode);
    toast.success(`Código ${accessCode} copiado!`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-xl bg-bg-elevated border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent-mint/15 border border-accent-mint/30 flex items-center justify-center text-accent-mint shadow-[0_0_20px_rgba(4,221,114,0.15)]">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    {isFirstSetup ? 'Bem-vindo ao MKT' : 'Configurar Empresa'}
                  </h2>
                  {isFirstSetup && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-mint/20 text-accent-mint border border-accent-mint/30 uppercase tracking-widest">
                      <Sparkles size={10} /> Novo Espaço
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {isFirstSetup 
                    ? 'Personalize seu painel com os dados e métricas do seu negócio' 
                    : 'Atualize os dados e segmentação da sua empresa'}
                </p>
              </div>
            </div>

            {!isFirstSetup && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/5 transition-all"
              >
                <X size={20} />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome da Empresa */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                <Building2 size={13} className="text-accent-mint" />
                Nome da Empresa / Negócio *
              </label>
              <input
                type="text"
                required
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Ex: Minha Empresa, Agência Alpha, Loja Bella..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent-mint/60 transition-colors"
              />
            </div>

            {/* Grid: Nome do Gestor & Cargo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                  <User size={13} className="text-accent-mint" />
                  Seu Nome
                </label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent-mint/60 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                  <Briefcase size={13} className="text-accent-mint" />
                  Seu Cargo / Função
                </label>
                <input
                  type="text"
                  value={companyRole}
                  onChange={(e) => setCompanyRole(e.target.value)}
                  placeholder="Ex: Empresário / Dono, CEO, Diretor"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent-mint/60 transition-colors"
                />
              </div>
            </div>

            {/* Segmento da Empresa */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Segmento / Nicho Principal
              </label>
              <select
                value={businessSector}
                onChange={(e) => setBusinessSector(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent-mint/60 transition-colors"
              >
                {BUSINESS_SECTORS.map(sector => (
                  <option key={sector} value={sector} className="bg-bg-elevated text-white">
                    {sector}
                  </option>
                ))}
              </select>
            </div>

            {/* Grid: Telefone e Meta Mensal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                  <Phone size={13} className="text-accent-mint" />
                  WhatsApp / Contato
                </label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent-mint/60 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                  <DollarSign size={13} className="text-accent-mint" />
                  Meta de Faturamento (R$)
                </label>
                <input
                  type="number"
                  value={monthlyGoal}
                  onChange={(e) => setMonthlyGoal(e.target.value)}
                  placeholder="Ex: 50000"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent-mint/60 transition-colors"
                />
              </div>
            </div>

            {/* Código de Acesso da Equipe */}
            <div className="p-3.5 bg-accent-mint/5 border border-accent-mint/20 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-accent-mint uppercase tracking-wider flex items-center gap-2">
                  <Key size={13} />
                  Código de Acesso da Equipe (Criado pelo Dono)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="text-[11px] text-accent-mint hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    <Copy size={11} /> Código
                  </button>
                  <span className="text-white/20">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const inviteUrl = `${window.location.origin}/login?codigo=${accessCode.trim()}`;
                      navigator.clipboard.writeText(inviteUrl);
                      toast.success('Link de convite copiado! Seus colaboradores entrarão direto na sua empresa.');
                    }}
                    className="text-[11px] text-accent-mint hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    <Copy size={11} /> Copiar Link de Convite
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="Ex: EMP-8492"
                className="w-full px-4 py-2.5 bg-black/40 border border-accent-mint/30 rounded-xl text-accent-mint font-mono font-bold tracking-widest text-sm focus:outline-none focus:border-accent-mint transition-colors"
              />
              <p className="text-[11px] text-text-muted leading-relaxed">
                Compartilhe o código ou o link de convite com seus colaboradores. Eles entrarão diretamente vinculados ao espaço exclusivo da sua empresa.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
              {!isFirstSetup && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-text-secondary hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-accent-mint text-black font-bold rounded-xl text-sm hover:bg-accent-mint/90 transition-all shadow-lg shadow-accent-mint/20 cursor-pointer disabled:opacity-50"
              >
                <Check size={16} />
                {loading ? 'Salvando...' : 'Salvar e Começar'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

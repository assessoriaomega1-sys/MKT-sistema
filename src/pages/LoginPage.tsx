import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { VideoPlayer } from '../components/VideoPlayer';
import { Building2, Users, Lock, Key, Mail, Sparkles, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../lib/storage';

export function LoginPage() {
  const { user, signInWithGoogle, signInAsCompany, signInAsCollaborator } = useAuth();
  const navigate = useNavigate();

  // Tab State: 'empresa' | 'colaborador'
  const [activeTab, setActiveTab] = useState<'empresa' | 'colaborador'>('empresa');

  // Form States - Empresa
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAccessCode, setCompanyAccessCode] = useState(() => `EMP-${Math.floor(1000 + Math.random() * 9000)}`);

  // Form States - Colaborador
  const [colabCompanyName, setColabCompanyName] = useState('');
  const [colabEmail, setColabEmail] = useState('');
  const [colabAccessCode, setColabAccessCode] = useState('');

  // Loading State
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Generate new random code for owner
  const handleGenerateNewCode = () => {
    const randomCode = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
    setCompanyAccessCode(randomCode);
    toast.info(`Novo código gerado: ${randomCode}`);
  };

  // Helper error parser
  const handleAuthError = (error: any) => {
    console.error('Login error:', error);
    if (error.code === 'auth/unauthorized-domain') {
      toast.error(
        <div>
          <p className="font-bold">Domínio não autorizado no Firebase!</p>
          <p className="text-xs mt-1">Hostname detectado: <strong>{window.location.hostname}</strong></p>
          <p className="text-xs mt-1">Adicione este domínio em <em>Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</em>.</p>
        </div>,
        { duration: 8000 }
      );
    } else if (error.code === 'auth/popup-closed-by-user') {
      toast.info('Autenticação cancelada.');
    } else {
      toast.error(error.message || 'Ocorreu um erro ao realizar login.');
    }
  };

  // Handle Empresa submit
  const handleSubmitEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error('Informe o nome da sua empresa.');
      return;
    }
    const cleanCode = (companyAccessCode.trim() || `EMP-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();

    setIsSubmitting(true);
    try {
      await signInAsCompany(companyName.trim(), cleanCode, companyEmail.trim());
      toast.success(`Espaço da empresa "${companyName.trim()}" criado com sucesso! Código da equipe: ${cleanCode}`);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Colaborador submit
  const handleSubmitColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = colabAccessCode.trim().toUpperCase();
    if (!cleanCode) {
      toast.error('Digite o Código de Acesso da empresa fornecido pelo dono.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Verify access code existence
      const company = await storage.getCompanyByAccessCode(cleanCode);
      if (!company) {
        toast.error('Código de acesso inválido ou empresa não encontrada! Solicite o código correto ao dono da sua empresa.');
        setIsSubmitting(false);
        return;
      }

      toast.info(`Empresa localizada: "${company.companyName}". Conectando com Google...`);
      await signInAsCollaborator(cleanCode, company.companyName);
      toast.success(`Bem-vindo à equipe da ${company.companyName}!`);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Google Login (for returning users)
  const handleDirectGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      toast.success('Bem-vindo de volta ao MKT!');
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black py-10 px-4">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <VideoPlayer 
          src="https://stream.mux.com/9JXDljEVWYwWu01PUkAemafDugK89o01BR6zqJ3aS9u00A.m3u8"
          className="h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent to-black" />
      </div>

      {/* Content Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="glass p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl">
          
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-accent-mint/15 flex items-center justify-center mb-3 border border-accent-mint/30 shadow-[0_0_25px_rgba(4,221,114,0.25)]">
              <span className="text-2xl font-black text-accent-mint tracking-tight">MKT</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Gestão Empresarial & Equipe
            </h1>
            <p className="text-text-muted text-xs mt-1 max-w-sm">
              Selecione se você é a Empresa (Dono) ou Colaborador para acessar seu espaço
            </p>
          </div>

          {/* DUAL REGISTRATION TABS */}
          <div className="grid grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-2xl mb-6">
            <button
              id="tab-btn-empresa"
              type="button"
              onClick={() => setActiveTab('empresa')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'empresa'
                  ? 'bg-accent-mint text-black shadow-lg shadow-accent-mint/20 font-bold'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 size={16} />
              Sou Empresa
            </button>

            <button
              id="tab-btn-colaborador"
              type="button"
              onClick={() => setActiveTab('colaborador')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'colaborador'
                  ? 'bg-accent-mint text-black shadow-lg shadow-accent-mint/20 font-bold'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <Users size={16} />
              Sou Colaborador
            </button>
          </div>

          {/* FORM: SOU EMPRESA */}
          <AnimatePresence mode="wait">
            {activeTab === 'empresa' ? (
              <motion.form
                key="form-empresa"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmitEmpresa}
                className="space-y-4"
              >
                <div className="bg-accent-mint/10 border border-accent-mint/25 rounded-2xl p-3 text-xs text-accent-mint flex items-start gap-2.5">
                  <Sparkles size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Para Donos e Sócios:</span> Cadastre o nome da sua empresa, crie o código de acesso exclusivo e conecte-se com Google para gerenciar sua equipe.
                  </div>
                </div>

                {/* Nome da Empresa */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    <Building2 size={13} className="text-accent-mint" />
                    Nome da Empresa / Agência *
                  </label>
                  <input
                    id="input-company-name"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Minha Empresa, Agência Alfa, MKT Performance..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent-mint transition-colors"
                  />
                </div>

                {/* E-mail da Empresa / Dono */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    <Mail size={13} className="text-accent-mint" />
                    E-mail Corporativo ou do Dono
                  </label>
                  <input
                    id="input-company-email"
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="contato@suaempresa.com"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent-mint transition-colors"
                  />
                </div>

                {/* Código de Acesso da Equipe (Criado pelo Dono) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                      <Key size={13} className="text-accent-mint" />
                      Código de Acesso da Equipe *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateNewCode}
                      className="text-[10px] text-accent-mint hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={10} /> Gerar Aleatório
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="input-company-code"
                      type="text"
                      required
                      value={companyAccessCode}
                      onChange={(e) => setCompanyAccessCode(e.target.value.toUpperCase())}
                      placeholder="Ex: EMP-8492 ou ALFA2026"
                      className="w-full px-4 py-3 bg-white/5 border border-accent-mint/40 rounded-xl text-accent-mint font-mono font-bold tracking-widest text-sm focus:outline-none focus:border-accent-mint transition-colors"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    💡 <strong>O dono cria este código:</strong> seus colaboradores usarão este código na aba "Sou Colaborador" para entrar diretamente na sua empresa.
                  </p>
                </div>

                {/* Botão Entrar com Google */}
                <button
                  id="btn-login-empresa"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 mt-2 bg-accent-mint text-black font-bold rounded-xl hover:bg-accent-mint/90 transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-accent-mint/20 disabled:opacity-50"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                  <span>{isSubmitting ? 'Configurando empresa...' : 'Criar e Entrar com Google como Empresa'}</span>
                  <ArrowRight size={16} />
                </button>
              </motion.form>
            ) : (
              /* FORM: SOU COLABORADOR */
              <motion.form
                key="form-colaborador"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmitColaborador}
                className="space-y-4"
              >
                <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-3 text-xs text-blue-400 flex items-start gap-2.5">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Para Membros da Equipe:</span> Insira o Código de Acesso que o dono da sua empresa criou e compartilhou com você para ingressar na equipe.
                  </div>
                </div>

                {/* Nome da Empresa */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    <Building2 size={13} className="text-accent-mint" />
                    Nome da Empresa
                  </label>
                  <input
                    id="input-colab-company"
                    type="text"
                    value={colabCompanyName}
                    onChange={(e) => setColabCompanyName(e.target.value)}
                    placeholder="Ex: Agência Alfa, Empresa XYZ..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent-mint transition-colors"
                  />
                </div>

                {/* E-mail do Colaborador */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    <Mail size={13} className="text-accent-mint" />
                    Seu E-mail
                  </label>
                  <input
                    id="input-colab-email"
                    type="email"
                    value={colabEmail}
                    onChange={(e) => setColabEmail(e.target.value)}
                    placeholder="seu.email@gmail.com"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none focus:border-accent-mint transition-colors"
                  />
                </div>

                {/* Código de Acesso da Empresa */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    <Lock size={13} className="text-accent-mint" />
                    Código de Acesso da Empresa (Criado pelo Dono) *
                  </label>
                  <input
                    id="input-colab-code"
                    type="text"
                    required
                    value={colabAccessCode}
                    onChange={(e) => setColabAccessCode(e.target.value.toUpperCase())}
                    placeholder="Ex: EMP-8492 ou código da sua empresa"
                    className="w-full px-4 py-3 bg-white/5 border border-accent-mint/50 rounded-xl text-accent-mint font-mono font-bold tracking-widest text-sm focus:outline-none focus:border-accent-mint transition-colors placeholder:text-text-muted/60"
                  />
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    🔑 <strong>Onde conseguir:</strong> Solicite este código ao dono ou gestor da sua empresa. O sistema validará se a empresa existe antes de liberar seu acesso.
                  </p>
                </div>

                {/* Botão Entrar com Google */}
                <button
                  id="btn-login-colaborador"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 mt-2 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                  <span>{isSubmitting ? 'Validando código...' : 'Validar Código e Entrar com Google'}</span>
                  <ArrowRight size={16} />
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Quick direct sign-in for existing users */}
          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <button
              id="btn-direct-login"
              type="button"
              onClick={handleDirectGoogleLogin}
              disabled={isSubmitting}
              className="text-xs text-text-muted hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              Já possui conta configurada? <span className="text-accent-mint underline font-semibold">Entrar diretamente com Google</span>
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-text-muted text-[11px]">
            <Lock size={12} />
            <span>Dados isolados e seguros por empresa</span>
          </div>
        </div>
      </motion.div>

      {/* Footer copyright */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-text-muted text-[10px] uppercase tracking-widest text-center">
        MKT Gestor © 2026 • Gestão Multi-Empresa & Equipes
      </div>
    </div>
  );
}

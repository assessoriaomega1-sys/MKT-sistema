import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Target, 
  ShoppingCart, 
  TrendingUp, 
  Plus, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  AlertCircle, 
  BarChart3, 
  Users, 
  Search, 
  X,
  TrendingDown,
  Clock,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { storage } from '../lib/storage';
import { Sale, CommercialGoal, Client, BillingModel } from '../types';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Commercial() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [goals, setGoals] = useState<CommercialGoal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  
  // Modals
  const [showAddSale, setShowAddSale] = useState(false);
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [billingFilter, setBillingFilter] = useState<'ALL' | 'RECURRING' | 'ONE_OFF'>('ALL');

  // Month navigation
  const nextMonth = () => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const prevMonth = () => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  
  const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthDisplay = selectedMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // Real-time synchronization
  useEffect(() => {
    let unsubSales: (() => void) | undefined;
    let unsubGoals: (() => void) | undefined;
    let unsubClients: (() => void) | undefined;

    const initData = async () => {
      try {
        setLoading(true);
        const [initialSales, initialGoals, initialClients] = await Promise.all([
          storage.getSales(),
          storage.getGoals(),
          storage.getClients()
        ]);
        setSales(Array.isArray(initialSales) ? initialSales : []);
        setGoals(Array.isArray(initialGoals) ? initialGoals : []);
        setClients(Array.isArray(initialClients) ? initialClients : []);
      } catch (err) {
        console.error('Error fetching initial commercial data:', err);
      } finally {
        setLoading(false);
      }

      // Listeners
      try {
        unsubSales = storage.listenToSales((newSales) => {
          if (Array.isArray(newSales)) setSales(newSales);
        });
        unsubGoals = storage.listenToGoals((newGoals) => {
          if (Array.isArray(newGoals)) setGoals(newGoals);
        });
        unsubClients = storage.listenToClients((newClients) => {
          if (Array.isArray(newClients)) setClients(newClients);
        });
      } catch (err) {
        console.error('Error setting up commercial listeners:', err);
      }
    };

    initData();

    return () => {
      if (unsubSales) unsubSales();
      if (unsubGoals) unsubGoals();
      if (unsubClients) unsubClients();
    };
  }, []);

  // Safe date helper
  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr || typeof dateStr !== 'string') return '-';
    try {
      const cleanDate = dateStr.split('T')[0];
      const d = new Date(cleanDate + 'T12:00:00');
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Safe currency format
  const formatBRL = (val: any) => {
    const num = Number(val);
    const safe = isNaN(num) ? 0 : num;
    return `R$ ${safe.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  // Filtered sales for selected month
  const monthlySales = useMemo(() => {
    return (sales || []).filter(s => {
      if (!s || !s.date) return false;
      const dStr = String(s.date);
      return dStr.startsWith(monthKey);
    });
  }, [sales, monthKey]);

  // Current Monthly Goal
  const monthlyGoal = useMemo<CommercialGoal>(() => {
    const found = (goals || []).find(g => g && g.id === monthKey);
    if (found) {
      return {
        id: monthKey,
        month: Number(found.month) || selectedMonth.getMonth() + 1,
        year: Number(found.year) || selectedMonth.getFullYear(),
        target: Number(found.target) || 0,
        notes: found.notes || ''
      };
    }
    return {
      id: monthKey,
      month: selectedMonth.getMonth() + 1,
      year: selectedMonth.getFullYear(),
      target: 0,
      notes: ''
    };
  }, [goals, monthKey, selectedMonth]);

  // Core Metrics
  const totalRevenue = useMemo(() => {
    return monthlySales.reduce((acc, s) => acc + (Number(s?.value) || 0), 0);
  }, [monthlySales]);

  const recurringRevenue = useMemo(() => {
    return monthlySales
      .filter(s => {
        if (!s) return false;
        if (s.billingModel === 'RECURRING') return true;
        if (s.billingModel === 'ONE_OFF') return false;
        const cl = (clients || []).find(c => c && c.id === s.clientId);
        return cl?.billingModel !== 'ONE_OFF';
      })
      .reduce((acc, s) => acc + (Number(s?.value) || 0), 0);
  }, [monthlySales, clients]);

  const oneOffRevenue = useMemo(() => {
    return monthlySales
      .filter(s => {
        if (!s) return false;
        if (s.billingModel === 'ONE_OFF') return true;
        if (s.billingModel === 'RECURRING') return false;
        const cl = (clients || []).find(c => c && c.id === s.clientId);
        return cl?.billingModel === 'ONE_OFF';
      })
      .reduce((acc, s) => acc + (Number(s?.value) || 0), 0);
  }, [monthlySales, clients]);

  const salesCount = monthlySales.length;
  const avgTicket = salesCount > 0 ? totalRevenue / salesCount : 0;
  const goalTarget = Number(monthlyGoal?.target) || 0;
  const progress = goalTarget > 0 ? (totalRevenue / goalTarget) * 100 : 0;
  const isGoalReached = progress >= 100 && goalTarget > 0;

  // Previous Month Comparison
  const prevMonthDate = useMemo(() => new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1), [selectedMonth]);
  const prevMonthKey = useMemo(() => `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`, [prevMonthDate]);

  const prevMonthSales = useMemo(() => {
    return (sales || []).filter(s => s && s.date && String(s.date).startsWith(prevMonthKey));
  }, [sales, prevMonthKey]);

  const prevTotalRevenue = useMemo(() => {
    return prevMonthSales.reduce((acc, s) => acc + (Number(s?.value) || 0), 0);
  }, [prevMonthSales]);

  const growth = useMemo(() => {
    if (prevTotalRevenue <= 0) return 0;
    return ((totalRevenue / prevTotalRevenue) - 1) * 100;
  }, [totalRevenue, prevTotalRevenue]);

  // Projected Pace Calculations
  const paceStats = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = 
      selectedMonth.getFullYear() === now.getFullYear() && 
      selectedMonth.getMonth() === now.getMonth();
    const isPastMonth = 
      selectedMonth.getFullYear() < now.getFullYear() || 
      (selectedMonth.getFullYear() === now.getFullYear() && selectedMonth.getMonth() < now.getMonth());

    const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();

    if (isPastMonth) {
      return {
        dailyPace: daysInMonth > 0 ? totalRevenue / daysInMonth : 0,
        forecast: totalRevenue,
        remaining: Math.max(0, goalTarget - totalRevenue),
        isCurrent: false
      };
    }

    if (isCurrentMonth) {
      const currentDay = Math.max(1, Math.min(now.getDate(), daysInMonth));
      const dailyPace = totalRevenue / currentDay;
      const forecast = dailyPace * daysInMonth;
      return {
        dailyPace,
        forecast,
        remaining: Math.max(0, goalTarget - totalRevenue),
        isCurrent: true
      };
    }

    // Future month
    return {
      dailyPace: 0,
      forecast: totalRevenue,
      remaining: Math.max(0, goalTarget - totalRevenue),
      isCurrent: false
    };
  }, [selectedMonth, totalRevenue, goalTarget]);

  // Chart Data
  const chartData = useMemo(() => {
    try {
      const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
      const data = [];
      let cumulative = 0;
      
      for (let i = 1; i <= daysInMonth; i++) {
        const dayStr = `${monthKey}-${String(i).padStart(2, '0')}`;
        const dayRevenue = monthlySales
          .filter(s => s && s.date && String(s.date).startsWith(dayStr))
          .reduce((acc, s) => acc + (Number(s?.value) || 0), 0);
        
        cumulative += dayRevenue;
        data.push({
          day: i,
          venda: dayRevenue,
          acumulado: cumulative
        });
      }
      return data;
    } catch {
      return [];
    }
  }, [monthlySales, monthKey, selectedMonth]);

  // Search and Filtered Sales Table List
  const displayedSales = useMemo(() => {
    return monthlySales.filter(sale => {
      if (!sale) return false;

      // Status filter
      if (statusFilter === 'PAID' && sale.status !== 'PAID') return false;
      if (statusFilter === 'PENDING' && sale.status !== 'PENDING') return false;

      // Billing filter
      const clientObj = (clients || []).find(c => c && c.id === sale.clientId);
      const effectiveBilling = sale.billingModel || clientObj?.billingModel || 'RECURRING';
      if (billingFilter === 'RECURRING' && effectiveBilling !== 'RECURRING') return false;
      if (billingFilter === 'ONE_OFF' && effectiveBilling !== 'ONE_OFF') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const clientMatch = (sale.clientName || '').toLowerCase().includes(q);
        const serviceMatch = (sale.service || '').toLowerCase().includes(q);
        const originMatch = (sale.origin || '').toLowerCase().includes(q);
        if (!clientMatch && !serviceMatch && !originMatch) return false;
      }

      return true;
    });
  }, [monthlySales, searchQuery, statusFilter, billingFilter, clients]);

  // Goal Form State
  const [editGoalTarget, setEditGoalTarget] = useState<number>(0);
  const [editGoalNotes, setEditGoalNotes] = useState<string>('');

  useEffect(() => {
    if (showEditGoal) {
      setEditGoalTarget(monthlyGoal.target || 0);
      setEditGoalNotes(monthlyGoal.notes || '');
    }
  }, [showEditGoal, monthlyGoal]);

  const handleSaveGoal = async () => {
    try {
      const monthNum = selectedMonth.getMonth() + 1;
      const yearNum = selectedMonth.getFullYear();
      const targetVal = Math.max(0, Number(editGoalTarget) || 0);

      const newGoal: CommercialGoal = {
        id: monthKey,
        month: monthNum,
        year: yearNum,
        target: targetVal,
        notes: String(editGoalNotes || '').trim(),
      };

      await storage.saveGoal(newGoal);
      setGoals(prev => {
        const clean = Array.isArray(prev) ? prev : [];
        return clean.some(g => g.id === newGoal.id)
          ? clean.map(g => g.id === newGoal.id ? newGoal : g)
          : [...clean, newGoal];
      });
      setShowEditGoal(false);
      toast.success('Meta mensal salva com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar meta:', err);
      toast.error('Erro ao salvar meta comercial.');
    }
  };

  // Add Sale Form Handler
  const handleAddSale = async (data: any) => {
    try {
      let clientId = data.clientId;
      let clientName = '';

      if (!clientId) {
        toast.error('Por favor, selecione um cliente.');
        return;
      }

      const billingModel: BillingModel = data.billingModel === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING';
      const saleVal = Math.max(0, Number(data.value) || 0);

      if (clientId === 'new') {
        const cName = String(data.newClientName || '').trim();
        if (!cName) {
          toast.error('Informe o nome do novo cliente.');
          return;
        }

        const newClientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newClient: Client = {
          id: newClientId,
          name: cName,
          brandColor: '#00D9A3',
          businessType: 'B2B_LEADS',
          smartGoal: { currentRevenue: 0, targetRevenue: 0, durationMonths: 1, adSpend: 0, funnelSteps: [], ticket: 0 },
          channels: [],
          createdAt: new Date().toISOString(),
          ownerNames: cName,
          contactInfo: String(data.newClientContact || '').trim(),
          planValue: saleVal,
          billingModel,
          accessInfo: []
        };

        await storage.saveClient(newClient);
        setClients(prev => [...(prev || []), newClient]);
        clientId = newClientId;
        clientName = cName;
      } else {
        const client = (clients || []).find(c => c && c.id === clientId);
        clientName = client?.name || 'Cliente';
      }

      const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newSale: Sale = {
        id: saleId,
        clientId,
        clientName,
        service: String(data.service || 'Serviço Comercial').trim(),
        value: saleVal,
        date: data.date || new Date().toISOString().split('T')[0],
        status: data.status === 'PENDING' ? 'PENDING' : 'PAID',
        origin: data.origin || 'Instagram',
        billingModel
      };

      await storage.saveSale(newSale);
      setSales(prev => [newSale, ...(prev || [])]);
      setShowAddSale(false);
      toast.success('Venda registrada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao adicionar venda:', err);
      toast.error('Não foi possível registrar a venda.');
    }
  };

  // Edit Sale Form Handler
  const handleUpdateSale = async (data: any) => {
    if (!editingSale) return;
    try {
      const saleVal = Math.max(0, Number(data.value) || 0);
      const updatedSale: Sale = {
        ...editingSale,
        service: String(data.service || '').trim() || editingSale.service,
        value: saleVal,
        date: data.date || editingSale.date,
        status: data.status === 'PENDING' ? 'PENDING' : 'PAID',
        origin: data.origin || editingSale.origin,
        billingModel: data.billingModel === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING'
      };

      await storage.saveSale(updatedSale);
      setSales(prev => (prev || []).map(s => s.id === updatedSale.id ? updatedSale : s));
      setEditingSale(null);
      toast.success('Venda atualizada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao atualizar venda:', err);
      toast.error('Não foi possível atualizar a venda.');
    }
  };

  // Toggle Sale Status
  const handleToggleStatus = async (sale: Sale) => {
    try {
      const nextStatus = sale.status === 'PAID' ? 'PENDING' : 'PAID';
      const updated: Sale = { ...sale, status: nextStatus };
      await storage.saveSale(updated);
      setSales(prev => (prev || []).map(s => s.id === sale.id ? updated : s));
      toast.success(`Status alterado para ${nextStatus === 'PAID' ? 'Pago' : 'Pendente'}`);
    } catch (err) {
      console.error('Erro ao alternar status:', err);
      toast.error('Erro ao alternar status da venda.');
    }
  };

  // Delete Sale Handler
  const handleDeleteSale = async (id: string) => {
    if (confirm('Tem certeza de que deseja excluir este registro de venda?')) {
      try {
        await storage.deleteSale(id);
        setSales(prev => (prev || []).filter(s => s.id !== id));
        toast.success('Venda excluída com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir venda:', error);
        toast.error('Erro ao excluir venda.');
      }
    }
  };

  const getProgressColor = (val: number) => {
    if (val < 50) return 'bg-accent-coral';
    if (val < 80) return 'bg-yellow-500';
    return 'bg-accent-mint';
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">Comercial</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-accent-mint/10 text-accent-mint border border-accent-mint/20">
              MKT
            </span>
          </div>
          <p className="text-text-secondary text-sm mt-1">
            Gestão estratégica de vendas, faturamento, metas e ritmo de crescimento
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/10 shadow-sm">
          <button 
            onClick={prevMonth} 
            className="p-2 hover:bg-white/10 text-text-muted hover:text-white rounded-xl transition-colors cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1">
            <Calendar size={16} className="text-accent-mint" />
            <span className="text-xs font-bold uppercase tracking-widest min-w-[130px] text-center capitalize text-white">
              {monthDisplay}
            </span>
          </div>
          <button 
            onClick={nextMonth} 
            className="p-2 hover:bg-white/10 text-text-muted hover:text-white rounded-xl transition-colors cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          label="Faturamento Total" 
          value={formatBRL(totalRevenue)} 
          icon={DollarSign} 
          color="text-accent-mint"
          trend={growth}
          subtitle={`Recorrente: ${formatBRL(recurringRevenue)} | Único: ${formatBRL(oneOffRevenue)}`}
        />
        <SummaryCard 
          label="Meta Mensal" 
          value={formatBRL(goalTarget)} 
          icon={Target} 
          action={() => setShowEditGoal(true)}
          color={isGoalReached ? "text-accent-mint" : "text-white"}
          subtitle={monthlyGoal.notes || "Clique para ajustar a meta"}
        />
        <SummaryCard 
          label="Vendas Realizadas" 
          value={salesCount} 
          icon={ShoppingCart} 
          trend={prevMonthSales.length > 0 ? ((salesCount / prevMonthSales.length) - 1) * 100 : 0}
          subtitle={`${monthlySales.filter(s => s.status === 'PAID').length} pagas • ${monthlySales.filter(s => s.status === 'PENDING').length} pendentes`}
        />
        <SummaryCard 
          label="Ticket Médio" 
          value={formatBRL(avgTicket)} 
          icon={TrendingUp} 
          subtitle="Valor médio por venda"
        />
      </div>

      {/* Progress & Rhythm Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance of the Goal & Chart */}
        <div className={cn(
          "lg:col-span-2 glass rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden transition-all duration-700",
          isGoalReached && "border-accent-mint/30 shadow-[0_0_40px_-15px_rgba(0,217,163,0.15)]"
        )}>
          {isGoalReached && (
            <motion.div 
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-6 right-8 flex items-center gap-2 bg-accent-mint/20 border border-accent-mint/30 text-accent-mint px-3 py-1 rounded-full text-xs font-bold"
            >
              <Sparkles size={14} />
              Meta Conquistada!
            </motion.div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">Desempenho da Meta</h3>
              <p className="text-sm text-text-secondary mt-0.5">
                {goalTarget > 0 ? `${formatBRL(totalRevenue)} alcançados de ${formatBRL(goalTarget)}` : 'Defina uma meta mensal para monitorar o avanço'}
              </p>
            </div>
            <div className="text-right">
              <span className={cn("text-2xl font-bold tracking-tight", isGoalReached ? "text-accent-mint" : "text-white")}>
                {progress.toFixed(1)}%
              </span>
              <p className="text-[10px] font-bold uppercase text-text-muted">concluído</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-3.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, progress)}%` }}
                className={cn("h-full rounded-full transition-all duration-1000", getProgressColor(progress))}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-text-muted">
              <span>R$ 0</span>
              <span className="text-white font-medium">{formatBRL(totalRevenue)}</span>
              <button 
                onClick={() => setShowEditGoal(true)}
                className="flex items-center gap-1.5 hover:text-accent-mint transition-colors cursor-pointer group"
                title="Editar meta"
              >
                <span>{formatBRL(goalTarget)}</span>
                <Edit2 size={11} className="opacity-60 group-hover:opacity-100" />
              </button>
            </div>
          </div>

          {/* Cumulative Sales Chart */}
          <div className="h-[210px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D9A3" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#00D9A3" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0C0D0E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px' }}
                  formatter={(val: any) => [formatBRL(val), 'Acumulado']}
                  labelFormatter={(lbl) => `Dia ${lbl} de ${monthDisplay}`}
                />
                <Area type="monotone" dataKey="acumulado" stroke="#00D9A3" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rhythm & Projections Panel */}
        <div className="glass rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">Previsão e Ritmo</h3>
              <span className="text-[10px] font-bold text-accent-mint uppercase px-2 py-0.5 rounded bg-accent-mint/10">
                Projeção
              </span>
            </div>

            <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-mint/10 flex items-center justify-center text-accent-mint shrink-0">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-muted">Faturamento Previsto</p>
                  <p className="text-xl font-bold tracking-tight text-white mt-0.5">
                    {formatBRL(paceStats.forecast)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                <span className="text-text-secondary flex items-center gap-1.5">
                  <Clock size={14} className="text-text-muted" />
                  Ritmo diário
                </span>
                <span className="font-semibold text-white">
                  {formatBRL(paceStats.dailyPace)} / dia
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                <span className="text-text-secondary flex items-center gap-1.5">
                  <Target size={14} className="text-text-muted" />
                  Faltam para a meta
                </span>
                <span className={cn("font-semibold", paceStats.remaining > 0 ? "text-accent-coral" : "text-accent-mint")}>
                  {formatBRL(paceStats.remaining)}
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setShowAddSale(true)}
            className="w-full py-3.5 bg-accent-mint hover:bg-accent-mint/90 text-black rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-lg shadow-accent-mint/10"
          >
            <Plus size={18} /> Nova Venda
          </button>
        </div>
      </div>

      {/* Sales Registry Table */}
      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">Registro de Vendas</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {displayedSales.length} {displayedSales.length === 1 ? 'venda encontrada' : 'vendas encontradas'} em {monthDisplay}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente ou serviço..." 
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-8 py-2 text-xs text-white placeholder-text-muted outline-none focus:border-accent-mint/50 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-wider">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", statusFilter === 'ALL' ? "bg-white/10 text-white" : "text-text-muted hover:text-white")}
              >
                Todas
              </button>
              <button
                onClick={() => setStatusFilter('PAID')}
                className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", statusFilter === 'PAID' ? "bg-accent-mint/20 text-accent-mint" : "text-text-muted hover:text-white")}
              >
                Pagas
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", statusFilter === 'PENDING' ? "bg-yellow-500/20 text-yellow-400" : "text-text-muted hover:text-white")}
              >
                Pendentes
              </button>
            </div>

            {/* Billing Model Filter */}
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-wider">
              <button
                onClick={() => setBillingFilter('ALL')}
                className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", billingFilter === 'ALL' ? "bg-white/10 text-white" : "text-text-muted hover:text-white")}
              >
                Planos
              </button>
              <button
                onClick={() => setBillingFilter('RECURRING')}
                className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", billingFilter === 'RECURRING' ? "bg-accent-mint/20 text-accent-mint" : "text-text-muted hover:text-white")}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingFilter('ONE_OFF')}
                className={cn("px-2.5 py-1 rounded-lg transition-colors cursor-pointer", billingFilter === 'ONE_OFF' ? "bg-blue-400/20 text-blue-400" : "text-text-muted hover:text-white")}
              >
                Único
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Cliente</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Serviço/Produto</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Origem</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-right">Valor</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Data</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayedSales.map((sale) => {
                const clientMatch = (clients || []).find(c => c && c.id === sale.clientId);
                const isOneOff = (sale.billingModel || clientMatch?.billingModel) === 'ONE_OFF';

                return (
                  <tr key={sale.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center text-accent-mint shrink-0">
                          <Users size={14} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-white">{sale.clientName || 'Cliente'}</p>
                          <span className={cn(
                            "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-block mt-0.5",
                            isOneOff ? "bg-blue-400/10 text-blue-400" : "bg-accent-mint/10 text-accent-mint"
                          )}>
                            {isOneOff ? 'Trabalho Único' : 'Plano Mensal'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs font-medium text-text-secondary">
                      {sale.service || 'Serviço Comercial'}
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 bg-white/5 rounded-md text-text-muted uppercase tracking-wider">
                        {sale.origin || 'Direto'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-sm text-accent-mint">
                      {formatBRL(sale.value)}
                    </td>

                    <td className="px-6 py-4 text-xs text-text-muted">
                      {formatDate(sale.date)}
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(sale)}
                        className={cn(
                          "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all cursor-pointer",
                          sale.status === 'PAID'
                            ? "bg-accent-mint/10 border-accent-mint/20 text-accent-mint hover:bg-accent-mint/20"
                            : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20"
                        )}
                        title="Clique para alternar o status de pagamento"
                      >
                        {sale.status === 'PAID' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {sale.status === 'PAID' ? 'Pago' : 'Pendente'}
                      </button>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingSale(sale)}
                          className="p-1.5 text-text-muted hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
                          title="Editar venda"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSale(sale.id)}
                          className="p-1.5 text-text-muted hover:text-accent-coral hover:bg-accent-coral/10 rounded-lg transition-all cursor-pointer"
                          title="Excluir venda"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {displayedSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-text-muted">
                        <ShoppingCart size={22} />
                      </div>
                      <p className="text-sm text-text-secondary font-medium">
                        Nenhuma venda registrada {searchQuery ? 'com os filtros aplicados' : 'neste mês'}.
                      </p>
                      <button 
                        onClick={() => setShowAddSale(true)}
                        className="px-4 py-2 bg-accent-mint text-black font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-accent-mint/90 transition-all cursor-pointer"
                      >
                        Cadastrar Venda
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Editar Meta Mensal */}
      <AnimatePresence>
        {showEditGoal && (
          <Modal title="Editar Meta Mensal" onClose={() => setShowEditGoal(false)}>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
                  Valor da Meta (R$)
                </label>
                <input 
                  type="number" 
                  min="0"
                  step="100"
                  value={editGoalTarget || ''} 
                  onChange={(e) => setEditGoalTarget(Math.max(0, Number(e.target.value)))}
                  placeholder="Ex: 50000"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-semibold text-xl text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
                  Notas / Observações Estratégicas
                </label>
                <textarea 
                  value={editGoalNotes} 
                  onChange={(e) => setEditGoalNotes(e.target.value)}
                  placeholder="Ex: Foco em captação de clientes B2B, aumento de ticket médio..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all text-sm text-white min-h-[90px] resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEditGoal(false)}
                  className="w-1/3 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleSaveGoal}
                  className="w-2/3 py-3.5 bg-accent-mint hover:bg-accent-mint/90 text-black rounded-xl font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                >
                  Salvar Meta
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: Nova Venda */}
        {showAddSale && (
          <Modal title="Registrar Nova Venda" onClose={() => setShowAddSale(false)}>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleAddSale(Object.fromEntries(formData.entries()));
            }} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
                  Cliente
                </label>
                <select 
                  name="clientId" 
                  id="clientSelect"
                  defaultValue=""
                  onChange={(e) => {
                    const target = document.getElementById('newClientFields');
                    if (target) {
                      target.style.display = e.target.value === 'new' ? 'block' : 'none';
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 text-white transition-all text-sm font-medium"
                  required
                >
                  <option value="" disabled className="bg-bg-card text-text-muted">Selecione um cliente...</option>
                  {(clients || []).map(c => (
                    <option key={c.id} value={c.id} className="bg-bg-card text-white">{c.name}</option>
                  ))}
                  <option value="new" className="bg-bg-card text-accent-mint font-bold">+ Cadastrar Novo Cliente</option>
                </select>
              </div>

              {/* Novo Cliente Fields (Dynamic) */}
              <div id="newClientFields" style={{ display: 'none' }} className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/10">
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent-mint">Dados do Novo Cliente</p>
                <input 
                  name="newClientName" 
                  placeholder="Nome completo ou Razão Social"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-accent-mint/50" 
                />
                <input 
                  name="newClientContact" 
                  placeholder="WhatsApp ou E-mail de contato"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-accent-mint/50" 
                />
              </div>

              {/* Billing Model */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
                  Tipo de Faturamento
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:border-accent-mint/40 transition-colors">
                    <input type="radio" name="billingModel" value="RECURRING" defaultChecked className="accent-accent-mint" />
                    <span className="text-xs font-semibold text-white">Plano Mensal</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:border-accent-mint/40 transition-colors">
                    <input type="radio" name="billingModel" value="ONE_OFF" className="accent-accent-mint" />
                    <span className="text-xs font-semibold text-white">Trabalho Único</span>
                  </label>
                </div>
              </div>

              {/* Service and Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Serviço/Produto</label>
                  <input 
                    name="service" 
                    placeholder="Ex: Gestão de Tráfego" 
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 text-white text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Valor (R$)</label>
                  <input 
                    type="number" 
                    name="value" 
                    min="0"
                    step="50"
                    placeholder="0.00" 
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 text-white font-semibold text-sm" 
                  />
                </div>
              </div>

              {/* Date and Origin */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Data da Venda</label>
                  <input 
                    type="date" 
                    name="date" 
                    defaultValue={new Date().toISOString().split('T')[0]} 
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 text-white text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Origem</label>
                  <select 
                    name="origin" 
                    defaultValue="Instagram"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 text-white text-sm"
                  >
                    <option value="Instagram" className="bg-bg-card">Instagram</option>
                    <option value="Indicação" className="bg-bg-card">Indicação</option>
                    <option value="Tráfego Pago" className="bg-bg-card">Tráfego Pago</option>
                    <option value="YouTube" className="bg-bg-card">YouTube</option>
                    <option value="Eventos" className="bg-bg-card">Eventos</option>
                    <option value="Outro" className="bg-bg-card">Outro</option>
                  </select>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
                  Status de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:border-accent-mint/40 transition-colors">
                    <input type="radio" name="status" value="PAID" defaultChecked className="accent-accent-mint" />
                    <span className="text-xs font-semibold text-accent-mint flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Pago
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:border-yellow-500/40 transition-colors">
                    <input type="radio" name="status" value="PENDING" className="accent-yellow-400" />
                    <span className="text-xs font-semibold text-yellow-400 flex items-center gap-1.5">
                      <AlertCircle size={14} /> Pendente
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddSale(false)}
                  className="w-1/3 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="w-2/3 py-3.5 bg-accent-mint hover:bg-accent-mint/90 text-black rounded-xl font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer shadow-md shadow-accent-mint/10"
                >
                  Confirmar Venda
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Modal: Editar Venda */}
        {editingSale && (
          <Modal title="Editar Venda" onClose={() => setEditingSale(null)}>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleUpdateSale(Object.fromEntries(formData.entries()));
            }} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Cliente</label>
                <p className="font-semibold text-sm text-white px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                  {editingSale.clientName}
                </p>
              </div>

              {/* Billing Model */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
                  Tipo de Faturamento
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:border-accent-mint/40 transition-colors">
                    <input 
                      type="radio" 
                      name="billingModel" 
                      value="RECURRING" 
                      defaultChecked={editingSale.billingModel !== 'ONE_OFF'} 
                      className="accent-accent-mint" 
                    />
                    <span className="text-xs font-semibold text-white">Plano Mensal</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:border-accent-mint/40 transition-colors">
                    <input 
                      type="radio" 
                      name="billingModel" 
                      value="ONE_OFF" 
                      defaultChecked={editingSale.billingModel === 'ONE_OFF'} 
                      className="accent-accent-mint" 
                    />
                    <span className="text-xs font-semibold text-white">Trabalho Único</span>
                  </label>
                </div>
              </div>

              {/* Service and Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Serviço/Produto</label>
                  <input 
                    name="service" 
                    defaultValue={editingSale.service}
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 text-white text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Valor (R$)</label>
                  <input 
                    type="number" 
                    name="value" 
                    min="0"
                    step="50"
                    defaultValue={editingSale.value} 
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 text-white font-semibold text-sm" 
                  />
                </div>
              </div>

              {/* Date and Origin */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Data</label>
                  <input 
                    type="date" 
                    name="date" 
                    defaultValue={editingSale.date ? editingSale.date.split('T')[0] : ''} 
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 text-white text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Origem</label>
                  <select 
                    name="origin" 
                    defaultValue={editingSale.origin || 'Instagram'}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 text-white text-sm"
                  >
                    <option value="Instagram" className="bg-bg-card">Instagram</option>
                    <option value="Indicação" className="bg-bg-card">Indicação</option>
                    <option value="Tráfego Pago" className="bg-bg-card">Tráfego Pago</option>
                    <option value="YouTube" className="bg-bg-card">YouTube</option>
                    <option value="Eventos" className="bg-bg-card">Eventos</option>
                    <option value="Outro" className="bg-bg-card">Outro</option>
                  </select>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
                  Status de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:border-accent-mint/40 transition-colors">
                    <input 
                      type="radio" 
                      name="status" 
                      value="PAID" 
                      defaultChecked={editingSale.status === 'PAID'} 
                      className="accent-accent-mint" 
                    />
                    <span className="text-xs font-semibold text-accent-mint flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Pago
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:border-yellow-500/40 transition-colors">
                    <input 
                      type="radio" 
                      name="status" 
                      value="PENDING" 
                      defaultChecked={editingSale.status === 'PENDING'} 
                      className="accent-yellow-400" 
                    />
                    <span className="text-xs font-semibold text-yellow-400 flex items-center gap-1.5">
                      <AlertCircle size={14} /> Pendente
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditingSale(null)}
                  className="w-1/3 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="w-2/3 py-3.5 bg-accent-mint hover:bg-accent-mint/90 text-black rounded-xl font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer shadow-md shadow-accent-mint/10"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({ 
  label, 
  value, 
  icon: Icon, 
  color = "text-white", 
  action, 
  trend, 
  subtitle 
}: { 
  label: string; 
  value: any; 
  icon: any; 
  color?: string; 
  action?: () => void; 
  trend?: number; 
  subtitle?: string; 
}) {
  return (
    <div 
      onClick={action}
      className={cn(
        "glass p-6 rounded-3xl space-y-4 group transition-all",
        action && "cursor-pointer hover:border-accent-mint/30 shadow-[0_0_20px_-10px_rgba(255,255,255,0)] hover:shadow-[0_0_20px_-10px_rgba(0,217,163,0.15)]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-muted group-hover:text-accent-mint transition-colors">
          <Icon size={20} />
        </div>
        {trend !== undefined && trend !== 0 && !isNaN(trend) && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg",
            trend >= 0 ? "bg-accent-mint/10 text-accent-mint" : "bg-accent-coral/10 text-accent-coral"
          )}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(0)}%
          </div>
        )}
        {action && (trend === undefined || trend === 0 || isNaN(trend)) && (
          <Plus size={16} className="text-text-muted group-hover:text-accent-mint transition-colors" />
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
        <p className={cn("text-2xl font-bold tracking-tight mt-1", color)}>
          {value}
        </p>
        {subtitle && (
          <p className="text-[10px] font-medium text-text-secondary mt-1 line-clamp-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="glass w-full max-w-lg rounded-[28px] overflow-hidden border border-white/10 shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="p-6 flex items-center justify-between border-b border-white/5 shrink-0">
          <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-text-muted hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

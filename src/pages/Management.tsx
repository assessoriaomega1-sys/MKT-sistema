import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  Flag, 
  ExternalLink, 
  Users, 
  Search,
  ChevronDown,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Calendar,
  CreditCard,
  Check,
  Play,
  Camera,
  Plus,
  Filter,
  Trash2,
  PiggyBank,
  Target,
  Bell,
  Calculator,
  AlertCircle
} from 'lucide-react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { storage } from '../lib/storage';
import { Client, ManagementFlag, MonthlyPayment, FinancialRelease, RecurringBill, FinancialGoal } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { useVisibility } from '../contexts/VisibilityContext';
import { toast } from 'sonner';

const getClientMonthStats = (client: any) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const isRecurringClient = client.billingModel === 'RECURRING';

  const stats = {
    contentTotal: 0,
    contentDone: 0,
    capturesTotal: 0,
    capturesDone: 0
  };

  const isInMonth = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  const checkDateOccurs = (date: Date, evt: any) => {
    const dateStr = date.toISOString().split('T')[0];
    if (evt.deletedDates?.includes(dateStr)) return false;
    const rType = evt.recurrenceType || (evt.isRecurring ? 'MONTHLY_DAY' : (evt.recurringDays && evt.recurringDays.length > 0) ? 'WEEKLY' : 'NONE');
    const effectiveR = (evt.type === 'content' && isRecurringClient && rType === 'NONE' && evt.isRecurring === undefined) ? 'MONTHLY_DAY' : rType;
    
    switch (effectiveR) {
      case 'DAILY': return true;
      case 'WEEKLY': return evt.recurringDays?.includes(date.getDay());
      case 'MONTHLY_DAY': return date.getDate() === new Date((evt.targetDate || evt.date) + "T12:00:00").getDate();
      case 'MONTHLY_ORDINAL': {
        if (!evt.ordinalWeekday) return false;
        const { ordinal, day } = evt.ordinalWeekday;
        if (date.getDay() !== day) return false;
        return Math.ceil(date.getDate() / 7) === ordinal;
      }
      default: return false;
    }
  };

  client.contentPlan?.items?.forEach((item: any) => {
    const isRecurring = item.recurrenceType 
      ? item.recurrenceType !== 'NONE'
      : (item.isRecurring || (item.recurringDays && item.recurringDays.length > 0) || (isRecurringClient && !item.recurringDays));

    if (isRecurring) {
      for (let d = 1; d <= daysInMonth; d++) {
        const checkDate = new Date(currentYear, currentMonth, d);
        const checkDateStr = checkDate.toISOString().split('T')[0];
        if (checkDateOccurs(checkDate, { ...item, type: 'content' })) {
          stats.contentTotal++;
          if (item.completedDates?.includes(checkDateStr)) {
            stats.contentDone++;
          }
        }
      }
    } else {
      const itemDate = item.targetDate || item.date;
      if (itemDate && isInMonth(itemDate)) {
        stats.contentTotal++;
        if (item.status === 'POSTED') {
          stats.contentDone++;
        }
      }
    }
  });

  client.captures?.forEach((item: any) => {
    const isRecurring = item.recurrenceType ? item.recurrenceType !== 'NONE' : item.isRecurring;
    if (isRecurring) {
      for (let d = 1; d <= daysInMonth; d++) {
        const checkDate = new Date(currentYear, currentMonth, d);
        const checkDateStr = checkDate.toISOString().split('T')[0];
        if (checkDateOccurs(checkDate, { ...item, type: 'capture' })) {
          stats.capturesTotal++;
          if (item.completedDates?.includes(checkDateStr)) {
            stats.capturesDone++;
          }
        }
      }
    } else {
      const itemDate = item.date;
      if (itemDate && isInMonth(itemDate)) {
        stats.capturesTotal++;
        if (item.status === 'DONE') {
          stats.capturesDone++;
        }
      }
    }
  });

  return stats;
};

const isContentDelayed = (client: any) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const isInMonth = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  const isRecurringClient = client.billingModel === 'RECURRING';

  // Check Content
  if (client.contentPlan?.items?.some((item: any) => {
    const isRecurring = item.recurrenceType 
      ? item.recurrenceType !== 'NONE'
      : (item.isRecurring || (item.recurringDays && item.recurringDays.length > 0) || (isRecurringClient && !item.recurringDays));

    if (isRecurring) {
      // Check days in current month up to yesterday
      const lastDayToCheck = today.getDate() - 1;
      if (lastDayToCheck < 1) return false;
      
      for (let d = 1; d <= lastDayToCheck; d++) {
        const checkDate = new Date(currentYear, currentMonth, d);
        const checkDateStr = checkDate.toISOString().split('T')[0];
        
        const dateOccurs = (date: Date, evt: any) => {
          const rType = evt.recurrenceType || (evt.isRecurring ? 'MONTHLY_DAY' : (evt.recurringDays && evt.recurringDays.length > 0) ? 'WEEKLY' : 'NONE');
          const effectiveR = (evt.type === 'content' && isRecurringClient && rType === 'NONE' && evt.isRecurring === undefined) ? 'MONTHLY_DAY' : rType;
          if (evt.deletedDates?.includes(checkDateStr)) return false;

          switch (effectiveR) {
            case 'DAILY': return true;
            case 'WEEKLY': return evt.recurringDays?.includes(date.getDay());
            case 'MONTHLY_DAY': return date.getDate() === new Date((evt.targetDate || evt.date) + "T12:00:00").getDate();
            case 'MONTHLY_ORDINAL': {
              if (!evt.ordinalWeekday) return false;
              const { ordinal, day } = evt.ordinalWeekday;
              if (date.getDay() !== day) return false;
              return Math.ceil(date.getDate() / 7) === ordinal;
            }
            default: return false;
          }
        };

        if (dateOccurs(checkDate, { ...item, type: 'content' }) && !item.completedDates?.includes(checkDateStr)) {
          return true;
        }
      }
      return false;
    } else {
      const itemDate = item.targetDate || item.date;
      return item.status === 'PLANNED' && itemDate < todayStr && isInMonth(itemDate);
    }
  })) return true;

  // Check Captures/Meetings (similar logic)
  if (client.captures?.some((item: any) => {
    const itemDate = item.date;
    if (item.isRecurring) return false;
    return item.status === 'PLANNED' && itemDate < todayStr && isInMonth(itemDate);
  })) return true;

  if (client.meetings?.some((item: any) => {
    const itemDate = item.date;
    if (item.isRecurring) return false;
    return item.status === 'PLANNED' && itemDate < todayStr && isInMonth(itemDate);
  })) return true;
  
  return false;
};

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const computeStatsForMonth = (clients: Client[], targetMonth: number, targetYear: number) => {
  const recurringClients = clients.filter(c => {
    const isRecurring = c.billingModel === 'RECURRING' || !c.billingModel;
    if (!isRecurring) return false;
    
    if (!c.createdAt) return true; 
    const d = new Date(c.createdAt);
    const clientYear = d.getFullYear();
    const clientMonth = d.getMonth();
    
    return (clientYear < targetYear) || (clientYear === targetYear && clientMonth <= targetMonth);
  });
  
  const mrr = recurringClients.reduce((acc, c) => acc + (c.planValue || 0), 0);
  
  const oneOffClients = clients.filter(c => {
    const isOneOff = c.billingModel === 'ONE_OFF';
    if (!isOneOff) return false;
    
    if (!c.createdAt) return false;
    const d = new Date(c.createdAt);
    return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
  });
  
  const projects = oneOffClients.reduce((acc, c) => acc + (c.planValue || 0), 0);
  
  const active = recurringClients.length + oneOffClients.length;
  const healthy = recurringClients.filter(c => c.managementStatus === 'GREEN').length + 
                  oneOffClients.filter(c => c.managementStatus === 'GREEN').length;
                  
  return {
    active,
    mrr,
    projects,
    total: mrr + projects,
    healthy,
    recurringClients,
    oneOffClients
  };
};

export function Management() {
  const { isVisible } = useVisibility();
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'portfolio' | 'progresso' | 'folha'>('portfolio');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(11);

  // FOLHA states
  const [releases, setReleases] = useState<FinancialRelease[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);

  // Lançamento form
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [releaseDescription, setReleaseDescription] = useState('');
  const [releaseCategory, setReleaseCategory] = useState<any>('Tráfego Pago');
  const [releaseType, setReleaseType] = useState<any>('RECEITA');
  const [releaseValue, setReleaseValue] = useState('');
  const [releaseObservation, setReleaseObservation] = useState('');

  // Recurring bill form
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [billDescription, setBillDescription] = useState('');
  const [billValue, setBillValue] = useState('');
  const [billDueDay, setBillDueDay] = useState(10);

  // Goal Form editing
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalTargetValue, setGoalTargetValue] = useState('20000');

  // FOLHA filters state
  const [folhaFilterMonth, setFolhaFilterMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [folhaFilterYear, setFolhaFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [folhaFilterCategory, setFolhaFilterCategory] = useState<string>('all');
  const [folhaFilterType, setFolhaFilterType] = useState<string>('all');

  const currentMonthNum = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientsData, paymentsData, releasesData, billsData, goalsData] = await Promise.all([
        storage.getClients(),
        storage.getPayments(currentMonthNum, currentYear),
        storage.getFinancialReleases(),
        storage.getRecurringBills(),
        storage.getFinancialGoals()
      ]);
      setClients(clientsData);
      setPayments(paymentsData);
      setReleases(releasesData);
      setRecurringBills(billsData);
      setFinancialGoals(goalsData);
    } catch (e) {
      console.error('Error loading finance data: ', e);
    } finally {
      setLoading(false);
    }
  };

  const togglePayment = async (client: Client) => {
    const existingPayment = payments.find(p => p.clientId === client.id);
    const newStatus = existingPayment?.status === 'PAID' ? 'PENDING' : 'PAID';
    
    const payment: MonthlyPayment = {
      id: `${currentYear}-${currentMonthNum}-${client.id}`,
      clientId: client.id,
      month: currentMonthNum,
      year: currentYear,
      status: newStatus,
      value: client.planValue || 0,
      paidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined
    };

    try {
      await storage.savePayment(payment);
      setPayments(prev => {
        const other = prev.filter(p => p.clientId !== client.id);
        return [...other, payment];
      });
      toast.success(newStatus === 'PAID' ? `Pagamento de ${client.name} confirmado` : `Pagamento de ${client.name} marcado como pendente`);
    } catch (error) {
      toast.error('Erro ao salvar pagamento');
    }
  };

  // FOLHA mutation handlers
  const handleAddRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseDescription || !releaseValue) {
      toast.error('Por favor, preencha a descrição e o valor.');
      return;
    }
    const val = parseFloat(releaseValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      toast.error('Por favor, insira um valor válido positivo.');
      return;
    }
    
    // Auto incrementing id
    const newRelease: FinancialRelease = {
      id: 'rel_' + Math.random().toString(36).substring(2, 9),
      date: releaseDate,
      description: releaseDescription,
      category: releaseCategory,
      type: releaseType,
      value: val,
      observation: releaseObservation.trim() || undefined
    };

    try {
      await storage.saveFinancialRelease(newRelease);
      setReleases(prev => [newRelease, ...prev]);
      toast.success('Lançamento registrado com sucesso!');
      setIsReleaseModalOpen(false);
      setReleaseDescription('');
      setReleaseValue('');
      setReleaseObservation('');
    } catch (err) {
      toast.error('Erro ao registrar lançamento.');
    }
  };

  const handleDeleteRelease = async (id: string) => {
    try {
      await storage.deleteFinancialRelease(id);
      setReleases(prev => prev.filter(r => r.id !== id));
      toast.success('Lançamento excluído com sucesso.');
    } catch (err) {
      toast.error('Erro ao excluir lançamento.');
    }
  };

  const handleAddRecurringBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billDescription || !billValue) {
      toast.error('Por favor, preencha descrição e valor.');
      return;
    }
    const val = parseFloat(billValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      toast.error('Por favor, insira um valor válido positivo.');
      return;
    }
    const day = parseInt(billDueDay.toString());
    if (isNaN(day) || day < 1 || day > 31) {
      toast.error('Dia de vencimento deve ser entre 1 e 31.');
      return;
    }

    const newBill: RecurringBill = {
      id: 'bill_' + Math.random().toString(36).substring(2, 9),
      description: billDescription,
      value: val,
      dueDay: day
    };

    try {
      await storage.saveRecurringBill(newBill);
      setRecurringBills(prev => [...prev, newBill]);
      toast.success('Despesa recorrente cadastrada!');
      setIsBillModalOpen(false);
      setBillDescription('');
      setBillValue('');
      setBillDueDay(10);
    } catch (err) {
      toast.error('Erro ao cadastrar despesa recorrente.');
    }
  };

  const handleDeleteRecurringBill = async (id: string) => {
    try {
      await storage.deleteRecurringBill(id);
      setRecurringBills(prev => prev.filter(b => b.id !== id));
      toast.success('Despesa recorrente removida.');
    } catch (err) {
      toast.error('Erro ao remover despesa.');
    }
  };

  // Re-calculate the goal target reactively if month/year changes
  const activeMonthNum = folhaFilterMonth === 'all' ? currentMonthNum + 1 : parseInt(folhaFilterMonth);
  const activeYearNum = folhaFilterYear === 'all' ? currentYear : parseInt(folhaFilterYear);
  const goalId = `${activeYearNum}-${String(activeMonthNum).padStart(2, '0')}`;
  
  const currentGoalValue = useMemo(() => {
    const goal = financialGoals.find(g => g.id === goalId);
    return goal ? goal.target.toString() : '20000';
  }, [financialGoals, goalId]);

  useEffect(() => {
    setGoalTargetValue(currentGoalValue);
  }, [currentGoalValue]);

  const handleSaveGoal = async () => {
    const val = parseFloat(goalTargetValue);
    if (isNaN(val) || val < 0) {
      toast.error('Valor de meta inválido.');
      return;
    }

    const newGoal: FinancialGoal = {
      id: goalId,
      target: val,
      month: activeMonthNum,
      year: activeYearNum
    };

    try {
      await storage.saveFinancialGoal(newGoal);
      setFinancialGoals(prev => {
        const other = prev.filter(g => g.id !== goalId);
        return [...other, newGoal];
      });
      setIsEditingGoal(false);
      toast.success('Meta de faturamento atualizada!');
    } catch (err) {
      toast.error('Erro ao salvar meta.');
    }
  };

  // Calculations for sums (top finance report cards)
  const sums = useMemo(() => {
    let receita = 0;
    let gastos = 0;
    let investimentos = 0;

    // Calculate dynamic portfolio revenue based on the filtered period
    if (folhaFilterMonth !== 'all' && folhaFilterYear !== 'all') {
      const targetMonth = parseInt(folhaFilterMonth) - 1;
      const targetYear = parseInt(folhaFilterYear);
      const mStats = computeStatsForMonth(clients, targetMonth, targetYear);
      receita = mStats.total;
    } else if (folhaFilterMonth === 'all' && folhaFilterYear !== 'all') {
      // Sum the totals for all 12 months of the selected year
      const targetYear = parseInt(folhaFilterYear);
      let yearTotal = 0;
      for (let m = 0; m < 12; m++) {
        yearTotal += computeStatsForMonth(clients, m, targetYear).total;
      }
      receita = yearTotal;
    } else {
      // Fallback: use current month's wallet value
      const mStats = computeStatsForMonth(clients, currentMonthNum, currentYear);
      receita = mStats.total;
    }

    releases.forEach(r => {
      if (folhaFilterMonth !== 'all') {
        const m = new Date(r.date + "T12:00:00").getMonth() + 1;
        if (m.toString() !== folhaFilterMonth) return;
      }
      if (folhaFilterYear !== 'all') {
        const y = new Date(r.date + "T12:00:00").getFullYear();
        if (y.toString() !== folhaFilterYear) return;
      }

      if (r.type === 'GASTO') {
        gastos += r.value;
      } else if (r.type === 'INVESTIMENTO') {
        investimentos += r.value;
      }
    });

    return {
      receita,
      gastos,
      investimentos,
      lucroLiquido: receita - gastos - investimentos,
      saldoAtual: receita - gastos
    };
  }, [releases, clients, folhaFilterMonth, folhaFilterYear, currentMonthNum, currentYear]);

  // General indicators
  const indicators = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    const allCategories = ['Tráfego Pago', 'Freelancer', 'Ferramentas', 'Software', 'Assinaturas', 'Equipamentos', 'Marketing', 'Combustível', 'Alimentação', 'Escritório', 'Impostos', 'Outros'];
    allCategories.forEach(cat => {
      categoryTotals[cat] = 0;
    });

    let totalGasto = 0;
    let totalInvestido = 0;
    let totalRecebido = sums.receita;

    // Summations inside active filters
    releases.forEach(r => {
      if (folhaFilterMonth !== 'all') {
        const m = new Date(r.date + "T12:00:00").getMonth() + 1;
        if (m.toString() !== folhaFilterMonth) return;
      }
      if (folhaFilterYear !== 'all') {
        const y = new Date(r.date + "T12:00:00").getFullYear();
        if (y.toString() !== folhaFilterYear) return;
      }

      if (r.type === 'GASTO' || r.type === 'INVESTIMENTO') {
        categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.value;
      }
      
      if (r.type === 'GASTO') {
        totalGasto += r.value;
      } else if (r.type === 'INVESTIMENTO') {
        totalInvestido += r.value;
      }
    });

    // Averages across all active database months with entries
    const monthReleases: Record<string, { GASTO: number; RECEITA: number }> = {};
    releases.forEach(r => {
      const dt = new Date(r.date + "T12:00:00");
      const key = `${dt.getFullYear()}-${dt.getMonth() + 1}`;
      if (!monthReleases[key]) {
        monthReleases[key] = { GASTO: 0, RECEITA: 0 };
      }
      if (r.type === 'GASTO') {
        monthReleases[key].GASTO += r.value;
      }
    });

    // For each month key in monthReleases, let's inject the real portfolio total for that month!
    Object.keys(monthReleases).forEach(key => {
      const parts = key.split('-');
      const year = parseInt(parts[0]);
      const monthZeroBased = parseInt(parts[1]) - 1;
      monthReleases[key].RECEITA = computeStatsForMonth(clients, monthZeroBased, year).total;
    });

    const activeMonthsCount = Object.keys(monthReleases).length || 1;
    let sumMonthlyGastos = 0;
    let sumMonthlyReceitas = 0;
    Object.values(monthReleases).forEach(item => {
      sumMonthlyGastos += item.GASTO;
      sumMonthlyReceitas += item.RECEITA;
    });

    // Ensure we count the current month if monthReleases is empty
    if (Object.keys(monthReleases).length === 0) {
      sumMonthlyReceitas = computeStatsForMonth(clients, currentMonthNum, currentYear).total;
    }

    return {
      categoryTotals,
      totalGasto,
      totalInvestido,
      totalRecebido,
      mediaMensalGastos: sumMonthlyGastos / activeMonthsCount,
      mediaMensalReceita: sumMonthlyReceitas / activeMonthsCount
    };
  }, [releases, clients, folhaFilterMonth, folhaFilterYear, currentMonthNum, currentYear, sums.receita]);

  // Sector-based Cost Center consuming
  const costCenter = useMemo(() => {
    let operacao = 0;
    let marketing = 0;
    let ferramentas = 0;
    let freelancers = 0;
    let equipamentos = 0;

    releases.forEach(r => {
      if (folhaFilterMonth !== 'all') {
        const m = new Date(r.date + "T12:00:00").getMonth() + 1;
        if (m.toString() !== folhaFilterMonth) return;
      }
      if (folhaFilterYear !== 'all') {
        const y = new Date(r.date + "T12:00:00").getFullYear();
        if (y.toString() !== folhaFilterYear) return;
      }

      if (r.type === 'GASTO' || r.type === 'INVESTIMENTO') {
        const val = r.value;
        const cat = r.category;

        if (['Combustível', 'Alimentação', 'Escritório', 'Impostos', 'Outros'].includes(cat)) {
          operacao += val;
        } else if (['Tráfego Pago', 'Marketing'].includes(cat)) {
          marketing += val;
        } else if (['Ferramentas', 'Software', 'Assinaturas'].includes(cat)) {
          ferramentas += val;
        } else if (cat === 'Freelancer') {
          freelancers += val;
        } else if (cat === 'Equipamentos') {
          equipamentos += val;
        }
      }
    });

    return {
      operacao,
      marketing,
      ferramentas,
      freelancers,
      equipamentos
    };
  }, [releases, folhaFilterMonth, folhaFilterYear]);

  // Full History filter output
  const filteredReleases = useMemo(() => {
    return releases.filter(r => {
      if (folhaFilterMonth !== 'all') {
        const m = new Date(r.date + "T12:00:00").getMonth() + 1;
        if (m.toString() !== folhaFilterMonth) return false;
      }
      if (folhaFilterYear !== 'all') {
        const y = new Date(r.date + "T12:00:00").getFullYear();
        if (y.toString() !== folhaFilterYear) return false;
      }
      if (folhaFilterCategory !== 'all' && r.category !== folhaFilterCategory) return false;
      if (folhaFilterType !== 'all' && r.type !== folhaFilterType) return false;
      return true;
    });
  }, [releases, folhaFilterMonth, folhaFilterYear, folhaFilterCategory, folhaFilterType]);

  const categorizedClients = useMemo(() => {
    const base = clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.ownerNames?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    return {
      monthly: base.filter(c => c.billingModel !== 'ONE_OFF'),
      single: base.filter(c => {
        if (c.billingModel !== 'ONE_OFF') return false;
        if (!c.createdAt) return false;
        const d = new Date(c.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonthNum;
      })
    };
  }, [clients, searchTerm, currentMonthNum, currentYear]);

  const stats = useMemo(() => {
    return computeStatsForMonth(clients, currentMonthNum, currentYear);
  }, [clients, currentMonthNum, currentYear]);

  const monthlyHistory = useMemo(() => {
    const history = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const mStats = computeStatsForMonth(clients, m, y);
      history.push({
        month: m,
        year: y,
        monthLabel: monthNames[m].substring(0, 3) + '/' + String(y).substring(2),
        fullLabel: `${monthNames[m]} de ${y}`,
        mrr: mStats.mrr,
        projects: mStats.projects,
        total: mStats.total,
        active: mStats.active,
        healthy: mStats.healthy,
        stats: mStats
      });
    }
    return history;
  }, [clients]);

  const updateClientStatus = async (clientId: string, status: ManagementFlag) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const updatedClient = { ...client, managementStatus: status };
    
    try {
      await storage.saveClient(updatedClient);
      setClients(prev => prev.map(c => c.id === clientId ? updatedClient : c));
      toast.success('Status atualizado');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  if (loading) {
    return (
      <div className="py-32 flex justify-center">
        <div className="w-8 h-8 rounded-full border-t-2 border-accent-mint animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Gestão de Carteira</h1>
          <p className="text-text-muted text-sm">Controle administrativo e financeiro da agência</p>
        </div>
        
        <div className="relative group w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-hover:text-accent-mint transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por cliente ou dono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-accent-mint/50 transition-all text-sm"
          />
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <button
          onClick={() => setActiveTab('portfolio')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all mb-[-1px] border cursor-pointer",
            activeTab === 'portfolio'
              ? "bg-accent-mint/10 border-accent-mint/20 text-accent-mint shadow-lg shadow-accent-mint/5"
              : "border-transparent text-text-secondary hover:text-white"
          )}
        >
          <Briefcase size={16} />
          Carteira Ativa
        </button>
        <button
          onClick={() => setActiveTab('progresso')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all mb-[-1px] border cursor-pointer",
            activeTab === 'progresso'
              ? "bg-accent-mint/10 border-accent-mint/20 text-accent-mint shadow-lg shadow-accent-mint/5"
              : "border-transparent text-text-secondary hover:text-white"
          )}
        >
          <TrendingUp size={16} />
          Progresso Mensal
        </button>
        <button
          onClick={() => setActiveTab('folha')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all mb-[-1px] border cursor-pointer",
            activeTab === 'folha'
              ? "bg-accent-mint/10 border-accent-mint/20 text-accent-mint shadow-lg shadow-accent-mint/5"
              : "border-transparent text-text-secondary hover:text-white"
          )}
        >
          <Calculator size={16} />
          FOLHA
        </button>
      </div>

      {activeTab === 'portfolio' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KPICard 
              label="Recorrência (MRR)" 
              value={stats.mrr} 
              isCurrency 
              icon={<DollarSign size={20} className="text-accent-mint" />}
              color="accent-mint"
            />
            <KPICard 
              label="Projetos Únicos" 
              value={stats.projects} 
              isCurrency 
              icon={<TrendingUp size={20} className="text-blue-400" />}
              color="blue-400"
            />
            <KPICard 
              label="Total em Carteira" 
              value={stats.mrr + stats.projects} 
              isCurrency 
              icon={<CheckCircle2 size={20} className="text-fuchsia-400" />}
              color="fuchsia-400"
            />
            <KPICard 
              label="Status Saudável" 
              value={`${Math.round((stats.healthy / stats.active) * 100 || 0)}%`} 
              icon={<CheckCircle2 size={20} className="text-white" />}
              color="white"
            />
          </div>

          {/* Financeiro / Pagamentos Section */}
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent-mint/10 rounded-lg">
                  <Calendar className="text-accent-mint" size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-medium tracking-tight">Fluxo de Caixa: {monthNames[currentMonthNum]}</h2>
                  <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest">Confirmação de recebimento mensal</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-4">
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-mint/5 rounded-full border border-accent-mint/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent-mint">Pago</span>
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-coral/5 rounded-full border border-accent-coral/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-coral" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent-coral">Pendente</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {categorizedClients.monthly.map((client) => {
                const payment = payments.find(p => p.clientId === client.id);
                const isPaid = payment?.status === 'PAID';
                
                return (
                  <motion.div 
                    key={client.id}
                    whileHover={{ y: -4 }}
                    onClick={() => togglePayment(client)}
                    className={cn(
                      "glass p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden",
                      isPaid ? "border-accent-mint/30 bg-accent-mint/[0.03]" : "border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-black shrink-0 shadow-lg transition-transform group-hover:scale-105" style={{ backgroundColor: client.brandColor }}>
                            {client.logo ? <img src={client.logo} className="w-full h-full object-cover rounded-xl" alt="" referrerPolicy="no-referrer" /> : client.name.charAt(0)}
                          </div>
                          {isPaid && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-mint rounded-full flex items-center justify-center text-black shadow-lg border-2 border-bg-base">
                              <Check size={10} strokeWidth={4} />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-xs text-white leading-tight truncate">{client.name}</span>
                          <span className="text-[10px] text-text-secondary mt-0.5">
                            {isVisible ? formatCurrency(client.planValue || 0) : '•••••'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                       {isPaid ? (
                         <div className="flex flex-col">
                            <span className="text-[10px] text-accent-mint font-bold uppercase tracking-tighter">Confirmado</span>
                            <span className="text-[8px] text-text-muted mt-0.5">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('pt-BR') : ''}</span>
                         </div>
                       ) : (
                         <div className="flex flex-col">
                            <span className="text-[10px] text-accent-coral font-bold uppercase tracking-tighter">Não Recebido</span>
                            <div className="flex items-center gap-1 mt-0.5">
                               <div className="w-1 h-1 rounded-full bg-accent-coral animate-pulse" />
                               <span className="text-[8px] text-text-muted italic">Aguardando...</span>
                            </div>
                         </div>
                       )}
                       
                       <button className={cn(
                         "px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all cursor-pointer",
                         isPaid ? "hover:bg-accent-coral/20 hover:text-accent-coral text-text-muted" : "bg-accent-mint text-black"
                       )}>
                         {isPaid ? 'Estornar' : 'Confirmar'}
                       </button>
                    </div>
                    
                    {/* Visual indicator corner */}
                    <div className={cn(
                      "absolute top-0 right-0 w-8 h-8 -mr-4 -mt-4 rotate-45 transition-colors",
                      isPaid ? "bg-accent-mint/20" : "bg-transparent"
                    )} />
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="space-y-12">
            {categorizedClients.monthly.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-mint" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted">Planos Mensais</h3>
                </div>
                <div className="glass rounded-3xl overflow-hidden border border-white/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                          <th className="px-6 py-4">Cliente</th>
                          <th className="px-6 py-4">Conteúdo / Captação</th>
                          <th className="px-6 py-4">Dono / Sócios</th>
                          <th className="px-6 py-4">Gestor</th>
                          <th className="px-6 py-4">Valor do Plano</th>
                          <th className="px-6 py-4">Status / Flag</th>
                          <th className="px-6 py-4">Contrato</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {categorizedClients.monthly.map((client) => (
                          <ClientRow key={client.id} client={client} updateStatus={updateClientStatus} isVisible={isVisible} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {categorizedClients.single.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted">Trabalhos Únicos</h3>
                </div>
                <div className="glass rounded-3xl overflow-hidden border border-white/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                          <th className="px-6 py-4">Cliente</th>
                          <th className="px-6 py-4">Conteúdo / Captação</th>
                          <th className="px-6 py-4">Dono / Sócios</th>
                          <th className="px-6 py-4">Gestor</th>
                          <th className="px-6 py-4">Valor do Trabalho</th>
                          <th className="px-6 py-4">Status / Flag</th>
                          <th className="px-6 py-4">Contrato</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {categorizedClients.single.map((client) => (
                          <ClientRow key={client.id} client={client} updateStatus={updateClientStatus} isVisible={isVisible} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {categorizedClients.monthly.length === 0 && categorizedClients.single.length === 0 && (
              <div className="py-20 text-center glass rounded-3xl border-dashed">
                <p className="text-text-muted italic">Nenhum cliente encontrado.</p>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'progresso' ? (
        <div className="space-y-8 animate-fade-in">
          {/* Card Gráfico interativo */}
          <div className="glass rounded-3xl p-6 border border-white/5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted">Curva de Crescimento</h3>
                <p className="text-[10px] text-text-secondary mt-1">Evolução do MRR e Projetos Únicos nos últimos 12 meses</p>
              </div>
              
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5 text-accent-mint">
                  <div className="w-2 h-2 rounded-full bg-accent-mint" />
                  <span>Recorrência (MRR)</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-400">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Projetos Únicos</span>
                </div>
                <div className="flex items-center gap-1.5 text-fuchsia-400">
                  <div className="w-2 h-2 bg-fuchsia-400 rounded-full" />
                  <span>Total</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyHistory}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d442ff" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#d442ff" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ffcc" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#00ffcc" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="monthLabel" 
                    stroke="#4B5563" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#4B5563" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R$ ${v >= 1000 ? (v / 1000) + 'k' : v}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181B', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullLabel;
                      }
                      return label;
                    }}
                    formatter={(value: any) => [formatCurrency(value), '']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#f44336" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" name="Total" />
                  <Area type="monotone" dataKey="mrr" stroke="#00ffcc" strokeWidth={2} fillOpacity={1} fill="url(#colorMrr)" name="MRR" />
                  <Line type="monotone" dataKey="projects" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} name="Projetos" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Grid de Meses Clickáveis */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted">Selecione o Mês para Auditar</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {monthlyHistory.map((item, index) => {
                const isSelected = selectedMonthIndex === index;
                const prevItem = index > 0 ? monthlyHistory[index - 1] : null;
                const totalDiff = prevItem ? item.total - prevItem.total : 0;
                const totalIsUp = totalDiff > 0;
                const totalIsDown = totalDiff < 0;

                return (
                  <motion.div
                    key={item.monthLabel}
                    whileHover={{ y: -4 }}
                    onClick={() => setSelectedMonthIndex(index)}
                    className={cn(
                      "glass p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group select-none",
                      isSelected 
                        ? "border-accent-mint/40 bg-accent-mint/[0.03] shadow-lg shadow-accent-mint/5" 
                        : "border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        isSelected ? "text-accent-mint font-black" : "text-text-muted"
                      )}>
                        {item.monthLabel}
                      </span>
                      {totalDiff !== 0 && (
                        <span className={cn(
                          "text-[8px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full leading-none",
                          totalIsUp ? "bg-accent-mint/10 text-accent-mint" : "bg-accent-coral/10 text-accent-coral"
                        )}>
                          {totalIsUp ? '▲' : '▼'} {formatCurrency(Math.abs(totalDiff)).replace('R$', '').trim()}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted block">Total Faturado</span>
                      <p className="text-lg font-semibold text-white tracking-tight leading-none pt-0.5">
                        {isVisible ? formatCurrency(item.total) : '•••••'}
                      </p>
                    </div>
                    
                    <div className={cn(
                      "absolute top-0 right-0 w-8 h-8 -mr-4 -mt-4 rotate-45 transition-colors",
                      isSelected ? "bg-accent-mint/10" : "bg-transparent"
                    )} />
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Painel do Mês Selecionado */}
          {selectedMonthIndex !== null && (
            <div className="space-y-6 pt-4 border-t border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-medium tracking-tight text-white flex items-center gap-2">
                    <span>Detalhamento:</span>
                    <span className="text-accent-mint">{monthlyHistory[selectedMonthIndex].fullLabel}</span>
                  </h2>
                  <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest mt-1">Estatísticas consolidada e faturamento por cliente nesse mês</p>
                </div>
                <div className="text-[10px] font-bold uppercase text-text-muted italic bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                  Ref: {monthlyHistory[selectedMonthIndex].monthLabel}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard 
                  label="Recorrência (MRR)" 
                  value={monthlyHistory[selectedMonthIndex].mrr} 
                  isCurrency 
                  icon={<DollarSign size={20} className="text-accent-mint" />}
                  color="accent-mint"
                />
                <KPICard 
                  label="Projetos Únicos" 
                  value={monthlyHistory[selectedMonthIndex].projects} 
                  isCurrency 
                  icon={<TrendingUp size={20} className="text-blue-400" />}
                  color="blue-400"
                />
                <KPICard 
                  label="Total em Carteira" 
                  value={monthlyHistory[selectedMonthIndex].total} 
                  isCurrency 
                  icon={<CheckCircle2 size={20} className="text-fuchsia-400" />}
                  color="fuchsia-400"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Planos */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-mint" />
                    Planos Recorrentes Ativos ({monthlyHistory[selectedMonthIndex].stats.recurringClients.length})
                  </h4>
                  <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-white/[0.01] border-b border-white/5 text-[9px] font-bold uppercase tracking-wider text-text-muted">
                          <th className="px-4 py-3">Cliente</th>
                          <th className="px-4 py-3">Dono</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                          <th className="px-4 py-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {monthlyHistory[selectedMonthIndex].stats.recurringClients.map((client: Client) => (
                          <tr key={client.id} className="hover:bg-white/[0.01] transition-all">
                            <td className="px-4 py-3 font-medium text-white">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-black" style={{ backgroundColor: client.brandColor }}>
                                  {client.logo ? <img src={client.logo} className="w-full h-full object-cover rounded" alt="" referrerPolicy="no-referrer" /> : client.name.charAt(0)}
                                </div>
                                <span className="truncate max-w-[120px]">{client.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-text-secondary truncate max-w-[100px]">{client.ownerNames || '—'}</td>
                            <td className="px-4 py-3 text-right text-accent-mint font-medium">{isVisible ? formatCurrency(client.planValue || 0) : '•••••'}</td>
                            <td className="px-4 py-3 text-right">
                              <Link to={`/clientes/${client.id}`} className="text-text-muted hover:text-white transition-colors">
                                Ver Carteira ↗
                              </Link>
                            </td>
                          </tr>
                        ))}
                        {monthlyHistory[selectedMonthIndex].stats.recurringClients.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-text-muted italic">Nenhum plano recorrente neste mês.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Projetos únicos */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Projetos Únicos ({monthlyHistory[selectedMonthIndex].stats.oneOffClients.length})
                  </h4>
                  <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-white/[0.01] border-b border-white/5 text-[9px] font-bold uppercase tracking-wider text-text-muted">
                          <th className="px-4 py-3">Cliente</th>
                          <th className="px-4 py-3">Dono</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                          <th className="px-4 py-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {monthlyHistory[selectedMonthIndex].stats.oneOffClients.map((client: Client) => (
                          <tr key={client.id} className="hover:bg-white/[0.01] transition-all">
                            <td className="px-4 py-3 font-medium text-white">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-black" style={{ backgroundColor: client.brandColor }}>
                                  {client.logo ? <img src={client.logo} className="w-full h-full object-cover rounded" alt="" referrerPolicy="no-referrer" /> : client.name.charAt(0)}
                                </div>
                                <span className="truncate max-w-[120px]">{client.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-text-secondary truncate max-w-[100px]">{client.ownerNames || '—'}</td>
                            <td className="px-4 py-3 text-right text-blue-400 font-medium">{isVisible ? formatCurrency(client.planValue || 0) : '•••••'}</td>
                            <td className="px-4 py-3 text-right">
                              <Link to={`/clientes/${client.id}`} className="text-text-muted hover:text-white transition-colors">
                                Ver Carteira ↗
                              </Link>
                            </td>
                          </tr>
                        ))}
                        {monthlyHistory[selectedMonthIndex].stats.oneOffClients.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-text-muted italic">Nenhum projeto único neste mês.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in text-white">
          {/* LUCRO REAL BANNER */}
          <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-r from-accent-mint/15 via-bg-base/20 to-bg-base border border-accent-mint/30 shadow-[0_0_20px_rgba(0,255,204,0.05)]">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-accent-mint uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse" />
                  Lucro Real Consolidado
                </span>
                <h2 className="text-2xl font-bold tracking-tight">
                  Lucro Líquido: <span className="text-accent-mint">{formatCurrency(sums.lucroLiquido)}</span>
                </h2>
                <p className="text-xs text-text-muted">
                  Fórmula oficial: <span className="font-mono text-white">LUCRO = RECEITAS ({formatCurrency(sums.receita)}) - GASTOS ({formatCurrency(sums.gastos)}) - INVESTIMENTOS ({formatCurrency(sums.investimentos)})</span>
                </p>
              </div>
              <div className="flex items-center gap-2 bg-white/5 py-2 px-4 rounded-2xl border border-white/5 self-start md:self-auto">
                <Calculator size={18} className="text-accent-mint" />
                <div className="text-left font-mono">
                  <span className="text-[9px] uppercase tracking-wider text-text-muted block leading-none">Saldo Atual</span>
                  <span className="text-sm font-bold text-white block">
                    {formatCurrency(sums.saldoAtual)} <span className="text-[9px] font-normal text-text-muted">(Rec. - Gast.)</span>
                  </span>
                </div>
              </div>
            </div>
            
            <div className="absolute right-0 top-0 w-48 h-48 bg-accent-mint/5 rounded-full blur-[80px]" />
          </div>

          {/* RESUMO FINANCEIRO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass rounded-3xl p-6 border border-accent-mint/20 space-y-2 hover:border-accent-mint/40 transition-colors shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Receitas Totais</span>
                <div className="p-2 bg-accent-mint/10 rounded-xl">
                  <CheckCircle2 size={18} className="text-accent-mint" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-accent-mint tracking-tight">
                  {isVisible ? formatCurrency(sums.receita) : '•••••'}
                </h3>
                <p className="text-[10px] text-text-muted font-medium text-accent-mint/80">Sincronizado da Carteira Ativa</p>
              </div>
            </div>

            <div className="glass rounded-3xl p-6 border border-red-500/10 space-y-2 hover:border-red-500/20 transition-colors shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Gastos Totais</span>
                <div className="p-2 bg-red-400/10 rounded-xl">
                  <XCircle size={18} className="text-red-400" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-red-400 tracking-tight">
                  {isVisible ? formatCurrency(sums.gastos) : '•••••'}
                </h3>
                <p className="text-[10px] text-text-muted">Saídas operacionais</p>
              </div>
            </div>

            <div className="glass rounded-3xl p-6 border border-white/5 space-y-2 hover:border-white/10 transition-colors shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Lucro Líquido</span>
                <div className="p-2 bg-accent-mint/5 rounded-xl">
                  <Calculator size={18} className="text-accent-mint" />
                </div>
              </div>
              <div className="space-y-1 relative z-10">
                <h3 className="text-2xl font-bold text-white tracking-tight drop-shadow-[0_0_15px_rgba(0,255,204,0.15)] flex items-center gap-1.5">
                  {isVisible ? formatCurrency(sums.lucroLiquido) : '•••••'}
                  <span className="text-[10px] font-bold text-accent-mint bg-accent-mint/10 px-1.5 py-0.5 rounded-full">Mint</span>
                </h3>
                <p className="text-[10px] text-text-muted">Ebitda operacional do mês</p>
              </div>
              <div className="absolute top-0 right-0 w-12 h-12 bg-accent-mint/5 rounded-full blur-2xl" />
            </div>

            <div className="glass rounded-3xl p-6 border border-amber-500/15 space-y-2 hover:border-amber-500/25 transition-colors shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Investimentos</span>
                <div className="p-2 bg-amber-400/10 rounded-xl">
                  <TrendingUp size={18} className="text-amber-400" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-amber-400 tracking-tight">
                  {isVisible ? formatCurrency(sums.investimentos) : '•••••'}
                </h3>
                <p className="text-[10px] text-text-muted">Alocações de longo prazo</p>
              </div>
            </div>
          </div>

          {/* FILTROS E LANÇAMENTO FINANCEIRO */}
          <div className="glass rounded-3xl p-6 border border-white/5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-xl">
                  <Filter size={18} className="text-text-muted" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Filtros Avançados</h4>
                  <p className="text-[10px] text-text-secondary">Filtrar os lançamentos do histórico financeiro</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 lg:max-w-3xl">
                <div>
                  <label className="text-[9px] font-bold text-text-muted uppercase block mb-1">Mês</label>
                  <select
                    value={folhaFilterMonth}
                    onChange={(e) => setFolhaFilterMonth(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-accent-mint/40 cursor-pointer text-white"
                  >
                    <option value="all">Todos os Meses</option>
                    {monthNames.map((name, idx) => (
                      <option key={idx} value={(idx + 1).toString()}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-text-muted uppercase block mb-1">Ano</label>
                  <select
                    value={folhaFilterYear}
                    onChange={(e) => setFolhaFilterYear(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-accent-mint/40 cursor-pointer text-white"
                  >
                    <option value="all">Todos os Anos</option>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-text-muted uppercase block mb-1">Categoria</label>
                  <select
                    value={folhaFilterCategory}
                    onChange={(e) => setFolhaFilterCategory(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-accent-mint/40 cursor-pointer text-white"
                  >
                    <option value="all">Todas</option>
                    <option value="Tráfego Pago">Tráfego Pago</option>
                    <option value="Freelancer">Freelancer</option>
                    <option value="Ferramentas">Ferramentas</option>
                    <option value="Software">Software</option>
                    <option value="Assinaturas">Assinaturas</option>
                    <option value="Equipamentos">Equipamentos</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Combustível">Combustível</option>
                    <option value="Alimentação">Alimentação</option>
                    <option value="Escritório">Escritório</option>
                    <option value="Impostos">Impostos</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-text-muted uppercase block mb-1">Tipo</label>
                  <select
                    value={folhaFilterType}
                    onChange={(e) => setFolhaFilterType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-accent-mint/40 cursor-pointer text-white"
                  >
                    <option value="all">Todos</option>
                    <option value="RECEITA">Receita</option>
                    <option value="GASTO">Gasto</option>
                    <option value="INVESTIMENTO">Investimento</option>
                  </select>
                </div>
              </div>

              <div className="self-end lg:self-center">
                <button
                  type="button"
                  onClick={() => setIsReleaseModalOpen(true)}
                  className="bg-accent-mint text-black px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all w-full cursor-pointer"
                >
                  <Plus size={16} />
                  Novo Lançamento
                </button>
              </div>
            </div>
          </div>

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* HISTÓRICO FINANCEIRO */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-mint" />
                  Histórico de Lançamentos ({filteredReleases.length})
                </h3>
              </div>

              <div className="glass rounded-3xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto font-sans">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/[0.01] border-b border-white/5 text-[9px] font-bold uppercase tracking-widest text-text-muted">
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Descrição</th>
                        <th className="px-6 py-4">Categoria</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4 text-right">Valor</th>
                        <th className="px-6 py-4 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredReleases
                        .sort((a, b) => new Date(b.date + "T12:00:00").getTime() - new Date(a.date + "T12:00:00").getTime())
                        .map((rel) => (
                          <tr key={rel.id} className="hover:bg-white/[0.01] transition-all group">
                            <td className="px-6 py-4 font-medium text-text-secondary whitespace-nowrap">
                              {new Date(rel.date + "T12:00:00").toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 font-semibold text-white">
                              <div>
                                <span className="block">{rel.description}</span>
                                {rel.observation && (
                                  <span className="block text-[10px] text-text-muted font-normal italic mt-0.5">{rel.observation}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] bg-white/5 px-2.5 py-1 rounded-full border border-white/5 font-medium whitespace-nowrap">
                                {rel.category}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {rel.type === 'RECEITA' ? (
                                <span className="text-[9px] font-bold uppercase tracking-widest text-accent-mint bg-accent-mint/10 border border-accent-mint/20 px-2 py-0.5 rounded">
                                  Receita
                                </span>
                              ) : rel.type === 'GASTO' ? (
                                <span className="text-[9px] font-bold uppercase tracking-widest text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded">
                                  Gasto
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                                  Investimento
                                </span>
                              )}
                            </td>
                            <td className={`px-6 py-4 text-right font-bold font-mono text-xs whitespace-nowrap ${
                              rel.type === 'RECEITA' ? 'text-accent-mint' : rel.type === 'GASTO' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                              {isVisible ? formatCurrency(rel.value) : '•••••'}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRelease(rel.id)}
                                className="p-1 px-2 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer border-0 bg-transparent"
                                title="Deletar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}

                      {filteredReleases.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-16 text-center text-text-muted italic">
                            Nenhum lançamento no filtro selecionado. Adicione clicando em "+ Novo Lançamento".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* INDICADORES */}
              <div className="glass rounded-3xl p-6 border border-white/5 space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse" />
                    Indicadores Financeiros de Apoio
                  </h4>
                  <p className="text-[10px] text-text-secondary mt-1">Estatísticas complementares calculadas sob o período ativo</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[9px] text-text-muted uppercase font-bold block">Investimentos Totais</span>
                    <p className="text-lg font-bold text-amber-400">{formatCurrency(indicators.totalInvestido)}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[9px] text-text-muted uppercase font-bold block">Entradas Totais</span>
                    <p className="text-lg font-bold text-accent-mint">{formatCurrency(indicators.totalRecebido)}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[9px] text-text-muted uppercase font-bold block">Gasto Médio Mensal</span>
                    <p className="text-lg font-bold text-red-400">{formatCurrency(indicators.mediaMensalGastos)}</p>
                    <span className="text-[8px] text-text-muted italic block">Média histórica geral</span>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[9px] text-text-muted uppercase font-bold block">Receita Média Mensal</span>
                    <p className="text-lg font-bold text-accent-mint">{formatCurrency(indicators.mediaMensalReceita)}</p>
                    <span className="text-[8px] text-text-muted italic block">Média histórica geral</span>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <h5 className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-left">Saídas Detalhadas por Categoria (Gastos + Investimentos)</h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Object.entries(indicators.categoryTotals).map(([cat, val]) => (
                      <div key={cat} className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between text-left">
                        <span className="text-[10px] font-medium text-text-secondary truncate">{cat}</span>
                        <span className="text-xs font-bold text-white mt-1">{formatCurrency(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* META FINANCEIRA */}
              <div className="glass rounded-3xl p-6 border border-white/5 space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target size={18} className="text-accent-mint" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted">Meta do Faturamento</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingGoal(!isEditingGoal);
                    }}
                    className="text-[10px] text-accent-mint uppercase font-bold hover:underline cursor-pointer bg-transparent border-0"
                  >
                    {isEditingGoal ? 'Cancelar' : 'Alterar'}
                  </button>
                </div>

                {isEditingGoal ? (
                  <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <label className="text-[9px] uppercase font-bold text-text-muted block">Meta Mensal (R$)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Ex: 20000"
                        value={goalTargetValue}
                        onChange={(e) => setGoalTargetValue(e.target.value)}
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-xs outline-none text-white focus:border-accent-mint w-full"
                      />
                      <button
                        type="button"
                        onClick={handleSaveGoal}
                        className="bg-accent-mint text-black text-xs font-bold px-3 py-1.5 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer border-0"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[10px] text-text-secondary uppercase block">Progresso do Mês</span>
                        <p className="text-base font-bold text-white mt-1">
                          {formatCurrency(sums.receita)} <span className="text-xs text-text-muted font-normal">de {formatCurrency(parseFloat(currentGoalValue))}</span>
                        </p>
                      </div>
                      <span className="text-xs font-bold text-accent-mint">
                        {Math.round((sums.receita / parseFloat(currentGoalValue)) * 100 || 0)}%
                      </span>
                    </div>

                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                      <div
                        className="bg-accent-mint h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,255,204,0.5)]"
                        style={{ width: `${Math.min(100, Math.round((sums.receita / parseFloat(currentGoalValue)) * 100 || 0))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CENTRO DE CUSTOS */}
              <div className="glass rounded-3xl p-6 border border-white/5 space-y-4 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded bg-accent-mint" />
                  <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted">Centro de Custos</h4>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.01] border border-white/5">
                    <span className="text-xs text-text-secondary font-medium">Operação</span>
                    <span className="text-sm font-bold text-white font-mono">{formatCurrency(costCenter.operacao)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.01] border border-white/5">
                    <span className="text-xs text-text-secondary font-medium">Marketing</span>
                    <span className="text-sm font-bold text-white font-mono">{formatCurrency(costCenter.marketing)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.01] border border-white/5">
                    <span className="text-xs text-text-secondary font-medium">Ferramentas</span>
                    <span className="text-sm font-bold text-white font-mono">{formatCurrency(costCenter.ferramentas)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.01] border border-white/5">
                    <span className="text-xs text-text-secondary font-medium">Freelancers</span>
                    <span className="text-sm font-bold text-white font-mono">{formatCurrency(costCenter.freelancers)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.01] border border-white/5">
                    <span className="text-xs text-text-secondary font-medium">Equipamentos</span>
                    <span className="text-sm font-bold text-white font-mono">{formatCurrency(costCenter.equipamentos)}</span>
                  </div>
                </div>
              </div>

              {/* CONTAS RECORRENTES */}
              <div className="glass rounded-3xl p-6 border border-white/5 space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PiggyBank size={18} className="text-accent-mint" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted">Contas Recorrentes</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBillModalOpen(true)}
                    className="text-[10px] text-accent-mint uppercase font-bold flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-0"
                  >
                    <Plus size={10} /> Add Fixed
                  </button>
                </div>

                <div className="space-y-3.5">
                  {recurringBills.map((bill) => {
                    const todayDay = new Date().getDate();
                    const isVencendoHoje = bill.dueDay === todayDay;
                    const isProximo = (bill.dueDay > todayDay && bill.dueDay - todayDay <= 3);
                    
                    return (
                      <div key={bill.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start justify-between gap-2 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white">{bill.description}</span>
                            {isVencendoHoje && (
                              <span className="text-[8px] font-bold uppercase text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 whitespace-nowrap">
                                <Bell size={8} className="text-red-400 animate-bounce" /> Vence Hoje!
                              </span>
                            )}
                            {isProximo && (
                              <span className="text-[8px] font-bold uppercase text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 whitespace-nowrap">
                                <AlertCircle size={8} className="text-amber-400 animate-pulse" /> Vence em {bill.dueDay - todayDay} ds
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-accent-mint leading-none font-mono mt-0.5">
                            {formatCurrency(bill.value)} <span className="text-[9px] font-normal text-text-muted">/mês</span>
                          </p>
                          <span className="text-[9px] text-text-muted block">Dia vencimento: <span className="text-white font-mono">{bill.dueDay}</span></span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecurringBill(bill.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors cursor-pointer border-0 bg-transparent"
                          title="Remover"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}

                  {recurringBills.length === 0 && (
                    <div className="py-8 text-center text-text-muted italic text-[11px]">
                      Nenhuma conta fixa cadastrada. Cadastre clicando em "Add Fixed".
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* NOVO LANÇAMENTO MODAL */}
      {isReleaseModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-bg-elevated border border-white/10 rounded-3xl p-6 w-full max-w-lg space-y-6 shadow-2xl relative text-left"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Registrar Lançamento Financeiro</h3>
              <button
                type="button"
                onClick={() => setIsReleaseModalOpen(false)}
                className="text-text-muted hover:text-white text-lg font-bold cursor-pointer bg-transparent border-none outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRelease} className="space-y-4 text-white">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none text-white focus:border-accent-mint"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Valor (R$)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 150,00"
                    value={releaseValue}
                    onChange={(e) => setReleaseValue(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none text-white focus:border-accent-mint"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Licença da ferramenta X"
                  value={releaseDescription}
                  onChange={(e) => setReleaseDescription(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none text-white focus:border-accent-mint"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Tipo de Movimentação</label>
                  <select
                    value={releaseType}
                    onChange={(e) => setReleaseType(e.target.value as any)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none text-white focus:border-accent-mint cursor-pointer"
                  >
                    <option value="RECEITA">Receita</option>
                    <option value="GASTO">Gasto (Despesa)</option>
                    <option value="INVESTIMENTO">Investimento</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Categoria</label>
                  <select
                    value={releaseCategory}
                    onChange={(e) => setReleaseCategory(e.target.value as any)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none text-white focus:border-accent-mint cursor-pointer"
                  >
                    <option value="Tráfego Pago">Tráfego Pago</option>
                    <option value="Freelancer">Freelancer</option>
                    <option value="Ferramentas">Ferramentas</option>
                    <option value="Software">Software</option>
                    <option value="Assinaturas">Assinaturas</option>
                    <option value="Equipamentos">Equipamentos</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Combustível">Combustível</option>
                    <option value="Alimentação">Alimentação</option>
                    <option value="Escritório">Escritório</option>
                    <option value="Impostos">Impostos</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Observação (Opcional)</label>
                <textarea
                  placeholder="Ex: Referente ao projeto do cliente X"
                  value={releaseObservation}
                  onChange={(e) => setReleaseObservation(e.target.value)}
                  rows={2}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs outline-none text-white focus:border-accent-mint resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReleaseModalOpen(false)}
                  className="flex-1 bg-white/5 border border-white/10 text-white rounded-xl py-2.5 text-xs font-bold hover:bg-white/10 transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-accent-mint text-black rounded-xl py-2.5 text-xs font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer border-none"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ADICIONAR CONTA RECORRENTE MODAL */}
      {isBillModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-bg-elevated border border-white/10 rounded-3xl p-6 w-full max-w-sm space-y-6 shadow-2xl relative text-left"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Nova Conta Recorrente</h3>
              <button
                type="button"
                onClick={() => setIsBillModalOpen(false)}
                className="text-text-muted hover:text-white text-lg font-bold cursor-pointer bg-transparent border-none outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRecurringBill} className="space-y-4 text-white font-sans">
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Descrição / Fornecedor</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: ChatGPT Plus, Adobe"
                  value={billDescription}
                  onChange={(e) => setBillDescription(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none text-white focus:border-accent-mint shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Valor Mensal (R$)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 120,00"
                    value={billValue}
                    onChange={(e) => setBillValue(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none text-white focus:border-accent-mint"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Dia do Vencimento</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={billDueDay}
                    onChange={(e) => setBillDueDay(parseInt(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none text-white focus:border-accent-mint"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBillModalOpen(false)}
                  className="flex-1 bg-white/5 border border-white/10 text-white rounded-xl py-2.5 text-xs font-bold hover:bg-white/10 transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-accent-mint text-black rounded-xl py-2.5 text-xs font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer border-none"
                >
                  Adicionar Conta
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ClientRow({ client, updateStatus, isVisible }: any) {
  const stats = getClientMonthStats(client);

  return (
    <tr key={client.id} className="hover:bg-white/[0.01] transition-colors group">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black shrink-0" style={{ backgroundColor: client.brandColor }}>
              {client.logo ? <img src={client.logo} className="w-full h-full object-cover rounded-lg" alt="" /> : client.name.charAt(0)}
            </div>
            {isContentDelayed(client) && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-coral rounded-full border-2 border-bg-base animate-pulse shadow-[0_0_8px_rgba(255,77,77,0.8)]" />
            )}
          </div>
          <div className="flex flex-col">
            <span className={cn("font-medium text-sm transition-colors", isContentDelayed(client) ? "text-accent-coral" : "text-white")}>{client.name}</span>
            {isContentDelayed(client) && (
              <span className="text-[8px] font-bold text-accent-coral uppercase leading-none mt-0.5">Postagem Atrasada</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1.5 min-w-[120px]">
          <div className="flex items-center justify-between gap-4">
             <div className="flex items-center gap-1.5">
                <Play size={12} className="text-accent-mint" />
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Vídeos</span>
             </div>
             <span className="text-xs font-medium text-white">{stats.contentDone}/{stats.contentTotal}</span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
             <div 
               className="h-full bg-accent-mint transition-all" 
               style={{ width: `${(stats.contentDone / Math.max(stats.contentTotal, 1)) * 100}%` }} 
             />
          </div>
          
          <div className="flex items-center justify-between gap-4 mt-1">
             <div className="flex items-center gap-1.5">
                <Camera size={12} className="text-fuchsia-400" />
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Captação</span>
             </div>
             <span className="text-xs font-medium text-white">{stats.capturesDone}/{stats.capturesTotal}</span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
             <div 
               className="h-full bg-fuchsia-400 transition-all" 
               style={{ width: `${(stats.capturesDone / Math.max(stats.capturesTotal, 1)) * 100}%` }} 
             />
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-text-secondary italic">
        {client.ownerNames || 'Não informado'}
      </td>
      <td className="px-6 py-4">
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md",
          client.accountManager === 'Não tem gestor' ? "bg-accent-coral/10 text-accent-coral border border-accent-coral/20" : "bg-white/5 text-text-secondary"
        )}>
          {client.accountManager || 'Pendente'}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {isVisible ? formatCurrency(client.planValue || 0) : '•••••'}
            </span>
            <span className={cn(
              "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter",
              client.billingModel === 'ONE_OFF' ? "bg-blue-400/10 text-blue-400 border border-blue-400/20" : "bg-accent-mint/10 text-accent-mint border border-accent-mint/20"
            )}>
              {client.billingModel === 'ONE_OFF' ? 'Projeto' : 'Mensal'}
            </span>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <StatusDropdown 
          status={client.managementStatus || 'GREEN'} 
          onChange={(s) => updateStatus(client.id, s)} 
        />
      </td>
      <td className="px-6 py-4">
        {client.contractUrl ? (
          <a 
            href={client.contractUrl} 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-2 text-accent-mint hover:underline text-xs font-medium"
          >
            <FileText size={14} /> Link do Contrato
          </a>
        ) : (
          <span className="text-xs text-text-muted">Sem link</span>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <Link to={`/clientes/${client.id}`} className="p-2 hover:bg-white/5 rounded-lg inline-block text-text-muted hover:text-white transition-colors">
          <ExternalLink size={16} />
        </Link>
      </td>
    </tr>
  );
}

function KPICard({ label, value, isCurrency = false, icon, color }: any) {
  const { isVisible } = useVisibility();
  return (
    <div className="glass p-6 rounded-2xl relative group overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary group-hover:text-white transition-colors">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-medium tracking-tighter">
          {isVisible ? (isCurrency ? formatCurrency(value).replace('R$', '').trim() : value) : '•••••'}
        </span>
        {isVisible && isCurrency && <span className="text-sm text-text-muted font-bold">BRL</span>}
      </div>
      <div className={cn(
        "absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-transparent opacity-0 group-hover:opacity-100 transition-opacity",
        `via-${color}/20`
      )} />
    </div>
  );
}

function StatusDropdown({ status, onChange }: { status: ManagementFlag, onChange: (s: ManagementFlag) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const configs = {
    GREEN: { label: 'Saudável', color: 'bg-accent-mint', icon: CheckCircle2, text: 'text-accent-mint' },
    YELLOW: { label: 'Instável', color: 'bg-yellow-400', icon: AlertTriangle, text: 'text-yellow-400' },
    RED: { label: 'Crítico', color: 'bg-accent-coral', icon: XCircle, text: 'text-accent-coral' },
  };

  const current = configs[status];

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[10px] font-bold uppercase tracking-wider",
          status === 'GREEN' ? "border-accent-mint/20 bg-accent-mint/5 text-accent-mint" :
          status === 'YELLOW' ? "border-yellow-400/20 bg-yellow-400/5 text-yellow-400" :
          "border-accent-coral/20 bg-accent-coral/5 text-accent-coral"
        )}
      >
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", current.color)} />
        {current.label}
        <ChevronDown size={12} className={cn("transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-40 bg-bg-elevated border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
            {(Object.keys(configs) as ManagementFlag[]).map((s) => {
              const conf = configs[s];
              return (
                <button
                  key={s}
                  onClick={() => {
                    onChange(s);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors text-left"
                >
                  <div className={cn("w-2 h-2 rounded-full", conf.color)} />
                  <span className={cn("text-[10px] font-bold uppercase tracking-widest", conf.text)}>{conf.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

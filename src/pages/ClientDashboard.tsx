import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  TrendingUp, TrendingDown, Clock, Plus, FileText, 
  BarChart3, Settings, Share2, Maximize2, Download,
  ArrowRight, Users, CreditCard, DollarSign, Target, PlusCircle, Trash2, Edit2, ChevronDown, CheckCircle2, AlertCircle, Info, Minimize2, ExternalLink, Camera, CalendarDays, Play, X, MessageSquare, Key, Lock, Copy, Eye, EyeOff,
  Layers, CheckSquare, User
} from 'lucide-react';
import { useEntries } from '../hooks/useMetrics';
import { storage } from '../lib/storage';
import { calculateMetrics, getHealthStatus, generateInsights } from '../lib/calculations';
import { cn, formatCurrency, formatPercent, formatNumber } from '../lib/utils';
import { useVisibility } from '../contexts/VisibilityContext';
import { Creative } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { toast } from 'sonner';

const BUSINESS_CONFIGS: Record<string, any> = {
  REAL_ESTATE: {
    label: 'Imobiliária',
    funnel: ['leads', 'bookings', 'sales'],
    labels: { leads: 'Leads', bookings: 'Visitas', sales: 'Contratos' },
    hideCac: true,
    hideProfit: true
  },
  INFO_PRODUCTS: {
    label: 'Infoprodutos',
    funnel: ['leads', 'sales'],
    labels: { leads: 'Leads', sales: 'Vendas' }
  },
  LOCAL_BUSINESS: {
    label: 'Negócio Local',
    funnel: ['leads', 'sales'],
    labels: { leads: 'Contatos', sales: 'Vendas' }
  },
  ECOMMERCE: {
    label: 'E-commerce',
    funnel: ['sessions', 'addCart', 'purchases'],
    labels: { sessions: 'Sessões', addCart: 'Carrinhos', purchases: 'Vendas' }
  },
  SERVICE_BOOKING: {
    label: 'Serviço com Agendamento',
    funnel: ['leads', 'bookings', 'shows', 'sales'],
    labels: { leads: 'Leads', bookings: 'Agendam.', shows: 'Comparec.', sales: 'Vendas' }
  },
  B2B_LEADS: {
    label: 'Captação Leads B2B',
    funnel: ['leads', 'mqls', 'sales'],
    labels: { leads: 'Leads', mqls: 'MQLs', sales: 'Vendas' }
  },
  WHATSAPP: {
    label: 'WhatsApp',
    funnel: ['waClicks', 'waConversations', 'sales'],
    labels: { waClicks: 'Cliques', waConversations: 'Conversas', sales: 'Vendas' }
  },
  LAUNCH: {
    label: 'Lançamento',
    funnel: ['leads', 'sales', 'clicks', 'cpm'],
    labels: { leads: 'Leads', sales: 'Vendas', clicks: 'Cliques', cpm: 'CPM' },
    isLaunch: true
  },
  VIDEO_PRODUCTION: {
    label: 'Produção de Vídeo',
    funnel: ['projects', 'recording', 'delivered'],
    labels: { projects: 'Pautas/Projetos', recording: 'Gravações', delivered: 'Entregues' },
    hideCac: true,
    hideRevenue: true
  },
  CONTENT_EDITING: {
    label: 'Edição de Conteúdo',
    funnel: ['raw', 'editing', 'delivered'],
    labels: { raw: 'Brutos', editing: 'Em Edição', delivered: 'Entregues' },
    hideCac: true,
    hideRevenue: true
  }
};

const isContentDelayed = (client: any, refDate: Date = new Date()) => {
  const today = new Date();
  const realCurrentMonth = today.getMonth();
  const realCurrentYear = today.getFullYear();
  
  const currentMonth = refDate.getMonth();
  const currentYear = refDate.getFullYear();

  // ONLY red for the current real-world month
  if (currentMonth !== realCurrentMonth || currentYear !== realCurrentYear) {
    return false;
  }
  
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
      // Check days in the month up to the reference date (or today if reference is current month)
      // Actually, we only care about delays relative to "today".
      // If we are looking at a past month, we check the whole month.
      // If we are looking at future month, no delays.
      // If we are looking at current month, we check up to yesterday.
      
      const isPastMonth = (currentYear < today.getFullYear()) || (currentYear === today.getFullYear() && currentMonth < today.getMonth());
      const isCurrentMonth = (currentYear === today.getFullYear() && currentMonth === today.getMonth());
      const isFutureMonth = (currentYear > today.getFullYear()) || (currentYear === today.getFullYear() && currentMonth > today.getMonth());

      if (isFutureMonth) return false;

      const lastDayToCheck = isCurrentMonth ? today.getDate() - 1 : new Date(currentYear, currentMonth + 1, 0).getDate();
      
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

export function ClientDashboard() {
  const { id } = useParams<{ id: string }>();
  const { isVisible } = useVisibility();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'entries' | 'report' | 'settings' | 'processos'>('overview');
  const [isPresenting, setIsPresenting] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'monthly'>('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [client, setClient] = useState<any>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [clientTasks, setClientTasks] = useState<any[]>([]);
  const [clientCreatives, setClientCreatives] = useState<Creative[]>([]);
  const [processesList, setProcessesList] = useState<any[]>([]);
  const [columnsList, setColumnsList] = useState<any[]>([]);
  
  useEffect(() => {
    if (id) {
      storage.getClients().then(clients => {
        const found = clients.find(c => c.id === id);
        setClient(found);
        setLoadingClient(false);
      });

      // Listen to processes and columns for detail references
      const unsubProcesses = storage.listenToProcesses((list) => {
        setProcessesList(list);
      });

      // Listen to all tasks and filter by client
      const unsubTasks = storage.listenToAllTasks((list) => {
        const filtered = list.filter(t => t.clientId === id);
        setClientTasks(filtered);
      });

      // Listen to creatives and filter by client
      const unsubCreatives = storage.listenToCreatives((list) => {
        const filtered = list.filter(c => c.clientId === id);
        setClientCreatives(filtered);
      });

      return () => {
        unsubProcesses();
        unsubTasks();
        unsubCreatives();
      };
    }
  }, [id]);
  
  useEffect(() => {
    const handleFsChange = () => {
      setIsPresenting(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const togglePresentation = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        setIsPresenting(true); // Fallback to viewport-only fullscreen if API fails
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleDeleteCreative = async (creative: Creative) => {
    if (!window.confirm(`Deseja realmente excluir o criativo/vídeo "${creative.title || creative.code}"?`)) {
      return;
    }
    const toastId = toast.loading('Excluindo criativo...');
    try {
      await storage.deleteCreative(creative.id);
      toast.success('Criativo excluído com sucesso!', { id: toastId });
    } catch (err) {
      toast.error('Erro ao excluir criativo.', { id: toastId });
    }
  };
  const { entries, addEntry, removeEntry, loading: loadingEntries } = useEntries(id || '');
  const [newEntry, setNewEntry] = useState<any>({
    date: new Date().toISOString().substring(0, 10),
    endDate: '',
    investment: '',
    revenue: '',
    profit: '',
    cac: '',
    clicks: '',
    cpm: '',
    customData: {}
  });

  const handleAddField = (field: string, value: string) => {
    setNewEntry((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleAddCustomField = (id: string, value: string) => {
    setNewEntry((prev: any) => ({
      ...prev,
      customData: {
        ...(prev.customData || {}),
        [id]: value
      }
    }));
  };

  const handleSaveEntry = async () => {
    const isLaunch = client?.businessType === 'LAUNCH';
    const isRange = client?.isRange || config.isLaunch || config.isRange;
    
    // Check if investment is required (if it's active in custom fields or it's a standard requirement)
    const formsWithInvestment = !client.customFunnelSteps || client.customFunnelSteps.some((s: any) => s.id === 'investment');
    
    if (!newEntry.date || (newEntry.investment === '' && formsWithInvestment && !config.hideRevenue)) {
      toast.error("Data e Investimento são obrigatórios");
      return;
    }

    const toastId = toast.loading("Salvando registro...");
    try {
      // Process custom data strings to numbers
      const processedCustomData: Record<string, number> = {};
      if (newEntry.customData) {
        Object.entries(newEntry.customData).forEach(([key, val]) => {
          processedCustomData[key] = parseFloat(val as string) || 0;
        });
      }

      const entryData = {
        id: Math.random().toString(36).substring(2, 11),
        clientId: id!,
        date: new Date(newEntry.date + (newEntry.date.length === 7 ? "-01" : "") + "T12:00:00Z").toISOString(),
        endDate: newEntry.endDate ? new Date(newEntry.endDate + "T23:59:59Z").toISOString() : undefined,
        investment: parseFloat(newEntry.investment),
        revenue: parseFloat(newEntry.revenue),
        profit: parseFloat(newEntry.profit) || 0,
        cac: parseFloat(newEntry.cac) || 0,
        leads: parseInt(newEntry.leads) || 0,
        bookings: parseInt(newEntry.bookings) || 0,
        shows: parseInt(newEntry.shows) || 0,
        sales: parseInt(newEntry.sales) || 0,
        clicks: parseInt(newEntry.clicks) || 0,
        cpm: parseFloat(newEntry.cpm) || 0,
        delivered: parseInt(newEntry.delivered) || 0,
        projects: parseInt(newEntry.projects) || 0,
        raw: parseInt(newEntry.raw) || 0,
        customData: processedCustomData
      };

      await addEntry(entryData as any);
      setNewEntry({
        date: new Date().toISOString().substring(0, 10),
        endDate: '',
        investment: '',
        revenue: '',
        profit: '',
        cac: '',
        clicks: '',
        cpm: '',
        customData: {}
      });
      toast.success("Lançamento realizado com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao salvar lançamento:", error);
      toast.error("Erro ao salvar lançamento.", { id: toastId });
    }
  };

  const displayEntries = useMemo(() => {
    // If it's a launch business, we might want to group by month
    // But the user specifically asked for "Total should be the sum of days I launched, every month does the same, and renews every month"
    // So we group entries by month and return them.
    const groups: Record<string, any> = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.date);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!groups[monthKey]) {
        groups[monthKey] = {
          id: monthKey,
          clientId: entry.clientId,
          date: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
          investment: 0,
          revenue: 0,
          profit: 0,
          leads: 0,
          sales: 0,
          clicks: 0,
          delivered: 0,
          projects: 0,
          raw: 0,
          customData: {}
        };
      }
      
      groups[monthKey].investment += entry.investment || 0;
      groups[monthKey].revenue += entry.revenue || 0;
      groups[monthKey].profit += entry.profit || 0;
      groups[monthKey].leads += entry.leads || 0;
      groups[monthKey].sales += entry.sales || 0;
      groups[monthKey].clicks += entry.clicks || 0;
      groups[monthKey].delivered += entry.delivered || 0;
      groups[monthKey].projects += entry.projects || 0;
      groups[monthKey].raw += entry.raw || 0;
      
      if (entry.customData) {
        Object.entries(entry.customData).forEach(([key, val]) => {
          groups[monthKey].customData[key] = (groups[monthKey].customData[key] || 0) + (val as number);
        });
      }
    });
    
    return Object.values(groups).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [entries]);

  const lastEntry = useMemo(() => displayEntries[displayEntries.length - 1], [displayEntries]);
  const metrics = useMemo(() => lastEntry ? calculateMetrics(lastEntry, client?.businessType) : null, [lastEntry, client?.businessType]);
  const previousEntry = useMemo(() => displayEntries.length > 1 ? displayEntries[displayEntries.length - 2] : undefined, [displayEntries]);
  const previousMetrics = useMemo(() => previousEntry ? calculateMetrics(previousEntry, client?.businessType) : undefined, [previousEntry, client?.businessType]);
  const insights = useMemo(() => metrics ? generateInsights(metrics, previousMetrics) : [], [metrics, previousMetrics]);
  const health = useMemo(() => metrics ? getHealthStatus(metrics, 4) : 'GOOD', [metrics]);

  const matchesRecurrence = useCallback((date: Date, event: any, isRecurringClient: boolean) => {
    const dateStr = date.toISOString().split('T')[0];
    if (event.deletedDates?.includes(dateStr)) return false;

    const recurrenceType = event.recurrenceType || (event.isRecurring ? 'MONTHLY_DAY' : (event.recurringDays && event.recurringDays.length > 0) ? 'WEEKLY' : 'NONE');
    
    // Effective recurrence for content items if no specific recurrence set but client is recurring
    const effectiveRecurrence = (event.type === 'content' && isRecurringClient && recurrenceType === 'NONE' && event.isRecurring === undefined) ? 'MONTHLY_DAY' : recurrenceType;

    switch (effectiveRecurrence) {
      case 'DAILY':
        return true;
      case 'WEEKLY':
        return event.recurringDays?.includes(date.getDay());
      case 'MONTHLY_DAY': {
        const targetDate = new Date((event.targetDate || event.date) + "T12:00:00");
        return date.getDate() === targetDate.getDate();
      }
      case 'MONTHLY_ORDINAL': {
        if (!event.ordinalWeekday) return false;
        const { ordinal, day } = event.ordinalWeekday;
        if (date.getDay() !== day) return false;
        const dayOfMonth = date.getDate();
        const calcOrdinal = Math.ceil(dayOfMonth / 7);
        // Correctly handle 5th occurrence if needed, or stick to 1-4
        return calcOrdinal === ordinal;
      }
      case 'NONE':
        return dateStr === (event.targetDate || event.date);
      default:
        return false;
    }
  }, []);

  const monthStats = useMemo(() => {
    if (!client) return { total: 0, posted: 0 };
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let totalCount = 0;
    let postedCount = 0;
    const isRecurringClient = client.billingModel === 'RECURRING';

    if (client.contentPlan?.items) {
      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(year, month, d);
        const dateStr = dayDate.toISOString().split('T')[0];
        
        client.contentPlan.items.forEach((item: any) => {
          if (matchesRecurrence(dayDate, { ...item, type: 'content' }, isRecurringClient)) {
            totalCount++;
            const isRecurring = item.recurrenceType 
              ? item.recurrenceType !== 'NONE'
              : (item.isRecurring || (item.recurringDays && item.recurringDays.length > 0) || (isRecurringClient && !item.recurringDays));
            
            const isCompleted = isRecurring ? item.completedDates?.includes(dateStr) : item.status === 'POSTED';
            if (isCompleted) postedCount++;
          }
        });
      }
    }
    
    return { total: totalCount, posted: postedCount };
  }, [client, currentDate, matchesRecurrence]);

  const chartData = useMemo(() => displayEntries.map(e => ({
    name: new Date(e.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    investimento: e.investment,
    faturamento: e.revenue || 0,
    roas: (e.revenue || 0) / (e.investment || 1)
  })), [displayEntries]);

  const handleExportPDF = async () => {
    if (!containerRef.current) return;
    
    const toastId = toast.loading("Gerando PDF...");
    try {
      const element = containerRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0A0A0B',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          // Workaround for html2canvas not supporting modern CSS color functions like oklab/oklch
          const styleElements = clonedDoc.getElementsByTagName('style');
          for (let i = 0; i < styleElements.length; i++) {
            const style = styleElements[i];
            if (style.innerHTML.includes('oklch') || style.innerHTML.includes('oklab')) {
              style.innerHTML = style.innerHTML
                .replace(/oklch\([^)]+\)/g, '#ffffff')
                .replace(/oklab\([^)]+\)/g, '#ffffff');
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Relatorio-${client?.name || 'Cliente'}-${new Date().toLocaleDateString()}.pdf`);
      toast.success("PDF exportado com sucesso!", { id: toastId });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error("Erro ao gerar PDF. Tente novamente.", { id: toastId });
    }
  };

  const tabs = [
    { id: 'overview', label: 'Dashboard', icon: BarChart3 },
    { id: 'calendar', label: 'Calendário', icon: CalendarDays },
    { id: 'processos', label: 'Processos Kanban', icon: Layers },
    { id: 'entries', label: 'Lançamentos', icon: PlusCircle },
    { id: 'report', label: 'Relatório', icon: FileText },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const config = useMemo(() => BUSINESS_CONFIGS[client?.businessType] || BUSINESS_CONFIGS.SERVICE_BOOKING, [client?.businessType]);

  if (loadingClient || loadingEntries) {
    return (
      <div className="py-32 flex justify-center">
        <div className="w-8 h-8 rounded-full border-t-2 border-accent-mint animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20 glass rounded-3xl p-12">
        <AlertCircle size={48} className="text-accent-coral mb-4" />
        <h2 className="text-2xl font-bold">Cliente não encontrado</h2>
        <button onClick={() => navigate('/clientes')} className="mt-4 text-accent-mint hover:underline">Voltar para lista</button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn("space-y-8 min-h-full", isPresenting && "bg-bg-base p-12 overflow-y-auto")}
    >
      {isPresenting && (
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-black font-bold overflow-hidden" style={{ backgroundColor: client!.brandColor }}>
              {client!.logo ? (
                <img src={client!.logo} alt={client!.name} className="w-full h-full object-cover" />
              ) : (
                client!.name.charAt(0)
              )}
            </div>
            <div>
              <h2 className="text-xl font-medium">{client!.name}</h2>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Dashboard de Performance | {config.label}</p>
            </div>
          </div>
          <button 
            onClick={togglePresentation}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-all"
          >
            <Minimize2 size={16} />
            Sair da Apresentação
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <motion.div 
            layoutId="client-logo"
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-black text-3xl font-bold shadow-[0_0_40px_-5px_rgba(0,0,0,0.5)] border-4 border-white/5 overflow-hidden shrink-0"
            style={{ backgroundColor: client.brandColor }}
          >
            {client.logo ? (
              <img src={client.logo} alt={client.name} className="w-full h-full object-cover" />
            ) : (
              client.name.charAt(0)
            )}
          </motion.div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-medium tracking-tight">{client.name}</h1>
              <HealthBadge status={isContentDelayed(client, currentDate) ? 'CRITICAL' : health} />
              {isContentDelayed(client, currentDate) && (
                <div className="bg-accent-coral/20 border border-accent-coral/30 px-3 py-1 rounded-full text-accent-coral text-[10px] font-bold uppercase animate-pulse">
                   Conteúdo Atrasado
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-text-secondary">
               <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">{config.label}</span>
               {client.accountManager && (
                 <span className="flex items-center gap-1.5"><Users size={14} /> Gestor: {client.accountManager}</span>
               )}
               <span className="flex items-center gap-1.5"><Clock size={14} /> Ativo há 6 meses</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={togglePresentation}
            className="flex items-center gap-2 px-4 py-2.5 glass glass-hover rounded-xl text-sm font-medium"
          >
            <Maximize2 size={16} />
            Modo Apresentação
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-mint text-black font-bold rounded-xl hover:bg-accent-mint/90 transition-all shadow-lg shadow-accent-mint/20"
          >
            <Download size={16} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      {!isPresenting && (
        <div className="flex items-center gap-2 border-b border-white/5 overflow-x-auto pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative border-b-2",
                activeTab === tab.id 
                  ? "text-accent-mint border-accent-mint" 
                  : tab.id === 'calendar' && isContentDelayed(client, currentDate)
                    ? "text-accent-coral border-transparent animate-pulse"
                    : "text-text-muted border-transparent hover:text-text-secondary"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.id === 'calendar' && isContentDelayed(client, currentDate) && (
                <div className="w-2 h-2 rounded-full bg-accent-coral shadow-[0_0_8px_rgba(255,77,77,0.6)] animate-pulse" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Dynamic KPI Cards based on performanceMode */}
              {(client.performanceMode === 'LEADS') ? (
                <>
                  <ClientKPICard label="Leads" value={lastEntry?.leads || 0} trend={lastEntry && previousEntry ? (((lastEntry.leads || 0) / (previousEntry.leads || 1) - 1) * 100) : 0} />
                  <ClientKPICard 
                    label="Vídeos" 
                    value={monthStats.posted} 
                    suffix={`/ ${monthStats.total}`} 
                    color={isContentDelayed(client, currentDate) ? 'text-accent-coral shadow-[0_0_15px_rgba(255,77,77,0.2)]' : undefined}
                  />
                  <ClientKPICard label="Vendas" value={lastEntry?.sales || 0} color="text-accent-mint" />
                  <ClientKPICard label="CPL" value={metrics?.cpl || 0} isCurrency color="text-accent-coral" />
                  <ClientKPICard label="Investimento" value={lastEntry?.investment || 0} isCurrency />
                </>
              ) : (
                <>
                  <ClientKPICard label="Faturamento" value={lastEntry?.revenue || 0} isCurrency trend={metrics && previousMetrics ? ((metrics.roas / previousMetrics.roas - 1) * 100) : 0} />
                  <ClientKPICard label="Investimento" value={lastEntry?.investment || 0} isCurrency />
                  <ClientKPICard 
                    label="Vídeos" 
                    value={monthStats.posted} 
                    suffix={`/ ${monthStats.total}`} 
                    color={isContentDelayed(client, currentDate) ? 'text-accent-coral shadow-[0_0_15px_rgba(255,77,77,0.2)]' : undefined}
                  />
                  {!config.hideCac && <ClientKPICard label="CAC" value={metrics?.cac || 0} isCurrency color="text-accent-coral" />}
                  <ClientKPICard label="ROAS" value={metrics?.roas || 0} isDecimal />
                </>
              )}
            </div>

            {/* Content and Strategy Widgets */}
            {(client.contentPlan || client.strategyUrl || (client.captures && client.captures.length > 0)) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {client.contentPlan && (
                  <div className={cn(
                    "glass rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group transition-all duration-500",
                    isContentDelayed(client, currentDate) && "border border-accent-coral/50 bg-accent-coral/[0.02]"
                  )}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted">Conteúdo</h3>
                        <p className={cn("text-xs", isContentDelayed(client, currentDate) ? "text-accent-coral font-bold" : "text-text-secondary")}>
                          {isContentDelayed(client, currentDate) ? 'Atenção: Atrasadas!' : 'Status mensal'}
                        </p>
                      </div>
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        isContentDelayed(client, currentDate) ? "bg-accent-coral/20 text-accent-coral" : "bg-accent-mint/10 text-accent-mint"
                      )}>
                        <Camera size={20} />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-medium tracking-tighter">
                            {monthStats.posted}
                          </span>
                          <span className="text-xl font-light text-text-muted"> / {monthStats.total}</span>
                        </div>
                        <span className={cn("text-[10px] font-bold uppercase", isContentDelayed(client, currentDate) ? "text-accent-coral" : "text-accent-mint")}>
                          {Math.round((monthStats.posted / (monthStats.total || 1)) * 100)}%
                        </span>
                      </div>
                      
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (monthStats.posted / (monthStats.total || 1)) * 100)}%` }}
                          className={cn(
                            "h-full transition-all shadow-[0_0_15px_rgba(0,0,0,0.2)]",
                            isContentDelayed(client, currentDate) ? "bg-accent-coral shadow-accent-coral/30" : "bg-accent-mint shadow-accent-mint/30"
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {client.captures && client.captures.length > 0 && (
                  <div className="glass rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted">Captações</h3>
                        <p className="text-xs text-text-secondary">Próximas datas</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-fuchsia-400/10 text-fuchsia-400 flex items-center justify-center">
                        <CalendarDays size={20} />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {client.captures.filter((c: any) => c.status === 'PLANNED').sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(0, 2).map((cap: any) => (
                        <div key={cap.id} className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/5">
                           <span className="text-[10px] font-bold text-white max-w-[100px] truncate">{cap.title}</span>
                           <span className="text-[10px] font-bold text-fuchsia-400">{new Date(cap.date + "T12:00:00").toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                        </div>
                      ))}
                      {client.captures.filter((c: any) => c.status === 'PLANNED').length === 0 && (
                        <p className="text-[10px] text-text-muted italic">Nenhuma captação agendada</p>
                      )}
                    </div>
                  </div>
                )}

                {client.strategyUrl && (
                  <div className="glass rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group border border-accent-mint/10">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted">Estratégia</h3>
                      <Target size={16} className="text-accent-mint" />
                    </div>
                    
                    <p className="text-[10px] text-text-secondary leading-relaxed mb-4 line-clamp-2">
                       Visualize a tática completa desenhada para este cliente.
                    </p>

                    <a 
                      href={client.strategyUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2 bg-white/5 hover:bg-white/10 transition-all rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/10"
                    >
                      Abrir Estratégia <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart Block */}
              {client.performanceMode === 'LEADS' ? (
                <div className="lg:col-span-2 glass rounded-3xl p-8">
                  <div className="flex items-center justify-between mb-8">
                      <h3 className="font-medium text-lg">Volume de Leads</h3>
                  </div>
                  <div className="h-[300px] min-w-0 w-full overflow-hidden">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50} key={`chart-leads-${activeTab}`}>
                        <AreaChart data={displayEntries.map(e => ({ name: new Date(e.date).toLocaleDateString('pt-BR', { month: 'short' }), leads: e.leads || 0 }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
                            <Tooltip 
                              contentStyle={{ background: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} 
                              formatter={(val: any) => isVisible ? val : '•••••'}
                            />
                            <Area type="monotone" dataKey="leads" stroke={client.brandColor} strokeWidth={3} fillOpacity={0.1} fill={client.brandColor} />
                        </AreaChart>
                      </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-2 glass rounded-3xl p-8">
                  <div className="flex items-center justify-between mb-8">
                      <h3 className="font-medium text-lg">Evolução do Faturamento</h3>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                        <div className="w-2 h-2 rounded-full bg-accent-mint" /> Realizado
                        <div className="w-2 h-2 rounded-full bg-white/40" /> Meta
                      </div>
                  </div>
                  <div className="h-[300px] min-w-0 w-full overflow-hidden">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50} key={`chart-${activeTab}`}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                              <linearGradient id="clientColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={client.brandColor} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={client.brandColor} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} dy={10} />
                            <Tooltip 
                              contentStyle={{ background: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                              itemStyle={{ color: '#fff', fontSize: '12px' }}
                              formatter={(val: any) => isVisible ? formatCurrency(val) : '•••••'}
                            />
                            <Area type="monotone" dataKey="faturamento" stroke={client.brandColor} strokeWidth={3} fillOpacity={1} fill="url(#clientColor)" />
                        </AreaChart>
                      </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Conversion Funnel Widget */}
              <div className="glass rounded-3xl p-8 flex flex-col">
                 <h3 className="font-medium text-lg mb-8">Funil de Conversão</h3>
                 <div className="flex-1">
                   {metrics ? <ConversionFunnelVisual entry={lastEntry} client={client} metrics={metrics} /> : <div className="h-full flex items-center justify-center text-text-muted">Aguardando dados...</div>}
                 </div>
              </div>
            </div>

            {/* Bottom Row - Projections and Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="glass rounded-3xl p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Insights Automáticos</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-text-muted">{config.label} Intelligence</span>
                       <Info size={14} className="text-text-muted" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    {insights.map((insight, idx) => (
                      <div key={idx} className="flex gap-4 items-start bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-accent-mint/10 flex items-center justify-center text-accent-mint shrink-0">
                          <CheckCircle2 size={16} />
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{insight}</p>
                      </div>
                    ))}
                    {insights.length === 0 && <p className="text-sm text-text-muted italic">Dados insuficientes para gerar novos insights este mês.</p>}
                  </div>
               </div>

               {client.performanceMode !== 'LEADS' && !config.hideRevenue && (
                 <div className="glass rounded-3xl p-8 flex flex-col justify-between">
                    <div>
                      <h3 className="font-medium mb-1">Projeção da Meta</h3>
                      <p className="text-xs text-text-secondary">Ritmo atual para atingir {formatCurrency(client.smartGoal.targetRevenue)}</p>
                    </div>
                    <div className="py-8 space-y-4">
                       <div className="flex justify-between items-end">
                          <span className="text-3xl font-medium tracking-tighter">
                            {formatPercent(lastEntry ? (lastEntry.revenue || 0) / client.smartGoal.targetRevenue * 100 : 0)}
                          </span>
                          <span className="text-[10px] font-bold text-text-muted uppercase">CONCLUÍDO</span>
                       </div>
                       <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, lastEntry ? (lastEntry.revenue || 0) / client.smartGoal.targetRevenue * 100 : 0)}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="h-full bg-accent-mint shadow-[0_0_20px_rgba(0,217,163,0.4)]"
                          />
                       </div>
                       <p className="text-xs text-text-muted">Você está a {formatCurrency(Math.max(0, client.smartGoal.targetRevenue - (lastEntry?.revenue || 0)))} de distância da meta.</p>
                    </div>
                    <button className="text-accent-mint text-sm font-medium flex items-center gap-2 hover:translate-x-1 transition-transform">
                      Simular próximos meses <ArrowRight size={14} />
                    </button>
                 </div>
               )}
            </div>
          </motion.div>
        )}

        {activeTab === 'calendar' && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <DashboardCalendar 
              client={client} 
              setClient={setClient} 
              currentDate={currentDate} 
              setCurrentDate={setCurrentDate} 
            />
          </motion.div>
        )}

        {activeTab === 'entries' && (
          <motion.div
            key="entries"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="glass rounded-3xl p-8 border border-white/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                   <h3 className="font-medium text-xl">Novo Registro</h3>
                   <p className="text-xs text-text-muted mt-1">Preencha os dados do {(client.isRange !== undefined ? client.isRange : config.isLaunch) ? 'lançamento' : 'período'}</p>
                </div>
                
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                   <button 
                     onClick={() => {
                        const updatedClient = { ...client, isRange: false };
                        setClient(updatedClient);
                        storage.saveClient(updatedClient);
                     }}
                     className={cn(
                       "px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all",
                       !(client.isRange !== undefined ? client.isRange : config.isLaunch) ? "bg-white text-black shadow-lg" : "text-text-secondary hover:text-white"
                     )}
                   >
                     Mensal
                   </button>
                   <button 
                     onClick={() => {
                        const updatedClient = { ...client, isRange: true };
                        setClient(updatedClient);
                        storage.saveClient(updatedClient);
                     }}
                     className={cn(
                       "px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all",
                       (client.isRange !== undefined ? client.isRange : config.isLaunch) ? "bg-white text-black shadow-lg" : "text-text-secondary hover:text-white"
                     )}
                   >
                     Lançamento
                   </button>
                </div>
              </div>

              <div className="space-y-8">
                {/* Date Selection */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Datas de Referência</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                         <Clock size={12} className="text-accent-mint" />
                         De (Início)
                      </label>
                      <input 
                        type="date" 
                        value={newEntry.date}
                        onChange={(e) => handleAddField('date', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                         <Clock size={12} className="text-accent-mint" />
                         Até (Término)
                      </label>
                      <input 
                        type="date" 
                        value={newEntry.endDate || ''}
                        onChange={(e) => handleAddField('endDate', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none" 
                      />
                    </div>
                  </div>
                </div>

                {/* Metric Selection Toggle */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Informações para adicionar</label>
                    <span className="text-[10px] text-accent-mint font-bold uppercase">Clique para ativar os campos</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'investment', label: 'Investimento' },
                      { id: 'revenue', label: 'Faturamento' },
                      { id: 'leads', label: 'Leads' },
                      { id: 'sales', label: 'Vendas' },
                      { id: 'clicks', label: 'Cliques' },
                      { id: 'cpm', label: 'CPM' },
                      { id: 'waConversations', label: 'Conversas WA' },
                      { id: 'profit', label: 'Lucro' },
                    ].map(metric => {
                      const isActive = client.customFunnelSteps?.some((s: any) => s.id === metric.id) || 
                                       (!client.customFunnelSteps && config.funnel.includes(metric.id));
                      return (
                        <button
                          key={metric.id}
                          type="button"
                          onClick={() => {
                            let newSteps = [...(client.customFunnelSteps || (config.funnel.map((f: string) => ({ id: f, label: config.labels[f] || f }))))];
                            if (isActive) {
                              newSteps = newSteps.filter(s => s.id !== metric.id);
                            } else {
                              newSteps.push(metric);
                            }
                            const updatedClient = { ...client, customFunnelSteps: newSteps };
                            setClient(updatedClient);
                            storage.saveClient(updatedClient);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all",
                            isActive 
                              ? "bg-accent-mint/10 border-accent-mint text-accent-mint" 
                              : "bg-white/5 border-white/10 text-text-muted hover:border-white/20"
                          )}
                        >
                          {metric.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* We now purely follow customFunnelSteps or config.funnel */}
                  {(client.customFunnelSteps || config.funnel.map((f: string) => ({ id: f, label: config.labels[f] || f }))).map((stepItem: any) => {
                    const isStandard = ['investment', 'revenue', 'profit', 'leads', 'bookings', 'shows', 'sales', 'sessions', 'addCart', 'purchases', 'mqls', 'waClicks', 'waConversations', 'delivered', 'projects', 'raw', 'clicks', 'cpm', 'cac'].includes(stepItem.id);
                    
                    return (
                      <div key={stepItem.id} className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                          {stepItem.label}
                        </label>
                        <input 
                          type="number" 
                          value={isStandard ? (newEntry[stepItem.id] || '') : (newEntry.customData?.[stepItem.id] || '')}
                          onChange={(e) => isStandard ? handleAddField(stepItem.id, e.target.value) : handleAddCustomField(stepItem.id, e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent-mint/50 outline-none" 
                          placeholder="0" 
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={handleSaveEntry}
                  className="bg-accent-mint text-black font-bold px-8 py-3 rounded-xl hover:bg-accent-mint/90 transition-all shadow-lg shadow-accent-mint/20"
                >
                  Salvar Registro
                </button>
              </div>
            </div>

            <div className="glass rounded-3xl overflow-hidden">
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-medium text-xl">Histórico de Lançamentos</h3>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                   <button 
                     onClick={() => setViewMode('all')}
                     className={cn(
                       "px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all",
                       viewMode === 'all' ? "bg-white text-black shadow-lg" : "text-text-secondary hover:text-white"
                     )}
                   >
                     Individual
                   </button>
                   <button 
                     onClick={() => setViewMode('monthly')}
                     className={cn(
                       "px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all",
                       viewMode === 'monthly' ? "bg-white text-black shadow-lg" : "text-text-secondary hover:text-white"
                     )}
                   >
                     Mensal (Soma)
                   </button>
                </div>
              </div>
              <div className="p-8 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-text-muted uppercase tracking-widest border-b border-white/5">
                      <th className="pb-4">Período</th>
                      {!config.hideRevenue && <th className="pb-4">Investiment.</th>}
                      
                      {client.performanceMode === 'LEADS' ? (
                        <>
                          <th className="pb-4">Leads</th>
                          <th className="pb-4">Vendas</th>
                          <th className="pb-4">CPL</th>
                        </>
                      ) : (
                        <>
                          {!config.hideRevenue && <th className="pb-4">Faturamento</th>}
                          {!config.hideProfit && <th className="pb-4">Lucro</th>}
                          {config.hideRevenue ? (
                            <>
                              <th className="pb-4">Projetos</th>
                              <th className="pb-4">Entregues</th>
                            </>
                          ) : (
                            <>
                              <th className="pb-4">Leads</th>
                              <th className="pb-4">Vendas</th>
                            </>
                          )}
                        </>
                      )}
                      <th className="pb-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {(viewMode === 'all' ? entries : displayEntries).map((e: any) => (
                      <tr key={e.id} className="group hover:bg-white/[0.02]">
                        <td className="py-5 font-medium">
                          {viewMode === 'monthly' ? (
                             new Date(e.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                          ) : (
                            <>
                              {new Date(e.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              {e.endDate && ` - ${new Date(e.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                            </>
                          )}
                        </td>
                        <td className="py-5 text-sm">
                          {!config.hideRevenue && (isVisible ? formatCurrency(e.investment) : '•••••')}
                        </td>
                        
                        {client.performanceMode === 'LEADS' ? (
                          <>
                            <td className="py-5 text-sm">{e.leads || 0}</td>
                            <td className="py-5 text-sm">{e.sales || 0}</td>
                            <td className="py-5 text-sm text-accent-coral font-medium">
                              {e.leads ? (isVisible ? formatCurrency(e.investment / e.leads) : '•••••') : '--'}
                            </td>
                          </>
                        ) : (
                          <>
                            {!config.hideRevenue && <td className="py-5 text-sm">{isVisible ? formatCurrency(e.revenue || 0) : '•••••'}</td>}
                            {!config.hideProfit && <td className="py-5 text-sm text-accent-mint font-medium">{isVisible ? formatCurrency(e.profit || 0) : '•••••'}</td>}
                            {config.hideRevenue ? (
                              <>
                                <td className="py-5 text-sm">{e.projects || e.raw || 0}</td>
                                <td className="py-5 text-sm">{e.delivered || 0}</td>
                              </>
                            ) : (
                              <>
                                <td className="py-5 text-sm">{e.leads || 0}</td>
                                <td className="py-5 text-sm">{e.sales || 0}</td>
                              </>
                            )}
                          </>
                        )}
                        
                        <td className="py-5 text-right">
                          {viewMode === 'all' && (
                            <button onClick={() => removeEntry(e.id)} className="p-2 hover:bg-accent-coral/20 hover:text-accent-coral rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                               <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'report' && (
          <motion.div
            key="report"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="glass rounded-3xl p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-medium">Análise de Performance</h3>
                    <div className="flex items-center gap-3">
                       <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-text-muted uppercase">De:</label>
                          <select className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none">
                             {entries.map(e => (
                               <option key={e.id} value={e.date}>{new Date(e.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</option>
                             ))}
                          </select>
                       </div>
                       <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-text-muted uppercase">Até:</label>
                          <select className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none">
                             {entries.map(e => (
                               <option key={e.id} value={e.date}>{new Date(e.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</option>
                             ))}
                          </select>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="bg-white/5 p-4 rounded-2xl">
                        <p className="text-[9px] font-bold text-text-muted uppercase mb-1">Leads</p>
                        <p className="text-xl font-medium">{entries.reduce((acc, curr) => acc + (curr.leads || 0), 0)}</p>
                     </div>
                     <div className="bg-white/5 p-4 rounded-2xl">
                        <p className="text-[9px] font-bold text-text-muted uppercase mb-1">CPL Médio</p>
                        <p className="text-xl font-medium">
                          {!isVisible ? '•••••' : (entries.reduce((acc, curr) => acc + (curr.leads || 0), 0) > 0 
                            ? formatCurrency(entries.reduce((acc, curr) => acc + curr.investment, 0) / entries.reduce((acc, curr) => acc + (curr.leads || 0), 0))
                            : '--')}
                        </p>
                     </div>
                     <div className="bg-white/5 p-4 rounded-2xl">
                        <p className="text-[9px] font-bold text-text-muted uppercase mb-1">Vendas</p>
                        <p className="text-xl font-medium">{entries.reduce((acc, curr) => acc + (curr.sales || 0), 0)}</p>
                     </div>
                     <div className="bg-white/5 p-4 rounded-2xl">
                        <p className="text-[9px] font-bold text-text-muted uppercase mb-1">
                          {client.performanceMode === 'LEADS' ? 'Investimento' : 'Lucro Total'}
                        </p>
                        <p className={cn("text-xl font-medium", client.performanceMode !== 'LEADS' && "text-accent-mint")}>
                          {!isVisible ? '•••••' : formatCurrency(entries.reduce((acc, curr) => acc + (client.performanceMode === 'LEADS' ? curr.investment : (curr.profit || 0)), 0))}
                        </p>
                     </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Relatório Estratégico</label>
                    <textarea 
                      placeholder="Descreva os principais pontos positivos, gargalos e o plano de ação para o próximo período..."
                      className="w-full min-h-[250px] bg-white/5 border border-white/10 rounded-2xl p-6 text-sm leading-relaxed resize-none focus:border-accent-mint/50 outline-none transition-all"
                    />
                  </div>

                  <div className="pt-6 border-t border-white/5 flex justify-end gap-3">
                    <button className="px-6 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-medium transition-all">Salvar rascunho</button>
                    <button 
                      onClick={handleExportPDF}
                      className="px-6 py-2.5 rounded-xl bg-accent-mint text-black font-bold text-sm transition-all hover:bg-accent-mint/90 shadow-lg shadow-accent-mint/20"
                    >
                      Exportar Relatório
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="glass rounded-3xl p-8">
                  <h4 className="font-medium mb-6">Métricas do Período</h4>
                  <div className="space-y-6">
                    {client.performanceMode === 'LEADS' ? (
                      <>
                        <SummaryItem label="CPL Médio" value={formatCurrency(entries.reduce((acc, curr) => acc + curr.investment, 0) / (entries.reduce((acc, curr) => acc + (curr.leads || 0), 0) || 1))} />
                        <SummaryItem label="Taxa Conversão" value={formatPercent((entries.reduce((acc, curr) => acc + (curr.sales || 0), 0) / (entries.reduce((acc, curr) => acc + (curr.leads || 1), 0) || 1)) * 100)} />
                        <SummaryItem label="Total Investido" value={formatCurrency(entries.reduce((acc, curr) => acc + curr.investment, 0))} />
                        <SummaryItem label="Total Leads" value={entries.reduce((acc, curr) => acc + (curr.leads || 0), 0).toString()} />
                      </>
                    ) : (
                      <>
                        <SummaryItem label="ROAS Médio" value={`${(metrics?.roas || 0).toFixed(2)}x`} />
                        <SummaryItem label="CAC Médio" value={formatCurrency(metrics?.cac || 0)} />
                        <SummaryItem label="ROI Médio" value={`${(metrics?.roi || 0).toFixed(1)}%`} />
                        <SummaryItem label="Faturamento" value={formatCurrency(entries.reduce((acc, curr) => acc + (curr.revenue || 0), 0))} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'processos' && (
          <motion.div
            key="processos"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 text-left"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-xl text-white">Demandas e Processos Kanban</h3>
                <p className="text-xs text-text-secondary mt-1">Acompanhamento operacional de todas as etapas e criativos deste cliente.</p>
              </div>
              <button
                onClick={() => navigate('/processos')}
                className="px-4 py-2 bg-accent-mint/15 text-accent-mint border border-accent-mint/30 rounded-xl font-bold text-xs hover:bg-accent-mint/25 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Ir para o Painel Kanban Completo
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Tasks Bento Grid */}
            {clientTasks.length === 0 ? (
              <div className="glass rounded-3xl p-16 text-center space-y-4 border border-white/5">
                <Layers className="mx-auto text-text-muted" size={40} />
                <h4 className="text-base font-semibold text-white">Nenhuma atividade operacional vinculada</h4>
                <p className="text-text-muted text-xs max-w-sm mx-auto leading-relaxed">
                  Não existem cards criativos ou tarefas ativas para este cliente em nenhum fluxo de trabalho (Produção de Vídeo, Comercial, Design, etc.).
                </p>
                <button
                  onClick={() => navigate('/processos')}
                  className="px-4.5 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition-all cursor-pointer"
                >
                  Adicionar primeira tarefa
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clientTasks.map(task => {
                  const processObj = processesList.find(p => p.id === task.processoId);
                  
                  // Checklist completion percentage helper
                  const totalCheck = task.checklist?.length || 0;
                  const doneCheck = task.checklist?.filter((c: any) => c.completed).length || 0;
                  const percent = totalCheck > 0 ? Math.round((doneCheck / totalCheck) * 100) : 0;

                  return (
                    <div 
                      key={task.id}
                      className="glass rounded-2xl p-5 border border-white/[0.06] hover:border-white/15 bg-white/[0.01] hover:bg-white/[0.03] transition-all flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        {/* Process and Status tags */}
                        <div className="flex items-center justify-between gap-2">
                          <span 
                            className="px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border"
                            style={{ 
                              color: processObj?.color || '#fff', 
                              borderColor: processObj?.color ? `${processObj.color}30` : 'rgba(255,255,255,0.1)',
                              backgroundColor: processObj?.color ? `${processObj.color}10` : 'rgba(255,255,255,0.02)'
                            }}
                          >
                            {processObj?.name || 'Fluxo Geral'}
                          </span>
                          
                          <span className={`px-2 py-0.5 text-[8px] font-bold rounded-md uppercase tracking-wider ${
                            task.status === 'DONE' 
                              ? 'bg-accent-mint/10 text-accent-mint border border-accent-mint/20' 
                              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                          }`}>
                            {task.status === 'DONE' ? 'Concluído' : 'Em andamento'}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="font-bold text-white text-sm line-clamp-1 mt-1">{task.title}</h4>
                        
                        {/* Description */}
                        {task.description && (
                          <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">{task.description}</p>
                        )}
                      </div>

                      {/* Progression bar */}
                      {totalCheck > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] text-text-muted">
                            <span className="flex items-center gap-1 font-semibold">
                              <CheckSquare size={10} />
                              Checklist de atividades ({doneCheck}/{totalCheck})
                            </span>
                            <span className="font-mono">{percent}%</span>
                          </div>
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-accent-mint transition-all" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Footer detail row */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-[10px] text-text-muted">
                        <div className="flex items-center gap-1.5 font-medium">
                          <User size={12} />
                          <span>Responsável: {task.responsible || 'Equipe'}</span>
                        </div>

                        {task.dueDate && (
                          <div className="flex items-center gap-1 font-semibold text-text-secondary">
                            <Clock size={11} />
                            <span>Prazo: {new Date(task.dueDate + "T12:00:00").toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Criativos / Vídeos Grid */}
            <div className="pt-6 border-t border-white/5 space-y-4">
              <div>
                <h4 className="font-bold text-lg text-white flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-mint" />
                  Vídeos e Criativos Vinculados ({clientCreatives.length})
                </h4>
                <p className="text-xs text-text-muted">Lista de todos os criativos, ideias e vídeos de tráfego criados para este cliente.</p>
              </div>

              {clientCreatives.length === 0 ? (
                <div className="glass rounded-3xl p-12 text-center text-text-muted space-y-2 border border-white/5">
                  <Play className="mx-auto opacity-35" size={28} />
                  <p className="text-xs">Nenhum criativo ou vídeo cadastrado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {clientCreatives.map((creative) => (
                    <div
                      key={creative.id}
                      className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col justify-between gap-3 group relative"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-mono text-text-muted font-bold">
                            {creative.code}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {creative.isUrgent && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-accent-coral/20 text-accent-coral border border-accent-coral/30 shadow-[0_0_8px_rgba(255,90,95,0.1)]">
                                URGENTE
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 bg-white/5 rounded text-[9px] font-mono text-text-secondary">
                              {creative.status}
                            </span>
                          </div>
                        </div>

                        <h5 className="text-xs font-semibold text-white line-clamp-1">{creative.title}</h5>
                        {creative.type && (
                          <span className="inline-block mt-1.5 text-[9px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded font-mono">
                            {creative.type}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.04] mt-2">
                        {creative.videoUrl ? (
                          <a
                            href={creative.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-accent-mint hover:underline flex items-center gap-1 font-semibold"
                          >
                            <ExternalLink size={10} />
                            Ver Vídeo/Link
                          </a>
                        ) : (
                          <span className="text-[10px] text-text-muted italic">Sem link de vídeo</span>
                        )}

                        <button
                          onClick={() => handleDeleteCreative(creative)}
                          className="p-1 hover:bg-accent-coral/20 text-text-muted hover:text-accent-coral rounded-lg transition-all cursor-pointer"
                          title="Excluir Criativo/Vídeo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="glass rounded-3xl p-8 border border-white/5 max-w-2xl mx-auto">
              <h3 className="text-xl font-medium mb-8">Configurações do Cliente</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updatedClient = {
                  ...client,
                  name: formData.get('name') as string,
                  accountManager: formData.get('accountManager') as string,
                  brandColor: formData.get('brandColor') as string,
                  ownerNames: formData.get('ownerNames') as string,
                  contactInfo: formData.get('contactInfo') as string,
                  planValue: parseFloat(formData.get('planValue') as string) || 0,
                  planScope: formData.get('planScope') as string,
                  managementStatus: formData.get('managementStatus') as string,
                  billingModel: formData.get('billingModel') as string,
                  isRange: formData.get('isRange') === 'on',
                  contentPlan: client.contentPlan || { total: 0, items: [] },
                  captures: client.captures || [],
                  accessInfo: client.accessInfo || []
                };
                await storage.saveClient(updatedClient);
                toast.success("Configurações atualizadas!");
                setClient(updatedClient);
              }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Nome da Empresa</label>
                    <input name="name" defaultValue={client.name} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                       <label className="block text-xs font-bold uppercase tracking-widest text-text-muted">Gestor Responsável</label>
                       <button 
                         type="button" 
                         onClick={() => {
                           const input = document.querySelector('input[name="accountManager"]') as HTMLInputElement;
                           if (input) {
                             input.value = "Não tem gestor";
                             input.dispatchEvent(new Event('input', { bubbles: true }));
                           }
                         }}
                         className="text-[9px] font-bold text-accent-mint hover:underline uppercase"
                       >
                         Sem gestor
                       </button>
                    </div>
                    <input name="accountManager" defaultValue={client.accountManager} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium" />
                  </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                       <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Donos / Sócios</label>
                       <input name="ownerNames" defaultValue={client.ownerNames} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium" />
                    </div>
                    <div>
                       <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Contato (WhatsApp/Email)</label>
                       <input name="contactInfo" defaultValue={client.contactInfo} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium" />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Valor do Plano (Mensal)</label>
                    <input type="number" name="planValue" defaultValue={client.planValue} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium" />
                 </div>

                 <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-6">
                   <div className="flex items-center justify-between">
                     <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Captações / Gravações</h4>
                     <button 
                       type="button" 
                       onClick={() => {
                          const currentCaptures = client.captures || [];
                          const today = new Date();
                          const updatedClient = {
                            ...client,
                            captures: [...currentCaptures, { id: Math.random().toString(36).substring(7), date: today.toISOString().split('T')[0], title: 'Nova Captação', status: 'PLANNED' }]
                          };
                          setClient(updatedClient);
                       }}
                       className="text-[10px] font-bold text-fuchsia-400 uppercase hover:underline"
                     >
                       + Adicionar Captação
                     </button>
                   </div>
                   
                   <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                      {(client.captures || []).map((item: any, idx: number) => (
                        <div key={item.id} className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5 group">
                           <div className="w-8 h-8 rounded-full bg-fuchsia-400/10 text-fuchsia-400 flex items-center justify-center text-xs font-bold shrink-0">
                              <Camera size={14} />
                           </div>
                           <div className="flex-1 grid grid-cols-3 gap-2">
                             <div>
                               <label className="block text-[8px] font-bold text-text-muted uppercase mb-1">Título</label>
                               <input 
                                 type="text" 
                                 defaultValue={item.title}
                                 onChange={(e) => {
                                   const newCaps = [...client.captures];
                                   newCaps[idx] = { ...newCaps[idx], title: e.target.value };
                                   setClient({ ...client, captures: newCaps });
                                 }}
                                 className="bg-transparent text-xs font-medium text-white outline-none w-full"
                               />
                             </div>
                             <div>
                               <label className="block text-[8px] font-bold text-text-muted uppercase mb-1">Data</label>
                               <input 
                                 type="date" 
                                 defaultValue={item.date}
                                 onChange={(e) => {
                                   const newCaps = [...client.captures];
                                   newCaps[idx] = { ...newCaps[idx], date: e.target.value };
                                   setClient({ ...client, captures: newCaps });
                                 }}
                                 className="bg-transparent text-xs font-medium text-white outline-none w-full"
                               />
                             </div>
                             <div className="flex flex-col justify-center">
                               <label className="block text-[8px] font-bold text-text-muted uppercase mb-1">Tipo</label>
                               <button
                                 type="button"
                                 onClick={() => {
                                   const newCaps = [...client.captures];
                                   newCaps[idx] = { ...newCaps[idx], isRecurring: !newCaps[idx].isRecurring };
                                   setClient({ ...client, captures: newCaps });
                                 }}
                                 className={cn(
                                   "text-[9px] font-bold uppercase py-1 px-2 rounded-lg border transition-all truncate",
                                   item.isRecurring ? "bg-accent-mint/10 border-accent-mint text-accent-mint" : "bg-white/5 border-white/10 text-text-muted"
                                 )}
                               >
                                 {item.isRecurring ? 'Recorr.' : 'Único'}
                                </button>
                             </div>
                           </div>
                           <select 
                             value={item.status}
                             onChange={(e) => {
                                 const newCaps = [...client.captures];
                                 newCaps[idx] = { ...newCaps[idx], status: e.target.value as any };
                                 setClient({ ...client, captures: newCaps });
                             }}
                             className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold outline-none uppercase"
                           >
                              <option value="PLANNED">Pendente</option>
                              <option value="DONE">Concluído</option>
                           </select>
                           <button 
                             type="button"
                             onClick={() => {
                                const newCaps = client.captures.filter((_: any, i: number) => i !== idx);
                                setClient({ ...client, captures: newCaps });
                             }}
                             className="p-2 text-text-muted hover:text-accent-coral transition-colors"
                           >
                              <Trash2 size={14} />
                           </button>
                        </div>
                      ))}
                   </div>
                 </div>

                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-6">
                   <div className="flex items-center justify-between">
                     <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Planejamento de Conteúdo Mensal</h4>
                     <button 
                       type="button" 
                       onClick={() => {
                          const currentItems = client.contentPlan?.items || [];
                          const nextWeek = new Date();
                          nextWeek.setDate(nextWeek.getDate() + (currentItems.length * 7));
                          const updatedClient = {
                            ...client,
                            contentPlan: {
                              total: currentItems.length + 1,
                              items: [...currentItems, { id: Math.random().toString(36).substring(7), targetDate: nextWeek.toISOString().split('T')[0], status: 'PLANNED' }]
                            }
                          };
                          setClient(updatedClient);
                       }}
                       className="text-[10px] font-bold text-accent-mint uppercase hover:underline"
                     >
                       + Adicionar Semana
                     </button>
                   </div>
                   
                   <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                      {(client.contentPlan?.items || []).map((item: any, idx: number) => (
                        <div key={item.id} className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5 group">
                           <div className="w-8 h-8 rounded-full bg-accent-mint/10 text-accent-mint flex items-center justify-center text-xs font-bold shrink-0">
                              {idx + 1}
                           </div>
                           <div className="flex-1">
                              <label className="block text-[8px] font-bold text-text-muted uppercase mb-1">Data Prevista</label>
                              <input 
                                type="date" 
                                defaultValue={item.targetDate}
                                onChange={(e) => {
                                  const newItems = [...client.contentPlan.items];
                                  newItems[idx] = { ...newItems[idx], targetDate: e.target.value };
                                  setClient({ ...client, contentPlan: { ...client.contentPlan, items: newItems } });
                                }}
                                className="bg-transparent text-xs font-medium text-white outline-none w-full"
                              />
                           </div>
                           <select 
                             value={item.status}
                             onChange={(e) => {
                                 const newItems = [...client.contentPlan.items];
                                 newItems[idx] = { ...newItems[idx], status: e.target.value };
                                 setClient({ ...client, contentPlan: { ...client.contentPlan, items: newItems } });
                             }}
                             className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold outline-none uppercase"
                           >
                              <option value="PLANNED">Pendente</option>
                              <option value="POSTED">Postado</option>
                           </select>
                           <button 
                             type="button"
                             onClick={() => {
                                const newItems = client.contentPlan.items.filter((_: any, i: number) => i !== idx);
                                setClient({ ...client, contentPlan: { total: newItems.length, items: newItems } });
                             }}
                             className="p-2 text-text-muted hover:text-accent-coral transition-colors"
                           >
                              <Trash2 size={14} />
                           </button>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Informações de Acesso</h4>
                    <button 
                      type="button" 
                      onClick={() => {
                         const currentAccess = client.accessInfo || [];
                         const updatedClient = {
                           ...client,
                           accessInfo: [...currentAccess, { id: Math.random().toString(36).substring(7), platform: 'Instagram', email: '', password: '', extra: '' }]
                         };
                         setClient(updatedClient);
                      }}
                      className="text-[10px] font-bold text-accent-mint uppercase hover:underline"
                    >
                      + Adicionar Acesso
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                     {(client.accessInfo || []).map((item: any, idx: number) => (
                       <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-black/20 p-4 rounded-xl border border-white/5">
                          <div>
                             <label className="block text-[8px] font-bold text-text-muted uppercase mb-1">Plataforma</label>
                             <input 
                               value={item.platform}
                               onChange={(e) => {
                                 const newAccess = [...client.accessInfo];
                                 newAccess[idx] = { ...newAccess[idx], platform: e.target.value };
                                 setClient({ ...client, accessInfo: newAccess });
                               }}
                               placeholder="Ex: Instagram"
                               className="bg-transparent text-xs font-medium text-white outline-none w-full"
                             />
                          </div>
                          <div>
                             <label className="block text-[8px] font-bold text-text-muted uppercase mb-1">Email / User</label>
                             <input 
                               value={item.email}
                               onChange={(e) => {
                                 const newAccess = [...client.accessInfo];
                                 newAccess[idx] = { ...newAccess[idx], email: e.target.value };
                                 setClient({ ...client, accessInfo: newAccess });
                               }}
                               className="bg-transparent text-xs font-medium text-white outline-none w-full"
                             />
                          </div>
                          <div className="relative">
                             <label className="block text-[8px] font-bold text-text-muted uppercase mb-1">Senha</label>
                             <input 
                               type="text"
                               value={item.password}
                               onChange={(e) => {
                                 const newAccess = [...client.accessInfo];
                                 newAccess[idx] = { ...newAccess[idx], password: e.target.value };
                                 setClient({ ...client, accessInfo: newAccess });
                               }}
                               className="bg-transparent text-xs font-medium text-white outline-none w-full pr-8"
                             />
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="flex-1">
                                <label className="block text-[8px] font-bold text-text-muted uppercase mb-1">Outros</label>
                                <input 
                                  value={item.extra}
                                  onChange={(e) => {
                                    const newAccess = [...client.accessInfo];
                                    newAccess[idx] = { ...newAccess[idx], extra: e.target.value };
                                    setClient({ ...client, accessInfo: newAccess });
                                  }}
                                  className="bg-transparent text-xs font-medium text-white outline-none w-full"
                                />
                             </div>
                             <button 
                               type="button"
                               onClick={() => {
                                  const newAccess = client.accessInfo.filter((_: any, i: number) => i !== idx);
                                  setClient({ ...client, accessInfo: newAccess });
                               }}
                               className="p-1.5 text-text-muted hover:text-accent-coral transition-colors"
                             >
                                <Trash2 size={14} />
                             </button>
                          </div>
                       </div>
                     ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                   <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Cor da Marca</label>
                      <div className="flex items-center gap-4">
                        <input type="color" name="brandColor" defaultValue={client.brandColor} className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer" />
                        <span className="text-sm text-text-secondary">Cor primária do dashboard.</span>
                      </div>
                   </div>
                   <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Status de Gestão (Flag)</label>
                      <select name="managementStatus" defaultValue={client.managementStatus || 'GREEN'} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium">
                         <option value="GREEN">Saudável (Green Flag)</option>
                         <option value="YELLOW">Instável (Yellow Flag)</option>
                         <option value="RED">Crítico (Red Flag)</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Tipo de Contrato</label>
                      <select name="billingModel" defaultValue={client.billingModel || 'RECURRING'} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium">
                         <option value="RECURRING">Recorrência (Mensal)</option>
                         <option value="ONE_OFF">Trabalho Único (Projeto)</option>
                      </select>
                   </div>
                   <div className="md:col-span-2 pt-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            name="isRange" 
                            defaultChecked={client.isRange || config.isLaunch} 
                            className="sr-only peer"
                          />
                          <div className="w-10 h-6 bg-white/5 border border-white/10 rounded-full peer peer-checked:bg-accent-mint/20 peer-checked:border-accent-mint transition-all"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white/20 rounded-full peer-checked:left-5 peer-checked:bg-accent-mint transition-all"></div>
                        </div>
                        <span className="text-sm font-medium">Ativar Intervalo de Datas para Registros</span>
                      </label>
                      <p className="text-[10px] text-text-muted mt-2 font-bold uppercase">Permite definir data inicial e final (ex: do dia 1 ao dia 10)</p>
                   </div>
                </div>

                <div className="pt-8 border-t border-white/5 space-y-6">
                  <div className="bg-accent-mint/5 border border-accent-mint/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-base font-medium text-accent-mint flex items-center gap-2">
                          <Target size={18} />
                          Foco de Performance
                        </h4>
                        <p className="text-xs text-text-muted mt-1">Defina o objetivo principal deste cliente para ajustar o Dashboard automaticamente.</p>
                      </div>
                      <div className="flex bg-black/20 p-1 rounded-xl border border-white/10">
                        <button 
                          type="button"
                          onClick={() => {
                            const updatedClient = { ...client, performanceMode: 'SALES' };
                            setClient(updatedClient);
                            storage.saveClient(updatedClient);
                            toast.success("Modo Faturamento/ROI ativado");
                          }}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all",
                            (client.performanceMode || 'SALES') === 'SALES' ? "bg-accent-mint text-black" : "text-text-muted hover:text-white"
                          )}
                        >
                          Vendas & ROI
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            const updatedClient = { ...client, performanceMode: 'LEADS' };
                            setClient(updatedClient);
                            storage.saveClient(updatedClient);
                            toast.success("Modo Leads/Conversão ativado");
                          }}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all",
                            client.performanceMode === 'LEADS' ? "bg-accent-mint text-black" : "text-text-muted hover:text-white"
                          )}
                        >
                          Leads & Conversão
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Campos Personalizados do Registro</h4>
                      <p className="text-[10px] text-text-muted font-bold uppercase">Escolha as informações que deseja acompanhar no formulário</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { id: 'investment', label: 'Investimento' },
                        { id: 'revenue', label: 'Faturamento' },
                        { id: 'profit', label: 'Lucro' },
                        { id: 'leads', label: 'Leads' },
                        { id: 'sales', label: 'Vendas' },
                        { id: 'clicks', label: 'Cliques' },
                        { id: 'waConversations', label: 'Conversas WA' },
                        { id: 'bookings', label: 'Agendamentos' },
                        { id: 'shows', label: 'Comparecimentos' },
                        { id: 'projects', label: 'Projetos' },
                        { id: 'delivered', label: 'Entregue' },
                      ].map(metric => {
                        const isActive = client.customFunnelSteps?.some((s: any) => s.id === metric.id) || 
                                         (!client.customFunnelSteps && config.funnel.includes(metric.id));
                        return (
                          <button
                            key={metric.id}
                            type="button"
                            onClick={() => {
                              let newSteps = [...(client.customFunnelSteps || config.funnel.map((f: string) => ({ id: f, label: config.labels[f] || f })))];
                              if (isActive) {
                                newSteps = newSteps.filter(s => s.id !== metric.id);
                              } else {
                                if (!newSteps.some(s => s.id === metric.id)) {
                                  newSteps.push(metric);
                                }
                              }
                              const updatedClient = { ...client, customFunnelSteps: newSteps };
                              setClient(updatedClient);
                              storage.saveClient(updatedClient);
                            }}
                            className={cn(
                              "flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider",
                              isActive 
                                ? "bg-accent-mint/10 border-accent-mint text-accent-mint" 
                                : "bg-white/5 border-white/10 text-text-muted hover:border-white/20"
                            )}
                          >
                            {metric.label}
                            {isActive && <CheckCircle2 size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 space-y-4 text-left">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-widest text-text-muted">Etapas Personalizadas</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const newSteps = [...(client.customFunnelSteps || [])];
                          newSteps.push({ id: `step_${Date.now()}`, label: 'Nova Etapa' });
                          setClient({ ...client, customFunnelSteps: newSteps });
                        }}
                        className="flex items-center gap-2 text-accent-mint text-[10px] font-bold uppercase hover:underline"
                      >
                        <Plus size={14} /> Adicionar Campo Customizado
                      </button>
                    </div>
                  
                  <div className="space-y-3">
                    {(client.customFunnelSteps || []).filter((s: any) => !['leads', 'sales', 'clicks', 'cpm', 'waConversations', 'bookings', 'shows', 'mqls', 'delivered', 'projects'].includes(s.id)).map((step: any, index: number) => (
                      <div key={step.id} className="flex items-center gap-3">
                        <input 
                          value={step.label}
                          onChange={(e) => {
                            const newSteps = [...client.customFunnelSteps];
                            const idx = newSteps.findIndex(s => s.id === step.id);
                            newSteps[idx] = { ...newSteps[idx], label: e.target.value };
                            setClient({ ...client, customFunnelSteps: newSteps });
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-mint/50"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const newSteps = client.customFunnelSteps.filter((s: any) => s.id !== step.id);
                            setClient({ ...client, customFunnelSteps: newSteps });
                          }}
                          className="p-2 text-text-muted hover:text-accent-coral transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                  <button 
                    type="button"
                    onClick={async () => {
                      if (window.confirm("Deseja realmente excluir este cliente?")) {
                        await storage.deleteClient(client.id);
                        navigate('/clientes');
                      }
                    }}
                    className="text-accent-coral text-xs font-bold uppercase hover:underline flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Excluir Cliente
                  </button>
                  <button type="submit" className="bg-accent-mint text-black font-bold px-8 py-3 rounded-xl hover:bg-accent-mint/90 transition-all">Salvar Alterações</button>
              </div>
            </form>
          </div>

            <div className="glass rounded-3xl p-8 border border-white/5 max-w-2xl mx-auto border-accent-coral/20">
               <h3 className="text-lg font-medium text-accent-coral mb-2">Zona de Perigo</h3>
               <p className="text-sm text-text-muted mb-6">Ao apagar este cliente, todos os registros e relatórios serão permanentemente removidos.</p>
               <button 
                 onClick={async () => {
                   if(window.confirm("Certeza absoluta? Esta ação não pode ser desfeita.")) {
                     await storage.deleteClient(client.id);
                     navigate('/clientes');
                     toast.success("Cliente removido.");
                   }
                 }}
                 className="flex items-center gap-2 px-6 py-3 bg-accent-coral/10 text-accent-coral rounded-xl text-sm font-bold border border-accent-coral/20 hover:bg-accent-coral/20 transition-all"
               >
                  <Trash2 size={16} /> Apagar Cliente
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardCalendar({ 
  client, 
  setClient, 
  currentDate, 
  setCurrentDate 
}: { 
  client: any, 
  setClient: any, 
  currentDate: Date, 
  setCurrentDate: (d: Date) => void 
}) {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedRecurringDays, setSelectedRecurringDays] = useState<number[]>([]);
  const [recurrenceType, setRecurrenceType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY_DAY' | 'MONTHLY_ORDINAL' | 'NONE'>('NONE');
  const [ordinalSelection, setOrdinalSelection] = useState<{ ordinal: number, day: number }>({ ordinal: 1, day: 1 });
  
  useEffect(() => {
    if (selectedEvent) {
      setSelectedRecurringDays(selectedEvent.recurringDays || []);
      setRecurrenceType(selectedEvent.recurrenceType || (selectedEvent.isRecurring ? 'MONTHLY_DAY' : (selectedEvent.recurringDays?.length > 0 ? 'WEEKLY' : 'NONE')));
      setOrdinalSelection(selectedEvent.ordinalWeekday || { 
        ordinal: selectedDay ? Math.ceil(selectedDay.getDate() / 7) : 1, 
        day: selectedDay?.getDay() || 0 
      });
    } else {
      setSelectedRecurringDays([]);
      setRecurrenceType('NONE');
      setOrdinalSelection({ 
        ordinal: selectedDay ? Math.ceil(selectedDay.getDate() / 7) : 1, 
        day: selectedDay?.getDay() || 0 
      });
    }
  }, [selectedEvent, showEventModal, selectedDay]);

  const matchesRecurrence = useCallback((date: Date, event: any, isRecurringClient: boolean) => {
    const dateStr = date.toISOString().split('T')[0];
    if (event.deletedDates?.includes(dateStr)) return false;

    const rType = event.recurrenceType || (event.isRecurring ? 'MONTHLY_DAY' : (event.recurringDays && event.recurringDays.length > 0) ? 'WEEKLY' : 'NONE');
    
    // Effective recurrence for content items if no specific recurrence set but client is recurring
    const effectiveRecurrence = (event.type === 'content' && isRecurringClient && rType === 'NONE' && event.isRecurring === undefined) ? 'MONTHLY_DAY' : rType;

    switch (effectiveRecurrence) {
      case 'DAILY':
        return true;
      case 'WEEKLY':
        return event.recurringDays?.includes(date.getDay());
      case 'MONTHLY_DAY': {
        const targetDate = new Date((event.targetDate || event.date) + "T12:00:00");
        return date.getDate() === targetDate.getDate();
      }
      case 'MONTHLY_ORDINAL': {
        if (!event.ordinalWeekday) return false;
        const { ordinal, day } = event.ordinalWeekday;
        if (date.getDay() !== day) return false;
        const dayOfMonth = date.getDate();
        const calcOrdinal = Math.ceil(dayOfMonth / 7);
        return calcOrdinal === ordinal;
      }
      case 'NONE':
        return dateStr === (event.targetDate || event.date);
      default:
        return false;
    }
  }, []);
  
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    
    // Fill previous month days
    const firstDayIndex = date.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex; i > 0; i--) {
      days.push({ day: prevMonthLastDay - i + 1, month: 'prev', date: new Date(year, month - 1, prevMonthLastDay - i + 1) });
    }
    
    // Fill current month days
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= lastDay; i++) {
      days.push({ day: i, month: 'current', date: new Date(year, month, i) });
    }
    
    // Fill next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, month: 'next', date: new Date(year, month + 1, i) });
    }
    
    return days;
  }, [currentDate]);

  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const getEventsForDate = (date: Date) => {
    const events: any[] = [];
    const isRecurringClient = client.billingModel === 'RECURRING';
    
    if (client.contentPlan?.items) {
      client.contentPlan.items.forEach((item: any) => {
        if (matchesRecurrence(date, { ...item, type: 'content' }, isRecurringClient)) {
          events.push({ type: 'content', ...item });
        }
      });
    }
    
    if (client.captures) {
      client.captures.forEach((cap: any) => {
        if (matchesRecurrence(date, { ...cap, type: 'capture' }, false)) {
          events.push({ type: 'capture', ...cap });
        }
      });
    }

    if (client.meetings) {
      client.meetings.forEach((meeting: any) => {
        if (matchesRecurrence(date, { ...meeting, type: 'meeting' }, false)) {
          events.push({ type: 'meeting', ...meeting });
        }
      });
    }
    
    return events;
  };

  const isEventDelayed = (event: any, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const isCompleted = (event.isRecurring || event.recurringDays?.length > 0)
      ? event.completedDates?.includes(dateStr)
      : (event.status === 'POSTED' || event.status === 'DONE');

    if (isCompleted) return false;
    const today = new Date();
    
    // ONLY show as delayed if it's in the current real-world month
    if (date.getMonth() !== today.getMonth() || date.getFullYear() !== today.getFullYear()) {
      return false;
    }

    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  const handleEventClick = async (e: React.MouseEvent, event: any, date: Date) => {
    e.stopPropagation();
    const dateStr = date.toISOString().split('T')[0];
    const isRecurring = event.isRecurring || 
                       (event.recurringDays && event.recurringDays.length > 0) || 
                       (event.type === 'content' && client.billingModel === 'RECURRING');
    
    let updatedClient = { ...client };
    if (event.type === 'content') {
      const items = (updatedClient.contentPlan?.items || []).map((i: any) => {
        if (i.id !== event.id) return i;
        
        if (isRecurring) {
          const completedDates = i.completedDates || [];
          const newCompleted = completedDates.includes(dateStr)
            ? completedDates.filter((d: string) => d !== dateStr)
            : [...completedDates, dateStr];
          return { ...i, completedDates: newCompleted };
        }
        return { ...i, status: i.status === 'POSTED' ? 'PLANNED' : 'POSTED' };
      });
      updatedClient = { ...updatedClient, contentPlan: { ...(updatedClient.contentPlan || { total: 0 }), items } };
      
      const isNowDone = isRecurring 
        ? updatedClient.contentPlan.items.find((i: any) => i.id === event.id)?.completedDates?.includes(dateStr)
        : updatedClient.contentPlan.items.find((i: any) => i.id === event.id)?.status === 'POSTED';
      
      toast.success(isNowDone ? 'Vídeo postado!' : 'Vídeo planejado');
    } else if (event.type === 'capture') {
      const captures = (updatedClient.captures || []).map((i: any) => {
        if (i.id !== event.id) return i;
        
        if (isRecurring) {
          const completedDates = i.completedDates || [];
          const newCompleted = completedDates.includes(dateStr)
            ? completedDates.filter((d: string) => d !== dateStr)
            : [...completedDates, dateStr];
          return { ...i, completedDates: newCompleted };
        }
        return { ...i, status: i.status === 'DONE' ? 'PLANNED' : 'DONE' };
      });
      updatedClient = { ...updatedClient, captures };
      
      const isNowDone = isRecurring 
        ? updatedClient.captures.find((i: any) => i.id === event.id)?.completedDates?.includes(dateStr)
        : updatedClient.captures.find((i: any) => i.id === event.id)?.status === 'DONE';

      toast.success(isNowDone ? 'Captação concluída!' : 'Captação pendente');
    } else if (event.type === 'meeting') {
      const meetings = (updatedClient.meetings || []).map((i: any) => {
        if (i.id !== event.id) return i;
        
        if (isRecurring) {
          const completedDates = i.completedDates || [];
          const newCompleted = completedDates.includes(dateStr)
            ? completedDates.filter((d: string) => d !== dateStr)
            : [...completedDates, dateStr];
          return { ...i, completedDates: newCompleted };
        }
        return { ...i, status: i.status === 'DONE' ? 'PLANNED' : 'DONE' };
      });
      updatedClient = { ...updatedClient, meetings };

      const isNowDone = isRecurring 
        ? updatedClient.meetings.find((i: any) => i.id === event.id)?.completedDates?.includes(dateStr)
        : updatedClient.meetings.find((i: any) => i.id === event.id)?.status === 'DONE';

      toast.success(isNowDone ? 'Reunião concluída!' : 'Reunião pendente');
    }

    setClient(updatedClient);
    await storage.saveClient(updatedClient);
  };

  const handleEventDoubleClick = (e: React.MouseEvent, event: any, date: Date) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setSelectedDay(date);
    setShowEventModal(true);
  };

  const handleSaveEvent = async (formData: FormData) => {
    const type = formData.get('type') as string;
    const title = formData.get('title') as string;
    const notes = formData.get('notes') as string;
    const dateStr = selectedDay?.toISOString().split('T')[0] || '';
    
    let updatedClient = { ...client };
    const eventData = {
      title: title || '',
      notes: notes || '',
      recurrenceType: recurrenceType || 'NONE',
      recurringDays: recurrenceType === 'WEEKLY' ? (selectedRecurringDays || []) : [],
      ordinalWeekday: recurrenceType === 'MONTHLY_ORDINAL' ? ordinalSelection : null,
      isRecurring: recurrenceType !== 'NONE'
    };

    if (selectedEvent) {
      // Edit mode
      if (selectedEvent.type === 'content') {
        const items = (updatedClient.contentPlan?.items || []).map((i: any) => 
          i.id === selectedEvent.id ? { ...i, ...eventData, targetDate: dateStr } : i
        );
        updatedClient = { ...updatedClient, contentPlan: { ...(updatedClient.contentPlan || { total: 0 }), items } };
      } else if (selectedEvent.type === 'capture') {
        const captures = (updatedClient.captures || []).map((i: any) => 
          i.id === selectedEvent.id ? { ...i, ...eventData, date: dateStr } : i
        );
        updatedClient = { ...updatedClient, captures };
      } else if (selectedEvent.type === 'meeting') {
        const meetings = (updatedClient.meetings || []).map((i: any) => 
          i.id === selectedEvent.id ? { ...i, ...eventData, date: dateStr } : i
        );
        updatedClient = { ...updatedClient, meetings };
      }
    } else {
      // Add mode
      const newId = Math.random().toString(36).substring(7);
      if (type === 'content') {
        const currentContentPlan = updatedClient.contentPlan || { total: 0, items: [] };
        const newItems = [...(currentContentPlan.items || []), { id: newId, targetDate: dateStr, status: 'PLANNED', ...eventData }];
        updatedClient = { ...updatedClient, contentPlan: { ...currentContentPlan, items: newItems } };
      } else if (type === 'capture') {
        const captures = [...(updatedClient.captures || []), { id: newId, date: dateStr, status: 'PLANNED', ...eventData }];
        updatedClient = { ...updatedClient, captures };
      } else if (type === 'meeting') {
        const meetings = [...(updatedClient.meetings || []), { id: newId, date: dateStr, status: 'PLANNED', ...eventData }];
        updatedClient = { ...updatedClient, meetings };
      }
    }

    setClient(updatedClient);
    await storage.saveClient(updatedClient);
    setShowEventModal(false);
    toast.success(selectedEvent ? "Evento atualizado!" : "Evento adicionado!");
  };

  const handleDeleteEventFromGrid = async (event: any, date: Date) => {
    const isRecurring = event.recurrenceType 
                       ? event.recurrenceType !== 'NONE'
                       : (event.isRecurring || (event.recurringDays && event.recurringDays.length > 0) || (event.type === 'content' && client.billingModel === 'RECURRING'));

    let onlyThisOccurrence = false;
    if (isRecurring) {
      const confirmMsg = "Esta é uma demanda recorrente.\n\nDeseja excluir TODA A SÉRIE? (Clique em OK para excluir toda a série, ou em Cancelar para excluir apenas esta ocorrência específica)";
      const deleteAll = window.confirm(confirmMsg);
      onlyThisOccurrence = !deleteAll;
    } else {
      if (!window.confirm(`Deseja realmente excluir a demanda "${event.title || (event.type === 'content' ? 'Vídeo' : (event.type === 'capture' ? 'Captação' : 'Reunião'))}"?`)) return;
    }

    let updatedClient = { ...client };
    const dateStr = date.toISOString().split('T')[0] || '';

    if (onlyThisOccurrence && isRecurring) {
      if (event.type === 'content') {
        const items = (updatedClient.contentPlan?.items || []).map((i: any) => {
          if (i.id !== event.id) return i;
          const deletedDates = i.deletedDates || [];
          return { ...i, deletedDates: [...deletedDates, dateStr] };
        });
        updatedClient = { ...updatedClient, contentPlan: { ...(updatedClient.contentPlan || { total: 0 }), items } };
      } else if (event.type === 'capture') {
        const captures = (updatedClient.captures || []).map((i: any) => {
          if (i.id !== event.id) return i;
          const deletedDates = i.deletedDates || [];
          return { ...i, deletedDates: [...deletedDates, dateStr] };
        });
        updatedClient = { ...updatedClient, captures };
      } else if (event.type === 'meeting') {
        const meetings = (updatedClient.meetings || []).map((i: any) => {
          if (i.id !== event.id) return i;
          const deletedDates = i.deletedDates || [];
          return { ...i, deletedDates: [...deletedDates, dateStr] };
        });
        updatedClient = { ...updatedClient, meetings };
      }
    } else {
      // Delete whole series
      if (event.type === 'content') {
        const items = updatedClient.contentPlan.items.filter((i: any) => i.id !== event.id);
        updatedClient = { ...updatedClient, contentPlan: { ...updatedClient.contentPlan, items } };
      } else if (event.type === 'capture') {
        const captures = updatedClient.captures.filter((i: any) => i.id !== event.id);
        updatedClient = { ...updatedClient, captures };
      } else if (event.type === 'meeting') {
        const meetings = updatedClient.meetings.filter((i: any) => i.id !== event.id);
        updatedClient = { ...updatedClient, meetings };
      }
    }

    setClient(updatedClient);
    await storage.saveClient(updatedClient);
    toast.success("Evento removido com sucesso!");
  };

  const handleDeleteEvent = async (onlyThisOccurrence: boolean = false) => {
    if (!selectedEvent) return;
    
    const isRecurring = selectedEvent.recurrenceType 
                       ? selectedEvent.recurrenceType !== 'NONE'
                       : (selectedEvent.isRecurring || (selectedEvent.recurringDays && selectedEvent.recurringDays.length > 0) || (selectedEvent.type === 'content' && client.billingModel === 'RECURRING'));

    if (!window.confirm(onlyThisOccurrence ? "Apagar apenas esta ocorrência?" : "Deseja apagar este evento (toda a série)?")) return;

    let updatedClient = { ...client };
    const dateStr = selectedDay?.toISOString().split('T')[0] || '';

    if (onlyThisOccurrence && isRecurring) {
      if (selectedEvent.type === 'content') {
        const items = (updatedClient.contentPlan?.items || []).map((i: any) => {
          if (i.id !== selectedEvent.id) return i;
          const deletedDates = i.deletedDates || [];
          return { ...i, deletedDates: [...deletedDates, dateStr] };
        });
        updatedClient = { ...updatedClient, contentPlan: { ...(updatedClient.contentPlan || { total: 0 }), items } };
      } else if (selectedEvent.type === 'capture') {
        const captures = (updatedClient.captures || []).map((i: any) => {
          if (i.id !== selectedEvent.id) return i;
          const deletedDates = i.deletedDates || [];
          return { ...i, deletedDates: [...deletedDates, dateStr] };
        });
        updatedClient = { ...updatedClient, captures };
      } else if (selectedEvent.type === 'meeting') {
        const meetings = (updatedClient.meetings || []).map((i: any) => {
          if (i.id !== selectedEvent.id) return i;
          const deletedDates = i.deletedDates || [];
          return { ...i, deletedDates: [...deletedDates, dateStr] };
        });
        updatedClient = { ...updatedClient, meetings };
      }
    } else {
      // Delete whole series
      if (selectedEvent.type === 'content') {
        const items = updatedClient.contentPlan.items.filter((i: any) => i.id !== selectedEvent.id);
        updatedClient = { ...updatedClient, contentPlan: { ...updatedClient.contentPlan, items } };
      } else if (selectedEvent.type === 'capture') {
        const captures = updatedClient.captures.filter((i: any) => i.id !== selectedEvent.id);
        updatedClient = { ...updatedClient, captures };
      } else if (selectedEvent.type === 'meeting') {
        const meetings = updatedClient.meetings.filter((i: any) => i.id !== selectedEvent.id);
        updatedClient = { ...updatedClient, meetings };
      }
    }

    setClient(updatedClient);
    await storage.saveClient(updatedClient);
    setShowEventModal(false);
    toast.success("Evento removido!");
  };

  return (
    <div className="glass rounded-3xl p-8 border border-white/5">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-medium capitalize">{monthName}</h3>
          <p className="text-xs text-text-muted">Cronograma de postagens, gravações e reuniões</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 mr-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">
             <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: client.brandColor }} /> Postagem</div>
             <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-fuchsia-400" /> Captação</div>
             <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-400" /> Reunião</div>
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronDown size={18} className="rotate-90" />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-3 text-[10px] font-bold uppercase hover:text-accent-mint transition-colors"
            >
              Hoje
            </button>
            <button 
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronDown size={18} className="-rotate-90" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="bg-bg-base/40 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {day}
          </div>
        ))}
        {daysInMonth.map((dateObj, idx) => {
          const events = getEventsForDate(dateObj.date);
          const isToday = dateObj.date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
          const hasDelayedEvent = events.some(e => isEventDelayed(e, dateObj.date));
          
          return (
            <div 
              key={idx} 
              onClick={() => handleDayClick(dateObj.date)}
              className={cn(
                "min-h-[100px] bg-bg-base/20 p-2 border-t border-white/[0.02] flex flex-col gap-1 transition-colors hover:bg-white/[0.03] cursor-pointer",
                dateObj.month !== 'current' && "opacity-20 pointer-events-none",
                hasDelayedEvent && "border-2 border-accent-coral/50 bg-accent-coral/[0.02]"
              )}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={cn(
                  "text-[10px] font-bold flex items-center justify-center w-5 h-5 rounded-full transition-colors",
                  isToday ? "bg-accent-mint text-black" : "text-text-muted"
                )}>
                  {dateObj.day}
                </span>
                {events.length > 0 && <div className="w-1 h-1 rounded-full bg-accent-mint" />}
              </div>
              
              <div className="space-y-1">
                {events.map((event: any) => {
                  const delayed = isEventDelayed(event, dateObj.date);
                  const dateStr = dateObj.date.toISOString().split('T')[0];
                  const isCompleted = (event.isRecurring || event.recurringDays?.length > 0)
                    ? event.completedDates?.includes(dateStr)
                    : (event.status === 'POSTED' || event.status === 'DONE');

                  return (
                    <div
                      key={`${event.id}-${dateStr}`}
                      className={cn(
                        "w-full text-[8px] font-bold p-1 rounded-md border flex items-center gap-1 justify-between transition-all group/event relative pr-4",
                        delayed && "border-accent-coral shadow-[0_0_10px_rgba(255,77,77,0.2)]",
                        event.type === 'content' 
                          ? (isCompleted ? "bg-accent-mint/20 border-accent-mint/30 text-accent-mint" : (delayed ? "bg-accent-coral/10 text-accent-coral" : "bg-accent-mint/10 border-accent-mint/10 text-white/40"))
                          : (event.type === 'capture' 
                              ? (isCompleted ? "bg-fuchsia-400/20 border-fuchsia-400/30 text-fuchsia-400" : (delayed ? "bg-accent-coral/10 text-accent-coral" : "bg-fuchsia-400/10 border-fuchsia-400/10 text-white/40"))
                              : (isCompleted ? "bg-blue-400/20 border-blue-400/30 text-blue-400" : (delayed ? "bg-accent-coral/10 text-accent-coral" : "bg-blue-400/10 border-blue-400/10 text-white/40"))
                            )
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleEventClick(e, event, dateObj.date)}
                        onDoubleClick={(e) => handleEventDoubleClick(e, event, dateObj.date)}
                        className="flex-1 min-w-0 flex items-center gap-1 text-left"
                      >
                        {event.type === 'content' ? <Play size={10} className="shrink-0" /> : (event.type === 'capture' ? <Camera size={10} className="shrink-0" /> : <MessageSquare size={10} className="shrink-0" />)}
                        <span className="flex-1 truncate">{event.title || (event.type === 'content' ? 'Vídeo' : (event.type === 'capture' ? 'Captação' : 'Reunião'))}</span>
                        {((event.type === 'content' && client.billingModel === 'RECURRING') || event.isRecurring) && (
                          <Clock size={8} className="opacity-60 shrink-0" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEventFromGrid(event, dateObj.date);
                        }}
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-30 group-hover/event:opacity-100 hover:opacity-100 hover:text-accent-coral p-0.5 rounded transition-all shrink-0 cursor-pointer"
                        title="Excluir Evento"
                      >
                        <Trash2 size={9} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showEventModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowEventModal(false)}
               className="absolute inset-0 bg-black/80 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-lg glass border border-white/10 rounded-3xl p-8 overflow-hidden shadow-2xl"
             >
                <div className="flex justify-between items-center mb-6">
                   <div>
                      <h4 className="text-xl font-medium">{selectedEvent ? 'Detalhes do Evento' : 'Agendar Evento'}</h4>
                      <p className="text-xs text-text-muted mt-1 uppercase tracking-widest font-bold">
                        {selectedDay?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                   </div>
                   <button onClick={() => setShowEventModal(false)} className="text-text-muted hover:text-white transition-colors">
                      <X size={20} />
                   </button>
                </div>

                <form key={selectedEvent?.id || 'new'} onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEvent(new FormData(e.currentTarget));
                }} className="space-y-6">
                   <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Tipo de Evento</label>
                      <div className="grid grid-cols-3 gap-3">
                         {[
                           { id: 'content', label: 'Post/Vídeo', icon: Play, color: 'text-accent-mint' },
                           { id: 'capture', label: 'Captação', icon: Camera, color: 'text-fuchsia-400' },
                           { id: 'meeting', label: 'Reunião', icon: MessageSquare, color: 'text-blue-400' }
                         ].map(t => (
                           <label key={t.id} className={cn(
                             "relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer group",
                             (selectedEvent?.type || 'content') === t.id ? "bg-white/10 border-white/20" : "bg-white/5 border-transparent opacity-50 hover:opacity-100"
                           )}>
                              <input type="radio" name="type" value={t.id} defaultChecked={(selectedEvent?.type || 'content') === t.id} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <t.icon size={20} className={t.color} />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-tight">{t.label}</span>
                           </label>
                         ))}
                      </div>
                   </div>

                   <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Título do Evento</label>
                      <input 
                        name="title" 
                        defaultValue={selectedEvent?.title}
                        required
                        placeholder="Ex: Vídeo de Reels, Captação na Sede..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium" 
                      />
                   </div>

                   <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Informações Adicionais (Briefing/Pauta)</label>
                      <textarea 
                        name="notes" 
                        defaultValue={selectedEvent?.notes}
                        rows={4}
                        placeholder="Adicione detalhes importantes aqui..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium resize-none text-sm" 
                      />
                   </div>

                   <div className="space-y-4">
                      {/* Lembretes e Controles de Recorrência */}
                      {selectedEvent && (selectedEvent.recurrenceType ? selectedEvent.recurrenceType !== 'NONE' : (selectedEvent.isRecurring || selectedEvent.recurringDays?.length > 0 || (selectedEvent.type === 'content' && client.billingModel === 'RECURRING'))) && (
                        <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] space-y-3">
                          <div className="flex items-start gap-2.5">
                            <Clock size={16} className="text-accent-mint shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-white uppercase tracking-wider">Demanda Recorrente (Lembrete)</p>
                              <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                                Esta demanda é um lembrete que repete-se automaticamente. Para adicionar as informações específicas de criativo para este dia sem afetar as demais repetições, desvincule esta data.
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/5">
                            <button
                              type="button"
                              onClick={async () => {
                                const dateStr = selectedDay?.toISOString().split('T')[0] || '';
                                let updatedClient = { ...client };
                                const newId = Math.random().toString(36).substring(7);
                                const singleEventData = {
                                  id: newId,
                                  title: selectedEvent.title || '',
                                  notes: selectedEvent.notes || '',
                                  recurrenceType: 'NONE',
                                  recurringDays: [],
                                  ordinalWeekday: null,
                                  isRecurring: false,
                                  status: selectedEvent.status || 'PLANNED',
                                };

                                if (selectedEvent.type === 'content') {
                                  const items = (updatedClient.contentPlan?.items || []).map((i: any) => {
                                    if (i.id !== selectedEvent.id) return i;
                                    const deletedDates = i.deletedDates || [];
                                    return { ...i, deletedDates: [...deletedDates, dateStr] };
                                  });
                                  const newItems = [...items, { ...singleEventData, targetDate: dateStr }];
                                  updatedClient = { ...updatedClient, contentPlan: { ...(updatedClient.contentPlan || { total: 0 }), items: newItems } };
                                } else if (selectedEvent.type === 'capture') {
                                  const captures = (updatedClient.captures || []).map((i: any) => {
                                    if (i.id !== selectedEvent.id) return i;
                                    const deletedDates = i.deletedDates || [];
                                    return { ...i, deletedDates: [...deletedDates, dateStr] };
                                  });
                                  const newCaptures = [...captures, { ...singleEventData, date: dateStr }];
                                  updatedClient = { ...updatedClient, captures: newCaptures };
                                } else if (selectedEvent.type === 'meeting') {
                                  const meetings = (updatedClient.meetings || []).map((i: any) => {
                                    if (i.id !== selectedEvent.id) return i;
                                    const deletedDates = i.deletedDates || [];
                                    return { ...i, deletedDates: [...deletedDates, dateStr] };
                                  });
                                  const newMeetings = [...meetings, { ...singleEventData, date: dateStr }];
                                  updatedClient = { ...updatedClient, meetings: newMeetings };
                                }

                                setClient(updatedClient);
                                await storage.saveClient(updatedClient);
                                setSelectedEvent({
                                  ...singleEventData,
                                  type: selectedEvent.type
                                });
                                toast.success("Desvinculado! Agora você pode preencher os dados deste criativo de forma independente.");
                              }}
                              className="flex-1 px-3 py-2 bg-accent-mint hover:bg-accent-mint/90 text-black font-bold text-[9px] rounded-xl uppercase tracking-wider transition-all cursor-pointer text-center"
                            >
                              📝 Preencher dados hoje (Tornar Único)
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm("Deseja realmente cancelar a repetição desta demanda? (Ela deixará de se repetir e passará a ser uma demanda única)")) return;
                                
                                let updatedClient = { ...client };
                                const stopRecurrenceData = {
                                  recurrenceType: 'NONE',
                                  recurringDays: [],
                                  ordinalWeekday: null,
                                  isRecurring: false
                                };

                                if (selectedEvent.type === 'content') {
                                  const items = (updatedClient.contentPlan?.items || []).map((i: any) => 
                                    i.id === selectedEvent.id ? { ...i, ...stopRecurrenceData } : i
                                  );
                                  updatedClient = { ...updatedClient, contentPlan: { ...(updatedClient.contentPlan || { total: 0 }), items } };
                                } else if (selectedEvent.type === 'capture') {
                                  const captures = (updatedClient.captures || []).map((i: any) => 
                                    i.id === selectedEvent.id ? { ...i, ...stopRecurrenceData } : i
                                  );
                                  updatedClient = { ...updatedClient, captures };
                                } else if (selectedEvent.type === 'meeting') {
                                  const meetings = (updatedClient.meetings || []).map((i: any) => 
                                    i.id === selectedEvent.id ? { ...i, ...stopRecurrenceData } : i
                                  );
                                  updatedClient = { ...updatedClient, meetings };
                                }

                                setClient(updatedClient);
                                await storage.saveClient(updatedClient);
                                setRecurrenceType('NONE');
                                setSelectedEvent({
                                  ...selectedEvent,
                                  ...stopRecurrenceData
                                });
                                toast.success("A repetição foi desativada! Esta se tornou uma demanda única.");
                              }}
                              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-[9px] rounded-xl uppercase tracking-wider transition-all cursor-pointer text-center"
                            >
                              ❌ Parar de repetir
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Tipo de Recorrência</label>
                          <select 
                            name="recurrenceType"
                            value={recurrenceType}
                            onChange={(e) => setRecurrenceType(e.target.value as any)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium text-sm"
                          >
                            <option value="NONE" className="bg-bg-base text-white">Nenhuma</option>
                            <option value="DAILY" className="bg-bg-base text-white">Diária (Todo dia)</option>
                            <option value="WEEKLY" className="bg-bg-base text-white">Semanal (Dias específicos)</option>
                            <option value="MONTHLY_DAY" className="bg-bg-base text-white">Mensal (Mesmo dia do mês)</option>
                            <option value="MONTHLY_ORDINAL" className="bg-bg-base text-white">Mensal (Ex: 1ª Terça)</option>
                          </select>
                        </div>
                        {recurrenceType === 'MONTHLY_ORDINAL' && (
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Qual ocorrência?</label>
                            <div className="flex gap-2">
                              <select 
                                value={ordinalSelection.ordinal}
                                onChange={(e) => setOrdinalSelection({...ordinalSelection, ordinal: parseInt(e.target.value)})}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium text-sm"
                              >
                                <option value="1" className="bg-bg-base text-white">1ª</option>
                                <option value="2" className="bg-bg-base text-white">2ª</option>
                                <option value="3" className="bg-bg-base text-white">3ª</option>
                                <option value="4" className="bg-bg-base text-white">4ª</option>
                                <option value="5" className="bg-bg-base text-white">Última</option>
                              </select>
                              <select 
                                value={ordinalSelection.day}
                                onChange={(e) => setOrdinalSelection({...ordinalSelection, day: parseInt(e.target.value)})}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent-mint/50 transition-all font-medium text-sm"
                              >
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                                  <option key={i} value={i} className="bg-bg-base text-white">{d}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {recurrenceType === 'WEEKLY' && (
                        <div>
                           <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Dias da Semana</label>
                           <div className="flex flex-wrap gap-2">
                              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => {
                                 const isSelected = selectedRecurringDays.includes(idx);
                                 return (
                                   <button
                                     key={day}
                                     type="button"
                                     onClick={() => {
                                       if (isSelected) {
                                         setSelectedRecurringDays(selectedRecurringDays.filter(d => d !== idx));
                                       } else {
                                         setSelectedRecurringDays([...selectedRecurringDays, idx]);
                                       }
                                     }}
                                     className={cn(
                                       "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                       isSelected 
                                         ? "bg-accent-mint text-black border-accent-mint" 
                                         : "bg-white/5 text-text-muted border-white/10 hover:border-white/20"
                                     )}
                                   >
                                     {day}
                                   </button>
                                 );
                              })}
                           </div>
                        </div>
                      )}
                   </div>

                   <div className="flex gap-4 pt-4">
                      {selectedEvent && (
                        <div className="flex-1 flex flex-col gap-2">
                          <button 
                            type="button" 
                            onClick={() => handleDeleteEvent(false)}
                            className="w-full px-4 py-3 bg-accent-coral/10 text-accent-coral rounded-xl text-[10px] font-bold uppercase tracking-widest border border-accent-coral/20 hover:bg-accent-coral/20 transition-all"
                          >
                            Apagar Série
                          </button>
                          {(selectedEvent.recurrenceType ? selectedEvent.recurrenceType !== 'NONE' : (selectedEvent.isRecurring || selectedEvent.recurringDays?.length > 0 || (selectedEvent.type === 'content' && client.billingModel === 'RECURRING'))) && (
                            <button 
                              type="button" 
                              onClick={() => handleDeleteEvent(true)}
                              className="w-full px-4 py-3 bg-accent-amber/10 text-accent-amber rounded-xl text-[10px] font-bold uppercase tracking-widest border border-accent-amber/20 hover:bg-accent-amber/20 transition-all"
                            >
                              Apagar Apenas Hoje
                            </button>
                          )}
                        </div>
                      )}
                      <button 
                        type="submit" 
                        className="flex-[2] bg-accent-mint text-black font-bold px-8 py-4 rounded-xl hover:bg-accent-mint/90 transition-all shadow-lg shadow-accent-mint/10"
                      >
                         {selectedEvent ? 'Salvar Alterações' : 'Agendar Evento'}
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

function ClientKPICard({ label, value, isCurrency, isDecimal, trend, suffix, color }: any) {
  const { isVisible } = useVisibility();
  
  const displayValue = useMemo(() => {
    if (!isVisible) return '•••••';
    if (isCurrency) return formatCurrency(value).replace('R$', '').trim();
    if (isDecimal) return value.toFixed(2);
    return value;
  }, [isVisible, value, isCurrency, isDecimal]);

  return (
    <div className="glass p-6 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-3xl font-medium tracking-tight", color)}>
           {displayValue}
        </span>
        {isVisible && suffix && <span className="text-xs text-text-muted font-bold">{suffix}</span>}
      </div>
      {isVisible && trend !== undefined && trend !== 0 && (
        <div className={cn("text-[10px] font-bold flex items-center gap-1", trend > 0 ? "text-accent-mint" : "text-accent-coral")}>
           {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
           {Math.abs(trend).toFixed(1)}% vs anterior
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  const { isVisible } = useVisibility();
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-medium">{isVisible ? value : '•••••'}</span>
    </div>
  );
}

function ConversionFunnelVisual({ entry, client, metrics }: any) {
  if (!client || !entry || !metrics) return null;
  const type = client?.businessType;
  const config = BUSINESS_CONFIGS[type] || BUSINESS_CONFIGS.SERVICE_BOOKING;
  const customSteps = client?.customFunnelSteps;
  
  const stages = useMemo(() => {
    if (customSteps && customSteps.length > 0) {
      return customSteps.map((step: any, idx: number) => {
        // Try to find value in standard fields first, then customData
        const standardFields = ['leads', 'bookings', 'shows', 'sales', 'sessions', 'addCart', 'purchases', 'mqls', 'waClicks', 'waConversations'];
        let value = 0;
        if (standardFields.includes(step.id)) {
          value = entry[step.id] || 0;
        } else {
          value = entry.customData?.[step.id] || 0;
        }

        let rate = undefined;
        // Basic conversion from previous step if available
        if (idx > 0) {
          const prevStep = customSteps[idx-1];
          let prevValue = 0;
          if (standardFields.includes(prevStep.id)) {
            prevValue = entry[prevStep.id] || 0;
          } else {
            prevValue = entry.customData?.[prevStep.id] || 0;
          }
          if (prevValue > 0) rate = (value / prevValue) * 100;
        }

        return {
          label: step.label,
          value,
          rate
        };
      });
    }

    return config.funnel.map((key: string) => {
      let value = entry[key] || 0;
      let rate = undefined;
      
      // Calculate rates based on stage
      if (key === 'bookings') rate = metrics.bookingRate;
      if (key === 'shows') rate = metrics.showRate;
      if (key === 'sales' || key === 'purchases') rate = metrics.conversion;
      if (key === 'waConversations') rate = metrics.waResponseRate;
      if (key === 'mqls') rate = metrics.mqlRate;
      if (key === 'addCart') rate = (100 - (metrics.abandonRate || 0));

      return {
        label: config.labels[key] || key,
        value,
        rate
      };
    });
  }, [entry, type, metrics, config, customSteps]);

  const maxVal = Math.max(...stages.map((s: any) => s.value), 1);

  return (
    <div className="space-y-6">
      {stages.map((stage, idx) => (
         <div key={idx} className="space-y-2">
            <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-wider">
               <span className="text-text-secondary">{stage.label}</span>
               <div className="flex items-center gap-2">
                  {stage.rate !== undefined && (
                    <span className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-accent-mint">{stage.rate.toFixed(1)}%</span>
                  )}
                  <span className="text-white">{formatNumber(stage.value)}</span>
               </div>
            </div>
            <div className="h-6 bg-white/5 rounded-lg relative overflow-hidden group">
               <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(stage.value / maxVal) * 100}%` }}
                transition={{ duration: 1, delay: idx * 0.1 }}
                className={cn(
                  "h-full bg-gradient-to-r transition-all",
                  idx === 0 ? "from-accent-mint/20 to-accent-mint" : "from-accent-mint/40 to-accent-mint/80"
                )}
               />
               <div className="absolute inset-x-2 inset-y-0 flex items-center">
                  <span className="text-[10px] font-bold text-black drop-shadow-sm opacity-60">{formatNumber(stage.value)}</span>
               </div>
            </div>
         </div>
      ))}
    </div>
  );
}

function HealthBadge({ status }: { status: string }) {
  const configs = {
    GOOD: { text: 'Em Dia', color: 'bg-accent-mint', glow: 'shadow-[0_0_10px_rgba(0,217,163,0.5)]' },
    WARNING: { text: 'Alerta', color: 'bg-accent-amber', glow: 'shadow-[0_0_10px_rgba(255,176,32,0.5)]' },
    CRITICAL: { text: 'Abaixo da Meta', color: 'bg-accent-coral', glow: 'shadow-[0_0_10px_rgba(255,77,77,0.5)]' },
  }[status as 'GOOD' | 'WARNING' | 'CRITICAL'];

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full glass border-white/5">
       <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", configs.color, configs.glow)} />
       <span className="text-[10px] font-bold uppercase tracking-widest leading-none mt-0.5">{configs.text}</span>
    </div>
  );
}

function AccessInfoRow({ item, onChange, onRemove }: { item: any, onChange: (item: any) => void, onRemove: () => void }) {
  const [showPassword, setShowPassword] = useState(false);

  const handleCopy = (text: string, label: string) => {
    if (!text) {
      toast.error(`${label} está vazio!`);
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-xl border border-white/5 relative group/row">
      <button 
        type="button" 
        onClick={onRemove}
        className="absolute top-2 right-2 p-1.5 text-text-muted hover:text-accent-coral opacity-0 group-hover/row:opacity-100 transition-all"
      >
        <Trash2 size={14} />
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[8px] font-bold text-text-muted uppercase tracking-wider">Plataforma</label>
          <input 
            value={item.platform} 
            onChange={(e) => onChange({ ...item, platform: e.target.value })}
            placeholder="Instagram, Facebook..."
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent-mint/30"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[8px] font-bold text-text-muted uppercase tracking-wider">Usuário / Login</label>
          <div className="flex items-center gap-2">
            <input 
              value={item.login} 
              onChange={(e) => onChange({ ...item, login: e.target.value })}
              placeholder="Ex: @empresa"
              className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent-mint/30"
            />
            <button 
              type="button"
              onClick={() => handleCopy(item.login, 'Usuário')}
              className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted transition-colors"
              title="Copiar Usuário"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[8px] font-bold text-text-muted uppercase tracking-wider">Senha</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input 
                type={showPassword ? "text" : "password"}
                value={item.password} 
                onChange={(e) => onChange({ ...item, password: e.target.value })}
                placeholder="********"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-accent-mint/30"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button 
              type="button"
              onClick={() => handleCopy(item.password, 'Senha')}
              className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted transition-colors"
              title="Copiar Senha"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[8px] font-bold text-text-muted uppercase tracking-wider">Link (URL)</label>
          <input 
            value={item.url || ''} 
            onChange={(e) => onChange({ ...item, url: e.target.value })}
            placeholder="Ex: https://instagram.com/..."
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent-mint/30"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[8px] font-bold text-text-muted uppercase tracking-wider">Observações</label>
          <input 
            value={item.notes || ''} 
            onChange={(e) => onChange({ ...item, notes: e.target.value })}
            placeholder="Ex: 2FA ativa no celular..."
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent-mint/30"
          />
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, TrendingUp, DollarSign, Wallet2, Plus, ArrowRight, Activity, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { storage } from '../lib/storage';
import { calculateMetrics, getHealthStatus } from '../lib/calculations';
import { formatCurrency, cn } from '../lib/utils';
import { useVisibility } from '../contexts/VisibilityContext';
import { ResponsiveContainer, ComposedChart, Bar, Line, Tooltip as RechartsTooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

interface DashboardStats {
  totalInvested: number;
  totalRevenue: number;
  activeClients: number;
  averageRoas: number;
  globalChartData: any[];
  clientEntries: Record<string, any[]>;
}

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

export function Dashboard() {
  const { isVisible } = useVisibility();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalInvested: 0,
    totalRevenue: 0,
    activeClients: 0,
    averageRoas: 0,
    globalChartData: [],
    clientEntries: {}
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const allClients = await storage.getClients();
      setClients(allClients);

      const entriesMap: Record<string, any[]> = {};
      let totalInvested = 0;
      let totalRevenue = 0;
      const dateMap = new Map<string, { investment: number; revenue: number; timestamp: number }>();

      await Promise.all(allClients.map(async (client) => {
        const entries = await storage.getEntries(client.id);
        entriesMap[client.id] = entries;
        
        if (entries.length > 0) {
          const last = entries[entries.length - 1];
          totalInvested += last.investment || 0;
          totalRevenue += last.revenue || 0;
        }

        entries.forEach(entry => {
          const date = new Date(entry.date);
          const dateKey = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          const current = dateMap.get(dateKey) || { investment: 0, revenue: 0, timestamp: date.getTime() };
          dateMap.set(dateKey, {
            investment: current.investment + entry.investment,
            revenue: current.revenue + (entry.revenue || 0),
            timestamp: Math.min(current.timestamp, date.getTime())
          });
        });
      }));

      const averageRoas = totalInvested > 0 ? totalRevenue / totalInvested : 0;
      const globalChartData = Array.from(dateMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => a.timestamp - b.timestamp);

      setStats({
        totalInvested,
        totalRevenue,
        activeClients: allClients.length,
        averageRoas,
        globalChartData,
        clientEntries: entriesMap
      });
      setLoading(false);
    };

    fetchData();
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  const categorizedClients = useMemo(() => {
    const base = selectedCategory === 'todos' ? clients : clients.filter(c => c.businessType === selectedCategory);
    return {
      monthly: base.filter(c => c.billingModel !== 'ONE_OFF'),
      single: base.filter(c => c.billingModel === 'ONE_OFF')
    };
  }, [clients, selectedCategory]);

  const categories = useMemo(() => {
    const types = Array.from(new Set(clients.map(c => c.businessType)));
    return ['todos', ...types];
  }, [clients]);

  if (loading) {
    return (
      <div className="py-32 flex justify-center">
        <div className="w-8 h-8 rounded-full border-t-2 border-accent-mint animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Faturamento" value={stats.totalRevenue} isCurrency icon={<DollarSign size={20} />} variation={12.5} />
        <KPICard label="Investimento" value={stats.totalInvested} isCurrency icon={<Wallet2 size={20} />} variation={-4.2} />
        <KPICard label="ROAS Médio" value={stats.averageRoas} icon={<TrendingUp size={20} />} variation={7.8} />
        <KPICard label="Clientes" value={stats.activeClients} icon={<Users size={20} />} />
      </div>

      <div className="glass p-8 rounded-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-medium tracking-tight">Evolução Consolidada</h2>
            <p className="text-text-muted text-sm">Performance agregada de todos os clientes</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-accent-mint" /> Faturamento</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white/20" /> Investimento</span>
          </div>
        </div>

        <div className="h-[400px] min-w-0 w-full overflow-hidden">
          {stats.globalChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50} key="consolidated-chart">
              <ComposedChart data={stats.globalChartData}>
                <defs>
                  <linearGradient id="globalRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D9A3" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00D9A3" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} dy={10} />
                <YAxis hide />
                <RechartsTooltip 
                  contentStyle={{ background: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                  formatter={(val: any) => isVisible ? formatCurrency(val) : '•••••'}
                />
                <Bar dataKey="revenue" fill="url(#globalRev)" radius={[6, 6, 0, 0]} barSize={40} />
                <Line type="monotone" dataKey="investment" stroke="rgba(255,255,255,0.3)" strokeWidth={2} dot={{ r: 4, fill: '#00D9A3', strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-full flex items-center justify-center text-text-muted italic opacity-40">
               Nenhum dado consolidado disponível.
             </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-medium tracking-tight">Performance por Cliente</h2>
            <div className="flex flex-wrap gap-2 pt-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border",
                    selectedCategory === cat 
                      ? "bg-accent-mint border-accent-mint text-black" 
                      : "bg-white/5 border-white/10 text-text-muted hover:border-white/20"
                  )}
                >
                  {cat === 'todos' ? 'Todos os Setores' : cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <Link to="/clientes" className="text-accent-mint font-medium hover:underline text-sm flex items-center gap-1 shrink-0">
            Ver carteira completa <ArrowRight size={14} />
          </Link>
        </div>

        <div className="space-y-12">
          {categorizedClients.monthly.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-mint" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted">Planos Mensais</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categorizedClients.monthly.slice(0, 6).map((client, i) => (
                  <GlobalClientCard key={client.id} client={client} index={i} entries={stats.clientEntries[client.id] || []} />
                ))}
              </div>
            </div>
          )}

          {categorizedClients.single.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted">Trabalhos Únicos</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categorizedClients.single.map((client, i) => (
                  <GlobalClientCard key={client.id} client={client} index={i + 10} entries={stats.clientEntries[client.id] || []} />
                ))}
              </div>
            </div>
          )}

          {categorizedClients.monthly.length === 0 && categorizedClients.single.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center glass rounded-3xl border-dashed">
              <PlusCircle size={40} className="text-text-muted mb-4 opacity-20" />
              <p className="text-text-secondary font-medium">Nenhum cliente encontrado nesta categoria.</p>
              <button onClick={() => setSelectedCategory('todos')} className="text-accent-mint text-sm mt-3 font-bold hover:underline">Ver todos os clientes</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, isCurrency = false, variation, icon }: any) {
  const { isVisible } = useVisibility();
  return (
    <div className="glass p-6 rounded-2xl glass-hover relative group overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary group-hover:text-accent-mint transition-colors">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-medium tracking-tighter">
          {!isVisible ? '•••••' : (isCurrency ? formatCurrency(value).replace('R$', '').trim() : typeof value === 'number' ? value.toFixed(value < 10 ? 2 : 0) : value)}
        </span>
        {isVisible && isCurrency && <span className="text-sm text-text-muted">BRL</span>}
      </div>
      {isVisible && variation && (
        <div className={cn("text-[10px] font-bold mt-2 flex items-center gap-1", variation > 0 ? "text-accent-mint" : "text-accent-coral")}>
           {variation > 0 ? '↑' : '↓'} {Math.abs(variation)}% 
           <span className="text-text-muted opacity-60">vs mês anterior</span>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-accent-mint/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function GlobalClientCard({ client, index, entries }: any) {
  const { isVisible } = useVisibility();
  const last = entries[entries.length - 1];
  const metrics = last ? calculateMetrics(last, client.businessType) : null;
  
  const isRealEstate = client.businessType === 'REAL_ESTATE';
  const isLocal = client.businessType === 'LOCAL_BUSINESS';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link 
        to={`/clientes/${client.id}`}
        className={cn(
          "glass glass-hover p-6 rounded-3xl block group relative transition-all duration-500",
          isContentDelayed(client) && "border border-accent-coral/50 bg-accent-coral/[0.02]"
        )}
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-black font-bold" style={{ backgroundColor: client.brandColor }}>
              {client.logo ? (
                <img src={client.logo} alt={client.name} className="w-full h-full object-cover" />
              ) : (
                client.name.charAt(0)
              )}
            </div>
            {isContentDelayed(client) && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-coral rounded-full border-2 border-bg-base animate-pulse shadow-[0_0_10px_rgba(255,77,77,0.8)]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className={cn("font-medium transition-colors", isContentDelayed(client) ? "text-accent-coral font-bold" : "group-hover:text-accent-mint")}>{client.name}</h4>
              <span className={cn(
                "text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter",
                client.billingModel === 'ONE_OFF' ? "bg-blue-400/10 text-blue-400" : "bg-accent-mint/10 text-accent-mint"
              )}>
                {client.billingModel === 'ONE_OFF' ? 'Único' : 'Mensal'}
              </span>
            </div>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{client.businessType.replace('_', ' ')}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
           {isRealEstate ? (
             <>
               <div className="bg-white/5 p-3 rounded-2xl">
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">LEADS</p>
                  <p className="text-lg font-medium">{last?.leads || 0}</p>
               </div>
               <div className="bg-white/5 p-3 rounded-2xl">
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">VISITAS</p>
                  <p className="text-lg font-medium">{last?.bookings || 0}</p>
               </div>
             </>
           ) : isLocal ? (
             <>
               <div className="bg-white/5 p-3 rounded-2xl">
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">CONTATOS</p>
                  <p className="text-lg font-medium">{last?.leads || 0}</p>
               </div>
               <div className="bg-white/5 p-3 rounded-2xl">
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">VENDAS</p>
                  <p className="text-lg font-medium">{last?.sales || 0}</p>
               </div>
             </>
           ) : client.performanceMode === 'LEADS' ? (
             <>
               <div className="bg-white/5 p-3 rounded-2xl">
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">LEADS</p>
                  <p className="text-lg font-medium">{last?.leads || 0}</p>
               </div>
               <div className="bg-white/5 p-3 rounded-2xl">
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">VENDAS</p>
                  <p className="text-lg font-medium">{last?.sales || 0}</p>
               </div>
             </>
           ) : (
             <>
               <div className="bg-white/5 p-3 rounded-2xl">
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">ROAS</p>
                  <p className="text-lg font-medium">{isVisible ? (metrics ? (metrics.roas || 0).toFixed(2) : '--') : '•••••'}</p>
               </div>
               <div className="bg-white/5 p-3 rounded-2xl">
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">FATURAMENTO</p>
                  <p className="text-lg font-medium tracking-tight text-white/90">{last ? (isVisible ? formatCurrency(last.revenue || 0).replace('R$', '').trim() : '•••••') : '--'}</p>
                </div>
              </>
            )}
        </div>

        <div className="mt-2 pt-4 border-t border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-1.5">
             <Activity size={12} className="text-accent-mint" />
             <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Saudável</span>
           </div>
           <ArrowRight size={14} className="text-text-muted group-hover:translate-x-1 group-hover:text-white transition-all" />
        </div>
      </Link>
    </motion.div>
  );
}

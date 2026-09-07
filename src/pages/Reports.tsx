import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  FileText, Search, ChevronRight, User, Calendar, ExternalLink, Filter,
  TrendingUp, DollarSign, Target, Users as UsersIcon, Plus, Download, Share2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { storage } from '../lib/storage';
import { formatCurrency, cn } from '../lib/utils';
import { calculateMetrics } from '../lib/calculations';
import { toast } from 'sonner';
import { PerformanceReportModal } from '../components/PerformanceReportModal';
import { Zap } from 'lucide-react';

export function Reports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [period, setPeriod] = useState('Atual');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  const [clients, setClients] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    storage.getClients().then(data => {
      setClients(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      storage.getEntries(selectedClientId).then(setEntries);
    } else {
      setEntries([]);
    }
  }, [selectedClientId]);

  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);
  
  const filteredClients = useMemo(() => {
    return clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [clients, searchTerm]);

  const metrics = useMemo(() => {
    if (entries.length === 0 || !selectedClient) return null;
    const last = entries[entries.length - 1];
    return calculateMetrics(last, selectedClient.businessType);
  }, [entries, selectedClient]);

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    return {
      totalRev: entries.reduce((acc, c) => acc + (c.revenue || 0), 0),
      totalInv: entries.reduce((acc, c) => acc + (c.investment || 0), 0),
      totalLeads: entries.reduce((acc, c) => acc + (c.leads || 0), 0),
      totalSales: entries.reduce((acc, c) => acc + (c.sales || 0), 0),
    };
  }, [entries]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    const toastId = toast.loading("Gerando PDF...");
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0A0A0B',
        onclone: (clonedDoc) => {
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
        orientation: 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Relatorio-${selectedClient?.name || 'Cliente'}-${new Date().toLocaleDateString()}.pdf`);
      toast.success("PDF exportado com sucesso!", { id: toastId });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error("Erro ao gerar PDF. Tente novamente.", { id: toastId });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Relatórios de Performance</h1>
          <p className="text-text-muted">Gere documentos detalhados para seus clientes</p>
        </div>
        <button 
          onClick={() => setIsReportModalOpen(true)}
          className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-accent-mint/50 px-6 py-3 rounded-2xl text-sm font-bold text-accent-mint transition-all shadow-lg"
        >
          <Zap size={18} fill="currentColor" />
          GERADOR IA (PRINT)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Client Selector */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass p-6 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">Selecione um Cliente</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input 
                type="text" 
                placeholder="Buscar cliente..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-accent-mint/50 transition-all"
              />
            </div>

            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {filteredClients.map(client => (
                <button 
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all group text-left",
                    selectedClientId === client.id ? "bg-accent-mint/10 border-accent-mint/20 border" : "hover:bg-white/5 border border-transparent"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black shrink-0" style={{ backgroundColor: client.brandColor }}>
                    {client.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate transition-colors",
                      selectedClientId === client.id ? "text-accent-mint" : "group-hover:text-accent-mint"
                    )}>{client.name}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">{client.businessType}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content: Report Builder */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {selectedClient ? (
              <motion.div
                key={selectedClientId}
                ref={reportRef}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="glass rounded-3xl p-8 border border-white/5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-black font-bold text-xl" style={{ backgroundColor: selectedClient.brandColor }}>
                        {selectedClient.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-medium">{selectedClient.name}</h2>
                        <p className="text-sm text-text-muted">Relatório de Performance Analítica</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <select 
                         value={period}
                         onChange={(e) => setPeriod(e.target.value)}
                         className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-accent-mint/50"
                       >
                         <option>Mês Atual</option>
                         <option>Últimos 3 meses</option>
                         <option>Histórico Geral</option>
                       </select>
                       <button 
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 bg-accent-mint text-black px-4 py-2 rounded-xl text-sm font-bold hover:bg-accent-mint/90 transition-all"
                       >
                         <Download size={16} /> PDF
                       </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <ReportKPICard icon={DollarSign} label="Faturamento" value={formatCurrency(stats?.totalRev || 0)} color="text-accent-mint" />
                    <ReportKPICard icon={Target} label="ROAS Médio" value={`${(metrics?.roas || 0).toFixed(2)}x`} color="text-white" />
                    <ReportKPICard icon={UsersIcon} label="Total Leads" value={stats?.totalLeads || 0} color="text-text-secondary" />
                    <ReportKPICard icon={TrendingUp} label="Vendas" value={stats?.totalSales || 0} color="text-accent-mint" />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Análise do Estrategista</label>
                    <textarea 
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      placeholder="Redija aqui os pontos de destaque, os desafios superados e a estratégia para o próximo ciclo..."
                      className="w-full min-h-[300px] bg-white/5 border border-white/10 rounded-2xl p-6 text-sm leading-relaxed resize-none focus:border-accent-mint/50 outline-none transition-all placeholder:opacity-30"
                    />
                  </div>

                  <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                     <div className="flex items-center gap-2 text-text-muted text-xs italic">
                        <Calendar size={14} />
                        Última atualização: {new Date().toLocaleDateString('pt-BR')}
                     </div>
                     <div className="flex gap-4">
                        <button className="px-6 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5">Salvar Rascunho</button>
                        <button 
                           onClick={handleExportPDF}
                           className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        >
                           <Share2 size={16} /> Exportar
                        </button>
                     </div>
                  </div>
                </div>

                {/* Detailed Table for Context */}
                <div className="glass rounded-3xl overflow-hidden border border-white/5">
                   <div className="p-6 border-b border-white/5">
                      <h3 className="font-medium">Dados de Apoio ({period})</h3>
                   </div>
                   <div className="p-6 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                         <thead>
                            <tr className="text-[10px] font-bold text-text-muted uppercase tracking-widest border-b border-white/5">
                               <th className="pb-4">Mês</th>
                               <th className="pb-4 text-right">Inves.</th>
                               <th className="pb-4 text-right">Fatur.</th>
                               <th className="pb-4 text-right">Leads</th>
                               <th className="pb-4 text-right">CAC</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-white/[0.03]">
                            {entries.slice(-6).reverse().map(e => {
                               const m = calculateMetrics(e, selectedClient.businessType);
                               return (
                                 <tr key={e.id}>
                                    <td className="py-4 font-medium">{new Date(e.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</td>
                                    <td className="py-4 text-right text-text-muted">{formatCurrency(e.investment)}</td>
                                    <td className="py-4 text-right font-medium">{formatCurrency(e.revenue || 0)}</td>
                                    <td className="py-4 text-right">{e.leads || 0}</td>
                                    <td className="py-4 text-right text-accent-coral">{formatCurrency(m.cac)}</td>
                                 </tr>
                               );
                            })}
                         </tbody>
                      </table>
                   </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-3xl p-12 text-center h-[500px] flex flex-col items-center justify-center space-y-6"
              >
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-text-muted">
                  <Filter size={32} className="opacity-20" />
                </div>
                <div className="max-w-xs">
                  <h2 className="text-xl font-medium mb-2">Selecione um cliente para começar</h2>
                  <p className="text-sm text-text-muted">Ao selecionar um cliente à esquerda, você poderá configurar o período e redigir a análise mensal.</p>
                </div>
                <Link 
                  to="/clientes" 
                  className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-all flex items-center gap-2"
                >
                   Ir para carteira de clientes <ChevronRight size={16} />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <PerformanceReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
        clients={clients} 
      />
    </div>
  );
}

function ReportKPICard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
       <div className="flex items-center gap-2 mb-2">
          <Icon size={14} className="text-text-muted" />
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{label}</span>
       </div>
       <p className={cn("text-lg font-medium", color)}>{value}</p>
    </div>
  );
}


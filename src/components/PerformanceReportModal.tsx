import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Upload, 
  Copy, 
  Check, 
  Loader2, 
  Image as ImageIcon,
  FileText,
  MessageSquare,
  BadgeDollarSign,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { extractMetricsFromImage, ExtractedReportData } from '../services/geminiService';
import { Client, MetricEntry } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { storage } from '../lib/storage';

interface PerformanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
}

type ReportType = 'MENSAGENS' | 'VENDAS' | 'LEADS' | 'ALCANCE';

export function PerformanceReportModal({ isOpen, onClose, clients }: PerformanceReportModalProps) {
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [reportType, setReportType] = useState<ReportType>('MENSAGENS');
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedReportData | null>(null);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Editable fields for saving
  const [editInvestment, setEditInvestment] = useState(0);
  const [editConversions, setEditConversions] = useState(0);
  const [editDataInicial, setEditDataInicial] = useState('');
  const [editDataFinal, setEditDataFinal] = useState('');

  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateReport = async () => {
    if (!image) {
      toast.error('Por favor, faça upload de um print da campanha');
      return;
    }
    if (!selectedClient) {
      toast.error('Por favor, selecione um cliente');
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Processando print com IA...');

    try {
      const data = await extractMetricsFromImage(image);
      
      if (!data) {
        toast.error('Não foi possível extrair os dados da imagem. Verifique a qualidade do print.');
        return;
      }

      setExtractedData(data);
      setEditInvestment(data.valorInvestido);
      setEditConversions(data.conversoes);
      setEditDataInicial(data.dataInicial || '');
      setEditDataFinal(data.dataFinal || '');

      if (data.dataFinal) {
        // Try to set report date to final date of extraction if valid format
        try {
          const dateStr = data.dataFinal.includes('/') ? data.dataFinal.split('/').reverse().join('-') : data.dataFinal;
          setReportDate(dateStr);
        } catch (e) {
          console.warn('Could not parse extracted date', data.dataFinal);
        }
      }

      const client = clients.find(c => c.id === selectedClient);
      const clientName = client?.name || 'Cliente';
      
      // Calculate CPA/CPL Label
      const metricLabel = {
        'MENSAGENS': 'CPL (Conversa)',
        'VENDAS': 'Custo por Venda',
        'LEADS': 'CPL (Lead)',
        'ALCANCE': 'CPM (Mil Pessoas)'
      }[reportType];

      const checkBoxes = {
        'MENSAGENS': '☒ Campanha de Mensagens\n☐ Campanha de Vendas\n☐ Campanha de Leads\n☐ Campanha de Alcance',
        'VENDAS': '☐ Campanha de Mensagens\n☒ Campanha de Vendas\n☐ Campanha de Leads\n☐ Campanha de Alcance',
        'LEADS': '☐ Campanha de Mensagens\n☐ Campanha de Vendas\n☒ Campanha de Leads\n☐ Campanha de Alcance',
        'ALCANCE': '☐ Campanha de Mensagens\n☐ Campanha de Vendas\n☐ Campanha de Leads\n☒ Campanha de Alcance'
      }[reportType];

      const report = `RELATÓRIO DE PERFORMANCE — TRÁFEGO PAGO

Cliente:
${clientName}

Período:
${data.dataInicial || format(new Date(), 'dd/MM/yyyy')} até ${data.dataFinal || format(new Date(), 'dd/MM/yyyy')}

Tipo de Campanha:
${checkBoxes}

RESULTADOS DA SEMANA
📈 Alcance
${data.alcance.toLocaleString('pt-BR')} pessoas alcançadas

👆 Cliques
${data.cliques.toLocaleString('pt-BR')} cliques

${reportType === 'MENSAGENS' ? '💬 Conversas por Mensagem Iniciadas' : '🎯 Conversões'}
${data.conversoes.toLocaleString('pt-BR')} ${reportType === 'MENSAGENS' ? 'conversas iniciadas' : 'conversões'}

💰 ${metricLabel}
${formatCurrency(data.custoPorConversao)}

💵 Valor Investido
${formatCurrency(data.valorInvestido)}

ANÁLISE DA PERFORMANCE
[Sua análise aqui]`;

      setGeneratedReport(report);
      toast.success('Relatório gerado com sucesso!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao gerar relatório', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveReportData = async () => {
    if (!extractedData || !selectedClient) return;

    setIsSaving(true);
    const toastId = toast.loading('Salvando dados no sistema...');

    try {
      const client = clients.find(c => c.id === selectedClient);
      if (client) {
        // Save Metric Entry
        const newEntry: MetricEntry = {
          id: `${selectedClient}-${new Date(reportDate).getTime()}`,
          clientId: selectedClient,
          date: reportDate,
          endDate: editDataFinal ? (editDataFinal.includes('/') ? format(parseISO(editDataFinal.split('/').reverse().join('-')), 'yyyy-MM-dd') : editDataFinal) : reportDate,
          investment: editInvestment,
          clicks: extractedData.cliques,
          alcance: extractedData.alcance,
          conversions: editConversions,
          // Map based on type
          ...(reportType === 'MENSAGENS' ? { waConversations: editConversions } : {}),
          ...(reportType === 'VENDAS' ? { purchases: editConversions, sales: editConversions } : {}),
          ...(reportType === 'LEADS' ? { leads: editConversions } : {}),
        };

        await storage.saveEntry(newEntry);
        
        // Update client smartGoal with the latest investment if needed
        const updatedClient = {
          ...client,
          smartGoal: {
            ...client.smartGoal,
            adSpend: editInvestment || client.smartGoal.adSpend
          }
        };
        await storage.saveClient(updatedClient);
        
        toast.success('Relatório salvo no histórico do cliente!', { id: toastId });
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('Erro ao salvar no histórico', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedReport);
    setCopied(true);
    toast.success('Copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 flex flex-col"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-mint/10 flex items-center justify-center border border-accent-mint/20">
              <FileText className="text-accent-mint" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-medium">Gerador de Relatório IA</h2>
              <p className="text-xs text-text-secondary">Transforme prints de campanha em relatórios profissionais</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {!generatedReport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Cliente</label>
                  <select 
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-mint/50 transition-all"
                  >
                    <option value="">Selecione o cliente...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Tipo de Relatório</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'MENSAGENS', label: 'Mensagens', icon: MessageSquare },
                      { id: 'VENDAS', label: 'Vendas', icon: BadgeDollarSign },
                      { id: 'LEADS', label: 'Leads', icon: ImageIcon },
                      { id: 'ALCANCE', label: 'Alcance', icon: FileText }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setReportType(type.id as ReportType)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center",
                          reportType === type.id 
                            ? "bg-accent-mint/10 border-accent-mint text-accent-mint" 
                            : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/10"
                        )}
                      >
                        <type.icon size={18} />
                        <span className="text-[10px] font-bold uppercase">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Print da Campanha</label>
                  <div 
                    className={cn(
                      "relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer overflow-hidden aspect-video",
                      image ? "border-accent-mint/50 bg-accent-mint/5" : "border-white/10 hover:border-white/20 hover:bg-white/5"
                    )}
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    {image ? (
                      <img src={image} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                          <Upload size={24} className="text-text-muted" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">Clique para fazer upload</p>
                          <p className="text-[10px] text-text-secondary">PNG, JPG ou JPEG</p>
                        </div>
                      </>
                    )}
                    <input 
                      id="image-upload"
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                <button
                  onClick={generateReport}
                  disabled={isProcessing || !image || !selectedClient}
                  className="w-full h-14 bg-accent-mint text-dark font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_-4px_rgba(0,217,163,0.4)]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      GERANDO...
                    </>
                  ) : (
                    <>
                      <Zap size={20} />
                      GERAR RELATÓRIO COM IA
                    </>
                  )}
                </button>
              </div>

              <div className="bg-dark/50 rounded-2xl border border-white/5 p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-accent-mint/10 flex items-center justify-center border border-accent-mint/20">
                  <FileText className="text-accent-mint" size={40} />
                </div>
                <div className="max-w-[240px]">
                  <h4 className="text-lg font-medium">Siga os passos</h4>
                  <p className="text-sm text-text-secondary">Selecione o cliente, o tipo de campanha e envie um print legível dos resultados da semana.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-accent-mint">Relatório Gerado</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setGeneratedReport('');
                      setImage(null);
                      setExtractedData(null);
                    }}
                    className="px-4 py-2 hover:bg-white/5 rounded-xl text-xs font-bold uppercase transition-all"
                  >
                    Novo Relatório
                  </button>
                  <button 
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase transition-all hover:bg-white/10"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copiado!' : 'Copiar Texto'}
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <textarea 
                  value={generatedReport}
                  onChange={(e) => setGeneratedReport(e.target.value)}
                  className="glass p-8 rounded-3xl border border-white/10 bg-white/[0.02] font-mono text-xs leading-relaxed whitespace-pre-wrap outline-none focus:border-accent-mint/30 transition-all min-h-[400px] max-h-[400px] overflow-y-auto resize-none"
                />

                <div className="space-y-6">
                  <div className="p-6 bg-accent-mint/5 border border-accent-mint/20 rounded-3xl space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-accent-mint">Salvar no Histórico</h4>
                    <p className="text-xs text-text-secondary">Os dados extraídos serão salvos como um novo lançamento para este cliente.</p>
                    
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 ml-1">Data do Lançamento</label>
                        <input 
                          type="date"
                          value={reportDate}
                          onChange={(e) => setReportDate(e.target.value)}
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-accent-mint/50"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/20 p-3 rounded-xl border border-white/5 focus-within:border-accent-mint/30 transition-all">
                          <p className="text-[8px] font-bold text-text-muted uppercase tracking-widest mb-1">Investimento (R$)</p>
                          <input 
                            type="number"
                            value={editInvestment}
                            onChange={(e) => setEditInvestment(Number(e.target.value))}
                            className="w-full bg-transparent text-sm font-medium text-white outline-none"
                          />
                        </div>
                        <div className="bg-black/20 p-3 rounded-xl border border-white/5 focus-within:border-accent-mint/30 transition-all">
                          <p className="text-[8px] font-bold text-text-muted uppercase tracking-widest mb-1">
                            {reportType === 'MENSAGENS' ? 'Conversas' : 'Conversões'}
                          </p>
                          <input 
                            type="number"
                            value={editConversions}
                            onChange={(e) => setEditConversions(Number(e.target.value))}
                            className="w-full bg-transparent text-sm font-medium text-white outline-none"
                          />
                        </div>
                        
                        <div className="bg-black/20 p-3 rounded-xl border border-white/5 col-span-2 space-y-2">
                          <p className="text-[8px] font-bold text-text-muted uppercase tracking-widest">Período Extraído</p>
                          <div className="flex items-center gap-2">
                            <input 
                              type="text"
                              value={editDataInicial}
                              onChange={(e) => setEditDataInicial(e.target.value)}
                              placeholder="Início"
                              className="flex-1 bg-black/20 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:border-accent-mint/30"
                            />
                            <span className="text-text-muted text-[10px]">até</span>
                            <input 
                              type="text"
                              value={editDataFinal}
                              onChange={(e) => setEditDataFinal(e.target.value)}
                              placeholder="Fim"
                              className="flex-1 bg-black/20 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:border-accent-mint/30"
                            />
                          </div>
                        </div>

                        {editInvestment > 0 && editConversions > 0 && (
                          <div className="col-span-2 px-2 py-1 border-t border-white/5 flex justify-between items-center">
                            <span className="text-[9px] text-text-muted uppercase font-bold">{reportType === 'VENDAS' ? 'Custo por Venda' : 'CPL Estimado'}</span>
                            <span className="text-[10px] text-accent-mint font-bold">{formatCurrency(editInvestment / editConversions)}</span>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={handleSaveReportData}
                        disabled={isSaving}
                        className="w-full py-3 bg-accent-mint text-black rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                        Confirmar e Salvar Lançamento
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-accent-amber/10 border border-accent-amber/20 rounded-2xl flex gap-3 items-start">
                    <Loader2 size={18} className="text-accent-amber shrink-0 mt-0.5" />
                    <p className="text-xs text-accent-amber leading-normal">
                      <strong>Nota da IA:</strong> Os dados foram extraídos do print. Revise as informações antes de salvar no sistema.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

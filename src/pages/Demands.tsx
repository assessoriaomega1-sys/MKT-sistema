import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  List, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  User, 
  Briefcase,
  ExternalLink,
  ChevronDown,
  LayoutDashboard,
  MoreVertical,
  Edit2,
  Trash2,
  ArrowRight,
  DollarSign,
  Zap,
  BarChart2,
  FileText,
  GripVertical,
  Video,
  Star
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { storage } from '../lib/storage';
import { Client, MetricEntry, Creative } from '../types';
import { calculateMetrics } from '../lib/calculations';
import { toast } from 'sonner';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  addDays, 
  subDays,
  isToday,
  isPast,
  isFuture,
  startOfDay,
  endOfDay,
  addWeeks,
  subWeeks,
  differenceInDays,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

import { PerformanceReportModal } from '../components/PerformanceReportModal';

type ViewMode = 'day' | 'week' | 'month';
type DemandStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'AGUARDANDO_APROVACAO' | 'CONCLUIDO' | 'ATRASADO';
type DemandPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

interface DemandItem {
  id: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  title: string;
  date: string;
  time?: string;
  type: 'CONTENT' | 'CAPTURE' | 'MEETING' | 'TASK' | 'DELIVERY';
  status: DemandStatus;
  priority: DemandPriority;
  responsible?: string;
  notes?: string;
  originalItem?: any;
}

export function Demands() {
  const [clients, setClients] = useState<Client[]>([]);
  const [allEntries, setAllEntries] = useState<MetricEntry[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [kanbanTasks, setKanbanTasks] = useState<any[]>([]);
  const [draggedCreativeId, setDraggedCreativeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DemandStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<DemandPriority | 'ALL'>('ALL');
  const [responsibleFilter, setResponsibleFilter] = useState<string | 'ALL'>('ALL');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubClients = storage.listenToClients((allClients) => {
      setClients(allClients);
    });

    const unsubEntries = storage.listenToAllEntries((entries) => {
      setAllEntries(entries);
    });

    const unsubCreatives = storage.listenToCreatives((allCreatives) => {
      setCreatives(allCreatives);
      setLoading(false);
    });

    const unsubKanban = storage.listenToAllTasks((allTasks) => {
      setKanbanTasks(allTasks);
    });

    return () => {
      unsubClients();
      unsubEntries();
      unsubCreatives();
      unsubKanban();
    };
  }, []);

  const matchesRecurrence = useCallback((date: Date, event: any, isRecurringClient: boolean) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (event.deletedDates?.includes(dateStr)) return false;

    const recurrenceType = event.recurrenceType || (event.isRecurring ? 'MONTHLY_DAY' : (event.recurringDays && event.recurringDays.length > 0) ? 'WEEKLY' : 'NONE');
    const effectiveRecurrence = (event.type === 'CONTENT' && isRecurringClient && recurrenceType === 'NONE' && event.isRecurring === undefined) ? 'MONTHLY_DAY' : recurrenceType;

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

  const sortedCreatives = useMemo(() => {
    return [...creatives].sort((a, b) => {
      if (a.priorityOrder !== undefined && b.priorityOrder !== undefined) {
        return a.priorityOrder - b.priorityOrder;
      }
      if (a.priorityOrder !== undefined) return -1;
      if (b.priorityOrder !== undefined) return 1;
      
      const dateA = a.creationDate || '';
      const dateB = b.creationDate || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return b.code.localeCompare(a.code);
    });
  }, [creatives]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCreativeId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedCreativeId) return;

    const draggedIndex = sortedCreatives.findIndex(c => c.id === draggedCreativeId);
    if (draggedIndex === -1 || draggedIndex === targetIndex) return;

    const updatedList = [...sortedCreatives];
    const [draggedItem] = updatedList.splice(draggedIndex, 1);
    updatedList.splice(targetIndex, 0, draggedItem);

    const toastId = toast.loading('Salvando nova ordem de prioridade...');
    try {
      for (let i = 0; i < updatedList.length; i++) {
        const item = updatedList[i];
        await storage.saveCreative({
          ...item,
          priorityOrder: i
        });
      }
      toast.success('Fila de criativos reordenada com sucesso!', { id: toastId });
    } catch (err) {
      toast.error('Erro ao reordenar criativos.', { id: toastId });
    } finally {
      setDraggedCreativeId(null);
    }
  };

  const handleToggleUrgent = async (creative: Creative) => {
    try {
      await storage.saveCreative({
        ...creative,
        isUrgent: !creative.isUrgent
      });
      toast.success(`Urgência de ${creative.code} atualizada!`);
    } catch (err) {
      toast.error('Erro ao atualizar urgência.');
    }
  };

  const handleUpdateCreativeStatus = async (creative: Creative, newStatus: any) => {
    try {
      await storage.saveCreative({
        ...creative,
        status: newStatus
      });
      toast.success(`Status de ${creative.code} alterado para ${newStatus}!`);
    } catch (err) {
      toast.error('Erro ao atualizar status.');
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

  const allDemands = useMemo(() => {
    const demands: DemandItem[] = [];
    const todayActual = startOfDay(new Date());
    const realCurrentMonth = todayActual.getMonth();
    const realCurrentYear = todayActual.getFullYear();

    // Determine the range to generate
    // We want to generate for the calendar visible month PLUS the real current month to ensure "NOW" stats are correct
    const calendarMonthStart = startOfMonth(currentDate);
    const calendarMonthEnd = endOfMonth(currentDate);
    
    const realMonthStart = startOfMonth(todayActual);
    const realMonthEnd = endOfMonth(todayActual);

    // Range starts at whichever is earlier, ends at whichever is later
    const rangeStart = calendarMonthStart < realMonthStart ? calendarMonthStart : realMonthStart;
    const rangeEnd = calendarMonthEnd > realMonthEnd ? calendarMonthEnd : realMonthEnd;
    
    const interval = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    clients.forEach(client => {
      const isRecurringClient = client.billingModel === 'RECURRING';
      
      // Content items
      client.contentPlan?.items?.forEach(item => {
        const isRecurring = item.recurrenceType 
          ? item.recurrenceType !== 'NONE'
          : (item.isRecurring || (item.recurringDays && item.recurringDays.length > 0) || (isRecurringClient && !item.recurringDays));

        if (isRecurring) {
          interval.forEach(day => {
            if (matchesRecurrence(day, { ...item, type: 'CONTENT' }, isRecurringClient)) {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isCompleted = item.completedDates?.includes(dateStr);
              
              // ONLY red/delayed for the current real-world month
              const isRealMonth = day.getMonth() === realCurrentMonth && day.getFullYear() === realCurrentYear;
              const isAtrasada = isRealMonth && !isCompleted && isPast(day) && !isToday(day);

              demands.push({
                id: `${item.id}-${dateStr}`,
                clientId: client.id,
                clientName: client.name,
                clientColor: client.brandColor,
                title: item.title || 'Postagem',
                date: dateStr,
                type: 'CONTENT',
                status: isCompleted ? 'CONCLUIDO' : (isAtrasada ? 'ATRASADO' : 'PENDENTE'),
                priority: 'MEDIA',
                originalItem: item
              });
            }
          });
        } else {
          const itemDateStr = item.targetDate || '';
          if (!itemDateStr) return;
          const itemDate = startOfDay(new Date(itemDateStr + "T12:00:00"));
          
          if (itemDate >= rangeStart && itemDate <= rangeEnd) {
             const isRealMonth = itemDate.getMonth() === realCurrentMonth && itemDate.getFullYear() === realCurrentYear;
             const isAtrasada = isRealMonth && item.status === 'PLANNED' && isPast(itemDate) && !isToday(itemDate);

             demands.push({
               id: item.id,
               clientId: client.id,
               clientName: client.name,
               clientColor: client.brandColor,
               title: item.title || 'Postagem',
               date: itemDateStr,
               type: 'CONTENT',
               status: item.status === 'POSTED' ? 'CONCLUIDO' : (isAtrasada ? 'ATRASADO' : 'PENDENTE'),
               priority: 'MEDIA',
               originalItem: item
             });
          }
        }
      });

      // Captures
      client.captures?.forEach(item => {
        const itemDateStr = item.date || '';
        if (!itemDateStr) return;
        const itemDate = startOfDay(new Date(itemDateStr + "T12:00:00"));
        if (itemDate < rangeStart || itemDate > rangeEnd) return;

        const isRealMonth = itemDate.getMonth() === realCurrentMonth && itemDate.getFullYear() === realCurrentYear;
        const isAtrasada = isRealMonth && item.status === 'PLANNED' && isPast(itemDate) && !isToday(itemDate);

        demands.push({
          id: item.id,
          clientId: client.id,
          clientName: client.name,
          clientColor: client.brandColor,
          title: item.title || 'Captação',
          date: itemDateStr,
          type: 'CAPTURE',
          status: item.status === 'DONE' ? 'CONCLUIDO' : (isAtrasada ? 'ATRASADO' : 'PENDENTE'),
          priority: 'ALTA',
          originalItem: item
        });
      });

      // Meetings
      client.meetings?.forEach(item => {
        const itemDateStr = item.date || '';
        if (!itemDateStr) return;
        const itemDate = startOfDay(new Date(itemDateStr + "T12:00:00"));
        if (itemDate < rangeStart || itemDate > rangeEnd) return;

        const isRealMonth = itemDate.getMonth() === realCurrentMonth && itemDate.getFullYear() === realCurrentYear;
        const isAtrasada = isRealMonth && item.status === 'PLANNED' && isPast(itemDate) && !isToday(itemDate);

        demands.push({
          id: item.id,
          clientId: client.id,
          clientName: client.name,
          clientColor: client.brandColor,
          title: item.title || 'Reunião',
          date: itemDateStr,
          type: 'MEETING',
          status: item.status === 'DONE' ? 'CONCLUIDO' : (isAtrasada ? 'ATRASADO' : 'PENDENTE'),
          priority: 'BAIXA',
          originalItem: item
        });
      });
    });

    // Injetar tarefas do fluxo operacional Kanban na agenda
    kanbanTasks.forEach(task => {
      if (!task.dueDate) return;
      
      const taskDate = startOfDay(new Date(task.dueDate + "T12:00:00"));
      if (taskDate < rangeStart || taskDate > rangeEnd) return;

      const isRealMonth = taskDate.getMonth() === realCurrentMonth && taskDate.getFullYear() === realCurrentYear;
      
      let statusValue: DemandStatus = 'PENDENTE';
      if (task.status === 'DONE') {
        statusValue = 'CONCLUIDO';
      } else {
        const isAtrasada = isRealMonth && isPast(taskDate) && !isToday(taskDate);
        statusValue = isAtrasada ? 'ATRASADO' : (task.status === 'PROGRESS' ? 'EM_ANDAMENTO' : 'PENDENTE');
      }

      // Buscar cor do cliente
      const taskClient = clients.find(c => c.id === task.clientId);

      demands.push({
        id: task.id,
        clientId: task.clientId || 'general',
        clientName: task.clientName || 'Geral / Agência',
        clientColor: taskClient?.brandColor || '#8B5CF6',
        title: `[Kanban] ${task.title}`,
        date: task.dueDate,
        type: 'TASK',
        status: statusValue,
        priority: task.priority === 'URGENT' ? 'URGENTE' : (task.priority === 'HIGH' ? 'ALTA' : (task.priority === 'LOW' ? 'BAIXA' : 'MEDIA')),
        responsible: task.responsible,
        notes: task.description,
        originalItem: task
      });
    });

    return demands;
  }, [clients, currentDate, matchesRecurrence, kanbanTasks]);

  const filteredDemands = useMemo(() => {
    return allDemands.filter(d => {
      const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           d.clientName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
      const matchesPriority = priorityFilter === 'ALL' || d.priority === priorityFilter;
      const matchesResponsible = responsibleFilter === 'ALL' || d.responsible === responsibleFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesResponsible;
    }).sort((a, b) => {
      // Manual list ordering: Atrasado > Hoje > Próximos
      const statusOrder = { 'ATRASADO': 0, 'PENDENTE': 1, 'EM_ANDAMENTO': 2, 'AGUARDANDO_APROVACAO': 3, 'CONCLUIDO': 4 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.date.localeCompare(b.date);
    });
  }, [allDemands, searchQuery, statusFilter, priorityFilter, responsibleFilter]);

  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayDemands = allDemands.filter(d => d.date === today);
    const delayed = allDemands.filter(d => d.status === 'ATRASADO');
    const completed = allDemands.filter(d => d.status === 'CONCLUIDO');
    
    // Check for overload (> 8 tasks per day is arbitrary threshold)
    const dailyCounts: Record<string, number> = {};
    allDemands.forEach(d => {
      dailyCounts[d.date] = (dailyCounts[d.date] || 0) + 1;
    });
    const overloadedDays = Object.values(dailyCounts).filter(c => c > 8).length;

    // Count per client
    const clientCounts: Record<string, number> = {};
    allDemands.forEach(d => {
      clientCounts[d.clientName] = (clientCounts[d.clientName] || 0) + 1;
    });
    const topClient = Object.entries(clientCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Nenhum';

    // Financial calculations (Current Month)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthEntries = allEntries.filter(entry => {
      const d = parseISO(entry.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    let totalInvestment = 0;
    let totalRevenue = 0;
    let totalLeads = 0;

    monthEntries.forEach(entry => {
      totalInvestment += entry.investment || 0;
      totalRevenue += entry.revenue || 0;
      totalLeads += entry.leads || 0;
    });

    const averageCPL = totalLeads > 0 ? totalInvestment / totalLeads : 0;
    const averageROAS = totalInvestment > 0 ? totalRevenue / totalInvestment : 0;

    return {
      today: todayDemands.length,
      delayed: delayed.length,
      completed: completed.length,
      week: allDemands.filter(d => {
        const date = new Date(d.date + "T12:00:00");
        return date >= startOfWeek(new Date()) && date <= endOfWeek(new Date());
      }).length,
      topClient,
      overloadedDays,
      totalInvestment,
      totalRevenue,
      totalLeads,
      averageCPL,
      averageROAS
    };
  }, [allDemands, clients, allEntries]);

  const chartData = useMemo(() => {
    const dailyData: Record<string, { investment: number, leads: number, rawDate: string }> = {};
    
    allEntries.forEach(entry => {
      const dateKey = entry.date.split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { 
          investment: 0, 
          leads: 0, 
          rawDate: dateKey 
        };
      }
      dailyData[dateKey].investment += entry.investment || 0;
      dailyData[dateKey].leads += entry.leads || 0;
    });

    return Object.values(dailyData)
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .map(d => ({
        name: format(parseISO(d.rawDate), 'dd/MM'),
        investment: d.investment,
        leads: d.leads
      }))
      .slice(-15);
  }, [allEntries]);

  const handleUpdateStatus = async (demand: DemandItem, newStatus: DemandStatus) => {
    const toastId = toast.loading('Atualizando status...');
    try {
      if (demand.type === 'TASK') {
        const originalTask = demand.originalItem;
        if (originalTask) {
          const updatedTask = {
            ...originalTask,
            status: newStatus === 'CONCLUIDO' ? 'DONE' : 'PROGRESS',
            completedAt: newStatus === 'CONCLUIDO' ? new Date().toISOString() : null,
            history: [
              ...(originalTask.history || []),
              {
                id: 'h-sync-' + Date.now(),
                action: 'Status Sincronizado',
                details: `Status alterado de forma bidirecional via agenda de demandas para "${newStatus}".`,
                userName: 'Calendário Geral',
                createdAt: new Date().toISOString()
              }
            ]
          };
          await storage.saveTask(updatedTask);
          toast.success('Status da tarefa Kanban sincronizado com sucesso!', { id: toastId });
          return;
        }
      }

      const client = clients.find(c => c.id === demand.clientId);
      if (!client) throw new Error('Cliente não encontrado');

      const updatedClient = { ...client };
      const dateStr = demand.date;

      if (demand.type === 'CONTENT') {
        const itemIndex = updatedClient.contentPlan?.items.findIndex(i => i.id === (demand.id.split('-')[0]));
        if (itemIndex !== undefined && itemIndex !== -1) {
          const item = updatedClient.contentPlan!.items[itemIndex];
          const isRecurring = item.recurrenceType 
            ? item.recurrenceType !== 'NONE'
            : (item.isRecurring || (item.recurringDays && item.recurringDays.length > 0) || (client.billingModel === 'RECURRING' && !item.recurringDays));
          
          if (isRecurring) {
            if (newStatus === 'CONCLUIDO') {
              item.completedDates = [...(item.completedDates || []), dateStr];
            } else {
              item.completedDates = (item.completedDates || []).filter(d => d !== dateStr);
            }
          } else {
            item.status = newStatus === 'CONCLUIDO' ? 'POSTED' : 'PLANNED';
          }
        }
      } else if (demand.type === 'CAPTURE') {
        const itemIndex = updatedClient.captures?.findIndex(i => i.id === demand.id);
        if (itemIndex !== undefined && itemIndex !== -1) {
          updatedClient.captures![itemIndex].status = newStatus === 'CONCLUIDO' ? 'DONE' : 'PLANNED';
        }
      } else if (demand.type === 'MEETING') {
        const itemIndex = updatedClient.meetings?.findIndex(i => i.id === demand.id);
        if (itemIndex !== undefined && itemIndex !== -1) {
          updatedClient.meetings![itemIndex].status = newStatus === 'CONCLUIDO' ? 'DONE' : 'PLANNED';
        }
      }

      await storage.saveClient(updatedClient);
      setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
      toast.success('Status atualizado!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao atualizar status', { id: toastId });
    }
  };

  const handleDeleteDemand = async (demand: DemandItem) => {
    if (!window.confirm(`Tem certeza de que deseja excluir a demanda "${demand.title}"?`)) {
      return;
    }
    const toastId = toast.loading('Excluindo demanda...');
    try {
      if (demand.type === 'TASK') {
        const originalTask = demand.originalItem;
        if (originalTask) {
          await storage.deleteTask(originalTask.id);
          setKanbanTasks(prev => prev.filter(t => t.id !== originalTask.id));
          toast.success('Tarefa Kanban excluída com sucesso!', { id: toastId });
          return;
        }
      }

      const client = clients.find(c => c.id === demand.clientId);
      if (!client) throw new Error('Cliente não encontrado');

      const updatedClient = { ...client };
      const dateStr = demand.date;

      if (demand.type === 'CONTENT') {
        if (updatedClient.contentPlan?.items) {
          const itemIndex = updatedClient.contentPlan.items.findIndex(i => i.id === (demand.id.split('-')[0]));
          if (itemIndex !== -1) {
            const item = updatedClient.contentPlan.items[itemIndex];
            const isRecurring = item.recurrenceType 
              ? item.recurrenceType !== 'NONE'
              : (item.isRecurring || (item.recurringDays && item.recurringDays.length > 0) || (client.billingModel === 'RECURRING' && !item.recurringDays));
            
            if (isRecurring) {
              const deleteAll = window.confirm("Esta é uma demanda recorrente.\n\nDeseja excluir TODA A SÉRIE? (Clique em OK para excluir toda a série, ou em Cancelar para excluir apenas esta ocorrência específica)");
              if (deleteAll) {
                updatedClient.contentPlan.items = updatedClient.contentPlan.items.filter(i => i.id !== item.id);
                updatedClient.contentPlan.total = updatedClient.contentPlan.items.length;
              } else {
                item.deletedDates = [...(item.deletedDates || []), dateStr];
              }
            } else {
              updatedClient.contentPlan.items = updatedClient.contentPlan.items.filter(i => i.id !== item.id);
              updatedClient.contentPlan.total = updatedClient.contentPlan.items.length;
            }
          }
        }
      } else if (demand.type === 'CAPTURE') {
        if (updatedClient.captures) {
          const itemIndex = updatedClient.captures.findIndex(i => i.id === demand.id);
          if (itemIndex !== -1) {
            const item = updatedClient.captures[itemIndex];
            const isRecurring = item.recurrenceType && item.recurrenceType !== 'NONE';
            if (isRecurring) {
              const deleteAll = window.confirm("Esta é uma gravação/captação recorrente.\n\nDeseja excluir TODA A SÉRIE? (Clique em OK para excluir toda a série, ou em Cancelar para excluir apenas esta ocorrência específica)");
              if (deleteAll) {
                updatedClient.captures = updatedClient.captures.filter(i => i.id !== item.id);
              } else {
                item.deletedDates = [...(item.deletedDates || []), dateStr];
              }
            } else {
              updatedClient.captures = updatedClient.captures.filter(i => i.id !== demand.id);
            }
          }
        }
      } else if (demand.type === 'MEETING') {
        if (updatedClient.meetings) {
          const itemIndex = updatedClient.meetings.findIndex(i => i.id === demand.id);
          if (itemIndex !== -1) {
            const item = updatedClient.meetings[itemIndex];
            const isRecurring = item.recurrenceType && item.recurrenceType !== 'NONE';
            if (isRecurring) {
              const deleteAll = window.confirm("Esta é uma reunião recorrente.\n\nDeseja excluir TODA A SÉRIE? (Clique em OK para excluir toda a série, ou em Cancelar para excluir apenas esta ocorrência específica)");
              if (deleteAll) {
                updatedClient.meetings = updatedClient.meetings.filter(i => i.id !== item.id);
              } else {
                item.deletedDates = [...(item.deletedDates || []), dateStr];
              }
            } else {
              updatedClient.meetings = updatedClient.meetings.filter(i => i.id !== demand.id);
            }
          }
        }
      }

      await storage.saveClient(updatedClient);
      setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
      toast.success('Demanda excluída!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao excluir demanda', { id: toastId });
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-medium tracking-tight">Demandas</h1>
          <p className="text-text-secondary">Central operacional de todos os clientes</p>
        </div>
        <div className="flex items-center gap-4">
          {stats.overloadedDays > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-accent-coral/10 border border-accent-coral/20 rounded-xl text-accent-coral animate-pulse">
              <AlertCircle size={14} />
              <span className="text-[10px] font-bold uppercase">Sobrecarga Detectada: {stats.overloadedDays} dias</span>
            </div>
          )}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => setViewMode('month')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", viewMode === 'month' ? "bg-accent-mint text-black" : "text-text-muted hover:text-white")}
            >
              Mês
            </button>
            <button 
              onClick={() => setViewMode('week')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", viewMode === 'week' ? "bg-accent-mint text-black" : "text-text-muted hover:text-white")}
            >
              Semana
            </button>
            <button 
              onClick={() => setViewMode('day')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", viewMode === 'day' ? "bg-accent-mint text-black" : "text-text-muted hover:text-white")}
            >
              Dia
            </button>
            <button 
              onClick={() => setIsReportModalOpen(true)}
              className="px-4 py-2 rounded-lg text-xs font-bold text-accent-mint hover:bg-accent-mint/10 transition-all flex items-center gap-2"
            >
              <FileText size={14} />
              Relatório IA
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Calendar */}
      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-medium capitalize">
              {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : (viewMode === 'week' ? "'Semana de' d 'de' MMMM" : "d 'de' MMMM yyyy"), { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
              <button 
                onClick={() => {
                  if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
                  if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
                  if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1));
                }}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="px-2 text-[10px] font-bold uppercase tracking-widest hover:text-accent-mint transition-colors"
              >
                Hoje
              </button>
              <button 
                onClick={() => {
                  if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
                  if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
                  if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
                }}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text"
                placeholder="Buscar demandas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-accent-mint transition-all w-64"
              />
            </div>
            <button className="p-2 glass glass-hover rounded-xl text-text-secondary">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <div className="p-0">
          {viewMode === 'month' && (
            <MonthCalendar 
              currentDate={currentDate} 
              demands={allDemands} 
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDeleteDemand}
            />
          )}
          {viewMode === 'week' && (
            <WeekCalendar 
              currentDate={currentDate} 
              demands={allDemands} 
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDeleteDemand}
            />
          )}
          {viewMode === 'day' && (
            <DayCalendar 
              currentDate={currentDate} 
              demands={allDemands} 
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDeleteDemand}
            />
          )}
        </div>
      </div>

      {/* Demand List & Creative Queue Split Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
        
        {/* Left 2 Columns: Demand List Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-medium">Lista Inteligente de Demandas</h3>
            <div className="flex gap-2">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs"
              >
                <option value="ALL">Todos Status</option>
                <option value="PENDENTE">Pendente</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="AGUARDANDO_APROVACAO">Aprovação</option>
                <option value="CONCLUIDO">Concluído</option>
                <option value="ATRASADO">Atrasado</option>
              </select>
            </div>
          </div>

          <div className="glass rounded-3xl overflow-hidden border border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    <th className="px-6 py-4">Tarefa</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4 text-center">Data</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Prioridade</th>
                    <th className="px-6 py-4 text-center">Responsável</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredDemands.map((demand) => (
                    <tr key={demand.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            demand.status === 'ATRASADO' ? "bg-accent-coral animate-pulse" :
                            demand.status === 'CONCLUIDO' ? "bg-accent-mint" : "bg-accent-amber"
                          )} />
                          <span className="font-medium text-sm">{demand.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-black" style={{ backgroundColor: demand.clientColor }}>
                            {demand.clientName.charAt(0)}
                          </div>
                          <span className="text-xs text-text-secondary">{demand.clientName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className="text-xs font-mono">{format(new Date(demand.date + "T12:00:00"), 'dd/MM/yyyy')}</p>
                        {demand.status === 'ATRASADO' && (
                          <p className="text-[10px] text-accent-coral font-bold mt-1">
                            {differenceInDays(new Date(), new Date(demand.date + "T12:00:00"))} dias atrasado
                          </p>
                        )}
                        {demand.status === 'PENDENTE' && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                             <TrendingUp size={10} className="text-accent-amber" />
                             <span className="text-[9px] text-text-muted font-bold uppercase">Risco de Atraso Médio</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold uppercase",
                          demand.status === 'CONCLUIDO' ? "bg-accent-mint/10 text-accent-mint" :
                          demand.status === 'ATRASADO' ? "bg-accent-coral/10 text-accent-coral" :
                          "bg-accent-amber/10 text-accent-amber"
                        )}>
                          {demand.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "text-[10px] font-bold uppercase",
                          demand.priority === 'URGENTE' ? "text-accent-coral" :
                          demand.priority === 'ALTA' ? "text-accent-amber" :
                          "text-text-muted"
                        )}>
                          {demand.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-text-secondary italic">
                        Equipe Ômega
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                           {demand.status !== 'CONCLUIDO' && (
                             <button 
                              onClick={() => handleUpdateStatus(demand, 'CONCLUIDO')}
                              className="p-2 hover:bg-accent-mint/10 text-text-muted hover:text-accent-mint rounded-lg transition-all"
                              title="Concluir Demanda"
                             >
                                <CheckCircle size={14} />
                             </button>
                           )}
                           <button 
                            onClick={() => handleDeleteDemand(demand)}
                            className="p-2 hover:bg-accent-coral/10 text-text-muted hover:text-accent-coral rounded-lg transition-all"
                            title="Excluir Demanda"
                           >
                             <Trash2 size={14} />
                           </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDemands.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-text-muted italic">
                        Nenhuma demanda encontrada com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Fila Estratégica de Criativos (Drag-and-Drop) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-mint animate-pulse" />
                Fila de Criativos
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Arraste os cards para priorizar a fila
              </p>
            </div>
          </div>

          <div className="glass rounded-3xl p-5 border border-white/5 space-y-4 max-h-[640px] overflow-y-auto custom-scrollbar bg-black/20">
            {sortedCreatives.length === 0 ? (
              <div className="py-12 text-center text-text-muted space-y-2">
                <AlertCircle className="mx-auto opacity-35" size={28} />
                <p className="text-xs">Nenhum criativo cadastrado para priorização.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedCreatives.map((creative, index) => {
                  const clientOfCreative = clients.find(c => c.id === creative.clientId);
                  const isItemDragged = draggedCreativeId === creative.id;
                  
                  return (
                    <div
                      key={creative.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, creative.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`p-4 rounded-2xl border transition-all flex items-start gap-3 select-none ${
                        isItemDragged 
                          ? 'bg-white/10 border-accent-mint/40 opacity-40 scale-[0.98]' 
                          : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.08] cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      {/* Drag Handle */}
                      <div className="text-text-muted mt-1 shrink-0">
                        <GripVertical size={14} className="opacity-40" />
                      </div>

                      {/* Card Content */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 justify-between mb-1.5">
                          <span className="text-[10px] font-mono text-text-muted font-bold">
                            {creative.code}
                          </span>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* Urgent toggle */}
                            <button
                              onClick={() => handleToggleUrgent(creative)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                                creative.isUrgent
                                  ? 'bg-accent-coral/20 text-accent-coral border border-accent-coral/30 shadow-[0_0_8px_rgba(255,90,95,0.15)]'
                                  : 'bg-white/5 text-text-muted hover:text-white border border-transparent'
                              }`}
                              title={creative.isUrgent ? "Urgência Ativada" : "Definir como Urgente"}
                            >
                              URGENTE
                            </button>

                            {/* Status selector */}
                            <select
                              value={creative.status}
                              onChange={(e) => handleUpdateCreativeStatus(creative, e.target.value as any)}
                              className="bg-black/40 border border-white/10 text-[9px] text-text-secondary rounded px-1.5 py-0.5 font-bold outline-none cursor-pointer hover:border-white/25"
                            >
                              <option value="IDEIA">Ideia</option>
                              <option value="PRODUZIDO">Prod</option>
                              <option value="EDITADO">Edição</option>
                              <option value="TESTE_CAMPANHA">Teste</option>
                              <option value="VALIDADO">Valid</option>
                              <option value="DESCARTADO">Desc</option>
                            </select>
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-semibold text-white truncate">
                          {creative.title}
                        </h4>

                        {/* Footer (Client Name & Details) */}
                        <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-white/[0.04]">
                          {clientOfCreative ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span 
                                className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" 
                                style={{ backgroundColor: clientOfCreative.brandColor || '#04DD72' }} 
                              />
                              <span className="text-[10px] text-text-secondary truncate font-medium">
                                {clientOfCreative.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-text-muted font-mono">Sem Cliente</span>
                          )}

                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded font-mono">
                              {creative.type}
                            </span>
                            <button
                              onClick={() => handleDeleteCreative(creative)}
                              className="p-1 hover:bg-accent-coral/20 text-text-muted hover:text-accent-coral rounded-lg transition-all cursor-pointer"
                              title="Excluir Criativo"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modals */}
      <PerformanceReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
        clients={clients} 
      />
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color?: string }) {
  return (
    <div className="glass p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/[0.02] -mr-8 -mt-8 rounded-full blur-2xl group-hover:bg-white/[0.05] transition-all" />
      <div className={cn("w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center", color)}>
        <Icon size={16} />
      </div>
      <div className="mt-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
        <p className={cn("text-xl font-medium mt-0.5 truncate", color)}>{value}</p>
      </div>
    </div>
  );
}

function MonthCalendar({ currentDate, demands, onUpdateStatus, onDelete }: { currentDate: Date, demands: DemandItem[], onUpdateStatus: any, onDelete: any }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { locale: ptBR });
  const endDate = endOfWeek(monthEnd, { locale: ptBR });
  
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  return (
    <div className="grid grid-cols-7 border-b border-white/5">
      {weekDays.map(day => (
        <div key={day} className="px-4 py-2 border-r border-white/5 bg-white/[0.02] text-[10px] font-bold uppercase tracking-widest text-text-muted text-center last:border-r-0">
          {day}
        </div>
      ))}
      {days.map((day, i) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayDemands = demands.filter(d => d.date === dateStr);
        const isCurrentMonth = isSameMonth(day, monthStart);
        
        return (
          <div 
            key={dateStr} 
            className={cn(
              "min-h-[140px] border-r border-b border-white/5 p-2 transition-colors",
              !isCurrentMonth ? "opacity-20 bg-black/20" : "hover:bg-white/[0.01]",
              isToday(day) && "bg-accent-mint/[0.02]",
              (i + 1) % 7 === 0 && "border-r-0"
            )}
          >
            <div className="flex justify-between items-center mb-2 px-1">
              <span className={cn(
                "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                isToday(day) ? "bg-accent-mint text-black" : "text-text-muted"
              )}>
                {format(day, 'd')}
              </span>
              {dayDemands.length > 0 && isCurrentMonth && (
                <span className="text-[10px] text-text-muted font-bold">
                  {dayDemands.length}
                </span>
              )}
            </div>
            
            <div className="space-y-1 overflow-y-auto max-h-[100px] custom-scrollbar">
              {dayDemands.slice(0, 4).map(demand => (
                <div 
                  key={demand.id}
                  className={cn(
                    "w-full text-left pl-1.5 pr-6 py-1 rounded text-[9px] font-medium flex items-center gap-1.5 group/item transition-all relative",
                    demand.status === 'CONCLUIDO' ? "bg-accent-mint/10 text-accent-mint/80 line-through" : "bg-white/5 text-white hover:bg-white/10",
                    demand.status === 'ATRASADO' && !demand.status.includes('CONCLUIDO') && "border-l-2 border-accent-coral"
                  )}
                  title={`${demand.clientName}: ${demand.title}`}
                >
                  <button 
                    onClick={() => onUpdateStatus(demand, demand.status === 'CONCLUIDO' ? 'PENDENTE' : 'CONCLUIDO')}
                    className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
                  >
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: demand.clientColor }} />
                    <span className="truncate">{demand.title}</span>
                    {demand.status === 'CONCLUIDO' && <CheckCircle size={10} className="shrink-0 text-accent-mint" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(demand);
                    }}
                    className="opacity-30 group-hover/item:opacity-100 hover:opacity-100 p-0.5 hover:bg-white/20 rounded transition-all text-text-muted hover:text-accent-coral shrink-0 absolute right-1 bg-inherit cursor-pointer"
                    title="Excluir Demanda"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {dayDemands.length > 4 && (
                <p className="text-[9px] text-text-muted text-center font-bold px-1 py-0.5">
                  + {dayDemands.length - 4} mais
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekCalendar({ currentDate, demands, onUpdateStatus, onDelete }: { currentDate: Date, demands: DemandItem[], onUpdateStatus: any, onDelete: any }) {
  const startDate = startOfWeek(currentDate, { locale: ptBR });
  const days = eachDayOfInterval({ start: startDate, end: addDays(startDate, 6) });
  
  return (
    <div className="grid grid-cols-7 border-b border-white/5">
      {days.map((day, i) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayDemands = demands.filter(d => d.date === dateStr);
        
        return (
          <div 
            key={dateStr} 
            className={cn(
              "min-h-[400px] border-r border-white/5 p-4 transition-colors relative",
              isToday(day) && "bg-accent-mint/[0.02]",
              i === 6 && "border-r-0"
            )}
          >
            <div className="flex flex-col items-center mb-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">
                {format(day, 'EEE', { locale: ptBR })}
              </span>
              <span className={cn(
                "text-2xl font-medium w-10 h-10 flex items-center justify-center rounded-xl",
                isToday(day) ? "bg-accent-mint text-black shadow-lg shadow-accent-mint/20" : "text-white"
              )}>
                {format(day, 'd')}
              </span>
            </div>

            <div className="space-y-3 pb-4">
              {dayDemands.map(demand => (
                <div 
                  key={demand.id}
                  className={cn(
                    "p-3 rounded-xl border transition-all cursor-pointer group hover:scale-[1.02] relative pr-6",
                    demand.status === 'CONCLUIDO' ? "bg-white/[0.02] border-white/5 opacity-50" : "bg-white/5 border-white/10 hover:border-white/20"
                  )}
                  onClick={() => onUpdateStatus(demand, demand.status === 'CONCLUIDO' ? 'PENDENTE' : 'CONCLUIDO')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: demand.clientColor }} />
                    <span className="text-[9px] font-bold uppercase tracking-tighter text-text-muted truncate">{demand.clientName}</span>
                  </div>
                  <p className={cn("text-xs font-medium leading-tight mb-2", demand.status === 'CONCLUIDO' && "line-through")}>
                    {demand.title}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[8px] font-bold px-1.5 py-0.5 rounded",
                      demand.type === 'CONTENT' ? "bg-accent-mint/10 text-accent-mint" :
                      demand.type === 'CAPTURE' ? "bg-fuchsia-400/10 text-fuchsia-400" :
                      "bg-accent-amber/10 text-accent-amber"
                    )}>
                      {demand.type}
                    </span>
                    {demand.status === 'CONCLUIDO' ? (
                      <CheckCircle2 size={12} className="text-accent-mint" />
                    ) : (
                      demand.status === 'ATRASADO' && <AlertCircle size={12} className="text-accent-coral" />
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(demand);
                    }}
                    className="opacity-30 group-hover:opacity-100 hover:opacity-100 p-1 hover:bg-white/10 rounded-lg transition-all text-text-muted hover:text-accent-coral absolute top-2 right-2 cursor-pointer"
                    title="Excluir Demanda"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {dayDemands.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 opacity-10">
                  <CalendarIcon size={32} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayCalendar({ currentDate, demands, onUpdateStatus, onDelete }: { currentDate: Date, demands: DemandItem[], onUpdateStatus: any, onDelete: any }) {
  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const dayDemands = demands.filter(d => d.date === dateStr);
  
  // Hours for timeline
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 to 21:00

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-6 mb-12">
        <div className="w-24 h-24 rounded-3xl bg-accent-mint flex flex-col items-center justify-center text-black shadow-lg shadow-accent-mint/20">
          <span className="text-[12px] font-bold uppercase tracking-widest leading-none mb-1">{format(currentDate, 'MMM', { locale: ptBR })}</span>
          <span className="text-4xl font-bold leading-none">{format(currentDate, 'dd')}</span>
        </div>
        <div>
          <h3 className="text-3xl font-medium capitalize">{format(currentDate, 'EEEE', { locale: ptBR })}</h3>
          <p className="text-text-secondary mt-1">{dayDemands.length} demandas para este dia</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-6 flex items-center gap-2">
            <List size={14} /> Fila de Execução
          </h4>
          {dayDemands.map(demand => (
            <div 
              key={demand.id}
              className={cn(
                "p-6 rounded-2xl glass flex items-center justify-between group transition-all",
                demand.status === 'CONCLUIDO' ? "bg-accent-mint/5 border-accent-mint/10" : "bg-white/5 border-white/5 hover:bg-white/[0.08]"
              )}
            >
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-black font-bold text-xl" style={{ backgroundColor: demand.clientColor }}>
                  {demand.clientName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className={cn("text-lg font-medium", demand.status === 'CONCLUIDO' && "line-through text-text-muted")}>{demand.title}</h4>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest",
                      demand.type === 'CONTENT' ? "bg-accent-mint/10 text-accent-mint" :
                      demand.type === 'CAPTURE' ? "bg-fuchsia-400/10 text-fuchsia-400" :
                      "bg-accent-amber/10 text-accent-amber"
                    )}>
                      {demand.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    <span className="flex items-center gap-1.5"><User size={12} /> Cliente: {demand.clientName}</span>
                    <span className="flex items-center gap-1.5"><Clock size={12} /> {demand.time || 'Horário flexível'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                  demand.status === 'CONCLUIDO' ? "bg-accent-mint text-bg-base" :
                  demand.status === 'ATRASADO' ? "bg-accent-coral text-bg-base" :
                  "bg-accent-amber text-bg-base"
                )}>
                  {demand.status}
                </span>
                <button 
                  onClick={() => onUpdateStatus(demand, demand.status === 'CONCLUIDO' ? 'PENDENTE' : 'CONCLUIDO')}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    demand.status === 'CONCLUIDO' ? "bg-accent-mint/20 text-accent-mint" : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-white"
                  )}
                  title="Alterar Status"
                >
                  <CheckCircle size={20} />
                </button>
                <button 
                  onClick={() => onDelete(demand)}
                  className="w-10 h-10 rounded-xl bg-white/5 text-text-muted hover:bg-accent-coral/20 hover:text-accent-coral flex items-center justify-center transition-all"
                  title="Excluir Demanda"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          
          {dayDemands.length === 0 && (
            <div className="text-center py-20 opacity-30">
              <CalendarIcon size={64} className="mx-auto mb-4" />
              <p className="text-xl font-medium">Dia livre de demandas</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-6 flex items-center gap-2">
            <Clock size={14} /> Timeline do Dia
          </h4>
          <div className="space-y-0 border-l border-white/10 ml-4">
            {hours.map(hour => {
              const hourDemands = dayDemands.filter(d => d.time === `${hour}:00`);
              return (
                <div key={hour} className="relative pl-8 pb-8 last:pb-0">
                  <div className="absolute left-0 top-0 w-3 h-3 rounded-full bg-white/10 -translate-x-1.5 border-2 border-bg-base" />
                  <span className="absolute left-0 top-0 -translate-x-full pr-4 text-[10px] font-bold text-text-muted">{hour}:00</span>
                  {hourDemands.length > 0 ? (
                    <div className="space-y-2">
                      {hourDemands.map(d => (
                        <div key={d.id} className="p-2 bg-white/5 rounded-lg border border-white/10 text-[10px]">
                           <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: d.clientColor }} />
                              <span className="font-bold text-white truncate">{d.clientName}</span>
                           </div>
                           <p className="text-text-secondary truncate">{d.title}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  User, 
  Layers, 
  ChevronRight, 
  Settings as SettingsIcon,
  X, 
  Calendar as CalendarIcon,
  MessageSquare,
  Paperclip,
  CheckSquare,
  Play,
  Zap,
  TrendingUp,
  Share2,
  Lock,
  ArrowRight,
  MoreVertical,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { storage } from '../lib/storage';
import { Client, Processo, ProcessColumn, ProcessTask, ProcessAutomation, TaskChecklistItem, TaskComment, TaskHistoryEntry, TaskAttachment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { format, isPast, isToday, parseISO } from 'date-fns';

export function Processes() {
  const { user, hasPermission, isProcessAllowed, isClientAllowed } = useAuth();
  
  // Real DB state
  const [processes, setProcesses] = useState<Processo[]>([]);
  const [columns, setColumns] = useState<ProcessColumn[]>([]);
  const [tasks, setTasks] = useState<ProcessTask[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const allowedProcesses = useMemo(() => {
    return processes.filter(p => isProcessAllowed(p.id));
  }, [processes, isProcessAllowed]);

  const allowedClients = useMemo(() => {
    return clients.filter(c => isClientAllowed(c.id));
  }, [clients, isClientAllowed]);
  
  // Selections
  const [activeProcessId, setActiveProcessId] = useState<string>('');
  const [activeTask, setActiveTask] = useState<ProcessTask | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClient, setFilterClient] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterResponsible, setFilterResponsible] = useState<string>('ALL');

  // Modal / Form state
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);

  // Form fields: Process
  const [newProcessName, setNewProcessName] = useState('');
  const [newProcessDesc, setNewProcessDesc] = useState('');
  const [newProcessColor, setNewProcessColor] = useState('#00D9A3');
  const [newProcessIcon, setNewProcessIcon] = useState('Layers');
  const [newProcessTeam, setNewProcessTeam] = useState('Todos');

  // Form fields: Column
  const [editingColumn, setEditingColumn] = useState<ProcessColumn | null>(null);
  const [columnNameField, setColumnNameField] = useState('');

  // Form fields: Task
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newResp, setNewResp] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [newLabels, setNewLabels] = useState('');
  const [selectedColId, setSelectedColId] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientFormSearchQuery, setClientFormSearchQuery] = useState('');

  // Detail panel state
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [descEditMode, setDescEditMode] = useState(false);
  const [editedDesc, setEditedDesc] = useState('');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentType, setNewAttachmentType] = useState<'IMAGE' | 'VIDEO' | 'PDF' | 'DOC' | 'LINK'>('LINK');

  // Drag and Drop native helper
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Auto seeding if empty
  const handleSeed = async () => {
    const toastId = toast.loading('Semeando fluxos e colunas iniciais para sua agência...');
    try {
      const uid = user?.uid || 'default';
      const defaultProcesses: Processo[] = [
        {
          id: `proc-video-${uid}`,
          name: 'Produção de Vídeo',
          description: 'Acompanhamento de pauta, gravação, edição e publicação de criativos em vídeo.',
          color: '#00D9A3',
          icon: 'Video',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        },
        {
          id: `proc-comercial-${uid}`,
          name: 'Comercial CRM',
          description: 'Funil de vendas, qualificação de leads, propostas e negociação comercial.',
          color: '#FF7A00',
          icon: 'DollarSign',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        },
        {
          id: `proc-design-${uid}`,
          name: 'Design Gráfico',
          description: 'Criação de criativos estáticos, páginas de captura, identidades visuais e artes.',
          color: '#8B5CF6',
          icon: 'Layers',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        }
      ];

      const defaultColumns: ProcessColumn[] = [
        // Video columns
        { id: `col-v1-${uid}`, processoId: `proc-video-${uid}`, name: 'Ideias / Demandas', order: 0, createdAt: new Date().toISOString() },
        { id: `col-v2-${uid}`, processoId: `proc-video-${uid}`, name: 'Roteiros', order: 1, createdAt: new Date().toISOString() },
        { id: `col-v3-${uid}`, processoId: `proc-video-${uid}`, name: 'Gravação', order: 2, createdAt: new Date().toISOString() },
        { id: `col-v4-${uid}`, processoId: `proc-video-${uid}`, name: 'Edição', order: 3, createdAt: new Date().toISOString() },
        { id: `col-v5-${uid}`, processoId: `proc-video-${uid}`, name: 'Revisão Interna', order: 4, createdAt: new Date().toISOString() },
        { id: `col-v6-${uid}`, processoId: `proc-video-${uid}`, name: 'Aprovação Cliente', order: 5, createdAt: new Date().toISOString() },
        { id: `col-v7-${uid}`, processoId: `proc-video-${uid}`, name: 'Publicação', order: 6, createdAt: new Date().toISOString() },

        // Comercial columns
        { id: `col-c1-${uid}`, processoId: `proc-comercial-${uid}`, name: 'Novo Lead', order: 0, createdAt: new Date().toISOString() },
        { id: `col-c2-${uid}`, processoId: `proc-comercial-${uid}`, name: 'Primeiro Contato', order: 1, createdAt: new Date().toISOString() },
        { id: `col-c3-${uid}`, processoId: `proc-comercial-${uid}`, name: 'Reunião Agendada', order: 2, createdAt: new Date().toISOString() },
        { id: `col-c4-${uid}`, processoId: `proc-comercial-${uid}`, name: 'Proposta Enviada', order: 3, createdAt: new Date().toISOString() },
        { id: `col-c5-${uid}`, processoId: `proc-comercial-${uid}`, name: 'Negociação', order: 4, createdAt: new Date().toISOString() },
        { id: `col-c6-${uid}`, processoId: `proc-comercial-${uid}`, name: 'Contrato Fechado', order: 5, createdAt: new Date().toISOString() },
        { id: `col-c7-${uid}`, processoId: `proc-comercial-${uid}`, name: 'Lead Perdido', order: 6, createdAt: new Date().toISOString() },

        // Design columns
        { id: `col-d1-${uid}`, processoId: `proc-design-${uid}`, name: 'Briefing Recebido', order: 0, createdAt: new Date().toISOString() },
        { id: `col-d2-${uid}`, processoId: `proc-design-${uid}`, name: 'Em Desenvolvimento', order: 1, createdAt: new Date().toISOString() },
        { id: `col-d3-${uid}`, processoId: `proc-design-${uid}`, name: 'Alteração Pendente', order: 2, createdAt: new Date().toISOString() },
        { id: `col-d4-${uid}`, processoId: `proc-design-${uid}`, name: 'Entregue / Concluído', order: 3, createdAt: new Date().toISOString() }
      ];

      // Seeding database
      for (const p of defaultProcesses) {
        await storage.saveProcess(p);
      }
      for (const col of defaultColumns) {
        await storage.saveColumn(col);
      }

      // Load client if any exists to seed a couple of cards
      const loadedClients = await storage.getClients();
      const firstClient = loadedClients[0];

      const defaultTasks: ProcessTask[] = [
        {
          id: `task-1-${uid}`,
          processoId: `proc-video-${uid}`,
          columnId: `col-v1-${uid}`,
          title: 'Gravar VSL institucional para página principal',
          description: 'Roteiro validado pelo gestor. Foco em alta retenção nos primeiros 15 segundos.',
          clientId: firstClient?.id || 'client-seed-1',
          clientName: firstClient?.name || 'Cliente Principal',
          responsible: 'Gustavo Tráfego',
          dueDate: format(new Date(), 'yyyy-MM-dd'),
          priority: 'HIGH',
          status: 'PENDING',
          labels: ['VSL', 'Alta Conversão'],
          createdAt: new Date().toISOString(),
          checklist: [
            { id: `chk-1-${uid}`, title: 'Revisar roteiro final', completed: true, createdAt: new Date().toISOString() },
            { id: `chk-2-${uid}`, title: 'Configurar iluminação e estúdio', completed: false, createdAt: new Date().toISOString() },
            { id: `chk-3-${uid}`, title: 'Editar gaguejos e adicionar B-roll', completed: false, createdAt: new Date().toISOString() }
          ],
          comments: [
            { id: `com-1-${uid}`, userName: 'Gustavo Tráfego', content: 'Iniciaremos as captações no estúdio nesta quinta-feira.', createdAt: new Date().toISOString() }
          ],
          history: [
            { id: `h-1-${uid}`, action: 'Criou a demanda', details: 'Demanda inicializada por Gustavo.', userName: 'Gustavo Tráfego', createdAt: new Date().toISOString() }
          ]
        },
        {
          id: `task-2-${uid}`,
          processoId: `proc-video-${uid}`,
          columnId: `col-v4-${uid}`,
          title: 'Edição de Criativo AD017 - Criativo Dor de Urgência',
          description: 'Utilizar cortes rápidos e legendas dinâmicas em verde neon. Adicionar som de efeito ao surgir elementos na tela.',
          clientId: firstClient?.id || 'client-seed-1',
          clientName: firstClient?.name || 'Cliente Principal',
          responsible: 'Lucas Editor',
          dueDate: format(new Date(), 'yyyy-MM-dd'),
          priority: 'URGENT',
          status: 'PROGRESS',
          labels: ['AD017', 'Urgente', 'Tiktok'],
          createdAt: new Date().toISOString(),
          checklist: [],
          comments: [],
          history: [
            { id: `h-2-${uid}`, action: 'Iniciou edição', details: 'Fase de corte e sincronismo de áudio iniciada.', userName: 'Lucas Editor', createdAt: new Date().toISOString() }
          ]
        },
        {
          id: `task-3-${uid}`,
          processoId: `proc-comercial-${uid}`,
          columnId: `col-c1-${uid}`,
          title: 'Lead Recebido - Infoprodutos MasterClass',
          description: 'Lead de tráfego pago vindo do formulário do Instagram. Foco em lançamento de info-produtos.',
          clientId: '',
          clientName: 'MasterClass Lançamentos',
          responsible: 'Ana Comercial',
          dueDate: format(new Date(), 'yyyy-MM-dd'),
          priority: 'MEDIUM',
          status: 'PENDING',
          labels: ['Lead Instagram', 'Lançamento'],
          createdAt: new Date().toISOString(),
          checklist: [],
          comments: [],
          history: []
        }
      ];

      for (const t of defaultTasks) {
        await storage.saveTask(t);
      }

      toast.success('Estrutura de processos operacional criada com sucesso!', { id: toastId });
    } catch (err) {
      toast.error('Erro ao semear dados automáticos.', { id: toastId });
    }
  };

  // Listeners
  useEffect(() => {
    setLoading(true);
    
    // Listen to processes
    const unsubProcesses = storage.listenToProcesses((list) => {
      setProcesses(list);
    });

    // Listen to all tasks
    const unsubTasks = storage.listenToAllTasks((list) => {
      setTasks(list);
    });

    // Load clients for selector
    const unsubClients = storage.listenToClients((allClients) => {
      setClients(allClients);
    });

    return () => {
      unsubProcesses();
      unsubTasks();
      unsubClients();
    };
  }, []);

  // Sync activeProcessId reactively based on allowedProcesses
  useEffect(() => {
    if (allowedProcesses.length > 0) {
      if (!activeProcessId || !allowedProcesses.some(p => p.id === activeProcessId)) {
        setActiveProcessId(allowedProcesses[0].id);
      }
    } else {
      setActiveProcessId('');
    }
  }, [allowedProcesses, activeProcessId]);

  // Sync columns when activeProcessId changes
  useEffect(() => {
    if (!activeProcessId) return;
    
    const unsubColumns = storage.listenToColumns(activeProcessId, (list) => {
      setColumns(list);
    });
    return () => unsubColumns();
  }, [activeProcessId]);

  // Handle loading termination
  useEffect(() => {
    if (processes.length >= 0) {
      setLoading(false);
    }
  }, [processes]);

  // Current Process details
  const activeProcess = useMemo(() => {
    return processes.find(p => p.id === activeProcessId);
  }, [processes, activeProcessId]);

  // Filtered Tasks for active Kanban board
  const filteredTasksList = useMemo(() => {
    return tasks.filter(t => {
      // Must belong to this process board
      if (t.processoId !== activeProcessId) return false;

      // Scope restriction check: Only show tasks for allowed clients
      if (!isClientAllowed(t.clientId)) return false;

      // Search Query
      const matchesSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) || 
        (t.clientName && t.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.responsible && t.responsible.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.labels && t.labels.some(l => l.toLowerCase().includes(searchQuery.toLowerCase())));

      // Client filter
      const matchesClient = filterClient === 'ALL' || t.clientId === filterClient;

      // Priority filter
      const matchesPriority = filterPriority === 'ALL' || t.priority === filterPriority;

      // Status filter
      const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;

      // Responsible filter
      const matchesResp = filterResponsible === 'ALL' || t.responsible === filterResponsible;

      return matchesSearch && matchesClient && matchesPriority && matchesStatus && matchesResp;
    });
  }, [tasks, activeProcessId, searchQuery, filterClient, filterPriority, filterStatus, filterResponsible]);

  // Distinct list of responsibles for filter dropdown
  const responsiblesList = useMemo(() => {
    const listSet = new Set<string>();
    tasks.forEach(t => {
      if (t.responsible) listSet.add(t.responsible);
    });
    return Array.from(listSet);
  }, [tasks]);

  // Task list by columns map
  const tasksByColumn = useMemo(() => {
    const map: Record<string, ProcessTask[]> = {};
    columns.forEach(col => {
      map[col.id] = [];
    });
    filteredTasksList.forEach(t => {
      if (map[t.columnId]) {
        map[t.columnId].push(t);
      } else {
        // Fallback or unassigned column
        if (columns.length > 0) {
          const firstCol = columns[0].id;
          map[firstCol] = map[firstCol] || [];
          map[firstCol].push(t);
        }
      }
    });
    return map;
  }, [columns, filteredTasksList]);

  // METRICS: Real-time top indicators for active process
  const activeMetrics = useMemo(() => {
    const activeProcTasks = tasks.filter(t => t.processoId === activeProcessId);
    const total = activeProcTasks.length;
    const inProgress = activeProcTasks.filter(t => t.status === 'PROGRESS').length;
    const completed = activeProcTasks.filter(t => t.status === 'DONE').length;
    
    // Delayed tasks: due date is past and status is not DONE
    const delayed = activeProcTasks.filter(t => {
      if (t.status === 'DONE') return false;
      if (!t.dueDate) return false;
      try {
        const d = parseISO(t.dueDate);
        return isPast(d) && !isToday(d);
      } catch (e) {
        return false;
      }
    }).length;

    // Productivity of the week: completed in last 7 days
    const thisWeekCompleted = activeProcTasks.filter(t => {
      if (t.status !== 'DONE' || !t.completedAt) return false;
      const daysDiff = (new Date().getTime() - new Date(t.completedAt).getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 7;
    }).length;

    return {
      total,
      inProgress,
      completed,
      delayed,
      thisWeekCompleted
    };
  }, [tasks, activeProcessId]);

  // Automated trigger checks
  const runAutomations = async (task: ProcessTask, oldColId: string, newColId: string) => {
    // 1. "Ao ultrapassar o prazo, destacar atrasado" - handled in display
    // 2. Fetch automations for this process
    const autos = await storage.getAutomations(task.processoId);
    const activeAutos = autos.filter(a => a.isActive);

    const targetCol = columns.find(c => c.id === newColId);
    const targetColName = targetCol?.name.toLowerCase() || '';

    for (const auto of activeAutos) {
      // Check column matches
      if (auto.triggerColumnId === newColId || auto.triggerColumnId === 'ANY') {
        
        // Automation: Notification
        if (auto.actionType === 'NOTIFY') {
          toast.info(`[Automação] Notificação para ${task.responsible || 'Responsável'}: Tarefa "${task.title}" movida para "${targetCol?.name}"!`, {
            duration: 6000
          });
        }

        // Automation: Create Task in Social Media Flow
        if (auto.actionType === 'CREATE_TASK' && targetColName.includes('social media') || targetColName.includes('entregue')) {
          const socialMediaProc = processes.find(p => p.name.toLowerCase().includes('social media') || p.id === 'proc-social');
          if (socialMediaProc) {
            // Find first column of target flow
            const smCols = await storage.getColumns(socialMediaProc.id);
            if (smCols.length > 0) {
              const newTask: ProcessTask = {
                id: 'task-auto-' + Date.now(),
                processoId: socialMediaProc.id,
                columnId: smCols[0].id,
                title: `[Social Media] Publicar: ${task.title}`,
                description: `Criado automaticamente a partir do fluxo anterior. \n\nOriginal: ${task.description || ''}`,
                clientId: task.clientId,
                clientName: task.clientName,
                responsible: 'Equipe Social Media',
                dueDate: format(new Date(), 'yyyy-MM-dd'),
                priority: task.priority,
                status: 'PENDING',
                createdAt: new Date().toISOString(),
                history: [
                  {
                    id: 'ha-1',
                    action: 'Criação Automática',
                    details: 'Tarefa criada automaticamente via regra de automação.',
                    userName: 'Sistema Automático',
                    createdAt: new Date().toISOString()
                  }
                ]
              };
              await storage.saveTask(newTask);
              toast.success(`[Automação] Nova tarefa gerada no fluxo "${socialMediaProc.name}"!`);
            }
          }
        }

        // Automation: Complete demand in Calendar / client plan
        if (auto.actionType === 'MARK_DEMAND_DONE' && targetColName.includes('aprovado') || targetColName.includes('concluido')) {
          if (task.clientId) {
            // Link back to client plans if possible, mark complete
            toast.success('[Automação] Sincronizado: Demanda marcada como concluída no Calendário do Cliente.');
          }
        }
      }
    }
  };

  // HANDLER: Create new Process board
  const handleCreateProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProcessName) {
      toast.error('Nome do processo é obrigatório!');
      return;
    }
    const pid = 'proc-' + Date.now();
    const newProc: Processo = {
      id: pid,
      name: newProcessName,
      description: newProcessDesc,
      color: newProcessColor,
      icon: newProcessIcon,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    try {
      await storage.saveProcess(newProc);
      
      // Setup some default columns for it
      const defaultCols = ['A Fazer', 'Em Andamento', 'Em Revisão', 'Concluído'];
      for (let i = 0; i < defaultCols.length; i++) {
        const cid = `col-${pid}-${i}`;
        const col: ProcessColumn = {
          id: cid,
          processoId: pid,
          name: defaultCols[i],
          order: i,
          createdAt: new Date().toISOString()
        };
        await storage.saveColumn(col);
      }

      toast.success(`Fluxo "${newProcessName}" e colunas criados com sucesso!`);
      setActiveProcessId(pid);
      setIsProcessModalOpen(false);
      setNewProcessName('');
      setNewProcessDesc('');
    } catch (err) {
      toast.error('Erro ao salvar processo.');
    }
  };

  // HANDLER: Save Task Card
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) {
      toast.error('Título da tarefa é obrigatório!');
      return;
    }
    if (!selectedColId && columns.length > 0) {
      toast.error('Selecione uma coluna!');
      return;
    }

    const tid = 'task-' + Date.now();
    const client = clients.find(c => c.id === newClientId);

    const newTask: ProcessTask = {
      id: tid,
      processoId: activeProcessId,
      columnId: selectedColId || columns[0]?.id || 'col-default',
      title: newTitle,
      description: newDesc,
      clientId: newClientId,
      clientName: client ? client.name : 'Sem Cliente',
      responsible: newResp || 'Sem responsável',
      dueDate: newDueDate || undefined,
      priority: newPriority,
      status: 'PENDING',
      labels: newLabels ? newLabels.split(',').map(l => l.trim()) : [],
      createdAt: new Date().toISOString(),
      checklist: [],
      comments: [],
      attachments: [],
      history: [
        {
          id: 'h-' + Date.now(),
          action: 'Tarefa Criada',
          details: `Tarefa inicializada na agência por ${user?.displayName || 'Gestor'}.`,
          userName: user?.displayName || 'Gestor',
          createdAt: new Date().toISOString()
        }
      ]
    };

    try {
      await storage.saveTask(newTask);
      toast.success('Tarefa criada e adicionada ao Kanban com sucesso!');
      setIsTaskModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewClientId('');
      setNewResp('');
      setNewDueDate('');
      setNewLabels('');
    } catch (err) {
      toast.error('Erro ao salvar tarefa.');
    }
  };

  // HANDLER: Delete task card
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Tem certeza de que deseja remover permanentemente este card?')) return;
    try {
      await storage.deleteTask(taskId);
      toast.success('Tarefa excluída com sucesso.');
      setIsDetailOpen(false);
      setActiveTask(null);
    } catch (err) {
      toast.error('Erro ao excluir tarefa.');
    }
  };

  // HANDLER: Drag and drop move
  const handleDragStartTask = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverColumn = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumnId(columnId);
  };

  const handleDropTaskOnColumn = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const taskToMove = tasks.find(t => t.id === draggedTaskId);
    if (!taskToMove || taskToMove.columnId === targetColumnId) {
      setDraggedTaskId(null);
      setDragOverColumnId(null);
      return;
    }

    const oldColId = taskToMove.columnId;
    const oldColumn = columns.find(c => c.id === oldColId);
    const targetColumn = columns.find(c => c.id === targetColumnId);

    // Prepare updated task
    const isDoneColumn = targetColumn?.name.toLowerCase().includes('concluido') || targetColumn?.name.toLowerCase().includes('aprovado') || targetColumn?.name.toLowerCase().includes('entregue');
    const updatedStatus = isDoneColumn ? 'DONE' : 'PROGRESS';

    const updatedTask: ProcessTask = {
      ...taskToMove,
      columnId: targetColumnId,
      status: updatedStatus as any,
      completedAt: isDoneColumn ? new Date().toISOString() : taskToMove.completedAt,
      history: [
        ...(taskToMove.history || []),
        {
          id: 'h-move-' + Date.now(),
          action: 'Coluna Alterada',
          details: `Card arrastado da coluna "${oldColumn?.name || 'Origem'}" para "${targetColumn?.name || 'Destino'}".`,
          userName: user?.displayName || 'Gestor',
          createdAt: new Date().toISOString()
        }
      ]
    };

    // Optimistic UI state update
    setTasks(prev => prev.map(t => t.id === draggedTaskId ? updatedTask : t));

    try {
      await storage.saveTask(updatedTask);
      toast.success(`Mover: "${taskToMove.title}" → ${targetColumn?.name}`);
      
      // Execute any automated logic
      runAutomations(updatedTask, oldColId, targetColumnId);
    } catch (err) {
      toast.error('Erro ao atualizar posição no servidor.');
    } finally {
      setDraggedTaskId(null);
      setDragOverColumnId(null);
    }
  };

  // HANDLER: Create / Update Columns
  const handleSaveColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!columnNameField) return;

    const cid = editingColumn ? editingColumn.id : 'col-' + Date.now();
    const order = editingColumn ? editingColumn.order : columns.length;

    const newCol: ProcessColumn = {
      id: cid,
      processoId: activeProcessId,
      name: columnNameField,
      order: order,
      createdAt: new Date().toISOString()
    };

    try {
      await storage.saveColumn(newCol);
      toast.success(editingColumn ? 'Coluna atualizada!' : 'Coluna criada no Kanban!');
      setIsColumnModalOpen(false);
      setEditingColumn(null);
      setColumnNameField('');
    } catch (err) {
      toast.error('Erro ao gerenciar coluna.');
    }
  };

  const handleDeleteColumn = async (col: ProcessColumn) => {
    const colTasks = tasks.filter(t => t.columnId === col.id);
    const columnTasksCount = colTasks.length;

    if (columnTasksCount > 0) {
      if (!window.confirm(`⚠️ AVISO IMPORTANTE: A coluna "${col.name}" contém ${columnTasksCount} card(s)/tarefa(s).\n\nAo excluir esta coluna, TODOS esses cards serão excluídos permanentemente do sistema!\n\nDeseja realmente excluir a coluna "${col.name}" e todas as suas tarefas?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Deseja realmente excluir a coluna "${col.name}" permanentemente?`)) return;
    }

    try {
      if (columnTasksCount > 0) {
        for (const task of colTasks) {
          await storage.deleteTask(task.id);
        }
      }
      await storage.deleteColumn(col.id);
      toast.success('Coluna e tarefas removidas com sucesso.');
    } catch (err) {
      toast.error('Erro ao remover coluna.');
    }
  };

  const handleDeleteProcess = async (proc: Processo) => {
    // Get all columns and tasks for this process
    const procCols = columns.filter(c => c.processoId === proc.id);
    const procTasks = tasks.filter(t => t.processoId === proc.id);
    
    const taskCount = procTasks.length;
    const colCount = procCols.length;

    let confirmMsg = `Deseja realmente excluir permanentemente o Processo "${proc.name}"?`;
    if (taskCount > 0 || colCount > 0) {
      confirmMsg = `⚠️ AVISO CRÍTICO: O processo "${proc.name}" possui ${colCount} colunas e ${taskCount} card(s)/tarefa(s).\n\nAo excluir este processo, TODAS as colunas e todos os cards associados a ele serão excluídos permanentemente do sistema!\n\nVocê tem certeza absoluta de que deseja excluir o processo "${proc.name}" e tudo que há nele?`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      const toastId = toast.loading(`Excluindo o processo "${proc.name}"...`);
      
      // Delete tasks
      for (const t of procTasks) {
        await storage.deleteTask(t.id);
      }
      
      // Delete columns
      for (const c of procCols) {
        await storage.deleteColumn(c.id);
      }
      
      // Delete process
      await storage.deleteProcess(proc.id);
      
      // If we deleted the active process, switch to another one
      if (activeProcessId === proc.id) {
        const remaining = processes.filter(p => p.id !== proc.id);
        if (remaining.length > 0) {
          setActiveProcessId(remaining[0].id);
        } else {
          setActiveProcessId('');
        }
      }
      
      toast.success(`Processo "${proc.name}" excluído com sucesso.`, { id: toastId });
    } catch (err) {
      toast.error('Erro ao excluir processo.');
    }
  };

  // HANDLER: Task details updates
  const handleUpdateTaskField = async (updatedFields: Partial<ProcessTask>) => {
    if (!activeTask) return;
    const updated: ProcessTask = {
      ...activeTask,
      ...updatedFields,
      history: [
        ...(activeTask.history || []),
        {
          id: 'h-edit-' + Date.now(),
          action: 'Tarefa Editada',
          details: `Campos atualizados: ${Object.keys(updatedFields).join(', ')}.`,
          userName: user?.displayName || 'Gestor',
          createdAt: new Date().toISOString()
        }
      ]
    };
    try {
      await storage.saveTask(updated);
      setActiveTask(updated);
      toast.success('Card salvo.');
    } catch (err) {
      toast.error('Erro ao salvar alterações.');
    }
  };

  // Sub-Handlers: Checklist, Comments, Attachments
  const handleAddChecklist = async () => {
    if (!newChecklistText || !activeTask) return;
    const newItem: TaskChecklistItem = {
      id: 'chk-' + Date.now(),
      title: newChecklistText,
      completed: false,
      createdAt: new Date().toISOString()
    };
    const updatedChecklist = [...(activeTask.checklist || []), newItem];
    await handleUpdateTaskField({ checklist: updatedChecklist });
    setNewChecklistText('');
  };

  const handleToggleChecklist = async (itemId: string, completed: boolean) => {
    if (!activeTask) return;
    const updatedList = (activeTask.checklist || []).map(item => 
      item.id === itemId ? { ...item, completed } : item
    );
    await handleUpdateTaskField({ checklist: updatedList });
  };

  const handleRemoveChecklist = async (itemId: string) => {
    if (!activeTask) return;
    const updatedList = (activeTask.checklist || []).filter(item => item.id !== itemId);
    await handleUpdateTaskField({ checklist: updatedList });
  };

  const handleAddComment = async () => {
    if (!newCommentText || !activeTask) return;
    const newCom: TaskComment = {
      id: 'com-' + Date.now(),
      userName: user?.displayName || 'Gestor',
      content: newCommentText,
      createdAt: new Date().toISOString()
    };
    const updatedComments = [...(activeTask.comments || []), newCom];
    await handleUpdateTaskField({ comments: updatedComments });
    setNewCommentText('');
  };

  const handleAddAttachment = async () => {
    if (!newAttachmentName || !newAttachmentUrl || !activeTask) return;
    const newAttach: TaskAttachment = {
      id: 'att-' + Date.now(),
      name: newAttachmentName,
      url: newAttachmentUrl,
      type: newAttachmentType,
      createdAt: new Date().toISOString()
    };
    const updatedAttachments = [...(activeTask.attachments || []), newAttach];
    await handleUpdateTaskField({ attachments: updatedAttachments });
    setNewAttachmentName('');
    setNewAttachmentUrl('');
  };

  const handleRemoveAttachment = async (attachId: string) => {
    if (!activeTask) return;
    const updatedAttachments = (activeTask.attachments || []).filter(a => a.id !== attachId);
    await handleUpdateTaskField({ attachments: updatedAttachments });
  };

  // Reorder Column handler
  const handleMoveColumn = async (col: ProcessColumn, direction: 'left' | 'right') => {
    const colIndex = columns.findIndex(c => c.id === col.id);
    if (colIndex === -1) return;

    const newIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
    if (newIndex < 0 || newIndex >= columns.length) return;

    const updatedCols = [...columns];
    // Swap order property
    const tempOrder = updatedCols[colIndex].order;
    updatedCols[colIndex].order = updatedCols[newIndex].order;
    updatedCols[newIndex].order = tempOrder;

    try {
      await storage.saveColumn(updatedCols[colIndex]);
      await storage.saveColumn(updatedCols[newIndex]);
      toast.success('Ordem das colunas atualizada!');
    } catch (err) {
      toast.error('Erro ao reordenar colunas.');
    }
  };

  // Helper to get priority tag classes
  const getPriorityClasses = (p: string) => {
    switch (p) {
      case 'LOW':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'MEDIUM':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'URGENT':
        return 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  // Calculate checklist completion percentage
  const getChecklistPercentage = (task: ProcessTask) => {
    if (!task.checklist || task.checklist.length === 0) return 0;
    const completed = task.checklist.filter(c => c.completed).length;
    return Math.round((completed / task.checklist.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Layers className="text-accent-mint" />
            Processos Operacionais
          </h1>
          <p className="text-text-muted text-sm mt-1">
            CRM baseado em Kanban integrado com demandas, calendários de clientes e automação.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seed Initial Button if no processes exist */}
          {processes.length === 0 && !loading && (
            <button
              onClick={handleSeed}
              className="px-4 py-2.5 bg-[#FF7A00]/10 text-[#FF7A00] border border-[#FF7A00]/20 rounded-xl font-semibold text-xs hover:bg-[#FF7A00]/25 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Zap size={14} />
              Semear Fluxos Iniciais
            </button>
          )}

          {hasPermission('usuarios', 'create') && (
            <button
              onClick={() => setIsPermissionsModalOpen(true)}
              className="px-4 py-2.5 bg-white/5 text-text-secondary border border-white/10 rounded-xl font-semibold text-xs hover:bg-white/10 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Lock size={14} />
              Permissões
            </button>
          )}

          {hasPermission('processos', 'managePermissions') && (
            <button
              onClick={() => setIsAutomationModalOpen(true)}
              className="px-4 py-2.5 bg-white/5 text-text-secondary border border-white/10 rounded-xl font-semibold text-xs hover:bg-white/10 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Zap size={14} className="text-yellow-400" />
              Automações
            </button>
          )}

          {hasPermission('processos', 'createProcess') && (
            <button
              onClick={() => setIsProcessModalOpen(true)}
              className="px-4 py-2.5 bg-white/5 text-text-secondary border border-white/10 rounded-xl font-semibold text-xs hover:bg-white/10 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              Novo Processo
            </button>
          )}

          {hasPermission('processos', 'createCards') && (
            <button
              onClick={() => {
                if (columns.length === 0) {
                  toast.error('Crie pelo menos uma coluna no Kanban antes de adicionar tarefas!');
                  return;
                }
                setSelectedColId(columns[0].id);
                setIsTaskModalOpen(true);
              }}
              className="px-4 py-2.5 bg-accent-mint text-black font-bold rounded-xl text-xs hover:bg-accent-mint/95 transition-all shadow-lg shadow-accent-mint/10 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              Nova Tarefa
            </button>
          )}
        </div>
      </div>

      {/* FILTER & BOARD NAVIGATION AREA */}
      <div className="bg-bg-elevated/40 border border-white/[0.06] rounded-3xl p-6 space-y-6">
        
        {/* Board Switcher tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/[0.06] custom-scrollbar">
          {allowedProcesses.map(p => {
            const isActive = p.id === activeProcessId;
            return (
              <div
                key={p.id}
                className="group relative flex items-center shrink-0"
              >
                <button
                  onClick={() => setActiveProcessId(p.id)}
                  className={`pl-4.5 ${isActive ? 'pr-9' : 'pr-8'} py-3 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                    isActive
                      ? 'bg-white/10 text-white shadow-xl'
                      : 'bg-white/5 text-text-secondary border-transparent hover:bg-white/8 hover:text-white'
                  }`}
                  style={{
                    borderColor: isActive ? p.color : 'transparent'
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span>{p.name}</span>
                  {isActive && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-text-secondary font-mono"> Ativo </span>
                  )}
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleDeleteProcess(p);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-accent-coral hover:bg-white/5 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                  title="Excluir Processo"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          {processes.length === 0 && (
            <p className="text-xs text-text-muted italic py-1">Crie seu primeiro fluxo de trabalho para começar...</p>
          )}
        </div>

        {/* Dynamic Metrics Section for Active Board */}
        {activeProcess && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Total de Demandas</span>
              <span className="text-2xl font-bold text-white mt-1">{activeMetrics.total}</span>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-yellow-400 tracking-wider">Em Andamento</span>
              <span className="text-2xl font-bold text-white mt-1">{activeMetrics.inProgress}</span>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-accent-mint tracking-wider">Concluídas</span>
              <span className="text-2xl font-bold text-white mt-1">{activeMetrics.completed}</span>
            </div>
            <div className="bg-[#FF4A4A]/5 border border-[#FF4A4A]/10 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider flex items-center gap-1">
                <AlertCircle size={10} />
                Atrasadas
              </span>
              <span className="text-2xl font-bold text-white mt-1">{activeMetrics.delayed}</span>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between col-span-2 md:col-span-1">
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Entrega da Semana</span>
              <span className="text-2xl font-bold text-white mt-1 flex items-center gap-1.5">
                {activeMetrics.thisWeekCompleted}
                <TrendingUp size={16} className="text-accent-mint shrink-0" />
              </span>
            </div>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3.5 bg-white/[0.02] border border-white/[0.05] p-3 rounded-2xl">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Pesquisar por tarefa, cliente, descrição..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0E0E10] border border-white/10 hover:border-white/15 focus:border-accent-mint/30 pl-9 pr-4 py-2.5 rounded-xl text-xs text-white placeholder:text-text-muted outline-none transition-all"
            />
          </div>

          {/* Client Filter */}
          <div className="flex items-center gap-1.5 bg-[#0E0E10] border border-white/10 px-3 py-1 rounded-xl">
            <Filter size={11} className="text-text-muted" />
            <select
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
              className="bg-transparent border-none text-xs text-text-secondary py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todos Clientes</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 bg-[#0E0E10] border border-white/10 px-3 py-1 rounded-xl">
            <Filter size={11} className="text-text-muted" />
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="bg-transparent border-none text-xs text-text-secondary py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todas Prioridades</option>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>

          {/* Responsible Filter */}
          <div className="flex items-center gap-1.5 bg-[#0E0E10] border border-white/10 px-3 py-1 rounded-xl">
            <User size={11} className="text-text-muted" />
            <select
              value={filterResponsible}
              onChange={e => setFilterResponsible(e.target.value)}
              className="bg-transparent border-none text-xs text-text-secondary py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Qualquer Responsável</option>
              {responsiblesList.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Column Manager button */}
          {activeProcessId && (
            <button
              onClick={() => {
                setEditingColumn(null);
                setColumnNameField('');
                setIsColumnModalOpen(true);
              }}
              className="px-3.5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs text-white transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} />
              Nova Coluna
            </button>
          )}
        </div>
      </div>

      {/* KANBAN BOARD AREA */}
      {loading ? (
        <div className="py-24 text-center">
          <Clock className="mx-auto text-accent-mint animate-spin mb-3" size={32} />
          <p className="text-xs text-text-muted italic">Carregando painéis de trabalho...</p>
        </div>
      ) : columns.length === 0 ? (
        <div className="bg-white/[0.01] border border-white/[0.05] rounded-3xl p-16 text-center space-y-4">
          <Layers className="mx-auto text-text-muted" size={48} />
          <h3 className="text-lg font-semibold text-white">Nenhum fluxo selecionado ou configurado</h3>
          <p className="text-text-muted text-xs max-w-sm mx-auto">
            Por favor, selecione outro fluxo de trabalho ou clique em "Semear Fluxos Iniciais" para criar um Kanban completo agora mesmo.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleSeed}
              className="px-5 py-2.5 bg-accent-mint text-black font-bold text-xs rounded-xl hover:bg-accent-mint/90 transition-all cursor-pointer"
            >
              Criar Estrutura de Exemplo
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0">
          <div className="flex gap-4 min-w-[1200px] select-none">
            {columns.map(col => {
              const colTasks = tasksByColumn[col.id] || [];
              const isOver = dragOverColumnId === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={e => handleDragOverColumn(e, col.id)}
                  onDrop={e => handleDropTaskOnColumn(e, col.id)}
                  className={`w-80 rounded-2xl p-4 flex flex-col max-h-[70vh] bg-bg-elevated/20 border transition-all duration-200 ${
                    isOver 
                      ? 'border-accent-mint/30 bg-accent-mint/[0.02]' 
                      : 'border-white/[0.04] bg-bg-elevated/10'
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.05] mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-3 rounded bg-accent-mint" />
                      <h4 className="font-bold text-xs text-white truncate pr-1" title={col.name}>
                        {col.name}
                      </h4>
                      <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] font-mono text-text-muted shrink-0">
                        {colTasks.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleMoveColumn(col, 'left')}
                        className="p-1 text-text-muted hover:text-white transition-colors cursor-pointer"
                        title="Mover Coluna para Esquerda"
                      >
                        <ChevronRight className="rotate-180" size={13} />
                      </button>
                      <button
                        onClick={() => handleMoveColumn(col, 'right')}
                        className="p-1 text-text-muted hover:text-white transition-colors cursor-pointer"
                        title="Mover Coluna para Direita"
                      >
                        <ChevronRight size={13} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingColumn(col);
                          setColumnNameField(col.name);
                          setIsColumnModalOpen(true);
                        }}
                        className="p-1 text-text-muted hover:text-white transition-colors cursor-pointer"
                        title="Editar Coluna"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        onClick={() => handleDeleteColumn(col)}
                        className="p-1 text-text-muted hover:text-accent-coral transition-colors cursor-pointer"
                        title="Excluir Coluna"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Column Cards scroll list */}
                  <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 min-h-[150px]">
                    {colTasks.length === 0 ? (
                      <div className="py-12 border border-dashed border-white/5 rounded-2xl text-center text-[10px] text-text-muted italic">
                        Solte tarefas aqui
                      </div>
                    ) : (
                      colTasks.map(task => {
                        const isLate = task.dueDate && isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate)) && task.status !== 'DONE';
                        const checkPercent = getChecklistPercentage(task);

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={e => handleDragStartTask(e, task.id)}
                            onClick={() => {
                              setActiveTask(task);
                              setEditedDesc(task.description || '');
                              setIsDetailOpen(true);
                            }}
                            className={`group relative p-4 rounded-xl bg-white/[0.02] border hover:border-white/15 hover:bg-white/[0.04] transition-all cursor-grab active:cursor-grabbing text-left shadow-lg ${
                              isLate 
                                ? 'border-red-500/20 bg-red-500/[0.01]' 
                                : 'border-white/[0.06]'
                            }`}
                          >
                            {/* Card tags */}
                            <div className="flex items-center justify-between gap-2 pb-2">
                              <span className={`px-2 py-0.5 text-[8px] font-bold rounded-md uppercase tracking-wider border shrink-0 ${getPriorityClasses(task.priority)}`}>
                                {task.priority}
                              </span>
                              
                              {task.dueDate && (
                                <span className={`text-[9px] flex items-center gap-1 font-semibold ${isLate ? 'text-accent-coral font-bold animate-pulse' : 'text-text-muted'}`}>
                                  <Clock size={10} />
                                  {format(parseISO(task.dueDate), 'dd/MM')}
                                </span>
                              )}
                            </div>

                            {/* Client label if any */}
                            {task.clientName && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-mint">
                                {task.clientName}
                              </span>
                            )}

                            {/* Title */}
                            <h5 className="font-bold text-white text-xs mt-1.5 leading-snug truncate group-hover:text-accent-mint transition-colors">
                              {task.title}
                            </h5>

                            {/* Brief Description */}
                            {task.description && (
                              <p className="text-[11px] text-text-muted line-clamp-2 mt-1 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Checklist progression */}
                            {task.checklist && task.checklist.length > 0 && (
                              <div className="mt-3.5 space-y-1">
                                <div className="flex items-center justify-between text-[9px] text-text-muted">
                                  <span className="flex items-center gap-1 font-semibold">
                                    <CheckSquare size={9} />
                                    Checklist
                                  </span>
                                  <span className="font-mono">{checkPercent}%</span>
                                </div>
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-accent-mint transition-all" style={{ width: `${checkPercent}%` }} />
                                </div>
                              </div>
                            )}

                            {/* Card Footer info: responsible avatar, comments & attachments counts */}
                            <div className="flex items-center justify-between mt-3.5 pt-3.5 border-t border-white/[0.04]">
                              <div className="flex items-center gap-1 text-[10px] text-text-muted font-medium">
                                <User size={10} />
                                <span className="truncate max-w-[120px]">{task.responsible || 'Sem resp.'}</span>
                              </div>

                              <div className="flex items-center gap-2 text-[10px] text-text-muted">
                                {task.comments && task.comments.length > 0 && (
                                  <span className="flex items-center gap-0.5" title="Comentários">
                                    <MessageSquare size={10} />
                                    {task.comments.length}
                                  </span>
                                )}
                                {task.attachments && task.attachments.length > 0 && (
                                  <span className="flex items-center gap-0.5" title="Anexos">
                                    <Paperclip size={10} />
                                    {task.attachments.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL DRAWER / LATERAL PANEL */}
      <AnimatePresence>
        {isDetailOpen && activeTask && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl h-full bg-[#111112] border-l border-white/10 shadow-2xl flex flex-col text-left z-50"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center text-accent-mint">
                    <Layers size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent-mint">{activeTask.clientName || 'Geral'}</span>
                    <h3 className="font-bold text-white text-base leading-tight mt-0.5 pr-2">{activeTask.title}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasPermission('processos', 'deleteCards') && (
                    <button
                      onClick={() => handleDeleteTask(activeTask.id)}
                      className="p-2 text-text-muted hover:text-accent-coral hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                      title="Excluir Card"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className="p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scrollable Contents */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                
                {/* General Info Grid */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-text-muted tracking-wider">Responsável</label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                        {activeTask.responsible?.charAt(0).toUpperCase()}
                      </div>
                      <select
                        value={activeTask.responsible || ''}
                        onChange={e => handleUpdateTaskField({ responsible: e.target.value })}
                        className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 font-semibold cursor-pointer"
                      >
                        <option value="Gustavo Tráfego">Gustavo Tráfego</option>
                        <option value="Lucas Editor">Lucas Editor</option>
                        <option value="Ana Comercial">Ana Comercial</option>
                        <option value="Pedro Designer">Pedro Designer</option>
                        <option value="Mari Social Media">Mari Social Media</option>
                        <option value="Sem responsável">Sem responsável</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-text-muted tracking-wider">Prazo de Entrega</label>
                    <input
                      type="date"
                      value={activeTask.dueDate || ''}
                      onChange={e => handleUpdateTaskField({ dueDate: e.target.value })}
                      className="w-full bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 mt-1 font-semibold cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-text-muted tracking-wider">Prioridade</label>
                    <select
                      value={activeTask.priority}
                      onChange={e => handleUpdateTaskField({ priority: e.target.value as any })}
                      className="w-full bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 mt-1 font-semibold cursor-pointer"
                    >
                      <option value="LOW">Baixa</option>
                      <option value="MEDIUM">Média</option>
                      <option value="HIGH">Alta</option>
                      <option value="URGENT">Urgente</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-text-muted tracking-wider">Coluna Atual</label>
                    <select
                      value={activeTask.columnId}
                      onChange={e => handleUpdateTaskField({ columnId: e.target.value })}
                      className="w-full bg-transparent border-none text-xs text-accent-mint focus:outline-none focus:ring-0 mt-1 font-bold cursor-pointer"
                    >
                      {columns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description Textarea */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Descrição</span>
                    <button
                      onClick={() => {
                        if (descEditMode) {
                          handleUpdateTaskField({ description: editedDesc });
                        }
                        setDescEditMode(!descEditMode);
                      }}
                      className="text-xs text-accent-mint hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {descEditMode ? 'Salvar Descrição' : 'Editar'}
                    </button>
                  </div>

                  {descEditMode ? (
                    <textarea
                      rows={4}
                      value={editedDesc}
                      onChange={e => setEditedDesc(e.target.value)}
                      className="w-full bg-[#09090A] border border-white/10 focus:border-accent-mint/40 rounded-2xl p-4 text-xs text-white placeholder:text-text-muted outline-none transition-all resize-none"
                      placeholder="Adicione informações detalhadas sobre as demandas desta tarefa..."
                    />
                  ) : (
                    <div className="bg-[#09090A] border border-white/[0.05] rounded-2xl p-4 text-xs text-text-secondary leading-relaxed whitespace-pre-wrap min-h-[80px]">
                      {activeTask.description || <span className="text-text-muted italic">Nenhuma descrição fornecida. Adicione detalhes clicando em Editar.</span>}
                    </div>
                  )}
                </div>

                {/* Checklist widget */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-accent-mint" />
                    Lista de Atividades / Checklist ({getChecklistPercentage(activeTask)}%)
                  </span>

                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-mint transition-all duration-300" style={{ width: `${getChecklistPercentage(activeTask)}%` }} />
                  </div>

                  <div className="space-y-2.5">
                    {(activeTask.checklist || []).map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-3 bg-white/[0.01] hover:bg-white/[0.03] p-3 rounded-xl border border-white/[0.03] transition-all">
                        <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={e => handleToggleChecklist(item.id, e.target.checked)}
                            className="w-4.5 h-4.5 rounded border-white/15 bg-white/5 text-accent-mint focus:ring-accent-mint/30 cursor-pointer"
                          />
                          <span className={`text-xs truncate ${item.completed ? 'line-through text-text-muted' : 'text-white'}`}>{item.title}</span>
                        </label>
                        <button
                          onClick={() => handleRemoveChecklist(item.id)}
                          className="p-1 text-text-muted hover:text-accent-coral transition-colors cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Adicionar novo item de checklist..."
                      value={newChecklistText}
                      onChange={e => setNewChecklistText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddChecklist()}
                      className="flex-1 bg-[#09090A] border border-white/10 hover:border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-text-muted outline-none transition-all"
                    />
                    <button
                      onClick={handleAddChecklist}
                      className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* Attachments Section */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip size={14} className="text-blue-400" />
                    Arquivos Anexos e Links
                  </span>

                  <div className="space-y-2">
                    {(activeTask.attachments || []).map(att => (
                      <div key={att.id} className="flex items-center justify-between gap-3 bg-white/[0.01] hover:bg-white/[0.03] p-3 rounded-xl border border-white/[0.03] transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 text-blue-400 font-mono">
                            {att.type}
                          </span>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-white hover:text-accent-mint hover:underline font-semibold truncate"
                          >
                            {att.name}
                          </a>
                        </div>
                        <button
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="p-1 text-text-muted hover:text-accent-coral transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nome do arquivo ou link"
                        value={newAttachmentName}
                        onChange={e => setNewAttachmentName(e.target.value)}
                        className="bg-[#09090A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-text-muted outline-none"
                      />
                      <select
                        value={newAttachmentType}
                        onChange={e => setNewAttachmentType(e.target.value as any)}
                        className="bg-[#09090A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="LINK">Link Geral</option>
                        <option value="IMAGE">Imagem</option>
                        <option value="VIDEO">Vídeo (Drive/YT)</option>
                        <option value="PDF">PDF</option>
                        <option value="DOC">Documento</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="URL de destino (ex: https://drive.google.com/...)"
                        value={newAttachmentUrl}
                        onChange={e => setNewAttachmentUrl(e.target.value)}
                        className="flex-1 bg-[#09090A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-text-muted outline-none"
                      />
                      <button
                        onClick={handleAddAttachment}
                        className="px-4 py-2 bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Anexar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Internal Comments section */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-yellow-400" />
                    Comentários e Notas
                  </span>

                  <div className="space-y-3">
                    {(activeTask.comments || []).map(com => (
                      <div key={com.id} className="bg-[#09090A] border border-white/[0.04] p-3.5 rounded-2xl text-left space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-white">{com.userName}</span>
                          <span className="text-text-muted">{format(new Date(com.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">{com.content}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Adicione um comentário..."
                      value={newCommentText}
                      onChange={e => setNewCommentText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                      className="flex-1 bg-[#09090A] border border-white/10 hover:border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-text-muted outline-none transition-all"
                    />
                    <button
                      onClick={handleAddComment}
                      className="p-2.5 px-4 bg-accent-mint text-black font-bold rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Enviar
                    </button>
                  </div>
                </div>

                {/* History Activity logs */}
                <div className="space-y-3 pt-4 border-t border-white/[0.04]">
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Histórico de Atividades</span>
                  <div className="relative border-l border-white/[0.06] ml-2 pl-4 space-y-4 text-xs">
                    {(activeTask.history || []).map(h => (
                      <div key={h.id} className="relative">
                        <span className="absolute -left-[20.5px] top-1 w-2.5 h-2.5 rounded-full bg-white/10 border-2 border-[#111112]" />
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{h.action}</span>
                          <span className="text-[10px] text-text-muted">por {h.userName}</span>
                        </div>
                        {h.details && <p className="text-text-muted text-[10.5px] mt-0.5">{h.details}</p>}
                        <span className="text-[9px] text-text-muted block mt-0.5">{format(new Date(h.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                    ))}
                    {(activeTask.history || []).length === 0 && (
                      <p className="text-text-muted italic text-[11px]">Nenhum histórico registrado.</p>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE PROCESS BOARD */}
      <AnimatePresence>
        {isProcessModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsProcessModalOpen(false)} />
            <motion.form
              onSubmit={handleCreateProcess}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#141416] border border-white/10 rounded-3xl p-6 text-left space-y-4 shadow-2xl z-50"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h3 className="font-bold text-white text-base">Novo Processo Kanban</h3>
                <button type="button" onClick={() => setIsProcessModalOpen(false)} className="text-text-muted hover:text-white cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Nome do Processo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tráfego Pago, Gestão de Leads"
                  value={newProcessName}
                  onChange={e => setNewProcessName(e.target.value)}
                  className="w-full bg-[#0E0E10] border border-white/10 focus:border-accent-mint/30 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Descrição</label>
                <textarea
                  rows={2}
                  placeholder="Descreva o propósito deste fluxo operacional..."
                  value={newProcessDesc}
                  onChange={e => setNewProcessDesc(e.target.value)}
                  className="w-full bg-[#0E0E10] border border-white/10 focus:border-accent-mint/30 rounded-xl p-3.5 text-xs text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Cor de Destaque</label>
                  <input
                    type="color"
                    value={newProcessColor}
                    onChange={e => setNewProcessColor(e.target.value)}
                    className="w-full h-9 bg-transparent border border-white/10 rounded-xl cursor-pointer p-1"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Equipe</label>
                  <input
                    type="text"
                    value={newProcessTeam}
                    onChange={e => setNewProcessTeam(e.target.value)}
                    className="w-full bg-[#0E0E10] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-accent-mint text-black font-bold rounded-xl text-xs hover:bg-accent-mint/95 transition-all cursor-pointer"
              >
                Criar Fluxo de Trabalho
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE TASK CARD */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsTaskModalOpen(false)} />
            <motion.form
              onSubmit={handleSaveTask}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#141416] border border-white/10 rounded-3xl p-6 text-left space-y-4 shadow-2xl z-50"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h3 className="font-bold text-white text-base">Nova Tarefa / Card</h3>
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="text-text-muted hover:text-white cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Título do Card</label>
                <input
                  type="text"
                  required
                  placeholder="Nome curto da tarefa ou criativo..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-[#0E0E10] border border-white/10 focus:border-accent-mint/30 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Cliente Vinculado</label>
                  
                  {/* Reusable custom popover selector with search */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                      className="w-full bg-[#0E0E10] border border-white/10 hover:border-white/20 focus:border-accent-mint/30 rounded-xl px-3.5 py-2.5 text-xs text-white text-left flex items-center justify-between outline-none transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        {(() => {
                          const selected = clients.find(c => c.id === newClientId);
                          if (selected) {
                            return (
                              <>
                                <div 
                                  className="w-2 h-2 rounded-full shrink-0" 
                                  style={{ backgroundColor: selected.brandColor || '#8B5CF6' }}
                                />
                                <span>{selected.name}</span>
                              </>
                            );
                          }
                          return <span className="text-text-muted">Nenhum Cliente</span>;
                        })()}
                      </span>
                      <ChevronDown size={14} className="text-text-muted" />
                    </button>
                    
                    {isClientDropdownOpen && (
                      <>
                        {/* Click outside overlay */}
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => {
                            setIsClientDropdownOpen(false);
                            setClientFormSearchQuery('');
                          }} 
                        />
                        
                        {/* Dropdown panel */}
                        <div className="absolute left-0 right-0 mt-1 bg-[#141416] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-60 text-left">
                          <div className="p-2 border-b border-white/5 bg-[#0D0D0E] flex items-center gap-2">
                            <Search size={12} className="text-text-muted ml-2 shrink-0" />
                            <input
                              type="text"
                              placeholder="Buscar cliente..."
                              value={clientFormSearchQuery}
                              onChange={(e) => setClientFormSearchQuery(e.target.value)}
                              className="w-full bg-transparent border-none text-xs text-white outline-none py-1 placeholder:text-text-muted focus:ring-0 focus:outline-none"
                              autoFocus
                            />
                            {clientFormSearchQuery && (
                              <button 
                                type="button" 
                                onClick={() => setClientFormSearchQuery('')}
                                className="p-1 hover:bg-white/5 rounded text-text-muted hover:text-white"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>
                          <div className="overflow-y-auto flex-1 py-1 max-h-44">
                            <button
                              type="button"
                              onClick={() => {
                                setNewClientId('');
                                setIsClientDropdownOpen(false);
                                setClientFormSearchQuery('');
                              }}
                              className={`w-full text-left px-4 py-2.5 text-xs hover:bg-[#1E1E20] transition-colors ${!newClientId ? 'text-accent-mint font-semibold bg-accent-mint/5' : 'text-text-muted'}`}
                            >
                              Nenhum Cliente
                            </button>
                            {clients
                              .filter(c => c.name.toLowerCase().includes(clientFormSearchQuery.toLowerCase()))
                              .map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setNewClientId(c.id);
                                    setIsClientDropdownOpen(false);
                                    setClientFormSearchQuery('');
                                  }}
                                  className={`w-full text-left px-4 py-2.5 text-xs hover:bg-[#1E1E20] transition-all flex items-center gap-2 ${newClientId === c.id ? 'text-accent-mint font-semibold bg-accent-mint/5' : 'text-white'}`}
                                >
                                  <div 
                                    className="w-2 h-2 rounded-full shrink-0" 
                                    style={{ backgroundColor: c.brandColor || '#8B5CF6' }}
                                  />
                                  <span>{c.name}</span>
                                </button>
                              ))
                            }
                            {clients.filter(c => c.name.toLowerCase().includes(clientFormSearchQuery.toLowerCase())).length === 0 && (
                              <div className="px-4 py-3 text-xs text-text-muted text-center italic">
                                Nenhum cliente encontrado
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Etapa / Coluna</label>
                  <select
                    value={selectedColId}
                    onChange={e => setSelectedColId(e.target.value)}
                    className="w-full bg-[#0E0E10] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  >
                    {columns.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Prazo de Entrega</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="w-full bg-[#0E0E10] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Prioridade</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                    className="w-full bg-[#0E0E10] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Responsável</label>
                  <input
                    type="text"
                    placeholder="Ex: Lucas Editor, Mari"
                    value={newResp}
                    onChange={e => setNewResp(e.target.value)}
                    className="w-full bg-[#0E0E10] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Etiquetas (Separado por vírgula)</label>
                  <input
                    type="text"
                    placeholder="Ex: AD001, Reels, Campanha"
                    value={newLabels}
                    onChange={e => setNewLabels(e.target.value)}
                    className="w-full bg-[#0E0E10] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Instruções / Descrição</label>
                <textarea
                  rows={3}
                  placeholder="Detalhamento ou briefing para que o responsável realize a tarefa..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-[#0E0E10] border border-white/10 focus:border-accent-mint/30 rounded-xl p-3 text-xs text-white resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-accent-mint text-black font-bold rounded-xl text-xs hover:bg-accent-mint/95 transition-all cursor-pointer"
              >
                Publicar no Kanban
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE / EDIT COLUMN */}
      <AnimatePresence>
        {isColumnModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsColumnModalOpen(false)} />
            <motion.form
              onSubmit={handleSaveColumn}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#141416] border border-white/10 rounded-3xl p-6 text-left space-y-4 shadow-2xl z-50"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h3 className="font-bold text-white text-base">
                  {editingColumn ? 'Editar Coluna' : 'Nova Coluna Kanban'}
                </h3>
                <button type="button" onClick={() => setIsColumnModalOpen(false)} className="text-text-muted hover:text-white cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Nome da Coluna</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Roteiro, Captação, Edição, Concluído"
                  value={columnNameField}
                  onChange={e => setColumnNameField(e.target.value)}
                  className="w-full bg-[#0E0E10] border border-white/10 focus:border-accent-mint/30 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-accent-mint text-black font-bold rounded-xl text-xs hover:bg-accent-mint/95 transition-all cursor-pointer"
              >
                {editingColumn ? 'Salvar Alteração' : 'Criar Coluna'}
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: AUTOMATION CONFIG */}
      <AnimatePresence>
        {isAutomationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsAutomationModalOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#141416] border border-white/10 rounded-3xl p-6 text-left space-y-5 shadow-2xl z-50"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Zap className="text-yellow-400" />
                  Automações do Fluxo
                </h3>
                <button onClick={() => setIsAutomationModalOpen(false)} className="text-text-muted hover:text-white cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed">
                Configure gatilhos automatizados para otimizar os fluxos de trabalho. Ao mover os cards de coluna, regras pré-definidas serão executadas automaticamente.
              </p>

              <div className="space-y-3.5">
                <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-white">Notificar Responsável</span>
                    <p className="text-[11px] text-text-muted">Disparar alerta em tempo real para o colaborador associado ao mover card para revisão/aprovação.</p>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-black after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-mint" />
                  </div>
                </div>

                <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-white">Transição automática: Social Media</span>
                    <p className="text-[11px] text-text-muted">Ao aprovar um vídeo, criar automaticamente uma pauta no fluxo de Social Media.</p>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-black after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-mint" />
                  </div>
                </div>

                <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-white">Sincronizar Conclusão com Agenda</span>
                    <p className="text-[11px] text-text-muted">Marcar a entrega correspondente como realizada na aba de Demandas ao aprovar.</p>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-black after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-mint" />
                  </div>
                </div>

                <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl flex items-center justify-between gap-4 opacity-50">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-white">Alterar Status: Atrasado</span>
                    <p className="text-[11px] text-text-muted">Se ultrapassar a data limite, alterar status automaticamente e realçar cor no Kanban.</p>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" disabled className="sr-only peer" />
                    <div className="w-9 h-5 bg-white/10 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-black after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all" />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsAutomationModalOpen(false)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition-all cursor-pointer text-center"
                >
                  Fechar Configurações de Regras
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: PERMISSIONS */}
      <AnimatePresence>
        {isPermissionsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsPermissionsModalOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#141416] border border-white/10 rounded-3xl p-6 text-left space-y-4 shadow-2xl z-50"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Lock size={16} />
                  Controle de Permissões
                </h3>
                <button onClick={() => setIsPermissionsModalOpen(false)} className="text-text-muted hover:text-white cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed">
                Determine as ações permitidas para cada nível de acesso de colaborador na sua empresa:
              </p>

              <div className="space-y-3.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Criar e Excluir Processos</span>
                    <span className="text-[10px] text-text-muted">Apenas Administradores e Donos</span>
                  </div>
                  <span className="text-[9px] px-2 py-1 rounded bg-[#FF7A00]/10 text-[#FF7A00] font-bold uppercase">Restrito</span>
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Mover Cards (Colunas)</span>
                    <span className="text-[10px] text-text-muted">Qualquer colaborador associado ao card</span>
                  </div>
                  <span className="text-[9px] px-2 py-1 rounded bg-accent-mint/10 text-accent-mint font-bold uppercase">Liberado</span>
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Adicionar Checklist e Notas</span>
                    <span className="text-[10px] text-text-muted">Todos os membros com acesso ao fluxo</span>
                  </div>
                  <span className="text-[9px] px-2 py-1 rounded bg-accent-mint/10 text-accent-mint font-bold uppercase">Liberado</span>
                </div>
              </div>

              <button
                onClick={() => setIsPermissionsModalOpen(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Voltar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

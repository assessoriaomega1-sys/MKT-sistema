import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  collectionGroup
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Client, MetricEntry, UserSettings, Sale, CommercialGoal, MonthlyPayment, FinancialRelease, RecurringBill, FinancialGoal, Creative, Processo, ProcessColumn, ProcessTask, ProcessAutomation, UserProfile, UserRole, ActivityLog, Company } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function cleanData(data: any) {
  const clean = { ...data };
  Object.keys(clean).forEach(key => {
    if (clean[key] === undefined) {
      delete clean[key];
    } else if (typeof clean[key] === 'number' && isNaN(clean[key])) {
      clean[key] = 0;
    } else if (clean[key] !== null && typeof clean[key] === 'object' && !Array.isArray(clean[key])) {
      clean[key] = cleanData(clean[key]);
    }
  });
  return clean;
}

const CLIENTS_COL = 'clients';
const USERS_COL = 'users';
const SALES_COL = 'sales';
const GOALS_COL = 'goals';
const PAYMENTS_COL = 'payments';
const FINANCIAL_RELEASES_COL = 'financial_releases';
const RECURRING_BILLS_COL = 'recurring_bills';
const FINANCIAL_GOALS_COL = 'financial_goals';
const CREATIVES_COL = 'creatives';
const COMPANIES_COL = 'companies';

let currentActiveOwnerId: string | null = null;

export function setActiveOwnerId(id: string | null) {
  currentActiveOwnerId = id;
}

export function getActiveOwnerId(): string {
  return currentActiveOwnerId || auth.currentUser?.uid || '';
}

// ==========================================
// BIDIRECTIONAL SYNC BETWEEN DEMANDS & KANBAN TASKS
// ==========================================
let isSyncing = false;

async function getDefaultProcessAndColumn() {
  const userId = getActiveOwnerId();
  if (!userId) return { processoId: 'p-default', columnId: 'col-default' };
  
  try {
    const processesQuery = query(collection(db, 'processes'), where('ownerId', '==', userId));
    const processesSnap = await getDocs(processesQuery);
    let processoId = 'p-default';
    if (!processesSnap.empty) {
      processoId = processesSnap.docs[0].id;
    }
    
    const colsQuery = query(collection(db, 'process_columns'), where('ownerId', '==', userId), where('processoId', '==', processoId));
    const colsSnap = await getDocs(colsQuery);
    let columnId = 'col-default';
    if (!colsSnap.empty) {
      columnId = colsSnap.docs[0].id;
    }
    
    return { processoId, columnId };
  } catch (err) {
    console.error("Error getting default process and column:", err);
    return { processoId: 'p-default', columnId: 'col-default' };
  }
}

async function syncTaskWithClientDemand(task: ProcessTask) {
  if (isSyncing) return;
  if (!task.clientId || task.clientId === 'general' || task.clientId === 'Sem Cliente') return;
  
  isSyncing = true;
  try {
    const clientRef = doc(db, CLIENTS_COL, task.clientId);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) {
      isSyncing = false;
      return;
    }
    const client = { ...clientSnap.data(), id: clientSnap.id } as Client;
    let clientChanged = false;
    
    const isDone = task.status === 'DONE';
    const dueDateStr = task.dueDate || new Date().toISOString().split('T')[0];
    
    let foundEvent = false;
    
    // Check Content Plan
    if (client.contentPlan?.items) {
      const idx = client.contentPlan.items.findIndex(
        i => i.linkedTaskId === task.id || (task.linkedEventId && i.id === task.linkedEventId)
      );
      if (idx !== -1) {
        foundEvent = true;
        const item = { ...client.contentPlan.items[idx] };
        const isCurrentlyCompleted = item.recurrenceType && item.recurrenceType !== 'NONE'
          ? item.completedDates?.includes(dueDateStr)
          : item.status === 'POSTED';
          
        const targetCompleted = isDone;
        let itemChanged = false;
        
        if (item.title !== task.title) {
          item.title = task.title;
          itemChanged = true;
        }
        if (item.notes !== task.description) {
          item.notes = task.description || '';
          itemChanged = true;
        }
        if (item.targetDate !== dueDateStr) {
          item.targetDate = dueDateStr;
          itemChanged = true;
        }
        if (isCurrentlyCompleted !== targetCompleted) {
          if (item.recurrenceType && item.recurrenceType !== 'NONE') {
            const completedDates = item.completedDates || [];
            item.completedDates = targetCompleted
              ? [...completedDates, dueDateStr]
              : completedDates.filter(d => d !== dueDateStr);
          } else {
            item.status = targetCompleted ? 'POSTED' : 'PLANNED';
          }
          itemChanged = true;
        }
        if (!item.linkedTaskId) {
          item.linkedTaskId = task.id;
          itemChanged = true;
        }
        if (itemChanged) {
          client.contentPlan.items[idx] = item;
          clientChanged = true;
        }
      }
    }
    
    // Check Captures
    if (!foundEvent && client.captures) {
      const idx = client.captures.findIndex(
        i => i.linkedTaskId === task.id || (task.linkedEventId && i.id === task.linkedEventId)
      );
      if (idx !== -1) {
        foundEvent = true;
        const item = { ...client.captures[idx] };
        const isCurrentlyCompleted = item.status === 'DONE';
        const targetCompleted = isDone;
        let itemChanged = false;
        
        if (item.title !== task.title) {
          item.title = task.title;
          itemChanged = true;
        }
        if (item.notes !== task.description) {
          item.notes = task.description || '';
          itemChanged = true;
        }
        if (item.date !== dueDateStr) {
          item.date = dueDateStr;
          itemChanged = true;
        }
        if (isCurrentlyCompleted !== targetCompleted) {
          item.status = targetCompleted ? 'DONE' : 'PLANNED';
          itemChanged = true;
        }
        if (!item.linkedTaskId) {
          item.linkedTaskId = task.id;
          itemChanged = true;
        }
        if (itemChanged) {
          client.captures[idx] = item;
          clientChanged = true;
        }
      }
    }
    
    // Check Meetings
    if (!foundEvent && client.meetings) {
      const idx = client.meetings.findIndex(
        i => i.linkedTaskId === task.id || (task.linkedEventId && i.id === task.linkedEventId)
      );
      if (idx !== -1) {
        foundEvent = true;
        const item = { ...client.meetings[idx] };
        const isCurrentlyCompleted = item.status === 'DONE';
        const targetCompleted = isDone;
        let itemChanged = false;
        
        if (item.title !== task.title) {
          item.title = task.title;
          itemChanged = true;
        }
        if (item.notes !== task.description) {
          item.notes = task.description || '';
          itemChanged = true;
        }
        if (item.date !== dueDateStr) {
          item.date = dueDateStr;
          itemChanged = true;
        }
        if (isCurrentlyCompleted !== targetCompleted) {
          item.status = targetCompleted ? 'DONE' : 'PLANNED';
          itemChanged = true;
        }
        if (!item.linkedTaskId) {
          item.linkedTaskId = task.id;
          itemChanged = true;
        }
        if (itemChanged) {
          client.meetings[idx] = item;
          clientChanged = true;
        }
      }
    }
    
    // If not found, create as a new Content Plan item
    if (!foundEvent) {
      const eventId = task.linkedEventId || 'ev-' + Math.random().toString(36).substring(7);
      const newEvent = {
        id: eventId,
        targetDate: dueDateStr,
        title: task.title,
        notes: task.description || '',
        status: isDone ? 'POSTED' as const : 'PLANNED' as const,
        recurrenceType: 'NONE' as const,
        isRecurring: false,
        linkedTaskId: task.id
      };
      
      const currentContentPlan = client.contentPlan || { total: 0, items: [] };
      client.contentPlan = {
        ...currentContentPlan,
        items: [...(currentContentPlan.items || []), newEvent],
        total: (currentContentPlan.items || []).length + 1
      };
      clientChanged = true;
      
      // Update task itself with linkedEventId
      task.linkedEventId = eventId;
      task.linkedEventType = 'content';
      
      await setDoc(doc(db, 'process_tasks', task.id), cleanData({
        ...task,
        ownerId: auth.currentUser?.uid
      }), { merge: true });
    }
    
    if (clientChanged) {
      await setDoc(clientRef, cleanData({
        ...client,
        ownerId: auth.currentUser?.uid,
        updatedAt: new Date().toISOString()
      }), { merge: true });
    }
  } catch (error) {
    console.error("Error in syncTaskWithClientDemand:", error);
  } finally {
    isSyncing = false;
  }
}

async function syncClientDemandsWithTasks(client: Client) {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const defaultRef = await getDefaultProcessAndColumn();
    let clientChanged = false;
    
    const syncEvent = async (event: any, type: 'content' | 'capture' | 'meeting') => {
      const isRecurring = event.recurrenceType && event.recurrenceType !== 'NONE';
      const eventDate = type === 'content' ? event.targetDate : event.date;
      const isComplete = type === 'content'
        ? (isRecurring ? event.completedDates?.includes(eventDate) : event.status === 'POSTED')
        : (isRecurring ? event.completedDates?.includes(eventDate) : event.status === 'DONE');
        
      const taskStatus = isComplete ? 'DONE' as const : 'PENDING' as const;
      
      if (event.linkedTaskId) {
        // Task exists, let's update it
        const taskRef = doc(db, 'process_tasks', event.linkedTaskId);
        const taskSnap = await getDoc(taskRef);
        if (taskSnap.exists()) {
          const task = taskSnap.data() as ProcessTask;
          let taskChanged = false;
          
          if (task.title !== event.title) {
            task.title = event.title;
            taskChanged = true;
          }
          if (task.description !== event.notes) {
            task.description = event.notes || '';
            taskChanged = true;
          }
          if (task.dueDate !== eventDate) {
            task.dueDate = eventDate;
            taskChanged = true;
          }
          if (task.status !== taskStatus) {
            task.status = taskStatus;
            task.completedAt = isComplete ? new Date().toISOString() : undefined;
            taskChanged = true;
          }
          if (taskChanged) {
            await setDoc(taskRef, cleanData({
              ...task,
              ownerId: auth.currentUser?.uid
            }), { merge: true });
          }
        } else {
          // Task referenced but deleted/not found in Firestore, let's remove reference so we can recreate it or clean it up
          delete event.linkedTaskId;
          clientChanged = true;
        }
      } else {
        // Task does NOT exist, let's create a new one!
        const taskId = 'task-' + Math.random().toString(36).substring(7);
        const newTask: ProcessTask = {
          id: taskId,
          processoId: defaultRef.processoId,
          columnId: defaultRef.columnId,
          title: event.title || (type === 'content' ? 'Post de Conteúdo' : type === 'capture' ? 'Captação' : 'Reunião'),
          description: event.notes || '',
          clientId: client.id,
          clientName: client.name,
          responsible: 'Sem responsável',
          dueDate: eventDate,
          priority: 'MEDIUM',
          status: taskStatus,
          createdAt: new Date().toISOString(),
          checklist: [],
          comments: [],
          attachments: [],
          linkedEventId: event.id,
          linkedEventType: type,
          history: [
            {
              id: 'h-sync-' + Date.now(),
              action: 'Sincronização',
              details: `Tarefa criada automaticamente via planejamento de ${type === 'content' ? 'conteúdo' : type === 'capture' ? 'captação' : 'reunião'}.`,
              userName: 'Sistema',
              createdAt: new Date().toISOString()
            }
          ]
        };
        
        await setDoc(doc(db, 'process_tasks', taskId), cleanData({
          ...newTask,
          ownerId: auth.currentUser?.uid
        }), { merge: true });
        
        // Link the taskId inside the event
        event.linkedTaskId = taskId;
        clientChanged = true;
      }
    };
    
    // Sync Content Plan Items
    if (client.contentPlan?.items) {
      for (const item of client.contentPlan.items) {
        await syncEvent(item, 'content');
      }
    }
    
    // Sync Captures
    if (client.captures) {
      for (const item of client.captures) {
        await syncEvent(item, 'capture');
      }
    }
    
    // Sync Meetings
    if (client.meetings) {
      for (const item of client.meetings) {
        await syncEvent(item, 'meeting');
      }
    }
    
    // Sync task deletion: Delete tasks that are linked to events that no longer exist
    const tasksRef = collection(db, 'process_tasks');
    const qTasks = query(tasksRef, where('ownerId', '==', auth.currentUser?.uid), where('clientId', '==', client.id));
    const tasksSnap = await getDocs(qTasks);
    
    const currentEventIds = new Set<string>();
    client.contentPlan?.items?.forEach(i => currentEventIds.add(i.id));
    client.captures?.forEach(i => currentEventIds.add(i.id));
    client.meetings?.forEach(i => currentEventIds.add(i.id));
    
    for (const docOfTask of tasksSnap.docs) {
      const task = docOfTask.data() as ProcessTask;
      if (task.linkedEventId && !currentEventIds.has(task.linkedEventId)) {
        await deleteDoc(docOfTask.ref);
      }
    }
    
    if (clientChanged) {
      // Re-save client with the newly linked taskId(s)
      await setDoc(doc(db, 'clients', client.id), cleanData({
        ...client,
        ownerId: auth.currentUser?.uid,
        updatedAt: new Date().toISOString()
      }), { merge: true });
    }
  } catch (error) {
    console.error("Error in syncClientDemandsWithTasks:", error);
  } finally {
    isSyncing = false;
  }
}

async function syncDeletedTask(taskId: string) {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const taskRef = doc(db, 'process_tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) {
      isSyncing = false;
      return;
    }
    const task = taskSnap.data() as ProcessTask;
    if (!task.clientId || !task.linkedEventId) {
      isSyncing = false;
      return;
    }
    
    const clientRef = doc(db, CLIENTS_COL, task.clientId);
    const clientSnap = await getDoc(clientRef);
    if (clientSnap.exists()) {
      const client = clientSnap.data() as Client;
      let clientChanged = false;
      
      if (task.linkedEventType === 'content' && client.contentPlan?.items) {
        const originalLength = client.contentPlan.items.length;
        client.contentPlan.items = client.contentPlan.items.filter(i => i.id !== task.linkedEventId);
        if (client.contentPlan.items.length !== originalLength) {
          client.contentPlan.total = client.contentPlan.items.length;
          clientChanged = true;
        }
      } else if (task.linkedEventType === 'capture' && client.captures) {
        const originalLength = client.captures.length;
        client.captures = client.captures.filter(i => i.id !== task.linkedEventId);
        if (client.captures.length !== originalLength) {
          clientChanged = true;
        }
      } else if (task.linkedEventType === 'meeting' && client.meetings) {
        const originalLength = client.meetings.length;
        client.meetings = client.meetings.filter(i => i.id !== task.linkedEventId);
        if (client.meetings.length !== originalLength) {
          clientChanged = true;
        }
      }
      
      if (clientChanged) {
        await setDoc(clientRef, cleanData({
          ...client,
          ownerId: auth.currentUser?.uid,
          updatedAt: new Date().toISOString()
        }), { merge: true });
      }
    }
  } catch (error) {
    console.error("Error in syncDeletedTask:", error);
  } finally {
    isSyncing = false;
  }
}

async function syncCreativeWithTask(creative: Creative) {
  if (!creative.clientId) return;
  try {
    const defaultRef = await getDefaultProcessAndColumn();
    const dueDate = creative.publishDate || creative.creationDate || new Date().toISOString().split('T')[0];
    const isDone = creative.status === 'VALIDADO';
    const taskStatus = isDone ? 'DONE' as const : (creative.status === 'DESCARTADO' ? 'PENDING' as const : (creative.status === 'TESTE_CAMPANHA' ? 'PROGRESS' as const : 'PENDING' as const));
    
    // Check if task exists for this creative
    const tasksRef = collection(db, 'process_tasks');
    const qTasks = query(tasksRef, where('linkedEventId', '==', creative.id));
    const tasksSnap = await getDocs(qTasks);

    if (!tasksSnap.empty) {
      const docOfTask = tasksSnap.docs[0];
      const existingTask = docOfTask.data() as ProcessTask;
      await setDoc(docOfTask.ref, cleanData({
        ...existingTask,
        title: `[Criativo ${creative.code}] ${creative.title}`,
        description: `Formato: ${creative.type || 'REELS'}\nGancho: ${creative.hook || '-'}\nRoteiro: ${creative.script || '-'}\nVídeo: ${creative.videoUrl || 'Pendente'}\nStatus Criativo: ${creative.status}`,
        dueDate: dueDate,
        status: taskStatus,
        completedAt: isDone ? new Date().toISOString() : undefined,
        ownerId: auth.currentUser?.uid
      }), { merge: true });
    } else if (creative.syncWithClientCalendar !== false) {
      const taskId = 'task-cr-' + Math.random().toString(36).substring(7);
      const newTask: ProcessTask = {
        id: taskId,
        processoId: defaultRef.processoId,
        columnId: defaultRef.columnId,
        title: `[Criativo ${creative.code}] ${creative.title}`,
        description: `Formato: ${creative.type || 'REELS'}\nGancho: ${creative.hook || '-'}\nRoteiro: ${creative.script || '-'}\nVídeo: ${creative.videoUrl || 'Pendente'}\nStatus Criativo: ${creative.status}`,
        clientId: creative.clientId,
        clientName: creative.clientName,
        responsible: 'Tráfego / Criativos',
        dueDate: dueDate,
        priority: creative.isUrgent ? 'URGENT' : (creative.rating >= 4 ? 'HIGH' : 'MEDIUM'),
        status: taskStatus,
        createdAt: new Date().toISOString(),
        checklist: [],
        comments: [],
        attachments: creative.videoUrl ? [{
          id: 'att-' + Date.now(),
          name: `Vídeo ${creative.code}`,
          url: creative.videoUrl,
          type: 'VIDEO',
          createdAt: new Date().toISOString()
        }] : [],
        linkedEventId: creative.id,
        linkedEventType: 'creative' as any,
        history: [
          {
            id: 'h-cr-' + Date.now(),
            action: 'Sincronização Criativo',
            details: `Tarefa criada automaticamente a partir do Laboratório de Criativos (${creative.code}).`,
            userName: 'Laboratório de Tráfego',
            createdAt: new Date().toISOString()
          }
        ]
      };

      await setDoc(doc(db, 'process_tasks', taskId), cleanData({
        ...newTask,
        ownerId: auth.currentUser?.uid
      }), { merge: true });
    }
  } catch (error) {
    console.warn('Warning syncing creative with process task:', error);
  }
}


export const firebaseStorage = {
  // Payments
  getPayments: async (month: number, year: number): Promise<MonthlyPayment[]> => {
    if (!auth.currentUser) return [];
    const path = PAYMENTS_COL;
    try {
      const q = query(
        collection(db, path), 
        where('ownerId', '==', auth.currentUser.uid),
        where('month', '==', month),
        where('year', '==', year)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MonthlyPayment));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  savePayment: async (payment: MonthlyPayment) => {
    if (!auth.currentUser) return;
    const path = `${PAYMENTS_COL}/${payment.id}`;
    try {
      await setDoc(doc(db, PAYMENTS_COL, payment.id), cleanData({
        ...payment,
        ownerId: auth.currentUser.uid
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Sales
  getSales: async (monthYear?: string): Promise<Sale[]> => {
    if (!auth.currentUser) return [];
    const path = SALES_COL;
    try {
      let q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const salesList = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Sale));
      // Sort by date desc in memory to avoid composite index errors
      return salesList.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
    } catch (error) {
      console.error('Error in getSales:', error);
      return [];
    }
  },

  listenToSales: (callback: (sales: Sale[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = SALES_COL;
    const q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid));
    return onSnapshot(q, (snapshot) => {
      const salesList = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Sale));
      salesList.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      callback(salesList);
    }, (error) => {
      console.error('Error listening to sales:', error);
    });
  },

  saveSale: async (sale: Sale) => {
    if (!auth.currentUser) return;
    const path = `${SALES_COL}/${sale.id}`;
    try {
      await setDoc(doc(db, SALES_COL, sale.id), cleanData({
        ...sale,
        ownerId: auth.currentUser.uid
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteSale: async (id: string) => {
    const path = `${SALES_COL}/${id}`;
    try {
      await deleteDoc(doc(db, SALES_COL, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Goals
  getGoals: async (): Promise<CommercialGoal[]> => {
    if (!auth.currentUser) return [];
    const path = GOALS_COL;
    try {
      const q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as CommercialGoal));
    } catch (error) {
      console.error('Error in getGoals:', error);
      return [];
    }
  },

  listenToGoals: (callback: (goals: CommercialGoal[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = GOALS_COL;
    const q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid));
    return onSnapshot(q, (snapshot) => {
      const goals = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as CommercialGoal));
      callback(goals);
    }, (error) => {
      console.error('Error listening to goals:', error);
    });
  },

  saveGoal: async (goal: CommercialGoal) => {
    if (!auth.currentUser) return;
    const path = `${GOALS_COL}/${goal.id}`;
    try {
      await setDoc(doc(db, GOALS_COL, goal.id), cleanData({
        ...goal,
        ownerId: auth.currentUser.uid
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },
  // Clients
  getClient: async (id: string): Promise<Client | null> => {
    if (!auth.currentUser || !id) return null;
    const path = `${CLIENTS_COL}/${id}`;
    try {
      const docSnap = await getDoc(doc(db, CLIENTS_COL, id));
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as Client;
      }
      return null;
    } catch (error) {
      console.warn('Error in getClient direct fetch:', error);
      return null;
    }
  },

  listenToClient: (id: string, callback: (client: Client | null) => void) => {
    if (!auth.currentUser || !id) return () => {};
    try {
      return onSnapshot(doc(db, CLIENTS_COL, id), (docSnap) => {
        if (docSnap.exists()) {
          callback({ ...docSnap.data(), id: docSnap.id } as Client);
        } else {
          callback(null);
        }
      }, (error) => {
        console.warn('Error in listenToClient:', error);
        callback(null);
      });
    } catch (error) {
      console.warn('Error setting up listenToClient:', error);
      return () => {};
    }
  },

  getClients: async (): Promise<Client[]> => {
    if (!auth.currentUser) return [];
    const path = CLIENTS_COL;
    try {
      const activeOwner = getActiveOwnerId();
      const q = activeOwner 
        ? query(collection(db, path), where('ownerId', '==', activeOwner))
        : collection(db, path);
      const snapshot = await getDocs(q as any);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Client));
    } catch (error) {
      console.warn('Error in getClients with filter, falling back to direct collection:', error);
      try {
        const snapshot = await getDocs(collection(db, path));
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Client));
      } catch (fallbackError) {
        console.error('Error in getClients fallback:', fallbackError);
        return [];
      }
    }
  },

  saveClient: async (client: Client) => {
    if (!auth.currentUser) return;
    const path = `${CLIENTS_COL}/${client.id}`;
    try {
      await setDoc(doc(db, CLIENTS_COL, client.id), cleanData({
        ...client,
        ownerId: auth.currentUser.uid,
        updatedAt: new Date().toISOString()
      }), { merge: true });
      await syncClientDemandsWithTasks(client);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteClient: async (id: string) => {
    const path = `${CLIENTS_COL}/${id}`;
    try {
      await deleteDoc(doc(db, CLIENTS_COL, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  listenToClients: (callback: (clients: Client[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = CLIENTS_COL;
    try {
      const activeOwner = getActiveOwnerId();
      const q = activeOwner
        ? query(collection(db, path), where('ownerId', '==', activeOwner))
        : collection(db, path);
      return onSnapshot(q as any, (snapshot) => {
        const clients = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Client));
        callback(clients);
      }, (error) => {
        console.warn('Error in listenToClients with filter, falling back:', error);
        try {
          return onSnapshot(collection(db, path), (snapshot) => {
            const clients = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Client));
            callback(clients);
          });
        } catch (fbErr) {
          console.error('Fallback in listenToClients failed:', fbErr);
        }
      });
    } catch (error) {
      console.warn('Setup listenToClients failed:', error);
      return () => {};
    }
  },

  listenToAllEntries: (callback: (entries: MetricEntry[]) => void) => {
    if (!auth.currentUser) return () => {};
    const q = query(
      collectionGroup(db, 'entries'),
      where('ownerId', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MetricEntry));
      callback(entries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'collectionGroup:entries');
    });
  },

  // Entries
  getEntries: async (clientId: string): Promise<MetricEntry[]> => {
    if (!clientId) return [];
    const path = `${CLIENTS_COL}/${clientId}/entries`;
    try {
      const snapshot = await getDocs(collection(db, path));
      const entriesList = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MetricEntry));
      // Sort by date asc in memory to avoid composite index errors
      return entriesList.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateA.localeCompare(dateB);
      });
    } catch (error) {
      console.warn('Error in getEntries for clientId:', clientId, error);
      return [];
    }
  },

  saveEntry: async (entry: MetricEntry) => {
    if (!auth.currentUser) return;
    const path = `${CLIENTS_COL}/${entry.clientId}/entries/${entry.id}`;
    try {
      await setDoc(doc(db, CLIENTS_COL, entry.clientId, 'entries', entry.id), cleanData({
        ...entry,
        ownerId: auth.currentUser.uid
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteEntry: async (clientId: string, entryId: string) => {
    const path = `${CLIENTS_COL}/${clientId}/entries/${entryId}`;
    try {
      await deleteDoc(doc(db, CLIENTS_COL, clientId, 'entries', entryId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Settings
  getSettings: async (): Promise<UserSettings> => {
    if (!auth.currentUser) return { managerName: 'Gestor MKT', agencyName: 'MKT', theme: 'light' };
    const path = `${USERS_COL}/${auth.currentUser.uid}`;
    try {
      const d = await getDoc(doc(db, USERS_COL, auth.currentUser.uid));
      if (d.exists()) {
        const data = d.data() as UserSettings;
        return {
          ...data,
          agencyName: data.agencyName || 'MKT',
          managerName: data.managerName || 'Gestor'
        };
      }
      return { managerName: 'Gestor MKT', agencyName: 'MKT', theme: 'light' };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return { managerName: 'Gestor MKT', agencyName: 'MKT', theme: 'light' };
    }
  },

  saveSettings: async (settings: UserSettings) => {
    if (!auth.currentUser) return;
    const path = `${USERS_COL}/${auth.currentUser.uid}`;
    try {
      await setDoc(doc(db, USERS_COL, auth.currentUser.uid), cleanData(settings), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // FOLHA - Financial Releases (Lançamentos Financeiros)
  getFinancialReleases: async (): Promise<FinancialRelease[]> => {
    if (!auth.currentUser) return [];
    const path = FINANCIAL_RELEASES_COL;
    try {
      const q = query(
        collection(db, path),
        where('ownerId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const releases = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as FinancialRelease));
      releases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return releases;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  saveFinancialRelease: async (release: FinancialRelease) => {
    if (!auth.currentUser) return;
    const path = `${FINANCIAL_RELEASES_COL}/${release.id}`;
    try {
      await setDoc(doc(db, FINANCIAL_RELEASES_COL, release.id), cleanData({
        ...release,
        ownerId: auth.currentUser.uid
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteFinancialRelease: async (id: string) => {
    const path = `${FINANCIAL_RELEASES_COL}/${id}`;
    try {
      await deleteDoc(doc(db, FINANCIAL_RELEASES_COL, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // FOLHA - Recurring Bills (Contas Recorrentes)
  getRecurringBills: async (): Promise<RecurringBill[]> => {
    if (!auth.currentUser) return [];
    const path = RECURRING_BILLS_COL;
    try {
      const q = query(
        collection(db, path),
        where('ownerId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as RecurringBill));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  saveRecurringBill: async (bill: RecurringBill) => {
    if (!auth.currentUser) return;
    const path = `${RECURRING_BILLS_COL}/${bill.id}`;
    try {
      await setDoc(doc(db, RECURRING_BILLS_COL, bill.id), cleanData({
        ...bill,
        ownerId: auth.currentUser.uid
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteRecurringBill: async (id: string) => {
    const path = `${RECURRING_BILLS_COL}/${id}`;
    try {
      await deleteDoc(doc(db, RECURRING_BILLS_COL, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // FOLHA - Financial Goals (Metas Financeiras)
  getFinancialGoals: async (): Promise<FinancialGoal[]> => {
    if (!auth.currentUser) return [];
    const path = FINANCIAL_GOALS_COL;
    try {
      const q = query(
        collection(db, path),
        where('ownerId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as FinancialGoal));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  saveFinancialGoal: async (goal: FinancialGoal) => {
    if (!auth.currentUser) return;
    const path = `${FINANCIAL_GOALS_COL}/${goal.id}`;
    try {
      await setDoc(doc(db, FINANCIAL_GOALS_COL, goal.id), cleanData({
        ...goal,
        ownerId: auth.currentUser.uid
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // CREATIVES Section (Banco de Criativos)
  getCreatives: async (): Promise<Creative[]> => {
    if (!auth.currentUser) return [];
    const path = CREATIVES_COL;
    try {
      const q = query(
        collection(db, path),
        where('ownerId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Creative));
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  saveCreative: async (creative: Creative) => {
    if (!auth.currentUser) return;
    const path = `${CREATIVES_COL}/${creative.id}`;
    try {
      await setDoc(doc(db, CREATIVES_COL, creative.id), cleanData({
        ...creative,
        ownerId: auth.currentUser.uid
      }), { merge: true });
      await syncCreativeWithTask(creative);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteCreative: async (id: string) => {
    const path = `${CREATIVES_COL}/${id}`;
    try {
      await deleteDoc(doc(db, CREATIVES_COL, id));
      // Also delete any linked process task
      try {
        const qTasks = query(collection(db, 'process_tasks'), where('linkedEventId', '==', id));
        const tasksSnap = await getDocs(qTasks);
        for (const tDoc of tasksSnap.docs) {
          await deleteDoc(tDoc.ref);
        }
      } catch (tErr) {
        console.warn('Error cleaning up linked task for creative:', tErr);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  listenToCreatives: (callback: (creatives: Creative[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = CREATIVES_COL;
    try {
      const activeOwner = getActiveOwnerId();
      const q = activeOwner
        ? query(collection(db, path), where('ownerId', '==', activeOwner))
        : collection(db, path);
      return onSnapshot(q as any, (snapshot) => {
        const creatives = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Creative));
        callback(creatives);
      }, (error) => {
        console.warn('Error in listenToCreatives with ownerId, trying general collection:', error);
        try {
          return onSnapshot(collection(db, path), (snap) => {
            const creatives = snap.docs.map(d => ({ ...d.data(), id: d.id } as Creative));
            callback(creatives);
          });
        } catch (fbErr) {
          console.error('Fallback listenToCreatives failed:', fbErr);
        }
      });
    } catch (error) {
      console.warn('Setup listenToCreatives failed:', error);
      return () => {};
    }
  },

  // PROCESSES
  getProcesses: async (): Promise<Processo[]> => {
    if (!auth.currentUser) return [];
    const path = 'processes';
    try {
      const q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Processo));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  saveProcess: async (process: Processo) => {
    if (!auth.currentUser) return;
    const path = `processes/${process.id}`;
    try {
      await setDoc(doc(db, 'processes', process.id), cleanData({
        ...process,
        ownerId: auth.currentUser.uid
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteProcess: async (id: string) => {
    const path = `processes/${id}`;
    try {
      await deleteDoc(doc(db, 'processes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  listenToProcesses: (callback: (processes: Processo[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'processes';
    const q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Processo));
      callback(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // COLUMNS
  getColumns: async (processoId?: string): Promise<ProcessColumn[]> => {
    if (!auth.currentUser) return [];
    const path = 'process_columns';
    try {
      const q = collection(db, path);
      const firebaseQuery = query(
        q,
        where('ownerId', '==', auth.currentUser.uid),
        where('processoId', '==', processoId)
      );
      const snapshot = await getDocs(firebaseQuery);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProcessColumn)).sort((a, b) => a.order - b.order);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  saveColumn: async (col: ProcessColumn) => {
    if (!auth.currentUser) return;
    const path = `process_columns/${col.id}`;
    try {
      await setDoc(doc(db, 'process_columns', col.id), cleanData({
        ...col,
        ownerId: auth.currentUser.uid
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteColumn: async (id: string) => {
    const path = `process_columns/${id}`;
    try {
      await deleteDoc(doc(db, 'process_columns', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  listenToColumns: (processoId: string, callback: (cols: ProcessColumn[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'process_columns';
    const q = query(
      collection(db, path),
      where('ownerId', '==', auth.currentUser.uid),
      where('processoId', '==', processoId)
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProcessColumn)).sort((a, b) => a.order - b.order);
      callback(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // TASKS
  getTasks: async (processoId?: string): Promise<ProcessTask[]> => {
    if (!auth.currentUser) return [];
    const path = 'process_tasks';
    try {
      let q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid));
      if (processoId) {
        q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid), where('processoId', '==', processoId));
      }
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProcessTask));
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  saveTask: async (task: ProcessTask) => {
    if (!auth.currentUser) return;
    const path = `process_tasks/${task.id}`;
    try {
      await setDoc(doc(db, 'process_tasks', task.id), cleanData({
        ...task,
        ownerId: auth.currentUser.uid
      }), { merge: true });
      await syncTaskWithClientDemand(task);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteTask: async (id: string) => {
    const path = `process_tasks/${id}`;
    try {
      await syncDeletedTask(id);
      await deleteDoc(doc(db, 'process_tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  listenToTasks: (processoId: string, callback: (tasks: ProcessTask[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'process_tasks';
    const q = query(
      collection(db, path), 
      where('ownerId', '==', auth.currentUser.uid), 
      where('processoId', '==', processoId)
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProcessTask));
      callback(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  listenToAllTasks: (callback: (tasks: ProcessTask[]) => void) => {
    if (!auth.currentUser) return () => {};
    const path = 'process_tasks';
    const q = query(
      collection(db, path), 
      where('ownerId', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProcessTask));
      callback(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // AUTOMATIONS
  getAutomations: async (processoId: string): Promise<ProcessAutomation[]> => {
    if (!auth.currentUser) return [];
    const path = 'process_automations';
    try {
      const q = query(
        collection(db, path),
        where('ownerId', '==', auth.currentUser.uid),
        where('processoId', '==', processoId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProcessAutomation));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  saveAutomation: async (auto: ProcessAutomation) => {
    if (!auth.currentUser) return;
    const path = `process_automations/${auto.id}`;
    try {
      await setDoc(doc(db, 'process_automations', auto.id), cleanData({
        ...auto,
        ownerId: auth.currentUser.uid
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteAutomation: async (id: string) => {
    const path = `process_automations/${id}`;
    try {
      await deleteDoc(doc(db, 'process_automations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // USERS MODULE
  getAllUsers: async (): Promise<UserProfile[]> => {
    const path = 'users';
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const all = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as UserProfile));
      const currentUid = auth.currentUser?.uid;
      const isMaster = auth.currentUser?.email === 'assessoriaomega1@gmail.com';
      if (isMaster) return all;
      return all.filter(u => u.id === currentUid || u.ownerId === currentUid);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  getUserProfile: async (userId: string): Promise<UserProfile | null> => {
    const path = `users/${userId}`;
    try {
      const d = await getDoc(doc(db, 'users', userId));
      if (d.exists()) {
        return { ...d.data(), id: d.id } as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  saveUserProfile: async (profile: UserProfile) => {
    const path = `users/${profile.id}`;
    try {
      const currentUid = auth.currentUser?.uid;
      const dataToSave = {
        ...profile,
        // Mark ownerId if it's a collaborator created by this owner
        ownerId: profile.ownerId || (profile.id === currentUid ? undefined : currentUid)
      };
      await setDoc(doc(db, 'users', profile.id), cleanData(dataToSave), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteUserProfile: async (id: string) => {
    const path = `users/${id}`;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  listenToUsers: (callback: (users: UserProfile[]) => void) => {
    const path = 'users';
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      const all = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as UserProfile));
      const currentUid = auth.currentUser?.uid;
      const isMaster = auth.currentUser?.email === 'assessoriaomega1@gmail.com';
      const filtered = isMaster ? all : all.filter(u => u.id === currentUid || u.ownerId === currentUid);
      callback(filtered);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // ROLES
  getRoles: async (): Promise<UserRole[]> => {
    const path = 'roles';
    try {
      const snapshot = await getDocs(collection(db, 'roles'));
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as UserRole));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  saveRole: async (role: UserRole) => {
    const path = `roles/${role.id}`;
    try {
      await setDoc(doc(db, 'roles', role.id), cleanData(role), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  deleteRole: async (id: string) => {
    const path = `roles/${id}`;
    try {
      await deleteDoc(doc(db, 'roles', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  listenToRoles: (callback: (roles: UserRole[]) => void) => {
    const path = 'roles';
    return onSnapshot(collection(db, 'roles'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as UserRole));
      callback(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // ACTIVITY LOGS
  getActivityLogs: async (): Promise<ActivityLog[]> => {
    const path = 'activity_logs';
    try {
      const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ActivityLog));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  saveActivityLog: async (log: ActivityLog) => {
    const path = `activity_logs/${log.id}`;
    try {
      await setDoc(doc(db, 'activity_logs', log.id), cleanData(log));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  listenToActivityLogs: (callback: (logs: ActivityLog[]) => void) => {
    const path = 'activity_logs';
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ActivityLog));
      callback(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // COMPANIES & ACCESS CODES
  getCompanyByAccessCode: async (code: string): Promise<Company | null> => {
    if (!code || !code.trim()) return null;
    const rawTrimmed = code.trim();
    const cleanUpper = rawTrimmed.toUpperCase();
    const cleanNoDashes = cleanUpper.replace(/[\s\-_]/g, '');

    // Set of candidate code variations
    const candidates = new Set<string>();
    candidates.add(rawTrimmed);
    candidates.add(cleanUpper);
    candidates.add(cleanNoDashes);
    if (!cleanUpper.startsWith('EMP')) {
      candidates.add(`EMP-${cleanUpper}`);
      candidates.add(`EMP${cleanUpper}`);
      candidates.add(`EMP-${cleanNoDashes}`);
    }
    if (cleanUpper.startsWith('EMP-')) {
      candidates.add(cleanUpper.replace('EMP-', ''));
    }
    if (cleanUpper.startsWith('EMP')) {
      const stripped = cleanUpper.replace(/^EMP[-_]?/, '');
      if (stripped) {
        candidates.add(stripped);
        candidates.add(`EMP-${stripped}`);
      }
    }

    try {
      // 1. Direct candidate queries on companies collection
      for (const cand of candidates) {
        try {
          const q = query(collection(db, COMPANIES_COL), where('accessCode', '==', cand));
          const snap = await getDocs(q);
          if (!snap.empty) {
            return { ...snap.docs[0].data(), id: snap.docs[0].id } as Company;
          }
        } catch (e) {
          // ignore individual query failures
        }
      }

      // 1b. Search by ownerEmail in companies collection (in case user pasted owner's email)
      if (rawTrimmed.includes('@')) {
        try {
          const qEmail = query(collection(db, COMPANIES_COL), where('ownerEmail', '==', rawTrimmed.toLowerCase()));
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
            return { ...snapEmail.docs[0].data(), id: snapEmail.docs[0].id } as Company;
          }
        } catch (e) {}
      }

      // 1c. Scan all companies in memory (case-insensitive & whitespace tolerant)
      try {
        const allCompaniesSnap = await getDocs(collection(db, COMPANIES_COL));
        for (const docSnap of allCompaniesSnap.docs) {
          const cData = docSnap.data() as Company;
          const storedCode = (cData.accessCode || '').trim().toUpperCase();
          const storedClean = storedCode.replace(/[\s\-_]/g, '');
          const storedEmail = (cData.ownerEmail || '').trim().toLowerCase();
          const storedName = (cData.companyName || '').trim().toLowerCase();

          for (const cand of candidates) {
            if (
              storedCode === cand || 
              storedClean === cand.replace(/[\s\-_]/g, '') ||
              (cand.includes('@') && storedEmail === cand.toLowerCase()) ||
              (cand.length >= 3 && storedName === cand.toLowerCase())
            ) {
              return { ...cData, id: docSnap.id };
            }
          }
        }
      } catch (scanErr) {
        // Ignore if permission denied
      }

      // 2. Fallback: Search in users collection where companyAccessCode or email matches
      try {
        for (const cand of candidates) {
          try {
            const qUser = query(collection(db, USERS_COL), where('companyAccessCode', '==', cand));
            const snapUser = await getDocs(qUser);
            if (!snapUser.empty) {
              const u = snapUser.docs[0].data() as UserProfile;
              const companyRec: Company = {
                id: snapUser.docs[0].id,
                companyName: u.agencyName || 'Empresa',
                ownerUid: snapUser.docs[0].id,
                ownerEmail: u.email || '',
                accessCode: u.companyAccessCode || cand,
                createdAt: u.createdAt || new Date().toISOString()
              };
              // Auto-repair companies collection in background
              try {
                await setDoc(doc(db, COMPANIES_COL, companyRec.id), companyRec, { merge: true });
              } catch (saveErr) {}
              return companyRec;
            }
          } catch (e) {}
        }

        // 2b. Check by email in users collection
        if (rawTrimmed.includes('@')) {
          try {
            const qUserEmail = query(collection(db, USERS_COL), where('email', '==', rawTrimmed.toLowerCase()));
            const snapUserEmail = await getDocs(qUserEmail);
            if (!snapUserEmail.empty) {
              const u = snapUserEmail.docs[0].data() as UserProfile;
              const companyRec: Company = {
                id: snapUserEmail.docs[0].id,
                companyName: u.agencyName || 'Empresa',
                ownerUid: snapUserEmail.docs[0].id,
                ownerEmail: u.email || '',
                accessCode: u.companyAccessCode || `EMP-${snapUserEmail.docs[0].id.slice(0, 4).toUpperCase()}`,
                createdAt: u.createdAt || new Date().toISOString()
              };
              try {
                await setDoc(doc(db, COMPANIES_COL, companyRec.id), companyRec, { merge: true });
              } catch (saveErr) {}
              return companyRec;
            }
          } catch (e) {}
        }
      } catch (userErr) {
        // May fail if not signed in yet
      }

      return null;
    } catch (error) {
      console.error('Error finding company by access code:', error);
      return null;
    }
  },

  getCompany: async (companyId: string): Promise<Company | null> => {
    try {
      const snap = await getDoc(doc(db, COMPANIES_COL, companyId));
      if (snap.exists()) {
        return { ...snap.data(), id: snap.id } as Company;
      }
      return null;
    } catch (error) {
      console.error('Error getting company:', error);
      return null;
    }
  },

  saveCompany: async (company: Company) => {
    const path = `${COMPANIES_COL}/${company.id}`;
    try {
      await setDoc(doc(db, COMPANIES_COL, company.id), cleanData({
        ...company,
        accessCode: company.accessCode.trim().toUpperCase(),
        updatedAt: new Date().toISOString()
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
};


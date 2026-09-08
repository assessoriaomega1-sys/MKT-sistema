/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BusinessType = 'SERVICE_BOOKING' | 'ECOMMERCE' | 'B2B_LEADS' | 'WHATSAPP' | 'REAL_ESTATE' | 'INFO_PRODUCTS' | 'LOCAL_BUSINESS' | 'VIDEO_PRODUCTION' | 'CONTENT_EDITING' | 'LAUNCH';

export type BillingModel = 'RECURRING' | 'ONE_OFF';

export type StatusHealth = 'GOOD' | 'WARNING' | 'CRITICAL';

export type ManagementFlag = 'GREEN' | 'YELLOW' | 'RED';

export interface SmartGoal {
  currentRevenue: number;
  targetRevenue: number;
  durationMonths: number;
  adSpend: number;
  funnelSteps: {
    name: string;
    rate: number;
  }[];
  ticket: number;
}

export interface FunnelStep {
  id: string;
  label: string;
}

export interface AccessCredential {
  id: string;
  platform: string;
  login: string;
  password?: string;
  url?: string;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  accountManager?: string;
  logo?: string;
  brandColor: string;
  businessType: BusinessType;
  smartGoal: SmartGoal;
  channels: string[];
  createdAt: string;
  customFunnelSteps?: FunnelStep[];
  accessInfo?: AccessCredential[];
  // Management fields
  ownerNames?: string;
  planValue?: number;
  planScope?: string;
  contactInfo?: string;
  contractUrl?: string;
  managementStatus?: ManagementFlag;
  billingModel?: BillingModel;
  performanceMode?: 'LEADS' | 'SALES';
  strategyUrl?: string;
  contentPlan?: {
    total: number;
    items: {
      id: string;
      targetDate: string;
      title?: string;
      status: 'PLANNED' | 'POSTED';
      notes?: string;
      isRecurring?: boolean;
      recurringDays?: number[];
      recurrenceType?: 'DAILY' | 'WEEKLY' | 'MONTHLY_DAY' | 'MONTHLY_ORDINAL' | 'NONE';
      ordinalWeekday?: { ordinal: number; day: number };
      completedDates?: string[];
      deletedDates?: string[];
      linkedTaskId?: string;
    }[];
  };
  captures?: {
    id: string;
    date: string;
    title: string;
    status: 'PLANNED' | 'DONE';
    isRecurring?: boolean;
    recurringDays?: number[];
    recurrenceType?: 'DAILY' | 'WEEKLY' | 'MONTHLY_DAY' | 'MONTHLY_ORDINAL' | 'NONE';
    ordinalWeekday?: { ordinal: number; day: number };
    completedDates?: string[];
    deletedDates?: string[];
    notes?: string;
    linkedTaskId?: string;
  }[];
  meetings?: {
    id: string;
    date: string;
    title: string;
    status: 'PLANNED' | 'DONE';
    isRecurring?: boolean;
    recurringDays?: number[];
    recurrenceType?: 'DAILY' | 'WEEKLY' | 'MONTHLY_DAY' | 'MONTHLY_ORDINAL' | 'NONE';
    ordinalWeekday?: { ordinal: number; day: number };
    completedDates?: string[];
    deletedDates?: string[];
    notes?: string;
    linkedTaskId?: string;
  }[];
}

export interface MetricEntry {
  id: string;
  clientId: string;
  date: string; // ISO String (start or exact day)
  endDate?: string; // For date ranges
  
  // Input fields (common)
  investment: number;
  revenue?: number;
  profit?: number;
  leads?: number;
  sales?: number;
  clicks?: number;
  alcance?: number;
  conversions?: number;
  cpm?: number;
  
  // Specific to SERVICE_BOOKING
  bookings?: number;
  shows?: number;
  cac?: number;

  // Specific to ECOMMERCE
  sessions?: number;
  addCart?: number;
  checkouts?: number;
  purchases?: number;

  // Specific to B2B_LEADS
  mqls?: number;
  meetings?: number;
  proposals?: number;

  // Specific to WHATSAPP
  waClicks?: number;
  waConversations?: number;
  qualifiedLeads?: number;
  // Specific to creative types
  delivered?: number;
  projects?: number;
  raw?: number;
  customData?: Record<string, number>;
}

export interface CalculatedMetrics {
  roas: number;
  cac: number;
  ticket: number;
  conversion: number;
  profit?: number;
  roi?: number;
  delivered?: number;
  projects?: number;
  leads?: number;
  sales?: number;
  // Specifics
  cpl?: number;
  cpc?: number;
  cpm?: number;
  clicks?: number;
  ctr?: number;
  bookingRate?: number;
  showRate?: number;
  closeRate?: number;
  mqlRate?: number;
  waResponseRate?: number;
  abandonRate?: number;
  customRates?: Record<string, number>;
}

export interface UserSettings {
  managerName: string;
  agencyName?: string; // Nome da Empresa / Negócio
  companyRole?: string; // Cargo do usuário na empresa (Empresário, Dono, Diretor, Gestor)
  businessSector?: string; // Segmento / Nicho da empresa
  companyPhone?: string;
  companySetupCompleted?: boolean;
  theme: 'light' | 'dark';
  trafficPanelUrl?: string;
  monthlyGoal?: number;
  executiveConfig?: any;
  companyAccessCode?: string; // Código de acesso criado pelo dono da empresa
}

export interface Company {
  id: string; // ID da empresa (geralmente igual ao UID do dono)
  companyName: string;
  ownerUid: string;
  ownerEmail?: string;
  accessCode: string; // Código exclusivo que o dono cria para os colaboradores entrarem
  createdAt: string;
  updatedAt?: string;
}

export interface Sale {
  id: string;
  clientId: string;
  clientName: string;
  service: string;
  value: number;
  date: string; // ISO Date
  status: 'PAID' | 'PENDING';
  origin: string; // Instagram, Indication, etc.
  billingModel?: BillingModel;
  ownerId?: string;
}

export interface CommercialGoal {
  id: string; // e.g. "2026-05"
  month: number;
  year: number;
  target: number;
  ownerId?: string;
  notes?: string;
}

export interface CommercialMetrics {
  totalRevenue: number;
  target: number;
  salesCount: number;
  averageTicket: number;
  monthYear: string; // "MM/YYYY"
}

export interface MonthlyPayment {
  id: string; // "YYYY-MM-clientId"
  clientId: string;
  month: number;
  year: number;
  status: 'PAID' | 'PENDING';
  value: number;
  paidAt?: string;
  ownerId?: string;
}

export type FinancialReleaseType = 'RECEITA' | 'GASTO' | 'INVESTIMENTO';

export type FinancialReleaseCategory =
  | 'Tráfego Pago'
  | 'Freelancer'
  | 'Ferramentas'
  | 'Software'
  | 'Assinaturas'
  | 'Equipamentos'
  | 'Marketing'
  | 'Combustível'
  | 'Alimentação'
  | 'Escritório'
  | 'Impostos'
  | 'Outros';

export interface FinancialRelease {
  id: string;
  date: string;
  description: string;
  category: FinancialReleaseCategory;
  type: FinancialReleaseType;
  value: number;
  observation?: string;
  ownerId?: string;
  createdAt?: string;
}

export interface RecurringBill {
  id: string;
  description: string;
  value: number;
  dueDay: number;
  ownerId?: string;
}

export interface FinancialGoal {
  id: string;
  target: number;
  month: number;
  year: number;
  ownerId?: string;
}

export type CreativeStatus = 'IDEIA' | 'PRODUZIDO' | 'EDITADO' | 'TESTE_CAMPANHA' | 'VALIDADO' | 'DESCARTADO';

export interface Creative {
  id: string;
  code: string; // AD001, AD002, etc.
  title: string;
  status: CreativeStatus;
  type: string;
  objective: string;
  creationDate: string; // YYYY-MM-DD
  publishDate?: string; // YYYY-MM-DD (optional)
  validationDate?: string; // YYYY-MM-DD (optional)
  rating: number; // 1-5 stars
  validationReason?: string; // Motivo da validação
  script?: string; // Roteiro (large text)
  observations?: string; // Observações
  learnings?: string; // Aprendizados (large text)
  videoUrl?: string; // Link para o vídeo gravado/editado (Google Drive, Youtube, etc)
  isUrgent?: boolean; // Urgência do criativo no laboratório
  clientId?: string; // ID do Cliente associado
  clientName?: string; // Nome do Cliente
  priorityOrder?: number; // Ordem de prioridade para drag-and-drop
  ownerId?: string;
  syncWithClientCalendar?: boolean; // Sincronizar com calendário do cliente
  syncWithGeneralCalendar?: boolean; // Sincronizar com calendário geral de demandas
}

export interface Processo {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  teamResponsible?: string[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  ownerId?: string;
}

export interface ProcessColumn {
  id: string;
  processoId: string;
  name: string;
  order: number;
  createdAt: string;
  ownerId?: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: 'IMAGE' | 'VIDEO' | 'PDF' | 'DOC' | 'LINK';
  createdAt: string;
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  userName: string;
  content: string;
  createdAt: string; // ISO string
}

export interface TaskHistoryEntry {
  id: string;
  action: string;
  details?: string;
  userName: string;
  createdAt: string; // ISO string
}

export interface ProcessTask {
  id: string;
  processoId: string;
  columnId: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  responsible?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'PROGRESS' | 'DONE' | 'DELAYED';
  labels?: string[];
  createdAt: string;
  completedAt?: string;
  timeSpentSeconds?: number;
  attachments?: TaskAttachment[];
  checklist?: TaskChecklistItem[];
  comments?: TaskComment[];
  history?: TaskHistoryEntry[];
  ownerId?: string;
  linkedEventId?: string;
  linkedEventType?: 'content' | 'capture' | 'meeting';
}

export interface ProcessAutomation {
  id: string;
  processoId: string;
  triggerColumnId: string; // columnId or 'ANY'
  actionType: 'NOTIFY' | 'CREATE_TASK' | 'MARK_DEMAND_DONE' | 'SET_STATUS_DELAYED';
  actionParams?: {
    targetProcessoId?: string;
    targetColumnId?: string;
    responsibleUser?: string;
    notifyUserId?: string;
    message?: string;
  };
  isActive: boolean;
  ownerId?: string;
}

export interface ModulePermissions {
  view: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  complete?: boolean;
  createProcess?: boolean;
  editProcess?: boolean;
  moveCards?: boolean;
  createCards?: boolean;
  deleteCards?: boolean;
  createSale?: boolean;
  editSale?: boolean;
  deleteSale?: boolean;
  editGoals?: boolean;
  editPermissions?: boolean;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: Record<string, ModulePermissions>;
  createdAt: string;
  ownerId?: string;
}

export interface UserProfile extends UserSettings {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl?: string;
  phone?: string;
  roleId?: string;
  roleName?: string;
  team?: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastAccess?: string;
  createdAt: string;
  ownerId?: string;
  customPermissions?: Record<string, ModulePermissions>;
  restrictedClients?: string[];
  restrictedProcesses?: string[];
}

export interface ActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  targetUserId?: string;
  targetUserName?: string;
  action: string;
  details: string;
  timestamp: string;
}

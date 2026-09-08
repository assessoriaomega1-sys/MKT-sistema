import { firebaseStorage } from './firebaseStorage';
import { Client, MetricEntry, UserSettings, Sale, CommercialGoal, MonthlyPayment, FinancialRelease, RecurringBill, FinancialGoal, Creative, UserProfile, UserRole, ActivityLog, Company } from '../types';

export const storage = {
  // Payments
  getPayments: async (month: number, year: number): Promise<MonthlyPayment[]> => {
    return await firebaseStorage.getPayments(month, year);
  },

  savePayment: async (payment: MonthlyPayment) => {
    await firebaseStorage.savePayment(payment);
  },

  getClients: async (): Promise<Client[]> => {
    return await firebaseStorage.getClients();
  },

  getClient: async (id: string): Promise<Client | null> => {
    return await firebaseStorage.getClient(id);
  },

  listenToClient: (id: string, callback: (client: Client | null) => void) => {
    return firebaseStorage.listenToClient(id, callback);
  },
  
  saveClient: async (client: Client) => {
    await firebaseStorage.saveClient(client);
  },

  deleteClient: async (id: string) => {
    await firebaseStorage.deleteClient(id);
  },

  listenToClients: (callback: (clients: Client[]) => void) => {
    return firebaseStorage.listenToClients(callback);
  },

  listenToAllEntries: (callback: (entries: MetricEntry[]) => void) => {
    return firebaseStorage.listenToAllEntries(callback);
  },

  getEntries: async (clientId: string): Promise<MetricEntry[]> => {
    return await firebaseStorage.getEntries(clientId);
  },

  saveEntry: async (entry: MetricEntry) => {
    await firebaseStorage.saveEntry(entry);
  },

  deleteEntry: async (clientId: string, entryId: string) => {
    await firebaseStorage.deleteEntry(clientId, entryId);
  },

  getSettings: async (): Promise<UserSettings> => {
    return await firebaseStorage.getSettings();
  },

  saveSettings: async (settings: UserSettings) => {
    await firebaseStorage.saveSettings(settings);
  },

  // Commercial
  getSales: async (monthYear?: string): Promise<Sale[]> => {
    return await firebaseStorage.getSales(monthYear);
  },

  listenToSales: (callback: (sales: Sale[]) => void) => {
    return firebaseStorage.listenToSales(callback);
  },
  
  saveSale: async (sale: Sale) => {
    await firebaseStorage.saveSale(sale);
  },

  deleteSale: async (id: string) => {
    await firebaseStorage.deleteSale(id);
  },

  getGoals: async (): Promise<CommercialGoal[]> => {
    return await firebaseStorage.getGoals();
  },

  listenToGoals: (callback: (goals: CommercialGoal[]) => void) => {
    return firebaseStorage.listenToGoals(callback);
  },

  saveGoal: async (goal: CommercialGoal) => {
    await firebaseStorage.saveGoal(goal);
  },

  // FOLHA
  getFinancialReleases: async (): Promise<FinancialRelease[]> => {
    return await firebaseStorage.getFinancialReleases();
  },

  saveFinancialRelease: async (release: FinancialRelease) => {
    await firebaseStorage.saveFinancialRelease(release);
  },

  deleteFinancialRelease: async (id: string) => {
    await firebaseStorage.deleteFinancialRelease(id);
  },

  getRecurringBills: async (): Promise<RecurringBill[]> => {
    return await firebaseStorage.getRecurringBills();
  },

  saveRecurringBill: async (bill: RecurringBill) => {
    await firebaseStorage.saveRecurringBill(bill);
  },

  deleteRecurringBill: async (id: string) => {
    await firebaseStorage.deleteRecurringBill(id);
  },

  getFinancialGoals: async (): Promise<FinancialGoal[]> => {
    return await firebaseStorage.getFinancialGoals();
  },

  saveFinancialGoal: async (goal: FinancialGoal) => {
    await firebaseStorage.saveFinancialGoal(goal);
  },

  // CREATIVES
  getCreatives: async (): Promise<Creative[]> => {
    return await firebaseStorage.getCreatives();
  },

  saveCreative: async (creative: Creative) => {
    await firebaseStorage.saveCreative(creative);
  },

  deleteCreative: async (id: string) => {
    await firebaseStorage.deleteCreative(id);
  },

  listenToCreatives: (callback: (creatives: Creative[]) => void) => {
    return firebaseStorage.listenToCreatives(callback);
  },

  // PROCESSES
  getProcesses: async () => {
    return await firebaseStorage.getProcesses();
  },
  saveProcess: async (process: any) => {
    await firebaseStorage.saveProcess(process);
  },
  deleteProcess: async (id: string) => {
    await firebaseStorage.deleteProcess(id);
  },
  listenToProcesses: (callback: (processes: any[]) => void) => {
    return firebaseStorage.listenToProcesses(callback);
  },

  // COLUMNS
  getColumns: async (processoId?: string) => {
    return await firebaseStorage.getColumns(processoId);
  },
  saveColumn: async (col: any) => {
    await firebaseStorage.saveColumn(col);
  },
  deleteColumn: async (id: string) => {
    await firebaseStorage.deleteColumn(id);
  },
  listenToColumns: (processoId: string, callback: (cols: any[]) => void) => {
    return firebaseStorage.listenToColumns(processoId, callback);
  },

  // TASKS
  getTasks: async (processoId?: string) => {
    return await firebaseStorage.getTasks(processoId);
  },
  saveTask: async (task: any) => {
    await firebaseStorage.saveTask(task);
  },
  deleteTask: async (id: string) => {
    await firebaseStorage.deleteTask(id);
  },
  listenToTasks: (processoId: string, callback: (tasks: any[]) => void) => {
    return firebaseStorage.listenToTasks(processoId, callback);
  },
  listenToAllTasks: (callback: (tasks: any[]) => void) => {
    return firebaseStorage.listenToAllTasks(callback);
  },

  // AUTOMATIONS
  getAutomations: async (processoId: string) => {
    return await firebaseStorage.getAutomations(processoId);
  },
  saveAutomation: async (auto: any) => {
    await firebaseStorage.saveAutomation(auto);
  },
  deleteAutomation: async (id: string) => {
    await firebaseStorage.deleteAutomation(id);
  },

  // USERS MODULE
  getAllUsers: async (): Promise<UserProfile[]> => {
    return await firebaseStorage.getAllUsers();
  },
  getUserProfile: async (userId: string): Promise<UserProfile | null> => {
    return await firebaseStorage.getUserProfile(userId);
  },
  saveUserProfile: async (profile: UserProfile) => {
    await firebaseStorage.saveUserProfile(profile);
  },
  deleteUserProfile: async (id: string) => {
    await firebaseStorage.deleteUserProfile(id);
  },
  listenToUsers: (callback: (users: UserProfile[]) => void) => {
    return firebaseStorage.listenToUsers(callback);
  },

  // ROLES
  getRoles: async (): Promise<UserRole[]> => {
    return await firebaseStorage.getRoles();
  },
  saveRole: async (role: UserRole) => {
    await firebaseStorage.saveRole(role);
  },
  deleteRole: async (id: string) => {
    await firebaseStorage.deleteRole(id);
  },
  listenToRoles: (callback: (roles: UserRole[]) => void) => {
    return firebaseStorage.listenToRoles(callback);
  },

  // ACTIVITY LOGS
  getActivityLogs: async (): Promise<ActivityLog[]> => {
    return await firebaseStorage.getActivityLogs();
  },
  saveActivityLog: async (log: ActivityLog) => {
    await firebaseStorage.saveActivityLog(log);
  },
  listenToActivityLogs: (callback: (logs: ActivityLog[]) => void) => {
    return firebaseStorage.listenToActivityLogs(callback);
  },

  // COMPANIES & ACCESS CODES
  getCompanyByAccessCode: async (code: string): Promise<Company | null> => {
    return await firebaseStorage.getCompanyByAccessCode(code);
  },
  getCompany: async (companyId: string): Promise<Company | null> => {
    return await firebaseStorage.getCompany(companyId);
  },
  saveCompany: async (company: Company) => {
    await firebaseStorage.saveCompany(company);
  }
};

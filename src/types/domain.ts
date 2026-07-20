export type UserRole = 'requester' | 'mover' | 'admin';

export type RequestStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type Priority = 'normal' | 'urgent';

export interface Site {
  id: string;
  name: string;
  shortName: string;
  address: string;
  mapsQuery?: string;
  contactName?: string;
  contactPhone?: string;
  active: boolean;
}

export interface Equipment {
  id: string;
  inventoryCode: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  currentSiteId: string;
  homeSiteId: string;
  movable: boolean;
  active: boolean;
  accessories: string[];
  notes?: string;
}

export interface SaveSiteInput {
  id?: string;
  name: string;
  shortName: string;
  address: string;
  mapsQuery?: string;
  contactName?: string;
  contactPhone?: string;
  active: boolean;
}

export interface SaveEquipmentInput {
  id?: string;
  inventoryCode: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  homeSiteId: string;
  currentSiteId: string;
  movable: boolean;
  active: boolean;
  accessories: string[];
  notes?: string;
}

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  siteId?: string;
  phone?: string;
  active: boolean;
  mustChangePassword?: boolean;
  lastAccessAt?: string;
  createdAt?: string;
}

export interface CreateAppUserInput {
  fullName: string;
  email: string;
  role: UserRole;
  siteId?: string;
  phone?: string;
}

export interface UpdateAppUserInput extends CreateAppUserInput {
  id: string;
}

export interface PushRegistrationStatus {
  state: 'idle' | 'checking' | 'ready' | 'permission_denied' | 'unsupported' | 'error';
  message: string;
  tokenPreview?: string;
  lastAttemptAt?: string;
}

export interface PushAdminDiagnostics {
  activeUsers: number;
  activeTokens: number;
  nativeTokens: number;
  webSubscriptions: number;
  pendingDeliveries: number;
  failedDeliveries24h: number;
  usersWithoutToken: { id: string; fullName: string; email: string }[];
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export interface DeliveryRequest {
  id: string;
  code: string;
  equipmentId: string;
  requesterId: string;
  pickupSiteId: string;
  destinationSiteId: string;
  assignedMoverId?: string;
  assignedMoverIds: string[];
  requestedDate: string;
  requestedTime: string;
  priority: Priority;
  status: RequestStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewDeliveryRequest {
  equipmentId: string;
  pickupSiteId: string;
  destinationSiteId: string;
  requestedDate: string;
  requestedTime: string;
  priority: Priority;
  note?: string;
}

export type NotificationKind = 'request' | 'status' | 'assignment' | 'reminder' | 'chat' | 'system';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  requestId?: string;
  recipientUserId?: string;
  createdAt: string;
  readBy: string[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId?: string;
  text: string;
  requestId?: string;
  createdAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface StatisticsFilters {
  fromDate?: string;
  toDate?: string;
  siteId?: string;
  equipmentId?: string;
  moverId?: string;
  status?: RequestStatus;
  priority?: Priority;
}

export interface StatisticsBreakdownItem {
  id: string;
  label: string;
  count: number;
}

export interface AdminStatistics {
  total: number;
  completed: number;
  active: number;
  urgent: number;
  late: number;
  averageCycleMinutes: number | null;
  bySite: StatisticsBreakdownItem[];
  byEquipment: StatisticsBreakdownItem[];
  byMover: StatisticsBreakdownItem[];
}

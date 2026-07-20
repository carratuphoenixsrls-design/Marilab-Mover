import type {
  AdminStatistics,
  AppNotification,
  AppUser,
  ChatMessage,
  DeliveryRequest,
  Equipment,
  Site,
  StatisticsBreakdownItem,
} from '@/types/domain';

type Row = Record<string, unknown>;

const optionalText = (value: unknown) => typeof value === 'string' && value.length ? value : undefined;
const text = (value: unknown) => typeof value === 'string' ? value : '';
const bool = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback;
const time = (value: unknown) => text(value).slice(0, 5);

export function mapSite(row: Row): Site {
  return {
    id: text(row.id),
    name: text(row.name),
    shortName: text(row.short_name),
    address: text(row.address),
    mapsQuery: optionalText(row.maps_query),
    contactName: optionalText(row.contact_name),
    contactPhone: optionalText(row.contact_phone),
    active: bool(row.active, true),
  };
}

export function mapEquipment(row: Row): Equipment {
  return {
    id: text(row.id),
    inventoryCode: text(row.inventory_code),
    name: text(row.name),
    brand: optionalText(row.brand),
    model: optionalText(row.model),
    serialNumber: optionalText(row.serial_number),
    homeSiteId: text(row.home_site_id),
    currentSiteId: text(row.current_site_id),
    movable: bool(row.movable, true),
    active: bool(row.active, true),
    accessories: Array.isArray(row.accessories) ? row.accessories.map(text).filter(Boolean) : [],
    notes: optionalText(row.notes),
  };
}

export function mapUser(row: Row): AppUser {
  return {
    id: text(row.id),
    fullName: text(row.full_name),
    email: text(row.email),
    role: row.role === 'admin' || row.role === 'mover' ? row.role : 'requester',
    siteId: optionalText(row.site_id),
    phone: optionalText(row.phone),
    active: bool(row.active, true),
    mustChangePassword: bool(row.must_change_password),
    lastAccessAt: optionalText(row.last_access_at),
    createdAt: optionalText(row.created_at),
  };
}

export function mapRequest(row: Row): DeliveryRequest {
  const rawStatus = text(row.status);
  const normalizedStatus = rawStatus === 'approved'
    ? 'pending'
    : rawStatus === 'return_required'
      ? 'delivered'
      : rawStatus;
  const status: DeliveryRequest['status'] = [
    'pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled',
  ].includes(normalizedStatus)
    ? normalizedStatus as DeliveryRequest['status']
    : 'pending';

  return {
    id: text(row.id),
    code: text(row.code),
    equipmentId: text(row.equipment_id),
    requesterId: text(row.requester_id),
    pickupSiteId: text(row.pickup_site_id),
    destinationSiteId: text(row.destination_site_id),
    assignedMoverId: optionalText(row.assigned_mover_id),
    assignedMoverIds: Array.isArray(row.assigned_mover_ids) ? row.assigned_mover_ids.map(text).filter(Boolean) : (optionalText(row.assigned_mover_id) ? [text(row.assigned_mover_id)] : []),
    requestedDate: text(row.requested_date),
    requestedTime: time(row.requested_time),
    priority: row.priority === 'urgent' ? 'urgent' : 'normal',
    status,
    note: optionalText(row.note),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export function mapNotification(row: Row, currentUserId: string, readIds: Set<string>): AppNotification {
  const id = String(row.id ?? '');
  return {
    id,
    kind: typeof row.kind === 'string' ? row.kind as AppNotification['kind'] : 'system',
    title: text(row.title),
    body: text(row.body),
    requestId: optionalText(row.request_id),
    recipientUserId: optionalText(row.recipient_user_id),
    createdAt: text(row.created_at),
    readBy: readIds.has(id) ? [currentUserId] : [],
  };
}

export function mapChatMessage(row: Row): ChatMessage {
  return {
    id: String(row.id ?? ''),
    senderId: text(row.sender_id),
    requestId: optionalText(row.request_id),
    recipientId: optionalText(row.recipient_id),
    text: text(row.message),
    createdAt: text(row.created_at),
    deletedAt: optionalText(row.deleted_at),
    deletedBy: optionalText(row.deleted_by),
  };
}

function breakdown(value: unknown): StatisticsBreakdownItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as Row;
    return { id: text(row.id), label: text(row.label), count: Number(row.count ?? 0) };
  });
}

export function mapAdminStatistics(value: unknown): AdminStatistics {
  const row = (value ?? {}) as Row;
  return {
    total: Number(row.total ?? 0),
    completed: Number(row.completed ?? 0),
    active: Number(row.active ?? 0),
    urgent: Number(row.urgent ?? 0),
    late: Number(row.late ?? 0),
    averageCycleMinutes: row.average_cycle_minutes == null ? null : Number(row.average_cycle_minutes),
    bySite: breakdown(row.by_site),
    byEquipment: breakdown(row.by_equipment),
    byMover: breakdown(row.by_mover),
  };
}

import type { RequestStatus, UserRole } from '@/types/domain';

export const roleLabels: Record<UserRole, string> = {
  requester: 'Richiedente',
  mover: 'Mover',
  admin: 'Admin',
};

export const statusLabels: Record<RequestStatus, string> = {
  pending: 'Da prendere in carico',
  assigned: 'Presa in carico',
  picked_up: 'Ritirata',
  in_transit: 'In viaggio',
  delivered: 'Consegnata',
  completed: 'Chiusa',
  cancelled: 'Annullata',
};

export const visibleStatusFilters: RequestStatus[] = [
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'completed',
  'cancelled',
];

export function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function todayIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

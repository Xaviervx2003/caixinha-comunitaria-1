export type Participant = {
  id: number;
  name: string;
  email?: string | null;
  totalLoan: number | string;
  currentDebt: number | string;
  monthlyPayments?: { id: number; month: string; year: number; paid: boolean | number }[];
  createdAt?: string | Date | null;
};

export type Transaction = {
  id: number;
  participantId: number;
  type: 'payment' | 'amortization' | string;
  amount: number | string;
  month?: string;
  year?: number;
  createdAt?: string | Date | null;
  description?: string;
};

export type AuditEntry = {
  id: number;
  participantId: number;
  participantName: string;
  action: string;
  description?: string;
  createdAt?: string | Date | null;
};

export type NavSection = 'dashboard' | 'participantes' | 'devedores' | 'transacoes' | 'configuracoes';

export const MONTHS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

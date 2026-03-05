
export enum Role {
  ADMIN = 'Administrador',
  COLLECTOR = 'Cobrador',
  MANAGER = 'Gerente'
}

export enum LoanStatus {
  ACTIVE = 'Activo',
  PAID = 'Pagado',
  DEFAULT = 'Mora'
}

export enum PaymentStatus {
  PENDING = 'Pendiente',
  PAID = 'Pagado',
  PARTIAL = 'Parcial'
}

export enum Frequency {
  DAILY = 'Diaria',
  WEEKLY = 'Semanal',
  BIWEEKLY = 'Quincenal',
  MONTHLY = 'Mensual'
}

export enum ExpenseCategory {
  TRANSPORT = 'Transporte',
  SALARIES = 'Sueldos',
  MARKETING = 'Marketing',
  OFFICE = 'Oficina',
  OTHERS = 'Otros'
}

export enum CollectionLogType {
  PAYMENT = 'PAGO',
  NO_PAGO = 'NO_PAGO',
  OPENING = 'APERTURA'
}

export type Language = 'es' | 'en' | 'pt' | 'fr';

export type CountryCode =
  | 'AR' | 'BO' | 'BR' | 'CL' | 'CO' | 'EC' | 'GY' | 'PY' | 'PE' | 'SR' | 'UY' | 'VE' | 'ES'
  | 'BZ' | 'CR' | 'SV' | 'GT' | 'HN' | 'NI' | 'PA'
  | 'CA' | 'US' | 'MX'
  | 'DO' | 'CU' | 'HT' | 'JM' | 'TT' | 'BS' | 'BB' | 'LC' | 'VC' | 'GD' | 'AG' | 'DM' | 'KN';

export interface AppSettings {
  language: Language;
  country: CountryCode;
  companyName?: string;
  currencySymbol?: string; // Added optional currency symbol
  contactPhone?: string;
  companyAlias?: string; // Para el Legajo (Nombre corto o comercial)
  companyIdentifier?: string; // RUC/NIT/ID Legal
  shareLabel?: string; // Etiqueta personalizada para el legajo (Ej: "ALIAS DE LA EMPRESA")
  shareValue?: string; // Valor monetario/número personalizado para el legajo
  transferAlias?: string;
  technicalSupportPhone?: string;
  numberFormat?: 'dot' | 'comma'; // 'dot' -> 1.000,00 | 'comma' -> 1,000.00
  // Configuración de Impresión
  receiptPrintMargin?: number;
  companyNameBold?: boolean;
  companyNameSize?: 'normal' | 'medium' | 'large';
  companyIdentifierBold?: boolean;
  contactPhoneBold?: boolean;
  shareLabelBold?: boolean;
  shareLabelSize?: 'normal' | 'medium' | 'large';
  shareValueBold?: boolean;
  shareValueSize?: 'normal' | 'medium' | 'large';
}

export interface User {
  id: string;
  name: string;
  role: Role;
  username: string;
  password?: string;
  blocked?: boolean;
  expiryDate?: string;
  managedBy?: string; // ID del Gerente que supervisa a este usuario
  profilePic?: string; // Foto de perfil del cobrador
  homePic?: string;    // Foto de la casa del cobrador
  homeLocation?: { lat: number; lng: number }; // Ubicación GPS de la casa
  requiresLocation?: boolean; // Si está activado, obliga a tener GPS encendido
  deletedAt?: string; // Soft delete timestamp para ocular gerentes eliminados
}

export interface Client {
  id: string;
  documentId: string;
  name: string;
  phone: string;
  secondaryPhone?: string;
  address: string;
  addedBy?: string;
  branchId?: string; // ID de la sucursal (Gerente) a la que pertenece
  profilePic?: string;
  housePic?: string;
  businessPic?: string;
  documentPic?: string;
  location?: {
    lat: number;
    lng: number;
  };
  domicilioLocation?: {
    lat: number;
    lng: number;
  };
  creditLimit: number;
  allowCollectorLocationUpdate?: boolean;
  customNoPayMessage?: string;
  isActive?: boolean;
  isHidden?: boolean; // Nueva propiedad para ocultar clientes
  createdAt?: string; // Fecha de registro del cliente
  capital?: number; // Added to sync initial loan capital directly on client
  currentBalance?: number; // Added to sync current balance directly on client
  // Nuevos campos de Registro Extendido
  nationality?: string;
  birthDate?: string;
  maritalStatus?: string;
  profession?: string;
  email?: string;
  // Datos del Cónyuge
  spouseName?: string;
  spouseDocumentId?: string;
  spouseBirthDate?: string;
  spouseProfession?: string;
  spouseWorkplace?: string;
  spouseWorkPhone?: string;
  spouseIncome?: number;
  // Información de Vivienda
  residenceType?: 'propia' | 'alquilada' | 'familiar';
  residenceAntiquity?: string;
  clientType?: string; // Código para tipo de cliente (Formal/Informal, Empleado/Dueño)
  clientTypeCode?: string; // Nuevo campo para clasificación BANCA (130, 131, etc.)
  systemRating?: string; // NUEVO: Calificación en el sistema (P, I, etc.)
  sellerCode?: string; // NUEVO: Código de Vendedor
  deletedAt?: string; // Soft delete timestamp
  // Datos Particulares Detallados
  particularCity?: string;
  particularStreetMain?: string;
  particularStreetSecondary?: string;
  houseNumber?: string;
  particularNeighborhood?: string;
  // Datos Laborales Detallados
  workCompany?: string;
  workStreetMain?: string;
  workStreetSecondary?: string;
  workCity?: string;
  workPhone?: string;
  workNeighborhood?: string;
  workPosition?: string;
  workSector?: string; // Rubro
  workAntiquity?: string;
  workIncome?: number;
  locationCoords?: string; // Coordenada guardada como string
}

export interface Installment {
  number: number;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  paidAmount: number;
}

export interface Loan {
  id: string;
  clientId: string;
  collectorId?: string;
  branchId?: string; // ID de la sucursal (Gerente)
  principal: number;
  interestRate: number;
  totalInstallments: number;
  frequency: Frequency;
  totalAmount: number;
  installmentValue: number;
  status: LoanStatus;
  createdAt: string;
  installments: Installment[];
  isRenewal?: boolean;
  customHolidays?: string[]; // Fechas YYYY-MM-DD omitidas en el cobro
  operationTypeCode?: string; // Nuevo campo para clasificación operación (202, 201, etc.)
  sellerCode?: string; // NUEVO: Código de Vendedor (31, 38, etc.)
  promissoryNoteAmount?: number; // Monto del Pagaré
  promissoryNoteExpiration?: string; // Fecha de Vencimiento del Pagaré
  deletedAt?: string;
  updated_at?: string;
}

export interface PaymentRecord {
  id: string;
  loanId: string;
  clientId: string;
  collectorId?: string; // ID del cobrador que recibió el pago
  branchId?: string; // ID de la sucursal (Gerente)
  amount: number;
  date: string;
  installmentNumber: number;
  location?: { lat: number; lng: number };
  isVirtual?: boolean;
  isRenewal?: boolean;
  created_at?: string;
  deletedAt?: string;
  updated_at?: string;
}

export interface CollectionLog {
  id: string;
  loanId: string;
  clientId: string;
  branchId?: string; // ID de la sucursal (Gerente)
  type: CollectionLogType;
  amount?: number;
  date: string;
  location: { lat: number; lng: number };
  isVirtual?: boolean;
  isRenewal?: boolean;
  isOpening?: boolean;
  recordedBy?: string; // ID del usuario que marcó el abono
  notes?: string; // Nota opcional para el motivo de No Pago
  companySnapshot?: AppSettings; // Snapshot inmutable de las opciones de la empresa en el momento del recibo
  deletedAt?: string;
  updated_at?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  branchId?: string; // ID de la sucursal (Gerente)
  addedBy?: string;  // ID del usuario que registró el gasto
}

export interface CommissionBracket {
  maxMora: number; // Porcentaje máximo de mora (Ej: 20)
  payoutPercent: number; // Porcentaje de la comisión base que se paga (Ej: 100)
}

export interface AppState {
  clients: Client[];
  loans: Loan[];
  payments: PaymentRecord[];
  expenses: Expense[];
  collectionLogs: CollectionLog[];
  users: User[];
  currentUser: User | null;
  commissionPercentage: number;
  commissionBrackets: CommissionBracket[];
  initialCapital: number;
  settings: AppSettings;
  branchSettings?: Record<string, AppSettings>;
  deletedItems?: DeletedItem[];
}

export interface DeletedItem {
  id: string;
  tableName: string;
  recordId: string;
  branchId?: string;
  deletedAt: string;
}

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Client, AppState, Loan, Frequency, LoanStatus, CollectionLog, CollectionLogType, Role, PaymentStatus, User } from '../types';
import { formatCurrency, calculateTotalReturn, generateAmortizationTable, formatDate, generateReceiptText, getDaysOverdue, getLocalDateStringForCountry, generateUUID, convertReceiptForWhatsApp, calculateTotalPaidFromLogs, getRenewalButtonColor, parseAmount } from '../utils/helpers';
import { getTranslation } from '../utils/translations';
import { generateNoPaymentAIReminder } from '../services/geminiService';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import PullToRefresh from './PullToRefresh';
import { useSync } from '../hooks/useSync';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { jsPDF } from 'jspdf';
import { saveAndOpenPDF, saveAndOpenBase64PDF } from '../utils/pdfHelper';
import { exportClientsToExcel, processExcelImport } from '../utils/excelHelper';
import { RefreshCcw, Upload, Download } from 'lucide-react';

interface ClientsProps {
  state: AppState;
  addClient: (client: Client, loan?: Loan) => void | Promise<void>;
  addLoan?: (loan: Loan) => void;
  updateClient?: (client: Client) => void;
  updateLoan?: (loan: Loan) => void;
  deleteCollectionLog?: (logId: string) => void;
  updateCollectionLog?: (logId: string, newAmount: number) => void;
  updateCollectionLogNotes?: (logId: string, notes: string) => void;
  deleteLoan?: (loanId: string) => void;
  addCollectionAttempt: (log: CollectionLog) => void;
  globalState: AppState;
  onForceSync?: (silent?: boolean, message?: string) => Promise<void>;
  setActiveTab?: (tab: string) => void;
  fetchClientPhotos?: (clientId: string) => Promise<Partial<Client> | null>;
  recalculateLoanStatus?: (loanId: string) => void;
}

const compressImage = (base64: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(base64);
  });
};

const GenericCalendar = ({ startDate, customHolidays, setDate, toggleHoliday, disabled = false }: { startDate: string, customHolidays: string[], setDate: (iso: string) => void, toggleHoliday: (iso: string) => void, disabled?: boolean }) => {
  const [currentCalDate, setCurrentCalDate] = useState(new Date(startDate + 'T00:00:00'));
  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();
  const month = currentCalDate.getMonth();
  const year = currentCalDate.getFullYear();
  const totalDays = daysInMonth(month, year);
  const startDay = firstDayOfMonth(month, year);
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);

  const handleDayClick = (day: number) => {
    if (disabled) return;
    const date = new Date(year, month, day);
    const iso = date.toISOString().split('T')[0];
    if (startDate === iso) {
      toggleHoliday(iso);
    } else {
      setDate(iso);
    }
  };

  return (
    <div className={`bg - white border border - slate - 300 rounded - 2xl p - 4 shadow - sm animate - fadeIn ${disabled ? 'opacity-50 pointer-events-none' : ''} `}>
      <div className="flex justify-between items-center mb-4">
        <h5 className="text-[10px] font-black uppercase text-slate-900">{monthNames[month]} {year}</h5>
        <div className="flex gap-1">
          <button type="button" onClick={() => setCurrentCalDate(new Date(year, month - 1))} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><i className="fa-solid fa-chevron-left text-[10px]"></i></button>
          <button type="button" onClick={() => setCurrentCalDate(new Date(year, month + 1))} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><i className="fa-solid fa-chevron-right text-[10px]"></i></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {["D", "L", "M", "M", "J", "V", "S"].map(d => <div key={d} className="text-[8px] font-black text-slate-500 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty - ${idx} `} />;
          const date = new Date(year, month, day);
          const iso = date.toISOString().split('T')[0];
          const isStart = startDate === iso;
          const isHoliday = customHolidays.includes(iso);
          const isSunday = date.getDay() === 0;
          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              onContextMenu={(e) => { e.preventDefault(); !disabled && toggleHoliday(iso); }}
              className={`h - 10 w - full rounded - lg text - [10px] font - black flex flex - col items - center justify - center transition - all border
                ${isStart ? 'bg-blue-600 text-white border-blue-500 shadow-md scale-105 z-10' :
                  isHoliday ? 'bg-orange-500 text-white border-orange-400' :
                    isSunday ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-white text-slate-800 border-slate-300 hover:border-blue-400'
                } `}
            >
              {day}
              {isHoliday && <div className="w-1 h-1 bg-white rounded-full mt-0.5"></div>}
              {isStart && <div className="text-[6px] opacity-70">INICIO</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const PhotoUploadField = ({ label, field, value, onFileChange, forEdit = false, disabled = false }: { label: string, field: 'profilePic' | 'documentPic' | 'housePic' | 'businessPic', value: string, onFileChange: (e: React.ChangeEvent<HTMLInputElement>, field: 'profilePic' | 'documentPic' | 'housePic' | 'businessPic', forEdit: boolean) => void, forEdit?: boolean, disabled?: boolean }) => {
  const isPdf = value && (value.startsWith('data:application/pdf') || value.includes('pdf'));

  return (
    <div className={`flex flex-col gap-1.5 ${disabled ? 'opacity-50 grayscale' : ''}`}>
      <label className="text-[8px] font-black text-slate-700 uppercase tracking-widest ml-1">{label}</label>
      <div className={`relative group aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden flex flex-col items-center justify-center transition-all ${!disabled ? 'hover:border-blue-500 hover:bg-blue-50 cursor-pointer' : ''}`}>
        {value ? (
          <>
            {isPdf ? (
              <div className="flex flex-col items-center justify-center p-2 text-center">
                <i className="fa-solid fa-file-pdf text-red-500 text-3xl mb-1"></i>
                <span className="text-[7px] font-black text-slate-700 uppercase">DOCUMENTO PDF</span>
              </div>
            ) : (
              <img src={value} className="w-full h-full object-cover" />
            )}
            {!disabled && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">{isPdf ? 'Cambiar PDF' : 'Cambiar Foto'}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <i className="fa-solid fa-camera text-slate-400 text-2xl group-hover:text-blue-500 transition-colors"></i>
            <span className="text-[7px] font-black text-slate-500 uppercase mt-2 group-hover:text-blue-600">Subir Imagen</span>
          </>
        )}
        {!disabled && (
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => onFileChange(e, field, forEdit)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        )}
      </div>
    </div>
  );
};

const Clients: React.FC<ClientsProps> = ({ state, addClient, addLoan, updateClient, updateLoan, deleteCollectionLog, updateCollectionLog, updateCollectionLogNotes, addCollectionAttempt, globalState, onForceSync, setActiveTab, fetchClientPhotos, deleteLoan, recalculateLoanStatus }) => {
  const { forceSync } = useSync();
  const countryTodayStr = getLocalDateStringForCountry(state.settings.country);

  const handleViewPhotoAsPDF = async (imageSrc: string, title: string, client: Client) => {
    try {
      const isPdf = imageSrc.startsWith('data:application/pdf') || imageSrc.includes('pdf');
      const fileName = `${client.name.replace(/\s+/g, '_')}_${title}_${state.currentUser?.name || 'user'}.pdf`;

      if (isPdf) {
        await saveAndOpenBase64PDF(imageSrc, fileName);
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Title
      doc.setFontSize(16);
      doc.text(`Expediente: ${client.name} - ${title} `, 10, 15);

      // Add image
      const imgProps = doc.getImageProperties(imageSrc);
      const ratio = imgProps.width / imgProps.height;
      let imgWidth = pageWidth - 20; // 10px margin each side
      let imgHeight = imgWidth / ratio;

      if (imgHeight > pageHeight - 30) {
        imgHeight = pageHeight - 30;
        imgWidth = imgHeight * ratio;
      }

      doc.addImage(imageSrc, 'JPEG', 10, 25, imgWidth, imgHeight);
      await saveAndOpenPDF(doc, fileName);
    } catch (e) {
      console.error("Error generating/opening PDF", e);
      alert("Error al abrir el documento.");
    }
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedCollectorForImport, setSelectedCollectorForImport] = useState('');
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [viewMode, setViewMode] = useState<'gestion' | 'nuevos' | 'renovaciones' | 'cartera' | 'ocultos'>('cartera');
  const [filterStartDate, setFilterStartDate] = useState(countryTodayStr);
  const [filterEndDate, setFilterEndDate] = useState(countryTodayStr);
  const [selectedCollector, setSelectedCollector] = useState<string>('all');
  const [carteraSortBy, setCarteraSortBy] = useState<'registro' | 'saldo' | 'atraso' | 'renovaciones'>('registro');

  // PAGINACIÓN PARA GAMA BAJA
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [showModal, setShowModal] = useState(false);
  const [showLegajo, setShowLegajo] = useState<string | null>(null);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewForm, setRenewForm] = useState<any>({
    principal: '500000',
    interestRate: '20',
    installments: '24',
    frequency: Frequency.DAILY
  });

  const [clientData, setClientData] = useState<Client>({
    id: '',
    documentId: '',
    name: '',
    phone: '',
    secondaryPhone: '',
    address: '',
    creditLimit: 1000000,
    location: undefined,
    domicilioLocation: undefined,
    profilePic: '',
    housePic: '',
    businessPic: '',
    documentPic: '',
    allowCollectorLocationUpdate: false,
    isActive: true,
    // Inicializar nuevos campos
    nationality: '',
    birthDate: '',
    maritalStatus: '',
    profession: '',
    email: '',
    spouseName: '',
    spouseDocumentId: '',
    spouseBirthDate: '',
    spouseProfession: '',
    spouseWorkplace: '',
    spouseWorkPhone: '',
    spouseIncome: 0,
    residenceType: 'propia',
    residenceAntiquity: '',
    clientType: ''
  });

  const [editClientFormData, setEditClientFormData] = useState<Client | null>(null);
  const [editLoanFormData, setEditLoanFormData] = useState<any>(null);

  const [initialLoan, setInitialLoan] = useState<any>({
    principal: '500000',
    interestRate: '20',
    installments: '24',
    frequency: Frequency.DAILY,
    startDate: countryTodayStr,
    endDate: '',
    customHolidays: [] as string[],
    selectedCollectorId: ''
  });

  useEffect(() => {
    if (showModal) {
      const p = Number(initialLoan.principal) || 0;
      const i = Number(initialLoan.interestRate) || 0;
      const inst = Number(initialLoan.installments) || 0;

      let startDateObj;
      if (typeof initialLoan.startDate === 'string') {
        startDateObj = new Date(initialLoan.startDate.split('T')[0] + 'T00:00:00');
      } else {
        startDateObj = new Date(initialLoan.startDate);
        startDateObj.setHours(0, 0, 0, 0);
      }

      const table = generateAmortizationTable(
        p,
        i,
        inst,
        initialLoan.frequency,
        startDateObj,
        state.settings.country,
        initialLoan.customHolidays
      );
      if (table.length > 0) {
        const lastDate = table[table.length - 1].dueDate.split('T')[0];
        setInitialLoan((prev: any) => ({ ...prev, endDate: lastDate }));
      }
    }
  }, [initialLoan.startDate, initialLoan.installments, initialLoan.frequency, initialLoan.customHolidays, showModal, state.settings.country]);

  useEffect(() => {
    if (isEditingClient && editLoanFormData) {
      const p = Number(editLoanFormData.principal) || 0;
      const i = Number(editLoanFormData.interestRate) || 0;
      const inst = Number(editLoanFormData.totalInstallments) || 0;

      let startDateTime;
      if (typeof editLoanFormData.createdAt === 'string') {
        startDateTime = new Date(editLoanFormData.createdAt.split('T')[0] + 'T00:00:00');
      } else {
        startDateTime = new Date(editLoanFormData.createdAt);
        startDateTime.setHours(0, 0, 0, 0);
      }

      console.log(`[REGEN DEBUG] Regenerating Loan: ${editLoanFormData.id} | Principal: ${p} | StartDate(createdAt): ${editLoanFormData.createdAt} `);

      const table = generateAmortizationTable(
        p,
        i,
        inst,
        editLoanFormData.frequency,
        startDateTime,
        state.settings.country,
        editLoanFormData.customHolidays || []
      );

      const totalAmount = calculateTotalReturn(p, i);
      const installmentValue = inst > 0 ? totalAmount / inst : 0;

      const updatedInstallments = (Array.isArray(table) ? table : []).map(newInst => {
        const existing = (editLoanFormData.installments || []).find((e: any) => e.number === newInst.number);
        if (existing) {
          return { ...newInst, paidAmount: existing.paidAmount, status: existing.status };
        }
        return newInst;
      });

      setEditLoanFormData((prev: any) => prev ? {
        ...prev,
        totalAmount: totalAmount,
        installmentValue: installmentValue,
        installments: updatedInstallments
      } : null);
    }
  }, [
    editLoanFormData?.principal,
    editLoanFormData?.interestRate,
    editLoanFormData?.totalInstallments,
    editLoanFormData?.frequency,
    editLoanFormData?.customHolidays,
    editLoanFormData?.createdAt,
    isEditingClient,
    state.settings.country
  ]);

  const [showDossierPaymentModal, setShowDossierPaymentModal] = useState(false);
  const [dossierPaymentAmount, setDossierPaymentAmount] = useState<any>('');
  const [dossierIsVirtual, setDossierIsVirtual] = useState(false);
  const [dossierIsRenewal, setDossierIsRenewal] = useState(false);
  const [isProcessingDossierAction, setIsProcessingDossierAction] = useState(false);

  const [showEditLogModal, setShowEditLogModal] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [newLogAmount, setNewLogAmount] = useState<any>('');

  const [showCustomNoPayModal, setShowCustomNoPayModal] = useState(false);
  const [customNoPayText, setCustomNoPayText] = useState('');

  const [addInitialLoan, setAddInitialLoan] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturingType, setCapturingType] = useState<'home' | 'domicilio' | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(globalSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearch]);
  const [isSharing, setIsSharing] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  useEffect(() => {
    if (showLegajo && fetchClientPhotos && updateClient) {
      const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === showLegajo);
      if (client && !client.profilePic && !client.housePic && !client.businessPic && !client.documentPic) {
        fetchClientPhotos(showLegajo).then(photos => {
          if (photos) {
            updateClient({ ...client, ...photos });
          }
        });
      }
    }
  }, [showLegajo, fetchClientPhotos, updateClient, state.clients]);

  const shareCardRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLDivElement>(null);

  const isAdmin = state.currentUser?.role === Role.ADMIN;
  const isManager = state.currentUser?.role === Role.MANAGER;
  const isAdminOrManager = isAdmin || isManager;
  const isCollector = state.currentUser?.role === Role.COLLECTOR;
  const currentUserId = state.currentUser?.id;

  const collectors = useMemo(() => (Array.isArray(state.users) ? state.users : []).filter(u => u.role === Role.COLLECTOR), [state.users]);

  const clientInLegajo = useMemo(() => (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === showLegajo), [showLegajo, state.clients]);

  const activeLoanInLegajo = useMemo(() => {
    if (!showLegajo) return null;
    const clientLoans = (Array.isArray(state.loans) ? state.loans : []).filter(l => l.clientId === showLegajo && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
    return clientLoans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [showLegajo, state.loans]);

  const clientHistory = useMemo(() => {
    if (!showLegajo) return [];

    // Get collection logs
    const logs = (state.collectionLogs || [])
      .filter(log => log.clientId === showLegajo && !log.deletedAt)
      .map(log => ({ ...log, itemType: 'log' as const }));

    // Get loan grants (créditos otorgados)
    const loanGrants = (state.loans || [])
      .filter(loan => loan.clientId === showLegajo)
      .map(loan => ({
        id: `loan - ${loan.id} `,
        clientId: loan.clientId,
        loanId: loan.id,
        type: CollectionLogType.PAYMENT, // Dummy type for rendering
        amount: loan.principal, // Show the granted amount
        date: loan.createdAt,
        itemType: 'loan' as const,
        isRenewal: loan.isRenewal
      }));

    // Merge and sort by date (most recent first)
    return [...logs, ...loanGrants]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [showLegajo, state.collectionLogs, state.loans]);

  const getClientMetrics = (client: Client) => {
    if (!client) return { balance: 0, installmentsStr: '0/0', cuotasTP: '0/0', daysOverdue: 0, activeLoan: null, totalPaid: 0, lastExpiryDate: '', createdAt: '', isFullyPaid: false, maxDaysOverdue: 0, hasMultipleLoans: false };
    const clientLoans = (Array.isArray(state.loans) ? state.loans : []).filter(l => (l.clientId || (l as any).client_id) === client.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
    const sortedLoans = clientLoans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const activeLoan = sortedLoans[0];
    const hasMultipleLoans = clientLoans.length > 1;

    let balance = 0, installmentsStr = '0/0', daysOverdue = 0, totalPaid = 0, lastExpiryDate = '', createdAt = '', cuotasTP = '0/0', isFullyPaid = false, maxDaysOverdue = 0;

    if (activeLoan) {
      // USAR SIEMPRE LA FUNCIÓN ROBUSTA UNIFICADA
      totalPaid = calculateTotalPaidFromLogs(activeLoan, state.collectionLogs);

      // Saldo Pendiente Consolidado
      balance = clientLoans.reduce((sum, l) => {
        const lPaid = calculateTotalPaidFromLogs(l, state.collectionLogs);
        return sum + Math.max(0, l.totalAmount - lPaid);
      }, 0);

      isFullyPaid = balance <= 0.01;

      // Progreso Cuotas (del principal/reciente)
      const progress = totalPaid / (activeLoan.installmentValue || 1);
      const formattedProgress = progress % 1 === 0 ? progress.toString() : (Math.floor(progress * 10) / 10).toString();
      installmentsStr = `${formattedProgress} / ${activeLoan.totalInstallments}`;

      const paidUnits = Math.floor(progress);
      cuotasTP = `${activeLoan.totalInstallments} / ${paidUnits}`;

      // Mora: Tomamos la mayor de todos los préstamos para alertar peligro
      daysOverdue = Math.max(...clientLoans.map(l => {
        const lp = calculateTotalPaidFromLogs(l, state.collectionLogs);
        return getDaysOverdue(l, state.settings, lp);
      }));

      const daysOverdueArr = activeLoan.installments
        .filter(i => i.status !== PaymentStatus.PAID)
        .map(i => getDaysOverdue(i.dueDate, state.settings));
      maxDaysOverdue = daysOverdueArr.length > 0 ? Math.max(...daysOverdueArr) : 0;

      if (activeLoan.installments && activeLoan.installments.length > 0) {
        const insts = activeLoan.installments;
        lastExpiryDate = insts[insts.length - 1].dueDate;
      }
      createdAt = activeLoan.createdAt;

      return { balance, installmentsStr, cuotasTP, daysOverdue, activeLoan, totalPaid, lastExpiryDate, createdAt, isFullyPaid, maxDaysOverdue };
    }
    return { balance, installmentsStr, cuotasTP, daysOverdue, activeLoan: null, totalPaid, lastExpiryDate, createdAt, isFullyPaid, maxDaysOverdue };
  };

  const filteredClients = useMemo(() => {
    let clients = (Array.isArray(state.clients) ? state.clients : []).filter(c => !c.isHidden);
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
      clients = clients.filter(c => {
        const nameNorm = (c.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
        const docNorm = (c.documentId || '').replace(/\s+/g, "");
        const phoneNorm = (c.phone || '').replace(/\D/g, "");
        return nameNorm.includes(s) || docNorm.includes(s) || phoneNorm.includes(s);
      });
    }
    if (selectedCollector !== 'all') {
      const collectorLower = selectedCollector.toLowerCase();
      clients = clients.filter(c => {
        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        return (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase() === collectorLower || (c.addedBy || (c as any).added_by)?.toLowerCase() === collectorLower;
      });
    }
    // SAFE SORT (NaN PROOF)
    return [...clients].sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt.split('T')[0] + 'T00:00:00').getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt.split('T')[0] + 'T00:00:00').getTime() : 0;
      const vA = isNaN(tA) ? 0 : tA;
      const vB = isNaN(tB) ? 0 : tB;
      return vB - vA;
    });
  }, [state.clients, debouncedSearch, selectedCollector, state.loans, state.collectionLogs]);

  // RESETEAR PAGINA AL FILTRAR
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, debouncedSearch, selectedCollector]);

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return (filteredClients || []).slice(start, start + ITEMS_PER_PAGE);
  }, [filteredClients, currentPage]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);

  // VISTA EXCEL: NUEVOS CLIENTES EN RANGO
  const nuevosExcelData = useMemo(() => {
    if (viewMode !== 'nuevos') return [];
    const start = new Date(filterStartDate + 'T00:00:00');
    const end = new Date(filterEndDate + 'T23:59:59');

    const loans = Array.isArray(state.loans) ? state.loans : [];
    const s = debouncedSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");

    return (Array.isArray(state.clients) ? state.clients : []).map(client => {
      if (client.isHidden) return null;

      // Búsqueda Global
      if (s) {
        const nameNorm = (client.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
        const docNorm = (client.documentId || '').replace(/\s+/g, "");
        const phoneNorm = (client.phone || '').replace(/\D/g, "");
        if (!nameNorm.includes(s) && !docNorm.includes(s) && !phoneNorm.includes(s)) return null;
      }

      const cDate = new Date(client.createdAt || '');
      const inRange = cDate >= start && cDate <= end;
      if (!inRange) return null;

      const activeLoan = loans.find(l => l.clientId === client.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
      if (activeLoan?.isRenewal) return null;

      if (selectedCollector !== 'all') {
        const collectorLower = selectedCollector.toLowerCase();
        const matchesCollector = (activeLoan && (activeLoan.collectorId || (activeLoan as any).collector_id)?.toLowerCase() === collectorLower) || ((client.addedBy || (client as any).added_by)?.toLowerCase() === collectorLower);
        if (!matchesCollector) return null;
      }

      const metrics = getClientMetrics(client);
      return { ...client, _metrics: metrics };
    }).filter(Boolean).sort((a: any, b: any) => new Date(b._metrics.activeLoan?.createdAt || b.createdAt).getTime() - new Date(a._metrics.activeLoan?.createdAt || a.createdAt).getTime());
  }, [state.clients, filterStartDate, filterEndDate, viewMode, debouncedSearch, selectedCollector, state.loans]);

  const renovacionesExcelData = useMemo(() => {
    if (viewMode !== 'renovaciones') return [];
    const start = new Date(filterStartDate + 'T00:00:00');
    const end = new Date(filterEndDate + 'T23:59:59');

    const loans = Array.isArray(state.loans) ? state.loans : [];
    const clients = Array.isArray(state.clients) ? state.clients : [];
    const s = debouncedSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");

    return loans.filter(l =>
      l.isRenewal &&
      new Date(l.createdAt) >= start &&
      new Date(l.createdAt) <= end &&
      (selectedCollector === 'all' || (l.collectorId || (l as any).collector_id)?.toLowerCase() === selectedCollector.toLowerCase())
    ).map(loan => {
      const client = clients.find(c => c.id === loan.clientId);
      if (!client || client.isHidden) return null;

      // Búsqueda Global
      if (s) {
        const nameNorm = (client.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
        const docNorm = (client.documentId || '').replace(/\s+/g, "");
        if (!nameNorm.includes(s) && !docNorm.includes(s)) return null;
      }

      return {
        ...client,
        _loan: loan,
        _metrics: getClientMetrics(client),
        _sortDate: new Date(loan.createdAt).getTime()
      };
    }).filter(Boolean).sort((a: any, b: any) => b._sortDate - a._sortDate);
  }, [state.loans, state.clients, filterStartDate, filterEndDate, viewMode, selectedCollector, debouncedSearch]);

  // VISTA EXCEL: CARTERA GENERAL (TODOS LOS CLIENTES POR FECHA DE REGISTRO)
  const carteraExcelData = useMemo(() => {
    if (viewMode !== 'cartera') return [];
    const s = debouncedSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");

    return (Array.isArray(state.clients) ? state.clients : []).filter(c => {
      if (c.isHidden) return false;

      // Búsqueda Global
      if (s) {
        const nameNorm = (c.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
        const docNorm = (c.documentId || '').replace(/\s+/g, "");
        const phoneNorm = (c.phone || '').replace(/\D/g, "");
        if (!nameNorm.includes(s) && !docNorm.includes(s) && !phoneNorm.includes(s)) return false;
      }

      if (selectedCollector !== 'all') {
        const collectorLower = selectedCollector.toLowerCase();
        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
        return (activeLoan?.collectorId || (activeLoan as any).collector_id)?.toLowerCase() === collectorLower || (c.addedBy || (c as any).added_by)?.toLowerCase() === collectorLower;
      }
      return true;
    }).map(client => {
      const metrics = getClientMetrics(client);
      return { ...client, _metrics: metrics };
    }).sort((a, b) => {
      if (carteraSortBy === 'renovaciones') {
        const renewalsB = Array.isArray(state.loans) ? state.loans.filter(l => l.clientId === b.id && l.isRenewal).length : 0;
        const renewalsA = Array.isArray(state.loans) ? state.loans.filter(l => l.clientId === a.id && l.isRenewal).length : 0;
        return renewalsB - renewalsA;
      }
      if (carteraSortBy === 'saldo') {
        return (b._metrics?.balance || 0) - (a._metrics?.balance || 0);
      }
      if (carteraSortBy === 'atraso') {
        const delaysB = Math.max(0, b._metrics?.daysOverdue || 0);
        const delaysA = Math.max(0, a._metrics?.daysOverdue || 0);
        return delaysB - delaysA;
      }
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [state.clients, state.loans, viewMode, selectedCollector, carteraSortBy, debouncedSearch]);

  const handleOpenMap = (loc?: { lat: number, lng: number }) => {
    if (loc && loc.lat && loc.lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
      window.open(url, '_blank');
    } else {
      alert("Sin coordenadas capturadas para este punto.");
    }
  };

  const handleToggleHideClient = (clientId: string) => {
    if (!isAdminOrManager) return;
    const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === clientId);
    if (client && updateClient) {
      if (confirm(`¿DESEA OCULTAR AL CLIENTE ${client.name.toUpperCase()}? NO APARECERÁ EN LAS RUTAS DE COBRO ACTIVAS.`)) {
        updateClient({ ...client, isHidden: true });
      }
    }
  };

  const handleSubmitNewClient = async (e: React.FormEvent) => {
    if (isSubmitting) return;
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const clientId = generateUUID();
      // FIX: Explicitly assign branchId so it belongs to the Manager/Admin, not the Collector's private scope
      // This ensures it appears on the Web Dashboard (Admin) AND the Collector's App (via managedBy view)
      const user = state.currentUser;
      const calculatedBranchId = (user?.role === Role.ADMIN || user?.role === Role.MANAGER)
        ? user.id
        : (user?.managedBy || (user as any)?.managed_by || user?.id);

      const client: Client = {
        ...clientData,
        id: clientId,
        addedBy: currentUserId,
        branchId: calculatedBranchId,
        isActive: true,
        isHidden: false,
        createdAt: new Date().toISOString()
      };
      let loan: Loan | undefined;

      if (addInitialLoan) {
        const baseDateStr = initialLoan.startDate || countryTodayStr;
        const startDateTime = new Date(baseDateStr + 'T00:00:00');
        const validStartDate = isNaN(startDateTime.getTime()) ? new Date() : startDateTime;

        const safeParseFloat = (val: string | number | undefined) => {
          if (!val) return 0;
          const str = val.toString().replace(',', '.');
          return parseFloat(str) || 0;
        };

        const p = safeParseFloat(initialLoan.principal);
        const i = safeParseFloat(initialLoan.interestRate);
        const inst = safeParseFloat(initialLoan.installments);

        const total = calculateTotalReturn(p, i);
        loan = {
          id: generateUUID(),
          clientId,
          collectorId: initialLoan.selectedCollectorId || currentUserId,
          principal: p,
          interestRate: i,
          totalInstallments: inst,
          frequency: initialLoan.frequency,
          totalAmount: total,
          installmentValue: inst > 0 ? total / inst : 0,
          status: LoanStatus.ACTIVE,
          createdAt: validStartDate.toISOString(),
          customHolidays: initialLoan.customHolidays,
          installments: generateAmortizationTable(p, i, inst, initialLoan.frequency, validStartDate, state.settings.country, initialLoan.customHolidays)
        };
        // CRITICAL: Update client with loan details for denormalized view
        client.capital = p;
        client.currentBalance = total;
      }
      await addClient(client, loan);
      if (onForceSync) onForceSync(false, "CREDITO SUBIDO CORRECTAMENTE");
      setShowModal(false);
      // No longer force resetting or changing viewMode manually here if not needed
      setClientData({
        id: '', documentId: '', name: '', phone: '', secondaryPhone: '', address: '', creditLimit: 1000000,
        location: undefined, domicilioLocation: undefined, profilePic: '', housePic: '', businessPic: '', documentPic: '',
        allowCollectorLocationUpdate: false, isActive: true, isHidden: false,
        nationality: '', birthDate: '', maritalStatus: '', profession: '', email: '',
        spouseName: '', spouseDocumentId: '', spouseBirthDate: '', spouseProfession: '', spouseWorkplace: '', spouseWorkPhone: '', spouseIncome: 0,
        residenceType: 'propia', residenceAntiquity: '', clientType: ''
      });
    } catch (error) {
      alert("Error al crear el cliente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCaptureLocation = async (type: 'home' | 'domicilio', forEdit: boolean = false) => {
    setIsCapturing(true);
    setCapturingType(type);
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 2000, maximumAge: 120000 });
      const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (forEdit && editClientFormData) {
        setEditClientFormData(prev => prev ? { ...prev, [type === 'home' ? 'location' : 'domicilioLocation']: newLoc } : null);
      } else {
        setClientData(prev => ({ ...prev, [type === 'home' ? 'location' : 'domicilioLocation']: newLoc }));
      }
    } catch (err: any) {
      try {
        const fb = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 1500, maximumAge: 300000 });
        const fbLoc = { lat: fb.coords.latitude, lng: fb.coords.longitude };
        if (forEdit && editClientFormData) {
          setEditClientFormData(prev => prev ? { ...prev, [type === 'home' ? 'location' : 'domicilioLocation']: fbLoc } : null);
        } else {
          setClientData(prev => ({ ...prev, [type === 'home' ? 'location' : 'domicilioLocation']: fbLoc }));
        }
      } catch (fallbackErr: any) {
        alert("Error GPS: " + fallbackErr.message);
      }
      alert("Error GPS: " + err.message);
    } finally {
      setIsCapturing(false);
      setCapturingType(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'profilePic' | 'documentPic' | 'housePic' | 'businessPic', forEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If it's already a PDF, just read it as base64 and save it
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (forEdit) {
          setEditClientFormData(prev => prev ? { ...prev, [field]: base64 } : null);
        } else {
          setClientData(prev => ({ ...prev, [field]: base64 }));
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    // If it's an image, compress and convert to PDF
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string;
      const compressed = await compressImage(base64Image);

      // Convert image to PDF automatically
      try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const imgProps = doc.getImageProperties(compressed);
        const ratio = imgProps.width / imgProps.height;
        let imgWidth = pageWidth - 20;
        let imgHeight = imgWidth / ratio;

        if (imgHeight > pageHeight - 20) {
          imgHeight = pageHeight - 20;
          imgWidth = imgHeight * ratio;
        }

        doc.addImage(compressed, 'JPEG', 10, 10, imgWidth, imgHeight);
        const pdfBase64 = doc.output('datauristring');

        if (forEdit) {
          setEditClientFormData(prev => prev ? { ...prev, [field]: pdfBase64 } : null);
        } else {
          setClientData(prev => ({ ...prev, [field]: pdfBase64 }));
        }
      } catch (err) {
        console.error("Error converting image to PDF", err);
        // Fallback: save image if PDF fails
        if (forEdit) {
          setEditClientFormData(prev => prev ? { ...prev, [field]: compressed } : null);
        } else {
          setClientData(prev => ({ ...prev, [field]: compressed }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStartEdit = () => {
    if (!clientInLegajo) return;
    setEditClientFormData({ ...clientInLegajo });
    if (activeLoanInLegajo) {
      setEditLoanFormData({ ...activeLoanInLegajo });
    }
    setIsEditingClient(true);
  };

  const handleSaveEditedClient = () => {
    if (editClientFormData && updateClient) {
      updateClient(editClientFormData);
      if (editLoanFormData && updateLoan) {
        const loanToSave = {
          ...editLoanFormData,
          principal: Number(editLoanFormData.principal),
          interestRate: Number(editLoanFormData.interestRate),
          totalInstallments: Number(editLoanFormData.totalInstallments)
        };
        updateLoan(loanToSave);
      }
      setIsEditingClient(false);
      alert("Expediente y Crédito actualizados.");
    }
  };

  const handleOpenDossierPayment = () => {
    if (!activeLoanInLegajo) return;
    setDossierPaymentAmount(activeLoanInLegajo.installmentValue.toString());
    setDossierIsVirtual(false);
    setDossierIsRenewal(false);
    setShowDossierPaymentModal(true);
  };

  const setDossierPaymentMethod = (method: 'cash' | 'virtual' | 'renewal') => {
    setDossierIsVirtual(method === 'virtual');
    setDossierIsRenewal(method === 'renewal');

    // Solo cambiar el monto automáticamente si está vacío o es el valor por defecto
    const currentAmount = dossierPaymentAmount.toString();
    const isDefaultValue = activeLoanInLegajo && (currentAmount === activeLoanInLegajo.installmentValue.toString() || currentAmount === '');

    if (method === 'renewal' && activeLoanInLegajo) {
      // Regla de Oro: Usar collection logs como fuente de verdad para el saldo
      const loanLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => log.loanId === activeLoanInLegajo.id && log.type === CollectionLogType.PAYMENT && !log.isOpening && !log.deletedAt);
      const tPaid = loanLogs.reduce((acc, log) => acc + (log.amount || 0), 0);
      setDossierPaymentAmount(Math.max(0, activeLoanInLegajo.totalAmount - tPaid).toString());
    } else if (activeLoanInLegajo && isDefaultValue) {
      setDossierPaymentAmount(activeLoanInLegajo.installmentValue.toString());
    }
  };

  const handleDossierAction = async (type: CollectionLogType, customAmount?: number) => {
    if (isProcessingDossierAction || !clientInLegajo || !activeLoanInLegajo || !addCollectionAttempt) return;
    setIsProcessingDossierAction(true);
    try {
      const amountToPay = customAmount || Number(dossierPaymentAmount);

      // VALIDACIÓN: El abono no puede ser mayor al saldo
      const metrics = getClientMetrics(clientInLegajo);
      if (type === CollectionLogType.PAYMENT && amountToPay > metrics.balance + 0.01) {
        alert(`ERROR: El abono (${formatCurrency(amountToPay, state.settings)}) no puede superar el saldo pendiente (${formatCurrency(metrics.balance, state.settings)}).`);
        setIsProcessingDossierAction(false);
        return;
      }

      const logId = generateUUID();
      let currentLocation = { lat: 0, lng: 0 };
      try {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 2000, maximumAge: 120000 });
        currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (geoErr) {
        try {
          const fb = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 1500, maximumAge: 300000 });
          currentLocation = { lat: fb.coords.latitude, lng: fb.coords.longitude };
        } catch (fallbackErr) {
          console.warn("Could not get real GPS from dossier:", fallbackErr);
        }
      }

      const log: CollectionLog = {
        id: logId,
        clientId: clientInLegajo.id,
        loanId: activeLoanInLegajo.id,
        type: type,
        amount: type === CollectionLogType.PAYMENT ? amountToPay : undefined,
        date: new Date().toISOString(),
        location: currentLocation,
        isVirtual: dossierIsVirtual,
        isRenewal: dossierIsRenewal,
        companySnapshot: state.settings
      };

      addCollectionAttempt(log);



      if (type === CollectionLogType.PAYMENT || type === CollectionLogType.NO_PAGO) {
        if (onForceSync) onForceSync(false);
      }

      if (type === CollectionLogType.PAYMENT) {
        const installments = Array.isArray(activeLoanInLegajo.installments) ? activeLoanInLegajo.installments : [];

        // REGLA DE ORO: Recalcular histórico para el recibo
        const loanLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => log.loanId === activeLoanInLegajo.id && log.type === CollectionLogType.PAYMENT && !log.isOpening && !log.deletedAt);
        const totalPaidHistory = (Array.isArray(loanLogs) ? loanLogs : []).reduce((acc, log) => acc + (log.amount || 0), 0) + amountToPay;

        // AUTO-Cerrar crédito si el saldo llega a 0
        if (activeLoanInLegajo.totalAmount - totalPaidHistory <= 0.01 && updateLoan) {
          updateLoan({ ...activeLoanInLegajo, status: LoanStatus.PAID });
        }

        const progress = totalPaidHistory / (activeLoanInLegajo.installmentValue || 1);
        const paidInstCount = progress % 1 === 0 ? progress : Math.floor(progress * 10) / 10;

        const lastDueDate = installments.length > 0 ? installments[installments.length - 1].dueDate : activeLoanInLegajo.createdAt;

        const receiptText = generateReceiptText({
          clientName: clientInLegajo.name,
          amountPaid: amountToPay,
          previousBalance: Math.max(0, activeLoanInLegajo.totalAmount - (totalPaidHistory - amountToPay)),
          loanId: activeLoanInLegajo.id,
          startDate: activeLoanInLegajo.createdAt,
          expiryDate: lastDueDate,
          daysOverdue: getDaysOverdue(activeLoanInLegajo, state.settings, totalPaidHistory),
          remainingBalance: Math.max(0, activeLoanInLegajo.totalAmount - totalPaidHistory),
          paidInstallments: paidInstCount,
          totalInstallments: activeLoanInLegajo.totalInstallments,
          isRenewal: dossierIsRenewal,
          isVirtual: dossierIsVirtual,
          installmentValue: activeLoanInLegajo.installmentValue,
          totalPaidAmount: totalPaidHistory,
          principal: activeLoanInLegajo.totalAmount
        }, state.settings);

        // ALWAYS SHOW MODAL (Fixes "hanging" issue by avoiding window.open fallback)
        setReceipt(receiptText);

        // Attempt Automatic Print (Silent)
        const { printText } = await import('../services/bluetoothPrinterService');
        printText(receiptText).catch(err => console.warn("Auto-print failed:", err));

        // AUTOMATIZACIÓN TOTAL: Enviar por WhatsApp automáticamente
        const phone = clientInLegajo.phone.replace(/\D/g, '');
        const cleanReceipt = convertReceiptForWhatsApp(receiptText);
        const wpUrl = `https://wa.me/${phone.length === 10 ? '57' + phone : phone}?text=${encodeURIComponent(cleanReceipt)}`;
        window.open(wpUrl, '_blank');
      } else if (type === CollectionLogType.NO_PAGO) {
        const metrics = getClientMetrics(clientInLegajo);
        let msg = clientInLegajo.customNoPayMessage || await generateNoPaymentAIReminder(
          activeLoanInLegajo,
          clientInLegajo,
          metrics.daysOverdue,
          state.settings,
          metrics.balance
        );
        const cleanMsg = convertReceiptForWhatsApp(msg);
        window.open(`https://wa.me/${clientInLegajo.phone.replace(/\D/g, '')}?text=${encodeURIComponent(cleanMsg)}`, '_blank');
      }
    } catch (e) { console.error(e); } finally {
      setIsProcessingDossierAction(false);
      setShowDossierPaymentModal(false);
    }
  };

  const handleShareLegajo = async () => {
    if (!shareCardRef.current || !clientInLegajo || !activeLoanInLegajo) return;
    setIsSharing(true);
    try {
      // 1. MANEJO DE VISIBILIDAD MANUAL PARA ASEGURAR CAPTURA
      const shareContainer = document.getElementById('share-container-hidden');
      let originalStyle = '';

      if (shareContainer) {
        originalStyle = shareContainer.getAttribute('style') || '';
        shareContainer.style.position = 'fixed';
        shareContainer.style.left = '0';
        shareContainer.style.top = '0';
        shareContainer.style.opacity = '0.01'; // Casi invisible
        shareContainer.style.zIndex = '-9999';
        shareContainer.style.pointerEvents = 'none';
        shareContainer.style.display = 'block';
        shareContainer.style.visibility = 'visible';
      }

      // Delay para asegurar que el navegador aplique los estilos y renderice
      await new Promise(r => setTimeout(r, 1200));

      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#ffffff',
        scale: 6, // Full HD Resolution
        useCORS: true,
        logging: false,
        allowTaint: true,
        windowWidth: 700,
        width: 700,
        height: shareCardRef.current.scrollHeight,
      });

      const fileName = `Estado_Cuenta_${clientInLegajo.name.replace(/\s+/g, '_')}.png`;

      // LOGICA WEB (PC / MOBILE BROWSER)
      if (!Capacitor.isNativePlatform()) {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            alert("Error: No se pudo generar la imagen del reporte.");
            return;
          }
          const blobUrl = URL.createObjectURL(blob);
          const file = new File([blob], fileName, { type: 'image/png' });

          let sharedSuccessfully = false;
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: 'Estado de Cuenta',
                text: `Estado de Cuenta de ${clientInLegajo.name}`
              });
              sharedSuccessfully = true;
            } catch (err) {
              console.log("Web share cancelled or failed:", err);
            }
          }

          if (!sharedSuccessfully) {
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }, 'image/png');
      } else {
        // LÓGICA NATIVA (CAPACITOR)
        try {
          const base64Data = canvas.toDataURL('image/png').split(',')[1];
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const { Share } = await import('@capacitor/share');

          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });

          await Share.share({
            title: 'Estado de Cuenta',
            text: `Estado de Cuenta de ${clientInLegajo.name}`,
            url: savedFile.uri,
            dialogTitle: 'Compartir Estado de Cuenta'
          });
        } catch (err) {
          console.error("Native share failed:", err);
          alert("Error al compartir: " + (err instanceof Error ? err.message : String(err)));
        }
      }
    } catch (e) {
      console.error("Error generating/sharing dossier:", e);
      alert("Error al generar el reporte. Intente de nuevo.");
    } finally {
      // 2. Restauramos estilo original (oculto) SIEMPRE
      const shareContainer = document.getElementById('share-container-hidden');
      if (shareContainer) {
        shareContainer.style.position = 'fixed';
        shareContainer.style.left = '-5000px';
        shareContainer.style.top = '0';
        shareContainer.style.opacity = '0';
        shareContainer.style.pointerEvents = 'none';
        shareContainer.style.zIndex = '-1';
        shareContainer.style.display = 'block';
        shareContainer.style.visibility = 'hidden';
      }
      setIsSharing(false);
    }
  };

  const handleEditLog = (log: CollectionLog) => {
    setEditingLogId(log.id);
    setNewLogAmount(log.amount?.toString() || '');
    setShowEditLogModal(true);
  };

  const handleSaveEditedLog = () => {
    const amt = parseAmount(newLogAmount);
    if (editingLogId && updateCollectionLog && clientInLegajo && activeLoanInLegajo) {
      const logToEdit = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).find(l => l.id === editingLogId);
      if (!logToEdit) return;

      const oldAmount = logToEdit.amount || 0;
      updateCollectionLog(editingLogId, amt);

      const installments = Array.isArray(activeLoanInLegajo.installments) ? activeLoanInLegajo.installments : [];
      const currentTotalPaid = (Array.isArray(installments) ? installments : []).reduce((acc, inst) => acc + (inst.paidAmount || 0), 0);
      const newTotalPaid = currentTotalPaid - oldAmount + amt;

      const lastDueDate = installments.length > 0 ? installments[installments.length - 1].dueDate : activeLoanInLegajo.createdAt;

      const progress = newTotalPaid / (activeLoanInLegajo.installmentValue || 1);
      const paidInstCount = progress % 1 === 0 ? progress : Math.floor(progress * 10) / 10;

      const settingsToUse = logToEdit.companySnapshot || state.settings;

      const receiptText = generateReceiptText({
        clientName: clientInLegajo.name,
        amountPaid: amt,
        previousBalance: Math.max(0, activeLoanInLegajo.totalAmount - (newTotalPaid - amt)),
        loanId: activeLoanInLegajo.id,
        startDate: activeLoanInLegajo.createdAt,
        expiryDate: lastDueDate,
        daysOverdue: getDaysOverdue(activeLoanInLegajo, settingsToUse, newTotalPaid),
        remainingBalance: Math.max(0, activeLoanInLegajo.totalAmount - newTotalPaid),
        paidInstallments: paidInstCount,
        totalInstallments: activeLoanInLegajo.totalInstallments,
        isRenewal: logToEdit.isRenewal,
        isVirtual: logToEdit.isVirtual,
        installmentValue: activeLoanInLegajo.installmentValue,
        totalPaidAmount: newTotalPaid,
        principal: activeLoanInLegajo.totalAmount
      }, settingsToUse);

      const printWin = window.open('', '_blank', 'width=400,height=600');
      printWin?.document.write(`<html><body style="font-family:monospace;white-space:pre-wrap;padding:20px;font-size:12px;">${receiptText}</body></html>`);
      printWin?.print();

      const phone = clientInLegajo.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent("*COMPROBANTE DE CORRECCIÓN*\n" + receiptText)}`, '_blank');

      setShowEditLogModal(false);
      setEditingLogId(null);
      alert("Abono corregido. Se ha generado el ticket y enviado a WhatsApp.");
    }
  };

  const handleOpenCustomNoPay = () => {
    if (!clientInLegajo) return;
    setCustomNoPayText(clientInLegajo.customNoPayMessage || '');
    setShowCustomNoPayModal(true);
  };

  const handleSaveCustomNoPay = () => {
    if (!clientInLegajo || !updateClient) return;
    updateClient({ ...clientInLegajo, customNoPayMessage: customNoPayText });
    setShowCustomNoPayModal(false);
    alert("Mensaje guardado.");
  };

  const handleReprintLastReceipt = async () => {
    if (!clientInLegajo || !activeLoanInLegajo) return;

    // 1. Encontrar el ÚLTIMO pago registrado para este crédito (SIN IMPORTAR FECHA)
    const allPaymentLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : [])
      .filter(l => l.loanId === activeLoanInLegajo.id && l.type === CollectionLogType.PAYMENT && !l.isOpening);

    const lastPaymentLog = [...(Array.isArray(allPaymentLogs) ? allPaymentLogs : [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (!lastPaymentLog) {
      alert("No hay pagos registrados para este crédito.");
      return;
    }

    // 2. Recalcular el estado HISTÓRICO al momento de ese pago exacto
    // Sumamos todos los pagos HASTA ese log inclusive (por fecha)
    const historicLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(l =>
      l.loanId === activeLoanInLegajo.id &&
      l.type === CollectionLogType.PAYMENT &&
      !l.isOpening &&
      new Date(l.date).getTime() <= new Date(lastPaymentLog.date).getTime()
    );

    // Si hay logs con la misma fecha exacta, aseguramos incluir el target
    // (Ya está incluido por la lógica <=, pero si hay duplicados de timestamp, el ordenamiento previo asegura cual es cual. 
    // Aquí asumimos idempotencia simple: sumamos todo lo que tenga fecha <= al log target).

    const totalPaidAtThatMoment = (Array.isArray(historicLogs) ? historicLogs : []).reduce((acc, log) => acc + (log.amount || 0), 0);
    const amountPaidInLastLog = lastPaymentLog.amount || 0;

    const installments = Array.isArray(activeLoanInLegajo.installments) ? activeLoanInLegajo.installments : [];
    const lastDueDate = (Array.isArray(installments) && installments.length > 0) ? installments[installments.length - 1].dueDate : activeLoanInLegajo.createdAt;

    const progress = totalPaidAtThatMoment / (activeLoanInLegajo.installmentValue || 1);
    const paidInstCount = progress % 1 === 0 ? progress : Math.floor(progress * 10) / 10;

    const settingsToUse = lastPaymentLog.companySnapshot || state.settings;

    // 3. Generar Texto
    const receiptText = generateReceiptText({
      clientName: clientInLegajo.name,
      amountPaid: amountPaidInLastLog,
      previousBalance: Math.max(0, activeLoanInLegajo.totalAmount - (totalPaidAtThatMoment - amountPaidInLastLog)),
      loanId: activeLoanInLegajo.id,
      startDate: activeLoanInLegajo.createdAt,
      expiryDate: lastDueDate,
      daysOverdue: getDaysOverdue(activeLoanInLegajo, settingsToUse, totalPaidAtThatMoment), // Mora recalculada con el total a ese momento
      remainingBalance: Math.max(0, activeLoanInLegajo.totalAmount - totalPaidAtThatMoment),
      paidInstallments: paidInstCount,
      totalInstallments: activeLoanInLegajo.totalInstallments,
      isRenewal: lastPaymentLog.isRenewal,
      isVirtual: lastPaymentLog.isVirtual,
      installmentValue: activeLoanInLegajo.installmentValue,
      totalPaidAmount: totalPaidAtThatMoment,
      principal: activeLoanInLegajo.totalAmount
    }, settingsToUse);

    // 4. Imprimir vía Bluetooth
    const { printText } = await import('../services/bluetoothPrinterService');
    try {
      await printText(receiptText);
      alert("Reimpresi\u00f3n enviada a la impresora.");
    } catch (printErr) {
      console.error("Error direct printing:", printErr);
      alert("Error: No se pudo conectar con la impresora Bluetooth.");
    }
  };

  const handleRenewLoan = () => {
    if (!clientInLegajo || !addLoan) return;

    const p = Number(renewForm.principal) || 0;
    const i = Number(renewForm.interestRate) || 0;
    const inst = Number(renewForm.installments) || 0;

    const total = calculateTotalReturn(p, i);
    const newLoan: Loan = {
      id: generateUUID(),
      clientId: clientInLegajo.id,
      collectorId: currentUserId,
      principal: p,
      interestRate: i,
      totalInstallments: inst,
      frequency: renewForm.frequency,
      totalAmount: total,
      installmentValue: inst > 0 ? total / inst : 0,
      status: LoanStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      installments: generateAmortizationTable(p, i, inst, renewForm.frequency, new Date(), state.settings.country),
      isRenewal: true
    };
    addLoan(newLoan);

    // Cerrar cualquier crédito activo previo (Liquidación por renovación)
    const previousActiveLoans = (Array.isArray(state.loans) ? state.loans : []).filter(l => l.clientId === clientInLegajo.id && l.id !== newLoan.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT));
    previousActiveLoans.forEach(ol => {
      if (updateLoan) updateLoan({ ...ol, status: LoanStatus.PAID });
    });

    setShowRenewModal(false);
    if (onForceSync) onForceSync(false, "RENOVACIÓN REALIZADA CORRECTAMENTE");
  };

  const handlePrintCartera = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const collectorName = selectedCollector === 'all'
      ? 'TODOS'
      : collectors.find(c => c.id === selectedCollector)?.name || selectedCollector;

    const html = `
      <html>
        <head>
          <title>Cartera General - ${state.settings.companyName}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; }
            h1 { text-transform: uppercase; margin-bottom: 5px; font-size: 24px; color: #0f172a; }
            h2 { text-transform: uppercase; font-size: 14px; color: #64748b; margin-top: 0; margin-bottom: 30px; letter-spacing: 1px; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9; }
            .info-block { font-size: 12px; }
            .info-label { font-weight: 800; color: #94a3b8; text-transform: uppercase; font-size: 10px; margin-bottom: 4px; }
            .info-value { font-weight: 700; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #0f172a; color: white; text-align: left; padding: 12px 15px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
            td { padding: 12px 15px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 600; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .mora-high { color: #dc2626; font-weight: 900; }
            .mora-none { color: #059669; }
            .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; text-transform: uppercase; font-weight: 700; }
            @media print {
              @page { margin: 2cm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>${state.settings.companyName}</h1>
          <h2>Reporte de Cartera General</h2>
          
          <div class="header-info">
            <div class="info-block">
              <div class="info-label">Cobrador</div>
              <div class="info-value">${collectorName}</div>
            </div>
            <div class="info-block">
              <div class="info-label">Fecha del Reporte</div>
              <div class="info-value">${new Date().toLocaleDateString()}</div>
            </div>
            <div class="info-block text-right">
              <div class="info-label">Total Clientes</div>
              <div class="info-value">${carteraExcelData.length}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Registro</th>
                <th>Cliente / ID</th>
                <th>Teléfono</th>
                <th class="text-right">Crédito</th>
                <th class="text-center">Cuotas T/P</th>
                <th class="text-right">Saldo Actual</th>
                <th class="text-center">Progreso</th>
                <th class="text-center">Atraso</th>
              </tr>
            </thead>
            <tbody>
              ${carteraExcelData.map(client => `
                <tr>
                  <td>${client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '---'}</td>
                  <td>${client.name.toUpperCase()}<br/><span style="font-size: 9px; color: #94a3b8;">ID: ${client.documentId}</span></td>
                  <td>${client.phone}</td>
                  <td class="text-right">${formatCurrency(client._metrics.activeLoan?.totalAmount || 0, state.settings)}</td>
                  <td class="text-center">${client._metrics.cuotasTP}</td>
                  <td class="text-right">${formatCurrency(client._metrics.balance, state.settings)}</td>
                  <td class="text-center">${client._metrics.installmentsStr}</td>
                  <td class="text-center">
                    <span class="${client._metrics.daysOverdue > 0 ? 'mora-high' : 'mora-none'}">
                      ${client._metrics.daysOverdue > 0 ? `${client._metrics.daysOverdue} DÍAS` : 'AL DÍA'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Generado por Sistema de Cobros - ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    // Esperar a que las fuentes/estilos carguen si es necesario
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const collectorName = selectedCollector === 'all'
        ? 'TODOS'
        : collectors.find(c => c.id === selectedCollector)?.name || selectedCollector;

      // CONFIGURACIÓN DE ESTILOS
      const margin = 15;
      let y = 20;

      // ENCABEZADO
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(state.settings.companyName.toUpperCase(), margin, y);

      y += 8;
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("REPORTE DE CARTERA GENERAL", margin, y);

      y += 12;
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(margin, y, 210 - margin, y);

      y += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("COBRADOR:", margin, y);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(collectorName.toUpperCase(), margin + 25, y);

      doc.setTextColor(148, 163, 184);
      doc.text("FECHA:", 140, y);
      doc.setTextColor(30, 41, 59);
      doc.text(new Date().toLocaleDateString(), 155, y);

      y += 12;

      // TABLA HEADER
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, 180, 8, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text("CLIENTE / ID", margin + 2, y + 5.5);
      doc.text("TELÉFONO", margin + 50, y + 5.5);
      doc.text("CRÉDITO", margin + 85, y + 5.5, { align: 'right' });
      doc.text("CUOTAS T/P", margin + 105, y + 5.5, { align: 'center' });
      doc.text("SALDO", margin + 130, y + 5.5, { align: 'right' });
      doc.text("PROGRESO", margin + 155, y + 5.5, { align: 'center' });
      doc.text("MORA", margin + 175, y + 5.5, { align: 'center' });

      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);

      // CONTENIDO
      carteraExcelData.forEach((client, idx) => {
        // Salto de página
        if (y > 270) {
          doc.addPage();
          y = 20;

          // Re-dibujar header de tabla en nueva página
          doc.setFillColor(15, 23, 42);
          doc.rect(margin, y, 180, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.text("CLIENTE / ID", margin + 2, y + 5.5);
          doc.text("TELÉFONO", margin + 50, y + 5.5);
          doc.text("CRÉDITO", margin + 85, y + 5.5, { align: 'right' });
          doc.text("CUOTAS T/P", margin + 105, y + 5.5, { align: 'center' });
          doc.text("SALDO", margin + 130, y + 5.5, { align: 'right' });
          doc.text("PROGRESO", margin + 155, y + 5.5, { align: 'center' });
          doc.text("MORA", margin + 175, y + 5.5, { align: 'center' });
          y += 8;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 41, 59);
        }

        // Zebra striping
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, 180, 10, 'F');
        }

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(client.name.substring(0, 25).toUpperCase(), margin + 2, y + 4.5);
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text(`ID: ${client.documentId}`, margin + 2, y + 7.5);

        doc.setFontSize(7);
        doc.setTextColor(30, 41, 59);
        doc.text(client.phone, margin + 50, y + 6);

        doc.setFont("helvetica", "bold");
        doc.text(formatCurrency(client._metrics.activeLoan?.totalAmount || 0, state.settings), margin + 85, y + 6, { align: 'right' });

        doc.setFont("helvetica", "normal");
        doc.text(client._metrics.cuotasTP, margin + 105, y + 6, { align: 'center' });

        doc.setFont("helvetica", "bold");
        doc.text(formatCurrency(client._metrics.balance, state.settings), margin + 130, y + 6, { align: 'right' });

        doc.setFont("helvetica", "normal");
        doc.text(client._metrics.installmentsStr, margin + 155, y + 6, { align: 'center' });

        if (client._metrics.daysOverdue > 0) {
          doc.setTextColor(220, 38, 38);
          doc.setFont("helvetica", "bold");
          doc.text(`${client._metrics.daysOverdue} D`, margin + 175, y + 6, { align: 'center' });
        } else {
          doc.setTextColor(5, 150, 105);
          doc.text("OK", margin + 175, y + 6, { align: 'center' });
        }

        doc.setTextColor(30, 41, 59);
        y += 10;
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, 210 - margin, y);
      });

      // FOOTER
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`PÁGINA ${i} DE ${pageCount} | GENERADO EL ${new Date().toLocaleString()}`, 105, 290, { align: 'center' });
      }

      doc.save(`CARTERA_${collectorName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      alert("PDF GENERADO CORRECTAMENTE");
    } catch (err) {
      console.error(err);
      alert("ERROR AL GENERAR PDF");
    }
  };


  const handleFileUploadMasivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCollectorForImport) return;

    setIsProcessingExcel(true);
    try {
      const { clients, loans } = await processExcelImport(file, selectedCollectorForImport);

      for (const client of clients) {
        await addClient(client);
      }
      for (const loan of loans) {
        await addLoan(loan);
      }

      alert(`IMPORTACIÓN EXITOSA: ${clients.length} CLIENTES Y ${loans.length} PRÉSTAMOS.`);
      setShowImportModal(false);
      setSelectedCollectorForImport('');
    } catch (err) {
      console.error(err);
      alert("ERROR AL PROCESAR EL EXCEL. VERIFIQUE EL FORMATO.");
    } finally {
      setIsProcessingExcel(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <PullToRefresh onRefresh={async () => { await forceSync(); }}>
      <div className="space-y-4 md:space-y-6 pb-32 animate-fadeIn w-full px-1">
        <div className="bg-white p-2 rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap items-center gap-1">
          <button onClick={() => setViewMode('nuevos')} className={`flex-1 min-w-[120px] py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${viewMode === 'nuevos' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><i className="fa-solid fa-clipboard-list"></i> REGISTROS</button>
          <button onClick={() => setViewMode('gestion')} className={`flex-1 min-w-[120px] py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${viewMode === 'gestion' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><i className="fa-solid fa-user-plus"></i> AGREGAR</button>
          <button onClick={() => setViewMode('renovaciones')} className={`flex-1 min-w-[120px] py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${viewMode === 'renovaciones' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><i className="fa-solid fa-rotate"></i> RENOVACIONES</button>
          <button onClick={() => setViewMode('cartera')} className={`flex-1 min-w-[120px] py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${viewMode === 'cartera' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><i className="fa-solid fa-briefcase"></i> CARTERA</button>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-3xl md:rounded-[2rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full lg:w-auto">
            <h2 className="text-xl md:text-2xl font-black text-slate-950 uppercase tracking-tighter flex items-center gap-3">
              <i className={`fa-solid ${viewMode === 'gestion' ? 'fa-user-plus text-emerald-600' : viewMode === 'nuevos' ? 'fa-clipboard-list text-blue-600' : viewMode === 'renovaciones' ? 'fa-arrows-rotate text-orange-500' : 'fa-briefcase text-slate-950'}`}></i>
              {viewMode === 'gestion' ? 'Añadir Cliente' : viewMode === 'nuevos' ? 'Registros de Clientes' : viewMode === 'renovaciones' ? 'Cartera Renovada' : 'Cartera General'}
            </h2>

            {viewMode === 'cartera' && (
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={handlePrintCartera}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl font-black text-[9px] uppercase border border-slate-300 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-print text-xs text-indigo-500"></i> IMPRIMIR
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-black text-[9px] uppercase border border-red-200 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-file-pdf text-xs"></i> PDF
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[9px] uppercase border border-emerald-500 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Upload className="h-3 w-3" /> IMPORTAR
                </button>
                <button
                  onClick={() => exportClientsToExcel(filteredClients, state.loans)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[9px] uppercase border border-blue-500 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Download className="h-3 w-3" /> EXPORTAR
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {isAdminOrManager && (
              <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-2 w-full sm:w-auto">
                <span className="text-lg">👩‍🚀</span>
                <select
                  value={selectedCollector}
                  onChange={(e) => setSelectedCollector(e.target.value)}
                  className="bg-transparent border-none outline-none text-[10px] font-black text-slate-700 uppercase cursor-pointer w-full"
                >
                  <option value="all">TODOS</option>
                  {Array.isArray(collectors) && collectors.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {viewMode === 'cartera' || viewMode === 'nuevos' || viewMode === 'renovaciones' ? (
              <div className="flex flex-col sm:flex-row gap-3 w-full items-center">
                <div className="flex items-center justify-between gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300 shadow-inner w-full sm:w-auto">
                  <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="bg-transparent text-[9px] font-black text-slate-950 outline-none uppercase w-full" />
                  <span className="text-slate-500 font-bold">-</span>
                  <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="bg-transparent text-[9px] font-black text-slate-950 outline-none uppercase w-full" />
                </div>
              </div>
            ) : (
              <button onClick={() => setShowModal(true)} className="w-full sm:w-auto bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg active:scale-95 transition-all"><i className="fa-solid fa-user-plus mr-2"></i> NUEVO CLIENTE</button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Buscar por nombre o ID..."
              className="w-full bg-white border border-slate-300 rounded-2xl py-4 pl-12 pr-6 text-base font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm text-slate-950"
            />
            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"></i>
          </div>

          {viewMode === 'gestion' && (
            <div className="space-y-4">
              <div className="px-4 py-2 flex flex-col md:flex-row justify-between items-center gap-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg">
                  <i className="fa-solid fa-database mr-1"></i> Total: <span className="text-slate-700 font-bold">{filteredClients.length}</span> <span className="mx-2 text-slate-300">|</span> <i className="fa-solid fa-eye mr-1"></i> Viendo: <span className="text-slate-700 font-bold">{paginatedClients.length}</span>
                </div>
              </div>

              <div className="space-y-3 w-full max-w-5xl mx-auto">
                {paginatedClients.length === 0 && (
                  <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                      <i className="fa-solid fa-users-slash text-slate-300 text-xl"></i>
                    </div>
                    <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Lista de clientes vacía</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Cree un nuevo cliente para comenzar</p>
                  </div>
                )}
                {(Array.isArray(paginatedClients) ? paginatedClients : []).map((client) => {
                  const m = getClientMetrics(client);
                  return (
                    <div key={client.id} className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all flex flex-col md:flex-row items-center p-3 md:p-4 gap-3 md:gap-8 group relative">
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden shrink-0 shadow-inner">{client.profilePic ? <img src={client.profilePic} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400 text-xl md:text-2xl"><i className="fa-solid fa-user"></i></div>}</div>
                      <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 items-center">
                        <div>
                          <h3 className="text-sm md:text-base font-black text-slate-950 uppercase tracking-tight truncate flex items-center gap-2">
                            {client.name}
                            {m.hasMultipleLoans && (
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-orange-100 text-orange-600 rounded-full text-[10px] animate-pulse" title="Múltiples Préstamos Activos">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                              </span>
                            )}
                          </h3>
                          <p className="text-[8px] md:text-[9px] font-bold text-slate-600 uppercase tracking-widest">ID: {client.documentId}</p>
                        </div>
                        <div className="flex flex-col"><p className="text-[7px] md:text-[8px] font-black text-slate-600 uppercase mb-0.5 tracking-wider">Saldo</p><p className={`text-xs md:text-sm font-black ${m.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatCurrency(m.balance, state.settings)}</p></div>
                        <div className="flex flex-col"><p className="text-[7px] md:text-[8px] font-black text-slate-600 uppercase mb-0.5 tracking-wider">Progreso</p><p className="text-xs md:text-sm font-black text-slate-800">{m.installmentsStr}</p></div>
                        <div className="flex flex-col"><p className="text-[7px] md:text-[8px] font-black text-slate-600 uppercase mb-0.5 tracking-wider">Mora</p><p className={`text-xs md:text-sm font-black ${m.daysOverdue > 0 ? 'text-orange-700' : 'text-slate-500'}`}>{m.daysOverdue} Días</p></div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <button onClick={() => setShowLegajo(client.id)} className="flex-1 md:flex-none px-6 py-3 bg-blue-50 text-blue-800 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100">EXPEDIENTE</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CONTROLES DE PAGINACIÓN */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 py-6">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-12 h-12 bg-white border border-slate-200 rounded-xl text-slate-600 disabled:opacity-30 shadow-sm active:scale-95 transition-all flex items-center justify-center"
                  >
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>

                  <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      Página <span className="text-emerald-600 text-base">{currentPage}</span> / {totalPages}
                    </span>
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-12 h-12 bg-white border border-slate-200 rounded-xl text-slate-600 disabled:opacity-30 shadow-sm active:scale-95 transition-all flex items-center justify-center"
                  >
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {
          viewMode === 'nuevos' && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                      <th className="px-6 py-4">Fecha Alta</th>
                      <th className="px-6 py-4">Cliente / ID</th>
                      <th className="px-6 py-4">Teléfono</th>
                      <th className="px-6 py-4 text-right">Monto</th>
                      <th className="px-6 py-4 text-center">Int %</th>
                      <th className="px-6 py-4 text-right">Valor Cuota</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-[11px]">
                    {(Array.isArray(nuevosExcelData) ? nuevosExcelData : []).map(client => (
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 uppercase text-slate-500">{client._metrics.activeLoan?.createdAt ? new Date(client._metrics.activeLoan.createdAt).toLocaleDateString() : '---'}</td>
                        <td className="px-6 py-4 uppercase text-slate-900">{client.name}<br /><span className="text-[8px] text-slate-400">ID: {client.documentId}</span></td>
                        <td className="px-6 py-4 text-blue-600">{client.phone}</td>
                        <td className="px-6 py-4 text-right">{formatCurrency(client._metrics.activeLoan?.totalAmount || 0, state.settings)}</td>
                        <td className="px-6 py-4 text-center text-emerald-600">{client._metrics.activeLoan?.interestRate}%</td>
                        <td className="px-6 py-4 text-right font-mono">{formatCurrency(client._metrics.activeLoan?.installmentValue || 0, state.settings)}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setShowLegajo(client.id)} className="text-blue-500 hover:underline">VER</button>
                            {isAdminOrManager && (
                              <button onClick={() => handleToggleHideClient(client.id)} className="text-slate-400 hover:text-red-500 active:scale-90" title="Ocultar"><i className="fa-solid fa-eye-slash"></i></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {nuevosExcelData.length === 0 && (
                      <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400 uppercase tracking-widest">No hay registros para este periodo</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }

        {/* VISTA EXCEL: RENOVACIONES */}
        {
          viewMode === 'renovaciones' && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-orange-600 text-white text-[9px] font-black uppercase tracking-widest">
                      <th className="px-6 py-4">Fecha Renov.</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4 text-right">Monto</th>
                      <th className="px-6 py-4 text-center">Cuotas</th>
                      <th className="px-6 py-4 text-right">Atraso</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-[11px]">
                    {(Array.isArray(renovacionesExcelData) ? renovacionesExcelData : []).map(item => (
                      <tr key={item._loan!.id} className="hover:bg-orange-50 transition-colors">
                        <td className="px-6 py-4 uppercase text-slate-500">{new Date(item._loan!.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 uppercase text-slate-900">{item.name}</td>
                        <td className="px-6 py-4 text-right text-emerald-700">{formatCurrency(item._loan!.totalAmount, state.settings)}</td>
                        <td className="px-6 py-4 text-center">{item._loan!.totalInstallments}</td>
                        <td className="px-6 py-4 text-right font-mono text-red-600">{item._metrics.daysOverdue} d</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setShowLegajo(item.id)} className="text-orange-600 hover:underline">DETALLE</button>
                            {isAdminOrManager && (
                              <button onClick={() => handleToggleHideClient(item.id)} className="text-slate-400 hover:text-red-500 active:scale-90" title="Ocultar"><i className="fa-solid fa-eye-slash"></i></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {renovacionesExcelData.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 uppercase tracking-widest">No hay renovaciones en este periodo</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }

        {/* VISTA EXCEL: CARTERA GENERAL ORDENADA POR FECHA REGISTRO */}
        {
          viewMode === 'cartera' && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-950 text-white text-[9px] font-black uppercase tracking-widest">
                      <th className="px-6 py-4 flex items-center gap-1.5">
                        <select
                          value={carteraSortBy}
                          onChange={(e) => setCarteraSortBy(e.target.value as any)}
                          className="bg-slate-800 text-white border border-slate-700 outline-none uppercase font-black cursor-pointer rounded-md px-1.5 py-0.5 text-[7px] max-w-[85px] hover:border-slate-500 transition-colors shadow-inner"
                        >
                          <option value="registro">REGISTRO</option>
                          <option value="saldo">POR SALDO</option>
                          <option value="atraso">POR ATRASO</option>
                          <option value="renovaciones">POR RENOV.</option>
                        </select>
                      </th>
                      <th className="px-6 py-4">Cliente / ID</th>
                      <th className="px-6 py-4">Teléfono(s)</th>
                      <th className="px-6 py-4 text-center">Renov.</th>
                      <th className="px-6 py-4 text-right">Monto</th>
                      <th className="px-6 py-4 text-center">Cuotas T/P</th>
                      <th className="px-6 py-4 text-right">Saldo Actual</th>
                      <th className="px-6 py-4 text-center">Progreso</th>
                      <th className="px-6 py-4 text-center">Atraso</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-[11px]">
                    {(Array.isArray(carteraExcelData) ? carteraExcelData : []).map(client => (
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-slate-500 uppercase">{client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '---'}</td>
                        <td className="px-6 py-4 uppercase text-slate-900">{client.name}<br /><span className="text-[8px] text-slate-400">DOC: {client.documentId}</span></td>
                        <td className="px-6 py-4">
                          <p className="text-blue-700">{client.phone}</p>
                          {client.secondaryPhone && <p className="text-slate-400 text-[10px]">{client.secondaryPhone}</p>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                            {Array.isArray(state.loans) ? state.loans.filter(l => l.clientId === client.id && l.isRenewal).length : 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-900">{formatCurrency(client._metrics.activeLoan?.totalAmount || 0, state.settings)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-100">{client._metrics.cuotasTP}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-red-600">{formatCurrency(client._metrics.balance, state.settings)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{client._metrics.installmentsStr}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] ${client._metrics.daysOverdue > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {client._metrics.daysOverdue > 0 ? `${client._metrics.daysOverdue} d` : 'AL DÍA'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setShowLegajo(client.id)} className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center active:scale-90 transition-all" title="Expediente"><i className="fa-solid fa-folder-open text-[10px]"></i></button>
                            {isAdminOrManager && (
                              <button onClick={() => handleToggleHideClient(client.id)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-600 active:scale-90 transition-all" title="Ocultar Cliente"><i className="fa-solid fa-eye-slash text-[10px]"></i></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }

        {/* MODAL REGISTRO CLIENTE NUEVO */}
        {
          showModal && (
            <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[150] p-2 overflow-hidden pt-4 md:pt-10">
              <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[98vh] flex flex-col animate-scaleIn border border-white/20">
                <div className="p-4 md:p-5 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-white/10 sticky top-0 z-20">
                  <div><h3 className="text-base md:text-lg font-black uppercase tracking-tighter">Planilla Registro Cliente</h3><p className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest">Alta de expediente y documentación fotográfica</p></div>
                  <button onClick={() => setShowModal(false)} className="w-8 h-8 md:w-9 md:h-9 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all"><i className="fa-solid fa-xmark text-lg"></i></button>
                </div>
                <form onSubmit={handleSubmitNewClient} className="flex-1 overflow-y-auto p-3 md:p-5 space-y-6 bg-slate-50 mobile-scroll-container">
                  <div className="space-y-3">
                    <h4 className="text-[9px] font-black text-blue-800 uppercase tracking-widest border-l-4 border-blue-800 pl-2">I. Datos del Solicitante</h4>
                    <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-2">
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Nombre</div><input required type="text" value={clientData.name} onChange={(e: any) => setClientData({ ...clientData, name: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none" /></div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Cédula</div><input required type="text" value={clientData.documentId} onChange={(e: any) => setClientData({ ...clientData, documentId: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white outline-none" /></div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Nacionalidad</div><input type="text" value={clientData.nationality} onChange={(e: any) => setClientData({ ...clientData, nationality: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none" /></div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">F. Nacimiento</div><input type="date" value={clientData.birthDate} onChange={(e: any) => setClientData({ ...clientData, birthDate: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white outline-none" /></div>
                      <div className="flex border-b border-slate-200">
                        <div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Estado Civil</div>
                        <select value={clientData.maritalStatus} onChange={(e: any) => setClientData({ ...clientData, maritalStatus: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none">
                          <option value="">Seleccionar</option>
                          <option value="soltero">Soltero/a</option>
                          <option value="casado">Casado/a</option>
                          <option value="divorciado">Divorciado/a</option>
                          <option value="viudo">Viudo/a</option>
                        </select>
                      </div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Profesión</div><input type="text" value={clientData.profession} onChange={(e: any) => setClientData({ ...clientData, profession: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none" /></div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">WhatsApp 1</div><input required type="tel" value={clientData.phone} onChange={(e: any) => setClientData({ ...clientData, phone: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white outline-none" /></div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">WhatsApp 2</div><input type="tel" value={clientData.secondaryPhone} onChange={(e: any) => setClientData({ ...clientData, secondaryPhone: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white outline-none" /></div>
                      <div className="flex border-b border-slate-200 md:col-span-2">
                        <div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Email</div>
                        <input type="email" value={clientData.email} onChange={(e: any) => setClientData({ ...clientData, email: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white outline-none" />
                      </div>
                      <div className="flex col-span-1 md:col-span-2">
                        <div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Dirección</div>
                        <input required type="text" value={clientData.address} onChange={(e: any) => setClientData({ ...clientData, address: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none" />
                      </div>
                      <div className="flex col-span-1 md:col-span-2">
                        <div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Tipo de Cliente</div>
                        <input type="text" placeholder="Ej: F01 (Formal), E (Empleado)" value={clientData.clientType} onChange={(e: any) => setClientData({ ...clientData, clientType: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none" />
                      </div>
                    </div>

                    <h4 className="text-[9px] font-black text-emerald-800 uppercase tracking-widest border-l-4 border-emerald-800 pl-2 mt-4">II. Datos del Cónyuge</h4>
                    <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-2">
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Nombre</div><input type="text" value={clientData.spouseName} onChange={(e: any) => setClientData({ ...clientData, spouseName: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none" /></div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Cédula</div><input type="text" value={clientData.spouseDocumentId} onChange={(e: any) => setClientData({ ...clientData, spouseDocumentId: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white outline-none" /></div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">F. Nacimiento</div><input type="date" value={clientData.spouseBirthDate} onChange={(e: any) => setClientData({ ...clientData, spouseBirthDate: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white outline-none" /></div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Profesión</div><input type="text" value={clientData.spouseProfession} onChange={(e: any) => setClientData({ ...clientData, spouseProfession: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none" /></div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Lugar Trabajo</div><input type="text" value={clientData.spouseWorkplace} onChange={(e: any) => setClientData({ ...clientData, spouseWorkplace: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none" /></div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Tel. Laboral</div><input type="tel" value={clientData.spouseWorkPhone} onChange={(e: any) => setClientData({ ...clientData, spouseWorkPhone: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white outline-none" /></div>
                      <div className="flex md:col-span-2">
                        <div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Ingresos Mens.</div>
                        <input type="number" value={clientData.spouseIncome} onChange={(e: any) => setClientData({ ...clientData, spouseIncome: Number(e.target.value) })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white outline-none" />
                      </div>
                    </div>

                    <h4 className="text-[9px] font-black text-orange-800 uppercase tracking-widest border-l-4 border-orange-800 pl-2 mt-4">III. Información de Vivienda</h4>
                    <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-2">
                      <div className="flex border-b border-slate-200">
                        <div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Tipo Residencia</div>
                        <select value={clientData.residenceType} onChange={(e: any) => setClientData({ ...clientData, residenceType: e.target.value as any })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none">
                          <option value="propia">Propia</option>
                          <option value="alquilada">Alquilada</option>
                          <option value="familiar">Familiar</option>
                        </select>
                      </div>
                      <div className="flex border-b border-slate-200"><div className="w-28 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Antigüedad/Tpo</div><input type="text" value={clientData.residenceAntiquity} onChange={(e: any) => setClientData({ ...clientData, residenceAntiquity: e.target.value })} className="flex-1 px-3 py-3 text-xs font-bold bg-slate-800 text-white uppercase outline-none" /></div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      <div className="space-y-2">
                        <button type="button" onClick={() => handleCaptureLocation('home')} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md hover:bg-emerald-700 flex items-center justify-center gap-2 active:scale-95 transition-all">
                          {isCapturing && capturingType === 'home' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-house-circle-check"></i>}
                          MARCAR GPS CASA
                        </button>
                        {clientData.location && (
                          <div className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[8px] font-black uppercase text-center animate-fadeIn">
                            COORD: {clientData.location.lat.toFixed(6)}, {clientData.location.lng.toFixed(6)}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <button type="button" onClick={() => handleCaptureLocation('domicilio')} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md hover:bg-blue-700 flex items-center justify-center gap-2 active:scale-95 transition-all">
                          {isCapturing && capturingType === 'domicilio' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-briefcase"></i>}
                          MARCAR GPS NEGOCIO
                        </button>
                        {clientData.domicilioLocation && (
                          <div className="px-3 py-2 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-[8px] font-black uppercase text-center animate-fadeIn">
                            COORD: {clientData.domicilioLocation.lat.toFixed(6)}, {clientData.domicilioLocation.lng.toFixed(6)}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-2 col-span-1 sm:col-span-2">
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-l-4 border-slate-500 pl-2">IV. Documentación Fotográfica</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-200">
                          <PhotoUploadField label="Perfil" field="profilePic" value={clientData.profilePic || ''} onFileChange={handleFileChange} />
                          <PhotoUploadField label="Cédula" field="documentPic" value={clientData.documentPic || ''} onFileChange={handleFileChange} />
                          <PhotoUploadField label="Fachada" field="housePic" value={clientData.housePic || ''} onFileChange={handleFileChange} />
                          <PhotoUploadField label="Negocio" field="businessPic" value={clientData.businessPic || ''} onFileChange={handleFileChange} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {addInitialLoan && (
                    <div className="space-y-6">
                      <h4 className="text-[9px] font-black text-emerald-800 uppercase tracking-widest border-l-4 border-emerald-800 pl-2">IV. Configuración de Crédito y Calendario</h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm grid grid-cols-2">
                            <div className="flex border-b border-r border-slate-200"><div className="w-20 bg-emerald-700 px-3 py-3 text-[7px] font-black text-white flex items-center uppercase">Capital</div><input type="text" value={initialLoan.principal} onChange={(e: any) => setInitialLoan({ ...initialLoan, principal: e.target.value })} className="flex-1 px-3 py-3 text-xs font-black bg-emerald-600 text-white outline-none" /></div>
                            <div className="flex border-b border-slate-200"><div className="w-20 bg-emerald-700 px-3 py-3 text-[7px] font-black text-white flex items-center uppercase">Int. %</div><input type="text" value={initialLoan.interestRate} onChange={(e: any) => setInitialLoan((prev: any) => ({ ...prev, interestRate: e.target.value }))} className="flex-1 px-3 py-3 text-xs font-black bg-emerald-600 text-white outline-none" /></div>
                            <div className="flex border-r border-slate-200"><div className="w-20 bg-emerald-700 px-3 py-3 text-[7px] font-black text-white flex items-center uppercase">Cuotas</div><input type="text" value={initialLoan.installments} onChange={(e: any) => setInitialLoan((prev: any) => ({ ...prev, installments: e.target.value }))} className="flex-1 px-3 py-3 text-xs font-black bg-emerald-600 text-white outline-none" /></div>
                            <div className="flex"><div className="w-20 bg-slate-900 px-3 py-3 text-[7px] font-black text-white flex items-center uppercase">Finaliza</div><div className="flex-1 px-3 py-3 text-[9px] font-black bg-slate-800 text-white flex items-center">{initialLoan.endDate ? formatDate(initialLoan.endDate).toUpperCase() : '---'}</div></div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1">Tipo de Pago / Frecuencia</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {Object.values(Frequency).map((freq) => (
                                <button
                                  key={freq}
                                  type="button"
                                  onClick={() => setInitialLoan((prev: any) => ({ ...prev, frequency: freq }))}
                                  className={`py-2.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all border-2 ${initialLoan.frequency === freq ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-700 border-slate-300 active:border-emerald-200'}`}
                                >
                                  {freq}
                                </button>
                              ))}
                            </div>
                          </div>

                          {isAdminOrManager && (
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1">Asignar a Cobrador</label>
                              <select
                                value={initialLoan.selectedCollectorId}
                                onChange={e => setInitialLoan(prev => ({ ...prev, selectedCollectorId: e.target.value }))}
                                className="w-full py-3 px-4 bg-white border-2 border-slate-300 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all uppercase"
                              >
                                <option value="">{currentUserId === '00000000-0000-0000-0000-000000000001' || currentUserId === 'b3716a78-fb4f-4918-8c0b-92004e3d63ec' ? '-- SELECCIONAR COBRADOR --' : 'YO (POR DEFECTO)'}</option>
                                {Array.isArray(collectors) && collectors.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              <p className="text-[7px] text-slate-400 font-bold uppercase pl-1">Selecciona quién cobrará este crédito para que le aparezca en su celular</p>
                            </div>
                          )}
                        </div>
                        <GenericCalendar
                          startDate={initialLoan.startDate}
                          customHolidays={initialLoan.customHolidays}
                          setDate={(iso) => setInitialLoan((prev: any) => ({ ...prev, startDate: iso }))}
                          toggleHoliday={(iso) => setInitialLoan((prev: any) => prev.customHolidays.includes(iso) ? { ...prev, customHolidays: prev.customHolidays.filter((d: string) => d !== iso) } : { ...prev, customHolidays: [...prev.customHolidays, iso] })}
                        />
                      </div>
                    </div>
                  )}
                  <div className="pt-2 sticky bottom-0 bg-slate-50 z-10 pb-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`w-full py-4 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 active:scale-95 shadow-emerald-500/20'}`}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <i className="fa-solid fa-spinner animate-spin"></i> PROCESANDO...
                        </span>
                      ) : 'FINALIZAR REGISTRO Y CRONOGRAMA'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        }

        {/* LEGAJO / EXPEDIENTE DEL CLIENTE */}
        {
          showLegajo && clientInLegajo && (
            <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[120] p-2 overflow-hidden pt-2 md:pt-6">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-full md:h-[95vh] flex flex-col overflow-hidden animate-scaleIn">
                <div className="p-2 md:p-4 bg-[#0f172a] text-white shrink-0 flex flex-col md:flex-row md:justify-between md:items-center border-b border-white/10 sticky top-0 z-20 gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl border-2 border-white/10 overflow-hidden bg-white/5 shadow-xl shrink-0">{clientInLegajo.profilePic && <img src={clientInLegajo.profilePic} className="w-full h-full object-cover" />}</div>
                    <div className="min-w-0">
                      <h3 className="text-sm md:text-lg font-black uppercase tracking-tighter leading-tight truncate">{clientInLegajo.name}</h3>
                      <p className="text-[7px] md:text-[8px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 mt-0.5 truncate"><i className="fa-solid fa-location-dot"></i> {clientInLegajo.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {!isEditingClient && (
                      <>
                        <button
                          disabled={isSharing}
                          onClick={handleShareLegajo}
                          className={`px-3 py-2 bg-emerald-500 text-white rounded-lg font-black text-[8px] md:text-[9px] uppercase tracking-widest flex items-center gap-1.5 shadow-lg active:scale-95 transition-all ${isSharing ? 'opacity-50' : ''}`}
                        >
                          {isSharing ? <i className="fa-solid fa-spinner animate-spin text-xs"></i> : <i className="fa-brands fa-whatsapp text-xs"></i>}
                          <span className="hidden xs:inline">{isSharing ? 'GENERANDO...' : 'COMPARTIR'}</span>
                          {!isSharing && <span className="xs:hidden">ENVIAR</span>}
                        </button>
                        {isAdminOrManager && (
                          <>
                            <button onClick={() => setActiveTab?.('settings')} className="px-3 py-2 bg-blue-600 text-white rounded-lg font-black text-[8px] md:text-[9px] uppercase tracking-widest flex items-center gap-1.5 shadow-lg active:scale-95 transition-all">
                              <i className="fa-solid fa-building text-xs"></i>
                              <span className="hidden sm:inline">EDITAR EMPRESA</span>
                              <span className="sm:hidden text-[7px]">EMPRESA</span>
                            </button>
                            <button onClick={handleOpenCustomNoPay} className="px-3 py-2 bg-amber-500 text-white rounded-lg font-black text-[8px] md:text-[9px] uppercase tracking-widest flex items-center gap-1.5 shadow-lg active:scale-95 transition-all">
                              <i className="fa-solid fa-comment-slash text-xs"></i>
                              <span className="hidden sm:inline">EDITAR NO PAGO</span>
                              <span className="sm:hidden text-[7px]">NO PAGO</span>
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {(isAdminOrManager || clientInLegajo.allowCollectorLocationUpdate) && (
                      <button
                        onClick={isEditingClient ? () => setIsEditingClient(false) : handleStartEdit}
                        className={`px-3 py-2 rounded-lg font-black text-[8px] md:text-[9px] uppercase tracking-widest transition-all ${isEditingClient ? 'bg-red-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                      >
                        {isEditingClient ? 'CANCELAR' : 'EDITAR'}
                      </button>
                    )}
                    <button onClick={() => { setShowLegajo(null); setIsEditingClient(false); }} className="w-8 h-8 md:w-9 md:h-9 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all shrink-0"><i className="fa-solid fa-xmark text-lg"></i></button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-slate-50 space-y-4 mobile-scroll-container pb-20">
                  {!isEditingClient ? (
                    <>
                      <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-sm flex flex-wrap items-center justify-center gap-4 animate-fadeIn">
                        <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
                          <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">MAPA GPS:</span>
                          <button onClick={() => handleOpenMap(clientInLegajo.location)} className="px-4 py-2.5 bg-emerald-100 text-emerald-900 rounded-xl flex items-center gap-2 shadow-sm hover:bg-emerald-600 hover:text-white transition-all font-black text-[9px] uppercase"><i className="fa-solid fa-house"></i> CASA</button>
                          <button onClick={() => handleOpenMap(clientInLegajo.domicilioLocation)} className="px-4 py-2.5 bg-blue-100 text-blue-900 rounded-xl flex items-center gap-2 shadow-sm hover:bg-blue-600 hover:text-white transition-all font-black text-[9px] uppercase"><i className="fa-solid fa-briefcase"></i> NEGOCIO</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">CONTACTOS:</span>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => window.open(`https://wa.me/${clientInLegajo.phone.replace(/\D/g, '')}`, '_blank')}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-black text-[9px] flex items-center gap-2 border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                            >
                              <i className="fa-brands fa-whatsapp"></i> {clientInLegajo.phone}
                            </button>
                            {clientInLegajo.secondaryPhone && (
                              <button
                                onClick={() => window.open(`https://wa.me/${clientInLegajo.secondaryPhone?.replace(/\D/g, '')}`, '_blank')}
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-black text-[9px] flex items-center gap-2 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              >
                                <i className="fa-brands fa-whatsapp"></i> {clientInLegajo.secondaryPhone}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-3 space-y-4">
                          {activeLoanInLegajo ? (
                            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden" ref={statementRef}>
                              <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center"><h4 className="text-[9px] font-black text-slate-100 uppercase tracking-widest">Resumen Cuenta</h4><span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[8px] font-black rounded-md uppercase border border-emerald-500/30">En curso</span></div>
                              <div className="overflow-x-auto">
                                {(() => {
                                  const m = getClientMetrics(clientInLegajo!);
                                  return (
                                    <table className="w-full text-left border-collapse">
                                      <tbody className="divide-y divide-slate-800 text-slate-100 font-bold text-[10px] md:text-[11px]">
                                        <tr className="hover:bg-slate-800/50 transition-colors"><td className="p-3 text-slate-100 font-black uppercase text-[8px] tracking-widest border-r border-slate-800 w-1/2 bg-slate-800/20">Total del Crédito</td><td className="p-3 text-right font-black text-white">{formatCurrency(activeLoanInLegajo.totalAmount, state.settings)}</td></tr>
                                        <tr className="hover:bg-emerald-900/10 transition-colors"><td className="p-3 text-emerald-400 font-black uppercase text-[8px] tracking-widest border-r border-slate-800 bg-emerald-900/5">Abonado</td><td className="p-3 text-right font-black text-emerald-400">{formatCurrency(m.totalPaid, state.settings)}</td></tr>
                                        <tr className="hover:bg-red-900/10 transition-colors"><td className="p-3 text-red-400 font-black uppercase text-[8px] tracking-widest border-r border-slate-800 bg-red-900/5">Saldo Pendiente</td><td className="p-3 text-right font-black text-red-400">{formatCurrency(m.balance, state.settings)}</td></tr>
                                        <tr className="hover:bg-slate-800/50 transition-colors"><td className="p-3 text-slate-100 font-black uppercase text-[8px] tracking-widest border-r border-slate-800 bg-slate-800/20">Progreso Cuotas</td><td className="p-3 text-right font-black text-white">{m.installmentsStr}</td></tr>
                                      </tbody>
                                    </table>
                                  );
                                })()}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white p-10 rounded-3xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4 shadow-inner animate-fadeIn">
                              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 text-4xl">
                                <i className="fa-solid fa-money-bill-transfer"></i>
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">SIN PRÉSTAMOS ACTIVOS</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Este cliente no posee créditos vigentes en este momento.</p>
                              </div>
                              <button
                                onClick={() => setShowRenewModal(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-3 border border-blue-400/30"
                              >
                                <i className="fa-solid fa-plus-circle"></i> NUEVA RENOVACIÓN / CRÉDITO
                              </button>
                            </div>
                          )}

                          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
                            <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center"><h4 className="text-[9px] font-black text-slate-100 uppercase tracking-widest">Historial Reciente</h4><i className="fa-solid fa-clock-rotate-left text-slate-400"></i></div>
                            <div className="max-h-[400px] overflow-y-auto mobile-scroll-container">
                              <table className="w-full text-[10px] border-collapse min-w-[350px]">
                                <thead className="bg-slate-800 sticky top-0 font-black text-slate-100 border-b border-slate-700 uppercase tracking-widest">
                                  <tr><th className="px-4 py-3 text-left">Fecha / Hora</th><th className="px-4 py-3 text-left">Concepto</th><th className="px-4 py-3 text-right">Monto</th><th className="px-4 py-3 text-center">Acciones</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 font-bold">
                                  {(Array.isArray(clientHistory) ? clientHistory : []).map((log) => {
                                    const logDate = log.date ? new Date(log.date.split('T')[0] + 'T00:00:00') : null;
                                    const formattedDate = (logDate && !isNaN(logDate.getTime())) ? logDate.toLocaleDateString() : '---';
                                    const formattedTime = (logDate && !isNaN(logDate.getTime())) ? logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                                    // Determine if this is a loan grant entry
                                    const isLoanGrant = log.itemType === 'loan';

                                    return (
                                      <tr key={log.id} className="hover:bg-slate-800 transition-colors">
                                        <td className="px-4 py-3">
                                          <p className="text-slate-100 font-black">{formattedDate}</p>
                                          {formattedTime && <p className="text-[8px] text-slate-400 font-bold">{formattedTime}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                          <p className={`uppercase font-black text-[9px] ${isLoanGrant ? 'text-blue-400' :
                                            log.isOpening ? 'text-emerald-400' :
                                              log.type === CollectionLogType.PAYMENT ? 'text-slate-300' :
                                                'text-red-400'
                                            }`}>
                                            {isLoanGrant ? 'CRÉDITO' :
                                              log.isOpening ? 'Crédito Habilitado' :
                                                log.type === CollectionLogType.PAYMENT ? 'Abono Recibido' :
                                                  'Visita sin Pago'}
                                          </p>
                                        </td>
                                        <td className="px-4 py-3 text-right font-black font-mono text-xs text-white">
                                          {log.amount ? formatCurrency(log.amount, state.settings) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          {isAdminOrManager && !isLoanGrant && (
                                            <div className="flex items-center justify-center gap-1">
                                              {log.type === CollectionLogType.PAYMENT && (
                                                <button onClick={() => handleEditLog(log)} className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shadow-sm" title="Editar Pago"><i className="fa-solid fa-pen text-[10px]"></i></button>
                                              )}
                                              <button onClick={() => {
                                                if (confirm('¿BORRAR ESTE PAGO DEFINITIVAMENTE? SE REVERTIRÁN LOS SALDOS.')) {
                                                  deleteCollectionLog?.(log.id);
                                                  if (log.loanId && recalculateLoanStatus) {
                                                    // Pequeño delay para asegurar que el estado local se actualice antes del recalculo si es necesario
                                                    setTimeout(() => recalculateLoanStatus(log.loanId!), 500);
                                                  }
                                                }
                                              }} className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30 shadow-sm" title="Borrar Pago"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                                            </div>
                                          )}
                                          {isAdminOrManager && isLoanGrant && log.loanId && (
                                            <button
                                              onClick={() => { if (confirm('⚠️ ¿ELIMINAR ESTE CRÉDITO? Esta acción eliminará el crédito completo y no se puede deshacer.')) deleteLoan?.(log.loanId!); }}
                                              className="w-7 h-7 rounded-lg bg-red-600/30 text-red-400 flex items-center justify-center border border-red-500/40 shadow-sm"
                                              title="Eliminar Crédito"
                                            >
                                              <i className="fa-solid fa-trash-can text-[10px]"></i>
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center"><h4 className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Información Personal y Vivienda</h4><i className="fa-solid fa-house-user text-slate-400"></i></div>
                              <div className="p-0">
                                <table className="w-full text-left border-collapse">
                                  <tbody className="divide-y divide-slate-100 text-[10px] font-bold">
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] w-1/3 border-r border-slate-100">Nacionalidad</td><td className="p-2 uppercase text-slate-900">{clientInLegajo.nationality || '---'}</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">F. Nacimiento</td><td className="p-2 text-slate-900">{clientInLegajo.birthDate || '---'}</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">Estado Civil</td><td className="p-2 uppercase text-slate-900">{clientInLegajo.maritalStatus || '---'}</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">Profesión</td><td className="p-2 uppercase text-slate-900">{clientInLegajo.profession || '---'}</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">Email</td><td className="p-2 text-slate-900 lowercase">{clientInLegajo.email || '---'}</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">Residencia</td><td className="p-2 uppercase text-slate-900">{clientInLegajo.residenceType || '---'} ({clientInLegajo.residenceAntiquity || '---'})</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">Tipo de Cliente</td><td className="p-2 uppercase text-blue-800 font-black">{clientInLegajo.clientType || '---'}</td></tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center"><h4 className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Información del Cónyuge</h4><i className="fa-solid fa-heart text-red-400"></i></div>
                              <div className="p-0">
                                <table className="w-full text-left border-collapse">
                                  <tbody className="divide-y divide-slate-100 text-[10px] font-bold">
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] w-1/3 border-r border-slate-100">Nombre</td><td className="p-2 uppercase text-slate-900">{clientInLegajo.spouseName || '---'}</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">Cédula</td><td className="p-2 text-slate-900">{clientInLegajo.spouseDocumentId || '---'}</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">F. Nacimiento</td><td className="p-2 text-slate-900">{clientInLegajo.spouseBirthDate || '---'}</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">Profesión</td><td className="p-2 uppercase text-slate-900">{clientInLegajo.spouseProfession || '---'}</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">Lugar Trab.</td><td className="p-2 uppercase text-slate-900">{clientInLegajo.spouseWorkplace || '---'}</td></tr>
                                    <tr><td className="p-2 bg-slate-50/50 text-slate-500 uppercase text-[7px] border-r border-slate-100">Ingresos</td><td className="p-2 text-emerald-700 font-black">{formatCurrency(clientInLegajo.spouseIncome || 0, state.settings)}</td></tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>

                          {/* CRONOGRAMA DE PAGOS VISIBLE */}
                          {activeLoanInLegajo && (
                            <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden animate-fadeIn">
                              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <h4 className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Cronograma de Pagos</h4>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">{(Array.isArray(activeLoanInLegajo.installments) ? activeLoanInLegajo.installments : []).length} CUOTAS</span>
                              </div>
                              <div className="max-h-[600px] overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 mobile-scroll-container bg-slate-50/30">
                                {(() => {
                                  const m = getClientMetrics(clientInLegajo!);
                                  let remainingToAllocate = m.totalPaid;

                                  return (Array.isArray(activeLoanInLegajo.installments) ? activeLoanInLegajo.installments : []).map((inst, idx) => {
                                    const installmentAmount = inst.amount;
                                    let amountPaidForThisOne = 0;

                                    if (remainingToAllocate >= installmentAmount) {
                                      amountPaidForThisOne = installmentAmount;
                                      remainingToAllocate -= installmentAmount;
                                    } else if (remainingToAllocate > 0) {
                                      amountPaidForThisOne = remainingToAllocate;
                                      remainingToAllocate = 0;
                                    }

                                    const isPaid = amountPaidForThisOne >= installmentAmount;
                                    const isPartial = amountPaidForThisOne > 0 && amountPaidForThisOne < installmentAmount;

                                    return (
                                      <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${isPaid ? 'bg-emerald-50 border-emerald-200' : isPartial ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${isPaid ? 'bg-emerald-600 text-white' : isPartial ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                                            {inst.number}
                                          </div>
                                          <div className="flex flex-col">
                                            <span className={`text-[9px] font-black uppercase ${isPaid ? 'text-emerald-700' : 'text-slate-700'}`}>
                                              {(() => {
                                                if (!inst || !inst.dueDate) return '---';
                                                try {
                                                  const d = new Date(inst.dueDate.split('T')[0] + 'T00:00:00');
                                                  return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'numeric' }).replace('.', '').toUpperCase();
                                                } catch (e) {
                                                  return '---';
                                                }
                                              })()}
                                            </span>
                                            {isPartial && <span className="text-[7px] font-black text-emerald-600 uppercase">ABONO: {formatCurrency(amountPaidForThisOne, state.settings)}</span>}
                                            {isPaid && <span className="text-[7px] font-black text-emerald-700 uppercase">PAGADO</span>}
                                          </div>
                                        </div>
                                        <span className={`font-black text-xs ${isPaid ? 'text-emerald-700' : 'text-slate-900'}`}>
                                          {formatCurrency(installmentAmount, state.settings)}
                                        </span>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-sm space-y-3">
                            <h4 className="text-[9px] font-black text-slate-800 uppercase border-b border-slate-200 pb-1.5 tracking-widest">Fotos del Expediente</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {[{ key: 'profilePic', label: 'Perfil' }, { key: 'documentPic', label: 'Cédula' }, { key: 'businessPic', label: 'Negocio' }, { key: 'housePic', label: 'Fachada' }].map((item) => (
                                <div key={item.key} className="flex flex-col items-center">
                                  <div className="aspect-square w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center relative group">
                                    {clientInLegajo[item.key as keyof Client] ? (
                                      <img src={clientInLegajo[item.key as keyof Client] as string} className="w-full h-full object-cover cursor-zoom-in" onClick={() => handleViewPhotoAsPDF(clientInLegajo[item.key as keyof Client] as string, item.label, clientInLegajo)} alt={item.label} />
                                    ) : (
                                      <i className="fa-solid fa-image text-slate-400 text-xl"></i>
                                    )}
                                  </div>
                                  <span className="text-[7px] font-black text-slate-700 uppercase mt-1 tracking-wider">{item.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {activeLoanInLegajo && (
                            <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-lg overflow-hidden flex flex-col animate-fadeIn sticky bottom-4 z-10">
                              <div className="p-4 space-y-3 flex-1 bg-gradient-to-b from-white to-emerald-50/20">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Gestión Rápida</h4>
                                  {(() => { const m = getClientMetrics(clientInLegajo!); return (<span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase border ${m.daysOverdue > 0 ? 'bg-red-50 text-red-800 border-red-200 animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{m.daysOverdue > 0 ? `${m.daysOverdue} d mora` : 'Al Día'}</span>); })()}
                                </div>
                                <div className="bg-white p-3 rounded-xl space-y-2 border border-emerald-200 shadow-inner">
                                  <div className="flex justify-between items-center"><p className="text-[7px] font-black text-slate-700 uppercase">Valor Cuota</p><p className="text-base font-black text-blue-800 font-mono">{formatCurrency(activeLoanInLegajo.installmentValue, state.settings)}</p></div>
                                </div>
                              </div>
                              <div className="p-3 bg-white border-t border-slate-200 grid grid-cols-2 gap-2">
                                {(() => {
                                  const m = getClientMetrics(clientInLegajo!);
                                  const isFullyPaid = m.balance <= 0.01;
                                  return (
                                    <>
                                      <button onClick={() => handleDossierAction(CollectionLogType.NO_PAGO)} className="py-2.5 bg-slate-50 border border-slate-300 rounded-lg font-black text-[8px] text-red-700 uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95">No Pago</button>
                                      <button
                                        onClick={isFullyPaid ? () => setShowRenewModal(true) : handleOpenDossierPayment}
                                        className={`py-2.5 ${getRenewalButtonColor(m.maxDaysOverdue)} text-white rounded-lg font-black text-[8px] uppercase tracking-widest shadow-md transition-all active:scale-95`}
                                      >
                                        {isFullyPaid ? 'Renovar Crédito' : 'Cobrar / Renovación'}
                                      </button>
                                    </>
                                  );
                                })()}
                              </div>
                              <div className="px-3 pb-3 bg-white">
                                <button onClick={() => handleReprintLastReceipt()} className="w-full py-2.5 bg-slate-800 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-slate-700 transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2">
                                  <i className="fa-solid fa-print"></i> REIMPRIMIR ÚLTIMO RECIBO
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-300 shadow-sm max-w-5xl mx-auto space-y-10 animate-fadeIn pb-32 mobile-scroll-container">
                      <div className="flex justify-between items-center border-b border-slate-300 pb-3 sticky top-0 bg-white z-10">
                        <h4 className="text-lg font-black text-slate-950 uppercase tracking-tighter">Modificar Expediente Completo</h4>
                      </div>

                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-blue-800 uppercase tracking-widest border-l-4 border-blue-800 pl-2">I. Datos del Cliente</h5>
                        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-2 shadow-sm">
                          <div className="flex border-b md:border-r border-slate-800"><div className="w-24 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Nombre</div><input disabled={isCollector} type="text" value={editClientFormData?.name} onChange={e => setEditClientFormData(prev => prev ? { ...prev, name: e.target.value } : null)} className={`flex-1 px-3 py-3 text-xs font-bold bg-slate-950 text-white uppercase outline-none ${isCollector ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
                          <div className="flex border-b border-slate-800"><div className="w-24 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Cédula</div><input disabled={isCollector} type="text" value={editClientFormData?.documentId} onChange={e => setEditClientFormData(prev => prev ? { ...prev, documentId: e.target.value } : null)} className={`flex-1 px-3 py-3 text-xs font-bold bg-slate-950 text-white outline-none ${isCollector ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
                          <div className="flex border-b md:border-b-0 md:border-r border-slate-800"><div className="w-24 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">WhatsApp 1</div><input disabled={isCollector} type="tel" value={editClientFormData?.phone} onChange={e => setEditClientFormData(prev => prev ? { ...prev, phone: e.target.value } : null)} className={`flex-1 px-3 py-3 text-xs font-bold bg-slate-950 text-white outline-none ${isCollector ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
                          <div className="flex border-b md:border-b-0 border-slate-800"><div className="w-24 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">WhatsApp 2</div><input disabled={isCollector} type="tel" value={editClientFormData?.secondaryPhone} onChange={e => setEditClientFormData(prev => prev ? { ...prev, secondaryPhone: e.target.value } : null)} className={`flex-1 px-3 py-3 text-xs font-bold bg-slate-950 text-white outline-none ${isCollector ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
                          <div className="flex col-span-1 md:col-span-2 border-t border-slate-800">
                            <div className="w-24 bg-slate-900 px-3 py-3 text-[7px] font-black text-white uppercase flex items-center border-r border-white/10 shrink-0">Dirección</div>
                            <input disabled={isCollector} type="text" value={editClientFormData?.address} onChange={e => setEditClientFormData(prev => prev ? { ...prev, address: e.target.value } : null)} className={`flex-1 px-3 py-3 text-xs font-bold bg-slate-950 text-white uppercase outline-none ${isCollector ? 'opacity-50 cursor-not-allowed' : ''}`} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest border-l-4 border-emerald-600 pl-2">II. Ubicación GPS</h5>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-2">
                                <button type="button" onClick={() => handleCaptureLocation('home', true)} className="w-full py-3 bg-emerald-600/20 text-emerald-400 rounded-xl font-black text-[8px] uppercase tracking-widest border border-emerald-600/30 flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all">
                                  {isCapturing && capturingType === 'home' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-house-signal"></i>} Capturar Casa
                                </button>
                                {editClientFormData?.location && <div className="text-[7px] font-mono text-emerald-500 text-center">{editClientFormData.location.lat.toFixed(5)}, {editClientFormData.location.lng.toFixed(5)}</div>}
                              </div>
                              <div className="space-y-2">
                                <button type="button" onClick={() => handleCaptureLocation('domicilio', true)} className="w-full py-3 bg-blue-600/20 text-blue-400 rounded-xl font-black text-[8px] uppercase tracking-widest border border-blue-600/30 flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all">
                                  {isCapturing && capturingType === 'domicilio' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-briefcase"></i>} Capturar Negocio
                                </button>
                                {editClientFormData?.domicilioLocation && <div className="text-[7px] font-mono text-blue-500 text-center">{editClientFormData.domicilioLocation.lat.toFixed(5)}, {editClientFormData.domicilioLocation.lng.toFixed(5)}</div>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                              <div
                                onClick={() => setEditClientFormData(prev => prev ? { ...prev, allowCollectorLocationUpdate: !prev.allowCollectorLocationUpdate } : null)}
                                className={`w-10 h-6 rounded-full cursor-pointer transition-colors relative ${editClientFormData?.allowCollectorLocationUpdate ? 'bg-emerald-500' : 'bg-slate-700'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${editClientFormData?.allowCollectorLocationUpdate ? 'left-5' : 'left-1'}`}></div>
                              </div>
                              <span className="text-[8px] font-black text-slate-500 uppercase">Permitir a Cobrador actualizar GPS</span>
                            </div>

                            <div className="space-y-4">
                              <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-l-4 border-slate-500 pl-2">III. Documentación Fotográfica</h5>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-900/10">
                                <PhotoUploadField label="Perfil" field="profilePic" value={editClientFormData?.profilePic || ''} onFileChange={handleFileChange} forEdit={true} disabled={isCollector} />
                                <PhotoUploadField label="Cédula" field="documentPic" value={editClientFormData?.documentPic || ''} onFileChange={handleFileChange} forEdit={true} disabled={isCollector} />
                                <PhotoUploadField label="Fachada" field="housePic" value={editClientFormData?.housePic || ''} onFileChange={handleFileChange} forEdit={true} disabled={isCollector} />
                                <PhotoUploadField label="Negocio" field="businessPic" value={editClientFormData?.businessPic || ''} onFileChange={handleFileChange} forEdit={true} disabled={isCollector} />
                              </div>
                            </div>

                          </div>

                          {isAdminOrManager && editLoanFormData && (
                            <div className="space-y-4">
                              <h5 className="text-[10px] font-black text-orange-500 uppercase tracking-widest border-l-4 border-orange-500 pl-2">IV. Editar Crédito Activo</h5>
                              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden grid grid-cols-2">
                                <div className="flex border-b border-r border-slate-800 p-2 items-center gap-2">
                                  <label className="text-[7px] font-black text-slate-500 uppercase">Monto</label>
                                  <input type="text" value={editLoanFormData.principal} onChange={e => setEditLoanFormData((prev: any) => ({ ...prev, principal: e.target.value }))} className="flex-1 bg-transparent text-white font-black font-mono text-xs outline-none text-right" />
                                </div>
                                <div className="flex border-b border-slate-800 p-2 items-center gap-2">
                                  <label className="text-[7px] font-black text-slate-500 uppercase">Int %</label>
                                  <input type="text" value={editLoanFormData.interestRate} onChange={e => setEditLoanFormData((prev: any) => ({ ...prev, interestRate: e.target.value }))} className="flex-1 bg-transparent text-white font-black font-mono text-xs outline-none text-right" />
                                </div>
                                <div className="flex border-r border-slate-800 p-2 items-center gap-2">
                                  <label className="text-[7px] font-black text-slate-500 uppercase">Cuotas</label>
                                  <input type="text" value={editLoanFormData.totalInstallments} onChange={e => setEditLoanFormData((prev: any) => ({ ...prev, totalInstallments: e.target.value }))} className="flex-1 bg-transparent text-white font-black font-mono text-xs outline-none text-right" />
                                </div>
                                <div className="flex p-2 items-center gap-2">
                                  <label className="text-[7px] font-black text-slate-500 uppercase">Inicio</label>
                                  <input type="date" value={editLoanFormData.createdAt ? editLoanFormData.createdAt.split('T')[0] : ''} onChange={e => setEditLoanFormData((prev: any) => ({ ...prev, createdAt: e.target.value }))} className="flex-1 bg-transparent text-white font-black text-[9px] outline-none text-right uppercase" />
                                </div>
                                <div className="flex p-2 items-center gap-2 border-t border-slate-800 col-span-2">
                                  <label className="text-[7px] font-black text-slate-500 uppercase">Frecuencia</label>
                                  <select
                                    value={editLoanFormData.frequency}
                                    onChange={e => setEditLoanFormData((prev: any) => ({ ...prev, frequency: e.target.value }))}
                                    className="flex-1 bg-slate-900 text-white font-black text-[9px] outline-none text-right uppercase border-none focus:ring-0 cursor-pointer"
                                  >
                                    {Object.values(Frequency).map(f => <option key={f} value={f} className="bg-white text-slate-800">{f}</option>)}
                                  </select>
                                </div>
                              </div>
                              <p className="text-[8px] text-orange-400 italic text-center opacity-80">* Editar estos valores recalculará todo el cronograma.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-6 sticky bottom-0 bg-white/90 backdrop-blur-md z-10 pb-4">
                        <button onClick={handleSaveEditedClient} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                          <i className="fa-solid fa-cloud-arrow-up"></i>
                          {isCollector ? 'GUARDAR UBICACIONES' : 'GUARDAR TODOS LOS CAMBIOS'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div >
          )
        }

        {/* MODAL RENOVACIÓN / NUEVO CRÉDITO */}
        {
          showRenewModal && clientInLegajo && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-start justify-center z-[250] p-4 pt-10 md:pt-20">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-lg overflow-hidden animate-scaleIn border border-white/20">
                <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                  <h3 className="text-xl font-black uppercase tracking-tighter">Generar Nuevo Crédito</h3>
                  <button onClick={() => setShowRenewModal(false)}><i className="fa-solid fa-xmark text-xl"></i></button>
                </div>
                <div className="p-8 space-y-6 bg-slate-50">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Capital a Prestar</label>
                        <input type="text" value={renewForm.principal} onChange={e => setRenewForm({ ...renewForm, principal: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 font-black text-lg outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Interés %</label>
                        <input type="text" value={renewForm.interestRate} onChange={e => setRenewForm({ ...renewForm, interestRate: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 font-black text-lg outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Cantidad de Cuotas</label>
                      <input type="text" value={renewForm.installments} onChange={e => setRenewForm({ ...renewForm, installments: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 font-black text-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <button onClick={handleRenewLoan} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95">CONFIRMAR E INICIAR CRÉDITO</button>
                </div>
              </div>
            </div>
          )
        }

        {/* MODAL COBRO / LIQUIDACIÓN DENTRO DEL EXPEDIENTE */}
        {
          showDossierPaymentModal && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-start justify-center z-[200] p-2 overflow-y-auto pt-10 md:pt-20">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-sm overflow-hidden animate-scaleIn border border-white/20">
                <div className="p-5 md:p-6 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-10">
                  <h3 className="text-base md:text-lg font-black uppercase tracking-tighter">Registrar Gestión</h3>
                  <button onClick={() => setShowDossierPaymentModal(false)} className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all"><i className="fa-solid fa-xmark text-lg"></i></button>
                </div>
                <div className="p-5 md:p-6 space-y-4 md:space-y-6">
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setDossierPaymentMethod('cash')} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${!dossierIsVirtual && !dossierIsRenewal ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Efectivo</button>
                    <button onClick={() => setDossierPaymentMethod('virtual')} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${dossierIsVirtual ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Transf.</button>
                    <button onClick={() => setDossierPaymentMethod('renewal')} className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${dossierIsRenewal ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Renovar</button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">$</span>
                    <input type="text" autoFocus value={dossierPaymentAmount} onChange={(e) => setDossierPaymentAmount(e.target.value)} className="w-full pl-12 pr-5 py-8 md:py-10 bg-slate-50 border border-slate-200 rounded-2xl md:rounded-[2.5rem] text-3xl md:text-5xl font-black text-center text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/20 shadow-inner" />
                    {dossierIsRenewal && (
                      <div className="text-center mt-2">
                        <span className="text-xs font-black text-amber-600 uppercase tracking-wider">
                          💰 Saldo Pendiente para Cancelar Crédito
                        </span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleDossierAction(CollectionLogType.PAYMENT)} disabled={isProcessingDossierAction} className="w-full py-4 md:py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl md:rounded-[2rem] font-black uppercase text-xs md:text-sm tracking-widest shadow-2xl active:scale-95 transition-all">
                    {isProcessingDossierAction ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Confirmar Registro'}
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* MODAL EDICIÓN LOG PAGO */}
        {
          showEditLogModal && (
            <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[200] p-4 pt-10 md:pt-20">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-scaleIn">
                <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                  <h3 className="text-lg font-black uppercase">Corregir Pago</h3>
                  <button onClick={() => setShowEditLogModal(false)}><i className="fa-solid fa-xmark text-xl"></i></button>
                </div>
                <div className="p-8 space-y-6">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xl font-black">$</span>
                    <input type="text" value={newLogAmount} onChange={e => setNewLogAmount(e.target.value)} className="w-full pl-10 pr-4 py-6 text-3xl font-black text-center bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500" />
                  </div>
                  <button onClick={handleSaveEditedLog} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl">GUARDAR CORRECCIÓN</button>
                </div>
              </div>
            </div>
          )
        }

        {/* MODAL NOTA NO PAGO */}
        {
          showCustomNoPayModal && (
            <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[200] p-4 pt-10 md:pt-20">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-md overflow-hidden animate-scaleIn">
                <div className="p-6 bg-amber-500 text-white flex justify-between items-center">
                  <h3 className="text-lg font-black uppercase">Mensaje Personalizado Mora</h3>
                  <button onClick={() => setShowCustomNoPayModal(false)}><i className="fa-solid fa-xmark text-xl"></i></button>
                </div>
                <div className="p-8 space-y-6">
                  <textarea value={customNoPayText} onChange={e => setCustomNoPayText(e.target.value)} placeholder="Ej: Hola, registramos su mora. Favor pagar mañana sin falta..." className="w-full h-32 p-4 rounded-xl border border-slate-300 font-bold outline-none focus:ring-2 focus:ring-amber-500"></textarea>
                  <button onClick={handleSaveCustomNoPay} className="w-full py-4 bg-amber-500 text-white rounded-xl font-black uppercase tracking-widest shadow-xl">GUARDAR MENSAJE</button>
                </div>
              </div>
            </div>
          )
        }
        {/* TARJETA DE ESTADO DE CUENTA PROFESIONAL (OCULTA PARA CAPTURA) */}
        {isSharing && (
          <div id="share-container-hidden" style={{ position: 'fixed', left: '-5000px', top: '0', opacity: '0', pointerEvents: 'none', zIndex: -1 }}>
            <div ref={shareCardRef} className="w-[640px] bg-white text-slate-900 font-sans relative" style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
              {/* COMPACT HEADER */}
              <div className="bg-[#1e293b] px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#10b981] rounded-xl flex items-center justify-center text-2xl text-white shadow-lg overflow-hidden">
                    <i className="fa-solid fa-sack-dollar"></i>
                  </div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-widest mb-1">{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</p>
                    <h1 className="text-2xl font-black text-white tracking-tight uppercase leading-none">{clientInLegajo?.name}</h1>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{clientInLegajo?.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1$2$3') || ''} / {clientInLegajo?.secondaryPhone?.replace(/(\d{3})(\d{4})(\d{4})/, '$1$2$3') || ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-[#10b981] text-white text-[9px] font-black rounded-lg uppercase tracking-wider">ACTIVO</span>
                  <div className="text-right">
                    <p className="text-xs font-black text-white uppercase tracking-widest">TOTAL: {formatCurrency(activeLoanInLegajo?.totalAmount || 0, state.settings)}</p>
                    <p className="text-xs font-black text-[#10b981] uppercase tracking-widest">ABONADO: {formatCurrency(getClientMetrics(clientInLegajo!).totalPaid, state.settings)}</p>
                    <p className="text-xs font-black text-red-500 uppercase tracking-widest">SALDO: {formatCurrency(getClientMetrics(clientInLegajo!).balance, state.settings)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 space-y-4">
                {/* INSTALLMENTS GRID */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">CRONOGRAMA - {(Array.isArray(activeLoanInLegajo?.installments) ? activeLoanInLegajo.installments : []).length} CUOTAS</h3>

                  <div className="grid grid-cols-6 gap-2">
                    {(() => {
                      const m = getClientMetrics(clientInLegajo!);
                      let remainingToAllocate = m.totalPaid;

                      return (Array.isArray(activeLoanInLegajo?.installments) ? activeLoanInLegajo.installments : []).map((inst, idx) => {

                        const installmentAmount = inst.amount;
                        let amountPaidForThisOne = 0;

                        if (remainingToAllocate >= installmentAmount) {
                          amountPaidForThisOne = installmentAmount;
                          remainingToAllocate -= installmentAmount;
                        } else if (remainingToAllocate > 0) {
                          amountPaidForThisOne = remainingToAllocate;
                          remainingToAllocate = 0;
                        }

                        const isPaid = amountPaidForThisOne >= installmentAmount;
                        const isPartial = amountPaidForThisOne > 0 && amountPaidForThisOne < installmentAmount;
                        const pendingAmount = installmentAmount - amountPaidForThisOne;

                        return (
                          <div key={idx} className={`flex flex-col p-2 rounded-lg border ${isPaid ? 'bg-[#f0fdf4] border-[#bbf7d0]' : isPartial ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
                            <div className="flex justify-between items-center mb-0.5 leading-none">
                              <span className={`text-[11px] font-black ${isPaid ? 'text-[#10b981]' : 'text-slate-800'}`}>#{inst.number}</span>
                              <span className={`text-[9px] font-black uppercase ${isPaid ? 'text-[#15803d]' : 'text-[#1e293b]'}`}>
                                {(() => {
                                  if (!inst || !inst.dueDate) return '---';
                                  try {
                                    const d = new Date(inst.dueDate + 'T00:00:00');
                                    return isNaN(d.getTime()) ? '---' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' });
                                  } catch (e) {
                                    return '---';
                                  }
                                })()}
                              </span>
                            </div>
                            <p className={`text-lg font-black leading-none mt-0.5 mb-1 ${isPaid ? 'text-[#166534]' : 'text-[#1e293b]'}`}>
                              {formatCurrency(installmentAmount, state.settings)}
                            </p>
                            {isPartial && (
                              <div className="flex flex-col gap-0.5">
                                <p className="text-[8px] font-black text-emerald-600 uppercase leading-none whitespace-nowrap tracking-tight">✓ Pagado: {formatCurrency(amountPaidForThisOne, state.settings)}</p>
                                <p className="text-[8px] font-black text-red-600 uppercase leading-none whitespace-nowrap tracking-tight">Pendiente: {formatCurrency(pendingAmount, state.settings)}</p>
                              </div>
                            )}
                            {isPaid && (
                              <p className="text-[8px] font-black text-[#10b981] uppercase leading-none mt-0.5 whitespace-nowrap tracking-tight">✓ Pagado: {formatCurrency(amountPaidForThisOne, state.settings)}</p>
                            )}
                            {!isPaid && !isPartial && (
                              <p className="text-[8px] font-black text-red-600 uppercase leading-none mt-0.5 whitespace-nowrap tracking-tight">Pendiente: {formatCurrency(pendingAmount, state.settings)}</p>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="bg-[#d1fae5] px-6 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#10b981] rounded-full flex items-center justify-center text-white text-xl shadow-md">
                    <i className="fa-brands fa-whatsapp"></i>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-[#166534] uppercase tracking-widest">MARCA</p>
                    <p className="text-2xl font-black text-[#1e293b] tracking-tight leading-none mb-1">{state.settings.companyAlias || state.settings.companyName || 'ANEXO S.A'}</p>
                    <p className="text-[8px] font-black text-[#166534] uppercase tracking-widest">SOPORTE DIRECTO</p>
                    <p className="text-xl font-black text-[#1e293b] tracking-tight leading-none">{state.settings.contactPhone || '3333333333'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-[#166534] uppercase tracking-widest">BANCO O FINANCIERA</p>
                  <p className="text-xl font-black text-[#1e293b] tracking-tight leading-none">{state.settings.shareLabel || 'BANCO FAMILIAR'}</p>
                  <p className="text-[8px] font-black text-[#166534] uppercase tracking-widest mt-1">NUMERO DE CUENTA O ALIAS DE LA EMPRESA</p>
                  <p className="text-xl font-black text-[#1e293b] tracking-tight leading-none">{state.settings.shareValue || '3.770.096'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {
          receipt && (
            <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[210] p-4 overflow-y-auto pt-10 md:pt-20">
              <div className="bg-white rounded-[2rem] text-center max-w-sm w-full animate-scaleIn shadow-2xl overflow-hidden">
                {/* Header de navegación en el ticket */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 italic bg-white sticky top-0">
                  <button onClick={() => setReceipt(null)} className="text-slate-400 hover:text-slate-600 transition-all active:scale-90">
                    <i className="fa-solid fa-arrow-left text-lg"></i>
                  </button>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Vista de Comprobante</span>
                  <button onClick={() => setReceipt(null)} className="text-slate-400 hover:text-red-500 transition-all active:scale-90">
                    <i className="fa-solid fa-xmark text-xl"></i>
                  </button>
                </div>

                <div className="p-6 md:p-8">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl shadow-xl border border-green-200">
                    <i className="fa-solid fa-check-double"></i>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">¡Gestión Exitosa!</h3>
                  <div className="bg-slate-50 p-4 md:p-6 rounded-xl md:rounded-2xl font-mono text-[9px] md:text-[10px] text-left mb-8 max-h-60 overflow-y-auto border border-slate-200 text-black font-black shadow-inner whitespace-pre-wrap leading-relaxed">
                    {receipt}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setReceipt(null)} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">
                      Finalizar y Salir
                    </button>
                    <button
                      onClick={async () => {
                        const { printText } = await import('../services/bluetoothPrinterService');
                        printText(receipt || '').catch(e => alert("Error impresi\u00f3n: " + e));
                      }}
                      className="w-full py-4 bg-purple-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-print mr-2"></i> Re-Imprimir Ticket
                    </button>
                    <button
                      onClick={() => {
                        const phone = clientInLegajo?.phone.replace(/\D/g, '') || '';
                        const wpUrl = `https://wa.me/${phone.length === 10 ? '57' + phone : phone}?text=${encodeURIComponent(receipt || '')}`;
                        window.open(wpUrl, '_blank');
                      }}
                      className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                      <i className="fa-brands fa-whatsapp mr-2"></i> Enviar por WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }
        {showImportModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 z-[9999] animate-fadeIn pt-10 md:pt-20">
            <div className="bg-slate-900 rounded-[2rem] p-8 border border-white/10 w-full max-w-md shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>

              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                <Upload className="text-emerald-500" /> IMPORTAR CARTERA
              </h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">
                Sube tu archivo Excel (45 Columnas)
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
                    1. Asignar a Cobrador / Ruta
                  </label>
                  <div className="bg-slate-800 rounded-2xl border border-slate-700 p-1">
                    <select
                      className="w-full bg-transparent p-3 text-white font-bold outline-none cursor-pointer text-sm"
                      value={selectedCollectorForImport}
                      onChange={(e) => setSelectedCollectorForImport(e.target.value)}
                    >
                      <option value="">-- SELECCIONAR DESTINO --</option>
                      {collectors.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all relative ${!selectedCollectorForImport ? 'border-slate-800 bg-slate-900/50 opacity-50 cursor-not-allowed' : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer'}`}>
                  {isProcessingExcel ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-emerald-500 font-black text-[10px] uppercase">Procesando...</span>
                    </div>
                  ) : (
                    <>
                      <i className="fa-solid fa-file-excel text-4xl text-emerald-500 mb-4 scale-animation"></i>
                      <span className="text-slate-300 font-bold text-sm text-center">
                        {selectedCollectorForImport ? 'Click para subir Excel' : 'Selecciona un cobrador primero'}
                      </span>
                      {selectedCollectorForImport && (
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          onChange={handleFileUploadMasivo}
                        />
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    className="flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                    onClick={() => setShowImportModal(false)}
                    disabled={isProcessingExcel}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
};

export default Clients;

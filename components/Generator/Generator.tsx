import React, { useState, useEffect, useRef } from 'react';
import {
    History,
    Save,
    Printer,
    Trash2,
    X,
    FileDown,
    Search,
    Copy,
    Edit3,
    ChevronDown,
    BookmarkPlus,
    BookOpen,
    Maximize2,
    FileBox,
    Pencil
} from 'lucide-react';
import type { DocumentData, TextTemplate, PaperSize } from './types';
import { DocumentType } from './types';
import { numberToWordsSpanish } from './utils/numberToWords';
import { jsPDF } from 'jspdf';
import SignaturePad from './SignaturePad';
import { generateBluetoothTicket } from './utils/generateTicket';
import { AppSettings } from '../../types';

interface GeneratorProps {
    settings?: AppSettings;
}

const DEFAULT_PAGARE_TEXT = `El día[FECHA] Pagaré(mos) solidariamente libre de gastos y sin Presto a su orden, en el domicilio[DOMICILIO] La cantidad de [MONEDA_NOMBRE] [MONTO_LETRAS].

Por el valor recibido en[CONCEPTO] A mi entera satisfacción.En caso de que este documento no fuese abonado en el día del vencimiento se constituirá(n) el(los) deudor(res) en mora y sin intimación judicial ni extrajudicial el pago; originando también una pena de ...% mensual con el pago de la pena no se entiende extinguida la obligación principal, además de los intereses y comisiones pactados, que continuarán devengándose hasta el reembolso total del crédito, sin que implique novación, prórroga o espera, a todos los efectos legales acepto(amos) la jurisdicción del juzgado de Paz de la ciudad de Villa Elisa.`;

const DEFAULT_RECIBO_TEXT = `Recibí de[DEUDOR_NOMBRE] la cantidad de [MONEDA_NOMBRE] [MONTO_LETRAS] por concepto de[CONCEPTO].`;

const DEFAULT_MANUAL_TEXT = `Escriba aquí el contenido de su documento...`;

const CURRENCIES = [
    { symbol: 'Gs.', name: 'GUARANIES' },
    { symbol: 'AR$', name: 'PESOS ARGENTINOS' },
    { symbol: 'R$', name: 'REALES BRASILEROS' },
    { symbol: 'UY$', name: 'PESOS URUGUAYOS' },
    { symbol: 'CL$', name: 'PESOS CHILENOS' },
    { symbol: 'CO$', name: 'PESOS COLOMBIANOS' },
    { symbol: 'MX$', name: 'PESOS MEXICANOS' },
    { symbol: 'S/', name: 'SOLES' },
    { symbol: 'Bs', name: 'BOLIVIANOS' },
    { symbol: 'Bs.', name: 'BOLIVARES' },
    { symbol: 'US$', name: 'DOLARES' },
    { symbol: '€', name: 'EUROS' },
    { symbol: '₡', name: 'COLONES' },
    { symbol: 'RD$', name: 'PESOS DOMINICANOS' },
    { symbol: 'B/.', name: 'BALBOAS' },
    { symbol: 'Q', name: 'QUETZALES' },
    { symbol: 'L', name: 'LEMPIRAS' },
    { symbol: 'C$', name: 'CORDOBAS' },
];

const Generator: React.FC<GeneratorProps> = ({ settings }) => {
    const [documents, setDocuments] = useState<DocumentData[]>([]);
    const [templates, setTemplates] = useState<TextTemplate[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSidebarTab, setActiveSidebarTab] = useState<'history' | 'templates'>('history');
    const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
    const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
    const [isPaperMenuOpen, setIsPaperMenuOpen] = useState(false);
    const [paperSize, setPaperSize] = useState<PaperSize>('A4');
    const [signature, setSignature] = useState<string | null>(null);

    // Bluetooth Printer State
    const [showPrinterModal, setShowPrinterModal] = useState(false);
    const [printerDevices, setPrinterDevices] = useState<any[]>([]);
    const [scanningPrinters, setScanningPrinters] = useState(false);
    const [connectedDevice, setConnectedDevice] = useState<string | null>(localStorage.getItem('printer_name'));

    const currencyMenuRef = useRef<HTMLDivElement>(null);
    const templateMenuRef = useRef<HTMLDivElement>(null);
    const paperMenuRef = useRef<HTMLDivElement>(null);
    const printFrameRef = useRef<HTMLIFrameElement>(null);

    const [formData, setFormData] = useState<Partial<DocumentData>>({
        type: DocumentType.PAGARE,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        amount: 0,
        currencySymbol: 'Gs.',
        currencyName: 'GUARANIES',
        amountInWords: '',
        concept: '',
        folio: '',
        debtorName: '',
        beneficiaryName: '',
        documentIdNumber: '',
        phoneNumber: '',
        paymentMethod: 'Efectivo',
        legalText: DEFAULT_PAGARE_TEXT,
    });

    useEffect(() => {
        const savedDocs = localStorage.getItem('offline_docs');
        const savedTemplates = localStorage.getItem('text_templates');
        const savedPaper = localStorage.getItem('paper_size') as PaperSize;
        if (savedDocs) setDocuments(JSON.parse(savedDocs));
        if (savedTemplates) setTemplates(JSON.parse(savedTemplates));
        if (savedPaper) setPaperSize(savedPaper);
    }, []);

    useEffect(() => {
        if (formData.amount !== undefined && formData.type !== DocumentType.MANUAL) {
            const words = numberToWordsSpanish(formData.amount || 0);
            setFormData(prev => ({ ...prev, amountInWords: words }));
        }
    }, [formData.amount, formData.type]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (currencyMenuRef.current && !currencyMenuRef.current.contains(event.target as Node)) {
                setIsCurrencyMenuOpen(false);
            }
            if (templateMenuRef.current && !templateMenuRef.current.contains(event.target as Node)) {
                setIsTemplateMenuOpen(false);
            }
            if (paperMenuRef.current && !paperMenuRef.current.contains(event.target as Node)) {
                setIsPaperMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const saveToHistory = () => {
        if (formData.type !== DocumentType.MANUAL && (!formData.debtorName || !formData.amount)) {
            alert("Complete campos obligatorios (Nombre y Monto)");
            return;
        }
        const newDoc: DocumentData = {
            ...formData as DocumentData,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            folio: formData.folio || new Date().getTime().toString().slice(-4)
        };
        const updated = [newDoc, ...documents];
        setDocuments(updated);
        localStorage.setItem('offline_docs', JSON.stringify(updated));
        alert("Documento guardado.");
        resetForm();
    };

    const resetForm = () => {
        setFormData({
            type: formData.type || DocumentType.PAGARE,
            date: new Date().toISOString().split('T')[0],
            amount: 0,
            currencySymbol: 'Gs.',
            currencyName: 'GUARANIES',
            amountInWords: '',
            concept: '',
            folio: '',
            debtorName: '',
            beneficiaryName: '',
            documentIdNumber: '',
            phoneNumber: '',
            paymentMethod: 'Efectivo',
            legalText: formData.type === DocumentType.PAGARE ? DEFAULT_PAGARE_TEXT : (formData.type === DocumentType.RECIBO ? DEFAULT_RECIBO_TEXT : DEFAULT_MANUAL_TEXT),
        });
        setSignature(null);
    };

    const saveCurrentAsTemplate = () => {
        if (templates.length >= 8) {
            alert("Máximo 8 plantillas permitidas. Elimine alguna para continuar.");
            setActiveSidebarTab('templates');
            setIsHistoryOpen(true);
            return;
        }
        const name = prompt("Nombre para esta plantilla:");
        if (!name) return;
        const newTemplate: TextTemplate = {
            id: crypto.randomUUID(),
            name,
            content: formData.legalText || '',
            type: formData.type || DocumentType.PAGARE
        };
        const updated = [...templates, newTemplate];
        setTemplates(updated);
        localStorage.setItem('text_templates', JSON.stringify(updated));
        alert("Plantilla de texto guardada.");
        setActiveSidebarTab('templates');
        setIsHistoryOpen(true);
    };

    const handleScanPrinters = async () => {
        setScanningPrinters(true);
        try {
            const { listBondedDevices, checkBluetoothEnabled, enableBluetooth } = await import('../../services/bluetoothPrinterService');
            const enabled = await checkBluetoothEnabled();
            if (!enabled) {
                const success = await enableBluetooth();
                if (!success) {
                    alert("Es necesario activar el Bluetooth.");
                    setScanningPrinters(false);
                    return;
                }
            }
            const devices = await listBondedDevices();
            setPrinterDevices(devices);
        } catch (e: any) {
            alert("Error buscando impresoras. Verifica los permisos.");
        } finally {
            setScanningPrinters(false);
        }
    };

    const handleSelectPrinter = async (device: any) => {
        try {
            const { connectToPrinter } = await import('../../services/bluetoothPrinterService');
            const connected = await connectToPrinter(device.id);
            if (connected) {
                alert(`Conectado a ${device.name}`);
                setConnectedDevice(device.name);
                localStorage.setItem('printer_name', device.name);
                setShowPrinterModal(false);
            } else {
                alert("No se pudo conectar.");
            }
        } catch (e) {
            alert("Error al conectar.");
        }
    };

    const handleBluetoothPrint = async (doc: Partial<DocumentData>) => {
        try {
            const { printText, isPrinterConnected, connectToPrinter } = await import('../../services/bluetoothPrinterService');

            const words = numberToWordsSpanish(doc.amount || 0);
            const docWithWords: Partial<DocumentData> = {
                ...doc,
                amountInWords: words,
                // Inject Company Settings
                companyName: settings?.companyName || doc.companyName,
                companyIdentifier: settings?.companyIdentifier || doc.companyIdentifier,
                contactPhone: settings?.contactPhone || doc.contactPhone,
                companyAlias: settings?.companyAlias || doc.companyAlias,
                shareLabel: settings?.shareLabel || doc.shareLabel,
                shareValue: settings?.shareValue || doc.shareValue,
                receiptPrintMargin: settings?.receiptPrintMargin ?? doc.receiptPrintMargin
            };

            const ticketText = generateBluetoothTicket(docWithWords);

            if (!(await isPrinterConnected())) {
                const connected = await connectToPrinter();
                if (!connected) {
                    alert("Impresora no conectada. Por favor vincúlala primero.");
                    setShowPrinterModal(true);
                    handleScanPrinters();
                    return;
                }
            }

            const success = await printText(ticketText);
            if (success) {
                alert("✅ Ticket enviado a la impresora");
            } else {
                alert("❌ Error al enviar el ticket");
            }
        } catch (e: any) {
            alert("Error de impresión: " + e.message);
        }
    };

    const generatePDF = (sourceDoc: Partial<DocumentData>, isPrint: boolean = false) => {
        // INJECT SETTINGS (FIX: Ensure company data is present even for history items)
        const doc: Partial<DocumentData> = {
            ...sourceDoc,
            companyName: settings?.companyName || sourceDoc.companyName,
            companyIdentifier: settings?.companyIdentifier || sourceDoc.companyIdentifier,
            contactPhone: settings?.contactPhone || sourceDoc.contactPhone,
            companyAlias: settings?.companyAlias || sourceDoc.companyAlias,
            shareLabel: settings?.shareLabel || sourceDoc.shareLabel,
            shareValue: settings?.shareValue || sourceDoc.shareValue,
            receiptPrintMargin: settings?.receiptPrintMargin ?? sourceDoc.receiptPrintMargin
        };

        const isThermal = paperSize === 'Thermal58mm';
        const isOficio = paperSize === 'Oficio';

        let pdf: jsPDF;
        if (isThermal) {
            pdf = new jsPDF('p', 'mm', [58, 300]);
        } else if (isOficio) {
            pdf = doc.type === DocumentType.RECIBO
                ? new jsPDF('l', 'mm', [330, 216])
                : new jsPDF('p', 'mm', [216, 330]);
        } else {
            pdf = doc.type === DocumentType.RECIBO
                ? new jsPDF('l', 'mm', 'a4')
                : new jsPDF('p', 'mm', 'a4');
        }

        const thermalFontSize = 10;

        if (doc.type === DocumentType.MANUAL) {
            if (isThermal) {
                let y = 15;
                pdf.setFontSize(thermalFontSize);
                pdf.setFont('helvetica', 'normal');
                const splitText = pdf.splitTextToSize(doc.legalText || '', 48);
                pdf.text(splitText, 5, y, { lineHeightFactor: 1.4 });
            } else {
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'normal');
                const splitText = pdf.splitTextToSize(doc.legalText || '', 180);
                pdf.text(splitText, 15, 20, { lineHeightFactor: 1.5 });
            }
        } else if (doc.type === DocumentType.RECIBO) {
            if (isThermal) {
                let y = 10;
                pdf.setFontSize(12);
                pdf.setTextColor(0);
                pdf.setFont('helvetica', 'bold');

                // --- COMPANY HEADER (Thermal PDF) ---
                if (doc.companyName) {
                    pdf.setFontSize(10);
                    pdf.text(doc.companyName.toUpperCase(), 29, y, { align: 'center' });
                    y += 5;
                }
                if (doc.companyAlias) {
                    pdf.setFontSize(8);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(doc.companyAlias.toUpperCase(), 29, y, { align: 'center' });
                    y += 4;
                }
                if (doc.companyIdentifier) {
                    pdf.setFontSize(8);
                    pdf.text(`RUC/ID: ${doc.companyIdentifier}`, 29, y, { align: 'center' });
                    y += 4;
                }
                if (doc.contactPhone) {
                    pdf.setFontSize(8);
                    pdf.text(`Tel: ${doc.contactPhone}`, 29, y, { align: 'center' });
                    y += 4;
                }

                // Bank Info
                if (doc.shareLabel || doc.shareValue) {
                    y += 2;
                    pdf.line(5, y, 53, y);
                    y += 4;
                    if (doc.shareLabel) {
                        pdf.text(doc.shareLabel, 29, y, { align: 'center' });
                        y += 4;
                    }
                    if (doc.shareValue) {
                        pdf.text(doc.shareValue, 29, y, { align: 'center' });
                        y += 4;
                    }
                    pdf.line(5, y, 53, y);
                    y += 4;
                }

                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text('RECIBO DE PAGO', 29, y, { align: 'center' });

                y += 10;
                pdf.setFontSize(thermalFontSize);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Fecha: ${doc.date || ''} `, 5, y);
                y += 7;
                pdf.text(`Folio: ${doc.folio || ''} `, 5, y);
                y += 2;
                pdf.line(5, y, 53, y);

                y += 10;
                pdf.setFont('helvetica', 'bold');
                pdf.text('Recibí de:', 5, y);
                y += 6;
                pdf.setFont('helvetica', 'normal');
                pdf.text(doc.debtorName || '', 5, y);

                y += 10;
                pdf.setFont('helvetica', 'bold');
                pdf.text(`Monto: ${doc.currencySymbol} ${doc.amount?.toLocaleString()} `, 5, y);

                y += 7;
                pdf.setFont('helvetica', 'normal');
                const splitWords = pdf.splitTextToSize(`${doc.amountInWords} ${doc.currencyName} `, 48);
                pdf.text(splitWords, 5, y, { lineHeightFactor: 1.2 });
                y += (splitWords.length * 5.5);

                y += 5;
                pdf.setFont('helvetica', 'bold');
                pdf.text('Concepto:', 5, y);
                y += 6;
                pdf.setFont('helvetica', 'normal');
                const splitConcept = pdf.splitTextToSize(doc.concept || '', 48);
                pdf.text(splitConcept, 5, y, { lineHeightFactor: 1.2 });
                y += (splitConcept.length * 5.5);

                y += 5;
                pdf.text(`Pago: ${doc.paymentMethod} `, 5, y);

                y += 6;
                pdf.line(5, y, 53, y);
                y += 8;
                pdf.setFont('helvetica', 'bold');
                pdf.text('Recibido por:', 5, y);
                y += 6;
                pdf.setFont('helvetica', 'normal');
                pdf.text(doc.beneficiaryName || '', 5, y);
                y += 6;
                pdf.text(`CI: ${doc.documentIdNumber || ''} `, 5, y);
                y += 6;
                pdf.text(`Tel: ${doc.phoneNumber || ''} `, 5, y);

                y += 25;
                pdf.line(10, y, 48, y);
                if (signature) {
                    pdf.addImage(signature, 'PNG', 15, y - 20, 28, 18);
                }
                pdf.setFontSize(8);
                pdf.text('FIRMA RECIBO', 29, y + 5, { align: 'center' });
            } else {
                pdf.setDrawColor(0);
                pdf.setLineWidth(0.5);
                pdf.setTextColor(60, 100, 180);
                pdf.setFontSize(28);
                pdf.setFont('helvetica', 'bold');
                pdf.text('RECIBO DE PAGO', 15, 25);

                pdf.setTextColor(0);
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'normal');
                pdf.text('Fecha', 140, 25);
                pdf.text(doc.date || '', 165, 25);
                pdf.text('No.', 235, 25);
                pdf.text(doc.folio || '', 250, 25);

                pdf.setFont('helvetica', 'bold');
                pdf.text('Recibí de:', 35, 45);
                pdf.setFont('helvetica', 'normal');
                pdf.text(doc.debtorName || '', 70, 45);

                pdf.rect(isOficio ? 270 : 240, 35, 45, 12);
                pdf.text(`${doc.currencySymbol} ${doc.amount?.toLocaleString()} `, isOficio ? 273 : 243, 43);

                pdf.text(`# ${doc.amountInWords} ${doc.currencyName} #`, 65, 58);
                pdf.text(doc.concept || '', 65, 75);

                pdf.text(`[Nombre]: ${doc.beneficiaryName || ''} `, 65, 113);
                pdf.text(`[Documento]: ${doc.documentIdNumber || ''} `, 65, 120);
                pdf.text(`[Teléfono]: ${doc.phoneNumber || ''} `, 65, 127);

                if (signature) {
                    pdf.addImage(signature, 'PNG', 200, 100, 50, 30);
                }
            }
        } else {
            // PAGARE
            if (isThermal) {
                let y = 10;
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text('PAGARE A LA ORDEN', 29, y, { align: 'center' });

                y += 10;
                pdf.setFontSize(thermalFontSize);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Vencimiento: ${doc.dueDate || doc.date || ''} `, 5, y);
                y += 7;
                pdf.setFont('helvetica', 'bold');
                pdf.text(`Monto: ${doc.currencySymbol} ${doc.amount?.toLocaleString()} `, 5, y);
                y += 2;
                pdf.line(5, y, 53, y);

                y += 10;
                let bodyText = doc.legalText || DEFAULT_PAGARE_TEXT;
                bodyText = bodyText
                    .replace(/\[FECHA\]/g, doc.date || '___/___/___')
                    .replace(/\[MONEDA_NOMBRE\]/g, (doc.currencyName || 'GUARANIES').toUpperCase())
                    .replace(/\[MONTO_LETRAS\]/g, (doc.amountInWords || '________________').toUpperCase())
                    .replace(/\[CONCEPTO\]/g, (doc.concept || '________________'))
                    .replace(/\[DOMICILIO\]/g, (doc.beneficiaryName || '________________'))
                    .replace(/\[DEUDOR_NOMBRE\]/g, (doc.debtorName || '________________'));

                pdf.setFont('helvetica', 'normal');
                const splitBody = pdf.splitTextToSize(bodyText, 48);
                pdf.text(splitBody, 5, y, { lineHeightFactor: 1.4 });
                y += (splitBody.length * 5.5) + 12;

                pdf.setLineDashPattern([1, 1], 0);

                y += 20;
                pdf.line(10, y, 48, y);
                if (signature) {
                    pdf.addImage(signature, 'PNG', 15, y - 20, 28, 18);
                }
                pdf.setFontSize(8);
                pdf.text('FIRMA', 29, y + 5, { align: 'center' });

                y += 20;
                pdf.line(10, y, 48, y);
                pdf.setFontSize(8);
                pdf.text('ACLARACIÓN', 29, y + 5, { align: 'center' });
                pdf.setFontSize(thermalFontSize);
                pdf.text(doc.debtorName || '', 29, y - 2, { align: 'center' });

                y += 20;
                pdf.line(10, y, 48, y);
                pdf.setFontSize(8);
                pdf.text('NRO. DE CÉDULA', 29, y + 5, { align: 'center' });
                pdf.setFontSize(thermalFontSize);
                pdf.text(doc.documentIdNumber || '', 29, y - 2, { align: 'center' });
            } else {
                pdf.setFontSize(20);
                pdf.setFont('helvetica', 'bold');
                pdf.text('PAGARE A LA ORDEN', 105, 30, { align: 'center' });
                pdf.setFontSize(14);
                pdf.text('VENCIMIENTO:', 20, 55);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`${doc.dueDate || doc.date || ''}`, 65, 55);

                pdf.setFont('helvetica', 'bold');
                const formattedAmount = doc.amount?.toLocaleString('es-PY', { minimumFractionDigits: doc.currencySymbol === 'Gs.' ? 0 : 2 }).replace(/,/g, '.') || '0';
                pdf.text(`${doc.currencySymbol}  ${formattedAmount}.-`, 20, 68);

                let bodyText = doc.legalText || DEFAULT_PAGARE_TEXT;
                bodyText = bodyText
                    .replace(/\[FECHA\]/g, doc.date || '___/___/___')
                    .replace(/\[MONEDA_NOMBRE\]/g, (doc.currencyName || 'GUARANIES').toUpperCase())
                    .replace(/\[MONTO_LETRAS\]/g, (doc.amountInWords || '________________').toUpperCase())
                    .replace(/\[CONCEPTO\]/g, (doc.concept || '________________'))
                    .replace(/\[DOMICILIO\]/g, (doc.beneficiaryName || '________________'))
                    .replace(/\[DEUDOR_NOMBRE\]/g, (doc.debtorName || '________________'));

                pdf.setFontSize(12);
                const splitBody = pdf.splitTextToSize(bodyText, 170);
                pdf.text(splitBody, 20, 90, { lineHeightFactor: 1.5 });

                const bottomY = isOficio ? 250 : 220;
                pdf.setFontSize(12);
                pdf.text('FIRMA', 20, bottomY);
                if (signature) {
                    pdf.addImage(signature, 'PNG', 30, bottomY - 30, 50, 25);
                }
                pdf.text('ACLARACIÓN', 20, bottomY + 20);
                pdf.text('Nro. DE CÉDULA:', 20, bottomY + 40);

                const lineX = 60;
                const lineLength = 80;
                pdf.setLineDashPattern([1, 1], 0);
                pdf.line(lineX, bottomY, lineX + lineLength, bottomY);
                pdf.line(lineX, bottomY + 20, lineX + lineLength, bottomY + 20);
                pdf.setFontSize(10);
                pdf.text(doc.debtorName || '', lineX + 2, bottomY + 18);
                pdf.line(lineX, bottomY + 40, lineX + lineLength, bottomY + 40);
                pdf.text(doc.documentIdNumber || '', lineX + 2, bottomY + 38);
            }
        }

        if (isPrint) {
            const blobUrl = pdf.output('bloburl').toString();
            if (printFrameRef.current) {
                printFrameRef.current.src = blobUrl;
                printFrameRef.current.onload = () => {
                    printFrameRef.current?.contentWindow?.focus();
                    printFrameRef.current?.contentWindow?.print();
                };
            } else {
                window.open(blobUrl, '_blank');
            }
        } else {
            pdf.save(`${doc.type}_${doc.folio || 'doc'}.pdf`);
        }
    };

    const changePaperSize = (size: PaperSize) => {
        setPaperSize(size);
        localStorage.setItem('paper_size', size);
        setIsPaperMenuOpen(false);
    };

    const handleTypeChange = (type: DocumentType) => {
        const text = type === DocumentType.PAGARE ? DEFAULT_PAGARE_TEXT : (type === DocumentType.RECIBO ? DEFAULT_RECIBO_TEXT : DEFAULT_MANUAL_TEXT);
        setFormData({ ...formData, type, legalText: text });
    };

    return (
        <div className="flex flex-col md:flex-row bg-slate-50 min-h-screen">
            <iframe ref={printFrameRef} className="hidden" title="Impresión" />

            {/* Sidebar Local para Historial */}
            <aside className={`fixed inset-y-0 left-0 z-40 transition-transform duration-300 transform bg-white border-r border-slate-200 w-80 md:relative md:translate-x-0 ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full hidden md:block'}`}>
                <div className="flex flex-col h-full">
                    <div className="flex border-b border-slate-100">
                        <button
                            onClick={() => setActiveSidebarTab('history')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeSidebarTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <History className="w-3.5 h-3.5 inline mr-1" /> Historial
                        </button>
                        <button
                            onClick={() => setActiveSidebarTab('templates')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeSidebarTab === 'templates' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <BookOpen className="w-3.5 h-3.5 inline mr-1" /> Plantillas
                        </button>
                    </div>

                    {activeSidebarTab === 'history' ? (
                        <>
                            <div className="p-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-800 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {documents.filter(d => (d.folio || '').includes(searchTerm) || (d.debtorName || '').toLowerCase().includes(searchTerm.toLowerCase())).map(doc => (
                                    <div key={doc.id} className="p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm group">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[8px] font-black text-indigo-600 uppercase">{doc.type}</span>
                                            <span className="text-[8px] text-slate-400 font-bold">#{doc.folio || '---'}</span>
                                        </div>
                                        <h3 className="text-[10px] font-black text-slate-700 truncate uppercase">{doc.debtorName || doc.legalText?.substring(0, 20) || '(Sin título)'}</h3>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[9px] font-black text-slate-600">{doc.type !== DocumentType.MANUAL ? `${doc.currencySymbol} ${doc.amount?.toLocaleString() || 0}` : 'Manual'}</span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setFormData({ ...doc, id: undefined }); setIsHistoryOpen(false); }} className="p-1 hover:bg-slate-100 text-slate-600 rounded-md"><Copy className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => generatePDF(doc, true)} className="p-1 hover:bg-slate-100 text-slate-600 rounded-md"><Printer className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => { if (confirm("¿Eliminar?")) { const updated = documents.filter(d => d.id !== doc.id); setDocuments(updated); localStorage.setItem('offline_docs', JSON.stringify(updated)); } }} className="p-1 hover:bg-red-50 text-red-500 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {templates.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-[10px] font-bold uppercase">Sin plantillas</p>
                                    <p className="text-[9px] mt-2">Guarda el texto actual como plantilla para verlo aquí.</p>
                                </div>
                            ) : (
                                templates.map(temp => (
                                    <div key={temp.id} className="p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm group cursor-pointer" onClick={() => { setFormData({ ...formData, legalText: temp.content, type: temp.type }); setIsHistoryOpen(false); }}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[8px] font-black text-emerald-600 uppercase">{temp.type}</span>
                                        </div>
                                        <h3 className="text-[10px] font-black text-slate-700 truncate uppercase mb-2">{temp.name}</h3>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] text-slate-400 font-bold truncate max-w-[120px]">{temp.content.substring(0, 30)}...</span>
                                            <div className="flex gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar plantilla?")) { const updated = templates.filter(t => t.id !== temp.id); setTemplates(updated); localStorage.setItem('text_templates', JSON.stringify(updated)); } }} className="p-1 hover:bg-red-50 text-red-500 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </aside>

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsHistoryOpen(true)} className="md:hidden p-2 text-slate-500 bg-slate-50 rounded-xl"><History className="w-5 h-5" /></button>
                        <div>
                            <h1 className="text-xs font-black text-slate-900 uppercase tracking-tighter">Generador de Pagarés</h1>
                            <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">v1.1.0 Pro Standalone</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setShowPrinterModal(true);
                                handleScanPrinters();
                            }}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-[9px] font-black uppercase transition-all ${connectedDevice ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                            title={connectedDevice ? `Conectado a: ${connectedDevice}` : 'Vincular Impresora'}
                        >
                            <Printer className="w-3.5 h-3.5" />
                            {connectedDevice ? 'Conectado' : 'Vincular'}
                        </button>
                        <div className="relative" ref={paperMenuRef}>
                            <button onClick={() => setIsPaperMenuOpen(!isPaperMenuOpen)} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-600 hover:bg-slate-100 transition-all">
                                {paperSize === 'A4' ? <Maximize2 className="w-3.5 h-3.5" /> : paperSize === 'Oficio' ? <FileBox className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />}
                                {paperSize === 'A4' ? 'A4' : paperSize === 'Oficio' ? 'Oficio' : 'Térmico'}
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {isPaperMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50">
                                    <button onClick={() => changePaperSize('A4')} className="w-full px-4 py-3 text-left text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Maximize2 className="w-4 h-4" /> Papel A4</button>
                                    <button onClick={() => changePaperSize('Oficio')} className="w-full px-4 py-3 text-left text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-2"><FileBox className="w-4 h-4" /> Papel Oficio</button>
                                    <button onClick={() => changePaperSize('Thermal58mm')} className="w-full px-4 py-3 text-left text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Printer className="w-4 h-4" /> Térmico 58mm</button>
                                </div>
                            )}
                        </div>
                        <button onClick={saveToHistory} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"><Save className="w-3.5 h-3.5 inline mr-1" /> Guardar</button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex gap-1 bg-slate-200 p-1 rounded-xl">
                                    <button onClick={() => handleTypeChange(DocumentType.PAGARE)} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${formData.type === DocumentType.PAGARE ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Pagaré</button>
                                    <button onClick={() => handleTypeChange(DocumentType.RECIBO)} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${formData.type === DocumentType.RECIBO ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Recibo</button>
                                    <button onClick={() => handleTypeChange(DocumentType.MANUAL)} className={`px-3 py-1.5 rounded-lg transition-all ${formData.type === DocumentType.MANUAL ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><Pencil className="w-4 h-4" /></button>
                                </div>
                                <div className="flex items-center gap-2 relative" ref={templateMenuRef}>
                                    <button type="button" onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)} className="text-[8px] font-black text-indigo-600 uppercase border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-white flex items-center gap-1.5">
                                        <BookOpen className="w-3 h-3" />
                                        Plantillas
                                        <ChevronDown className="w-2.5 h-2.5" />
                                    </button>
                                    {isTemplateMenuOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-[60] overflow-hidden animate-scaleIn">
                                            <div className="p-3 bg-slate-50 border-b border-slate-100">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mis Plantillas</p>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                                {templates.length === 0 ? (
                                                    <div className="p-4 text-center cursor-default">
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Sin plantillas</p>
                                                    </div>
                                                ) : (
                                                    templates.map(temp => (
                                                        <button
                                                            key={temp.id}
                                                            onClick={() => {
                                                                setFormData({ ...formData, legalText: temp.content, type: temp.type });
                                                                setIsTemplateMenuOpen(false);
                                                            }}
                                                            className="w-full p-4 text-left border-b border-slate-50 hover:bg-indigo-50 transition-colors group"
                                                        >
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[7px] font-black text-emerald-600 uppercase">{temp.type}</span>
                                                            </div>
                                                            <p className="text-[10px] font-black text-slate-700 uppercase truncate">{temp.name}</p>
                                                            <p className="text-[7px] text-slate-400 font-bold mt-1 line-clamp-1">{temp.content.substring(0, 40)}...</p>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setActiveSidebarTab('templates');
                                                    setIsHistoryOpen(true);
                                                    setIsTemplateMenuOpen(false);
                                                }}
                                                className="w-full p-3 bg-slate-50 text-[8px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 transition-colors"
                                            >
                                                Gestionar Plantillas
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 md:p-10 space-y-6">
                                {formData.type !== DocumentType.MANUAL && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monto Principal</label>
                                            <div className="flex gap-2">
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="text"
                                                        value={formData.amount?.toLocaleString('es-PY') || ''}
                                                        onChange={(e) => {
                                                            // Allow only numbers
                                                            const rawValue = e.target.value.replace(/\D/g, '');
                                                            const numericValue = rawValue ? parseInt(rawValue, 10) : 0;
                                                            setFormData({ ...formData, amount: numericValue });
                                                        }}
                                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-black text-lg text-slate-900"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="relative" ref={currencyMenuRef}>
                                                    <button type="button" onClick={() => setIsCurrencyMenuOpen(!isCurrencyMenuOpen)} className="h-full px-4 bg-white border-2 border-slate-100 rounded-2xl text-[9px] font-black uppercase text-slate-600 flex items-center gap-2">{formData.currencySymbol} <ChevronDown className="w-3 h-3" /></button>
                                                    {isCurrencyMenuOpen && (
                                                        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1">
                                                            {CURRENCIES.map(curr => (
                                                                <button key={curr.name} type="button" onClick={() => { setFormData({ ...formData, currencySymbol: curr.symbol, currencyName: curr.name }); setIsCurrencyMenuOpen(false); }} className="w-full px-4 py-2 text-left text-[9px] font-black uppercase hover:bg-slate-50 rounded-lg">{curr.name} ({curr.symbol})</button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                <p className="text-[10px] font-black text-emerald-700 uppercase italic">SON: {formData.amountInWords || 'CERO'} {formData.currencyName}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-black">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fechas del Documento</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Fecha Emisión</label>
                                                    <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-black text-xs" />
                                                </div>
                                                {formData.type === DocumentType.PAGARE && (
                                                    <div>
                                                        <label className="text-[8px] font-black text-red-500 uppercase block mb-1">Fecha Vencimiento</label>
                                                        <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="w-full p-3 bg-red-50 border-2 border-red-100 rounded-2xl focus:border-red-500 outline-none font-black text-xs text-red-900" />
                                                    </div>
                                                )}
                                            </div>
                                            <input type="text" value={formData.folio} onChange={(e) => setFormData({ ...formData, folio: e.target.value })} placeholder="Número de Folio / Referencia" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-black text-xs" />
                                        </div>

                                        <div className="space-y-4 md:col-span-2 text-black">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase">{formData.type === DocumentType.PAGARE ? 'Nombre del Deudor' : 'De (Nombre Pagador)'}</label>
                                                    <input type="text" value={formData.debtorName} onChange={(e) => setFormData({ ...formData, debtorName: e.target.value })} className="w-full p-3 bg-indigo-50/20 border-2 border-indigo-100 rounded-2xl font-black text-sm outline-none" placeholder="EJ: JUAN PÉREZ" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase">Cédula / Documento</label>
                                                    <input type="text" value={formData.documentIdNumber} onChange={(e) => setFormData({ ...formData, documentIdNumber: e.target.value })} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm outline-none" placeholder="EJ: 4.567.890" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase">{formData.type === DocumentType.PAGARE ? 'Nombre del Beneficiario' : 'Para (Nombre Quien Recibe)'}</label>
                                                    <input type="text" value={formData.beneficiaryName} onChange={(e) => setFormData({ ...formData, beneficiaryName: e.target.value })} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm outline-none" placeholder="EJ: PRESTAMASTER" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase">Concepto / Motivo</label>
                                                    <input type="text" value={formData.concept} onChange={(e) => setFormData({ ...formData, concept: e.target.value })} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm outline-none" placeholder="EJ: PRESTAMO PERSONAL" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Edit3 className="w-3.5 h-3.5" /> Redacción del Documento</label>
                                        <button type="button" onClick={saveCurrentAsTemplate} className="text-[8px] font-black text-emerald-600 uppercase border border-emerald-100 px-3 py-1.5 rounded-lg hover:bg-emerald-50"><BookmarkPlus className="w-3 h-3 inline mr-1" /> Guardar como Plantilla</button>
                                    </div>
                                    <textarea rows={formData.type === DocumentType.MANUAL ? 15 : 6} value={formData.legalText} onChange={(e) => setFormData({ ...formData, legalText: e.target.value })} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-indigo-500 transition-all outline-none font-serif text-sm leading-relaxed text-slate-800 font-bold" placeholder="Redacte el contenido aquí..." />
                                </div>

                                {/* <SignaturePad onSave={setSignature} onClear={() => setSignature(null)} /> */}

                                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                    <button type="button" onClick={() => generatePDF({
                                        ...formData,
                                        companyName: settings?.companyName,
                                        companyIdentifier: settings?.companyIdentifier,
                                        contactPhone: settings?.contactPhone,
                                        companyAlias: settings?.companyAlias,
                                        shareLabel: settings?.shareLabel,
                                        shareValue: settings?.shareValue
                                    })} className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"><FileDown className="w-5 h-5" /> Generar PDF</button>
                                    <button type="button" onClick={() => handleBluetoothPrint(formData)} className="flex-1 flex items-center justify-center gap-3 px-6 py-4 border-2 border-slate-900 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"><Printer className="w-5 h-5" /> Imprimir Ticket</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Printer Selection Modal */}
            {showPrinterModal && (
                <div className="fixed inset-0 bg-slate-900/98 flex items-start justify-center z-[200] p-4 pt-10 md:pt-16 overflow-y-auto">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-scaleIn mb-8">
                        <div className="bg-slate-900 p-6 flex justify-between items-center">
                            <h3 className="text-white font-black uppercase text-lg tracking-tighter">
                                <Printer className="w-5 h-5 inline mr-2 text-indigo-400" />
                                Vincular Impresora
                            </h3>
                            <button onClick={() => setShowPrinterModal(false)} className="text-white/50 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="flex justify-center mb-6">
                                <button
                                    onClick={handleScanPrinters}
                                    disabled={scanningPrinters}
                                    className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all ${scanningPrinters ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}`}
                                >
                                    {scanningPrinters ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-indigo-400 border-t-white rounded-full animate-spin" /> BUSCANDO...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-4 h-4" /> BUSCAR VINCULADOS
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {printerDevices.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400">
                                        <Printer className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p className="text-[10px] font-bold uppercase">No se encontraron dispositivos</p>
                                        <p className="text-[9px] mt-2">Asegúrate de haber vinculado tu impresora en los ajustes del sistema.</p>
                                    </div>
                                ) : (
                                    printerDevices.map((dev, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelectPrinter(dev)}
                                            className="w-full text-left p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-black text-slate-700 uppercase text-xs">{dev.name || 'Desconocido'}</p>
                                                    <p className="font-mono text-[9px] text-slate-400">{dev.address || dev.id}</p>
                                                </div>
                                                <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transform -rotate-90" />
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Generator;

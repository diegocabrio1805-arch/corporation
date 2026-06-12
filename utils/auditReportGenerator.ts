import { jsPDF } from 'jspdf';
import { formatCurrency } from './helpers';
import { User, AppSettings, CollectionLog, Client } from '../types';

interface AuditData {
    collectorName: string;
    startDate: string;
    endDate: string;
    totalRevenue: number;
    activeClients: number;
    newClients: number;
    efficiency: number;
    dailyRevenue: { day: string; amount: number }[];
    clientsIncreased: boolean;
    revenueIncreased: boolean;
    verdict: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'DEFICIENTE';
    logs: CollectionLog[];
    clients: Client[];
    settings: AppSettings;
}

export const generateAuditPDF = (data: AuditData) => {
    const doc = new jsPDF();
    // const { collectorName, startDate, endDate, totalRevenue, activeClients, newClients, efficiency, dailyRevenue, verdict, settings } = data; <--- Removed old line
    const dateStr = new Date().toLocaleDateString();

    // Desestructurar nuevos datos
    const {
        collectorName, startDate, endDate, totalRevenue, activeClients, newClients,
        efficiency, dailyRevenue, verdict, settings,
        totalClients, clientsWithoutPayment, weeklyRevenue, monthlyRevenue
    } = data as any; // Cast to any to avoid interface strictness during transition if types aren't fully perfectly matched yet

    // --- HEADER ---
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE AUDITOR GENERAL', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    // doc.text(`GENERADO EL: ${dateStr}`, 105, 30, { align: 'center' }); // Removed to clean up, put in footer or below

    // --- INFO DEL COBRADOR ---
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`COBRADOR: ${collectorName.toUpperCase()}`, 20, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`PERIODO AUDITADO: ${startDate} al ${endDate}`, 20, 62);
    doc.text(`FECHA REPORTE: ${dateStr}`, 20, 67);

    // --- VEREDICTO ---
    // --- VEREDICTO ---
    let verdictColor = [100, 116, 139]; // Slate 500
    if (verdict === 'EXCELENTE') verdictColor = [16, 185, 129]; // Emerald
    else if (verdict === 'BUENO') verdictColor = [59, 130, 246]; // Blue
    else if (verdict === 'MEDIANAMENTE BUENO') verdictColor = [14, 165, 233]; // Sky Blue
    else if (verdict === 'MEDIANAMENTE MALO') verdictColor = [245, 158, 11]; // Amber
    else if (verdict === 'MALO') verdictColor = [239, 68, 68]; // Red
    else if (verdict === 'REGULAR') verdictColor = [245, 158, 11]; // Fallback
    else if (verdict === 'DEFICIENTE') verdictColor = [239, 68, 68]; // Fallback

    const boxWidth = 70;
    const boxX = 210 - 20 - boxWidth; // Align right with 20mm margin

    doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2]);
    doc.roundedRect(boxX, 50, boxWidth, 15, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(verdict, boxX + (boxWidth / 2), 59, { align: 'center' });
    doc.setFontSize(8);
    doc.text("VEREDICTO", boxX + (boxWidth / 2), 63, { align: 'center' });

    // --- KPIs MACRO ---
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.line(20, 75, 190, 75);

    const drawKPI = (label: string, value: string, x: number) => {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(label, x, 85);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.text(value, x, 92);
    };

    drawKPI("RECAUDO TOTAL", formatCurrency(totalRevenue, settings), 20);
    drawKPI("CARTERA TOTAL", (totalClients || 0).toString(), 65);
    drawKPI("PAGARON", activeClients.toString(), 105); // Clients who paid
    drawKPI("NUEVOS", `+${newClients}`, 135);

    // Cobertura %
    const coverage = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;
    drawKPI("COBERTURA", `${coverage}%`, 165);

    doc.line(20, 98, 190, 98);

    // --- ANÁLISIS DE CRECIMIENTO ---
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("ANÁLISIS DE RENDIMIENTO", 20, 110);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let analysisText = "";
    if (data.clientsIncreased && data.revenueIncreased) {
        analysisText = "EXCELENTE: Aumento en base de clientes y recaudación. Gestión efectiva y crecimiento saludable.";
    } else if (data.clientsIncreased && !data.revenueIncreased) {
        analysisText = "ALERTA: Más clientes pero menos recaudación. Posible deterioro de cartera o créditos nuevos sin pago.";
    } else if (!data.clientsIncreased && data.revenueIncreased) {
        analysisText = "ESTABLE: Recaudación sube sin nuevos clientes. Buena recuperación, pero baja expansión.";
    } else {
        analysisText = "CRÍTICO: Caída en clientes y recaudación. Requiere intervención inmediata.";
    }

    const splitAnalysis = doc.splitTextToSize(analysisText, 170);
    doc.text(splitAnalysis, 20, 118);

    // --- VISUALIZACIÓN DE BARRAS (Helper) ---
    const drawBarChart = (title: string, items: { label: string, amount: number }[], startY: number) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(title, 20, startY);

        // Header Background
        doc.setFillColor(241, 245, 249);
        doc.rect(20, startY + 3, 170, 8, 'F');

        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text("PERIODO", 30, startY + 8);
        doc.text("RECAUDO", 100, startY + 8);
        doc.text("TENDENCIA", 150, startY + 8);

        let currentY = startY + 16;
        const maxVal = Math.max(...items.map(i => i.amount), 1);

        items.forEach((item, index) => {
            const percent = (item.amount / maxVal) * 100;

            // Row bg
            if (index % 2 !== 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(20, currentY - 5, 170, 7, 'F');
            }

            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.text(item.label.length > 3 && !item.label.includes('/') ? item.label.substring(0, 3) : item.label, 30, currentY); // Truncate long month names if needed

            doc.setFont('helvetica', 'normal');
            doc.text(formatCurrency(item.amount, settings), 100, currentY);

            // Bar
            if (item.amount > 0) {
                // Color semáforo relativo
                if (percent > 66) doc.setFillColor(16, 185, 129); // Green
                else if (percent > 33) doc.setFillColor(245, 158, 11); // Amber
                else doc.setFillColor(239, 68, 68); // Red

                const barWidth = (percent / 100) * 35;
                doc.rect(150, currentY - 3, barWidth, 3, 'F');
            } else {
                doc.setTextColor(200, 200, 200);
                doc.text("-", 150, currentY);
            }

            currentY += 7;
        });

        return currentY; // Return next Y position
    };

    // --- 1. EVOLUCIÓN DIARIA ---
    const dailyItems = dailyRevenue.map((d: any) => ({ label: d.day, amount: d.amount }));
    let nextY = drawBarChart("EVOLUCIÓN DIARIA (LUNES - SÁBADO)", dailyItems, 135);

    // --- 2. EVOLUCIÓN SEMANAL ---
    // Si hay espacio en Pag 1 (aprox 280mm max)
    const spaceNeededForWeekly = 20 + (weeklyRevenue?.length || 0) * 8;
    if (nextY + spaceNeededForWeekly > 260) {
        doc.addPage();
        nextY = 20;
    } else {
        nextY += 10; // Spacing
    }

    if (weeklyRevenue && weeklyRevenue.length > 0) {
        nextY = drawBarChart("EVOLUCIÓN SEMANAL (PERIODO SELECCIONADO)", weeklyRevenue, nextY);
    }

    // --- NUEVA PÁGINA PARA HISTÓRICO Y CLIENTES ---
    doc.addPage();
    nextY = 20;

    // --- 3. HISTÓRICO MENSUAL ---
    if (monthlyRevenue && monthlyRevenue.length > 0) {
        nextY = drawBarChart(`HISTÓRICO MENSUAL (${new Date().getFullYear()})`, monthlyRevenue, nextY);
        nextY += 15;
    }

    // --- 4. CLIENTES SIN PAGO ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68); // Red Title
    doc.text(`CLIENTES SIN PAGO (${clientsWithoutPayment?.length || 0})`, 20, nextY);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Listado de clientes activos asignados que no registraron pagos en este periodo.", 20, nextY + 5);

    nextY += 10;

    // Tabla de clientes - HEADERS
    doc.setFillColor(241, 245, 249);
    doc.rect(20, nextY, 170, 8, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);

    doc.text("CLIENTE", 22, nextY + 5);
    doc.text("ÚLTOMB PAGO", 85, nextY + 5);
    doc.text("MORA", 125, nextY + 5);
    doc.text("SALDO DEUDA", 160, nextY + 5);

    nextY += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    const clientList = clientsWithoutPayment || [];
    let totalDebt = 0;

    if (clientList.length === 0) {
        doc.text("¡Felicitaciones! Todos los clientes activos realizaron pagos.", 25, nextY);
    } else {
        clientList.forEach((client: any, index: number) => {
            totalDebt += (client.balance || 0);

            // Check page break for long lists
            if (nextY > 270) {
                doc.addPage();
                nextY = 20;
                // Repeat Header
                doc.setFillColor(241, 245, 249);
                doc.rect(20, nextY, 170, 8, 'F');
                doc.setTextColor(71, 85, 105);
                doc.setFont('helvetica', 'bold');
                doc.text("CLIENTE (Cont.)", 22, nextY + 5);
                doc.text("ÚLT. PAGO", 85, nextY + 5);
                doc.text("MORA", 125, nextY + 5);
                doc.text("SALDO DEUDA", 160, nextY + 5);
                nextY += 12;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(30, 41, 59);
            }

            if (index % 2 !== 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(20, nextY - 4, 170, 8, 'F');
            }

            // Nombre y Telefono
            doc.setFont('helvetica', 'bold');
            doc.text(client.name.length > 25 ? client.name.substring(0, 25) + '...' : client.name, 22, nextY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(100, 116, 139);
            doc.text(client.phone || 'Sin tel.', 22, nextY + 3);

            doc.setFontSize(7);
            doc.setTextColor(30, 41, 59);

            // Último Pago
            if (client.lastPaymentDate) {
                doc.text(`${new Date(client.lastPaymentDate).toLocaleDateString()}`, 85, nextY);
                doc.text(`(${formatCurrency(client.lastPaymentAmount, settings)})`, 85, nextY + 3);
            } else {
                doc.setTextColor(239, 68, 68);
                doc.text("NUNCA", 85, nextY + 1.5);
                doc.setTextColor(30, 41, 59);
            }

            // Mora
            doc.text(`${client.daysOverdue} días`, 125, nextY + 1.5);

            // Saldo
            doc.setFont('helvetica', 'bold');
            doc.text(formatCurrency(client.balance, settings), 160, nextY + 1.5);
            doc.setFont('helvetica', 'normal');

            nextY += 10;
        });

        // ROW TOTAL DEUDA
        nextY += 2;
        doc.setDrawColor(203, 213, 225);
        doc.line(20, nextY, 190, nextY);
        nextY += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text("TOTAL CARTERA EN MORA (ESTE PERIODO):", 80, nextY);
        doc.setTextColor(239, 68, 68);
        doc.text(formatCurrency(totalDebt, settings), 160, nextY);
    }

    // --- FOOTER LAST PAGE ---
    const pageCount = doc.getNumberOfPages(); // Returns number
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("Reporte Interno - Anexo Cobro", 105, 285, { align: 'center' });
        doc.text(`Página ${i} de ${pageCount}`, 190, 285, { align: 'right' });
    }

    doc.save(`AUDITORIA_${collectorName.replace(/\s+/g, '_')}_${startDate}.pdf`);
};

export const generateDeletedPaymentsPDF = (data: any) => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString();
    const { collectorName, startDate, endDate, logs, settings, users, clients } = data;

    const lang = settings?.language || 'es';

    // --- HEADER ---
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    const title = lang === 'fr' ? "AUDIT DES ÉLÉMENTS SUPPRIMÉS" : lang === 'pt' ? "AUDITORIA DE ITENS ELIMINADOS" : "AUDITORÍA DE PAGOS ELIMINADOS";
    doc.text(title, 105, 20, { align: 'center' });

    // --- INFO DEL FILTRO ---
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const colLabel = lang === 'fr' ? "COLLECTEUR:" : lang === 'pt' ? "COBRADOR:" : "COBRADOR FILTRADO:";
    doc.text(`${colLabel} ${collectorName.toUpperCase()}`, 20, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const perLabel = lang === 'fr' ? "PÉRIODE DE SUPPRESSION:" : lang === 'pt' ? "PERÍODO DE ELIMINAÇÃO:" : "PERIODO DE ELIMINACIÓN:";
    doc.text(`${perLabel} ${startDate} al ${endDate}`, 20, 62);
    const dateLabel = lang === 'fr' ? "DATE DU RAPPORT:" : lang === 'pt' ? "DATA DO RELATÓRIO:" : "FECHA DE REPORTE:";
    doc.text(`${dateLabel} ${dateStr}`, 20, 67);

    // --- TABLA DE PAGOS ELIMINADOS ---
    doc.setDrawColor(203, 213, 225);
    doc.line(20, 75, 190, 75);

    let nextY = 85;
    
    doc.setFillColor(241, 245, 249);
    doc.rect(20, nextY, 170, 8, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);

    const thDate = lang === 'fr' ? "DATE SUPPR." : lang === 'pt' ? "DATA ELIM." : "FECHA ELIM.";
    const thType = lang === 'fr' ? "TYPE" : "TIPO";
    const thClient = lang === 'fr' ? "CLIENT" : "CLIENTE";
    const thDeletedBy = lang === 'fr' ? "SUPPRIMÉ PAR" : "ELIMINADO POR";
    const thOrig = lang === 'fr' ? "COLLECTEUR ORIG." : "COBRADOR ORIG.";
    const thAmount = lang === 'fr' ? "MONTANT" : lang === 'pt' ? "MONTANTE" : "MONTO";

    doc.text(thDate, 22, nextY + 5);
    doc.text(thType, 45, nextY + 5);
    doc.text(thClient, 70, nextY + 5);
    doc.text(thDeletedBy, 120, nextY + 5);
    doc.text(thOrig, 155, nextY + 5);
    doc.text(thAmount, 190, nextY + 5, { align: 'right' });

    nextY += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    let totalDeleted = 0;

    if (!logs || logs.length === 0) {
        doc.setFont('helvetica', 'italic');
        const emptyMsg = lang === 'fr' ? "AUCUN ÉLÉMENT SUPPRIMÉ TROUVÉ DANS CETTE PÉRIODE." : lang === 'pt' ? "NENHUM ITEM ELIMINADO ENCONTRADO NESTE PERÍODO." : "NO SE ENCONTRARON ELEMENTOS ELIMINADOS EN ESTE PERIODO.";
        doc.text(emptyMsg, 105, nextY, { align: 'center' });
    } else {
        logs.forEach((log: any, index: number) => {
            totalDeleted += (log.amount || 0);

            if (nextY > 270) {
                doc.addPage();
                nextY = 20;
                doc.setFillColor(241, 245, 249);
                doc.rect(20, nextY, 170, 8, 'F');
                doc.setTextColor(71, 85, 105);
                doc.setFont('helvetica', 'bold');
                doc.text(thDate, 22, nextY + 5);
                doc.text(thType, 45, nextY + 5);
                doc.text(thClient, 70, nextY + 5);
                doc.text(thDeletedBy, 120, nextY + 5);
                doc.text(thOrig, 155, nextY + 5);
                doc.text(thAmount, 190, nextY + 5, { align: 'right' });
                nextY += 12;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(30, 41, 59);
            }

            if (index % 2 !== 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(20, nextY - 4, 170, 8, 'F');
            }

            const elimDate = new Date(log.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            const unknownText = lang === 'fr' ? 'Inconnu' : lang === 'en' ? 'Unknown' : lang === 'pt' ? 'Desconhecido' : 'Desconocido';
            const clientName = clients?.find((c: any) => c.id === log.clientId)?.name || unknownText;
            const adminName = users?.find((u: any) => u.id === log.recordedBy)?.name || 'Admin';
            const collName = users?.find((u: any) => u.id === log.collectorId)?.name || unknownText;

            let actionType = 'ABONO';
            try {
                if (log.notes) {
                    const parsed = JSON.parse(log.notes);
                    if (parsed.tipo === 'CREDITO_ELIMINADO') actionType = 'CRÉDITO';
                    else if (parsed.tipo === 'CLIENTE_ELIMINADO') actionType = 'CLIENTE';
                    else if (parsed.tipo === 'PAGO_ELIMINADO') actionType = 'ABONO';
                }
            } catch(e) {}

            doc.text(elimDate, 22, nextY);
            doc.text(actionType, 45, nextY);
            doc.text(clientName.length > 25 ? clientName.substring(0, 25) + '...' : clientName, 70, nextY);
            doc.text(adminName.length > 15 ? adminName.substring(0, 15) + '...' : adminName, 120, nextY);
            doc.text(collName.length > 15 ? collName.substring(0, 15) + '...' : collName, 155, nextY);
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(239, 68, 68); // Red
            doc.text(formatCurrency(log.amount, settings), 185, nextY, { align: 'right' });
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(30, 41, 59);

            nextY += 8;
        });

        nextY += 4;
        doc.setDrawColor(203, 213, 225);
        doc.line(20, nextY, 190, nextY);
        nextY += 8;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const totalText = lang === 'fr' ? "ARGENT TOTAL ANNULÉ:" : lang === 'pt' ? "TOTAL DE DINHEIRO ANULADO:" : "TOTAL DINERO ANULADO:";
        doc.text(totalText, 110, nextY);
        doc.setTextColor(239, 68, 68);
        doc.text(formatCurrency(totalDeleted, settings), 185, nextY, { align: 'right' });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        const footerText = lang === 'fr' ? "Audit de Sécurité Interne - Anexo Cobro" : lang === 'pt' ? "Auditoria Interna de Segurança - Anexo Cobro" : "Auditoría Interna de Seguridad - Anexo Cobro";
        const pageText = lang === 'fr' ? 'Page' : lang === 'pt' ? 'Página' : 'Página';
        doc.text(footerText, 105, 285, { align: 'center' });
        doc.text(`${pageText} ${i} / ${pageCount}`, 190, 285, { align: 'right' });
    }

    doc.save(`PAGOS_ELIMINADOS_${collectorName.replace(/\s+/g, '_')}_${startDate}.pdf`);
};

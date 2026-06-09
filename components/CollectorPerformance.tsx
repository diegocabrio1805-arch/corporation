
import React, { useMemo } from 'react';
import { AppState, Role, CollectionLogType, PaymentStatus, LoanStatus, CollectionLog } from '../types';
import { formatCurrency, calculateMonthlyStats } from '../utils/helpers';
import { getTranslation } from '../utils/translations';
import { jsPDF } from 'jspdf';
import { saveAndOpenPDF } from '../utils/pdfHelper';

interface CollectorPerformanceProps {
  state: AppState;
}

const CollectorPerformance: React.FC<CollectorPerformanceProps> = ({ state }) => {
  const collectors = useMemo(() => {
    return (Array.isArray(state.users) ? state.users : []).filter(u => {
      if (u.role !== Role.COLLECTOR) return false;
      if (state.currentUser?.role === Role.COLLECTOR) {
        return u.id === state.currentUser?.id;
      }
      const mId = (u.managedBy || (u as any).managed_by);
      return mId?.toLowerCase() === state.currentUser?.id?.toLowerCase();
    });
  }, [state.users, state.currentUser]);
  const t = getTranslation(state.settings.language);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const getMonthlyStats = (collectorId: string) => {
    // 1. Préstamos activos asignados a este cobrador
    const assignedLoans = (Array.isArray(state.loans) ? state.loans : []).filter(l => {
      const cId = (l as any).collectorId || (l as any).collector_id;
      const status = (l as any).status;
      return cId === collectorId && (status === LoanStatus.ACTIVE || status === 'Activo');
    });

    const assignedClientIds = new Set((Array.isArray(assignedLoans) ? assignedLoans : []).map(l => (l as any).clientId || (l as any).client_id));
    const totalActiveClients = assignedClientIds.size;

    // 2. Logs de gestión de este mes (Suma acumulada)
    const monthlyLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
      const logDate = new Date(log.date);
      const loan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.id === log.loanId);
      const cId = (loan as any)?.collectorId || (loan as any)?.collector_id;
      const isCollector = cId === collectorId;
      return isCollector &&
        logDate.getMonth() === currentMonth &&
        logDate.getFullYear() === currentYear &&
        !log.deletedAt;
    });

    // 3. Clientes visitados vs No visitados
    const visitedClientIds = new Set((Array.isArray(monthlyLogs) ? monthlyLogs : []).map(log => log.clientId));
    const clientsVisited = Array.from(visitedClientIds).filter(id => assignedClientIds.has(id as string));
    const missedClientIds = Array.from(assignedClientIds).filter(id => !visitedClientIds.has(id));

    const monthlyStats = calculateMonthlyStats(state.loans, state.collectionLogs, currentMonth, currentYear, collectorId);
    const collectedThisMonth = monthlyStats.collectedThisMonth;
    const monthlyGoal = monthlyStats.monthlyGoal;
    const moneyNotCollected = monthlyStats.remainingBalance;

    const filteredLogs = (Array.isArray(state.collectionLogs) ? state.collectionLogs : []).filter(log => {
      const logDate = new Date(log.date);
      const loan = (Array.isArray(state.loans) ? state.loans : []).find(l => l.id === log.loanId);
      const cId = (loan as any)?.collectorId || (loan as any)?.collector_id;
      const isCollector = cId === collectorId;
      return isCollector &&
        logDate.getMonth() === currentMonth &&
        logDate.getFullYear() === currentYear &&
        !log.deletedAt;
    });

    const coverage = totalActiveClients > 0 ? (clientsVisited.length / totalActiveClients) * 100 : 0;
    const allVisited = totalActiveClients > 0 && clientsVisited.length >= totalActiveClients;

    return {
      collectedThisMonth,
      monthlyGoal,
      moneyNotCollected,
      totalActiveClients,
      clientsVisited: clientsVisited.length,
      missedClients: (Array.isArray(state.clients) ? state.clients : []).filter(c => missedClientIds.includes(c.id)),
      monthlyLogs,
      coverage,
      allVisited
    };
  };

  const handleExportDetailedPDF = (collector: any, stats: any) => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });

    // --- ESTILO EXCEL ---
    const drawCell = (text: string, x: number, y: number, w: number, h: number, isHeader = false) => {
      doc.setDrawColor(200);
      doc.rect(x, y, w, h);
      if (isHeader) {
        doc.setFillColor(241, 245, 249);
        doc.rect(x, y, w, h, 'F');
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      doc.text(text, x + 2, y + (h / 2) + 1, { maxWidth: w - 4 });
    };

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(((t as any).performanceDashboard?.pdf?.title || 'REPORTE DE RENDIMIENTO EXCEL'), 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${((t as any).performanceDashboard?.pdf?.collector || 'COBRADOR:')} ${collector.name.toUpperCase()}  |  ${((t as any).performanceDashboard?.pdf?.period || 'PERIODO:')} ${dateStr.toUpperCase()}`, 105, 30, { align: 'center' });

    doc.setTextColor(30);
    let currentY = 50;

    // Resumen General (Excel Style Table)
    doc.setFontSize(12);
    doc.text(((t as any).performanceDashboard?.pdf?.summaryTitle || 'RESUMEN DE GESTIÓN MÓVIL'), 20, currentY);
    currentY += 8;

    const rowH = 10;
    const colW = 60;
    drawCell(((t as any).performanceDashboard?.pdf?.collected || 'RECAUDADO'), 20, currentY, colW, rowH, true);
    drawCell(((t as any).performanceDashboard?.pdf?.notCollected || 'NO RECAUDADO'), 20 + colW, currentY, colW, rowH, true);
    drawCell(((t as any).performanceDashboard?.pdf?.effectiveness || 'EFECTIVIDAD'), 20 + (colW * 2), currentY, colW, rowH, true);
    currentY += rowH;

    const effectiveness = stats.collectedThisMonth > 0 ? Math.round((stats.collectedThisMonth / (stats.collectedThisMonth + stats.moneyNotCollected)) * 100) : 0;
    drawCell(formatCurrency(stats.collectedThisMonth, state.settings), 20, currentY, colW, rowH);
    drawCell(formatCurrency(stats.moneyNotCollected, state.settings), 20 + colW, currentY, colW, rowH);
    drawCell(`${effectiveness}%`, 20 + (colW * 2), currentY, colW, rowH);

    currentY += 25;

    // Tabla 1: Gestiones del Mes
    doc.text(((t as any).performanceDashboard?.pdf?.detailsTitle || 'DETALLE DE REGISTROS (VISITAS CON PAGO/GESTIÓN)'), 20, currentY);
    currentY += 8;

    const logsCols = [40, 90, 40]; // Fecha, Cliente, Monto
    const headers = [
      ((t as any).performanceDashboard?.pdf?.date || 'FECHA'), 
      ((t as any).performanceDashboard?.pdf?.client || 'CLIENTE'), 
      ((t as any).performanceDashboard?.pdf?.amount || 'MONTO')
    ];
    let startX = 20;
    headers.forEach((h, i) => drawCell(h, startX + logsCols.slice(0, i).reduce((a, b) => a + b, 0), currentY, logsCols[i], rowH, true));
    currentY += rowH;

    stats.monthlyLogs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20).forEach((log: CollectionLog) => {
      if (currentY > 270) { doc.addPage(); currentY = 20; }
      const client = state.clients.find(c => c.id === log.clientId)?.name || 'Desconocido';
      const logDate = new Date(log.date).toLocaleDateString();

      const rowX = 20;
      drawCell(logDate, rowX, currentY, logsCols[0], rowH);
      drawCell(client.substring(0, 30), rowX + logsCols[0], currentY, logsCols[1], rowH);
      drawCell(formatCurrency(log.amount || 0, state.settings), rowX + logsCols[0] + logsCols[1], currentY, logsCols[2], rowH);
      currentY += rowH;
    });

    currentY += 20;

    // Tabla 2: Clientes NO Visitados (CRÍTICO)
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setTextColor(220, 38, 38);
    doc.text(((t as any).performanceDashboard?.pdf?.criticalTitle || '⚠️ SECCIÓN CRÍTICA: CLIENTES SIN GESTIÓN ESTE MES'), 20, currentY);
    doc.setTextColor(30);
    currentY += 8;

    const missedCols = [100, 70];
    drawCell(((t as any).performanceDashboard?.pdf?.clientName || 'NOMBRE DEL CLIENTE'), 20, currentY, missedCols[0], rowH, true);
    drawCell(((t as any).performanceDashboard?.pdf?.daysWithoutVisit || 'DÍAS SIN GESTIÓN'), 20 + missedCols[0], currentY, missedCols[1], rowH, true);
    currentY += rowH;

    stats.missedClients.forEach((client: any) => {
      if (currentY > 270) { doc.addPage(); currentY = 20; }

      const allLogs = state.collectionLogs.filter(l => l.clientId === client.id && !l.deletedAt);
      const lastLog = allLogs.length > 0 ? new Date(Math.max(...allLogs.map(l => new Date(l.date).getTime()))) : null;
      const diff = lastLog ? Math.floor((new Date().getTime() - lastLog.getTime()) / (1000 * 3600 * 24)) : ((t as any).performanceDashboard?.pdf?.never || 'NUNCA');

      drawCell(client.name.substring(0, 40), 20, currentY, missedCols[0], rowH);
      drawCell(`${diff} ${diff !== ((t as any).performanceDashboard?.pdf?.never || 'NUNCA') ? ((t as any).performanceDashboard?.pdf?.daysLate || 'días atrasado') : ''}`.trim(), 20 + missedCols[0], currentY, missedCols[1], rowH);
      currentY += rowH;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(((t as any).performanceDashboard?.pdf?.footer || 'Este reporte es un documento de control interno generado por ANEXO COBRO.'), 105, 285, { align: 'center' });

    saveAndOpenPDF(doc, `RENDIMIENTO_${collector.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
            <i className="fa-solid fa-chart-pie text-blue-600"></i>
            {t.menu.performance}
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{(t as any).performanceDashboard?.subtitle || 'Análisis de Gestión Mensual'}</p>
        </div>
        <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="text-right">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{(t as any).performanceDashboard?.currentPeriod || 'Periodo Actual'}</p>
            <p className="text-xs font-black text-slate-800 uppercase">
              {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <i className="fa-solid fa-calendar-check"></i>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {(Array.isArray(collectors) ? collectors : []).length === 0 ? (
          <div className="py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-400">
            <i className="fa-solid fa-user-tag text-5xl mb-4 opacity-20"></i>
            <p className="text-lg font-bold">{(t as any).performanceDashboard?.noCollectors || 'No hay cobradores para auditar.'}</p>
          </div>
        ) : (
          (Array.isArray(collectors) ? collectors : []).map(collector => {
            const stats = getMonthlyStats(collector.id);

            return (
              <div key={collector.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl hover:border-blue-100 transition-all duration-300 group">
                <div className="p-8 flex flex-col lg:flex-row gap-8 items-center">
                  {/* Perfil y Cobertura */}
                  <div className="w-full lg:w-1/4 flex flex-col items-center text-center space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-8">
                    <div className="relative">
                      <div className="w-20 h-20 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center text-3xl font-black shadow-2xl transition-transform group-hover:scale-110 duration-500">
                        {collector.name.charAt(0)}
                      </div>
                      {stats.allVisited && (
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center border-4 border-white shadow-lg animate-bounce">
                          <i className="fa-solid fa-check text-xs"></i>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{collector.name}</h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{(t as any).performanceDashboard?.routeCollector || 'Cobrador de Ruta'}</p>
                    </div>
                    <div className="w-full space-y-2">
                      <div className="flex justify-between items-end">
                        <p className="text-[8px] font-black text-slate-400 uppercase">{(t as any).performanceDashboard?.visitCoverage || 'Cobertura de Visitas'}</p>
                        <p className={`text-xs font-black ${stats.allVisited ? 'text-emerald-500' : 'text-blue-600'}`}>{Math.round(stats.coverage)}%</p>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${stats.allVisited ? 'bg-emerald-500' : 'bg-blue-600'}`}
                          style={{ width: `${stats.coverage}%` }}
                        />
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">
                        {stats.clientsVisited} {((t as any).performanceDashboard?.activeClientsVisited || 'de {0} clientes activos visitados').replace('{0}', stats.totalActiveClients.toString())}
                      </p>
                    </div>
                  </div>

                  {/* Métricas Financieras Mensuales */}
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-6 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 flex flex-col justify-between group-hover:bg-emerald-50 transition-colors">
                      <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                        <i className="fa-solid fa-money-bill-trend-up"></i>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">{(t as any).performanceDashboard?.collectedThisMonth || 'Recaudado este mes'}</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(stats.collectedThisMonth, state.settings)}</p>
                      </div>
                    </div>

                    <div className="p-6 bg-red-50/50 rounded-[2rem] border border-red-100 flex flex-col justify-between group-hover:bg-red-50 transition-colors">
                      <div className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-red-500/20">
                        <i className="fa-solid fa-hand-holding-dollar"></i>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1">{(t as any).performanceDashboard?.notCollectedThisMonth || 'No recaudado (Mes)'}</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(stats.moneyNotCollected, state.settings)}</p>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-900 rounded-[2rem] text-white flex flex-col justify-between relative overflow-hidden group-hover:shadow-2xl transition-all duration-500">
                      <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center mb-4">
                        <i className="fa-solid fa-star text-amber-400"></i>
                      </div>
                      <div className="relative z-10">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{(t as any).performanceDashboard?.goalEffectiveness || 'Efectividad Meta'}</p>
                        <p className="text-2xl font-black text-white tracking-tighter">
                          {stats.monthlyGoal > 0 ? Math.round((stats.collectedThisMonth / stats.monthlyGoal) * 100) : 0}%
                        </p>
                      </div>
                      <i className="fa-solid fa-award absolute -right-4 -bottom-4 text-7xl text-white/5"></i>
                    </div>
                  </div>

                  {/* Status Final */}
                  <div className="w-full lg:w-48 flex flex-col gap-3">
                    <div className={`p-4 rounded-2xl border text-center ${stats.allVisited ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100 animate-pulse'}`}>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{(t as any).performanceDashboard?.pendingClients || 'Clientes Pendientes'}</p>
                      <p className={`text-xs font-black uppercase ${stats.allVisited ? 'text-emerald-600' : 'text-red-600'}`}>
                        {stats.allVisited ? ((t as any).performanceDashboard?.yesCompleted || 'SÍ, CUMPLIÓ') : `${stats.missedClients.length} ${((t as any).performanceDashboard?.withoutVisit || 'SIN VISITA')}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleExportDetailedPDF(collector, stats)}
                      className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:bg-blue-700"
                    >
                      {(t as any).performanceDashboard?.fullDetail || 'DETALLE COMPLETO'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CollectorPerformance;

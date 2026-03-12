import * as XLSX from 'xlsx-js-style';
import { Client, Loan, Frequency, LoanStatus, PaymentStatus, CollectionLog, CollectionLogType } from '../types';
import { parseAmount, formatDate, generateUUID } from './helpers';
import { mapHeadersWithAI } from '../services/geminiService';

/**
 * Robustly parses dates from Excel, handling both serial numbers and strings.
 */
const parseExcelDate = (val: any): string => {
    if (!val) return new Date().toISOString();

    // Si es un número (Excel Serial Date)
    if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        return date.toISOString();
    }

    const str = String(val).trim();
    if (!str) return new Date().toISOString();

    // Intentar DD/MM/YYYY
    if (str.includes('/')) {
        const parts = str.split(' ')[0].split('/');
        if (parts.length === 3) {
            // Asumimos DD-MM-YYYY
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d.toISOString();
        }
    }

    const d = new Date(str);
    return !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
};

export const EXCEL_COLUMNS = [
    "ID / Código", "Nombre Completo", "Cédula", "Teléfono Primario", "Teléfono Secundario",
    "Dirección Domicilio", "Nacionalidad", "Fecha Nacimiento", "Estado Civil", "Profesión",
    "Nombre Cónyuge", "Documento Cónyuge", "Fecha Nacimiento Cónyuge", "Profesión Cónyuge",
    "Lugar Trabajo Cónyuge", "Teléfono Laboral Cónyuge", "Ingresos Cónyuge",
    "Tipo Vivienda", "Antigüedad Residencia", "Latitud Domicilio", "Longitud Domicilio",
    "Calificación", "Tipo de Cliente", "Cód. Vendedor", "Capital Préstamo", "Interés (%)", "Cuotas Totales", "Frecuencia",
    "Valor Cuota", "Total a Pagar", "Fecha Inicio", "Estado Préstamo", "Saldo Actual",
    "Cuotas Pagadas", "Cuotas Pendientes", "Total Cobrado", "Días Atraso", "Última Fecha Pago",
    "Próximo Vencimiento", "Ref 1 Nombre", "Ref 1 Teléfono", "Ref 2 Nombre", "Ref 2 Teléfono",
    "Empresa/Negocio", "Dirección Negocio", "Rubro Negocio", "Notas"
];

export const exportClientsToExcel = (clients: Client[], loans: Loan[]) => {
    const data = clients.map(client => {
        const loan = loans.find(l => l.clientId === client.id && l.status !== LoanStatus.PAID) ||
            loans.filter(l => l.clientId === client.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        const paidInstallments = loan?.installments.filter(i => i.status === PaymentStatus.PAID).length || 0;
        const pendingInstallments = (loan?.totalInstallments || 0) - paidInstallments;
        const totalPaid = loan?.installments.reduce((acc, i) => acc + i.paidAmount, 0) || 0;

        return {
            "ID / Código": client.id,
            "Nombre Completo": client.name,
            "Cédula": client.documentId,
            "Teléfono Primario": client.phone,
            "Teléfono Secundario": client.secondaryPhone || "A COMPLETAR",
            "Dirección Domicilio": client.address,
            "Nacionalidad": client.nationality || "A COMPLETAR",
            "Fecha Nacimiento": client.birthDate ? formatDate(client.birthDate) : "A COMPLETAR",
            "Estado Civil": client.maritalStatus || "A COMPLETAR",
            "Profesión": client.profession || "A COMPLETAR",
            "Nombre Cónyuge": client.spouseName || "A COMPLETAR",
            "Documento Cónyuge": client.spouseDocumentId || "A COMPLETAR",
            "Fecha Nacimiento Cónyuge": client.spouseBirthDate ? formatDate(client.spouseBirthDate) : "A COMPLETAR",
            "Profesión Cónyuge": client.spouseProfession || "A COMPLETAR",
            "Lugar Trabajo Cónyuge": client.spouseWorkplace || "A COMPLETAR",
            "Teléfono Laboral Cónyuge": client.spouseWorkPhone || "A COMPLETAR",
            "Ingresos Cónyuge": client.spouseIncome || 0,
            "Tipo Vivienda": client.residenceType || "A COMPLETAR",
            "Antigüedad Residencia": client.residenceAntiquity || "A COMPLETAR",
            "Latitud Domicilio": client.location?.lat || 0,
            "Longitud Domicilio": client.location?.lng || 0,
            "Calificación": client.systemRating || "N/A",
            "Tipo de Cliente": client.clientType || "A COMPLETAR",
            "Cód. Vendedor": client.sellerCode || loan?.sellerCode || "N/A",
            "Cód. Tipo Cliente": client.clientTypeCode || "131",
            "Cód. Operación": loan?.operationTypeCode || "202",
            "Capital Préstamo": loan?.principal || 0,
            "Interés (%)": loan?.interestRate || 0,
            "Cuotas Totales": loan?.totalInstallments || 0,
            "Frecuencia": loan?.frequency || "A COMPLETAR",
            "Valor Cuota": loan?.installmentValue || 0,
            "Total a Pagar": loan?.totalAmount || 0,
            "Fecha Inicio": loan?.createdAt ? new Date(loan.createdAt).toISOString().split('T')[0] : "A COMPLETAR",
            "Estado Préstamo": loan?.status || "SIN CRÉDITO",
            "Saldo Actual": client.currentBalance || 0,
            "Cuotas Pagadas": paidInstallments,
            "Cuotas Pendientes": pendingInstallments,
            "Total Cobrado": totalPaid,
            "Días Atraso": 0, // Cálculo complejo omitido en local, se hace del lado del server si es posible
            "Última Fecha Pago": "N/A",
            "Próximo Vencimiento": "N/A",
            "Ref 1 Nombre": "A COMPLETAR",
            "Ref 1 Teléfono": "A COMPLETAR",
            "Ref 2 Nombre": "A COMPLETAR",
            "Ref 2 Teléfono": "A COMPLETAR",
            "Empresa/Negocio": client.workCompany || "A COMPLETAR",
            "Dirección Negocio": client.workStreetMain ? `${client.workStreetMain} ${client.workStreetSecondary || ''} ${client.workCity || ''}` : "A COMPLETAR",
            "Rubro Negocio": client.workSector || "A COMPLETAR",
            "Notas": "EXPORTADO DESDE SISTEMA"
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");

    // Estilos básicos para el encabezado
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1";
        if (!ws[address]) continue;
        ws[address].s = {
            fill: { fgColor: { rgb: "10B981" } }, // Emerald 500
            font: { color: { rgb: "FFFFFF" }, bold: true },
            alignment: { horizontal: "center" }
        };
    }

    XLSX.writeFile(wb, `CARTERA_CLIENTES_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const processExcelImport = async (file: File, collectorId: string, branchId?: string, sellerCode?: string): Promise<{ clients: Client[], loans: Loan[], logs: CollectionLog[] }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Convert to array of arrays to scan row by row
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                let clientHeaderRow = -1;
                let loanHeaderRow = -1;

                // 1. Detect Header Rows
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i].map(c => String(c || '').toUpperCase());

                    // Detectar si la fila tiene datos de Clientes
                    if (clientHeaderRow === -1 && (row.some(r => 
                        r.includes("NOMBRE COMPLETO") || 
                        r.includes("CLIENTE") || 
                        r.includes("NOM. COMPLETO") || 
                        r.includes("RAZON SOCIAL") || 
                        r.includes("RAZÓN SOCIAL")
                    ))) {
                        clientHeaderRow = i;
                    }

                    // Detectar si la fila tiene datos de Préstamos
                    if (loanHeaderRow === -1 && (row.some(r => 
                        r.includes("LIQUIDO DESEMBOLSADO") || 
                        r.includes("SALDO CAPITAL") || 
                        r.includes("LIQ. DESEMB") || 
                        r.includes("MONTO PAGARE") || 
                        r.includes("IMPORT. PAGARE") ||
                        r.includes("IMP. PAGARE") ||
                        r.includes("SALDO ACTUAL") || 
                        r.includes("MONTO PAG")
                    ))) {
                        loanHeaderRow = i;
                    }
                }

                if (clientHeaderRow === -1) {
                    // Fallback to old behavior if no special headers found
                    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
                    const clients: Client[] = [];
                    const loans: Loan[] = [];
                    jsonData.forEach((row, index) => {
                        const clientId = row["ID / Código"] || generateUUID();
                        clients.push({
                            id: clientId,
                            name: row["Nombre Completo"] || "NOMBRE A COMPLETAR",
                            documentId: String(row["Cédula"] || "0"),
                            phone: String(row["Teléfono Primario"] || "0"),
                            address: row["Dirección Domicilio"] || "DIRECCIÓN A COMPLETAR",
                            addedBy: collectorId,
                            creditLimit: Number(row["Capital Préstamo"]) || 1000000,
                            isActive: true,
                            branchId: branchId,
                            sellerCode: sellerCode,
                            clientTypeCode: "131",
                            createdAt: new Date().toISOString()
                        });
                        if (row["Capital Préstamo"]) {
                            loans.push({
                                id: `L-${clientId}`,
                                clientId,
                                collectorId,
                                principal: Number(row["Capital Préstamo"]),
                                interestRate: Number(row["Interés (%)"]) || 20,
                                totalInstallments: Number(row["Cuotas Totales"]) || 24,
                                frequency: (row["Frecuencia"] as Frequency) || Frequency.DAILY,
                                totalAmount: Number(row["Total a Pagar"]) || Number(row["Capital Préstamo"]) * 1.2,
                                installmentValue: Number(row["Valor Cuota"]) || 0,
                                status: LoanStatus.ACTIVE,
                                branchId: branchId,
                                sellerCode: sellerCode,
                                operationTypeCode: "202",
                                createdAt: new Date().toISOString(),
                                installments: []
                            });
                        }
                    });
                    resolve({ clients, loans, logs: [] });
                    return;
                }

                // 2. Map Columns for each section
                const getColMap = (headerRowIndex: number) => {
                    const map: Record<string, number> = {};
                    rows[headerRowIndex].forEach((val, idx) => {
                        const key = String(val || '').toUpperCase().trim();
                        map[key] = idx;
                    });
                    return map;
                };

                const clientMap = getColMap(clientHeaderRow);
                const loanMap = loanHeaderRow !== -1 ? getColMap(loanHeaderRow) : null;

                console.log("🔍 [FORENSIC] Headers Detectados:", { clientMap, loanMap });

                // --- INTEGRACIÓN IA: DESCUBRIMIENTO DE COLUMNAS CON GEMINI ---
                const allHeaders = [...Object.keys(clientMap), ...(loanMap ? Object.keys(loanMap) : [])];
                const aiMap = await mapHeadersWithAI(allHeaders);

                console.log("🤖 [FORENSIC] Mapeo de la IA:", aiMap);

                const findCol = (map: Record<string, number> | null, internalKey: string, synonyms: string[]) => {
                    if (!map) return undefined;
                    // 1. Check IA Mapping
                    const aiMatch = Object.entries(aiMap).find(([header, target]) => target === internalKey && map[header.toUpperCase()] !== undefined);
                    if (aiMatch) {
                        console.log(`✅ [FORENSIC] IA encontró '${internalKey}' en columna: "${aiMatch[0]}"`);
                        return map[aiMatch[0].toUpperCase()];
                    }

                    // 2. Check Synonyms
                    for (const s of synonyms) {
                        const sUpper = s.toUpperCase();
                        if (map[sUpper] !== undefined) return map[sUpper];
                        // Partial match
                        const partial = Object.keys(map).find(k => k.includes(sUpper));
                        if (partial !== undefined) return map[partial];
                    }
                    return undefined;
                };

                const clients: Client[] = [];
                const loans: Loan[] = [];
                const logs: CollectionLog[] = [];

                // 3. Process Data
                let dataIndex = 0;
                for (let i = clientHeaderRow + 1; i < rows.length; i++) {
                    const cRow = rows[i];
                    if (!cRow || cRow.length === 0) continue;

                    const nameIdx = findCol(clientMap, 'name', ["NOMBRE COMPLETO", "NOM. COMPLETO", "CLIENTE", "NOMBRE", "RAZON SOCIAL", "RAZÓN SOCIAL", "NOMBRES"]);
                    if (nameIdx === undefined || !cRow[nameIdx]) continue; // Skip empty rows or rows without name
                    
                    const clientId = generateUUID();

                    // --- EMPIEZA MAPEADO CRUDO COMPLETO ---
                    // Captura todo lo que vino en la fila de Excel para este cliente
                    const clientRawData: Record<string, any> = {};
                    Object.entries(clientMap).forEach(([headerName, colIdx]) => {
                        const cellValue = cRow[colIdx];
                        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                            clientRawData[headerName] = cellValue;
                        }
                    });
                    // --- TERMINA MAPEADO CRUDO COMPLETO ---

                    const client: Client = {
                        id: clientId,
                        name: String(cRow[nameIdx ?? -1] || ''),
                        documentId: String(cRow[(findCol(clientMap, 'documentId', ["NRO DE DOCUMENTO", "CÉDULA", "CEDULA", "DNI", "IDENTIFICACION", "NRO DE DOCUMENTO DE IDENT.", "CI", "CED", "DOC", "NRO DOC", "ID"]) ?? -1)] || '0'),
                        phone: String(cRow[(findCol(clientMap, 'phone', ["TELÉFONO", "TELEFONO", "CELULAR", "MOVIL", "TELÉFONO PRIMARIO", "(PARTICULAR - TELÉFONO)", "(PARTICULAR - TELEFONO)", "TEL", "CEL", "MOV"]) ?? -1)] || '0'),
                        secondaryPhone: String(cRow[(findCol(clientMap, 'secondaryPhone', ["TELÉFONO SECUNDARIO", "CELULAR 2", "CONTACTO 2", "PARTICULAR 2", "TEL 2", "CEL 2"]) ?? -1)] || 'SIN DATOS'),
                        address: String(cRow[(findCol(clientMap, 'address', ["DIRECCIÓN", "DIRECCION", "DOMICILIO", "CALLE", "DIRECCIÓN DOMICILIO", "(PARTICULAR - DIRECCIÓN)", "DIR", "DOM"]) ?? -1)] || 'SIN DATOS'),
                        addedBy: collectorId,
                        branchId: branchId,
                        creditLimit: 1000000,
                        isActive: true,
                        createdAt: parseExcelDate(cRow[findCol(clientMap, 'date', ["FECHA", "REGISTRO", "ALTA", "FECHA REGISTRO", "FEC", "FCH"]) ?? -1]),
                        birthDate: cRow[findCol(clientMap, 'birthDate', ["FECHA NACIMIENTO", "FEC. NAC", "F. NACIMIENTO", "(FCH. NACIMIENTO)", "FECHA DE NACIMIENTO", "FEC NAC", "F NAC", "F. NACIM"]) ?? -1] ? parseExcelDate(cRow[findCol(clientMap, 'birthDate', ["FECHA NACIMIENTO", "FEC. NAC", "F. NACIMIENTO", "(FCH. NACIMIENTO)", "FECHA DE NACIMIENTO", "FEC NAC", "F NAC", "F. NACIM"]) ?? -1]) : undefined,
                        nationality: String(cRow[findCol(clientMap, 'nationality', ["NACIONALIDAD", "NACION", "PAÍS", "NAC"]) ?? -1] || 'SIN DATOS'),
                        maritalStatus: String(cRow[findCol(clientMap, 'maritalStatus', ["ESTADO CIVIL", "ESTADO", "EST CIV"]) ?? -1] || 'SIN DATOS'),
                        profession: String(cRow[findCol(clientMap, 'profession', ["PROFESIÓN", "PROFESION", "CARGO", "PROF"]) ?? -1] || 'SIN DATOS'),
                        email: String(cRow[findCol(clientMap, 'email', ["EMAIL", "CORREO", "E-MAIL", "MAIL"]) ?? -1] || 'SIN DATOS'),
                        // Datos Cónyuge
                        spouseName: String(cRow[findCol(clientMap, 'spouseName', ["NOMBRE CÓNYUGE", "NOMBRE CONYUGE", "CONYUGE", "NOMBRE DE LA PAREJA", "NOM CONY"]) ?? -1] || 'SIN DATOS'),
                        spouseDocumentId: String(cRow[findCol(clientMap, 'spouseDocumentId', ["DOCUMENTO CÓNYUGE", "CEDULA CONYUGE", "CI CONYUGE", "DOC CONY"]) ?? -1] || 'SIN DATOS'),
                        spouseBirthDate: cRow[findCol(clientMap, 'spouseBirthDate', ["FECHA NACIMIENTO CÓNYUGE", "FEC NAC CONYUGE", "F NAC CONY"]) ?? -1] ? parseExcelDate(cRow[findCol(clientMap, 'spouseBirthDate', ["FECHA NACIMIENTO CÓNYUGE", "FEC NAC CONYUGE", "F NAC CONY"]) ?? -1]) : undefined,
                        spouseProfession: String(cRow[findCol(clientMap, 'spouseProfession', ["PROFESIÓN CÓNYUGE", "PROFESION CONYUGE", "PROF CONY"]) ?? -1] || 'SIN DATOS'),
                        spouseWorkplace: String(cRow[findCol(clientMap, 'spouseWorkplace', ["LUGAR TRABAJO CÓNYUGE", "TRABAJO CONYUGE", "LUG TRAB CONY"]) ?? -1] || 'SIN DATOS'),
                        spouseWorkPhone: String(cRow[findCol(clientMap, 'spouseWorkPhone', ["TELÉFONO LABORAL CÓNYUGE", "TEL TRABAJO CONYUGE", "TEL LAB CONY"]) ?? -1] || 'SIN DATOS'),
                        spouseIncome: parseAmount(cRow[findCol(clientMap, 'spouseIncome', ["INGRESOS CÓNYUGE", "SUELDO CONYUGE", "ING CONY"]) ?? -1] || '0'),

                        // Residencia
                        residenceType: cRow[findCol(clientMap, 'residenceType', ["TIPO VIVIENDA", "TIPO DE CASA", "TIPO VIV"]) ?? -1] as any,
                        residenceAntiquity: String(cRow[findCol(clientMap, 'residenceAntiquity', ["ANTIGÜEDAD RESIDENCIA", "TIEMPO EN CASA", "ANTIG RES"]) ?? -1] || 'SIN DATOS'),
                        houseNumber: String(cRow[findCol(clientMap, 'houseNumber', ["NRO CASA", "NÙMERO CASA", "NRO DE CASA", "NRO HS"]) ?? -1] || 'SIN DATOS'),

                        particularCity: String(cRow[findCol(clientMap, 'particularCity', ["(PARTICULAR - CIUDAD)", "CIUDAD", "CIUDAD PARTICULAR", "CDAD", "CIUD"]) ?? -1] || 'SIN DATOS'),
                        particularNeighborhood: String(cRow[findCol(clientMap, 'particularNeighborhood', ["(PARTICULAR - BARRIO)", "BARRIO", "BARRIO PARTICULAR", "BARR"]) ?? -1] || 'SIN DATOS'),
                        particularStreetMain: String(cRow[findCol(clientMap, 'particularStreetMain', ["CALLE PRINCIPAL", "(PARTICULAR - DIRECCIÓN - CALLE PRINCIPAL)", "DIRECCIÓN PARTICULAR", "C PRINCIPAL"]) ?? -1] || 'SIN DATOS'),
                        particularStreetSecondary: String(cRow[findCol(clientMap, 'particularStreetSecondary', ["CALLE SECUNDARIA", "(PARTICULAR - DIRECCIÓN - CALLE SECUNDARIA)", "(PARTICULAR - DIRECCIÓN - CALLE SECONDARIA)", "C SECUNDARIA"]) ?? -1] || 'SIN DATOS'),

                        // Datos Laborales
                        workCompany: String(cRow[findCol(clientMap, 'workCompany', ["LABORAL EMPRESA/NEGOCIO", "EMPRESA", "EMPRESA/NEGOCIO", "LUGAR DE TRABAJO", "LABORAL  EMPRESA/NEGOCIO", "EMPR", "NEG"]) ?? -1] || 'SIN DATOS'),
                        workStreetMain: String(cRow[findCol(clientMap, 'workStreetMain', ["DIRECCIÓN NEGOCIO", "CALLE LABORAL", "(LABORAL - DIRECCIÓN - CALLE PRINCIPAL)", "DIR NEG"]) ?? -1] || 'SIN DATOS'),
                        workStreetSecondary: String(cRow[findCol(clientMap, 'workStreetSecondary', ["CALLE SECUNDARIA LABORAL", "(LABORAL - DIRECCIÓN - CALLE SECUNDARIA)", "(LABORAL - DIRECCIÓN - CALLE SECONDARIA)"]) ?? -1] || 'SIN DATOS'),
                        workCity: String(cRow[findCol(clientMap, 'workCity', ["CIUDAD LABORAL", "(LABORAL -  CIUDAD)", "CDAD LAB"]) ?? -1] || 'SIN DATOS'),
                        workNeighborhood: String(cRow[findCol(clientMap, 'workNeighborhood', ["BARRIO LABORAL", "(LABORAL - BARRIO)", "BARR LAB"]) ?? -1] || 'SIN DATOS'),
                        workPosition: String(cRow[findCol(clientMap, 'workPosition', ["CARGO"]) ?? -1] || 'SIN DATOS'),
                        workSector: String(cRow[findCol(clientMap, 'workSector', ["RUBRO", "RUBRO NEGOCIO"]) ?? -1] || 'SIN DATOS'),
                        workAntiquity: String(cRow[findCol(clientMap, 'workAntiquity', ["(ANTIGÜEDAD)", "ANTIGUEDAD", "ANTIGÜEDAD", "ANTIG"]) ?? -1] || 'SIN DATOS'),
                        workIncome: parseAmount(cRow[findCol(clientMap, 'workIncome', ["(LABORAL INGRESOS / SALARIO)", "SALARIO / INGRESOS", "SALARIO", "ING LAB"]) ?? -1] || '0'),
                        workPhone: String(cRow[findCol(clientMap, 'workPhone', ["TELÉFONO LABORAL", "TELÉFONO NEGOCIO", "(LABORAL - TELÉFONO)", "(LABORAL - TELEFONO)", "TEL LAB", "TEL NEG"]) ?? -1] || 'SIN DATOS'),

                        clientTypeCode: String(cRow[findCol(clientMap, 'clientType', ["BANCA (TIPO DE CLIENTE)", "BANCA", "TIPO CLIENTE", "BANCA (TIPO DE CLIENTE", "TIPO CLT"]) ?? -1] || '131'),
                        systemRating: String(cRow[findCol(clientMap, 'rating', ["CALIFICACION EN EL SISTEMA", "CALIFICACION", "CALIF"]) ?? -1] || ''),
                        sellerCode: String(cRow[findCol(clientMap, 'seller', ["CODIGO DE VENDEDOR", "CODIGO VENDEDOR", "VENDEDOR", "CÓD. VENDEDOR"]) ?? -1] || sellerCode || ''),
                        externalId: String(cRow[findCol(clientMap, 'externalId', ["NRO DE OPERACIÓN EN SISTEMA BASE", "OPERACION BASE", "NRO OPERACION", "ID BASE", "ID EXTERNO", "NRO DE OPERACIÓN EN SISTEMA BASE"]) ?? -1] || '').replace(/\D/g, ''),
                        raw_data: clientRawData
                    };
                    clients.push(client);

                    // Find corresponding loan row if loan block exists
                    if (loanMap) {
                        const lRowIndex = loanHeaderRow + 1 + dataIndex;
                        const lRow = rows[lRowIndex];
                        if (lRow && lRow.length > 0) {
                            // --- MAPEADO CRUDO PRÉSTAMO ---
                            const loanRawData: Record<string, any> = {};
                            Object.entries(loanMap).forEach(([headerName, colIdx]) => {
                                const cellValue = lRow[colIdx];
                                if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                                    loanRawData[headerName] = cellValue;
                                }
                            });

                            const principalIdx = findCol(loanMap, 'principal', ["LIQUIDO DESEMBOLSADO", "LIQ. DESEMB", "MONTO PAGARE", "MONTO PAG", "IMPORT. PAGARE", "IMP. PAGARE", "TOTAL DESEMBOLSADO", "PRÉSTAMO", "PRESTAMO", "CAPITAL INICIAL"]);
                            const rawPrincipal = lRow[principalIdx ?? -1];
                            const principal = parseAmount(rawPrincipal);
                            console.log(`💰 [FORENSIC] Campo 'principal': Original="${rawPrincipal}", Final=${principal}`);

                            const importedBalanceIdx = findCol(loanMap, 'balance', ["SALDO ACTUAL", "SALDO PENDIENTE", "SALDO TOTAL", "SALDO", "DEUDA ACTUAL", "RESTANTE", "TOTAL DEUDA", "SALDO A PAGAR"]);
                            const rawBalance = lRow[importedBalanceIdx ?? -1];
                            const legacyBalance = parseAmount(rawBalance);
                            console.log(`💰 [FORENSIC] Campo 'balance': Original="${rawBalance}", Final=${legacyBalance}`);

                            // 2. Obtener el total a pagar del Excel (si existe) o calcularlo
                            const totalAmountStr = String(
                                lRow[loanMap["TOTAL A PAGAR"]] ||
                                lRow[loanMap["MONTO TOTAL"]] ||
                                lRow[loanMap["TOTAL"]] ||
                                lRow[loanMap["TOTAL DEVENSIÓN"]] ||
                                lRow[loanMap["MONTO TOTAL PAGARE"]] ||
                                '0'
                            );

                            const capitalStr = String(lRow[loanMap["SALDO CAPITAL"] ?? loanMap["SALDO CAP"] ?? loanMap["CAPITAL"] ?? (principalIdx ?? -1)] || '0');
                            const interestStr = String(lRow[loanMap["SALDO INTERES"] ?? loanMap["SALDO INT"] ?? loanMap["INTERES"] ?? -1] || '0');

                            const valCapital = parseAmount(capitalStr);
                            const valInterest = parseAmount(interestStr);

                            // RECONSTRUCCIÓN MATEMÁTICA v2.4 (Requerimiento Usuario)
                            // 1. Obtener Monto Cuota y Cantidades
                            const instValueIdx = findCol(loanMap, 'installmentValue', ["MONTO CUOTA", "VAL. CUOTA", "VALOR CUOTA", "CUOTA", "PRECIO CUOTA"]);
                            const instValue = parseAmount(lRow[instValueIdx ?? -1]);

                            const totalInstIdx = findCol(loanMap, 'totalInstallments', ["CUOTAS TOTALES", "CUOTAS TOT", "CANT. CUOTAS", "PLAZO"]);
                            const totalInstInput = Number(lRow[totalInstIdx ?? -1] || 0);

                            const pendingInstIdx = findCol(loanMap, 'pendingInstallments', ["CUOTAS PENDIENTES", "CTAS. PEND", "CUOTAS PENDIENTE", "CUOTA PENDIENTE", "CUOTAS PEND", "RESTANTES", "PENDIENTES", "SALDO CUOTAS", "CUOTAS FALTANTES"]);
                            const pendingInst = Number(lRow[pendingInstIdx ?? -1] || 0);

                            const paidInstIdx = findCol(loanMap, 'paidInstallments', ["CUOTAS PAGADAS", "CTA. PAG", "CUOTAS PAG", "CANT. PAG.", "PAGADAS", "CUOTAS COBRADAS", "CUOTAS TIENE"]);
                            let paidInst = Number(lRow[paidInstIdx ?? -1] || 0);

                            // Si no viene el total de cuotas, intentar deducirlo de pagadas + pendientes
                            const totalInst = totalInstInput || (paidInst + pendingInst) || 24; 
                            
                            // 2. Aplicar Fórmulas del Usuario
                            // Monto Total = Cuotas Totales * Monto Cuota
                            let totalAmount = totalInst * instValue;

                            // Saldo Actual = Cuotas Pendientes * Monto Cuota
                            const currentBalance = pendingInst * instValue;

                            // Si no hay cuotas pagadas explícitas, deducirlas
                            if (paidInst === 0 && totalInst > 0) {
                                paidInst = totalInst - pendingInst;
                            }

                            console.log(`🧮 [MATH FORENSIC v2.4] Cuota=${instValue} | Totales=${totalInst} | Pendientes=${pendingInst} | Pagadas=${paidInst}`);
                            console.log(`🧮 [MATH FORENSIC v2.4] RESULTADO -> Total=${totalAmount} | Saldo=${currentBalance}`);

                            // Fallback por si lo anterior falla
                            if (totalAmount === 0) {
                                totalAmount = parseAmount(totalAmountStr) || (valCapital + valInterest);
                            }

                            // 3. Detectar frecuencia (INTELIGENTE)
                            let frequency = Frequency.DAILY;
                            const freqIdx = findCol(loanMap, 'frequency', ["FRECUENCIA", "MODALIDAD"]);
                            const freqStr = String(lRow[freqIdx ?? -1] || '').toUpperCase();
                            if (freqStr.includes('SEM') || freqStr.includes('7 D')) frequency = Frequency.WEEKLY;
                            else if (freqStr.includes('QUIN') || freqStr.includes('15 D')) frequency = Frequency.BIWEEKLY;
                            else if (freqStr.includes('MEN') || freqStr.includes('30 D')) frequency = Frequency.MONTHLY;

                            // 4. Determinar Saldo Final (REQUERIMIENTO v2.10)
                            // A. Prioridad 1: Suma de Saldo Capital + Saldo Interes
                            const sumBalance = valCapital + valInterest;

                            // B. Prioridad 2: Saldo importado legado si existe
                            // C. Prioridad 3: Cálculo por Cuotas Pendientes
                            let importedBalance = sumBalance > 0 ? sumBalance : (legacyBalance || (pendingInst * instValue));

                            if (sumBalance > 0) {
                                console.log(`🧮 [MATH v2.10] Saldo por SUMA (Cap + Int): ${valCapital} + ${valInterest} = ${importedBalance}`);
                            } else if (pendingInst > 0 && (!legacyBalance || legacyBalance === 0)) {
                                console.log(`🧮 [MATH v2.10] Saldo por CUOTAS: ${pendingInst} * ${instValue} = ${importedBalance}`);
                            }

                            totalAmount = totalAmount || importedBalance || legacyBalance;
                            // ---------------------------------------------

                            const loan: Loan = {
                                id: `L-${clientId}`,
                                clientId,
                                collectorId,
                                principal,
                                totalAmount,
                                totalInstallments: totalInst,
                                installmentValue: instValue,
                                frequency,
                                status: LoanStatus.ACTIVE,
                                branchId: branchId,
                                operationTypeCode: String(lRow[findCol(loanMap, 'operationType', ["TIPO DE OPERACION", "TIPO OPERACION", "TIPO OP"]) ?? -1] || '202'),
                                sellerCode: String(lRow[findCol(loanMap, 'seller', ["CODIGO DE VENDEDOR", "CODIGO VENDEDOR", "VENDEDOR", "CÓD. VENDEDOR"]) ?? -1] || sellerCode || ''),
                                interestRate: principal > 0 ? Math.round(((totalAmount / principal) - 1) * 100) : 20,
                                createdAt: parseExcelDate(lRow[findCol(loanMap, 'date', ["FECHA DE DESEMBOLSO", "FEC. DESEMB", "FECHA INICIO", "FECHA PAGAR"]) ?? -1]),
                                installments: [],
                                raw_data: loanRawData // <-- GUARDA TODO
                            };

                            // Generate historical installments
                            for (let j = 1; j <= totalInst; j++) {
                                loan.installments.push({
                                    number: j,
                                    amount: instValue,
                                    dueDate: new Date().toISOString(), // Standard generation
                                    status: j <= paidInst ? PaymentStatus.PAID : PaymentStatus.PENDING,
                                    paidAmount: j <= paidInst ? instValue : 0
                                });
                            }

                            // 5. GENERAR LOG HISTÓRICO "RECONSTRUIDO" (v2.11)
                            // Calculamos el monto del log para que: TOTAL - LOG = SALDO_DESEADO
                            if (paidInst > 0 || totalAmount > importedBalance) {
                                const logAmount = Math.max(0, totalAmount - importedBalance);
                                if (logAmount > 0) {
                                    logs.push({
                                        id: generateUUID(),
                                        loanId: loan.id,
                                        clientId: client.id,
                                        type: CollectionLogType.PAYMENT,
                                        amount: logAmount,
                                        date: loan.createdAt, // Usamos la fecha de inicio como referencia
                                        location: { lat: 0, lng: 0 },
                                        isOpening: false, // Falso para que 'helpers.ts' lo cuente como un pago real
                                        notes: "Pago histórico importado (Ajuste de Saldo)",
                                        branchId: branchId,
                                        recordedBy: collectorId
                                    });
                                }
                            }

                            loans.push(loan);
                            // Update client current balance
                            client.creditLimit = principal;
                            client.currentBalance = Math.max(0, totalAmount - (paidInst * instValue));
                        }
                    }
                    dataIndex++;
                }

                resolve({ clients, loans, logs });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

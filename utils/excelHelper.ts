import * as XLSX from 'xlsx-js-style';
import { Client, Loan, Frequency, LoanStatus, PaymentStatus } from '../types';
import { parseAmount } from './helpers';

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
            "Fecha Nacimiento": client.birthDate || "A COMPLETAR",
            "Estado Civil": client.maritalStatus || "A COMPLETAR",
            "Profesión": client.profession || "A COMPLETAR",
            "Nombre Cónyuge": client.spouseName || "A COMPLETAR",
            "Documento Cónyuge": client.spouseDocumentId || "A COMPLETAR",
            "Fecha Nacimiento Cónyuge": client.spouseBirthDate || "A COMPLETAR",
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
            "Cód. Vendedor": loan?.sellerCode || "N/A",
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
            "Días Atraso": 0, // Cálculo complejo omitido por brevedad en exportación básica
            "Última Fecha Pago": "N/A",
            "Próximo Vencimiento": "N/A",
            "Ref 1 Nombre": "A COMPLETAR",
            "Ref 1 Teléfono": "A COMPLETAR",
            "Ref 2 Nombre": "A COMPLETAR",
            "Ref 2 Teléfono": "A COMPLETAR",
            "Empresa/Negocio": "A COMPLETAR",
            "Dirección Negocio": "A COMPLETAR",
            "Rubro Negocio": "A COMPLETAR",
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

export const processExcelImport = async (file: File, collectorId: string): Promise<{ clients: Client[], loans: Loan[] }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
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
                    if (clientHeaderRow === -1 && (row.some(r => r.includes("NOMBRE COMPLETO") || r.includes("CLIENTE") || r.includes("NOM. COMPLETO")))) {
                        clientHeaderRow = i;
                    } else if (loanHeaderRow === -1 && (row.some(r => r.includes("LIQUIDO DESEMBOLSADO") || r.includes("SALDO CAPITAL") || r.includes("LIQ. DESEMB") || r.includes("MONTO PAGARE") || r.includes("MONTO PAG")))) {
                        loanHeaderRow = i;
                    }
                }

                if (clientHeaderRow === -1) {
                    // Fallback to old behavior if no special headers found
                    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
                    const clients: Client[] = [];
                    const loans: Loan[] = [];
                    jsonData.forEach((row, index) => {
                        const clientId = row["ID / Código"] || `IMP-${Date.now()}-${index}`;
                        clients.push({
                            id: clientId,
                            name: row["Nombre Completo"] || "NOMBRE A COMPLETAR",
                            documentId: String(row["Cédula"] || "0"),
                            phone: String(row["Teléfono Primario"] || "0"),
                            address: row["Dirección Domicilio"] || "DIRECCIÓN A COMPLETAR",
                            addedBy: collectorId,
                            creditLimit: Number(row["Capital Préstamo"]) || 1000000,
                            isActive: true,
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
                                operationTypeCode: "202",
                                createdAt: new Date().toISOString(),
                                installments: []
                            });
                        }
                    });
                    resolve({ clients, loans });
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

                const clients: Client[] = [];
                const loans: Loan[] = [];

                // 3. Process Data
                // We assume data starts immediately after headers.
                // If there are multiple clients, they should align between blocks if present.
                let dataIndex = 0;
                for (let i = clientHeaderRow + 1; i < rows.length; i++) {
                    const cRow = rows[i];
                    if (!cRow || cRow.length === 0 || !cRow[clientMap["NOMBRE COMPLETO"] || 1]) {
                        // If we skip the client part but haven't reached the loan part, continue?
                        // Or if we hit empty space, maybe we finished the client block.
                        if (loanHeaderRow !== -1 && i >= loanHeaderRow) break;
                        continue;
                    }

                    const clientValue = (val: any) => parseAmount(val);

                    const clientId = `IMP-${Date.now()}-${dataIndex}`;
                    const client: Client = {
                        id: clientId,
                        name: String(cRow[clientMap["NOMBRE COMPLETO"] || clientMap["NOM. COMPLETO"] || clientMap["CLIENTE"] || 1] || ''),
                        documentId: String(cRow[clientMap["NRO DE DOCUMENTO DE IDENT."] || clientMap["CÉDULA"] || clientMap["CEDULA"] || 2] || '0'),
                        phone: String(cRow[clientMap["(PARTICULAR - TELÉFONO)"] || clientMap["TELÉFONO PRIMARIO"] || clientMap["TEL. PRIMARIO"] || 11] || '0'),
                        address: `${cRow[clientMap["LOCALIDAD (CIUDAD)"] || 4] || ''} - ${cRow[clientMap["(PARTICULAR - DIRECCIÓN - CALLE PRINCIPAL)"] || 5] || ''}`,
                        addedBy: collectorId,
                        creditLimit: 1000000,
                        isActive: true,
                        createdAt: new Date().toISOString(),
                        birthDate: cRow[clientMap["FECHA NACIMIENTO"] || clientMap["FEC. NAC"]] ? String(cRow[clientMap["FECHA NACIMIENTO"] || clientMap["FEC. NAC"]]) : undefined,
                        clientTypeCode: String(cRow[clientMap["BANCA (TIPO DE CLIENTE)"] || clientMap["BANCA"] || clientMap["TIPO CLIENTE"]] || '131'),
                        systemRating: String(cRow[clientMap["CALIFICACION EN EL SISTEMA"] || clientMap["CALIFICACION"] || clientMap["CALIF"]] || ''),
                    };
                    clients.push(client);

                    // Find corresponding loan row if loan block exists
                    if (loanMap) {
                        const lRowIndex = loanHeaderRow + 1 + dataIndex;
                        const lRow = rows[lRowIndex];
                        if (lRow && lRow.length > 0) {
                            const principalStr = String(lRow[loanMap["LIQUIDO DESEMBOLSADO"] || loanMap["LIQ. DESEMB"] || loanMap["MONTO PAGARE"] || loanMap["MONTO PAG"]] || '0');
                            const principal = clientValue(principalStr);

                            const capitalStr = String(lRow[loanMap["SALDO CAPITAL"] || loanMap["LIQUIDO DESEMBOLSADO"] || loanMap["LIQ. DESEMB"] || loanMap["MONTO PAGARE"] || loanMap["MONTO PAG"]] || '0');
                            const interestStr = String(lRow[loanMap["SALDO INTERES"] || loanMap["SALDO INT"]] || '0');
                            const totalAmount = clientValue(capitalStr) + clientValue(interestStr);

                            const totalInst = Number(lRow[loanMap["CUOTAS TOTALES"] || loanMap["CUOTAS TOT"]] || 0);
                            const paidInst = Number(lRow[loanMap["CUOTAS PAGADAS"] || loanMap["CUOTAS PAG"]] || 0);
                            const instValue = clientValue(lRow[loanMap["MONTO CUOTA"] || loanMap["CUOTA"]]);

                            const loan: Loan = {
                                id: `L-${clientId}`,
                                clientId,
                                collectorId,
                                principal,
                                totalAmount,
                                totalInstallments: totalInst,
                                installmentValue: instValue,
                                frequency: Frequency.DAILY, // Standard default for these imports
                                status: LoanStatus.ACTIVE,
                                operationTypeCode: String(lRow[loanMap["TIPO DE OPERACION"] || loanMap["TIPO OPERACION"] || loanMap["TIPO OP"]] || '202'),
                                sellerCode: String(lRow[loanMap["CODIGO DE VENDEDOR"] || loanMap["CODIGO VENDEDOR"] || loanMap["COD. VEND"] || loanMap["VENDEDOR"]] || ''),
                                interestRate: principal > 0 ? Math.round(((totalAmount / principal) - 1) * 100) : 20,
                                createdAt: lRow[loanMap["FECHA DE DESEMBOLSO"] || loanMap["FEC. DESEMB"]] ? new Date(lRow[loanMap["FECHA DE DESEMBOLSO"] || loanMap["FEC. DESEMB"]]).toISOString() : new Date().toISOString(),
                                installments: []
                            };

                            // Generate historical installments
                            for (let j = 1; j <= totalInst; j++) {
                                loan.installments.push({
                                    number: j,
                                    amount: instValue,
                                    dueDate: new Date().toISOString(), // Mocking dates for imported history
                                    status: j <= paidInst ? PaymentStatus.PAID : PaymentStatus.PENDING,
                                    paidAmount: j <= paidInst ? instValue : 0
                                });
                            }

                            loans.push(loan);
                            // Update client current balance
                            client.creditLimit = principal;
                            client.currentBalance = totalAmount - (paidInst * instValue);
                        }
                    }
                    dataIndex++;
                }

                resolve({ clients, loans });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

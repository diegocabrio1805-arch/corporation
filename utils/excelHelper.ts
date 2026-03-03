import * as XLSX from 'xlsx-js-style';
import { Client, Loan, Frequency, LoanStatus, PaymentStatus } from '../types';

export const EXCEL_COLUMNS = [
    "ID / Código", "Nombre Completo", "Cédula", "Teléfono Primario", "Teléfono Secundario",
    "Dirección Domicilio", "Nacionalidad", "Fecha Nacimiento", "Estado Civil", "Profesión",
    "Nombre Cónyuge", "Documento Cónyuge", "Fecha Nacimiento Cónyuge", "Profesión Cónyuge",
    "Lugar Trabajo Cónyuge", "Teléfono Laboral Cónyuge", "Ingresos Cónyuge",
    "Tipo Vivienda", "Antigüedad Residencia", "Latitud Domicilio", "Longitud Domicilio",
    "Tipo de Cliente", "Capital Préstamo", "Interés (%)", "Cuotas Totales", "Frecuencia",
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
            "Tipo de Cliente": client.clientType || "A COMPLETAR",
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
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

                const clients: Client[] = [];
                const loans: Loan[] = [];

                jsonData.forEach((row, index) => {
                    const clientId = row["ID / Código"] || `IMP-${Date.now()}-${index}`;

                    const newClient: Client = {
                        id: clientId,
                        name: row["Nombre Completo"] || "NOMBRE A COMPLETAR",
                        documentId: String(row["Cédula"] || "0"),
                        phone: String(row["Teléfono Primario"] || "0"),
                        address: row["Dirección Domicilio"] || "DIRECCIÓN A COMPLETAR",
                        addedBy: collectorId,
                        creditLimit: Number(row["Capital Préstamo"]) || 1000000,
                        isActive: true,
                        createdAt: new Date().toISOString(),
                        nationality: row["Nacionalidad"],
                        birthDate: row["Fecha Nacimiento"] ? String(row["Fecha Nacimiento"]) : undefined,
                        maritalStatus: row["Estado Civil"],
                        profession: row["Profesión"],
                        spouseName: row["Nombre Cónyuge"],
                        clientType: row["Tipo de Cliente"]
                    };

                    clients.push(newClient);

                    if (row["Capital Préstamo"]) {
                        const loan: Loan = {
                            id: `L-${clientId}`,
                            clientId: clientId,
                            collectorId: collectorId,
                            principal: Number(row["Capital Préstamo"]),
                            interestRate: Number(row["Interés (%)"]) || 20,
                            totalInstallments: Number(row["Cuotas Totales"]) || 24,
                            frequency: (row["Frecuencia"] as Frequency) || Frequency.DAILY,
                            totalAmount: Number(row["Total a Pagar"]) || Number(row["Capital Préstamo"]) * 1.2,
                            installmentValue: Number(row["Valor Cuota"]) || 0,
                            status: LoanStatus.ACTIVE,
                            createdAt: row["Fecha Inicio"] ? new Date(row["Fecha Inicio"]).toISOString() : new Date().toISOString(),
                            installments: [] // Las cuotas se generarían al guardar si el sistema lo requiere
                        };
                        loans.push(loan);
                    }
                });

                resolve({ clients, loans });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

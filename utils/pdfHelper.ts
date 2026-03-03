
import { jsPDF } from 'jspdf';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Capacitor } from '@capacitor/core';

/**
 * Saves and opens a PDF. Use this instead of doc.save().
 * @param doc The jsPDF instance
 * @param fileName The desired filename (e.g., 'reporte.pdf')
 */
export const saveAndOpenPDF = async (doc: jsPDF, fileName: string) => {
    if (Capacitor.isNativePlatform()) {
        try {
            // 1. Get base64 content (without data URI prefix)
            const base64 = doc.output('datauristring').split(',')[1];

            // 2. Write file to Documents directory (or External)
            const directory = Directory.External;

            const result = await Filesystem.writeFile({
                path: fileName,
                data: base64,
                directory: directory,
            });

            // 3. Open the file
            await FileOpener.open({
                filePath: result.uri,
                contentType: 'application/pdf'
            });

            return true;
        } catch (error) {
            console.error('Error saving/opening PDF:', error);
            alert('Error al abrir el PDF: ' + (error instanceof Error ? error.message : String(error)));
            return false;
        }
    } else {
        // Web fallback: Open in new tab AND download
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');

        // Also trigger download if preferred, or let browser handle preview
        doc.save(fileName);

        // Cleanup URL after some time
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return true;
    }
};

/**
 * Saves and opens a PDF from a base64 string (Data URI or raw base64).
 */
export const saveAndOpenBase64PDF = async (base64Data: string, fileName: string) => {
    if (Capacitor.isNativePlatform()) {
        try {
            const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
            const directory = Directory.External;

            const result = await Filesystem.writeFile({
                path: fileName,
                data: base64,
                directory: directory,
            });

            await FileOpener.open({
                filePath: result.uri,
                contentType: 'application/pdf'
            });

            return true;
        } catch (error) {
            console.error('Error saving/opening Base64 PDF:', error);
            alert('Error al abrir el PDF.');
            return false;
        }
    } else {
        // Web fallback: Open in new tab
        const byteCharacters = atob(base64Data.includes(',') ? base64Data.split(',')[1] : base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');

        // Also trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();

        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return true;
    }
};

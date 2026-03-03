
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
            // On Android 11+, Directory.Documents is scoped storage friendly?
            // Or use Directory.External to write to app-specific external storage which doesn't need permissions
            // We added <external-files-path> which maps to Directory.External
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
        // Web fallback
        doc.save(fileName);
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
        // Web fallback: download using a link
        const link = document.createElement('a');
        link.href = base64Data.startsWith('data:') ? base64Data : `data:application/pdf;base64,${base64Data}`;
        link.download = fileName;
        link.click();
        return true;
    }
};

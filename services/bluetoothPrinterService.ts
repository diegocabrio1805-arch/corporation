// bluetoothPrinterService.ts
// Servicio Híbrido Optimizado: Soporta Plugin Nativo (Cordova/Capacitor) y Web Bluetooth API
// Optimizaciones para gama baja: Chunking, Retries y Timeouts extendidos.

let connectedDevice: any = null;
let printerCharacteristic: any = null;
let isNativeConnection = false;
let isCurrentlyPrinting = false;
let connectionKeeperInterval: any = null; // Interval ID for keep-alive

// Claves para persistencia
const PRINTER_STORAGE_KEY = 'saved_printer_address';

// Configuración OPTIMIZADA
const CHUNK_SIZE = 200; // Aumentado para menos iteraciones
const CHUNK_DELAY = 15; // Reducido drásticamente (antes 100ms) para velocidad
const CONNECTION_RETRIES = 3; // Menos reintentos pero más rápidos
const RETRY_DELAY = 500; // 500ms entre intentos iniciales
const KEEPER_INTERVAL_MS = 5000; // 5s: Reconexión más agresiva solicitada por el usuario

// Helper seguro para obtener la referencia al plugin
const getBluetoothSerial = (): any => {
    // @ts-ignore
    return window.BluetoothSerial || window.bluetoothSerial || (window.cordova ? (window.cordova.plugins && window.cordova.plugins.BluetoothSerial) : null);
};

// Helper para esperar al plugin con timeout
const waitForPlugin = async (): Promise<boolean> => {
    let attempts = 0;
    while (attempts < 20) { // 2 segundos
        if (getBluetoothSerial()) return true;
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    return !!getBluetoothSerial();
};

// Utility: Espera asíncrona
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Verificar estado y activar Bluetooth
export const checkBluetoothEnabled = async (): Promise<boolean> => {
    await waitForPlugin();
    const bs = getBluetoothSerial();
    if (!bs) return false;

    return new Promise((resolve) => {
        bs.isEnabled(
            () => resolve(true),
            () => resolve(false)
        );
    });
};

export const enableBluetooth = async (): Promise<boolean> => {
    await waitForPlugin();
    const bs = getBluetoothSerial();
    if (!bs) return false;

    return new Promise((resolve) => {
        bs.enable(
            () => resolve(true),
            () => resolve(false)
        );
    });
};

// 2. Listar dispositivos pareados (Solo Nativo)
export const listBondedDevices = async (): Promise<any[]> => {
    await waitForPlugin();
    const bs = getBluetoothSerial();
    if (!bs) return [];

    return new Promise((resolve, reject) => {
        bs.list(
            (devices: any[]) => resolve(devices),
            (err: any) => reject(err)
        );
    });
};

// 3. Conexión Genérica Robusta
const attemptNativeConnection = async (address: string, attemptNumber = 1, silent = false): Promise<boolean> => {
    const bs = getBluetoothSerial();
    return new Promise((resolve) => {
        if (!silent) console.log(`[Bluetooth] Connection attempt ${attemptNumber} to ${address}...`);
        bs.connect(
            address,
            () => {
                if (!silent) console.log(`[Bluetooth] ✓ Connected successfully on attempt ${attemptNumber}`);
                isNativeConnection = true;
                connectedDevice = { address };
                localStorage.setItem(PRINTER_STORAGE_KEY, address);
                resolve(true);
            },
            (err: any) => {
                if (!silent) console.warn(`[Bluetooth] ✗ Attempt ${attemptNumber} failed:`, err?.message || err);
                resolve(false);
            }
        );
    });
};

export const connectToPrinter = async (addressOrId?: string, forceReconnect = false, silent = false): Promise<boolean> => {
    // A. Intento Nativo con Retries
    if (await waitForPlugin()) {
        const bs = getBluetoothSerial();
        const savedAddress = localStorage.getItem(PRINTER_STORAGE_KEY);
        const targetAddress = addressOrId || savedAddress;

        if (!targetAddress) {
            if (!silent) console.log("No address provided and none saved.");
            return false;
        }

        // FAST PATH: Verificar si ya está conectado al dispositivo correcto
        if (!forceReconnect) {
            const isConnectedNow = await new Promise<boolean>(r => bs.isConnected(() => r(true), () => r(false)));
            if (isConnectedNow) {
                if (!silent) console.log('[Bluetooth] Fast Path: Already connected');
                isNativeConnection = true;
                connectedDevice = { address: targetAddress };
                return true;
            }
        }

        // Solo desconectar si forzamos reconexión o falló el chequeo rápido
        if (forceReconnect) {
            try {
                await new Promise<void>(r => bs.disconnect(() => r(), () => r()));
                await sleep(300); // Reduce wait time
            } catch (e) {
                if (!silent) console.log('[Bluetooth] No previous connection to clear');
            }
        }

        // Intentar conectar con retries optimizados
        if (!silent) console.log(`[Bluetooth] Starting connection to ${targetAddress}...`);
        for (let i = 0; i < CONNECTION_RETRIES; i++) {
            const success = await attemptNativeConnection(targetAddress, i + 1, silent);
            if (success) {
                await sleep(200); // Reduced stabilization delay
                return true;
            }
            if (i < CONNECTION_RETRIES - 1) {
                // Faster retries: 500ms, 1000ms, 1500ms
                const delay = RETRY_DELAY * (i + 1);
                if (!silent) console.log(`[Bluetooth] Waiting ${delay}ms before retry...`);
                await sleep(delay);
            }
        }
        return false;
    }

    // B. Fallback Web Bluetooth (si no hay plugin)
    if (!('bluetooth' in navigator)) return false;

    try {
        // @ts-ignore
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
        });
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const characteristics = await service.getCharacteristics();
        printerCharacteristic = characteristics[0];
        connectedDevice = device;
        isNativeConnection = false;
        return true;
    } catch (e) {
        return false;
    }
};

// 4. Función de Impresión Robusta con Chunking Rápido
export const printText = async (rawText: string, retryCount = 0): Promise<boolean> => {
    if (isCurrentlyPrinting && retryCount === 0) {
        console.warn("Print already in progress. Skipping duplicate request.");
        return false;
    }

    isCurrentlyPrinting = true;
    const bs = getBluetoothSerial();

    // Asegurar conexión antes de imprimir (sin forzar desconexión inicial)
    const connected = await isPrinterConnected();
    if (!connected) {
        console.log("Printer not connected. Attempting fast connection...");
        const reconnected = await connectToPrinter(undefined, false);
        if (!reconnected) {
            isCurrentlyPrinting = false;
            return false;
        }
    }

    // Definición de Comandos ESC/POS
    const ESC = '\x1B';
    const GS = '\x1D';
    const CMD_BOLD_ON = ESC + 'E' + '\x01';
    const CMD_BOLD_OFF = ESC + 'E' + '\x00';
    const CMD_SIZE_LARGE = GS + '!' + '\x11'; // Doble ancho y alto
    const CMD_SIZE_MEDIUM = GS + '!' + '\x01'; // Doble alto, ancho normal
    const CMD_SIZE_NORMAL = GS + '!' + '\x00';

    // --- MARGIN LOGIC ---
    const getPrintMargin = (): number => {
        const saved = localStorage.getItem('printer_margin_bottom');
        const val = saved ? parseInt(saved, 10) : 2; // Default to 2 lines if not set (matches Settings default)
        return isNaN(val) ? 2 : val;
    };
    const marginLines = getPrintMargin();
    const marginText = '\n'.repeat(marginLines);

    // Append margin to the raw text (Feed paper)
    const finalText = rawText + marginText;

    // Normalizar texto y parsear etiquetas
    const parts = finalText.split(/(<B[01]>|<GS[012]>)/);

    const sendChunk = async (chunk: string): Promise<void> => {
        if (chunk === '<B1>') return bs ? bs.write(CMD_BOLD_ON) : printerCharacteristic.writeValue(new Uint8Array([0x1B, 0x45, 0x01]));
        if (chunk === '<B0>') return bs ? bs.write(CMD_BOLD_OFF) : printerCharacteristic.writeValue(new Uint8Array([0x1B, 0x45, 0x00]));
        if (chunk === '<GS1>') return bs ? bs.write(CMD_SIZE_LARGE) : printerCharacteristic.writeValue(new Uint8Array([0x1D, 0x21, 0x11]));
        if (chunk === '<GS2>') return bs ? bs.write(CMD_SIZE_MEDIUM) : printerCharacteristic.writeValue(new Uint8Array([0x1D, 0x21, 0x01]));
        if (chunk === '<GS0>') return bs ? bs.write(CMD_SIZE_NORMAL) : printerCharacteristic.writeValue(new Uint8Array([0x1D, 0x21, 0x00]));

        const cleanText = chunk.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (isNativeConnection && bs) {
            // Optimización: Enviar chunks más grandes con menos delay
            for (let i = 0; i < cleanText.length; i += CHUNK_SIZE) {
                await new Promise<void>((res, rej) => bs.write(cleanText.substring(i, i + CHUNK_SIZE), res, rej));
                await sleep(CHUNK_DELAY); // 15ms
            }
        } else if (printerCharacteristic) {
            const encoder = new TextEncoder();
            for (let i = 0; i < cleanText.length; i += CHUNK_SIZE) {
                await printerCharacteristic.writeValue(encoder.encode(cleanText.substring(i, i + CHUNK_SIZE)));
                await sleep(CHUNK_DELAY);
            }
        }
    };

    try {
        for (const part of parts) {
            if (part) await sendChunk(part);
        }
        return true;
    } catch (e) {
        console.warn("Print failed. Attempting recovery...", e);
        if (retryCount < 1) { // Solo 1 reintento para no bloquear
            // Forzar reconexión "limpia" solo si falló la escritura
            const reconnected = await connectToPrinter(undefined, true);
            if (reconnected) {
                return printText(rawText, retryCount + 1);
            }
        }
        return false;
    } finally {
        isCurrentlyPrinting = false;
    }
};

export const isPrintingNow = () => isCurrentlyPrinting;

export const isPrinterConnected = async (): Promise<boolean> => {
    const bs = getBluetoothSerial();
    if (isNativeConnection && bs) {
        return new Promise((resolve) => {
            bs.isConnected(() => resolve(true), () => resolve(false));
        });
    }
    return !!(connectedDevice && connectedDevice.gatt.connected);
};

// 5. CONNECTION KEEPER (Mantiene la conexi?n viva y reconecta autom?ticamente)
export const forceReconnect = async (): Promise<boolean> => {
    const savedAddress = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (!savedAddress) return false;
    console.log("[Bluetooth] Forcing fresh reconnection...");
    return await connectToPrinter(savedAddress, true, false);
};

export const startConnectionKeeper = () => {
    if (connectionKeeperInterval) return;

    console.log("[Bluetooth Keeper] Starting background connection keeper...");
    connectionKeeperInterval = setInterval(async () => {
        if (isCurrentlyPrinting) return;

        const savedAddress = localStorage.getItem(PRINTER_STORAGE_KEY);
        if (!savedAddress) return;

        try {
            const connected = await isPrinterConnected();
            if (!connected) {
                console.log("[Bluetooth Keeper] Lost connection. Attempting silent reconnect...");
                await connectToPrinter(savedAddress, false, true);
            }
        } catch (e) {
            console.warn("[Bluetooth Keeper] Error checking status:", e);
        }
    }, KEEPER_INTERVAL_MS);
};

export const stopConnectionKeeper = () => {
    if (connectionKeeperInterval) {
        clearInterval(connectionKeeperInterval);
        connectionKeeperInterval = null;
        console.log("[Bluetooth Keeper] Stopped.");
    }
};

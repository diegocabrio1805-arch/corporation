import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anexocobro.app',
  appName: 'ANEXO COBRANZA COBRADOR',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  server: {
    // URL de Puesta en Producción (GitHub Pages)
    url: 'https://diegocabrio1805-arch.github.io/cobros/',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false, // Mantener Splash Screen hasta que cargue la web
      backgroundColor: "#ffffffff",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    StatusBar: {
      style: "DARK",
      overlay: true,
    }
  }
};

export default config;

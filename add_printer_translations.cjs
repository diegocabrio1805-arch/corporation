const fs = require('fs');
let content = fs.readFileSync('utils/translations.ts', 'utf8');

const additions = {
  es: {
    linkPrinterTitle: "Vincular Impresora",
    searchLinkedBtn: "BUSCAR VINCULADOS",
    noDevicesFound: "No se encontraron dispositivos",
    printerBluetoothHint: "Asegúrate de haber vinculado tu impresora en los ajustes de Bluetooth del celular.",
    unknownDevice: "Desconocido"
  },
  en: {
    linkPrinterTitle: "Link Printer",
    searchLinkedBtn: "SEARCH PAIRED",
    noDevicesFound: "No devices found",
    printerBluetoothHint: "Make sure you have paired your printer in your phone's Bluetooth settings.",
    unknownDevice: "Unknown"
  },
  pt: {
    linkPrinterTitle: "Vincular Impressora",
    searchLinkedBtn: "BUSCAR PAREADOS",
    noDevicesFound: "Nenhum dispositivo encontrado",
    printerBluetoothHint: "Certifique-se de ter pareado sua impressora nas configurações de Bluetooth do seu celular.",
    unknownDevice: "Desconhecido"
  },
  fr: {
    linkPrinterTitle: "Lier une Imprimante",
    searchLinkedBtn: "CHERCHER LES ASSOCIÉS",
    noDevicesFound: "Aucun appareil trouvé",
    printerBluetoothHint: "Assurez-vous d'avoir associé votre imprimante dans les paramètres Bluetooth de votre téléphone.",
    unknownDevice: "Inconnu"
  }
};

for (const lang of ['es', 'en', 'pt', 'fr']) {
  const settingsRegex = new RegExp('( *' + lang + ':\\s*\\{[\\s\\S]*?settingsPage:\\s*\\{[\\s\\S]*?)( *linked:.*?)\\n');
  const match = content.match(settingsRegex);
  if (match) {
    const toAdd = Object.entries(additions[lang]).map(([k, v]) => `      ${k}: "${v}",\n`).join('');
    content = content.replace(settingsRegex, `$1${toAdd}$2\n`);
  }
}

fs.writeFileSync('utils/translations.ts', content, 'utf8');
console.log('Translations added successfully.');

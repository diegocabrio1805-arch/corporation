
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] && process.argv[2].toUpperCase() === 'COLLECTOR' ? 'COLLECTOR' : 'ADMIN';

console.log(`--- CONFIGURANDO PARA MODO: ${mode} ---`);

const paths = {
    buildConfig: path.join(__dirname, '..', 'build_config.ts'),
    capacitorConfig: path.join(__dirname, '..', 'capacitor.config.ts'),
    androidStrings: path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml')
};

// 1. Update build_config.ts
const buildConfigContent = `
/**
 * CONFIGURACIÓN DE COMPILACIÓN
 * Cambiar APP_MODE a 'COLLECTOR' para la versión del cobrador.
 * Cambiar APP_MODE a 'ADMIN' para la versión del administrador.
 */
export const APP_MODE = '${mode}';
`;
fs.writeFileSync(paths.buildConfig, buildConfigContent.trim() + '\n');
console.log('✅ build_config.ts actualizado.');

// 2. Update capacitor.config.ts
const appName = mode === 'COLLECTOR' ? 'ANEXO COBRANZA COBRADOR' : 'ANEXO COBRANZA ADMINISTRADOR';
let capacitorConfig = fs.readFileSync(paths.capacitorConfig, 'utf8');
capacitorConfig = capacitorConfig.replace(/appName: '.*'/, `appName: '${appName}'`);
fs.writeFileSync(paths.capacitorConfig, capacitorConfig);
console.log('✅ capacitor.config.ts actualizado.');

// 3. Update android/app/src/main/res/values/strings.xml
if (fs.existsSync(paths.androidStrings)) {
    let stringsXml = fs.readFileSync(paths.androidStrings, 'utf8');
    stringsXml = stringsXml.replace(/<string name="app_name">.*<\/string>/, `<string name="app_name">${appName.toLowerCase()}<\/string>`);
    stringsXml = stringsXml.replace(/<string name="title_activity_main">.*<\/string>/, `<string name="title_activity_main">${appName.toLowerCase()}<\/string>`);
    fs.writeFileSync(paths.androidStrings, stringsXml);
    console.log('✅ strings.xml actualizado.');
} else {
    console.log('⚠️ No se encontró strings.xml, saltando actualización nativa.');
}

console.log(`--- LISTO PARA COMPILAR LA APK (${mode}) ---`);

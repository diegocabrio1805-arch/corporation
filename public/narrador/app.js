const textInput = document.getElementById('textInput');
const voiceSelect = document.getElementById('voiceSelect');
const rateInput = document.getElementById('rate');
const pitchInput = document.getElementById('pitch');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const charCount = document.getElementById('charCount');
const linkBtn = document.getElementById('linkBtn');
const copyToChatBtn = document.getElementById('copyToChatBtn');
const micBtn = document.getElementById('micBtn');
const syncStatus = document.getElementById('syncStatus');
const chatHistory = document.getElementById('chatHistory');

function addChatMessage(text) {
    const placeholder = chatHistory.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message';
    msgDiv.textContent = text;
    chatHistory.appendChild(msgDiv);
    
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

const synth = window.speechSynthesis;
let voices = [];
let isLinking = false;
let lastSyncTime = 0;

// Cargar Voces
function loadVoices() {
    voices = synth.getVoices();
    
    // Filtrar voces: Intentar priorizar femeninas y jóvenes por nombre/metadatos
    // En español: Microsoft Helena, Microsoft Sabina, etc.
    // Palabras clave para identificar voces femeninas y masculinas
    const femaleKeywords = ['helena', 'sabina', 'laura', 'maria', 'zira', 'daria', 'linda', 'female', 'mujer', 'victoria'];
    const maleKeywords = ['pablo', 'raul', 'david', 'jorge', 'male', 'hombre', 'tomas', 'carlos'];
    
    // Filtrar para mantener SOLO voces femeninas
    const femaleVoices = voices.filter(voice => {
        const name = voice.name.toLowerCase();
        // Si tiene nombre de hombre, la descartamos
        if (maleKeywords.some(kw => name.includes(kw))) return false;
        // Si tiene nombre de mujer o es de Google (suele ser femenina por defecto), la aceptamos
        if (femaleKeywords.some(kw => name.includes(kw)) || name.includes('google')) return true;
        // Por defecto excluimos para limpiar la lista
        return false;
    });

    // Ordenar español primero
    const sortedVoices = femaleVoices.sort((a, b) => {
        if (a.lang.includes('es') && !b.lang.includes('es')) return -1;
        if (!a.lang.includes('es') && b.lang.includes('es')) return 1;
        return 0;
    });

    voiceSelect.innerHTML = sortedVoices
        .map(voice => `<option value="${voice.name}">${voice.name} (${voice.lang})</option>`)
        .join('');

}

// Inicializar voces
loadVoices();
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
}

// Motor de Corrección y Expresividad
function enhanceTextForSpeech(text) {
    let enhanced = text;
    // Correcciones ortográficas y de jerga de chat
    const dictionary = {
        '\\bq\\b': 'que',
        '\\bxq\\b': 'porque',
        '\\btmb\\b': 'también',
        '\\bvdd\\b': 'verdad',
        '\\bbn\\b': 'bien',
        '\\bxd\\b': 'jaja',
        '\\bporq\\b': 'porque',
        '\\bpa\\b': 'para',
        '\\bmx\\b': 'mucho'
    };

    for (const [pattern, replacement] of Object.entries(dictionary)) {
        enhanced = enhanced.replace(new RegExp(pattern, 'gi'), replacement);
    }

    // Mejorar pausas para mayor fluidez
    enhanced = enhanced.replace(/\n+/g, '. '); // Saltos de línea como puntos
    enhanced = enhanced.replace(/([.!?])\s*([a-zA-Z])/g, (match, p1, p2) => `${p1} ${p2.toUpperCase()}`);

    return enhanced;
}

// Función de Hablar
function speak() {
    if (synth.speaking) {
        synth.resume();
        return;
    }

    if (textInput.value !== '') {
        // Aplicar motor de corrección
        let textToSpeak = enhanceTextForSpeech(textInput.value);
        const utterThis = new SpeechSynthesisUtterance(textToSpeak);
        
        const selectedVoice = voices.find(v => v.name === voiceSelect.value);
        if (selectedVoice) {
            utterThis.voice = selectedVoice;
        }

        utterThis.rate = rateInput.value;
        utterThis.pitch = pitchInput.value;

        utterThis.onend = () => {
            playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        };

        playBtn.innerHTML = '<i class="fa-solid fa-waveform"></i>';
        synth.speak(utterThis);
    }
}

// Event Listeners
playBtn.addEventListener('click', speak);
pauseBtn.addEventListener('click', () => synth.pause());
stopBtn.addEventListener('click', () => synth.cancel());
clearBtn.addEventListener('click', () => {
    textInput.value = '';
    updateCharCount();
});

textInput.addEventListener('input', updateCharCount);

function updateCharCount() {
    charCount.textContent = `${textInput.value.length} caracteres`;
}

// Sistema de Enlace (Polling)
linkBtn.addEventListener('click', () => {
    isLinking = !isLinking;
    linkBtn.classList.toggle('active', isLinking);
    syncStatus.querySelector('.dot').classList.toggle('linking', isLinking);
    syncStatus.innerHTML = isLinking ? 
        '<span class="dot linking"></span> Sincronizado con Antigravity' : 
        '<span class="dot"></span> Modo Local';
    
    if (isLinking) {
        startPolling();
    }
});

async function startPolling() {
    if (!isLinking) return;

    try {
        // Intentamos leer el archivo de sincronización
        const response = await fetch('sync.json?t=' + Date.now());
        const data = await response.json();

        if (data.timestamp > lastSyncTime) {
            // Añadir al historial visual
            addChatMessage(data.text);
            lastSyncTime = data.timestamp;
            
            // Hablar directamente el mensaje recibido
            if (synth.speaking) synth.cancel();
            
            let textToSpeak = enhanceTextForSpeech(data.text);
            const utterThis = new SpeechSynthesisUtterance(textToSpeak);
            
            const selectedVoice = voices.find(v => v.name === voiceSelect.value);
            if (selectedVoice) {
                utterThis.voice = selectedVoice;
            }

            utterThis.rate = rateInput.value;
            utterThis.pitch = pitchInput.value;
            
            playBtn.innerHTML = '<i class="fa-solid fa-waveform"></i>';
            utterThis.onend = () => {
                playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            };

            synth.speak(utterThis);
        }
    } catch (e) {
        // El archivo podría no existir aún
    }

    if (isLinking) {
        setTimeout(startPolling, 2000);
    }
}

// Enviar al Chat (Copiar al portapapeles)
copyToChatBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(textInput.value).then(() => {
        copyToChatBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>COPIADO</span>';
        setTimeout(() => {
            copyToChatBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>ENVIAR AL CHAT</span>';
        }, 2000);
    });
});

// Dictado por Voz (Speech Recognition)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;

    micBtn.addEventListener('click', () => {
        recognition.start();
        micBtn.classList.add('listening');
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        textInput.value += (textInput.value ? ' ' : '') + transcript;
        updateCharCount();
        micBtn.classList.remove('listening');
    };

    recognition.onerror = () => {
        micBtn.classList.remove('listening');
    };
} else {
    micBtn.style.display = 'none';
}

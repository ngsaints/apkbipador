/**
 * Bipador Controller - WMS Rocket (Especial para Netum Q900)
 * Lógica de captura de códigos de barras ultra-rápida.
 */

const API_ENDPOINT = 'https://wmsrocket.base44.app/api/wms-api/bipar-item';
const input = document.getElementById('barcode-input');
const statusText = document.getElementById('status-text');
const statusIndicator = document.getElementById('status-indicator');
const counterEl = document.getElementById('counter');
const lastItemEl = document.getElementById('last-item');
const visualFeedback = document.querySelector('.visual-feedback');

let scanCount = 0;
let currentOrderId = null; 
let isWaitingForTracking = false; // Estado para quando termina os itens e aguarda o selo
let countdownTimer = null;
const DEVICE_ID = 'Q900-Agent';
const TRANSITION_DELAY = 3000; // Tempo em MS (pode vir de config futuramente)

// 1. Manter o foco no input o tempo todo para garantir que o scanner funcione
function keepFocus() {
    input.focus();
    console.log('Foco retido para o scanner.');
}

window.addEventListener('click', keepFocus);
window.addEventListener('load', () => {
    keepFocus();
    checkUrlParams(); // Verifica se o pedido veio via URL ao abrir
});
input.addEventListener('blur', () => setTimeout(keepFocus, 50)); 

// 2. Capturar ID do pedido via URL (Se disparado pela interface Web da Base44)
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId') || params.get('pedido');
    
    if (orderId) {
        console.log('Pedido recebido via URL:', orderId);
        loadOrder(orderId);
    }
}
// 2. Detectar bipagem do scanner
input.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
        const rawContent = input.value.trim();
        if (rawContent.length > 0) {
            const barcode = parseBarcode(rawContent);
            await processScan(barcode);
        }
        input.value = '';
    }
});

// Helper: Extrai o ID se o código for um JSON (Flex/QR)
function parseBarcode(raw) {
    try {
        const obj = JSON.parse(raw);
        return obj.id || raw; 
    } catch (e) {
        return raw; 
    }
}

// 3. Processar o código
async function processScan(barcode) {
    applyFlashEffect();

    if (!currentOrderId) {
        await loadOrder(barcode);
        return;
    }

    if (isWaitingForTracking) {
        await confirmFinalization(barcode);
    } else {
        await biparItem(barcode);
    }
}

// 3.1 Busca detalhes do pedido (Passo 2.2 da descrição)
async function loadOrder(orderQuery) {
    showStatus('CARREGANDO PEDIDO...', 'ready');
    // Aceita tanto ID interno quanto número do pedido (Query flexível)
    const URL_DETALHES = `https://wmsrocket.base44.app/api/wms-api/pedido-detalhes?query=${orderQuery}`;

    try {
        const response = await fetch(URL_DETALHES);
        const data = await response.json();

        if (response.ok && data.id) {
            currentOrderId = data.id; // Agora temos o ID real do banco
            scanCount = 0; 
            counterEl.innerText = '0';
            lastItemEl.innerText = 'Pedido Ativo: ' + (data.order_number || orderQuery);
            showStatus('PRONTO PARA BIPAR SKUs', 'success');
        } else {
            handleError('Pedido não identificado');
        }
    } catch (error) {
        handleError('Erro ao conectar com o servidor');
    }
}

// 3.2 Envia a bipagem do SKU (Passo 2.1 da descrição)
async function biparItem(sku) {
    showStatus('BIPANDO ITEM...', 'ready');

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pedido_id: currentOrderId,
                sku: sku,
                device: 'Q900',
                timestamp: new Date().toISOString()
            })
        });

        const result = await response.json();

        if (response.ok) {
            handleSuccess(sku);
            
            // Se a API retornar que o pedido já pode imprimir/embalar
            if (result.prontoParaEmbalar || result.finalizado) {
                isWaitingForTracking = true;
                showStatus('ITENS COMPLETOS! BIPAR RASTREIO DA ETIQUETA.', 'success');
                lastItemEl.innerText = 'Aguardando Código de Rastreio...';
            }
        } else {
            handleError(result.message || 'Erro ao bipar item');
        }
    } catch (error) {
        handleError('Erro de Rede');
    }
}

// 3.3 Confirmação de Finalização via Rastreio (Novo Flow)
async function confirmFinalization(trackingCode) {
    showStatus('CONFIRMANDO...', 'ready');
    const CONFIRM_URL = `https://wmsrocket.base44.app/api/wms-api`;

    try {
        const response = await fetch(CONFIRM_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'finalizar-pacote', // Aciona a lógica correta no backend
                pedido_id: currentOrderId,
                tracking_code: trackingCode  // Padronizado com o Entities do Base44
            })
        });

        if (response.ok) {
            startTransitionCountdown();
        } else {
            handleError('Código de Rastreio Inválido.');
        }
    } catch (e) {
        handleError('Erro ao finalizar pacote');
    }
}

// 4. Transição Suave (Contagem Regressiva 3, 2, 1...)
function startTransitionCountdown() {
    let seconds = TRANSITION_DELAY / 1000;
    isWaitingForTracking = false;
    
    const interval = setInterval(() => {
        showStatus(`CONCLUÍDO! PRÓXIMO EM ${seconds}s...`, 'success');
        seconds--;
        
        if (seconds < 0) {
            clearInterval(interval);
            resetBipador();
        }
    }, 1000);
}

function resetBipador() {
    currentOrderId = null;
    scanCount = 0;
    counterEl.innerText = '0';
    lastItemEl.innerText = 'Aguardando próximo pedido...';
    showStatus('PRONTO PARA BIPAR', 'ready');
}

// 4. Feedbacks Visuais (UX Premium)
function handleSuccess(barcode) {
    scanCount++;
    counterEl.innerText = scanCount;
    lastItemEl.innerText = barcode;
    showStatus('ITEM BIPADO COM SUCESSO', 'success');
}

function handleError(msg, technicalError = null) {
    showStatus(msg, 'error');
    console.error('Bipador Error:', msg, technicalError);
    
    // Alerta remoto para o desenvolvedor ver na Base44
    sendRemoteLog(msg, technicalError);

    // Vibrar se for um dispositivo mobile nativo
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }
}

// 5. Sistema de Logging Remoto (Para Debug de campo)
async function sendRemoteLog(message, error) {
    const LOG_ENDPOINT = 'https://wmsrocket.base44.app/api/wms-api/logs';
    
    try {
        await fetch(LOG_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: DEVICE_ID,
                orderId: currentOrderId,
                message: message,
                details: error ? error.toString() : 'N/A',
                url: window.location.href,
                timestamp: new Date().toISOString()
            })
        });
    } catch (e) {
        // Se falhar o log, apenas ignoramos para não entrar em loop de erro
        console.warn('Falha ao enviar log remoto');
    }
}
// 6. Atualizar a Interface (Status Visual)
function showStatus(text, type) {
    statusText.innerText = text;
    statusIndicator.className = ''; // Limpa classes
    statusIndicator.classList.add(`status-${type}`);
    
    // Volta para o estado inicial após 3 segundos
    if (type !== 'ready') {
        setTimeout(() => {
            showStatus('PRONTO PARA BIPAR', 'ready');
        }, 3000);
    }
}

function applyFlashEffect() {
    visualFeedback.classList.add('anim-flash');
    setTimeout(() => visualFeedback.classList.remove('anim-flash'), 300);
}

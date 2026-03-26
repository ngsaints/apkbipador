const { app, BrowserWindow, ipcMain, Tray, Menu, session } = require('electron');
const path = require('path');
require('dotenv').config();
const axios = require('axios');
const printer = require('@thesusheer/electron-printer');

let mainWindow;
let tray;
let printQueue = [];
let isProcessingQueue = false;

// Configurable Constants via Environment Variables
const API_URL = process.env.API_URL || 'https://wmsrocket.base44.app/api/orders/finalized';
const POLLING_INTERVAL = parseInt(process.env.POLLING_INTERVAL) || 30000; 
const PRINTER_NAME = process.env.PRINTER_NAME || 'Zebra ZD220'; 
const APP_URL = process.env.APP_URL || 'https://wmsrocket.base44.app';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'WMS Rocket',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true, // Remove a barra de menu branca de cima
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Main UI: The WMS App
  mainWindow.loadURL(APP_URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links and system tray
  createTray();

  // Handle permissions for things like USB/Camera etc.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true); // Grant all permissions
  });
  
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return true; // Always allow hardware access checks
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.png')); // Use a small icon
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { label: 'Restart Agent', click: () => startAgent() },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() }
  ]);
  tray.setToolTip('WMS Rocket Agent');
  tray.setContextMenu(contextMenu);
}

// --- Agent Logic ---

async function startAgent() {
  console.log('Background Agent Started. Monitoring:', API_URL);
  setInterval(async () => {
    try {
      const response = await axios.get(API_URL);
      
      // Tenta normalizar a resposta para sempre ter um array
      let orders = [];
      if (Array.isArray(response.data)) {
        orders = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        orders = response.data.data;
      } else if (response.data && Array.isArray(response.data.results)) {
        orders = response.data.results;
      }

      if (orders.length > 0) {
        console.log(`Found ${orders.length} orders to print.`);
        orders.forEach(order => {
          addToQueue(order);
        });
      }
    } catch (err) {
      console.error('Error fetching orders from API:', err.message);
      if (err.response) {
        console.error('Server status:', err.response.status, '- Body:', JSON.stringify(err.response.data));
      }
    }
  }, POLLING_INTERVAL);
}

function addToQueue(order) {
  // Prevent duplicate prints if needed
  if (!printQueue.find(q => q.id === order.id)) {
    printQueue.push(order);
    processQueue();
  }
}

async function processQueue() {
  if (isProcessingQueue || printQueue.length === 0) return;
  isProcessingQueue = true;

  const order = printQueue[0];
  console.log(`Processing Order ${order.id} for printing...`);

  try {
    // 1. Envia para a Impressora Zebra
    await printOrder(order);
    
    // 2. Notifica o Base44 que a impressão foi realizada (NOVO FLOW)
    await notifyServer(order.id);

    // Success: remove from queue
    printQueue.shift();
    console.log(`Order ${order.id} printed and confirmed.`);
  } catch (err) {
    console.error(`Print Error for Order ${order.id}:`, err);
    // Simple retry logic: just keep it in queue and stop processing for a bit
    setTimeout(() => {
      isProcessingQueue = false;
      processQueue();
    }, 5000); // Wait 5 seconds before retrying
    return;
  }

  isProcessingQueue = false;
  processQueue(); // Process next in line
}

async function notifyServer(orderId) {
  const CONFIRM_URL = `${process.env.APP_URL}/api/wms-api`; // Aponta para a função principal
  try {
    await axios.post(CONFIRM_URL, { 
      action: 'impressao-confirmada', // Identificador da ação no backend
      pedido_id: orderId,
      status: 'impresso',
      timestamp: new Date().toISOString()
    });
    console.log(`Server notified for order ${orderId}`);
  } catch (err) {
    console.error('Failed to notify server after printing:', err.message);
  }
}

async function printOrder(order) {
  const zpl = order.zpl || `^XA
^CF0,60
^FO50,50^FDPedido: ${order.orderNumber}^FS
^FO50,150^FDCliente: ${order.customerName}^FS
^XZ`;

  return new Promise((resolve, reject) => {
    console.log(`Sending ZPL to printer: ${PRINTER_NAME}`);
    printer.printDirect({
      data: zpl,
      printer: PRINTER_NAME,
      type: 'RAW',
      success: (jobId) => {
        console.log(`Print job sent: ${jobId}`);
        resolve(jobId);
      },
      error: (err) => {
        console.error('Printing failed:', err);
        reject(err);
      }
    });
  });
}

// --- App Lifecycle ---

app.whenReady().then(() => {
  createWindow();
  startAgent();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

# WMS Rocket - Electron Agent

Este é um agente local Electron que fornece um Webview para o WMS Rocket e um agente de monitoramento de API para impressão térmica automática via QZ Tray.

## Funcionalidades

- **WebView:** Carrega o aplicativo oficial `https://wmsrocket.base44.app`.
- **Agente Local (Node.js):** Monitora eventos de "pedido finalizado" e envia etiquetas para a impressora.
- **Integração QZ Tray:** Impressão silenciosa e robusta para Zebra ZD220 (ZPL).
- **Fila de Impressão:** Gerencia vários pedidos simultâneos com lógica de re-tentativa em caso de erro.

## Instalação e Uso

1. **Instalar Dependências:**
   ```bash
   npm install
   ```

2. **Requisitos Adicionais:**
   - Possuir o **Python** e o **Visual Studio Build Tools** instalados (necessário para compilar o módulo de impressão nativo no Windows).
   - Configurar o nome da impressora no `main.js` (atual: `Zebra ZD220`).

3. **Instalação Especial (Electron):**
   Como usamos um módulo de impressão nativo, você deve rodar os seguintes comandos:
   ```bash
   npm install
   npx electron-rebuild
   ```

4. **Iniciar em Desenvolvimento:**
   ```bash
   npm start
   ```

4. **Gerar Executável (Windows):**
   ```bash
   npm run dist
   ```

## Configuração da API

O código em `main.js` espera que o endpoint `API_URL` retorne um array de pedidos prontos para impressão.
O formato esperado é:

```json
[
  {
    "id": "unique-id",
    "orderNumber": "001",
    "customerName": "Exemplo",
    "zpl": "^XA...^XZ"
  }
]
```

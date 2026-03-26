# Resumo do Projeto: WMS Rocket Agent

Este documento resume o estado atual e as funcionalidades do aplicativo **WMS Rocket Agent** que estamos desenvolvendo.

## 🚀 O que é o projeto?
O **WMS Rocket Agent** é uma aplicação desktop nativa desenvolvida em **Electron**. Ela serve como uma ponte de integração entre o sistema web (WMS Rocket) e o hardware local do usuário (especificamente impressoras térmicas Zebra).

---

## 🛠️ O que o App faz atualmente?

### 1. Interface Unificada (WebView)
- O aplicativo carrega diretamente a URL oficial: `https://wmsrocket.base44.app`.
- Oferece uma experiência de "App Nativo", removendo barras de navegação de navegadores comuns e focando na produtividade.

### 2. Agente de Impressão em Segundo Plano
- Existe um processo rodando continuamente que monitora a API (`/api/orders/finalized`).
- Ele busca automaticamente novos pedidos que precisam de etiqueta assim que são finalizados no sistema.

### 3. Impressão Térmica Silenciosa (Direct Print)
- Integrado com o módulo `@thesusheer/electron-printer`.
- Envia comandos **ZPL (Zebra Programming Language)** diretamente para a impressora **Zebra ZD220**.
- A impressão é "silenciosa" (não abre janelas de diálogo do Windows), garantindo agilidade no checkout.

### 4. Fila e Resiliência
- O app possui uma **Fila de Impressão** inteligente. Se houver erro (impressora desligada ou sem papel), ele tenta imprimir novamente após alguns segundos.
- Evita impressões duplicadas controlando os IDs dos pedidos já processados.

### 5. Integração com Sistema (Tray)
- O app pode ser minimizado para a **bandeja do sistema (ao lado do relógio)**, continuando a monitorar a API mesmo se a janela principal for fechada.

---

## 🏗️ Tecnologias Utilizadas
- **Electron:** Framework principal para o desktop.
- **Node.js:** Para a lógica do agente de segundo plano.
- **Axios:** Para comunicação com a API do WMS.
- **@thesusheer/electron-printer:** Para comunicação direta via porta RAW com a impressora.
- **Dotenv:** Para configurações flexíveis (URL da API, Nome da Impressora, Intervalos).

---

## 📋 Próximos Passos (O que estou fazendo agora)
1. **Estabilização do Agente:** Garantindo que a conexão com a API seja resiliente a quedas de internet.
2. **Configurações Dinâmicas:** Permitir que o usuário mude o nome da impressora ou o intervalo de busca via interface ou arquivo `.env`.
3. **Build e Distribuição:** Configurando o `electron-builder` para gerar um instalador `.exe` profissional para Windows.

---

> [!TIP]
> **Status Atual:** O esqueleto do app e a lógica de impressão em ZPL já estão funcionais. O agente está pronto para começar a receber dados reais da API.

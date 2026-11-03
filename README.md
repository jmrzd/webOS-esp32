# 💻 WebOS ESP32

### Um sistema operacional web embarcado, executado diretamente no ESP32.

O **WebOS ESP32** é um projeto acadêmico que busca transformar o ESP32 em um pequeno computador, oferecendo uma interface gráfica semelhante à de um sistema operacional desktop, acessível diretamente pelo navegador.

Desenvolvido com **React, JavaScript, C++ e FreeRTOS**, o projeto integra tecnologias web e sistemas embarcados para demonstrar, de forma interativa, conceitos fundamentais de Sistemas Operacionais.

---

## 🎯 Objetivo do projeto

Desenvolver um ambiente operacional web capaz de apresentar e permitir a experimentação prática de recursos de um sistema operacional, utilizando o ESP32 como hardware principal.

A interface permitirá interagir com diferentes aplicativos que representam funcionalidades como gerenciamento de tarefas, escalonamento, concorrência, memória, arquivos e dispositivos.

## ⚙️ Tecnologias utilizadas

| Tecnologia | Finalidade |
|---|---|
| React | Construção da interface |
| JavaScript | Lógica e interatividade |
| Vite | Ambiente de desenvolvimento e build |
| HTML5 | Estrutura da aplicação |
| CSS3 | Estilização e responsividade |
| C++ | Desenvolvimento do firmware |
| ESP32 | Hardware principal |
| FreeRTOS | Gerenciamento de tarefas |
| HTTP / JSON | Comunicação entre frontend e firmware |
| LittleFS | Sistema de arquivos embarcado |

## 🖥️ Interface do WebOS

A proposta é desenvolver uma interface inspirada em sistemas operacionais desktop, contendo:

- Área de trabalho interativa.
- Ícones para acesso aos aplicativos.
- Janelas independentes.
- Barra de tarefas.
- Menu iniciar.
- Relógio e informações do sistema.
- Interface responsiva para computadores e dispositivos móveis.

## 📦 Aplicativos principais

O sistema contará com seis aplicativos obrigatórios:

### 1. Gerenciador de Tarefas
- Listagem de tarefas do FreeRTOS.
- Nome, estado, prioridade e núcleo.
- Monitoramento de pilha disponível.
- Criação, suspensão e retomada de tarefas.
- Finalização e alteração de prioridade.

### 2. Escalonador em Tempo Real
- Execução de tarefas de cálculo.
- Monitoramento da utilização da CPU.
- Comparação de prioridades.
- Demonstração do fenômeno de starvation.

### 3. Laboratório de Concorrência
- Execução de tarefas concorrentes.
- Demonstração de condições de corrida.
- Comparação entre acesso compartilhado com e sem mutex.
- Visualização dos resultados.

### 4. Monitor de Memória
- Monitoramento da heap livre.
- Visualização do menor espaço livre.
- Monitoramento do maior bloco contíguo.
- Testes de alocação, liberação e fragmentação.

### 5. Explorador de Arquivos
- Listagem de arquivos.
- Criação, edição e exclusão.
- Integração com LittleFS.
- Monitoramento do espaço utilizado e disponível.

### 6. Gerenciador de Dispositivos
- Controle do LED pela interface web.
- Monitoramento do botão BOOT.
- Captura de eventos por interrupção.
- Contador de eventos registrados.

## 🌐 Arquitetura e comunicação

O projeto utiliza uma arquitetura dividida em duas partes:

**Frontend — React**

Responsável pela interface gráfica, aplicativos, janelas, interações e visualização dos dados.

**Firmware — C++ / FreeRTOS**

Responsável pelo gerenciamento dos recursos físicos e computacionais do ESP32, execução das tarefas e disponibilização das informações por meio de uma API HTTP.

A comunicação entre as duas partes será realizada por requisições HTTP e respostas em JSON.

O React será compilado em arquivos estáticos, que serão disponibilizados pelo próprio ESP32.

### Fluxo de funcionamento

```text
┌─────────────────────────────┐
│        NAVEGADOR             │
│                             │
│      React + JavaScript     │
│                             │
│   Desktop e Aplicativos     │
└──────────────┬──────────────┘
               │
               │ HTTP / JSON
               │
┌──────────────▼──────────────┐
│           ESP32             │
│                             │
│       API HTTP / C++        │
│                             │
│          FreeRTOS           │
│                             │
│  Tarefas | Memória | GPIO   │
│                             │
│          LittleFS           │
└─────────────────────────────┘
```

## 📡 Como acessar

O ESP32 funcionará como um ponto de acesso Wi-Fi (Access Point).

1. Ligue o ESP32.
2. Conecte seu computador ou celular à rede criada pela placa.
3. Abra o navegador.
4. Acesse o endereço:

```text
http://192.168.4.1
```

A interface será carregada diretamente pelo ESP32, sem necessidade de instalar programas adicionais no dispositivo de acesso.

## 🏗️ Estrutura do projeto

```text
WebOS-ESP32/
│
├── firmware/
│   ├── src/
│   ├── include/
│   └── platform/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── desktop/
│   │   ├── apps/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── docs/
│   ├── arquitetura.md
│   └── conceitos.md
│
├── tests/
│
└── README.md
```

## 🛠️ Ambiente de desenvolvimento

Para desenvolver o projeto, serão utilizadas as seguintes ferramentas:

- **Node.js e npm:** gerenciamento das dependências do frontend.
- **React e Vite:** desenvolvimento e compilação da interface.
- **Arduino IDE 2.x:** desenvolvimento do firmware.
- **ESP32 by Espressif Systems:** suporte à placa.
- **Navegador web:** acesso e testes da interface.

## 🚀 Etapas de desenvolvimento

1. Preparação do ambiente e configuração do ESP32.
2. Desenvolvimento da interface desktop em React.
3. Construção da API HTTP no firmware.
4. Integração entre frontend e ESP32.
5. Implementação dos seis aplicativos obrigatórios.
6. Testes e validação diretamente no hardware.
7. Documentação e apresentação do sistema.

## 📚 Fundamentação acadêmica

Projeto desenvolvido no contexto da disciplina **Introdução a Sistemas Operacionais**, do curso de Ciência da Computação da **Afya Unigranrio**.

**Professor:** Joelmir Ramos.

O projeto aborda conceitos fundamentais:

- Processos e threads.
- Escalonamento de CPU.
- Concorrência e sincronização.
- Gerenciamento de memória.
- Sistemas de arquivos.
- Gerenciamento de dispositivos.

## 👨‍💻 Projeto acadêmico

**WebOS ESP32**

Transformando conceitos de Sistemas Operacionais em uma experiência prática, visual e interativa.

**Afya Unigranrio — Ciência da Computação.**

# WebOS ESP32

Um sistema operacional web que roda **no ESP32** e é usado pelo navegador do computador ou do celular.
A placa cria a própria rede Wi-Fi, serve uma área de trabalho com janelas e cada app mostra um conceito
de Sistemas Operacionais acontecendo **de verdade** no FreeRTOS da placa — tarefas, escalonamento,
condição de corrida, heap, sistema de arquivos, interrupções e deadlock.

> Desafio WebOS ESP32 · Introdução a Sistemas Operacionais · Prof. Joelmir Ramos (Joel)

---

## Sumário

1. [Início rápido (Windows)](#1-início-rápido-windows)
2. [Arquitetura](#2-arquitetura)
3. [Tecnologias](#3-tecnologias)
4. [Requisitos](#4-requisitos)
5. [Instalação, compilação e gravação](#5-instalação-compilação-e-gravação)
6. [Conexão e acesso](#6-conexão-e-acesso)
7. [Aplicativos](#7-aplicativos)
8. [API](#8-api)
9. [Estrutura do projeto](#9-estrutura-do-projeto)
10. [Desenvolvimento da interface](#10-desenvolvimento-da-interface)
11. [Limitações do hardware e do projeto](#11-limitações-do-hardware-e-do-projeto)
12. [O que foi e o que não foi testado](#12-o-que-foi-e-o-que-não-foi-testado)
13. [Como apresentar](#13-como-apresentar)

---

## 1. Início rápido (Windows)

1. Conecte o ESP32 ao computador com um cabo USB **de dados**.
2. Dê dois cliques em **`scripts\install.bat`** (ou, no Prompt de Comando, na pasta do projeto: `scripts\install.bat`).
   - Na primeira vez ele baixa o `arduino-cli` e o core ESP32 (centenas de MB — precisa de internet uma única vez).
   - Compila o firmware, gera a imagem do sistema de arquivos com a interface e grava os dois na placa.
   - Detecta a porta COM sozinho; se houver mais de uma, pergunta qual usar. Também aceita `scripts\install.bat COM5`.
3. Conecte o celular ou o PC ao Wi-Fi **`WebOS-ESP32-xxxx`** (senha **`webos1234`**).
4. Abra **http://192.168.4.1** — com `http`, não `https`.

Depois da gravação a placa funciona sozinha: pode desconectar do computador e alimentar por qualquer fonte USB.

**Caminho mais rápido (sem compilar nada):** `scripts\flash-prebuilt.bat` grava os binários já compilados de
`firmware\prebuilt` (core esp32 3.3.10, ESP32 Dev Module, partições padrão de 4 MB). Ele só precisa do
esptool — usa o do core, se existir, ou baixa o oficial do GitHub (~80 MB). Use o `install.bat` quando
quiser recompilar depois de mudar o código.

> **A porta COM não aparece?** Instale o driver do conversor USB-serial da sua placa (CP210x ou CH340/CH9102 —
> veja o chip ao lado do conector USB) e troque o cabo, se necessário. Detalhes em
> [docs/SOLUCAO-DE-PROBLEMAS.md](docs/SOLUCAO-DE-PROBLEMAS.md).

---

## 2. Arquitetura

```
 Navegador (PC ou celular)                         ESP32 (2 núcleos · FreeRTOS)
┌──────────────────────────────┐   Wi-Fi AP    ┌─────────────────────────────────────────────┐
│ React + TypeScript (WebOS)   │  192.168.4.1  │ loopTask (núcleo 1): WebServer HTTP :80      │
│  boot → detecção → desktop   │ ────────────▶ │  ├─ /            → LittleFS /www/*.gz        │
│  janelas, barra, menu, apps  │   HTTP/JSON   │  └─ /api/...     → módulos (C++)             │
│  cliente HTTP centralizado   │ ◀──────────── │ webos-monitor (núcleo 1): amostra 1 s        │
└──────────────────────────────┘               │ driver-botao: ISR → fila → debounce          │
                                               │ tarefas do usuário / escalonador (núcleo 0)  │
                                               │ laboratórios: corrida (0+1), deadlock (A+B)  │
                                               │ LittleFS (flash) · NVS · GPIO · heap         │
                                               └─────────────────────────────────────────────┘
```

Camadas (app **Sobre**): Apps no navegador → API HTTP (o equivalente às chamadas de sistema) → serviços
(Wi-Fi, LittleFS, driver do botão, monitor, login) → núcleo FreeRTOS → hardware ESP32.

Princípios:

- **O ESP32 executa as operações reais; o React é só a interface.** Nenhuma tarefa, mutex, alocação, arquivo
  ou GPIO é imitado no navegador. Os dois **simuladores** (escalonamento e paginação) rodam no navegador
  e são identificados como **SIMULAÇÃO** em todas as telas, como pede o enunciado.
- **Sem dependências externas em funcionamento:** a interface fica na flash da placa (gzip), sem CDN, sem
  internet, sem servidor no computador.
- **Nada de dado inventado:** se a placa não responde, os indicadores mostram “—” e aparece a tela de
  reconexão. Se o core do Arduino não oferecer uma informação, ela não é exibida (há fallback explícito).

---

## 3. Tecnologias

| Camada | Tecnologias |
|---|---|
| Firmware | C++ · Arduino IDE 2.x / arduino-cli · core **esp32 by Espressif 3.x** · FreeRTOS · `WebServer` · `LittleFS` · `Preferences` (NVS) · `ESPmDNS` · mbedTLS (SHA-256). **Nenhuma biblioteca externa** (JSON montado por uma classe própria). |
| Interface | React 19 · TypeScript · Vite · Tailwind CSS 4 · Framer Motion · Lucide React. Gráficos em SVG próprio no lugar do Recharts (economiza ~100 KB de flash). |
| Ferramentas | arduino-cli · esptool (vem com o core) · mklittlefs (vem com o core) · Node.js (opcional, só para recompilar a interface) |

---

## 4. Requisitos

- **Placa:** ESP32 DevKit (ESP32-WROOM/D0WD, 2 núcleos, 4 MB de flash). O FQBN usado é `esp32:esp32:esp32` (ESP32 Dev Module) com o esquema de partições **Default 4MB with spiffs**.
- **Windows 10/11** com PowerShell (já vem no sistema).
- **Driver** do conversor USB-serial: CP210x (Silicon Labs) ou CH340/CH9102 (WCH).
- **Internet** apenas na primeira execução do `setup.bat`.
- **Node.js LTS** — *opcional*. O pacote já traz a interface compilada em `firmware/WebOS_ESP32/data/www`.
  Só é necessário para alterar a interface.

---

## 5. Instalação, compilação e gravação

### Pelos scripts (recomendado)

| Script | O que faz |
|---|---|
| `scripts\install.bat [COMx]` | Tudo em sequência: `setup` → `build` → `flash`. |
| `scripts\setup.bat` | Baixa o `arduino-cli` oficial para `tools\arduino-cli` (se não houver um no PATH), registra o índice da Espressif e instala o core `esp32:esp32@3.3.10` (mantém um 3.x já instalado). |
| `scripts\build.bat` | (1) recompila a interface se o Node.js existir — senão usa a já compilada; (2) compila o firmware em `firmware\build`; (3) lê o `partitions.csv` gerado pela compilação e cria `firmware\build\littlefs.bin` com o **mklittlefs** do próprio core. |
| `scripts\flash.bat [COMx]` | Detecta a porta, grava o firmware com `arduino-cli upload` e a imagem LittleFS com o **esptool** do core no endereço da partição de dados. Se 921600 baud falhar, tenta 115200. |
| `scripts\flash-prebuilt.bat [COMx]` | Grava os binários prontos de `firmware\prebuilt` (bootloader 0x1000, partições 0x8000, boot_app0 0xE000, app 0x10000, LittleFS 0x290000) com um único comando do esptool. Não compila nada. |
| `scripts\monitor.bat COMx` | Monitor serial a 115200 baud (mensagens de boot e erros). |

Variáveis opcionais (defina antes, no Prompt de Comando):

```bat
set ESP32_CORE_VERSION=3.3.10   & rem versão do core a instalar
set UPLOAD_BAUD=115200          & rem gravação mais lenta e tolerante
set SKIP_FRONTEND=1             & rem não recompila a interface mesmo com Node.js
```

**Sobre os seus arquivos:** a gravação **não** apaga a flash inteira. Ela grava o firmware nas partições de
aplicativo e a imagem LittleFS na partição de dados — e **esta última substitui** os arquivos criados pelo
Explorador de Arquivos pelo conteúdo de `firmware/WebOS_ESP32/data`. Copie antes o que quiser guardar.
Para atualizar só o firmware, use `arduino-cli upload` (ou a Arduino IDE) sem regravar o LittleFS.

### Pela Arduino IDE 2.x (alternativa manual)

1. Instale o core: *Arquivo › Preferências › URLs adicionais* →
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`; depois *Gerenciador de Placas* →
   **esp32 by Espressif Systems 3.x**.
2. Abra `firmware/WebOS_ESP32/WebOS_ESP32.ino`. *Ferramentas*: Placa **ESP32 Dev Module**,
   Partition Scheme **Default 4MB with spiffs**, a porta COM correta. Clique em **Carregar**.
3. Para gravar a interface (pasta `data/` do sketch) pela IDE, instale o plugin
   [arduino-littlefs-upload](https://github.com/earlephilhower/arduino-littlefs-upload) e use
   `Ctrl+Shift+P › Upload LittleFS to Pico/ESP8266/ESP32` com o Monitor Serial fechado.
   Ou rode apenas `scripts\build.bat` e `scripts\flash.bat`.

Sem a interface gravada, a placa mostra uma página de aviso em `http://192.168.4.1` e a API continua respondendo.

---

## 6. Conexão e acesso

1. Rede: **`WebOS-ESP32-XXXX`** (os 4 últimos dígitos do MAC) · senha **`webos1234`** · até 4 aparelhos.
   Para mudar, edite `firmware/WebOS_ESP32/config.h`.
2. Endereço: **http://192.168.4.1** (também `http://webos.local` em aparelhos com mDNS).
3. O navegador **não pode** trocar de rede Wi-Fi sozinho — a conexão à rede da placa é feita nas
   configurações do celular/PC. Depois disso a detecção é automática:
   **Boot** (integridade da interface) → **Detecção do hardware** (`/api/system/health` e `/api/system/info`;
   só mostra “Conexão confirmada” com resposta válida) → **Ambiente** (valida métricas, tarefas, arquivos e
   dispositivos) → **Área de trabalho**.
4. No celular: desligue os dados móveis e aceite “rede sem internet”.
5. Login: desativado por padrão. Ative em **Sobre o WebOS** (usuário `admin`, senha `webos`).

---

## 7. Aplicativos

Todos têm a caixa **“Entenda o conceito”** (o que é, como funciona, por que importa, aula, Tanenbaum,
como experimentar, o que observar, como interpretar) e uma **interpretação ao vivo** dos resultados.

| App | Tipo | O que acontece na placa | Aula |
|---|---|---|---|
| Gerenciador de Tarefas | obrigatório | Lista todas as tarefas do FreeRTOS (`uxTaskGetSystemState`): PID, nome, estado, prioridade, núcleo, pilha livre, % de CPU. Cria tarefas `cpu` (núcleo 0) e `contador` (dorme 100 ms), suspende, retoma, finaliza e muda prioridade. Diagrama de estados com contagem ao vivo. | 7 |
| Escalonador ao vivo | obrigatório | 3 tarefas CPU-bound reais no núcleo 0; % de CPU **do último segundo** (delta do contador de tempo de execução). Cenários: Round-Robin (1,1,1), inanição (1,2,3) e (2,2,1). Suspender, ±prioridade e **aging** opcional. Para sozinho após 180 s. | 7 |
| Laboratório de Concorrência | obrigatório | Duas tarefas, uma em cada núcleo, fazem N × (lê, soma, escreve) num contador compartilhado. Sem mutex: incrementos perdidos de verdade. Com mutex: resultado exato. Histórico e comparação de tempo. | 8 |
| Monitor de Memória | obrigatório | `heap_caps_malloc/free` reais (RAM interna): total, livre, menor livre, maior bloco, pedaços livres, fragmentação. Alocar 4–32 KB, liberar um/alternados/todos, **provocar fragmentação**, mapa de endereços reais. Reserva de 40 KB protege o sistema. | 9 |
| Explorador de Arquivos | obrigatório | LittleFS na flash: listar, criar arquivo/pasta, abrir, editar, salvar, apagar, espaço usado/total. **Persiste** após reiniciar. Mostra a **tabela de partições** real da flash. `/www` (a interface) é protegida. | 10 e 4 |
| Gerenciador de Dispositivos | obrigatório | LED no GPIO configurável (salvo na NVS, nível ativo configurável). Botão BOOT (GPIO 0) por **interrupção**: ISR curta → fila → tarefa `driver-botao` com debounce. Interrupções, apertos válidos, repiques filtrados, fila, histórico. | 10 |
| Monitor do Sistema | bônus | Heap ao longo de 60 s (histórico da placa), tarefas, aparelhos conectados, carga de cada núcleo (100% − IDLE), uptime, LittleFS, latência. | 2 |
| Deadlock | bônus | A: M1→M2, B: M2→M1 em núcleos diferentes → espera circular real. Grafo de alocação, detecção por ciclo, recuperação manual ou por watchdog (8 s, vítima B), **prevenção** por ordem global. Condições de Coffman ao vivo. A API nunca trava. | 8 |
| Simulador de Escalonamento | bônus · SIMULAÇÃO | FCFS, SJF e Round-Robin (quantum ajustável), Gantt, espera, retorno, resposta, médias e comparação. | 7 |
| Simulador de Paginação | bônus · SIMULAÇÃO | FIFO, LRU e Ótimo, quadros × tempo, faltas/acertos, comparação e detecção da anomalia de Belady. | 9 |
| Terminal | bônus | `help ps kill mem free ls cat df uptime uname led clear` interpretados **pelo firmware**; histórico (↑/↓) e Tab. | 3 |
| Sobre / Login | bônus | Hardware real, arquitetura em camadas, apps × conceitos, tecnologias, dados do grupo (editáveis, salvos em `/grupo.json`) e login com senha em SHA-256 + sal na NVS. | 3 |

Referências ao Tanenbaum citadas no documento do professor aparecem normalmente; as que **não** estão no
documento aparecem com a etiqueta **“conferir edição”** (veja [docs/REQUISITOS.md](docs/REQUISITOS.md)).

---

## 8. API

Documentação completa: **[docs/API.md](docs/API.md)**. Resumo:

- Respostas sempre em JSON: `{"ok":true,"data":{…}}` ou `{"ok":false,"error":{"code":"…","message":"…"}}`
  com o status HTTP correspondente (400, 403, 404, 409, 413, 429, 503, 507).
- `POST` recebe `application/x-www-form-urlencoded` (o que `URLSearchParams` envia).
- Limite de 60 requisições de API por segundo, parâmetros validados, tamanho máximo de arquivo 16 KB.

```text
GET  /api/system/info | health | metrics | partitions      POST /api/system/restart
GET  /api/tasks        POST /api/tasks  /api/tasks/{suspend,resume,delete,priority}
GET  /api/scheduler    POST /api/scheduler/{start,stop,task,aging}
GET  /api/concurrency  POST /api/concurrency/{start,stop,reset}
GET  /api/memory       POST /api/memory/{allocate,free,fragment}
GET  /api/files  /api/files/read      POST /api/files/{create,write,delete}
GET  /api/devices  /api/devices/button POST /api/devices/{led,config,button/reset}
GET  /api/deadlock     POST /api/deadlock/{start,recover,stop}
POST /api/terminal/execute
GET  /api/auth/status  POST /api/auth/{login,logout,verify,config}
```

Ajustes em relação à lista sugerida no enunciado: o modo do laboratório de concorrência vai como parâmetro
`mutex=0|1` em `/api/concurrency/start` (em vez de uma rota `/mutex` separada), e foram acrescentadas rotas
para partições, fragmentação, deadlock, configuração do LED e login.

---

## 9. Estrutura do projeto

```text
webos-esp32/
├── firmware/
│   ├── prebuilt/                 binários prontos (core 3.3.10) + littlefs.bin
│   ├── WebOS_ESP32/              ← sketch Arduino (abra o .ino na IDE)
│   │   ├── WebOS_ESP32.ino       setup/loop, Wi-Fi AP, mDNS
│   │   ├── config.h              rede, pinos, limites
│   │   ├── webos.h               declarações compartilhadas + JsonWriter
│   │   ├── web_server.cpp        HTTP, JSON, limite de taxa, arquivos estáticos .gz
│   │   ├── system.cpp            info, métricas, partições, monitor (CPU por intervalo)
│   │   ├── tasks.cpp             Gerenciador de Tarefas
│   │   ├── scheduler.cpp         Escalonador ao vivo
│   │   ├── concurrency.cpp       Laboratório de Concorrência
│   │   ├── memory.cpp            Monitor de Memória
│   │   ├── files.cpp             Explorador de Arquivos (LittleFS)
│   │   ├── devices.cpp           LED + botão BOOT (ISR/fila/driver)
│   │   ├── deadlock.cpp          Deadlock (detecção, prevenção, recuperação)
│   │   ├── terminal.cpp          interpretador de comandos
│   │   ├── auth.cpp              login (SHA-256 + sal, NVS)
│   │   └── data/                 ← conteúdo do LittleFS
│   │       ├── www/              interface compilada (gzip) — gerada pelo build
│   │       ├── leia-me.txt
│   │       └── grupo.json
│   └── build/                    (gerado) binários e littlefs.bin
├── frontend/                     React + TypeScript + Vite
│   ├── src/{apps,boot,components,content,contexts,desktop,hooks,lib,services,styles,types,windows}
│   ├── scripts/pack-littlefs.mjs dist/ → data/www/*.gz (confere nomes e tamanho)
│   └── mock/mock-server.mjs      servidor de TESTES (dados falsos) para desenvolver sem a placa
├── scripts/                      install · setup · build · flash · monitor (.bat) + auxiliares .ps1
├── tools/fw-syntax-check/        checagem de sintaxe do firmware no PC (stubs)
└── docs/                         API, requisitos, checklists, diário, solução de problemas
```

A pasta `data/` fica **dentro do sketch** (e não na raiz) porque é onde o plugin de upload LittleFS da
Arduino IDE a procura — assim os scripts e a IDE usam a mesma pasta.

---

## 10. Desenvolvimento da interface

```bat
cd frontend
npm ci
npm run mock            & rem servidor de TESTES em http://localhost:8787 (dados falsos, chip "MOCK")
npm run dev             & rem Vite em http://localhost:5173 com /api → mock
set ESP_TARGET=http://192.168.4.1 && npm run dev   & rem desenvolvendo contra a placa real
npm run typecheck && npm run lint
npm run build           & rem gera firmware/WebOS_ESP32/data/www (gzip)
```

O servidor `mock` existe apenas para testar a interface sem hardware: os números são falsos e o modelo do
chip aparece como **“MOCK (servidor de testes)”**. Ele não é gravado na placa.

---

## 11. Limitações do hardware e do projeto

- **Servidor síncrono:** o `WebServer` do core atende uma conexão por vez. Por isso o cliente limita a 2
  requisições simultâneas, encadeia o polling (nunca empilha) e pausa apps minimizados e abas ocultas.
- **CPU por tarefa:** depende de `configGENERATE_RUN_TIME_STATS` no FreeRTOS do core. Se o core não tiver,
  o escalonador usa a proporção de voltas (avisado na tela) e a coluna CPU mostra “—”.
- **Listagem de tarefas:** depende de `configUSE_TRACE_FACILITY`. Sem ela, só as tarefas criadas pelo WebOS
  são listadas, com aviso — nada é inventado para as do sistema.
- **Tarefas `cpu` e escalonador:** nunca bloqueiam e ocupam o núcleo 0. Enquanto existirem, o IDLE0 é
  retirado do Task Watchdog (e devolvido quando a última termina); o Wi-Fi, de prioridade maior, segue normal.
- **Uma tarefa bloqueada sem prazo (`portMAX_DELAY`) aparece como “suspensa”** na listagem do FreeRTOS — é
  como o núcleo a guarda; explicado no app.
- **Concorrência:** num chip de 1 núcleo a corrida quase não aparece (aviso na tela).
- **Memória:** reserva mínima de 40 KB; no máximo 48 blocos; o ESP32 não pagina programas (paginação é simulada).
- **Login:** educacional — HTTP sem TLS e a API não exige o token (explicado na interface).
- **Wi-Fi:** até 4 aparelhos ao mesmo tempo; sem internet.
- **Gravar o LittleFS** substitui os arquivos do usuário pelos da pasta `data/`.

---

## 12. O que foi e o que não foi testado

Feito neste ambiente de desenvolvimento (sem ESP32 físico):

| Verificação | Resultado |
|---|---|
| `tsc` (TypeScript estrito) | sem erros |
| ESLint (regras de hooks do React) | sem erros |
| Build de produção do Vite + compressão gzip | 25 arquivos, ~197 KB (14% da partição de 1,375 MB) |
| **Firmware compilado com o toolchain real** (arduino-cli 1.3.1 + core esp32 3.3.10, `--warnings all`) | **sem erros e sem avisos** nos arquivos do projeto · programa 1.076.044 bytes (82% de 1,25 MB) · variáveis globais 56.840 bytes (17%) |
| `sdkconfig` do core 3.3.10 | `CONFIG_FREERTOS_USE_TRACE_FACILITY=y`, `GENERATE_RUN_TIME_STATS=y`, `VTASKLIST_INCLUDE_COREID=y` → listagem completa e % de CPU real. `ESP_TASK_WDT_PANIC=y` → por isso o IDLE0 sai do watchdog durante os experimentos |
| Imagem LittleFS gerada com o mklittlefs 4.0.2 do core e conferida (`mklittlefs -l`) | `partitions.csv` da compilação: `spiffs 0x290000 0x160000`, igual ao que os scripts usam |
| Sintaxe dos comandos do esptool 5.3.0 (`write-flash -z …` e `write_flash`) | aceitos |
| Interface contra o servidor de testes: boot, desktop, 12 apps, janelas, menu, notificações | sem erros no console |
| Celular 390 × 844: área de trabalho, janelas em tela cheia, tabelas com rolagem | sem rolagem horizontal da página |
| Queda e volta da conexão | tela de reconexão, indicadores em “—”, reconexão automática |

**Não foi possível** neste ambiente: executar os `.bat` no Windows e testar na placa (não há ESP32 físico aqui). Nenhuma operação física é declarada como
testada. Antes da apresentação, siga **[docs/CHECKLIST-VALIDACAO.md](docs/CHECKLIST-VALIDACAO.md)** na placa real.

---

## 13. Como apresentar

Roteiro sugerido e itens de conferência em **[docs/CHECKLIST-APRESENTACAO.md](docs/CHECKLIST-APRESENTACAO.md)**.
O diário de uso de IA exigido no enunciado está em **[docs/DIARIO-DE-DESENVOLVIMENTO.md](docs/DIARIO-DE-DESENVOLVIMENTO.md)**.

# Diário de desenvolvimento e de uso de IA

Exigência da seção 8 do enunciado: principais prompts, o que a IA errou e o que foi corrigido.
Ferramenta: Claude (Anthropic). **Complete com as sessões do próprio grupo** — o que vocês testarem na placa
e corrigirem é a parte que vale nota.

## 1. Prompt principal

O grupo entregou à IA o PDF do desafio e um prompt longo pedindo o projeto completo. Resumo:

> “Assuma o papel de uma equipe sênior … PROJETAR, IMPLEMENTAR, INTEGRAR, TESTAR E ENTREGAR um sistema
> operacional web completo chamado WebOS ESP32 … frontend React + TypeScript, firmware C++ para ESP32,
> comunicação real entre interface e hardware, ferramentas de instalação, documentação e todos os
> aplicativos exigidos … O ESP32 deve executar as operações reais. O React deve ser a camada de interface …
> Não afirmar que algo foi testado fisicamente sem ter sido.”

## 2. Decisões técnicas tomadas

| Decisão | Motivo |
|---|---|
| `WebServer` síncrono do core, sem bibliotecas externas (nem ArduinoJson nem AsyncWebServer) | Instalação sem dependências extras; o script só precisa do core oficial. JSON montado por uma classe própria (`JsonWriter`). |
| POST em `x-www-form-urlencoded` | O `WebServer` já separa esses parâmetros; evita escrever um parser JSON no firmware. |
| Interface no LittleFS em gzip, nomes curtos com hash | ~197 KB ocupam 14% da partição; nomes curtos respeitam o limite do LittleFS. |
| Cliente com no máximo 2 requisições simultâneas e polling encadeado | O servidor atende uma conexão por vez; rajadas causariam timeouts em cascata. |
| Gráficos em SVG próprio em vez de Recharts | Economia de ~100 KB na flash e no carregamento pelo Wi-Fi da placa. |
| Tarefas CPU-bound no núcleo 0 e servidor no núcleo 1 | Demonstrar inanição sem derrubar a interface. |
| IDLE0 retirado do Task Watchdog só enquanto há tarefas que nunca bloqueiam | Sem isso o watchdog reclamaria/reiniciaria durante os experimentos. |
| CPU% = Δ tempo de execução ÷ 1 s, amostrado por uma tarefa monitora | Atende “não confundir tempo acumulado com utilização instantânea”. |
| Deadlock com espera em fatias de 50 ms no `xSemaphoreTake` | A espera é real (a tarefa fica bloqueada no mutex), mas a vítima pode ser escolhida sem matar tarefas que seguram mutex. |
| `data/` dentro da pasta do sketch | É onde o plugin de upload LittleFS da Arduino IDE procura; scripts e IDE usam a mesma pasta. |
| Servidor *mock* só para desenvolvimento, com chip “MOCK” | Testar a interface sem placa sem risco de confundir com dados reais. |

## 3. Erros encontrados e correções

| # | Onde | Problema | Correção |
|---|---|---|---|
| 1 | Ambiente da IA | O download do toolchain foi bloqueado no início; depois, com autorização do grupo, o GitHub foi liberado, mas `downloads.arduino.cc` e `espressif.github.io` continuaram bloqueados. | Primeiro, checagem com g++ e *stubs*. Depois, core 3.3.10, toolchain Xtensa, esptool e mklittlefs instalados manualmente a partir das releases do GitHub, e o firmware compilado de verdade. |
| 1b | Firmware (`web_server.cpp`) | **Erro na compilação real**: `WiFiClient` não declarado — no core 3.x a classe virou `NetworkClient` e não vem com o `WebServer.h`. Os *stubs* não pegaram. | `auto client = server.client();` |
| 1c | Firmware (vários) | Avisos do C++20: `++`/`--` e atribuição encadeada em variáveis `volatile`. | Escritas explícitas (`x = x + 1`). Compilação final sem avisos. |
| 2 | Firmware (`web_server.cpp`) | `isnan`/`isinf` sem prefixo falharam na checagem. | Trocado por `std::isnan`/`std::isinf` com `<cmath>`. |
| 3 | Firmware (vários) | Parâmetros opcionais inválidos geravam **duas respostas HTTP** (a função de validação já respondia o erro e o handler continuava). | `if (server.hasArg(x) && !argInt(...)) return;` em todos os opcionais. |
| 4 | Firmware (`deadlock.cpp`) | Após recuperar, a tarefa sobrevivente continuava em laço e o experimento nunca terminava; se a criação falhasse, o estado ficava “rodando” para sempre. | A sobrevivente encerra após a rodada; `reapIfOrphan()` limpa o estado. |
| 5 | Firmware (`concurrency.cpp`) | `max()` sobre variáveis `volatile int64_t` é ambíguo. | Copiadas para locais antes de comparar. |
| 6 | Interface | Janelas de “vidro” semitransparentes deixavam ler o texto das janelas de trás. | Superfície das janelas opaca (`.window-surface`); vidro só no menu e na barra. |
| 7 | Interface (`Logo`) | As trilhas do logotipo não apareciam: gradiente SVG em `objectBoundingBox` não pinta linhas retas (caixa de largura zero). | `gradientUnits="userSpaceOnUse"` e id único por instância (`useId`). |
| 8 | Interface | Janelas minimizadas continuavam capturando cliques na área onde estavam. | `pointer-events: none` no quadro da janela minimizada. |
| 9 | Interface | Lint: atribuição inútil no boot (`no-useless-assignment`). | Corrigido. |
| 10 | Interface (Deadlock) | Texto redundante (“esperando o 2º mutex — esperando M2”) e grafo grande demais em tela larga. | Texto simplificado; SVG com largura máxima. |
| 11 | Textos | Terminologia diferente da Aula 8 (“não-preempção”). | Alinhado aos slides: “ausência de preempção”, 4 estratégias, concorrência × paralelismo. |
| 12 | Testes | Um `pkill -f mock-server` encerrou o próprio terminal de teste (o padrão casava com a linha de comando). | Controle por arquivo de PID. |
| 13 | **Firmware (`tasks.cpp`, `scheduler.cpp`) — achado no teste na placa real** | Ao criar uma tarefa, o PID era lido com `uxTaskGetTaskNumber()`, que devolve o campo `uxTaskNumber` (0 se ninguém chamar `vTaskSetTaskNumber`). A listagem e o `ps` usam `xTaskNumber` (número do TCB). Na placa, toda tarefa criada ficava com PID 0 e **suspender, retomar, mudar prioridade, finalizar e `kill` não achavam a tarefa**. O servidor *mock* inventava PIDs coerentes, por isso o erro só apareceu no hardware. | PID lido com `vTaskGetInfo(...).xTaskNumber`, o mesmo número da listagem. |
| 14 | Instalação no Windows | Placa com conversor CP2102 sem driver: a porta COM não aparecia. | Driver CP210x da Silicon Labs instalado com `pnputil /add-driver silabser.inf /install`; a placa virou COM3. |
| 15 | Ferramentas | Sem o core ESP32 no PC, não havia `mklittlefs` para regravar só a interface. | Imagem LittleFS gerada com `littlefs-python` usando os mesmos parâmetros da original (bloco 4096, 352 blocos, disco v2.1, `name_max` 255), conferida arquivo por arquivo e gravada com o esptool em `0x290000`. |
| 16 | Textos da interface | Seis referências ao Tanenbaum estavam marcadas “conferir edição” e só a Aula 8 tinha sido lida. | Lidos os slides das Aulas 2, 3, 4, 5, 7 e 9 na pasta da disciplina. Textos alinhados aos termos das aulas (PCB, troca de contexto, preemptivo × não preemptivo, fragmentação interna × externa, MMU, compactação, modo usuário × modo kernel, MBR/GPT e boot, RTOS e *deadline*). Capítulos conferidos na 4ª ed. (2016), a citada nas aulas. Simuladores ganharam os exemplos dos slides e reproduzem os números: FIFO 10 e LRU 9 faltas (Aula 9); Gantt de FCFS e RR q=2 (Aula 7). |
| 17 | Interface | O grupo achou o visual feio. | Novo visual inspirado em desktops Linux (KDE Plasma): painel flutuante, lançador com categorias por aula, janelas com título centralizado, ícones chapados, papel de parede em SVG e fontes embutidas (Manrope e JetBrains Mono, licença OFL) — tudo offline. |

## 4. Validações feitas pela IA (sem placa)

- `tsc` estrito e ESLint sem erros; build de produção e compactação gzip.
- Checagem de sintaxe do firmware com e sem *trace facility*.
- Interface navegada em Chrome contra o servidor de testes: 12 apps, desktop 1440 × 900 e celular 390 × 844,
  queda e volta da conexão. Sem erros no console.
- Compilação real do firmware com o core 3.3.10 (sem erros/avisos) e geração da imagem LittleFS.
- **Não feito:** execução dos `.bat` no Windows e qualquer teste na placa.

## 5. Pontos que exigem atenção do grupo

- Se usar um core diferente do 3.3.10 e a compilação falhar, os candidatos são `xTaskGetIdleTaskHandleForCore`,
  `xTaskGetCoreID` e `esp_task_wdt_*`. Com o 3.3.10 compila sem erros.
- Ver no monitor serial se aparece `trace=1 runtime=1` (esperado com o core 3.3.10).
- Revisar os textos das Aulas 2, 3, 4, 7, 9 e 10 contra os slides e confirmar as seções “conferir edição”.

## 6. Sessões do grupo (preencher)

| Data | Prompt / pergunta | O que a IA respondeu ou errou | O que o grupo fez |
|---|---|---|---|
| | | | |

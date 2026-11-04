# Rastreabilidade dos requisitos

Requisitos extraídos do documento **“Desafio WebOS ESP32”** (Prof. Joelmir Ramos) e onde cada um foi atendido.

## Seção 3.1 — Acesso pela interface web

| Requisito | Onde |
|---|---|
| ESP32 cria a própria rede (Access Point) e entrega a página | `WebOS_ESP32.ino` (`startAccessPoint`), `web_server.cpp` (`streamFromFs`) |
| Usuário abre `http://192.168.4.1`; nada instalado no computador do usuário | IP fixo do AP; interface no LittleFS; sem CDN/internet |
| Página conversa por API HTTP JSON | `web_server.cpp` (`beginOk/sendOk/sendError`), [API.md](API.md) |
| Atualiza sozinha a cada ~1 s | `hooks/usePolling.ts` (1 s na maioria dos apps; 500 ms em Dispositivos e Deadlock; 5 s no Explorador), `contexts/SystemContext.tsx` |
| Funciona no computador e no celular | layout responsivo; janelas em tela cheia e tabelas com rolagem lateral em telas < 768 px |

## Seção 3.2 — Explicação na própria interface

| Requisito | Onde |
|---|---|
| Área “Entenda o conceito” em cada app | `components/ConceptBox.tsx`, textos em `content/concepts.tsx` (12 apps) |
| Cita aula e capítulo do Tanenbaum | rodapé da caixa; referências não citadas no documento aparecem com “conferir edição” (tabela abaixo) |
| Diz como experimentar | campo “Como experimentar aqui” |
| Resultados importantes interpretados na tela | componente `Callout` dinâmico em cada app (ex.: “67.616 incrementos sumiram: condição de corrida”) |
| Unidades e nomes claros | KB/ms/%/bytes em todos os números; `lib/format.ts` |

## Seção 3.3 — Apps

| App | Exigência do documento | Implementação |
|---|---|---|
| Gerenciador de Tarefas | listar nome, estado, prioridade, núcleo, pilha livre; criar, suspender, retomar, finalizar, mudar prioridade | `tasks.cpp`, `apps/TaskManager.tsx` |
| Escalonador ao vivo | 2–3 tarefas que só calculam; % de CPU; efeito da prioridade; inanição | `scheduler.cpp` (3 tarefas, 3 cenários, aging), `apps/Scheduler.tsx` |
| Laboratório de Concorrência | duas tarefas, uma em cada núcleo, mesmo contador; errado sem mutex, certo com mutex | `concurrency.cpp`, `apps/Concurrency.tsx` |
| Monitor de Memória | heap livre, menor heap, maior bloco; alocar, liberar, fragmentar | `memory.cpp`, `apps/MemoryMonitor.tsx` |
| Explorador de Arquivos | listar, criar, editar, apagar no LittleFS; espaço usado e total | `files.cpp` (+ tabela de partições em `system.cpp`), `apps/FileExplorer.tsx` |
| Gerenciador de Dispositivos | LED pela página; BOOT por interrupção com contador | `devices.cpp`, `apps/Devices.tsx` |
| Monitor do Sistema (bônus) | heap no tempo, nº de tarefas, aparelhos, tempo ligado | `system.cpp` (monitor + histórico), `apps/SystemMonitor.tsx` |
| Deadlock (bônus) | dois mutex em ordem invertida; detectar e prevenir | `deadlock.cpp`, `apps/Deadlock.tsx` |
| Simulador de Escalonamento (bônus) | FCFS, SJF, RR, Gantt, tempos médios | `lib/scheduling.ts`, `apps/SchedulingSim.tsx` (SIMULAÇÃO) |
| Simulador de Paginação (bônus) | FIFO, LRU, Ótimo, faltas de página | `lib/paging.ts`, `apps/PagingSim.tsx` (SIMULAÇÃO) |
| Terminal (bônus) | ps, kill, mem, ls, cat | `terminal.cpp`, `apps/Terminal.tsx` |
| Sobre / Login (bônus) | arquitetura em camadas; usuário e senha | `auth.cpp`, `apps/About.tsx`, `boot/LoginScreen.tsx` |

## Seção 4 — Conceito de interface

| Item | Onde |
|---|---|
| Ícones na área de trabalho, janelas que se movem e se sobrepõem | `desktop/Desktop.tsx`, `windows/Window.tsx`, `contexts/WindowManager.tsx` (z-index, arrastar, redimensionar, minimizar, maximizar, restaurar, fechar) |
| Barra de tarefas com janelas abertas, IP, memória, tempo ligado e relógio | `desktop/Taskbar.tsx` |
| Menu Iniciar agrupado por aula | `desktop/StartMenu.tsx`, `apps/meta.ts` (`GROUPS`) |
| “Entenda o conceito” abre e fecha, no topo de cada janela | `ConceptBox` (estado lembrado por app) |
| Celular: janela ocupa a tela, tabelas rolam para o lado | `Window` (modo `full`), `TableWrap` |

## Seção 8 — Uso de IA · Seção 9 — Entregáveis

| Item | Onde |
|---|---|
| Diário de IA (prompts, erros da IA, correções) | [DIARIO-DE-DESENVOLVIMENTO.md](DIARIO-DE-DESENVOLVIMENTO.md) |
| Conferir textos contra as aulas | tabela de referências abaixo + checklist de apresentação |
| Tudo testado na placa | **pendente** — [CHECKLIST-VALIDACAO.md](CHECKLIST-VALIDACAO.md) |
| Código-fonte completo do sketch, compilando sem erros | `firmware/WebOS_ESP32/` — **compilado com o core esp32 3.3.10 sem erros e sem avisos**; binários em `firmware/prebuilt` |

## Referências ao Tanenbaum

As seções marcadas como **citadas** aparecem nas figuras do documento do professor. As demais foram
indicadas pelo grupo a partir do sumário do livro (4ª edição) e aparecem na interface com a etiqueta
**“conferir edição”**: confira o número na edição usada pela turma antes de apresentar.

| App | Referência | Situação |
|---|---|---|
| Gerenciador de Tarefas | cap. 2.1 — Processos | citada no documento (Figura 3) |
| Escalonador ao vivo | cap. 2.4 — Escalonamento | citada (Figura 4) |
| Simulador de Escalonamento | cap. 2.4 — Escalonamento | citada (Figura 4) |
| Laboratório de Concorrência | cap. 2.3 — Comunicação entre processos | citada (Figura 5) |
| Monitor de Memória | cap. 3 — Gerenciamento de memória | citada (Figura 6) |
| Gerenciador de Dispositivos | cap. 5 — Entrada/saída | citada (Figura 8) |
| Explorador de Arquivos | cap. 4 — Sistemas de arquivos | a conferir |
| Monitor do Sistema | cap. 1.1 — O que é um sistema operacional | a conferir |
| Deadlock | cap. 6 — Impasses (deadlocks) | a conferir |
| Simulador de Paginação | cap. 3.4 — Algoritmos de substituição de páginas | a conferir |
| Terminal | cap. 1.6 — Chamadas de sistema | a conferir |
| Sobre / Login | cap. 1.7 — Estrutura de SOs; cap. 9 — Segurança | a conferir |

Os números das **aulas** seguem a tabela da seção 2 do documento e os títulos dos arquivos da pasta da
disciplina (Aula 1 a Aula 10; a Aula 6 é revisão). A **Aula 8** (concorrência, deadlocks e sincronização) foi
lida na íntegra e a interface usa a mesma terminologia dela: condição de corrida, região crítica, exclusão
mútua, mutex, concorrência × paralelismo, condições de Coffman (exclusão mútua, posse e espera, ausência de
preempção, espera circular) e as quatro estratégias (prevenção, evitação, detecção e recuperação, ignorar).
As demais aulas não foram lidas por completo: revise os textos dos apps das Aulas 2, 3, 4, 7, 9 e 10
contra os slides antes da apresentação (o enunciado deixa claro que o grupo responde pelo que aparece na tela).

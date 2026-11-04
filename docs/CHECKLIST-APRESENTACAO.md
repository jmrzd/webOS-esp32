# Checklist e roteiro de apresentação

## Antes de entrar na sala

- [ ] [CHECKLIST-VALIDACAO.md](CHECKLIST-VALIDACAO.md) executado na placa que será usada.
- [ ] Placa gravada com a versão final; dados do grupo preenchidos em **Sobre › Grupo**.
- [ ] Login **desativado** (ou senha combinada), para não travar a demonstração.
- [ ] Celular e notebook já conectados ao Wi-Fi da placa; dados móveis desligados.
- [ ] Cabo USB de dados e uma fonte USB reserva.
- [ ] Textos de “Entenda o conceito” revisados contra os slides; seções “conferir edição” confirmadas.
- [ ] `.zip` com o nome do grupo: `firmware/WebOS_ESP32` (todas as abas), `frontend/`, `scripts/`, `docs/`, `README.md`.

## Roteiro sugerido (≈ 10 min)

| Tempo | O quê | Fala-chave |
|---|---|---|
| 0:00 | Ligar a placa, abrir `192.168.4.1` no celular. Mostrar o boot. | “A página vem da flash do ESP32; a placa só entra na área de trabalho depois de responder à API.” |
| 1:00 | **Sobre**: camadas. | “Navegador → API (como chamadas de sistema) → serviços → núcleo FreeRTOS → hardware.” (Aula 3) |
| 2:00 | **Gerenciador de Tarefas**: criar `contador` e duas `cpu` (1 e 3). | “Contador fica bloqueado (I/O-bound); a cpu de prioridade 1 está pronta mas não executa.” (Aula 7) |
| 3:30 | **Escalonador**: cenário 2, depois suspender “alta”; cenário 1. | “Preempção por prioridade e inanição; com prioridades iguais, Round-Robin a cada tick.” |
| 5:00 | **Concorrência**: sem mutex, depois com mutex. | “Os incrementos perdidos são uma condição de corrida real entre os dois núcleos; o mutex cria exclusão mútua.” (Aula 8) |
| 6:00 | **Memória**: provocar fragmentação. | “Livre ≠ maior bloco contíguo: fragmentação externa.” (Aula 9) |
| 7:00 | **Arquivos**: salvar nota, reiniciar a placa, abrir de novo; tabela de partições. | “Persistência na flash; a flash é particionada.” (Aulas 4 e 10) |
| 8:00 | **Dispositivos**: LED e botão BOOT. | “Interrupção → ISR curta → fila → driver; repiques filtrados por debounce.” (Aula 10) |
| 9:00 | **Deadlock** (bônus) e **Terminal** (`ps`, `kill`). | “Espera circular detectada pelo grafo; a ordem global previne. O shell pede, o núcleo decide.” |

## Perguntas prováveis

- **Por que a soma da CPU não dá exatamente 100%?** Interrupções e tarefas do sistema (Wi-Fi, timers) também usam o núcleo 0.
- **Por que uma tarefa aparece “suspensa” sem ninguém suspender?** No FreeRTOS, bloqueio sem prazo (`portMAX_DELAY`) fica na lista de suspensas.
- **A corrida é simulada?** Não: duas tarefas FreeRTOS em núcleos diferentes executam `t = contador; t++; contador = t` de verdade (`concurrency.cpp`).
- **Como mede a CPU?** A cada 1 s, diferença do contador de tempo de execução de cada tarefa ÷ tempo decorrido (`system.cpp`, `sampleCpu`).
- **O que é simulação no WebOS?** Só os simuladores de escalonamento e de paginação, marcados na tela.
- **E se a placa travar no deadlock?** Só as duas tarefas do experimento ficam presas; o vigia detecta e recupera; o servidor roda em outra tarefa.
- **Onde está o diário de IA?** [DIARIO-DE-DESENVOLVIMENTO.md](DIARIO-DE-DESENVOLVIMENTO.md).

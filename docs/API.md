# API do WebOS ESP32

Base: `http://192.168.4.1` (mesma origem da interface). Implementação: `firmware/WebOS_ESP32/*.cpp`.
Tipos TypeScript correspondentes: `frontend/src/types/api.ts`. Cliente: `frontend/src/services/api.ts`.

## Convenções

- **Resposta de sucesso** — HTTP 200: `{"ok": true, "data": { ... }}`
- **Resposta de erro**: `{"ok": false, "error": {"code": "invalid_param", "message": "texto em português"}}`

| HTTP | `code` típico | Quando |
|---|---|---|
| 400 | `missing_param`, `invalid_param`, `invalid_path`, `invalid_input`, `invalid_pin` | parâmetro ausente, fora do intervalo ou malformado |
| 401 | `bad_credentials` | senha incorreta |
| 403 | `protected` | operação em tarefa do sistema ou em `/www` |
| 404 | `not_found` | rota, arquivo, bloco inexistente |
| 409 | `busy`, `exists`, `limit`, `refused`, `not_running`, `no_deadlock`, `not_empty` | estado não permite a operação |
| 413 | `too_large` | parâmetro maior que o permitido |
| 429 | `rate_limited`, `locked` | mais de 60 req/s na API; login bloqueado por 30 s |
| 503 | `fs_unavailable` | LittleFS não montado |
| 507 | `no_memory`, `no_space` | heap ou flash insuficiente |

- `GET`: parâmetros na query string. `POST`: corpo `application/x-www-form-urlencoded`.
- Booleanos como `0`/`1`. Tamanhos em **bytes**, tempos em **ms**, CPU em **%**.
- Todas as respostas da API têm `Cache-Control: no-store`.

## Sistema

| Método e rota | Parâmetros | `data` |
|---|---|---|
| `GET /api/system/health` | — | `status`, `uptimeMs`, `freeHeap`, `samples` |
| `GET /api/system/info` | — | `name`, `version`, `build`, `chip{model,revision,cores,cpuMHz,flashBytes,flashMHz,psramBytes,mac}`, `sdk`, `arduinoCore`, `freertos{kernel,tickHz,maxPriorities,tasks}`, `capabilities{traceFacility,runtimeStats,dualCore,littlefs}`, `network{mode,ssid,ip,channel,hostname,stations,maxStations}`, `hardware{ledPin,buttonPin}`, `uptimeMs`, `heap{...}` |
| `GET /api/system/metrics` | — | `uptimeMs`, `heap{total,free,minFree,largestBlock,allocatedBlocks,freeBlocks,psramTotal,psramFree}`, `tasks`, `stations`, `cpu{core0,core1,measured}` (null se indisponível), `fs{mounted,used,total}`, `heapHistory[]` (até 60 amostras de 1 s), `led`, `demoCoreBusy`, `rateLimited` |
| `GET /api/system/partitions` | — | `flashBytes`, `partitions[{label,type,subtype,offset,size,running,filesystem}]` |
| `POST /api/system/restart` | — | reinicia a placa após 500 ms |

## Tarefas (Gerenciador de Tarefas)

| Rota | Parâmetros | Observações |
|---|---|---|
| `GET /api/tasks` | — | `tasks[{pid,name,state,priority,basePriority,core(-1=qualquer),stackFree,cpu,user,type,counter,rate,protected,protectedReason}]`, `total`, `maxUserTasks`, `prioMin`, `prioMax`, `traceFacility`, `runtimeStats` |
| `POST /api/tasks` | `type=cpu\|contador`, `priority=1..8`, `name` (opcional, 1–15: letras, números, `-`, `_`) | cria a tarefa; `cpu` no núcleo 0, `contador` no núcleo 1. Até 12. |
| `POST /api/tasks/suspend` | `pid` | `vTaskSuspend` — só tarefas do usuário (403 nas demais) |
| `POST /api/tasks/resume` | `pid` | `vTaskResume` |
| `POST /api/tasks/delete` | `pid` | `vTaskDelete` |
| `POST /api/tasks/priority` | `pid`, `priority=1..8` | `vTaskPrioritySet` |

`state` ∈ `executando`, `pronta`, `bloqueada`, `suspensa`, `finalizada`, `invalida`.

## Escalonador ao vivo

| Rota | Parâmetros | Observações |
|---|---|---|
| `GET /api/scheduler` | — | `running`, `scenario`, `aging`, `agingBoosts`, `cpuMethod` (`runtime`/`voltas`), `core`, `elapsedMs`, `maxSeconds`, `otherCpuTasks`, `lastEvent`, `tasks[{id,name,state,priority,basePriority,pid,loopsPerSec,loops,suspended,aged,starvedSecs,cpu}]` |
| `POST /api/scheduler/start` | `scenario=1..3` | 1: (1,1,1) · 2: (1,2,3) · 3: (2,2,1). 409 se o laboratório de concorrência estiver rodando. |
| `POST /api/scheduler/stop` | — | |
| `POST /api/scheduler/task` | `id=0..2`, `action=suspend\|resume\|prio`, `priority` (para `prio`) | |
| `POST /api/scheduler/aging` | `enabled=0\|1` | quem passa 2 s sem CPU sobe para a maior prioridade + 1 |

## Laboratório de Concorrência

| Rota | Parâmetros | Observações |
|---|---|---|
| `GET /api/concurrency` | — | `running`, `dualCore`, `current{mutex,n,progress0,progress1,counter,elapsedMs}` ou null, `history[{id,version,mutex,n,expected,obtained,lost,lostPct,elapsedMs,aborted,sameCore}]` (mais recente primeiro, até 12) |
| `POST /api/concurrency/start` | `n=1000..1000000`, `mutex=0\|1` | assíncrono: acompanhe pelo GET. 409 se ocupado ou com o escalonador ativo. Prazo de 30 s. |
| `POST /api/concurrency/stop` | — | aborta (resultado marcado `aborted`) |
| `POST /api/concurrency/reset` | — | limpa o histórico |

## Memória

| Rota | Parâmetros | Observações |
|---|---|---|
| `GET /api/memory` | — | `heap{total,free,used,minFree,largestBlock,freeBlocks,allocatedBlocks,fragmentationPct}`, `app{blocks,bytesHeld,bytesAllocatedTotal,bytesFreedTotal,allocOps,freeOps,refused,reserveBytes,maxBlocks}`, `lastEvent`, `blocks[{id,size,address,ageMs}]`, `history[]` |
| `POST /api/memory/allocate` | `kb=1..32` | 409 `refused` se sobrariam menos de 40 KB ou se o `malloc` falhar |
| `POST /api/memory/free` | `mode=one\|all\|alternate`, `id` (para `one`) | |
| `POST /api/memory/fragment` | — | aloca blocos de 8 KB até a reserva e libera metade, alternados |

## Arquivos (LittleFS)

Caminhos: absolutos, até 63 caracteres, nomes até 31 com letras, números, espaço, `.`, `-`, `_`; sem `..`.
`/www` (a interface) pode ser listado e lido, mas não alterado.

| Rota | Parâmetros | Observações |
|---|---|---|
| `GET /api/files` | `dir` (padrão `/`) | `dir`, `used`, `total`, `maxFileBytes`, `partition`, `entries[{name,path,isDir,size,protected,modified}]` |
| `GET /api/files/read` | `path` | `content` (até 16 KB; `truncated`), `binary`, `size`, `protected` |
| `POST /api/files/create` | `path`, `type=file\|dir`, `content` (opcional) | 409 se já existe |
| `POST /api/files/write` | `path`, `content` (≤ 16 KB) | cria ou sobrescreve; 507 sem espaço |
| `POST /api/files/delete` | `path` | pastas só vazias (409 `not_empty`) |

## Dispositivos

| Rota | Parâmetros | Observações |
|---|---|---|
| `GET /api/devices` | — | `led{pin,activeLow,on,toggles,level,allowedPins[]}`, `button{pin,trigger,pullup,pressedNow,interrupts,valid,filtered,dropped,queued,debounceMs,lastValidMs,nowMs,driverState,history[{atMs,sinceLastMs,bounces}]}` |
| `GET /api/devices/button` | — | só `button` |
| `POST /api/devices/led` | `state=on\|off\|toggle` | devolve `led` |
| `POST /api/devices/config` | `ledPin`, `activeLow=0\|1` | pinos permitidos: 2, 4, 5, 12–19, 21–23, 25–27, 32, 33. Salvo na NVS. |
| `POST /api/devices/button/reset` | — | zera contadores e histórico |

## Deadlock

| Rota | Parâmetros | Observações |
|---|---|---|
| `GET /api/deadlock` | — | `running`, `mode`, `autoRecover`, `deadlock` (ciclo agora), `detected`, `detections`, `recoveries`, `elapsedMs`, `cycleForMs`, `detectAfterMs`, `autoRecoverAfterMs`, `mutexes[{name,holder}]`, `tasks[{name,phase,rounds,waitingFor,order,state}]`, `log[]` |
| `POST /api/deadlock/start` | `mode=deadlock\|ordered`, `autoRecover=0\|1` | limite de 90 s por experimento |
| `POST /api/deadlock/recover` | — | escolhe B como vítima (409 se não houver ciclo) |
| `POST /api/deadlock/stop` | — | |

## Terminal

`POST /api/terminal/execute` — `cmd` (até 120 caracteres, sem caracteres de controle) →
`{cmd, output, exitCode}`. Comandos: `help`, `ps`, `kill <pid>`, `mem`/`free`, `ls [dir]`, `cat <arquivo>`
(até 4 KB), `df`, `uptime`, `uname [-a]`, `led on|off|toggle|status`. `clear` é tratado no navegador.
Comando desconhecido → `exitCode` 127.

## Login (educacional)

| Rota | Parâmetros | Observações |
|---|---|---|
| `GET /api/auth/status` | — | `required`, `user`, `locked`, `lockRemainingMs`, `defaultPassword`, `algorithm` |
| `POST /api/auth/login` | `user`, `pass` | `token` (16 bytes aleatórios, hex). 5 erros → bloqueio de 30 s |
| `POST /api/auth/verify` | `token` | `valid` |
| `POST /api/auth/logout` | — | invalida o token |
| `POST /api/auth/config` | `currentPass`, `newUser`, `newPass` (≥ 4), `required=0\|1` | exige a senha atual |

Senha guardada como `SHA-256(sal + ":" + senha)` com sal aleatório, na NVS. Comparações em tempo constante.
**Limitação assumida:** HTTP sem TLS; a API não exige o token.

## Arquivos estáticos

Qualquer rota fora de `/api/` é procurada em `/www` do LittleFS. Se existir `<arquivo>.gz`, é enviado com
`Content-Encoding: gzip`. Arquivos em `/assets/` (nomes com hash) recebem cache longo; `index.html`, `no-cache`.
Rotas sem extensão devolvem o `index.html`. Sem a interface gravada, a placa mostra uma página de aviso.

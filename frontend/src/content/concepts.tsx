// Textos didáticos de "Entenda o conceito". Revisados contra o documento do
// desafio e contra os slides das Aulas 2, 3, 4, 5, 7, 8 e 9 (pasta da disciplina).
// Capítulos conferidos no sumário da 4ª edição do Tanenbaum & Bos (2016), a
// edição citada na bibliografia das aulas.
import type { Concept } from '../components/ConceptBox'
import { ProcessStateDiagram } from './diagrams'

const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-ink-50">{children}</b>
const C = ({ children }: { children: React.ReactNode }) => <code className="num rounded bg-black/30 px-1 py-0.5 text-[11.5px] text-phos-200">{children}</code>

export const CONCEPTS: Record<string, Concept> = {
  tasks: {
    lesson: 'Aula 7 · Processos',
    tanenbaum: 'cap. 2.1 — Processos',
    tanenbaumConfirmed: true,
    what: <>Um <B>processo</B> é um programa em execução. No FreeRTOS — o sistema operacional de tempo real que roda dentro do ESP32 — ele se chama <B>tarefa</B>: tem pilha própria, prioridade e um <B>estado</B>. O SO guarda tudo sobre cada processo num <B>PCB</B> (<i>Process Control Block</i>: PID, estado, prioridade, contador de programa, registradores, memória, tempo de CPU) — no FreeRTOS ele se chama TCB. O conjunto dos PCBs é a <B>tabela de processos</B>.</>,
    diagram: <ProcessStateDiagram />,
    how: <>Uma tarefa nasce <i>pronta</i>. O escalonador escolhe a pronta de maior prioridade para <i>executar</i>. Ao esperar um evento (um <C>vTaskDelay</C>, uma fila) ela fica <i>bloqueada</i> e não consome CPU; quando o evento chega volta a <i>pronta</i>. <C>vTaskSuspend</C> a tira do escalonamento até um <C>vTaskResume</C>; <C>vTaskDelete</C> é uma <B>finalização externa</B> (como o <C>kill</C> do Linux ou o <C>taskkill</C> do Windows) e o SO libera a pilha e o PCB da tarefa.</>,
    why: <>Com a tabela de processos o SO consegue repartir a CPU entre muitos programas, saber quem espera o quê e recuperar recursos quando um programa termina. Prioridade é a ferramenta para dizer ao SO o que é mais urgente.</>,
    tryIt: [
      <>Crie uma tarefa <B>contador</B> (dorme 100 ms) e observe-a quase sempre como <i>bloqueada</i>.</>,
      <>Crie uma tarefa <B>cpu</B> com prioridade 1 e depois outra com prioridade 3: a de prioridade 1 para de avançar (coluna Ritmo).</>,
      <>Suspenda a de prioridade 3 e veja a outra voltar a executar; depois finalize as duas.</>,
    ],
    observe: [
      <><B>PID</B>: o identificador único de cada tarefa, como na Aula 7.</>,
      <><B>Estado</B>: executando, pronta, bloqueada ou suspensa — vindo de <C>uxTaskGetSystemState()</C>.</>,
      <><B>Pilha livre</B>: o menor espaço livre que a pilha já teve (bytes). Se chegar a zero ocorre estouro de pilha.</>,
      <><B>Núcleo</B>: o ESP32 tem 2. As tarefas “cpu” rodam no 0; o servidor web no 1.</>,
    ],
    interpret: <>Tarefas <i>cpu</i> são <B>CPU-bound</B> (só calculam) e as <i>contador</i> são <B>I/O-bound</B> (passam o tempo bloqueadas). Uma tarefa “pronta” que nunca vira “executando” está sendo preterida por outra de prioridade maior. Atenção: no FreeRTOS, uma tarefa bloqueada <i>sem prazo</i> (<C>portMAX_DELAY</C>) aparece na listagem como <i>suspensa</i> — é assim que o núcleo a guarda.</>,
    apis: 'xTaskCreatePinnedToCore · vTaskSuspend · vTaskResume · vTaskDelete · vTaskPrioritySet · uxTaskGetSystemState',
  },

  scheduler: {
    lesson: 'Aula 7 · Escalonamento',
    tanenbaum: 'cap. 2.4 — Escalonamento',
    tanenbaumConfirmed: true,
    what: <>O <B>escalonador</B> decide qual tarefa pronta usa a CPU. O do FreeRTOS é <B>preemptivo por prioridade</B>: sempre executa a tarefa pronta de maior prioridade e a interrompe (preempta) quando aparece outra mais prioritária. Entre tarefas de <B>mesma</B> prioridade ele faz <B>Round-Robin</B>, com quantum de um tick do relógio (1 ms no ESP32). Cada troca é uma <B>troca de contexto</B>: o SO salva registradores e contador de programa de uma tarefa e restaura os da outra.</>,
    how: <>Aqui rodam três tarefas reais — <i>baixa</i>, <i>media</i> e <i>alta</i> — presas ao núcleo 0, que só calculam e nunca bloqueiam. A cada segundo o WebOS mede quanto tempo cada uma ocupou a CPU naquele intervalo (diferença do contador de tempo de execução do FreeRTOS ÷ 1 s). Isso é utilização <B>instantânea</B>, não o total acumulado desde o boot.</>,
    why: <>A política de escalonamento define tempo de resposta, justiça e eficiência. Um escalonador <B>preemptivo</B> pode tirar a CPU de quem está executando; um <B>não preemptivo</B> espera a tarefa terminar ou bloquear (Aula 7). Prioridade estrita é ótima para tempo real (o urgente nunca espera), mas pode causar <B>inanição</B> (<i>starvation</i>): quem tem prioridade baixa pode nunca executar. Uma solução clássica é o <B>envelhecimento</B> (<i>aging</i>): aumentar a prioridade de quem espera demais.</>,
    tryIt: [
      <>Cenário 1 (prioridades iguais): as três dividem a CPU, cerca de 33% cada — Round-Robin.</>,
      <>Cenário 2 (1, 2 e 3): só <i>alta</i> executa; as outras ficam prontas a 0% — inanição.</>,
      <>No cenário 2, suspenda <i>alta</i>: a CPU passa inteira para <i>media</i> (a próxima na fila de prioridades).</>,
      <>Ligue o <B>aging</B> e veja quem está passando fome subir de prioridade.</>,
    ],
    observe: [
      <>A coluna <B>% de CPU</B> e as <B>voltas/s</B> (trabalho efetivamente feito).</>,
      <>O estado: quem tem 0% está <i>pronta</i>, não bloqueada — ela quer CPU, mas não recebe.</>,
      <>O servidor web continua respondendo porque roda no outro núcleo.</>,
    ],
    interpret: <>Se uma tarefa pronta fica em 0% enquanto outra de prioridade maior está em ~100%, isso é <B>inanição causada por prioridade estrita</B>. Fatias iguais entre tarefas de mesma prioridade mostram o <B>Round-Robin</B>. A soma pode ficar um pouco abaixo de 100% porque interrupções e tarefas do sistema (Wi-Fi) também usam o núcleo 0.</>,
    apis: 'vTaskPrioritySet · vTaskSuspend · uxTaskGetSystemState (ulRunTimeCounter) · núcleo 0',
  },

  concurrency: {
    lesson: 'Aula 8 · Concorrência',
    tanenbaum: 'cap. 2.3 — Comunicação entre processos',
    tanenbaumConfirmed: true,
    what: <>Quando duas tarefas usam o mesmo dado ao mesmo tempo, o resultado depende da ordem exata em que executam: é uma <B>condição de corrida</B>. O trecho que mexe no dado compartilhado é a <B>região crítica</B>. Aqui há <B>paralelismo</B> de verdade: as duas tarefas executam ao mesmo tempo, uma em cada núcleo — não é só concorrência por alternância numa CPU.</>,
    how: <>Duas tarefas, uma em cada núcleo do ESP32, fazem N vezes: lê o contador, soma 1, escreve. Se as duas leem o mesmo valor antes de qualquer uma escrever, uma escrita apaga a outra e um incremento some. A solução é a <B>exclusão mútua</B>: com um <B>mutex</B> (<C>xSemaphoreTake</C> para entrar, <C>xSemaphoreGive</C> para sair) só uma tarefa por vez fica na região crítica.</>,
    why: <>Todo SO multitarefa — e todo programa com threads — precisa sincronizar dados compartilhados. Erros de corrida são intermitentes e difíceis de reproduzir; por isso o SO oferece primitivas de sincronização (mutex, semáforo, fila).</>,
    tryIt: [
      <>Execute <B>SEM mutex</B> com 100.000 incrementos por tarefa: o obtido fica abaixo de 200.000.</>,
      <>Execute <B>COM mutex</B>: o resultado é exatamente 200.000.</>,
      <>Repita algumas vezes e compare o tempo e os incrementos perdidos no histórico.</>,
    ],
    observe: [
      <>Esperado = 2 × N. Perdidos = esperado − obtido.</>,
      <>Sem mutex, a quantidade perdida muda a cada execução (depende do entrelaçamento real dos núcleos).</>,
      <>Com mutex fica correto, porém mais lento: entrar e sair da região crítica tem custo.</>,
    ],
    interpret: <>Qualquer incremento perdido na versão sem mutex é a prova de uma <B>condição de corrida real</B> entre os dois núcleos. O resultado exato com mutex mostra que a exclusão mútua resolve o problema; a diferença de tempo é o preço da sincronização. Num chip de um núcleo só, a corrida quase não aparece, porque as tarefas não executam ao mesmo tempo de verdade.</>,
    apis: 'xSemaphoreCreateMutex · xSemaphoreTake · xSemaphoreGive · xEventGroupSetBits · núcleos 0 e 1',
  },

  memory: {
    lesson: 'Aula 9 · Memória',
    tanenbaum: 'cap. 3 — Gerenciamento de memória',
    tanenbaumConfirmed: true,
    what: <>Segundo Tanenbaum & Bos, o <B>gerenciador de memória</B> é a parte do SO que controla quais partes da memória estão em uso, aloca memória aos processos quando precisam e a libera quando terminam. No ESP32 a área livre para o programa é o <B>heap</B>: dele saem as pilhas das tarefas, os buffers do Wi-Fi e tudo o que se pede com <C>malloc</C>.</>,
    how: <>Cada alocação reserva um bloco <B>contíguo</B> — como as partições variáveis da Aula 9. O alocador procura uma lacuna livre que caiba (o ESP-IDF usa o TLSF, que acha rápido uma lacuna de tamanho adequado, parecido com o <i>best fit</i>). Ao liberar, o espaço volta ao heap, mas pode ficar entre blocos ocupados: é a <B>fragmentação externa</B> — há memória livre no total, porém em lacunas separadas, e um pedido grande não cabe. Por isso o “maior bloco contíguo” pode ser bem menor que o “livre”. Já a <B>fragmentação interna</B> é o desperdício <i>dentro</i> do bloco (o alocador arredonda o tamanho e guarda um cabeçalho).</>,
    why: <>Sem um gerenciador, programas sobrescreveriam a memória uns dos outros e a RAM acabaria por desperdício. O ESP32 não tem <B>MMU</B> para paginar os programas como um PC: os endereços que você vê são <B>físicos</B>. Por isso ele também não pode fazer <B>compactação</B> (mover blocos para juntar as lacunas): os ponteiros dos programas ficariam errados. Paginação aparece no app Simulador de Paginação.</>,
    tryIt: [
      <>Aloque alguns blocos de 8 KB e veja o heap livre cair e os blocos aparecerem com o endereço real.</>,
      <>Clique em <B>Provocar fragmentação</B>: o WebOS enche o heap e libera blocos alternados.</>,
      <>Compare “livre” com “maior bloco contíguo” e tente alocar 32 KB.</>,
    ],
    observe: [
      <><B>Heap livre</B> agora e <B>menor livre</B> (o pior momento desde o boot).</>,
      <><B>Fragmentação</B> = 1 − maior bloco ÷ livre.</>,
      <>O WebOS recusa alocações que deixariam menos de 40 KB para o sistema.</>,
    ],
    interpret: <>Se há bastante memória livre mas um pedido grande falha ou o maior bloco é pequeno, isso é <B>fragmentação externa</B>. Quando os blocos vizinhos são liberados, o alocador junta (coalesce) os buracos e o maior bloco volta a crescer.</>,
    apis: 'heap_caps_malloc · heap_caps_free · heap_caps_get_free_size · heap_caps_get_largest_free_block · heap_caps_get_minimum_free_size',
  },

  files: {
    lesson: 'Aulas 4 e 10 · Arquivos',
    tanenbaum: 'cap. 4 — Sistemas de arquivos',
    tanenbaumConfirmed: true,
    what: <>Um <B>sistema de arquivos</B> organiza dados em arquivos e diretórios sobre um dispositivo de armazenamento. Aqui é o <B>LittleFS</B>, gravado numa <B>partição</B> da memória flash de 4 MB do ESP32 — os arquivos <B>persistem</B> mesmo se a placa for desligada.</>,
    how: <>Como o disco de um PC tem MBR ou GPT (Aula 4), a flash do ESP32 tem uma <B>tabela de partições</B> no endereço 0x8000: uma parte guarda o firmware, outra a NVS (configurações) e outra o sistema de arquivos. O boot segue a sequência da Aula 4: o firmware em ROM carrega o <B>bootloader</B> (0x1000), que lê a tabela e carrega o programa (0x10000). <B>Formatar</B> a partição é criar nela um sistema de arquivos vazio — aqui o LittleFS, no lugar de NTFS, FAT32 ou ext4. O LittleFS trabalha em blocos de 4 KB, distribui as escritas para não gastar sempre o mesmo setor e é resistente a quedas de energia. A interface do WebOS também mora aqui, em <C>/www</C> (protegida).</>,
    why: <>É o sistema de arquivos que dá nome, hierarquia, proteção e persistência aos dados, escondendo do programa os detalhes do hardware (setores, apagamento da flash).</>,
    tryIt: [
      <>Crie <C>/notas.txt</C>, escreva algo e salve.</>,
      <>Reinicie a placa (botão EN ou menu Iniciar) e abra o arquivo de novo: ele continua lá.</>,
      <>Veja na tabela de partições onde fica o LittleFS dentro da flash.</>,
    ],
    observe: [
      <>Espaço usado e total da partição.</>,
      <>O tamanho cresce em blocos: um arquivo pequeno ocupa pelo menos um bloco.</>,
      <>Arquivos <C>.gz</C> em <C>/www</C> são a interface comprimida.</>,
    ],
    interpret: <>Se o arquivo sobrevive à reinicialização, ele está na flash (memória não volátil), e não na RAM. O espaço usado aumenta mais que o tamanho do texto por causa dos metadados e da alocação em blocos.</>,
    apis: 'LittleFS.open · File.print · LittleFS.remove · LittleFS.mkdir · esp_partition_find',
  },

  devices: {
    lesson: 'Aula 10 · Entrada e saída',
    tanenbaum: 'cap. 5 — Entrada/saída',
    tanenbaumConfirmed: true,
    what: <>O SO fala com o hardware por meio de <B>drivers</B> e controladores. Há duas formas de saber que algo aconteceu: <B>polling</B> (o programa pergunta ao dispositivo o tempo todo, gastando CPU) e <B>interrupção</B> (o dispositivo avisa a CPU, que para o que está fazendo e roda uma rotina curta — a ISR).</>,
    how: <>O botão BOOT (GPIO 0) gera uma interrupção na borda de descida. A <B>ISR</B> só anota o instante e coloca o evento numa <B>fila</B>. A tarefa <B>driver-botao</B>, que estava <i>bloqueada</i> esperando a fila, acorda, espera o contato assentar e decide se foi um aperto válido. O LED é um dispositivo de <B>saída</B>: escrever no GPIO acende ou apaga.</>,
    why: <>Interrupções permitem reagir rápido sem desperdiçar CPU. Separar ISR curta e tarefa de tratamento (a “metade de cima e metade de baixo” do driver) mantém o sistema responsivo.</>,
    tryIt: [
      <>Ligue e desligue o LED pela página.</>,
      <>Aperte o botão BOOT na placa uma vez e veja os contadores mudarem.</>,
      <>Aperte várias vezes rápido: compare <B>interrupções recebidas</B> e <B>apertos válidos</B>.</>,
    ],
    observe: [
      <>Um aperto costuma gerar várias interrupções: o contato metálico “quica” (repique).</>,
      <>O driver filtra os repiques (debounce de 200 ms).</>,
      <>O estado da tarefa driver-botao: quase sempre bloqueada, sem gastar CPU.</>,
    ],
    interpret: <>Mais interrupções do que apertos válidos mostram o <B>repique mecânico</B> e a necessidade de debounce no driver. Com polling, o programa teria de ler o pino continuamente; com interrupção, a CPU só trabalha quando o evento acontece.</>,
    apis: 'attachInterrupt · xQueueSendFromISR · xQueueReceive · digitalWrite · digitalRead',
  },

  monitor: {
    lesson: 'Aula 2 · SO como gerenciador de recursos',
    tanenbaum: 'cap. 1.1 — O que é um sistema operacional',
    tanenbaumConfirmed: true,
    what: <>O sistema operacional é o software que <B>gerencia os recursos</B> do computador e oferece uma interface entre hardware, aplicações e usuário (Aula 2): tempo de CPU, memória, armazenamento e dispositivos, divididos entre os programas de forma justa e eficiente. Este painel mostra esses recursos ao vivo.</>,
    how: <>Uma tarefa do WebOS amostra o heap e o tempo de CPU de cada tarefa a cada segundo. A <B>carga de cada núcleo</B> é 100% menos o tempo em que a tarefa ociosa (IDLE) daquele núcleo executou.</>,
    why: <>Monitorar recursos é como o SO (e o administrador) detecta vazamentos de memória, sobrecarga e gargalos. Na Aula 3: SO = <B>fornecedor de abstrações</B> + <B>gerenciador de recursos</B>; este app mostra a segunda visão. Repare também na <B>multiprogramação</B> (Aula 2): enquanto uma tarefa espera (bloqueada), a CPU executa outra — por isso dezenas de tarefas cabem em 2 núcleos.</>,
    tryIt: [
      <>Abra o Monitor de Memória e aloque blocos: o gráfico do heap cai aqui também.</>,
      <>Crie tarefas “cpu” e veja a carga do núcleo 0 subir.</>,
      <>Conecte outro celular no Wi-Fi da placa: “aparelhos conectados” aumenta.</>,
    ],
    observe: [<>Heap livre ao longo de 60 s.</>, <>Número de tarefas no FreeRTOS.</>, <>Carga dos dois núcleos e o tempo ligado.</>],
    interpret: <>Um heap que só desce e nunca volta indica vazamento. Núcleo 0 a 100% com o servidor ainda respondendo mostra a divisão de trabalho entre os núcleos.</>,
    apis: 'heap_caps_get_free_size · uxTaskGetNumberOfTasks · WiFi.softAPgetStationNum · esp_timer_get_time',
  },

  deadlock: {
    lesson: 'Aula 8 · Deadlocks',
    tanenbaum: 'cap. 6 — Impasses (deadlocks)',
    tanenbaumConfirmed: true,
    what: <>Um <B>deadlock</B> (impasse) acontece quando cada tarefa de um grupo espera um recurso que outra do grupo segura, e ninguém pode prosseguir. Aqui: <B>A</B> pega M1 e quer M2; <B>B</B> pega M2 e quer M1.</>,
    how: <>São necessárias, ao mesmo tempo, as quatro <B>condições de Coffman</B>: exclusão mútua, posse e espera, ausência de preempção e espera circular. O WebOS monta o <B>grafo de espera</B> (quem espera qual mutex e quem o segura); um ciclo A → B → A é deadlock. Para <B>recuperar</B>, escolhe uma vítima (B), que devolve seu mutex. Para <B>prevenir</B>, todas pegam os mutex na mesma ordem (M1 antes de M2), quebrando a espera circular.</>,
    why: <>Deadlocks travam sistemas sem consumir CPU — o programa simplesmente para. Há quatro estratégias: <B>prevenção</B> (impedir uma das condições, ex.: ordem global de travas), <B>evitação</B> (só conceder recursos em estado seguro, ex.: algoritmo do banqueiro), <B>detecção e recuperação</B> (grafo de alocação + ação corretiva) e <B>ignorar</B> (comum em SOs de uso geral, quando impasses são raros). Este app demonstra prevenção e detecção/recuperação.</>,
    tryIt: [
      <>Clique em <B>Provocar deadlock</B>: em menos de 1 s as duas tarefas ficam presas.</>,
      <>Veja o ciclo vermelho no grafo e o aviso de detecção.</>,
      <>Recupere manualmente ou espere o watchdog do experimento (8 s).</>,
      <>Rode o modo <B>Prevenção</B>: muitas rodadas e nenhum deadlock.</>,
    ],
    observe: [<>Quem segura cada mutex (dado real de <C>xSemaphoreGetMutexHolder</C>).</>, <>Fase de cada tarefa e o tempo de ciclo.</>, <>As condições de Coffman presentes.</>],
    interpret: <>Se o ciclo persiste, as tarefas estão em <B>espera circular</B> — deadlock real. Na prevenção a ordem global elimina a quarta condição, então o ciclo nunca se forma. O resto do WebOS continua respondendo: o impasse prende só as duas tarefas do experimento.</>,
    apis: 'xSemaphoreTake · xSemaphoreGive · xSemaphoreGetMutexHolder · tarefa vigia (watchdog)',
  },

  schedsim: {
    lesson: 'Aula 7 · Algoritmos de escalonamento',
    tanenbaum: 'cap. 2.4 — Escalonamento',
    tanenbaumConfirmed: true,
    what: <>Algoritmos de escalonamento decidem a <B>ordem</B> em que os processos usam a CPU. Esta é uma <B>simulação no navegador</B> para comparar três algoritmos clássicos de sistemas em lote e interativos.</>,
    how: <><B>FCFS</B>: o primeiro a chegar é o primeiro servido. <B>SJF</B>: entre os que chegaram, o de menor duração vai primeiro (não preemptivo). <B>Round-Robin</B>: cada processo roda no máximo um quantum e volta ao fim da fila.</>,
    why: <>Cada política troca tempo médio de espera, tempo de resposta e justiça. SJF minimiza a espera média quando as durações são conhecidas; RR dá respostas rápidas a todos; FCFS é simples, mas sofre o “efeito comboio”.</>,
    tryIt: [<>Use o conjunto “comboio”: um processo longo chegando primeiro.</>, <>Compare a espera média de FCFS e SJF.</>, <>Varie o quantum do RR (1, 2, 4) e veja o Gantt mudar.</>],
    observe: [<>Tempo de espera = retorno − duração.</>, <>Tempo de retorno = término − chegada.</>, <>Trocas de contexto no RR.</>],
    interpret: <>A menor espera média geralmente é do SJF. Um quantum muito pequeno no RR aumenta as trocas de contexto; muito grande faz o RR se comportar como FCFS.</>,
  },

  pagingsim: {
    lesson: 'Aula 9 · Memória virtual',
    tanenbaum: 'cap. 3.4 — Algoritmos de substituição de páginas',
    tanenbaumConfirmed: true,
    what: <>Com <B>memória virtual</B>, um processo vê um espaço de endereços dividido em <B>páginas</B>, e só parte delas fica na RAM (em <B>quadros</B>). Quem traduz endereço virtual em físico é a <B>MMU</B>, usando a tabela de páginas. Acessar uma página ausente (bit presente = 0) gera uma <B>falta de página</B> (<i>page fault</i>): o SO busca a página no disco (área de troca) e reexecuta a instrução. Esta é uma <B>simulação no navegador</B> — o ESP32 não pagina os programas.</>,
    how: <>Quando a RAM está cheia, o SO escolhe uma página para sair. <B>FIFO</B>: a mais antiga. <B>LRU</B>: a usada há mais tempo. <B>Ótimo</B>: a que será usada mais tarde no futuro (impossível na prática, serve de referência).</>,
    why: <>Cada falta custa um acesso ao disco, milhares de vezes mais lento que a RAM. O algoritmo de substituição decide o desempenho de todo o sistema.</>,
    tryIt: [<>Carregue o <B>Exemplo da Aula 9</B> (7 0 1 2 0 3 0 4 2 3 0 3, 3 quadros): FIFO dá 10 faltas e LRU 9, como no slide.</>, <>Carregue a sequência de Belady e compare FIFO com 3 e 4 quadros.</>, <>Aumente os quadros e veja as faltas diminuírem (em LRU e Ótimo).</>],
    observe: [<>Células vermelhas = faltas; verdes = acertos.</>, <>Taxa de faltas de cada algoritmo.</>],
    interpret: <>O Ótimo dá o mínimo possível de faltas; LRU costuma ficar próximo; FIFO pode até piorar com mais quadros — a <B>anomalia de Belady</B>.</>,
  },

  terminal: {
    lesson: 'Aula 3 · Shell',
    tanenbaum: 'cap. 1.6 — Chamadas de sistema',
    tanenbaumConfirmed: true,
    what: <>O <B>shell</B> é o interpretador de comandos: lê o que o usuário digita e pede ao sistema operacional para executar. Os pedidos ao núcleo são as <B>chamadas de sistema</B> (Aula 3): num PC, um <C>open()</C> sai do <B>modo usuário</B>, entra no <B>modo kernel</B>, o núcleo acessa o hardware e devolve o resultado.</>,
    how: <>O navegador envia só o texto do comando. O firmware o interpreta e chama as funções do FreeRTOS/ESP-IDF correspondentes: <C>ps</C> → <C>uxTaskGetSystemState</C>, <C>kill</C> → <C>vTaskDelete</C>, <C>mem</C> → <C>heap_caps_*</C>, <C>ls</C>/<C>cat</C> → LittleFS.</>,
    why: <>O shell separa a interface com o usuário do núcleo: o mesmo SO pode ter vários shells. Os comandos lembram os do CMD vistos na Aula 2: <C>ps</C> ≈ <C>tasklist</C>, <C>kill</C> ≈ <C>taskkill</C>, <C>ls</C> ≈ <C>dir</C>. Uma diferença honesta: o ESP32 não separa modo usuário e modo kernel — todas as tarefas do FreeRTOS rodam com o mesmo privilégio. Aqui a fronteira é a API HTTP, que valida cada pedido; por isso <C>kill</C> recusa tarefas do sistema.</>,
    tryIt: [<>Digite <C>help</C>.</>, <><C>ps</C> e depois <C>kill &lt;pid&gt;</C> numa tarefa criada no Gerenciador.</>, <><C>ls</C>, <C>cat /leia-me.txt</C>, <C>mem</C>, <C>led on</C>.</>],
    observe: [<>A saída vem da placa (não é gerada no navegador).</>, <>Comandos inválidos retornam código de saída diferente de 0.</>],
    interpret: <>Se <C>kill</C> numa tarefa do sistema é recusado, isso mostra a <B>proteção</B> do SO: o shell pede, mas o núcleo decide o que é permitido.</>,
    apis: 'POST /api/terminal/execute → interpretador no firmware',
  },

  about: {
    lesson: 'Aula 3 · Estrutura do SO',
    tanenbaum: 'cap. 1.7 — Estrutura de sistemas operacionais · cap. 9 — Segurança',
    tanenbaumConfirmed: true,
    what: <>Todo SO é organizado em <B>camadas</B>: cada uma usa os serviços da camada de baixo e oferece serviços à de cima. O <B>núcleo</B> (kernel) fica entre o hardware e os programas.</>,
    how: <>No WebOS: o navegador (apps) chama a <B>API HTTP</B> — o equivalente às chamadas de sistema — que usa os <B>serviços</B> (Wi-Fi, LittleFS, driver do botão), apoiados no <B>núcleo FreeRTOS</B> (escalonador, filas, mutex, heap), que roda no <B>hardware</B> ESP32. O FreeRTOS é um SO de <B>tempo real</B> e <B>embarcado</B> — aparece na Aula 5 como exemplo de RTOS. Em tempo real o que importa é a <B>previsibilidade</B>: responder antes do prazo (<i>deadline</i>), e não apenas “ser rápido”.</>,
    why: <>Camadas isolam responsabilidades: dá para trocar a interface sem mexer no núcleo. Das estruturas da Aula 3 (monolítica, camadas, microkernel, cliente-servidor, máquinas virtuais), o FreeRTOS tem um núcleo pequeno — só tarefas, escalonador, filas, mutex e heap; Wi-Fi, sistema de arquivos e drivers rodam como tarefas comuns. Lembra o microkernel, mas sem a separação de modo usuário. E o WebOS em si é <B>cliente-servidor</B>: o navegador pede, a placa atende. O login ilustra <B>autenticação</B>: a senha é guardada como hash SHA-256 com sal, nunca em texto.</>,
    tryIt: [<>Veja os dados reais do processador e da flash.</>, <>Ative “exigir login” e reinicie a página.</>, <>Edite os dados do grupo (ficam salvos no LittleFS).</>],
    observe: [<>Versões do FreeRTOS e do ESP-IDF.</>, <>Qual app demonstra cada conceito.</>],
    interpret: <>Limitação didática assumida: o tráfego é HTTP sem criptografia e a API não exige o token — o login protege a área de trabalho, não as rotas da placa. Num sistema real, usaríamos HTTPS e verificaríamos o token em cada chamada.</>,
    apis: 'GET /api/system/info · POST /api/auth/login · SHA-256 (mbedTLS) · NVS',
  },
}

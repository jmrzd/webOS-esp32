# Checklist de validação na placa real

Execute antes da apresentação. Marque cada item e anote o que mudar. Monitor serial: `scripts\monitor.bat COMx`.

## A. Ambiente e gravação

- [ ] Opção rápida: `scripts\flash-prebuilt.bat` grava os binários prontos (pule para o item B se usar esta).
- [ ] `scripts\setup.bat` termina sem erro (arduino-cli e core esp32 3.x instalados).
- [ ] `scripts\build.bat` compila o firmware **sem erros** e informa o uso de flash e RAM (referência com o core 3.3.10: 1.076.044 bytes / 56.840 bytes).
- [ ] A linha “particao de dados: inicio 0x290000, tamanho 0x160000” (ou os valores do seu esquema) aparece.
- [ ] `scripts\flash.bat` detecta a porta COM correta e grava firmware + LittleFS.
- [ ] No monitor serial aparecem: `WebOS ESP32 v1.0.0`, `trace=1 runtime=1`, `LittleFS montado`, `AP WebOS-ESP32-XXXX ativo`.
  - Se aparecer `trace=0` ou `runtime=0`, a listagem/CPU funciona no modo reduzido (avisado na tela). Anote.

## B. Conexão e boot

- [ ] A rede `WebOS-ESP32-XXXX` aparece; conecta com `webos1234`.
- [ ] `http://192.168.4.1` abre no PC e no celular (dados móveis desligados).
- [ ] Boot mostra as 3 etapas; a etapa “Hardware” exibe o modelo real do chip (ex.: ESP32-D0WD-V3), 2 × 240 MHz, 4 MB.
- [ ] Com a placa desligada no meio do uso, aparece “ESP32 fora de alcance”; ao religar, reconecta sozinho.
- [ ] Desconectada do PC e alimentada por um carregador USB, a placa continua funcionando.

## C. Apps obrigatórios

**Gerenciador de Tarefas**
- [ ] Lista loopTask, webos-monitor, driver-botao, IDLE0/IDLE1, tarefas do Wi-Fi etc., com pilha livre em bytes.
- [ ] Criar `contador` → aparece “bloqueada”, ritmo ≈ 10/s.
- [ ] Criar `cpu` prio 1 e outra `cpu` prio 3 → a de prio 1 fica com ritmo 0 (inanição); suspender a de prio 3 → a outra volta.
- [ ] Mudar prioridade, suspender, retomar e finalizar funcionam; tarefas do sistema mostram “protegido”.
- [ ] Com 2 tarefas `cpu` de mesma prioridade, cada uma mostra ≈ 50% de CPU.

**Escalonador ao vivo**
- [ ] Cenário 1: ≈ 33% cada. Cenário 2: “alta” ≈ 95–100%, as outras 0% e “pronta”. Cenário 3: 50/50 e “baixa” 0%.
- [ ] Suspender “alta” no cenário 2 → “media” assume. Aging ligado → quem passa fome sobe de prioridade.
- [ ] A interface continua respondendo durante os testes (servidor no núcleo 1).
- [ ] “Encerrar testes” remove as tarefas; não há reinício da placa por watchdog (monitor serial limpo).

**Laboratório de Concorrência**
- [ ] SEM mutex, 100.000: obtido < 200.000 (anote perdidos: ______). Repetir dá valores diferentes.
- [ ] COM mutex, 100.000: obtido = 200.000, tempo maior (anote: ______ ms).
- [ ] 1.000.000 com mutex termina (ou é abortado em 30 s) sem travar a página.
- [ ] Histórico e “Limpar” funcionam.

**Monitor de Memória**
- [ ] Alocar 8 KB reduz o heap livre ≈ 8 KB; o bloco mostra endereço 0x3FF…/0x3FFB….
- [ ] “Provocar fragmentação”: maior bloco contíguo fica bem menor que o livre; a interpretação aparece.
- [ ] Alocar até perto do limite → recusa “deixaria menos de 40 KB”. A placa não reinicia.
- [ ] Liberar um, alternados e todos funcionam; o gráfico de 60 s acompanha.

**Explorador de Arquivos**
- [ ] Lista `leia-me.txt`, `grupo.json` e `www` (com cadeado).
- [ ] Criar `/teste.txt`, escrever, salvar (Ctrl+S); criar pasta; apagar.
- [ ] **Persistência:** salvar, reiniciar a placa (botão EN), abrir de novo → conteúdo mantido.
- [ ] Espaço usado/total e tabela de partições (nvs, otadata, app0, app1, spiffs, coredump) aparecem.
- [ ] Tentar apagar algo em `/www` → recusado.

**Gerenciador de Dispositivos**
- [ ] LED liga/desliga pela página (se a placa não tiver LED no GPIO 2, trocar o pino em “Pino do LED” e conferir com um LED + resistor de 220–330 Ω).
- [ ] Apertar BOOT 1 vez → “Interrupções recebidas” aumenta, “Apertos válidos” +1.
- [ ] Apertos rápidos → repiques filtrados aparecem; o driver-botao aparece “bloqueada” em repouso.
- [ ] “Zerar” zera os contadores.

## D. Bônus

- [ ] Monitor do Sistema: gráfico do heap, tarefas, aparelhos conectados (conectar um 2º celular → 2), carga dos núcleos.
- [ ] Deadlock: “Provocar” → ciclo vermelho em < 2 s, detecção; recuperação em 8 s (ou manual); a página continua respondendo.
- [ ] Deadlock “Prevenção”: termina com 25 + 25 rodadas, sem ciclo.
- [ ] Simuladores: identificados como SIMULAÇÃO; Gantt e tabelas corretos (conferir um caso à mão).
- [ ] Terminal: `help`, `ps`, `kill <pid de tarefa criada>`, `kill 1` (recusado), `mem`, `ls`, `cat /leia-me.txt`, `df`, `led on`.
- [ ] Sobre: dados reais do chip; editar grupo e salvar; ativar login, recarregar a página → tela de login; senha errada é recusada.

## E. Estabilidade

- [ ] 3 aparelhos com várias janelas abertas por 10 min: sem reinícios (contador “ligado há” não zera).
- [ ] Monitor serial sem `Guru Meditation`, `task_wdt` ou `Stack canary`.
- [ ] “Menor heap desde o boot” não cai abaixo de ~40 KB no uso normal.

## Registro

| Data | Placa / chip | Core esp32 | Resultado | Observações |
|---|---|---|---|---|
| | | | | |

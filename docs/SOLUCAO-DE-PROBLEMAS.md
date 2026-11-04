# Solução de problemas

## Porta COM e gravação

| Sintoma | Causa provável | Solução |
|---|---|---|
| `flash.bat` diz “Nenhuma porta COM encontrada” | Driver ausente ou cabo que só carrega | Veja o chip ao lado do USB: **CP2102/CP2104** → driver Silicon Labs CP210x (silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers); **CH340/CH9102** → CH341SER.EXE (wch-ic.com/downloads/CH341SER_EXE.html). Troque o cabo. Confira em *Gerenciador de Dispositivos › Portas (COM e LPT)*. |
| Várias portas listadas | Arduino Uno ou outro dispositivo conectado | Escolha a que tem CP210x/CH340 no nome, ou rode `scripts\flash.bat COM5`. |
| Parado em `Connecting...` | A placa não entrou no modo de gravação | Segure o botão **BOOT**, aperte e solte **EN**, solte BOOT quando começar a gravar. |
| `Write timeout` / `serial exception` / `could not open port` | Porta ocupada ou velocidade alta | Feche o Monitor Serial da IDE e outros programas; `set UPLOAD_BAUD=115200` e grave de novo. |
| `setup.bat` não baixa o arduino-cli | Sem internet ou proxy | Instale manualmente (arduino.github.io/arduino-cli) e coloque no PATH, ou copie `arduino-cli.exe` para `tools\arduino-cli\`. |
| `mklittlefs.exe` ou `esptool.exe` não encontrado | Core esp32 não instalado ou em outra pasta | Rode `scripts\setup.bat`. O script procura em `arduino-cli config get directories.data` (normalmente `%LOCALAPPDATA%\Arduino15`). |
| Erro de compilação em função do FreeRTOS/ESP-IDF | Core diferente do usado no desenvolvimento | Use o core 3.3.10: `set ESP32_CORE_VERSION=3.3.10` e rode `setup.bat`, ou ajuste a função indicada no erro. |
| `data\www esta vazio e o Node.js nao foi encontrado` | Pacote incompleto | Instale o Node.js LTS (nodejs.org) e rode `build.bat`, ou use o `.zip` completo. |

## Wi-Fi e página

| Sintoma | Solução |
|---|---|
| A rede `WebOS-ESP32-XXXX` não aparece | Veja o monitor serial (`scripts\monitor.bat COMx`): procure `AP … ativo`. Alimente com uma fonte de pelo menos 500 mA. |
| A rede aparece, mas a página não abre | Digite `http://192.168.4.1` (http, não https). No celular, desligue os dados móveis e aceite “rede sem internet”. |
| Aparece “firmware ativo, mas a interface não foi encontrada” | O LittleFS não foi gravado: rode `scripts\build.bat` e `scripts\flash.bat`. |
| Página fica em “Detectando o hardware” | A API não respondeu: confirme a rede; aguarde a nova tentativa automática; veja o monitor serial. |
| Muitos “Sem dados novos da placa” | Muitos aparelhos ou abas: feche janelas que não está usando (apps minimizados param de consultar a placa). |

## Funcionamento

| Sintoma | Solução |
|---|---|
| Coluna CPU com “—” | O core foi compilado sem estatística de tempo de execução (`runtime=0` no serial). O escalonador usa a proporção de voltas, avisado na tela. |
| Só aparecem as minhas tarefas no Gerenciador | Core sem `configUSE_TRACE_FACILITY` (`trace=0` no serial). Comportamento esperado, com aviso. |
| LED não acende | Sua placa usa outro pino ou não tem LED: em **Dispositivos › Pino do LED** escolha o GPIO e o nível ativo; ou ligue um LED com resistor de 220–330 Ω entre o GPIO e o GND. |
| A placa reinicia sozinha | Veja a mensagem no serial (115200). `task_wdt`: anote o que estava rodando; `Stack canary`: aumente a pilha da tarefa indicada em `config.h`/código; heap baixo: libere blocos no Monitor de Memória. |
| Arquivos criados sumiram depois de gravar | A gravação do LittleFS substitui o conteúdo pela pasta `firmware/WebOS_ESP32/data`. Para atualizar só o firmware, grave apenas o firmware (`arduino-cli upload` ou IDE). |
| Esqueci a senha do login | Grave o firmware novamente com a NVS apagada: `esptool --chip esp32 --port COMx erase_region 0x9000 0x5000` (apaga só a partição NVS — também volta o pino do LED ao padrão). |

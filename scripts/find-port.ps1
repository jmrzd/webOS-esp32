# Lista as portas COM no formato  COMx|prioridade|descricao
# prioridade 0 = parece um conversor USB-serial de ESP32 (CP210x, CH340/CH9102, FTDI, USB JTAG)
$ErrorActionPreference = 'SilentlyContinue'
$items = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\((COM\d+)\)' }
$rows = foreach ($p in $items) {
  if ($p.Name -match '\((COM\d+)\)') {
    $com = $Matches[1]
    $pref = 1
    if ($p.Name -match 'CP210|CH34|CH910|USB-SERIAL|USB Serial|Silicon Labs|FTDI|USB JTAG|UART') { $pref = 0 }
    [pscustomobject]@{ Com = $com; Pref = $pref; Name = ($p.Name -replace '\|', '/') }
  }
}
$rows | Sort-Object Pref, { [int]($_.Com -replace 'COM', '') } | ForEach-Object { "$($_.Com)|$($_.Pref)|$($_.Name)" }

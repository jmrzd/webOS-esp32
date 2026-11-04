# Le firmware\build\partitions.csv (copiado pelo core durante a compilacao) e
# imprime "OFFSET SIZE" em hexadecimal da particao de dados "spiffs" (usada pelo LittleFS).
param([string]$Csv)
function ToNum([string]$s) {
  $s = $s.Trim()
  if ($s -match '^0x') { return [Convert]::ToInt64($s.Substring(2), 16) }
  if ($s -match '^(\d+)K$') { return [int64]$Matches[1] * 1024 }
  if ($s -match '^(\d+)M$') { return [int64]$Matches[1] * 1024 * 1024 }
  return [int64]$s
}
if (-not (Test-Path $Csv)) { exit 1 }
$line = Get-Content $Csv | Where-Object { $_ -match '^\s*spiffs\s*,' } | Select-Object -First 1
if (-not $line) { exit 2 }
$f = $line -split ','
'0x{0:X} 0x{1:X}' -f (ToNum $f[3]), (ToNum $f[4])

# Empacota o Onde Caçar para as lojas.
#   .\build.ps1              usa a versão do manifest.json
#   .\build.ps1 -Versao 2.1.0  muda a versão antes de empacotar
# Gera em .\dist:
#   onde-cacar-<versão>-chrome-edge-opera.zip  (Chrome Web Store, Edge Add-ons, Opera Add-ons)
#   onde-cacar-<versão>-firefox.zip            (addons.mozilla.org)
param([string]$Versao)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$IdFirefox = 'onde-cacar@ajudante-pokeidle'   # depois de publicar no Firefox, NUNCA mude este ID
$semBom = New-Object System.Text.UTF8Encoding $false

$manifest = Get-Content manifest.json -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Versao) {
  $manifest.version = $Versao
  [IO.File]::WriteAllText("$PSScriptRoot\manifest.json", ($manifest | ConvertTo-Json -Depth 20), $semBom)
}
$v = $manifest.version
New-Item -ItemType Directory -Force dist | Out-Null

function Empacotar($destino, $manifestObj) {
  if (Test-Path $destino) { Remove-Item $destino }
  $zip = [IO.Compression.ZipFile]::Open($destino, 'Create')
  try {
    # o manifest de cada loja
    $e = $zip.CreateEntry('manifest.json')
    $w = New-Object IO.StreamWriter($e.Open(), $semBom)
    $w.Write(($manifestObj | ConvertTo-Json -Depth 20)); $w.Close()
    # o resto, com caminhos usando "/" (a loja do Firefox recusa "\")
    foreach ($pasta in 'src', 'icons') {
      Get-ChildItem $pasta -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($PSScriptRoot.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null
      }
    }
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$PSScriptRoot\LICENSE", 'LICENSE') | Out-Null
  } finally { $zip.Dispose() }
  Write-Host "  $destino"
}

# Chrome, Edge e Opera: o manifest como está, sem a parte do Firefox
$chrome = $manifest | ConvertTo-Json -Depth 20 | ConvertFrom-Json
if ($chrome.PSObject.Properties['browser_specific_settings']) { $chrome.PSObject.Properties.Remove('browser_specific_settings') }
# Firefox: ID fixo, versão mínima (world MAIN) e a declaração de que não coleta dados
$firefox = $manifest | ConvertTo-Json -Depth 20 | ConvertFrom-Json
$firefox | Add-Member -Force -NotePropertyName browser_specific_settings -NotePropertyValue ([ordered]@{
  gecko = [ordered]@{ id = $IdFirefox; strict_min_version = '128.0'; data_collection_permissions = @{ required = @('none') } }
})

Write-Host "Onde Caçar $v"
Empacotar "dist\onde-cacar-$v-chrome-edge-opera.zip" $chrome
Empacotar "dist\onde-cacar-$v-firefox.zip" $firefox
Write-Host 'Pronto.'

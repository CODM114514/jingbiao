$ErrorActionPreference = 'Stop'

$bundledNode = 'C:\Users\26338\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'

if (Test-Path $bundledNode) {
  $node = $bundledNode
} else {
  $node = 'node'
}

if (-not $env:PORT) {
  $env:PORT = '3000'
}

if (-not $env:HOST) {
  $env:HOST = '0.0.0.0'
}

if (-not $env:ADMIN_PASSWORD) {
  $env:ADMIN_PASSWORD = 'admin123'
}

& $node server.mjs

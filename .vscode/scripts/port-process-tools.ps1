$script:CurrentSessionId = (Get-Process -Id $PID).SessionId
$script:DevProcessNames = @(
  "bun",
  "bunx",
  "node",
  "npm",
  "pnpm",
  "yarn",
  "vite",
  "next",
  "turbo",
  "tsx"
)
$script:DevToolPattern = '(?i)\b(bun|bunx|node|npm|pnpm|yarn|vite|next|turbo|tsx)\b'
$script:ExcludeCommandLinePatterns = @(
  '(?i)opencode',
  '(?i)\\.agents',
  '(?i)mcp-server',
  '(?i)copilot',
  '(?i)cursor',
  '(?i)code-helper',
  '(?i)extensionHost',
  '(?i)vscode'
)

function Get-ListeningPortEntries {
  param(
    [int[]]$FilterPorts
  )

  $entries = foreach ($line in (netstat -ano)) {
    if ($line -match '^\s*TCP\s+(?<address>.+):(?<port>\d+)\s+\S+\s+(?<state>\S+)\s+(?<pid>\d+)\s*$') {
      if ($Matches.state -cne "LISTENING") {
        continue
      }

      $port = [int]$Matches.port

      if ($FilterPorts.Count -gt 0 -and $FilterPorts -notcontains $port) {
        continue
      }

      if ([int]$Matches.pid -gt 0) {
        [PSCustomObject]@{
          Protocol = "TCP"
          Address = $Matches.address.Trim()
          Port = $port
          ProcessId = [int]$Matches.pid
        }
      }

      continue
    }

    if ($line -match '^\s*UDP\s+(?<address>.+):(?<port>\d+)\s+\S+\s+(?<pid>\d+)\s*$') {
      $port = [int]$Matches.port

      if ($FilterPorts.Count -gt 0 -and $FilterPorts -notcontains $port) {
        continue
      }

      if ([int]$Matches.pid -gt 0) {
        [PSCustomObject]@{
          Protocol = "UDP"
          Address = $Matches.address.Trim()
          Port = $port
          ProcessId = [int]$Matches.pid
        }
      }
    }
  }

  return @(
    $entries |
      Sort-Object Protocol, Port, ProcessId -Unique
  )
}

function Get-ProcessSnapshot {
  param(
    [Parameter(Mandatory = $true)]
    [int]$ProcessId
  )

  $processName = "<already exited>"
  $sessionId = $null
  $commandLine = ""

  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    $processName = $process.ProcessName
    $sessionId = $process.SessionId
  } catch {
  }

  try {
    $cimProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop

    if (-not $commandLine) {
      $commandLine = [string]$cimProcess.CommandLine
    }

    if ($processName -eq "<already exited>" -and $cimProcess.Name) {
      $processName = [System.IO.Path]::GetFileNameWithoutExtension([string]$cimProcess.Name)
    }
  } catch {
  }

  $normalizedProcessName = $processName.ToLowerInvariant()
  $isKnownDevProcessName = $normalizedProcessName -in $script:DevProcessNames
  $hasDevCommandLine = $commandLine -match $script:DevToolPattern
  $isCurrentSession = $null -ne $sessionId -and $sessionId -eq $script:CurrentSessionId
  $isExcludedProcess = $false
  $excludedBy = ""

  foreach ($pattern in $script:ExcludeCommandLinePatterns) {
    if ($commandLine -match $pattern) {
      $isExcludedProcess = $true
      $excludedBy = $pattern
      break
    }
  }

  $isTargetDevProcess = (-not $isExcludedProcess) -and $isCurrentSession -and ($isKnownDevProcessName -or $hasDevCommandLine)

  $skipReason = ""

  if ($processName -eq "<already exited>") {
    $skipReason = "already exited"
  } elseif ($isExcludedProcess) {
    $skipReason = "excluded ($excludedBy)"
  } elseif (-not $isCurrentSession) {
    $skipReason = "different session"
  } elseif (-not ($isKnownDevProcessName -or $hasDevCommandLine)) {
    $skipReason = "not a bun/node/vite dev process"
  }

  $matchSource = ""

  if ($isTargetDevProcess) {
    if ($isKnownDevProcessName -and $hasDevCommandLine) {
      $matchSource = "name+cmd"
    } elseif ($isKnownDevProcessName) {
      $matchSource = "name"
    } else {
      $matchSource = "cmd"
    }
  }

  return [PSCustomObject]@{
    Id = $ProcessId
    ProcessName = $processName
    SessionId = $sessionId
    CommandLine = $commandLine
    IsTargetDevProcess = $isTargetDevProcess
    MatchSource = $matchSource
    SkipReason = $skipReason
  }
}

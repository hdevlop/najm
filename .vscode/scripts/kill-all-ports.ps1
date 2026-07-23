param(
  [ValidateRange(1, 65535)]
  [int[]]$Ports,

  [switch]$Force
)

. "$PSScriptRoot\port-process-tools.ps1"

$filterPorts = @($Ports | Sort-Object -Unique)
$portEntries = @(Get-ListeningPortEntries -FilterPorts $filterPorts)

if ($portEntries.Count -eq 0) {
  if ($filterPorts.Count -gt 0) {
    Write-Host "No listening process found on the requested port(s): $($filterPorts -join ', ')."
  } else {
    Write-Host "No listening TCP or UDP ports were found."
  }

  exit 0
}

$processEntries = @(
  $portEntries |
    Group-Object ProcessId |
    ForEach-Object {
      $processSnapshot = Get-ProcessSnapshot -ProcessId ([int]$_.Name)

      [PSCustomObject]@{
        Id = $processSnapshot.Id
        ProcessName = $processSnapshot.ProcessName
        SessionId = $processSnapshot.SessionId
        MatchSource = $processSnapshot.MatchSource
        SkipReason = $processSnapshot.SkipReason
        IsTargetDevProcess = $processSnapshot.IsTargetDevProcess
        Ports = ($_.Group |
          Sort-Object Protocol, Port |
          ForEach-Object { "$($_.Protocol):$($_.Port)" }) -join ", "
      }
    } |
    Sort-Object Id
)

$targetProcessEntries = @(
  $processEntries |
    Where-Object { $_.IsTargetDevProcess }
)

$skippedProcessEntries = @(
  $processEntries |
    Where-Object { -not $_.IsTargetDevProcess }
)

$targetProcessIds = @(
  $targetProcessEntries |
    Select-Object -ExpandProperty Id
)

Write-Host "Matching dev-tool listening ports:"
(
  $portEntries |
    Where-Object { $targetProcessIds -contains $_.ProcessId } |
    Format-Table -Property Protocol, Port, Address, ProcessId -AutoSize |
    Out-String
).TrimEnd() | Write-Host

Write-Host ""
Write-Host "Target processes:"
($targetProcessEntries | Format-Table -Property Id, ProcessName, SessionId, MatchSource, Ports -AutoSize | Out-String).TrimEnd() | Write-Host

if ($skippedProcessEntries.Count -gt 0) {
  Write-Host ""
  Write-Host "Skipped non-dev or out-of-session processes:"
  ($skippedProcessEntries | Format-Table -Property Id, ProcessName, SessionId, SkipReason, Ports -AutoSize | Out-String).TrimEnd() | Write-Host
}

if ($targetProcessIds.Count -eq 0) {
  Write-Warning "No bun/node/vite-style dev process was found on listening ports in this VS Code session."
  exit 0
}

if (-not $Force) {
  Write-Warning "This only stops matching dev-tool processes in your current session."
  $confirmation = Read-Host "Type KILL DEV PORTS to continue"

  if ($confirmation -cne "KILL DEV PORTS") {
    Write-Host "Cancelled."
    exit 0
  }
}

$failedProcessIds = @()

foreach ($processId in $targetProcessIds) {
  try {
    Stop-Process -Id $processId -Force -ErrorAction Stop
    Write-Host "Stopped PID $processId." -ForegroundColor Green
  } catch {
    Write-Warning "Could not stop PID ${processId}: $($_.Exception.Message)"
    $failedProcessIds += $processId
  }
}

$remainingEntries = @(Get-ListeningPortEntries -FilterPorts $filterPorts)
$remainingTargetEntries = @(
  $remainingEntries |
    Where-Object { $targetProcessIds -contains $_.ProcessId }
)

if ($remainingTargetEntries.Count -gt 0) {
  Write-Warning "Some processes are still holding ports:"
  ($remainingTargetEntries | Format-Table -Property Protocol, Port, Address, ProcessId -AutoSize | Out-String).TrimEnd() | Write-Host
  exit 1
}

if ($failedProcessIds.Count -gt 0) {
  exit 1
}

Write-Host "All matching dev-tool port owners were stopped." -ForegroundColor Green

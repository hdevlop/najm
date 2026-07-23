param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 65535)]
  [int]$Port
)

. "$PSScriptRoot\port-process-tools.ps1"

$portEntries = @(
  Get-ListeningPortEntries -FilterPorts @($Port)
)

if ($portEntries.Count -eq 0) {
  Write-Host "No process is using port $Port."
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
      }
    } |
    Sort-Object Id
)

$targetProcessIds = @(
  $processEntries |
    Where-Object { $_.IsTargetDevProcess } |
    Select-Object -ExpandProperty Id
)

$skippedProcessEntries = @(
  $processEntries |
    Where-Object { -not $_.IsTargetDevProcess }
)

if ($targetProcessIds.Count -eq 0) {
  Write-Warning "Port $Port is in use, but not by a bun/node/vite-style dev process in this VS Code session."

  if ($skippedProcessEntries.Count -gt 0) {
    ($skippedProcessEntries | Format-Table -Property Id, ProcessName, SessionId, SkipReason -AutoSize | Out-String).TrimEnd() | Write-Host
  }

  exit 0
}

Write-Host "Stopping dev process(es) using port $Port..."
($processEntries | Format-Table -Property Id, ProcessName, SessionId, MatchSource -AutoSize | Out-String).TrimEnd() | Write-Host

if ($skippedProcessEntries.Count -gt 0) {
  Write-Host ""
  Write-Host "Skipped non-dev or out-of-session processes:"
  ($skippedProcessEntries | Format-Table -Property Id, ProcessName, SessionId, SkipReason -AutoSize | Out-String).TrimEnd() | Write-Host
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

$remainingProcessIds = @(
  Get-ListeningPortEntries -FilterPorts @($Port) |
    Where-Object { $targetProcessIds -contains $_.ProcessId } |
    Select-Object -ExpandProperty ProcessId -Unique
)

if ($remainingProcessIds.Count -gt 0) {
  Write-Warning "Port $Port is still in use by PID(s): $($remainingProcessIds -join ', ')"
  exit 1
}

if ($failedProcessIds.Count -gt 0) {
  exit 1
}

Write-Host "Port $Port is now free." -ForegroundColor Green

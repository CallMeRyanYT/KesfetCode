# Speaks text with the offline Windows (OneCore) voices and writes WAV files.
# Input: a JSON file listing { text, voice, lang, out } jobs. Used by scripts/voices.mjs.
param([Parameter(Mandatory = $true)][string]$Jobs)
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($operation, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation))
  $task.Wait(-1) | Out-Null
  $task.Result
}
[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.SpeechSynthesis.SpeechSynthesisStream, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime] | Out-Null

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
foreach ($job in (Get-Content -Raw -Encoding UTF8 $Jobs | ConvertFrom-Json)) {
  $voice = $voices | Where-Object { $_.DisplayName -like "*$($job.voice)*" } | Select-Object -First 1
  if (-not $voice) { throw "Voice '$($job.voice)' is not installed." }
  $synth.Voice = $voice
  $text = [System.Security.SecurityElement]::Escape($job.text)
  $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='$($job.lang)'><prosody rate='$($job.rate)'>$text</prosody></speak>"
  $stream = Await ($synth.SynthesizeSsmlToStreamAsync($ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $input = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
  $file = [System.IO.File]::Create($job.out)
  $input.CopyTo($file)
  $file.Close(); $input.Close(); $stream.Dispose()
}

# 1. Get a clean list of just the main filenames (ignoring heavy system paths)
Write-Host "Scanning your website files..." -ForegroundColor Cyan
$files = Get-ChildItem -File | Where-Object {
    $_.Extension -in '.html', '.js', '.css', '.md'
}

$fileList = ($files | Select-Object -ExpandProperty Name) -join ", "

# 2. Ask you what to do
Write-Host ""
$userQuestion = Read-Host "What do you want Gemma to do with this repo?"
if ([string]::IsNullOrWhiteSpace($userQuestion)) {
    Write-Host "No question asked. Exiting." -ForegroundColor Red
    exit
}

# 3. Simplify the prompt layout so the model doesn't get overwhelmed
$prompt = "You are a web development assistant. Here is a list of files in my website project folder: $fileList. My request is: $userQuestion"

# 4. Package it up for Ollama
$body = @{
    model  = "gemma:2b"
    prompt = $prompt
    stream = $false
} | ConvertTo-Json

# 5. Send it down
Write-Host "Processing your request via gemma:2b..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 120
    Write-Host "`n--- GEMMA RESPONSE ---" -ForegroundColor Green
    Write-Host $response.response
}
catch {
    Write-Host "`nError connecting to Ollama. Make sure the app is running!" -ForegroundColor Red
}
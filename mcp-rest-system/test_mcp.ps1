# PowerShell Script to test the MCP SSE Server
$ErrorActionPreference = "Stop"

$sseUrl = "http://127.0.0.1:8080/sse"
Write-Host "Connecting to SSE endpoint to establish session: $sseUrl ..."

try {
    # Establish the connection and read the first few SSE lines
    $request = [System.Net.WebRequest]::Create($sseUrl)
    $response = $request.GetResponse()
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())

    $messagePath = $null
    # Read up to 20 lines or until we find the "data: " session path
    for ($i = 0; $i -lt 20; $i++) {
        $line = $reader.ReadLine()
        if ($line -like "*data:*") {
            # Extract the path from the data field
            $messagePath = $line.Substring($line.IndexOf("data:") + 5).Trim()
            break
        }
    }
    $reader.Close()
    $response.Close()
} catch {
    Write-Error "Failed to connect to the SSE server at $sseUrl. Make sure the Spring Boot application is running!"
    exit
}

if ($null -eq $messagePath -or $messagePath -eq "") {
    Write-Error "Could not retrieve the connection path/session ID from the SSE event stream."
    exit
}

# The message path returned is relative, e.g. /mcp/message?id=...
$postUrl = "http://127.0.0.1:8080" + $messagePath
Write-Host "Successfully established session! Message endpoint is: $postUrl"
Write-Host "--------------------------------------------------------"

# 1. Send Initialize Request
Write-Host "1. Sending 'initialize' request..."
$initBody = @{
    jsonrpc = "2.0"
    id = 1
    method = "initialize"
    params = @{
        protocolVersion = "2024-11-05"
        capabilities = @{}
        clientInfo = @{
            name = "powershell-client"
            version = "1.0.0"
        }
    }
} | ConvertTo-Json -Depth 5

try {
    $initResponse = Invoke-RestMethod -Uri $postUrl -Method Post -Body $initBody -ContentType "application/json"
    Write-Host "Initialize Response: SUCCESS"
    Write-Host ($initResponse | ConvertTo-Json -Depth 10)
} catch {
    Write-Error "Initialize request failed: $_"
    exit
}
Write-Host "--------------------------------------------------------"

# 2. List Registered Tools
Write-Host "2. Sending 'tools/list' request..."
$listBody = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/list"
    params = @{}
} | ConvertTo-Json -Depth 5

try {
    $listResponse = Invoke-RestMethod -Uri $postUrl -Method Post -Body $listBody -ContentType "application/json"
    Write-Host "List Tools Response: SUCCESS"
    Write-Host ($listResponse | ConvertTo-Json -Depth 10)
} catch {
    Write-Error "List Tools request failed: $_"
    exit
}
Write-Host "--------------------------------------------------------"

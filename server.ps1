param(
    [string]$Url = 'http://127.0.0.1:8080/'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$dataDirectory = if ($env:THEOCEAN_DATA_DIRECTORY) {
    [System.IO.Path]::GetFullPath($env:THEOCEAN_DATA_DIRECTORY)
} else {
    Join-Path $env:LOCALAPPDATA 'TheOceanGym'
}
$dataFile = Join-Path $dataDirectory 'theocean-data.json'
$maxRequestBytes = 16384
$sessionLifetime = [TimeSpan]::FromHours(8)
$sessions = @{}
$loginAttempts = @{}
$registrationAttempts = @{}

$adminEmail = $env:THEOCEAN_ADMIN_EMAIL
$adminPassword = $env:THEOCEAN_ADMIN_PASSWORD
if ([string]::IsNullOrWhiteSpace($adminEmail) -or [string]::IsNullOrWhiteSpace($adminPassword)) {
    throw 'Set THEOCEAN_ADMIN_EMAIL and THEOCEAN_ADMIN_PASSWORD before starting the server.'
}
if ($adminPassword.Length -lt 12) {
    throw 'THEOCEAN_ADMIN_PASSWORD must be at least 12 characters long.'
}
if ($Url -notmatch '^https?://(127\.0\.0\.1|localhost)(:\d+)?/$' -and $env:THEOCEAN_ALLOW_NONLOCAL_BIND -ne '1') {
    throw 'The server only binds to localhost by default. Set THEOCEAN_ALLOW_NONLOCAL_BIND=1 only behind a trusted HTTPS reverse proxy.'
}

New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath $dataFile)) {
    $initialData = [ordered]@{ registrations = @(); revenue = @() } | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($dataFile, $initialData, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-Data {
    $data = Get-Content -LiteralPath $dataFile -Raw -Encoding UTF8 | ConvertFrom-Json
    return @{
        registrations = @($data.registrations | Where-Object { $null -ne $_ })
        revenue = @($data.revenue | Where-Object { $null -ne $_ })
    }
}

function Save-Data($data) {
    $serialized = [ordered]@{
        registrations = @($data.registrations)
        revenue = @($data.revenue)
    } | ConvertTo-Json -Depth 8
    $temporaryFile = "$dataFile.tmp"
    [System.IO.File]::WriteAllText($temporaryFile, $serialized, (New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temporaryFile -Destination $dataFile -Force
}

function Send-Json($response, [int]$statusCode, $value) {
    $response.StatusCode = $statusCode
    $response.ContentType = 'application/json; charset=utf-8'
    $response.Headers['Cache-Control'] = 'no-store'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 8 -Compress))
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.Close()
}

function Read-JsonBody($request) {
    if ($request.ContentLength64 -gt $maxRequestBytes) {
        throw 'Request body is too large.'
    }
    $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
    try {
        $builder = New-Object System.Text.StringBuilder
        $buffer = New-Object char[] 4096
        $byteCount = 0
        while (($read = $reader.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $byteCount += [System.Text.Encoding]::UTF8.GetByteCount($buffer, 0, $read)
            if ($byteCount -gt $maxRequestBytes) { throw 'Request body is too large.' }
            [void]$builder.Append($buffer, 0, $read)
        }
        $body = $builder.ToString()
    } finally {
        $reader.Dispose()
    }
    if ([string]::IsNullOrWhiteSpace($body)) {
        throw 'A JSON request body is required.'
    }
    return ConvertFrom-Json -InputObject $body
}

function Test-SameOrigin($request) {
    $origin = $request.Headers['Origin']
    if ([string]::IsNullOrWhiteSpace($origin)) {
        return $true
    }
    try {
        $originUri = [Uri]$origin
        return $originUri.Scheme -eq $request.Url.Scheme -and $originUri.Authority -eq $request.Url.Authority
    } catch {
        return $false
    }
}

function Get-SessionToken($request) {
    foreach ($cookie in ($request.Headers['Cookie'] -split ';')) {
        $parts = $cookie.Trim() -split '=', 2
        if ($parts.Length -eq 2 -and $parts[0] -eq 'theocean_admin') {
            return $parts[1]
        }
    }
    return $null
}

function Test-AdminSession($request) {
    $token = Get-SessionToken $request
    if ([string]::IsNullOrWhiteSpace($token) -or -not $sessions.ContainsKey($token)) {
        return $false
    }
    if ($sessions[$token] -le [DateTimeOffset]::UtcNow) {
        $sessions.Remove($token)
        return $false
    }
    return $true
}

function New-SessionToken {
    $bytes = New-Object byte[] 32
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random.GetBytes($bytes)
    } finally {
        $random.Dispose()
    }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Test-ConstantTimeEqual([string]$left, [string]$right) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $leftHash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($left))
        $rightHash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($right))
        $difference = 0
        for ($index = 0; $index -lt $leftHash.Length; $index++) {
            $difference = $difference -bor ($leftHash[$index] -bxor $rightHash[$index])
        }
        return $difference -eq 0
    } finally {
        $sha.Dispose()
    }
}

function Test-RateLimit($table, [string]$key, [int]$limit, [TimeSpan]$window) {
    $now = [DateTimeOffset]::UtcNow
    if (-not $table.ContainsKey($key) -or $table[$key].until -le $now) {
        $table[$key] = @{ count = 0; until = $now.Add($window) }
    }
    if ($table[$key].count -ge $limit) {
        return $false
    }
    $table[$key].count++
    return $true
}

function Send-StaticFile($context, [string]$relativePath, [bool]$headOnly = $false) {
    $path = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $relativePath))
    $rootPrefix = $projectRoot.TrimEnd('\') + '\'
    if (-not $path.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Json $context.Response 404 @{ error = 'Not found.' }
        return
    }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Send-Json $context.Response 404 @{ error = 'Not found.' }
        return
    }
    $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
    $types = @{
        '.html' = 'text/html; charset=utf-8'
        '.js' = 'text/javascript; charset=utf-8'
        '.css' = 'text/css; charset=utf-8'
        '.jpg' = 'image/jpeg'
        '.jpeg' = 'image/jpeg'
        '.png' = 'image/png'
        '.svg' = 'image/svg+xml'
        '.webp' = 'image/webp'
        '.gif' = 'image/gif'
        '.mp4' = 'video/mp4'
        '.woff2' = 'font/woff2'
        '.ico' = 'image/x-icon'
    }
    if (-not $types.ContainsKey($extension)) {
        Send-Json $context.Response 404 @{ error = 'Not found.' }
        return
    }
    $context.Response.StatusCode = 200
    $context.Response.ContentType = $types[$extension]
    $context.Response.Headers['X-Content-Type-Options'] = 'nosniff'
    $context.Response.Headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    $context.Response.Headers['X-Frame-Options'] = 'DENY'
    $context.Response.Headers['Cache-Control'] = 'public, max-age=3600'
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $context.Response.ContentLength64 = $bytes.Length
    if (-not $headOnly) {
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $context.Response.Close()
}

function Send-AdminDashboard($response) {
    $data = Get-Data
    $now = [DateTimeOffset]::Now
    $currentMonth = $now.ToString('yyyy-MM')
    $today = $now.ToString('yyyy-MM-dd')
    $monthlyRevenue = 0L
    foreach ($entry in $data.revenue) {
        if ($entry.createdAt -like "$currentMonth-*") {
            $monthlyRevenue += [long]$entry.amount
        }

    }
    $monthly = @()
    for ($offset = 5; $offset -ge 0; $offset--) {
        $monthDate = (Get-Date -Year $now.Year -Month $now.Month -Day 1).AddMonths(-$offset)
        $monthKey = $monthDate.ToString('yyyy-MM')
        $amount = 0L
        foreach ($entry in $data.revenue) {
            if ($entry.createdAt -like "$monthKey-*") {
                $amount += [long]$entry.amount
            }
        }
        $monthly += [ordered]@{ month = $monthKey; amount = $amount }
    }
    $recent = @($data.registrations | Sort-Object submittedAt -Descending | Select-Object -First 5)
    $todayCount = @($data.registrations | Where-Object { $_.submittedAt -like "$today*" }).Count
    $interestCounts = @{}
    foreach ($registration in $data.registrations) {
        $interest = [string]$registration.goal
        if ([string]::IsNullOrWhiteSpace($interest)) { $interest = 'unspecified' }
        if (-not $interestCounts.ContainsKey($interest)) { $interestCounts[$interest] = 0 }
        $interestCounts[$interest]++
    }
    $interests = @($interestCounts.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
        [ordered]@{ goal = $_.Key; count = $_.Value }
    })
    Send-Json $response 200 ([ordered]@{
        revenueCurrentMonth = $monthlyRevenue
        registrationsTotal = $data.registrations.Count
        registrationsToday = $todayCount
        revenueByMonth = $monthly
        recentRegistrations = $recent
        registrationGoals = $interests
    })
}

function Test-SecureCookie($request) {
    return $request.Url.Scheme -eq 'https' -or $env:THEOCEAN_BEHIND_HTTPS_PROXY -eq '1'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Url)
try {
    $listener.Start()
} catch {
    throw "Could not start web server at $Url. $($_.Exception.Message)"
}

Write-Host "The Ocean Gym is running at $Url"
Write-Host 'Press Ctrl+C to stop the server.'

while ($listener.IsListening) {
    $context = $null
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $response.Headers['X-Content-Type-Options'] = 'nosniff'
        $response.Headers['X-Frame-Options'] = 'DENY'
        $response.Headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        $path = [Uri]::UnescapeDataString($request.Url.AbsolutePath)
        $method = $request.HttpMethod.ToUpperInvariant()
        $ip = $request.RemoteEndPoint.Address.ToString()

        if ($path -eq '/api/register' -and $method -eq 'POST') {
            if (-not (Test-SameOrigin $request)) {
                Send-Json $response 403 @{ error = 'Không chấp nhận yêu cầu từ website khác.' }
                continue
            }
            if (-not (Test-RateLimit $registrationAttempts $ip 5 ([TimeSpan]::FromMinutes(10)))) {
                Send-Json $response 429 @{ error = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' }
                continue
            }
            try {
                $body = Read-JsonBody $request
            } catch {
                Send-Json $response 400 @{ error = 'Yêu cầu không hợp lệ.' }
                continue
            }
            $name = ([string]$body.name).Trim()
            $phone = ([string]$body.phone).Trim()
            $goal = ([string]$body.goal).Trim()
            if ($name.Length -lt 2 -or $name.Length -gt 100 -or $phone -notmatch '^(?:\+84|0)(?:3|5|7|8|9)[0-9]{8}$' -or $goal.Length -gt 120) {
                Send-Json $response 400 @{ error = 'Vui lòng nhập họ tên và số điện thoại Việt Nam hợp lệ.' }
                continue
            }
            $data = Get-Data
            $registration = [ordered]@{
                id = [Guid]::NewGuid().ToString('N')
                name = $name
                phone = $phone
                goal = $goal
                submittedAt = [DateTimeOffset]::Now.ToString('o')
            }
            $data.registrations = @($data.registrations) + @([PSCustomObject]$registration)
            Save-Data $data
            Send-Json $response 201 @{ message = 'Registration received.'; id = $registration.id }
            continue
        }

        if (($path -eq '/api/admin/login' -or $path -eq '/api/accounts/login') -and $method -eq 'POST') {
            if (-not (Test-SameOrigin $request)) {
                Send-Json $response 403 @{ error = 'Không chấp nhận yêu cầu từ website khác.' }
                continue
            }
            if (-not (Test-RateLimit $loginAttempts $ip 8 ([TimeSpan]::FromMinutes(15)))) {
                Send-Json $response 429 @{ error = 'Đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' }
                continue
            }
            try {
                $body = Read-JsonBody $request
            } catch {
                Send-Json $response 400 @{ error = 'Yêu cầu không hợp lệ.' }
                continue
            }
            $identifier = if ($body.username) { [string]$body.username } else { [string]$body.email }
            $emailMatches = Test-ConstantTimeEqual $identifier.Trim().ToLowerInvariant() $adminEmail.Trim().ToLowerInvariant()
            $adminUserMatches = Test-ConstantTimeEqual $identifier.Trim().ToLowerInvariant() 'admin'
            $passwordMatches = Test-ConstantTimeEqual ([string]$body.password) $adminPassword
            if (-not (($emailMatches -or $adminUserMatches) -and $passwordMatches)) {
                Send-Json $response 401 @{ success = $false; error = 'Email hoặc mật khẩu không chính xác.' }
                continue
            }
            $token = New-SessionToken
            $sessions[$token] = [DateTimeOffset]::UtcNow.Add($sessionLifetime)
            $secureCookie = if (Test-SecureCookie $request) { '; Secure' } else { '' }
            $response.Headers.Add('Set-Cookie', "theocean_admin=$token; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800$secureCookie")
            Send-Json $response 200 @{ authenticated = $true; success = $true; admin = $true }
            continue
        }

        if ($path -eq '/api/admin/session' -and $method -eq 'GET') {
            Send-Json $response 200 @{ authenticated = (Test-AdminSession $request) }
            continue
        }

        if ($path -like '/api/admin/*' -and -not (Test-AdminSession $request)) {
            Send-Json $response 401 @{ error = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' }
            continue
        }

        if ($path -eq '/api/admin/logout' -and $method -eq 'POST') {
            if (-not (Test-SameOrigin $request)) {
                Send-Json $response 403 @{ error = 'Không chấp nhận yêu cầu từ website khác.' }
                continue
            }
            $token = Get-SessionToken $request
            if ($token) { $sessions.Remove($token) }
            $secureCookie = if (Test-SecureCookie $request) { '; Secure' } else { '' }
            $response.Headers.Add('Set-Cookie', "theocean_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0$secureCookie")
            Send-Json $response 200 @{ authenticated = $false }
            continue
        }

        if ($path -eq '/api/admin/dashboard' -and $method -eq 'GET') {
            Send-AdminDashboard $response
            continue
        }

        if ($path -eq '/api/admin/revenue' -and $method -eq 'POST') {
            if (-not (Test-SameOrigin $request)) {
                Send-Json $response 403 @{ error = 'Không chấp nhận yêu cầu từ website khác.' }
                continue
            }
            try {
                $body = Read-JsonBody $request
            } catch {
                Send-Json $response 400 @{ error = 'Yêu cầu không hợp lệ.' }
                continue
            }
            $amount = 0L
            if (-not [long]::TryParse([string]$body.amount, [ref]$amount) -or $amount -lt 1 -or $amount -gt 1000000000) {
                Send-Json $response 400 @{ error = 'Số tiền phải từ 1 đến 1.000.000.000 VNĐ.' }
                continue
            }
            $data = Get-Data
            $data.revenue = @($data.revenue) + @([PSCustomObject]@{
                id = [Guid]::NewGuid().ToString('N')
                amount = $amount
                createdAt = [DateTimeOffset]::Now.ToString('o')
            })
            Save-Data $data
            Send-Json $response 201 @{ message = 'Revenue saved.' }
            continue
        }

        if ($path -like '/api/*') {
            Send-Json $response 404 @{ error = 'Not found.' }
            continue
        }

        if ($path -eq '/' -and ($method -eq 'GET' -or $method -eq 'HEAD')) {
            $response.StatusCode = 302
            $response.RedirectLocation = '/html/index.html'
            $response.Close()
            continue
        }

        if ($method -ne 'GET' -and $method -ne 'HEAD') {
            Send-Json $response 405 @{ error = 'Method not allowed.' }
            continue
        }
        $relativePath = $path.TrimStart('/').Replace('/', '\')
        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            $relativePath = 'html\index.html'
        }
        Send-StaticFile $context $relativePath ($method -eq 'HEAD')
    } catch {
        [Console]::Error.WriteLine("Request failed: $($_.Exception.Message)")
        if ($null -ne $context) {
            try {
                Send-Json $context.Response 500 @{ error = 'Máy chủ gặp lỗi nội bộ.' }
            } catch {
                try { $context.Response.Close() } catch {}
            }
        }
    }
}

$listener.Stop()
$listener.Close()

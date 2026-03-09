Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -eq 8080} | Select-Object LocalAddress, LocalPort, State, OwningProcess

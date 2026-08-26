On Error Resume Next
Set fso = CreateObject("Scripting.FileSystemObject")
Set wsh = CreateObject("WScript.Shell")

Dim logF
Set logF = fso.OpenTextFile("C:\Users\USER\AppData\Local\Temp\alpha_crm_updater_test.log", 2, True)
logF.WriteLine "=== ALPHA CRM Update Relayer ==="
logF.WriteLine "Started: " & Now()

Dim pid : pid = 39092

Dim wc : wc = 0
Do
  WScript.Sleep 500
  wc = wc + 1
  Dim pRunning : pRunning = False
  Dim colProcs
  Set colProcs = GetObject("winmgmts:" & Chr(92) & Chr(92) & "." & Chr(92) & "root" & Chr(92) & "cimv2").ExecQuery("SELECT ProcessId FROM Win32_Process WHERE ProcessId=" & pid)
  If Err.Number = 0 Then
    If colProcs.Count > 0 Then pRunning = True
  End If
  Err.Clear
  If Not pRunning Then Exit Do
  If wc > 40 Then Exit Do
Loop

WScript.Sleep 2000

Dim src : src = "C:\Users\USER\AppData\Local\Temp\ALPHA_CRM_Update_test.asar"
Dim dst : dst = "C:\Users\USER\AppData\Local\Programs\offline-crm-app\resources\app.asar"
Dim exe : exe = "C:\Users\USER\AppData\Local\Programs\offline-crm-app\ALPHA 고객관리Tool.exe"

logF.WriteLine "Source: " & src
logF.WriteLine "Target: " & dst
logF.WriteLine "AppExe: " & exe
logF.WriteLine "Source exists: " & fso.FileExists(src)

Dim copied : copied = False
Dim ci
For ci = 1 To 25
  Err.Clear
  fso.CopyFile src, dst, True
  If Err.Number = 0 Then
    copied = True
    logF.WriteLine "Copy OK on attempt " & ci
    Exit For
  Else
    logF.WriteLine "Copy attempt " & ci & " error: " & Err.Description
    Err.Clear
  End If
  WScript.Sleep 500
Next

logF.WriteLine "Copy result: " & copied

If fso.FileExists(exe) Then
  logF.WriteLine "Starting app..."
  wsh.Run """" & exe & """", 1, False
  logF.WriteLine "App started"
Else
  logF.WriteLine "ERROR: exe not found: " & exe
End If

logF.WriteLine "Finished: " & Now()
logF.Close
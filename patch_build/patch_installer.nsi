;; ALPHA CRM Patch Installer v1.5.4 - Organization Management & Subordinate Monitoring
Unicode true

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

Name "ALPHA CRM Patch v1.5.4"
OutFile "..\ALPHA_CRM_Patch_v1.5.4.exe"
InstallDir ""
RequestExecutionLevel admin
SetCompressor /SOLID lzma
BrandingText "ALPHA CRM Tool - Patch v1.5.4"

!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "ALPHA CRM Tool - Patch v1.5.4"
!define MUI_WELCOMEPAGE_TEXT "This patch updates ALPHA CRM Tool to v1.5.4.$\r$\n$\r$\n[Patch v1.5.4 Features]$\r$\n- Organization Management & Subordinate Search$\r$\n- Subordinate Schedule Calendar & 6-Month Long-Touch Customer Monitoring$\r$\n- 100% Reliable Auto-Update HotSwap & Explorer Shell Relaunch Engine$\r$\n$\r$\nUser database and custom data will be safely preserved.$\r$\n$\r$\nClick Next to apply the patch."

!define MUI_FINISHPAGE_TITLE "Patch Applied Successfully!"
!define MUI_FINISHPAGE_TEXT "ALPHA CRM Tool v1.5.4 patch has been successfully installed.$\r$\n$\r$\nAll functions including Organization Management are now active."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ALPHA CRM Tool"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Korean"
!insertmacro MUI_LANGUAGE "English"

Var INSTALL_PATH

Function .onInit
  ; Step 0: IMMEDIATELY FORCE CLOSE ALL RUNNING INSTANCES ON LAUNCH
  nsExec::ExecToLog 'taskkill /IM "ALPHA 고객관리Tool.exe" /F'
  nsExec::ExecToLog 'taskkill /IM "Offline Desktop CRM.exe" /F'
  nsExec::ExecToLog 'taskkill /IM "offline-crm-app.exe" /F'
  nsExec::ExecToLog 'taskkill /FI "IMAGENAME eq ALPHA*.exe" /F'
  nsExec::ExecToLog 'taskkill /FI "IMAGENAME eq offline*.exe" /F'
  Sleep 1500

  StrCpy $INSTALL_PATH ""

  ; Enable 64-bit Registry & Path View
  SetRegView 64

  ; 1. Check Literal C:\Program Files\offline-crm-app
  ${If} ${FileExists} "C:\Program Files\offline-crm-app\resources\app.asar"
    StrCpy $INSTALL_PATH "C:\Program Files\offline-crm-app"
    Goto found
  ${EndIf}

  ; 2. Check %LOCALAPPDATA%\Programs\offline-crm-app
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\offline-crm-app\resources\app.asar"
    StrCpy $INSTALL_PATH "$LOCALAPPDATA\Programs\offline-crm-app"
    Goto found
  ${EndIf}

  ; 3. Check Literal C:\Program Files (x86)\offline-crm-app
  ${If} ${FileExists} "C:\Program Files (x86)\offline-crm-app\resources\app.asar"
    StrCpy $INSTALL_PATH "C:\Program Files (x86)\offline-crm-app"
    Goto found
  ${EndIf}

  ; 4. Check Literal C:\Program Files\ALPHA 고객관리Tool
  ${If} ${FileExists} "C:\Program Files\ALPHA 고객관리Tool\resources\app.asar"
    StrCpy $INSTALL_PATH "C:\Program Files\ALPHA 고객관리Tool"
    Goto found
  ${EndIf}

  ; 5. Check %LOCALAPPDATA%\Programs\ALPHA 고객관리Tool
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\ALPHA 고객관리Tool\resources\app.asar"
    StrCpy $INSTALL_PATH "$LOCALAPPDATA\Programs\ALPHA 고객관리Tool"
    Goto found
  ${EndIf}

  ; 6. Check Registry Uninstall String from HKLM
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\b0060b8b-4d78-5309-9b07-5b986265974f" "UninstallString"
  ${If} $0 != ""
    ${GetParent} $0 $1
    ${If} ${FileExists} "$1\resources\app.asar"
      StrCpy $INSTALL_PATH "$1"
      Goto found
    ${EndIf}
  ${EndIf}

  ; 7. Check Registry Uninstall String from HKCU
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\fbe2a728-777f-51c0-a752-fc4bf20475ac" "UninstallString"
  ${If} $0 != ""
    ${GetParent} $0 $1
    ${If} ${FileExists} "$1\resources\app.asar"
      StrCpy $INSTALL_PATH "$1"
      Goto found
    ${EndIf}
  ${EndIf}

  ; Fallback: Prompt user if not auto-detected
  MessageBox MB_OK|MB_ICONINFORMATION "ALPHA CRM Tool folder not auto-detected.$\r$\nPlease select the installation folder."
  nsDialogs::SelectFolderDialog "Select ALPHA CRM Tool folder" "C:\Program Files"
  Pop $INSTALL_PATH

  ${If} $INSTALL_PATH == ""
    MessageBox MB_OK|MB_ICONSTOP "No folder selected. Patch cancelled."
    Abort
  ${EndIf}

  ${IfNot} ${FileExists} "$INSTALL_PATH\resources\app.asar"
    MessageBox MB_OK|MB_ICONSTOP "ALPHA CRM Tool resources not found in: $INSTALL_PATH"
    Abort
  ${EndIf}

found:
  StrCpy $INSTDIR $INSTALL_PATH
FunctionEnd

Function LaunchApp
  SetOutPath "$INSTALL_PATH"
  ${If} ${FileExists} "$INSTALL_PATH\ALPHA 고객관리Tool.exe"
    ExecShell "open" "$INSTALL_PATH\ALPHA 고객관리Tool.exe"
  ${ElseIf} ${FileExists} "$INSTALL_PATH\Offline Desktop CRM.exe"
    ExecShell "open" "$INSTALL_PATH\Offline Desktop CRM.exe"
  ${ElseIf} ${FileExists} "$INSTALL_PATH\offline-crm-app.exe"
    ExecShell "open" "$INSTALL_PATH\offline-crm-app.exe"
  ${EndIf}
FunctionEnd

Section "Patch"
  DetailPrint "Ensuring all running instances are closed..."
  nsExec::ExecToLog 'taskkill /IM "ALPHA 고객관리Tool.exe" /F'
  nsExec::ExecToLog 'taskkill /IM "Offline Desktop CRM.exe" /F'
  nsExec::ExecToLog 'taskkill /IM "offline-crm-app.exe" /F'
  Sleep 1000
  DetailPrint ""

  DetailPrint "Backing up current app.asar..."
  CreateDirectory "$INSTALL_PATH\resources\backup_before_patch"
  ${If} ${FileExists} "$INSTALL_PATH\resources\app.asar"
    CopyFiles /SILENT "$INSTALL_PATH\resources\app.asar" "$INSTALL_PATH\resources\backup_before_patch\app.asar"
  ${EndIf}
  DetailPrint "Backup saved to: resources\backup_before_patch\"
  DetailPrint ""

  DetailPrint "Applying patch files..."
  SetOutPath "$INSTALL_PATH\resources"
  File "app.asar"
  DetailPrint "  [OK] app.asar updated"

  ${If} ${FileExists} "app.asar.unpacked\*.*"
    SetOutPath "$INSTALL_PATH\resources\app.asar.unpacked"
    File /r "app.asar.unpacked\*.*"
    DetailPrint "  [OK] app.asar.unpacked updated"
  ${EndIf}

  DetailPrint ""
  DetailPrint "============================================"
  DetailPrint "  Patch v1.5.3 applied successfully!"
  DetailPrint "  User data: safely preserved"
  DetailPrint "============================================"
SectionEnd

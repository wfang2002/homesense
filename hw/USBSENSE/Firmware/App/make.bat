del USBKB3.hex
"C:\Program files (x86)\Picc\CCSC.exe" "USBKB3.c"  "-I C:\Program Files (x86)\PICC\Devices" +FH +DF +LN +T -A +M +Z +Y=9 +EA
if exist USBKB3.HEX GOTO FLASH
;echo %ERRORLEVEL%
;if ERRORLEVEL == 0 GOTO FLASH
type USBKB3.err
PAUSE
EXIT
:FLASH
BTUSBFlash -dUSBKB USBKB3.HEX

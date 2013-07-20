del usbLoader.hex
"C:\Program files\Picc\CCSC.exe" "usbloader.c"  "-I C:\Program Files\PICC\Devices" +FH +DF +LN +T -A +M +Z +Y=9 +EA
if exist usbLoader.hex GOTO FLASH
;echo %ERRORLEVEL%
;if ERRORLEVEL == 0 GOTO FLASH
type usbLoader.err
PAUSE
EXIT


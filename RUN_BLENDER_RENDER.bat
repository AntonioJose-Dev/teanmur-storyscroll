@echo off
title TEANMUR - Blender Render
echo.
echo  =============================================
echo   TEANMUR - Render bote 3D (115 frames)
echo  =============================================
echo.

SET SCRIPT=%~dp0blender_render.py
SET OUTDIR=%~dp0public\frames

echo Script : %SCRIPT%
echo Salida  : %OUTDIR%
echo.

REM -- Buscar Blender en rutas comunes --
SET BLENDER=

IF EXIST "C:\Program Files\Blender Foundation\Blender 4.4\blender.exe" (
    SET BLENDER=C:\Program Files\Blender Foundation\Blender 4.4\blender.exe
    GOTO FOUND
)
IF EXIST "C:\Program Files\Blender Foundation\Blender 4.3\blender.exe" (
    SET BLENDER=C:\Program Files\Blender Foundation\Blender 4.3\blender.exe
    GOTO FOUND
)
IF EXIST "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" (
    SET BLENDER=C:\Program Files\Blender Foundation\Blender 4.2\blender.exe
    GOTO FOUND
)
IF EXIST "C:\Program Files\Blender Foundation\Blender 4.1\blender.exe" (
    SET BLENDER=C:\Program Files\Blender Foundation\Blender 4.1\blender.exe
    GOTO FOUND
)
IF EXIST "C:\Program Files\Blender Foundation\Blender 4.0\blender.exe" (
    SET BLENDER=C:\Program Files\Blender Foundation\Blender 4.0\blender.exe
    GOTO FOUND
)
IF EXIST "C:\Program Files\Blender Foundation\Blender 3.6\blender.exe" (
    SET BLENDER=C:\Program Files\Blender Foundation\Blender 3.6\blender.exe
    GOTO FOUND
)
IF EXIST "C:\Program Files\Blender Foundation\Blender\blender.exe" (
    SET BLENDER=C:\Program Files\Blender Foundation\Blender\blender.exe
    GOTO FOUND
)

REM -- Try PATH --
WHERE blender >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    SET BLENDER=blender
    GOTO FOUND
)

echo ERROR: No se encontro Blender. Rutas buscadas:
echo   C:\Program Files\Blender Foundation\Blender 4.x\blender.exe
echo   C:\Program Files\Blender Foundation\Blender 3.x\blender.exe
echo.
echo Abre este .bat con un editor de texto y ajusta la ruta de Blender.
pause
EXIT /B 1

:FOUND
echo Blender encontrado:
echo   %BLENDER%
echo.
echo Lanzando render headless...
echo (Esto puede tardar 2-8 minutos segun tu GPU)
echo.

"%BLENDER%" --background --python "%SCRIPT%" -- 2>&1

echo.
echo ============================================
echo  Render terminado. Revisa public\frames\
echo ============================================
pause

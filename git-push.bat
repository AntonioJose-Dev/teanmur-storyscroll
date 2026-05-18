@echo off
cd /d "%~dp0"
echo Eliminando lock si existe...
if exist ".git\index.lock" del /f ".git\index.lock"
echo.
echo Haciendo git add...
git add -A
echo.
echo Haciendo commit...
git commit -m "fix: mobile polish — logo izquierda, iconos sociales abajo, sin negro al scrollar

- Logo mas pegado al borde izquierdo (padding-left: 4px en movil)
- Iconos IG/WA/FB bajados con margin-top: 10px en movil
- overscroll-behavior-y: none en body — elimina area negra al deslizar en iOS/Android
- Eliminado bloque media query duplicado en main.css
- Footer mas alto en movil (200px) para cubrir mejor el fondo"
echo.
echo Haciendo push a GitHub...
git push origin main
echo.
echo Listo! Pulsa cualquier tecla para cerrar.
pause

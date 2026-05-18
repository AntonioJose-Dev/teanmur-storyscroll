@echo off
cd /d "%~dp0"
echo Eliminando lock si existe...
if exist ".git\index.lock" del /f ".git\index.lock"
echo.
echo Haciendo git add...
git add -A
echo.
echo Haciendo commit...
git commit -m "feat: Railway deploy, mobile responsive, imagenes particulares, modos IA

- Railway: railway.toml, process.env.PORT, Express sirve frontend estatico
- AI_PROXY_ORIGIN auto-detecta localhost vs produccion (mismo origen)
- Mobile responsive: widget chat ancho completo, panel padding reducido,
  imagen quienes somos adaptada, CTAs full-width, mark-preview max-width,
  advice overlay tipo sheet, header/footer ajustados
- Imagenes: todas las tarjetas de Particulares con foto real
- Modo compatibilidad: 16 materiales, fallback servidor /api/compatibility
- Modo colores: 5 familias, sugerencias por estancia
- WhatsApp CTA: numero correcto 34968967450
- Footer: Diseno web Antonio Jose Marin"
echo.
echo Haciendo push a GitHub...
git push origin main
echo.
echo Listo! Pulsa cualquier tecla para cerrar.
pause

# Seguridad, privacidad y recuperación

## Contexto
ClassNote maneja registros educativos potencialmente sensibles de **menores de edad**. Ser offline no significa automáticamente cifrado, control de acceso o protección ante otros usuarios de Windows.

## Políticas de 1.1.0
- No datos reales en Git, fixtures, capturas, issues, PRs ni telemetría.
- La interfaz de producción no llama a CDN/APIs externas. El instalador incluye WebView2 offline; Windows y el runtime gestionan sus propias comunicaciones. No hay actualizador automático de ClassNote.
- Mantener permisos/capabilities Tauri mínimos; diálogo de archivos solo tras acción explícita.
- Validar todos los imports y campos libres; neutralizar entradas que puedan convertirse en fórmulas de Excel.
- Mantener rutas de datos estables y evitar borrado en actualizaciones/desinstalación hasta verificar políticas.
- Advertir que el usuario debe proteger su sesión de Windows y los archivos exportados.
- **No afirmar que los datos están cifrados**; IndexedDB y JSON de respaldo no lo garantizan por sí solos.

## Backups
- Recomendación inicial: respaldo manual frecuente en unidad elegida, con copias adicionales controladas por el docente.
- Antes de restaurar: validar formato/versión, avisar del reemplazo, exigir el guardado de un respaldo previo completo y probar recuperación ante error.
- Dejar claro qué se exporta (todos los módulos) y qué no.
- No guardar respaldos en carpetas públicas por defecto.

## Reporte responsable
No publicar datos de menores ni archivos reales al reportar vulnerabilidades. No se ha establecido un canal privado de reporte. Para problemas no sensibles, usar Issues si está habilitado en el repositorio y describir pasos con datos sintéticos. No publicar vulnerabilidades sensibles ni archivos personales en canales públicos.

## Antes de distribución pública
Revisar avisos de privacidad y obligaciones legales aplicables en regiones objetivo; políticas de retención/borrado de datos; licencias; seguridad de dependencias; firma de instaladores si es viable.

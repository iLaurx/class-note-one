# ClassNote 1.1.0

## Estado

Versión en preparación para distribución por GitHub Releases. El usuario informó el 21/10/2026 que completó satisfactoriamente sus pruebas funcionales. Esa aceptación no acredita por sí sola la instalación sin red ni la actualización del nuevo paquete en otra PC.

Instalador generado localmente: ClassNote_1.1.0_x64-setup.exe, 224.135.699 bytes (213,75 MiB). Metadatos de producto/archivo 1.1.0, sin firma. SHA-256: ca0ecae42b66476c7dd9f21cef7a4979f9e6f099c2f606bde94d7db26df61744. El archivo SHA256SUMS.txt está junto al instalador, en src-tauri/target/release/bundle/nsis/. Estos datos corresponden al paquete generado; no se reutilizaron cifras de 0.1.0.

## Producto actual

- Seis secciones: Inicio, Asistencia, Tareas, Alumnos, Reportes y Configuración.
- Interfaz simplificada para una docente y su grupo, sin límite artificial de siete alumnos.
- Asistencia, tareas y entregas, alumnos y matrículas, ciclos escolares y un grupo activo por ciclo.
- Reportes Excel por semana, mes, ciclo o fechas libres, con selección de contenido y alumnos, resumen, detalle y comentarios.
- Lecturas y Observaciones ocultas de navegación y reportes; sus datos históricos se conservan en almacenamiento y respaldos.
- Almacenamiento local sin cuenta, backend, sincronización ni actualizador automático.

## Distribución

Nombre: **ClassNote**. Versión de producto: **1.1.0**. Instalador previsto: **ClassNote_1.1.0_x64-setup.exe**, NSIS en español, para el usuario actual.

La configuración incluye WebView2 Evergreen x64 mediante offlineInstaller. La compilación obtiene el instalador independiente y lo incorpora al paquete para no descargarlo en destino. La inclusión física se debe comprobar en el paquete generado y la instalación inicial offline se prueba por separado.

Windows 11 x64 es la plataforma inicial. Windows 10 y ARM no están validados. Sin firma digital: pueden aparecer advertencias de Windows. Licencia MIT.

## Datos y respaldos

Se conservan org.classnote.desktop, el origen http://tauri.localhost y el esquema IndexedDB v1. No se migran ni eliminan registros por cambiar la versión.

Los respaldos nuevos indican appVersion 1.1.0. El lector admite 0.1.0 y 1.1.0, mantiene esquema/formato v1 y valida integridad y relaciones antes de escribir. Versiones desconocidas siguen rechazándose. No se garantiza que una instalación 0.1.0 importe respaldos 1.1.0.

La restauración exige confirmación y copia previa; reemplaza la base completa. No hay cifrado propio ni recuperación remota.

## Antes de distribuir

- [x] Aceptación funcional comunicada por el usuario.
- [x] Versión 1.1.0 en manifiestos y metadatos de respaldo.
- [x] Configuración de WebView2 offline en el instalador.
- [x] Guías actuales de instalación, uso, privacidad y publicación.
- [x] Comprobaciones de la preparación de 1.1.0 registradas.
- [x] Instalador 1.1.0 generado y metadatos comprobados; script NSIS incorpora WebView2 y las guías.
- [x] SHA-256 del paquete definitivo generado.
- [ ] Versión y archivos publicados en GitHub Releases.
- [ ] Prueba del paquete definitivo en otra PC, prevista después de preparar la descarga.
- [ ] Actualización real desde 0.1.0 con datos de prueba y respaldo.

Las [notas de 0.1.0](RELEASE_0.1.0.md) y las matrices CN conservan evidencia histórica; no describen el paquete actual.

## Comprobaciones de preparación

- TypeScript, ESLint y formato: correctos.
- 92 pruebas de datos/dominio aprobadas, incluida restauración de respaldos 0.1.0 y exportación con metadatos 1.1.0.
- Dos pruebas de distribución aprobadas: recursos locales y restricciones de red/permisos.
- 30 documentos revisados automáticamente sin enlaces locales rotos; recursos documentales del instalador presentes.
- Ejecutable Windows compilado; metadatos ProductName ClassNote, ProductVersion y FileVersion 1.1.0.
- NSIS generado con modo offlineInstaller y directiva File que incorpora el instalador independiente WebView2 x64.

Se utilizaron las herramientas ya instaladas. La invocación inicial de pnpm quedó esperando su verificación de políticas de dependencias y se detuvo; los comandos de validación se ejecutaron directamente desde node_modules. No se afirma una ejecución nueva de pnpm check ni de la suite UI o nativa completa. La compilación inicial restringida falló por DNS al obtener NSIS; la ejecución con red autorizada descargó las herramientas y WebView2.

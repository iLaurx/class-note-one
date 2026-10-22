# Instalar y actualizar ClassNote 1.1.0

## Antes de instalar

La plataforma prevista es Windows 11 x64 en procesadores Intel/AMD. Windows 10 y Windows ARM siguen sin validar. Como orientación, se sugieren 4 GB de RAM para uso básico y 8 GB para mayor comodidad; no hay un mínimo propio medido. Reserva espacio para la aplicación, WebView2 y tus archivos; el mínimo de disco aún no se ha medido.

No necesitas Node.js, Rust, Visual Studio, cuenta ni Excel. Para abrir reportes fuera de la aplicación puedes usar Excel u otro visor compatible.

## Descarga e instalación

1. Entra a [GitHub Releases](https://github.com/iLaurx/class-note-one/releases) y busca **ClassNote 1.1.0**. Mientras esté en preparación, puede no aparecer publicada.
2. En **Assets**, descarga **ClassNote_1.1.0_x64-setup.exe**. No necesitas el ZIP de código fuente.
3. Si se entrega SHA256SUMS.txt, comprueba el archivo antes de instalar. Es opcional usar PowerShell para calcularlo:

   ```powershell
   Get-FileHash "$env:USERPROFILE\Downloads\ClassNote_1.1.0_x64-setup.exe" -Algorithm SHA256
   ```

   Si descargaste en otra carpeta, usa su ruta. Compara el resultado con el publicado para ese mismo archivo.

4. Cierra cualquier ventana de ClassNote y abre el instalador. Lee la licencia y sigue las pantallas en español.
5. El instalador incluye el instalador independiente de **WebView2 Evergreen x64**. Si falta el runtime, intenta instalarlo sin necesitar internet. Atiende cualquier solicitud de permisos de Windows; una política del equipo puede impedirlo.
6. Abre ClassNote desde el acceso creado. La instalación es por usuario y la ruta predeterminada es %LOCALAPPDATA%\ClassNote.
7. En una instalación sin datos previos, configura el ciclo y el grupo siguiendo la [guía breve](QUICK_START.md). No se cargan alumnos de ejemplo.

La firma digital aún no está incorporada. Windows puede avisar que el editor es desconocido. Comprueba el origen y la suma del archivo; no desactives las protecciones. En una PC institucional, solicita ayuda al administrador si hay un bloqueo.

## Instalar sin internet

Descarga y transfiere el único archivo de instalación de 1.1.0 a la PC de destino, por ejemplo en una memoria USB. Ese paquete debe contener WebView2; la versión antigua 0.1.0 no lo incluía. La instalación inicial del paquete definitivo sin red sigue pendiente de comprobar en otra PC.

El funcionamiento local de ClassNote no impide que Windows, WebView2 u otros programas gestionen sus propias comunicaciones y actualizaciones.

## Actualizar desde una versión anterior

1. En la versión anterior, guarda un respaldo completo JSON en una ubicación externa al perfil.
2. Cierra ClassNote e instala 1.1.0 con el mismo usuario de Windows y la misma ubicación.
3. Abre y comprueba tus registros. Conserva el respaldo previo.
4. Si necesitas restaurar, 1.1.0 acepta archivos válidos de 0.1.0 y 1.1.0, con formato/esquema v1.

No desinstales primero ni borres el perfil como paso de actualización. Se conserva el identificador org.classnote.desktop, el origen y el esquema; la actualización real desde el instalador anterior todavía requiere validación. No se garantiza conservación por desinstalar ni compatibilidad de los nuevos respaldos con el programa anterior.

## Cambiar de PC

Guarda un respaldo completo JSON en el equipo anterior. Instala ClassNote en el nuevo y restaura el JSON desde **Configuración → Respaldos y recuperación**. Confirma el reemplazo y guarda la copia previa que exige el programa. No uses Excel ni copies archivos internos de IndexedDB para transferir datos.

## Dónde están los datos

La base classnote es IndexedDB dentro del perfil WebView2 del usuario, bajo el origen http://tauri.localhost. La ubicación predeterminada esperada es %LOCALAPPDATA%\org.classnote.desktop\EBWebView; la ruta efectiva puede variar.

El ejecutable no contiene tus registros. Otro usuario de Windows tiene su propia base. No borres ni edites el perfil; usa los respaldos desde la aplicación.

## Problemas habituales

- **No inicia o falta WebView2:** verifica que descargaste el instalador completo 1.1.0. Si el componente no pudo instalarse, consulta al administrador u obtén el instalador Evergreen independiente x64 desde [Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).
- **No aparecen los datos anteriores:** comprueba el usuario de Windows y el ciclo seleccionado. Si es otra PC o perfil, restaura tu respaldo.
- **No abre el Excel:** necesitas un visor compatible con .xlsx; ClassNote no lo requiere para generar el reporte.
- **El respaldo es rechazado:** conserva el original. No edites sus versiones ni relaciones para forzar la importación. Excel no es restaurable.
- **La restauración terminó pero falló la recarga:** utiliza el reintento de lectura que muestra la aplicación antes de volver a restaurar.

## Desinstalar

Guarda primero un respaldo completo fuera del perfil y comprueba que conservas el archivo. Desinstala desde Configuración de Windows y revisa cualquier opción de borrar datos. No dependas de que la desinstalación conserve registros. Los JSON y Excel exportados se gestionan por separado.

Consulta [privacidad](PRIVACY.md), [primer uso](QUICK_START.md) y [estado de 1.1.0](RELEASE_1.1.0.md).

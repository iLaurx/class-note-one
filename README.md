# ClassNote 1.1.0

Agenda escolar para Windows, en español y sin conexión, pensada para el trabajo diario de una docente con su grupo. Los datos se guardan en la PC; no necesitas cuenta, servidor ni suscripción.

## Descargar e instalar

1. Abre [las versiones de ClassNote en GitHub](https://github.com/iLaurx/class-note-one/releases).
2. Cuando esté publicada la versión **1.1.0**, descarga **ClassNote_1.1.0_x64-setup.exe** desde sus archivos adjuntos (Assets). Los archivos «Source code» son para desarrollo.
3. Ejecuta el instalador y sigue las instrucciones en español.
4. Abre ClassNote desde el acceso creado y configura tu ciclo escolar y grupo.

**Estado:** instalador 1.1.0 generado localmente (213,75 MiB), pendiente de publicación. El enlace anterior lleva al listado de versiones; no implica que el instalador ya esté publicado. La prueba del paquete definitivo en otra PC queda pendiente.

El instalador se configura para incluir **Microsoft Edge WebView2 Runtime Evergreen x64** y prepararlo si falta, sin descargarlo en la PC de destino. Se distribuye un solo archivo; no necesitas ejecutar comandos para usar ClassNote. La primera compilación del instalador sí necesita internet para obtener ese componente.

El paquete aún no tiene firma digital. Windows puede mostrar un aviso de editor desconocido. Comprueba que provenga de este repositorio y verifica su SHA-256; no desactives las protecciones del equipo. Una política institucional puede requerir apoyo del administrador.

## Requisitos de la PC

| Elemento | Requisito o referencia                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sistema  | Windows 11 de 64 bits; instalador x64 para Intel/AMD. Windows 10 y Windows ARM no tienen validación de esta entrega.                             |
| Memoria  | Sin mínimo propio medido. Como orientación: 4 GB para uso básico y 8 GB recomendados; no es una medición de consumo.                             |
| Espacio  | Para ClassNote, WebView2, reportes y respaldos. El tamaño definitivo se indicará con el instalador generado; no se ha medido un mínimo de disco. |
| Internet | Para descargar el instalador. El uso de ClassNote es local y sin conexión.                                                                       |
| WebView2 | Incluido en el instalador configurado para 1.1.0.                                                                                                |
| Reportes | Excel u otro visor compatible es opcional para abrir los archivos .xlsx.                                                                         |

No necesitas Node.js, Rust, Visual Studio, Excel ni una cuenta de GitHub para usar la aplicación instalada. La descarga sin cuenta requiere que la versión sea pública.

## Qué puedes hacer

- **Inicio:** consultar el resumen del grupo y acceder al trabajo diario.
- **Asistencia:** capturar estados por alumno y fecha, añadir notas y consultar el historial.
- **Tareas:** organizar actividades y registrar sus entregas.
- **Alumnos:** registrar fichas y matrículas, editar datos y consultar el historial.
- **Reportes:** elegir semana, mes, ciclo completo o fechas libres; exportar asistencia, actividades y tareas o lista de alumnos, para todo el grupo o alumnos seleccionados.
- **Configuración:** administrar ciclos y el grupo activo de cada ciclo; guardar y restaurar respaldos completos.

La interfaz no muestra Lecturas ni Observaciones. Los registros históricos de esos módulos se conservan en la base y en los respaldos. No se crean alumnos de ejemplo ni existe un límite de siete alumnos.

## Guías

- [Instalación, requisitos, actualización y solución de problemas](docs/INSTALLATION.md).
- [Guía breve: primer uso, asistencia, tareas, reportes y respaldos](docs/QUICK_START.md).
- [Privacidad y ubicación de los datos](docs/PRIVACY.md).
- [Qué cambia en 1.1.0 y estado de la entrega](docs/RELEASE_1.1.0.md).
- [Preparar y publicar la descarga en GitHub Releases](docs/PUBLISHING.md).

## Datos y respaldos

Cada usuario de Windows y cada PC tienen su propia base local. Copiar el ejecutable o instalar ClassNote en otra PC no transfiere los registros.

En **Configuración → Respaldos y recuperación**, guarda un **respaldo completo JSON** en una ubicación privada fuera del perfil de la aplicación. Para cambiar de PC, instala ClassNote y restaura ese JSON. Restaurar reemplaza todos los datos locales y requiere guardar primero una copia de los datos anteriores.

1.1.0 crea respaldos identificados como 1.1.0 y acepta respaldos 0.1.0 y 1.1.0 con formato y esquema v1 válidos. No cambia el esquema de datos. No se promete que 0.1.0 pueda abrir respaldos nuevos.

**Un Excel es un reporte, no un respaldo restaurable.** ClassNote no cifra la base ni los archivos exportados y no dispone de recuperación remota. Protege tu sesión de Windows y conserva copias externas.

## Desarrollo y compilación

Estos requisitos son solo para quien modifica o genera el programa: Windows x64, Node.js >=22.12, pnpm 12.6.0, Rust MSVC compatible con Cargo.toml, Visual Studio Build Tools con C++ y Windows SDK, y WebView2.

Desde la raíz del repositorio:

```powershell
pnpm install --frozen-lockfile
pnpm tauri:dev
```

Generar el instalador con WebView2 incluido:

```powershell
pnpm tauri:build
```

La primera compilación requiere internet para dependencias, herramientas y el instalador de WebView2. El archivo resultante queda en:

```text
src-tauri/target/release/bundle/nsis/ClassNote_1.1.0_x64-setup.exe
```

No distribuyas solo classnote.exe a una PC sin WebView2. No subas target/, perfiles ni datos personales al repositorio; el instalador se adjunta a una Release.

| Comando          | Función                                                        |
| ---------------- | -------------------------------------------------------------- |
| pnpm dev         | Interfaz en navegador para desarrollo                          |
| pnpm tauri:dev   | Aplicación de escritorio de desarrollo                         |
| pnpm check       | Lint, formato, compilación, pruebas DB/distribución e interfaz |
| pnpm tauri:build | Ejecutable e instalador Windows                                |
| pnpm test:native | Persistencia en ejecutable real, con perfil de prueba aislado  |

Ejecuta las pruebas nativas después de las de interfaz: estas últimas limpian test-results. [Procedimientos y resultados históricos](TESTING.md). La aceptación funcional comunicada por el usuario no sustituye la prueba pendiente del nuevo instalador en otra PC.

## Documentación técnica

[Arquitectura](ARCHITECTURE.md), [modelo de datos](DATA_MODEL.md), [decisiones](DECISIONS.md), [reportes actuales](docs/REPORTS.md), [respaldo/restauración](docs/BACKUP_RESTORE.md), [seguridad](SECURITY.md) y [contribución](CONTRIBUTING.md).

Los documentos CN y las notas de 0.1.0 conservan evidencia histórica de desarrollo; para instalar o usar la versión actual, sigue este README y las guías anteriores.

## Licencia y ayuda

[Licencia MIT](LICENSE). Las dependencias conservan sus propias licencias.

Para informar problemas, consulta [Issues del repositorio](https://github.com/iLaurx/class-note-one/issues), si están habilitados. Describe pasos, versión y Windows usando datos ficticios. No publiques nombres de menores, respaldos ni reportes reales.

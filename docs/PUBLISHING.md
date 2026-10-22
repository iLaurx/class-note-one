# Publicar ClassNote 1.1.0 en GitHub

Esta guía es para quien prepara la distribución. Para instalar y usar el programa, consulta [instalación](INSTALLATION.md).

## 1. Cerrar la versión

Revisa los cambios y guarda en Git exactamente lo que irá en la entrega. Deben coincidir 1.1.0 en package.json, Cargo.toml, la entrada classnote de Cargo.lock y tauri.conf.json; los respaldos nuevos también indican 1.1.0.

Ejecuta:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm tauri:build
```

La primera compilación requiere internet para dependencias y WebView2. No necesita internet la PC de destino para descargar el runtime: se incluye en el paquete configurado. Conserva los dos lockfiles.

## 2. Preparar los archivos de descarga

El instalador debe ser:

```text
src-tauri/target/release/bundle/nsis/ClassNote_1.1.0_x64-setup.exe
```

Comprueba sus metadatos, que contiene el instalador offline de WebView2 y que las guías incluidas corresponden a esta versión. No reutilices un instalador 0.1.0 ni publiques el ejecutable suelto como entrega completa.

Genera el archivo de verificación junto al instalador, desde la raíz:

```powershell
$releaseInstaller = Resolve-Path 'src-tauri/target/release/bundle/nsis/ClassNote_1.1.0_x64-setup.exe'
$releaseHash = Get-FileHash -LiteralPath $releaseInstaller.Path -Algorithm SHA256
$releaseChecksum = Join-Path (Split-Path $releaseInstaller.Path) 'SHA256SUMS.txt'
"$($releaseHash.Hash.ToLowerInvariant())  $(Split-Path $releaseInstaller.Path -Leaf)" | Set-Content -LiteralPath $releaseChecksum -Encoding ascii
```

## 3. Preparar GitHub Releases

1. Comprueba el repositorio de destino: **iLaurx/class-note-one**.
2. Revisa su visibilidad: un repositorio privado limita quién puede descargar; no cambies la visibilidad sin decidirlo expresamente.
3. Sube a GitHub el commit que contiene todos los cambios de 1.1.0.
4. En **Releases → Draft a new release**, crea la etiqueta **v1.1.0** apuntando a ese commit.
5. Título: **ClassNote 1.1.0**.
6. Añade notas basadas en [RELEASE_1.1.0.md](RELEASE_1.1.0.md), indicando los límites de validación pendientes y la ausencia de firma.
7. Adjunta el instalador y SHA256SUMS.txt. GitHub añade automáticamente los archivos de código fuente; no sustituyen al instalador.
8. Guarda como borrador y revisa título, etiqueta, commit, archivos, enlaces y privacidad antes de publicar.
9. Publica y prueba la descarga. Actualiza el README y el estado de la entrega con el enlace real.

No subas target/, bases, perfiles, respaldos ni reportes personales al historial Git. Los archivos de instalación se adjuntan a la Release.

## 4. Probar en otra PC

Después de preparar la descarga, siguiendo la secuencia acordada:

- Descarga el instalador y compara SHA-256.
- Instala en Windows 11 x64; comprueba el caso sin WebView2 en un entorno de prueba.
- Comprueba instalación y primer inicio sin red.
- Crea un ciclo, grupo y alumnos ficticios; guarda asistencia y entregas.
- Cierra completamente y vuelve a abrir: los registros deben conservarse.
- Exporta Excel y un respaldo JSON.
- Restaura el JSON y comprueba los registros.
- Si hay versión anterior, prueba la actualización con datos sintéticos y respaldo externo.

Registra fecha, entorno y resultados. Si publicas antes de completar esta comprobación, conserva claramente visible que la validación en otra PC está pendiente.

## Futuras entregas

Usa un nuevo número de versión, etiqueta e instalador. Mantén el identificador y la política de compatibilidad de datos; prueba cambios de esquema y actualización antes de prometer conservación. Por ahora, la actualización es manual.

Referencias: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) y [WebView2 en Tauri](https://v2.tauri.app/distribute/windows-installer/#offline-installer).

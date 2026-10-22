# Contribuir a ClassNote

## Antes de empezar

Lee el [README](README.md), la [arquitectura](ARCHITECTURE.md), el [modelo de datos](DATA_MODEL.md) y la [política de seguridad](SECURITY.md). El producto actual es ClassNote 1.1.0, con seis secciones y datos locales.

AGENTS.md, MVP.md y TASKS.md son archivos locales opcionales e ignorados por Git; no son requisitos para colaborar desde un clon nuevo.

Propón cambios pequeños con datos ficticios. Para persistencia y respaldos, incluye compatibilidad, migraciones si corresponden y pruebas de recuperación.

## Desarrollo y validación

Instala las herramientas indicadas en el README y ejecuta pnpm install --frozen-lockfile. Usa pnpm tauri:dev para escritorio y pnpm check para las comprobaciones. La compilación del instalador se hace con pnpm tauri:build.

Las pruebas nativas usan perfiles temporales y se ejecutan después de las de interfaz. Consulta [TESTING.md](TESTING.md) para sus requisitos; no confundas resultados históricos con validaciones nuevas.

## Flujo Git y revisión

Usa ramas con prefijo codex/ y commits descriptivos. En una propuesta de cambio explica el problema, resultado, pruebas e impacto sobre datos, permisos y respaldos. Las capturas solo deben contener datos ficticios.

No subas binarios de compilación, perfiles, bases ni respaldos personales al repositorio. Los instaladores se adjuntan a una Release según [la guía de publicación](docs/PUBLISHING.md).

## Licencia

El proyecto se distribuye con [licencia MIT](LICENSE). Conserva las licencias y atribuciones de dependencias y recursos que añadas.

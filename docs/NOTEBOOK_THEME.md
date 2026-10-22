# Interfaz de agenda escolar

> Documento histórico de desarrollo. Conserva el alcance, las pruebas y los pendientes de su etapa, incluidos módulos o pantallas anteriores. Para ClassNote 1.1.0 consulta el [README actual](../README.md), la [guía breve](QUICK_START.md) y las [notas vigentes](RELEASE_1.1.0.md). Los resultados de esta etapa no acreditan el nuevo instalador.

Rediseño del 21 de octubre de 2026 basado en la imagen adjunta a la solicitud:
papel marfil, cuadrícula azul tenue, verde profundo, acentos pastel y títulos
manuscritos. No se importan los números, alumnos ni otros datos de la referencia.

## Alcance

- Mi día, Asistencia, Tareas y entregas, Alumnos y fichas, Reportes y Configuración.
- Lectura en casa y Observaciones, accesibles desde el menú «Más».
- Formularios de ciclos, grupos, alumnos, tareas, lecturas y observaciones;
  filtros, estados vacíos, errores, respaldos y confirmaciones dentro de la página.
- Barra lateral de escritorio, navegación móvil, foco visible y salto al contenido.

El tema está en `src/app/notebook.css`, importado después de los estilos base.
Comparte los componentes y flujos existentes. No cambia repositorios, modelos,
reglas de validación, almacenamiento ni exportación. Conserva los cambios que ya
había en el checkout al comenzar este trabajo.

Los títulos usan Segoe Print en Windows con alternativas locales. Formularios,
tablas, cifras y textos funcionales mantienen Segoe UI. Los recursos no requieren
internet. El Snoopy del pie lateral es una ilustración SVG decorativa, excluida de
la lectura accesible y sin interacción. Se oculta con el pie en móvil para dejar
espacio a la navegación. Los detalles decorativos se limitan a la cuadrícula,
textura, cinta, trazos y mascota.

## Verificación

- Compilación de producción y comprobación TypeScript: correctas.
- ESLint, formato de los archivos del rediseño y `git diff --check`: correctos.
- `tests/ui/notebook.spec.ts` y `tests/ui/reports.spec.ts`: 11 pruebas aprobadas.
  Incluyen los anchos 360, 390, 768, 1100 y 1440; navegación de las ocho secciones,
  edición de alumnos, asistencia, tareas, entregas, persistencia tras recarga,
  teclado, estados vacíos, selección de reportes y exportación sin conexión.
- Dos pruebas de distribución sin recursos externos: aprobadas.
- Revisión visual de capturas de escritorio y móvil en `test-results/notebook-*`.
  Los datos de esas capturas pertenecen a perfiles aislados de prueba.
- Ejecutable e instalador NSIS generados en `src-tauri/target/release/`.

## Límites

La suite general de datos no pasa por incompatibilidades de sus expectativas
con las reglas actuales de grupos y matrículas. Esos archivos de lógica no se
modificaron en este rediseño. La suite histórica de interfaz también conserva
expectativas de versiones anteriores; la cobertura específica de este cambio
está en `notebook.spec.ts`.

Los diálogos nativos de archivos y las confirmaciones del sistema mantienen la
apariencia de Windows/WebView2. Las pruebas de navegador no sustituyen la
validación manual del instalador y del ejecutable nativo; no se instaló ni se
abrió la aplicación sobre el perfil real del usuario.

# Cuaderno de clase: rediseño

La interfaz prioriza el trabajo diario de una maestra con un solo grupo pequeño. No impone un límite de siete alumnos ni agrega datos de ejemplo a la aplicación.

- Navegación superior: Inicio, Alumnos, Asistencia y Tareas. Lectura, Observaciones, Reportes y Configuración están en Más.
- Inicio: acción para pasar lista, tres cifras del grupo y tareas recientes o próximas. La base vacía muestra cómo configurar el grupo.
- Asistencia: botones por alumno, notas opcionales desplegables, recuentos compactos y guardado explícito. Se mantiene la protección de borradores y la confirmación de correcciones.
- Tareas: listado, formulario y entregas en vistas separadas. Los filtros se despliegan cuando se necesitan.
- Alumnos, lecturas y observaciones: menos texto administrativo; búsqueda e historial individual bajo controles desplegables.
- Configuración: grupo primero y respaldos en un apartado desplegable. Se conserva la confirmación para restaurar y archivar.
- Estilo común para todas las pantallas, sin recursos externos y con adaptación a celular.

No se modificaron el esquema, los repositorios, los cálculos ni el generador de Excel durante este rediseño. Sus modificaciones previas en el checkout se conservaron. El formato inspirado en la hoja de referencia queda para la siguiente etapa.

## Verificación

- Compilación y TypeScript: correctos.
- ESLint y formato de los archivos del rediseño: correctos.
- Dos comprobaciones de distribución sin recursos externos: correctas.
- Siete pruebas nuevas en `tests/ui/redesign.spec.ts`: correctas. Incluyen el alta mediante la interfaz de un grupo de segundo y siete alumnos ficticios, asistencia y entregas sin conexión, persistencia tras recargar, lectura, observaciones y filtros, protección de borradores, teclado y recuperación de un fallo de almacenamiento. Se revisaron pantallas de 1280, 768 y 360 px.
- Las capturas están en `test-results/redesign-*.png` y solo contienen datos de prueba.

La suite histórica de base de datos devuelve 54 pruebas correctas y 11 fallidas. Los fallos corresponden a expectativas anteriores de selección, varios grupos y exportación, sobre archivos que ya estaban modificados antes del rediseño. Las pruebas históricas de interfaz también usan los antiguos selectores de ciclo/grupo y no se migraron en esta etapa. Por tanto, no se afirma que `pnpm test` esté completamente en verde.

Para ejecutar únicamente las pruebas del rediseño: `pnpm build` y `pnpm exec playwright test tests/ui/redesign.spec.ts`. La variable opcional `CN_UI_PORT` permite usar otro puerto si el de pruebas está ocupado. No se generó un instalador Windows nuevo.

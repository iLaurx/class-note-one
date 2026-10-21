# Reportes del grupo

Reportes permite elegir semana (lunes a domingo), mes calendario, todo el ciclo o fechas libres. Semana y mes se recortan al ciclo configurado. El ciclo completo usa sus fechas de inicio y fin; si no tiene fin, llega hasta hoy. Las fechas libres son inclusivas.

Se pueden combinar asistencia, actividades y tareas, lecturas y lista de alumnos. La selección de alumnos permite trabajar con el grupo completo o con alumnos concretos, sin imponer un límite de siete ni crear alumnos de ejemplo. El resumen, el detalle y los comentarios se eligen por separado. La vista previa consulta los registros reales; al descargar se vuelven a leer para tomar los datos más recientes. Solo ExcelJS se carga bajo demanda al exportar.

## Formato del Excel

El resumen presenta bloques cortos por contenido. Asistencia muestra totales por alumno y cuadrículas semanales; los periodos largos añaden porcentajes por mes con registros. Actividades y tareas muestra estados de entrega, una vista por día, semana o mes según el rango, matrices semanales de hasta seis tareas y su catálogo numerado junto a cada bloque. Cada bloque indica la semana completa, del lunes al domingo; la numeración vuelve a empezar en cada semana y cada actividad muestra su fecha. Lecturas muestra totales y, si se solicita, registros con sus fechas. Las hojas se crean únicamente para los contenidos elegidos, con títulos, fechas, bordes completos en cada celda, colores, nombres inmovilizados y configuración de impresión. El archivo no lleva notas explicativas automáticas ni marca del programa en el pie de página.

Los totales representan los registros al descargar; editar el archivo no actualiza ClassNote ni recalcula las cifras. Las observaciones privadas nunca se exportan. Las notas de asistencia y comentarios de entregas y lecturas requieren activar detalle y comentarios. El texto del usuario se conserva como texto seguro, sin convertirlo en fórmulas.

## Criterios de cálculo

- Asistencias = presentes + retardos. El porcentaje usa los estados capturados del alumno como denominador, incluyendo las faltas justificadas. Sin capturas, el porcentaje queda vacío, no en cero.
- «Sin capturar» cuenta días con algún pase de lista del grupo y sin estado del alumno. Los días sin lista no se presumen faltas ni días de clase. Este criterio se mantiene al seleccionar un solo alumno. Los fines de semana aparecen si tienen registros.
- Las tareas se filtran por fecha de asignación. Su estado es el guardado actualmente, no una reconstrucción de cómo estaba en una fecha pasada. Una entrega sin capturar cuenta como pendiente, no como no entregada. Incompletas y no entregadas se cuentan por separado.
- Se respeta la fecha de salida del alumno y se conservan incidencias históricas existentes. El formato se adapta a las matrículas guardadas, sin completar filas con alumnos ficticios.

## Comprobaciones

- `node --experimental-strip-types --test tests/db/excel-export.test.ts`: periodos, siete alumnos, cifras, las quince combinaciones de contenido, selección individual, vacíos, privacidad, texto seguro y reapertura de los XLSX. Genera cuatro libros ficticios, incluido un mes con 41 tareas repartidas en cuatro semanas, en `test-results/reports/`.
- `pnpm build` y `pnpm exec playwright test tests/ui/reports.spec.ts`: interfaz de 1280, 768 y 360 px, vista previa, selección, exportación sin conexión, cancelación, fallos y doble envío. La selección de archivos nativa se simula en estas pruebas.
- Ejecutar primero Playwright y después la prueba de Excel, porque Playwright limpia `test-results`.
- En Windows con Excel instalado: `powershell -File tests/native/check-reports-excel.ps1 -Render`. Abre los cuatro libros ficticios como solo lectura en una instancia oculta, comprueba la apertura normal y genera PDF para revisión visual. No modifica los archivos de origen.

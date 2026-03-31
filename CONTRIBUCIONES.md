# Cómo contribuir schemas al I-NET Intelligence

> **Para el equipo de desarrollo de Informat**
> Este documento explica cómo aportar el conocimiento de las tablas de I-NET
> para que la IA pueda responder preguntas sobre cualquier módulo del ERP.

---

## ¿Qué necesita la IA para funcionar?

El sistema convierte preguntas en español a SQL. Para hacerlo, necesita saber:

- Qué tablas existen en cada módulo
- Qué columnas tiene cada tabla
- **Qué significa cada columna en términos de negocio**

Los primeros dos puntos los puede obtener solo del servidor SQL. El tercero lo
saben ustedes — y es exactamente lo que nos hace falta.

**Ejemplo de lo que aportas:**

| Columna técnica | Sin tu aporte | Con tu aporte |
|----------------|---------------|---------------|
| `VFACLIRUM`    | —             | *"RUT del cliente"* |
| `VFATOTNET`    | —             | *"Total neto de la factura (sin IVA)"* |
| `VFAESTADO`    | —             | *"Estado: 0=pendiente, 1=despachado, 2=anulado"* |

Con esa descripción, la IA puede responder: *"¿Cuánto vendimos en febrero?"* correctamente.

---

## Tu asignación

| Programador | Módulo | Prefijo | Query a usar |
|-------------|--------|---------|-------------|
| **Dev 1** | Ventas | `VFA` | Ver abajo → cambia `VFA%` |
| **Dev 2** | Inventario / Existencias | `EXI` | Ver abajo → cambia `EXI%` |
| **Dev 3** | Compras / Adquisiciones | `ADQ` | Ver abajo → cambia `ADQ%` |
| **Dev 4** | Contabilidad | `CON` | Ver abajo → cambia `CON%` |
| **Dev 5** | Remuneraciones | `REM` | Ver abajo → cambia `REM%` |
| **Dev 6** | Bancos / Egresos | `BAN` + `EGR` | Dos queries, una planilla cada una |

> **Módulos adicionales** (si quieren más): `IMP`, `AFF`, `DDI`, `COT`, `PED`, `PRO`, `FIN`, `ATE`

---

## Paso 1 — Extraer las columnas desde SQL Server

Conecta a la base de datos de I-NET y ejecuta esta query. Cambia `VFA%` por
el prefijo de **tu módulo** (ejemplo: `EXI%`, `CON%`, etc.):

```sql
SELECT
    t.TABLE_NAME                                                  AS Tabla,
    ''                                                            AS Descripcion_Tabla,
    c.COLUMN_NAME                                                 AS Columna,
    ''                                                            AS Descripcion_Columna,
    c.DATA_TYPE                                                   AS Tipo,
    ISNULL(c.CHARACTER_MAXIMUM_LENGTH, c.NUMERIC_PRECISION)       AS Largo,
    ISNULL(c.NUMERIC_SCALE, 0)                                    AS Decimales
FROM INFORMATION_SCHEMA.TABLES   t
JOIN INFORMATION_SCHEMA.COLUMNS  c
     ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
WHERE t.TABLE_NAME  LIKE 'VFA%'       -- ← CAMBIA ESTO
  AND t.TABLE_TYPE  = 'BASE TABLE'
ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
```

---

## Paso 2 — Exportar a Excel

En SQL Server Management Studio:
1. Ejecuta la query
2. Clic derecho en los resultados → **"Save Results As..."**
3. Guarda como `VFA_schema.xlsx` (o `.csv`, también funciona)

---

## Paso 3 — Llenar las descripciones

Abre el archivo en Excel. Hay **dos columnas que debes llenar tú**:

### `Descripcion_Tabla` (una vez por tabla)
Escribe en palabras simples qué es esa tabla. Ejemplos:
- `"Encabezado de facturas de venta"`
- `"Detalle de líneas por factura"`
- `"Maestro de clientes"`

### `Descripcion_Columna` (una por columna)
Escribe qué significa esa columna. Cuanto más precisa, mejor responde la IA.

**Tips:**
- Si la columna guarda un código, especifica qué tipo: *"Código de cliente (RUT sin puntos ni guión)"*
- Si guarda estados, menciona los valores: *"Estado del documento: A=Activo, N=Anulado"*
- Si guarda montos, especifica la unidad: *"Monto total en pesos chilenos, sin IVA"*
- Si no sabes qué hace una columna, déjala en blanco — mejor sin descripción que con una incorrecta

### Ejemplo de planilla completada:

| Tabla    | Descripcion_Tabla              | Columna    | Descripcion_Columna                        | Tipo    | Largo | Decimales |
|----------|--------------------------------|------------|--------------------------------------------|---------|-------|-----------|
| VFAENCA  | Encabezado de facturas         | VFAENCNUM  | Número de factura                          | int     | 10    | 0         |
| VFAENCA  | Encabezado de facturas         | VFACLINUM  | RUT del cliente                            | varchar | 12    | 0         |
| VFAENCA  | Encabezado de facturas         | VFATOTNET  | Total neto sin IVA (pesos CLP)             | decimal | 15    | 2         |
| VFAENCA  | Encabezado de facturas         | VFAESTADO  | Estado: A=Activo, N=Anulado, P=Pendiente  | char    | 1     | 0         |
| VFADETA  | Detalle de líneas por factura  | VFADETLIN  | Número de línea dentro de la factura       | int     | 5     | 0         |
| VFADETA  | Detalle de líneas por factura  | VFAARTCOD  | Código de artículo                         | varchar | 15    | 0         |

---

## Paso 4 — Enviar tu planilla

Guarda el archivo con el nombre `PREFIJO_schema.xlsx` y envíaselo a Sebastián
(o súbelo a la carpeta compartida que él indique).

**No necesitas tocar ningún archivo del proyecto.** Sebastián se encarga de
integrar tu planilla con un script automático.

---

## Preguntas frecuentes

**¿Debo documentar TODAS las columnas?**
No. Enfócate en las columnas que son importantes para consultas de negocio:
montos, fechas, estados, claves de clientes/productos/proveedores.
Columnas internas del sistema (timestamps de auditoría, flags técnicos) puedes dejarlas vacías.

**¿Qué pasa si una tabla tiene 200 columnas?**
Documenta las 20-30 más relevantes para consultas. El sistema igual puede usar
las demás, solo que sin descripción la IA las entenderá menos.

**¿Tengo que instalar algo?**
No. Solo SQL Server Management Studio (que ya tienes) y Excel.

**¿Puedo agregar tablas que no aparecen en la query?**
Sí. Si sabes que hay una tabla importante que no tiene el prefijo estándar,
agrégala manualmente en la planilla con el mismo formato.

**¿Qué pasa si me equivoco en una descripción?**
No pasa nada grave. Sebastián revisa todo antes de integrarlo.
Lo peor que puede pasar es que la IA responda una pregunta con menos precisión.

---

## Cronograma sugerido

| Cuándo | Qué |
|--------|-----|
| Esta semana | Ejecutar query, exportar planilla, llenar descripciones |
| Próxima semana | Enviar planilla a Sebastián |
| Semana siguiente | Sebastián integra y prueba con la IA |

---

*Gracias por su contribución. Con el conocimiento que ustedes tienen de I-NET,
este sistema va a ser extraordinario.*

# I-NET Intelligence — Documento Técnico Interno
**Informat Chile | Última actualización: Marzo 2026**

> Este documento existe para que cualquier desarrollador nuevo, o el equipo actual después de meses sin tocar el código, pueda entender el sistema en 30 minutos y no repetir errores que ya costaron muchas horas resolver.

---

## 1. ¿Qué es este sistema?

**I-NET Intelligence** es un agente de IA que permite hacer preguntas en lenguaje natural sobre la base de datos de I-NET ERP.

El usuario escribe: *"¿Cuáles son los top 10 clientes de febrero?"*
El sistema responde con una tabla real extraída de SQL Server, sin que el usuario sepa que hubo SQL de por medio.

**Stack tecnológico:**
- **Frontend:** Next.js 14 (React, TypeScript, Tailwind CSS) → corre en puerto 3000
- **Backend (API):** NestJS (Node.js, TypeScript) → corre en puerto 3001
- **Base de datos:** SQL Server (I-NET ERP de Informat)
- **IA:** Anthropic Claude (claude-sonnet) vía API

---

## 2. Arquitectura en una imagen

```
Usuario (navegador/celular)
        ↓
  Next.js Frontend (puerto 3000)
        ↓  (proxy interno /api/*)
  NestJS API (puerto 3001)
        ↓                    ↓
  Claude API (Anthropic)   SQL Server (I-NET ERP)
```

El frontend **nunca habla directamente** con el API de NestJS ni con la base de datos. Todo pasa por el proxy de Next.js (`/web/app/api/`). Esto es importante: si agregas un nuevo endpoint en NestJS, necesitas también crear su ruta proxy en Next.js.

---

## 3. Archivos críticos — los que importan

### Backend (`/api/src/`)

| Archivo | Qué hace | Cuándo tocarlo |
|---|---|---|
| `query/query.service.ts` | **El más importante.** Contiene el system prompt de Claude, la lógica de KPIs y la ejecución de queries SQL | Cuando cambies qué puede responder la IA, o ajustes KPIs del dashboard |
| `query/query.controller.ts` | Endpoints HTTP del API (`/query/kpis`, `/query/stream`) | Si agregas nuevos endpoints |
| `database/database.service.ts` | Conexión a SQL Server, ejecuta las queries | Si cambia el servidor de BD |
| `schema/schema.service.ts` | Descubre el schema de la BD y decide qué módulos de INET están disponibles | Si agregas nuevos módulos |
| `main.ts` | Arranca el servidor en el puerto 3001 | Casi nunca |

### Frontend (`/web/`)

| Archivo | Qué hace | Cuándo tocarlo |
|---|---|---|
| `components/chat/WelcomeScreen.tsx` | **Dashboard de KPIs** — las tarjetas, selector de mes, Top 10 | Cuando cambies el dashboard |
| `app/(app)/dashboard/page.tsx` | **Pantalla principal del chat** — donde el usuario hace preguntas | Cuando cambies la interfaz del chat |
| `components/chat/ChatInput.tsx` | Input donde el usuario escribe | Si cambias cómo se envían preguntas |
| `components/layout/Sidebar.tsx` | Sidebar con historial de conversaciones | Si cambias la navegación |
| `lib/api.ts` | Funciones que llaman al API desde el frontend | Cuando cambies o agregues endpoints |
| `app/api/query/kpis/route.ts` | **Proxy** del endpoint de KPIs (pasa `?year=&month=` al backend) | Si cambias los parámetros de KPIs |

---

## 4. La regla más importante del sistema — FechaDocumento

> **⚠️ Esta fue la decisión que más tiempo costó. No cambiarla sin entender el porqué.**

En la vista `INFORMAT_Vista_DocumentosComerciales` existen tres campos de fecha:

| Campo | Tipo | Qué es | ¿Usar para filtrar? |
|---|---|---|---|
| `FechaDocumento` | datetime | Fecha de emisión del DTE (documento tributario) | ✅ SÍ — SIEMPRE |
| `FechaAtencion` | datetime | Fecha en que se registró internamente en el sistema | ❌ NO |
| `[Periodo]` | varchar YYYYMM | Derivado de FechaAtencion | ❌ NO |

**¿Por qué solo FechaDocumento?**

En Chile es legal (y muy común) emitir facturas del mes anterior hasta el día 8 del mes siguiente. Por ejemplo: una factura de febrero puede emitirse el 5 de marzo. En ese caso:
- `FechaDocumento` = febrero (fecha real del documento)
- `FechaAtencion` = marzo (cuando se registró en el sistema)
- `[Periodo]` = `202603` (basado en FechaAtencion → incorrecto)

Si filtras por `[Periodo]` o `FechaAtencion`, **las ventas nunca van a cuadrar con el libro de ventas del SII**. Solo `FechaDocumento` coincide con la realidad tributaria.

**Forma correcta de filtrar un mes:**
```sql
WHERE YEAR(FechaDocumento) = 2026 AND MONTH(FechaDocumento) = 2
```

**⚠️ Trampa frecuente:** La columna se llama `FechaDocumento` (sin espacios, sin brackets). Existe la tentación de escribir `[Fecha Documento]` (con espacio) — esa columna NO EXISTE y genera error silencioso devolviendo 0 resultados.

---

## 5. Las Notas de Crédito son negativas — y eso es correcto

La vista `INFORMAT_Vista_DocumentosComerciales` incluye todos los tipos de documentos: facturas, boletas **y notas de crédito**. Las notas de crédito tienen `[Total Linea]` en **negativo**.

Cuando se hace `SUM([Total Linea])` sin filtrar tipo de documento, el resultado es la **venta neta real** (facturas + boletas − notas de crédito). Eso es exactamente lo que debe mostrar el sistema.

Si el usuario pide "ventas brutas sin descuentos", ahí sí se filtra:
```sql
WHERE UPPER(RTRIM([Nombre Documento])) NOT LIKE '%NOTA%'
```

---

## 6. Cómo funciona el chat (flujo técnico)

1. Usuario escribe pregunta en el frontend
2. Frontend envía POST a `/api/query/stream` (proxy Next.js)
3. Proxy reenvía a NestJS `/query/stream`
4. NestJS detecta qué módulos de INET están involucrados (ventas, contabilidad, etc.)
5. NestJS consulta el schema real de la BD para esos módulos
6. NestJS envía a Claude: system prompt + schema + pregunta del usuario
7. Claude genera SQL T-SQL en un bloque `[SQL]...[/SQL]`
8. NestJS extrae el SQL, lo valida, lo ejecuta contra SQL Server
9. Los resultados se envían de vuelta al frontend como **SSE (Server-Sent Events)**
10. El frontend filtra el bloque `[SQL]` del texto visible y muestra la tabla con los datos reales

**El usuario nunca ve el SQL.** Solo ve el texto en español y la tabla de resultados.

---

## 7. Dashboard de KPIs — cómo funciona

El dashboard al entrar muestra 6 KPIs y 2 tablas Top 10. Todo viene de **un solo endpoint**: `GET /query/kpis?year=2026&month=3`

El endpoint ejecuta **3 queries en paralelo** contra `INFORMAT_Vista_DocumentosComerciales`:
1. **Totales:** VentasMes, VentasMesAnterior, CostoVenta, Documentos, ClientesActivos
2. **Top 10 Clientes** del mes seleccionado
3. **Top 10 Productos** del mes seleccionado

Luego calcula:
- `ticketPromedio` = VentasMes ÷ Documentos
- `margenBruto` = (VentasMes − CostoVenta) ÷ VentasMes × 100
- `variacionPct` = variación % vs mes anterior

Si los parámetros `year` y `month` no se envían, usa el mes actual por defecto.

**⚠️ Trampa del proxy:** La ruta proxy `/web/app/api/query/kpis/route.ts` debe pasar `req.nextUrl.search` al backend para que los parámetros lleguen. Si esto se pierde, el selector de mes deja de funcionar y siempre muestra el mes actual.

---

## 8. Variables de entorno necesarias

### API (`/api/.env`)
```
# Base de datos I-NET ERP
DB_SERVER=<servidor SQL Server>
DB_NAME=<nombre base de datos>
DB_USER=<usuario>
DB_PASSWORD=<contraseña>
DB_PORT=1433

# Claude AI
ANTHROPIC_API_KEY=<clave de Anthropic>

# JWT para autenticación
JWT_SECRET=<secreto largo y aleatorio>

# URL del frontend (para CORS)
WEB_URL=http://localhost:3000

# Puerto del API
PORT=3001
```

### Frontend (`/web/.env.local`)
```
# URL del API de NestJS (server-side)
API_URL=http://localhost:3001

# URL pública del API (client-side, si se necesita)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 9. Cómo deployar — paso a paso

> Para Elías: estos son los pasos exactos cada vez que se entrega un ZIP nuevo.

### Paso 1 — Reemplazar archivos
Descomprimir el ZIP sobre la instalación existente. **No borrar** el archivo `.env` de producción (no está en el ZIP).

### Paso 2 — Compilar el API (si hay cambios en `/api/src/`)
```bash
cd api
npm run build
```
Esto genera la carpeta `/api/dist/` con el JavaScript compilado. **El servidor corre `dist/`, no el TypeScript fuente.** Si no se compila, el servidor corre código viejo aunque los `.ts` estén actualizados.

### Paso 3 — Compilar el Frontend (si hay cambios en `/web/`)
```bash
cd web
npm run build
```

### Paso 4 — Reiniciar completamente
```bash
# Matar el proceso actual (buscar el PID del proceso node)
pm2 restart inet-api      # si usan pm2
# o
pkill -f "node dist/main" # si corre directo
node dist/main            # reiniciar
```

> **⚠️ CRÍTICO:** Si no se reinicia el proceso, el servidor sigue corriendo el código anterior en memoria aunque los archivos hayan cambiado. Siempre reiniciar después de compilar.

### Paso 5 — Verificar
Abrir `http://servidor:3001/health` — debe responder `{ "status": "ok", "db": true, "llm": true }`.

---

## 10. Cómo funciona el system prompt de Claude

El system prompt se construye **dinámicamente** en cada request (función `buildSystemPrompt()` en `query.service.ts`). Esto permite que Claude siempre sepa la fecha actual y genere SQL con los años/meses correctos.

El system prompt le dice a Claude:
- Qué vista usar (`INFORMAT_Vista_DocumentosComerciales`)
- Qué columnas existen y qué significa cada una
- La regla de FechaDocumento (explicación legal de los DTEs en Chile)
- Que las notas de crédito son negativas y eso es correcto
- Ejemplos de queries SQL correctas (para que no los invente)
- Que NUNCA invente datos ni muestre placeholders
- El formato de respuesta esperado (texto en español + bloque `[SQL]`)
- Los follow-ups sugeridos al final en formato `[FOLLOWUPS][...][/FOLLOWUPS]`

**El system prompt es el "cerebro" del sistema.** Si la IA responde mal, casi siempre el fix está en el system prompt.

---

## 11. Errores conocidos y sus soluciones

| Error | Síntoma | Causa | Solución |
|---|---|---|---|
| SQL retorna 0 resultados | El chat no muestra datos | Columna `[Fecha Documento]` con espacio en el SQL | Verificar que sea `FechaDocumento` sin espacio |
| Datos no cambian al navegar meses | Selector muestra "Febrero" pero datos son de marzo | Proxy no pasa `?year=&month=` al backend | Verificar `req.nextUrl.search` en `/web/app/api/query/kpis/route.ts` |
| `[` al final de respuesta | Último carácter visible es `[` | Token de streaming parcial de `[FOLLOWUPS]` | Filtro en dashboard/page.tsx: `.replace(/\[[A-Z\/]{0,10}$/i, "")` |
| Año "2.025" en tablas | 2025 aparece como 2.025 | `inferColType` devuelve 'number' para columna Anio | Regex en `inferColType`: devolver 'string' para columnas de año/mes |
| Servidor corre código viejo | Fix aplicado pero no funciona | `dist/` no recompilado, proceso no reiniciado | `npm run build` + reiniciar proceso |
| Comparaciones siempre 0 | Pide feb 2025 vs 2026 y muestra cero | Claude hace dos queries separadas en vez de CASE WHEN | System prompt tiene ejemplo CASE WHEN explícito para este caso |

---

## 12. Decisiones de diseño que no son obvias

**¿Por qué SSE (streaming) y no una respuesta normal?**
Claude tarda entre 3-8 segundos en responder. Con SSE el texto aparece palabra por palabra, como ChatGPT. Si fuera una respuesta normal, el usuario vería pantalla en blanco 5 segundos. La experiencia sería inaceptable.

**¿Por qué el SQL va en `[SQL]...[/SQL]` dentro del texto de Claude?**
Claude genera texto y SQL mezclados en el stream. El frontend filtra el bloque `[SQL]` del texto visible, extrae el SQL, lo ejecuta y muestra la tabla por separado. El usuario ve texto limpio + tabla de datos reales, sin ver código SQL.

**¿Por qué RTRIM() en todos los GROUP BY?**
Los campos `CHAR` en SQL Server se rellenan con espacios hasta su longitud máxima. "TOTEAT S.A." puede estar guardado como "TOTEAT S.A.         " (con 20 espacios al final). Sin `RTRIM()`, el mismo cliente aparece como 15 registros distintos en un GROUP BY.

**¿Por qué el proxy de Next.js en vez de llamar al API directamente?**
Seguridad: el token JWT del usuario no puede exponerse en llamadas desde el navegador a un servidor externo. El proxy Next.js maneja las credenciales server-side.

---

## 13. Contacto y contexto del negocio

- **Empresa:** Informat Chile — fabricante del ERP I-NET
- **Dueño del proyecto:** Sebastián Segura
- **Usuario principal:** Gerente General de Informat (usa el sistema desde el celular)
- **Objetivo de negocio:** En el futuro, vender I-NET Intelligence como módulo adicional de I-NET ERP a los clientes de Informat. Para eso, el sistema deberá parametrizarse por cliente (hoy está configurado para Informat mismo).

---

*Documento generado en base al código real del proyecto. Actualizar cuando cambien decisiones de arquitectura importantes.*

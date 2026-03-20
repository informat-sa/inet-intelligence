# I-NET Intelligence 🧠

Portal de análisis de datos conversacional para **I-NET ERP de Informat**.
Permite a usuarios de negocio hacer preguntas en español natural y obtener respuestas con tablas, gráficos y SQL generado automáticamente, conectándose directamente a la base de datos SQL Server de INET.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│    Next.js Frontend (React, Tailwind CSS, shadcn/ui)        │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch /api/* (mismo origen)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Routes (Proxy Server-Side)         │
│   /api/query/stream  →  POST  NestJS /query/stream          │
│   /api/auth/login    →  POST  NestJS /auth/login            │
│   /api/health        →  GET   NestJS /health                │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch http://localhost:3001 (server-to-server)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   NestJS API (puerto 3001)                   │
│                                                             │
│  1. Detecta módulos INET relevantes a la pregunta           │
│  2. Carga schema de tablas del módulo                       │
│  3. Llama a Claude API (claude-3-5-sonnet) con contexto     │
│  4. Claude genera SQL + análisis en español                 │
│  5. Ejecuta SQL en SQL Server (SELECT only)                 │
│  6. Hace streaming del resultado al frontend (SSE)          │
└──────────┬───────────────────────────────────────┬──────────┘
           │                                       │
           ▼                                       ▼
  ┌────────────────┐                    ┌──────────────────────┐
  │  Anthropic API │                    │   SQL Server (INET)  │
  │  Claude 3.5    │                    │   Base INET_STD      │
  │  Sonnet        │                    │   (read-only)        │
  └────────────────┘                    └──────────────────────┘
```

### Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Estilos | Tailwind CSS v4, shadcn/ui |
| Estado | Zustand |
| Backend | NestJS 11, TypeScript |
| IA | Anthropic SDK (Claude 3.5 Sonnet) |
| Base de datos | mssql (SQL Server) |
| Streaming | Server-Sent Events (SSE) |
| Deploy API | Railway |
| Deploy Web | Vercel |

---

## Estructura de carpetas

```
inet-intelligence/
├── api/                          ← Backend NestJS
│   ├── src/
│   │   ├── main.ts               ← Entry point, CORS config
│   │   ├── app.module.ts         ← Módulo raíz
│   │   ├── query/
│   │   │   ├── query.controller.ts  ← POST /query/stream (SSE)
│   │   │   ├── query.service.ts     ← Lógica: demo mode, Claude, SQL
│   │   │   └── sql-validator.ts     ← Sanitización SQL (solo SELECT)
│   │   ├── schema/
│   │   │   └── schema.service.ts    ← Carga y filtra schema INET
│   │   ├── database/
│   │   │   └── database.service.ts  ← Conexión mssql, pool, executeQuery
│   │   ├── auth/                    ← (En desarrollo) Auth module
│   │   └── health/
│   │       └── health.controller.ts ← GET /health
│   ├── .env.example              ← Variables de entorno (ver abajo)
│   ├── railway.json              ← Config deploy Railway
│   └── package.json
│
├── web/                          ← Frontend Next.js
│   ├── app/
│   │   ├── (auth)/login/         ← Pantalla de login
│   │   ├── (app)/dashboard/      ← Dashboard principal + chat
│   │   └── api/                  ← Rutas proxy (server-side)
│   │       ├── query/stream/route.ts
│   │       ├── auth/login/route.ts
│   │       └── health/route.ts
│   ├── components/
│   │   ├── chat/                 ← ChatInput, Message, ResultTable, ResultChart
│   │   └── layout/               ← Sidebar
│   ├── lib/api.ts                ← Cliente fetch del frontend
│   ├── store/chat.ts             ← Estado global (Zustand)
│   ├── types/index.ts            ← Interfaces TypeScript
│   ├── .env.example              ← Variables de entorno (ver abajo)
│   └── vercel.json               ← Config deploy Vercel
│
└── README.md                     ← Este archivo
```

---

## Configuración de entorno

### API (`api/.env`)

Copia `api/.env.example` como `api/.env`:

```bash
cp api/.env.example api/.env
```

Variables clave:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DEMO_MODE` | `true` = sin API ni SQL (demo) | `false` |
| `ANTHROPIC_API_KEY` | API key de Anthropic | `sk-ant-api03-...` |
| `DB_SERVER` | Servidor SQL Server | `centauro` o `192.168.1.10` |
| `DB_DATABASE` | Base de datos INET | `INET_STD` |
| `DB_USER` | Usuario SQL (solo SELECT) | `inet_readonly` |
| `DB_PASSWORD` | Contraseña SQL | `***` |
| `DB_PORT` | Puerto SQL Server | `1433` |
| `DB_ENCRYPT` | TLS en conexión | `false` (LAN) / `true` (Azure) |
| `WEB_URL` | URL del frontend | `https://tu-app.vercel.app` |

### Web (`web/.env.local`)

Copia `web/.env.example` como `web/.env.local`:

```bash
cp web/.env.example web/.env.local
```

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `API_URL` | URL del backend NestJS | `http://localhost:3001` |
| `NEXT_PUBLIC_APP_NAME` | Nombre en la UI | `I-NET Intelligence` |

---

## Instalación y ejecución local

### Requisitos
- Node.js 20+
- npm 10+
- (Para producción) Acceso a SQL Server de INET y API key de Anthropic

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/TU_ORG/inet-intelligence.git
cd inet-intelligence

# 2. Instalar dependencias
cd api && npm install
cd ../web && npm install && cd ..

# 3. Configurar variables de entorno
cp api/.env.example api/.env
cp web/.env.example web/.env.local
# Editar ambos archivos con los valores correctos

# 4. Iniciar en modo desarrollo (2 terminales)
# Terminal 1 — API:
cd api && npm run start:dev

# Terminal 2 — Web:
cd web && npm run dev
```

El portal queda disponible en `http://localhost:3000`.

> **Modo Demo**: Con `DEMO_MODE=true` (default en `.env.example`) el sistema
> funciona completamente sin SQL Server ni API key de Anthropic. Ideal para
> presentaciones y pruebas de UI.

---

## Cómo funciona el flujo completo (modo producción)

```
Usuario escribe: "¿Cuánto vendimos en marzo comparado con febrero?"
         │
         ▼
1. Frontend → POST /api/query/stream
         │
         ▼
2. Next.js proxy → POST http://localhost:3001/query/stream
         │
         ▼
3. QueryService.detectModules() → detecta módulo "VFA" (Ventas y Facturación)
         │
         ▼
4. SchemaService.getSchemaForModules(['VFA']) → carga tablas VFA del schema JSON
         │
         ▼
5. Claude API recibe:
   - SYSTEM_PROMPT con reglas T-SQL + formato
   - Schema de tablas VFA (nombres, columnas, tipos)
   - Pregunta del usuario
         │
         ▼
6. Claude responde en streaming:
   - Análisis en español
   - Bloque SQL:  SELECT TOP 100 ... FROM VFADOCC WHERE ...
   - Follow-ups sugeridos: ["¿Y por cliente?", "¿Ver canal de venta?", ...]
         │
         ▼
7. sql-validator.ts valida que sea solo SELECT (seguridad)
         │
         ▼
8. DatabaseService.executeQuery(sql) → ejecuta en SQL Server
         │
         ▼
9. Resultado + datos → SSE stream al frontend
         │
         ▼
10. Frontend renderiza tabla/gráfico + chips de follow-up
```

---

## Exportar el schema de INET

El sistema necesita un archivo JSON con la estructura de tablas de INET.

### Opción A: Desde la base de datos (recomendado)

Ejecutar en SQL Server Management Studio:

```sql
SELECT
    t.TABLE_NAME,
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.NUMERIC_PRECISION,
    c.NUMERIC_SCALE,
    c.IS_NULLABLE
FROM INFORMATION_SCHEMA.TABLES t
JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME
WHERE t.TABLE_TYPE = 'BASE TABLE'
  AND t.TABLE_SCHEMA = 'dbo'
ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
FOR JSON PATH
```

Guardar el resultado como `api/src/schema/schema.json`.

### Opción B: Desde el exportador de INET

INET ERP incluye utilidades de exportación de diccionario de datos.
Consultar con el equipo de Informat por el archivo `diccionario_inet.json` o equivalente.

### Formato esperado

```json
[
  {
    "prefix": "VFA",
    "tables": [
      {
        "name": "VFADOCC",
        "description": "Cabeceras de documentos de venta",
        "attributes": [
          { "id": "VFADOCC001", "name": "NROORD", "title": "Número de Orden", "type": "N", "length": 10, "dec": 0 },
          { "id": "VFADOCC002", "name": "FECEMI", "title": "Fecha Emisión", "type": "C", "length": 8, "dec": 0 }
        ]
      }
    ]
  }
]
```

---

## Deploy en producción

### Opción 1: Vercel + Railway (recomendado)

#### API en Railway

1. Push del repositorio a GitHub
2. En [railway.app](https://railway.app): **New Project → Deploy from GitHub Repo**
3. Seleccionar la carpeta `api/` como **Root Directory**
4. Agregar variables de entorno en Railway:
   ```
   DEMO_MODE=false
   ANTHROPIC_API_KEY=sk-ant-api03-...
   DB_SERVER=tu-servidor-sql
   DB_DATABASE=INET_STD
   DB_USER=inet_readonly
   DB_PASSWORD=tu_password
   DB_PORT=1433
   DB_ENCRYPT=false
   WEB_URL=https://tu-app.vercel.app
   NODE_ENV=production
   ```
5. Railway detecta `railway.json` y ejecuta `npm run build && node dist/main`
6. Copiar la URL generada (ej: `https://inet-api.up.railway.app`)

#### Web en Vercel

1. En [vercel.com](https://vercel.com): **New Project → Import GitHub Repo**
2. Seleccionar `web/` como **Root Directory**
3. Agregar variable de entorno:
   ```
   API_URL=https://inet-api.up.railway.app
   NEXT_PUBLIC_APP_NAME=I-NET Intelligence
   ```
4. Deploy → obtener URL final (ej: `https://inet-intelligence.vercel.app`)
5. Volver a Railway y actualizar `WEB_URL=https://inet-intelligence.vercel.app`

### Opción 2: Servidor propio (Docker)

```bash
# API
cd api
npm run build
NODE_ENV=production node dist/main

# Web
cd web
npm run build
npm run start
```

O con Docker Compose (crear `docker-compose.yml` basado en Dockerfiles en cada carpeta).

---

## Seguridad

| Medida | Implementación |
|--------|---------------|
| Solo SELECT | `sql-validator.ts` rechaza INSERT/UPDATE/DELETE/DROP |
| Usuario read-only | DB_USER debe tener solo permisos SELECT |
| Sin credenciales en código | Todo via variables de entorno |
| API key server-side | `ANTHROPIC_API_KEY` nunca llega al browser |
| Proxy Next.js | Browser nunca conecta directo a la API NestJS |
| CORS estricto | API solo acepta origin = WEB_URL en producción |

---

## Módulos INET soportados

| Prefijo | Nombre | Descripción |
|---------|--------|-------------|
| VFA | Ventas y Facturación | Órdenes, facturas, clientes, precios |
| CCC | Cuentas por Cobrar | Cartera, cobranzas, vencimientos |
| ADQ | Adquisiciones y Compras | OC, cotizaciones, proveedores |
| IMP | Importaciones | Carpetas, internación, aduanas |
| EXI | Existencias e Inventario | Stock, bodegas, movimientos |
| PRO | Productos | Maestro artículos, categorías, lotes |
| AFF | Activo Fijo | Bienes, depreciación, bajas |
| REM | Remuneraciones y RRHH | Sueldos, AFP, liquidaciones |
| CON | Contabilidad General | Asientos, balance, centros de costo |
| SII | SII y Documentos Tributarios | DTE, IVA, F29 |
| PAR | Parámetros del Sistema | Config, monedas, sucursales |
| DDI | Distribución y Despacho | Guías, rutas, transportistas |
| FIN | Finanzas y Tesorería | Flujo de caja, bancos |
| GAN | Granos (Vertical Molinero) | Trigo, romanajes, harinas |
| ATE | Atención a Clientes | Tickets, SLA, contratos |

---

## Pendientes para el equipo de producto

- [ ] **Conectar SQL Server real**: Configurar `DB_SERVER`, `DB_USER`, `DB_PASSWORD` en `api/.env` y cambiar `DEMO_MODE=false`
- [ ] **Obtener API key de Anthropic**: En [console.anthropic.com](https://console.anthropic.com/settings/keys), plan Team o individual, modelo `claude-3-5-sonnet-20241022`
- [ ] **Exportar schema de INET**: Generar `api/src/schema/schema.json` con el diccionario de datos real de INET_STD
- [ ] **Implementar AuthModule**: El login actual es una demo. Se necesita integrar con el directorio de usuarios de Informat (Active Directory o tabla de usuarios INET)
- [ ] **Ajustar SYSTEM_PROMPT**: En `api/src/query/query.service.ts`, línea ~55, personalizar el prompt con nombres de tablas específicas más frecuentes y reglas de negocio de cada cliente
- [ ] **Módulo de historial**: La ruta `/history` existe en el sidebar pero aún no está implementada
- [ ] **Deploy en Vercel + Railway**: Seguir pasos del README sección "Deploy en producción"

---

## Contacto

Proyecto desarrollado para **Informat** — Soluciones ERP.
Portal I-NET Intelligence v1.0 — Marzo 2026.

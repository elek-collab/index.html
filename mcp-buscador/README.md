# Buscador MCP · DelegaloAI

Conector personalizado (servidor MCP remoto) que da a Claude búsquedas web de verdad, al estilo de Claude Code, desde la app de Claude, el chat web o CarPlay. Por dentro llama a la API de Claude con las herramientas `web_search` y `web_fetch`.

## Herramientas

| Herramienta | Para qué |
|---|---|
| `buscar_en_internet` | Preguntas rápidas de cualquier tema: noticias, datos, aves, sitios, horarios… |
| `investigar_a_fondo` | Informes, comparativas, análisis de mercado o competencia (1-3 min) |
| `buscar_empresas` | Prospección: empresas de un sector y zona con web, teléfono, email y por qué encajan |
| `ficha_empresa` | Datos de contacto y contexto de una empresa concreta |
| `leer_pagina` | Leer y resumir una URL |

## Desplegar en Render (recomendado)

1. En [render.com](https://render.com) → **New → Blueprint** → elige el repo `elek-collab/index.html`. Usa el `render.yaml` de la raíz.
2. Pega tu `ANTHROPIC_API_KEY` cuando lo pida. `CLAVE_MCP` se genera sola.
3. Cuando termine, copia la URL del servicio (p. ej. `https://buscador-mcp.onrender.com`) y el valor de `CLAVE_MCP` (Environment del servicio).

El plan gratuito de Render se duerme tras 15 min sin uso y la primera búsqueda tarda ~1 min en despertar; para el coche conviene el plan de pago más barato.

También funciona en cualquier sitio que ejecute Docker (Railway, Fly.io, Cloud Run…) con el `Dockerfile` de esta carpeta y las mismas dos variables.

## Conectarlo a Claude

1. claude.ai → **Ajustes → Conectores → Añadir conector personalizado**.
2. Nombre: `Buscador`. URL:
   ```
   https://TU-SERVICIO.onrender.com/mcp/TU_CLAVE_MCP
   ```
3. Guardar y activarlo en el chat. Al estar en tu cuenta, aparece también en la app del móvil y en CarPlay.

Para Claude Code:
```
claude mcp add --transport http buscador https://TU-SERVICIO.onrender.com/mcp/TU_CLAVE_MCP
```

La clave en la URL es la contraseña del conector: no la compartas. Si se filtra, cambia `CLAVE_MCP` en Render y actualiza la URL del conector.

## En local

```
cp .env.example .env   # rellena las dos variables
npm install
npm run build
set -a; . ./.env; set +a; npm start
```

Servidor en `http://localhost:3000/mcp/<CLAVE_MCP>`.

## Notas

- Modelo: `claude-opus-5-5` por defecto (variable `MODELO_CLAUDE` para cambiarlo).
- Si Claude rechaza una petición por sus filtros de seguridad, la API la reintenta sola con otro modelo (`fallbacks: "default"`).
- Cada búsqueda cuesta lo que consuma en la API de Anthropic más 10 $ por cada 1000 búsquedas web.

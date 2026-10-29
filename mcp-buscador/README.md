# Buscador MCP · DelegaloAI

Conector personalizado (servidor MCP remoto) para Claude. Cuando Claude lo usa, el VPS lanza **Claude Code** con búsqueda web y lectura de páginas y devuelve el resultado. Así tienes las búsquedas de Claude Code desde el chat, la app del móvil y CarPlay.

Claude Code se ejecuta solo con `WebSearch` y `WebFetch`: no puede tocar archivos ni ejecutar comandos en el VPS.

## Herramientas

| Herramienta | Para qué |
|---|---|
| `buscar_en_internet` | Preguntas rápidas de cualquier tema: noticias, datos, aves, sitios, horarios… |
| `investigar_a_fondo` | Informes, comparativas, análisis de mercado o competencia (1-3 min) |
| `buscar_empresas` | Prospección: empresas de un sector y zona con web, teléfono, email y por qué encajan |
| `ficha_empresa` | Datos de contacto y contexto de una empresa concreta |
| `leer_pagina` | Leer y resumir una URL |

## Instalar en el VPS

Necesitas Node 20 o superior y Claude Code con la sesión iniciada:

```
npm install -g @anthropic-ai/claude-code
claude          # la primera vez: inicia sesión con tu cuenta y sal con /exit
```

Después:

```
cd /opt
git clone -b claude/mcp-personalizado-claude-code-6c45ay https://github.com/elek-collab/index.html
cd index.html/mcp-buscador
npm install
npm run build
cp .env.example .env
echo "CLAVE_MCP=$(openssl rand -hex 24)" >> .env
```

Arrancarlo como servicio (se reinicia solo y arranca con el VPS):

```
cp buscador-mcp.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now buscador-mcp
systemctl status buscador-mcp
```

Si clonas en otra carpeta o usas otro usuario, cambia `WorkingDirectory`, `EnvironmentFile` y `User` en `buscador-mcp.service`. El usuario tiene que ser el mismo con el que iniciaste sesión en Claude Code.

## HTTPS

Claude solo acepta conectores con `https://`. Publica el puerto 3100 con el mismo proxy que uses para el conector de WhatsApp. Por ejemplo, con Caddy y un subdominio que apunte al VPS:

```
buscador.tudominio.com {
    reverse_proxy localhost:3100
}
```

Con Nginx, una ruta `location /mcp/ { proxy_pass http://localhost:3100; proxy_buffering off; proxy_read_timeout 300s; }` dentro del dominio que ya tengas.

## Conectarlo a Claude

1. claude.ai → **Ajustes → Conectores → Añadir conector personalizado**.
2. Nombre: `Buscador`. URL (la clave es la de `.env`):
   ```
   https://buscador.tudominio.com/mcp/TU_CLAVE_MCP
   ```
3. Guardar y activarlo. Aparece también en la app del móvil y en CarPlay.

La clave en la URL es la contraseña del conector: no la compartas. Si se filtra, cámbiala en `.env`, ejecuta `systemctl restart buscador-mcp` y actualiza la URL del conector.

## Comprobar que va

```
curl https://buscador.tudominio.com/              # "Buscador MCP de DelegaloAI funcionando"
journalctl -u buscador-mcp -f                       # ver lo que pasa en directo
```

## Opcional: usar la API en vez de Claude Code

Pon `MOTOR=api` y `ANTHROPIC_API_KEY=...` en `.env` y reinicia. Así no depende de la sesión de Claude Code y lo que gastes se cobra en la cuenta de la API.

Ojo: si `ANTHROPIC_API_KEY` está definida en el VPS, Claude Code también la usará y lo cobrará en la API en lugar de en tu suscripción.

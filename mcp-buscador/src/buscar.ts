import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "node:child_process";

// "claude-code" usa el Claude Code instalado en el servidor (tu suscripción);
// "api" llama directamente a la API de Anthropic con ANTHROPIC_API_KEY.
export const MOTOR = process.env.MOTOR === "api" ? "api" : "claude-code";

const client = MOTOR === "api" ? new Anthropic() : undefined;

const MODEL = process.env.MODELO_CLAUDE || "claude-opus-5-5";
const MAX_CONTINUACIONES = 5;

type Esfuerzo = "low" | "medium" | "high";

export interface OpcionesBusqueda {
  esfuerzo?: Esfuerzo;
  maxBusquedas?: number;
  leerPaginas?: boolean;
}

const SISTEMA = `Eres el buscador de DelegaloAI. Investigas en internet y devuelves lo que has encontrado a otro asistente que se lo cuenta al usuario, a menudo por voz mientras conduce.
- Responde en español, directo y sin relleno. Empieza por la respuesta, después los detalles.
- Comprueba los datos en fuentes fiables y recientes; si algo no está confirmado, dilo.
- No inventes teléfonos, emails ni webs: pon solo lo que hayas visto en una fuente.
- No uses tablas. Listas cortas sí.
- Hoy es ${new Date().toISOString().slice(0, 10)}.`;

/**
 * Lanza una búsqueda con Claude usando las herramientas web del servidor
 * (web_search y web_fetch) y devuelve el texto final con las fuentes.
 */
export async function buscar(peticion: string, opciones: OpcionesBusqueda = {}): Promise<string> {
  return MOTOR === "api" ? buscarConApi(peticion, opciones) : buscarConClaudeCode(peticion, opciones);
}

/**
 * Ejecuta Claude Code en modo no interactivo con solo WebSearch y WebFetch:
 * no puede tocar archivos ni ejecutar comandos del servidor.
 */
function buscarConClaudeCode(peticion: string, opciones: OpcionesBusqueda): Promise<string> {
  const { esfuerzo = "low" } = opciones;
  const herramientas = "WebSearch,WebFetch";
  const args = [
    "-p",
    "--output-format", "json",
    "--tools", herramientas,
    "--allowedTools", herramientas,
    "--append-system-prompt", SISTEMA,
    "--effort", esfuerzo,
    "--no-session-persistence",
    "--strict-mcp-config",
    "--setting-sources", "",
  ];
  if (process.env.MODELO_CLAUDE) args.push("--model", process.env.MODELO_CLAUDE);

  return new Promise((resolve, reject) => {
    const hijo = spawn(process.env.CLAUDE_BIN || "claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let salida = "";
    let errores = "";
    const limite = setTimeout(() => hijo.kill("SIGTERM"), 5 * 60_000);
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (errores += d));
    hijo.on("error", (err) => {
      clearTimeout(limite);
      reject(new Error(`No se pudo ejecutar Claude Code: ${err.message}`));
    });
    hijo.on("close", (codigo) => {
      clearTimeout(limite);
      try {
        const json = JSON.parse(salida);
        if (json.is_error) return reject(new Error(json.result || "Claude Code devolvió un error"));
        resolve(String(json.result ?? "").trim());
      } catch {
        reject(new Error(`Claude Code terminó con código ${codigo}: ${(errores || salida).slice(0, 500)}`));
      }
    });
    hijo.stdin.end(peticion);
  });
}

async function buscarConApi(peticion: string, opciones: OpcionesBusqueda): Promise<string> {
  const { esfuerzo = "low", maxBusquedas = 6, leerPaginas = true } = opciones;

  const tools: Anthropic.Beta.Messages.BetaToolUnion[] = [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: maxBusquedas,
      user_location: { type: "approximate", country: "ES", timezone: "Europe/Madrid" },
    },
  ];
  if (leerPaginas) {
    tools.push({ type: "web_fetch_20260209", name: "web_fetch", max_uses: maxBusquedas });
  }

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: peticion }];
  let respuesta: Anthropic.Beta.Messages.BetaMessage | undefined;

  for (let i = 0; i <= MAX_CONTINUACIONES; i++) {
    respuesta = await client!.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        system: SISTEMA,
        thinking: { type: "adaptive" },
        output_config: { effort: esfuerzo },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        tools,
        messages,
      })
      .finalMessage();

    if (respuesta.stop_reason !== "pause_turn") break;
    // El servidor retoma solo si le devolvemos su turno tal cual.
    if (messages.length === 1) {
      messages.push({ role: "assistant", content: respuesta.content });
    } else {
      messages[1] = { role: "assistant", content: respuesta.content };
    }
  }

  if (!respuesta) throw new Error("Sin respuesta de Claude");
  if (respuesta.stop_reason === "refusal") {
    return "No he podido hacer esta búsqueda.";
  }

  const texto = respuesta.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return texto + formatearFuentes(respuesta.content);
}

function formatearFuentes(content: Anthropic.Beta.Messages.BetaContentBlock[]): string {
  const fuentes = new Map<string, string>();
  for (const bloque of content) {
    if (bloque.type !== "text" || !bloque.citations) continue;
    for (const cita of bloque.citations) {
      if (cita.type === "web_search_result_location" && !fuentes.has(cita.url)) {
        fuentes.set(cita.url, cita.title ?? cita.url);
      }
    }
  }
  if (fuentes.size === 0) return "";
  const lineas = [...fuentes].slice(0, 8).map(([url, titulo]) => `- ${titulo}: ${url}`);
  return `\n\nFuentes:\n${lineas.join("\n")}`;
}

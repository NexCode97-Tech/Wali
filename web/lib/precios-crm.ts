/** Planes del CRM (en USD), con precio según los usuarios (8-oct): `mensual` es el «desde» de cada plan. Anual = 20 % de descuento. La IA y WhatsApp los paga cada empresa directo a su proveedor. */
export type Plan = {
  id: "starter" | "growth" | "business";
  nombre: string;
  para: string;
  mensual: number;
  /** Usuarios que cubre el plan, para la barra de /precios. */
  rango: string;
  /** Lo que se paga en el plan anual (mensual × 12 con 20 % de descuento), ya escrito para mostrar. */
  anual: string;
  /** Mensual × 12, tachado junto al precio anual. */
  anualSinDescuento: string;
  /** Lo que equivale el anual por mes, redondeado. */
  equivaleMes: string;
  ahorro: string;
  cta: string;
  prueba?: boolean;
  destacado?: boolean;
  ficha: { k: string; v: string; tono?: "si" | "no" }[];
  base?: string;
  incluye: string[];
};

export const PLANES: Plan[] = [
  {
    id: "starter", nombre: "Starter", para: "Para centralizar la atención de un equipo pequeño en una sola bandeja.",
    mensual: 59, rango: "De 3 a 5 usuarios", anual: "566", anualSinDescuento: "USD 708", equivaleMes: "USD 47", ahorro: "ahorras USD 142", cta: "Empezar prueba gratis", prueba: true,
    ficha: [{ k: "Espacios de trabajo", v: "1" }, { k: "Usuarios", v: "3 a 5" }, { k: "Conversaciones", v: "Ilimitadas" }, { k: "Líneas de WhatsApp", v: "Ilimitadas" }, { k: "Agentes de IA", v: "No incluye", tono: "no" }, { k: "Respuestas de IA", v: "No incluye", tono: "no" }],
    incluye: ["WhatsApp, Instagram, Messenger y chat web", "Bandeja compartida con etiquetas y etapas", "Equipos y subequipos", "Respuestas rápidas y notas internas", "Horario de atención y reparto básico", "Soporte por correo"],
  },
  {
    id: "growth", nombre: "Growth", para: "Para equipos que venden por varios canales y quieren automatizar con IA.",
    mensual: 139, rango: "De 6 a 10 usuarios", anual: "1.334", anualSinDescuento: "USD 1.668", equivaleMes: "USD 111", ahorro: "ahorras USD 334", cta: "Elegir Growth", destacado: true,
    ficha: [{ k: "Espacios de trabajo", v: "3" }, { k: "Usuarios", v: "6 a 10" }, { k: "Conversaciones", v: "Ilimitadas" }, { k: "Líneas de WhatsApp", v: "Ilimitadas" }, { k: "Agentes de IA", v: "2 agentes", tono: "si" }, { k: "Respuestas de IA", v: "Sin límite, con tu cuenta", tono: "si" }],
    base: "Todo lo de Starter, y además:",
    incluye: ["Telegram, TikTok y correo", "Reparto automático y flujos de bienvenida", "Difusiones y embudo de ventas", "2 agentes de IA con tu base de conocimiento", "Transcripción de notas de voz", "Integraciones y API", "Soporte por WhatsApp"],
  },
  {
    id: "business", nombre: "Business", para: "Para operaciones grandes con varios equipos, más IA y control fino.",
    mensual: 259, rango: "11 usuarios o más", anual: "2.486", anualSinDescuento: "USD 3.108", equivaleMes: "USD 207", ahorro: "ahorras USD 622", cta: "Elegir Business",
    ficha: [{ k: "Espacios de trabajo", v: "6" }, { k: "Usuarios", v: "11 a 15 + USD 20 por extra" }, { k: "Conversaciones", v: "Ilimitadas" }, { k: "Líneas de WhatsApp", v: "Ilimitadas" }, { k: "Agentes de IA", v: "Ilimitados", tono: "si" }, { k: "Respuestas de IA", v: "Sin límite, con tu cuenta", tono: "si" }],
    base: "Todo lo de Growth, y además:",
    incluye: ["Agentes de IA ilimitados, uno por equipo", "Sugerencias y análisis del embudo con IA", "Roles, permisos y usuarios de solo lectura", "Enlaces de pauta con atribución", "Soporte prioritario y configuración guiada"],
  },
];

/** Tabla comparativa: true = incluido, false = no, texto = valor. Columnas: Starter, Growth, Business. */
export const COMPARATIVA: { grupo: string; filas: [string, boolean | string, boolean | string, boolean | string][] }[] = [
  { grupo: "Equipo y bandeja", filas: [
    ["Espacios de trabajo (una empresa cada uno)", "1", "3", "6"],
    ["Usuarios (entre todos los espacios)", "3 a 5", "6 a 10", "11 a 15"],
    ["Usuario adicional", false, false, "USD 20 al mes"],
    ["Conversaciones", "Ilimitadas", "Ilimitadas", "Ilimitadas"],
    ["Bandeja compartida, etiquetas y etapas", true, true, true],
    ["Equipos y subequipos", true, true, true],
    ["Roles, permisos y solo lectura", "Básicos", "Básicos", "Avanzados"],
  ] },
  { grupo: "Canales", filas: [
    ["Líneas de WhatsApp", "Ilimitadas", "Ilimitadas", "Ilimitadas"],
    ["Instagram, Messenger y chat web", true, true, true],
    ["Telegram, TikTok y correo", false, true, true],
  ] },
  { grupo: "Automatización", filas: [
    ["Reparto de conversaciones", "Básico", "Automático", "Automático"],
    ["Flujos de bienvenida", false, true, true],
    ["Difusiones a contactos", false, true, true],
    ["Enlaces de pauta con atribución", false, false, true],
  ] },
  { grupo: "Inteligencia artificial (con tu propia cuenta)", filas: [
    ["Agentes de IA", false, "2", "Ilimitados"],
    ["Respuestas de IA", false, "Sin límite", "Sin límite"],
    ["Base de conocimiento (PDF, Word, Excel)", false, true, true],
    ["Transcripción de notas de voz", false, true, true],
    ["Sugerencias y análisis del embudo", false, false, true],
  ] },
  { grupo: "Informes y soporte", filas: [
    ["Informes", "Básicos", "Completos", "Completos"],
    ["Encuestas de satisfacción", false, true, true],
    ["Integraciones y API", false, true, true],
    ["Soporte", "Correo", "WhatsApp", "Prioritario"],
  ] },
];

export const PREGUNTAS: [string, string][] = [
  ["¿Qué cuenta como usuario?", "Cada persona de tu equipo que entra al CRM con su propio correo. Los contactos y clientes con los que conversas no cuentan como usuarios. El mínimo son 3. Starter va de 3 a 5 usuarios, Growth de 6 a 10 y Business de 11 a 15; desde el usuario 16, cada uno cuesta USD 20 al mes."],
  ["¿Las conversaciones de verdad son ilimitadas?", "Sí. El CRM no cobra ni limita conversaciones ni líneas. Lo único que pagas por mensaje es lo que Meta cobra por WhatsApp, directo a tu cuenta."],
  ["¿Cómo se paga la IA?", "Desde el plan Growth conectas tu propia cuenta del proveedor de IA y él te cobra directo, según lo que uses. Una respuesta del agente suele costar alrededor de un centavo de dólar. NexCode97 no cobra recargo ni vende créditos, y te ayudamos a conectarla en minutos."],
  ["¿Puedo cambiar de plan o cancelar?", "Cuando quieras, desde Ajustes. Si subes de plan se cobra solo la diferencia; si cancelas, el plan sigue activo hasta el final del periodo pagado."],
  ["¿Los precios incluyen impuestos?", "Los precios están en dólares. Al pagar se suman los impuestos que correspondan a tu país, calculados automáticamente."],
];

/** Mínimo de usuarios y la barra de /precios (8-oct): Starter 59 + 20 por usuario desde 3; Growth 139 + 10 desde 6;
 *  Business 259 + 10 desde 11 hasta 15 (299), y de ahí USD 20 por cada usuario extra. */
export const USUARIOS_MIN = 3;
export function precioPorUsuarios(n: number): { plan: Plan["id"]; mensual: number; extra: number } {
  if (n <= 5) return { plan: "starter", mensual: 59 + 20 * (n - 3), extra: 0 };
  if (n <= 10) return { plan: "growth", mensual: 139 + 10 * (n - 6), extra: 0 };
  if (n <= 15) return { plan: "business", mensual: 259 + 10 * (n - 11), extra: 0 };
  return { plan: "business", mensual: 299 + 20 * (n - 15), extra: n - 15 };
}

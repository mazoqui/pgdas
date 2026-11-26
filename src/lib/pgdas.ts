/**
 * Reads the Simples Nacional rates off a PGDAS-D "Extrato do Simples Nacional".
 *
 * Ported from hcare `backend/src/nfse/pgdas.js` (same rules, same refusals), but
 * it returns every intermediate figure so the page can explain the result.
 *
 * Nothing is computed from the Anexos: the statement already says what the DAS
 * charged on what revenue, and the rates are those two divided. Only an activity
 * whose ISS is in the DAS can answer. A withheld one shows ISS 0,00, so dividing
 * the whole statement understates both rates.
 *
 * A statement this does not fully understand is refused rather than guessed at:
 * these figures go on fiscal documents.
 */

const MONEY = "\\d{1,3}(?:\\.\\d{3})*,\\d{2}";
/** Two activities of one rate can differ by this much, from the DAS' rounding alone. */
export const RATE_TOLERANCE = 0.02;

export type PgdasErrorCode =
  | "pgdas_unreadable"
  | "pgdas_declaration"
  | "pgdas_fixed_values"
  | "pgdas_no_revenue"
  | "pgdas_revenue_mismatch"
  | "pgdas_only_withheld"
  | "pgdas_mixed_rates"
  | "pgdas_no_iss";

export class PgdasError extends Error {
  readonly code: PgdasErrorCode;
  constructor(code: PgdasErrorCode) {
    super(code);
    this.code = code;
  }
}

export interface Activity {
  /** The activity's description, as the statement writes it after "Prestação de Serviços,". */
  description: string;
  withheld: boolean;
  /** Cents. */
  revenue: number;
  /** Each tax column, by the name of the block's own header, in cents. */
  taxes: { name: string; value: number }[];
  /** Cents. */
  iss: number;
  /** Cents. */
  total: number;
  /** % of the revenue, unrounded. */
  totalRate: number;
  /** % of the revenue, unrounded. */
  issRate: number;
}

export interface PgdasResult {
  /** "MM/AAAA" as printed. */
  period: string;
  /** "MM/AAAA": the first month these rates are used on a note. */
  from: string;
  companyCnpj: string;
  companyName: string;
  /** Cents. */
  declaredRevenue: number;
  /** Cents; null when the statement does not print it. */
  rbt12: number | null;
  /** Cents: the proportional RBT12 of a company in its first year; null when empty. */
  rbt12p: number | null;
  /** Cents; null when the statement does not print it. */
  payroll12: number | null;
  /** As printed, e.g. "0,10"; null when absent. */
  fatorR: string | null;
  /** "III", "V"... as printed next to the Fator r; null when absent. */
  anexo: string | null;
  issOutside: boolean;
  activities: Activity[];
  /** The activity the rates were read from: the first one with ISS in the DAS. */
  reference: Activity;
  /** "15.50"-style strings, rounded to 2 decimals. */
  total: string;
  /** Empty when the ISS is outside the DAS. */
  iss: string;
  /** Unrounded %. */
  totalExact: number;
  issExact: number;
}

export const cents = (text: string) => Math.round(Number(text.replace(/\./g, "").replace(",", ".")) * 100);
const rate = (part: number, whole: number) => (part / whole) * 100;

/**
 * Each activity's revenue and debit. A block without its figures fails the sum in `parsePgdas`.
 *
 * The columns are read by name from the block's own header, not by position: from
 * 2027 the Anexos of LC 214/2025 put CBS and IBS in the DAS (and PIS/COFINS out),
 * and a fixed position would then read the wrong tax without noticing. The columns
 * have to add up to the Total, or the block is not what this thinks it is.
 */
const readActivities = (text: string): Activity[] =>
  text
    .split("Valor do Débito por Tributo para a Atividade")
    .slice(1)
    .flatMap((block) => {
      const revenue = block.match(new RegExp(`Receita Bruta Informada: R\\$ (${MONEY})`));
      const table = block.match(new RegExp(`((?:[A-Z][A-Za-z/]* )+)Total((?: ${MONEY})+)`));
      if (!revenue || revenue.index === undefined || !table) return [];
      const names = table[1].trim().split(" ");
      const values = table[2].trim().split(" ").map(cents);
      if (values.length < names.length + 1) return [];
      const taxes = names.map((name, index) => ({ name, value: values[index] }));
      const total = values[names.length];
      const sum = taxes.reduce((acc, tax) => acc + tax.value, 0);
      const iss = taxes.find((tax) => tax.name === "ISS");
      if (!iss || sum !== total) return [];
      const head = block.slice(0, revenue.index);
      const amount = cents(revenue[1]);
      return [
        {
          description: head
            .replace(/^\s*\(R\$\):\s*/, "")
            .replace(/^Prestação de Serviços,\s*/, "")
            .trim(),
          withheld: /com retenção\/substituição/i.test(head),
          revenue: amount,
          taxes,
          iss: iss.value,
          total,
          totalRate: rate(total, amount),
          issRate: rate(iss.value, amount),
        },
      ];
    });

const nextMonth = (month: number, year: number) =>
  month === 12 ? `01/${year + 1}` : `${String(month + 1).padStart(2, "0")}/${year}`;

/**
 * What one statement says: its period, and the rates of the month after it. A note
 * uses "a alíquota efetiva ... no mês anterior ao da prestação" (LC 123, art. 21,
 * §4º, I), so the statement of 09/2026 is the row that starts at 10/2026.
 */
export const parsePgdas = (text: string): PgdasResult => {
  if (!text.includes("Extrato do Simples Nacional") && /Declaratório|Nº da Declaração/.test(text)) {
    throw new PgdasError("pgdas_declaration");
  }
  const period = text.match(/Período de Apuração \(PA\): (\d{2})\/(\d{4})/);
  const company = text.match(/CNPJ Básico: (\d{2}\.\d{3}\.\d{3})/);
  const declared = text.match(new RegExp(`Receita Bruta do PA \\(RPA\\)[^\\d]*${MONEY} ${MONEY} (${MONEY})`));
  if (!text.includes("Extrato do Simples Nacional") || !period || !company || !declared) {
    throw new PgdasError("pgdas_unreadable");
  }
  if (!/2\.5\) Valores Fixos Não se aplica/.test(text)) throw new PgdasError("pgdas_fixed_values");

  const activities = readActivities(text);
  const declaredRevenue = cents(declared[1]);
  if (!declaredRevenue) throw new PgdasError("pgdas_no_revenue");
  // Every real of the period has to be in an activity read here, or one was missed.
  if (activities.reduce((sum, activity) => sum + activity.revenue, 0) !== declaredRevenue) {
    throw new PgdasError("pgdas_revenue_mismatch");
  }

  const own = activities.filter((activity) => !activity.withheld);
  if (!own.length) throw new PgdasError("pgdas_only_withheld");

  const first = own[0];
  const total = first.totalRate;
  const withoutIss = rate(first.total - first.iss, first.revenue);
  const mixed =
    own.some((activity) => Math.abs(activity.totalRate - total) > RATE_TOLERANCE) ||
    activities
      .filter((activity) => activity.withheld)
      .some((activity) => Math.abs(activity.totalRate - withoutIss) > RATE_TOLERANCE);
  if (mixed) throw new PgdasError("pgdas_mixed_rates");

  // Above the sublimit the ISS is the city's, out of the DAS, and there is no share.
  const issOutside = /Impedido de recolher ICMS\/ISS no DAS: Sim/.test(text);
  if (!first.iss && !issOutside) throw new PgdasError("pgdas_no_iss");

  const rbt12 = text.match(new RegExp(`doze meses anteriores ao PA \\(RBT12\\) ${MONEY} ${MONEY} (${MONEY})`));
  const rbt12p = text.match(new RegExp(`\\(RBT12p\\) (?:${MONEY}) (?:${MONEY}) (${MONEY})`));
  const payroll = text.match(new RegExp(`Total de Folhas de Salários Anteriores \\(R\\$\\) R\\$ (${MONEY})`));
  const fator = text.match(/Fator r = (\d+,\d+)(?: - Anexo ([IVX]+))?/);
  const name = text.match(/Nome Empresarial: (.+?) Data de Abertura/);
  const month = Number(period[1]);
  const year = Number(period[2]);

  return {
    period: `${period[1]}/${period[2]}`,
    from: nextMonth(month, year),
    companyCnpj: company[1],
    companyName: name?.[1].trim() ?? "",
    declaredRevenue,
    rbt12: rbt12 ? cents(rbt12[1]) : null,
    rbt12p: rbt12p ? cents(rbt12p[1]) : null,
    payroll12: payroll ? cents(payroll[1]) : null,
    fatorR: fator?.[1] ?? null,
    anexo: fator?.[2] ?? null,
    issOutside,
    activities,
    reference: first,
    total: total.toFixed(2),
    iss: first.iss ? first.issRate.toFixed(2) : "",
    totalExact: total,
    issExact: first.iss ? first.issRate : 0,
  };
};

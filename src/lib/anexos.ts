/**
 * The Simples Nacional rates by the Anexos of LC 123/2006, for checking what the
 * statement shows. Ported from hcare `backend/src/nfse/simples-anexos.js`.
 *
 * Only Anexos III and V: the activities subject to the Fator r (LC 123, art. 18,
 * §5º-I) move between them by it. The tables change with the year of the período
 * de apuração: LC 123's until 2026, then LC 214/2025's (as amended by LC 227/2026),
 * where CBS and IBS join the DAS and the ISS share shrinks until it is gone in 2033.
 *
 *   effective = (RBT12 × nominal − deduction) / RBT12
 *   ISS       = effective × the faixa's ISS share, at most the year's cap
 */

export type Anexo = "III" | "V";

/** RBT12 ceilings of the six faixas, in reais. */
export const CEILINGS = [180_000, 360_000, 720_000, 1_800_000, 3_600_000, 4_800_000];
/** From this Fator r on, the activity is taxed by Anexo III instead of V (art. 18, §5º-J). */
export const FATOR_R_ANEXO_III = 0.28;

/** [nominal %, deduction R$] per faixa. Only the 6ª faixa changes over the years. */
const nominal = (sixth: Record<Anexo, number>): Record<Anexo, [number, number][]> => ({
  III: [[6, 0], [11.2, 9_360], [13.5, 17_640], [16, 35_640], [21, 125_640], [sixth.III, 648_000]],
  V: [[15.5, 0], [18, 4_500], [19.5, 9_900], [20.5, 17_100], [23, 62_100], [sixth.V, 540_000]],
});
const NOMINAL_CURRENT = nominal({ III: 33, V: 30.5 });
const NOMINAL_2027 = nominal({ III: 32.9, V: 30.4 });

/**
 * ISS share of the effective rate per faixa (1ª-5ª; the 6ª has none: above the
 * sublimit the ISS is the city's), and the cap on the ISS effective rate.
 */
const ISS_SHARES: Record<number, { III: number[]; V: number[]; cap: number }> = {
  2026: { III: [33.5, 32, 32.5, 32.5, 33.5], V: [14, 17, 19, 21, 23.5], cap: 5 },
  2029: { III: [30.15, 28.8, 29.25, 29.25, 30.15], V: [12.6, 15.3, 17.1, 18.9, 21.15], cap: 4.5 },
  2030: { III: [26.8, 25.6, 26, 26, 26.8], V: [11.2, 13.6, 15.2, 16.8, 18.8], cap: 4 },
  2031: { III: [23.45, 22.4, 22.75, 22.75, 23.45], V: [9.8, 11.9, 13.3, 14.7, 16.45], cap: 3.5 },
  2032: { III: [20.1, 19.2, 19.5, 19.5, 20.1], V: [8.4, 10.2, 11.4, 12.6, 14.1], cap: 3 },
};

const tablesFor = (year: number) => ({
  nominal: year >= 2027 && year <= 2028 ? NOMINAL_2027 : NOMINAL_CURRENT,
  // 2027-2028 keep the current ISS shares; from 2033 there is no ISS at all.
  iss: year >= 2033 ? null : ISS_SHARES[year <= 2028 ? 2026 : year],
});

export interface AnexoCheck {
  anexo: Anexo;
  /** 1-6. */
  faixa: number;
  /** Reais. */
  rbt12: number;
  nominal: number;
  /** Reais. */
  deduction: number;
  /** Unrounded %. */
  effective: number;
  /** ISS share of the effective rate, %; null in the 6ª faixa or from 2033. */
  issShare: number | null;
  /** Unrounded %, before the cap. */
  issRaw: number;
  cap: number | null;
  capped: boolean;
  /** What the DAS carries, unrounded %. Without the ISS share when it is outside the DAS. */
  total: number;
  /** Unrounded %; 0 when outside the DAS. */
  iss: number;
  outside: boolean;
}

/** `rbt12` in reais; `year` of the período de apuração. Null above the Simples' ceiling. */
export const computeAnexo = ({
  year,
  rbt12,
  anexo,
  aboveSublimit,
}: {
  year: number;
  rbt12: number;
  anexo: Anexo;
  aboveSublimit: boolean;
}): AnexoCheck | null => {
  if (!(rbt12 > 0) || rbt12 > CEILINGS[CEILINGS.length - 1]) return null;
  const faixa = CEILINGS.findIndex((ceiling) => rbt12 <= ceiling);
  const tables = tablesFor(year);
  const [rate, deduction] = tables.nominal[anexo][faixa];
  const effective = ((rbt12 * (rate / 100) - deduction) / rbt12) * 100;
  const share = tables.iss?.[anexo][faixa] ?? null;
  const cap = tables.iss?.cap ?? null;
  const issRaw = share ? (effective * share) / 100 : 0;
  const issInDas = cap !== null ? Math.min(issRaw, cap) : issRaw;
  const outside = aboveSublimit || !share;
  return {
    anexo,
    faixa: faixa + 1,
    rbt12,
    nominal: rate,
    deduction,
    effective,
    issShare: share,
    issRaw,
    cap,
    capped: share !== null && cap !== null && issRaw > cap,
    // Above the sublimit the DAS carries everything but the ISS, which the city charges by its own rate.
    total: outside ? effective - issInDas : effective,
    iss: outside ? 0 : issInDas,
    outside,
  };
};

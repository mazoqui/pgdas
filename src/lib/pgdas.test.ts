/** Ported from hcare `backend/tests/nfse-pgdas.test.js`, plus the Anexo cross-check. */
import { describe, expect, test } from "vitest";
import { parsePgdas, PgdasError, type PgdasErrorCode } from "./pgdas";
import { computeAnexo } from "./anexos";

const HEAD = "IRPJ CSLL COFINS PIS/Pasep INSS/CPP ICMS IPI ISS Total";
const toCents = (money: string) => Math.round(Number(money.replace(/\./g, "").replace(",", ".")) * 100);
const toMoney = (value: number) =>
  `${Math.floor(value / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${String(value % 100).padStart(2, "0")}`;
/** The federal part all in IRPJ, so the columns add up to the Total as on a real statement. */
const activity = (kind: string, revenue: string, iss: string, total: string) =>
  `Valor do Débito por Tributo para a Atividade (R$): Prestação de Serviços, ${kind} ` +
  `Receita Bruta Informada: R$ ${revenue} ${HEAD} ${toMoney(toCents(total) - toCents(iss))} 0,00 0,00 0,00 0,00 0,00 0,00 ` +
  `${iss} ${total} Parcela 1: R$ ${revenue}`;
const OWN = "sem retenção/substituição tributária de ISS, com ISS devido ao próprio Município";
const WITHHELD = "com retenção/substituição tributária de ISS";

const statement = ({
  pa = "09/2026",
  rpa = "13.600,00",
  fixed = "Não se aplica",
  blocked = "Não",
  activities,
}: {
  pa?: string;
  rpa?: string;
  fixed?: string;
  blocked?: string;
  activities: string[];
}) =>
  `Extrato do Simples Nacional CNPJ Básico: 11.222.333 Nome Empresarial: TESTE LTDA Data de Abertura: 01/01/2020 ` +
  `Período de Apuração (PA): ${pa} ` +
  `Receita Bruta do PA (RPA) - Competência ${rpa} 0,00 ${rpa} ` +
  `Receita bruta acumulada nos doze meses anteriores ao PA (RBT12) 175.511,38 0,00 175.511,38 ` +
  `2.3.1) Total de Folhas de Salários Anteriores (R$) R$ 18.937,00 . . 2.4) Fator r Fator r = 0,10 - Anexo V . . ` +
  `2.5) Valores Fixos ${fixed} . . ` +
  `Impedido de recolher ICMS/ISS no DAS: ${blocked} ${activities.join(" . . ")} ` +
  `Informações por Estabelecimento Total do Débito ${HEAD} 9,00 9,00 9,00 9,00 9,00 0,00 0,00 9,00 9,00`;

const refused = (fn: () => unknown, code: PgdasErrorCode) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PgdasError);
    expect((error as PgdasError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
};

describe("parsePgdas", () => {
  test("one activity: the DAS over the revenue, for the month after the period", () => {
    const read = parsePgdas(statement({ activities: [activity("x", "13.600,00", "295,12", "2.108,00")] }));
    expect(read).toMatchObject({
      period: "09/2026",
      from: "10/2026",
      companyCnpj: "11.222.333",
      companyName: "TESTE LTDA",
      total: "15.50",
      iss: "2.17",
      rbt12: 17_551_138,
      payroll12: 1_893_700,
      fatorR: "0,10",
      anexo: "V",
    });
  });

  test("withheld revenue does not pull the rates down", () => {
    const read = parsePgdas(
      statement({
        rpa: "50.090,49",
        activities: [activity(OWN, "38.355,49", "1.229,17", "6.469,32"), activity(WITHHELD, "11.735,00", "0,00", "1.603,24")],
      }),
    );
    expect(read.total).toBe("16.87");
    expect(read.iss).toBe("3.20");
    expect(read.activities.map((a) => a.withheld)).toEqual([false, true]);
  });

  test("December's statement starts next year's row", () => {
    const read = parsePgdas(statement({ pa: "12/2026", activities: [activity(OWN, "13.600,00", "295,12", "2.108,00")] }));
    expect(read.from).toBe("01/2027");
  });

  test("above the sublimit there is no ISS share to read", () => {
    const read = parsePgdas(statement({ blocked: "Sim", activities: [activity(OWN, "13.600,00", "0,00", "1.813,00")] }));
    expect(read.iss).toBe("");
    expect(read.issOutside).toBe(true);
  });

  test("what it cannot read with certainty it refuses", () => {
    const own = activity(OWN, "13.600,00", "295,12", "2.108,00");
    refused(() => parsePgdas("some other document"), "pgdas_unreadable");
    refused(() => parsePgdas("Programa Gerador ... Declaratório Nº da Declaração: 1"), "pgdas_declaration");
    refused(() => parsePgdas(statement({ rpa: "0,00", activities: [] })), "pgdas_no_revenue");
    refused(() => parsePgdas(statement({ fixed: "R$ 100,00", activities: [own] })), "pgdas_fixed_values");
    // An activity lost on the way: the revenue no longer adds up.
    refused(() => parsePgdas(statement({ rpa: "20.000,00", activities: [own] })), "pgdas_revenue_mismatch");
    refused(
      () => parsePgdas(statement({ activities: [activity(WITHHELD, "13.600,00", "0,00", "1.800,00")] })),
      "pgdas_only_withheld",
    );
    refused(
      () => parsePgdas(statement({ rpa: "20.000,00", activities: [own, activity(OWN, "6.400,00", "50,00", "384,00")] })),
      "pgdas_mixed_rates",
    );
    refused(
      () => parsePgdas(statement({ rpa: "20.000,00", activities: [own, activity(WITHHELD, "6.400,00", "0,00", "400,00")] })),
      "pgdas_mixed_rates",
    );
    refused(() => parsePgdas(statement({ activities: [activity(OWN, "13.600,00", "0,00", "1.800,00")] })), "pgdas_no_iss");
  });

  test("the 2027 columns of LC 214/2025 are read by name, not position", () => {
    const block =
      `Valor do Débito por Tributo para a Atividade (R$): Prestação de Serviços, ${OWN} ` +
      "Receita Bruta Informada: R$ 38.355,49 IRPJ CSLL CBS INSS/CPP ICMS IPI ISS IBS Total " +
      "1.552,64 970,40 1.161,23 1.542,93 0,00 0,00 1.229,17 12,95 6.469,32 Parcela 1: R$ 38.355,49";
    const read = parsePgdas(statement({ rpa: "38.355,49", activities: [block] }));
    expect(read.total).toBe("16.87");
    expect(read.iss).toBe("3.20");
  });

  test("columns that do not add up to the Total are refused", () => {
    const block =
      `Valor do Débito por Tributo para a Atividade (R$): Prestação de Serviços, ${OWN} ` +
      `Receita Bruta Informada: R$ 13.600,00 ${HEAD} 527,00 316,20 297,23 64,29 608,16 0,00 0,00 295,12 2.000,00`;
    refused(() => parsePgdas(statement({ activities: [block] })), "pgdas_revenue_mismatch");
  });
});

describe("computeAnexo", () => {
  test("agrees with both 09/2026 statements checked in hcare", () => {
    const first = computeAnexo({ year: 2026, rbt12: 175_511.38, anexo: "V", aboveSublimit: false })!;
    expect([first.faixa, first.total.toFixed(2), first.iss.toFixed(2)]).toEqual([1, "15.50", "2.17"]);
    const third = computeAnexo({ year: 2026, rbt12: 375_960.1, anexo: "V", aboveSublimit: false })!;
    expect([third.faixa, third.total.toFixed(2), third.iss.toFixed(2)]).toEqual([3, "16.87", "3.20"]);
  });

  test("above the ceiling of the Simples there is nothing to check", () => {
    expect(computeAnexo({ year: 2026, rbt12: 5_000_000, anexo: "III", aboveSublimit: false })).toBeNull();
  });
});

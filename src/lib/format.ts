import type { PgdasErrorCode } from "./pgdas";

/** Where the PGDAS-D statements are downloaded. */
export const PORTAL_URL = "https://www8.receita.fazenda.gov.br/SimplesNacional/Servicos/Grupo.aspx?grp=5";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Cents → "R$ 1.234,56". */
export const brl = (value: number) => money.format(value / 100);
/** Reais → "R$ 1.234,56". */
export const brlReais = (value: number) => money.format(value);
/** 15.5 → "15,50 %"; `digits` for the unrounded figures. */
export const pct = (value: number, digits = 2) =>
  `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
/** "15.50" → "15,50". */
export const comma = (text: string) => text.replace(".", ",");

export const ERROR_MESSAGES: Record<PgdasErrorCode, { title: string; detail: string }> = {
  pgdas_unreadable: {
    title: "Não foi possível ler este arquivo como extrato do PGDAS-D",
    detail:
      'Envie o PDF do "Extrato do Simples Nacional" exatamente como baixado do portal do Simples Nacional (PGDAS-D → Consultar Extrato). Arquivos digitalizados, fotos ou PDFs impressos de novo não têm o texto que a página precisa ler.',
  },
  pgdas_declaration: {
    title: "Este arquivo é a Declaração, não o Extrato",
    detail:
      'A declaração do PGDAS-D não traz o valor do DAS por atividade. No portal do Simples Nacional, em PGDAS-D → Consultar Declaração, baixe o "Extrato" do mesmo período e envie-o aqui.',
  },
  pgdas_fixed_values: {
    title: "Este extrato recolhe ISS em valor fixo",
    detail:
      "Quando o ISS é pago em valor fixo mensal (item 2.5 do extrato), ele não é um percentual da receita, então o extrato não mostra uma alíquota. Confirme as alíquotas com o seu contador.",
  },
  pgdas_no_revenue: {
    title: "Este extrato não tem receita no período",
    detail:
      "Sem receita no período de apuração não há DAS a dividir, então o extrato não mostra alíquota. Use o extrato do último mês com faturamento.",
  },
  pgdas_revenue_mismatch: {
    title: "As atividades lidas não somam a receita do período",
    detail:
      "A soma das receitas de cada atividade tem de ser igual à Receita Bruta do PA (RPA). Como não é, alguma atividade não foi reconhecida, e a página prefere não arriscar um resultado incompleto. Confirme as alíquotas com o seu contador.",
  },
  pgdas_only_withheld: {
    title: "Toda a receita deste extrato teve ISS retido",
    detail:
      "Com retenção, o ISS não entra no DAS e aparece como 0,00, então o extrato não mostra a parcela do ISS. Use o extrato de um mês em que houve receita sem retenção de ISS.",
  },
  pgdas_mixed_rates: {
    title: "As atividades deste extrato têm alíquotas diferentes",
    detail:
      "Há mais de uma atividade e elas não foram tributadas pela mesma alíquota (por exemplo, anexos diferentes), então não existe uma alíquota única. Pergunte ao seu contador qual se aplica a cada nota.",
  },
  pgdas_no_iss: {
    title: "Este extrato não mostra ISS sobre a receita sem retenção",
    detail:
      "A atividade sem retenção deveria trazer o ISS dentro do DAS, mas o valor é 0,00 e a empresa não está impedida de recolher ISS no DAS. Pergunte ao seu contador qual alíquota se aplica.",
  },
};

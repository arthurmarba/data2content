/**
 * Conferência de assinaturas: banco × Stripe.
 *
 * O webhook é o único caminho que mantém `planStatus` em dia. Quando um aviso se
 * perde, chega fora de ordem ou fala de uma assinatura que o banco não conhece,
 * ninguém fica sabendo. Este comando lista as divergências por tipo.
 *
 * Uso:
 *   Somente leitura (padrão):
 *     npm run audit:stripe-subscriptions
 *   Aplicar as correções seguras (as mesmas da rotina diária /api/cron/stripe-reconcile):
 *     npm run audit:stripe-subscriptions -- --corrigir
 *
 * As correções nunca tiram acesso (ver `lib/billing/stripeReconciliationRun`):
 *  - grupo 1: o banco passa a apontar para a assinatura viva que a pessoa paga
 *    (mesma regra da tela de assinatura);
 *  - grupo 5, quando o Stripe diz que a assinatura acabou: grava o fim como o
 *    aviso de cancelamento gravaria (ex.: "atrasado" de quem já foi cancelado).
 * Os demais grupos são para olhar caso a caso.
 *
 * Imprime ids de usuário e de assinatura, nunca nome ou e-mail. Fala com o banco e
 * com o Stripe de produção (chave em STRIPE_SECRET_KEY).
 */
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import type { ResumoAssinatura } from "@/app/lib/billing/stripeReconciliation";
import {
  executarConciliacao,
  STATUS_STRIPE_ENCERRADO,
  type Correcao,
} from "@/app/lib/billing/stripeReconciliationRun";

const CORRIGIR = process.argv.includes("--corrigir");

const dia = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const assinatura = (a: ResumoAssinatura | null) =>
  a ? `${a.id} (${a.status}${a.cancelaNoFim ? ", cancela no fim do ciclo" : ""})` : "nenhuma";

function secao(titulo: string, quantidade: number, nota: string) {
  console.log(`\n${titulo} — ${quantidade}`);
  if (quantidade > 0) console.log(`  ${nota}`);
}

function imprimirCorrecao(c: Correcao) {
  if (c.resultado === "corrigido") console.log(`  - usuário ${c.userId}: ${c.antes}  →  ${c.depois}`);
  else console.log(`  - usuário ${c.userId}: pulado (${c.motivo})`);
}

async function main() {
  await connectToDatabase();
  const { conferencia: r, correcoes } = await executarConciliacao({ corrigir: CORRIGIR });

  console.log(`Conferência de assinaturas — banco × Stripe${CORRIGIR ? " (com correção)" : " (somente leitura)"}`);
  console.log(
    `Usuários com cobrança: ${r.totais.usuarios} · assinaturas no Stripe: ${r.totais.assinaturas} · batem: ${r.totais.batem}`
  );

  secao(
    "1. Pagam uma assinatura que o banco não reconhece",
    r.pagaOutraAssinatura.length,
    "Se essa assinatura for cancelada, o banco não fica sabendo. Corrigível com --corrigir."
  );
  for (const p of r.pagaOutraAssinatura) {
    console.log(`  - usuário ${p.userId} (${p.planStatus}): banco aponta ${assinatura(p.gravada)}; paga ${assinatura(p.viva)}`);
  }

  secao(
    "2. Mais de uma assinatura viva no mesmo cliente",
    r.cobrancaDupla.length,
    "Pode estar pagando em dobro. Olhar no Stripe antes de qualquer coisa."
  );
  for (const d of r.cobrancaDupla) {
    console.log(`  - usuário ${d.userId} (${d.planStatus}): gravada ${d.gravadaId ?? "nenhuma"}; vivas ${d.vivas.map(assinatura).join(", ")}`);
  }

  secao(
    "3. Pro no banco sem assinatura que sustente",
    r.proSemAssinatura.length,
    "Cortesia dada à mão ou vazamento. Olhar caso a caso."
  );
  for (const p of r.proSemAssinatura) {
    console.log(`  - usuário ${p.userId} (${p.role ?? "—"}, ${p.planStatus}, expira ${dia(p.planExpiresAt)}): assinatura ${assinatura(p.assinatura)}`);
  }

  secao("4. Pagam e estão sem Pro no banco", r.pagaSemPro.length, "Gente pagando sem acesso. Prioridade.");
  for (const p of r.pagaSemPro) {
    console.log(`  - usuário ${p.userId} (${p.planStatus}): ${assinatura(p.assinatura)}`);
  }

  secao(
    "5. Mesmo acesso, status diferente",
    r.statusDiferente.length,
    "Não muda quem tem Pro, mas mostra aviso do Stripe que não chegou ao banco. Quando o Stripe diz que acabou, corrigível com --corrigir."
  );
  for (const s of r.statusDiferente) {
    console.log(`  - usuário ${s.userId}: banco ${s.planStatus}, Stripe pede ${s.esperado} — ${assinatura(s.assinatura)}`);
  }

  secao("6. Assinatura gravada que não existe no Stripe", r.gravadaInexistente.length, "Id velho ou de outro ambiente.");
  for (const g of r.gravadaInexistente) console.log(`  - usuário ${g.userId}: ${g.assinaturaId}`);

  secao(
    "7. Assinatura viva no Stripe sem ninguém no banco",
    r.vivaSemUsuario.length,
    "Se não cancela no fim do ciclo, alguém está pagando sem conta."
  );
  for (const v of r.vivaSemUsuario) console.log(`  - ${assinatura(v)}, criada ${dia(v.criadaEm)}`);

  const corrigiveis =
    r.pagaOutraAssinatura.length +
    r.statusDiferente.filter((x) => STATUS_STRIPE_ENCERRADO.has(x.esperado)).length;
  if (CORRIGIR) {
    console.log(`\nCorreções seguras (grupos 1 e 5): ${correcoes.length}`);
    correcoes.forEach(imprimirCorrecao);
  } else if (corrigiveis > 0) {
    console.log(`\nNada foi gravado. ${corrigiveis} caso(s) corrigível(is): npm run audit:stripe-subscriptions -- --corrigir`);
  }

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error("Erro na conferência de assinaturas:", err);
  mongoose.connection.close().finally(() => process.exit(1));
});

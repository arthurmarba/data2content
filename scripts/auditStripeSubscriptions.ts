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
 *   Corrigir quem paga uma assinatura que o banco não reconhece (e só isso):
 *     npm run audit:stripe-subscriptions -- --corrigir
 *
 * A correção aplica a mesma regra da tela de assinatura (`/api/billing/subscription`,
 * via `lib/billing/stripeSubscriptionSync`): é o que aconteceria se a pessoa abrisse
 * a página de assinatura. Os demais grupos são para olhar caso a caso.
 *
 * Imprime ids de usuário e de assinatura, nunca nome ou e-mail. Fala com o banco e
 * com o Stripe de produção (chave em STRIPE_SECRET_KEY).
 */
import mongoose from "mongoose";
import type Stripe from "stripe";
import { connectToDatabase } from "@/app/lib/mongoose";
import { stripe } from "@/app/lib/stripe";
import User from "@/app/models/User";
import {
  conferirAssinaturas,
  STATUS_ASSINATURA_VIVA,
  type ResumoAssinatura,
  type UsuarioCobranca,
} from "@/app/lib/billing/stripeReconciliation";
import {
  applyBillingStateToUser,
  billingStateFromSubscription,
} from "@/app/lib/billing/stripeSubscriptionSync";

const CORRIGIR = process.argv.includes("--corrigir");

const dia = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const assinatura = (a: ResumoAssinatura | null) =>
  a ? `${a.id} (${a.status}${a.cancelaNoFim ? ", cancela no fim do ciclo" : ""})` : "nenhuma";

async function listarAssinaturas(): Promise<Stripe.Subscription[]> {
  const todas: Stripe.Subscription[] = [];
  for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100 })) {
    todas.push(sub);
  }
  return todas;
}

async function carregarUsuarios(): Promise<UsuarioCobranca[]> {
  const docs = await User.find(
    {},
    "role planStatus cancelAtPeriodEnd planExpiresAt stripeCustomerId stripeSubscriptionId"
  ).lean();
  return docs.map((doc: any) => ({
    id: String(doc._id),
    role: doc.role ?? null,
    planStatus: doc.planStatus ?? null,
    cancelAtPeriodEnd: doc.cancelAtPeriodEnd ?? null,
    planExpiresAt: doc.planExpiresAt ?? null,
    stripeCustomerId: doc.stripeCustomerId || null,
    stripeSubscriptionId: doc.stripeSubscriptionId || null,
  }));
}

function secao(titulo: string, quantidade: number, nota: string) {
  console.log(`\n${titulo} — ${quantidade}`);
  if (quantidade > 0) console.log(`  ${nota}`);
}

async function corrigirAssinaturaGravada(userId: string, vivaId: string) {
  const user: any = await User.findById(userId);
  if (!user) return console.log(`  - usuário ${userId}: não encontrado, pulado`);

  const sub = await stripe.subscriptions.retrieve(vivaId);
  const cliente = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  if (!STATUS_ASSINATURA_VIVA.has(String(sub.status))) {
    return console.log(`  - usuário ${userId}: ${vivaId} não está mais viva (${sub.status}), pulado`);
  }
  if (user.stripeCustomerId && cliente !== user.stripeCustomerId) {
    return console.log(`  - usuário ${userId}: ${vivaId} é de outro cliente, pulado`);
  }

  const antes = `${user.planStatus} · ${user.stripeSubscriptionId} · expira ${dia(user.planExpiresAt)}`;
  const estado = billingStateFromSubscription(sub);
  if (!applyBillingStateToUser(user, cliente, sub, estado)) {
    return console.log(`  - usuário ${userId}: já estava em dia`);
  }
  await user.save();
  console.log(
    `  - usuário ${userId}: ${antes}  →  ${user.planStatus} · ${user.stripeSubscriptionId} · expira ${dia(user.planExpiresAt)}`
  );
}

async function main() {
  await connectToDatabase();
  const [usuarios, assinaturas] = await Promise.all([carregarUsuarios(), listarAssinaturas()]);
  const r = conferirAssinaturas(usuarios, assinaturas);

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
    "Não muda quem tem Pro, mas mostra aviso do Stripe que não chegou ao banco."
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

  if (CORRIGIR && r.pagaOutraAssinatura.length > 0) {
    console.log("\nCorrigindo o grupo 1:");
    for (const p of r.pagaOutraAssinatura) await corrigirAssinaturaGravada(p.userId, p.viva.id);
  } else if (!CORRIGIR && r.pagaOutraAssinatura.length > 0) {
    console.log("\nNada foi gravado. Para corrigir o grupo 1: npm run audit:stripe-subscriptions -- --corrigir");
  }

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error("Erro na conferência de assinaturas:", err);
  mongoose.connection.close().finally(() => process.exit(1));
});

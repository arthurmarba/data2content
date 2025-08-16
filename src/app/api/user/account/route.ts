// src/app/api/user/account/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { logger } from "@/app/lib/logger";
import { deleteUserAccountAndAssociatedData } from "@/app/lib/dataService";
import { DatabaseError, UserNotFoundError } from "@/app/lib/errors";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { cancelBlockingIncompleteSubs } from "@/utils/stripeHelpers";

export async function DELETE(req: Request) {
  const TAG = "[API DELETE /api/user/account]";
  let session;

  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    logger.error(`${TAG} Erro ao obter sessão:`, error);
    return NextResponse.json(
      { error: "Erro de autenticação ao tentar obter a sessão." },
      { status: 500 }
    );
  }

  if (!session?.user?.id) {
    logger.warn(`${TAG} Tentativa de exclusão de conta não autenticada.`);
    return NextResponse.json(
      { error: "Não autorizado. É necessário estar autenticado para excluir a conta." },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  if (!Types.ObjectId.isValid(userId)) {
    logger.error(`${TAG} User ID inválido na sessão durante a tentativa de exclusão: ${userId}`);
    return NextResponse.json(
      { error: "ID de utilizador inválido na sessão." },
      { status: 400 }
    );
  }

  logger.info(`${TAG} Utilizador ${userId} solicitou a exclusão da sua conta.`);

  try {
    await connectToDatabase();
    const user = await User.findById(userId);

    // --- Checagem de assinatura no Stripe ---
    if (user?.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId).catch(() => null);

      if (sub) {
        // Estados “ativos-like” bloqueiam somente se NÃO estiver agendado para encerrar
        const activeLike = new Set(["active", "trialing", "past_due", "unpaid"]);
        const mustBlock = activeLike.has(sub.status) && !sub.cancel_at_period_end;

        if (mustBlock) {
          return NextResponse.json(
            { error: "Cancele sua assinatura antes de excluir a conta." },
            { status: 400 }
          );
        }
        // Se chegou aqui: sub cancelada, agendada para encerrar, pausada ou já inativa → permitir.
      }
    }

    // Limpa pendências de cobrança que poderiam atrapalhar a remoção do cliente (opcional)
    if (user?.stripeCustomerId) {
      try {
        await cancelBlockingIncompleteSubs(user.stripeCustomerId);
      } catch (e) {
        logger.warn(`${TAG} Falha ao limpar pendências de assinatura (seguindo mesmo assim).`, e);
      }
    }

    // --- Execução da exclusão completa ---
    const deletionSuccessful = await deleteUserAccountAndAssociatedData(userId);

    if (deletionSuccessful) {
      logger.info(`${TAG} Conta e dados associados para o utilizador ${userId} excluídos com sucesso.`);

      // Tenta remover o Customer do Stripe (pode falhar se ainda houver artefatos; tudo bem)
      if (user?.stripeCustomerId) {
        try {
          await stripe.customers.del(user.stripeCustomerId);
        } catch (e) {
          logger.warn(`${TAG} Falha ao remover cliente Stripe ${user.stripeCustomerId}:`, e);
        }
      }

      return NextResponse.json(
        { message: "Conta e todos os dados associados foram excluídos com sucesso." },
        { status: 200 }
      );
    }

    logger.error(`${TAG} deleteUserAccountAndAssociatedData retornou false sem lançar erro.`);
    return NextResponse.json(
      { error: "Ocorreu um problema ao tentar excluir a conta. A operação pode não ter sido completada." },
      { status: 500 }
    );
  } catch (error: any) {
    logger.error(`${TAG} Erro ao processar a solicitação de exclusão de conta para o utilizador ${userId}:`, error);
    if (error instanceof UserNotFoundError) {
      return NextResponse.json(
        { error: "Utilizador não encontrado. A conta pode já ter sido excluída." },
        { status: 404 }
      );
    }
    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: `Erro na base de dados ao excluir a conta: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Erro interno do servidor ao tentar excluir a conta." },
      { status: 500 }
    );
  }
}

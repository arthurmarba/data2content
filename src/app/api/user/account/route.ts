// src/app/api/user/account/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho se for diferente
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { logger } from "@/app/lib/logger"; // Ajuste o caminho se for diferente
import { deleteUserAccountAndAssociatedData } from "@/app/lib/dataService"; // Ajuste o caminho se for diferente
import { DatabaseError, UserNotFoundError } from "@/app/lib/errors"; // Ajuste o caminho se for diferente

export async function DELETE(req: Request) {
  const TAG = "[API DELETE /api/user/account]";
  let session;

  try {
    // Obter a sessão do servidor para autenticação
    session = await getServerSession(authOptions);
  } catch (error) {
    logger.error(`${TAG} Erro ao obter sessão:`, error);
    return NextResponse.json(
      { message: "Erro de autenticação ao tentar obter a sessão." },
      { status: 500 }
    );
  }

  // Verificar se o utilizador está autenticado
  if (!session || !session.user || !session.user.id) {
    logger.warn(`${TAG} Tentativa de exclusão de conta não autenticada.`);
    return NextResponse.json(
      { message: "Não autorizado. É necessário estar autenticado para excluir a conta." },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // Validar o ID do utilizador da sessão
  if (!Types.ObjectId.isValid(userId)) {
    logger.error(`${TAG} User ID inválido na sessão durante a tentativa de exclusão: ${userId}`);
    return NextResponse.json(
      { message: "ID de utilizador inválido na sessão." },
      { status: 400 }
    );
  }

  logger.info(`${TAG} Utilizador ${userId} solicitou a exclusão da sua conta.`);

  try {
    // Chamar a função do dataService para excluir a conta e todos os dados associados
    const deletionSuccessful = await deleteUserAccountAndAssociatedData(userId);

    if (deletionSuccessful) {
      logger.info(`${TAG} Conta e dados associados para o utilizador ${userId} excluídos com sucesso.`);
      // Após a exclusão bem-sucedida, o frontend deverá tratar o signOut e redirecionamento.
      // Retornar 200 OK ou 204 No Content. 200 com mensagem pode ser mais informativo.
      return NextResponse.json(
        { message: "Conta e todos os dados associados foram excluídos com sucesso." },
        { status: 200 }
      );
    } else {
      // Este 'else' pode não ser alcançado se deleteUserAccountAndAssociatedData sempre lançar um erro em caso de falha.
      // Mas é uma salvaguarda.
      logger.error(`${TAG} A função deleteUserAccountAndAssociatedData retornou false para o utilizador ${userId} sem lançar um erro explícito.`);
      return NextResponse.json(
        { message: "Ocorreu um problema ao tentar excluir a conta. A operação pode não ter sido completada." },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error(`${TAG} Erro ao processar a solicitação de exclusão de conta para o utilizador ${userId}:`, error);
    if (error instanceof UserNotFoundError) {
      // Se o utilizador já não existe (talvez excluído numa tentativa anterior mas a sessão ainda era válida)
      return NextResponse.json({ message: "Utilizador não encontrado. A conta pode já ter sido excluída." }, { status: 404 });
    }
    if (error instanceof DatabaseError) {
      return NextResponse.json({ message: `Erro na base de dados ao excluir a conta: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json(
      { message: "Erro interno do servidor ao tentar excluir a conta." },
      { status: 500 }
    );
  }
}

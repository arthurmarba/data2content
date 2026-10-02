/**
 * Novos seguidores por dia, como o Instagram informa (`InstagramNewFollowersDay`).
 *
 * Cobre os 30 dias anteriores à conexão, quando ainda não havia leitura nossa.
 * É outro número que o saldo diário: conta quem começou a seguir e não desconta
 * quem saiu. Por isso viaja em bloco separado e nunca é somado ao saldo.
 */
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import InstagramNewFollowersDayModel from "@/app/models/InstagramNewFollowersDay";

export interface InstagramReportedNewFollowers {
  source: "instagram_follower_count_daily";
  /** O Instagram fecha o dia à meia-noite do Pacífico, não no fuso pedido. */
  dayClosesInTimeZone: "America/Los_Angeles";
  days: Array<{ date: string; newFollowers: number }>;
  daysReported: number;
  totalNewFollowers: number | null;
  notes: string[];
}

export async function loadInstagramReportedNewFollowers(params: {
  userId: string;
  startDate: string;
  endDate: string;
}): Promise<InstagramReportedNewFollowers> {
  await connectToDatabase();
  const rows = await InstagramNewFollowersDayModel.find({
    user: new Types.ObjectId(params.userId),
    date: { $gte: params.startDate, $lte: params.endDate },
  })
    .sort({ date: 1 })
    .select("date newFollowers")
    .lean<Array<{ date: string; newFollowers: number }>>();

  const days = rows.map((row) => ({ date: row.date, newFollowers: row.newFollowers }));
  return {
    source: "instagram_follower_count_daily",
    dayClosesInTimeZone: "America/Los_Angeles",
    days,
    daysReported: days.length,
    totalNewFollowers: days.length ? days.reduce((total, day) => total + day.newFollowers, 0) : null,
    notes: [
      "Número informado pelo próprio Instagram: quem começou a seguir no dia. Não desconta quem deixou de seguir, então tende a ser maior que o saldo.",
      "Existe só para os 30 dias anteriores à conexão com a Data2Content; depois dela, o saldo diário (days) é a referência.",
      "Nunca some este número ao saldo diário nem compare os dois como se fossem a mesma coisa.",
    ],
  };
}

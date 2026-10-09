import mongoose, { Schema } from "mongoose";

/**
 * Novos seguidores de um dia, como o próprio Instagram informa (`follower_count`).
 *
 * Existe para cobrir o que a gente não mediu: as leituras de `AccountInsight`
 * começam na conexão, e a API só devolve os 30 dias anteriores a ela. Por isso o
 * dado é puxado uma vez, quando o criador conecta.
 *
 * Não é o mesmo número do saldo diário (`dailyFollowerGrowth`): o Instagram conta
 * quem começou a seguir e não desconta quem deixou de seguir. Os dois nunca são
 * somados nem trocados um pelo outro.
 *
 * `date` é o dia civil no horário do Pacífico, que é como o Instagram fecha o dia.
 */
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  instagramAccountId: { type: String, required: true },
  date: { type: String, required: true },
  endTime: { type: Date, required: true },
  newFollowers: { type: Number, required: true, min: 0 },
  fetchedAt: { type: Date, required: true },
}, { timestamps: true, collection: "instagram_new_followers_days" });

schema.index({ user: 1, instagramAccountId: 1, date: 1 }, { unique: true });

export type InstagramNewFollowersDayRecord = mongoose.InferSchemaType<typeof schema>;
export default (mongoose.models.InstagramNewFollowersDay as mongoose.Model<InstagramNewFollowersDayRecord>)
  || mongoose.model<InstagramNewFollowersDayRecord>("InstagramNewFollowersDay", schema);

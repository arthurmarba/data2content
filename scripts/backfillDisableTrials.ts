import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

async function run() {
  await connectToDatabase();

  const baseFilter = {
    $or: [
      { planStatus: { $in: ["trial", "trialing"] } },
      { proTrialStatus: { $in: ["active", "eligible"] } },
      { whatsappTrialActive: true },
      {
        role: "guest",
      },
    ],
  };

  const now = new Date();

  const resetUpdate = {
    $set: {
      planStatus: "inactive",
      planExpiresAt: null,
      currentPeriodEnd: null,
      proTrialStatus: "unavailable",
      proTrialActivatedAt: null,
      proTrialExpiresAt: null,
      proTrialConvertedAt: null,
      proTrialDisabledAt: now,
      whatsappTrialActive: false,
      whatsappTrialEligible: false,
      whatsappTrialStartedAt: null,
      whatsappTrialExpiresAt: null,
      whatsappTrialLastReminderAt: null,
      whatsappTrialLastNotificationAt: null,
    },
    $unset: {
      whatsappTrialReminderJobId: "",
    },
  };

  const resetResult = await User.updateMany(baseFilter, resetUpdate);

  const guestResult = await User.updateMany(
    { role: "guest" },
    { $set: { role: "user" } }
  );

  console.log("Plano trial -> inactive:", resetResult.modifiedCount);
  console.log("Usuários guest -> user:", guestResult.modifiedCount);

  await mongoose.connection.close();
}

run().catch((err) => {
  console.error("Erro ao executar backfill de trials:", err);
  mongoose.connection.close().finally(() => process.exit(1));
});

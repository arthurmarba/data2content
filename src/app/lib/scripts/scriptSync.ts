import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import ScriptEntry from "@/app/models/ScriptEntry";
import { PLANNER_TIMEZONE } from "@/app/lib/planner/constants";

type PlannerSlotLike = {
  slotId?: string;
  title?: string;
  scriptShort?: string;
  dayOfWeek?: number;
  blockStartHour?: number;
  aiVersionId?: string | null;
};

type PlannerLinkRef = {
  weekStart: Date;
  slotId: string;
  dayOfWeek?: number;
  blockStartHour?: number;
};

let plannerPlanModelPromise: Promise<any> | null = null;

async function loadPlannerPlanModel() {
  if (!plannerPlanModelPromise) {
    plannerPlanModelPromise = import("@/app/models/PlannerPlan").then((mod: any) => {
      const candidate = mod?.default ?? mod?.PlannerPlan ?? mod?.PlannerPlanModel ?? mod;
      if (!candidate || typeof candidate.findOne !== "function") {
        throw new Error("PlannerPlan model unavailable for script sync");
      }
      return candidate;
    });
  }
  return plannerPlanModelPromise;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour || "0"),
    Number(map.minute || "0"),
    Number(map.second || "0")
  );
  return asUTC - date.getTime();
}

export function normalizeToMondayInTZ(date: Date, timeZone = PLANNER_TIMEZONE): Date {
  const zoned = new Date(date.getTime() + getTimeZoneOffsetMs(date, timeZone));
  const dow = zoned.getUTCDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  const mondayLocal = new Date(
    Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate() + shift, 0, 0, 0, 0)
  );
  return new Date(mondayLocal.getTime() - getTimeZoneOffsetMs(mondayLocal, timeZone));
}

function toObjectId(userId: string | Types.ObjectId) {
  if (userId instanceof Types.ObjectId) return userId;
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user id for script sync");
  }
  return new Types.ObjectId(userId);
}

function hasScriptContent(slot: PlannerSlotLike) {
  return Boolean((slot.title && slot.title.trim()) || (slot.scriptShort && slot.scriptShort.trim()));
}

function normalizeScriptContent(slot: PlannerSlotLike) {
  const title = (slot.title || "").trim() || "Roteiro sem título";
  const content = (slot.scriptShort || "").trim() || "Roteiro em branco.";
  return { title, content };
}

export async function upsertLinkedScriptFromPlanner(params: {
  userId: string | Types.ObjectId;
  weekStart: Date;
  slot: PlannerSlotLike;
  source?: "planner" | "manual" | "ai";
}) {
  const { userId, weekStart, slot, source = "planner" } = params;
  if (!slot.slotId) return null;

  await connectToDatabase();
  const uid = toObjectId(userId);
  const normalizedWeekStart = normalizeToMondayInTZ(weekStart);

  if (!hasScriptContent(slot)) {
    await ScriptEntry.deleteOne({
      userId: uid,
      linkType: "planner_slot",
      "plannerRef.weekStart": normalizedWeekStart,
      "plannerRef.slotId": slot.slotId,
    });
    return null;
  }

  const { title, content } = normalizeScriptContent(slot);

  const updated = await ScriptEntry.findOneAndUpdate(
    {
      userId: uid,
      linkType: "planner_slot",
      "plannerRef.weekStart": normalizedWeekStart,
      "plannerRef.slotId": slot.slotId,
    },
    {
      $set: {
        title,
        content,
        source,
        aiVersionId: typeof slot.aiVersionId === "string" ? slot.aiVersionId : null,
        plannerRef: {
          weekStart: normalizedWeekStart,
          slotId: slot.slotId,
          dayOfWeek: slot.dayOfWeek,
          blockStartHour: slot.blockStartHour,
        },
      },
      $setOnInsert: {
        userId: uid,
        linkType: "planner_slot",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .lean()
    .exec();

  return updated;
}

export async function syncLinkedScriptsFromPlannerPlan(params: {
  userId: string | Types.ObjectId;
  weekStart: Date;
  slots: PlannerSlotLike[];
}) {
  const { userId, weekStart, slots } = params;
  await connectToDatabase();
  const uid = toObjectId(userId);
  const normalizedWeekStart = normalizeToMondayInTZ(weekStart);
  const slotIdsInPlan = new Set<string>();

  for (const slot of slots) {
    if (!slot.slotId) continue;
    slotIdsInPlan.add(slot.slotId);
    await upsertLinkedScriptFromPlanner({
      userId: uid,
      weekStart: normalizedWeekStart,
      slot,
      source: "planner",
    });
  }

  const keepIds = Array.from(slotIdsInPlan);
  const deleteQuery: Record<string, any> = {
    userId: uid,
    linkType: "planner_slot",
    "plannerRef.weekStart": normalizedWeekStart,
  };
  if (keepIds.length) {
    deleteQuery["plannerRef.slotId"] = { $nin: keepIds };
  }
  await ScriptEntry.deleteMany(deleteQuery).exec();
}

export async function applyScriptToPlannerSlot(params: {
  userId: string | Types.ObjectId;
  plannerRef: PlannerLinkRef;
  title: string;
  content: string;
  aiVersionId?: string | null;
}) {
  const { userId, plannerRef, title, content, aiVersionId } = params;
  await connectToDatabase();
  const PlannerPlan = await loadPlannerPlanModel();
  const uid = toObjectId(userId);
  const normalizedWeekStart = normalizeToMondayInTZ(plannerRef.weekStart);

  const planDoc = await PlannerPlan.findOne({
    userId: uid,
    platform: "instagram",
    weekStart: normalizedWeekStart,
  });
  if (!planDoc) {
    throw new Error("Plano da semana não encontrado para vincular roteiro.");
  }

  const idx = planDoc.slots.findIndex((slot: any) => slot.slotId === plannerRef.slotId);
  if (idx < 0) {
    throw new Error("Slot do planner não encontrado para vincular roteiro.");
  }

  const slot = planDoc.slots[idx];
  slot.title = title.trim();
  slot.scriptShort = content.trim();
  if (typeof aiVersionId === "string") {
    slot.aiVersionId = aiVersionId;
  } else if (aiVersionId === null) {
    slot.aiVersionId = null;
  }
  await planDoc.save();
}

export async function clearScriptFromPlannerSlot(params: {
  userId: string | Types.ObjectId;
  plannerRef: PlannerLinkRef;
}) {
  const { userId, plannerRef } = params;
  await connectToDatabase();
  const PlannerPlan = await loadPlannerPlanModel();
  const uid = toObjectId(userId);
  const normalizedWeekStart = normalizeToMondayInTZ(plannerRef.weekStart);

  const planDoc = await PlannerPlan.findOne({
    userId: uid,
    platform: "instagram",
    weekStart: normalizedWeekStart,
  });
  if (!planDoc) return;

  const idx = planDoc.slots.findIndex((slot: any) => slot.slotId === plannerRef.slotId);
  if (idx < 0) return;

  const slot = planDoc.slots[idx];
  slot.title = "";
  slot.scriptShort = "";
  slot.aiVersionId = null;
  await planDoc.save();
}

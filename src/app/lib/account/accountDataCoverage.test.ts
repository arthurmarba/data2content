/** @jest-environment node */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { ACCOUNT_DATA_CHILDREN, ACCOUNT_DATA_KEPT, ACCOUNT_DATA_RULES } from "./accountDataDeletion";

// Campos que costumam guardar o id de uma conta mesmo sem `ref: "User"`.
const OWNER_NAME = /^(user|userId|creatorId|originalCreatorId|originUserId|owner|ownerId|partner|userA|userB|acceptedBy|actorUserId|targetCreatorIds|reviewerId|reviewedBy|recommendedByAdminId|adminAnnotationUpdatedById|requestedBy|mergedIntoUserId|affiliateUserId|buyerUserId)$/;

function ownerPaths(schema: mongoose.Schema, prefix = ""): string[] {
  const found: string[] = [];
  schema.eachPath((name, type: any) => {
    const full = prefix ? `${prefix}.${name}` : name;
    const ref = type.options?.ref ?? type.caster?.options?.ref;
    if (ref === "User" || OWNER_NAME.test(name)) found.push(full);
    if (type.schema) found.push(...ownerPaths(type.schema, full));
  });
  return found;
}

// Foi assim que o conector ficou para trás: uma coleção nova com dono e ninguém
// lembrou da exclusão de conta. Este teste lê todos os modelos e cobra a decisão.
describe("toda coleção com dono tem destino na exclusão de conta", () => {
  it("cada campo que aponta para uma conta está nas regras ou na lista do que fica", () => {
    for (const dir of ["src/app/models", "src/server/db/models"]) {
      for (const file of fs.readdirSync(path.join(process.cwd(), dir))) {
        if (file.endsWith(".ts") && !file.includes(".test.")) require(path.join(process.cwd(), dir, file));
      }
    }
    const covered = new Set<string>([
      ...ACCOUNT_DATA_RULES.map((rule) => `${rule.collection}.${rule.field}`),
      ...ACCOUNT_DATA_CHILDREN.flatMap((group) => group.children.map((child) => `${child.collection}.${child.field}`)),
      ...Object.keys(ACCOUNT_DATA_KEPT),
    ]);
    const missing: string[] = [];
    for (const model of Object.values(mongoose.models)) {
      for (const field of ownerPaths(model.schema)) {
        const key = `${model.collection.collectionName}.${field}`;
        if (!covered.has(key)) missing.push(key);
      }
    }
    expect(missing.sort()).toEqual([]);
  });

  it("nenhum campo está ao mesmo tempo nas regras e na lista do que fica", () => {
    const ruled = new Set(ACCOUNT_DATA_RULES.map((rule) => `${rule.collection}.${rule.field}`));
    expect(Object.keys(ACCOUNT_DATA_KEPT).filter((key) => ruled.has(key))).toEqual([]);
  });
});

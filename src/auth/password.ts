import { sql } from "drizzle-orm";

import { db } from "@/src/db/client";

export async function hashPassword(password: string): Promise<string> {
  const result = await db.execute(sql`
    SELECT crypt(${password}, gen_salt('bf')) AS password_hash
  `);

  const rows = Array.isArray(result) ? result : result.rows;
  const row = rows[0] as Record<string, unknown> | undefined;
  const hash = row?.password_hash;

  if (typeof hash !== "string" || !hash) {
    throw new Error("Failed to hash password");
  }

  return hash;
}
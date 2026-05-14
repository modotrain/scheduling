import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/src/db/client";
import { approvedToO } from "@/src/db/schema";

type Props = { params: Promise<{ proposalId: string; sourceId: string }> };

export default async function ProposalSourceRedirectPage({ params }: Props) {
  const { proposalId, sourceId } = await params;

  const [row] = await db
    .select({ id: approvedToO.id })
    .from(approvedToO)
    .where(and(eq(approvedToO.proposalId, proposalId), eq(approvedToO.sourceId, sourceId)));

  if (!row) {
    redirect("/too-management");
  }

  redirect(`/too-management/${row.id}`);
}

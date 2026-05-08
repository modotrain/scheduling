import { relations } from "drizzle-orm/relations";
import { approvedToo, tootogpSchedule } from "./schema";

export const tootogpScheduleRelations = relations(tootogpSchedule, ({one}) => ({
	approvedToo: one(approvedToo, {
		fields: [tootogpSchedule.approvedTooId],
		references: [approvedToo.id]
	}),
}));

export const approvedTooRelations = relations(approvedToo, ({many}) => ({
	tootogpSchedules: many(tootogpSchedule),
}));
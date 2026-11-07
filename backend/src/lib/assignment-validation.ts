import { z } from "zod";
import { assignmentPriority } from "../db/schema.js";

export const assignmentTeamParamsSchema = z.object({ teamId: z.uuid() });

export const assignmentParamsSchema = assignmentTeamParamsSchema.extend({ assignmentId: z.uuid() });

const isoDate = z.iso.date();
const priority = z.enum(assignmentPriority.enumValues);
const tasks = z
  .array(z.string().trim().min(1).max(60))
  .min(1, "Select at least one task type or add custom task tags")
  .max(30)
  .transform((values) => [...new Set(values)]);
const projectName = z.string().trim().min(1).max(160);
const notes = z.string().trim().max(5000);
const personIds = z
  .array(z.uuid())
  .max(50)
  .transform((values) => [...new Set(values)]);

export const createAssignmentBodySchema = z
  .object({
    projectName,
    personIds: personIds.default([]),
    assignDate: isoDate,
    deadline: isoDate,
    priority: priority.default("Medium"),
    tasks,
    notes: notes.default(""),
  })
  .refine((body) => body.deadline >= body.assignDate, {
    path: ["deadline"],
    error: "Deadline cannot be earlier than assign date",
  });

export const updateAssignmentBodySchema = z
  .strictObject({
    projectName,
    personIds,
    assignDate: isoDate,
    deadline: isoDate,
    priority,
    tasks,
    notes,
    completed: z.boolean(),
  })
  .partial();

export const assignmentListQuerySchema = z.object({
  status: z.enum(["open", "overdue", "completed"]).optional(),
  personId: z.uuid().optional(),
});

export type AssignmentListQuery = z.infer<typeof assignmentListQuerySchema>;

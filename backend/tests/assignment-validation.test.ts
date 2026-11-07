import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignmentListQuerySchema,
  assignmentParamsSchema,
  createAssignmentBodySchema,
  updateAssignmentBodySchema,
} from "../src/lib/assignment-validation.ts";

const validCreate = {
  projectName: "  Website redesign  ",
  assignDate: "2026-10-20",
  deadline: "2026-10-30",
  tasks: [" Frontend ", "Frontend"],
};

test("assignment creation normalizes fields and applies defaults", () => {
  assert.deepEqual(createAssignmentBodySchema.parse(validCreate), {
    projectName: "Website redesign",
    personIds: [],
    assignDate: "2026-10-20",
    deadline: "2026-10-30",
    priority: "Medium",
    tasks: ["Frontend"],
    notes: "",
  });
});

test("assignment creation rejects invalid dates, empty tasks, and reversed deadlines", () => {
  assert.equal(createAssignmentBodySchema.safeParse({ ...validCreate, deadline: "2026-10-19" }).success, false);
  assert.equal(createAssignmentBodySchema.safeParse({ ...validCreate, assignDate: "2026-02-30" }).success, false);
  assert.equal(createAssignmentBodySchema.safeParse({ ...validCreate, tasks: [] }).success, false);
});

test("assignment updates accept partial changes but reject unknown fields", () => {
  assert.deepEqual(updateAssignmentBodySchema.parse({ completed: true }), { completed: true });
  assert.equal(updateAssignmentBodySchema.safeParse({ completed: true, isAdmin: true }).success, false);
});

test("assignment list filters and route parameters are validated", () => {
  assert.deepEqual(assignmentListQuerySchema.parse({ status: "overdue" }), { status: "overdue" });
  assert.equal(assignmentListQuerySchema.safeParse({ status: "pending" }).success, false);
  assert.equal(assignmentParamsSchema.safeParse({ teamId: "not-a-uuid", assignmentId: "also-invalid" }).success, false);
});

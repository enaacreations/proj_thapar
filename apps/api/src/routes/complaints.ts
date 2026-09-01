import { Router } from "express";
import type { CreateComplaintBody } from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import { COMPLAINT_CATEGORIES } from "../data/catalog";
import * as db from "../data/db";
import { requireRemarks, resolveCategory } from "./helpers";

export const complaintsRouter: Router = Router();

complaintsRouter.get("/categories", (_req, res) => {
  res.json(COMPLAINT_CATEGORIES);
});

complaintsRouter.get("/", async (req, res) => {
  res.json(await db.listComplaints(residentIdOf(req)));
});

complaintsRouter.post("/", async (req, res) => {
  const body = req.body as Partial<CreateComplaintBody>;
  const category = resolveCategory(
    COMPLAINT_CATEGORIES,
    body.categoryId,
    body.subCategoryId
  );

  const created = await db.createComplaint(residentIdOf(req), {
    title: category.subCategoryLabel,
    ...category,
    remarks: requireRemarks(body.remarks),
    againstRequestId: body.againstRequestId ?? null,
  });

  res.status(201).json(created);
});

complaintsRouter.get("/:id", async (req, res) => {
  const found = await db.getComplaint(residentIdOf(req), req.params.id);
  if (!found) throw HttpError.notFound("We couldn't find that complaint.");
  res.json(found);
});

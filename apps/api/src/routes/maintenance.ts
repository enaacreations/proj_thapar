import { Router } from "express";
import type { CreateMaintenanceBody } from "@proj/shared";
import { HttpError } from "../http-error";
import { residentIdOf } from "../auth";
import { MAINTENANCE_CATEGORIES } from "../data/catalog";
import * as db from "../data/db";
import { photoList, requireRemarks, resolveCategory } from "./helpers";

export const maintenanceRouter: Router = Router();

maintenanceRouter.get("/categories", (_req, res) => {
  res.json(MAINTENANCE_CATEGORIES);
});

maintenanceRouter.get("/", async (req, res) => {
  res.json(await db.listMaintenance(residentIdOf(req)));
});

maintenanceRouter.post("/", async (req, res) => {
  const body = req.body as Partial<CreateMaintenanceBody>;
  const category = resolveCategory(
    MAINTENANCE_CATEGORIES,
    body.categoryId,
    body.subCategoryId
  );

  const created = await db.createMaintenance(residentIdOf(req), {
    title: category.subCategoryLabel,
    ...category,
    remarks: requireRemarks(body.remarks),
    photoUris: photoList(body.photoUris),
  });

  res.status(201).json(created);
});

maintenanceRouter.get("/:id", async (req, res) => {
  const found = await db.getMaintenance(residentIdOf(req), req.params.id);
  if (!found) throw HttpError.notFound("We couldn't find that request.");
  res.json(found);
});

maintenanceRouter.post("/:id/cancel", async (req, res) => {
  const residentId = residentIdOf(req);
  const existing = await db.getMaintenance(residentId, req.params.id);

  if (!existing) throw HttpError.notFound("We couldn't find that request.");
  if (existing.status === "resolved") {
    throw HttpError.badRequest("This request is already resolved.");
  }

  res.json(await db.cancelMaintenance(residentId, req.params.id));
});

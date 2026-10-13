// Site-wide SEO settings: llms.txt (header, page lists, contact block) and the business details
// structured data may use. llms.txt stays off until an admin switches it on.

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

export async function getSettings() {
  const [settings, entries] = await Promise.all([
    prisma.seoSiteSettings.findUnique({ where: { id: "site" } }),
    prisma.seoLlmsEntry.findMany({ orderBy: [{ section: "asc" }, { sortOrder: "asc" }] }),
  ]);
  return {
    settings: settings ?? { id: "site", siteName: "Vista Chase", summary: null, aboutText: null, contactEmail: null, contactPhone: null, address: null, serviceArea: [], businessHours: null, googleBusinessUrl: null, sameAs: [], llmsEnabled: false, updatedAt: null },
    entries,
  };
}

type SettingsInput = {
  entries?: { title: string; path: string; description?: string | null; section: "PRIMARY" | "SECONDARY" }[];
} & Omit<Prisma.SeoSiteSettingsUncheckedCreateInput, "id" | "updatedAt">;

/** Saves the settings; when `entries` is sent it replaces the whole llms.txt page list, in that order. */
export async function saveSettings(input: Partial<SettingsInput>, userId: string) {
  const { entries, ...fields } = input;
  await prisma.$transaction(async (tx) => {
    await tx.seoSiteSettings.upsert({ where: { id: "site" }, create: { id: "site", ...fields, updatedById: userId }, update: { ...fields, updatedById: userId } });
    if (entries) {
      await tx.seoLlmsEntry.deleteMany({});
      if (entries.length > 0) {
        await tx.seoLlmsEntry.createMany({ data: entries.map((e, i) => ({ title: e.title, path: e.path, description: e.description ?? null, section: e.section, sortOrder: i })) });
      }
    }
    await tx.auditLog.create({ data: { userId, action: "SEO_SETTINGS_UPDATED", entityType: "SeoSiteSettings", entityId: "site", details: { fields: Object.keys(fields), entries: entries?.length ?? null } } });
  });
  return getSettings();
}

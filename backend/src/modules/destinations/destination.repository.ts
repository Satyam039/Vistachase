import prisma from "@/lib/db/prisma";
import { videosFor } from "@/modules/media/media.repository";

// Places each destination covers, for picking its hero video (backend/media/videos).
const DESTINATION_PLACES: Record<string, string[]> = {
  "banff-national-park": ["banff", "vermilion-lakes"],
  "lake-louise": ["lake-louise"],
  "moraine-lake": ["moraine-lake"],
  "jasper-national-park": ["maligne-lake", "jasper"],
  "yoho-national-park": ["emerald-lake", "yoho"],
};

const heroVideo = (slug: string) => videosFor(DESTINATION_PLACES[slug] ?? [], "all", 1)[0] ?? null;

export async function getDestinations() {
  const destinations = await prisma.destination.findMany({
    include: {
      tours: {
        select: { id: true, title: true, slug: true, basePrice: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return destinations.map((d) => ({ ...d, heroVideo: heroVideo(d.slug) }));
}

export async function getDestinationBySlug(slug: string) {
  const destination = await prisma.destination.findUnique({
    where: { slug },
    include: {
      tours: {
        include: {
          departures: {
            where: { status: "ACTIVE" },
          },
        },
      },
    },
  });
  return destination ? { ...destination, heroVideo: heroVideo(destination.slug) } : null;
}

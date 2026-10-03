import prisma from "@/lib/db/prisma";

export async function getDestinations() {
  return await prisma.destination.findMany({
    include: {
      tours: {
        select: { id: true, title: true, slug: true, basePrice: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getDestinationBySlug(slug: string) {
  return await prisma.destination.findUnique({
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
}

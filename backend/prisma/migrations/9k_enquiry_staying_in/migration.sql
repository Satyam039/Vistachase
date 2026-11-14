-- Contact form "We Are Staying In" (owner's "VistaChase Website" PDF, 2026-11-14): where the guest is
-- staying, or "Arriving at Calgary Airport". Additive only: one nullable column, so a code rollback is
-- safe (the previous release never reads it).

-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN "stayingIn" TEXT;

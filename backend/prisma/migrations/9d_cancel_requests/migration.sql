-- Guest cancellation requests (docs/ADMIN.md "Requests"). Additive only: one new BookingFlagType
-- value. A guest's request from My trips is an OPEN CANCEL_REQUEST flag that staff approve
-- (the booking is cancelled with the refund they choose) or decline. The previous release never
-- reads this value, so a code rollback is safe.

-- AlterEnum
ALTER TYPE "BookingFlagType" ADD VALUE 'CANCEL_REQUEST';

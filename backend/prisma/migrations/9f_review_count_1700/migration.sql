-- Published review count goes from "1000+" to "1700+" (owner request, 2026-10-28). The catalog
-- (prisma/catalog/products.json reviewCountLabel) only reaches the database through seed.js, so
-- tours already in the database still carry 1000. Data only, no schema change: only tours that
-- still show the old published figure move; a tour whose count came from real reviews is left as is.

UPDATE "Tour" SET "reviewCount" = 1700 WHERE "reviewCount" = 1000;

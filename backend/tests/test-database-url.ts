// The one database the test run uses, shared by vitest.config.ts (test workers) and
// tests/global-setup.ts (which force-resets and seeds it). It comes only from TEST_DATABASE_URL,
// never DATABASE_URL, so a developer's .env can't point the reset at their dev database. Any URL
// whose database name doesn't contain "test" is refused for the same reason.

const LOCAL_DEFAULT = "postgresql://postgres:postgres@localhost:5432/vistachase_test?schema=public";

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL || LOCAL_DEFAULT;
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(`TEST_DATABASE_URL must be a Postgres URL, got "${url.split("@").pop()}"`);
  }
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(`Refusing to run tests against database "${dbName}": its name must contain "test".`);
  }
  return url;
}

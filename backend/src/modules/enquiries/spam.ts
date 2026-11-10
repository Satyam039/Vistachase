/**
 * Form-spam bots fill the name field with a random mixed-case string ("SpvViyvvcPmWsQsxlpooZFKu",
 * seen on the live site 2026-11-09/10). A real name is never one long word that switches from
 * lower to upper case four or more times, so those submissions are dropped quietly.
 */
export function looksLikeBotName(name: string): boolean {
  const trimmed = name.trim();
  if (/\s/.test(trimmed) || trimmed.length < 10 || !/^[A-Za-z]+$/.test(trimmed)) return false;
  const switches = trimmed.match(/[a-z][A-Z]/g)?.length ?? 0;
  return switches >= 4;
}

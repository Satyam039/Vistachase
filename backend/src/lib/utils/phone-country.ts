// The guest's country, for partners that require it (Bókun asks the main contact's nationality).
// The checkout sends the country picked in the phone field; for older bookings the country is read
// from the phone number's calling code when only one country uses it (+1 is shared by Canada, the US
// and the Caribbean, so it gives no answer). Same table as frontend/src/lib/countries.ts.

const DIAL: Record<string, string> = {
  AF: "93", AL: "355", DZ: "213", AD: "376", AO: "244", AG: "1", AR: "54", AM: "374", AU: "61", AT: "43",
  AZ: "994", BS: "1", BH: "973", BD: "880", BB: "1", BY: "375", BE: "32", BZ: "501", BJ: "229", BT: "975",
  BO: "591", BA: "387", BW: "267", BR: "55", BN: "673", BG: "359", BF: "226", BI: "257", KH: "855", CM: "237",
  CA: "1", CV: "238", CF: "236", TD: "235", CL: "56", CN: "86", CO: "57", KM: "269", CG: "242", CD: "243",
  CR: "506", CI: "225", HR: "385", CU: "53", CY: "357", CZ: "420", DK: "45", DJ: "253", DM: "1", DO: "1",
  EC: "593", EG: "20", SV: "503", GQ: "240", ER: "291", EE: "372", SZ: "268", ET: "251", FJ: "679", FI: "358",
  FR: "33", GA: "241", GM: "220", GE: "995", DE: "49", GH: "233", GR: "30", GD: "1", GT: "502", GN: "224",
  GW: "245", GY: "592", HT: "509", HN: "504", HK: "852", HU: "36", IS: "354", IN: "91", ID: "62", IR: "98",
  IQ: "964", IE: "353", IL: "972", IT: "39", JM: "1", JP: "81", JO: "962", KZ: "7", KE: "254", KI: "686",
  KW: "965", KG: "996", LA: "856", LV: "371", LB: "961", LS: "266", LR: "231", LY: "218", LI: "423", LT: "370",
  LU: "352", MO: "853", MG: "261", MW: "265", MY: "60", MV: "960", ML: "223", MT: "356", MH: "692", MR: "222",
  MU: "230", MX: "52", FM: "691", MD: "373", MC: "377", MN: "976", ME: "382", MA: "212", MZ: "258", MM: "95",
  NA: "264", NR: "674", NP: "977", NL: "31", NZ: "64", NI: "505", NE: "227", NG: "234", KP: "850", MK: "389",
  NO: "47", OM: "968", PK: "92", PW: "680", PS: "970", PA: "507", PG: "675", PY: "595", PE: "51", PH: "63",
  PL: "48", PT: "351", PR: "1", QA: "974", RO: "40", RU: "7", RW: "250", KN: "1", LC: "1", VC: "1",
  WS: "685", SM: "378", ST: "239", SA: "966", SN: "221", RS: "381", SC: "248", SL: "232", SG: "65", SK: "421",
  SI: "386", SB: "677", SO: "252", ZA: "27", KR: "82", SS: "211", ES: "34", LK: "94", SD: "249", SR: "597",
  SE: "46", CH: "41", SY: "963", TW: "886", TJ: "992", TZ: "255", TH: "66", TL: "670", TG: "228", TO: "676",
  TT: "1", TN: "216", TR: "90", TM: "993", TV: "688", UG: "256", UA: "380", AE: "971", GB: "44", US: "1",
  UY: "598", UZ: "998", VU: "678", VA: "39", VE: "58", VN: "84", YE: "967", ZM: "260", ZW: "263",
};

const BY_DIAL = new Map<string, string[]>();
for (const [iso, code] of Object.entries(DIAL)) BY_DIAL.set(code, [...(BY_DIAL.get(code) ?? []), iso]);

/** "CA" for a known two-letter country code, else null. */
export function knownCountry(code: unknown): string | null {
  const iso = typeof code === "string" ? code.trim().toUpperCase() : "";
  return iso in DIAL ? iso : null;
}

/** The country of "+44 7700 900123" (GB), or null when the code is unknown or shared (+1, +7, +39). */
export function countryFromPhone(phone: string): string | null {
  const digits = /^\s*\+\s*(\d[\d\s-]*)/.exec(phone)?.[1]?.replace(/\D/g, "") ?? "";
  for (let len = 3; len >= 1; len--) {
    const isos = BY_DIAL.get(digits.slice(0, len));
    if (isos) return isos.length === 1 ? isos[0] : null;
  }
  return null;
}

/**
 * A phone number in E.164 form ("+14035550100"), as booking partners (Bókun) require, or null when
 * it can't be made into one. Spaces, dashes, dots and brackets go; "00" becomes "+"; a number
 * typed without its country code gets the guest's country's code (a leading trunk 0 dropped), or
 * +1 for a 10-digit North American number. 8 to 15 digits after the "+".
 */
export function toE164(phone: string | null | undefined, country?: string | null): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  let international = raw.startsWith("+");
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }
  if (!international) {
    const code = knownCountry(country) ? DIAL[knownCountry(country)!] : null;
    if (code && digits.startsWith(code) && digits.length > code.length + 6) {
      // Already has the country code, just no "+".
    } else if (code) {
      digits = code + digits.replace(/^0+/, "");
    } else if (digits.length === 10 && /^[2-9]/.test(digits)) {
      digits = `1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      // North American with its 1.
    } else {
      return null;
    }
  }
  digits = digits.replace(/^0+/, "");
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

/**
 * Structural validation for the two ID numbers residents register with.
 *
 * This checks *shape*, and nothing else. It answers "could this string ever be
 * a real Aadhaar/PAN?" — not "does this number exist" and not "does it belong
 * to this person". Those need a licensed AUA/KUA or the NSDL PAN API, and the
 * hostel office still checks the physical card against the uploaded photos.
 *
 * Worth having anyway: a typo'd or invented number costs someone a rejected
 * registration and a trip to the office, and the checksum catches most of them
 * at the point of typing.
 *
 * Both sides import this. Keeping one implementation is the point — the phone
 * and the API drifting apart is how "it let me register but then failed" bugs
 * happen.
 */

export type KycNumberType = "aadhaar" | "pan";

/**
 * Verhoeff check digit, the scheme UIDAI uses for Aadhaar. Unlike a Luhn-style
 * sum it catches transpositions ("...4356" typed as "...4536"), which is the
 * mistake people actually make reading a number off a card.
 */
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** True when `digits` ends in a valid Verhoeff check digit. */
export function hasValidVerhoeffChecksum(digits: string): boolean {
  let c = 0;
  // The algorithm reads right to left, and the position table is applied
  // modulo 8 as it goes.
  const reversed = digits.split("").reverse();

  for (let i = 0; i < reversed.length; i += 1) {
    const digit = Number(reversed[i]);
    if (!Number.isInteger(digit)) return false;
    c = D[c]![P[i % 8]![digit]!]!;
  }

  return c === 0;
}

/**
 * The fourth letter of a PAN is the holder type. Anything outside this set is
 * a number that was never issued, whatever else it looks like.
 *
 * P individual · C company · H Hindu undivided family · A association of
 * persons · B body of individuals · G government · J artificial juridical
 * person · L local authority · F firm · T trust · K Krish (trust under a will).
 */
const PAN_HOLDER_TYPES = "PCHABGJLFTK";

/** Strips spaces and hyphens, which people type when reading off a card. */
export function normaliseKycNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Returns a message to show the resident, or null when the number is
 * structurally sound. Messages say what to fix, not what rule failed.
 */
export function kycNumberProblem(
  type: KycNumberType,
  raw: string
): string | null {
  const value = normaliseKycNumber(raw);

  if (type === "aadhaar") {
    if (!/^\d{12}$/.test(value)) {
      return "Aadhaar number must be 12 digits.";
    }
    // UIDAI starts the range at 2 — a number opening with 0 or 1 is either a
    // typo or a VID/enrolment number pasted into the wrong box.
    if (value[0] === "0" || value[0] === "1") {
      return "That isn't an Aadhaar number — Aadhaar numbers don't start with 0 or 1.";
    }
    if (!hasValidVerhoeffChecksum(value)) {
      return "That Aadhaar number doesn't check out. Read the digits off your card again.";
    }
    return null;
  }

  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(value)) {
    return "PAN should look like ABCPE1234F — five letters, four digits, one letter.";
  }
  if (!PAN_HOLDER_TYPES.includes(value[3]!)) {
    return "That isn't a valid PAN. Check the fourth character.";
  }
  // Fifth letter is the first letter of the surname for an individual PAN.
  if (!/[A-Z]/.test(value[4]!)) {
    return "That isn't a valid PAN. Check the fifth character.";
  }
  return null;
}

/** Convenience for call sites that only need a yes/no. */
export function isValidKycNumber(type: KycNumberType, raw: string): boolean {
  return kycNumberProblem(type, raw) === null;
}

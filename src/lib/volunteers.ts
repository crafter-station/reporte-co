import { db } from "@/db";
import { type NewVolunteer, volunteers } from "@/db/schema";
import { volunteerId } from "./ids";
import { hashVolunteerContact, scrubPII } from "./privacy";
import type { VolunteerInput } from "./validations";

export type RegisterResult = {
  id: string;
  /** True when this contact had already signed up and the row was updated. */
  updated: boolean;
};

/**
 * Persist a volunteer sign-up.
 *
 * Idempotent on the contact hash, the same way ingestReport() is idempotent on
 * sourceRef: someone who signs up twice updates their offer instead of creating
 * a second row, and keeps their original folio.
 *
 * The raw contact is written ONLY when the volunteer consented. Without
 * consent, `contact` stays null and the hash is all we keep — enough to
 * deduplicate, not enough to reach anyone.
 */
export async function registerVolunteer(
  input: VolunteerInput,
): Promise<RegisterResult> {
  const contactHash = hashVolunteerContact(input.contact);
  const consented = input.contactConsent;
  const now = new Date();

  // Free text is scrubbed even though it never goes public: a volunteer who
  // pastes a third party's phone into "notes" shouldn't have it stored either.
  const displayName = input.displayName ? scrubPII(input.displayName) : null;
  const notes = input.notes ? scrubPII(input.notes) : null;

  const offer = {
    contactChannel: input.contactChannel,
    contact: consented ? input.contact : null,
    contactConsentAt: consented ? now : null,
    displayName,
    capabilities: input.capabilities,
    departamento: input.departamento,
    municipio: input.municipio ?? null,
    capacity: input.capacity,
    notes,
    updatedAt: now,
  };

  const candidateId = volunteerId();
  const row: NewVolunteer = {
    id: candidateId,
    contactHash,
    ...offer,
    status: "pending",
  };

  // Upsert on the contact hash rather than read-then-write, so two sign-ups
  // racing on the same contact can't hit the unique index. `status` is left
  // alone on conflict: re-registering must never quietly re-activate someone a
  // moderator paused or blocked.
  const [saved] = await db
    .insert(volunteers)
    .values(row)
    .onConflictDoUpdate({ target: volunteers.contactHash, set: offer })
    .returning({ id: volunteers.id });

  const id = saved?.id ?? candidateId;
  return { id, updated: id !== candidateId };
}

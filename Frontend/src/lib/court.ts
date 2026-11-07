/**
 * Whether an offence still has business before the court. Used to decide
 * when "Record Court Outcome" / court scheduling is available, so every
 * screen applies the same rule.
 *
 * Pending when:
 *   - the offence is on remand (unconvicted), or
 *   - it is convicted with restitution that is neither paid nor waived
 *     (the restitution due date is a court date).
 */
export interface CourtMatter {
  pending: boolean;
  /** Short reason, shown next to the action or as its tooltip. */
  reason: string;
}

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "";

export const courtMatter = (offence: {
  conviction_status?: string;
  restitution_amount?: number | string | null;
  restitution_status?: string | null;
  restitution_date?: string | null;
}): CourtMatter => {
  const status = (offence.conviction_status || "").toLowerCase();
  if (status === "unconvicted") {
    return { pending: true, reason: "On remand" };
  }
  if (status === "convicted") {
    const restitutionStatus = (offence.restitution_status || "").toLowerCase();
    if (offence.restitution_amount && !["paid", "waived"].includes(restitutionStatus)) {
      return {
        pending: true,
        reason: offence.restitution_date
          ? `Restitution due ${formatDate(offence.restitution_date)}`
          : "Restitution outstanding",
      };
    }
    return { pending: false, reason: "Sentence finalised. No restitution or court date pending." };
  }
  if (status === "discharged") {
    return { pending: false, reason: "Offence discharged." };
  }
  return { pending: false, reason: "No court matter pending." };
};

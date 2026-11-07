/**
 * Whether an offence still has business before the court. Used to decide
 * when "Record Court Outcome" / court scheduling is available, so every
 * screen applies the same rule.
 *
 * Pending when:
 *   - the offence is on remand (unconvicted), or
 *   - it is convicted with a confirmation of sentence (reduction / increase)
 *     awaiting its court session, or
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
  pending_confirmation?: { outcome: string; court_date?: string | null } | null;
}): CourtMatter => {
  const status = (offence.conviction_status || "").toLowerCase();
  if (status === "unconvicted") {
    return { pending: true, reason: "On remand" };
  }
  if (status === "convicted" && offence.pending_confirmation) {
    const kind = offence.pending_confirmation.outcome === "INCREASED" ? "increase" : "reduction";
    const when = offence.pending_confirmation.court_date
      ? ` on ${formatDate(offence.pending_confirmation.court_date)}`
      : "";
    return { pending: true, reason: `Confirmation of sentence (${kind}): re-sentencing in court${when}` };
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

/** Label and badge colour for an offence's status, so every screen shows the same badge. */
export const offenceStatusBadge = (status?: string | null): { label: string; className: string } => {
  switch ((status || "").toLowerCase()) {
    case "convicted":
      return { label: "Convicted", className: "bg-red-500 hover:bg-red-500 text-white" };
    case "discharged":
      return { label: "Discharged", className: "bg-slate-500 hover:bg-slate-500 text-white" };
    default:
      return { label: "Unconvicted", className: "bg-orange-500 hover:bg-orange-500 text-white" };
  }
};

/**
 * The earliest date a court session can be recorded for an offence: the
 * remand start for a remand matter, otherwise the date of sentence.
 */
export const earliestCourtDate = (offence: {
  remand_start_date?: string | null;
  sentence_date?: string | null;
}): Date | null => {
  const value = offence.remand_start_date || offence.sentence_date;
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

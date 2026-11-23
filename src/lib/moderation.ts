// Rapportering og blokkering (migrasjon 16, 20261123120000_reports_and_blocks.sql).

export const REPORT_REASONS = {
  inappropriate: "Upassende eller støtende innhold",
  harassment: "Trakassering eller mobbing",
  spam: "Spam eller svindel",
  other: "Noe annet",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

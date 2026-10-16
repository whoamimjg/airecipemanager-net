/** Business contact details shown on legal pages, the footer and in emails. Keep in step with
 *  supabase/functions/newsletter (email footer) and design/store in the apps repo. */
export const COMPANY = {
  legalName: "AI Manager LLC",
  addressLines: ["3939 Massillon Rd.", "Suite 801 PMB 1015", "Uniontown, OH 44685", "USA"],
  supportEmail: "support@airecipemanager.com",
  contactEmail: "michael@airecipemanager.com",
} as const;

export const COMPANY_ADDRESS_ONE_LINE = COMPANY.addressLines.join(", ");

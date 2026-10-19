import { t } from '../i18n/t';

/** Plain words for the data-check flags of a shift stoppage (the same checks as an uploaded event). */
export function flagText(f: string): string {
  const m: Record<string, string> = {
    missing_classification: t('Choose the classification (needed before submitting).'),
    invalid_classification: t('The classification is not one of PRO, MEC, ELE, AUT, PL or CIR.'),
    end_before_start: t('The restart is before the stop.'),
    unknown_area: t('Unknown area.'),
    missing_code: t('No equipment code: reliability will ask for it.'),
    unknown_code: t('The equipment code is not in the master list of this area.'),
    placeholder: t('A placeholder code (AFR / AFR2): give the real equipment if known.'),
    blank_reason: t('No reason given.'),
    unlisted_reason: t('The reason is not in the list for this classification.'),
    code_not_in_area: t('This equipment belongs to another area.'),
    line_mismatch: t('Line does not match the area.'),
  };
  return m[f] ?? f.replace(/_/g, ' ');
}

import { useDashboardLanguage } from '../lib/i18n/DashboardLanguageContext';

// One hook, used the same way on every dashboard page as it gets
// translated module by module: `const { t } = useT();` then wrap any
// literal English string in `t('...')`. Backed by DashboardLanguageProvider
// (mounted once, in DashboardLayout) - reads live React context, so a
// language change re-renders every page using this hook immediately,
// with no page refresh needed.
export function useT() {
  const { t, language, isRtl } = useDashboardLanguage();
  return { t, lang: language, isRtl };
}

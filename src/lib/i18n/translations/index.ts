import type { LanguageCode, TranslationDict } from '../types';
import { en } from './en';
import { ar } from './ar';
import { ru } from './ru';
import { es } from './es';
import { hi } from './hi';
import { ur } from './ur';
import { tl } from './tl';
import { zh } from './zh';

export const TRANSLATIONS: Record<LanguageCode, TranslationDict> = { en, ar, ru, es, hi, ur, tl, zh };

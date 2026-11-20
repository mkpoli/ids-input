// The languages of the workshop: each with the components' catalogue (messages/) and the
// workshop's own (demo/messages/), English filling any key a catalogue lacks.
import en from '../../messages/en.json' with { type: 'json' }
import ja from '../../messages/ja.json' with { type: 'json' }
import zhHans from '../../messages/zh-Hans.json' with { type: 'json' }
import zhHant from '../../messages/zh-Hant.json' with { type: 'json' }
import vi from '../../messages/vi.json' with { type: 'json' }
import ko from '../../messages/ko.json' with { type: 'json' }
import es from '../../messages/es.json' with { type: 'json' }
import fr from '../../messages/fr.json' with { type: 'json' }
import de from '../../messages/de.json' with { type: 'json' }
import pt from '../../messages/pt.json' with { type: 'json' }
import it from '../../messages/it.json' with { type: 'json' }
import id from '../../messages/id.json' with { type: 'json' }
import ms from '../../messages/ms.json' with { type: 'json' }
import th from '../../messages/th.json' with { type: 'json' }
import ru from '../../messages/ru.json' with { type: 'json' }
import tr from '../../messages/tr.json' with { type: 'json' }
import hi from '../../messages/hi.json' with { type: 'json' }
import mn from '../../messages/mn.json' with { type: 'json' }
import yue from '../../messages/yue.json' with { type: 'json' }
import appEn from '../messages/en.json' with { type: 'json' }
import appJa from '../messages/ja.json' with { type: 'json' }
import appZhHans from '../messages/zh-Hans.json' with { type: 'json' }
import appZhHant from '../messages/zh-Hant.json' with { type: 'json' }
import appVi from '../messages/vi.json' with { type: 'json' }
import appKo from '../messages/ko.json' with { type: 'json' }
import appEs from '../messages/es.json' with { type: 'json' }
import appFr from '../messages/fr.json' with { type: 'json' }
import appDe from '../messages/de.json' with { type: 'json' }
import appPt from '../messages/pt.json' with { type: 'json' }
import appIt from '../messages/it.json' with { type: 'json' }
import appId from '../messages/id.json' with { type: 'json' }
import appMs from '../messages/ms.json' with { type: 'json' }
import appTh from '../messages/th.json' with { type: 'json' }
import appRu from '../messages/ru.json' with { type: 'json' }
import appTr from '../messages/tr.json' with { type: 'json' }
import appHi from '../messages/hi.json' with { type: 'json' }
import appMn from '../messages/mn.json' with { type: 'json' }
import appYue from '../messages/yue.json' with { type: 'json' }

/** @type {[string, string, Record<string, string>][]} */
export const LOCALES = [['en', 'English', en], ['ja', '日本語', ja], ['zh-Hans', '简体中文', zhHans], ['zh-Hant', '繁體中文', zhHant], ['ko', '한국어', ko], ['vi', 'Tiếng Việt', vi],
  ['es', 'Español', es], ['fr', 'Français', fr], ['de', 'Deutsch', de], ['pt', 'Português', pt], ['it', 'Italiano', it], ['id', 'Bahasa Indonesia', id], ['ms', 'Bahasa Melayu', ms], ['th', 'ไทย', th],
  ['ru', 'Русский', ru], ['tr', 'Türkçe', tr], ['hi', 'हिन्दी', hi], ['mn', 'Монгол', mn], ['yue', '粵語', yue]]
/** @type {Record<string, Record<string, string>>} */
const APP = { en: appEn, ja: appJa, 'zh-Hans': appZhHans, 'zh-Hant': appZhHant, ko: appKo, vi: appVi,
  es: appEs, fr: appFr, de: appDe, pt: appPt, it: appIt, id: appId, ms: appMs, th: appTh,
  ru: appRu, tr: appTr, hi: appHi, mn: appMn, yue: appYue }
/** @param {string} locale */
export const appMessages = locale => APP[locale] ?? appEn

// The languages of the workshop: each with the components' catalogue (messages/) and the
// workshop's own (demo/messages/), English filling any key a catalogue lacks.
import en from '../../messages/en.json' with { type: 'json' }
import ja from '../../messages/ja.json' with { type: 'json' }
import zhHans from '../../messages/zh-Hans.json' with { type: 'json' }
import zhHant from '../../messages/zh-Hant.json' with { type: 'json' }
import ko from '../../messages/ko.json' with { type: 'json' }
import appEn from '../messages/en.json' with { type: 'json' }
import appJa from '../messages/ja.json' with { type: 'json' }
import appZhHans from '../messages/zh-Hans.json' with { type: 'json' }
import appZhHant from '../messages/zh-Hant.json' with { type: 'json' }
import appKo from '../messages/ko.json' with { type: 'json' }

/** @type {[string, string, Record<string, string>][]} */
export const LOCALES = [['en', 'English', en], ['ja', '日本語', ja], ['zh-Hans', '简体中文', zhHans], ['zh-Hant', '繁體中文', zhHant], ['ko', '한국어', ko]]
/** @type {Record<string, Record<string, string>>} */
const APP = { en: appEn, ja: appJa, 'zh-Hans': appZhHans, 'zh-Hant': appZhHant, ko: appKo }
/** @param {string} locale */
export const appMessages = locale => APP[locale] ?? appEn

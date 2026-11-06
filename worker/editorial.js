// @ts-check
import { isJurchen, isShuishu } from '../src/core/ids.js'

/**
 * Whether naming `char` for `sequence` rests on an editorial reading. No source decomposes Jurchen
 * or Shuishu, so a description of one of their characters is always ours.
 * @param {string} sequence @param {string | null | undefined} char
 */
export const isEditorial = (sequence, char) => Boolean(char) && char !== sequence && (isJurchen(char) || isShuishu(char))

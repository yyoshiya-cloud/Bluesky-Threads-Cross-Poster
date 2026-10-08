/**
 * Unicode特殊フォント変換 & 飾り罫線・装飾ユーティリティ
 */

export interface UnicodeStyle {
  id: string;
  name: string;
  category: 'bold' | 'italic' | 'script' | 'gothic' | 'double_struck' | 'circle' | 'square' | 'caps' | 'decor' | 'mono';
  sample: string;
  convert: (text: string) => string;
}

// 1. 基本的な文字コードマッピング関数
function mapChars(text: string, mapObj: Record<string, string>): string {
  return text.split('').map((char) => mapObj[char] || char).join('');
}

// A-Z / a-z / 0-9 から Unicode コードポイントオフセットへの一括マッピング生成
function buildOffsetMap(
  upperStart?: number,
  lowerStart?: number,
  digitStart?: number,
  exceptions?: Record<string, number>
): Record<string, string> {
  const map: Record<string, string> = {};

  if (upperStart !== undefined) {
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(65 + i); // 'A' - 'Z'
      if (exceptions && exceptions[char] !== undefined) {
        map[char] = String.fromCodePoint(exceptions[char]);
      } else {
        map[char] = String.fromCodePoint(upperStart + i);
      }
    }
  }

  if (lowerStart !== undefined) {
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(97 + i); // 'a' - 'z'
      if (exceptions && exceptions[char] !== undefined) {
        map[char] = String.fromCodePoint(exceptions[char]);
      } else {
        map[char] = String.fromCodePoint(lowerStart + i);
      }
    }
  }

  if (digitStart !== undefined) {
    for (let i = 0; i < 10; i++) {
      const char = String.fromCharCode(48 + i); // '0' - '9'
      if (exceptions && exceptions[char] !== undefined) {
        map[char] = String.fromCodePoint(exceptions[char]);
      } else {
        map[char] = String.fromCodePoint(digitStart + i);
      }
    }
  }

  return map;
}

// -------------------------------------------------------------
// 各種Unicodeフォントスタイルのマッピング
// -------------------------------------------------------------

// Bold (Sans-Serif): 𝗮-𝘇, 𝗔-𝗭, 𝟬-𝟵
const SANS_BOLD_MAP = buildOffsetMap(0x1d5d4, 0x1d5ee, 0x1d7ec);

// Bold (Serif): 𝐚-𝐳, 𝐀-𝐙, 𝟎-𝟗
const SERIF_BOLD_MAP = buildOffsetMap(0x1d400, 0x1d41a, 0x1d7ce);

// Italic (Sans-Serif): 𝘢-𝘻, 𝘈-𝘡
const SANS_ITALIC_MAP = buildOffsetMap(0x1d608, 0x1d622);

// Italic (Serif): 𝑎-𝑧, 𝐴-𝑍 (h: 0x210e)
const SERIF_ITALIC_MAP = buildOffsetMap(0x1d434, 0x1d44e, undefined, { h: 0x210e });

// Bold Italic (Sans-Serif): 𝙖-𝙯, 𝘼-𝙕
const SANS_BOLD_ITALIC_MAP = buildOffsetMap(0x1d63c, 0x1d656);

// Bold Italic (Serif): 𝒂-𝒛, 𝑨-𝒁
const SERIF_BOLD_ITALIC_MAP = buildOffsetMap(0x1d468, 0x1d482);

// Script / Cursive (筆記体): 𝒶-𝓏, 𝒜-𝒵
const SCRIPT_MAP = buildOffsetMap(0x1d49c, 0x1d4b6, undefined, {
  B: 0x212c, // ℬ
  E: 0x2130, // ℰ
  F: 0x2131, // ℱ
  H: 0x210b, // ℋ
  I: 0x2110, // ℐ
  L: 0x2112, // ℒ
  M: 0x2133, // ℳ
  R: 0x211b, // ℛ
  e: 0x212f, // ℯ
  g: 0x210a, // ℊ
  o: 0x2134, // ℴ
});

// Bold Script (太字筆記体): 𝓪-𝔃, 𝓐-𝓩
const BOLD_SCRIPT_MAP = buildOffsetMap(0x1d4d0, 0x1d4ea);

// Fraktur (ドイツ文字・ゴシック体): 𝔞-𝔷, 𝔄-𝔨
const FRAKTUR_MAP = buildOffsetMap(0x1d504, 0x1d51e, undefined, {
  C: 0x212d, // ℭ
  H: 0x210c, // ℌ
  I: 0x2111, // ℑ
  R: 0x211c, // ℜ
  Z: 0x2128, // ℨ
});

// Bold Fraktur: 𝖆-𝖟, 𝕬-𝖅
const BOLD_FRAKTUR_MAP = buildOffsetMap(0x1d538, 0x1d552);

// Double-Struck / Blackboard (袋文字): 𝕒-𝕫, 𝔸-ℤ, 𝟘-𝟡
const DOUBLE_STRUCK_MAP = buildOffsetMap(0x1d538 + 52, 0x1d552 + 52, 0x1d7d8, {
  C: 0x2102, // ℂ
  H: 0x210d, // ℍ
  N: 0x2115, // ℕ
  P: 0x2119, // ℙ
  Q: 0x211a, // ℚ
  R: 0x211d, // ℝ
  Z: 0x2124, // ℤ
});

// Monospace (等幅フォント): 𝚊-𝚣, 𝙰-𝚉, 𝟶-𝟿
const MONOSPACE_MAP = buildOffsetMap(0x1d670, 0x1d68a, 0x1d7f6);

// Sans-Serif Regular: 𝖺-𝗓, 𝖠-𝖹, 𝟢-𝟫
const SANS_REGULAR_MAP = buildOffsetMap(0x1d5a0, 0x1d5ba, 0x1d7e2);

// Circle (丸囲み文字): ⓐ-ⓩ, Ⓐ-Ⓩ, ①-⑨, ⓪
const CIRCLE_MAP: Record<string, string> = {};
for (let i = 0; i < 26; i++) {
  CIRCLE_MAP[String.fromCharCode(65 + i)] = String.fromCodePoint(0x24b6 + i); // Ⓐ
  CIRCLE_MAP[String.fromCharCode(97 + i)] = String.fromCodePoint(0x24d0 + i); // ⓐ
}
CIRCLE_MAP['0'] = '⓪';
for (let i = 1; i <= 9; i++) {
  CIRCLE_MAP[String(i)] = String.fromCodePoint(0x2460 + i - 1); // ①-⑨
}

// Filled / Negative Circle (黒丸囲み文字): 🅐-🅩, ⓿, ❶-❾
const FILLED_CIRCLE_MAP: Record<string, string> = {};
for (let i = 0; i < 26; i++) {
  const upper = String.fromCodePoint(0x1f150 + i); // 🅐-🅩
  FILLED_CIRCLE_MAP[String.fromCharCode(65 + i)] = upper;
  FILLED_CIRCLE_MAP[String.fromCharCode(97 + i)] = upper; // 小文字も大文字黒丸に変換
}
FILLED_CIRCLE_MAP['0'] = '⓿';
for (let i = 1; i <= 9; i++) {
  FILLED_CIRCLE_MAP[String(i)] = String.fromCodePoint(0x2776 + i - 1); // ❶-❾
}

// Square (角囲み文字 / Negative Squared): 🅰-🆉
const SQUARE_FILLED_MAP: Record<string, string> = {};
for (let i = 0; i < 26; i++) {
  const char = String.fromCharCode(65 + i);
  // 一部Unicode絵文字（A, B, O, Pなど）は標準絵文字ブロック
  if (char === 'A') SQUARE_FILLED_MAP['A'] = '🅰';
  else if (char === 'B') SQUARE_FILLED_MAP['B'] = '🅱';
  else if (char === 'O') SQUARE_FILLED_MAP['O'] = '🅾';
  else if (char === 'P') SQUARE_FILLED_MAP['P'] = '🅿';
  else SQUARE_FILLED_MAP[char] = String.fromCodePoint(0x1f170 + i);

  SQUARE_FILLED_MAP[String.fromCharCode(97 + i)] = SQUARE_FILLED_MAP[char];
}

// Small Capitals (スモールキャップス): ᴀ ʙ ᴄ ᴅ ᴇ ꜰ ɢ ʜ ɪ ᴊ ᴋ ʟ ᴍ ɴ ᴏ ᴘ ǫ ʀ s ᴛ ᴜ ᴠ ᴡ x ʏ ᴢ
const SMALL_CAPS_MAP: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
  j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
  s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
  A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
  J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
  S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ',
};

// Fullwidth (全角英数): Ａ-Ｚ, ａ-ｚ, ０-９
const FULLWIDTH_MAP = buildOffsetMap(0xff21, 0xff41, 0xff10);

// 結合記号による装飾関数（下線、取り消し線、ドット線など）
function applyCombiningChar(text: string, combiningChar: string): string {
  return text.split('').map((char) => {
    if (char === ' ' || char === '\n' || char === '\t') return char;
    return char + combiningChar;
  }).join('');
}

// -------------------------------------------------------------
// スタイル一覧定義
// -------------------------------------------------------------

export const UNICODE_STYLES: UnicodeStyle[] = [
  {
    id: 'sans-bold',
    name: '太字 (Sans Bold)',
    category: 'bold',
    sample: '𝗯𝗼𝗹𝗱 𝟭𝟮𝟯',
    convert: (t) => mapChars(t, SANS_BOLD_MAP),
  },
  {
    id: 'serif-bold',
    name: '明朝太字 (Serif Bold)',
    category: 'bold',
    sample: '𝐛𝐨𝐥𝐝 𝟏𝟐𝟑',
    convert: (t) => mapChars(t, SERIF_BOLD_MAP),
  },
  {
    id: 'sans-italic',
    name: '斜体 (Sans Italic)',
    category: 'italic',
    sample: '𝘪𝘵𝘢𝘭𝘪𝘤',
    convert: (t) => mapChars(t, SANS_ITALIC_MAP),
  },
  {
    id: 'serif-italic',
    name: '明朝斜体 (Serif Italic)',
    category: 'italic',
    sample: '𝑖𝑡𝑎𝑙𝑖𝑐',
    convert: (t) => mapChars(t, SERIF_ITALIC_MAP),
  },
  {
    id: 'sans-bold-italic',
    name: '太字斜体 (Bold Italic)',
    category: 'bold',
    sample: '𝙗𝙤𝙡𝙙 𝙞𝙩𝙖𝙡𝙞𝙘',
    convert: (t) => mapChars(t, SANS_BOLD_ITALIC_MAP),
  },
  {
    id: 'script',
    name: '筆記体 (Script)',
    category: 'script',
    sample: '𝓈𝒸𝓇𝒾𝓅𝓉',
    convert: (t) => mapChars(t, SCRIPT_MAP),
  },
  {
    id: 'bold-script',
    name: '太字筆記体 (Bold Script)',
    category: 'script',
    sample: '𝓫𝓸𝓵𝓭 𝓼𝓬𝓻𝓲𝓹𝓽',
    convert: (t) => mapChars(t, BOLD_SCRIPT_MAP),
  },
  {
    id: 'double-struck',
    name: '袋文字 (Blackboard / Double)',
    category: 'double_struck',
    sample: '𝕕𝕠𝕦𝕓𝕝𝕖 𝟙𝟚',
    convert: (t) => mapChars(t, DOUBLE_STRUCK_MAP),
  },
  {
    id: 'fraktur',
    name: 'ゴシック調 (Fraktur)',
    category: 'gothic',
    sample: '𝖋𝖗𝖆𝖐𝖙𝖚𝖗',
    convert: (t) => mapChars(t, FRAKTUR_MAP),
  },
  {
    id: 'bold-fraktur',
    name: '太字ゴシック (Bold Fraktur)',
    category: 'gothic',
    sample: '𝖇𝖔𝖑𝖉 𝖋𝖗𝖆𝖐𝖙𝖚𝖗',
    convert: (t) => mapChars(t, BOLD_FRAKTUR_MAP),
  },
  {
    id: 'monospace',
    name: '等幅 (Monospace / Code)',
    category: 'mono',
    sample: '𝚖𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎',
    convert: (t) => mapChars(t, MONOSPACE_MAP),
  },
  {
    id: 'small-caps',
    name: 'スモールキャップス (ꜱᴍᴀʟʟ)',
    category: 'caps',
    sample: 'ꜱᴍᴀʟʟ ᴄᴀᴘꜱ',
    convert: (t) => mapChars(t, SMALL_CAPS_MAP),
  },
  {
    id: 'circle',
    name: '丸囲み文字 (Circle)',
    category: 'circle',
    sample: 'ⓒⓘⓡⓒⓛⓔ ①②',
    convert: (t) => mapChars(t, CIRCLE_MAP),
  },
  {
    id: 'filled-circle',
    name: '黒丸囲み文字 (Filled Circle)',
    category: 'circle',
    sample: '🅒🅘🅡🅒🅛🅔 ❶❷',
    convert: (t) => mapChars(t, FILLED_CIRCLE_MAP),
  },
  {
    id: 'filled-square',
    name: '四角囲み文字 (Square)',
    category: 'square',
    sample: '🆂🆀🆄🅰🆁🅴',
    convert: (t) => mapChars(t, SQUARE_FILLED_MAP),
  },
  {
    id: 'underline',
    name: '下線 (U̲n̲d̲e̲r̲l̲i̲n̲e̲)',
    category: 'decor',
    sample: 'u̲n̲d̲e̲r̲l̲i̲n̲e̲',
    convert: (t) => applyCombiningChar(t, '\u0332'),
  },
  {
    id: 'strikethrough',
    name: '取り消し線 (S̶t̶r̶i̶k̶e̶)',
    category: 'decor',
    sample: 's̶t̶r̶i̶k̶e̶',
    convert: (t) => applyCombiningChar(t, '\u0336'),
  },
  {
    id: 'double-underline',
    name: '二重下線 (D̳o̳u̳b̳l̳e̳)',
    category: 'decor',
    sample: 'd̳o̳u̳b̳l̳e̳',
    convert: (t) => applyCombiningChar(t, '\u0333'),
  },
  {
    id: 'fullwidth',
    name: '全角英数 (Fullwidth)',
    category: 'caps',
    sample: 'Ｆｕｌｌｗｉｄｔｈ',
    convert: (t) => mapChars(t, FULLWIDTH_MAP),
  },
];

// -------------------------------------------------------------
// 飾り罫線・枠線・デコレーションテンプレート
// -------------------------------------------------------------

export interface DecorationItem {
  id: string;
  name: string;
  category: 'divider' | 'box' | 'bullets' | 'emoticons' | 'headers';
  content: string;
  description?: string;
  icon?: string;
  isCustom?: boolean;
  createdAt?: number;
}

export const DECORATION_CATEGORIES = [
  { id: 'divider', name: '区切り線・ライン', icon: '➖' },
  { id: 'box', name: '囲み枠・ボックス', icon: '📦' },
  { id: 'headers', name: '見出し・ラベル', icon: '🏷️' },
  { id: 'bullets', name: '箇条書き・数字', icon: '🔢' },
  { id: 'emoticons', name: '顔文字・シンボル', icon: '✨' },
] as const;

export const DECORATION_TEMPLATES: DecorationItem[] = [
  // --- 区切り線 (Divider) ---
  {
    id: 'div-heavy',
    name: '太二重線・太線 (━━━━)',
    category: 'divider',
    content: '━━━━━━━━━━━━━━━━━━━━',
  },
  {
    id: 'div-light',
    name: '細線 (────)',
    category: 'divider',
    content: '────────────────────',
  },
  {
    id: 'div-double',
    name: '二重線 (════)',
    category: 'divider',
    content: '════════════════════',
  },
  {
    id: 'div-dotted',
    name: '点線・破線 (┈┈┈┈)',
    category: 'divider',
    content: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
  },
  {
    id: 'div-stars',
    name: 'キラキラライン (✦ ─── ✦)',
    category: 'divider',
    content: '✦ ──────────────── ✦',
  },
  {
    id: 'div-wave',
    name: '波線 (〜〜〜〜)',
    category: 'divider',
    content: '〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜〜',
  },
  {
    id: 'div-diamond',
    name: 'ダイヤライン (◆◇◆◇)',
    category: 'divider',
    content: '◆━━━━━━━━━━━━━━━━◆',
  },
  {
    id: 'div-cute-star',
    name: '星・花装飾 (*:｡..｡:+)',
    category: 'divider',
    content: '*:｡..｡:+・ﾟ・*:｡..｡:+・ﾟ・*:｡..｡:+',
  },
  {
    id: 'div-arrow-dots',
    name: '矢印ステップ (・‥…━━━☆)',
    category: 'divider',
    content: '・‥…━━━☆・‥…━━━☆',
  },
  {
    id: 'div-triangles',
    name: '幾何学模様 (▼△▼△)',
    category: 'divider',
    content: '▼△▼△▼△▼△▼△▼△▼△▼△▼△▼',
  },

  // --- 囲み枠 (Box) ---
  {
    id: 'box-rounded',
    name: '角丸枠 (╭─╮)',
    category: 'box',
    content: '╭━━━━━━━━━━━━━━━━━━╮\n│  ここに本文を入力  │\n╰━━━━━━━━━━━━━━━━━━╯',
  },
  {
    id: 'box-square-thin',
    name: 'シンプル枠 (┌─┐)',
    category: 'box',
    content: '┌──────────────────┐\n│  ここに本文を入力  │\n└──────────────────┘',
  },
  {
    id: 'box-heavy',
    name: '太枠 (┏━┓)',
    category: 'box',
    content: '┏━━━━━━━━━━━━━━━━━━┓\n┃  ここに本文を入力  ┃\n┗━━━━━━━━━━━━━━━━━━┛',
  },
  {
    id: 'box-double',
    name: '二重枠 (╔═╗)',
    category: 'box',
    content: '╔══════════════════╗\n║  ここに本文を入力  ║\n╚══════════════════╝',
  },
  {
    id: 'box-memo',
    name: '付箋・メモ風 (📌)',
    category: 'box',
    content: '╭── [ 📌 POINT ] ───╮\n│  \n│  \n╰──────────────────╯',
  },
  {
    id: 'box-notice',
    name: 'お知らせ枠 (📢)',
    category: 'box',
    content: '┏━【 📢 お知らせ 】━┓\n┃  \n┗━━━━━━━━━━━━┛',
  },

  // --- 見出し・ラベル (Headers) ---
  {
    id: 'hdr-brackets',
    name: '隅付き括弧 【  】',
    category: 'headers',
    content: '【  】',
  },
  {
    id: 'hdr-sparkle',
    name: 'キラキラ見出し ✨【 】✨',
    category: 'headers',
    content: '✨【  】✨',
  },
  {
    id: 'hdr-ribbon',
    name: 'リボン風 ୨୧ ┈┈┈┈ ୨୧',
    category: 'headers',
    content: '୨୧ ┈┈┈┈┈┈┈┈┈┈┈┈ ୨୧\n   \n୨୧ ┈┈┈┈┈┈┈┈┈┈┈┈ ୨୧',
  },
  {
    id: 'hdr-check',
    name: 'チェック見出し ✅【 CHECK 】',
    category: 'headers',
    content: '✅【  】',
  },
  {
    id: 'hdr-point',
    name: 'ポイント見出し 💡【 POINT 】',
    category: 'headers',
    content: '💡【 POINT 】',
  },
  {
    id: 'hdr-release',
    name: 'リリース見出し 🚀【 NEW 】',
    category: 'headers',
    content: '🚀【 NEW RELEASE 】',
  },

  // --- 箇条書き・数字 (Bullets) ---
  {
    id: 'bullet-keycaps',
    name: '絵文字数字 (1️⃣ 2️⃣ 3️⃣)',
    category: 'bullets',
    content: '1️⃣ \n2️⃣ \n3️⃣ ',
  },
  {
    id: 'bullet-circles',
    name: '丸数字 (① ② ③)',
    category: 'bullets',
    content: '① \n② \n③ ',
  },
  {
    id: 'bullet-filled-circles',
    name: '黒丸数字 (❶ ❷ ❸)',
    category: 'bullets',
    content: '❶ \n❷ \n❸ ',
  },
  {
    id: 'bullet-checks',
    name: 'チェックリスト (✔ / ☑)',
    category: 'bullets',
    content: '☑️ \n☑️ \n☑️ ',
  },
  {
    id: 'bullet-arrows',
    name: '矢印リスト (▶ / ▸ / 👉)',
    category: 'bullets',
    content: '👉 \n👉 \n👉 ',
  },
  {
    id: 'bullet-stars',
    name: 'スター・ダイヤ (✦ / ◆)',
    category: 'bullets',
    content: '✦ \n✦ \n✦ ',
  },

  // --- 顔文字・シンボル (Emoticons) ---
  {
    id: 'emo-cheer',
    name: '応援・ガッツ ( •̀ᴗ•́ )و',
    category: 'emoticons',
    content: '( •̀ᴗ•́ )و',
  },
  {
    id: 'emo-joy',
    name: '大喜び ＼(^o^)／',
    category: 'emoticons',
    content: '＼(^o^)／',
  },
  {
    id: 'emo-smile',
    name: 'にっこり ( ⁎ᵕᴗᵕ⁎ )',
    category: 'emoticons',
    content: '( ⁎ᵕᴗᵕ⁎ )',
  },
  {
    id: 'emo-wink',
    name: 'ウインク (｡•̀ᴗ-)✧',
    category: 'emoticons',
    content: '(｡•̀ᴗ-)✧',
  },
  {
    id: 'emo-bow',
    name: 'お辞儀・感謝 ( _ _)ﾍﾟｺﾘ',
    category: 'emoticons',
    content: '( _ _)ﾍﾟｺﾘ',
  },
  {
    id: 'emo-sparkles-set',
    name: '装飾シンボルセット',
    category: 'emoticons',
    content: '✦ · ﾟ ⋆ ｡ ˚ ☽',
  },
];

export const DEFAULT_DECORATION_TEMPLATES: DecorationItem[] = DECORATION_TEMPLATES;
export const DECORATION_TEMPLATES_STORAGE_KEY = 'crosspost_decoration_templates_v1';

/**
 * 保存された飾り罫線・枠線テンプレート一覧を取得
 */
export function loadDecorationTemplatesFromStorage(): DecorationItem[] {
  if (typeof window === 'undefined') return DEFAULT_DECORATION_TEMPLATES;
  try {
    const raw = localStorage.getItem(DECORATION_TEMPLATES_STORAGE_KEY);
    if (!raw) return DEFAULT_DECORATION_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .map((item: any) => ({
          id: String(item.id || `decor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
          name: String(item.name || '無題の装飾'),
          category: (['divider', 'box', 'headers', 'bullets', 'emoticons'].includes(item.category)
            ? item.category
            : 'divider') as DecorationItem['category'],
          content: String(item.content || ''),
          description: item.description ? String(item.description) : undefined,
          icon: item.icon ? String(item.icon) : undefined,
          isCustom: Boolean(item.isCustom),
          createdAt: item.createdAt ? Number(item.createdAt) : undefined,
        }))
        .filter((item: DecorationItem) => item.name.trim().length > 0 && item.content.length > 0);
    }
  } catch (e) {
    console.error('Failed to load decoration templates from storage:', e);
  }
  return DEFAULT_DECORATION_TEMPLATES;
}

/**
 * 飾り罫線・枠線テンプレート一覧をLocalStorageに保存
 */
export function saveDecorationTemplatesToStorage(items: DecorationItem[]): DecorationItem[] {
  try {
    localStorage.setItem(DECORATION_TEMPLATES_STORAGE_KEY, JSON.stringify(items));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_decoration_templates_updated', { detail: items }));
    }
  } catch (e) {
    console.error('Failed to save decoration templates to storage:', e);
  }
  return items;
}

/**
 * 新しい飾り罫線・枠線テンプレートを追加
 */
export function addDecorationTemplate(item: Omit<DecorationItem, 'id'>): DecorationItem[] {
  const current = loadDecorationTemplatesFromStorage();
  const cleanName = item.name.trim();
  const cleanContent = item.content.trim();
  if (!cleanName || !cleanContent) return current;

  const newItem: DecorationItem = {
    ...item,
    id: `decor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    content: item.content,
    isCustom: true,
    createdAt: Date.now(),
  };

  const updated = [newItem, ...current];
  return saveDecorationTemplatesToStorage(updated);
}

/**
 * 既存の飾り罫線・枠線テンプレートを更新
 */
export function updateDecorationTemplate(item: DecorationItem): DecorationItem[] {
  const current = loadDecorationTemplatesFromStorage();
  const updated = current.map((existing) => (existing.id === item.id ? { ...item, isCustom: true } : existing));
  return saveDecorationTemplatesToStorage(updated);
}

/**
 * 指定IDの飾り罫線・枠線テンプレートを削除
 */
export function removeDecorationTemplate(id: string): DecorationItem[] {
  const current = loadDecorationTemplatesFromStorage();
  const updated = current.filter((item) => item.id !== id);
  return saveDecorationTemplatesToStorage(updated);
}

/**
 * 飾り罫線・枠線テンプレート一覧を初期デフォルトに戻す
 */
export function resetDecorationTemplates(): DecorationItem[] {
  return saveDecorationTemplatesToStorage(DEFAULT_DECORATION_TEMPLATES);
}

/**
 * 選択中のテキストを指定スタイルに変換
 */
export function convertTextToStyle(text: string, styleId: string): string {
  const style = UNICODE_STYLES.find((s) => s.id === styleId);
  if (!style) return text;
  return style.convert(text);
}

// -------------------------------------------------------------
// クイック装飾バー用アイテムの定義と永続化
// -------------------------------------------------------------

export type QuickDecorCategory = 'all' | 'line' | 'box' | 'number' | 'emoji';

export interface QuickDecorationItem {
  id: string;
  label: string;      // ボタンに表示される短いラベル（例: "━━━━", "【  】", "1️⃣"）
  insert: string;     // エディタに挿入されるテキスト
  title?: string;     // ツールチップ
  category?: 'line' | 'box' | 'number' | 'emoji';
  createdAt?: number;
}

export const DEFAULT_QUICK_DECORATIONS: QuickDecorationItem[] = [
  // ━ 罫線・区切り
  { id: 'qd-1', label: '━━━━', insert: '\n━━━━━━━━━━━━━━━━━━━━\n', title: '太二重線区切り (━━━━)', category: 'line' },
  { id: 'qd-2', label: '✦ ─── ✦', insert: '\n✦ ──────────────── ✦\n', title: 'キラキラライン (✦ ─── ✦)', category: 'line' },
  { id: 'qd-3', label: '┈┈┈┈', insert: '\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n', title: '点線区切り (┈┈┈┈)', category: 'line' },
  { id: 'qd-3b', label: '────', insert: '\n────────────────────\n', title: '細線区切り (────)', category: 'line' },
  { id: 'qd-3c', label: '◆ ─── ◆', insert: '\n◆ ──────────────── ◆\n', title: 'ダイヤライン (◆ ─── ◆)', category: 'line' },

  // 【】囲み・見出し
  { id: 'qd-4', label: '【  】', insert: '【  】', title: '隅付き括弧 【  】', category: 'box' },
  { id: 'qd-5', label: '✨【 】✨', insert: '✨【  】✨', title: 'キラキラ見出し ✨【  】✨', category: 'box' },
  { id: 'qd-6', label: '╭─ 枠 ─╮', insert: '╭━━━━━━━━━━━━━━━━━━╮\n│  ここに本文を入力  │\n╰━━━━━━━━━━━━━━━━━━╯\n', title: '角丸枠ボックス', category: 'box' },
  { id: 'qd-6b', label: '『  』', insert: '『  』', title: '二重鍵括弧 『  』', category: 'box' },
  { id: 'qd-6c', label: '▼ 見出し ▼', insert: '▼  ▼\n', title: '下三角見出し', category: 'box' },

  // 1️⃣ 数字・リスト
  { id: 'qd-7', label: '1️⃣', insert: '1️⃣ ', title: '絵文字数字 1️⃣', category: 'number' },
  { id: 'qd-8', label: '2️⃣', insert: '2️⃣ ', title: '絵文字数字 2️⃣', category: 'number' },
  { id: 'qd-9', label: '3️⃣', insert: '3️⃣ ', title: '絵文字数字 3️⃣', category: 'number' },
  { id: 'qd-9b', label: '4️⃣', insert: '4️⃣ ', title: '絵文字数字 4️⃣', category: 'number' },
  { id: 'qd-9c', label: '❶', insert: '❶ ', title: '丸数字 ❶', category: 'number' },
  { id: 'qd-9d', label: '❷', insert: '❷ ', title: '丸数字 ❷', category: 'number' },

  // 😀 記号・絵文字
  { id: 'qd-10', label: '👉', insert: '👉 ', title: '指差しポイント 👉', category: 'emoji' },
  { id: 'qd-11', label: '✅', insert: '✅ ', title: 'チェックマーク ✅', category: 'emoji' },
  { id: 'qd-12', label: '📌', insert: '📌 ', title: '押しピン 📌', category: 'emoji' },
  { id: 'qd-13', label: '💡', insert: '💡 ', title: 'ひらめき 💡', category: 'emoji' },
  { id: 'qd-14', label: '( •̀ᴗ•́ )و', insert: '( •̀ᴗ•́ )و ', title: 'ガッツポーズ ( •̀ᴗ•́ )و', category: 'emoji' },
];

export const QUICK_DECORATIONS_STORAGE_KEY = 'crosspost_quick_decorations_v3';

/**
 * 保存されたクイック装飾一覧を取得
 */
export function loadQuickDecorationsFromStorage(): QuickDecorationItem[] {
  if (typeof window === 'undefined') return DEFAULT_QUICK_DECORATIONS;
  try {
    const raw = localStorage.getItem(QUICK_DECORATIONS_STORAGE_KEY);
    if (!raw) {
      // v2またはv1が存在する場合のマイグレーションチェック
      // ただしユーザーが定義した最新のデフォルト反映を優先
      return DEFAULT_QUICK_DECORATIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        id: String(item.id || `qd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
        label: String(item.label || ''),
        insert: String(item.insert || ''),
        title: item.title ? String(item.title) : undefined,
        category: (item.category as any) || inferCategoryFromItem(item.label, item.insert),
        createdAt: item.createdAt ? Number(item.createdAt) : undefined,
      })).filter((item: QuickDecorationItem) => item.label.trim().length > 0 && item.insert.length > 0);
    }
  } catch (e) {
    console.error('Failed to load quick decorations from storage:', e);
  }
  return DEFAULT_QUICK_DECORATIONS;
}

/**
 * アイテムの文字列からカテゴリを自動推定
 */
export function inferCategoryFromItem(label: string, insert: string): 'line' | 'box' | 'number' | 'emoji' {
  if (/[-━─┈=~✦◆═]{3,}/.test(insert) || /[-━─┈=~✦◆═]{2,}/.test(label)) return 'line';
  if (/^[【『「［(\[<╭┌]/.test(label) || /^[【『「［(\[<╭┌]/.test(insert)) return 'box';
  if (/^[0-9０-９1-9🔟①-⑳❶-➓1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣0️⃣]/.test(label)) return 'number';
  return 'emoji';
}

/**
 * クイック装飾一覧をLocalStorageに保存
 */
export function saveQuickDecorationsToStorage(items: QuickDecorationItem[]): QuickDecorationItem[] {
  try {
    localStorage.setItem(QUICK_DECORATIONS_STORAGE_KEY, JSON.stringify(items));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_quick_decorations_updated', { detail: items }));
    }
  } catch (e) {
    console.error('Failed to save quick decorations to storage:', e);
  }
  return items;
}

/**
 * 新しいクイック装飾を追加
 */
export function addQuickDecoration(
  label: string,
  insert: string,
  title?: string,
  category?: 'line' | 'box' | 'number' | 'emoji'
): QuickDecorationItem[] {
  const current = loadQuickDecorationsFromStorage();
  const cleanLabel = label.trim();
  if (!cleanLabel || !insert) return current;

  // 重複判定（同じlabelとinsertがある場合はスキップ）
  const exists = current.some((item) => item.label === cleanLabel && item.insert === insert);
  if (exists) return current;

  const newItem: QuickDecorationItem = {
    id: `qd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    label: cleanLabel,
    insert,
    title: title ? title.trim() : cleanLabel,
    category: category || inferCategoryFromItem(cleanLabel, insert),
    createdAt: Date.now(),
  };

  const updated = [...current, newItem];
  return saveQuickDecorationsToStorage(updated);
}

/**
 * 指定IDのクイック装飾を削除
 */
export function removeQuickDecoration(id: string): QuickDecorationItem[] {
  const current = loadQuickDecorationsFromStorage();
  const updated = current.filter((item) => item.id !== id);
  return saveQuickDecorationsToStorage(updated);
}

/**
 * 既存のクイック装飾を更新
 */
export function updateQuickDecoration(
  id: string,
  updatedData: Partial<Omit<QuickDecorationItem, 'id'>>
): QuickDecorationItem[] {
  const current = loadQuickDecorationsFromStorage();
  const updated = current.map((item) =>
    item.id === id ? { ...item, ...updatedData } : item
  );
  return saveQuickDecorationsToStorage(updated);
}

/**
 * クイック装飾一覧を初期デフォルトに戻す
 */
export function resetQuickDecorations(): QuickDecorationItem[] {
  return saveQuickDecorationsToStorage(DEFAULT_QUICK_DECORATIONS);
}



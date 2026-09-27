import fs from 'fs';
import { PNG } from 'pngjs';

const data = fs.readFileSync('public/screenshot_editor.png');
const png = PNG.sync.read(data);

// ヘッダー領域 Y=5〜35 を走査して、ボタンの境界（border や background）を検出
// ボタンの高さは通常 h=22〜26px 程度、Y=10〜32 あたり
console.log('--- Scanning buttons in header row (Y=18) ---');
for (let x = 200; x < png.width - 10; x++) {
  const idx = (png.width * 18 + x) << 2;
  const r = png.data[idx];
  const g = png.data[idx + 1];
  const b = png.data[idx + 2];
  
  // 背景色 #050811 や #090f1d (r<15, g<20, b<30) とボタン要素の差分
  // ボタン内部や枠線
}

// ユーザー名表示: yoshiya.bsky.social / @yutakayoshiya
// ヘッダーのボタン群:
// 1. LIVE MODE
// 2. 分析・データ (棒グラフアイコン)
// 3. 使い方 (本アイコン)
// 4. 予約カレンダー (カレンダーアイコン)
// 5. 履歴 (時計/履歴アイコン)
// 6. テーマ (パレットアイコン)
// 7. 設定 (歯車アイコン)
// 8. サーバー登録情報 (フォルダ/鍵アイコン)
// 9. アプリ情報 (iアイコン)
// 10. 終了 (ドア/終了アイコン)

// Y=18におけるボタンの背景矩形（連続する非背景ピクセルブロック）を探す
const isBackground = (x, y) => {
  const idx = (png.width * y + x) << 2;
  const r = png.data[idx];
  const g = png.data[idx + 1];
  const b = png.data[idx + 2];
  // ヘッダーバーのベース色はおよそ rgb(11, 17, 32)
  return r < 18 && g < 22 && b < 38;
};

// Y=12〜24で垂直平均して、ボタンのあるX区間を検出
const profile = [];
for (let x = 0; x < png.width; x++) {
  let nonBgCount = 0;
  for (let y = 10; y <= 26; y++) {
    if (!isBackground(x, y)) nonBgCount++;
  }
  profile.push(nonBgCount > 8 ? 1 : 0);
}

// 連続する区間を抽出
const segments = [];
let inSeg = false;
let startX = 0;
for (let x = 0; x < profile.length; x++) {
  if (profile[x] === 1 && !inSeg) {
    inSeg = true;
    startX = x;
  } else if (profile[x] === 0 && inSeg) {
    inSeg = false;
    if (x - startX > 15) { // 幅15px以上
      segments.push({ startX, endX: x, width: x - startX, centerX: Math.round((startX + x) / 2) });
    }
  }
}
if (inSeg) segments.push({ startX, endX: profile.length, width: profile.length - startX, centerX: Math.round((startX + profile.length) / 2) });

console.log('Detected button segments in screenshot (1904 x 1066):');
segments.forEach((seg, i) => {
  console.log(`Segment ${i}: X=[${seg.startX}, ${seg.endX}] Width=${seg.width} CenterX=${seg.centerX}`);
});

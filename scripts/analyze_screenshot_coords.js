import fs from 'fs';
import { PNG } from 'pngjs';

const data = fs.readFileSync('public/screenshot_editor.png');
const png = PNG.sync.read(data);
console.log(`Image dimensions: ${png.width} x ${png.height}`);

// ヘッダー（Y=0〜50付近）のピクセルを検査
// 各X座標において、Y=10〜30の間で特徴的なボタンの色を探す
// 例えば「LIVE MODE」はエメラルドグリーン (#064e3b や #059669, #34d399 など)
// 「設定」はスカイブルー/青
// 「サーバー登録情報」は緑
// 「終了」は赤 (#dc2626 や #450a0a)
// 「分析」「使い方」「予約カレンダー」「履歴」「テーマ」はダークグレー (#1e293b, #334155)

const y = 20; // ヘッダーの中央高さ付近
console.log(`Scanning row at Y=${y}...`);

// 各ボタンの境界を特定するために色をサンプリング
let buttons = [];
for (let x = 0; x < png.width; x += 10) {
  const idx = (png.width * y + x) << 2;
  const r = png.data[idx];
  const g = png.data[idx + 1];
  const b = png.data[idx + 2];
  // 明るさや色合い
  if (r > 30 || g > 30 || b > 30) {
    // console.log(`x=${x}: rgb(${r},${g},${b})`);
  }
}

// ヘッダー全体の文字やボタンを検出するために、Y=12〜28の範囲で明るいピクセルや色つきピクセルを探す
const headerFeatures = [];
for (let x = 200; x < png.width - 20; x++) {
  for (let py = 12; py <= 28; py++) {
    const idx = (png.width * py + x) << 2;
    const r = png.data[idx];
    const g = png.data[idx + 1];
    const b = png.data[idx + 2];
    
    // 緑 (LIVE MODE または サーバー登録情報)
    if (g > 100 && g > r * 1.3 && g > b * 1.3) {
      headerFeatures.push({ x, py, type: 'green', r, g, b });
      break;
    }
    // 赤 (終了ボタン)
    if (r > 120 && r > g * 1.5 && r > b * 1.5) {
      headerFeatures.push({ x, py, type: 'red', r, g, b });
      break;
    }
    // 青 (設定ボタンなど)
    if (b > 120 && b > r * 1.3) {
      headerFeatures.push({ x, py, type: 'blue', r, g, b });
      break;
    }
  }
}

console.log('Green pixels X range:', 
  headerFeatures.filter(f => f.type === 'green').map(f => f.x).filter((v, i, a) => i === 0 || i === a.length - 1 || v - a[i-1] > 20)
);
console.log('Red pixels X range:', 
  headerFeatures.filter(f => f.type === 'red').map(f => f.x).filter((v, i, a) => i === 0 || i === a.length - 1 || v - a[i-1] > 20)
);
console.log('Blue pixels X range:', 
  headerFeatures.filter(f => f.type === 'blue').map(f => f.x).filter((v, i, a) => i === 0 || i === a.length - 1 || v - a[i-1] > 20)
);

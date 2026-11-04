export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  /** Builds a data URL for the preset image (rendered lazily on the client). */
  render: () => string;
}

interface PixelArt {
  palette: Record<string, string>;
  rows: string[];
}

function renderPixelArt(art: PixelArt, scale = 24, padding = 1, background?: string): string {
  const h = art.rows.length;
  const w = Math.max(...art.rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = (w + padding * 2) * scale;
  canvas.height = (h + padding * 2) * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  art.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = art.palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect((x + padding) * scale, (y + padding) * scale, scale, scale);
    }
  });
  return canvas.toDataURL('image/png');
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const HEART: PixelArt = {
  palette: { k: '#2E2F32', r: '#E3263A', p: '#FF8FA3', w: '#FFFFFF', d: '#9E1B2B' },
  rows: [
    '..kkk...kkk..',
    '.krrrk.krrrk.',
    'krwprrkrrrrrk',
    'krpprrrrrrrrk',
    'krrrrrrrrrrrk',
    'krrrrrrrrrrdk',
    '.krrrrrrrrdk.',
    '..krrrrrrdk..',
    '...krrrrdk...',
    '....krrdk....',
    '.....kdk.....',
    '......k......',
  ],
};

const STAR: PixelArt = {
  palette: { k: '#3B2A10', y: '#FFD21F', o: '#F4A100', w: '#FFF6B0', e: '#2E2F32', c: '#FF8FA3' },
  rows: [
    '.......k.......',
    '......kyk......',
    '......kyk......',
    '.....kywyk.....',
    'kkkkkkywyykkkkk',
    'kyyyyyyyyyyyyok',
    '.kyyyeyyyeyyok.',
    '..kyyeyyyeyok..',
    '...kcyyyyyck...',
    '...kyyykyyyk...',
    '..kyyyokoyyyk..',
    '..kyyokkkoyyk..',
    '.kyyok...koyyk.',
    '.kyok.....koyk.',
    '.kok.......kok.',
    '.kk.........kk.',
  ],
};

const CAT: PixelArt = {
  palette: {
    k: '#2E2F32',
    o: '#F28C28',
    d: '#C65F12',
    w: '#FFFFFF',
    p: '#FF9EB5',
    g: '#4FAE4C',
    c: '#FDE2C4',
  },
  rows: [
    '.k..........k.',
    'kok........kok',
    'kpok......kopk',
    'kppokkkkkkoppk',
    'kooooooooooook',
    'kodoooooooodok',
    'koowgoooowgook',
    'kooggooooggook',
    'koooooppoooook',
    'kccookookoocck',
    'kcccccccccccck',
    '.kcccccccccck.',
    '..kkcccccckk..',
    '....kkkkkk....',
  ],
};

const FLOWER: PixelArt = {
  palette: {
    k: '#2E2F32',
    p: '#E8508E',
    l: '#F6BBD5',
    y: '#FFD21F',
    o: '#F4A100',
    g: '#4FAE4C',
    d: '#1C753E',
  },
  rows: [
    '....kkk.kkk....',
    '...kpplkpplk...',
    '...kplllpllk...',
    '.kkkpllpllpkkk.',
    'kpplkpkkkpkpplk',
    'kplllkyyykllplk',
    'kpppkyyoyykpppk',
    '.kkkkyoyoykkkk.',
    'kpplkyyoyykpplk',
    'kplllkyyyklllpk',
    'kpppkpkkkpkpppk',
    '.kkkpllkllpkkk.',
    '...kpllkllpk...',
    '...kppkgkppk...',
    '....kkkgkkk....',
    '...kgk.gd.kk...',
    '..kggdkgdkggk..',
    '...kkgdgdgdk...',
    '.....kggdk.....',
    '......kgk......',
  ],
};

const MUSHROOM: PixelArt = {
  palette: { k: '#2E2F32', r: '#D62D3A', w: '#FFFFFF', c: '#F7E7C6', s: '#E4CEB0', e: '#2E2F32' },
  rows: [
    '.....kkkkkk.....',
    '...kkrrwwrrkk...',
    '..krrrwwwwrrrk..',
    '.krwwrrwwrrrrrk.',
    '.krwwrrrrrrwwrk.',
    'krrrrrrrrrwwwwrk',
    'krwwrrwwrrwwwwrk',
    'kwwwwrwwwwrwwrrk',
    'kwwwwrwwwwrrrrrk',
    'krwwkkkkkkkkrrrk',
    '.kkkccckkccckkk.',
    '...kccekkeccck..',
    '...kcccccccsck..',
    '...kccccccsssk..',
    '....kcccccssk...',
    '.....kkkkkkk....',
  ],
};

function sunsetSvg(): string {
  return svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3B2A7A"/>
      <stop offset="0.45" stop-color="#E8508E"/>
      <stop offset="0.75" stop-color="#FFA24C"/>
      <stop offset="1" stop-color="#FFE07A"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2B89C6"/>
      <stop offset="1" stop-color="#1F2A55"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#sky)"/>
  <circle cx="320" cy="400" r="120" fill="#FFF08A"/>
  <circle cx="320" cy="400" r="95" fill="#FFD21F"/>
  <rect y="400" width="640" height="240" fill="url(#sea)"/>
  <g fill="#FFD21F" opacity="0.8">
    <rect x="230" y="430" width="180" height="10" rx="5"/>
    <rect x="260" y="465" width="120" height="9" rx="4"/>
    <rect x="285" y="500" width="70" height="8" rx="4"/>
  </g>
  <path d="M0 400 L120 300 L210 370 L300 290 L380 400 Z" fill="#235342"/>
  <path d="M640 400 L540 320 L470 370 L420 340 L380 400 Z" fill="#1C3A2F"/>
  <g fill="#2E2F32">
    <path d="M150 140 q12 -14 24 0 q12 -14 24 0 q-12 -6 -24 4 q-12 -10 -24 -4z"/>
    <path d="M430 110 q9 -11 18 0 q9 -11 18 0 q-9 -5 -18 3 q-9 -8 -18 -3z"/>
  </g>
</svg>`);
}

function planetSvg(): string {
  return svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <radialGradient id="p" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#C3B1E1"/>
      <stop offset="0.5" stop-color="#8A72C1"/>
      <stop offset="1" stop-color="#3E2558"/>
    </radialGradient>
  </defs>
  <rect width="640" height="640" fill="#1F2A55"/>
  <g fill="#FFFFFF">
    <circle cx="80" cy="90" r="6"/><circle cx="560" cy="120" r="8"/><circle cx="520" cy="540" r="6"/>
    <circle cx="110" cy="520" r="7"/><circle cx="300" cy="60" r="5"/><circle cx="600" cy="330" r="5"/>
  </g>
  <g transform="rotate(-18 320 320)">
    <path d="M50 320 A270 70 0 0 1 590 320" fill="none" stroke="#B65F2E" stroke-width="26"/>
  </g>
  <circle cx="320" cy="320" r="170" fill="url(#p)"/>
  <g fill="#6F82C8" opacity="0.6">
    <ellipse cx="270" cy="250" rx="60" ry="16"/>
    <ellipse cx="360" cy="390" rx="80" ry="18"/>
  </g>
  <g transform="rotate(-18 320 320)">
    <path d="M50 320 A270 70 0 0 0 590 320" fill="none" stroke="#F6A35B" stroke-width="26"/>
  </g>
</svg>`);
}

export const PRESETS: PresetDefinition[] = [
  { id: 'heart', name: 'Pixel Heart', description: 'Classic 8-bit heart', render: () => renderPixelArt(HEART) },
  { id: 'star', name: 'Happy Star', description: 'A smiling star friend', render: () => renderPixelArt(STAR) },
  { id: 'cat', name: 'Ginger Cat', description: 'Cute kitty face', render: () => renderPixelArt(CAT, 24, 1, '#BFE3F5') },
  { id: 'flower', name: 'Spring Flower', description: 'Pink bloom with leaves', render: () => renderPixelArt(FLOWER) },
  { id: 'mushroom', name: 'Toadstool', description: 'Spotty red mushroom', render: () => renderPixelArt(MUSHROOM) },
  { id: 'sunset', name: 'Ocean Sunset', description: 'Gradient landscape — photo-like', render: sunsetSvg },
  { id: 'planet', name: 'Ringed Planet', description: 'Space scene with shading', render: planetSvg },
];

/**
 * Validates WCAG AA contrast (>= 4.5:1) for institutional primary pairs.
 * Run: node scripts/a11y/validate-primary-contrast.mjs
 */

function oklchToRgb(l, c, h) {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;
  const lr = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const mg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const sb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  const lin = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  return [lin(lr) * 255, lin(mg) * 255, lin(sb) * 255];
}

function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrast(rgb1, rgb2) {
  const l1 = luminance(...rgb1);
  const l2 = luminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const pairs = [
  {
    name: 'light primary',
    fg: oklchToRgb(0.99, 0, 0),
    bg: oklchToRgb(0.38, 0.12, 258),
  },
  {
    name: 'dark primary',
    fg: oklchToRgb(0.18, 0.04, 258),
    bg: oklchToRgb(0.68, 0.13, 258),
  },
  {
    name: 'light sidebar vs content',
    fg: oklchToRgb(0.985, 0.005, 260),
    bg: oklchToRgb(0.935, 0.028, 258),
  },
  {
    name: 'dark sidebar vs content',
    fg: oklchToRgb(0.2, 0.028, 258),
    bg: oklchToRgb(0.14, 0.012, 258),
  },
];

let failed = false;
for (const { name, fg, bg } of pairs) {
  const ratio = contrast(fg, bg);
  const pass = ratio >= 4.5;
  console.log(`${name}: ${ratio.toFixed(2)}:1 ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) failed = true;
}

process.exit(failed ? 1 : 0);

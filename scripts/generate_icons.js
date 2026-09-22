import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateAllIcons() {
  const publicDir = path.join(__dirname, '..', 'public');
  const imagesDir = path.join(__dirname, '..', 'src', 'assets', 'images');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // Pure Emerald Green with Bold White GTM text and BARBER SHOP underneath
  // Full bleed 512x512 solid green background
  const fullBleedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#059669" />
  <g text-anchor="middle" font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif">
    <text x="256" y="275" font-size="155" font-weight="900" letter-spacing="2" fill="#ffffff">GTM</text>
    <text x="256" y="342" font-size="34" font-weight="800" letter-spacing="6" fill="#f0fdf4">BARBER SHOP</text>
  </g>
</svg>`;

  // Clean Rounded corner SVG for web display (logo.svg)
  const roundedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#059669" />
  <g text-anchor="middle" font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif">
    <text x="256" y="275" font-size="155" font-weight="900" letter-spacing="2" fill="#ffffff">GTM</text>
    <text x="256" y="342" font-size="34" font-weight="800" letter-spacing="6" fill="#f0fdf4">BARBER SHOP</text>
  </g>
</svg>`;

  // Maskable SVG with safe-zone padding
  const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#059669" />
  <g text-anchor="middle" font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif">
    <text x="256" y="265" font-size="130" font-weight="900" letter-spacing="2" fill="#ffffff">GTM</text>
    <text x="256" y="322" font-size="28" font-weight="800" letter-spacing="5" fill="#f0fdf4">BARBER SHOP</text>
  </g>
</svg>`;

  fs.writeFileSync(path.join(publicDir, 'logo.svg'), roundedSvg);

  const buffer512 = await sharp(Buffer.from(fullBleedSvg)).png().toBuffer();
  const bufferMaskable = await sharp(Buffer.from(maskableSvg)).png().toBuffer();

  // 1. icon-512.png
  await sharp(buffer512).resize(512, 512).toFile(path.join(publicDir, 'icon-512.png'));

  // 2. icon-maskable-512.png
  await sharp(bufferMaskable).resize(512, 512).toFile(path.join(publicDir, 'icon-maskable-512.png'));

  // 3. icon-192.png
  await sharp(buffer512).resize(192, 192).toFile(path.join(publicDir, 'icon-192.png'));

  // 4. Apple Touch Icons (all standard iOS sizes)
  await sharp(buffer512).resize(180, 180).toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(buffer512).resize(180, 180).toFile(path.join(publicDir, 'apple-touch-icon-precomposed.png'));
  await sharp(buffer512).resize(180, 180).toFile(path.join(publicDir, 'apple-touch-icon-180x180.png'));
  await sharp(buffer512).resize(152, 152).toFile(path.join(publicDir, 'apple-touch-icon-152x152.png'));
  await sharp(buffer512).resize(120, 120).toFile(path.join(publicDir, 'apple-touch-icon-120x120.png'));

  // 5. logo.png (1024x1024) and logo.jpg
  await sharp(Buffer.from(fullBleedSvg)).resize(1024, 1024).png().toFile(path.join(publicDir, 'logo.png'));
  await sharp(Buffer.from(fullBleedSvg)).resize(1024, 1024).jpeg({ quality: 95 }).toFile(path.join(publicDir, 'logo.jpg'));

  // 6. Overwrite old asset in src if present
  await sharp(Buffer.from(fullBleedSvg)).resize(1024, 1024).jpeg({ quality: 95 }).toFile(path.join(imagesDir, 'logo_emblem_1788337017943.jpg'));

  // 7. favicon-32x32.png and favicon.ico
  const favBuffer = await sharp(buffer512).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), favBuffer);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favBuffer);

  console.log('All icons and Apple Touch Icons successfully generated!');
}

generateAllIcons().catch(err => {
  console.error('Failed generating icons:', err);
  process.exit(1);
});

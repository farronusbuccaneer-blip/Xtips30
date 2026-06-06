/**
 * Configuration and Default Assets for InfoGraphic Generator Studio
 */

const TEMPLATE_15_2_ID = 'template-15-2';
const TEMPLATE_5_6_ID = 'template-5-6';
const DEFAULT_TEMPLATE_ID = TEMPLATE_15_2_ID;

// Helper to draw rounded rectangle on canvas context
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Returns coordinate bounds for the 15 rows by 2 columns template.
 * Canvas resolution: 1200x1600.
 * Column-first ordering (1-15 left, 16-30 right).
 */
function get15x2Coords() {
  const sections = [];
  for (let k = 0; k < 30; k++) {
    const col = k < 15 ? 0 : 1;
    const row = k < 15 ? k : k - 15;
    
    // Card geometry:
    const cardX = 60 + col * 560;
    const cardY = 230 + row * 86;
    const cardW = 520;
    const cardH = 80;

    sections.push({
      x: cardX + 48,           // Offset for number circle (48px)
      y: cardY + 6,            // Offset leaving thin card border spacing
      w: cardW - 48 - 84,      // Width leaving space for number badge (48px) and image slot (84px)
      h: cardH - 12            // Height leaving top/bottom card padding
    });
  }
  return {
    title: { x: 90, y: 50, w: 1020, h: 130 },
    sections: sections
  };
}

/**
 * Returns coordinate bounds for the 5 rows by 6 columns template.
 * Canvas resolution: 1200x1600.
 * Row-first ordering.
 */
function get5x6Coords() {
  const sections = [];
  for (let k = 0; k < 30; k++) {
    const row = Math.floor(k / 6);
    const col = k % 6;
    
    // Card geometry:
    const cardX = 68 + col * 180;
    const cardY = 230 + row * 252;
    const cardW = 164;
    const cardH = 236;

    sections.push({
      x: cardX + 10,           // Left padding inside card
      y: cardY + 44,           // Offset leaving top number circle spacing (44px)
      w: cardW - 20,           // Width leaving side paddings
      h: cardH - 44 - 94       // Height leaving top circle (44px) and bottom image slot (94px)
    });
  }
  return {
    title: { x: 90, y: 50, w: 1020, h: 130 },
    sections: sections
  };
}

// Default XML template loaded on first startup (30 Japanese-English expressions)
const DEFAULT_XML_TEXT = `<title>分かったふりの愛想笑いを防ぐ<red>大人の相槌</red>30選</title>

<section1>
  <row1>I see.</row1>
  <row2>なるほど、そういうことですね。</row2>
</section1>

<section2>
  <row1>Makes sense.</row1>
  <row2>理にかなっていますね。</row2>
</section2>

<section3>
  <row1>Exactly.</row1>
  <row2>まさにその通りです。</row2>
</section3>

<section4>
  <row1>Absolutely.</row1>
  <row2>全く同感です。</row2>
</section4>

<section5>
  <row1>That's true.</row1>
  <row2>確かにそうですね。</row2>
</section5>

<section6>
  <row1>I totally agree.</row1>
  <row2>完全に同意します。</row2>
</section6>

<section7>
  <row1>Right.</row1>
  <row2>そうですね。</row2>
</section7>

<section8>
  <row1>Fair enough.</row1>
  <row2>それなら納得です。</row2>
</section8>

<section9>
  <row1>Good point.</row1>
  <row2>良い視点ですね。</row2>
</section9>

<section10>
  <row1>I'm with you.</row1>
  <row2>あなたに賛成です。</row2>
</section10>

<section11>
  <row1>No doubt.</row1>
  <row2>疑いの余地なしですね。</row2>
</section11>

<section12>
  <row1>I get it.</row1>
  <row2>理解しました。</row2>
</section12>

<section13>
  <row1>Understood.</row1>
  <row2>承知いたしました。</row2>
</section13>

<section14>
  <row1>That's a great idea.</row1>
  <row2>それは素晴らしい提案ですね。</row2>
</section14>

<section15>
  <row1>I hear you.</row1>
  <row2>おっしゃることは分かります。</row2>
</section15>

<section16>
  <row1>Interesting.</row1>
  <row2>興味深いですね。</row2>
</section16>

<section17>
  <row1>Sure.</row1>
  <row2>もちろんです。</row2>
</section17>

<section18>
  <row1>I couldn't agree more.</row1>
  <row2>これ以上ないほど大賛成です。</row2>
</section18>

<section19>
  <row1>Spot on.</row1>
  <row2>的を射ていますね。</row2>
</section19>

<section20>
  <row1>That works for me.</row1>
  <row2>それで進めましょう。</row2>
</section20>

<section21>
  <row1>Definitely.</row1>
  <row2>間違いありません。</row2>
</section21>

<section22>
  <row1>Sounds good.</row1>
  <row2>良さそうですね。</row2>
</section22>

<section23>
  <row1>I'm following you.</row1>
  <row2>話についていけてますよ。</row2>
</section23>

<section24>
  <row1>I see your point.</row1>
  <row2>言い分は理解できます。</row2>
</section24>

<section25>
  <row1>That's understandable.</row1>
  <row2>ごもっともです。</row2>
</section25>

<section26>
  <row1>You're right.</row1>
  <row2>おっしゃる通りです。</row2>
</section26>

<section27>
  <row1>Noted.</row1>
  <row2>記録にとどめました（了解）。</row2>
</section27>

<section28>
  <row1>Tell me more.</row1>
  <row2>もう少し詳しく教えてください。</row2>
</section28>

<section29>
  <row1>I see what you mean.</row1>
  <row2>意図は分かりました。</row2>
</section29>

<section30>
  <row1>Gotcha.</row1>
  <row2>了解、バッチリです。</row2>
</section30>`;

/**
 * Common draw steps for grid templates
 */
function drawBaseCanvasTemplate() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');

  // 1. Draw Cream Background
  ctx.fillStyle = '#F7F4EB';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw Dot Grid Pattern
  ctx.fillStyle = '#E6E1D8';
  const dotSpacing = 30;
  for (let x = 15; x < canvas.width; x += dotSpacing) {
    for (let y = 15; y < canvas.height; y += dotSpacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const navyColor = '#1E314B';
  const coralColor = '#D3544C';

  // 3. Draw Title Box (Drop Shadow and Navy Border)
  // Drop Shadow
  ctx.fillStyle = coralColor;
  drawRoundedRect(ctx, 80 + 8, 40 + 8, 1040, 150, 12);
  ctx.fill();
  // Main Rect
  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, 80, 40, 1040, 150, 12);
  ctx.fill();
  ctx.strokeStyle = navyColor;
  ctx.lineWidth = 6;
  ctx.stroke();

  return { canvas, ctx };
}

/**
 * Programmatically generates the 15x2 template as a Base64 PNG.
 */
function generate15x2Template() {
  const { canvas, ctx } = drawBaseCanvasTemplate();
  const navyColor = '#1E314B';

  // Draw 15x2 card grid
  for (let k = 0; k < 30; k++) {
    const col = k < 15 ? 0 : 1;
    const row = k < 15 ? k : k - 15;
    const boxX = 60 + col * 560;
    const boxY = 230 + row * 86;
    const boxW = 520;
    const boxH = 80;

    // Fill white card
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 8);
    ctx.fill();

    // Border (thin light gray / slate divider)
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Number Circle
    const circleX = boxX + 24;
    const circleY = boxY + 40;
    const circleRadius = 14;

    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = navyColor;
    ctx.fill();

    // Number Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = "bold 14px 'Segoe UI', 'Noto Sans JP', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((k + 1).toString(), circleX, circleY);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Programmatically generates the 5x6 template as a Base64 PNG.
 */
function generate5x6Template() {
  const { canvas, ctx } = drawBaseCanvasTemplate();
  const navyColor = '#1E314B';

  // Draw 5x6 card grid
  for (let k = 0; k < 30; k++) {
    const row = Math.floor(k / 6);
    const col = k % 6;
    const boxX = 68 + col * 180;
    const boxY = 230 + row * 252;
    const boxW = 164;
    const boxH = 236;

    // Fill white card
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 8);
    ctx.fill();

    // Border (thin light gray / slate divider)
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Number Circle Badge at top center
    const badgeX = boxX + boxW / 2;
    const badgeY = boxY + 22;
    const badgeRadius = 14;

    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = navyColor;
    ctx.fill();

    // Number Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = "bold 14px 'Segoe UI', 'Noto Sans JP', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((k + 1).toString(), badgeX, badgeY);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Standard utility to scale coordinate configs to any image's dimensions.
 * Maps 15x2 template coords proportionally to targetWidth / targetHeight.
 */
function getScaledCoords(targetWidth, targetHeight) {
  const scaleX = targetWidth / 1200;
  const scaleY = targetHeight / 1600;

  const baseCoords = get15x2Coords();
  return {
    title: {
      x: Math.round(baseCoords.title.x * scaleX),
      y: Math.round(baseCoords.title.y * scaleY),
      w: Math.round(baseCoords.title.w * scaleX),
      h: Math.round(baseCoords.title.h * scaleY)
    },
    sections: baseCoords.sections.map(sec => ({
      x: Math.round(sec.x * scaleX),
      y: Math.round(sec.y * scaleY),
      w: Math.round(sec.w * scaleX),
      h: Math.round(sec.h * scaleY)
    }))
  };
}

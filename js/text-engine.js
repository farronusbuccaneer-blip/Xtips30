/**
 * Text parsing and rendering engine for InfoGraphic Generator Studio
 * Handles inline highlighting via <red> or <emp> tags and dynamic box fitting.
 */

/**
 * Parses raw text input containing XML-like tags into a structured object.
 * Tolerates malformed or unclosed tags gracefully. Supports up to 30 sections.
 */
function parseXMLText(text) {
  const result = {
    title: '',
    sections: Array.from({ length: 30 }, () => ({ row1: '', row2: '' }))
  };

  if (!text) return result;

  // 1. Extract Title
  const titleMatch = text.match(/<title>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  }

  // 2. Extract Sections 1 to 30
  for (let i = 1; i <= 30; i++) {
    const sectionRegex = new RegExp(`<section${i}>([\\s\\S]*?)<\/section${i}>`, 'i');
    const sectionMatch = text.match(sectionRegex);
    if (sectionMatch) {
      const sectionContent = sectionMatch[1];
      const r1Match = sectionContent.match(/<row1>([\s\S]*?)<\/row1>/i);
      const r2Match = sectionContent.match(/<row2>([\s\S]*?)<\/row2>/i);

      result.sections[i - 1].row1 = r1Match ? r1Match[1].trim() : '';
      result.sections[i - 1].row2 = r2Match ? r2Match[1].trim() : '';
    }
  }

  return result;
}

/**
 * Tokenizes text character-by-character to parse inline style tags like <red> or <emp>.
 * Returns an array of objects: { char: String, isRed: Boolean }
 */
function tokenizeText(text) {
  const tokens = [];
  if (!text) return tokens;

  let i = 0;
  let isRed = false;

  while (i < text.length) {
    if (text.startsWith('<emp>', i) || text.startsWith('<red>', i)) {
      isRed = true;
      i += 5; // length of tag
    } else if (text.startsWith('</emp>', i) || text.startsWith('</red>', i)) {
      isRed = false;
      i += 6; // length of tag
    } else {
      tokens.push({ char: text[i], isRed: isRed });
      i++;
    }
  }

  return tokens;
}

/**
 * Splits token arrays by newlines ONLY. Used to support custom newlines for the Title.
 */
function splitTokensByNewline(tokensArray) {
  const lines = [];
  let currentLine = [];

  for (let i = 0; i < tokensArray.length; i++) {
    const token = tokensArray[i];
    if (token.char === '\n') {
      lines.push(currentLine);
      currentLine = [];
    } else {
      currentLine.push(token);
    }
  }
  
  if (currentLine.length > 0 || lines.length === 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Wraps styled character tokens based on a max width. Handles hybrid Japanese (character wrap) 
 * and English (word wrap) seamlessly.
 * Returns an array of lines, where each line is an array of token objects.
 */
function wrapStyledText(ctx, tokensArray, maxWidth) {
  if (!tokensArray || tokensArray.length === 0) return [];

  // Helper to check CJK
  const isCJK = char => /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(char);

  const words = [];
  let currentWord = [];

  // Group tokens into "words"
  for (let i = 0; i < tokensArray.length; i++) {
    const token = tokensArray[i];
    const char = token.char;

    if (isCJK(char) || char === ' ' || char === '\n') {
      if (currentWord.length > 0) {
        words.push(currentWord);
        currentWord = [];
      }
      words.push([token]);
    } else {
      currentWord.push(token);
    }
  }
  if (currentWord.length > 0) {
    words.push(currentWord);
  }

  const lines = [];
  let currentLine = [];

  // Helper to measure token array width
  const measureLine = (lineTokens) => {
    const str = lineTokens.map(t => t.char).join('');
    return ctx.measureText(str).width;
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (word.length === 1 && word[0].char === '\n') {
      lines.push(currentLine);
      currentLine = [];
      continue;
    }

    if (word.length === 1 && word[0].char === ' ' && currentLine.length === 0) {
      continue; // Skip leading space
    }

    const testLine = currentLine.concat(word);
    const width = measureLine(testLine);

    if (width > maxWidth && currentLine.length > 0) {
      const wordWidth = measureLine(word);
      if (wordWidth > maxWidth && !(word.length === 1 && word[0].char === ' ')) {
        // Split long words character-by-character
        for (let j = 0; j < word.length; j++) {
          const token = word[j];
          const testCharLine = currentLine.concat([token]);
          if (measureLine(testCharLine) > maxWidth) {
            lines.push(currentLine);
            currentLine = [token];
          } else {
            currentLine = testCharLine;
          }
        }
      } else {
        lines.push(currentLine);
        currentLine = (word.length === 1 && word[0].char === ' ') ? [] : word;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Performs dynamic fit-to-box rendering on the target canvas context.
 * Adjusts font sizes iteratively to ensure all text fits inside their boxes.
 */
function renderTextOnCanvas(ctx, parsedText, coords, uploadedImages = {}, templateId = '') {
  const fontFam = "'Segoe UI', 'Noto Sans JP', sans-serif";
  ctx.textBaseline = 'top';

  // Charcoal & Red Color Palette
  const mainCharcoal = '#333333';
  const secondaryCharcoal = '#555555';
  const emphasisRed = '#E63946';

  // Get canvas width and height for relative footer offsets
  const originalWidth = ctx.canvas.width;
  const originalHeight = ctx.canvas.height;

  // 1. Render Title
  if (parsedText.title && coords.title) {
    const box = coords.title;
    let s = 65; // Starting title font size optimized for h=130
    const minS = 16;
    
    const titleTokens = tokenizeText(parsedText.title);
    const titleLines = splitTokensByNewline(titleTokens);
    let titleTotalHeight = 0;

    // Search for a font size that fits in width and height
    while (s >= minS) {
      ctx.font = `bold ${s}px ${fontFam}`;
      
      let allLinesFit = true;
      for (let i = 0; i < titleLines.length; i++) {
        const lineStr = titleLines[i].map(t => t.char).join('');
        if (ctx.measureText(lineStr).width > box.w) {
          allLinesFit = false;
          break;
        }
      }

      titleTotalHeight = titleLines.length > 0 
        ? (titleLines.length - 1) * (s * 1.35) + s 
        : 0;

      if (allLinesFit && titleTotalHeight <= box.h) {
        break;
      }
      s -= 1;
    }

    // Draw Title (centered horizontally and vertically)
    ctx.font = `bold ${s}px ${fontFam}`;
    ctx.textAlign = 'left';
    
    const titleStartY = box.y + (box.h - titleTotalHeight) / 2;

    titleLines.forEach((line, index) => {
      const lineStr = line.map(t => t.char).join('');
      const lineWidth = ctx.measureText(lineStr).width;
      
      let currentX = box.x + (box.w - lineWidth) / 2;
      const currentY = titleStartY + index * (s * 1.35);

      line.forEach(token => {
        ctx.fillStyle = token.isRed ? emphasisRed : mainCharcoal;
        ctx.fillText(token.char, currentX, currentY);
        currentX += ctx.measureText(token.char).width;
      });
    });
  }

  // 2. Render Sections (Up to 30)
  const isGrid5x6 = (templateId === TEMPLATE_5_6_ID);
  const numSections = coords.sections.length;
  const sectionLayouts = [];

  // Pass 1: Sizing Computation Pass
  for (let i = 0; i < numSections; i++) {
    const sec = parsedText.sections[i];
    const box = coords.sections[i];
    if (!sec || !box) {
      sectionLayouts.push(null);
      continue;
    }

    // Skip section if empty
    if (!sec.row1 && !sec.row2) {
      sectionLayouts.push(null);
      continue;
    }

    let s1 = 36; // Starting size for Row 1 (header)
    let s = 24;  // Starting size for Row 2 (translation)
    const minS1 = 10;
    const minS = 6;
    
    // Fit Row 1 independently
    let r1Lines = [];
    let r1H = 0;
    if (sec.row1) {
      const r1Tokens = tokenizeText(sec.row1);
      while (s1 >= minS1) {
        ctx.font = `bold ${s1}px ${fontFam}`;
        const fitsSingle = ctx.measureText(sec.row1).width <= box.w;
        if (fitsSingle || s1 < 14) { // Allow wrap if below 14px
          r1Lines = wrapStyledText(ctx, r1Tokens, box.w);
          r1H = r1Lines.length > 0 ? (r1Lines.length - 1) * (s1 * 1.3) + s1 : 0;
          if (r1H <= box.h * 0.6) {
            break;
          }
        }
        s1 -= 0.5;
      }
    }

    // Fit Row 2 independently
    let r2Lines = [];
    let r2H = 0;
    if (sec.row2) {
      const r2Tokens = tokenizeText(sec.row2);
      while (s >= minS) {
        ctx.font = `bold ${s}px ${fontFam}`;
        const fitsSingle = ctx.measureText(sec.row2).width <= box.w;
        if (fitsSingle || s < 11) { // Allow wrap if below 11px
          r2Lines = wrapStyledText(ctx, r2Tokens, box.w);
          r2H = r2Lines.length > 0 ? (r2Lines.length - 1) * (s * 1.35) + s : 0;
          if (r2H <= box.h * 0.8) {
            break;
          }
        }
        s -= 0.5;
      }
    }

    // Adjust combined height
    let gap = Math.round(Math.min(s1, s) * 0.40);
    let activeRows = 0;
    if (r1H > 0) activeRows++;
    if (r2H > 0) activeRows++;
    let totalH = r1H + r2H + (activeRows > 1 ? (activeRows - 1) * gap : 0);

    // If combined height exceeds the box height, scale down Row 2 first (Row 1 stays as large as possible)
    while (totalH > box.h && (s > minS || s1 > minS1)) {
      if (s > minS) {
        s -= 0.5;
      } else if (s1 > minS1) {
        s1 -= 0.5;
      } else {
        break;
      }

      gap = Math.round(Math.min(s1, s) * 0.40);

      if (sec.row1) {
        ctx.font = `bold ${s1}px ${fontFam}`;
        r1Lines = wrapStyledText(ctx, tokenizeText(sec.row1), box.w);
        r1H = r1Lines.length > 0 ? (r1Lines.length - 1) * (s1 * 1.3) + s1 : 0;
      }
      if (sec.row2) {
        ctx.font = `bold ${s}px ${fontFam}`;
        r2Lines = wrapStyledText(ctx, tokenizeText(sec.row2), box.w);
        r2H = r2Lines.length > 0 ? (r2Lines.length - 1) * (s * 1.35) + s : 0;
      }
      totalH = r1H + r2H + (activeRows > 1 ? (activeRows - 1) * gap : 0);
    }

    sectionLayouts.push({
      s1,
      s,
      r1Lines,
      r2Lines,
      r1H,
      r2H,
      gap,
      activeRows,
      totalH,
      box,
      sec
    });
  }

  // Pass 2: Uniformity Pass for Row 1 in 5x6 layout
  if (isGrid5x6) {
    const activeS1s = sectionLayouts
      .filter(l => l !== null && l.sec.row1)
      .map(l => l.s1);

    if (activeS1s.length > 0) {
      const uniformS1 = Math.min(...activeS1s);

      // Recompute layout for all sections using uniformS1
      for (let i = 0; i < numSections; i++) {
        const layout = sectionLayouts[i];
        if (!layout || !layout.sec.row1) continue;

        layout.s1 = uniformS1;
        ctx.font = `bold ${uniformS1}px ${fontFam}`;
        layout.r1Lines = wrapStyledText(ctx, tokenizeText(layout.sec.row1), layout.box.w);
        layout.r1H = layout.r1Lines.length > 0 
          ? (layout.r1Lines.length - 1) * (uniformS1 * 1.3) + uniformS1 
          : 0;

        layout.gap = Math.round(Math.min(uniformS1, layout.s) * 0.40);
        layout.totalH = layout.r1H + layout.r2H + (layout.activeRows > 1 ? (layout.activeRows - 1) * layout.gap : 0);
      }
    }
  }

  // Pass 3: Rendering Pass
  for (let i = 0; i < numSections; i++) {
    const layout = sectionLayouts[i];
    if (!layout) continue;

    const { s1, s, r1Lines, r2Lines, totalH, gap, box, sec } = layout;

    // Draw Section Text
    ctx.textAlign = 'left';
    let currentY = box.y + (box.h - totalH) / 2;

    // Draw Row 1 (Header Row)
    if (r1Lines.length > 0) {
      ctx.font = `bold ${s1}px ${fontFam}`;
      r1Lines.forEach(line => {
        const lineStr = line.map(t => t.char).join('');
        const lineWidth = ctx.measureText(lineStr).width;
        let currentX = isGrid5x6 ? box.x + (box.w - lineWidth) / 2 : box.x;
        
        line.forEach(token => {
          ctx.fillStyle = token.isRed ? emphasisRed : mainCharcoal;
          ctx.fillText(token.char, currentX, currentY);
          currentX += ctx.measureText(token.char).width;
        });
        currentY += s1 * 1.3;
      });
      currentY += gap - (s1 * 0.3);
    }

    // Draw Row 2
    if (r2Lines.length > 0) {
      ctx.font = `bold ${s}px ${fontFam}`;
      r2Lines.forEach(line => {
        const lineStr = line.map(t => t.char).join('');
        const lineWidth = ctx.measureText(lineStr).width;
        let currentX = isGrid5x6 ? box.x + (box.w - lineWidth) / 2 : box.x;
        
        line.forEach(token => {
          ctx.fillStyle = token.isRed ? emphasisRed : secondaryCharcoal;
          ctx.fillText(token.char, currentX, currentY);
          currentX += ctx.measureText(token.char).width;
        });
        currentY += s * 1.35;
      });
    }

    // Draw section-specific transparent image in fixed layout slot if uploaded
    const sectionNum = i + 1;
    if (uploadedImages && uploadedImages[sectionNum]) {
      const img = uploadedImages[sectionNum];
      if (templateId === TEMPLATE_15_2_ID) {
        const col = i < 15 ? 0 : 1;
        const row = i < 15 ? i : i - 15;
        const cardX = 60 + col * 560;
        const cardY = 230 + row * 86;
        const cardW = 520;
        const cardH = 80;
        
        const imgW = 64;
        const imgH = 64;
        const imgX = cardX + cardW - imgW - 10;
        const imgY = cardY + (cardH - imgH) / 2;
        ctx.drawImage(img, imgX, imgY, imgW, imgH);
      } else if (templateId === TEMPLATE_5_6_ID) {
        const row = Math.floor(i / 6);
        const col = i % 6;
        const cardX = 68 + col * 180;
        const cardY = 230 + row * 252;
        const cardW = 164;
        const cardH = 236;
        
        const imgW = 70;
        const imgH = 70;
        const imgX = cardX + (cardW - imgW) / 2;
        const imgY = cardY + cardH - imgH - 12;
        ctx.drawImage(img, imgX, imgY, imgW, imgH);
      }
    }
  }

  // 3. Render Footer (Branding & Bookmark CTA)
  // Scale footer relative to active template resolution
  const scaleX = originalWidth / 1200;
  const scaleY = originalHeight / 1600;
  const footerS = Math.round(28 * Math.min(scaleX, scaleY));
  
  ctx.font = `bold ${footerS}px ${fontFam}`;
  ctx.fillStyle = '#1E314B'; // Navy color matches template border
  ctx.textBaseline = 'middle';
  
  const footerY = 1550 * scaleY; // Vertical center of the footer space (line is at 1514+)

  // Bottom Left: @farron_us
  ctx.textAlign = 'left';
  const leftX = 80 * scaleX;
  ctx.fillText('@farron_us', leftX, footerY);

  // Bottom Right: Bookmark CTA + Bookmark Icon
  ctx.textAlign = 'right';
  const rightX = 1120 * scaleX;
  const iconW = 24 * scaleX;
  const iconH = 32 * scaleY;
  
  // Draw CTA text offset from the right boundary to make space for the icon
  ctx.fillText('すぐ見返せるようにブックマーク↓', rightX - iconW - 12 * scaleX, footerY);

  // Draw vector bookmark icon
  const iconX = rightX - iconW;
  const iconY = footerY - iconH / 2;
  
  ctx.beginPath();
  ctx.moveTo(iconX, iconY);
  ctx.lineTo(iconX + iconW, iconY);
  ctx.lineTo(iconX + iconW, iconY + iconH);
  ctx.lineTo(iconX + iconW / 2, iconY + iconH * 0.7); // Bookmark bottom notch
  ctx.lineTo(iconX, iconY + iconH);
  ctx.closePath();
  ctx.fillStyle = '#1E314B';
  ctx.fill();
}

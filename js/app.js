/**
 * InfoGraphic Generator Studio - Main Orchestrator
 */

// Application State
let canvas;
let activeTemplate = null;
let activeCoords = null;
let zoomRatio = 1.0;
let originalWidth = 1200;
let originalHeight = 1600;
let textRenderDebounceTimer = null;
window.sectionImages = {}; // Session transparent PNGs for sections 1-30 (in-memory)
window.sectionImageNames = {}; // File names for transparent PNGs (in-memory)
window.titleImage = null; // Session transparent PNG/stamp for title (in-memory)
window.titleImageName = ''; // File name for title transparent PNG/stamp (in-memory)

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const workspaceEl = document.getElementById('workspace');
const xmlInput = document.getElementById('xml-input');
const templatesGrid = document.getElementById('templates-grid');
const overlaysGrid = document.getElementById('overlays-grid');
const toastContainer = document.getElementById('toast-container');

// Buttons
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomFit = document.getElementById('btn-zoom-fit');
const btnToggleTheme = document.getElementById('btn-toggle-theme');
const btnClearCanvas = document.getElementById('btn-clear-canvas');
const btnDownload = document.getElementById('btn-download');
const btnResetText = document.getElementById('btn-reset-text');
const btnClearText = document.getElementById('btn-clear-text');

// File Upload inputs
const inputUploadTemplate = document.getElementById('input-upload-template');
const inputUploadOverlay = document.getElementById('input-upload-overlay');
const uploadTemplateZone = document.getElementById('upload-template-zone');
const uploadOverlayZone = document.getElementById('upload-overlay-zone');

/**
 * Toast Notifications helper
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-check';
  if (type === 'danger') icon = 'fa-triangle-exclamation';
  if (type === 'warning') icon = 'fa-circle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  toastContainer.appendChild(toast);

  // Remove toast after animation finishes
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 2500);
}

/**
 * Initialize Default Assets in IndexedDB on first load
 */
async function initializeDefaultAssets() {
  // Clean up old template if present
  await db.templates.delete('default-template');
  await db.configs.delete('default-template');

  // 1. Templates (Put both programmatically generated 30-item templates)
  const template15_2Data = generate15x2Template();
  const template5_6Data = generate5x6Template();

  await db.templates.put({
    id: TEMPLATE_15_2_ID,
    name: '15行2列 (右側画像)',
    data_url: template15_2Data,
    created_at: Date.now() - 1000
  });

  await db.templates.put({
    id: TEMPLATE_5_6_ID,
    name: '5行6列 (下部画像)',
    data_url: template5_6Data,
    created_at: Date.now()
  });
  
  // Save configurations
  await db.configs.put({
    template_id: TEMPLATE_15_2_ID,
    title: get15x2Coords().title,
    sections: get15x2Coords().sections
  });

  await db.configs.put({
    template_id: TEMPLATE_5_6_ID,
    title: get5x6Coords().title,
    sections: get5x6Coords().sections
  });

  // 2. Stamps/Overlays
  const overlayCount = await db.overlays.count();
  if (overlayCount === 0) {
    const overlays = [
      { name: 'チェック緑', draw: (ctx) => {
        ctx.fillStyle = '#10B981';
        ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(35, 65); ctx.lineTo(55, 85); ctx.lineTo(90, 45); ctx.stroke();
      }},
      { name: 'チェック赤', draw: (ctx) => {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(35, 65); ctx.lineTo(55, 85); ctx.lineTo(90, 45); ctx.stroke();
      }},
      { name: '警告マーク', draw: (ctx) => {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.font = "bold 70px sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 64, 64);
      }},
      { name: 'はてな', draw: (ctx) => {
        ctx.fillStyle = '#3B82F6';
        ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.font = "bold 65px sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 64, 64);
      }},
      { name: 'ゴールドスター', draw: (ctx) => {
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 55 + 64, -Math.sin((18 + i * 72) * Math.PI / 180) * 55 + 64);
          ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 22 + 64, -Math.sin((54 + i * 72) * Math.PI / 180) * 22 + 64);
        }
        ctx.closePath(); ctx.fill();
      }},
      { name: '矢印右', draw: (ctx) => {
        ctx.fillStyle = '#6366F1';
        ctx.beginPath();
        ctx.moveTo(15, 45); ctx.lineTo(75, 45); ctx.lineTo(75, 25); ctx.lineTo(110, 64);
        ctx.lineTo(75, 103); ctx.lineTo(75, 83); ctx.lineTo(15, 83); ctx.closePath(); ctx.fill();
      }}
    ];

    for (const item of overlays) {
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 128;
      item.draw(cv.getContext('2d'));
      await db.overlays.add({
        id: crypto.randomUUID(),
        name: item.name,
        data_url: cv.toDataURL('image/png'),
        created_at: Date.now()
      });
    }
  }
}

/**
 * Initialize Fabric Interactive Canvas
 */
function initFabricCanvas() {
  canvas = new fabric.Canvas('canvas', {
    selection: true,
    preserveObjectStacking: true
  });

  // Attach delete key listeners
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') {
        return;
      }
      const active = canvas.getActiveObject();
      // Don't delete bounding boxes in Edit Coordinate mode
      if (active && active.name !== 'title' && !active.name?.startsWith('section')) {
        canvas.remove(active);
        canvas.discardActiveObject();
        canvas.renderAll();
        showToast('スタンプを削除しました');
      }
    }
  });
}



/**
 * Core Dynamic Render: Draws background + XML text to base high-res canvas
 * and sets it as the Fabric Background.
 */
function renderCanvasBackground() {
  if (!activeTemplate) return;

  const parsed = parseXMLText(xmlInput.value);
  const hiddenCanvas = document.getElementById('hidden-base-canvas');
  hiddenCanvas.width = originalWidth;
  hiddenCanvas.height = originalHeight;
  const ctx = hiddenCanvas.getContext('2d');

  const img = new Image();
  img.onload = function() {
    // 1. Draw template background
    ctx.drawImage(img, 0, 0, originalWidth, originalHeight);

    // 2. Render fit-to-box texts and custom section-specific images
    renderTextOnCanvas(ctx, parsed, activeCoords, window.sectionImages, activeTemplate.id);

    // 3. Update interactive Fabric canvas background
    const dataUrl = hiddenCanvas.toDataURL('image/png');
    fabric.Image.fromURL(dataUrl, (fabricImg) => {
      canvas.setBackgroundImage(fabricImg, () => {
        syncFabricImages();
      }, {
        originX: 'left',
        originY: 'top',
        width: originalWidth,
        height: originalHeight
      });
    });
  };
  img.src = activeTemplate.data_url;
}

/**
 * Debounced trigger for text inputs
 */
function triggerRenderDebounced() {
  clearTimeout(textRenderDebounceTimer);
  textRenderDebounceTimer = setTimeout(renderCanvasBackground, 40);
}

/**
 * Zoom and Pan handlers
 */
function applyZoom() {
  const scaledW = originalWidth * zoomRatio;
  const scaledH = originalHeight * zoomRatio;

  canvas.setDimensions({
    width: scaledW,
    height: scaledH
  });
  canvas.setZoom(zoomRatio);

  // Sync outer container size to avoid flex stretching or clipping layout bugs
  const outerContainer = document.querySelector('.canvas-container-outer');
  if (outerContainer) {
    outerContainer.style.width = `${scaledW}px`;
    outerContainer.style.height = `${scaledH}px`;
  }

  document.getElementById('zoom-label').innerText = `${Math.round(zoomRatio * 100)}%`;
}

function fitCanvasToWorkspace() {
  const padding = window.innerWidth <= 768 ? 24 : 80;
  
  if (window.innerWidth <= 768) {
    // Width-based zoom ratio using viewport physical width
    // Subtract safe side paddings (24px total)
    const screenW = window.innerWidth - padding;
    const zoomX = screenW / originalWidth;
    
    // Height-based zoom ratio (limit viewport height based on window.innerHeight)
    // Subtract header height (56px) and safe vertical padding (32px)
    const maxVisibleH = window.innerHeight - 56 - 32;
    const zoomY = maxVisibleH / originalHeight;
    
    // Fit canvas cleanly within both width and height boundaries
    zoomRatio = Math.min(zoomX, zoomY, 1.1);
  } else {
    const workW = workspaceEl.clientWidth - padding;
    const workH = workspaceEl.clientHeight - padding;
    const zoomX = workW / originalWidth;
    const zoomY = workH / originalHeight;
    zoomRatio = Math.min(zoomX, zoomY, 1.1); // Max zoom fit is 110%
  }
  applyZoom();
}

/**
 * Load Template list and UI grid
 */
async function loadTemplatesGrid() {
  templatesGrid.innerHTML = '';
  const list = await db.templates.orderBy('created_at').reverse().toArray();
  
  list.forEach(t => {
    const card = document.createElement('div');
    card.className = `asset-card ${activeTemplate && activeTemplate.id === t.id ? 'active' : ''}`;
    
    // Thumbnail image
    const img = document.createElement('img');
    img.src = t.data_url;
    card.appendChild(img);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'asset-actions';

    // Delete Button (Except default standard template)
    if (t.id !== DEFAULT_TEMPLATE_ID) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete-asset';
      delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
      delBtn.title = 'テンプレートを削除';
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm('この背景テンプレートを削除しますか？')) {
          await db.templates.delete(t.id);
          await db.configs.delete(t.id);
          showToast('テンプレートを削除しました', 'danger');
          if (activeTemplate && activeTemplate.id === t.id) {
            await selectTemplate(DEFAULT_TEMPLATE_ID);
          } else {
            loadTemplatesGrid();
          }
        }
      };
      actions.appendChild(delBtn);
    }
    card.appendChild(actions);

    // Click to Select
    card.onclick = () => selectTemplate(t.id);

    templatesGrid.appendChild(card);
  });
}

/**
 * Select Template and load its custom configurations
 */
async function selectTemplate(id) {
  const t = await db.templates.get(id);
  if (!t) return;

  activeTemplate = t;
  
  // Read image dimensions
  const img = new Image();
  img.onload = async () => {
    originalWidth = img.width;
    originalHeight = img.height;

    // Load template bounding boxes configuration
    let config = await db.configs.get(id);
    if (!config) {
      // Auto scale default bounds based on template dimensions
      activeCoords = getScaledCoords(originalWidth, originalHeight);
      // Save scaled coordinates as current template config
      await db.configs.put({
        template_id: id,
        title: activeCoords.title,
        sections: activeCoords.sections
      });
    } else {
      activeCoords = {
        title: config.title,
        sections: config.sections
      };
    }

    // Set background and zoom
    fitCanvasToWorkspace();
    renderCanvasBackground();
    loadTemplatesGrid();
    showToast(`背景を「${t.name}」に変更しました`);
  };
  img.src = t.data_url;
}

/**
 * Load Overlay stamps grid
 */
async function loadOverlaysGrid() {
  overlaysGrid.innerHTML = '';
  const list = await db.overlays.orderBy('created_at').reverse().toArray();

  list.forEach(o => {
    const card = document.createElement('div');
    card.className = 'asset-card overlay-card';

    const img = document.createElement('img');
    img.src = o.data_url;
    card.appendChild(img);

    const actions = document.createElement('div');
    actions.className = 'asset-actions';

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-asset';
    delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm('この透過スタンプを削除しますか？')) {
        await db.overlays.delete(o.id);
        showToast('スタンプを削除しました', 'danger');
        loadOverlaysGrid();
      }
    };
    actions.appendChild(delBtn);
    card.appendChild(actions);

    // Click to add to Fabric Canvas
    card.onclick = () => addOverlayToCanvas(o.data_url);

    overlaysGrid.appendChild(card);
  });
}

/**
 * Add Stamp Overlay Image to Canvas
 */
function addOverlayToCanvas(dataUrl) {
  fabric.Image.fromURL(dataUrl, (img) => {
    const scale = (originalWidth * 0.12) / img.width; // Fits nicely (12% of template width)
    img.set({
      left: originalWidth / 2,
      top: originalHeight / 2,
      scaleX: scale,
      scaleY: scale,
      originX: 'center',
      originY: 'center',
      cornerColor: '#6366F1',
      cornerSize: 12,
      transparentCorners: false,
      borderColor: '#6366F1'
    });
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.renderAll();
    showToast('スタンプを追加しました');
  });
}



/**
 * High-Resolution PNG Export (dual-canvas conversion)
 */
function downloadGraphic() {
  showToast('画像を出力中...', 'warning');

  try {
    // Grab the hidden base canvas containing template and text drawn at high-res
    const hiddenCanvas = document.getElementById('hidden-base-canvas');
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = originalWidth;
    exportCanvas.height = originalHeight;
    const ctx = exportCanvas.getContext('2d');

    // Draw background image and text layer first
    ctx.drawImage(hiddenCanvas, 0, 0);

    // Parse Fabric overlays and overlay them onto high-res export context
    const overlays = canvas.getObjects();
    
    overlays.forEach(overlay => {
      if (!overlay._element) return;

      ctx.save();
      
      const center = overlay.getCenterPoint();
      ctx.translate(center.x, center.y);
      ctx.rotate((overlay.angle || 0) * Math.PI / 180);

      const flipX = overlay.flipX ? -1 : 1;
      const flipY = overlay.flipY ? -1 : 1;
      ctx.scale(flipX, flipY);

      const w = overlay.width * overlay.scaleX * flipX;
      const h = overlay.height * overlay.scaleY * flipY;

      ctx.globalAlpha = overlay.opacity ?? 1;
      ctx.drawImage(overlay._element, -Math.abs(w) / 2, -Math.abs(h) / 2, Math.abs(w), Math.abs(h));
      
      ctx.restore();
    });

    const dataUrl = exportCanvas.toDataURL('image/png');

    // Generate clean filename based on <title> tag text
    const parsedText = parseXMLText(xmlInput.value);
    let cleanTitle = (parsedText.title || '')
      .replace(/<[^>]*>/g, '')         // Remove HTML/XML tags like <red> or <emp>
      .replace(/[\r\n]+/g, ' ')        // Remove newlines
      .replace(/[\\/:*?"<>|]/g, '')    // Remove invalid filename characters
      .replace(/\s+/g, '_')            // Replace spaces with underscores
      .trim();
    const filename = cleanTitle ? `${cleanTitle}.png` : `infographic_${Date.now()}.png`;

    if (window.innerWidth <= 768) {
      // Mobile/Tablet download popup modal (requires long press to save)
      const modal = document.getElementById('mobile-download-modal');
      const modalImg = document.getElementById('mobile-download-img');
      modalImg.src = dataUrl;
      modal.style.display = 'flex';
      showToast('画像を生成しました。長押しして保存してください。', 'warning');

      // Attempt direct download parallelly (some mobile browsers support it)
      try {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (directDlErr) {
        console.warn('Direct download attempt failed on mobile:', directDlErr);
      }
    } else {
      // Desktop download logic via dynamic link click
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('図解画像のダウンロードが完了しました！');
    }
  } catch (err) {
    console.error('Download graphic processing failed:', err);
    alert('画像の保存に失敗しました:\n' + err.message);
    showToast('エラーが発生しました: ' + err.message, 'danger');
  }
}

/**
 * Templates Tab Switching and Sidebar Navigation
 */
function initTabNavigation() {
  const tabTemplates = document.getElementById('tab-templates');
  const tabSectionImages = document.getElementById('tab-section-images');
  const tabOverlays = document.getElementById('tab-overlays');
  
  const paneTemplates = document.getElementById('pane-templates');
  const paneSectionImages = document.getElementById('pane-section-images');
  const paneOverlays = document.getElementById('pane-overlays');

  const deactivateAll = () => {
    [tabTemplates, tabSectionImages, tabOverlays].forEach(t => t.classList.remove('active'));
    [paneTemplates, paneSectionImages, paneOverlays].forEach(p => p.classList.remove('active'));
  };

  tabTemplates.onclick = () => {
    deactivateAll();
    tabTemplates.classList.add('active');
    paneTemplates.classList.add('active');
  };

  tabSectionImages.onclick = () => {
    deactivateAll();
    tabSectionImages.classList.add('active');
    paneSectionImages.classList.add('active');
  };

  tabOverlays.onclick = () => {
    deactivateAll();
    tabOverlays.classList.add('active');
    paneOverlays.classList.add('active');
  };
}

/**
 * Handle Theme Light/Dark styling preferences
 */
function initThemePreference() {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    btnToggleTheme.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    document.body.classList.remove('light-theme');
    btnToggleTheme.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }

  btnToggleTheme.onclick = () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    btnToggleTheme.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    showToast(`${isLight ? 'ライト' : 'ダーク'}モードに切り替えました`);
  };
}

/**
 * Drag and Drop & Upload Files Listeners
 */
function initFileUploads() {
  // 1. Template Backgrounds Upload
  const handleTemplateFile = (file) => {
    if (!file) return;
    if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
      showToast('背景にはJPGまたはPNG画像をアップロードしてください。', 'danger');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = async () => {
        const id = crypto.randomUUID();
        await db.templates.add({
          id: id,
          name: file.name.split('.')[0],
          data_url: dataUrl,
          created_at: Date.now()
        });
        showToast('新しい背景テンプレートを保存しました！');
        selectTemplate(id);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  inputUploadTemplate.onchange = (e) => handleTemplateFile(e.target.files[0]);

  setupDragAndDrop(uploadTemplateZone, handleTemplateFile);

  // 2. Translucent overlays Upload
  const handleOverlayFile = (file) => {
    if (!file) return;
    if (!file.type.match('image/png')) {
      showToast('透過スタンプにはPNG画像をアップロードしてください。', 'danger');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      await db.overlays.add({
        id: crypto.randomUUID(),
        name: file.name.split('.')[0],
        data_url: e.target.result,
        created_at: Date.now()
      });
      showToast('透過スタンプを追加保存しました！');
      loadOverlaysGrid();
    };
    reader.readAsDataURL(file);
  };

  inputUploadOverlay.onchange = (e) => handleOverlayFile(e.target.files[0]);

  setupDragAndDrop(uploadOverlayZone, handleOverlayFile);

  // 3. Bulk Section Images Upload (1-30)
  const inputUploadBulk = document.getElementById('input-upload-bulk');
  if (inputUploadBulk) {
    inputUploadBulk.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      showToast(`${files.length}枚の画像を一括処理中...`, 'warning');
      
      let processedCount = 0;
      
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          showToast(`画像以外のファイル（${file.name}）をスキップしました。`, 'danger');
          continue;
        }
        
        // Parse slot number from filename
        const numMatch = file.name.match(/(\d+)/);
        let targetSlot = null;
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          if (num >= 1 && num <= 30) {
            targetSlot = num;
          }
        }
        
        // If no slot matched, find first empty slot
        if (targetSlot === null) {
          for (let s = 1; s <= 30; s++) {
            if (!window.sectionImages[s]) {
              targetSlot = s;
              break;
            }
          }
        }
        
        if (targetSlot === null) {
          targetSlot = 1;
        }

        // Read and load image
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              window.sectionImages[targetSlot] = img;
              window.sectionImageNames[targetSlot] = file.name;
              processedCount++;
              resolve();
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      if (processedCount > 0) {
        populateSectionImagesGrid();
        triggerRenderDebounced();
        showToast(`${processedCount}枚の画像をスロットに配置しました！`);
      }
      
      // Clear input
      inputUploadBulk.value = '';
    };
  }
}

function setupDragAndDrop(zone, fileHandler) {
  ['dragenter', 'dragover'].forEach(eventName => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      zone.style.borderColor = 'var(--accent-color)';
      zone.style.background = 'var(--accent-light)';
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      zone.style.borderColor = 'var(--border-color)';
      zone.style.background = 'transparent';
    }, false);
  });

  zone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    fileHandler(files[0]);
  }, false);
}

/**
 * Text Editor Shortcuts (insert XML tags)
 */
function initXmlEditorShortcuts() {
  // Tag insert listeners
  document.querySelectorAll('.xml-shortcuts .shortcut-btn[data-tag]').forEach(btn => {
    btn.onclick = () => {
      const tag = btn.getAttribute('data-tag');
      const startTag = tag === 'section' ? '<section1>\n  <row1>' : `<${tag}>`;
      const endTag = tag === 'section' ? '</row1>\n</section1>' : `</${tag}>`;
      
      const start = xmlInput.selectionStart;
      const end = xmlInput.selectionEnd;
      const text = xmlInput.value;
      
      xmlInput.value = text.substring(0, start) + startTag + text.substring(start, end) + endTag + text.substring(end);
      
      // Put cursor back inside tags
      xmlInput.focus();
      const newCursorPos = start + startTag.length;
      xmlInput.setSelectionRange(newCursorPos, newCursorPos + (end - start));
      
      triggerRenderDebounced();
    };
  });

  // Clear Editor
  btnClearText.onclick = () => {
    if (confirm('エディタのテキストを全て消去しますか？')) {
      xmlInput.value = '';
      triggerRenderDebounced();
      showToast('エディタをクリアしました', 'warning');
    }
  };

  // Reset text template to default
  btnResetText.onclick = () => {
    if (confirm('テキストをデフォルトのサンプル文面に戻しますか？')) {
      xmlInput.value = DEFAULT_XML_TEXT;
      triggerRenderDebounced();
      showToast('テキストをリセットしました');
    }
  };
}

/**
 * Initialize Web Fonts and wait for Noto Sans JP
 */
function initWebFonts(callback) {
  // Append google fonts if not loaded
  if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap';
    document.head.appendChild(link);
  }

  // Monitor Font loading
  document.fonts.ready.then(() => {
    callback();
  }).catch(() => {
    // Fallback if network blocked
    callback();
  });
}

/**
 * Wire UI Controls Listeners
 */
function bindUIControls() {
  // Zooming
  btnZoomIn.onclick = () => {
    zoomRatio = Math.min(zoomRatio + 0.1, 3.0);
    applyZoom();
  };
  btnZoomOut.onclick = () => {
    zoomRatio = Math.max(zoomRatio - 0.1, 0.2);
    applyZoom();
  };
  btnZoomFit.onclick = fitCanvasToWorkspace;



  // Clear overlay icons
  btnClearCanvas.onclick = () => {
    if (confirm('キャンバス上に配置したすべての透過スタンプを削除しますか？')) {
      const stamps = canvas.getObjects().filter(o => 
        o.name !== 'title' && !o.name?.startsWith('section')
      );
      stamps.forEach(s => canvas.remove(s));
      canvas.discardActiveObject();
      canvas.renderAll();
      showToast('透過スタンプを全削除しました', 'danger');
    }
  };

  // Export Graphic
  btnDownload.onclick = downloadGraphic;

  // Mobile download modal close
  const btnCloseDownloadModal = document.getElementById('btn-close-download-modal');
  if (btnCloseDownloadModal) {
    btnCloseDownloadModal.onclick = () => {
      document.getElementById('mobile-download-modal').style.display = 'none';
    };
  }

  // Debounced input listeners on editor textarea
  xmlInput.oninput = triggerRenderDebounced;

  // Window Resize
  window.onresize = fitCanvasToWorkspace;

  // Mobile Drawer toggles (for tablet size 769px - 1024px)
  const btnToggleEditor = document.getElementById('btn-toggle-editor');
  const btnToggleAssets = document.getElementById('btn-toggle-assets');
  const leftSidebar = document.querySelector('.editor-sidebar');
  const rightSidebar = document.querySelector('.assets-sidebar');

  if (btnToggleEditor) {
    btnToggleEditor.onclick = (e) => {
      e.stopPropagation();
      leftSidebar.classList.toggle('sidebar-open');
      rightSidebar.classList.remove('sidebar-open');
    };
  }

  if (btnToggleAssets) {
    btnToggleAssets.onclick = (e) => {
      e.stopPropagation();
      rightSidebar.classList.toggle('sidebar-open');
      leftSidebar.classList.remove('sidebar-open');
    };
  }

  // Close drawers when clicking on the workspace (on tablet drawer views)
  workspaceEl.addEventListener('click', () => {
    if (window.innerWidth > 768 && window.innerWidth <= 1024) {
      leftSidebar.classList.remove('sidebar-open');
      rightSidebar.classList.remove('sidebar-open');
    }
  });
}

/**
 * Mobile Navigation controller for split screen views (under 768px)
 */
function initMobileNavigation() {
  const mbtnText = document.getElementById('mbtn-text');
  const mbtnTemplates = document.getElementById('mbtn-templates');
  const mbtnSectionImages = document.getElementById('mbtn-section-images');
  const mbtnOverlays = document.getElementById('mbtn-overlays');

  const leftSidebar = document.querySelector('.editor-sidebar');
  const rightSidebar = document.querySelector('.assets-sidebar');

  const tabTemplates = document.getElementById('tab-templates');
  const tabSectionImages = document.getElementById('tab-section-images');
  const tabOverlays = document.getElementById('tab-overlays');

  function clearMobileActive() {
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
    leftSidebar.classList.remove('active-mobile');
    rightSidebar.classList.remove('active-mobile');
  }

  mbtnText.onclick = (e) => {
    e.stopPropagation();
    clearMobileActive();
    mbtnText.classList.add('active');
    leftSidebar.classList.add('active-mobile');
  };

  mbtnTemplates.onclick = (e) => {
    e.stopPropagation();
    clearMobileActive();
    mbtnTemplates.classList.add('active');
    rightSidebar.classList.add('active-mobile');
    
    // Programmatically trigger templates tab inside assets pane
    tabTemplates.click();
  };

  if (mbtnSectionImages) {
    mbtnSectionImages.onclick = (e) => {
      e.stopPropagation();
      clearMobileActive();
      mbtnSectionImages.classList.add('active');
      rightSidebar.classList.add('active-mobile');
      
      // Programmatically trigger section images tab
      tabSectionImages.click();
    };
  }

  mbtnOverlays.onclick = (e) => {
    e.stopPropagation();
    clearMobileActive();
    mbtnOverlays.classList.add('active');
    rightSidebar.classList.add('active-mobile');
    
    // Programmatically trigger overlays tab inside assets pane
    tabOverlays.click();
  };

  // Set default active view on mobile on load (safely triggered after all click handlers are bound)
  if (window.innerWidth <= 768) {
    mbtnText.click();
  }
}

/**
 * Initialize Collapsible accordion sections for mobile view (under 768px)
 */
function initCollapsibleSections() {
  const leftSidebar = document.querySelector('.editor-sidebar');
  const paneTemplates = document.getElementById('pane-templates');
  const paneSectionImages = document.getElementById('pane-section-images');
  const paneOverlays = document.getElementById('pane-overlays');

  const toggleSection = (element) => {
    if (window.innerWidth <= 768) {
      element.classList.toggle('collapsed');
      // Re-fit canvas dynamically based on viewport height updates after collapse toggle
      fitCanvasToWorkspace();
    }
  };

  // Bind click events to headers
  const leftHeader = leftSidebar.querySelector('.editor-section-header');
  if (leftHeader) {
    leftHeader.onclick = () => toggleSection(leftSidebar);
  }

  const templatesHeader = paneTemplates.querySelector('.editor-section-header');
  if (templatesHeader) {
    templatesHeader.onclick = () => toggleSection(paneTemplates);
  }

  const sectionImagesHeader = paneSectionImages.querySelector('.editor-section-header');
  if (sectionImagesHeader) {
    sectionImagesHeader.onclick = () => toggleSection(paneSectionImages);
  }

  const overlaysHeader = paneOverlays.querySelector('.editor-section-header');
  if (overlaysHeader) {
    overlaysHeader.onclick = () => toggleSection(paneOverlays);
  }

  // Setup initial load collapsed states for mobile
  if (window.innerWidth <= 768) {
    leftSidebar.classList.add('collapsed');
    paneTemplates.classList.add('collapsed');
    paneSectionImages.classList.add('collapsed');
    paneOverlays.classList.add('collapsed');
  }
}

/**
 * Saves title image to Dexie DB under key 'saved_title_image'
 */
async function saveTitleImageToDB(dataUrl, name) {
  try {
    await db.configs.put({
      template_id: 'saved_title_image',
      data_url: dataUrl,
      name: name
    });
  } catch (e) {
    console.error('Failed to save title image to DB:', e);
  }
}

/**
 * Deletes title image from Dexie DB
 */
async function deleteTitleImageFromDB() {
  try {
    await db.configs.delete('saved_title_image');
  } catch (e) {
    console.error('Failed to delete title image from DB:', e);
  }
}

/**
 * Loads title image from Dexie DB on startup
 */
async function loadSavedTitleImage() {
  try {
    const saved = await db.configs.get('saved_title_image');
    if (saved && saved.data_url) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          window.titleImage = img;
          window.titleImageName = saved.name || 'title_image.png';
          resolve();
        };
        img.onerror = () => resolve();
        img.src = saved.data_url;
      });
    }
  } catch (e) {
    console.error('Failed to load saved title image:', e);
  }
}

/**
 * Opens stamp picker modal to select an overlay
 */
async function openStampPicker(onSelect) {
  const modal = document.getElementById('stamp-picker-modal');
  const grid = document.getElementById('modal-stamps-grid');
  const closeBtn = document.getElementById('btn-close-stamp-modal');
  
  if (!modal || !grid) return;
  
  grid.innerHTML = '';
  
  const list = await db.overlays.orderBy('created_at').reverse().toArray();
  
  if (list.length === 0) {
    grid.innerHTML = '<div style="grid-column: span 4; text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;">登録されているスタンプがありません。「装飾PNG」タブからスタンプをアップロードしてください。</div>';
  } else {
    list.forEach(o => {
      const item = document.createElement('div');
      item.className = 'asset-card';
      item.style.cursor = 'pointer';
      item.style.padding = '8px';
      
      const img = document.createElement('img');
      img.src = o.data_url;
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.objectFit = 'contain';
      item.appendChild(img);
      
      const label = document.createElement('span');
      label.innerText = o.name;
      label.style.fontSize = '10px';
      label.style.display = 'block';
      label.style.textAlign = 'center';
      label.style.marginTop = '4px';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.whiteSpace = 'nowrap';
      item.appendChild(label);
      
      item.onclick = () => {
        const imageElement = new Image();
        imageElement.onload = () => {
          onSelect(imageElement, o.name);
          modal.style.display = 'none';
        };
        imageElement.src = o.data_url;
      };
      
      grid.appendChild(item);
    });
  }
  
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };
  
  modal.style.display = 'flex';
}

/**
 * Synchronize Title & Section images with Fabric Canvas overlays
 */
function syncFabricImages() {
  if (!canvas) return;

  // 1. Sync Title Image
  const titleObj = canvas.getObjects().find(o => o.name === 'title');
  if (window.titleImage) {
    if (!titleObj) {
      const fabricImg = new fabric.Image(window.titleImage, {
        name: 'title',
        left: 1060,
        top: 115,
        originX: 'center',
        originY: 'center',
        lockMovementX: true,
        lockMovementY: true,
        centeredScaling: true,
        lockUniScaling: true,
        uniformScaling: true,
        hasRotatingPoint: false,
        cornerColor: '#6366F1',
        cornerSize: 12,
        transparentCorners: false
      });
      fabricImg.setControlsVisibility({
        mt: false, mb: false, ml: false, mr: false, mtr: false
      });
      // Scale initially so height is 160px
      const scale = 160 / (window.titleImage.naturalHeight || window.titleImage.height);
      fabricImg.set({
        scaleX: scale,
        scaleY: scale
      });
      canvas.add(fabricImg);
    } else {
      if (titleObj._element !== window.titleImage) {
        titleObj.setElement(window.titleImage);
        titleObj.set({
          width: window.titleImage.naturalWidth || window.titleImage.width,
          height: window.titleImage.naturalHeight || window.titleImage.height
        });
        const scale = 160 / (window.titleImage.naturalHeight || window.titleImage.height);
        titleObj.set({
          scaleX: scale,
          scaleY: scale
        });
      }
      titleObj.set({ left: 1060, top: 115 });
    }
  } else if (titleObj) {
    canvas.remove(titleObj);
  }

  // 2. Sync Section Images
  for (let i = 1; i <= 30; i++) {
    const secObj = canvas.getObjects().find(o => o.name === 'section' + i);
    if (window.sectionImages[i]) {
      const idx = i - 1;
      let targetLeft = 0;
      let targetTop = 0;

      if (activeTemplate && activeTemplate.id === TEMPLATE_15_2_ID) {
        const col = idx < 15 ? 0 : 1;
        const row = idx < 15 ? idx : idx - 15;
        const cardX = 60 + col * 560;
        const cardY = 230 + row * 86;
        const cardW = 520;
        const cardH = 80;
        const imgW = 64;
        const imgH = 64;
        targetLeft = cardX + cardW - imgW - 10 + imgW / 2;
        targetTop = cardY + (cardH - imgH) / 2 + imgH / 2;
      } else if (activeTemplate && activeTemplate.id === TEMPLATE_5_6_ID) {
        const row = Math.floor(idx / 6);
        const col = idx % 6;
        const cardX = 68 + col * 180;
        const cardY = 230 + row * 252;
        const cardW = 164;
        const cardH = 236;
        const imgW = 70;
        const imgH = 70;
        targetLeft = cardX + (cardW - imgW) / 2 + imgW / 2;
        targetTop = cardY + cardH - imgH - 12 + imgH / 2;
      }

      if (!secObj) {
        const fabricImg = new fabric.Image(window.sectionImages[i], {
          name: 'section' + i,
          left: targetLeft,
          top: targetTop,
          originX: 'center',
          originY: 'center',
          lockMovementX: true,
          lockMovementY: true,
          centeredScaling: true,
          lockUniScaling: true,
          uniformScaling: true,
          hasRotatingPoint: false,
          cornerColor: '#6366F1',
          cornerSize: 12,
          transparentCorners: false
        });
        fabricImg.setControlsVisibility({
          mt: false, mb: false, ml: false, mr: false, mtr: false
        });
        
        const maxW = (activeTemplate && activeTemplate.id === TEMPLATE_15_2_ID) ? 64 : 70;
        const maxH = (activeTemplate && activeTemplate.id === TEMPLATE_15_2_ID) ? 64 : 70;
        const scale = Math.min(maxW / (window.sectionImages[i].naturalWidth || window.sectionImages[i].width), maxH / (window.sectionImages[i].naturalHeight || window.sectionImages[i].height));
        fabricImg.set({
          scaleX: scale,
          scaleY: scale
        });
        canvas.add(fabricImg);
      } else {
        if (secObj._element !== window.sectionImages[i]) {
          secObj.setElement(window.sectionImages[i]);
          secObj.set({
            width: window.sectionImages[i].naturalWidth || window.sectionImages[i].width,
            height: window.sectionImages[i].naturalHeight || window.sectionImages[i].height
          });
          const maxW = (activeTemplate && activeTemplate.id === TEMPLATE_15_2_ID) ? 64 : 70;
          const maxH = (activeTemplate && activeTemplate.id === TEMPLATE_15_2_ID) ? 64 : 70;
          const scale = Math.min(maxW / (window.sectionImages[i].naturalWidth || window.sectionImages[i].width), maxH / (window.sectionImages[i].naturalHeight || window.sectionImages[i].height));
          secObj.set({
            scaleX: scale,
            scaleY: scale
          });
        }
        secObj.set({ left: targetLeft, top: targetTop });
      }
    } else if (secObj) {
      canvas.remove(secObj);
    }
  }

  canvas.renderAll();
}

/**
 * Programmatically populate the 1-30 section image upload rows and title image slot
 */
function populateSectionImagesGrid() {
  const container = document.getElementById('section-images-grid');
  if (!container) return;
  container.innerHTML = '';

  // --- Title Image Slot ---
  const titleSlot = document.createElement('div');
  titleSlot.className = 'section-image-slot title-image-slot';
  titleSlot.style.border = '2px dashed var(--accent-color)';
  titleSlot.style.borderRadius = '8px';
  titleSlot.style.padding = '8px';
  titleSlot.style.marginBottom = '12px';
  titleSlot.style.background = 'rgba(99, 102, 241, 0.05)';

  const titleBadge = document.createElement('div');
  titleBadge.className = 'slot-badge';
  titleBadge.style.background = 'var(--accent-color)';
  titleBadge.innerText = 'T';
  titleBadge.title = 'タイトル画像';
  titleSlot.appendChild(titleBadge);

  const titlePreviewZone = document.createElement('div');
  titlePreviewZone.className = 'slot-preview-container';
  
  const hasTitleImage = !!window.titleImage;
  
  if (hasTitleImage) {
    const thumb = document.createElement('img');
    thumb.src = window.titleImage.src;
    titlePreviewZone.appendChild(thumb);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'slot-filename';
    nameSpan.innerText = window.titleImageName || 'title_image.png';
    nameSpan.title = window.titleImageName || 'title_image.png';
    titlePreviewZone.appendChild(nameSpan);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'slot-delete-btn';
    deleteBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    deleteBtn.title = '画像を削除';
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      window.titleImage = null;
      window.titleImageName = '';
      await deleteTitleImageFromDB();
      populateSectionImagesGrid();
      syncFabricImages();
      triggerRenderDebounced();
      showToast('タイトル画像を削除しました', 'warning');
    };
    titlePreviewZone.appendChild(deleteBtn);
  } else {
    const placeholderSpan = document.createElement('span');
    placeholderSpan.innerText = 'タイトル画像をアップロード';
    titlePreviewZone.appendChild(placeholderSpan);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    titlePreviewZone.appendChild(fileInput);

    titlePreviewZone.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          showToast('画像ファイルをアップロードしてください。', 'danger');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = async () => {
            window.titleImage = img;
            window.titleImageName = file.name;
            await saveTitleImageToDB(event.target.result, file.name);
            populateSectionImagesGrid();
            syncFabricImages();
            triggerRenderDebounced();
            showToast('タイトル画像を登録しました');
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
  }
  titleSlot.appendChild(titlePreviewZone);

  // Title Setting Button
  const titleActionsContainer = document.createElement('div');
  titleActionsContainer.className = 'slot-actions';
  
  const titleSetBtn = document.createElement('button');
  titleSetBtn.className = 'slot-move-btn';
  titleSetBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
  titleSetBtn.title = 'スタンプから選択';
  titleSetBtn.onclick = (e) => {
    e.stopPropagation();
    openStampPicker((selectedImg, selectedName) => {
      window.titleImage = selectedImg;
      window.titleImageName = selectedName;
      saveTitleImageToDB(selectedImg.src, selectedName).then(() => {
        populateSectionImagesGrid();
        syncFabricImages();
        triggerRenderDebounced();
        showToast('タイトル画像を設定しました');
      });
    });
  };
  titleActionsContainer.appendChild(titleSetBtn);
  titleSlot.appendChild(titleActionsContainer);
  container.appendChild(titleSlot);

  // --- Section Slots 1-30 ---
  for (let i = 1; i <= 30; i++) {
    const slot = document.createElement('div');
    slot.className = 'section-image-slot';

    // 1. Badge (Number 1-30)
    const badge = document.createElement('div');
    badge.className = 'slot-badge';
    badge.innerText = i;
    slot.appendChild(badge);

    // 2. Preview & Upload Click Zone
    const previewZone = document.createElement('div');
    previewZone.className = 'slot-preview-container';
    
    const hasImage = !!window.sectionImages[i];
    
    if (hasImage) {
      const img = window.sectionImages[i];
      const filename = window.sectionImageNames[i] || `image_${i}.png`;

      const thumb = document.createElement('img');
      thumb.src = img.src;
      previewZone.appendChild(thumb);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'slot-filename';
      nameSpan.innerText = filename;
      nameSpan.title = filename; // Tooltip with full name
      previewZone.appendChild(nameSpan);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'slot-delete-btn';
      deleteBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      deleteBtn.title = '画像を削除';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        delete window.sectionImages[i];
        delete window.sectionImageNames[i];
        populateSectionImagesGrid();
        syncFabricImages();
        triggerRenderDebounced();
        showToast(`画像 ${i} を削除しました`, 'warning');
      };
      previewZone.appendChild(deleteBtn);
    } else {
      const placeholderSpan = document.createElement('span');
      placeholderSpan.innerText = '画像をアップロード';
      previewZone.appendChild(placeholderSpan);

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      previewZone.appendChild(fileInput);

      previewZone.onclick = () => fileInput.click();

      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          if (!file.type.startsWith('image/')) {
            showToast('画像ファイルをアップロードしてください。', 'danger');
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              window.sectionImages[i] = img;
              window.sectionImageNames[i] = file.name;
              populateSectionImagesGrid();
              syncFabricImages();
              triggerRenderDebounced();
              showToast(`画像 ${i} を登録しました`);
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      };
    }
    
    slot.appendChild(previewZone);

    // 3. Move Actions (Up/Down/Number Shift/Stamp Set)
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'slot-actions';

    const upBtn = document.createElement('button');
    upBtn.className = 'slot-move-btn';
    upBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
    upBtn.title = '上へ移動';
    upBtn.disabled = (i === 1);
    upBtn.onclick = (e) => {
      e.stopPropagation();
      moveSlot(i, i - 1);
    };
    actionsContainer.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.className = 'slot-move-btn';
    downBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    downBtn.title = '下へ移動';
    downBtn.disabled = (i === 30);
    downBtn.onclick = (e) => {
      e.stopPropagation();
      moveSlot(i, i + 1);
    };
    actionsContainer.appendChild(downBtn);

    const numBtn = document.createElement('button');
    numBtn.className = 'slot-move-btn';
    numBtn.innerHTML = '<i class="fa-solid fa-hashtag"></i>';
    numBtn.title = '指定位置へ移動';
    numBtn.onclick = (e) => {
      e.stopPropagation();
      const targetStr = prompt(`スロット ${i} の画像を移動する先のスロット番号（1〜30）を入力してください:`, i);
      if (targetStr !== null) {
        const targetNum = parseInt(targetStr, 10);
        if (isNaN(targetNum) || targetNum < 1 || targetNum > 30) {
          showToast('1から30の間の数値を入力してください。', 'danger');
          return;
        }
        moveSlot(i, targetNum);
      }
    };
    actionsContainer.appendChild(numBtn);

    const setBtn = document.createElement('button');
    setBtn.className = 'slot-move-btn';
    setBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
    setBtn.title = 'スタンプから選択';
    setBtn.onclick = (e) => {
      e.stopPropagation();
      openStampPicker((selectedImg, selectedName) => {
        window.sectionImages[i] = selectedImg;
        window.sectionImageNames[i] = selectedName;
        populateSectionImagesGrid();
        syncFabricImages();
        triggerRenderDebounced();
        showToast(`画像 ${i} にスタンプを設定しました`);
      });
    };
    actionsContainer.appendChild(setBtn);

    slot.appendChild(actionsContainer);
    container.appendChild(slot);
  }
}

/**
 * Moves an image from one slot to another, shifting all elements in between.
 */
function moveSlot(fromIdx, toIdx) {
  if (fromIdx === toIdx) return;
  
  const imgToMove = window.sectionImages[fromIdx];
  const nameToMove = window.sectionImageNames[fromIdx];

  // If both are empty, do nothing
  if (!imgToMove && !window.sectionImages[toIdx]) {
    return;
  }

  if (fromIdx < toIdx) {
    // Shift left: items from fromIdx + 1 to toIdx shift up
    for (let k = fromIdx; k < toIdx; k++) {
      window.sectionImages[k] = window.sectionImages[k + 1];
      window.sectionImageNames[k] = window.sectionImageNames[k + 1];
    }
  } else {
    // Shift right: items from toIdx to fromIdx - 1 shift down
    for (let k = fromIdx; k > toIdx; k--) {
      window.sectionImages[k] = window.sectionImages[k - 1];
      window.sectionImageNames[k] = window.sectionImageNames[k - 1];
    }
  }

  window.sectionImages[toIdx] = imgToMove;
  window.sectionImageNames[toIdx] = nameToMove;

  populateSectionImagesGrid();
  triggerRenderDebounced();
  showToast(`画像をスロット ${fromIdx} から ${toIdx} へ移動しました`);
}

/**
 * Main Application Bootstrap
 */
window.onload = async () => {
  try {
    // 1. Setup IndexedDB default values
    await initializeDefaultAssets();

    // 2. Prepare Web Fonts
    initWebFonts(() => {
      // 3. Initialize Fabric.js
      initFabricCanvas();

      // 4. Bind listeners
      bindUIControls();
      initTabNavigation();
      initThemePreference();
      initFileUploads();
      initXmlEditorShortcuts();
      initMobileNavigation();
      initCollapsibleSections();
      loadSavedTitleImage().then(() => {
        populateSectionImagesGrid();
      });

      // 5. Load default starter data
      xmlInput.value = DEFAULT_XML_TEXT;

      // 6. Select initial default template
      selectTemplate(DEFAULT_TEMPLATE_ID).then(() => {
        // Load libraries grids in sidebars
        loadTemplatesGrid();
        loadOverlaysGrid();

        // 7. Hide loading overlay
        setTimeout(() => {
          loadingScreen.style.opacity = '0';
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 300);
        }, 400);
      });
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    loadingScreen.innerHTML = `<div class="loading-text" style="color: var(--danger-color);"><i class="fa-solid fa-triangle-exclamation"></i> 起動エラーが発生しました: ${err.message}</div>`;
  }
};

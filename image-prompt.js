// ========== Advanced AI Prompt Generator - Main Application ==========
(function() {
  'use strict';

  // ========== Utility Functions ==========
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const byId = id => document.getElementById(id);
  
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  
  // ========== State Management (In-Memory Only) ==========
  const appState = {
    currentMode: 'image',
    provider: 'openai',
    apiKey: '',
    image: {
      blob: null,
      url: '',
      width: 0,
      height: 0,
      aspectRatio: '',
      fileSize: 0
    },
    options: {
      image: {
        style: 'balanced',
        target: 'sd',
        detail: 'medium',
        includeNeg: true,
        includeParams: true,
        includeAlt: true,
        includeTags: true
      },
      text: {
        style: 'balanced',
        target: 'sd',
        complexity: 'moderate',
        includeNeg: true,
        includeParams: true,
        includeVariations: true
      }
    },
    processing: false
  };

  // ========== DOM Elements Cache ==========
  const els = {
    // Mode switching
    modeBtns: $('.pgen-mode-btn'),
    imageMode: byId('pgen-image-mode'),
    textMode: byId('pgen-text-mode'),
    
    // Config
    configToggle: byId('pgen-toggle-config'),
    configPanel: byId('pgen-config-panel'),
    provider: byId('pgen-provider'),
    apiKey: byId('pgen-apikey'),
    toggleKey: byId('pgen-toggle-key'),
    saveConfig: byId('pgen-save-config'),
    clearConfig: byId('pgen-clear-config'),
    
    // Image input
    tabs: $('.ibtn-tab'),
    uploadPane: byId('pgen-upload-pane'),
    urlPane: byId('pgen-url-pane'),
    clipboardPane: byId('pgen-clipboard-pane'),
    dropzone: byId('pgen-dropzone'),
    fileInput: byId('pgen-file'),
    urlInput: byId('pgen-url'),
    fetchUrl: byId('pgen-fetch-url'),
    pasteTrigger: byId('pgen-paste-trigger'),
    
    // Preview
    previewImg: byId('pgen-preview-img'),
    previewPlaceholder: byId('pgen-preview-placeholder'),
    status: byId('pgen-status'),
    dimensions: byId('pgen-dimensions'),
    aspect: byId('pgen-aspect'),
    filesize: byId('pgen-filesize'),
    
    // Image options
    imgStyle: byId('pgen-img-style'),
    imgTarget: byId('pgen-img-target'),
    imgDetail: byId('pgen-img-detail'),
    imgNeg: byId('pgen-img-neg'),
    imgParams: byId('pgen-img-params'),
    imgAlt: byId('pgen-img-alt'),
    imgTags: byId('pgen-img-tags'),
    imgGenerate: byId('pgen-img-generate'),
    
    // Text input & options
    textInput: byId('pgen-text-input'),
    textStyle: byId('pgen-text-style'),
    textTarget: byId('pgen-text-target'),
    textComplexity: byId('pgen-text-complexity'),
    textNeg: byId('pgen-text-neg'),
    textParams: byId('pgen-text-params'),
    textVariations: byId('pgen-text-variations'),
    textGenerate: byId('pgen-text-generate'),
    
    // Output
    outputSection: byId('pgen-output-section'),
    outputMain: byId('pgen-output-main'),
    outputNeg: byId('pgen-output-neg'),
    outputParams: byId('pgen-output-params'),
    outputAlt: byId('pgen-output-alt'),
    outputTags: byId('pgen-output-tags'),
    variationsCard: byId('pgen-variations-card'),
    var1: byId('pgen-var-1'),
    var2: byId('pgen-var-2'),
    var3: byId('pgen-var-3'),
    
    // Copy buttons
    copyMain: byId('pgen-copy-main'),
    copyNeg: byId('pgen-copy-neg'),
    copyParams: byId('pgen-copy-params'),
    copyAlt: byId('pgen-copy-alt'),
    copyTags: byId('pgen-copy-tags'),
    copyVarBtns: $('.pgen-copy-var'),
    downloadMain: byId('pgen-download-main'),
    downloadAll: byId('pgen-download-all')
  };

  // ========== Status Updates ==========
  function setStatus(text, type = 'ready') {
    els.status.textContent = text;
    els.status.className = 'pgen-meta-value pgen-status-' + type;
  }

  // ========== Mode Switching ==========
  function switchMode(mode) {
    appState.currentMode = mode;
    
    els.modeBtns.forEach(btn => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('pgen-mode-active', isActive);
    });
    
    els.imageMode.classList.toggle('pgen-hidden', mode !== 'image');
    els.textMode.classList.toggle('pgen-hidden', mode !== 'text');
    
    // Hide output when switching modes
    els.outputSection.classList.remove('pgen-visible');
  }

  // ========== Configuration ==========
  function toggleConfig() {
    const isCollapsed = els.configPanel.classList.toggle('pgen-collapsed');
    els.configToggle.querySelector('.pgen-toggle-text').textContent = 
      isCollapsed ? 'Show Settings' : 'Hide Settings';
  }

  function toggleKeyVisibility() {
    const isPassword = els.apiKey.type === 'password';
    els.apiKey.type = isPassword ? 'text' : 'password';
  }

  function saveConfig() {
    appState.provider = els.provider.value;
    appState.apiKey = els.apiKey.value.trim();
    setStatus('Configuration saved (session only)', 'success');
    setTimeout(() => setStatus('Ready', 'ready'), 2000);
  }

  function clearConfig() {
    if (confirm('Clear all saved data and reset to defaults?')) {
      appState.apiKey = '';
      els.apiKey.value = '';
      els.provider.value = 'openai';
      appState.provider = 'openai';
      setStatus('Configuration cleared', 'ready');
    }
  }

  // ========== Tab Switching ==========
  function switchTab(tabName) {
    const panes = {
      upload: els.uploadPane,
      url: els.urlPane,
      clipboard: els.clipboardPane
    };
    
    els.tabs.forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('pgen-tab-active', isActive);
    });
    
    Object.entries(panes).forEach(([name, pane]) => {
      pane.classList.toggle('pgen-tab-active', name === tabName);
    });
  }

  // ========== Image Processing ==========
  async function loadImageFromFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      alert('Image too large. Maximum size: 10MB');
      return;
    }
    
    const url = URL.createObjectURL(file);
    await processImage(file, url);
  }

  async function loadImageFromURL() {
    const url = els.urlInput.value.trim();
    if (!url) {
      alert('Please enter a valid image URL');
      return;
    }
    
    setStatus('Fetching image...', 'processing');
    
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        throw new Error('URL does not point to a valid image');
      }
      
      await processImage(blob, url);
    } catch (err) {
      setStatus('Failed to load URL', 'error');
      alert('Failed to load image from URL. Ensure it is publicly accessible and CORS-enabled.');
      console.error(err);
    }
  }

  async function processImage(blob, displayUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        appState.image.blob = blob;
        appState.image.url = displayUrl;
        appState.image.width = img.naturalWidth;
        appState.image.height = img.naturalHeight;
        appState.image.fileSize = blob.size;
        appState.image.aspectRatio = calculateAspectRatio(img.naturalWidth, img.naturalHeight);
        
        updatePreview(displayUrl, img.naturalWidth, img.naturalHeight, blob.size);
        setStatus('Image loaded successfully', 'success');
        resolve();
      };
      
      img.onerror = () => {
        setStatus('Failed to load image', 'error');
        reject(new Error('Image load failed'));
      };
      
      img.src = displayUrl;
    });
  }

  function calculateAspectRatio(w, h) {
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const divisor = gcd(w, h);
    return `${Math.round(w / divisor)}:${Math.round(h / divisor)}`;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function updatePreview(url, width, height, size) {
    els.previewImg.src = url;
    els.previewImg.classList.add('pgen-visible');
    els.previewPlaceholder.classList.add('pgen-hidden');
    
    els.dimensions.textContent = `${width} × ${height}px`;
    els.aspect.textContent = appState.image.aspectRatio;
    els.filesize.textContent = formatFileSize(size);
  }

  function clearPreview() {
    els.previewImg.classList.remove('pgen-visible');
    els.previewPlaceholder.classList.remove('pgen-hidden');
    els.dimensions.textContent = '—';
    els.aspect.textContent = '—';
    els.filesize.textContent = '—';
  }

  // ========== Drag & Drop ==========
  function setupDragDrop() {
    ['dragenter', 'dragover'].forEach(evt => {
      els.dropzone.addEventListener(evt, e => {
        e.preventDefault();
        els.dropzone.classList.add('pgen-dragover');
      });
    });
    
    ['dragleave', 'drop'].forEach(evt => {
      els.dropzone.addEventListener(evt, e => {
        e.preventDefault();
        els.dropzone.classList.remove('pgen-dragover');
      });
    });
    
    els.dropzone.addEventListener('drop', e => {
      const file = e.dataTransfer.files[0];
      if (file) loadImageFromFile(file);
    });
  }

  // ========== Clipboard Paste ==========
  function setupClipboardPaste() {
    els.pasteTrigger.addEventListener('click', () => {
      els.pasteTrigger.textContent = 'Paste now (Ctrl+V / Cmd+V)...';
      els.pasteTrigger.focus();
    });
    
    window.addEventListener('paste', async e => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      
      if (imageItem) {
        e.preventDefault();
        const file = imageItem.getAsFile();
        await loadImageFromFile(file);
        switchTab('upload');
      }
    });
  }

  // ========== AI Prompt Generation ==========
  async function generateImagePrompt() {
    if (!appState.image.blob) {
      alert('Please upload an image first');
      return;
    }
    
    if (appState.processing) return;
    
    appState.processing = true;
    setStatus('Analyzing image...', 'processing');
    els.imgGenerate.disabled = true;
    els.imgGenerate.innerHTML = '<svg class="pgen-loading" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Generating...';
    
    try {
      // Compress image for API
      const compressed = await compressImage(appState.image.blob, 1280, 0.85);
      const base64 = await blobToBase64(compressed);
      
      // Call AI provider
      let result;
      if (appState.provider === 'openai' && appState.apiKey) {
        result = await callOpenAIVision(base64);
      } else if (appState.provider === 'hf' && appState.apiKey) {
        result = await callHuggingFace(compressed);
      } else {
        result = await localAnalysis(compressed);
      }
      
      // Display results
      displayResults(result, 'image');
      setStatus('Prompt generated successfully', 'success');
      
    } catch (err) {
      setStatus('Generation failed', 'error');
      alert('Failed to generate prompt: ' + err.message);
      console.error(err);
    } finally {
      appState.processing = false;
      els.imgGenerate.disabled = false;
      els.imgGenerate.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Generate Prompt from Image';
    }
  }

  async function generateTextPrompt() {
    const input = els.textInput.value.trim();
    if (!input) {
      alert('Please enter a prompt or idea first');
      return;
    }
    
    if (appState.processing) return;
    
    appState.processing = true;
    setStatus('Enhancing prompt...', 'processing');
    els.textGenerate.disabled = true;
    els.textGenerate.innerHTML = '<svg class="pgen-loading" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Processing...';
    
    try {
      let result;
      if (appState.provider === 'openai' && appState.apiKey) {
        result = await callOpenAITextEnhancement(input);
      } else {
        result = await localTextEnhancement(input);
      }
      
      displayResults(result, 'text');
      setStatus('Prompt enhanced successfully', 'success');
      
    } catch (err) {
      setStatus('Enhancement failed', 'error');
      alert('Failed to enhance prompt: ' + err.message);
      console.error(err);
    } finally {
      appState.processing = false;
      els.textGenerate.disabled = false;
      els.textGenerate.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Enhance & Optimize Prompt';
    }
  }

  // ========== Image Compression ==========
  async function compressImage(blob, maxDim = 1280, quality = 0.85) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        
        if (Math.max(w, h) > maxDim) {
          if (w > h) {
            h = Math.round(h * maxDim / w);
            w = maxDim;
          } else {
            w = Math.round(w * maxDim / h);
            h = maxDim;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(blob);
    });
  }

  async function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }

  // ========== API Calls ==========
  async function callOpenAIVision(base64Image) {
    const opts = appState.options.image;
    
    const systemPrompt = `You are an elite AI prompt engineer specializing in reverse-engineering images into production-ready prompts for AI image generators. Analyze the image comprehensively and return ONLY valid JSON with these exact fields:

{
  "main_prompt": "complete optimized prompt for ${opts.target.toUpperCase()}",
  "negative_prompt": "comma-separated negative elements",
  "parameters": "model-specific parameters and settings",
  "alt_text": "SEO-optimized alt text description",
  "keywords": ["keyword1", "keyword2"...],
  "style_analysis": "detected artistic style",
  "lighting_analysis": "lighting and atmosphere details",
  "composition_analysis": "compositional elements",
  "color_palette": ["color1", "color2"...]
}

Rules:
- main_prompt must be formatted specifically for ${opts.target === 'mj' ? 'Midjourney with --flags' : opts.target === 'sd' ? 'Stable Diffusion with comma-separated keywords' : opts.target === 'flux' ? 'FLUX.1 syntax' : opts.target === 'dalle' ? 'DALL-E 3 natural language' : 'Leonardo AI'}
- Include technical details: camera settings, artistic techniques, mood
- Style focus: ${opts.style}
- Detail level: ${opts.detail}
- NO markdown, NO code blocks, ONLY pure JSON`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appState.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this image and generate the complete prompt package.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    const cleaned = content.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  }

  async function callOpenAITextEnhancement(inputPrompt) {
    const opts = appState.options.text;
    
    const systemPrompt = `You are an elite AI prompt engineer. Enhance the user's basic prompt into a professional, optimized prompt for ${opts.target.toUpperCase()}. Return ONLY valid JSON:

{
  "enhanced_prompt": "fully optimized main prompt",
  "variation_1": "first alternative version",
  "variation_2": "second alternative version",
  "variation_3": "third alternative version",
  "negative_prompt": "comprehensive negative prompt",
  "parameters": "recommended parameters",
  "keywords": ["keyword1", "keyword2"...]
}

Enhancement level: ${opts.complexity}
Style: ${opts.style}
Include technical photography terms, artistic styles, lighting, composition, mood.
Format specifically for ${opts.target === 'mj' ? 'Midjourney with --ar flags' : opts.target === 'sd' ? 'Stable Diffusion keywords' : opts.target === 'flux' ? 'FLUX.1' : opts.target === 'dalle' ? 'DALL-E 3' : 'Leonardo AI'}.
NO markdown, NO code blocks, ONLY pure JSON`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appState.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Enhance this prompt: "${inputPrompt}"` }
        ],
        max_tokens: 1200,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    const cleaned = content.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  }

  async function callHuggingFace(blob) {
    // Use BLIP for basic captioning
    const response = await fetch('https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${appState.apiKey}` },
      body: blob
    });

    if (!response.ok) throw new Error('Hugging Face API error');

    const result = await response.json();
    const caption = result[0]?.generated_text || 'a detailed image';
    
    return {
      main_prompt: enhanceCaption(caption),
      negative_prompt: getDefaultNegatives(),
      parameters: getDefaultParameters(),
      alt_text: caption,
      keywords: extractKeywords(caption),
      style_analysis: 'photographic',
      lighting_analysis: 'natural lighting',
      composition_analysis: 'balanced composition',
      color_palette: ['varied']
    };
  }

  async function localAnalysis(blob) {
    // Basic local analysis using color extraction
    const colors = await extractDominantColors(blob);
    const caption = `image with ${colors.join(', ')} color palette`;
    
    return {
      main_prompt: `detailed ${appState.options.image.style} image, ${colors.join(', ')} tones, high quality, sharp focus`,
      negative_prompt: getDefaultNegatives(),
      parameters: getDefaultParameters(),
      alt_text: caption,
      keywords: [...colors, appState.options.image.style, 'detailed'],
      style_analysis: appState.options.image.style,
      lighting_analysis: 'balanced lighting',
      composition_analysis: 'centered composition',
      color_palette: colors
    };
  }

  async function localTextEnhancement(input) {
    const opts = appState.options.text;
    const enhanced = `${input}, ${opts.style} style, highly detailed, professional quality, perfect composition, ${opts.complexity === 'advanced' ? 'intricate details, masterpiece, ' : ''}sharp focus, vibrant colors`;
    
    return {
      enhanced_prompt: enhanced,
      variation_1: `${input}, cinematic ${opts.style}, dramatic lighting, 8k resolution, award winning`,
      variation_2: `${input}, ${opts.style} aesthetic, soft focus, atmospheric, professional photography`,
      variation_3: `${input}, ultra detailed ${opts.style}, perfect exposure, trending on artstation`,
      negative_prompt: getDefaultNegatives(),
      parameters: getDefaultParameters(),
      keywords: extractKeywords(input)
    };
  }

  // ========== Helper Functions ==========
  function getDefaultNegatives() {
    return 'blurry, low quality, watermark, text, logo, signature, cropped, out of frame, worst quality, low resolution, jpeg artifacts, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, ugly, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers';
  }

  function getDefaultParameters() {
    const opts = appState.currentMode === 'image' ? appState.options.image : appState.options.text;
    const target = opts.target;
    
    const params = {
      sd: 'Steps: 30, Sampler: DPM++ 2M Karras, CFG scale: 7, Size: 1024x1024, Model: SDXL',
      mj: '--ar 16:9 --v 6 --style raw --quality 2',
      flux: 'steps: 28, guidance: 3.5, size: 1024x1024',
      dalle: 'quality: hd, style: vivid, size: 1024x1024',
      leonardo: 'photoReal: true, alchemy: true, presetStyle: CINEMATIC'
    };
    
    return params[target] || params.sd;
  }

  function enhanceCaption(caption) {
    const opts = appState.options.image;
    const styleTerms = {
      photorealistic: 'photorealistic, highly detailed, 8k, professional photography',
      artistic: 'artistic style, creative composition, expressive',
      illustration: 'illustration style, digital art, detailed artwork',
      '3d': '3d render, octane render, unreal engine, photorealistic 3d',
      anime: 'anime style, manga art, vibrant colors, cel shaded',
      portrait: 'portrait photography, professional lighting, sharp focus on subject',
      landscape: 'landscape photography, wide angle, scenic vista',
      product: 'product photography, studio lighting, clean background',
      architecture: 'architectural photography, geometric composition, HDR'
    };
    
    return `${caption}, ${styleTerms[opts.style] || styleTerms.photorealistic}, masterpiece, best quality`;
  }

  function extractKeywords(text) {
    const stopwords = new Set(['a', 'an', 'and', 'the', 'of', 'in', 'on', 'with', 'for', 'to', 'from', 'at', 'by']);
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));
    
    return [...new Set(words)].slice(0, 12);
  }

  async function extractDominantColors(blob) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 64, 64);
        
        const imageData = ctx.getImageData(0, 0, 64, 64);
        const data = imageData.data;
        const colorMap = new Map();
        
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue; // Skip transparent
          
          const r = Math.floor(data[i] / 32) * 32;
          const g = Math.floor(data[i + 1] / 32) * 32;
          const b = Math.floor(data[i + 2] / 32) * 32;
          const key = `${r},${g},${b}`;
          
          colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }
        
        const sorted = [...colorMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([rgb]) => {
            const [r, g, b] = rgb.split(',').map(Number);
            return getColorName(r, g, b);
          });
        
        resolve([...new Set(sorted)].slice(0, 4));
      };
      
      img.src = URL.createObjectURL(blob);
    });
  }

  function getColorName(r, g, b) {
    const colorNames = [
      [[0, 0, 0], 'black'], [[255, 255, 255], 'white'], 
      [[128, 128, 128], 'gray'], [[255, 0, 0], 'red'],
      [[0, 255, 0], 'green'], [[0, 0, 255], 'blue'],
      [[255, 255, 0], 'yellow'], [[255, 165, 0], 'orange'],
      [[128, 0, 128], 'purple'], [[255, 192, 203], 'pink'],
      [[165, 42, 42], 'brown'], [[0, 128, 128], 'teal']
    ];
    
    let minDist = Infinity;
    let closestName = 'neutral';
    
    for (const [[cr, cg, cb], name] of colorNames) {
      const dist = Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestName = name;
      }
    }
    
    return closestName;
  }

  // ========== Display Results ==========
  function displayResults(result, mode) {
    const opts = mode === 'image' ? appState.options.image : appState.options.text;
    
    // Main prompt
    els.outputMain.value = result.enhanced_prompt || result.main_prompt || '';
    
    // Negative prompt
    els.outputNeg.value = opts.includeNeg ? (result.negative_prompt || '') : '';
    
    // Parameters
    els.outputParams.value = opts.includeParams ? (result.parameters || '') : '';
    
    // Alt text (image mode only)
    if (mode === 'image' && opts.includeAlt) {
      els.outputAlt.value = result.alt_text || '';
    } else {
      els.outputAlt.value = '';
    }
    
    // Keywords/tags
    if (opts.includeTags || opts.includeHashtags) {
      const keywords = result.keywords || [];
      els.outputTags.value = keywords.map(k => '#' + k.replace(/\s+/g, '')).join(' ');
    } else {
      els.outputTags.value = '';
    }
    
    // Variations (text mode only)
    if (mode === 'text' && appState.options.text.includeVariations) {
      els.var1.value = result.variation_1 || '';
      els.var2.value = result.variation_2 || '';
      els.var3.value = result.variation_3 || '';
      els.variationsCard.classList.add('pgen-visible');
    } else {
      els.variationsCard.classList.remove('pgen-visible');
    }
    
    // Show output section
    els.outputSection.classList.add('pgen-visible');
    els.outputSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ========== Copy to Clipboard ==========
  async function copyToClipboard(text, buttonEl) {
    try {
      await navigator.clipboard.writeText(text);
      const originalText = buttonEl.textContent;
      buttonEl.textContent = '✓ Copied!';
      setTimeout(() => {
        buttonEl.textContent = originalText;
      }, 2000);
    } catch (err) {
      alert('Failed to copy to clipboard');
      console.error(err);
    }
  }

  // ========== Download Functions ==========
  function downloadText(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadCompletePackage() {
    const timestamp = new Date().toISOString().split('T')[0];
    const mode = appState.currentMode;
    
    let content = `AI Prompt Package - Generated ${timestamp}\n`;
    content += `Mode: ${mode === 'image' ? 'Image to Prompt' : 'Text Enhancement'}\n`;
    content += `${'='.repeat(60)}\n\n`;
    
    content += `MAIN PROMPT:\n${els.outputMain.value}\n\n`;
    
    if (els.outputNeg.value) {
      content += `NEGATIVE PROMPT:\n${els.outputNeg.value}\n\n`;
    }
    
    if (els.outputParams.value) {
      content += `PARAMETERS:\n${els.outputParams.value}\n\n`;
    }
    
    if (els.outputAlt.value) {
      content += `SEO ALT TEXT:\n${els.outputAlt.value}\n\n`;
    }
    
    if (els.outputTags.value) {
      content += `KEYWORDS/HASHTAGS:\n${els.outputTags.value}\n\n`;
    }
    
    if (mode === 'text' && appState.options.text.includeVariations) {
      content += `VARIATIONS:\n\n`;
      content += `Variation 1:\n${els.var1.value}\n\n`;
      content += `Variation 2:\n${els.var2.value}\n\n`;
      content += `Variation 3:\n${els.var3.value}\n\n`;
    }
    
    content += `${'='.repeat(60)}\n`;
    content += `Generated by The Bukit Besi AI Prompt Generator\n`;
    content += `https://www.thebukitbesi.com/ai-prompt-generator\n`;
    
    downloadText(`ai-prompt-${timestamp}.txt`, content);
  }

  // ========== Event Listeners ==========
  function initEventListeners() {
    // Mode switching
    els.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
    
    // Config
    els.configToggle.addEventListener('click', toggleConfig);
    els.toggleKey.addEventListener('click', toggleKeyVisibility);
    els.saveConfig.addEventListener('click', saveConfig);
    els.clearConfig.addEventListener('click', clearConfig);
    
    // Provider change
    els.provider.addEventListener('change', () => {
      appState.provider = els.provider.value;
    });
    
    // Tab switching
    els.tabs.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Image input
    els.dropzone.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', e => {
      if (e.target.files[0]) loadImageFromFile(e.target.files[0]);
    });
    els.fetchUrl.addEventListener('click', loadImageFromURL);
    els.urlInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') loadImageFromURL();
    });
    
    // Options change listeners
    [els.imgStyle, els.imgTarget, els.imgDetail].forEach(el => {
      el.addEventListener('change', () => {
        appState.options.image[el.id.replace('pgen-img-', '')] = el.value;
      });
    });
    
    [els.imgNeg, els.imgParams, els.imgAlt, els.imgTags].forEach(el => {
      el.addEventListener('change', () => {
        const key = el.id.replace('pgen-img-', 'include' + el.id.split('-').pop().charAt(0).toUpperCase() + el.id.split('-').pop().slice(1));
        appState.options.image[key] = el.checked;
      });
    });
    
    [els.textStyle, els.textTarget, els.textComplexity].forEach(el => {
      el.addEventListener('change', () => {
        appState.options.text[el.id.replace('pgen-text-', '')] = el.value;
      });
    });
    
    [els.textNeg, els.textParams, els.textVariations].forEach(el => {
      el.addEventListener('change', () => {
        const key = el.id.replace('pgen-text-', 'include' + el.id.split('-').pop().charAt(0).toUpperCase() + el.id.split('-').pop().slice(1));
        appState.options.text[key] = el.checked;
      });
    });
    
    // Generate buttons
    els.imgGenerate.addEventListener('click', generateImagePrompt);
    els.textGenerate.addEventListener('click', generateTextPrompt);
    
    // Copy buttons
    els.copyMain.addEventListener('click', () => copyToClipboard(els.outputMain.value, els.copyMain));
    els.copyNeg.addEventListener('click', () => copyToClipboard(els.outputNeg.value, els.copyNeg));
    els.copyParams.addEventListener('click', () => copyToClipboard(els.outputParams.value, els.copyParams));
    els.copyAlt.addEventListener('click', () => copyToClipboard(els.outputAlt.value, els.copyAlt));
    els.copyTags.addEventListener('click', () => copyToClipboard(els.outputTags.value, els.copyTags));
    
    els.copyVarBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const varNum = btn.dataset.var;
        const textarea = byId(`pgen-var-${varNum}`);
        copyToClipboard(textarea.value, btn);
      });
    });
    
    // Download buttons
    els.downloadMain.addEventListener('click', () => {
      downloadText('ai-prompt-main.txt', els.outputMain.value);
    });
    els.downloadAll.addEventListener('click', downloadCompletePackage);
    
    // Drag & Drop
    setupDragDrop();
    
    // Clipboard paste
    setupClipboardPaste();
  }

  // ========== Initialize Application ==========
  function init() {
    initEventListeners();
    setStatus('Ready', 'ready');
    console.log('AI Prompt Generator initialized');
  }

  // Start the app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

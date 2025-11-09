// Use absolute import so it works regardless of extension folder depth
import { app } from "/scripts/app.js";

/*
  RGB Color Picker extension for ComfyUI
  - Adds a DOM-based color wheel + SV square widget to the RGBColorPicker node
  - Syncs with the node's red/green/blue INT widgets
  - Outputs hex via Python node
*/

const EXT_NAME = "Comfy.TJnodes.RGBColorPicker";
const __RGB_PICKER_VERSION__ = "v0.1.1-debug";
console.log(`[${EXT_NAME}] loading script ${__RGB_PICKER_VERSION__}`);

function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }
function hsvToRgb(h, s, v) {
    // h: [0,360), s,v: [0,1]
    const c = v * s;
    const hh = (h / 60) % 6;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let r1 = 0, g1 = 0, b1 = 0;
    if (0 <= hh && hh < 1) { r1 = c; g1 = x; b1 = 0; }
    else if (1 <= hh && hh < 2) { r1 = x; g1 = c; b1 = 0; }
    else if (2 <= hh && hh < 3) { r1 = 0; g1 = c; b1 = x; }
    else if (3 <= hh && hh < 4) { r1 = 0; g1 = x; b1 = c; }
    else if (4 <= hh && hh < 5) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    const m = v - c;
    return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}
function rgbToHsv(r, g, b) {
    // r,g,b: [0,255]
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d === 0) h = 0;
    else if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * (((b - r) / d) + 2);
    else h = 60 * (((r - g) / d) + 4);
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    return [h, s, v];
}

function createContainer() {
    const container = document.createElement("div");
    // Follow LogiCalc HTMLViewer strategy: fixed positioning inside canvas container
    container.style.position = "fixed";
    container.style.zIndex = "100";
    container.style.width = "300px";
    container.style.pointerEvents = "auto"; // allow interaction
    container.style.transformOrigin = "top left"; // for zoom scaling

    // Preview swatch (with checkerboard + overlay swatch)
    const preview = document.createElement("div");
    preview.style.width = "56px";
    preview.style.height = "56px";
    preview.style.border = "1px solid #fff";
    preview.style.borderRadius = "6px";
    preview.style.marginTop = "8px";
    preview.style.position = "relative";
    // checkerboard background
    preview.style.backgroundImage = `
        linear-gradient(45deg, #999 25%, transparent 25%),
        linear-gradient(-45deg, #999 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #999 75%),
        linear-gradient(-45deg, transparent 75%, #999 75%)`;
    preview.style.backgroundSize = "12px 12px";
    preview.style.backgroundPosition = "0 0, 0 6px, 6px -6px, -6px 0px";
    const swatch = document.createElement("div");
    swatch.style.position = "absolute";
    swatch.style.inset = "0";
    swatch.style.borderRadius = "6px";

    // Single canvas: hue ring + inner SV map (HiDPI aware)
    const wheel = document.createElement("canvas");
    const baseSize = 300;
    const dpr = window.devicePixelRatio || 1;
    wheel.style.width = `${baseSize}px`;
    wheel.style.height = `${baseSize}px`;
    wheel.width = Math.round(baseSize * dpr);
    wheel.height = Math.round(baseSize * dpr);
    wheel.style.display = "block";

    // Alpha bar under wheel
    const alphaBar = document.createElement("canvas");
    const alphaBarHeight = 16;
    alphaBar.style.width = `${baseSize}px`;
    alphaBar.style.height = `${alphaBarHeight}px`;
    alphaBar.width = Math.round(baseSize * dpr);
    alphaBar.height = Math.round(alphaBarHeight * dpr);
    alphaBar.style.display = "block";
    alphaBar.style.marginTop = "8px";

    container.appendChild(wheel);
    container.appendChild(alphaBar);
    preview.appendChild(swatch);
    container.appendChild(preview);
    const canvas = app.canvas?.canvas;
    const canvasContainer = canvas?.parentElement || document.body;
    canvasContainer.appendChild(container);
    return { container, wheel, alphaBar, preview, swatch };
}

function drawHueRingAndSV(canvas, hueDeg, s, v, markers) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    // Work in CSS pixels for geometry; scale context for HiDPI
    const w = canvas.clientWidth || parseInt(canvas.style.width) || 300;
    const h = canvas.clientHeight || parseInt(canvas.style.height) || 300;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const outer = Math.min(cx, cy) - 4; // outer radius
    const ringThickness = 20;
    const inner = outer - ringThickness; // inner radius -> inside will host SV

    // Hue ring (anti-aliased) using conic gradient when available
    if (typeof ctx.createConicGradient === 'function') {
        const cg = ctx.createConicGradient(-Math.PI/2, cx, cy); // start at top
        cg.addColorStop(0/6,   '#ff0000');
        cg.addColorStop(1/6,   '#ffff00');
        cg.addColorStop(2/6,   '#00ff00');
        cg.addColorStop(3/6,   '#00ffff');
        cg.addColorStop(4/6,   '#0000ff');
        cg.addColorStop(5/6,   '#ff00ff');
        cg.addColorStop(1,     '#ff0000');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cx, cy, outer, 0, Math.PI * 2);
        ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill('evenodd');
    } else {
        // Fallback: coarse pixel method
        const image = ctx.createImageData(w, h);
        for (let yy = 0; yy < h; yy++) {
            for (let xx = 0; xx < w; xx++) {
                const dx = xx - cx; const dy = yy - cy;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const idx = (yy*w + xx) * 4;
                if (dist <= outer && dist >= inner) {
                    let ang = Math.atan2(dy, dx);
                    let hdeg = ang * 180 / Math.PI; if (hdeg < 0) hdeg += 360;
                    const [rr, gg, bb] = hsvToRgb(hdeg, 1, 1);
                    image.data[idx] = rr; image.data[idx+1] = gg; image.data[idx+2] = bb; image.data[idx+3] = 255;
                } else {
                    image.data[idx+3] = 0;
                }
            }
        }
        ctx.putImageData(image, 0, 0);
    }

    // Inner SV square: compute directly from desired corner gap to keep perfectly centered
    const cornerGap = 14; // distance from square corner to ring inner edge (CSS px)
    // square half diagonal = inner - cornerGap -> side = (inner - cornerGap)*sqrt(2)
    const side = Math.max(1, (inner - cornerGap) * Math.sqrt(2));
    const topLeftX = cx - side / 2;
    const topLeftY = cy - side / 2;
    // radiusForSV kept for geometry compatibility (half diagonal of square)
    const radiusForSV = side / Math.sqrt(2);

    // Offscreen SV texture for current hue (per-pixel HSV -> RGB,正確な黒/白を保証)
    const off = document.createElement("canvas");
    const pxSide = Math.max(1, Math.round(side * dpr));
    off.width = pxSide; off.height = pxSide;
    const octx = off.getContext("2d");
    const img = octx.createImageData(pxSide, pxSide);
    for (let yy = 0; yy < pxSide; yy++) {
        const V = 1 - (yy / (pxSide - 1));
        for (let xx = 0; xx < pxSide; xx++) {
            const S = xx / (pxSide - 1);
            const [rr, gg, bb] = hsvToRgb(hueDeg, S, V);
            const idx = (yy * pxSide + xx) * 4;
            img.data[idx] = rr; img.data[idx+1] = gg; img.data[idx+2] = bb; img.data[idx+3] = 255;
        }
    }
    octx.putImageData(img, 0, 0);

    // Draw SV square directly (remove circular clip so display matches interactive square)
    ctx.save();
    ctx.beginPath();
    ctx.rect(topLeftX, topLeftY, side, side);
    ctx.clip();
    // draw offscreen (device px) into CSS px area
    ctx.drawImage(off, topLeftX, topLeftY, side, side);
    ctx.restore();

    // (debug frame removed) SV表示はクリック範囲と一致する正方形。必要なら再度描画コードを追加可能。

    // Markers
    const H = markers?.h ?? hueDeg; const S = markers?.s ?? s; const V = markers?.v ?? v;
    // hue marker in ring centerline
    const hr = inner + ringThickness / 2;
    const hx = cx + hr * Math.cos(H * Math.PI / 180);
    const hy = cy + hr * Math.sin(H * Math.PI / 180);
    ctx.save(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    // sv marker
    const svX = topLeftX + S * side;
    const svY = topLeftY + (1 - V) * side;
    ctx.save();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(svX, svY, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(svX, svY, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // geometry for hit tests
    return { cx, cy, outer, inner, radiusForSV, side, topLeftX, topLeftY };
}

function drawAlphaBar(canvas, r, g, b, a) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || parseInt(canvas.style.width) || 300;
    const h = canvas.clientHeight || parseInt(canvas.style.height) || 16;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // checkerboard background
    const tile = document.createElement('canvas');
    tile.width = tile.height = 12;
    const tctx = tile.getContext('2d');
    tctx.fillStyle = '#bbb'; tctx.fillRect(0,0,12,12);
    tctx.fillStyle = '#999'; tctx.fillRect(0,0,6,6); tctx.fillRect(6,6,6,6);
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pattern; ctx.fillRect(0,0,w,h);

    // alpha gradient overlay
    const grad = ctx.createLinearGradient(0,0,w,0);
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},1)`);
    ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

    // handle
    const x = Math.max(0, Math.min(1, a)) * w;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, h/2, 6, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, h/2, 6, 0, Math.PI*2); ctx.stroke();
}

// (legacy) drawSVSquare no longer used

// Position DOM overlay using the same formula proven in TJ_LogiCalc HTMLViewer:
// (nodePos + ds.offset) * ds.scale + canvasRect.{left,top}
function positionContainer(node, ctx, cont) {
    const ds = app.canvas?.ds; // {scale, offset}
    const canvas = app.canvas?.canvas;
    if (!ds || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = ds.scale || 1;
    const [offX, offY] = ds.offset || [0, 0];

    const nodeX = (node.pos[0] + offX) * scale + rect.left;
    const nodeY = (node.pos[1] + offY) * scale + rect.top;
    const gap = 12; // vertical gap
    const x = nodeX; // align horizontally with node
    const y = nodeY + node.size[1] * scale + gap; // place below node

    cont.style.left = `${x}px`;
    cont.style.top = `${y}px`;
    cont.style.transform = `scale(${scale})`;
}

function attachPicker(node) {
    if (node.__rgb_picker__) return node.__rgb_picker__;

    const { container, wheel, alphaBar, preview, swatch } = createContainer();

    let h = 330, s = 0.75, v = 0.9;
    let a = 1.0;
    let geometry = null; // cached geometry for hit tests

    function redraw() {
        geometry = drawHueRingAndSV(wheel, h, s, v, { h, s, v });
        const [rr, gg, bb] = hsvToRgb(h, s, v);
        drawAlphaBar(alphaBar, rr, gg, bb, a);
    }

    function updatePreview(updateCanvas = true) {
        const [r, g, b] = hsvToRgb(h, s, v);
        swatch.style.background = `rgba(${r}, ${g}, ${b}, ${a})`;
        const widgets = node.widgets || [];
        const wm = Object.fromEntries(widgets.map(w => [w.name, w]));
        if (wm.red && wm.green && wm.blue) {
            const setVal = (w, val) => { if (typeof w.value !== 'undefined') w.value = val; w.callback?.(val, app); };
            setVal(wm.red, r); setVal(wm.green, g); setVal(wm.blue, b);
            if (wm.alpha) setVal(wm.alpha, Math.round(a * 255));
            app.graph.setDirtyCanvas(true, true);
        }
        if (updateCanvas) redraw();
    }

    redraw();
    updatePreview(false);

    function handlePointer(ev) {
        const rect = wheel.getBoundingClientRect();
        // container is scaled by ds.scale, so normalize pointer to canvas pixel coords
        const ds = app.canvas?.ds;
        const scale = ds?.scale || 1;
        const x = (ev.clientX - rect.left) / scale;
        const y = (ev.clientY - rect.top) / scale;
        if (!geometry) return false;
        const dx = x - geometry.cx;
        const dy = y - geometry.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Hue ring region
        if (dist <= geometry.outer && dist >= geometry.inner) {
            let ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang < 0) ang += 360;
            h = ang;
            updatePreview();
            return true;
        }
        // SV region: restrict strictly to the square bounds to avoid accidental hits while dragging hue
        if (
            x >= geometry.topLeftX && x <= geometry.topLeftX + geometry.side &&
            y >= geometry.topLeftY && y <= geometry.topLeftY + geometry.side
        ) {
            const relX = (x - geometry.topLeftX) / geometry.side;
            const relY = (y - geometry.topLeftY) / geometry.side;
            // ピクセル基準の端スナップ（拡大縮小やHiDPIでも安定）
            const snapPx = Math.max(2, geometry.side * 0.01); // 最小2px or 1%
            const leftDist = x - geometry.topLeftX;
            const rightDist = (geometry.topLeftX + geometry.side) - x;
            const topDist = y - geometry.topLeftY;
            const bottomDist = (geometry.topLeftY + geometry.side) - y;
            // s (0..1)
            if (leftDist <= snapPx) s = 0;
            else if (rightDist <= snapPx) s = 1;
            else s = clamp(relX, 0, 1);
            // v (0..1) 上=1, 下=0
            if (topDist <= snapPx) v = 1;
            else if (bottomDist <= snapPx) v = 0;
            else v = 1 - clamp(relY, 0, 1);
            updatePreview();
            return true;
        }
        return false;
    }

    function dragStart(ev) {
        if (!handlePointer(ev)) return;
        const move = (e) => handlePointer(e);
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }

    wheel.addEventListener('mousedown', dragStart);

    function alphaStart(ev) {
        const rect = alphaBar.getBoundingClientRect();
        const ds = app.canvas?.ds; const scale = ds?.scale || 1;
        const x = (ev.clientX - rect.left) / scale;
        const w = alphaBar.clientWidth || parseInt(alphaBar.style.width) || 300;
        a = clamp(x / w, 0, 1);
        updatePreview();
        const move = (e) => {
            const xr = (e.clientX - rect.left) / scale; a = clamp(xr / w, 0, 1); updatePreview();
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }
    alphaBar.addEventListener('mousedown', alphaStart);

    const origConfigure = node.onConfigure;
    node.onConfigure = function() {
        const r = this.widgets?.find(w => w.name === 'red')?.value ?? 255;
        const g = this.widgets?.find(w => w.name === 'green')?.value ?? 0;
        const b = this.widgets?.find(w => w.name === 'blue')?.value ?? 0;
        const alphaW = this.widgets?.find(w => w.name === 'alpha')?.value;
        const [hh, ss, vv] = rgbToHsv(r, g, b);
        h = hh; s = ss; v = vv; if (typeof alphaW === 'number') a = clamp(alphaW / 255, 0, 1); updatePreview();
        return origConfigure?.apply(this, arguments);
    };

    const onRemoved = node.onRemoved;
    node.onRemoved = function() {
        try { container.remove(); } catch {}
        node.__rgb_picker__ = null;
        return onRemoved?.apply(this, arguments);
    };

    node.__rgb_picker__ = { container, wheel, alphaBar, preview, state: () => ({ h, s, v, a }) };
    return node.__rgb_picker__;
}

app.registerExtension({
    name: EXT_NAME,
    async beforeRegisterNodeDef(nodeType, nodeData, _app) {
        console.log(`[${EXT_NAME}] beforeRegisterNodeDef: ${nodeData.name}`);
        if (nodeData.name !== "RGBColorPicker") return;

        const onDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function(ctx) {
            const r = onDrawForeground?.apply(this, arguments);
            const picker = attachPicker(this);
            positionContainer(this, ctx, picker.container);
            return r;
        };

        // Attach picker immediately when node instance is created
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const r = onNodeCreated?.apply(this, arguments);
            console.log(`[${EXT_NAME}] nodeCreated id=${this.id}`);
            attachPicker(this);
            return r;
        };

        // Fallback: ensure picker after first execution if somehow missed
        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function() {
            const r = onExecuted?.apply(this, arguments);
            if (!this.__rgb_picker__) {
                console.log(`[${EXT_NAME}] onExecuted fallback attach id=${this.id}`);
                attachPicker(this);
            }
            return r;
        };
    },
});

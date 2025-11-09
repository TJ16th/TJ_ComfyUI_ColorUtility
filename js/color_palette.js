// ColorPalette extension for ComfyUI
// Displays 16 color chips below the node based on selected preset
import { app } from "/scripts/app.js";

const EXT_NAME = "Comfy.TJnodes.ColorPalette";
console.log(`[${EXT_NAME}] loading`);

function createChipsContainer() {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.zIndex = "100";
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(8, 24px)";
    container.style.gap = "4px";
    container.style.pointerEvents = "none";
    container.style.transformOrigin = "top left";
    
    // 8 chips
    const chips = [];
    for (let i = 0; i < 8; i++) {
        const chip = document.createElement("div");
        chip.style.width = "24px";
        chip.style.height = "24px";
        chip.style.borderRadius = "4px";
        chip.style.border = "1px solid #fff";
        chip.style.background = "#000";
        container.appendChild(chip);
        chips.push(chip);
    }
    
    const canvas = app.canvas?.canvas;
    const canvasContainer = canvas?.parentElement || document.body;
    canvasContainer.appendChild(container);
    
    return { container, chips };
}

function positionChips(node, container) {
    const ds = app.canvas?.ds;
    const canvas = app.canvas?.canvas;
    if (!ds || !canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scale = ds.scale || 1;
    const [offX, offY] = ds.offset || [0, 0];
    
    const nodeX = (node.pos[0] + offX) * scale + rect.left;
    const nodeY = (node.pos[1] + offY) * scale + rect.top;
    const gap = 8;
    
    const x = nodeX;
    const y = nodeY + node.size[1] * scale + gap;
    
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.transform = `scale(${scale})`;
}

function updateChips(node, chips) {
    // node.widgets から各 color_N の値を取得して chip に反映
    // ColorPalette ノードは preset widget のみなので、出力値を widgets に保持する必要あり
    // → onExecuted で outputs から色を取得
    if (!node.__palette_colors__) {
        // デフォルト: グレー
        for (let i = 0; i < 8; i++) {
            chips[i].style.background = `#${(i * 32).toString(16).padStart(2, '0').repeat(3)}`;
        }
        return;
    }
    
    const colors = node.__palette_colors__;
    for (let i = 0; i < 8 && i < colors.length; i++) {
        chips[i].style.background = colors[i];
    }
}

function parseCustomColors(text) {
    try {
        if (!text || !text.trim()) return null;
        const data = JSON.parse(text);
        const arr = Array.isArray(data) ? data : data.colors;
        if (!Array.isArray(arr)) return null;
        const out = [];
        for (const c of arr) {
            if (typeof c !== 'string') continue;
            const v = c.trim().toUpperCase();
            if (/^#[0-9A-F]{6}$/.test(v)) {
                out.push(v);
                if (out.length >= 8) break;
            }
        }
        if (!out.length) return null;
        while (out.length < 8) out.push('#000000');
        return out.slice(0, 8);
    } catch {
        return null;
    }
}

function setErrorVisual(node, on) {
    const ui = node.__palette_ui__;
    if (!ui) return;
    ui.container.style.outline = on ? '2px solid #f55' : 'none';
}

function attachPaletteUI(node) {
    if (node.__palette_ui__) return node.__palette_ui__;
    
    const { container, chips } = createChipsContainer();
    updateChips(node, chips);
    
    node.__palette_ui__ = { container, chips };
    return node.__palette_ui__;
}

app.registerExtension({
    name: EXT_NAME,
    async beforeRegisterNodeDef(nodeType, nodeData, _app) {
        if (nodeData.name !== "ColorPalette") return;
        
        const onDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function(ctx) {
            const r = onDrawForeground?.apply(this, arguments);
            const ui = attachPaletteUI(this);
            positionChips(this, ui.container);
            
            // custom の場合は custom_json を毎フレーム監視して即時更新
            const presetWidget = this.widgets?.find(w => w.name === 'preset');
            const customWidget = this.widgets?.find(w => w.name === 'custom_json');
            if (presetWidget && presetWidget.value === 'custom' && customWidget) {
                const currentText = customWidget.value || '';
                if (this.__last_custom_text__ !== currentText) {
                    this.__last_custom_text__ = currentText;
                    const colors = parseCustomColors(currentText);
                    if (colors) {
                        this.__palette_colors__ = colors;
                        setErrorVisual(this, false);
                    } else {
                        this.__palette_colors__ = null;
                        setErrorVisual(this, !!currentText.trim());
                    }
                }
            }
            
            updateChips(this, ui.chips);
            return r;
        };
        
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const r = onNodeCreated?.apply(this, arguments);
            attachPaletteUI(this);
            
            // widget 参照
            const presetWidget = this.widgets?.find(w => w.name === 'preset');
            const customWidget = this.widgets?.find(w => w.name === 'custom_json');

            const refreshFromWidgets = async () => {
                const preset = presetWidget?.value;
                if (!preset) return;
                if (preset === 'custom') {
                    const colors = parseCustomColors(customWidget?.value || '');
                    if (colors) {
                        this.__palette_colors__ = colors;
                        setErrorVisual(this, false);
                        updateChips(this, this.__palette_ui__.chips);
                    } else {
                        this.__palette_colors__ = null;
                        setErrorVisual(this, !!(customWidget?.value && customWidget.value.trim()))
                        updateChips(this, this.__palette_ui__.chips);
                    }
                } else {
                    // プリセットはサーバーから即時取得
                    try {
                        const response = await fetch('/tj_comfyuiutil/palette', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ preset })
                        });
                        if (response.ok) {
                            const colors = await response.json();
                            this.__palette_colors__ = colors;
                            setErrorVisual(this, false);
                            updateChips(this, this.__palette_ui__.chips);
                        }
                    } catch (e) {
                        console.error(`[${EXT_NAME}] Failed to fetch palette:`, e);
                    }
                }
            };

            // コールバックを装着
            if (presetWidget) {
                const orig = presetWidget.callback;
                presetWidget.callback = (v) => { refreshFromWidgets(); orig?.call(presetWidget, v); };
            }
            if (customWidget) {
                const orig = customWidget.callback;
                customWidget.callback = (v) => { refreshFromWidgets(); orig?.call(customWidget, v); };
            }
            // 初期
            refreshFromWidgets();
            
            return r;
        };
        
        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function(message) {
            const r = onExecuted?.apply(this, arguments);
            // outputs から8色を取得してキャッシュ
            if (message && Array.isArray(message)) {
                // message は [color_1, color_2, ..., color_8] 形式
                this.__palette_colors__ = message.slice(0, 8);
                if (this.__palette_ui__) {
                    updateChips(this, this.__palette_ui__.chips);
                }
            }
            return r;
        };
        
        // プリセット widget 変更時にも色をリロード (即座に反映)
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function() {
            const r = onConfigure?.apply(this, arguments);
            // preset widget から現在値を取得してサーバーに問い合わせずローカル再描画
            // (実際はサーバー実行後に onExecuted で更新されるが、ここでは初期表示をクリア)
            const presetWidget = this.widgets?.find(w => w.name === "preset");
            if (presetWidget && presetWidget.value) {
                // プリセット変更時は一旦リセット (実行後に正しい色が反映される)
                this.__palette_colors__ = null;
                if (this.__palette_ui__) {
                    updateChips(this, this.__palette_ui__.chips);
                }
            }
            return r;
        };
        
        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function() {
            const r = onRemoved?.apply(this, arguments);
            if (this.__palette_ui__) {
                try { this.__palette_ui__.container.remove(); } catch {}
                this.__palette_ui__ = null;
            }
            return r;
        };
    }
});

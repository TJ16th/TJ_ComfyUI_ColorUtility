from __future__ import annotations

import json
from typing import Tuple, List

import math
import numpy as np

try:
    import torch  # type: ignore
except Exception:  # pragma: no cover
    torch = None  # type: ignore


def _srgb_to_linear(c: np.ndarray) -> np.ndarray:
    mask = c <= 0.04045
    out = np.empty_like(c)
    out[mask] = c[mask] / 12.92
    out[~mask] = ((c[~mask] + 0.055) / 1.055) ** 2.4
    return out


def _linear_to_srgb(c: np.ndarray) -> np.ndarray:
    mask = c <= 0.0031308
    out = np.empty_like(c)
    out[mask] = 12.92 * c[mask]
    out[~mask] = 1.055 * (np.maximum(c[~mask], 0) ** (1 / 2.4)) - 0.055
    return out


def _rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    # rgb 0..1, shape (N,3)
    rgb_lin = _srgb_to_linear(np.clip(rgb, 0, 1))
    M = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ], dtype=np.float64)
    xyz = rgb_lin @ M.T
    # D65 white
    Xn, Yn, Zn = 0.95047, 1.00000, 1.08883
    x = xyz[:, 0] / Xn
    y = xyz[:, 1] / Yn
    z = xyz[:, 2] / Zn
    eps = (6 / 29) ** 3
    k = (29 / 3) ** 2 / 3
    fx = np.where(x > eps, np.cbrt(x), k * x + 4 / 29)
    fy = np.where(y > eps, np.cbrt(y), k * y + 4 / 29)
    fz = np.where(z > eps, np.cbrt(z), k * z + 4 / 29)
    L = 116 * fy - 16
    a = 500 * (fx - fy)
    b = 200 * (fy - fz)
    return np.stack([L, a, b], axis=1)


def _lab_to_rgb(lab: np.ndarray) -> np.ndarray:
    # lab shape (N,3)
    L, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
    fy = (L + 16) / 116
    fx = a / 500 + fy
    fz = fy - b / 200
    eps = (6 / 29) ** 3
    Xn, Yn, Zn = 0.95047, 1.00000, 1.08883
    def f_inv(t):
        return np.where(t ** 3 > eps, t ** 3, (t - 4 / 29) * (3 * (6 / 29) ** 2))
    x = f_inv(fx) * Xn
    y = f_inv(fy) * Yn
    z = f_inv(fz) * Zn
    M_inv = np.array([
        [ 3.2404542, -1.5371385, -0.4985314],
        [-0.9692660,  1.8760108,  0.0415560],
        [ 0.0556434, -0.2040259,  1.0572252],
    ], dtype=np.float64)
    rgb_lin = np.stack([x, y, z], axis=1) @ M_inv.T
    rgb = _linear_to_srgb(np.clip(rgb_lin, 0, None))
    return np.clip(rgb, 0, 1)


def _kmeans_pp_init(data: np.ndarray, k: int, rng: np.random.Generator) -> np.ndarray:
    n = data.shape[0]
    centers = np.empty((k, data.shape[1]), dtype=np.float64)
    idx = rng.integers(0, n)
    centers[0] = data[idx]
    d2 = np.full(n, np.inf)
    for i in range(1, k):
        # update distances
        diff = data - centers[i - 1]
        d2 = np.minimum(d2, np.einsum('ij,ij->i', diff, diff))
        probs = d2 / np.sum(d2)
        idx = rng.choice(n, p=probs)
        centers[i] = data[idx]
    return centers


def _kmeans(data: np.ndarray, k: int, iters: int, seed: int) -> Tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    centers = _kmeans_pp_init(data, k, rng)
    labels = np.zeros(data.shape[0], dtype=np.int32)
    for _ in range(iters):
        # assign
        # compute distances to centers
        # (N,C) -> compute argmin over centers
        d2 = np.sum((data[:, None, :] - centers[None, :, :]) ** 2, axis=2)
        new_labels = np.argmin(d2, axis=1)
        if np.array_equal(new_labels, labels):
            break
        labels = new_labels
        # update centers
        for i in range(k):
            mask = labels == i
            if np.any(mask):
                centers[i] = data[mask].mean(axis=0)
    return centers, labels


def _hex_from_rgb01(rgb: np.ndarray) -> str:
    r = int(np.round(rgb[0] * 255.0))
    g = int(np.round(rgb[1] * 255.0))
    b = int(np.round(rgb[2] * 255.0))
    r = max(0, min(255, r))
    g = max(0, min(255, g))
    b = max(0, min(255, b))
    return f"#{r:02X}{g:02X}{b:02X}"


class ImagePaletteExtractor:
    """
    Extract 8 representative colors from an IMAGE and output:
    - custom_json: {"colors":["#RRGGBB", ...]} (8 colors)
    - color_0 .. color_7: each #RRGGBB
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE", {}),
                "sample_max_pixels": ("INT", {"default": 100_000, "min": 1000, "max": 2_000_000, "step": 1000}),
                "merge_delta": ("FLOAT", {"default": 6.0, "min": 0.0, "max": 50.0, "step": 0.5}),
                "seed": ("INT", {"default": 42, "min": 0, "max": 2**31 - 1}),
                "sort": ("COMBO", {"default": "frequency", "choices": ["frequency", "hue", "luminance"]}),
            }
        }

    RETURN_TYPES = tuple(["STRING"] * 9)
    RETURN_NAMES = ("custom_json",) + tuple([f"color_{i}" for i in range(8)])
    FUNCTION = "extract_palette"
    CATEGORY = "TJnodes/color"

    def _to_numpy_rgb01(self, image) -> np.ndarray:
        # Accepts ComfyUI IMAGE (torch tensor BCHW or BHWC) or numpy array
        if torch is not None and hasattr(torch, "Tensor") and isinstance(image, torch.Tensor):  # type: ignore
            t = image
            if t.dim() == 4:
                # Assume [B,H,W,C] or [B,C,H,W]
                if t.shape[-1] == 3:
                    arr = t[0].detach().cpu().numpy()  # H,W,3
                else:
                    arr = t[0].permute(1, 2, 0).detach().cpu().numpy()  # H,W,C
            elif t.dim() == 3:
                if t.shape[-1] == 3:
                    arr = t.detach().cpu().numpy()
                else:
                    arr = t.permute(1, 2, 0).detach().cpu().numpy()
            else:
                raise ValueError("Unsupported tensor shape for IMAGE")
            arr = np.ascontiguousarray(arr)
            arr = np.clip(arr, 0.0, 1.0).astype(np.float64)
            return arr
        else:
            arr = np.asarray(image, dtype=np.float64)
            if arr.ndim == 4:
                arr = arr[0]
            if arr.shape[-1] != 3:
                raise ValueError("Expected last dimension=3 for RGB")
            arr = np.clip(arr, 0.0, 1.0)
            return arr

    def _downsample_or_sample(self, arr: np.ndarray, sample_max_pixels: int, seed: int) -> np.ndarray:
        H, W, _ = arr.shape
        N = H * W
        rng = np.random.default_rng(seed)
        if N <= sample_max_pixels:
            return arr.reshape(-1, 3)
        # random sample without replacement
        idx = rng.choice(N, size=sample_max_pixels, replace=False)
        flat = arr.reshape(-1, 3)
        return flat[idx]

    def _merge_close(self, centers: np.ndarray, counts: np.ndarray, threshold: float) -> Tuple[np.ndarray, np.ndarray]:
        # Merge clusters whose LAB euclidean distance < threshold
        k = centers.shape[0]
        used = np.zeros(k, dtype=bool)
        new_centers: List[np.ndarray] = []
        new_counts: List[int] = []
        for i in range(k):
            if used[i]:
                continue
            group = [i]
            used[i] = True
            for j in range(i + 1, k):
                if used[j]:
                    continue
                d = np.linalg.norm(centers[i] - centers[j])
                if d < threshold:
                    used[j] = True
                    group.append(j)
            # merge by weighted average
            cs = counts[group]
            merged = np.average(centers[group], axis=0, weights=cs)
            new_centers.append(merged)
            new_counts.append(int(cs.sum()))
        return np.vstack(new_centers), np.array(new_counts)

    def _ensure_k(self, centers: np.ndarray, counts: np.ndarray, data_lab: np.ndarray, k: int, seed: int) -> Tuple[np.ndarray, np.ndarray]:
        rng = np.random.default_rng(seed)
        while centers.shape[0] < k:
            # split the largest count cluster by small jitter
            idx = int(np.argmax(counts))
            c = centers[idx]
            jitter = (rng.random(centers.shape[1]) - 0.5) * 2.0
            new_c = c + jitter
            centers = np.vstack([centers, new_c])
            counts = np.append(counts, counts[idx] // 2)
        if centers.shape[0] > k:
            # drop smallest
            order = np.argsort(-counts)
            order = order[:k]
            centers = centers[order]
            counts = counts[order]
        return centers, counts

    def _sort(self, centers_rgb: np.ndarray, counts: np.ndarray, mode: str) -> Tuple[np.ndarray, np.ndarray]:
        if mode == "hue":
            import colorsys
            hsv = np.array([colorsys.rgb_to_hsv(*c) for c in centers_rgb], dtype=np.float64)
            order = np.lexsort((hsv[:, 2], hsv[:, 0]))  # hue, then value
        elif mode == "luminance":
            Y = 0.2126 * centers_rgb[:, 0] + 0.7152 * centers_rgb[:, 1] + 0.0722 * centers_rgb[:, 2]
            order = np.argsort(Y)
        else:
            order = np.argsort(-counts)  # frequency
        return centers_rgb[order], counts[order]

    def extract_palette(self, image, sample_max_pixels: int = 100_000, merge_delta: float = 6.0, seed: int = 42, sort: str = "frequency") -> Tuple[str, str, str, str, str, str, str, str, str]:
        arr = self._to_numpy_rgb01(image)
        samples = self._downsample_or_sample(arr, sample_max_pixels, seed)
        lab = _rgb_to_lab(samples)

        k = 8
        centers, labels = _kmeans(lab, k=k, iters=15, seed=seed)
        # counts per cluster
        counts = np.bincount(labels, minlength=k).astype(np.int64)
        # merge close clusters
        centers, counts = self._merge_close(centers, counts, threshold=merge_delta)
        centers, counts = self._ensure_k(centers, counts, lab, k, seed)
        # to sRGB
        centers_rgb = _lab_to_rgb(centers)
        centers_rgb, counts = self._sort(centers_rgb, counts, mode=sort)

        # hex and json
        hexes = [_hex_from_rgb01(c) for c in centers_rgb[:k]]
        while len(hexes) < k:
            hexes.append("#000000")
        custom_json = json.dumps({"colors": hexes}, ensure_ascii=False)
        return (custom_json, *hexes[:k])

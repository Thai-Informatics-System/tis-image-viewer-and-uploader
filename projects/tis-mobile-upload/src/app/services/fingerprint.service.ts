import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class FingerprintService {
  static readonly COMPONENT_NAME = 'FingerprintService';

  private fingerprintCache?: string;
  private fingerprintPromise?: Promise<string>;
  private readonly TAB_ID_KEY = 'tab-session-id';

  constructor() {
    this.ensureTabId();
    this.generateAndCacheFingerprint();
  }

  /**
   * Generates a consistent browser-level fingerprint.
   */
  async getFingerprint(): Promise<string> {
    if (this.fingerprintCache) return this.fingerprintCache;
    if (!this.fingerprintPromise) {
      this.fingerprintPromise = this.generateAndCacheFingerprint();
    }
    return this.fingerprintPromise;
  }

  /**
   * Generates a fingerprint specific to this tab by combining
   * the base fingerprint and the per-tab session ID.
   */
  async getTabFingerprint(): Promise<string> {
    const base = await this.getFingerprint();
    const tabId = sessionStorage.getItem(this.TAB_ID_KEY)!;
    const tabFingerprint = await this.hashString(`${base}:::${tabId}`);
    return tabFingerprint;
  }

  /**
   * Ensures a tab-specific UUID is stored in sessionStorage.
   */
  private ensureTabId(): void {
    if (!sessionStorage.getItem(this.TAB_ID_KEY)) {
      const uuid = crypto.randomUUID?.() || this.fallbackUUID();
      sessionStorage.setItem(this.TAB_ID_KEY, uuid);
    }
  }

  /**
   * Generates and caches the browser fingerprint.
   */
  private async generateAndCacheFingerprint(): Promise<string> {
    const fingerprintData = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width,
      screen.height,
      screen.availWidth,
      screen.availHeight,
      window.devicePixelRatio,
      new Date().getTimezoneOffset(),
      this.getPluginsString(),
      this.getCanvasFingerprint(),
      this.getAudioFingerprint(),
      this.getFontFingerprint(),
    ].join('###');

    const hash = await this.hashString(fingerprintData);
    this.fingerprintCache = hash;
    return hash;
  }

  private getPluginsString(): string {
    if (!navigator.plugins) return '';
    return Array.from(navigator.plugins)
      .map(p => `${p.name}::${p.filename}::${p.description}`)
      .join(';');
  }

  private getCanvasFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = '16px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('Browser fingerprinting test!', 2, 2);
      return canvas.toDataURL();
    } catch {
      return '';
    }
  }

  private getAudioFingerprint(): string {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const compressor = ctx.createDynamicsCompressor();

      oscillator.type = 'triangle';
      oscillator.frequency.value = 10000;
      oscillator.connect(compressor);
      compressor.connect(ctx.destination);
      oscillator.start(0);

      const fingerprint = compressor.reduction.toString();
      oscillator.disconnect();
      return fingerprint;
    } catch {
      return '';
    }
  }

  private getFontFingerprint(): string {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana'];

    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    const span = document.createElement('span');
    span.style.fontSize = testSize;
    span.innerText = testString;
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    document.body.appendChild(span);

    const baseWidths: { [key: string]: number } = {};
    for (const font of baseFonts) {
      span.style.fontFamily = font;
      baseWidths[font] = span.offsetWidth;
    }

    const results: string[] = [];
    for (const font of testFonts) {
      span.style.fontFamily = `'${font}', monospace`;
      const width = span.offsetWidth;
      results.push(`${font}:${width}`);
    }

    document.body.removeChild(span);
    return results.join('|');
  }

  private async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Fallback UUID generator if crypto.randomUUID is not available.
   */
  private fallbackUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

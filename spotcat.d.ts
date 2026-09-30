// Type declarations for the Spotcat extension page API (window.spotcat).
// Put this file in your extension folder and add `/// <reference path="./spotcat.d.ts" />` at the top of your JS for editor completion.

interface SpotcatEnterAction {
  /** The feature's code from manifest.json */
  code: string;
  /** keyword: entered by keyword; match: entered by content match */
  type: 'keyword' | 'match';
  /** The typed keyword for keyword, or the matched content for match */
  payload: string;
}

interface SpotcatChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface SpotcatChatOpenOptions {
  /** Chat title; defaults to the first question */
  title?: string;
  /** Context sent to the model as the system prompt and shown at the top of the chat */
  context?: { title: string; content: string }[];
  /** Text to prefill the input with */
  prompt?: string;
  /** Send the prompt right away when true */
  send?: boolean;
}

interface SpotcatFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  /** Request body; serialize it yourself (e.g. JSON.stringify) */
  body?: string;
  /** Timeout in milliseconds, 30000 by default */
  timeout?: number;
}

interface SpotcatFetchResponse {
  status: number;
  /** Header names are lowercase */
  headers: Record<string, string>;
  /** Response text (UTF-8) */
  body: string;
}

interface Spotcat {
  /** Called when a feature is entered; fires once right after the page loads */
  onEnter(callback: (action: SpotcatEnterAction) => void): void;

  copyText(text: string): Promise<true>;
  /** Hide the window and keep the extension open (reopening within 90 seconds returns to it) */
  hideWindow(): Promise<true>;
  /** Leave the extension and return to search */
  exit(): Promise<true>;
  /** Open an http(s) page or an x-apple.systempreferences: settings pane */
  openURL(url: string): Promise<true>;
  /** Open Spotcat settings, optionally on a tab (e.g. to set up AI: openSettings('ai')) */
  openSettings(tab?: 'general' | 'profile' | 'ai' | 'about'): Promise<true>;

  /** Request sent by the app, free of CORS. Requires "permissions": ["network"] in manifest.json */
  fetch(url: string, options?: SpotcatFetchOptions): Promise<SpotcatFetchResponse>;

  /** Detect the language; returns a BCP-47 code ('en', 'zh-Hans', 'ja' …) or null */
  detectLanguage(text: string): Promise<string | null>;
  /** Offline system translation (macOS 26+, language packs required). from is detected by default */
  translate(request: { text: string; from?: string; to: string }): Promise<{ text: string; from: string; to: string }>;
  /** Read text aloud; lang is detected when omitted */
  speak(text: string, lang?: string | null): Promise<true>;
  stopSpeaking(): Promise<true>;

  /** Localization: locale is the interface language; t reads locales/<language>.json, {name} is a placeholder */
  i18n: {
    locale: string;
    t(key: string, vars?: Record<string, string | number>): string;
    /** Fill data-i18n / data-i18n-placeholder / data-i18n-title (runs once when the page loads) */
    apply(root?: ParentNode): void;
  };

  /**
   * The AI service configured in Spotcat settings. Requires "permissions": ["ai"] in manifest.json.
   * model is "provider id/model name" (the id returned by info()); the default model is used when omitted or invalid
   */
  ai: {
    info(options?: { model?: string }): Promise<{ configured: boolean; id: string; model: string; provider: string }>;
    /** Resolves with the full reply; with onDelta, deltas are streamed; signal cancels */
    chat(options: { messages: SpotcatChatMessage[]; model?: string; onDelta?: (delta: string) => void; signal?: AbortSignal }): Promise<string>;
  };

  /** Spotcat's built-in AI chat. Esc or the back button in the chat returns to the extension with its state intact */
  chat: {
    open(options?: SpotcatChatOpenOptions): Promise<true>;
  };

  /** Private persistent storage for the extension; values must be JSON-serializable */
  storage: {
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<true>;
    remove(key: string): Promise<true>;
  };
}

declare const spotcat: Spotcat;
interface Window { spotcat: Spotcat; }

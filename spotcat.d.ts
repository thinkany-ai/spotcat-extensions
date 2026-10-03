// Type declarations for the Spotcat extension page API (window.spotcat).
// Put this file in your extension folder and add `/// <reference path="./spotcat.d.ts" />` at the top of your JS for editor completion.

interface SpotcatEnterAction {
  /** The feature's code from manifest.json */
  code: string;
  /** keyword: entered by keyword; match: entered by content match; item: entered from an item passed to search.setItems */
  type: 'keyword' | 'match' | 'item';
  /** The typed keyword for keyword, the matched content for match, or the item id for item */
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

interface SpotcatSearchItem {
  /** Passed back as payload when the item is chosen */
  id: string;
  /** Shown in the result (≤ 200 chars) */
  title: string;
  /** Shown next to the title (≤ 300 chars) */
  subtitle?: string;
  /** Matched but not shown (≤ 5000 chars) */
  text?: string;
  /** Feature to enter; defaults to the first feature */
  code?: string;
}

interface SpotcatClipboardItem {
  id: string;
  type: 'text' | 'image' | 'files';
  /** Milliseconds since 1970 */
  time: number;
  pinned: boolean;
  /** App that was in front when it was copied */
  app?: string;
  /** First 300 characters (text) */
  preview?: string;
  /** Full length (text) */
  length?: number;
  /** Full text, only from get() */
  text?: string;
  /** File paths (files) */
  files?: string[];
  /** [width, height] in pixels (image) */
  size?: [number, number];
  /** Preview image as a data URL, only from get() (image) */
  image?: string;
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

  /** Put text on the clipboard, hide Spotcat and paste into the front app. Resolves false without Accessibility access (the text is still copied). Spotcat 0.5.0+ */
  paste(text: string): Promise<boolean>;

  /** Searchable content shown in the main search box; entering from it passes type 'item'. Spotcat 0.5.0+ (check spotcat.search exists) */
  search?: {
    /** Replaces everything set before (at most 2000 items); [] clears */
    setItems(items: SpotcatSearchItem[]): Promise<true>;
  };

  /** Clipboard history recorded by Spotcat. Requires "permissions": ["clipboard"]. Spotcat 0.5.0+ */
  clipboard: {
    /** Pinned items first, then newest first */
    list(options?: { query?: string; limit?: number }): Promise<SpotcatClipboardItem[]>;
    get(id: string): Promise<SpotcatClipboardItem>;
    /** Small preview image as a data URL (image items) */
    thumbnail(id: string): Promise<string | null>;
    copy(id: string): Promise<boolean>;
    /** Copy, hide Spotcat and paste into the front app; false without Accessibility access */
    paste(id: string): Promise<boolean>;
    pin(id: string, pinned?: boolean): Promise<true>;
    remove(id: string): Promise<true>;
    /** Removes everything except pinned items */
    clear(): Promise<true>;
    /** Whether Spotcat is recording (the built-in Clipboard extension is enabled) */
    status(): Promise<{ recording: boolean }>;
    /** Called when something new is copied or an item changes */
    onChange(callback: () => void): void;
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

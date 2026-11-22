import { useEffect, useState } from "react";

export type Lang = "en" | "bn";

const KEY = "gateway.lang";
const EVENT = "gateway:lang";

export const STRINGS: Record<string, { en: string; bn: string }> = {
  nav_home: { en: "Home", bn: "হোম" },
  nav_sites: { en: "Supported Sites", bn: "সাপোর্টেড সাইট" },
  nav_how: { en: "How It Works", bn: "কীভাবে কাজ করে" },
  nav_faq: { en: "FAQ", bn: "সাধারণ প্রশ্ন" },
  nav_history: { en: "History", bn: "হিস্টোরি" },
  input_placeholder: { en: "Paste video link here...", bn: "ভিডিও লিংক এখানে পেস্ট করুন…" },
  btn_download: { en: "Download", bn: "ডাউনলোড" },
  busy_checking: { en: "Checking…", bn: "চেক করা হচ্ছে…" },
  busy_starting: { en: "Starting…", bn: "শুরু হচ্ছে…" },
  busy_downloading: { en: "Downloading…", bn: "ডাউনলোড হচ্ছে…" },
  busy_saving: { en: "Saving…", bn: "সেভ হচ্ছে…" },
  label_quality: { en: "Video quality", bn: "ভিডিও কোয়ালিটি" },
  label_audio: { en: "Audio", bn: "অডিও" },
  chip_audio: { en: "Audio only (MP3/M4A)", bn: "শুধু অডিও (MP3/M4A)" },
  chip_best: { en: "Best available", bn: "সেরা কোয়ালিটি" },
  cta_best: { en: "Download best quality", bn: "সেরা কোয়ালিটিতে ডাউনলোড" },
  cta_audio: { en: "Download audio", bn: "অডিও ডাউনলোড" },
  done_saved: { en: "Saved to your device", bn: "ডিভাইসে সেভ হয়েছে" },
  label_advanced: { en: "Advanced options", bn: "অ্যাডভান্সড অপশন" },
  cookies_hint: {
    en: "Paste cookies (Netscape format) to access private or age-restricted videos. Cookies are used for this download only and are never stored on the server.",
    bn: "প্রাইভেট বা এজ-রেস্ট্রিক্টেড ভিডিওর জন্য কুকি (Netscape ফরম্যাট) পেস্ট করুন। এই ডাউনলোডের জন্যেই ব্যবহার হবে, সার্ভারে কখনো জমা থাকবে না।",
  },
};

export function getLang(): Lang {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(KEY) === "bn" ? "bn" : "en";
}

export function setLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, lang);
  window.dispatchEvent(new Event(EVENT));
}

export function tt(lang: Lang, key: string): string {
  const entry = STRINGS[key];
  return entry ? entry[lang] : key;
}

const LANG_EVENT = "gateway:lang";

export function useLang(): Lang {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    setLangState(getLang());
    const onChange = () => setLangState(getLang());
    window.addEventListener(LANG_EVENT, onChange);
    return () => window.removeEventListener(LANG_EVENT, onChange);
  }, []);
  return lang;
}

"use client";

import { Maximize2, Minus, X } from "lucide-react";
import { PointerEvent, useEffect, useState } from "react";

type WebViewWindow = Window & {
  chrome?: {
    webview?: {
      postMessage: (message: unknown) => void;
    };
  };
};

function postNative(action: "drag" | "minimize" | "maximize" | "close") {
  const nativeWindow = window as WebViewWindow;
  nativeWindow.chrome?.webview?.postMessage({ source: "lsearch-titlebar", action });
}

export default function NativeTitlebar() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const nativeWindow = window as WebViewWindow;
    const isNative = Boolean(nativeWindow.chrome?.webview);
    setEnabled(isNative);
    document.documentElement.classList.toggle("native-host", isNative);
    return () => document.documentElement.classList.remove("native-host");
  }, []);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    postNative("drag");
  }

  if (!enabled) return null;

  return (
    <div className="native-titlebar">
      <div className="native-titlebar-drag" onPointerDown={startDrag}>
        <div className="native-titlebar-brand">
          <span>LS</span>
          <strong>LSearch</strong>
        </div>
      </div>
      <div className="native-titlebar-actions">
        <button type="button" aria-label="Minimiser" onClick={() => postNative("minimize")}>
          <Minus size={15} />
        </button>
        <button type="button" aria-label="Agrandir" onClick={() => postNative("maximize")}>
          <Maximize2 size={14} />
        </button>
        <button type="button" aria-label="Fermer" className="close" onClick={() => postNative("close")}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  generateGeminiContent,
  isGeminiConfigured,
  type GeminiChatMessage,
} from "../services/geminiService";

type DisplayMessage = GeminiChatMessage & { id: string };

export default function GlobalAiChat() {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setConfigured(isGeminiConfigured());
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const send = async () => {
    const prompt = text.trim();
    if (!prompt || sending) return;
    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: prompt,
    };
    const prior = messages.map(({ role, text: content }) => ({ role, text: content }));
    setMessages((current) => [...current, userMessage]);
    setText("");
    setError("");
    setSending(true);
    try {
      const response = await generateGeminiContent(
        `LPIC-1 101の学習支援として日本語で簡潔かつ正確に回答してください。不確かな内容は断定しないでください。\n\n質問: ${prompt}`,
        { history: prior },
      );
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "model", text: response },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AIへの送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="global-ai-button"
        aria-label="AIチャットを開く"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">AI</span>
      </button>
      {open && (
        <section className="global-ai-panel" role="dialog" aria-modal="false" aria-labelledby="global-ai-title">
          <div className="global-ai-heading">
            <div>
              <span>Gemini</span>
              <strong id="global-ai-title">学習AIチャット</strong>
            </div>
            <button type="button" aria-label="AIチャットを閉じる" onClick={() => setOpen(false)}>×</button>
          </div>
          {!configured ? (
            <div className="ai-empty-state">
              <p>Gemini APIキーが未設定です。</p>
              <small>「その他」→「設定」→「Gemini API連携」で接続テスト後に保存してください。</small>
            </div>
          ) : (
            <>
              <div className="global-ai-messages" aria-live="polite">
                {messages.length === 0 && (
                  <div className="ai-empty-state">
                    <p>LPICの疑問をそのまま入力できます。</p>
                    <small>会話履歴はこの画面を開いている間だけ保持します。</small>
                  </div>
                )}
                {messages.map((message) => (
                  <article key={message.id} className={`ai-message is-${message.role}`}>
                    <span>{message.role === "user" ? "あなた" : "Gemini"}</span>
                    <p>{message.text}</p>
                  </article>
                ))}
                {sending && <div className="ai-typing" role="status">Geminiが回答を作成しています...</div>}
              </div>
              <label className="global-ai-input">
                <span>質問</span>
                <textarea
                  ref={inputRef}
                  rows={3}
                  value={text}
                  maxLength={8000}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void send();
                  }}
                  placeholder="例: systemdのtargetとSysVinitのrunlevelの対応を整理して"
                />
              </label>
              <button type="button" className="primary-button" disabled={sending || !text.trim()} onClick={() => void send()}>
                AIへ送信
              </button>
              {error && <div className="error-box" role="alert">{error}</div>}
            </>
          )}
        </section>
      )}
    </>
  );
}


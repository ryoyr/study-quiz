import { useState } from "react";
import {
  clearGeminiSettings,
  loadGeminiSettings,
  saveGeminiSettings,
  testGeminiConnection,
} from "../services/geminiService";

export default function GeminiSettingsSection() {
  const [draft, setDraft] = useState(loadGeminiSettings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const save = () => {
    try {
      saveGeminiSettings(draft);
      setError("");
      setMessage("Gemini設定をこの端末へ保存しました。");
    } catch (cause) {
      setMessage("");
      setError(cause instanceof Error ? cause.message : "設定を保存できませんでした。");
    }
  };

  const test = async () => {
    if (testing) return;
    setTesting(true);
    setMessage("");
    setError("");
    try {
      await testGeminiConnection(draft);
      setMessage("接続テストに成功しました。設定を保存してください。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "接続テストに失敗しました。");
    } finally {
      setTesting(false);
    }
  };

  const clear = () => {
    clearGeminiSettings();
    setDraft({ ...draft, apiKey: "" });
    setError("");
    setMessage("保存済みAPIキーをこの端末から削除しました。");
  };

  return (
    <section className="gemini-settings" aria-labelledby="gemini-settings-title">
      <div className="gemini-settings-heading">
        <div>
          <span className="gemini-badge">AI</span>
          <h2 id="gemini-settings-title">Gemini API連携</h2>
        </div>
        <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">
          APIキーを取得
        </a>
      </div>
      <p className="security-note">
        APIキーはこの端末のブラウザ内だけに保存し、バックアップには含めません。共有端末では保存しないでください。公開Webアプリでのクライアント保存には漏えいリスクがあるため、本番運用ではバックエンドプロキシを推奨します。
      </p>
      <div className="form-grid compact-form-grid">
        <label className="form-item">
          <span>Gemini APIキー</span>
          <div className="secret-input-row">
            <input
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={draft.apiKey}
              onChange={(event) =>
                setDraft({ ...draft, apiKey: event.target.value })
              }
              placeholder="Google AI Studioで発行したキー"
            />
            <button type="button" onClick={() => setShowKey(!showKey)}>
              {showKey ? "隠す" : "表示"}
            </button>
          </div>
        </label>
        <label className="form-item">
          <span>モデル</span>
          <input
            value={draft.model}
            onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            placeholder="gemini-3.8-flash"
            spellCheck={false}
          />
          <small>利用可能なモデル名に変更できます。</small>
        </label>
      </div>
      <div className="gemini-settings-actions">
        <button type="button" className="secondary-button" disabled={testing || !draft.apiKey.trim()} onClick={() => void test()}>
          {testing ? "接続確認中..." : "接続テスト"}
        </button>
        <button type="button" className="primary-button" disabled={testing || !draft.apiKey.trim()} onClick={save}>
          API設定を保存
        </button>
        <button type="button" className="danger-text-button" disabled={testing || !loadGeminiSettings().apiKey} onClick={clear}>
          保存済みキーを削除
        </button>
      </div>
      {message && <div className="backup-success" role="status">{message}</div>}
      {error && <div className="error-box" role="alert">{error}</div>}
    </section>
  );
}


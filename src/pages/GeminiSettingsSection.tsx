
import { useState } from 'react';
import { deleteGeminiApiKey, loadGeminiApiKey, loadGeminiModel, saveGeminiApiKey, saveGeminiModel, testGeminiConnection } from '../services/geminiService';
export default function GeminiSettingsSection() {
  const [key, setKey] = useState(loadGeminiApiKey()); const [model, setModel] = useState(loadGeminiModel()); const [visible, setVisible] = useState(false); const [message, setMessage] = useState(''); const [testing, setTesting] = useState(false);
  const save = () => { saveGeminiApiKey(key); saveGeminiModel(model); setMessage('この端末のブラウザに保存しました。'); };
  const test = async () => { setTesting(true); setMessage(''); try { save(); const result = await testGeminiConnection(key, model); setMessage(`接続成功: ${result}`); } catch (e) { setMessage(e instanceof Error ? `接続失敗: ${e.message}` : '接続に失敗しました。'); } finally { setTesting(false); } };
  return <section className="dense-card gemini-settings"><h2>✦ Gemini設定</h2><p className="security-note">個人利用向けの簡易方式です。APIキーはブラウザのlocalStorageへ保存されます。共有端末では使用しないでください。</p><label>モデル<input value={model} onChange={(e) => setModel(e.target.value)}/></label><label>APIキー<div className="key-row"><input type={visible ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Gemini APIキー"/><button type="button" onClick={() => setVisible(!visible)}>{visible ? '隠す' : '表示'}</button></div></label><div className="action-row"><button type="button" onClick={save}>保存</button><button type="button" onClick={() => { deleteGeminiApiKey(); setKey(''); setMessage('削除しました。'); }}>削除</button><button type="button" disabled={!key.trim() || testing} onClick={() => void test()}>{testing ? '確認中...' : '接続テスト'}</button></div>{message && <div className="connection-message">{message}</div>}</section>;
}

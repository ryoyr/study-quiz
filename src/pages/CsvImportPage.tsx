import { useRef, useState } from "react";
import type { Question } from "../types/Question";
import {
  CSV_TEMPLATE,
  parseQuestionCsv,
  questionsFromPreview,
} from "../services/csvImportService";
import type { CsvParseResult } from "../services/csvImportService";
type Props = {
  existingQuestions: Question[];
  onImport: (questions: Question[]) => boolean;
  onBack: () => void;
};
const MAX_CSV_BYTES = 5 * 1024 * 1024;
export default function CsvImportPage({
  existingQuestions,
  onImport,
  onBack,
}: Props) {
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<CsvParseResult | null>(null);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const read = async (file: File) => {
    setMessage("");
    setFileName(file.name);
    try {
      if (file.size > MAX_CSV_BYTES) {
        throw new Error("CSVファイルは5MB以下にしてください。");
      }
      setResult(parseQuestionCsv(await file.text(), existingQuestions));
    } catch (error) {
      setResult({
        headers: [],
        rows: [],
        fatalErrors: [
          error instanceof Error
            ? error.message
            : "ファイルを読み取れませんでした。",
        ],
        validCount: 0,
        warningCount: 0,
        errorCount: 0,
      });
    }
  };
  const register = () => {
    if (!result) return;
    const targets = questionsFromPreview(result);
    if (!targets.length) return;
    if (!onImport(targets)) {
      setMessage("保存できませんでした。端末の空き容量を確認してください。");
      return;
    }
    setMessage(`${targets.length}件を登録しました。`);
    setResult(null);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };
  const template = () => {
    const blob = new Blob(["\uFEFF" + CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "study-quiz-question-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <main className="app-shell">
      <section className="home-card csv-card">
        <p className="eyebrow">CSV IMPORT</p>
        <h1>問題CSV一括登録</h1>
        <div className="csv-help">
          <strong>必須列</strong>
          <code>id, category, text, choice1, choice2, answer</code>
          <p>
            answerは1開始の選択肢番号です。UTF-8（BOMあり・なし）に対応します。
          </p>
        </div>
        <button className="template-button" type="button" onClick={template}>
          CSVテンプレートを出力
        </button>
        <input
          ref={inputRef}
          type="file"
          aria-label="取り込む問題CSV"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void read(file);
          }}
        />
        {fileName && <p className="selected-file">選択中: {fileName}</p>}
        {result && (
          <>
            <div className="csv-summary">
              <article>
                <span>正常</span>
                <strong>{result.validCount}</strong>
              </article>
              <article>
                <span>警告</span>
                <strong>{result.warningCount}</strong>
              </article>
              <article>
                <span>エラー</span>
                <strong>{result.errorCount}</strong>
              </article>
            </div>
            {result.fatalErrors.map((error) => (
              <div className="error-box" role="alert" key={error}>
                {error}
              </div>
            ))}
            {result.rows.length > 0 && (
              <div className="csv-preview">
                <table>
                  <thead>
                    <tr>
                      <th>行</th>
                      <th>状態</th>
                      <th>ID</th>
                      <th>カテゴリ</th>
                      <th>問題文</th>
                      <th>メッセージ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.rowNumber} className={`csv-${row.status}`}>
                        <td>{row.rowNumber}</td>
                        <td>
                          {row.status === "valid"
                            ? "正常"
                            : row.status === "warning"
                              ? "警告"
                              : "エラー"}
                        </td>
                        <td>{row.question?.id ?? "-"}</td>
                        <td>{row.question?.category ?? "-"}</td>
                        <td>{row.question?.text ?? "-"}</td>
                        <td>{row.messages.join(" / ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              className="primary-button"
              type="button"
              disabled={
                questionsFromPreview(result).length === 0 ||
                result.fatalErrors.length > 0
              }
              onClick={register}
            >
              正常・警告行を登録（{questionsFromPreview(result).length}件）
            </button>
          </>
        )}
        {message && (
          <div className="backup-success" role="status">
            {message}
          </div>
        )}
        <button className="secondary-button" type="button" onClick={onBack}>
          問題管理へ戻る
        </button>
      </section>
    </main>
  );
}


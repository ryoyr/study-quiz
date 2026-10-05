import type { AiPromptTemplate } from "../types/AiPromptTemplate";
const KEY = "study-quiz-ai-prompt-templates-v1";
const BUILT_INS: AiPromptTemplate[] = [
  {
    id: "builtin-understand",
    name: "理解を深める",
    description: "正解理由と誤選択肢の違いを確認",
    template:
      "次の問題について、正解理由、各誤選択肢が誤りである理由、重要用語を説明してください。\n\n{{questionContext}}",
    builtIn: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "builtin-exam",
    name: "試験対策",
    description: "本番での見分け方と頻出ポイント",
    template:
      "次の問題について、試験で問われやすいポイント、選択肢の見分け方、覚え方を整理してください。\n\n{{questionContext}}",
    builtIn: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "builtin-deep",
    name: "深掘り",
    description: "周辺知識と関連コマンドを確認",
    template:
      "次の問題のテーマを深掘りし、関連する仕組み、コマンド例、注意点を説明してください。\n\n{{questionContext}}",
    builtIn: true,
    createdAt: "",
    updatedAt: "",
  },
];
export const loadAiPromptTemplates = (): AiPromptTemplate[] => {
  try {
    const value = JSON.parse(
      localStorage.getItem(KEY) ?? "[]",
    ) as AiPromptTemplate[];
    return [
      ...BUILT_INS,
      ...(Array.isArray(value) ? value.filter((item) => !item.builtIn) : []),
    ];
  } catch {
    return [...BUILT_INS];
  }
};
export const saveAiPromptTemplates = (items: AiPromptTemplate[]) =>
  localStorage.setItem(
    KEY,
    JSON.stringify(items.filter((item) => !item.builtIn)),
  );
export const upsertAiPromptTemplate = (
  items: AiPromptTemplate[],
  input: Pick<AiPromptTemplate, "id" | "name" | "description" | "template">,
): AiPromptTemplate[] => {
  const now = new Date().toISOString();
  const prev = items.find((item) => item.id === input.id);
  const next: AiPromptTemplate = {
    ...input,
    id: input.id || crypto.randomUUID(),
    builtIn: false,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
  const result = [...items.filter((item) => item.id !== next.id), next];
  return result;
};
export const deleteAiPromptTemplate = (
  items: AiPromptTemplate[],
  id: string,
): AiPromptTemplate[] => {
  const result = items.filter((item) => item.id !== id || item.builtIn);
  return result;
};

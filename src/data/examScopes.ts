import { LPIC101_EXAM_SCOPE_ID, type ExamScope } from "../types/ExamScope";

const catalogTimestamp = "2026-10-06T00:00:00.000Z";

/**
 * 初期配布する試験枠。既定問題はLPIC以外を含めない。
 * 将来別試験を追加する場合も、問題カテゴリではなくこの試験枠で分離する。
 */
export const defaultExamScopes: ExamScope[] = [
  {
    id: LPIC101_EXAM_SCOPE_ID,
    certification: "LPIC-1",
    name: "LPIC-1 Exam 101",
    examCode: "101-500",
    version: "5.0",
    description: "システムアーキテクチャ、Linuxのインストールとパッケージ管理、GNU/Unixコマンド、デバイスとファイルシステム",
    active: true,
    sortOrder: 10,
    createdAt: catalogTimestamp,
    updatedAt: catalogTimestamp,
  },
];


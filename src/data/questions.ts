

import type { Question } from "../types/Question";

export const questions: Question[] = [
  {
    id: "PWA-001",
    category: "PWA",

    text:
      "PWAでオフライン動作を実現する中心的な仕組みはどれですか？",

    choices: [
      "Service Worker",
      "DOM",
      "CSS Grid",
      "WebSocket",
    ],

    answerIndex: 0,

    explanation:
      "Service Workerがネットワークリクエストを制御します。",

    weight: 5,

    difficulty: 2,
  },

  {
    id: "REACT-001",
    category: "React",

    text:
      "Reactで状態管理を行う基本的なHookはどれですか？",

    choices: [
      "useMemo",
      "useEffect",
      "useState",
      "useRef",
    ],

    answerIndex: 2,

    explanation:
      "useStateでコンポーネント状態を保持します。",

    weight: 3,

    difficulty: 2,
  },

  {
    id: "TS-001",
    category: "TypeScript",

    text:
      "型定義を行う際に利用するものはどれですか？",

    choices: [
      "interface",
      "while",
      "switch",
      "continue",
    ],

    answerIndex: 0,

    explanation:
      "interfaceで型定義ができます。",

    weight: 4,

    difficulty: 3,
  },
];

import type { Question } from '../types/Question'

export const questions: Question[] = [
  {
    id: 'PWA-001',
    category: 'PWA基礎',
    text: 'PWAでオフライン動作を実現する中心的な仕組みはどれですか？',
    choices: ['Service Worker', 'DOM', 'CSS Grid', 'WebSocket'],
    answerIndex: 0,
    explanation: 'Service Workerがネットワークリクエストを制御し、必要なファイルをキャッシュします。',
  },
  {
    id: 'PWA-002',
    category: 'PWA基礎',
    text: 'PWAのアプリ名や表示形式、アイコンなどを定義するファイルはどれですか？',
    choices: ['package.json', 'Web App Manifest', 'tsconfig.json', 'robots.txt'],
    answerIndex: 1,
    explanation: 'Web App Manifestにname、icons、display、theme_colorなどを定義します。',
  },
  {
    id: 'REACT-001',
    category: 'React',
    text: 'Reactでコンポーネントの状態を管理する基本的なフックはどれですか？',
    choices: ['useMemo', 'useState', 'useEffect', 'useRef'],
    answerIndex: 1,
    explanation: 'useStateはコンポーネント内の状態と、その更新関数を提供します。',
  },
  {
    id: 'TS-001',
    category: 'TypeScript',
    text: 'TypeScriptでオブジェクトの構造を定義する用途に適したものはどれですか？',
    choices: ['interface', 'switch', 'await', 'namespace only'],
    answerIndex: 0,
    explanation: 'interfaceを使用すると、プロパティ名や型を持つオブジェクト構造を定義できます。',
  },
  {
    id: 'DB-001',
    category: 'ローカル保存',
    text: 'ブラウザー内で大量の構造化データを保存する用途に適しているものはどれですか？',
    choices: ['Cookie', 'IndexedDB', 'URL hash', 'Session History'],
    answerIndex: 1,
    explanation: 'IndexedDBはブラウザー内で構造化データを扱える非同期データベースです。',
  },
]

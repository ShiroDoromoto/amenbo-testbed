import { render } from 'preact';
import './styles/tokens.css';
import { App } from './app/App.tsx';
import { runStartupTasks } from './app/startup.ts';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つからない');

// 定期取引から作った取引を一覧に出すため、作り終えてから描く。失敗しても画面は出す。
void runStartupTasks()
  .catch((error: unknown) => console.error('起動時の処理に失敗しました', error))
  .finally(() => render(<App />, root));

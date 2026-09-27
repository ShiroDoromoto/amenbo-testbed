import { render } from 'preact';
import { App } from './app/App.tsx';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つからない');

render(<App />, root);

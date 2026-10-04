import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

registerSW({ immediate: true });

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

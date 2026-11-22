import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import { SpikeScreen } from './screens/SpikeScreen';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpikeScreen />
  </StrictMode>,
);

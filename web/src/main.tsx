import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AvatarMotionLab from './components/AvatarMotionLab';
import './index.css';
import './components/DesignRefinements.css';
import './components/UserConfigModal.css';
import './components/StatusTimeline.css';

const isMotionLab = window.location.hash === '#motion-lab';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isMotionLab ? <AvatarMotionLab /> : <App />}
  </React.StrictMode>
);

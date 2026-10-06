import React from 'react';
import { createRoot } from 'react-dom/client';
import WorkshopApp from '@/components/workshop/workshop';
import '@/app/globals.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><WorkshopApp /></React.StrictMode>,
);

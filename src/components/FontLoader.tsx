import React, { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap';

export const FontLoader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender('Loading Arabic & Latin veterinary fonts'));

  useEffect(() => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        continueRender(handle);
      }
    };

    const existing = document.querySelector(`link[href="${GOOGLE_FONTS_URL}"]`);
    if (!existing) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = GOOGLE_FONTS_URL;
      document.head.appendChild(link);
    }

    const timeout = setTimeout(finish, 4500);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        clearTimeout(timeout);
        finish();
      });
    } else {
      clearTimeout(timeout);
      finish();
    }

    return () => clearTimeout(timeout);
  }, [handle]);

  return <>{children}</>;
};

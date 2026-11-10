// Botón «Instalar app». Chrome (Android, también ordenador) avisa con el evento `beforeinstallprompt` cuando
// la web se puede instalar; lo guardamos para lanzar el diálogo de instalación al pulsar el botón.
// En iPhone no existe ese evento: allí se instala con Compartir › «Añadir a pantalla de inicio».
import { useEffect, useState } from 'react';

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(Boolean(deferred)));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // sin el aviso automático de Chrome: se instala desde nuestro botón
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** ¿Ya se está usando como app instalada (sin barra del navegador)? */
export const isInstalled = () => typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

/** { canInstall, install }: canInstall solo es true cuando el navegador permite instalar ahora mismo. */
export function useInstallApp() {
  const [canInstall, setCanInstall] = useState(Boolean(deferred));
  useEffect(() => {
    listeners.add(setCanInstall);
    return () => listeners.delete(setCanInstall);
  }, []);
  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    notify();
  }
  return { canInstall: canInstall && !isInstalled(), install };
}

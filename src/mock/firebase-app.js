// Sustituto de 'firebase/app' para el modo demo.
export function initializeApp(config, name = '[DEFAULT]') {
  return { name, options: config };
}
export async function deleteApp() {}

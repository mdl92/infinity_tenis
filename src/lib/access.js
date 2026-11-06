// Acceso con nombre + contraseña automática.
//
// Firebase Auth necesita un email, así que cada jugador tiene uno interno que nunca ve ni recibe correos:
//   «Laura Martín»  →  usuario «laura-martin»  →  laura-martin@jugadores-infinity.example.com
// La contraseña automática es la primera letra del nombre + el primer apellido, sin tildes ni espacios:
//   «Laura» + «Martín»  →  «lmartin»
// Firebase exige al menos 6 caracteres, así que a lo que escribe el jugador se le añade un sufijo fijo
// antes de enviarlo («agil» → «agil-infinity»). El jugador nunca lo ve.

// example.com es un dominio reservado: no pertenece a nadie y nunca recibirá correo
export const AUTH_DOMAIN = 'jugadores-infinity.example.com';
const SUFFIX = '-infinity';

/** Minúsculas, sin tildes y con guiones en lugar de espacios: «Martín  Pérez» → «martin-perez». */
export function slugify(text = '') {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Usuario con el que se identifica: nombre + primer apellido. */
export const usernameOf = (firstName, lastName) => slugify(`${firstName} ${lastName}`);

export const emailFor = (username) => `${username}@${AUTH_DOMAIN}`;

/** Contraseña automática: primera letra del nombre + primer apellido. */
export function initialPassword(firstName, lastName) {
  const first = slugify(firstName).replace(/-/g, '');
  const last = slugify(lastName).replace(/-/g, '');
  return `${first.charAt(0)}${last}`;
}

/*
 * Si el admin corrige el nombre de alguien, su cuenta de Firebase (email interno y contraseña) no se puede
 * cambiar desde la web. Por eso cada perfil guarda con qué datos se creó la cuenta:
 *   authUsername                → usuario del email interno (no cambia)
 *   authFirstName/authLastName  → nombre con el que se generó la contraseña (no cambia)
 * y `username` es el nombre con el que entra ahora. Al iniciar sesión se busca por `username`.
 */
export const authUsernameOf = (u) => u.authUsername ?? u.username;

/** Contraseña automática de un usuario (la del nombre con el que se le dio de alta). */
export const passwordOf = (u) => initialPassword(u.authFirstName ?? u.firstName, u.authLastName ?? u.lastName);

/** Lo que se envía a Firebase a partir de lo que escribe el jugador. */
export const authPassword = (typed) => `${typed.trim().toLowerCase()}${SUFFIX}`;

/** Usuarios posibles a partir de lo que se escribe en «Nombre» (también si pone el segundo apellido). */
export function loginKeys(identifier) {
  const slug = slugify(identifier.trim());
  const parts = slug.split('-').filter(Boolean);
  const keys = [slug];
  if (parts.length > 2) keys.push(parts.slice(0, 2).join('-'));
  return keys;
}

/**
 * Formas de iniciar sesión a partir de lo que se escribe en «Nombre»:
 * - con @: es un email real (la cuenta del primer administrador, creada a mano) y la contraseña va tal cual;
 * - si no: nombre y primer apellido. `accounts` son las cuentas encontradas para ese nombre en los perfiles
 *   (por si se le cambió el nombre); si no hay, se prueba directamente con el nombre escrito.
 */
export function loginAttempts(identifier, password, accounts = []) {
  const id = identifier.trim();
  if (id.includes('@')) return [{ email: id.toLowerCase(), password }];
  const keys = [...new Set([...accounts, ...loginKeys(id)])];
  return keys.map((k) => ({ email: emailFor(k), password: authPassword(password) }));
}

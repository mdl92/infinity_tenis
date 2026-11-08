# Infinity · Torneo de tenis

React (Vite) + Firebase (Auth + Firestore), desplegado en GitHub Pages.

## Qué hace

- **Admin**: da de alta usuarios (jugadores o admins), crea torneos → categorías → grupos, mete jugadores en los grupos, crea partidos (uno a uno o "todos contra todos") y puede editar o borrar cualquier resultado.
- **Jugador**: inicia sesión, ve todo en modo lectura y en sus propios partidos puede:
  - **añadir el resultado** si el partido está *Por jugar* → pasa a *Falta confirmar*;
  - **confirmar** o **rechazar** el resultado que haya enviado el rival → *Confirmado* o vuelta a *Por jugar*.
- **Acceso**: todo está en una sola pantalla: una franja arriba para identificarse y cartas desplegables (Mis partidos, cada categoría con sus grupos, Resultados); los partidos se despliegan ahí mismo para apuntar o confirmar el resultado; categorías, grupos y resultados se ven sin entrar; *Inicio*, *Mis partidos* y la administración exigen haber entrado. No hay registro: **solo el admin da de alta** (*Administración › Jugadores*).
  - Cada persona entra con su **nombre y primer apellido** (sin importar mayúsculas ni tildes) y una **contraseña automática**: inicial del nombre + primer apellido (Laura Martín → `lmartin`).
  - Por dentro, Firebase usa un email interno que nadie ve (`laura-martin@jugadores-infinity.example.com`) y a la contraseña se le añade un sufijo fijo, porque Firebase exige 6 caracteres. Todo está en `src/lib/access.js`.
  - ⚠️ Como la contraseña sale del nombre, cualquiera que conozca el nombre de un jugador puede entrar como él. Es aceptable para un torneo entre conocidos; si no, conviene añadir un cambio de contraseña en el primer acceso.
- **Tipo de torneo por categoría**: al crear una categoría se elige *Torneo de grupos* (todos contra todos con clasificación) o *Eliminatoria* (cuadro por rondas). Solo se puede cambiar mientras la categoría está vacía.
- **Eliminatoria**: el admin añade los jugadores y sortea el cuadro **al azar** o **por cabezas de serie** (en el orden de la lista: el 1.º y el 2.º solo se cruzan en la final). Si el número de jugadores no es potencia de 2, los mejores cabezas de serie *pasan directo* a la segunda ronda. Al confirmarse un partido, el ganador pasa solo a la siguiente ronda; *Rehacer sorteo* borra el cuadro y deja los jugadores. La lógica está en `src/lib/bracket.js`.
- **Discrepancias**: si el rival rechaza un resultado, el partido vuelve a *Por jugar* y queda marcado (`disputedBy`, `disputedSets`) para que se vea el aviso.
- **Formato del partido**: al mejor de 3 sets (6-0…6-4, 7-5 o 7-6). Un 7-6 lleva los puntos de su tie-break (se ven en pequeño junto a los juegos). Si quedan 1-1, los jugadores eligen al apuntar el resultado si jugaron un tercer set o un súper tie-break a 10 (según el tiempo y lo que prefieran). Las reglas están en `validateSets` (`src/lib/tennis.js`).
- Clasificación por grupo calculada con los partidos confirmados, por puntos: victoria 3, derrota ganando un set 1, derrota sin ganar ningún set 0 (`POINTS` en `src/lib/tennis.js`). Desempate por dif. sets y dif. juegos.

Los permisos no dependen solo de la interfaz: los fuerza `firestore.rules` en el servidor. Los jugadores solo pueden crear un partido: el de la ronda siguiente de una eliminatoria, y las reglas comprueban que sus dos jugadores son los ganadores confirmados de los partidos anteriores.

## Puesta en marcha

### 1. Firebase
1. Crea un proyecto en <https://console.firebase.google.com>.
2. **Authentication → Sign-in method** → activa *Correo electrónico/contraseña*.
3. **Firestore Database** → crear base de datos (modo producción).
4. **Firestore → Reglas** → pega el contenido de `firestore.rules` y publica.
5. **Configuración del proyecto → Tus apps → Web** → registra una app y copia la config.

### 2. Variables de entorno
```bash
cp .env.example .env   # y rellena los valores de la config
```
> La config web de Firebase no es secreta (acaba en el JS público); la seguridad la dan las reglas.

### 3. Crear el primer administrador (una sola vez, a mano)
1. **Authentication → Usuarios → Añadir usuario** con tu email real y una contraseña. Copia el **UID**.
2. **Firestore → Iniciar colección** `users` → ID del documento = ese UID, con los campos:
   - `name` (string): tu nombre
   - `role` (string): `admin`
3. Entra en la web escribiendo **tu email** en el campo del nombre y tu contraseña (si el campo lleva `@`, se usa como email tal cual).

A partir de ahí, el resto de usuarios se dan de alta desde la propia web (*Administración › Jugadores*) y entran con su nombre.

### 4. Desarrollo
```bash
npm install
npm run dev
```

### 5. Publicar en GitHub Pages
1. Sube el proyecto a un repo (p. ej. `torneo-tenis`) y cambia `homepage` en `package.json` por tu URL.
2. `npm run deploy` (compila y sube `dist/` a la rama `gh-pages`).
3. En GitHub: **Settings → Pages → Branch: `gh-pages`**.
4. En Firebase: **Authentication → Configuración → Dominios autorizados** → añade `TU-USUARIO.github.io`.

Se usa `HashRouter` (URLs con `#/`) para que recargar cualquier página funcione en GitHub Pages.

## Modelo de datos (Firestore)

| Colección     | Campos principales |
|---------------|--------------------|
| `users/{uid}` | `name`, `firstName`, `lastName`, `secondLastName`, `username` (nombre + primer apellido, p. ej. `laura-martin`), `authUsername`, `authFirstName`, `authLastName` (con qué se creó la cuenta de acceso), `role` (`admin` \| `player`) |
| `tournaments` | `name` |
| `categories`  | `tournamentId`, `name`, `format` (`groups` \| `knockout`) |
| `categories` (eliminatoria) | además: `format: 'knockout'`, `playerIds[]` (por orden de cabeza de serie), `drawn`, `drawSize`, `rounds` |
| `groups`      | `tournamentId`, `categoryId`, `name`, `playerIds[]` |
| `matches`     | `tournamentId`, `categoryId`, `groupId`, `player1Id`, `player2Id`, `status` (`pending` \| `reported` \| `confirmed`), `sets[{a,b,ta?,tb?}]` (2 o 3 sets; el tercero es `{a,b,super:true}` si fue súper tie-break), `winnerId`, `reportedBy`, `confirmedBy`, `disputedBy`, `disputedSets`. En la eliminatoria, ID fijo `ko_<categoría>_<ronda>_<posición>` y además `round`, `slot`, `rounds` (y `bye: true` si pasa directo) |

## Notas

- **Alta de usuarios desde el cliente**: Firebase inicia sesión automáticamente con la cuenta recién creada, así que se crea en una instancia secundaria de la app (`createAuthAccount` en `src/firebase.js`) para no cerrar la sesión del admin.
- **Editar usuarios** (*Administración › Jugadores › Editar*): nombre, apellidos y rol. Desde la web no se puede cambiar la cuenta de Firebase de otra persona, así que si se cambia el nombre o el primer apellido, el perfil guarda con qué datos se creó la cuenta (`authUsername`, `authFirstName`, `authLastName`): el jugador entra con el nombre nuevo (al iniciar sesión se busca por `username`) y **con la misma contraseña de siempre**.
- **Dar de baja** borra el perfil y lo quita de sus grupos (ya no puede entrar); los partidos cuyo rival también estaba dado de baja se borran, pero la cuenta de Auth sigue existiendo; bórrala en la consola si quieres liberar el email.
- **Enlace de acceso**: el botón *Enviar enlace de acceso* usa el email de restablecer contraseña de Firebase, así que ya puedes dar de alta con una contraseña cualquiera y que el jugador ponga la suya. Si más adelante quieres enlaces sin contraseña, mira *Email link sign-in* de Firebase Auth.
- Lectura pública (para que se vean categorías, grupos y resultados sin entrar). Si prefieres que solo lo vean quienes han entrado, cambia `allow read: if true;` por `allow read: if signedIn();`.

# Google Kalender verbinden

Diese Anleitung beschreibt, wie du die **EMS-App** mit einem Google-Kalender verknüpfst. Ausleihen werden dann (optional) als **ganztägige Termine** in den gewählten Kalender geschrieben, aktualisiert oder bei Storno wieder entfernt.

Nur **Administratoren** können die Verbindung herstellen und die Synchronisation aktivieren.

---

## 1. Voraussetzungen

- Ein Google-Konto, das auf den **Zielkalender** schreiben darf (z. B. dein persönlicher Kalender oder ein geteilter Gruppenkalender).
- Zugriff auf die **Google Cloud Console** für dein Projekt (oder du legst ein neues Projekt an).
- Auf dem Server bzw. deinem Rechner eine **`.env`** (oder gleichwertige Konfiguration) mit den unten genannten Variablen.

---

## 2. Google Cloud einrichten

### 2.1 Projekt und API

1. Öffne [Google Cloud Console](https://console.cloud.google.com/) und wähle oder erstelle ein **Projekt**.
2. Unter **APIs & Dienste** → **Bibliothek** die **Google Calendar API** suchen und **aktivieren**.

### 2.2 OAuth-Zustimmungsbildschirm

1. **APIs & Dienste** → **Zustimmungsbildschirm für OAuth**.
2. Nutzertyp je nach Anwendungsfall wählen (häufig **Extern** für interne Tools mit klarer Testerliste).
3. App-Name, Support-E-Mail und ggf. **Testnutzer** eintragen (solange die App im Testmodus ist, müssen Google-Konten der Tester explizit eingetragen sein).
4. Beim Schritt **Bereiche (Scopes)** den Bereich hinzufügen:

   `https://www.googleapis.com/auth/calendar.events`

   Damit darf die App Termine im Kalender anlegen, bearbeiten und löschen – nicht mehr.

### 2.3 OAuth-Client (Webanwendung)

1. **APIs & Dienste** → **Anmeldedaten** → **Anmeldedaten erstellen** → **OAuth-Client-ID** → Typ **Webanwendung**.
2. Unter **Autorisierte Weiterleitungs-URIs** **genau** die Callback-URL eintragen, die deine App verwendet:

   **Lokal:**

   `http://localhost:3000/api/google-calendar/callback`

   **Produktion** (Beispiel):

   `https://deine-domain.de/api/google-calendar/callback`

   Die Basis-URL (`http://localhost:3000` bzw. `https://deine-domain.de`) muss mit der Umgebungsvariable **`APP_URL`** oder **`NEXT_PUBLIC_APP_URL`** übereinstimmen (ohne Schrägstrich am Ende).

3. **Client-ID** und **Clientschlüssel** notieren – sie kommen in die `.env`.

---

## 3. Umgebungsvariablen in der App

Lege im Projektroot eine `.env` an (Vorlage: `.env.example`). Für Google Kalender sind mindestens nötig:

| Variable | Beschreibung |
|----------|--------------|
| `GOOGLE_CLIENT_ID` | OAuth-Client-ID aus der Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth-Clientschlüssel |
| `GOOGLE_TOKEN_SECRET` | Mindestens **16 Zeichen**, zufällig und geheim; verschlüsselt den gespeicherten Refresh-Token in der Datenbank. Alternativ kann ein ausreichend langer **`JWT_SECRET`** genutzt werden, wenn `GOOGLE_TOKEN_SECRET` nicht gesetzt ist. |
| `APP_URL` **oder** `NEXT_PUBLIC_APP_URL` | Öffentliche Basis-URL der App **ohne** abschließenden `/` – wird für OAuth-Redirect und Links in Kalendereinträgen verwendet. |

Nach Änderungen an der `.env` den **Next.js-Server neu starten** (`npm run dev` bzw. `npm run start`).

---

## 4. Verbindung in der App (Einstellungen)

1. Als **Administrator** anmelden.
2. **Einstellungen** öffnen.
3. Im Bereich **Google Kalender** prüfen, dass alle drei Statuszeilen grün sind (Client-ID/Secret, Token-Secret, App-URL).
4. Auf **Mit Google verbinden** klicken und im Google-Dialog den Zugriff bestätigen.
5. Nach erfolgreicher Rückkehr erscheint ein Hinweis, dass die Verbindung steht.
6. Optional **Kalender-ID** setzen:
   - Feld **leer lassen** → es wird der **Hauptkalender** (`primary`) des verbundenen Google-Kontos genutzt.
   - Oder die ID eines anderen Kalenders eintragen (z. B. eine Adresse wie `xxxx@group.calendar.google.com`), auf den das Konto Schreibrechte hat.
7. **Synchronisation aktiv** ankreuzen und **Kalender-Einstellungen speichern**.

Ohne aktivierte Synchronisation und ohne gespeicherte Verbindung werden keine neuen Termine erzeugt.

---

## 5. Was wird synchronisiert?

- **Neue Ausleihe:** Es wird ein ganztägiger Termin angelegt; die App speichert die Google-**Event-ID** an der Ausleihe.
- **Status geändert** (z. B. aktiv, zurück, …): Der Termin wird aktualisiert (Titel/Beschreibung passen sich an).
- **Storno (`CANCELLED`):** Der Termin wird in Google gelöscht.
- **Ausleihe in der App gelöscht:** Der zugehörige Kalendereintrag wird entfernt (sofern noch ein gültiger Token gespeichert ist).

Fehler von Google (Netzwerk, widerrufener Zugriff) **brechen** das Anlegen oder Ändern der Ausleihe in der App **nicht** ab; sie erscheinen in der Server-Logausgabe. Bei Problemen Verbindung in den Einstellungen **trennen** und **erneut verbinden**.

---

## 6. Verbindung trennen

Unter **Einstellungen** → **Google Kalender** auf **Verbindung trennen** klicken. Gespeicherte OAuth-Tokens in der App werden entfernt; **bereits angelegte Termine in Google bleiben bestehen**, bis du sie dort manuell löschst oder die Ausleihen in der App so änderst, dass wieder synchronisiert würde (nach erneutem Verbinden).

---

## 7. Kurz-Checkliste

- [ ] Calendar API aktiviert  
- [ ] OAuth-Zustimmungsbildschirm mit Scope `calendar.events`  
- [ ] Web-Client mit korrektem Callback `{APP_URL}/api/google-calendar/callback`  
- [ ] `.env` mit `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_SECRET` (oder langem `JWT_SECRET`), `APP_URL`  
- [ ] Server neu gestartet  
- [ ] Als Admin: Einstellungen → Verbinden → Synchronisation aktiv → Speichern  

Bei **„Zugriff verweigert“** oder **„redirect_uri_mismatch“**: Weiterleitungs-URI in der Cloud Console und `APP_URL` exakt abgleichen (http vs. https, Port, kein Slash am Ende der Basis-URL).

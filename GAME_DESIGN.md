# 1 gegen 100 – Webbasiertes Live-Spiel

Dieses Dokument fasst ein technisches Konzept für ein vereinsinternes, webbasiertes Livespiel nach dem Vorbild der TV-Sendung **«1 gegen 100»** zusammen. Ziel ist ein reibungsloses Spielerlebnis mit drei klaren Oberflächen: eine mobile Spieler-UI, eine Beamer-Präsentationsansicht und ein Regie-Dashboard.

## Ziele
- Authentisches Spielgefühl nach dem offiziellen Regelwerk (Einzelkandidat:in vs. 100 Herausfordernde, Joker-Logik, Bonus-Regel).
- Niedrige Einstiegshürde: Login per Kurzlink/QR-Code auf dem Smartphone, keine App-Installation.
- Klare Trennung von Rollen und Oberflächen: Spieler:innen, Regie/Moderator:in, Publikum.
- Stabiler Echtzeit-Status (Antwort-Timing, Eliminierungen, Joker, Kontostand) auf allen Clients.

## Rollen und Oberflächen
- **Einzelkandidat:in (EK)**: spielt gegen alle Herausfordernden, sieht Fragen, Antwort-Buttons, Kontostand, Joker-Status.
- **Herausfordernde (H)**: bis zu 100 Mitspielende, sehen Fragen und senden Antworten vom Handy.
- **Moderator:in/Regie**: Dashboard zum Starten/Stoppen von Runden, Joker-Verwaltung, Fragenwahl, Auszahlungsentscheid, Bonus-Status.
- **Publikum/Beamer-Ansicht**: großflächige Visualisierung (Countdowns, aktuelle Frage, verbleibende H, EK-Kontostand, Joker-Einsatz, Bonus-Fortschritt).

## Kern-Spielablauf
1. **Lobby & Sitzordnung**: Regie öffnet ein Spiel, verteilt QR-Code/Link. H wählen einen Nickname; EK wird von Regie markiert. Max 100 H werden zugelassen (Rest auf Warteliste).
2. **Frage-Zyklus** (pro Frage):
   - Regie wählt Thema/Frage (aus Bank). Präsentation zeigt Thema, Countdown startet.
   - EK antwortet (mit Joker-Option); H antworten parallel auf mobilen Geräten.
   - Nach Ablauf: System wertet Antworten gleichzeitig aus.
   - H mit falscher Antwort werden eliminiert; EK mit falscher Antwort scheidet aus.
   - Kontostand-Update: jede gelöschte H erhöht Gewinn (z. B. fixer Betrag pro H); Joker verdoppeln/halbieren entsprechend der Regeln.
   - Bonus-Status wird aktualisiert, falls alle H falsch lagen.
3. **Joker**:
   - **Joker «Antwort kaufen»**: EK darf Ergebnis der H einsehen; Antwort auflösen und einen Anteil (Standard: 50 %) des aktuellen Gewinns an bereits eliminiert H abgeben.
   - **Doppel-Joker**: Verdoppelt die Auszahlungsstufe der nächsten richtig beantworteten Frage und halbiert den Kontostand bei falscher Antwort.
   - Optionales **ABC-Joker-Feature**: Alternative oder ergänzende Joker-Mechanik nach Vorlage.
4. **Ende**:
   - EK gewinnt, wenn alle H eliminiert sind; Auszahlung bis zur letzten H plus möglicher Bonus (wenn alle H gleichzeitig falsch lagen).
   - EK kann nach jeder Frage aussteigen und den Kontostand mitnehmen; Regie bestätigt Entscheidung.

## Echtzeit-Mechanik
- WebSockets (z. B. Socket.IO) für Fragen-Push, Countdown-Sync, Antwort-Events und Status-Updates.
- Serverseitige Timings: autoritativer Countdown mit Toleranzfenster; Client sendet Zeitstempel für Anti-Cheating.
- Heartbeats zur Verbindungsüberwachung; automatische Rejoin-Funktion bei Refresh/Verbindungsabbruch.

## UI-Konzept
- **Mobile Player-UI**: vertikal, große Antwort-Buttons (A/B/C), Joker-Button mit Sicherheitsabfrage, Fortschrittsbalken für Countdown, Mini-Status (noch verbleibende H, aktueller Gewinn für EK).
- **Regie-Dashboard**: Frage-Browser (Themenfilter), Live-Kontrollleiste (Start/Stop, nächste Frage, Joker bestätigen), Spieler-Liste mit Status (aktiv/eliminert), Override-Funktionen (Antwort werten, Spieler kicken, EK wechseln), Ausstieg bestätigen.
- **Präsentation (Beamer)**: Frage und Antworten, Countdown-Ring, Heatmap der H-Antwortverteilung (nur wenn Joker aktiv), verbleibende H als Grid/Counter, Kontostand und Bonus-Indikator, Hinweis auf eingesetzte Joker.

## Technische Architektur
- **Frontend**: React/Next.js oder Vue (SPA) mit drei Routen/Layouts: `/player`, `/host`, `/screen`. Shared Component-Library für Buttons, Timer, Status-Badges.
- **Backend**: Node.js (NestJS/Express) oder FastAPI mit:
  - Auth-Light: Spiel-PIN + Nickname; Regie mit Admin-PIN.
  - Sessions per JWT im HttpOnly-Cookie oder kurzlebigem Token im LocalStorage + WS-Auth.
  - REST für Setup (Spiel erstellen, Fragen laden), WebSockets für Live-Flows.
  - Persistenz: Postgres/SQLite für Fragenpool & Spielstände; Redis für schnelle WS-State-Sync.
- **Deployment**: Docker-Compose (backend, frontend, db, redis), HTTPS hinter Reverse Proxy; Skalierbar via Sticky Sessions oder Socket.IO-Redis-Adapter.

## Datenmodell (vereinfachter Vorschlag)
- `game(id, status, current_question_id, host_pin, screen_code, created_at)`
- `player(id, game_id, role: ek|h|spectator, nickname, is_active, eliminated_at)`
- `question(id, topic, text, options[a,b,c], correct_option)`
- `round(id, game_id, question_id, state, started_at, ended_at, payout_multiplier, bonus_triggered)`
- `answer(player_id, round_id, option, submitted_at, is_correct)`
- `wallet(game_id, ek_balance, bonus_eligible)`
- `joker_usage(game_id, type: kauf|doppel|abc, round_id, effect)`

## Moderations- und Fairness-Features
- Regie kann Zeit verlängern, Frage überspringen, Antworten verwerfen oder Runde neu starten.
- Anti-Absprachen: Fragenreihenfolge zufällig; optionale Sperre für Mehrfachgeräte per IP/Rate-Limit.
- Transparenz: Präsentation zeigt Joker-Effekte klar (z. B. „Kontostand halbiert bei falscher Antwort“).

## Ablauf eines Frage-Ticks (Server-Logik)
1. **Prepare**: Frage laden, Countdown setzen, Status `awaiting_answers`.
2. **Broadcast**: Frage an EK/H + Präsentation; Timer startet serverseitig.
3. **Collect**: Antworten bis Timer-Ende oder „alle abgegeben“.
4. **Lock**: Server schließt Runde, wertet simultan.
5. **Apply Rules**: Eliminierungen, Gewinnanpassung, Joker-Effekte, Bonus prüfen.
6. **Broadcast Result**: Richtige Antwort, Verbleibende H, neuer Kontostand, Bonusstatus.
7. **Next**: Regie wählt Fortsetzung oder Ausstieg des EK.

## Fragenpool & Themen
- Mehrere Themenkategorien (z. B. Geografie, Literatur); Regie mischt oder wählt gezielt.
- Import-Format (CSV/JSON) mit Feldern: Thema, Frage, Antwort A/B/C, richtige Antwort.
- Optional: Schwierigkeitsgrad zur dynamischen Einsatz-/Auszahlungslogik.

## Offene Punkte / Klärungsbedarf
- Auszahlungsschema pro eliminierter Person (fester Betrag oder TV-ähnliche Stufen?).
- Exakte Joker-Parameter: Höhe des Abzugs bei „Antwort kaufen“ (im Reglement 50 %); Einsatzbedingungen des Doppel-Jokers (nur vor Fragebeginn?).
- Minimale/Maximale Antwortzeit pro Frage und Puffer bei Verbindungsverlust.
- Optischer Stil (Branding, Vereinsfarben, Schriftarten) und Tonalität.
- Ob Publikum die Antwortverteilung live sehen darf oder erst nach Lock.

## MVP-Umfang
- Auth via Spiel-PIN + Nickname, Rollen EK/H.
- WebSocket-basierter Frage/Antwort-Flow mit Countdown.
- Joker „Antwort kaufen“ und „Doppel-Joker“ (inkl. Effekte auf Kontostand).
- Präsentationsansicht mit Status und Heatmap; Regie-Dashboard für Steuerung.
- CSV-Import für Fragen; persistenter Spielstand (DB) und Redis-gestützter WS-Sync.

## Nächste Schritte (nach Klärung)
- UI-Wireframes für Player, Host, Screen.
- Datenbankschema konkretisieren und Migrationen anlegen.
- API/WS-Schnittstellen spezifizieren (Events & Payloads).
- Prototyp (Backend + Frontend) mit lokalen Smoke-Tests.


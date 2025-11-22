# 1 gegen 100 – Vereinsedition

Ein leichtgewichtiger Prototyp, um das TV-Format **1 gegen 100** lokal im Verein als Browser-Spiel zu hosten. Das Backend nutzt Server-Sent Events für Live-Updates; Frontend-Seiten sind bewusst simpel gehalten für Smartphones, Regie und Beamer.

## Starten

1. Node.js 18+ installieren.
2. Repository klonen und Abhängigkeiten prüfen (es werden keine externen Module benötigt).
3. Server starten:
   ```bash
   node server.js
   ```
4. Im Browser öffnen:
   - Spieler:innen: `http://localhost:3000/player.html`
   - Regie: `http://localhost:3000/host.html`
   - Beamer: `http://localhost:3000/screen.html`

## Spielablauf (Kurzfassung)
- Regie setzt eine Einzelkandidat:in (erste Anmeldung als Kandidat oder per Dropdown im Dashboard).
- „Spiel starten“ setzt alle Status zurück und startet Frage 1.
- Während der Frage können Spieler:innen über ihre Geräte antworten (A/B/C).
- „Nächste Phase“ wertet eine laufende Frage aus oder startet die nächste Frage.
- Falsche Herausfordernde werden eliminiert; pro Eliminierung wächst der Topf. Scheidet die Kandidat:in aus, endet das Spiel. Sind alle Herausfordernden eliminiert, gewinnt die Kandidat:in.

## Hinweise
- Die Fragen sind als Demo im Code hinterlegt (`server.js`).
- Da kein externes Build-Tool genutzt wird, lassen sich Inhalte leicht anpassen oder erweitern.
- SSE sorgt für Live-Status auf allen Clients; sollte die Verbindung getrennt werden, lädt der Browser automatisch nach.

## Deployment auf Plesk (Schritt für Schritt)
1. **Projekt vorbereiten**: Das Repository als ZIP packen oder via Git bereitstellen.
2. **Dateien hochladen**: In Plesk unter *Dateimanager* in das gewünschte Webroot (z. B. `httpdocs/1gegen100`) hochladen und entpacken.
3. **Node.js-App anlegen**: In Plesk *Websites & Domains → Node.js* öffnen, *Node.js aktivieren* und als **Application root** das entpackte Verzeichnis wählen (z. B. `httpdocs/1gegen100`).
4. **Startdatei setzen**: In der Node.js-Konfiguration `server.js` als **Application Startup File** eintragen. **Document root** kann auf `public` zeigen, ist aber optional, da `server.js` statische Dateien selbst ausliefert.
5. **Node-Version wählen**: Eine 18er-Version (oder höher) auswählen, damit `randomUUID` und moderne Syntax verfügbar sind.
6. **Abhängigkeiten prüfen**: Es gibt keine zusätzlichen Pakete; `npm install` ist nicht nötig. Falls Plesk es anbietet, den Schritt überspringen oder bestätigen.
7. **Umgebungsvariable PORT**: Kein fixer Wert notwendig; Plesk setzt die interne Port-Nummer automatisch und reicht Anfragen per Proxy weiter. Falls verlangt, `PORT=3000` eintragen.
8. **App starten**: In Plesk auf *Start* bzw. *Neu starten* klicken. Die Statusmeldung sollte anzeigen, dass die Anwendung läuft.
9. **Domains/URLs testen**:
   - Spieler:innen: `https://<deine-domain>/player.html`
   - Regie: `https://<deine-domain>/host.html`
   - Beamer/Publikum: `https://<deine-domain>/screen.html`
   Falls ein Unterverzeichnis genutzt wurde, den Pfad ergänzen (z. B. `/1gegen100/player.html`).
10. **Fehleranalyse**: Bei Problemen Plesk-Logs öffnen (*Protokolle anzeigen*) und sicherstellen, dass keine Port-Kollision vorliegt und die App tatsächlich läuft.

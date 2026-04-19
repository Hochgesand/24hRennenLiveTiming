## 7. PRD (wird als `PRD.md` im Projektroot gespeichert)

### Problem Statement

Als Motorsport-Fan/Analyst will ich die Live-Daten von `livetiming.azurewebsites.net` (z.B. ADAC 24h Nuerburgring Qualifiers, `event=50`) in einem aufgeraeumten, modernen Dashboard betrachten. Die Original-Oberflaeche ist datendicht, optisch alt und nicht broadcast-tauglich; Drittanbieter-Tools fehlen. Ich brauche eine eigene React-App, die das Wire-Protocol direkt anzapft, robust live aktualisiert und mir eine bessere visuelle Lesbarkeit (Podium, Gap-Bar, Sector-Heatmap, Drilldown) bietet.

### Solution

Eine clientseitige React-App (Vite + TS + Tailwind + shadcn/ui + Zustand). Sie verbindet sich per WebSocket zum bestehenden Live-Timing-Server, abonniert die noetigen PIDs (0, 3, 4, 501, 9002) mit einem rekonstruierten Open-Frame (`{eventId, eventPid, clientLocalTime}`), entkoppelt das Wire-Format ueber pure Decoder, hydriert einen Zustand-Store und rendert ein broadcast-orientiertes Layout. Pro-Auto Drilldown lae dt die Lap-Historie ueber ein separates WebSocket-Abonnement mit `eventPid: [7]` und Zusatzfeldern `session` / `startingNo` im Open-Frame (Payload `PID: "7"`, `DATA[]`). URL-Parameter `?event=&config=` machen das Dashboard fuer beliebige Events wiederverwendbar.

### User Stories

1. Als Spectator will ich beim Oeffnen sofort sehen, welche Session laeuft, damit ich Kontext habe.
2. Als Spectator will ich Top 3 prominent als Podium sehen, damit ich die Spitze auf einen Blick erfasse.
3. Als Spectator will ich ein Live-Leaderboard mit Position, Startnummer, Klasse, Fahrer, Team, Auto, Gap, Last und Fastest sehen, damit ich den Renn-Status verstehe.
4. Als Spectator will ich Positions-Aenderungen (Up/Down) farblich markiert sehen, damit ich Bewegung erkenne.
5. Als Spectator will ich Sektor-Zellen farbcodiert sehen (session-best/personal-best/pit), damit ich Performance-Hotspots erkenne.
6. Als Spectator will ich Live Race-Messages in einer Sidebar sehen, damit ich Flags und Vorfaelle mitbekomme.
7. Als Spectator will ich nach Klassen und Pro/Am filtern, damit ich nur relevante Autos sehe.
8. Als Spectator will ich eine Spaltensichtbarkeits-Auswahl, damit ich die Tabelle meinen Beduerfnissen anpasse.
9. Als Power-User will ich, dass meine Filter und Spaltenwahl per URL gespeichert werden, damit ich Konfigurationen teilen kann.
10. Als Spectator will ich die verbleibende Sessionzeit korrekt synchronisiert sehen (Server-Time-Offset), damit der Countdown stimmt.
11. Als Spectator will ich eine Track-State-Anzeige (Green/Yellow/Red/SC), damit ich den Status sofort erkenne.
12. Als Spectator will ich auf eine Auto-Zeile klicken und ein Drilldown-Modal sehen, damit ich Detail-Performance studieren kann.
13. Als Analyst will ich im Drilldown ein Lap-Time-Linien-Chart sehen, damit ich Pace-Entwicklung erkenne.
14. Als Analyst will ich im Drilldown eine Sektor-Matrix pro Lap sehen, damit ich Verluste/Gewinne lokalisiere.
15. Als Analyst will ich Personal-Best und Stint-Average als Referenzlinien im Chart sehen, damit ich die Lap einordnen kann.
16. Als Spectator will ich, dass die App nach Verbindungsabbruch automatisch reconnecten, damit ich keine Daten verpasse.
17. Als Spectator will ich einen Connection-Status-Indikator, damit ich Probleme sofort sehe.
18. Als Spectator will ich `?event=50&config=w3` per URL setzen koennen, damit ich verschiedene Events sehen kann.
19. Als Spectator will ich ein "event not found"-Feedback bei `LTS_NOT_FOUND`, damit ich Fehlkonfigurationen erkenne.
20. Als Spectator will ich Top-Qualifying (Pro/ProAm) optional eingeblendet, wenn `STQ` aktiv ist, damit ich Qualifying-Stand sehe.
21. Als Spectator will ich Best-Lap und Best-Sector-Stats sehen, damit ich Session-Highlights erkenne.
22. Als Tablet-Nutzer will ich eine angepasste Layout-Variante mit zusammenklappbarer rechter Spalte, damit es auch auf 1024px funktioniert.
23. Als Mobile-Nutzer will ich Tabs (Leaderboard/Messages/Stats), damit die App auf kleinen Screens nutzbar bleibt.
24. Als Entwickler will ich klare TypeScript-Typen aller PID-Payloads, damit ich sicher gegen das Wire-Format programmieren kann.
25. Als Entwickler will ich pure Decoder-Funktionen, damit ich sie isoliert testen kann.
26. Als Entwickler will ich einen WS-Client mit fakeable WebSocket, damit ich Verbindungslogik testen kann.
27. Als Entwickler will ich URL-Config-Parsing isoliert getestet, damit ich Edge-Cases abdecke.
28. Als Operator will ich keine Backend-Komponente, damit ich die App statisch (z.B. CDN, GitHub Pages) deployen kann.

### Implementation Decisions

- **Stack:** Vite + React 18 + TypeScript + Tailwind v4 + shadcn/ui + Zustand + Recharts + tanstack-query.
- **Routing:** kein Router, Single-Page; URL-Query (`?event=&config=&view=`) parst `useUrlConfig`.
- **WS-Open-Frame:** `{ eventId: string, eventPid: number[], clientLocalTime: number }` (rekonstruiert aus Original-Bundle).
- **PID-Phasen-Maschine im Client:**
  1. erstes Frame muss `PID === "LTS_TIMESYNC"` sein -> berechnet `remoteTimeDiff = (now - serverLocalTime) + (now - clientLocalTime)/2`
  2. `PID === "LTS_NOT_FOUND"` -> Error-Callback `event not found`
  3. danach Datenframes (`"0"`, `"3"`, `"4"`, `"501"`, `"9002"`, `"7"` im Lap-Drilldown) als komplette Snapshots
- **Multi-PID-Multiplex:** ein WS pro PID-Set; UI-Stores teilen sich denselben Client wenn moeglich (Observer-Count-Pattern wie im Original).
- **Reconnect:** exponential-backoff bis `maxAttempts`, Skip bei Close-Codes 1000/1001/1005.
- **Decode-Modul:** **pure Funktionen** `decodeStatusCode(code: string|number): SectorStatus` und `decodeResultRow(raw: RawResult): ResultRow`; **keine Mutation, keine Seiteneffekte**. Status-Enum: `personalBest|sessionBest|overallBest|pit|inLap|outLap|invalid|normal`.
- **Store (Zustand):** Slices `connection`, `session`, `track`, `results`, `messages`, `topQualifying`. Setter werden vom WS-Client per Callback aufgerufen, niemals direkt von Komponenten.
- **Lap-Detail (Drilldown):** eigenes WS mit `eventPid: [7]`, Open-Frame inkl. `session` und `startingNo`; Hook `useLapsDataSubscription` liefert `Pid7Frame` / `DATA[]` fuer Charts und Matrix.
- **Architektur-Schichten:**
  - Wire (`lib/ws.ts`) — kennt nur Server-Format
  - Decode (`lib/decode.ts`) — pure, formenwandelt Wire -> Domain
  - Store (`store/useLiveStore.ts`) — haelt Domain-State, hat keinen Server-Bezug
  - View (`components/`*) — liest nur aus Store, ist "dumb"
- **CORS:** WS hat keine Origin-Restriction (in Test reproduziert). Lap-Daten laufen wie die uebrigen Features ueber WS (`PID 7`), nicht ueber die SPA-Route `/event/.../laps-data` (kein JSON-REST).
- **Theme:** Dark per Default, Tokens aus Stitch-Design (siehe Kapitel 4) als CSS-Variablen.
- **Resilienz:** App rendert mit leerem Snapshot Skeleton; Fehler-Toasts (shadcn `sonner`) bei `onError`.

### Testing Decisions

Tests pruefen **externes Verhalten** (Input/Output, Public-API), nicht interne Implementation. Vitest + Testing-Library wo UI; reine Module ohne DOM.

Module mit Tests:

- `**lib/ws.ts` (LiveTimingClient):** mit Fake-`WebSocket` (klassen-mock). Cases: erstes Frame `LTS_TIMESYNC` -> `onTime` aufgerufen, Phase wechselt; `LTS_NOT_FOUND` -> `onError`; Daten-Frame `PID:"0"` -> `onJson`; Open-Frame ist gueltiges JSON mit `eventId/eventPid/clientLocalTime`; Reconnect bei Close-Code != 1000/1001/1005 mit Backoff (Fake-Timers); `closeSocket()` schliesst WS und feuert `onClose`.
- `**lib/decode.ts`:** Tabellen-Tests aller Status-Codes, Snapshot-Test fuer `decodeResultRow` aus realer Beispiel-Payload (aufgezeichnet aus Live-Server, in `__fixtures__/result-row.json`).
- `**hooks/useUrlConfig.ts`:** Cases: `?event=50&config=w3` -> `{eventId:"50", config:"w3"}`; fehlt `event` -> `{eventId:null, ...}`; legacy `/event=50/...` Pfad ebenfalls geparst; Trailing/Leading-Slashes; Mehrfach-Params.
- `**store/useLiveStore.ts`:** PID-Routing: gegebene Frames `{PID:"0",...}`, `{PID:"4",...}`, `{PID:"3",...}` -> jeweils richtige Slice befuellt; Frames mit unbekanntem PID werden ignoriert ohne Fehler; `LTS_NOT_FOUND` setzt `connection.error = "event not found"`.

Prior Art / Inspiration:

- Klassischer Vitest-Setup wie bei Vite-Templates (`vitest`, `@vitest/ui`, `jsdom` env nur wo noetig).
- Fixture-Driven Decoder-Tests sind in vielen OSS-Projekten Standard (z.B. Sentry-SDK Wire-Format-Tests).

### Out of Scope

- Eigene Backend-Komponente, Persistenz oder Replay-Server.
- Authentifizierung/Login.
- Server-Side-Rendering, SEO.
- Native Mobile App.
- Andere Live-Timing-Provider als `livetiming.azurewebsites.net`.
- Audio-Kommentar / Push-Notifications.
- i18n jenseits von Deutsch/Englisch (Strings kommen teils direkt vom Server).
- Aufzeichnung kompletter Sessions im Browser (nur On-Demand Lap-Abonnement im Drilldown).

### Further Notes

- Wire-Format kann sich ohne Vorwarnung aendern; `version`-Felder (`VER`) im Decoder respektieren und Fallbacks loggen.
- Sector-Anzahl variiert pro Strecke (Nuerburgring nutzt bis zu 9 Sektoren, F1-Strecken 3) — UI muss dynamisch nur die belegten S1..S9 rendern.
- `eventPid` ist Array, **nicht** Subscribe-Topic-String — Bezeichnung im Original-Bundle missweisend.
- `LTS_TIMESYNC` muss vor jeder Daten-Verarbeitung kommen, sonst Socket schliessen (so macht's das Original).
- Ggf. spaeter `9002` (Statistics) und Top-Qualifying `501` als zusaetzliche Tabs nachruesten.

## PRD: Telemetric Cockpit + responsive shell

Tracking der **45 User Stories** aus `docs/PRD-design-overhaul.md` (dort: ~~erledigt~~ + **[offen]**).

### Shell, navigation (1–10)

- 1 Header/Timer/Track/WS bei allen Tabs
- 2 Podium-Ribbon unter Header
- 3 Tabs Leaderboard / Stats / Messages / Track / STQ?
- 4 STQ-Tab nur bei Daten (`STQ`)
- 5 Tablet gleiche Tab-Struktur
- 6 Podium Tablet: 2-Zeilen-Layout nach Scroll im Tab-Panel
- 7 Mobile Bottom-Tabs (Race/Stats/Messages/Settings)
- 8 Kompakte Session-Zeile (`SessionHeader compact`)
- 9 Mini-Podium horizontal
- 10 `safe-area-inset-bottom` am Tab-Bar

### Leaderboard & Filter (11–18)

- 11 Default-Spalten + Driver/Team-Stack
- 12 Spalten inkl. Pit/Stint/Tire/Best-of-class
- 13 `cols=` URL
- 14 Desktop: Settings-Drawer + Zahnrad
- 15 Tablet: gleicher Drawer
- 16 Mobile: Settings-Tab
- 17 Klassen- / Pro-Am-Filter
- 18 Sector-Farben + Tokens

### Drilldown (19–27)

- 19 Desktop Modal
- 20 Tablet/Mobile Bottom-Sheet
- 21 Header: #, Klasse, Monogramm, Team, Fahrerliste
- 22 KPI-Strip
- 23 Lap-Chart + PB/Stint-Referenz
- 24 Sektor-Matrix farbig
- 25 Stint-Timeline
- 26 Gap-to-Leader Chart
- 27 Telemetrie-Platzhalter

### Track Map (28–29)

- 28 Track-Map-Tab Desktop/Tablet
- 29 Mobile Stats inkl. Track Map

### State & i18n (30–35)

- 30 `LTS_NOT_FOUND` Deutsch
- 31 Reconnect-Banner
- 32 Status-Punkt + Reconnecting
- 33 Default DE
- 34 Sprachumschaltung
- 35 `lang` in URL

### Zahlenformat (36–38)

- 36 `DataNumeric` / Mono
- 37 Delta-Farben
- 38 Lap/Gap-Formatierung

### Design-System (39–41)

- 39 CSS-Variablen / Theme
- 40 JetBrains Mono
- 41 `useBreakpoint`

### Settings & Sharing (42–43)

- 42 Settings-Inhalt vollständig
- 43 Share-URL mit Query-State

### Performance (44–45)

- **44 Lighthouse Performance ≥ 90** — **[offen]**
- 45 Statische SPA

---

Details und Original-Story-Texte: `docs/PRD-design-overhaul.md`
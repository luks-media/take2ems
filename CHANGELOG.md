# Changelog

## v2.0.0 - 2026-04-30

### Added
- Neue Ausleihe: Kategoriegruppierte Equipment-Auswahl mit Kategorietrennern.
- Neue Ausleihe: Kundenwahl als integrierter Picker in Kachelansicht sowie kompaktere Warenkorb-Zeilen mit Suchfunktion.
- Dashboard: User-spezifisches ToDo-Board inkl. Teilen mit anderen Nutzern.
- Ausleihen: Optionaler Ausleihtitel mit Fallback auf Kundenname in Listen/Details/PDF.
- Ausleihen/Abrechnung: Umbuchung von Owner-Anteilen pro Ausleihe inkl. Kennzeichnung in der Zeilenansicht.

### Changed
- Dashboard: KPI-Titel und Darstellung verfeinert (u. a. "Umsatz <Monat>", zentrierte KPI-Werte, reduzierte Zusatztexte).
- Layout/Navigation: Programmsidebar ist jetzt global einklappbar mit weicher Morph-Animation.
- Neue Ausleihe: UI deutlich verdichtet (tighter Equipment-Container, schmalere Mengen-Controls, reduzierte Abstände, klarere Trennung der Bereiche).
- Dashboard/Listen: Titelanzeige priorisiert nun `rental.title`, fallback bleibt `customerName`.
- Settings: Versionsanzeige liest primär direkt aus `package.json`.

### Fixed
- Gesamtabrechnung/Salden berücksichtigen Umbuchungen von Owner-Anteilen konsistent über `effectiveOwner`.
- Umsatzberechnung im Dashboard schließt Entwürfe (`DRAFT`) aus.
- Prisma-Relationen beim Speichern von Ausleihen (`customer`, `user`) auf `connect`/`disconnect` korrigiert.
- Fehlende Migrationen/Felder (u. a. `settlementOwnerId`, `title`, `borrowerNote`) stabilisiert und integriert.

## v1.2.2 - 2026-04-30

### Fixed
- Dashboard Umsatz (Monat): Entwürfe (`DRAFT`) werden nicht mehr in die Umsatzsumme eingerechnet.

## v1.2.1 - 2026-04-30

### Fixed
- Gesamtabrechnung/Salden: Umbuchungen von Owner-Anteilen werden jetzt auch in der user-basierten Saldo-Logik berücksichtigt (`effectiveOwner = settlementOwner ?? owner`).
- Ausleihen speichern: Prisma-Relationen für Kunde/Bearbeiter in Create/Update auf `connect`/`disconnect` umgestellt, um Runtime-Fehler bei `customerId`/`userId` zu vermeiden.

## 2026-04-30

### Added
- Abrechnung: Owner-Anteile pro Ausleihe koennen jetzt auf einen anderen User umgebucht werden (ausleihenspezifisch, nicht global).
- Ausleihe-Detail: Umbuchungs-UI fuer Owner-Anteile inkl. ein-/ausblendbarer Bearbeitungsmaske.
- Dashboard: User-spezifisches ToDo-Board mit Erstellen, Abhaken und Loeschen.
- Dashboard ToDo-Board: Teilen mit anderen Usern (Shared ToDos) inkl. Sichtbarkeit fuer Ersteller und geteilte Empfaenger.
- Neue Ausleihe: Feld "Notiz fuer Ausleiher" hinzugefuegt.
- PDF-Checkliste: Ausleiher-Notiz wird im Block "Notizen fuer den Ausleiher" ausgegeben.
- Aktivitaetslog: Actor/User wird explizit angezeigt ("Von" und "Ausgefuehrt von").

### Changed
- Abrechnung: Summen laufen jetzt ueber den effektiven Abrechnungs-Owner (Umbuchungsziel), waehrend der Original-Owner erhalten bleibt.
- Abrechnung Zeilenansicht: Umbuchungen werden als `OriginalOwner -> AbrechnungsOwner` markiert.
- Dashboard Design: visuelles Polish (Cards, Abstaende, Quick-Access, Status-Akzente in Ausleihen-Listen).
- Dashboard KPI: Umsatz-Kachel wieder neutralisiert; zustandsbasierte Akzente fuer relevante KPI beibehalten.
- User-Kacheln: Equipmentwert auf Basis der Owner-Anteile (Lots/Fractions) statt Vollwert pro zugewiesenem Artikel.

### Fixed
- Prisma Create/Update bei Ausleihen auf relationale Schreibweise fuer `customer` und `user` umgestellt (statt direkter `customerId`/`userId` Zuweisung in den betroffenen Calls).
- Migrationen fuer neue Felder/Modelle angewendet und Prisma Client neu generiert.

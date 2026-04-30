# Changelog

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

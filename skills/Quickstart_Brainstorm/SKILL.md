---
name: Quickstart_Brainstorm
description: >
  Multi-Agenten Brainstorming zu einem Thema. Spawnt guenstige Agenten aus
  dem Katalog, sammelt ihre Perspektiven ueber mehrere Runden und synthetisiert
  ein Ergebnis. Verwende diesen Skill wenn der User /brainstorm aufruft.
---

# Brainstorm — Multi-Agent Ideation

Fuehre die folgenden Schritte in Reihenfolge aus.

---

## Schritt 1 — Thema und Modus bestimmen

Falls kein Thema angegeben: den User fragen.

Falls kein Modus angegeben: den User fragen. Zeige die Optionen als Auswahl:

| Modus     | Agenten | Runden | Beschreibung                          |
|-----------|---------|--------|---------------------------------------|
| Schnell   | 3       | 1      | Schneller Ueberblick, wenige Minuten  |
| Standard  | 4       | 2      | Ausgewogene Tiefe (Recommended)       |
| Gruendlich| 5       | 3      | Vertiefte Analyse mit mehr Perspektiven |
| Tiefgang  | 6       | 4      | Maximale Tiefe, alle Blickwinkel      |

---

## Schritt 2 — Team zusammenstellen

```
suggest_brainstorm_team(topic="<thema>", team_size=<anzahl>)
```

Das Tool waehlt zufaellig guenstige Agenten aus dem Katalog. Merke dir die zurueckgegebenen Template-Namen.

---

## Schritt 3 — Runden durchfuehren

Erstelle eine Session-ID: `bs_<thema_slug>_<MMDD_HHMM>` (z.B. `bs_ki_strategie_0220_1430`).

**Wiederhole fuer jede Runde (1 bis N):**

### 3a — Agenten spawnen

Die Agenten wurden bereits von `suggest_brainstorm_team` ausgewaehlt — guenstig und department-divers.
Kein Tool oder Model angeben — die Agenten nutzen ihr Standard-Setup aus dem Katalog.

Spawne jeden Agenten mit:

```
spawn_agent(
  Template: "<template_name>",
  Agent_ID: "<SESSION_ID>_R<runde>_<template>",
  No_Session: true,
  Cwd: "Althing_CEO/Quickstarts/<SESSION_ID>/R<runde>/",
  Command: "<prompt — siehe unten>"
)
```

**Prompt Runde 1:**
```
Du bist Teil eines Brainstorming-Teams. Deine Rolle: <template_name>.
Thema: <thema>

Teile deine Perspektive, Ideen, Chancen und Risiken.
Sei konkret. Max. 250 Woerter.
```

**Prompt ab Runde 2:**
```
Du bist Teil eines Brainstorming-Teams. Deine Rolle: <template_name>.
Thema: <thema>

Ergebnisse der vorherigen Runde:
<outputs_runde_N-1>

Baue auf diesen Ideen auf, ergaenze, widersprich oder vertiefe.
Sei konkret. Max. 250 Woerter.
```

### 3b — Warten bis alle fertig

Pruefe den Status aller Agenten dieser Runde:

```
get_agent_status(agent_id="<SESSION_ID>_R<runde>_<template>")
```

Wiederhole alle 10 Sekunden bis alle Agenten Output haben. Berichte dem User den Fortschritt.

### 3c — Outputs sammeln

Lies die Output-Dateien:
- Pfad: `Althing_CEO/Quickstarts/<SESSION_ID>/R<runde>/<SESSION_ID>_R<runde>_<template>_OUTPUT.md`

Speichere alle Outputs fuer den naechsten Schritt (und als Kontext fuer Runde N+1).

---

## Schritt 4 — Synthese

Fasse alle Runden-Outputs zu einem praegnanten Ergebnis zusammen:

- **Kernerkenntnisse** (3-5 Punkte)
- **Kontroversen / offene Fragen**
- **Empfohlene naechste Schritte**

Gib die Synthese direkt im Chat aus.

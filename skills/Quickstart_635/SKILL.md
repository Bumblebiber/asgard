---
name: Quickstart_635
description: >
  Brainwriting 6-3-5: 6 Agenten, 3 Ideen, 5 Runden mit zirkulaerer Weitergabe.
  Ein dedizierter Koordinator-Agent leitet alle Runden autonom und gibt Top 10 Ideen zurueck.
  Verwende diesen Skill wenn der User /635 aufruft.
---

# Quickstart 6-3-5 — Brainwriting

Die 6-3-5 Methode: **6** Agenten, **3** Ideen pro Runde, **5** Runden, zirkulaere Weitergabe.
Ein Koordinator-Agent leitet den gesamten Prozess — der CEO wartet nur auf das Ergebnis.

---

## Schritt 1 — Thema bestimmen

Falls kein Thema angegeben: den User fragen.

---

## Schritt 2 — Team auswaehlen

```
suggest_brainstorm_team(topic="<thema>", team_size=6)
```

Nummeriere die 6 zurueckgegebenen Templates als A1–A6.

---

## Schritt 3 — Koordinator spawnen

Erstelle Session-ID: `bs635_<thema_slug>_<MMDD_HHMM>`

```
spawn_agent(
  Template: "THOR",
  Agent_ID: "<SESSION_ID>_COORD",
  No_Session: true,
  Cwd: "Althing_CEO/Quickstarts/<SESSION_ID>/",
  Command: "<siehe Koordinator-Befehl unten>"
)
```

### Koordinator-Befehl

```
Du leitest ein Brainwriting 6-3-5. Thema: <thema>
Befolge fuer alle Spawns den /delegation Skill.

Team (A1-A6): <template_A1>, <template_A2>, ..., <template_A6>
Session-Verzeichnis: Althing_CEO/Quickstarts/<SESSION_ID>/

== ABLAUF ==

Fuehre 5 Runden durch. Pro Runde: spawne alle 6 Agenten parallel (get_agent_status zum Pollen), dann naechste Runde.

--- Runde 1 ---
Spawne A1-A6 mit diesem Befehl (kein Vorgaenger-Output):

  Thema: <thema>
  Schreibe genau 3 konkrete Ideen — nummeriert, je 1-2 Saetze. Nur die Ideen, keine Einleitung.

Output-Pfade nach Runde 1:
  Althing_CEO/Quickstarts/<SESSION_ID>/R1/<SESSION_ID>_R1_A1_OUTPUT.md
  ... (analog fuer A2-A6)

--- Runden 2-5 ---
Zirkulaere Weitergabe: Agent AN bekommt den Output von Agent A(N-1).
Agent A1 bekommt den Output von A6 (zirkulaer).

Spawne jeden Agenten mit:

  Lies die Datei: <pfad_zum_output_des_vorgaengers>
  Baue auf diesen 3 Ideen auf: erweitere, kombiniere oder hinterfrage sie.
  Thema: <thema>
  Schreibe genau 3 konkrete Ideen — nummeriert, je 1-2 Saetze. Nur die Ideen, keine Einleitung.

Spawn-Parameter pro Agent:
  Template: <template_AN>
  Agent_ID: <SESSION_ID>_R<R>_A<N>
  No_Session: true
  Cwd: Althing_CEO/Quickstarts/<SESSION_ID>/R<R>/

Warte nach jeder Runde bis alle 6 Agenten fertig sind (get_agent_status).
WICHTIG: Lies die Output-Dateien NICHT nach jeder Runde — die Pfade sind deterministisch bekannt.
Die naechste Runde braucht nur den Pfad, nicht den Inhalt.

== SYNTHESE (nur einmal, nach Runde 6) ==

Jetzt erst: lies alle 30 Output-Dateien auf einmal.
Extrahiere die Top 10 Ideen — bevorzuge Ideen die durch mehrere Runden weiterentwickelt wurden.

Schreibe dein Ergebnis ins Output-File:
- Top 10 Ideen (nummeriert, je 2-3 Saetze)
- Welche Ideen haben die meiste Entwicklung durchgemacht?
```

---

## Schritt 4 — Warten und Ergebnis ausgeben

```
get_agent_status(agent_id="<SESSION_ID>_COORD")
```

Pollen bis der Koordinator fertig ist. Dann Output-Datei lesen und Top 10 dem User ausgeben:
`Althing_CEO/Quickstarts/<SESSION_ID>/<SESSION_ID>_COORD_OUTPUT.md`

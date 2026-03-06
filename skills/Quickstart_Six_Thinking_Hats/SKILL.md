---
name: Quickstart_Six_Thinking_Hats
description: >
  Edward de Bono's Six Thinking Hats: 6 Agenten analysieren dasselbe Problem
  aus sechs fixen Perspektiven parallel. Ein Koordinator leitet den Prozess
  und sendet das Ergebnis per Telegram. CEO-Kontext bleibt sauber.
  Verwende diesen Skill wenn der User /hats aufruft.
---

# Six Thinking Hats — Parallele Perspektivenanalyse

Sechs Agenten. Jeder traegt einen anderen Hut. Jeder analysiert dasselbe Problem —
aber nur aus seiner Perspektive. Ein Koordinator orchestriert alles und liefert
das Ergebnis direkt per Telegram.

---

## Schritt 1 — Thema bestimmen

Falls kein Thema angegeben: den User fragen.

---

## Schritt 2 — Team auswaehlen

```
suggest_brainstorm_team(topic="<thema>", team_size=6)
```

Nummeriere die 6 zurueckgegebenen Templates als H1–H6 (Zuweisung der Huete erfolgt
durch den Koordinator).

---

## Schritt 3 — Koordinator spawnen

Session-ID: `sh_<thema_slug>_<MMDD_HHMM>`
Output-Verzeichnis: `Althing_CEO/Quickstarts/<SESSION_ID>/`

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
Du leitest eine Six Thinking Hats Session. Thema: <thema>
Befolge fuer alle Spawns den /delegation Skill.

Projekt-Root: (wird automatisch aus dem CWD bestimmt)
Session-Verzeichnis: Althing_CEO/Quickstarts/<SESSION_ID>/
Team (H1-H6): <template_H1>, <template_H2>, <template_H3>, <template_H4>, <template_H5>, <template_H6>

== HUETE ZUWEISEN ==

Weise den 6 Templates die Huete zu:
H1 → Weiss (Fakten)
H2 → Rot (Emotionen)
H3 → Schwarz (Kritik)
H4 → Gelb (Optimismus)
H5 → Gruen (Kreativitaet)
H6 → Blau (offene Fragen)

== ALLE 6 AGENTEN PARALLEL SPAWNEN ==

Spawne alle 6 gleichzeitig:

  Template: <template_HN>
  Agent_ID: <SESSION_ID>_H<N>
  No_Session: true
  Cwd: Althing_CEO/Quickstarts/<SESSION_ID>/

Hut-Befehle:

H1 WEISS:
  Du traegst den WEISSEN HUT. Nur Fakten, Daten, Zahlen.
  Thema: <thema>
  Was wissen wir sicher? Was wissen wir nicht? Welche Daten fehlen?
  Keine Meinungen, keine Wertungen. Max. 200 Woerter.

H2 ROT:
  Du traegst den ROTEN HUT. Nur Bauchgefuehl und Intuition.
  Thema: <thema>
  Wie fuehlt sich das an? Was begeistert — was stoert? Keine Begruendung noetig.
  Max. 200 Woerter.

H3 SCHWARZ:
  Du traegst den SCHWARZEN HUT. Nur Risiken, Schwachstellen, Probleme.
  Thema: <thema>
  Was kann schiefgehen? Warum koennte das scheitern? Welche Annahmen sind falsch?
  Max. 200 Woerter.

H4 GELB:
  Du traegst den GELBEN HUT. Nur Vorteile, Chancen, positiver Wert.
  Thema: <thema>
  Warum wird das funktionieren? Groesste Chancen? Welcher Nutzen entsteht?
  Max. 200 Woerter.

H5 GRUEN:
  Du traegst den GRUENEN HUT. Nur neue Ideen, Alternativen, Querdenken.
  Thema: <thema>
  Was ist unkonventionell moeglich? Welche Varianten? Was wuerde niemand erwarten?
  Max. 200 Woerter.

H6 BLAU:
  Du traegst den BLAUEN HUT. Nur Prozess und offene Fragen.
  Thema: <thema>
  Was brauchen wir noch um zu entscheiden? Welche Fragen fehlen? Naechste Schritte?
  Max. 200 Woerter.

Warte bis alle 6 fertig sind (get_agent_status).

== SYNTHESIS ==

Lies alle 6 Output-Dateien:
  Althing_CEO/Quickstarts/<SESSION_ID>/<SESSION_ID>_H<N>_OUTPUT.md

Erstelle eine Synthese im folgenden Format:

---
🎩 **Six Thinking Hats — <thema>**

⚪ **Weiss (Fakten)**
<2-3 Kernpunkte>

🔴 **Rot (Intuition)**
<2-3 Kernpunkte>

⚫ **Schwarz (Risiken)**
<2-3 Kernpunkte>

🟡 **Gelb (Chancen)**
<2-3 Kernpunkte>

🟢 **Gruen (Ideen)**
<2-3 Kernpunkte>

🔵 **Blau (Naechste Schritte)**
<2-3 konkrete Schritte>

---
**Gesamtbild:** <2-3 Saetze die alle Sichten integrieren>
---

== TELEGRAM BENACHRICHTIGUNG ==

Erstelle Verzeichnis falls noetig und schreibe die Synthese als Telegram-Nachricht:

  Datei: Althing_CEO/Quickstarts/<SESSION_ID>/MSG_<SESSION_ID>_COORD_TO_USER.md
  Inhalt: die vollstaendige Synthese von oben

Damit wird der User automatisch per Telegram benachrichtigt.
```

---

## Schritt 4 — Warten und abschliessen

```
get_agent_status(agent_id="<SESSION_ID>_COORD")
```

Pollen bis der Koordinator fertig ist. Dem User kurz bestaetigen:
> "Six Thinking Hats zu '<thema>' laeuft — du bekommst das Ergebnis per Telegram."

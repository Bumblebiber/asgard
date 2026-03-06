---
name: Quickstart_Disney_Method
description: >
  Walt Disney's drei Raeume: Dreamer, Realist, Critic — sequenziell aufeinander aufbauend.
  Ein Koordinator leitet alle drei Phasen und sendet das Ergebnis per Telegram.
  CEO-Kontext bleibt sauber. Verwende diesen Skill wenn der User /disney aufruft.
---

# Walt Disney Method — Dreamer, Realist, Critic

Drei Raeume. Drei Agenten. Sequenziell.
Der Dreamer erfindet — der Realist plant — der Critic prueft.
Ein Koordinator leitet alles und liefert das Ergebnis per Telegram.

---

## Schritt 1 — Thema bestimmen

Falls kein Thema angegeben: den User fragen.

---

## Schritt 2 — Koordinator spawnen

Session-ID: `wd_<thema_slug>_<MMDD_HHMM>`
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
Du leitest eine Walt Disney Method Session. Thema: <thema>
Befolge fuer alle Spawns den /delegation Skill.

Projekt-Root: (wird automatisch aus dem CWD bestimmt)
Session-Verzeichnis: Althing_CEO/Quickstarts/<SESSION_ID>/

== SCHRITT 1: AGENTEN AUSWAEHLEN ==

list_templates()

Waehle je einen Agenten fuer drei Rollen:
- DREAMER: kreativer, visionaerer Charakter (z.B. JORMUNGANDR, HUGINN)
- REALIST: strukturierter, pragmatischer Charakter (z.B. THOR, VOLUND, SIGURD)
- CRITIC:  kritischer, gruendlicher Charakter (z.B. HEIMDALL, BRUNHILD, GONDUL)

== SCHRITT 2: DREAMER ==

Spawne den Dreamer:

  Template: <dreamer_template>
  Agent_ID: <SESSION_ID>_DREAMER
  No_Session: true
  Cwd: Althing_CEO/Quickstarts/<SESSION_ID>/
  Command:
    Du bist der DREAMER — Raum 1 der Walt Disney Methode.
    Thema: <thema>

    In diesem Raum gibt es keine Grenzen. Alles ist moeglich.
    Denke gross, visionaer, unkonventionell. Kein "das geht nicht".

    - Was ist die idealste Version dieses Vorhabens?
    - Welche Moeglichkeiten existieren wenn Budget, Zeit, Technik kein Problem sind?
    - Was wuerde dich wirklich begeistern?

    Max. 300 Woerter. Sei konkret, nicht vage.

Warte bis fertig (get_agent_status). Lies Output:
  Althing_CEO/Quickstarts/<SESSION_ID>/<SESSION_ID>_DREAMER_OUTPUT.md

== SCHRITT 3: REALIST ==

Spawne den Realist mit dem Dreamer-Output:

  Template: <realist_template>
  Agent_ID: <SESSION_ID>_REALIST
  No_Session: true
  Cwd: Althing_CEO/Quickstarts/<SESSION_ID>/
  Command:
    Du bist der REALIST — Raum 2 der Walt Disney Methode.
    Thema: <thema>

    Der Dreamer hatte folgende Vision:
    <dreamer_output>

    Mach daraus einen umsetzbaren Plan. Behalte die Essenz — bring sie auf den Boden.
    - Welche Schritte sind konkret noetig?
    - Was braucht es an Ressourcen, Zeit, Team?
    - Welche Teile der Vision sind direkt umsetzbar — was muss angepasst werden?

    Max. 300 Woerter. Konkrete Massnahmen, keine Theorie.

Warte bis fertig. Lies Output:
  Althing_CEO/Quickstarts/<SESSION_ID>/<SESSION_ID>_REALIST_OUTPUT.md

== SCHRITT 4: CRITIC ==

Spawne den Critic mit dem Realist-Output:

  Template: <critic_template>
  Agent_ID: <SESSION_ID>_CRITIC
  No_Session: true
  Cwd: Althing_CEO/Quickstarts/<SESSION_ID>/
  Command:
    Du bist der CRITIC — Raum 3 der Walt Disney Methode.
    Thema: <thema>

    Der Realist hat folgenden Plan entwickelt:
    <realist_output>

    Pruefe diesen Plan schonungslos — aber konstruktiv. Ziel ist Verbesserung, nicht Zerstoerung.
    - Groesste Schwachstellen und Risiken?
    - Welche Annahmen sind nicht belegt?
    - Was wurde uebersehen?
    - Welche Fragen muss der Plan noch beantworten?

    Max. 300 Woerter. Praezise — keine allgemeinen Warnungen.

Warte bis fertig. Lies Output:
  Althing_CEO/Quickstarts/<SESSION_ID>/<SESSION_ID>_CRITIC_OUTPUT.md

== SCHRITT 5: SYNTHESIS ==

Erstelle eine Synthese im folgenden Format:

---
🎬 **Walt Disney Method — <thema>**

💭 **Dreamer** _(Was ist moeglich?)_
<3-4 Kernideen>

🔧 **Realist** _(Wie setzen wir es um?)_
<3-4 konkrete Schritte>

🔍 **Critic** _(Was muss noch geloest werden?)_
<3-4 Kernfragen / Schwachstellen>

---
**Naechster Schritt:** <Eine klare Handlungsempfehlung>
---

== SCHRITT 6: TELEGRAM BENACHRICHTIGUNG ==

Schreibe die Synthese als Telegram-Nachricht:

  Datei: Althing_CEO/Quickstarts/<SESSION_ID>/MSG_<SESSION_ID>_COORD_TO_USER.md
  Inhalt: die vollstaendige Synthese von oben

Damit wird der User automatisch per Telegram benachrichtigt.
```

---

## Schritt 3 — Warten und abschliessen

```
get_agent_status(agent_id="<SESSION_ID>_COORD")
```

Pollen bis der Koordinator fertig ist. Dem User kurz bestaetigen:
> "Walt Disney Method zu '<thema>' laeuft — du bekommst das Ergebnis per Telegram."

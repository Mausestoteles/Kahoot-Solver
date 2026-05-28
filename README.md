# Kahoot Solver

Tampermonkey-Userscript, das waehrend einer laufenden Kahoot-Runde automatisch die Frage und die Antwortmoeglichkeiten ausliest, an die OpenAI-API schickt und die wahrscheinlich richtige Antwort im Spiel hervorhebt. Optional kann die Antwort auch automatisch angeklickt werden.

---

## Voraussetzungen

- Ein moderner Browser (Chrome, Edge, Firefox, Brave, Opera, ...)
- Die Browser-Erweiterung **Tampermonkey**
  - Chrome/Edge/Brave: https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
  - Firefox: https://addons.mozilla.org/firefox/addon/tampermonkey/
- Ein **OpenAI API-Key** (beginnt mit `sk-...`)
  - Erstellen unter https://platform.openai.com/api-keys
  - Auf deinem OpenAI-Account muss ein Guthaben hinterlegt sein, sonst liefert die API einen Fehler

---

## Installation

1. Tampermonkey im Browser installieren (Link siehe oben).
2. Auf das Tampermonkey-Icon in der Browser-Leiste klicken und **"Dashboard"** waehlen.
3. Im Dashboard auf den Tab **"+"** (Neues Script erstellen) klicken.
4. Den gesamten vorgegebenen Beispielinhalt loeschen.
5. Den vollstaendigen Inhalt der Datei `kahoot-solver.user.js` aus diesem Ordner hineinkopieren.
6. Datei -> Speichern (oder `Strg + S`).
7. Im Dashboard pruefen, dass das Script aktiviert ist (Schalter rechts auf gruen).

Alternativ: Die Datei `kahoot-solver.user.js` per Drag & Drop in den Browser ziehen. Tampermonkey bietet dann direkt eine Installation an.

---

## Erste Einrichtung

Nachdem das Script installiert ist, muss einmalig der API-Key hinterlegt werden.

1. Eine Kahoot-Seite oeffnen, z. B. https://kahoot.it
2. Auf das Tampermonkey-Icon klicken.
3. Im Untermenue des Scripts **"Kahoot Solver"** auf **"Kahoot Solver: API-Key setzen"** klicken.
4. Den OpenAI API-Key eingeben (`sk-...`) und mit OK bestaetigen.

Der Key wird verschluesselt im Tampermonkey-Speicher abgelegt und ist nach einem Browser-Neustart noch vorhanden.

---

## Bedienung waehrend des Spiels

1. Wie gewohnt einer Kahoot-Runde beitreten (Game-PIN eingeben, Spitzname waehlen).
2. Sobald eine Frage erscheint, blendet das Script oben rechts den Status ein:
   - **"Frage erkannt, denke nach..."** waehrend OpenAI gefragt wird
   - **"Antwort N (xx%)"** sobald die KI geantwortet hat
3. Die wahrscheinlich richtige Antwort wird mit einem **gruenen Glow-Rahmen** markiert.
4. Du klickst die markierte Antwort dann selbst an, **oder** du laesst das Script auto-klicken (siehe unten).

---

## Menue-Befehle

Alle Befehle erreichst du ueber das Tampermonkey-Icon -> Untermenue **"Kahoot Solver"**:

| Befehl | Funktion |
|--------|----------|
| **API-Key setzen** | OpenAI API-Key eintragen oder aendern |
| **Modell waehlen** | OpenAI-Modell festlegen (siehe naechster Abschnitt) |
| **Auto-Klick umschalten** | Automatisches Klicken der richtigen Antwort an/aus |
| **Jetzt aufloesen** | Manueller Trigger, falls eine Frage nicht automatisch erkannt wurde |

Der Status (welches Modell aktiv ist, ob Auto-Klick an ist) wird kurz als Badge oben rechts eingeblendet, wenn du eine Einstellung aenderst.

---

## Modelle

Empfohlene Werte fuer **"Modell waehlen"**:

| Modell | Eigenschaften |
|--------|---------------|
| `gpt-4o-mini` | Sehr schnell, sehr guenstig, ausreichend fuer einfache Fragen |
| `gpt-4o` | Standardempfehlung. Gute Balance aus Tempo und Praezision |
| `gpt-4.1` | Neueres Wissen, sehr praezise, etwas teurer |
| `gpt-4.1-mini` | Schnell + neueres Wissen, mittlerer Preis |
| `o3-mini` | Reasoning-Modell, beste Genauigkeit bei Logik-/Rechenfragen, aber 5-15 Sekunden Antwortzeit (oft zu langsam fuer den Kahoot-Timer) |

Du kannst auch jeden anderen OpenAI-Modellnamen eintragen, sofern er ueber `/v1/chat/completions` mit `response_format: json_object` erreichbar ist.

---

## Auto-Klick

Wenn Auto-Klick aktiv ist, klickt das Script die wahrscheinlichste Antwort sofort nach Erhalt der OpenAI-Antwort selbst an. Der Status-Badge wird dann orange statt gruen, damit du den Modus sofort siehst.

Das Script versucht mehrere Klick-Mechanismen hintereinander (Pointer-Events, Mouse-Events, natives `click()`, React-Handler direkt), damit es zuverlaessig funktioniert. Trotzdem gilt:

- Auto-Klick ist fuer Aussenstehende **sehr offensichtlich**, da die Antwort sofort nach Frage-Anzeige geklickt wird.
- Bei Vorlesefragen oder Bildfragen kann Auto-Klick schneller sein als sinnvoll. In diesem Fall einfach im Menue ausschalten.

---

## Wie funktioniert es?

1. Ein `MutationObserver` ueberwacht den Kahoot-DOM auf Aenderungen (neue Frage erscheint).
2. Sobald Frage + mindestens zwei Antworten gefunden werden, wird der Text extrahiert.
3. Das Script schickt eine POST-Anfrage an `https://api.openai.com/v1/chat/completions` mit dem gewaehlten Modell, `temperature: 0` und `response_format: json_object`.
4. Die KI liefert ein JSON wie `{"index": 2, "confidence": 0.93}` zurueck.
5. Der zugehoerige Antwort-Button bekommt eine CSS-Klasse mit gruenem Glow.
6. Falls Auto-Klick aktiv: Klick wird ueber mehrere Mechanismen ausgeloest.

---

## Kosten

Die OpenAI-API rechnet pro Token ab. Eine typische Kahoot-Frage mit vier Antworten ist sehr kurz; mit `gpt-4o-mini` liegen die Kosten pro Frage bei deutlich unter einem Cent. Auch eine ganze Runde mit 20 Fragen bleibt im einstelligen Cent-Bereich.

Die aktuellen Preise findest du auf https://openai.com/api/pricing

---

## Datenschutz

- Der API-Key wird ausschliesslich lokal in Tampermonkeys Storage gespeichert und nur an `api.openai.com` gesendet.
- Frage und Antworten werden an OpenAI uebertragen (so wie es bei jeder Nutzung der OpenAI-API der Fall ist).
- Es wird nichts an Dritte oder externe Server (ausser OpenAI) geschickt.

---

## Troubleshooting

**Das Skript reagiert gar nicht.**
- Pruefen, ob du auf `https://kahoot.it/*` oder `https://play.kahoot.it/*` bist. Andere Domains werden nicht erkannt.
- Tampermonkey-Icon -> ist das Script aktiviert?
- F12 -> Console: tauchen `[Kahoot Solver]` Logs auf?

**"Kein API-Key" Fehler.**
- Im Menue "API-Key setzen" oeffnen und Key eintragen.

**"HTTP 401" oder "HTTP 429".**
- 401: API-Key ist falsch oder ungueltig.
- 429: Rate Limit oder fehlendes Guthaben auf dem OpenAI-Account.

**Die Antwort ist oft falsch.**
- Pruefe, ob im Menue "Modell waehlen" wirklich `gpt-4o` oder besser eingestellt ist.
- Sehr spezifische Fachfragen koennen mit `gpt-4.1` praeziser werden.

**Bilder werden nicht erkannt.**
- Die aktuelle Version liest nur Text. Reine Bildfragen ohne Text-Hinweis kann das Script nicht beantworten. Eine Erweiterung um die Vision-API ist moeglich.

**Auto-Klick klickt nicht.**
- Skript in Tampermonkey deaktivieren und wieder aktivieren.
- Browser-Tab neu laden.
- Falls das Antwort-Layout von Kahoot sich grundlegend geaendert hat, koennen die DOM-Selektoren in `getAnswerButtons` veralten.

---

## Hinweis zur Verwendung

Dieses Tool ist als technische Demo fuer DOM-Auslesen, Browser-Userscripts und OpenAI-API gedacht. Setze es verantwortungsvoll ein. In Schul-, Uni- oder Wettbewerbskontexten kann der Einsatz gegen Regeln verstossen. Die Verantwortung dafuer liegt bei dir.

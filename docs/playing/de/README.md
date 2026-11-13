# Spielen — DMs-only-Friend

Anleitung für Spielleitung (GM) und Remote-Spieler. Primärziel ist der Tisch (GM-Laptop + TV/Tablet als Spielbrett); Remote-Spieler joinen per Link.

## Rollen

| Rolle | Sicht |
|---|---|
| **GM** | **Settings** für Vorbereitung; **Play** mit kompaktem Game-HUD (Würfel + Initiative links, Fog rechts, untere Leiste) |
| **Player-Screen** | Vollbild-Karte + TCG-Initiative-Leiste; kompakte Kampfdauer / letzte Events; Würfel-Toast bei Rolls; Kamera folgt dem GM |
| **Remote-Spieler** | Wie Player-Screen, plus Steuerung des Tokens für den **beanspruchten PC** (`characterId` oder eindeutiger PC-Name beim Join) |

## GM-Vorbereitung (Settings)

1. Raum auf der Startseite erstellen: **Raumcode**, Tischname und **GM-PIN** (4–8 Ziffern) wählen. Raumcodes: 3–24 Zeichen nach Normalisierung — Unicode-Buchstaben (inkl. ä/ö/ü und ß), Ziffern, `_` und `-`. Speicherung NFC-normalisiert und in Großbuchstaben (`ß` wird zu `SS`, daher kollidieren `straße` und `strasse`). Den **einmaligen GM-Invite** sofort kopieren, öffnen und PIN eingeben.
2. Eine oder mehrere Karten hochladen: PNG/JPG/WebP (`grid_px` setzen) oder Universal VTT `.dd2vtt` (Raster, Wände, Türen und Lichter kommen aus der Datei, wenn vorhanden). Uploads brauchen eine aktive GM-Session. In der GM-Ansicht erscheinen importierte Wände als bernsteinfarbene Overlay-Linien; Türen als dickere Linien (zu vs. offen). Weiche Lichtglows aus der Datei sieht jeder (noch ohne Schattenwurf).
3. In Settings → **Room links** mit **Copy** neben Room join / Screen / Player (und einem geminteten GM-Invite) teilen. Es gibt keine dauerhafte GM-URL — bei Bedarf neuen einmaligen Invite in Settings (oder Startseite mit PIN) erzeugen. Solange eine GM-Session offen ist, kannst du dort die **GM-PIN ändern** (optional ausstehenden Invite invalidieren). Geht die PIN verloren und es gibt keine aktive GM-Session, ist der Tisch nicht wiederherstellbar — es gibt keinen Recovery-Code.
4. PCs und NPCs anlegen (Anzeigename, optionale TP/RK, kurze Notizen, Portrait); Häkchen setzen, auf welchen Karten sie erscheinen.
5. Optional unter **Screen**: Viertel-TP-Balken (25/50/75/100 %) auf dem Player-Screen — standardmäßig aus (genaue PC-TP; Monster verborgen).
6. Für die Session auf **Play** wechseln. Portraits und TP-Chips erscheinen in der Initiative, wenn gesetzt.

## GM-Spiel

Kompaktes **Game-HUD** um die Karte (keine schwebenden Inseln):

- **Links — Dice** — Ausdrücke wie `2d6+3` (oder Quick-Chips), Server-Würfel, letzte Summen. Ergebnisse landen im Session-Log.
- **Links — Initiative** — Runde, aktiver Charakter, **Next**, Reihenfolge setzen (aufklappen), ±1 TP und Bedingungen am Aktiven. **PCs / NPCs anzeigen** steuert die Sichtbarkeit auf dem Brett. Entfernte Tokens/Charaktere fallen aus der Reihenfolge.
- **Rechts — Fog** — kompakte vertikale Icon-Leiste (Pinsel / Rechteck, Größe −/+, Reveal/Hide, Cover/Clear-Augen, LoS-Strahlen; Tür-Icons falls vorhanden). Tür auch per Klick auf der Karte bei Tool **aus** (Hand). Fog für dich durchscheinend, für Screen/Spieler deckend.
- **Untere Leiste** — Kampf **Start** / **Ende** und Timer; **Next turn**; **Log** (standardmäßig eingeklappt); **More** für kompakten Kartenwechsel. Karten-Upload/Raster und NPC-Roster bleiben in **Settings**.

Abschnitte über den Titel einklappen, um Kartenfläche freizugeben. Collapse-Prefs bleiben pro Raumcode im Browser; ältere Insel-/Dock-Layouts werden gelöscht.

Kartenwechsel lädt die verknüpften Charaktere und entfernt die übrigen. Tokens snappen aufs Raster und syncen live. Pan/Zoom der GM-Ansicht folgen Screen und Spieler. Fog wird pro Karte gespeichert. Das erste **Next** startet automatisch einen Kampf, falls keiner läuft.

## Screen / Player

Kein GM-HUD. Die Seitenleiste zeigt Runde, Reihenfolge und aktiven Zug. Standardmäßig können PC-TP als genaue Chips erscheinen und **Monster-TP bleiben nur für die GM sichtbar**. Wenn die GM Viertel-TP aktiviert, zeigt die Leiste grobe 25/50/75/100 %-Balken für PCs und NPCs ohne genaue Zahlen. Kompakte Bedingungs-Badges (z. B. PRN, FRI), wenn die GM sie setzt. Ein schmaler Streifen zeigt Kampfdauer und die letzten Events, wenn vorhanden. Würfelwürfe erscheinen kurz als Toast über der Karte. Pan/Zoom folgt dem GM. Unaufgedeckte Bereiche bleiben unter solidem Fog (inkl. Tokens dort).

## Look & Laterne

Die Oberfläche nutzt ein mittelalterliches Tavernen-Thema. Mit dem **Laternen**-Schalter (Startseite, Settings, Play und Screen) wechselst du zwischen kerzenwarm und dunkler, rauchiger Dungeon-Taverne. Im Kerzenlicht flackert warmes Licht sanft über die ganze Seite (inkl. Chrome und HUD); die rauchige Dungeon-Ansicht bleibt ruhig. Die Wahl bleibt in diesem Browser gespeichert. Die Theme-Schriften liegen in der App, daher wirkt das Look auch im LAN / offline ohne Google-Fonts-Verbindung.

## Schnellstart (Tisch)

1. App starten (Self-Hosting oder lokal `npm run dev`).
2. GM erstellt einen Raum (Code + PIN) → einmaligen GM-Invite öffnen und PIN eingeben.
3. Screen-URL auf dem TV/Tablet öffnen (nur Code; kein PIN).
4. In Settings: Karten und Roster pflegen; dann Play.
5. Optional: Remote-Spielern Join-Links mit `characterId` (oder eindeutigem PC-`name`) schicken, damit sie diesen Roster-PC beanspruchen. GM später mit Code + PIN erneut joinen (funktioniert auch, wenn noch ein neu geminteter Invite aussteht — die Invite-URL braucht man nur für den **ersten** GM-Claim). PIN sicher aufbewahren, solange du nicht als GM verbunden bist.

### Self-Hosting / Join-Links

Für LAN oder Home-Server: Image `ghcr.io/firesh0ot/dms-only-friend` per Compose ziehen (Host-Port standardmäßig **8042**). `.env.example` nach `.env` kopieren und `PUBLIC_ORIGIN` auf die URL setzen, die alle im Browser öffnen (LAN-IP mit Port oder öffentliche HTTPS-Origin hinter dem Reverse-Proxy). Invite- und API-Raumlinks nutzen diese Origin; Copy-Links für Screen/Player in Settings folgen der aktuellen Browser-Origin — die GM-UI also unter derselben öffentlichen URL öffnen, die du teilst.

Optionale Traefik-Labels (`TRAEFIK_ENABLE` / `FQDN`) hängen an bestehendes Traefik — TLS bleibt beim Proxy. Der Proxy muss WebSocket / HTTP-`Upgrade` für Socket.IO durchlassen; hängt die UI bei **Joining room…**, liegt es meist daran. Details: [Developing — Docker / table deploy](../../developing/README.md#docker--table-deploy), [behind your reverse proxy](../../developing/README.md#behind-your-reverse-proxy) und [WebSockets required](../../developing/README.md#websockets-required-joining-room).

## Weiteres

- English: [../en/README.md](../en/README.md)
- Phase-1-Spezifikation: [../../phase-1.md](../../phase-1.md)
- Prep/Play-ADR: [../../decisions/0003-prep-play-ux.md](../../decisions/0003-prep-play-ux.md)
- Play-Game-HUD-ADR: [../../decisions/0024-play-game-hud.md](../../decisions/0024-play-game-hud.md)
- Session-Log-ADR: [../../decisions/0004-session-battle-log.md](../../decisions/0004-session-battle-log.md)
- Tavernen-Theme-ADR: [../../decisions/0005-tavern-theme-lantern.md](../../decisions/0005-tavern-theme-lantern.md)
- Seitenweites Kerzenflackern-ADR: [../../decisions/0019-page-wide-candlelit-flicker.md](../../decisions/0019-page-wide-candlelit-flicker.md)
- Dice-HUD-ADR: [../../decisions/0007-dice-play-island.md](../../decisions/0007-dice-play-island.md)
- dd2vtt-Import-ADR: [../../decisions/0008-dd2vtt-map-import.md](../../decisions/0008-dd2vtt-map-import.md)
- TP-Sichtbarkeit-ADR: [../../decisions/0009-hp-screen-visibility.md](../../decisions/0009-hp-screen-visibility.md)
- Manuelles Fog-ADR: [../../decisions/0010-manual-fog-of-war.md](../../decisions/0010-manual-fog-of-war.md)
- LoS-Fog-ADR: [../../decisions/0016-los-fog-from-walls.md](../../decisions/0016-los-fog-from-walls.md)
- Bedingungen-ADR: [../../decisions/0011-token-conditions.md](../../decisions/0011-token-conditions.md)
- Raum-/GM-Auth-ADR: [../../decisions/0012-room-identity-gm-auth.md](../../decisions/0012-room-identity-gm-auth.md)
- Screen-TP-Viertel-ADR: [../../decisions/0013-screen-hp-quarters.md](../../decisions/0013-screen-hp-quarters.md)
- Spieler-Token-Bind-ADR: [../../decisions/0014-player-token-character-bind.md](../../decisions/0014-player-token-character-bind.md)
- Docker-/GHCR-ADR: [../../decisions/0015-docker-ghcr-packaging.md](../../decisions/0015-docker-ghcr-packaging.md)
- Developing: [../../developing/README.md](../../developing/README.md)

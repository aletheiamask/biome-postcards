# Project page copy (CurseForge / MCPEDL)

Paste-ready text for the project page. Keep it in sync with `README.md` and the website.

## Fields

| Field | Value |
|---|---|
| Name | Biome Postcards |
| Slug | `biome-postcards` (use the same slug on CurseForge and MCPEDL) |
| Game / class | Minecraft Bedrock → Addons |
| Categories | Adventure / Exploration, Decoration, Survival-friendly |
| Summary (max ~120 chars) | Walk into a new biome and get its postcard. Keep 31 postcards in an album and pin them on your wall. |
| Game versions | 1.26.50 and newer (tested on 1.26.63) |
| License | All Rights Reserved (custom, see `LICENSE`) |
| Website | https://tarcoparoni.ropmuang.workers.dev/biome-postcards |
| Wiki | https://tarcoparoni.ropmuang.workers.dev/biome-postcards/wiki |
| Issues / support | Tacoparoni Discord (link on the website) |
| Authors | Marwin5411-Winner, pipothai (Tacoparoni) |
| File | `dist/BiomePostcards-1.0.0.mcaddon` (same file as on the website; the SHA-256 must match) |
| Release type | Release |
| Experimental toggles needed | None |

## Images

Ready-made copies (PNG/GIF, CurseForge has a WebP bug) are in `docs/release/curseforge/media/`:

| Use | File |
|---|---|
| Avatar (CurseForge requires 400×400) | `avatar-400.png` |
| Thumbnail labelled "MCPEDL" (needed for the MCPEDL sync) | `MCPEDL.png`, upload it with the title `MCPEDL` |
| Animated banner (GIF) | `banner-forests.gif`, `banner-cold.gif` (top of the description) |
| Gallery | `shot-boards.png`, `shot-decor.png`, `shot-toast.png`, `shot-toast-foil.png`, `shot-album.png`, `shot-stand.png` |

All of them are real screenshots of the game on Windows. The originals (WebP) are in the website repo, `public/assets/bpc/`.

## Description

```markdown
**Walk into a biome for the first time and its postcard goes into your album**, with the day, the place and your name on it. Take postcards out when you want them, pin them on a Pin Board, make copies for friends, and travel until you have all 31.

Biome Postcards adds no mobs and changes nothing about how the game plays. It gives you a reason to go and see the biomes you have not seen.

## What is in it

- **31 postcards**, one per biome family, covering every biome of the game except rivers. Each is pixel art of its biome
- **Postcard Album**. Comes free with your first postcard and you keep it when you die. Every card has its own slot. Your collection is stored on you, not in the book: lose the album and you lose nothing
- **Pin Board**. Hold a postcard and tap the board to pin it. Build a gallery wall
- **Foil postcards**. Visit a biome at night, in rain, in a thunderstorm or under a full moon and the card turns foil, with a stamp
- **Seven sets**. Finish a set and you get a decoration block: bonsai, frost crystal, hourglass, lily bowl, seashell, glowing geode, portal shard. Finish all seven for the Traveler's Globe
- **Souvenir Stand**. Buy four more decorations with emeralds as your collection grows
- **Copies**. Use a Blank Postcard to copy a card for a friend. A copy does not count as a discovery for them
- **Bonus cards**: Mysterious Land for biomes added by other add-ons, and four festival cards on real-world dates
- **Notification cards**. A new postcard slides in at the top right, with an animated scene of its biome family
- **3D models** for every block

## Recipes

- Postcard Album: 1 book + 2 paper
- Pin Board: 8 sticks around 1 planks
- Blank Postcard: 1 paper + 1 dye
- Souvenir Stand: planks, Blank Postcard, planks / planks, chest, planks

## Good to know

- **Back up your world** before you install, update or remove any add-on. Removing this one removes its items and blocks
- Stable Script API only. **No Beta APIs and no experiments**
- Works in single player, with friends and on dedicated servers. Each player has their own collection
- It replaces no vanilla file. Biomes from other add-ons give a Mysterious Land card
- In an existing world, postcards are not handed out for places you visited before installing. Visit the biome again
- The game may turn achievements off in worlds that use add-ons from outside the Marketplace
- World owners and operators can change the rules with `/bpc:settings` (creative mode, foil, festival cards, owner lock for boards, notification cards). Cheats are not needed
- Languages: English and Thai. For Thai, turn the resource pack on under Settings → Global Resources, then pick ไทย. Switch back to English before you remove or update the pack

Tested on Windows and Bedrock Dedicated Server 1.26.63. Mobile and consoles use the same file. Tell us on Discord if something is off on your device.

## Install

1. Download the `.mcaddon` and open it. Minecraft imports both packs
2. Create or edit a world and turn on **Biome Postcards** under Behavior Packs (the resource pack comes with it)
3. Join the world and walk

## Credits

Made by **Tacoparoni**: Marwin5411-Winner and pipothai.

Full guide and every system in detail: [Wiki](https://tarcoparoni.ropmuang.workers.dev/biome-postcards/wiki)

Thanks for playing! Follow Tacoparoni on Discord and on our website for what we make next: https://tarcoparoni.ropmuang.workers.dev/our-mods

© 2026 Tacoparoni. All Rights Reserved. Free to download and play, on your own worlds, Realms and servers, and to show in videos. Please do not reupload the files or put them behind paid links. Link to this page or to the official website instead.

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
```

## Changelog for the current file (1.0.1)

`tools/curseforge.mjs` sends the first changelog block on this page.

```markdown
Model fixes. Same ids, saves and recipes as 1.0.0: install it over 1.0.0.

- Traveler's Globe no longer flickers when you move the camera
- Golden Compass: no see-through pixels on the case
- Bonsai, Hourglass, Snow Globe, Shell Jar: missing faces are back, you can no longer look into them from above
- Ice Crystals, Portal Shard, Souvenir Stand and the pin of a pinned card: small gaps closed
```

## Changelog for the first file (1.0.0)

```markdown
First release.

- 31 postcards, Postcard Album, Pin Board, foil postcards with four stamps
- Seven sets with decoration rewards, the Traveler's Globe, the Souvenir Stand
- Bonus cards: Mysterious Land and four festival cards
- Animated notification cards, 3D models for every block
- English and Thai
```

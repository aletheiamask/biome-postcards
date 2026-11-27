# Changelog

## Unreleased

- The official page moved to https://tacoparoni.com/biome-postcards. The pack manifests, `CREDITS`, `LICENSE` and `README` point there. The old address still works but is no longer updated

## 1.0.1 (11 Nov 2026) model fixes

Fixes to the 3D block models. Nothing else changed: same ids, same saves, same recipes. Checked in the game client on 11 Nov 2026.

- Traveler's Globe: the sea and the land no longer flicker when you move the camera (the globe was three boxes inside each other; it is now one core with four raised sides)
- Golden Compass: no see-through pixels at the top and bottom of the case
- Bonsai, Hourglass, Snow Globe, Shell Jar: faces that were missing at the step where one part sits on a wider one are back, so you can no longer look into the model from above
- Ice Crystals: the tilted crystals have a bottom face; Portal Shard: the obsidian chunk now sits on the base
- Souvenir Stand: the corner ends of the awning edge are closed; Pin Board: the pin of a pinned card touches the cork instead of floating
- Placed Portal Shards have a collision box that matches the model (it is half a pixel narrower)

## 1.0.0 (11 Nov 2026) first public release

The same add-on as 0.10.0 below, with the version set to 1.0.0 and the ids locked (`content/ids.lock.json`): card ids, item ids and block ids will not change or disappear in later versions.

- Credits and licence: `LICENSE`, `CREDITS.md`, both also inside the two packs of the `.mcaddon`. The manifests carry the authors, the licence and the link to the official page
- The pack description names the developers

## 0.10.0 (10 Nov 2026) in-game review round

Never released on its own. These are the changes after the owner's first check of 0.9.0 in the game client. Notification cards, album, 3D models, placing and pinning were checked in the game client on 11 Nov 2026 (English and Thai).

### Added

- Notification cards: a new postcard, the first album, a finished set and the grand reward now show as a card in the top right corner, built like the Marketplace button of the main menu (animated background scene, item picture, name, animated foreground, corner banner, one shine sweep). Ten themes: forests, frozen lands, dry lands, wetlands, fields and coasts, underground, other worlds, mystery, festival, reward
- A queue per player: cards show one at a time in a fixed order (postcards, album, sets, grand reward), get shorter when more are waiting, and postcards beyond eight waiting merge into one summary card
- Particles around the player now differ per theme
- Setting `toast`: turn the cards off to get the plain title text back
- Debug commands `/bpc:toast <theme | card id | album | set | all | more> [foil]`, `/bpc:demo` and `/bpc:open <page>`
- The showcase world file now carries both packs inside it, so it opens without installing anything
- Album slots: every card you have found has its own slot in the album. Take a postcard out from its detail page or from the take-out list, put it back with "Put back"
- A slot that is empty gets a new print when you visit that biome again (festival cards: during the festival). The action bar tells you
- The album's first page shows whose album it is. Every album item opens the collection of the player who opens it
- Debug command `/bpc:takeall`
- 3D models for every block: the Pin Board has a raised wooden frame, a cork panel, the postcard as a lifted sheet and pins as small studs; the Souvenir Stand is a market stall with posts and a striped awning; the twelve trophies and souvenirs are small sculptures (bonsai, ice crystals, hourglass, lily bowl, seashell, geode, portal shard, globe, snow globe, cactus pot, shell jar, compass) in the colours of the game's own blocks. Each model has a Blockbench project in `art/blockbench/`
- Trophies and souvenirs face the player when placed and have a collision box of their own size

### Changed

- A new postcard goes straight into the album. It no longer lands in the inventory or drops at your feet when the inventory is full. Only the first album still arrives as an item
- The old 64-postcard storage is now the album's back pocket. It holds copies, postcards from friends, postcards from `/give` and spare prints, with their own data kept as it was. Your own original goes back into its slot when that slot is empty
- A foil postcard replaces the plain one in its slot
- "Set complete" used to be a chat line and "you got an album" an action bar line. Both are notification cards now
- `npm run deploy` stops when the game is set to Thai and Global Resources points at another version of the pack, and prints the steps to follow
- The Pin Board item is a flat icon of the board (like the game's item frame). Held in the hand, the old thin block looked like a wooden sign

### Fixed

- Forms: a player can have one set of add-on screens at a time. A second open request within half a second is dropped, and a later one closes a stuck form first. This is hardening after a report of a blank screen when using the album in 0.9.0. The cause was not found and the problem did not come back
- Notification cards: the gold badge in the corner now fits its text. Its background images are 1 or 2 pixels wide and the game kept their proportions, so the badge showed as a small square in the middle of the text (`keep_ratio: false`, checked in the game client on all twelve demo cards)
- Notification cards slide in and out in 0.8 seconds without the bounce and stay for 4 seconds
- The splash particles of the wet theme no longer write Molang errors to the client content log on every card
- Joining a world no longer prints the red chat line "At least one of your resource or behavior packs failed to load". The album and the postcards declared a custom component in their item files, which the game client cannot read (140 content log errors per join). Using these items is now handled through the `itemUse` event

### Good to know

- The add-on now changes one part of the game's HUD: the control that shows `/title` text is wrapped so the card can appear next to it. Titles from the game and from other add-ons look the same as before. If another resource pack replaces that part of the HUD, the cards fall back to plain title text
- Thai text needs the resource pack in Settings → Global Resources. Switch the game language back to English before you remove or update the pack

## 0.9.0 (10 Nov 2026) release candidate

Not released yet. It passes every automated check on the real game engine. It still needs one visual check in the game client. After that it becomes 1.0.0 and the ids are locked with `node tools/build.mjs --lock`.

### Added

- 31 biome postcards covering all 87 counted biome ids of Bedrock 1.26.63, including Dappled Forest and Sulfur Caves
- Discovery loop: one biome check per player every 3 seconds, no input needed, title + particles + sound on a new postcard
- Postcard Album: collection view, store all, take out, sets, make a copy
- Pin Board: 63 card slots through block states, one 32×32 picture per card, foil variants
- Foil postcards with stamps for thunderstorm, full moon, rain and night
- 7 sets with decoration rewards, and the Traveler's Globe for finishing all of them
- Blank Postcard and copies for friends
- Bonus cards: Mysterious Land (biomes from other add-ons, up to 32 per player), Ice Caves (Drop 4 experiment), 4 festival cards on real-world dates
- Souvenir Stand with 4 decorations bought with emeralds
- Settings form `/bpc:settings` and console command `/bpc:config`
- Debug commands: `biomes`, `here`, `giveall`, `reset`, `debug`, `selftest`, `pins`, `pinsclean`
- English and Thai text

### Good to know

- The game may turn achievements off for worlds that use add-ons from outside the Marketplace
- Removing the add-on removes postcards, albums and boards from the world. Back up first
- Postcards are not handed out for biomes visited before installing

### Changed from the original design

The main changes: a 31st card for Sulfur Caves, Pin Board states widened to 63 slots, the board cannot be pushed by pistons, settings live in a world dynamic property instead of pack settings, and the owner lock also covers breaking the board.

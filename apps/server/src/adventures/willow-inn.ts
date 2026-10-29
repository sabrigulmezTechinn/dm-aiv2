import type { Adventure } from './types';

export const willowInn: Adventure = {
  id: 'willow_inn',
  title: { en: 'The Secret of the Willow Inn', tr: "Söğütlü Han'ın Sırrı" },
  blurb: {
    en: "The innkeeper's daughter vanished three nights ago, and something scratches beneath the cellar floor.",
    tr: 'Hancının kızı üç gece önce kayboldu ve mahzen zemininin altından bir şeyler tırmalıyor.',
  },
  recommendedLevel: 1,
  lengthHours: 2,
  startScene: 'willow_inn',
  startQuest: { id: 'q_elin', title: { en: 'Find Elin, the innkeeper\'s daughter', tr: 'Hancının kızı Elin\'i bul' } },
  brief: `ADVENTURE: The Secret of the Willow Inn (levels 1-2, about 2 hours).

PREMISE: The village of Willowmere sits on top of abandoned dwarven mining tunnels. Three nights ago Elin (17), daughter of innkeeper Marta, went down to the cellar for wine and never came back. The villagers think she ran off with a traveller. Marta does not believe it. The hero arrives at the Willow Inn on a rainy evening.

THE TRUTH (reveal only through play): A small cult called the Pale Hand, led by the necromancer Varek Thorn, uses the old tunnels as a hideout. They broke through the back wall of the inn's cellar and kidnapped Elin, because she was born on the night of a lunar eclipse; Varek needs her blood for a ritual that will raise the dead miners buried in the tunnels. The ritual happens at moonrise two nights from now (a soft deadline: if the hero wastes a lot of time, the ritual is further along and there are more undead).

NPCS AT THE INN:
- Marta (innkeeper, 50s, stern, exhausted). Desperate. Offers 50 gold and free lodging forever if Elin is found. Knows Elin went to the cellar. Has the cellar key.
- Old Tobin (retired miner, drunk, by the fireplace). Rambles about "the old dwarf roads under the village" and "the pale lights". If treated kindly or bought a drink (Persuasion DC 10 or 2 gold), he reveals that the cellar wall was once a sealed tunnel entrance and that the tunnels lead to a burial vault of the dwarves who died in a collapse.
- Cael (hooded stranger at a corner table). Secretly a Pale Hand cultist keeping watch on the inn. Polite, evasive. Insight DC 13 reveals he is lying about being a merchant. If exposed or threatened he either flees into the night (and warns the cult: one more cultist in the tunnels) or fights (cultist stats). If charmed or intimidated (DC 15) he can reveal the ritual and the deadline. He carries a bone token shaped like a pale hand.

SCENES:
1. willow_inn (tavern): Starting point. Talk, gather clues, get the key, deal with Cael.
2. inn_cellar (cellar): Barrels, crates, and a freshly broken hole in the back wall. Giant rats (2-3) nest here, drawn by the smell from the tunnels. A torn scrap of Elin's blue shawl is caught on the broken stones (Investigation DC 10 or Perception DC 12). A hidden chest contains a Potion of Healing.
3. old_tunnels (dungeon): Dark dwarven tunnels. Patrol of 2 cultists and 1-2 skeletons. Signs of a dragged body. Dwarven runes warn "here lie the honored dead". A collapsed side passage can be cleared (Athletics DC 13) to reach a forgotten dwarven storeroom with a dwarven warhammer and 30 gold.
4. ritual_chamber (dungeon, same tunnels, the deepest room): Varek Thorn (use bandit_captain stats, named "Varek Thorn") with 2 zombies stands at an altar. Elin is chained to a pillar, alive. Varek monologues if allowed. He can be talked down only with a superb argument (Persuasion DC 20) or tricked. If Varek drops below half HP he tries to flee. Killing or driving off Varek ends the ritual; the zombies collapse.

ENDING: Returning Elin to Marta completes the quest (award 300 XP total across the adventure plus the reward). If Elin dies, the village mourns; the hero may still stop the cult. Use end_adventure when the story reaches a natural conclusion.

TONE: Cozy-creepy. Warm inn, rain outside, dread below.`,
  scenes: {
    willow_inn: {
      id: 'willow_inn',
      name: { en: 'The Willow Inn', tr: 'Söğütlü Han' },
      kind: 'tavern',
      description: 'A warm, smoky common room. Rain hammers the shutters. A long bar to the north, a fireplace on the west wall, a kitchen and a storeroom with the cellar stairs to the east.',
      npcs: [
        { id: 'npc_marta', name: 'Marta', description: 'Stern innkeeper in her fifties, red-eyed from worry.', attitude: 1, anchor: 'behind_bar' },
        { id: 'npc_tobin', name: 'Old Tobin', description: 'Retired miner, drunk, warming his bones by the fire.', attitude: 0, anchor: 'fireplace' },
        { id: 'npc_cael', name: 'Cael', description: 'A hooded stranger nursing a drink at a corner table.', attitude: -1, anchor: 'table_2' },
      ],
      exits: ['inn_cellar'],
    },
    inn_cellar: {
      id: 'inn_cellar',
      name: { en: 'The Inn Cellar', tr: 'Han Mahzeni' },
      kind: 'cellar',
      description: 'Cold, damp cellar full of barrels and crates. The back wall is broken open into darkness. Something squeaks.',
      npcs: [],
      encounter: [{ monsterId: 'giant_rat', count: 2 }],
      exits: ['willow_inn', 'old_tunnels'],
    },
    old_tunnels: {
      id: 'old_tunnels',
      name: { en: 'The Old Dwarven Tunnels', tr: 'Eski Cüce Tünelleri' },
      kind: 'dungeon',
      description: 'Ancient dwarven tunnels carved with runes. Drag marks lead deeper. Distant chanting.',
      npcs: [],
      encounter: [{ monsterId: 'cultist', count: 2 }, { monsterId: 'skeleton', count: 1 }],
      exits: ['inn_cellar', 'ritual_chamber'],
    },
    ritual_chamber: {
      id: 'ritual_chamber',
      name: { en: 'The Ritual Chamber', tr: 'Ayin Odası' },
      kind: 'dungeon',
      description: 'A vaulted burial chamber lit by pale green candles. An altar, a robed man, and a girl in chains.',
      npcs: [
        { id: 'npc_varek', name: 'Varek Thorn', description: 'Gaunt necromancer of the Pale Hand, soft-spoken and certain.', attitude: -3, anchor: 'altar' },
        { id: 'npc_elin', name: 'Elin', description: 'The innkeeper\'s daughter, chained, frightened but defiant.', attitude: 2, anchor: 'deepest' },
      ],
      encounter: [{ monsterId: 'bandit_captain', count: 1, name: 'Varek Thorn' }, { monsterId: 'zombie', count: 2 }],
      exits: ['old_tunnels'],
    },
  },
  mock: {
    opening: {
      en: 'Rain lashes the shutters of the Willow Inn as you step inside, shaking water from your cloak. The common room is warm and smoky. Behind the long bar, a stern woman with red-rimmed eyes polishes the same mug over and over. By the fire, an old man mutters to his ale. In the corner, a hooded stranger watches you over the rim of his cup.',
      tr: 'Söğütlü Han\'ın kepenklerini yağmur döverken içeri adım atıyor, pelerininden suları silkeliyorsun. Ortak salon sıcak ve dumanlı. Uzun barın arkasında gözleri kızarmış, sert yüzlü bir kadın aynı kupayı tekrar tekrar siliyor. Şöminenin başında yaşlı bir adam birasına bir şeyler mırıldanıyor. Köşede, kapüşonlu bir yabancı bardağının üzerinden seni süzüyor.',
    },
    choices: {
      willow_inn: [
        { en: 'Talk to the innkeeper', tr: 'Hancıyla konuş' },
        { en: 'Buy the old man a drink', tr: 'Yaşlı adama bir içki ısmarla' },
        { en: 'Watch the hooded stranger', tr: 'Kapüşonlu yabancıyı gözle' },
        { en: 'Go down to the cellar', tr: 'Mahzene in' },
      ],
      inn_cellar: [
        { en: 'Search the cellar', tr: 'Mahzeni ara' },
        { en: 'Climb through the broken wall', tr: 'Kırık duvardan geç' },
        { en: 'Go back upstairs', tr: 'Yukarı dön' },
      ],
      old_tunnels: [
        { en: 'Follow the drag marks', tr: 'Sürüklenme izlerini takip et' },
        { en: 'Sneak toward the chanting', tr: 'İlahilere doğru gizlice ilerle' },
        { en: 'Study the dwarven runes', tr: 'Cüce rünlerini incele' },
      ],
      ritual_chamber: [
        { en: 'Attack Varek', tr: 'Varek\'e saldır' },
        { en: 'Try to talk him down', tr: 'Onu ikna etmeye çalış' },
        { en: 'Free Elin', tr: 'Elin\'i kurtar' },
      ],
    },
  },
};

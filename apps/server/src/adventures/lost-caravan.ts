import type { Adventure } from './types';

export const lostCaravan: Adventure = {
  id: 'lost_caravan',
  title: { en: 'The Lost Caravan', tr: 'Kayıp Kervan' },
  blurb: {
    en: 'A merchant caravan vanished on the forest road. The trail leads to a cave full of goblins with a problem of their own.',
    tr: 'Bir tüccar kervanı orman yolunda kayboldu. İz, kendi dertleri olan goblinlerle dolu bir mağaraya çıkıyor.',
  },
  recommendedLevel: 1,
  lengthHours: 2,
  startScene: 'forest_road',
  startQuest: { id: 'q_caravan', title: { en: 'Find the lost caravan of Doran Kesk', tr: 'Doran Kesk\'in kayıp kervanını bul' } },
  brief: `ADVENTURE: The Lost Caravan (levels 1-2, about 2 hours).

PREMISE: The hero was hired in the town of Thornbury by the Merchants' Guild to find a caravan led by Doran Kesk that never arrived. It carried medicine for a fever spreading in Thornbury, so time matters. The hero starts on the forest road where the caravan was last seen.

THE TRUTH: Goblins of the Torn Ear tribe ambushed the caravan and dragged Doran and his guard Lysa to their cave. But the goblins are not simply raiders: an ogre named Grummash moved into the deep part of their cave and demands tribute. The goblin boss Skrag raids caravans to feed the ogre. Skrag would happily make a deal with anyone who kills or drives off Grummash. This is the key twist: the hero can fight the goblins OR negotiate with Skrag, and Grummash must be outwitted rather than fought.

SCENES:
1. forest_road (outdoor): Muddy road through dark pines. The wrecked caravan: an overturned wagon, broken crates, dead horses, arrows with crude black fletching (goblin). Tracks lead north into the woods (Survival DC 10). A survivor, the young driver Pell, hides in a hollow tree (Perception DC 13); he saw goblins take Doran and Lysa alive. ONE wolf feeds on a dead horse (two wolves only on hard difficulty; encounter if the hero approaches carelessly; can be scared off with fire or Animal Handling DC 13).
2. goblin_cave (cave): A cave in a hillside. Inside: a goblin camp with a campfire, stolen crates (the medicine is here, intact). The fight here is exactly 2 goblins plus Skrag (no extra lookouts or reinforcements). Lysa is tied up near the camp. Skrag the goblin boss (goblin_boss stats, named "Skrag") will parley if the hero shows strength or offers something.
3. ogre_den (cave, deepest part): Grummash the ogre sleeps on a pile of bones. Doran Kesk is in a cage here, meant as the ogre's next meal. Grummash is an OBSTACLE, NOT a fight: a level 1 hero cannot beat him in melee, so do NOT call start_combat against him. Overcome him by (a) negotiation: Grummash is dim but proud, flattery or food distracts him (Deception/Persuasion DC 14); (b) a trap: collapse the rotten ceiling beam or the bone heap onto him, or lure him over the cave's pit or into the cold stream (Investigation DC 12 to spot the weak beam, then Athletics/Sleight of Hand DC 13 to spring it); or (c) an alliance: Skrag and his goblins help drive him out if the hero made peace with them. If the hero attacks anyway, narrate that Grummash swats them aside and let them retreat, flee, or be captured; never run it as a straight fight.

POSSIBLE PATHS: Sneak in and rescue the prisoners; fight the goblins; ally with Skrag against the ogre (Skrag's goblins then help, and the goblins return the medicine); or trick the ogre into a trap or into fighting the goblins.

ENDING: Returning Doran (and ideally the medicine) to Thornbury completes the quest. Reward: 75 gold from the guild. Award around 300 XP across the adventure. If the medicine is lost, Thornbury suffers; note it as a consequence. Use end_adventure when the story reaches a natural conclusion.

TONE: Pulpy adventure with a moral wrinkle — the goblins are desperate, not just evil.`,
  scenes: {
    forest_road: {
      id: 'forest_road',
      name: { en: 'The Forest Road', tr: 'Orman Yolu' },
      kind: 'outdoor',
      description: 'A muddy road through dark pines. An overturned wagon, broken crates, dead horses, goblin arrows. Tracks lead north.',
      npcs: [{ id: 'npc_pell', name: 'Pell', description: 'A terrified young wagon driver hiding in a hollow tree.', nameTr: 'Pell', descriptionTr: 'Oyuk bir ağacın içine saklanmış, dehşete düşmüş genç bir araba sürücüsü.', attitude: 1 }],
      encounter: [{ monsterId: 'wolf', count: 1 }],
      encounterHard: [{ monsterId: 'wolf', count: 2 }],
      exits: ['goblin_cave'],
    },
    goblin_cave: {
      id: 'goblin_cave',
      name: { en: 'The Torn Ear Cave', tr: 'Yırtık Kulak Mağarası' },
      kind: 'cave',
      description: 'A smoky goblin cave. A campfire, stolen crates, crude bedding. Deeper passages lead into darkness.',
      npcs: [
        { id: 'npc_skrag', name: 'Skrag', description: 'Scarred goblin boss with one torn ear, clever and nervous.', nameTr: 'Skrag', descriptionTr: 'Tek kulağı yırtık, yara izli goblin şefi; kurnaz ve gergin.', attitude: -1, anchor: 'camp' },
        { id: 'npc_lysa', name: 'Lysa', description: 'Caravan guard, bruised and tied up, furious.', nameTr: 'Lysa', descriptionTr: 'Kervanın muhafızı; hırpalanmış, bağlı ve öfkeli.', attitude: 2, anchor: 'middle' },
      ],
      encounter: [{ monsterId: 'goblin', count: 2 }, { monsterId: 'goblin_boss', count: 1, name: 'Skrag' }],
      exits: ['forest_road', 'ogre_den'],
    },
    ogre_den: {
      id: 'ogre_den',
      name: { en: "The Ogre's Den", tr: 'Ogre İni' },
      kind: 'cave',
      description: 'The stinking deep cave. A heap of bones, a crude cage, and a sleeping ogre. Grummash is an obstacle to be overcome by negotiation (flattery, food), a trap (a rotten ceiling beam, the bone heap, a pit) or an alliance with the goblins, not a straight fight.',
      npcs: [
        { id: 'npc_grummash', name: 'Grummash', description: 'A huge, dim, proud ogre.', nameTr: 'Grummash', descriptionTr: 'Kocaman, ağır kafalı, gururlu bir ogre.', attitude: -2, anchor: 'camp' },
        { id: 'npc_doran', name: 'Doran Kesk', description: 'Portly caravan master, caged, trying to stay dignified.', nameTr: 'Doran Kesk', descriptionTr: 'Toplu yapılı kervan ağası; kafeste, onurunu korumaya çalışıyor.', attitude: 2, anchor: 'middle' },
      ],
      exits: ['goblin_cave'],
    },
  },
  mock: {
    opening: {
      en: 'The forest road is a ribbon of mud between black pines. Ahead, a wagon lies on its side, crates split open, two horses dead in their traces. Crude black-fletched arrows jut from the wood. From somewhere behind the wreck comes a wet, tearing sound.',
      tr: 'Orman yolu, kara çamların arasında çamurdan bir şerit. İleride bir araba yan yatmış, sandıklar parçalanmış, iki at koşumlarında ölü. Tahtaya saplanmış kaba, siyah tüylü oklar görüyorsun. Enkazın arkasından ıslak, yırtılan bir ses geliyor.',
    },
    choices: {
      forest_road: [
        { en: 'Approach the wreck carefully', tr: 'Enkaza dikkatlice yaklaş' },
        { en: 'Look for tracks', tr: 'İz ara' },
        { en: 'Call out for survivors', tr: 'Hayatta kalan var mı diye seslen' },
        { en: 'Follow the trail north', tr: 'Kuzeydeki izi takip et' },
      ],
      goblin_cave: [
        { en: 'Sneak into the camp', tr: 'Kampa gizlice sız' },
        { en: 'Demand to speak to their boss', tr: 'Şefleriyle konuşmak iste' },
        { en: 'Offer Skrag an alliance against the ogre', tr: 'Skrag\'a ogreye karşı ittifak öner' },
        { en: 'Charge in', tr: 'Hücum et' },
      ],
      ogre_den: [
        { en: 'Free Doran quietly', tr: 'Doran\'ı sessizce kurtar' },
        { en: 'Wake the ogre and bargain', tr: 'Ogreyi uyandırıp pazarlık et' },
        { en: 'Set a trap for the ogre', tr: 'Ogre için tuzak kur' },
      ],
    },
  },
};

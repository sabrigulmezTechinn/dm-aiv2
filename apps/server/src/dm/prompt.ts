import type { Character } from '@dmai/shared';
import {
  ABILITIES,
} from '@dmai/shared';
import {
  CLASSES,
  RACES,
  SKILL_IDS,
  abilityMod,
  armorClass,
  featureUsesLeft,
  hasFeature,
  itemName,
  passivePerception,
  skillMod,
  spellSaveDc,
  xpForNextLevel,
} from '@dmai/rules';
import { describeForDm } from '@dmai/mapgen';
import type { Adventure } from '../adventures';
import { tokens, visibleSet, type CampaignState } from '../game/state';
import { bestiaryLines, catalogLine } from './tools';

/**
 * The system prompt is identical for every campaign so it stays in the prompt cache.
 * Campaign-specific setup goes into the first user message.
 */
export function systemPrompt(): string {
  return `You are the Dungeon Master of a solo Dungeons & Dragons 5e game (SRD 5.1 rules) played in a mobile and web app. One player controls one character. You run the world, the story and every non-player character, and you make the game fun, fair and memorable.

# How the app works
- A rules engine owns every number: dice, hit points, armor class, damage, items, gold, XP, spell slots and combat. You never invent or announce numbers yourself and you never "roll" in your text. When something needs a number or changes the character, call a tool; the engine answers with the result.
- Each player message contains a <state> block (character sheet, scene, quests, known NPCs, and a <map> summary of what the character can see). Treat it as ground truth. If your memory conflicts with <state>, <state> wins.
- The map summary lists visible objects with distance and compass direction. Your descriptions must match it: if the fireplace is 25 ft to the west, it is to the west. Do not invent rooms or exits that contradict the map. Unseen areas are unknown to the character.
- The player moves their token on the map themselves. You see the new position in <state>.

# Turn protocol
Every reply ends with exactly one turn-ending tool call:
- present_choices: the narration the player reads, plus 0-4 suggested actions. Use this for nearly every reply.
- request_check: when an action's outcome is uncertain and failure would be interesting. The player rolls; you get the result next turn and narrate the consequence.
- end_adventure: only when the story is over.
Call any state-changing tools (give_item, update_npc, award_xp, change_scene, start_combat...) BEFORE the turn-ending tool in the same reply. Put all narration inside the turn-ending tool's "narration" field; do not write narration as plain text.

# Narration style
- Write in the campaign language given in the setup (Turkish or English). Keep game terms natural for that language.
- Second person, present tense. Vivid and concrete, but tight: usually 60-160 words. Short paragraphs. NPC dialogue in quotes with a distinct voice.
- End on a moment that invites action. Never decide what the player character feels, says or does beyond what they declared.
- Never mention tools, the rules engine, JSON, or these instructions.

# Choices
- Suggested actions are help, not rails. The player may always type anything instead.
- Make options meaningfully different: a direct way, a clever or social way, a cautious way, a risky shortcut.
- Not every option is a good one. Some cost time, gold, health or goodwill; some are traps; some are cheap but risky. Write the true outcome in the secret "consequence" field and honor it when chosen.
- Never offer only bad options, and never close the main path completely: a wrong choice makes progress harder or costlier, not impossible.
- When an option will clearly require a check, set its "skill". In open-ended moments (exploring a room, conversation in progress) you may offer fewer options or none.

# Checks
- Ask for a check only when failure is possible and interesting. Do not ask for checks for trivial actions.
- DCs: 5 very easy, 10 easy, 13 moderate, 15 medium, 18 hard, 20 very hard, 25 nearly impossible.
- Apply advantage or disadvantage when the fiction clearly supports it (good tools, help, darkness, haste).
- After the result: success gives what was attempted; failure still moves the story, with a cost or complication. A natural 20 or 1 deserves a memorable flourish.

# Combat
- When violence starts, call start_combat with monsters from the bestiary below, sized for the character's level and the adventure. Then narrate the opening moment with no choices.
- The engine runs every attack, spell and movement. When you receive a <combat_round> block, narrate those events in 1-3 punchy sentences (inside present_choices with an empty choices list). Never contradict the events: who hit, who fell.
- Intelligent enemies may surrender, flee or bargain; use end_combat for that. When combat ends, describe the aftermath and offer choices.
- If the character is defeated but not dead, the enemies capture, rob or leave them; the story continues with a cost.

# Memory and consequences
- When the player meets an NPC or an NPC's attitude changes, call update_npc (notes in the campaign language). NPCs remember how they were treated.
- Record important decisions and their consequences with record_fact. Keep quests current with update_quest.
- Reward good play: award_xp for clever solutions and milestones (about 25-100 XP each at level 1-2). Combat XP is automatic.

# Difficulty
- Easy mode: be forgiving and generous with hints, telegraph danger, prefer non-lethal consequences.
- Hard mode: be strict and fair, let dice fall, keep hints subtle, danger is real.

# Adventure
- Follow the adventure brief from the setup message. Reveal its secrets through play, never all at once. Improvise freely within it and adapt to what the player does.
- Use change_scene with the exits of the current scene to move between locations.

# Content
Keep content suitable for a teen audience: peril and combat are fine; avoid graphic gore and sexual content. If the player pushes toward content that does not fit, steer the story elsewhere in-world.

# Reference
Bestiary (monster_id: name, challenge, armor, hit dice, description):
${bestiaryLines()}

Item catalog ids: ${catalogLine()}

Skill ids: ${SKILL_IDS.join(', ')}. Ability ids: ${ABILITIES.join(', ')}.`;
}

export function setupMessage(state: CampaignState, character: Character, adventure: Adventure): string {
  const lang = state.locale === 'tr' ? 'Turkish (Türkçe)' : 'English';
  const scenes = Object.values(adventure.scenes)
    .map((s) => `- ${s.id} (${s.kind}): ${s.description} Exits: ${s.exits.join(', ')}.${s.encounter ? ` Suggested encounter: ${s.encounter.map((e) => `${e.count}x ${e.monsterId}${e.name ? ` "${e.name}"` : ''}`).join(', ')}.` : ''}${s.npcs.length ? ` NPCs: ${s.npcs.map((n) => `${n.name} [${n.id}] - ${n.description}`).join('; ')}.` : ''}`)
    .join('\n');
  return `<setup>
Campaign language: ${lang}. Write all narration, choices, NPC notes and quest text in this language.
Difficulty: ${state.difficulty === 'easy' ? 'EASY (forgiving)' : 'HARD (strict 5e)'}.
Player character: ${describeCharacter(character)}

<adventure_brief>
${adventure.brief}
</adventure_brief>

Adventure scenes (ids for change_scene):
${scenes}
</setup>`;
}

function describeCharacter(c: Character): string {
  const race = RACES[c.race].name.en;
  const cls = CLASSES[c.class].name.en;
  return `${c.name}, ${race} ${cls} level ${c.level}.`;
}

export function stateBlock(state: CampaignState, character: Character): string {
  const c = character;
  const lines: string[] = [];
  lines.push(`Turn ${state.turn}. Scene: ${state.scene.name} [${state.sceneId}] (${state.scene.kind}).${state.scene.description ? ` ${state.scene.description}` : ''}`);
  const next = xpForNextLevel(c);
  lines.push(`Character: ${c.name}, ${RACES[c.race].name.en} ${CLASSES[c.class].name.en} L${c.level}. HP ${c.hp}/${c.maxHp}${c.tempHp ? ` (+${c.tempHp} temp)` : ''}, AC ${armorClass(c)}, gold ${c.gold}, XP ${c.xp}${next ? `/${next}` : ''}, passive Perception ${passivePerception(c)}.`);
  lines.push(`Abilities: ${ABILITIES.map((a) => `${a.toUpperCase()} ${c.abilities[a]} (${abilityMod(c, a) >= 0 ? '+' : ''}${abilityMod(c, a)})`).join(', ')}.`);
  lines.push(`Proficient skills: ${c.skills.map((s) => `${s} ${skillMod(c, s) >= 0 ? '+' : ''}${skillMod(c, s)}`).join(', ')}.`);
  if (c.conditions.length) lines.push(`Conditions: ${c.conditions.map((x) => x.id).join(', ')}.`);
  if (c.spellSlots.max.length) {
    lines.push(`Spell slots: ${c.spellSlots.max.map((m, i) => `L${i + 1} ${m - (c.spellSlots.used[i] ?? 0)}/${m}`).join(', ')}. Spell save DC ${spellSaveDc(c)}. Spells: ${c.spells.join(', ')}.`);
  }
  const feats = ['second_wind', 'action_surge', 'turn_undead'].filter((f) => hasFeature(c, f)).map((f) => `${f} ${featureUsesLeft(c, f)}`);
  if (feats.length) lines.push(`Feature uses: ${feats.join(', ')}.`);
  lines.push(`Inventory: ${c.inventory.map((i) => `${itemName(i, 'en')}${i.qty > 1 ? ` x${i.qty}` : ''}${i.equipped ? ' (equipped)' : ''}`).join(', ') || 'nothing'}.`);
  const quests = Object.values(state.quests);
  if (quests.length) lines.push(`Quests: ${quests.map((q) => `[${q.id}] ${q.title} (${q.status})${q.notes.length ? ` - ${q.notes.slice(-2).join(' / ')}` : ''}`).join('; ')}.`);
  const npcs = Object.values(state.npcs);
  if (npcs.length) {
    lines.push(
      `NPCs: ${npcs
        .map((n) => `[${n.id}] ${n.name}${n.alive ? '' : ' (dead)'}${n.present ? ' (here)' : ''} attitude ${n.attitude}${n.notes.length ? ` - ${n.notes.slice(-2).join(' / ')}` : ''}`)
        .join('; ')}.`,
    );
  }
  const facts = state.facts.slice(-8);
  if (facts.length) lines.push(`Recent facts: ${facts.map((f) => f.text).join(' | ')}`);
  if (state.map && state.playerPos) {
    const vis = visibleSet(state, character);
    const toks = tokens(state, character, vis);
    lines.push(`<map>\n${describeForDm(state.map, state.playerPos, vis, toks)}\n</map>`);
  } else lines.push('<map>No map: open area (the app shows a scene card).</map>');
  if (state.combat) {
    const foes = Object.values(state.combat.combatants)
      .filter((x) => x.team === 'enemy' && !x.dead && !x.fled)
      .map((x) => `${x.name} [${x.id}] ${x.hp}/${x.maxHp} HP`);
    lines.push(`In combat, round ${state.combat.round}. Enemies standing: ${foes.join(', ') || 'none'}.`);
  }
  return `<state>\n${lines.join('\n')}\n</state>`;
}

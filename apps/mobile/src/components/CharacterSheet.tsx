import React from 'react';
import { View } from 'react-native';
import type { Character } from '@dmai/shared';
import { ABILITIES } from '@dmai/shared';
import {
  ABILITY_SHORT,
  CLASSES,
  CONDITIONS,
  RACES,
  SKILLS,
  SKILL_IDS,
  SPELLS,
  abilityMod,
  armorClass,
  featureMaxUses,
  featureUsesLeft,
  getItem,
  initiativeMod,
  isExpert,
  itemName,
  passivePerception,
  profBonus,
  saveMod,
  skillMod,
  speed,
  spellAttackMod,
  spellSaveDc,
  xpForNextLevel,
} from '@dmai/rules';
import { useI18n } from '../lib/i18n';
import { colors, radius, space } from '../lib/theme';
import { Bar, Button, Card, Row, Section, Stat, Txt } from './ui';

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function CharacterSheet({
  c,
  onEquip,
  onUse,
  onCast,
}: {
  c: Character;
  onEquip?: (uid: string) => void;
  onUse?: (uid: string) => void;
  onCast?: (spellId: string) => void;
}) {
  const { t, locale } = useI18n();
  const cls = CLASSES[c.class];
  const next = xpForNextLevel(c);
  const features = cls.features.filter((f) => f.level <= c.level);
  return (
    <View style={{ gap: space(4) }}>
      <Card>
        <Row>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.color, borderWidth: 2, borderColor: colors.gold }} />
          <View style={{ flex: 1 }}>
            <Txt variant="h2">{c.name}</Txt>
            <Txt variant="muted">
              {RACES[c.race].name[locale]} {cls.name[locale]} · {t('level')} {c.level}
            </Txt>
          </View>
        </Row>
        <Row>
          <Txt variant="muted" style={{ width: 70 }}>
            {t('hp')} {c.hp}/{c.maxHp}
          </Txt>
          <Bar value={c.hp} max={c.maxHp} style={{ flex: 1 }} height={8} />
        </Row>
        {next ? (
          <Row>
            <Txt variant="muted" style={{ width: 70 }}>
              {t('xp')} {c.xp}/{next}
            </Txt>
            <Bar value={c.xp} max={next} color={colors.gold} style={{ flex: 1 }} />
          </Row>
        ) : null}
        <Row>
          <Stat label={t('ac')} value={armorClass(c)} />
          <Stat label={t('speed')} value={`${speed(c)}`} sub="ft" />
          <Stat label="Init" value={signed(initiativeMod(c))} />
          <Stat label={t('gold')} value={c.gold} />
        </Row>
        {c.conditions.length ? (
          <Txt variant="small" style={{ color: colors.red }}>
            {t('conditions')}: {c.conditions.map((x) => CONDITIONS[x.id].name[locale]).join(', ')}
          </Txt>
        ) : null}
      </Card>

      <Section title={t('abilities')}>
        <Row style={{ flexWrap: 'wrap' }}>
          {ABILITIES.map((a) => (
            <View key={a} style={{ width: '31%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space(2), alignItems: 'center' }}>
              <Txt variant="label">{ABILITY_SHORT[a][locale]}</Txt>
              <Txt variant="h2">{signed(abilityMod(c, a))}</Txt>
              <Txt variant="muted">
                {c.abilities[a]} · {t('saves').slice(0, 3)} {signed(saveMod(c, a))}
                {cls.saves.includes(a) ? ' ●' : ''}
              </Txt>
            </View>
          ))}
        </Row>
      </Section>

      <Section title={`${t('skills')} · prof ${signed(profBonus(c))} · ${passivePerception(c)} ${locale === 'tr' ? 'pasif algı' : 'passive perception'}`}>
        <Card style={{ gap: 4 }}>
          {SKILL_IDS.map((s) => {
            const prof = c.skills.includes(s);
            return (
              <Row key={s} style={{ justifyContent: 'space-between' }}>
                <Txt variant="small" style={{ color: prof ? colors.text : colors.muted }}>
                  {prof ? (isExpert(c, s) ? '◆ ' : '● ') : '○ '}
                  {SKILLS[s].name[locale]} <Txt variant="muted">({ABILITY_SHORT[SKILLS[s].ability][locale]})</Txt>
                </Txt>
                <Txt variant="small" style={{ fontWeight: '700', color: prof ? colors.gold : colors.muted }}>
                  {signed(skillMod(c, s))}
                </Txt>
              </Row>
            );
          })}
        </Card>
      </Section>

      {c.spells.length ? (
        <Section title={`${t('spells')} · DC ${spellSaveDc(c)} · ${signed(spellAttackMod(c))}`}>
          <Row style={{ flexWrap: 'wrap' }}>
            {c.spellSlots.max.map((m, i) => (
              <View key={i} style={{ paddingHorizontal: space(3), paddingVertical: space(1), borderRadius: radius.pill, backgroundColor: colors.surface2 }}>
                <Txt variant="small">
                  {t('spellLevel', { n: i + 1 })}: {'◆'.repeat(m - (c.spellSlots.used[i] ?? 0))}
                  {'◇'.repeat(c.spellSlots.used[i] ?? 0)}
                </Txt>
              </View>
            ))}
          </Row>
          {c.spells.map((id) => {
            const sp = SPELLS[id]!;
            return (
              <Card key={id} style={{ paddingVertical: space(3) }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3">{sp.name[locale]}</Txt>
                    <Txt variant="muted">
                      {sp.level === 0 ? t('cantrip') : t('spellLevel', { n: sp.level })} · {sp.description[locale]}
                    </Txt>
                  </View>
                  {onCast && sp.outOfCombat ? <Button title={t('cast')} small kind="secondary" icon="auto-fix" onPress={() => onCast(id)} /> : null}
                </Row>
              </Card>
            );
          })}
        </Section>
      ) : null}

      <Section title={t('features')}>
        {features.map((f) => {
          const max = featureMaxUses(c, f.id);
          return (
            <Card key={f.id} style={{ paddingVertical: space(3) }}>
              <Txt variant="h3">
                {f.name[locale]}
                {max ? <Txt variant="muted"> · {featureUsesLeft(c, f.id)}/{max}</Txt> : null}
              </Txt>
              <Txt variant="muted">{f.description[locale]}</Txt>
            </Card>
          );
        })}
        <Card style={{ paddingVertical: space(3) }}>
          <Txt variant="h3">{RACES[c.race].name[locale]}</Txt>
          <Txt variant="muted">{RACES[c.race].traitText[locale]}</Txt>
        </Card>
      </Section>

      <Section title={t('inventory')}>
        {c.inventory.map((i) => {
          const def = getItem(i.itemId);
          const usable = def?.type === 'gear' && !!def.use && def.use.kind !== 'light';
          const equippable = def && def.type !== 'gear';
          return (
            <Card key={i.uid} style={{ paddingVertical: space(3) }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Txt variant="h3" style={{ color: i.equipped ? colors.gold : colors.text }}>
                    {itemName(i, locale)}
                    {i.qty > 1 ? ` ×${i.qty}` : ''}
                  </Txt>
                  {i.description || (def?.type === 'gear' && def.description) ? <Txt variant="muted">{i.description ?? (def?.type === 'gear' ? def.description[locale] : '')}</Txt> : null}
                  {def?.type === 'weapon' ? (
                    <Txt variant="muted">
                      {def.damage}
                      {def.versatileDamage ? `/${def.versatileDamage}` : ''} · {def.range ? `${def.range[0]}/${def.range[1]} ft` : 'melee'}
                    </Txt>
                  ) : null}
                  {def?.type === 'armor' ? <Txt variant="muted">{def.category === 'shield' ? '+2' : def.baseAc} AC</Txt> : null}
                </View>
                {onUse && usable ? <Button title={t('use')} small kind="secondary" onPress={() => onUse(i.uid)} /> : null}
                {onEquip && equippable ? <Button title={i.equipped ? t('unequip') : t('equip')} small kind="ghost" onPress={() => onEquip(i.uid)} /> : null}
              </Row>
            </Card>
          );
        })}
      </Section>
    </View>
  );
}

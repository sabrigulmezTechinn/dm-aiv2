import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { Ability, AbilityScores, CharacterDraft, ClassId, RaceId, Skill } from '@dmai/shared';
import { ABILITIES } from '@dmai/shared';
import {
  ABILITY_NAMES,
  ABILITY_SHORT,
  CLASSES,
  CLASS_IDS,
  POINT_BUY_BUDGET,
  RACES,
  RACE_IDS,
  SKILLS,
  STANDARD_ARRAY,
  applyRacialBonuses,
  getItem,
  mod,
  pointBuyCost,
  roll,
  validateDraft,
} from '@dmai/rules';
import { useApp } from '../../lib/app-state';
import { errorText, useI18n, type I18nKey } from '../../lib/i18n';
import { CHARACTER_COLORS, colors, fonts, radius, space } from '../../lib/theme';
import { Button, Card, Chip, Header, Icon, Row, Screen, Section, Txt } from '../../components/ui';

type Method = 'standard' | 'pointbuy' | 'roll';
const STEPS: I18nKey[] = ['step_identity', 'step_race', 'step_class', 'step_abilities', 'step_skills', 'step_review'];

function rollScores(): number[] {
  return Array.from({ length: 6 }, () => {
    const r = roll('4d6');
    const vals = r.dice.map((d) => d.value).sort((a, b) => a - b);
    return vals.slice(1).reduce((a, b) => a + b, 0);
  });
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export default function NewCharacter() {
  const { api } = useApp();
  const { t, locale } = useI18n();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CHARACTER_COLORS[5]!);
  const [race, setRace] = useState<RaceId>('human');
  const [cls, setCls] = useState<ClassId>('fighter');
  const [method, setMethod] = useState<Method>('standard');
  const [scores, setScores] = useState<AbilityScores>({ ...CLASSES.fighter.suggestedArray });
  const [pool, setPool] = useState<number[]>([...STANDARD_ARRAY]);
  const [picked, setPicked] = useState<number | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classDef = CLASSES[cls];
  const raceDef = RACES[race];
  const finalScores = useMemo(() => applyRacialBonuses(scores, race), [scores, race]);
  const raceSkills = raceDef.skills;
  const draft: CharacterDraft = { name, color, race, class: cls, baseAbilities: scores, skills };
  const validation = validateDraft(draft);

  const chooseClass = (c: ClassId) => {
    setCls(c);
    setSkills([]);
    if (method === 'standard') setScores({ ...CLASSES[c].suggestedArray });
  };

  const setMethodAndReset = (m: Method) => {
    setMethod(m);
    setPicked(null);
    if (m === 'standard') {
      setScores({ ...classDef.suggestedArray });
      setPool([...STANDARD_ARRAY]);
    } else if (m === 'pointbuy') setScores({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
    else {
      const rolled = rollScores().sort((a, b) => b - a);
      // Assign rolled scores following the class's suggested priority.
      const order = [...ABILITIES].sort((a, b) => classDef.suggestedArray[b] - classDef.suggestedArray[a]);
      const next = { ...scores };
      order.forEach((a, i) => (next[a] = rolled[i]!));
      setScores(next);
      setPool(rolled);
    }
  };

  // Standard array / rolled: tap a value from the pool, then an ability to swap.
  const assign = (a: Ability) => {
    if (picked === null) return;
    const value = pool[picked]!;
    const current = scores[a];
    const holder = ABILITIES.find((x) => scores[x] === value && x !== a);
    const next = { ...scores, [a]: value };
    if (holder) next[holder] = current;
    setScores(next);
    setPicked(null);
  };

  const bump = (a: Ability, d: number) => {
    const v = scores[a] + d;
    if (v < 8 || v > 15) return;
    const next = { ...scores, [a]: v };
    if (pointBuyCost(next) > POINT_BUY_BUDGET) return;
    setScores(next);
  };

  const toggleSkill = (s: Skill) => {
    if (raceSkills.includes(s)) return;
    if (skills.includes(s)) setSkills(skills.filter((x) => x !== s));
    else if (skills.length < classDef.skillCount) setSkills([...skills, s]);
  };

  const canNext = [
    name.trim().length > 0,
    true,
    true,
    method !== 'pointbuy' || pointBuyCost(scores) <= POINT_BUY_BUDGET,
    skills.length === classDef.skillCount,
    validation.ok,
  ][step];

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const c = await api.createCharacter({ ...draft, name: name.trim() });
      router.replace(`/characters/${c.id}`);
    } catch (e) {
      setError(errorText(locale, (e as { code?: string }).code));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header title={t('createCharacter')} onBack={() => (step > 0 ? setStep(step - 1) : router.back())} />
      <Row gap={1}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.gold : colors.surface3 }} />
        ))}
      </Row>
      <Txt variant="label">
        {step + 1}/{STEPS.length} · {t(STEPS[step]!)}
      </Txt>

      {step === 0 ? (
        <View style={{ gap: space(4) }}>
          <Section title={t('name')}>
            <TextInput
              testID="name-input"
              value={name}
              onChangeText={setName}
              placeholder={t('namePlaceholder')}
              placeholderTextColor={colors.faint}
              maxLength={40}
              style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: space(3), color: colors.text, fontSize: 18, fontFamily: fonts.serif }}
            />
          </Section>
          <Section title={t('tokenColor')}>
            <Row style={{ flexWrap: 'wrap' }}>
              {CHARACTER_COLORS.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={c}
                  onPress={() => setColor(c)}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: 3, borderColor: color === c ? colors.gold : colors.surface }}
                />
              ))}
            </Row>
          </Section>
        </View>
      ) : null}

      {step === 1
        ? RACE_IDS.map((r) => (
            <Card key={r} selected={race === r} onPress={() => setRace(r)} testID={`race-${r}`}>
              <Txt variant="h3">{RACES[r].name[locale]}</Txt>
              <Txt variant="muted">{RACES[r].description[locale]}</Txt>
              <Txt variant="small" style={{ color: colors.gold }}>
                {Object.entries(RACES[r].bonuses)
                  .map(([a, v]) => `${ABILITY_SHORT[a as Ability][locale]} +${v}`)
                  .join(', ')}{' '}
                · {t('speed')} {RACES[r].speed} ft
              </Txt>
              <Txt variant="small">{RACES[r].traitText[locale]}</Txt>
            </Card>
          ))
        : null}

      {step === 2
        ? CLASS_IDS.map((c) => (
            <Card key={c} selected={cls === c} onPress={() => chooseClass(c)} testID={`class-${c}`}>
              <Row>
                <Txt variant="h3" style={{ flex: 1 }}>
                  {CLASSES[c].name[locale]}
                </Txt>
                <Txt variant="muted">{CLASSES[c].role[locale]}</Txt>
              </Row>
              <Txt variant="muted">{CLASSES[c].description[locale]}</Txt>
              <Txt variant="small" style={{ color: colors.gold }}>
                {t('hitDie')} d{CLASSES[c].hitDie} · {t('primary')}: {ABILITY_NAMES[CLASSES[c].primary][locale]} · {t('complexity')}: {'●'.repeat(CLASSES[c].complexity)}
                {'○'.repeat(3 - CLASSES[c].complexity)}
              </Txt>
            </Card>
          ))
        : null}

      {step === 3 ? (
        <View style={{ gap: space(3) }}>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip label={t('standardArray')} selected={method === 'standard'} onPress={() => setMethodAndReset('standard')} />
            <Chip label={t('pointBuy')} selected={method === 'pointbuy'} onPress={() => setMethodAndReset('pointbuy')} />
            <Chip label={t('rollDice')} icon="dice-d20" selected={method === 'roll'} onPress={() => setMethodAndReset('roll')} />
          </Row>
          {method === 'pointbuy' ? (
            <Txt variant="small" style={{ color: colors.gold }}>
              {t('pointsLeft', { n: POINT_BUY_BUDGET - pointBuyCost(scores) })}
            </Txt>
          ) : (
            <View style={{ gap: space(2) }}>
              <Txt variant="muted">{t('assignHint')}</Txt>
              <Row style={{ flexWrap: 'wrap' }}>
                {pool.map((v, i) => (
                  <Chip key={`${v}-${i}`} label={String(v)} selected={picked === i} onPress={() => setPicked(picked === i ? null : i)} />
                ))}
                {method === 'roll' ? <Chip label={t('rollAgain')} icon="dice-d20" onPress={() => setMethodAndReset('roll')} /> : null}
              </Row>
            </View>
          )}
          {ABILITIES.map((a) => {
            const bonus = raceDef.bonuses[a] ?? 0;
            return (
              <Card key={a} onPress={method !== 'pointbuy' ? () => assign(a) : undefined} selected={picked !== null && method !== 'pointbuy'} style={{ paddingVertical: space(2) }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3">{ABILITY_NAMES[a][locale]}</Txt>
                    <Txt variant="muted">
                      {scores[a]}
                      {bonus ? ` + ${bonus} (${t('raceBonus')})` : ''}
                    </Txt>
                  </View>
                  {method === 'pointbuy' ? (
                    <Row>
                      <Button title="−" kind="secondary" small onPress={() => bump(a, -1)} />
                      <Button title="+" kind="secondary" small onPress={() => bump(a, 1)} />
                    </Row>
                  ) : null}
                  <View style={{ width: 64, alignItems: 'center' }}>
                    <Txt variant="h2">{finalScores[a]}</Txt>
                    <Txt variant="muted">{signed(mod(finalScores[a]))}</Txt>
                  </View>
                </Row>
              </Card>
            );
          })}
        </View>
      ) : null}

      {step === 4 ? (
        <View style={{ gap: space(2) }}>
          <Txt variant="small" style={{ color: colors.gold }}>
            {t('chooseSkills', { n: classDef.skillCount })} ({skills.length}/{classDef.skillCount})
          </Txt>
          <Row style={{ flexWrap: 'wrap' }}>
            {raceSkills.map((s) => (
              <Chip key={s} label={`${SKILLS[s].name[locale]} · ${t('fromRace')}`} selected icon="check" />
            ))}
            {classDef.skillChoices
              .filter((s) => !raceSkills.includes(s))
              .map((s) => (
                <Chip key={s} label={`${SKILLS[s].name[locale]} (${ABILITY_SHORT[SKILLS[s].ability][locale]})`} selected={skills.includes(s)} onPress={() => toggleSkill(s)} testID={`skill-${s}`} />
              ))}
          </Row>
        </View>
      ) : null}

      {step === 5 ? (
        <Card>
          <Row>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="shield-sword" color="#1b1408" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="h2">{name}</Txt>
              <Txt variant="muted">
                {raceDef.name[locale]} {classDef.name[locale]} · {t('level')} 1
              </Txt>
            </View>
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            {ABILITIES.map((a) => (
              <View key={a} style={{ width: '30%', alignItems: 'center', padding: space(2), backgroundColor: colors.surface2, borderRadius: radius.md }}>
                <Txt variant="label">{ABILITY_SHORT[a][locale]}</Txt>
                <Txt variant="h3">{finalScores[a]}</Txt>
                <Txt variant="muted">{signed(mod(finalScores[a]))}</Txt>
              </View>
            ))}
          </Row>
          <Txt variant="label">{t('skills')}</Txt>
          <Txt variant="small">{[...skills, ...raceSkills].map((s) => SKILLS[s].name[locale]).join(', ')}</Txt>
          <Txt variant="label">{t('startingGear')}</Txt>
          <Txt variant="small">
            {classDef.startingItems
              .map((i) => `${getItem(i.itemId)?.name[locale] ?? i.itemId}${(i.qty ?? 1) > 1 ? ` ×${i.qty}` : ''}`)
              .join(', ')}
          </Txt>
          {error ? <Txt style={{ color: colors.red }}>{error}</Txt> : null}
        </Card>
      ) : null}

      <Row gap={3}>
        {step > 0 ? <Button title={t('back')} kind="secondary" style={{ flex: 1 }} onPress={() => setStep(step - 1)} /> : null}
        {step < STEPS.length - 1 ? (
          <Button title={t('next')} style={{ flex: 1 }} disabled={!canNext} onPress={() => setStep(step + 1)} testID="next" />
        ) : (
          <Button title={t('create')} icon="check" style={{ flex: 1 }} disabled={!validation.ok} loading={saving} onPress={submit} testID="create" />
        )}
      </Row>
    </Screen>
  );
}

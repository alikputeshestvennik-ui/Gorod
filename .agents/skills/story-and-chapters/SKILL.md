---
name: story-and-chapters
description: How to implement the plot of «Городской маршрут»: characters, chapters unlocked by city population, dialogs, player choices that change game rules, flags and multiple endings. Use for any story, dialog, quest, chapter or ending work, and when story choices must affect simulation numbers.
---

# Story and chapters

The story is the reason to keep growing the city. Read `references/story-bible.md` for characters, chapters and endings before writing or changing story data.

## Principles
- Story is data. Chapters, dialogs, choices live in `data/story/*.json`; the engine in `src/story/` only interprets them.
- A chapter unlocks when its trigger holds (usually `population >= N` plus optional flags/mission done).
- Every important choice has a cost (money, trust, relations, future restrictions). No "correct" option.
- Choices change simulation rules through `effects` (e.g. money now, lock a route zone later), so story and mechanics are one system.
- Relations are numbers (`rel.stepan`, `rel.lidia`, `rel.grach`, `rel.vera`) plus boolean flags. Endings are computed from flags and relations at the final chapter.
- Dialogs are short (3–8 lines), skippable, shown as an overlay; the simulation is paused during dialogs. No long cutscenes.

## Chapter JSON shape
```json
{
  "id": "ch2_growth",
  "title": "chapter.ch2.title",
  "trigger": { "population": 10000, "flagsAll": ["ch1_done"] },
  "scenes": [
    { "id": "s1", "speaker": "grach", "lines": ["ch2.s1.l1", "ch2.s1.l2"],
      "choices": [
        { "text": "ch2.s1.c1", "effects": [{"money": 500000}, {"flag": "took_grach_money"}, {"rel": {"grach": 10}}] },
        { "text": "ch2.s1.c2", "effects": [{"flag": "refused_grach"}, {"rel": {"grach": -10}}] }
      ] }
  ],
  "mission": { "id": "m2", "goal": {"routesBuilt": 3}, "onDone": [{"flag": "ch2_done"}] }
}
```
Text keys resolve through `data/i18n/ru.json`.

## Engine requirements
- Pure functions: `evaluateTriggers(state)`, `applyEffects(state, effects)`, `computeEnding(state)`; unit-test them.
- Story state is part of the save file.
- Debug command to jump to any chapter and set flags, for testing endings.
- Russian text in a natural tone, no bureaucratic wording; each character has a distinct voice (see bible).

import type {
  Pathfinder2CharacterDraftV4,
  Pathfinder2FeatSlotType,
} from '../types'

function emptyFeatSuggestions() {
  return {
    'ancestry-feat': [],
    'class-feat': [],
    'skill-feat': [],
    'general-feat': [],
    'archetype-feat': [],
    'bonus-feat': [],
    'mythic-feat': [],
  } satisfies Record<Pathfinder2FeatSlotType, string[]>
}

export function createDefaultPathfinder2DraftV4(): Pathfinder2CharacterDraftV4 {
  return {
    schemaVersion: 4,
    identity: {
      name: '',
      player: '',
      portrait: '',
      concept: '',
      backstory: '',
      age: '',
      gender: '',
      pronouns: '',
      regionId: null,
      partyRole: '',
      connections: '',
      preliminaryFaith: '',
    },
    progression: {
      level: 1,
      targetLevel: 1,
      creationMode: 'level-1',
      experience: 0,
      heroPoints: 1,
      completedLevels: [],
      choicesByLevel: {},
    },
    ancestry: {
      ancestryId: '',
      heritageId: null,
      versatileHeritageId: null,
      boostMode: 'standard',
      freeBoosts: [],
      voluntaryFlaws: [],
      featChoicesByLevel: {},
    },
    background: {
      backgroundId: '',
      limitedBoost: null,
      freeBoost: null,
    },
    class: {
      classId: '',
      keyAbility: null,
      specializationChoices: {},
      featChoicesByLevel: {},
    },
    attributes: {
      priorities: [],
      finalFreeBoosts: [],
      levelBoosts: {},
    },
    skills: {
      grantedChoiceSelections: {},
      freeSelections: {},
      replacementSelections: {},
      increasesByLevel: {},
      loreEntries: [],
      suggestedSkills: [],
    },
    feats: {
      selectedBySlot: {},
      suggestedSelectionsByType: emptyFeatSuggestions(),
    },
    spellcasting: {
      entries: [],
    },
    inventory: {
      entries: [],
      currency: {
        cp: 0,
        sp: 0,
        gp: 15,
        pp: 0,
      },
    },
    details: {
      deityId: null,
      religionText: '',
      sanctification: 'none',
      personalEdicts: [],
      personalAnathema: [],
      languageChoices: [],
      customLanguages: [],
      notes: '',
    },
    vitals: {
      currentHp: 0,
      tempHp: 0,
    },
    migration: {
      needsReview: false,
      unresolvedSelections: [],
      legacyNotes: {
        lore: '',
        languages: '',
        equipment: '',
      },
      legacySnapshot: null,
    },
  }
}

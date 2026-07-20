export const SCREENS = {
  START: 'start',
  GUIDE: 'guide',
  SURVEY: 'survey',
  DONE: 'done',
};

export function createFlow(guideScript) {
  let screen = SCREENS.START;
  let step = 0;

  return {
    get screen() { return screen; },
    get step() { return step; },
    get line() { return screen === SCREENS.GUIDE ? guideScript[step] : null; },
    start() { screen = SCREENS.GUIDE; step = 0; },
    next() {
      if (screen !== SCREENS.GUIDE) return;
      if (step < guideScript.length - 1) step += 1;
      else screen = SCREENS.SURVEY;
    },
    finishSurvey() { if (screen === SCREENS.SURVEY) screen = SCREENS.DONE; },
    reset() { screen = SCREENS.START; step = 0; },
  };
}

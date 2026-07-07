import { createStore } from 'vuex';

import cabinet from './modules/cabinet';
import personnes from './modules/personnes';
import tournees from './modules/tournees';
import absences from './modules/absences';
import plannings from './modules/plannings';
import ui from './modules/ui';

/**
 * Store racine de l'application.
 *
 * Feature 001 : assemblage des modules uniquement, sans état métier ni
 * persistance. Le plugin de persistance et la mutation `REPLACE_ALL`
 * d'hydratation seront ajoutés en feature 002 (ADR 0005).
 */
export default createStore({
  modules: {
    cabinet,
    personnes,
    tournees,
    absences,
    plannings,
    ui,
  },
});

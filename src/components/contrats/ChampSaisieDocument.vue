<template>
  <div>
    <label :for="idChamp" class="form-label">{{ champ.libelle }}</label>
    <div :class="{ 'input-group': estTaux }">
      <input
        :id="idChamp"
        :value="modelValue"
        :type="estDate ? 'date' : 'text'"
        :inputmode="estNombre ? 'decimal' : null"
        :maxlength="estNombre || estDate ? null : 500"
        class="form-control"
        :class="{ 'is-invalid': Boolean(erreur) }"
        :aria-describedby="idsDescription"
        @input="$emit('update:modelValue', $event.target.value)"
        @blur="$emit('blur')"
      >
      <span v-if="estTaux" class="input-group-text">%</span>
    </div>
    <div v-if="aide" :id="`${idChamp}-aide`" class="form-text">{{ aide }}</div>
    <p v-if="erreur" :id="`${idChamp}-erreur`" class="champ-erreur">
      <PhWarning :size="14" weight="bold" aria-hidden="true" />
      <span>{{ erreur }}</span>
    </p>
  </div>
</template>

<script>
import { PhWarning } from '@phosphor-icons/vue';

/**
 * Saisie d'un champ de la fenêtre « Nouveau document » (0042), selon son type.
 * Présentationnelle : la valeur et l'erreur viennent du parent (Vuelidate).
 */
export default {
  name: 'ChampSaisieDocument',
  components: { PhWarning },
  props: {
    champ: { type: Object, required: true },
    modelValue: { type: String, default: '' },
    erreur: { type: String, default: '' },
    aide: { type: String, default: '' },
    idBase: { type: String, required: true },
  },
  emits: ['update:modelValue', 'blur'],
  computed: {
    idChamp() {
      return `${this.idBase}-${this.champ.id}`;
    },
    estDate() {
      return this.champ.type === 'DATE';
    },
    estTaux() {
      return this.champ.type === 'TAUX_RETROCESSION';
    },
    estNombre() {
      return this.champ.type === 'NOMBRE' || this.estTaux;
    },
    idsDescription() {
      const ids = [];
      if (this.aide) ids.push(`${this.idChamp}-aide`);
      if (this.erreur) ids.push(`${this.idChamp}-erreur`);
      return ids.length ? ids.join(' ') : null;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.champ-erreur {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-1;
  margin: t.$espace-2 0 0;
  color: t.$couleur-erreur;
  font-size: t.$taille-texte-petite;

  svg {
    flex-shrink: 0;
    margin-top: 0.15rem;
  }
}
</style>

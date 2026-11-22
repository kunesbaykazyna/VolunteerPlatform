export function categoryLabel(t, cat) {
  return t(`cat_${cat}`) === `cat_${cat}` ? cat : t(`cat_${cat}`)
}

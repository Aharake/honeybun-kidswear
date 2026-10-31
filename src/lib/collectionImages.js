import newbornImage from '../assets/categories/newborn.webp'
import girlsImage from '../assets/categories/girls.webp'
import boysImage from '../assets/categories/boys.webp'

const BUNDLED = { newborn: newbornImage, girls: girlsImage, boys: boysImage }

export function collectionImage(collection) {
  return collection.image_url || BUNDLED[collection.slug] || null
}

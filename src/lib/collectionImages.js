import newbornImage from '../assets/categories/newborn.jpg'
import girlsImage from '../assets/categories/girls.jpg'
import boysImage from '../assets/categories/boys.jpg'

const BUNDLED = { newborn: newbornImage, girls: girlsImage, boys: boysImage }

export function collectionImage(collection) {
  return collection.image_url || BUNDLED[collection.slug] || null
}

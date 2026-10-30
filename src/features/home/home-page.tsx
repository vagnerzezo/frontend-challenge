import { Hero } from './hero'
import { Catalog } from './catalog'
import { Diary, PromoBanners } from './editorial'

export function HomePage() {
  return (
    <>
      <Hero />
      <Catalog />
      <PromoBanners />
      <Diary />
    </>
  )
}

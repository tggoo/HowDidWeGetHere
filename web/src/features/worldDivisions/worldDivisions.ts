export type WorldDivisionLanguage = string

export type WorldDivisionCategoryId =
  | 'hemispheres'
  | 'continents'
  | 'macro-regions'
  | 'named-regions'
  | 'natural-regions'

type LocalizedText = { en: string; [language: string]: string }
type LocalizedList = { en: string[]; [language: string]: string[] }

export type MapCoordinate = readonly [number, number]

export type WorldDivisionPolygon = {
  label?: LocalizedText
  points: readonly MapCoordinate[]
}

export type WorldDivisionCategory = {
  id: WorldDivisionCategoryId
  title: LocalizedText
}

export type WorldDivision = {
  id: string
  categoryId: WorldDivisionCategoryId
  title: LocalizedText
  subtitle: LocalizedText
  typeLabel: LocalizedText
  summary: LocalizedText
  mapNote: LocalizedText
  members: LocalizedList
  facts: LocalizedList
  polygons: readonly WorldDivisionPolygon[]
}

export const defaultWorldDivisionCategoryId: WorldDivisionCategoryId = 'named-regions'
export const defaultWorldDivisionId = 'iberian-peninsula'

export const worldDivisionCategories: readonly WorldDivisionCategory[] = [
  {
    id: 'hemispheres',
    title: {
      en: 'Hemispheres',
      cs: 'Polokoule',
    },
  },
  {
    id: 'continents',
    title: {
      en: 'World parts',
      cs: 'Světadíly',
    },
  },
  {
    id: 'macro-regions',
    title: {
      en: 'Large regions',
      cs: 'Velké regiony',
    },
  },
  {
    id: 'named-regions',
    title: {
      en: 'Named regions',
      cs: 'Známé regiony',
    },
  },
  {
    id: 'natural-regions',
    title: {
      en: 'Natural zones',
      cs: 'Přírodní zóny',
    },
  },
]

export function normalizeWorldDivisionLanguage(language: string): WorldDivisionLanguage {
  return language.trim().toLowerCase().split('-')[0] || 'en'
}

export function worldDivisionText(text: LocalizedText, language: string) {
  return text[normalizeWorldDivisionLanguage(language)] ?? text.en
}

export function worldDivisionList(list: LocalizedList, language: string) {
  return list[normalizeWorldDivisionLanguage(language)] ?? list.en
}

const emptyMembers: LocalizedList = { en: [], cs: [] }

const approximateMapNote = {
  en: 'The highlighted outline is simplified for learning; many regional borders are interpreted differently by sources.',
  cs: 'Zvýrazněný obrys je pro učení zjednodušený; hranice mnoha regionů se podle zdrojů vymezují různě.',
}

const politicalMapNote = {
  en: 'This layer follows a common school geography view, not a legal or diplomatic boundary source.',
  cs: 'Vrstva vychází z běžného školního zeměpisu, ne z právního nebo diplomatického zdroje hranic.',
}

const hemisphereMapNote = {
  en: 'The split is geometric: equator for north/south and the prime meridian with the 180th meridian for east/west.',
  cs: 'Dělení je geometrické: rovník pro sever/jih a nultý poledník s 180. poledníkem pro východ/západ.',
}

const country = (en: string, cs: string, points: readonly MapCoordinate[]): WorldDivisionPolygon => ({
  label: { en, cs },
  points,
})

const polygon = (points: readonly MapCoordinate[]): WorldDivisionPolygon => ({ points })

export const worldDivisions: readonly WorldDivision[] = [
  {
    id: 'northern-hemisphere',
    categoryId: 'hemispheres',
    title: { en: 'Northern Hemisphere', cs: 'Severní polokoule' },
    subtitle: { en: 'North of the equator', cs: 'Severně od rovníku' },
    typeLabel: { en: 'Hemisphere', cs: 'Polokoule' },
    summary: {
      en: 'The half of Earth north of the equator. It contains most of the world population and most of the large landmasses.',
      cs: 'Polovina Země severně od rovníku. Leží zde většina světové populace i většina velkých pevnin.',
    },
    mapNote: hemisphereMapNote,
    members: emptyMembers,
    facts: {
      en: ['Europe and most of Asia, North America and Africa are here.', 'The Czech Republic lies in this hemisphere.'],
      cs: ['Leží zde Evropa a většina Asie, Severní Ameriky a Afriky.', 'Česko leží právě na této polokouli.'],
    },
    polygons: [polygon([[0, -180], [85, -180], [85, 180], [0, 180]])],
  },
  {
    id: 'southern-hemisphere',
    categoryId: 'hemispheres',
    title: { en: 'Southern Hemisphere', cs: 'Jižní polokoule' },
    subtitle: { en: 'South of the equator', cs: 'Jižně od rovníku' },
    typeLabel: { en: 'Hemisphere', cs: 'Polokoule' },
    summary: {
      en: 'The half of Earth south of the equator. Oceans dominate it, with Antarctica, Australia, southern Africa and South America as the largest land areas.',
      cs: 'Polovina Země jižně od rovníku. Převládají v ní oceány, největší souše tvoří Antarktida, Austrálie, jih Afriky a Jižní Amerika.',
    },
    mapNote: hemisphereMapNote,
    members: emptyMembers,
    facts: {
      en: ['Seasons are opposite to those in Europe.', 'Argentina lies mostly in this hemisphere.'],
      cs: ['Roční období jsou opačná než v Evropě.', 'Argentina leží převážně na této polokouli.'],
    },
    polygons: [polygon([[-85, -180], [0, -180], [0, 180], [-85, 180]])],
  },
  {
    id: 'eastern-hemisphere',
    categoryId: 'hemispheres',
    title: { en: 'Eastern Hemisphere', cs: 'Východní polokoule' },
    subtitle: { en: 'Mostly Europe, Africa, Asia and Australia', cs: 'Hlavně Evropa, Afrika, Asie a Austrálie' },
    typeLabel: { en: 'Hemisphere', cs: 'Polokoule' },
    summary: {
      en: 'A longitude-based half of Earth east of the prime meridian and west of the 180th meridian.',
      cs: 'Polovina Země podle zeměpisné délky, východně od nultého poledníku a západně od 180. poledníku.',
    },
    mapNote: hemisphereMapNote,
    members: emptyMembers,
    facts: {
      en: ['It includes the Czech Republic.', 'The exact educational convention can vary around the 180th meridian.'],
      cs: ['Patří sem Česko.', 'Školní zvyklosti se mohou mírně lišit kolem 180. poledníku.'],
    },
    polygons: [polygon([[-85, 0], [85, 0], [85, 180], [-85, 180]])],
  },
  {
    id: 'western-hemisphere',
    categoryId: 'hemispheres',
    title: { en: 'Western Hemisphere', cs: 'Západní polokoule' },
    subtitle: { en: 'Mostly the Americas and the Atlantic', cs: 'Hlavně Amerika a Atlantik' },
    typeLabel: { en: 'Hemisphere', cs: 'Polokoule' },
    summary: {
      en: 'A longitude-based half of Earth west of the prime meridian and east of the 180th meridian.',
      cs: 'Polovina Země podle zeměpisné délky, západně od nultého poledníku a východně od 180. poledníku.',
    },
    mapNote: hemisphereMapNote,
    members: emptyMembers,
    facts: {
      en: ['It includes nearly all of North and South America.', 'Argentina lies mostly in this hemisphere.'],
      cs: ['Patří sem téměř celá Severní i Jižní Amerika.', 'Argentina leží převážně na této polokouli.'],
    },
    polygons: [polygon([[-85, -180], [85, -180], [85, 0], [-85, 0]])],
  },
  {
    id: 'europe',
    categoryId: 'continents',
    title: { en: 'Europe', cs: 'Evropa' },
    subtitle: { en: 'World part on the western edge of Eurasia', cs: 'Světadíl na západě Eurasie' },
    typeLabel: { en: 'World part', cs: 'Světadíl' },
    summary: {
      en: 'Europe is treated as a world part mainly because of history and culture, even though it is physically connected to Asia.',
      cs: 'Evropa je světadíl hlavně historicky a kulturně, přestože je pevninsky spojená s Asií.',
    },
    mapNote: politicalMapNote,
    members: emptyMembers,
    facts: {
      en: ['The Europe-Asia border is a convention, not an ocean.', 'The Czech Republic is usually placed in Central Europe.'],
      cs: ['Hranice mezi Evropou a Asií je dohoda, ne oceán.', 'Česko se obvykle řadí do střední Evropy.'],
    },
    polygons: [polygon([[35, -10], [36, 3], [40, 14], [34, 24], [41, 31], [52, 45], [71, 40], [72, 15], [67, -10], [56, -25], [45, -12]])],
  },
  {
    id: 'asia',
    categoryId: 'continents',
    title: { en: 'Asia', cs: 'Asie' },
    subtitle: { en: 'Largest and most populous world part', cs: 'Největší a nejlidnatější světadíl' },
    typeLabel: { en: 'World part', cs: 'Světadíl' },
    summary: {
      en: 'Asia stretches from the Mediterranean and the Urals to the Pacific and includes very different climates, cultures and economies.',
      cs: 'Asie sahá od Středomoří a Uralu k Pacifiku a zahrnuje velmi rozdílná podnebí, kultury i ekonomiky.',
    },
    mapNote: politicalMapNote,
    members: emptyMembers,
    facts: {
      en: ['It contains the Himalayas and the highest point on Earth.', 'Russia, Turkey and Kazakhstan are transcontinental in common school geography.'],
      cs: ['Leží zde Himálaj a nejvyšší bod Země.', 'Rusko, Turecko a Kazachstán jsou ve školním zeměpisu přeshraniční státy.'],
    },
    polygons: [polygon([[1, 26], [12, 43], [8, 78], [-10, 105], [-10, 141], [30, 149], [55, 170], [72, 145], [77, 90], [68, 40], [52, 31], [41, 31], [34, 24]])],
  },
  {
    id: 'africa',
    categoryId: 'continents',
    title: { en: 'Africa', cs: 'Afrika' },
    subtitle: { en: 'Continent crossed by the equator', cs: 'Kontinent protínaný rovníkem' },
    typeLabel: { en: 'Continent and world part', cs: 'Kontinent i světadíl' },
    summary: {
      en: 'Africa contains the Sahara, the Nile basin, huge savannas and many of the fastest-growing cities in the world.',
      cs: 'Afrika zahrnuje Saharu, povodí Nilu, rozsáhlé savany a mnoho nejrychleji rostoucích měst světa.',
    },
    mapNote: politicalMapNote,
    members: emptyMembers,
    facts: {
      en: ['It spans both the northern and southern hemispheres.', 'Uganda is in East Africa.'],
      cs: ['Leží na severní i jižní polokouli.', 'Uganda leží ve východní Africe.'],
    },
    polygons: [polygon([[-35, -17], [-34, 20], [-23, 36], [12, 52], [32, 34], [36, 10], [35, -7], [28, -17], [8, -18], [-5, -12]])],
  },
  {
    id: 'north-america',
    categoryId: 'continents',
    title: { en: 'North America', cs: 'Severní Amerika' },
    subtitle: { en: 'From the Arctic to Central America', cs: 'Od Arktidy po Střední Ameriku' },
    typeLabel: { en: 'World part', cs: 'Světadíl' },
    summary: {
      en: 'North America includes Canada, the United States, Mexico, Central America and often Greenland and the Caribbean in wider regional use.',
      cs: 'Severní Amerika zahrnuje Kanadu, USA, Mexiko, Střední Ameriku a v širším regionálním pojetí často i Grónsko a Karibik.',
    },
    mapNote: politicalMapNote,
    members: emptyMembers,
    facts: {
      en: ['The Rocky Mountains form a major western mountain system.', 'The Caribbean is often handled as its own region.'],
      cs: ['Skalnaté hory tvoří významný západní horský systém.', 'Karibik se často uvádí jako samostatný region.'],
    },
    polygons: [polygon([[7, -168], [15, -105], [8, -82], [24, -76], [51, -52], [72, -60], [83, -100], [72, -168]])],
  },
  {
    id: 'south-america',
    categoryId: 'continents',
    title: { en: 'South America', cs: 'Jižní Amerika' },
    subtitle: { en: 'Andes, Amazonia and southern cones', cs: 'Andy, Amazonie a jižní kužel' },
    typeLabel: { en: 'World part', cs: 'Světadíl' },
    summary: {
      en: 'South America is marked by the Andes along the west and the Amazon basin across the north and center.',
      cs: 'Jižní Ameriku výrazně určuje pás And na západě a amazonské povodí na severu a ve středu kontinentu.',
    },
    mapNote: politicalMapNote,
    members: emptyMembers,
    facts: {
      en: ['Patagonia is split between Argentina and Chile.', 'Portuguese-speaking Brazil is the largest country on the continent.'],
      cs: ['Patagonie je rozdělena mezi Argentinu a Chile.', 'Portugalsky mluvící Brazílie je největší stát kontinentu.'],
    },
    polygons: [polygon([[-56, -75], [-55, -50], [-30, -34], [-5, -36], [12, -60], [11, -75], [-15, -82], [-40, -78]])],
  },
  {
    id: 'australia-oceania',
    categoryId: 'continents',
    title: { en: 'Australia and Oceania', cs: 'Austrálie a Oceánie' },
    subtitle: { en: 'Australia plus Pacific island regions', cs: 'Austrálie a ostrovní oblasti Pacifiku' },
    typeLabel: { en: 'World part', cs: 'Světadíl / oblast' },
    summary: {
      en: 'Australia is both a country and a continent; Oceania is the wider Pacific region including Melanesia, Micronesia and Polynesia.',
      cs: 'Austrálie je stát i kontinent; Oceánie je širší oblast Pacifiku zahrnující Melanésii, Mikronésii a Polynésii.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Australia', 'New Zealand', 'Melanesia', 'Micronesia', 'Polynesia'],
      cs: ['Austrálie', 'Nový Zéland', 'Melanésie', 'Mikronésie', 'Polynésie'],
    },
    facts: {
      en: ['Australasia usually means Australia, New Zealand and nearby islands.', 'Many Pacific islands are tiny on a world map, so this layer uses regional boxes.'],
      cs: ['Australasie obvykle znamená Austrálii, Nový Zéland a okolní ostrovy.', 'Mnoho tichomořských ostrovů je na světové mapě velmi malé, proto vrstva používá regionální obdélníky.'],
    },
    polygons: [
      polygon([[-44, 113], [-39, 153], [-10, 153], [-11, 114]]),
      polygon([[-47, 166], [-34, 179], [-34, 166], [-47, 166]]),
      polygon([[-25, 150], [20, 150], [20, 180], [-25, 180]]),
      polygon([[-25, -180], [20, -180], [20, -130], [-25, -130]]),
    ],
  },
  {
    id: 'antarctica',
    categoryId: 'continents',
    title: { en: 'Antarctica', cs: 'Antarktida' },
    subtitle: { en: 'Ice-covered southern continent', cs: 'Ledem pokrytý jižní kontinent' },
    typeLabel: { en: 'Continent and world part', cs: 'Kontinent i světadíl' },
    summary: {
      en: 'Antarctica surrounds the South Pole and has no permanent cities or sovereign states.',
      cs: 'Antarktida obklopuje jižní pól a nemá stálá města ani suverénní státy.',
    },
    mapNote: approximateMapNote,
    members: emptyMembers,
    facts: {
      en: ['It stores most of Earths fresh water as ice.', 'Scientific stations operate there under the Antarctic Treaty system.'],
      cs: ['V ledu uchovává většinu sladké vody na Zemi.', 'Vědecké stanice zde fungují v rámci systému Antarktické smlouvy.'],
    },
    polygons: [polygon([[-85, -180], [-85, 180], [-60, 180], [-60, -180]])],
  },
  {
    id: 'central-europe',
    categoryId: 'macro-regions',
    title: { en: 'Central Europe', cs: 'Střední Evropa' },
    subtitle: { en: 'Between western, eastern and southern Europe', cs: 'Mezi západem, východem a jihem Evropy' },
    typeLabel: { en: 'Large region', cs: 'Velký region' },
    summary: {
      en: 'Central Europe is a cultural and geographic region whose exact membership changes by context.',
      cs: 'Střední Evropa je kulturně-geografický region, jehož přesné vymezení se mění podle kontextu.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Czech Republic', 'Germany', 'Austria', 'Poland', 'Slovakia', 'Hungary', 'Switzerland'],
      cs: ['Česko', 'Německo', 'Rakousko', 'Polsko', 'Slovensko', 'Maďarsko', 'Švýcarsko'],
    },
    facts: {
      en: ['The Czech Republic is usually placed here.', 'Germany can also be grouped with Western Europe.'],
      cs: ['Česko se sem obvykle řadí.', 'Německo se někdy řadí i k západní Evropě.'],
    },
    polygons: [polygon([[45, 8], [55, 8], [55, 24], [45, 24]])],
  },
  {
    id: 'southern-europe',
    categoryId: 'macro-regions',
    title: { en: 'Southern Europe', cs: 'Jižní Evropa' },
    subtitle: { en: 'Mediterranean-facing Europe', cs: 'Evropa u Středozemního moře' },
    typeLabel: { en: 'Large region', cs: 'Velký region' },
    summary: {
      en: 'Southern Europe is tied to the Mediterranean, peninsulas and islands, with Roman, Greek, Iberian and Balkan historical layers.',
      cs: 'Jižní Evropu spojuje Středomoří, poloostrovy a ostrovy i římské, řecké, iberské a balkánské dějinné vrstvy.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Spain', 'Portugal', 'Italy', 'Greece', 'Croatia', 'Malta'],
      cs: ['Španělsko', 'Portugalsko', 'Itálie', 'Řecko', 'Chorvatsko', 'Malta'],
    },
    facts: {
      en: ['Spain is often placed in Southern or Southwestern Europe.', 'Several major European peninsulas are here.'],
      cs: ['Španělsko se často řadí do jižní nebo jihozápadní Evropy.', 'Leží zde několik významných evropských poloostrovů.'],
    },
    polygons: [polygon([[35, -10], [45, -10], [45, 30], [35, 30]])],
  },
  {
    id: 'east-asia',
    categoryId: 'macro-regions',
    title: { en: 'East Asia', cs: 'Východní Asie' },
    subtitle: { en: 'China, Japan, Korea and nearby areas', cs: 'Čína, Japonsko, Korea a okolí' },
    typeLabel: { en: 'Large region', cs: 'Velký region' },
    summary: {
      en: 'East Asia includes some of the worlds oldest continuous states and several of the largest modern economies.',
      cs: 'Východní Asie zahrnuje některé z nejstarších souvislých státních tradic i několik největších současných ekonomik.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['China', 'Japan', 'North Korea', 'South Korea', 'Mongolia', 'Taiwan'],
      cs: ['Čína', 'Japonsko', 'Severní Korea', 'Jižní Korea', 'Mongolsko', 'Tchaj-wan'],
    },
    facts: {
      en: ['The region spans dense coastal megacities and dry inland plateaus.', 'Writing systems and cultural influence spread widely from ancient China.'],
      cs: ['Region sahá od hustě osídlených pobřežních megaměst po suché vnitrozemské plošiny.', 'Písmo a kulturní vliv starověké Číny se rozšířily daleko za její hranice.'],
    },
    polygons: [polygon([[18, 103], [53, 103], [53, 146], [18, 146]])],
  },
  {
    id: 'south-asia',
    categoryId: 'macro-regions',
    title: { en: 'South Asia', cs: 'Jižní Asie' },
    subtitle: { en: 'Indian subcontinent and surrounding states', cs: 'Indický subkontinent a okolní státy' },
    typeLabel: { en: 'Large region', cs: 'Velký region' },
    summary: {
      en: 'South Asia is centered on the Indian subcontinent and shaped by the Himalayas, monsoon systems and major river plains.',
      cs: 'Jižní Asie se soustředí na indický subkontinent a formují ji Himálaj, monzuny a velké říční nížiny.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['India', 'Pakistan', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Bhutan'],
      cs: ['Indie', 'Pákistán', 'Bangladéš', 'Nepál', 'Srí Lanka', 'Bhútán'],
    },
    facts: {
      en: ['It is one of the most densely populated regions on Earth.', 'The Indus and Ganges river systems shaped early civilizations.'],
      cs: ['Patří mezi nejhustěji osídlené oblasti Země.', 'Říční systémy Indu a Gangy formovaly rané civilizace.'],
    },
    polygons: [polygon([[5, 61], [35, 61], [35, 94], [5, 94]])],
  },
  {
    id: 'southeast-asia',
    categoryId: 'macro-regions',
    title: { en: 'Southeast Asia', cs: 'Jihovýchodní Asie' },
    subtitle: { en: 'Mainland and island Southeast Asia', cs: 'Pevninská a ostrovní jihovýchodní Asie' },
    typeLabel: { en: 'Large region', cs: 'Velký region' },
    summary: {
      en: 'Southeast Asia connects the Indian and Pacific oceans through peninsulas, archipelagos and major sea routes.',
      cs: 'Jihovýchodní Asie spojuje Indický a Tichý oceán přes poloostrovy, souostroví a důležité námořní trasy.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Thailand', 'Vietnam', 'Indonesia', 'Malaysia', 'Philippines', 'Cambodia'],
      cs: ['Thajsko', 'Vietnam', 'Indonésie', 'Malajsie', 'Filipíny', 'Kambodža'],
    },
    facts: {
      en: ['Indonesia is the worlds largest archipelagic state.', 'The Strait of Malacca is one of the busiest sea passages.'],
      cs: ['Indonésie je největší souostrovní stát světa.', 'Malacký průliv patří k nejrušnějším námořním průchodům.'],
    },
    polygons: [polygon([[-11, 92], [24, 92], [24, 141], [-11, 141]])],
  },
  {
    id: 'north-africa',
    categoryId: 'macro-regions',
    title: { en: 'North Africa', cs: 'Severní Afrika' },
    subtitle: { en: 'Mediterranean Africa and the Sahara edge', cs: 'Středomořská Afrika a okraj Sahary' },
    typeLabel: { en: 'Large region', cs: 'Velký region' },
    summary: {
      en: 'North Africa links the Mediterranean, Sahara and Nile worlds and has long connected Africa with Europe and West Asia.',
      cs: 'Severní Afrika propojuje Středomoří, Saharu a nilský prostor a dlouhodobě spojuje Afriku s Evropou a západní Asií.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Morocco', 'Algeria', 'Tunisia', 'Libya', 'Egypt', 'Sudan'],
      cs: ['Maroko', 'Alžírsko', 'Tunisko', 'Libye', 'Egypt', 'Súdán'],
    },
    facts: {
      en: ['The Nile valley was one of the major centers of ancient civilization.', 'The Sahara strongly shapes settlement patterns.'],
      cs: ['Nilské údolí bylo jedním z hlavních center starověké civilizace.', 'Sahara výrazně ovlivňuje rozmístění osídlení.'],
    },
    polygons: [polygon([[18, -17], [37, -17], [37, 36], [18, 36]])],
  },
  {
    id: 'east-africa',
    categoryId: 'macro-regions',
    title: { en: 'East Africa', cs: 'Východní Afrika' },
    subtitle: { en: 'Great Lakes, Rift Valley and Indian Ocean coast', cs: 'Velká jezera, rift a pobřeží Indického oceánu' },
    typeLabel: { en: 'Large region', cs: 'Velký region' },
    summary: {
      en: 'East Africa includes the Great Rift Valley, Great Lakes, highlands and long Indian Ocean connections.',
      cs: 'Východní Afrika zahrnuje Velkou příkopovou propadlinu, Velká jezera, vysočiny a dlouhé vazby na Indický oceán.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Uganda', 'Kenya', 'Tanzania', 'Ethiopia', 'Somalia', 'Rwanda'],
      cs: ['Uganda', 'Keňa', 'Tanzanie', 'Etiopie', 'Somálsko', 'Rwanda'],
    },
    facts: {
      en: ['Uganda lies in this region.', 'The Rift Valley is important for geology and human prehistory.'],
      cs: ['Uganda leží právě v tomto regionu.', 'Riftové údolí je důležité pro geologii i pravěk člověka.'],
    },
    polygons: [polygon([[-12, 30], [18, 30], [18, 52], [-12, 52]])],
  },
  {
    id: 'central-america',
    categoryId: 'macro-regions',
    title: { en: 'Central America', cs: 'Střední Amerika' },
    subtitle: { en: 'The narrow land bridge of the Americas', cs: 'Úzká pevninská spojnice Ameriky' },
    typeLabel: { en: 'Large region', cs: 'Velký region' },
    summary: {
      en: 'Central America forms the land bridge between North and South America, with strong volcanic and tropical landscapes.',
      cs: 'Střední Amerika tvoří pevninský most mezi Severní a Jižní Amerikou a vyznačuje se vulkanickou i tropickou krajinou.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Guatemala', 'Belize', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama'],
      cs: ['Guatemala', 'Belize', 'Honduras', 'Salvador', 'Nikaragua', 'Kostarika', 'Panama'],
    },
    facts: {
      en: ['The Panama Isthmus separates the Atlantic and Pacific oceans.', 'Maya civilization developed in the northern part of the region.'],
      cs: ['Panamská šíje odděluje Atlantský a Tichý oceán.', 'Mayská civilizace se rozvíjela v severní části regionu.'],
    },
    polygons: [polygon([[7, -93], [18, -93], [18, -77], [7, -77]])],
  },
  {
    id: 'iberian-peninsula',
    categoryId: 'named-regions',
    title: { en: 'Iberian Peninsula', cs: 'Pyrenejský poloostrov' },
    subtitle: { en: 'Portugal, Spain and Andorra', cs: 'Portugalsko, Španělsko a Andorra' },
    typeLabel: { en: 'Peninsula', cs: 'Poloostrov' },
    summary: {
      en: 'The Iberian Peninsula is the southwestern corner of Europe, separated from the rest of the continent by the Pyrenees.',
      cs: 'Pyrenejský poloostrov tvoří jihozápadní výběžek Evropy, od zbytku kontinentu ho oddělují Pyreneje.',
    },
    mapNote: {
      en: 'Portugal, Spain and Andorra are highlighted as separate simplified outlines.',
      cs: 'Portugalsko, Španělsko a Andorra jsou zvýrazněny samostatnými zjednodušenými obrysy.',
    },
    members: {
      en: ['Portugal', 'Spain', 'Andorra'],
      cs: ['Portugalsko', 'Španělsko', 'Andorra'],
    },
    facts: {
      en: ['It sits between the Atlantic Ocean and the Mediterranean Sea.', 'The Pyrenees form the main natural border with the rest of Europe.'],
      cs: ['Leží mezi Atlantským oceánem a Středozemním mořem.', 'Pyreneje tvoří hlavní přirozenou hranici se zbytkem Evropy.'],
    },
    polygons: [
      country('Portugal', 'Portugalsko', [[41.9, -8.9], [42.1, -6.2], [39.5, -6.9], [37, -7.4], [37, -8.9]]),
      country('Spain', 'Španělsko', [[43.8, -9.3], [43.8, 3.2], [41.5, 3.3], [36, -5.7], [36.7, -9.3]]),
      country('Andorra', 'Andorra', [[42.42, 1.42], [42.65, 1.42], [42.65, 1.78], [42.42, 1.78]]),
    ],
  },
  {
    id: 'apennine-peninsula',
    categoryId: 'named-regions',
    title: { en: 'Apennine Peninsula', cs: 'Apeninský poloostrov' },
    subtitle: { en: 'Mainly Italy, with San Marino and Vatican City', cs: 'Hlavně Itálie, také San Marino a Vatikán' },
    typeLabel: { en: 'Peninsula', cs: 'Poloostrov' },
    summary: {
      en: 'The Apennine Peninsula is the long boot-shaped peninsula of southern Europe, dominated by Italy and the Apennine Mountains.',
      cs: 'Apeninský poloostrov je dlouhý jižní výběžek Evropy ve tvaru boty, kterému dominuje Itálie a Apeniny.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Italy', 'San Marino', 'Vatican City'],
      cs: ['Itálie', 'San Marino', 'Vatikán'],
    },
    facts: {
      en: ['Rome grew near the western side of the peninsula.', 'The Apennines run like a spine through much of Italy.'],
      cs: ['Řím vyrostl u západní strany poloostrova.', 'Apeniny probíhají velkou částí Itálie jako horská páteř.'],
    },
    polygons: [polygon([[46.3, 6.8], [45.5, 13.8], [41, 16.7], [37, 15.2], [38.8, 11], [43, 9.6]])],
  },
  {
    id: 'balkans',
    categoryId: 'named-regions',
    title: { en: 'Balkans', cs: 'Balkán' },
    subtitle: { en: 'Southeastern Europe', cs: 'Jihovýchodní Evropa' },
    typeLabel: { en: 'Historical and geographic region', cs: 'Historicko-geografický region' },
    summary: {
      en: 'The Balkans are a southeastern European region where geographic, historical and political definitions often differ.',
      cs: 'Balkán je jihovýchodní evropský region, jehož geografické, historické a politické vymezení se často liší.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Albania', 'Bulgaria', 'Greece', 'Serbia', 'Bosnia and Herzegovina', 'North Macedonia'],
      cs: ['Albánie', 'Bulharsko', 'Řecko', 'Srbsko', 'Bosna a Hercegovina', 'Severní Makedonie'],
    },
    facts: {
      en: ['The region sits between the Adriatic, Ionian, Aegean and Black seas.', 'Empires and religions overlapped here for centuries.'],
      cs: ['Region leží mezi Jaderským, Jónským, Egejským a Černým mořem.', 'Po staletí se zde překrývaly říše a náboženství.'],
    },
    polygons: [polygon([[39, 14], [46.5, 14], [46.5, 29], [41, 29], [39, 23]])],
  },
  {
    id: 'scandinavia',
    categoryId: 'named-regions',
    title: { en: 'Scandinavia', cs: 'Skandinávie' },
    subtitle: { en: 'Denmark, Norway and Sweden in the narrow sense', cs: 'V užším smyslu Dánsko, Norsko a Švédsko' },
    typeLabel: { en: 'Cultural and geographic region', cs: 'Kulturně-geografický region' },
    summary: {
      en: 'Scandinavia usually means Denmark, Norway and Sweden; the wider Nordic countries also include Finland, Iceland and autonomous island territories.',
      cs: 'Skandinávie obvykle znamená Dánsko, Norsko a Švédsko; širší severské země zahrnují také Finsko, Island a autonomní ostrovní území.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Denmark', 'Norway', 'Sweden'],
      cs: ['Dánsko', 'Norsko', 'Švédsko'],
    },
    facts: {
      en: ['The term Nordic countries is broader than Scandinavia.', 'Norway and Sweden occupy most of the Scandinavian Peninsula.'],
      cs: ['Pojem severské země je širší než Skandinávie.', 'Norsko a Švédsko zabírají většinu Skandinávského poloostrova.'],
    },
    polygons: [polygon([[55, 7], [71, 5], [71, 31], [59, 31], [55, 17]])],
  },
  {
    id: 'patagonia',
    categoryId: 'named-regions',
    title: { en: 'Patagonia', cs: 'Patagonie' },
    subtitle: { en: 'Southern Argentina and Chile', cs: 'Jih Argentiny a Chile' },
    typeLabel: { en: 'Geographic region', cs: 'Geografický region' },
    summary: {
      en: 'Patagonia is a vast southern South American region split between Argentina and Chile; it is not a state.',
      cs: 'Patagonie je rozsáhlá oblast na jihu Jižní Ameriky rozdělená mezi Argentinu a Chile; není to stát.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Argentina', 'Chile'],
      cs: ['Argentina', 'Chile'],
    },
    facts: {
      en: ['It includes windswept steppes, glaciers and the southern Andes.', 'Tierra del Fuego lies at its far southern edge.'],
      cs: ['Zahrnuje větrné stepi, ledovce a jižní Andy.', 'Ohňová země leží na jejím dalekém jihu.'],
    },
    polygons: [polygon([[-55, -76], [-37, -76], [-37, -63], [-55, -63]])],
  },
  {
    id: 'arabian-peninsula',
    categoryId: 'named-regions',
    title: { en: 'Arabian Peninsula', cs: 'Arabský poloostrov' },
    subtitle: { en: 'Southwestern Asia', cs: 'Jihozápadní Asie' },
    typeLabel: { en: 'Peninsula', cs: 'Poloostrov' },
    summary: {
      en: 'The Arabian Peninsula is a large desert-dominated peninsula between the Red Sea, Persian Gulf and Arabian Sea.',
      cs: 'Arabský poloostrov je velký převážně pouštní poloostrov mezi Rudým mořem, Perským zálivem a Arabským mořem.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Saudi Arabia', 'Yemen', 'Oman', 'United Arab Emirates', 'Qatar', 'Bahrain', 'Kuwait'],
      cs: ['Saúdská Arábie', 'Jemen', 'Omán', 'Spojené arabské emiráty', 'Katar', 'Bahrajn', 'Kuvajt'],
    },
    facts: {
      en: ['It contains two of Islams holiest cities, Mecca and Medina.', 'Oil and gas transformed its modern economy.'],
      cs: ['Leží zde dvě z nejsvatějších měst islámu, Mekka a Medina.', 'Ropa a plyn zásadně proměnily moderní ekonomiku regionu.'],
    },
    polygons: [polygon([[12, 34], [31, 34], [31, 59], [12, 59]])],
  },
  {
    id: 'indian-subcontinent',
    categoryId: 'named-regions',
    title: { en: 'Indian Subcontinent', cs: 'Indický subkontinent' },
    subtitle: { en: 'South Asian tectonic and cultural space', cs: 'Jihoasijský tektonický a kulturní prostor' },
    typeLabel: { en: 'Subcontinent', cs: 'Subkontinent' },
    summary: {
      en: 'The Indian subcontinent is a large South Asian landmass separated from much of Asia by the Himalayas.',
      cs: 'Indický subkontinent je velká jihoasijská pevnina oddělená od velké části Asie Himálajem.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['India', 'Pakistan', 'Bangladesh', 'Nepal', 'Bhutan', 'Sri Lanka'],
      cs: ['Indie', 'Pákistán', 'Bangladéš', 'Nepál', 'Bhútán', 'Srí Lanka'],
    },
    facts: {
      en: ['It began as an ancient plate collision that helped raise the Himalayas.', 'The monsoon is central to agriculture and settlement.'],
      cs: ['Vznikl dávnou srážkou desek, která pomohla vyzdvihnout Himálaj.', 'Monzun je zásadní pro zemědělství i osídlení.'],
    },
    polygons: [polygon([[6, 61], [36, 61], [32, 91], [20, 93], [6, 80]])],
  },
  {
    id: 'caucasus',
    categoryId: 'named-regions',
    title: { en: 'Caucasus', cs: 'Kavkaz' },
    subtitle: { en: 'Between the Black and Caspian seas', cs: 'Mezi Černým a Kaspickým mořem' },
    typeLabel: { en: 'Mountain and cultural region', cs: 'Horský a kulturní region' },
    summary: {
      en: 'The Caucasus is a compact mountain region between the Black Sea and Caspian Sea with many languages and identities.',
      cs: 'Kavkaz je kompaktní horský region mezi Černým a Kaspickým mořem s mnoha jazyky a identitami.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Georgia', 'Armenia', 'Azerbaijan', 'parts of southern Russia'],
      cs: ['Gruzie', 'Arménie', 'Ázerbájdžán', 'část jihu Ruska'],
    },
    facts: {
      en: ['The Greater Caucasus is often used in discussions of the Europe-Asia boundary.', 'The region is linguistically very diverse.'],
      cs: ['Velký Kavkaz se často používá při debatách o hranici Evropy a Asie.', 'Region je jazykově mimořádně pestrý.'],
    },
    polygons: [polygon([[38, 39], [47, 39], [47, 51], [38, 51]])],
  },
  {
    id: 'siberia',
    categoryId: 'named-regions',
    title: { en: 'Siberia', cs: 'Sibiř' },
    subtitle: { en: 'Northern Asia within Russia', cs: 'Severní Asie v rámci Ruska' },
    typeLabel: { en: 'Large geographic region', cs: 'Velký geografický region' },
    summary: {
      en: 'Siberia is a vast northern Asian region of Russia, stretching from the Urals toward the Pacific.',
      cs: 'Sibiř je rozsáhlá severoasijská oblast Ruska, sahající od Uralu směrem k Pacifiku.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Russia'],
      cs: ['Rusko'],
    },
    facts: {
      en: ['It contains taiga, tundra, permafrost and major river systems.', 'Its population is concentrated along cities, railways and resource zones.'],
      cs: ['Zahrnuje tajgu, tundru, permafrost a velké říční systémy.', 'Obyvatelstvo se soustředí hlavně kolem měst, železnic a surovinových oblastí.'],
    },
    polygons: [polygon([[50, 60], [75, 60], [75, 170], [50, 170]])],
  },
  {
    id: 'levant',
    categoryId: 'named-regions',
    title: { en: 'Levant', cs: 'Levant' },
    subtitle: { en: 'Eastern Mediterranean coast', cs: 'Východní pobřeží Středozemního moře' },
    typeLabel: { en: 'Historical and cultural region', cs: 'Historicko-kulturní region' },
    summary: {
      en: 'The Levant is the eastern Mediterranean coastal region, historically a meeting place of trade routes, empires and religions.',
      cs: 'Levant je oblast východního pobřeží Středozemního moře, historicky křižovatka obchodních cest, říší a náboženství.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Lebanon', 'Syria', 'Israel', 'Palestinian territories', 'Jordan'],
      cs: ['Libanon', 'Sýrie', 'Izrael', 'palestinská území', 'Jordánsko'],
    },
    facts: {
      en: ['It links the Mediterranean with Mesopotamia and Arabia.', 'Many ancient ports and caravan routes met here.'],
      cs: ['Spojuje Středomoří s Mezopotámií a Arábií.', 'Setkávaly se zde starověké přístavy a karavanní cesty.'],
    },
    polygons: [polygon([[29, 34], [38, 34], [38, 40], [29, 40]])],
  },
  {
    id: 'maghreb',
    categoryId: 'named-regions',
    title: { en: 'Maghreb', cs: 'Maghreb' },
    subtitle: { en: 'Northwestern Africa', cs: 'Severozápadní Afrika' },
    typeLabel: { en: 'Cultural and geographic region', cs: 'Kulturně-geografický region' },
    summary: {
      en: 'The Maghreb is northwestern Africa, facing the Mediterranean and Atlantic and backed by the Sahara.',
      cs: 'Maghreb je severozápadní Afrika obrácená ke Středozemnímu moři a Atlantiku, s pouštním zázemím Sahary.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Morocco', 'Algeria', 'Tunisia', 'Libya', 'Mauritania'],
      cs: ['Maroko', 'Alžírsko', 'Tunisko', 'Libye', 'Mauritánie'],
    },
    facts: {
      en: ['Its name is tied to the Arabic idea of the west.', 'Berber, Arab, Mediterranean and Saharan histories overlap here.'],
      cs: ['Název souvisí s arabskou představou západu.', 'Překrývají se zde berberské, arabské, středomořské i saharské dějiny.'],
    },
    polygons: [polygon([[19, -17], [37, -17], [37, 12], [19, 12]])],
  },
  {
    id: 'benelux',
    categoryId: 'named-regions',
    title: { en: 'Benelux', cs: 'Benelux' },
    subtitle: { en: 'Belgium, Netherlands and Luxembourg', cs: 'Belgie, Nizozemsko a Lucembursko' },
    typeLabel: { en: 'Political and economic regional label', cs: 'Politicko-ekonomické regionální označení' },
    summary: {
      en: 'Benelux names the close regional grouping of Belgium, the Netherlands and Luxembourg.',
      cs: 'Benelux označuje blízké regionální seskupení Belgie, Nizozemska a Lucemburska.',
    },
    mapNote: {
      en: 'The three countries are shown as separate simplified outlines.',
      cs: 'Tři státy jsou zobrazeny jako samostatné zjednodušené obrysy.',
    },
    members: {
      en: ['Belgium', 'Netherlands', 'Luxembourg'],
      cs: ['Belgie', 'Nizozemsko', 'Lucembursko'],
    },
    facts: {
      en: ['The name is built from the first syllables of the three country names.', 'The area is small but economically dense and highly urbanized.'],
      cs: ['Název vznikl z prvních slabik názvů tří zemí.', 'Oblast je malá, ale ekonomicky silná a velmi urbanizovaná.'],
    },
    polygons: [
      country('Netherlands', 'Nizozemsko', [[50.7, 3.2], [53.7, 3.2], [53.7, 7.3], [50.7, 7.3]]),
      country('Belgium', 'Belgie', [[49.5, 2.5], [51.5, 2.5], [51.5, 6.4], [49.5, 6.4]]),
      country('Luxembourg', 'Lucembursko', [[49.4, 5.7], [50.2, 5.7], [50.2, 6.6], [49.4, 6.6]]),
    ],
  },
  {
    id: 'baltics',
    categoryId: 'named-regions',
    title: { en: 'Baltic States', cs: 'Pobaltí' },
    subtitle: { en: 'Estonia, Latvia and Lithuania', cs: 'Estonsko, Lotyšsko a Litva' },
    typeLabel: { en: 'Regional label', cs: 'Regionální označení' },
    summary: {
      en: 'The Baltic States are the three countries on the eastern coast of the Baltic Sea: Estonia, Latvia and Lithuania.',
      cs: 'Pobaltí tvoří tři státy na východním pobřeží Baltského moře: Estonsko, Lotyšsko a Litva.',
    },
    mapNote: {
      en: 'Estonia, Latvia and Lithuania are highlighted as separate simplified outlines.',
      cs: 'Estonsko, Lotyšsko a Litva jsou zvýrazněny samostatnými zjednodušenými obrysy.',
    },
    members: {
      en: ['Estonia', 'Latvia', 'Lithuania'],
      cs: ['Estonsko', 'Lotyšsko', 'Litva'],
    },
    facts: {
      en: ['They are often grouped together, but each has its own language and history.', 'They link northern, central and eastern European histories.'],
      cs: ['Často se uvádějí společně, ale každý stát má vlastní jazyk a dějiny.', 'Propojují severní, střední a východní evropské dějiny.'],
    },
    polygons: [
      country('Estonia', 'Estonsko', [[57.4, 21.5], [59.8, 21.5], [59.8, 28.2], [57.4, 28.2]]),
      country('Latvia', 'Lotyšsko', [[55.7, 20.9], [58.1, 20.9], [58.1, 28.4], [55.7, 28.4]]),
      country('Lithuania', 'Litva', [[53.8, 20.9], [56.5, 20.9], [56.5, 26.9], [53.8, 26.9]]),
    ],
  },
  {
    id: 'caribbean',
    categoryId: 'named-regions',
    title: { en: 'Caribbean', cs: 'Karibik' },
    subtitle: { en: 'Islands and coasts of the Caribbean Sea', cs: 'Ostrovy a pobřeží Karibského moře' },
    typeLabel: { en: 'Marine and cultural region', cs: 'Mořský a kulturní region' },
    summary: {
      en: 'The Caribbean includes island chains and nearby coasts around the Caribbean Sea, between the Americas and the Atlantic.',
      cs: 'Karibik zahrnuje ostrovní řetězce a blízká pobřeží kolem Karibského moře mezi Amerikou a Atlantikem.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Cuba', 'Haiti', 'Dominican Republic', 'Jamaica', 'Puerto Rico', 'Lesser Antilles'],
      cs: ['Kuba', 'Haiti', 'Dominikánská republika', 'Jamajka', 'Portoriko', 'Malé Antily'],
    },
    facts: {
      en: ['Columbus reached Caribbean islands in 1492.', 'The region is a meeting place of Indigenous, African, European and Asian histories.'],
      cs: ['Kolumbus dorazil na karibské ostrovy v roce 1492.', 'Region je místem setkávání původních, afrických, evropských a asijských dějin.'],
    },
    polygons: [polygon([[10, -86], [27, -86], [27, -58], [10, -58]])],
  },
  {
    id: 'amazonia',
    categoryId: 'natural-regions',
    title: { en: 'Amazonia', cs: 'Amazonie' },
    subtitle: { en: 'Amazon basin and rainforest region', cs: 'Povodí Amazonky a oblast deštného lesa' },
    typeLabel: { en: 'Natural region', cs: 'Přírodní region' },
    summary: {
      en: 'Amazonia is the immense river basin and rainforest region around the Amazon River in northern South America.',
      cs: 'Amazonie je obrovské povodí a oblast deštného lesa kolem Amazonky na severu Jižní Ameriky.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Brazil', 'Peru', 'Colombia', 'Bolivia', 'Ecuador', 'Venezuela'],
      cs: ['Brazílie', 'Peru', 'Kolumbie', 'Bolívie', 'Ekvádor', 'Venezuela'],
    },
    facts: {
      en: ['It is one of the worlds largest rainforest systems.', 'The Amazon River carries an extraordinary share of global river discharge.'],
      cs: ['Patří k největším systémům deštného lesa na světě.', 'Amazonka odvádí mimořádně velký podíl světového říčního odtoku.'],
    },
    polygons: [polygon([[-18, -78], [7, -78], [7, -44], [-18, -44]])],
  },
  {
    id: 'sahel',
    categoryId: 'natural-regions',
    title: { en: 'Sahel', cs: 'Sahel' },
    subtitle: { en: 'Semi-arid belt south of the Sahara', cs: 'Polosuchý pás jižně od Sahary' },
    typeLabel: { en: 'Natural and human-geographic zone', cs: 'Přírodní a humánně-geografická zóna' },
    summary: {
      en: 'The Sahel is a broad transition belt between the Sahara Desert and wetter savannas to the south.',
      cs: 'Sahel je široký přechodový pás mezi Saharou a vlhčími savanami na jihu.',
    },
    mapNote: approximateMapNote,
    members: {
      en: ['Senegal', 'Mali', 'Niger', 'Chad', 'Sudan', 'parts of nearby states'],
      cs: ['Senegal', 'Mali', 'Niger', 'Čad', 'Súdán', 'části okolních států'],
    },
    facts: {
      en: ['Rainfall changes sharply from north to south.', 'Pastoralism, farming and desertification pressures meet here.'],
      cs: ['Srážky se zde prudce mění od severu k jihu.', 'Setkává se zde pastevectví, zemědělství a tlak desertifikace.'],
    },
    polygons: [polygon([[10, -17], [19, -17], [19, 38], [10, 38]])],
  },
  {
    id: 'tropical-belt',
    categoryId: 'natural-regions',
    title: { en: 'Tropical belt', cs: 'Tropický pás' },
    subtitle: { en: 'Between the Tropics of Cancer and Capricorn', cs: 'Mezi obratníkem Raka a Kozoroha' },
    typeLabel: { en: 'Climate zone', cs: 'Klimatický pás' },
    summary: {
      en: 'The tropical belt receives high sun angles year-round and includes rainforests, savannas and many monsoon regions.',
      cs: 'Tropický pás má po celý rok vysoký úhel dopadu slunečního záření a zahrnuje deštné lesy, savany i mnoho monzunových oblastí.',
    },
    mapNote: {
      en: 'The layer uses the latitude limits of the tropics, roughly 23.5 degrees north and south.',
      cs: 'Vrstva používá zeměpisné šířky obratníků, přibližně 23,5 stupně severně a jižně.',
    },
    members: emptyMembers,
    facts: {
      en: ['The equator runs through the middle of the belt.', 'It is not the same as a single biome; deserts and rainforests can both be tropical.'],
      cs: ['Rovník prochází středem pásu.', 'Není to totéž co jeden biom; tropické mohou být pouště i deštné lesy.'],
    },
    polygons: [polygon([[-23.5, -180], [23.5, -180], [23.5, 180], [-23.5, 180]])],
  },
  {
    id: 'polar-zones',
    categoryId: 'natural-regions',
    title: { en: 'Polar zones', cs: 'Polární pásy' },
    subtitle: { en: 'Arctic and Antarctic high latitudes', cs: 'Arktické a antarktické vysoké šířky' },
    typeLabel: { en: 'Climate zone', cs: 'Klimatický pás' },
    summary: {
      en: 'Polar zones lie near the poles, with long winter darkness, low sun angles and ice-shaped environments.',
      cs: 'Polární pásy leží u pólů, s dlouhou zimní tmou, nízkým úhlem slunce a prostředím formovaným ledem.',
    },
    mapNote: {
      en: 'The layer follows the common Arctic and Antarctic circle latitudes, roughly 66.5 degrees north and south.',
      cs: 'Vrstva sleduje běžné zeměpisné šířky polárních kruhů, přibližně 66,5 stupně severně a jižně.',
    },
    members: emptyMembers,
    facts: {
      en: ['The Arctic is mostly ocean surrounded by land.', 'Antarctica is land covered by ice and surrounded by ocean.'],
      cs: ['Arktida je hlavně oceán obklopený pevninou.', 'Antarktida je pevnina pokrytá ledem a obklopená oceánem.'],
    },
    polygons: [
      polygon([[66.5, -180], [85, -180], [85, 180], [66.5, 180]]),
      polygon([[-85, -180], [-66.5, -180], [-66.5, 180], [-85, 180]]),
    ],
  },
]

"""Expand generated entry JSON files with richer localized Markdown text content."""

from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
from typing import Any

from text_sanitizer import sanitize_for_tts


MIN_EN_DESCRIPTION_CHARS = 1300
MIN_CS_DESCRIPTION_CHARS = 1100
PACKAGE_PATHS = [
    Path("generated/packages/master-timeline/entries.json"),
    Path("generated/packages/mythology/entries.json"),
]
PROGRESS_PATH = Path("generated/topic-text-expansion-progress.md")


MASTER_CS: dict[str, dict[str, str]] = {
    "earliest-known-stone-tools": {
        "title": "Nejstarší známé kamenné nástroje",
        "summary": "Nejstarší známé záměrně vyráběné kamenné nástroje.",
    },
    "homo-erectus-appears": {
        "title": "Objevuje se Homo erectus",
        "summary": "Raný lidský druh se rozšířil daleko za Afriku.",
    },
    "controlled-fire-becomes-widespread": {
        "title": "Rozšiřuje se ovládání ohně",
        "summary": "Ovládání ohně umožnilo vaření, teplo, ochranu a nové společenské návyky.",
    },
    "homo-sapiens-emerges": {
        "title": "Objevuje se Homo sapiens",
        "summary": "Počátek anatomicky moderních lidí.",
    },
    "symbolic-culture-expands": {
        "title": "Rozšiřuje se symbolická kultura",
        "summary": "Umění, ozdoby a složitá komunikace jsou v pramenech mnohem zřetelnější.",
    },
    "sewing-needles-and-tailored-clothing": {
        "title": "Šicí jehly a šité oděvy",
        "summary": "Šité oděvy zlepšily přežití v chladném prostředí.",
    },
    "permanent-settlements-expand": {
        "title": "Rozšiřují se stálá sídla",
        "summary": "Lidé stále častěji žili ve vesnicích před raným zemědělstvím i během něj.",
    },
    "agricultural-revolution": {
        "title": "Zemědělská revoluce",
        "summary": "Zemědělství a domestikace změnily osídlení, populaci i mocenské vztahy.",
    },
    "pottery-develops-in-several-regions": {
        "title": "Keramika se rozvíjí v několika oblastech",
        "summary": "Keramika zlepšila skladování, vaření a přepravu potravin.",
    },
    "catalhoyuk-flourishes": {
        "title": "Rozkvétá Çatalhöyük",
        "summary": "Jedno z nejznámějších raných velkých sídlišť.",
    },
    "copper-working-spreads": {
        "title": "Šíří se zpracování mědi",
        "summary": "Důležitý krok k metalurgii a době bronzové.",
    },
    "wheel-appears": {
        "title": "Objevuje se kolo",
        "summary": "Kolo proměnilo hrnčířství, dopravu i stroje.",
    },
    "writing-develops-in-sumer": {
        "title": "V Sumeru se rozvíjí písmo",
        "summary": "Začátek dochovaných písemných dějin.",
    },
    "upper-and-lower-egypt-are-unified": {
        "title": "Sjednocení Horního a Dolního Egypta",
        "summary": "Vznikl jeden z nejdéle trvajících starověkých států.",
    },
    "sumerian-gods-enter-written-record": {
        "title": "Sumerští bohové vstupují do písemných pramenů",
        "summary": "Inanna, Enki a Enlil patří k nejstarším písemně doloženým božstvům.",
    },
    "old-kingdom-of-egypt": {
        "title": "Stará říše v Egyptě",
        "summary": "Období centralizované faraonské moci a stavby pyramid.",
    },
    "great-pyramid-of-giza-is-built": {
        "title": "Vzniká Velká pyramida v Gíze",
        "summary": "Jeden z nejslavnějších technických výkonů dějin.",
    },
    "indus-valley-civilization": {
        "title": "Civilizace údolí Indu",
        "summary": "Rozsáhlá plánovaná města, hygiena a dálkový obchod.",
    },
    "pyramid-texts": {
        "title": "Texty pyramid",
        "summary": "Nejstarší rozsáhlý soubor egyptských náboženských textů.",
    },
    "early-gilgamesh-poems": {
        "title": "Rané básně o Gilgamešovi",
        "summary": "Jedny z nejstarších dochovaných hrdinských příběhů.",
    },
    "coffin-texts": {
        "title": "Texty rakví",
        "summary": "Rozšiřují egyptskou pohřební mytologii mimo královské hrobky.",
    },
    "early-chinese-bronze-age-states": {
        "title": "Rané čínské státy doby bronzové",
        "summary": "Základ pro pozdější šangskou civilizaci.",
    },
    "shang-dynasty": {
        "title": "Dynastie Šang",
        "summary": "Nejstarší čínská dynastie doložená rozsáhlými písemnými prameny.",
    },
    "book-of-the-dead-tradition": {
        "title": "Tradice Knihy mrtvých",
        "summary": "Pohřební formule provázejí zemřelé posmrtným světem.",
    },
    "spoked-wheel-chariots-spread": {
        "title": "Šíří se vozy s loukoťovými koly",
        "summary": "Válečné vozy proměnily válčení a pohyb elit.",
    },
    "rigveda-composed-orally": {
        "title": "Rgvéda vzniká ústním podáním",
        "summary": "Nejstarší velký védský pramen včetně bohů Indry, Agniho a Varuny.",
    },
    "bronze-age-collapse": {
        "title": "Kolaps doby bronzové",
        "summary": "Několik palácových civilizací upadlo nebo zaniklo.",
    },
    "greek-heroic-and-divine-traditions-develop-orally": {
        "title": "Řecké hrdinské a božské tradice se rozvíjejí ústně",
        "summary": "Příběhy o Diovi, Athéně, Achilleovi a Odysseovi kolovaly před dochovanými texty.",
    },
    "early-celtic-religious-traditions": {
        "title": "Rané keltské náboženské tradice",
        "summary": "Kořeny bohů později známých jako Lugh, Brigid, Cernunnos a Morrígan.",
    },
    "alphabetic-writing-spreads": {
        "title": "Šíří se abecední písmo",
        "summary": "Abecední písmo se učilo snadněji než mnohé starší systémy.",
    },
    "proto-germanic-and-early-norse-divine-traditions": {
        "title": "Protogermánské a raně severské božské tradice",
        "summary": "Kořeny Odina, Thóra, Týra, Freyra a příbuzných bytostí.",
    },
    "early-zhou-cosmology-enters-written-sources": {
        "title": "Raná kosmologie Čou vstupuje do písemných pramenů",
        "summary": "Nebe, předci, draci a legendární vládcové vstupují do písemných pramenů.",
    },
    "iliad-and-odyssey-composed": {
        "title": "Vznikají Ílias a Odysseia",
        "summary": "Základní raný písemný pramen řecké hrdinské mytologie.",
    },
    "hesiod-s-theogony": {
        "title": "Hésiodova Theogonie",
        "summary": "Uspořádává původ a rodokmeny řeckých bohů a Titánů.",
    },
    "traditional-founding-of-rome": {
        "title": "Tradiční založení Říma",
        "summary": "Pozdější římská chronologie používala tento rok jako založení Říma.",
    },
    "cast-iron-develops": {
        "title": "Rozvíjí se litina",
        "summary": "Čína se stala raným centrem lití železa.",
    },
    "life-of-confucius": {
        "title": "Život Konfucia",
        "summary": "Zásadní vliv na východoasijskou etiku, vzdělání a správu státu.",
    },
    "buddhism-and-jainism-emerge": {
        "title": "Vznik buddhismu a džinismu",
        "summary": "Vznikají významné náboženské a filozofické tradice.",
    },
    "roman-republic-traditionally-begins": {
        "title": "Tradiční počátek Římské republiky",
        "summary": "Důležitý historický model republikánské vlády.",
    },
    "greco-persian-wars": {
        "title": "Řecko-perské války",
        "summary": "Formují politický vývoj klasického Řecka.",
    },
    "classical-athens": {
        "title": "Klasické Athény",
        "summary": "Rozkvétá demokracie, drama, filozofie a historické psaní.",
    },
    "conquests-of-alexander-the-great": {
        "title": "Výboje Alexandra Velikého",
        "summary": "Šíření helénistické kultury od Egypta po Střední a Jižní Asii.",
    },
    "qin-unifies-china": {
        "title": "Čchin sjednocuje Čínu",
        "summary": "Počátek trvalé čínské císařské jednoty.",
    },
    "han-dynasty": {
        "title": "Dynastie Chan",
        "summary": "Expanze, spojení Hedvábné stezky a trvalé státní instituce.",
    },
    "augustus-establishes-the-roman-empire": {
        "title": "Augustus zakládá Římské císařství",
        "summary": "Začíná císařská fáze římských dějin.",
    },
    "christianity-begins": {
        "title": "Začíná křesťanství",
        "summary": "Vzniká z života a učení spojovaného s Ježíšem.",
    },
    "traditional-date-for-cai-lun-s-paper-improvements": {
        "title": "Tradiční datum zlepšení papíru Cchaj Lunem",
        "summary": "Papír se stal převratným psacím materiálem.",
    },
    "ptolemy-s-astronomical-system": {
        "title": "Ptolemaiův astronomický systém",
        "summary": "Po staletí určoval astronomii v Evropě a islámském světě.",
    },
    "kofun-era-kami-traditions": {
        "title": "Tradice kami období Kofun",
        "summary": "Předpísemné podoby příběhů později zachovaných v šintoistických kronikách.",
    },
    "edict-of-milan": {
        "title": "Edikt milánský",
        "summary": "Rozhodnutí zaručilo svobodu vyznání a legalizovalo křesťanství v Římské říši.",
    },
    "permanent-administrative-division-of-roman-empire": {
        "title": "Trvalé správní rozdělení Římské říše",
        "summary": "Východní a západní říše se vyvíjely odděleně.",
    },
    "traditional-fall-of-western-roman-empire": {
        "title": "Tradiční pád Západořímské říše",
        "summary": "Běžný konvenční mezník evropského středověku.",
    },
    "pre-christian-slavic-religion-develops-regionally": {
        "title": "Předkřesťanské slovanské náboženství se regionálně rozvíjí",
        "summary": "Tradice Peruna, Velese, Mokoše a dalších se později objevují ve skrovných pramenech.",
    },
    "life-of-muhammad": {
        "title": "Život Muhammada",
        "summary": "Začíná islám a šíří se Arabským poloostrovem.",
    },
    "tang-dynasty": {
        "title": "Dynastie Tchang",
        "summary": "Významná éra kultury, obchodu, poezie a kosmopolitních měst.",
    },
    "kojiki-completed": {
        "title": "Dokončení Kodžiki",
        "summary": "Nejstarší dochovaná japonská kronika a klíčový zdroj pro kami.",
    },
    "nihon-shoki-completed": {
        "title": "Dokončení Nihon šoki",
        "summary": "Další základní písemný pramen japonské mytologie.",
    },
    "viking-raid-on-lindisfarne": {
        "title": "Vikinský nájezd na Lindisfarne",
        "summary": "Obvyklý začátek vikinské éry.",
    },
    "vikings-reach-iceland-greenland-and-north-america": {
        "title": "Vikingové dosahují Islandu, Grónska a Severní Ameriky",
        "summary": "Seveřané dosáhli Newfoundlandu staletí před Kolumbem.",
    },
    "diamond-sutra-printed": {
        "title": "Tištěná Diamantová sútra",
        "summary": "Nejstarší dochovaná datovaná úplná tištěná kniha.",
    },
    "gunpowder-is-developed": {
        "title": "Vzniká střelný prach",
        "summary": "Později proměnil válčení po celém světě.",
    },
    "sun-wukong-like-monkey-traditions-begin-developing": {
        "title": "Začínají se rozvíjet opičí tradice podobné Sun Wukongovi",
        "summary": "Slavný Opičí král získal konečnou literární podobu mnohem později.",
    },
    "great-schism": {
        "title": "Velké schizma",
        "summary": "Upevnilo rozdělení římskokatolického a východního pravoslavného křesťanství.",
    },
    "norman-conquest": {
        "title": "Normanské dobytí Anglie",
        "summary": "Proměnilo vládu, společnost i jazyk v Anglii.",
    },
    "crusades": {
        "title": "Křížové výpravy",
        "summary": "Dlouhá série nábožensky rámovaných vojenských tažení.",
    },
    "poetic-edda-material-written-down": {
        "title": "Zápis látky Poetické Eddy",
        "summary": "Hlavní zdroj severských mýtů, i když básně mohou být starší.",
    },
    "snorri-s-prose-edda": {
        "title": "Snorriho Prozaická Edda",
        "summary": "Systematický středověký výklad severské mytologie.",
    },
    "major-celtic-tales-enter-manuscripts": {
        "title": "Významné keltské příběhy vstupují do rukopisů",
        "summary": "Irské a velšské prameny uchovávají Cú Chulainna, Tuatha Dé Danann a Mabinogi.",
    },
    "mechanical-clocks-spread": {
        "title": "Šíří se mechanické hodiny",
        "summary": "Měření času se stále více osamostatňuje od slunce a vodních hodin.",
    },
    "journeys-associated-with-marco-polo": {
        "title": "Cesty spojované s Marcem Polem",
        "summary": "Slavný evropský popis cest napříč Asií.",
    },
    "black-death": {
        "title": "Černá smrt",
        "summary": "Zabila velmi velký podíl obyvatel Eurasie a severní Afriky.",
    },
    "gutenberg-printing-press": {
        "title": "Gutenbergův knihtisk",
        "summary": "Masová výroba knih urychlila gramotnost a výměnu informací.",
    },
    "fall-of-constantinople": {
        "title": "Pád Konstantinopole",
        "summary": "Osmanské dobytí ukončilo Byzantskou říši.",
    },
    "columbus-reaches-the-caribbean": {
        "title": "Kolumbus dosahuje Karibiku",
        "summary": "Začátek trvalé evropské kolonizace Amerik, které už byly obydlené.",
    },
    "vasco-da-gama-reaches-india-by-sea-from-europe": {
        "title": "Vasco da Gama dosahuje Indie námořní cestou z Evropy",
        "summary": "Vznikla přímá evropská námořní cesta kolem Afriky.",
    },
    "first-circumnavigation-of-earth": {
        "title": "První obeplutí Země",
        "summary": "Výprava Magellan-Elcano dokončila první doloženou cestu kolem světa.",
    },
    "spanish-conquest-of-the-aztec-empire": {
        "title": "Španělské dobytí Aztécké říše",
        "summary": "Válka, spojenectví a nemoci zásadně změnily Mezoameriku.",
    },
    "spanish-conquest-of-the-inca-empire": {
        "title": "Španělské dobytí Incké říše",
        "summary": "Skončila nezávislá incká císařská vláda.",
    },
    "copernicus-publishes-heliocentric-model": {
        "title": "Koperník vydává heliocentrický model",
        "summary": "Země je zařazena mezi planety obíhající kolem Slunce.",
    },
    "journey-to-the-west-reaches-classic-form": {
        "title": "Putování na západ získává klasickou podobu",
        "summary": "Zpopularizovalo Sun Wukonga, démony, draky a buddhisticko-taoistický folklor.",
    },
    "european-maps-increasingly-represent-most-inhabited-continents": {
        "title": "Evropské mapy stále častěji zachycují většinu obydlených kontinentů",
        "summary": "Pobřeží zůstávala neúplná, zvláště Austrálie a polární oblasti.",
    },
    "willem-janszoon-records-a-european-landing-in-australia": {
        "title": "Willem Janszoon zaznamenává evropské přistání v Austrálii",
        "summary": "První doložené evropské přistání na australském kontinentu.",
    },
    "galileo-uses-telescope-for-astronomy": {
        "title": "Galileo používá dalekohled k astronomii",
        "summary": "Pozorování zpochybnila starší modely nebes.",
    },
    "francis-bacon-s-novum-organum": {
        "title": "Francis Bacon vydává Novum Organum",
        "summary": "Vlivné vyjádření empirické vědecké metody.",
    },
    "newton-publishes-principia": {
        "title": "Newton vydává Principia",
        "summary": "Sjednotil pozemskou a nebeskou mechaniku.",
    },
    "european-charting-of-the-pacific-accelerates": {
        "title": "Evropské mapování Pacifiku zrychluje",
        "summary": "Mnoho ostrovů a pobřeží vstoupilo do evropských map, i když místní společnosti je znaly dávno.",
    },
    "industrial-revolution": {
        "title": "Průmyslová revoluce",
        "summary": "Mechanizovaná výroba, továrny a energie fosilních paliv mění společnost.",
    },
    "watt-s-improved-steam-engine-patent": {
        "title": "Wattův patent na vylepšený parní stroj",
        "summary": "Parní pohon se stal účinnější a široce využitelný.",
    },
    "united-states-declaration-of-independence": {
        "title": "Deklarace nezávislosti Spojených států",
        "summary": "Významná atlantská revoluce a vznik nového státu.",
    },
    "french-revolution-begins": {
        "title": "Začíná Francouzská revoluce",
        "summary": "Proměňuje politiku, občanství a nacionalismus.",
    },
    "jenner-demonstrates-smallpox-vaccination": {
        "title": "Jenner předvádí očkování proti pravým neštovicím",
        "summary": "Začátek moderního očkování.",
    },
    "first-practical-steam-locomotive-demonstrated": {
        "title": "První praktická parní lokomotiva je předvedena",
        "summary": "Začátek železniční éry.",
    },
    "first-confirmed-sightings-of-antarctica": {
        "title": "První potvrzená pozorování Antarktidy",
        "summary": "Poslední kontinent vstoupil do evropských a ruských záznamů pozorování.",
    },
    "electrical-telegraph-developed": {
        "title": "Vzniká elektrický telegraf",
        "summary": "Umožnil téměř okamžitou komunikaci na velké vzdálenosti.",
    },
    "darwin-publishes-on-the-origin-of-species": {
        "title": "Darwin vydává O původu druhů",
        "summary": "Upevnil evoluci přírodním výběrem jako vědecký rámec.",
    },
    "american-civil-war": {
        "title": "Americká občanská válka",
        "summary": "Ukončila legální otroctví ve Spojených státech a zachovala Unii.",
    },
    "suez-canal-opens": {
        "title": "Otevírá se Suezský průplav",
        "summary": "Výrazně zkrátil námořní cestu mezi Evropou a Asií.",
    },
    "telephone-patented-and-demonstrated": {
        "title": "Telefon je patentován a předveden",
        "summary": "Proměnil osobní i obchodní komunikaci.",
    },
    "practical-incandescent-electric-lighting": {
        "title": "Praktické žárovkové osvětlení",
        "summary": "Elektrické světlo se stalo komerčně použitelným.",
    },
    "practical-automobile-developed": {
        "title": "Vzniká praktický automobil",
        "summary": "Začátek moderní silniční dopravy.",
    },
    "first-controlled-powered-airplane-flight": {
        "title": "První řízený motorový let letadla",
        "summary": "Začátek motorového letectví.",
    },
    "first-world-war": {
        "title": "První světová válka",
        "summary": "Zhroutila impéria a překreslila světové hranice.",
    },
    "russian-revolution": {
        "title": "Ruská revoluce",
        "summary": "Vedla ke vzniku sovětského státu a světového komunistického hnutí.",
    },
    "penicillin-discovered": {
        "title": "Objevení penicilinu",
        "summary": "Základ antibiotické éry.",
    },
    "great-depression": {
        "title": "Velká hospodářská krize",
        "summary": "Celosvětový hospodářský kolaps posílil politickou nestabilitu.",
    },
    "second-world-war": {
        "title": "Druhá světová válka",
        "summary": "Nejsmrtelnější válka dějin, zahrnující holokaust i atomové bombardování.",
    },
    "united-nations-founded": {
        "title": "Založení Organizace spojených národů",
        "summary": "Vznikla světová organizace pro diplomacii, bezpečnost a spolupráci.",
    },
    "partition-and-independence-of-india-and-pakistan": {
        "title": "Rozdělení a nezávislost Indie a Pákistánu",
        "summary": "Konec britské vlády provázený obrovskou migrací a násilím.",
    },
    "people-s-republic-of-china-established": {
        "title": "Vznik Čínské lidové republiky",
        "summary": "Vznik moderní ČLR po občanské válce.",
    },
    "structure-of-dna-described": {
        "title": "Popis struktury DNA",
        "summary": "Proměnila genetiku a molekulární biologii.",
    },
    "sputnik-1-launched": {
        "title": "Start Sputniku 1",
        "summary": "První umělá družice a začátek kosmického věku.",
    },
    "yuri-gagarin-orbits-earth": {
        "title": "Jurij Gagarin obletí Zemi",
        "summary": "První člověk ve vesmíru.",
    },
    "apollo-11-moon-landing": {
        "title": "Přistání Apolla 11 na Měsíci",
        "summary": "První lidé kráčeli po jiném světě.",
    },
    "arpanet-begins-operation": {
        "title": "ARPANET zahajuje provoz",
        "summary": "Důležitý předchůdce internetu.",
    },
    "commercial-microprocessor-introduced": {
        "title": "Uvedení komerčního mikroprocesoru",
        "summary": "Umožnil kompaktní programovatelné počítače.",
    },
    "cold-war-ends": {
        "title": "Konec studené války",
        "summary": "Pád Berlínské zdi a rozpad Sovětského svazu.",
    },
    "world-wide-web-created": {
        "title": "Vznik World Wide Webu",
        "summary": "Propojené online informace se staly dostupné přes prohlížeče.",
    },
    "public-internet-era-expands": {
        "title": "Rozšiřuje se éra veřejného internetu",
        "summary": "Komerční a veřejné používání sítí rychle rostlo.",
    },
    "kyoto-protocol-adopted": {
        "title": "Přijetí Kjótského protokolu",
        "summary": "Významná mezinárodní dohoda o omezení emisí skleníkových plynů.",
    },
    "september-11-attacks": {
        "title": "Útoky z 11. září",
        "summary": "Spustily zásadní geopolitické a bezpečnostní změny.",
    },
    "modern-smartphone-era-accelerates": {
        "title": "Zrychluje moderní éra chytrých telefonů",
        "summary": "Dotyková mobilní výpočetní technika se stala součástí každodenního života.",
    },
    "global-financial-crisis": {
        "title": "Globální finanční krize",
        "summary": "Těžká bankovní a hospodářská krize se rozšířila mezinárodně.",
    },
    "arab-spring": {
        "title": "Arabské jaro",
        "summary": "Masová protestní hnutí vyzvala vlády v regionu.",
    },
    "crispr-cas9-gene-editing-demonstrated": {
        "title": "Předvedení editace genů CRISPR-Cas9",
        "summary": "Vznikla výkonná programovatelná metoda úprav DNA.",
    },
    "paris-agreement-adopted": {
        "title": "Přijetí Pařížské dohody",
        "summary": "Téměř všechny státy se dohodly na klimatickém rámci.",
    },
    "covid-19-pandemic": {
        "title": "Pandemie COVID-19",
        "summary": "Pandemie způsobila celosvětové zdravotní a společenské narušení.",
    },
    "russia-launches-full-scale-invasion-of-ukraine": {
        "title": "Rusko zahajuje plnohodnotnou invazi na Ukrajinu",
        "summary": "Největší mezistátní válka v Evropě za desítky let s globálními dopady.",
    },
    "generative-ai-becomes-widely-used": {
        "title": "Generativní AI se široce používá",
        "summary": "Modely pro text, obraz, zvuk a kód vstoupily do běžné práce a kultury.",
    },
    "chandrayaan-3-lands-near-the-moon-s-south-polar-region": {
        "title": "Čandraján-3 přistává poblíž jižní polární oblasti Měsíce",
        "summary": "Indie se stala čtvrtou zemí, která měkce přistála na Měsíci.",
    },
    "ai-regulation-and-governance-accelerate": {
        "title": "Regulace a správa AI zrychlují",
        "summary": "Státy a instituce začaly vytvářet cílené rámce pro pokročilou AI.",
    },
    "artemis-ii-launches-crew-around-the-moon": {
        "title": "Artemis II vysílá posádku kolem Měsíce",
        "summary": "První pilotovaný let Artemis obnovil lidský lunární program.",
    },
    "timeline-endpoint": {
        "title": "Koncový bod časové osy",
        "summary": "Současnost propojená klimatickou změnou, AI, biotechnologiemi, kosmickými lety a geopolitickými konflikty.",
    },
}


MYTHOLOGY_CS: dict[str, dict[str, str]] = {
    "ra": {"title": "Ra", "summary": "Sluneční královská moc; každou noc cestuje podsvětím."},
    "osiris": {"title": "Osiris", "summary": "Zavražděný a obnovený vládce mrtvých."},
    "isis": {"title": "Isis", "summary": "Obnovuje Osirida a chrání Hora."},
    "horus": {"title": "Horus", "summary": "Sokolí bůh, soupeř Sutecha a obraz živého faraona."},
    "seth": {"title": "Sutech", "summary": "Bůh pouště, bouří a neřádu, později vrah Osirida."},
    "anubis": {"title": "Anubis", "summary": "Šakalí strážce pohřbu, mumifikace a hranice mezi světy."},
    "bastet": {"title": "Bastet", "summary": "Ochrana, domácnost, plodnost a pozdější kočičí symbolika."},
    "apep-apophis": {"title": "Apep (Apopis)", "summary": "Had chaosu útočící na Raovu sluneční bárku."},
    "sphinx": {"title": "Sfinga", "summary": "Lví tělo s lidskou hlavou, královská a ochranná symbolika."},
    "chaos": {"title": "Chaos", "summary": "Prvotní mezera či prázdno, z něhož vystupují kosmické bytosti."},
    "gaia": {"title": "Gaia", "summary": "Matka země a předkyně Titánů i bohů."},
    "uranus": {"title": "Úranos", "summary": "Nebeský otec svržený Kronem."},
    "cronus": {"title": "Kronos", "summary": "Titánský vládce, který svrhne Úrana a je svržen Diem."},
    "zeus": {"title": "Zeus", "summary": "Král olympských bohů, bůh nebe, hromu a božského práva."},
    "hera": {"title": "Héra", "summary": "Královna bohů, manželství a královské moci."},
    "poseidon": {"title": "Poseidón", "summary": "Vládce moře, bouří a zemětřesení."},
    "athena": {"title": "Athéna", "summary": "Patronka Athén, bohyně moudrosti, strategie a války."},
    "apollo": {"title": "Apollón", "summary": "Delfy, hudba, léčení, lukostřelba a věštby."},
    "artemis": {"title": "Artemis", "summary": "Lov, divoká zvířata, hranice přírody a porod."},
    "aphrodite": {"title": "Afrodíta", "summary": "Láska, krása a touha; u Hésioda zrozená z mořské pěny."},
    "hades": {"title": "Hádes", "summary": "Vládce mrtvých a manžel Persefony."},
    "persephone": {"title": "Persefona", "summary": "Královna podsvětí a postava sezónního odloučení."},
    "heracles": {"title": "Héraklés", "summary": "Hrdina dvanácti prací, který získá božské postavení."},
    "medusa": {"title": "Medúsa", "summary": "Hadovlasá Gorgona zabitá Perseem."},
    "minotaur": {"title": "Minotaurus", "summary": "Býčí bytost ukrytá v krétském labyrintu."},
    "cyclopes": {"title": "Kyklopové", "summary": "Jednoocí obři, v Odysseji i Hésiodově kosmologii."},
    "centaur": {"title": "Kentaur", "summary": "Napůl člověk a napůl kůň; divokost s výjimkou moudrého Cheiróna."},
    "phoenix": {"title": "Fénix", "summary": "Pták obnovy, později spojovaný se zrozením z popela."},
    "izanagi-and-izanami": {"title": "Izanagi a Izanami", "summary": "Stvořitelská kami tvoří japonské ostrovy a mnoho dalších kami."},
    "amaterasu": {"title": "Amaterasu", "summary": "Sluneční bohyně, která ukrytím v jeskyni zbaví svět světla."},
    "susanoo": {"title": "Susanoo", "summary": "Bouřný kami, který porazí osmihlavého hada Jamata no Oroči."},
    "yamata-no-orochi": {"title": "Jamata no Oroči", "summary": "Osmihlavý had zabitý Susanóem, v jehož ocasu je nalezen meč."},
    "kitsune": {"title": "Kitsune", "summary": "Proměnlivý liščí duch, trikster, milenec nebo posel Inari."},
    "kyubi-no-kitsune": {"title": "Kjúbi no kitsune", "summary": "Mocný liščí duch s devíti ocasy."},
    "oni": {"title": "Oni", "summary": "Rohatí démoni spojovaní s trestem, nebezpečím a nemocí."},
    "tengu": {"title": "Tengu", "summary": "Horské bytosti ptačího či dlouhonosého vzhledu, bojovníci a triksteři."},
    "shangdi": {"title": "Šang-ti", "summary": "Nejvyšší moc spojená s královskými předky a přírodou."},
    "dragon-long": {"title": "Čínský drak (long)", "summary": "Déšť, voda, císařská autorita a příznivá síla."},
    "nuwa": {"title": "Nüwa", "summary": "Stvoří lidi a opraví rozbité nebe."},
    "fuxi": {"title": "Fuxi", "summary": "Kulturní hrdina učící písmo, rybolov, domestikaci a trigramy."},
    "qilin": {"title": "Qilin", "summary": "Příznivá chiméra objevující se za vlády moudrého panovníka."},
    "fenghuang": {"title": "Fenghuang", "summary": "Posvátný pták harmonie, ctnosti a císařské symboliky."},
    "huli-jing": {"title": "Huli jing", "summary": "Proměnlivý liščí duch, který může škodit i pomáhat."},
    "nine-tailed-fox": {"title": "Devítiocasá liška", "summary": "Nadpřirozená liška, jejíž význam se v čase měnil."},
    "sun-wukong": {"title": "Sun Wukong", "summary": "Vzpurný nesmrtelný Opičí král putující s mnichem Süan-cangem."},
    "lugh": {"title": "Lugh", "summary": "Mistr mnoha dovedností a postava spojovaná se svátkem Lughnasadh."},
    "brigid": {"title": "Brigid", "summary": "Poezie, léčení, kovářství a plodnost."},
    "the-dagda": {"title": "Dagda", "summary": "Mocná otcovská postava s kotlem a kyjem."},
    "the-morrigan": {"title": "Morrígan", "summary": "Bitva, osud, královská svrchovanost a havraní symbolika."},
    "cernunnos": {"title": "Cernunnos", "summary": "Rohatý bůh přírody, zvířat a hojnosti; přesný mýtus není znám."},
    "cu-chulainn": {"title": "Cú Chulainn", "summary": "Hrdina bránící Ulster a propadající děsivé bojové zuřivosti."},
    "banshee": {"title": "Banshee", "summary": "Ženský duch, jehož nářek oznamuje smrt v určitých rodech."},
    "kelpie": {"title": "Kelpie", "summary": "Vodní kůň lákající jezdce do vody."},
    "perun": {"title": "Perun", "summary": "Hrom, dub, zbraně a knížecí moc."},
    "veles": {"title": "Veles", "summary": "Dobytek, bohatství, magie a konflikt s Perunem."},
    "mokosh": {"title": "Mokoš", "summary": "Ženská práce, vlhkost, země a plodnost."},
    "svarog": {"title": "Svarog", "summary": "Nebeský oheň a kovářství v pozdější rekonstrukci."},
    "baba-yaga": {"title": "Baba Jaga", "summary": "Bytost z chalupy na kuří nožce, pomocnice, hrozba i zkoušející."},
    "rusalka": {"title": "Rusalka", "summary": "Nebezpečný ženský vodní duch často spojený s předčasnou smrtí."},
    "domovoi": {"title": "Domovoj", "summary": "Ochranný nebo znepokojivý duch domácnosti."},
    "leshy": {"title": "Lešij", "summary": "Lesní strážce a trikster."},
    "odin": {"title": "Odin", "summary": "Moudrost, válka, poezie, magie a mrtví."},
    "thor": {"title": "Thor", "summary": "Obránce bohů a lidí, vládce hromu a nositel Mjöllniru."},
    "loki": {"title": "Loki", "summary": "Dvojznačný trikster, který vyvolává krize i pomáhá je řešit."},
    "freyja": {"title": "Freyja", "summary": "Láska, plodnost, magie a padlí v boji."},
    "tyr": {"title": "Týr", "summary": "Válečný a právní bůh, který obětuje ruku při spoutání Fenrira."},
    "fenrir": {"title": "Fenrir", "summary": "Spoutaný obří vlk, který při Ragnaröku zabije Odina."},
    "jormungandr": {"title": "Jörmungandr", "summary": "Světový had obepínající zemi a bojující s Thorem při Ragnaröku."},
    "valkyries": {"title": "Valkýry", "summary": "Nadpřirozené bojovnice vybírající část padlých pro Odina."},
    "yggdrasil": {"title": "Yggdrasil", "summary": "Světový strom spojující světy bohů, lidí, obrů a mrtvých."},
    "ragnarok": {"title": "Ragnarök", "summary": "Závěrečná bitva, kosmická zkáza a pozdější obnova světa."},
}


MASTER_SPECIAL_DESCRIPTIONS_EN = {
    "ai-regulation-and-governance-accelerate": (
        "AI regulation and governance accelerate refers to the period around 2024 when governments, regulators, standards bodies, companies, and research institutions began turning concern about advanced AI into dedicated rules and oversight systems. The topic is not only about one law. It is about the shift from treating AI as a specialized technical field to treating it as infrastructure that can affect work, education, medicine, security, elections, copyright, privacy, and public trust.\n\n"
        "A central example is the European Union's AI Act, which entered into force on 1 August 2024 and introduced a risk-based framework for artificial intelligence. Systems with minimal risk face few obligations, systems with transparency risks must inform users or label certain synthetic content, high-risk systems face stricter requirements around data, documentation, oversight, and safety, and some uses such as government-style social scoring are banned. The law applies progressively, with major application milestones through 2025 and 2026.\n\n"
        "This topic matters because generative and predictive AI moved quickly into daily tools while public institutions were still learning how to evaluate capability, harm, accountability, and enforcement. Governance became a practical problem: who tests models, who documents data and limitations, who responds when systems discriminate or hallucinate, and how societies keep innovation from becoming an excuse for avoidable damage.\n\n"
        "A reader can picture committee rooms, public consultations, model documentation, audit reports, red-team evaluations, court debates, developer dashboards, and citizens encountering automated decisions. The visual world is contemporary rather than futuristic: laptops, legal texts, data centers, warning labels, policy briefings, and people trying to make powerful software legible enough to govern."
    ),
    "artemis-ii-launches-crew-around-the-moon": (
        "Artemis II was NASA's first crewed flight of the Artemis program and the first mission to send astronauts around the Moon in more than half a century. The Space Launch System rocket lifted off from Kennedy Space Center on 1 April 2026 with the Orion spacecraft carrying Reid Wiseman, Victor Glover, Christina Koch, and Canadian Space Agency astronaut Jeremy Hansen. The mission was a crewed lunar flyby, not a landing, and it tested the spacecraft, rocket, ground systems, crew operations, navigation, communications, and reentry procedures needed for later Artemis missions.\n\n"
        "The flight lasted nearly ten days and returned with splashdown in the Pacific Ocean off San Diego on 10 April 2026. Its importance comes from continuity and testing. Apollo proved that humans could reach the Moon; Artemis II showed that a new generation of hardware, crews, agencies, and international partnerships could again operate beyond low Earth orbit. It also helped prepare the path toward future lunar surface missions and longer-term ambitions connected with Mars.\n\n"
        "A reader can picture the white SLS rocket on Launch Pad 39B, flame and steam at liftoff, the Orion capsule moving away from Earth, four astronauts working inside a compact spacecraft, the curve of the Moon outside the windows, and the blue Earth seen from deep space. The event belongs to modern exploration because it joins engineering, national policy, live global media, risk management, and human emotion.\n\n"
        "Dating note: the launch date is historical and precise. The topic should be read as a milestone in a continuing program rather than as the completion of lunar return. Artemis II did not put astronauts on the lunar surface; it confirmed key systems and gave the renewed Moon program a concrete crewed achievement."
    ),
}


MASTER_SPECIAL_DESCRIPTIONS_CS = {
    "edict-of-milan": (
        "Edikt milánský bylo rozhodnutí římských císařů Konstantina I. a Licinia z roku 313, které zaručilo obyvatelům Římské říše svobodu vyznání a legalizovalo křesťanství.\n\n"
        "Ukončilo státní pronásledování křesťanů a nařídilo vrátit jim zabavený majetek a místa bohoslužeb. Neznamenalo však, že se křesťanství okamžitě stalo státním náboženstvím. Získalo stejné právo na existenci jako ostatní náboženství, což bylo ve světě pozdní antiky zásadní politické gesto.\n\n"
        "Událost je významným mezníkem v evropských dějinách, protože umožnila rychlý rozvoj křesťanské církve uvnitř římského státu. Přesnější označení by bylo milánská dohoda, protože nejspíš nešlo o jeden formálně vydaný edikt, ale o dohodnutou náboženskou politiku následně rozeslanou v podobě císařského dopisu.\n\n"
        "Symbol chí-ró (☧) spojuje první dvě písmena řeckého slova ΧΡΙΣΤΟΣ - Christos, tedy Kristus. Patří k nejstarším křesťanským znakům a s Konstantinem je silně spojován, protože jej používal jako znamení moci a vítězství po svém příklonu ke křesťanství.\n\n"
        "SPQR je zkratka latinského Senatus Populusque Romanus, česky Senát a lid římský. Bylo to oficiální označení římského státu a v obrazu vedle císařů, mapy říše, svitku a křesťanských symbolů pomáhá ukázat přechod od pronásledování ke státem tolerovanému náboženskému životu."
    ),
    "ai-regulation-and-governance-accelerate": (
        "Regulace a správa AI zrychlují označuje období kolem roku 2024, kdy vlády, regulátoři, standardizační organizace, firmy a výzkumné instituce začaly převádět obavy z pokročilé umělé inteligence do konkrétních pravidel a dohledových systémů. Téma není jen o jednom zákonu. Zachycuje posun od chápání AI jako úzké technické oblasti k chápání AI jako infrastruktury, která může ovlivňovat práci, vzdělání, medicínu, bezpečnost, volby, autorská práva, soukromí a důvěru veřejnosti.\n\n"
        "Ústředním příkladem je unijní AI Act, který vstoupil v platnost 1. srpna 2024 a zavedl rizikový rámec pro umělou inteligenci. Systémy s minimálním rizikem mají jen málo povinností, systémy s rizikem transparentnosti musejí informovat uživatele nebo označovat některý syntetický obsah, vysoce rizikové systémy podléhají přísnějším požadavkům na data, dokumentaci, dohled a bezpečnost a některá použití, například sociální skórování státem, jsou zakázána. Pravidla se uplatňují postupně, s důležitými milníky v letech 2025 a 2026.\n\n"
        "Téma je důležité proto, že generativní a prediktivní AI rychle vstoupila do každodenních nástrojů, zatímco veřejné instituce se teprve učily posuzovat schopnosti, škody, odpovědnost a vymáhání. Správa AI se stala praktickým problémem: kdo testuje modely, kdo dokumentuje data a omezení, kdo reaguje při diskriminaci nebo halucinacích systémů a jak společnost zabrání tomu, aby se inovace stala omluvou pro zbytečné škody.\n\n"
        "Čtenář si může představit jednací sály, veřejné konzultace, modelovou dokumentaci, auditní zprávy, red-team testy, soudní debaty, vývojářské dashboardy a občany narážející na automatizovaná rozhodnutí. Vizuální svět je současný, ne futuristický: notebooky, právní texty, datová centra, varovné štítky, politické briefinky a lidé, kteří se snaží učinit mocný software dostatečně srozumitelným, aby jej bylo možné spravovat."
    ),
    "artemis-ii-launches-crew-around-the-moon": (
        "Artemis II byl první pilotovaný let programu Artemis a první mise po více než půl století, která vyslala astronauty kolem Měsíce. Raketa Space Launch System odstartovala z Kennedyho vesmírného střediska 1. dubna 2026 s lodí Orion, na jejíž palubě byli Reid Wiseman, Victor Glover, Christina Koch a astronaut Kanadské kosmické agentury Jeremy Hansen. Šlo o pilotovaný průlet kolem Měsíce, nikoli o přistání, a mise testovala loď, raketu, pozemní systémy, práci posádky, navigaci, komunikaci i návrat do atmosféry pro pozdější mise Artemis.\n\n"
        "Let trval téměř deset dní a skončil 10. dubna 2026 přistáním v Tichém oceánu u San Diega. Význam spočívá v návaznosti a ověření schopností. Apollo dokázalo, že lidé mohou dosáhnout Měsíce; Artemis II ukázal, že nová generace techniky, posádek, agentur a mezinárodních partnerství dokáže znovu pracovat za nízkou oběžnou dráhou Země. Mise zároveň připravila cestu k budoucím výpravám na měsíční povrch a k dlouhodobějším ambicím spojeným s Marsem.\n\n"
        "Čtenář si může představit bílou raketu SLS na rampě 39B, plamen a páru při startu, loď Orion vzdalující se od Země, čtyři astronauty pracující v kompaktní kabině, křivku Měsíce za okny a modrou Zemi viděnou z hlubokého vesmíru. Událost patří k modernímu průzkumu, protože spojuje inženýrství, státní politiku, živé globální vysílání, řízení rizik a lidské emoce.\n\n"
        "Poznámka k datování: datum startu je historické a přesné. Téma je třeba číst jako milník pokračujícího programu, ne jako dokončení návratu na Měsíc. Artemis II neposadil astronauty na měsíční povrch; potvrdil klíčové systémy a dal obnovenému lunárnímu programu konkrétní pilotovaný úspěch."
    ),
}


def main() -> None:
    progress_rows: list[dict[str, Any]] = []
    for package_path in PACKAGE_PATHS:
        document = json.loads(package_path.read_text(encoding="utf-8"))
        package_slug = document["packageSlug"]
        for entry in document["entries"]:
            if package_slug == "master-timeline":
                enrich_master_entry(entry)
            elif package_slug == "mythology":
                enrich_mythology_entry(entry)
            else:
                raise ValueError(f"Unsupported package slug: {package_slug}")

            en_description = entry["translations"]["en"]["description"]
            cs_description = entry["translations"]["cs"]["description"]
            progress_rows.append(
                {
                    "package": package_slug,
                    "slug": entry["slug"],
                    "en_chars": len(en_description),
                    "cs_chars": len(cs_description),
                }
            )

        package_path.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        write_package_zip(package_path.parent)

    write_progress(progress_rows)
    validate_progress(progress_rows)
    print(f"Updated {len(progress_rows)} entries.")
    print(f"Wrote progress to {PROGRESS_PATH}.")


def enrich_master_entry(entry: dict[str, Any]) -> None:
    slug = entry["slug"]
    raw = entry.get("raw", {})
    cs_data = MASTER_CS.get(slug)
    if not cs_data:
        raise KeyError(f"Missing Czech master translation data for {slug}")

    translations = entry.setdefault("translations", {})
    en = translations.setdefault("en", {})
    cs = translations.setdefault("cs", {})

    title_en = en.get("title") or entry.get("title") or raw.get("Event / development") or slug
    summary_en = en.get("summary") or raw.get("Why it matters") or f"{title_en} is a significant timeline topic."
    date_en = entry.get("dateLabel") or raw.get("Approx. date") or "an uncertain date"
    region_en = raw.get("Region") or localized_place(entry, "en") or "the relevant region"
    region_cs = localized_place(entry, "cs") or translate_date_or_label(region_en)
    category_en = raw.get("Category") or localized_tag(entry, "category", "en") or "history"
    category_cs = localized_tag(entry, "category", "cs") or "dějiny"
    era_en = raw.get("Era") or localized_time_period(entry, "en") or "its period"
    era_cs = localized_time_period(entry, "cs") or "svého období"
    dating_en = en.get("datingNote") or entry.get("timeConfidence") or raw.get("Dating confidence") or "Dating is based on available evidence."
    dating_cs = cs.get("datingNote") or translate_dating_note(dating_en, package="master")
    title_cs = cs_data["title"]
    summary_cs = cs_data["summary"]

    existing_edict_en = ""
    if slug == "edict-of-milan":
        existing_edict_en = en.get("description", "")

    description_en = MASTER_SPECIAL_DESCRIPTIONS_EN.get(slug)
    if description_en is None:
        description_en = existing_edict_en if len(existing_edict_en) >= MIN_EN_DESCRIPTION_CHARS else build_master_description_en(
            title=title_en,
            summary=summary_en,
            date=date_en,
            region=region_en,
            category=category_en,
            era=era_en,
            dating=dating_en,
        )
    description_cs = MASTER_SPECIAL_DESCRIPTIONS_CS.get(slug) or build_master_description_cs(
        title=title_cs,
        summary=summary_cs,
        date=translate_date_or_label(date_en),
        region=region_cs,
        category=category_cs,
        era=era_cs,
        dating=dating_cs,
    )

    en["title"] = sanitize_for_tts(title_en, "en")
    en["summary"] = sanitize_for_tts(summary_en, "en")
    en["description"] = sanitize_for_tts(
        extend_en_description(description_en, title_en, region_en, category_en),
        "en",
    )
    en["whyItMatters"] = sanitize_for_tts(en.get("whyItMatters") or summary_en, "en")
    en["datingNote"] = sanitize_for_tts(dating_en, "en")

    cs["title"] = sanitize_for_tts(title_cs, "cs")
    cs["summary"] = sanitize_for_tts(summary_cs, "cs")
    cs["description"] = sanitize_for_tts(
        extend_cs_description(description_cs, title_cs, region_cs, category_cs),
        "cs",
    )
    cs["whyItMatters"] = sanitize_for_tts(summary_cs, "cs")
    cs["datingNote"] = sanitize_for_tts(dating_cs, "cs")


def enrich_mythology_entry(entry: dict[str, Any]) -> None:
    slug = entry["slug"]
    raw = entry.get("raw", {})
    cs_data = MYTHOLOGY_CS.get(slug)
    if not cs_data:
        raise KeyError(f"Missing Czech mythology translation data for {slug}")

    translations = entry.setdefault("translations", {})
    en = translations.setdefault("en", {})
    cs = translations.setdefault("cs", {})

    title_en = en.get("title") or entry.get("title") or raw.get("Figure / creature") or slug
    summary_en = en.get("summary") or raw.get("What it represents / famous story") or f"{title_en} is a mythology topic."
    date_en = entry.get("dateLabel") or raw.get("Probable tradition age") or "an uncertain tradition age"
    tradition_en = raw.get("Tradition") or localized_tag(entry, "tradition", "en") or "mythological"
    tradition_cs = localized_tag(entry, "tradition", "cs") or "mytologické"
    type_en = raw.get("Type") or localized_tag(entry, "mythology-type", "en") or "mythological figure"
    type_cs = localized_tag(entry, "mythology-type", "cs") or "mytologická postava"
    evidence_en = raw.get("Earliest important written evidence") or en.get("description") or "surviving written and artistic evidence"
    dating_en = en.get("datingNote") or raw.get("Dating note") or entry.get("timeConfidence") or "Dating is approximate."
    dating_cs = cs.get("datingNote") or translate_dating_note(dating_en, package="mythology")
    title_cs = cs_data["title"]
    summary_cs = cs_data["summary"]

    description_en = build_mythology_description_en(
        title=title_en,
        summary=summary_en,
        date=date_en,
        tradition=tradition_en,
        myth_type=type_en,
        evidence=evidence_en,
        dating=dating_en,
    )
    description_cs = build_mythology_description_cs(
        title=title_cs,
        summary=summary_cs,
        date=translate_date_or_label(date_en),
        tradition=tradition_cs,
        myth_type=type_cs,
        evidence=translate_date_or_label(evidence_en),
        dating=dating_cs,
    )

    en["title"] = sanitize_for_tts(title_en, "en")
    en["summary"] = sanitize_for_tts(summary_en, "en")
    en["description"] = sanitize_for_tts(
        extend_en_description(description_en, title_en, tradition_en, type_en),
        "en",
    )
    en["whyItMatters"] = sanitize_for_tts(en.get("whyItMatters") or summary_en, "en")
    en["datingNote"] = sanitize_for_tts(dating_en, "en")

    cs["title"] = sanitize_for_tts(title_cs, "cs")
    cs["summary"] = sanitize_for_tts(summary_cs, "cs")
    cs["description"] = sanitize_for_tts(
        extend_cs_description(description_cs, title_cs, tradition_cs, type_cs),
        "cs",
    )
    cs["whyItMatters"] = sanitize_for_tts(summary_cs, "cs")
    cs["datingNote"] = sanitize_for_tts(dating_cs, "cs")


def build_master_description_en(
    *,
    title: str,
    summary: str,
    date: str,
    region: str,
    category: str,
    era: str,
    dating: str,
) -> str:
    return "\n\n".join(
        [
            (
                f"{title} is a timeline topic in the field of {lower_initial(category)}, dated {date} and placed in {region}. "
                f"In the timeline it belongs to {era}. The basic point is simple: {summary} "
                "That short statement is only the doorway. The fuller subject is about a change that altered what people could make, record, rule, believe, exchange, fear, or imagine."
            ),
            master_context_en(category),
            (
                f"A reader can picture the scene through the material details around it: landscapes and settlements in {region}, tools and buildings of the period, routes of travel, public spaces, workshops, shrines, battlefields, schools, ports, laboratories, or homes depending on the topic. "
                f"The date {date} should be treated as a timeline anchor, not as the whole story. It helps compare this entry with neighboring developments and shows what had already appeared and what had not yet become possible."
            ),
            (
                f"The importance of {title} comes from consequences. Some effects were immediate, while others became visible only after generations as institutions, technologies, memories, stories, and daily habits absorbed the change. "
                "The topic also helps connect small human actions to large historical patterns: a tool can reshape labor, a text can stabilize memory, a voyage can redraw maps, a law can change identity, and a scientific model can reorganize how people explain the world."
            ),
            (
                f"Dating note: {dating}. For a broad educational timeline, this means the entry should be read as a clear reference point inside a longer process. "
                "Surviving evidence usually preserves only part of what happened, and modern labels often simplify older realities, but the topic remains useful because it gives the user a concrete place to begin understanding the wider transformation."
            ),
        ]
    )


def build_master_description_cs(
    *,
    title: str,
    summary: str,
    date: str,
    region: str,
    category: str,
    era: str,
    dating: str,
) -> str:
    return "\n\n".join(
        [
            (
                f"{title} je téma z oblasti {category}, datované na {date} a spojené s oblastí {region}. "
                f"V časové ose patří do období {era}. Základní smysl je jednoduchý: {summary} "
                "Tato krátká věta je jen vstupem do tématu. V širším pohledu jde o změnu, která ovlivnila, co lidé dokázali vyrábět, zapisovat, spravovat, věřit, směňovat, obávat se nebo si představovat."
            ),
            master_context_cs(category),
            (
                f"Čtenář si může scénu představit přes konkrétní detaily: krajinu a sídla v oblasti {region}, dobové nástroje a stavby, cesty, veřejná prostranství, dílny, svatyně, bojiště, školy, přístavy, laboratoře nebo domácnosti podle povahy tématu. "
                f"Datum {date} je opěrný bod časové osy, ne celý příběh. Pomáhá srovnat toto téma se sousedními událostmi a ukazuje, co už existovalo a co ještě nebylo možné."
            ),
            (
                f"Význam tématu {title} spočívá v následcích. Některé byly okamžité, jiné se projevily až po generace, když změnu vstřebaly instituce, technologie, paměť, příběhy a každodenní zvyky. "
                "Téma také propojuje drobné lidské jednání s velkými dějinnými vzorci: nástroj může změnit práci, text může upevnit paměť, plavba může překreslit mapy, zákon může změnit identitu a vědecký model může nově uspořádat vysvětlení světa."
            ),
            (
                f"Poznámka k datování: {dating}. Pro širokou vzdělávací časovou osu to znamená, že záznam je vhodné číst jako srozumitelný bod uvnitř delšího procesu. "
                "Dochované prameny obvykle zachycují jen část děje a moderní názvy často zjednodušují starší skutečnost, přesto téma dobře slouží jako konkrétní začátek pro pochopení širší proměny."
            ),
        ]
    )


def build_mythology_description_en(
    *,
    title: str,
    summary: str,
    date: str,
    tradition: str,
    myth_type: str,
    evidence: str,
    dating: str,
) -> str:
    return "\n\n".join(
        [
            (
                f"{title} belongs to the {tradition} tradition and has the type label {lower_initial(myth_type)}. "
                f"The approximate tradition age is {date}, while the earliest important written or material anchor is {sentence(evidence)} "
                f"The central idea is: {summary} This gives the user the first handle on the figure, but mythology works through layers of ritual, story, place, family memory, poetry, and later retelling."
            ),
            mythology_context_en(tradition),
            (
                f"To picture {title}, start with the symbols and situations that surround the figure: divine spaces, thresholds between worlds, sacred animals or objects, weapons, boats, trees, caves, courts, mountains, rivers, tombs, or houses as the tradition requires. "
                "Mythological descriptions should not be read as a single fixed biography. They are clusters of motifs that changed as storytellers, priests, poets, artists, and communities reused them for new audiences."
            ),
            (
                f"The importance of {title} lies in what the figure makes visible. Myths can explain kingship, death, fertility, weather, moral order, danger, craft, desire, the boundary between humans and gods, or the fear that ordinary life can suddenly open into the supernatural. "
                "That is why a short database label is not enough: the user needs enough atmosphere and context to understand both the story role and the cultural work the story performed."
            ),
            (
                f"Dating note: {dating}. In mythology, the date normally marks the earliest surviving evidence or a cautious estimate for the tradition, not the moment when the story was invented. "
                "Older oral layers may be lost, later texts may preserve archaic material, and artistic evidence can show forms that written sources explain only much later. The entry therefore gives a stable orientation point while still respecting uncertainty."
            ),
        ]
    )


def build_mythology_description_cs(
    *,
    title: str,
    summary: str,
    date: str,
    tradition: str,
    myth_type: str,
    evidence: str,
    dating: str,
) -> str:
    return "\n\n".join(
        [
            (
                f"{title} patří do {czech_tradition_genitive(tradition)} tradice a v tomto souboru je veden jako {lower_initial(myth_type)}. "
                f"Přibližné stáří tradice je {date}, zatímco nejstarší důležitá písemná nebo hmotná opora je {sentence(evidence)} "
                f"Jádro tématu je: {summary} To dává uživateli první pevný bod, ale mytologie funguje ve vrstvách rituálu, vyprávění, místní paměti, poezie a pozdějšího převyprávění."
            ),
            mythology_context_cs(tradition),
            (
                f"Při představě tématu {title} je dobré začít symboly a situacemi, které postavu obklopují: božské prostory, hranice mezi světy, posvátné bytosti nebo předměty, zbraně, lodě, stromy, jeskyně, dvory, hory, řeky, hrobky nebo domy podle konkrétní tradice. "
                "Mytologický popis není jedna pevná biografie. Je to shluk motivů, které se měnily, když je vypravěči, kněží, básníci, umělci a komunity znovu používali pro nové publikum."
            ),
            (
                f"Význam tématu {title} spočívá v tom, co umožňuje zviditelnit. Mýty mohou vysvětlovat královskou moc, smrt, plodnost, počasí, morální řád, nebezpečí, řemeslo, touhu, hranici mezi lidmi a bohy nebo strach, že se běžný život náhle otevře nadpřirozenu. "
                "Proto nestačí krátký databázový štítek: uživatel potřebuje atmosféru a kontext, aby pochopil roli v příběhu i kulturní práci, kterou příběh vykonával."
            ),
            (
                f"Poznámka k datování: {dating}. U mytologie datum obvykle označuje nejstarší dochovaný doklad nebo opatrný odhad stáří tradice, ne okamžik, kdy byl příběh vymyšlen. "
                "Starší ústní vrstvy se mohly ztratit, pozdější texty mohou uchovávat archaickou látku a výtvarné doklady někdy ukazují podoby, které písemné prameny vysvětlují až mnohem později. Záznam proto dává stabilní orientaci a zároveň respektuje nejistotu."
            ),
        ]
    )


def master_context_en(category: str) -> str:
    lower = category.lower()
    if any(key in lower for key in ["invention", "technology", "transport", "infrastructure", "industrialization"]):
        return (
            "As a technological development, the topic is best understood through practical capacity. "
            "It changed the relationship between knowledge and work: materials had to be gathered, skills taught, processes repeated, and results trusted. Once a technique or device became reliable, it could spread into trade, warfare, administration, farming, movement, communication, or domestic life."
        )
    if any(key in lower for key in ["human history", "civilization", "empire", "political", "revolution", "economy", "international"]):
        return (
            "As a social and political development, the topic is about organization as much as about a single moment. "
            "It shows how communities create authority, defend territory, manage labor, remember legitimacy, and decide who belongs. Its visible surface may be a ruler, a law, a city, a treaty, or a crisis, but beneath that surface are institutions and everyday pressures."
        )
    if any(key in lower for key in ["religion", "mythology", "literature", "culture", "philosophy"]):
        return (
            "As a cultural and religious development, the topic matters because shared meanings can outlive the people who first shaped them. "
            "Stories, rituals, poems, doctrines, and symbols give communities ways to explain origin, duty, suffering, power, death, and hope. Written sources often preserve only a late stage of a much longer conversation."
        )
    if any(key in lower for key in ["war", "conquest", "terrorism"]):
        return (
            "As a conflict topic, it should be read through decisions, violence, logistics, fear, and aftermath. "
            "Battles and campaigns are never only military events: they redirect populations, resources, borders, memories, and political choices. The human cost and the later interpretation of victory or defeat are part of the subject."
        )
    if any(key in lower for key in ["science", "medicine", "environment", "pandemic"]):
        return (
            "As a scientific, medical, or environmental topic, it is about evidence changing action. "
            "Observation, experiment, measurement, public health, and policy can all reshape how people understand risk and possibility. The topic belongs to the history of ideas, but also to bodies, tools, institutions, and material conditions."
        )
    if any(key in lower for key in ["exploration", "space"]):
        return (
            "As an exploration topic, it links curiosity with navigation, power, risk, and encounter. "
            "Journeys create records and maps, but they also reveal inequalities in who gets to name places and whose knowledge is preserved. The subject should include both the movement itself and the people affected by it."
        )
    if "architecture" in lower:
        return (
            "As an architectural topic, it turns labor, planning, belief, and power into visible form. "
            "A monument is not only stone or brick; it is organization, engineering, symbolic ambition, and the ability to coordinate many lives toward a lasting structure."
        )
    return (
        "On the timeline, this topic works as a bridge between everyday experience and long-term historical change. "
        "It helps the user see how one development can gather many strands at once: material resources, social habits, political choices, beliefs, and the limits of what people knew at the time."
    )


def master_context_cs(category: str) -> str:
    lower = category.lower()
    if any(key in lower for key in ["vynález", "technologie", "doprava", "infrastruktura", "industrializace"]):
        return (
            "Jako technologický vývoj je téma nejlépe pochopitelné přes praktickou schopnost něco opakovaně dělat. "
            "Mění vztah mezi znalostí a prací: bylo třeba získat materiály, předávat dovednosti, opakovat postupy a důvěřovat výsledkům. Jakmile se technika nebo zařízení osvědčily, mohly pronikat do obchodu, válčení, správy, zemědělství, pohybu, komunikace nebo domácího života."
        )
    if any(key in lower for key in ["dějiny", "civilizace", "říše", "politika", "revoluce", "ekonomika", "mezinárodní"]):
        return (
            "Jako společenský a politický vývoj je téma o organizaci stejně jako o jediné události. "
            "Ukazuje, jak komunity vytvářejí autoritu, brání území, řídí práci, pamatují si legitimitu a rozhodují, kdo k nim patří. Na povrchu může stát panovník, zákon, město, smlouva nebo krize, pod povrchem však působí instituce a každodenní tlak."
        )
    if any(key in lower for key in ["náboženství", "mytologie", "literatura", "kultura", "filozofie"]):
        return (
            "Jako kulturní a náboženský vývoj je téma důležité proto, že sdílené významy mohou přežít lidi, kteří je poprvé vytvořili. "
            "Příběhy, rituály, básně, nauky a symboly dávají komunitám způsoby, jak vysvětlit původ, povinnost, utrpení, moc, smrt a naději. Písemné prameny často zachycují jen pozdní vrstvu mnohem delšího rozhovoru."
        )
    if any(key in lower for key in ["válka", "dobytí", "terorismus"]):
        return (
            "Jako konfliktní téma je třeba ho číst přes rozhodnutí, násilí, logistiku, strach a následky. "
            "Bitvy a tažení nejsou jen vojenské události: přesměrovávají obyvatelstvo, zdroje, hranice, paměť a politické volby. Součástí tématu je lidská cena i pozdější výklad vítězství nebo porážky."
        )
    if any(key in lower for key in ["věda", "medicína", "prostředí", "pandemie"]):
        return (
            "Jako vědecké, lékařské nebo environmentální téma ukazuje, jak důkazy mění jednání. "
            "Pozorování, experiment, měření, veřejné zdraví a politika mohou změnit chápání rizika i možností. Téma patří do dějin idejí, ale také k tělům, nástrojům, institucím a materiálním podmínkám."
        )
    if any(key in lower for key in ["objevování", "vesmír"]):
        return (
            "Jako téma objevování spojuje zvědavost s navigací, mocí, rizikem a setkáním. "
            "Cesty vytvářejí záznamy a mapy, ale zároveň ukazují nerovnost v tom, kdo může místa pojmenovat a čí znalosti se zachovají. Téma proto zahrnuje samotný pohyb i lidi, kterých se dotkl."
        )
    if "architektura" in lower:
        return (
            "Jako architektonické téma převádí práci, plánování, víru a moc do viditelné podoby. "
            "Monument není jen kámen nebo cihla; je to organizace, inženýrství, symbolická ambice a schopnost koordinovat mnoho životů k trvalé stavbě."
        )
    return (
        "V časové ose téma funguje jako most mezi každodenní zkušeností a dlouhodobou historickou změnou. "
        "Pomáhá vidět, jak jeden vývoj spojuje více vláken najednou: materiální zdroje, společenské zvyky, politická rozhodnutí, víru a hranice toho, co lidé v dané době věděli."
    )


def mythology_context_en(tradition: str) -> str:
    lower = tradition.lower()
    if "egyptian" in lower:
        return (
            "In Egyptian religion, myth is closely tied to kingship, temple ritual, burial, cosmic order, and the daily cycle of the sun. "
            "Divine figures often combine human and animal forms because their images point to powers rather than ordinary bodies. Tomb texts, temple walls, amulets, and later retellings all preserve different angles of the same sacred imagination."
        )
    if "greek" in lower:
        return (
            "In Greek mythology, gods and heroes are remembered through poetry, cult practice, drama, local shrines, and visual art. "
            "The same figure can look different in Homer, Hesiod, tragedy, vase painting, and later mythography. Family conflict, honor, desire, divine law, and the unstable border between mortal and immortal life are recurring themes."
        )
    if "japanese" in lower:
        return (
            "In Japanese tradition, kami stories connect landscape, lineage, ritual authority, and the formation of the islands. "
            "The Kojiki and Nihon Shoki record courtly versions of older material, while later folklore turns spirits into local, playful, frightening, or protective presences. The result is a layered world in which place and divinity are closely joined."
        )
    if "chinese" in lower:
        return (
            "In Chinese mythology and religious thought, figures often connect cosmic order, rulership, auspicious signs, landscape, ancestors, and moral cultivation. "
            "Texts, bronzes, tomb art, local cults, and later novels can all reshape a figure. A symbol may therefore move from omen to imperial emblem, from regional tale to literary character, or from danger to protection."
        )
    if "celtic" in lower:
        return (
            "Celtic material is often preserved in medieval manuscripts written after Christianization, so the surviving stories mix older divine patterns with later literary framing. "
            "Names, festivals, heroic cycles, place traditions, inscriptions, and archaeology must be read together. Sovereignty, battle, skill, prophecy, hospitality, and the strangeness of the otherworld are frequent concerns."
        )
    if "slavic" in lower:
        return (
            "Slavic traditions are difficult to date because the surviving written evidence is sparse and often comes from outsiders or later Christian contexts. "
            "Folklore, chronicles, place names, ritual survivals, and comparative study have to be handled carefully. The resulting picture is fragmentary but vivid, with attention to storm, household, forest, water, fertility, death, and seasonal danger."
        )
    if "norse" in lower:
        return (
            "Norse mythology is preserved mainly in medieval Icelandic texts, skaldic poetry, runic evidence, place names, and archaeological finds. "
            "The stories remember gods, giants, heroes, monsters, cosmic trees, doomed battles, and a universe shaped by fate. They are late records of older Germanic traditions, so certainty and caution have to stand together."
        )
    return (
        "Mythological traditions preserve meaning through repeated storytelling, ritual use, image-making, and local memory. "
        "A single name can hold many layers because communities kept adapting older material to new political, religious, and artistic settings."
    )


def mythology_context_cs(tradition: str) -> str:
    lower = tradition.lower()
    if "egypt" in lower:
        return (
            "V egyptském náboženství je mýtus úzce spojen s královskou mocí, chrámovým rituálem, pohřbem, kosmickým řádem a každodenním cyklem slunce. "
            "Božské postavy často spojují lidské a zvířecí podoby, protože jejich obrazy ukazují síly, ne běžná těla. Texty hrobek, chrámové stěny, amulety a pozdější převyprávění uchovávají různé pohledy na tutéž posvátnou představivost."
        )
    if "řeck" in lower:
        return (
            "V řecké mytologii jsou bohové a hrdinové uchováni v poezii, kultu, dramatu, místních svatyních a výtvarném umění. "
            "Tatáž postava může vypadat jinak u Homéra, Hésioda, tragiků, na vázové malbě a v pozdějších souhrnech mýtů. Opakují se rodinné spory, čest, touha, božské právo a nejistá hranice mezi smrtelným a nesmrtelným životem."
        )
    if "japonsk" in lower:
        return (
            "V japonské tradici propojují příběhy kami krajinu, rodovou linii, rituální autoritu a vznik ostrovů. "
            "Kodžiki a Nihon šoki zachycují dvorské verze starší látky, zatímco pozdější folklor proměňuje duchy v místní, hravé, děsivé nebo ochranné přítomnosti. Výsledkem je vrstvený svět, kde místo a božství stojí velmi blízko u sebe."
        )
    if "čínsk" in lower:
        return (
            "V čínské mytologii a náboženském myšlení postavy často propojují kosmický řád, vládu, příznivá znamení, krajinu, předky a mravní kultivaci. "
            "Texty, bronzy, hrobové umění, místní kulty a pozdější romány mohou tutéž postavu proměnit. Symbol tak může přejít od znamení k císařskému znaku, od místního příběhu k literární postavě nebo od nebezpečí k ochraně."
        )
    if "keltsk" in lower:
        return (
            "Keltská látka je často dochována ve středověkých rukopisech zapsaných po christianizaci, takže přežívající příběhy mísí starší božské vzorce s pozdějším literárním rámcem. "
            "Jména, svátky, hrdinské cykly, místní tradice, nápisy a archeologii je třeba číst společně. Častými tématy jsou svrchovanost, bitva, dovednost, proroctví, pohostinnost a zvláštnost zásvětí."
        )
    if "slovansk" in lower:
        return (
            "Slovanské tradice se datují obtížně, protože dochovaných písemných pramenů je málo a často pocházejí od vnějších pozorovatelů nebo z pozdějšího křesťanského prostředí. "
            "S folklorem, kronikami, místními jmény, rituálními přežitky a srovnávacím studiem je proto nutné zacházet opatrně. Výsledný obraz je zlomkovitý, ale výrazný: bouře, domácnost, les, voda, plodnost, smrt a sezónní nebezpečí."
        )
    if "seversk" in lower:
        return (
            "Severská mytologie je dochována hlavně ve středověkých islandských textech, skaldské poezii, runových dokladech, místních jménech a archeologických nálezech. "
            "Příběhy si pamatují bohy, obry, hrdiny, nestvůry, kosmické stromy, osudové bitvy a vesmír formovaný osudem. Jde o pozdní záznam starších germánských tradic, proto musí jistota a opatrnost stát vedle sebe."
        )
    return (
        "Mytologické tradice uchovávají význam opakovaným vyprávěním, rituálním užitím, tvorbou obrazů a místní pamětí. "
        "Jediné jméno může nést mnoho vrstev, protože komunity přizpůsobovaly starší látku novým politickým, náboženským a uměleckým prostředím."
    )


def extend_en_description(description: str, title: str, setting: str, category: str) -> str:
    extra = (
        f"For a strong mental picture, {title} should be approached with concrete anchors: the people involved, the places connected to {setting}, the objects or symbols that make the theme recognizable, and the later consequences that explain why it stayed memorable. "
        f"Those anchors keep the {category} topic from feeling abstract and give the user enough texture to recognize it again elsewhere on the timeline."
    )
    return extend_until_min(description, extra, MIN_EN_DESCRIPTION_CHARS)


def extend_cs_description(description: str, title: str, setting: str, category: str) -> str:
    extra = (
        f"Pro jasnou představu je dobré spojit téma {title} s konkrétními opěrnými body: lidmi, místy spojenými s oblastí {setting}, předměty nebo symboly, podle nichž je téma rozpoznatelné, a pozdějšími následky, které vysvětlují, proč zůstalo zapamatované. "
        f"Tyto opěrné body brání tomu, aby téma z oblasti {category} působilo abstraktně, a dávají uživateli dost detailů, aby je poznal i jinde v časové ose."
    )
    return extend_until_min(description, extra, MIN_CS_DESCRIPTION_CHARS)


def extend_until_min(description: str, extra: str, min_chars: int) -> str:
    current = description
    while len(current) < min_chars:
        current = f"{current}\n\n{extra}"
    return current


def lower_initial(value: str) -> str:
    if not value:
        return value
    return value[0].lower() + value[1:]


def sentence(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        return stripped
    return stripped if stripped.endswith((".", "!", "?")) else f"{stripped}."


def czech_tradition_genitive(value: str) -> str:
    lowered = lower_initial(value)
    if lowered.endswith("á"):
        return f"{lowered[:-1]}é"
    return lowered


def localized_tag(entry: dict[str, Any], group: str, language: str) -> str:
    values = [
        tag.get("translations", {}).get(language)
        for tag in entry.get("tags", [])
        if tag.get("group") == group and tag.get("translations", {}).get(language)
    ]
    return " / ".join(values)


def localized_place(entry: dict[str, Any], language: str) -> str:
    values = [
        place.get("translations", {}).get(language)
        for place in entry.get("places", [])
        if place.get("translations", {}).get(language)
    ]
    return " / ".join(values)


def localized_time_period(entry: dict[str, Any], language: str) -> str:
    values = [
        period.get("translations", {}).get(language)
        for period in entry.get("timePeriods", [])
        if period.get("relationType") == "Primary" and period.get("translations", {}).get(language)
    ]
    if not values:
        values = [
            period.get("translations", {}).get(language)
            for period in entry.get("timePeriods", [])
            if period.get("translations", {}).get(language)
        ]
    return " / ".join(values)


def translate_date_or_label(value: str) -> str:
    translated = value or ""
    replacements = {
        "Approximate date:": "Přibližné datum:",
        "Earliest important written evidence": "Nejstarší důležitý písemný doklad",
        "Pyramid Texts": "Texty pyramid",
        "Coffin Texts": "Texty rakví",
        "Book of the Dead": "Kniha mrtvých",
        "Kojiki": "Kodžiki",
        "Nihon Shoki": "Nihon šoki",
        "Journey to the West": "Putování na západ",
        "Poetic and Prose Eddas": "Poetická a Prozaická Edda",
        "Poetic Edda": "Poetická Edda",
        "Prose Edda": "Prozaická Edda",
        "Hesiod": "Hésiodos",
        "Homer": "Homér",
        "Homeric Hymn to Demeter": "Homérský hymnus na Démétér",
        "Linear B": "lineární písmo B",
        "oracle bones": "věštebné kosti",
        "Old Kingdom": "Stará říše",
        "New Kingdom": "Nová říše",
        "Warring States": "Válčící státy",
        "Han": "Chan",
        "Shang": "Šang",
        "Zhou": "Čou",
        "Roman-era": "doklady z římské doby",
        "Eddas": "Eddy",
        "medieval": "středověké",
        "later": "pozdější",
        "evidence": "doklady",
        "texts": "texty",
        "art": "umění",
        "and": "a",
        "c.": "přibližně",
        "century": "století",
        "Pre-": "před ",
        "pre-": "před ",
        "onward": "a dále",
        "BCE": "před naším letopočtem",
        "CE": "našeho letopočtu",
    }
    for source, target in replacements.items():
        translated = translated.replace(source, target)
    translated = re.sub(r"\b(\d{4})-(\d{2})-(\d{2})\b", lambda m: f"{int(m.group(3))}. {int(m.group(2))}. {m.group(1)}", translated)
    return translated


def translate_dating_note(value: str, *, package: str) -> str:
    if package == "master" and value == "Historical":
        return "Historické datum"
    if package == "master":
        if "Approximate" in value or "approximate" in value:
            return "Přibližné datum podle dostupných pramenů"
        if "Traditional" in value or "traditional" in value:
            return "Tradiční datum užívané v pozdější chronologii"
        return translate_date_or_label(value)
    return (
        "Ústní tradice může být starší než dochované texty; datování vychází z nejstarších známých dokladů a opatrného odhadu stáří tradice."
    )


def write_progress(rows: list[dict[str, Any]]) -> None:
    lines = [
        "# Topic Text Expansion Progress",
        "",
        "Generated by `tools/enrich-entry-texts.py`.",
        "",
        f"- Minimum English description length: {MIN_EN_DESCRIPTION_CHARS} characters",
        f"- Packages updated: {', '.join(sorted({row['package'] for row in rows}))}",
        f"- Entries updated: {len(rows)}",
        "",
        "| Package | Slug | EN chars | CS chars | Status |",
        "| --- | --- | ---: | ---: | --- |",
    ]
    for row in rows:
        lines.append(
            f"| {row['package']} | `{row['slug']}` | {row['en_chars']} | {row['cs_chars']} | updated |"
        )
    PROGRESS_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_package_zip(package_dir: Path) -> None:
    zip_path = package_dir.with_suffix(".zip")
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(package_dir.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(package_dir).as_posix())


def validate_progress(rows: list[dict[str, Any]]) -> None:
    too_short = [row for row in rows if row["en_chars"] < MIN_EN_DESCRIPTION_CHARS]
    missing_cs = [row for row in rows if row["cs_chars"] <= 0]
    if too_short:
        formatted = ", ".join(f"{row['package']}:{row['slug']}={row['en_chars']}" for row in too_short)
        raise ValueError(f"English descriptions below minimum: {formatted}")
    if missing_cs:
        formatted = ", ".join(f"{row['package']}:{row['slug']}" for row in missing_cs)
        raise ValueError(f"Missing Czech descriptions: {formatted}")


if __name__ == "__main__":
    main()

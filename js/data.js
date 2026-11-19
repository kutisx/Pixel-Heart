/* =========================================================================
   data.js — единый источник данных брендбука Pixel Heart.
   Здесь лежат новеллы, палитры, шрифты, варианты маскота, композиции
   и словарь интерфейсных подписей RU/EN.
   Модули только читают эти данные; состояние живёт в state.js.
   ========================================================================= */

export const LANGS = ['ru', 'en'];
export const LANG_IDS = LANGS;

export const STORAGE_NOTE_KEY = 'final.storageNote';

/* ------------------------------------------------------------------ новеллы */

export const NOVELS = [
  {
    id: 'doki',
    name: 'Doki Doki',
    paletteId: 'doki',
    tag: { ru: 'милая тревога', en: 'sweet dread' },
    blurb: {
      ru: 'Дневник, клуб и улыбка, которая знает больше, чем говорит.',
      en: 'A diary, a club, and a smile that knows more than it says.'
    },
    image: 'assets/novels/doki.png',
    imageAlt: {
      ru: 'Абстрактная заставка в розовых тонах с мягким свечением',
      en: 'Abstract pink key art with soft glow'
    }
  },
  {
    id: 'saya',
    name: 'Saya no Uta',
    paletteId: 'saya',
    tag: { ru: 'хоррор', en: 'horror' },
    blurb: {
      ru: 'Мир стал другим — и в нём всё ещё есть нежность.',
      en: 'The world turned strange, and tenderness survived it.'
    },
    image: 'assets/novels/saya.png',
    imageAlt: {
      ru: 'Абстрактная заставка в тёмно-зелёных и бордовых тонах',
      en: 'Abstract deep green and crimson key art'
    }
  },
  {
    id: 'nine',
    name: '9 Rip',
    paletteId: 'nine',
    tag: { ru: 'мистика', en: 'mystery' },
    blurb: {
      ru: 'Девять причин остаться после уроков.',
      en: 'Nine reasons to stay after class.'
    },
    image: 'assets/novels/nine.png',
    imageAlt: {
      ru: 'Абстрактная заставка в синих и фиолетовых тонах',
      en: 'Abstract blue and violet key art'
    }
  },
  {
    id: 'va11',
    name: 'VA-11 HALL-A',
    paletteId: 'va11',
    tag: { ru: 'киберпанк', en: 'cyberpunk' },
    blurb: {
      ru: 'Бар, где наливают свет и слушают тишину.',
      en: 'A bar that serves light and listens to silence.'
    },
    image: 'assets/novels/va11.png',
    imageAlt: {
      ru: 'Абстрактная заставка в неоновых розовых и голубых тонах',
      en: 'Abstract neon pink and cyan key art'
    }
  }
];

export const NOVEL_IDS = NOVELS.map((novel) => novel.id);

export function getNovel(id) {
  return NOVELS.find((novel) => novel.id === id) || NOVELS[0];
}

/* ----------------------------------------------------------------- палитры */

export const PALETTES = [
  {
    id: 'doki',
    novelId: 'doki',
    label: 'Doki Doki',
    shortLabel: 'Doki',
    mood: { ru: 'Милая тревога, розовый флёр', en: 'Sweet unease, a pink haze' },
    bg: '#1A0F16',
    text: '#F6E9F0',
    accent: '#FF6FAE',
    accent2: '#B84CFF',
    glow: 'rgba(255,111,174,.35)'
  },
  {
    id: 'saya',
    novelId: 'saya',
    label: 'Saya no Uta',
    shortLabel: 'Saya',
    mood: { ru: 'Хоррор, плоть и нежность', en: 'Horror, flesh and tenderness' },
    bg: '#0E1410',
    text: '#E6EFE2',
    accent: '#B23A3A',
    accent2: '#7A9E7E',
    glow: 'rgba(178,58,58,.35)'
  },
  {
    id: 'nine',
    novelId: 'nine',
    label: '9 Rip',
    shortLabel: '9 Rip',
    mood: { ru: 'Мистика, школа, тайна', en: 'Mystery, school, secrets' },
    bg: '#0A0E1A',
    text: '#E8ECFF',
    accent: '#7C5CFF',
    accent2: '#35D6C4',
    glow: 'rgba(124,92,255,.35)'
  },
  {
    id: 'va11',
    novelId: 'va11',
    label: 'VA-11 HALL-A',
    shortLabel: 'VA-11',
    mood: { ru: 'Киберпанк, неон, уют', en: 'Cyberpunk, neon, cosiness' },
    bg: '#120B1E',
    text: '#F5E9FF',
    accent: '#FF4D9D',
    accent2: '#4DE1FF',
    glow: 'rgba(255,77,157,.35)'
  }
];

export const PALETTE_IDS = PALETTES.map((palette) => palette.id);

export function getPalette(id) {
  return PALETTES.find((palette) => palette.id === id) || PALETTES[0];
}

export function getPaletteForNovel(novelId) {
  const novel = getNovel(novelId);
  return getPalette(novel.paletteId);
}

/* ------------------------------------------------------------------ шрифты */

export const FONTS = [
  {
    id: 'pixelify',
    label: 'Pixelify Sans',
    stack: '"Pixelify Sans", "Rubik", system-ui, sans-serif',
    note: {
      ru: 'Пиксельный гротеск для логотипа, маскота и крупных заголовков.',
      en: 'A pixel grotesque for the logo, mascot and large headings.'
    }
  },
  {
    id: 'rubik',
    label: 'Rubik',
    stack: '"Rubik", system-ui, sans-serif',
    note: {
      ru: 'Нейтральный гротеск для текста, интерфейса и длинных абзацев.',
      en: 'A neutral grotesque for body copy, UI and long paragraphs.'
    }
  }
];

export const FONT_IDS = FONTS.map((font) => font.id);

export function getFont(id) {
  return FONTS.find((font) => font.id === id) || FONTS[0];
}

/* ------------------------------------------------------------ варианты маскота */

export const OUTFITS = [
  { id: 'doki', label: { ru: 'Свитер с сердцем', en: 'Heart sweater' } },
  { id: 'saya', label: { ru: 'Плащ с капюшоном', en: 'Hooded coat' } },
  { id: 'nine', label: { ru: 'Школьная форма', en: 'School uniform' } },
  { id: 'va11', label: { ru: 'Фартук бармена', en: 'Bartender apron' } },
  { id: 'hoodie', label: { ru: 'Худи с карманом', en: 'Pocket hoodie' } },
  { id: 'dress', label: { ru: 'Платье с рюшами', en: 'Ruffled dress' } }
];

export const OUTFIT_IDS = OUTFITS.map((outfit) => outfit.id);

export const ACCESSORIES = [
  { id: 'none', label: { ru: 'Без аксессуара', en: 'No accessory' } },
  { id: 'doki', label: { ru: 'Лента с сердцем', en: 'Heart ribbon' } },
  { id: 'saya', label: { ru: 'Визор-окуляры', en: 'Visor goggles' } },
  { id: 'nine', label: { ru: 'Звёздная заколка', en: 'Star pin' } },
  { id: 'va11', label: { ru: 'Наушники', en: 'Headphones' } },
  { id: 'crown', label: { ru: 'Корона', en: 'Crown' } },
  { id: 'glasses', label: { ru: 'Круглые очки', en: 'Round glasses' } }
];

export const ACCESSORY_IDS = ACCESSORIES.map((accessory) => accessory.id);

export function getOutfit(id) {
  return OUTFITS.find((outfit) => outfit.id === id) || OUTFITS[0];
}

export function getAccessory(id) {
  return ACCESSORIES.find((accessory) => accessory.id === id) || ACCESSORIES[0];
}

/* -------------------------------------------------------------- композиции */

export const LAYOUTS = [
  {
    id: 'classic',
    label: { ru: 'Классика', en: 'Classic' },
    note: {
      ru: 'Заголовок сверху, слоган внизу, воздух по краям.',
      en: 'Title on top, slogan at the bottom, air around the edges.'
    }
  },
  {
    id: 'offset',
    label: { ru: 'Смещение', en: 'Offset' },
    note: {
      ru: 'Заголовок сдвинут вправо, слоган в рамке, метка в углу.',
      en: 'Title shifted right, slogan boxed, mark in the corner.'
    }
  }
];

export const LAYOUT_IDS = LAYOUTS.map((layout) => layout.id);

export function getLayout(id) {
  return LAYOUTS.find((layout) => layout.id === id) || LAYOUTS[0];
}

/* --------------------------------------------------- количество месяцев/дат */
export const DATE_LOCALES = { ru: 'ru-RU', en: 'en-GB' };

/**
 * Демо-подписи бренда по языкам. Если пользователь не менял name/slogan,
 * переключатель языка подставляет демо-текст другого языка. Любой ввод,
 * отличный от демо, не трогается.
 */
export const DEMO_COPY = {
  ru: {
    name: 'Pixel Heart',
    slogan: 'Истории, которые светятся в темноте'
  },
  en: {
    name: 'Pixel Heart',
    slogan: 'Stories that glow in the dark'
  }
};

/* ------------------------------------------------------------------- i18n */

export const I18N = {
  ru: {
    'meta.title': 'Pixel Heart — учебный брендбук издательства визуальных новелл',
    'meta.description':
      'Учебный брендбук Pixel Heart: тёмный минимализм, пиксельные акценты, четыре палитры и маскот, которого можно собрать самому.',

    'brand.sub': 'учебный брендбук',
    'brand.logoAlt': 'Pixel Heart — на главную',

    'nav.aria': 'Разделы брендбука',
    'nav.brief': 'Бриф',
    'nav.color': 'Цвет',
    'nav.typography': 'Типографика',
    'nav.mascot': 'Маскот',
    'nav.layouts': 'Макеты',
    'nav.final': 'Итог',

    'actions.print': 'Печать / PDF',
    'actions.printCard': 'Печать карточки',
    'actions.reset': 'Сброс',
    'actions.resetMascot': 'Сбросить маскота',
    'actions.close': 'Закрыть',
    'actions.dismiss': 'Скрыть сообщение',

    'lang.aria': 'Язык интерфейса',
    'a11y.skip': 'Перейти к содержимому',
    'a11y.newTab': 'открывается в новой вкладке',

    'hero.aria': 'Карусель новелл',
    'hero.kicker': 'Избранное',
    'hero.headTitle': 'Издательство визуальных новелл',
    'hero.headLead':
      'Тёмный минимализм, пиксельные акценты и мягкий свет. Четыре истории — одна узнаваемая система.',
    'hero.prev': 'Предыдущий слайд',
    'hero.next': 'Следующий слайд',
    'hero.dot': 'Слайд {n}: {name}',
    'hero.live': 'Слайд {n} из {total}: {name}',
    'hero.choose': 'Выбрать эту тему',
    'hero.hint': 'Стрелки ← → листают истории, Home и End прыгают к краям. Наведение или фокус внутри останавливают автопрокрутку.',
    'hero.placeholder': 'Заставка ещё не добавлена',
    'hero.placeholderPath': 'Положите файл: {path}',
    'hero.imageAlt': 'Заставка новеллы {name}',

    'brief.kicker': '01 · Бриф',
    'brief.title': 'Что мы собрали',
    'brief.lead':
      'Бренд-система издательства, которое соединяет пиксельную эстетику, тёмную атмосферу и отомэ-чувственность. Меняйте поля — примеры, макеты и брендбук обновятся сразу.',
    'brief.name': 'Название',
    'brief.namePlaceholder': 'Например, Pixel Heart',
    'brief.slogan': 'Слоган',
    'brief.sloganPlaceholder': 'Короткая фраза, которая светится',
    'brief.audience': 'Аудитория',
    'brief.audiencePlaceholder': 'Кому мы говорим',
    'brief.goal': 'Цель',
    'brief.goalPlaceholder': 'Что должен сделать бренд',
    'brief.character': 'Характер',
    'brief.characterPlaceholder': 'Три слова через запятую',
    'brief.required': 'Обязательное поле',
    'brief.nameError': 'Без названия не собрать брендбук. Впишите имя бренда.',
    'brief.sloganError': 'Добавьте слоган — он держит все макеты.',
    'brief.memoTitle': 'Так это выглядит на носителе',
    'brief.memoNote': 'Живой пример: обновляется на каждом нажатии клавиши.',
    'brief.characterEmpty': 'характер не задан',
    'brief.memoBrand': 'издательство визуальных новелл',

    'color.kicker': '02 · Цвет',
    'color.title': 'Четыре палитры, один бренд',
    'color.lead':
      'Каждая палитра привязана к новелле и задаёт настроение. Выбор меняет тему всего сайта, образцы и макеты — но не текст, который вы ввели.',
    'color.legend': 'Палитра бренда',
    'color.bg': 'Фон',
    'color.text': 'Текст',
    'color.button': 'Кнопка',
    'color.accent': 'Акцент',
    'color.accent2': 'Доп. акцент',
    'color.contrastText': 'Текст на фоне',
    'color.contrastButton': 'Текст на кнопке',
    'color.previewTitle': 'Заголовок в выбранной палитре',
    'color.previewBody':
      'Тёмная база, много воздуха и мягкое свечение вместо тяжёлых эффектов. Цвет работает вместе с подписями, а не вместо них.',
    'color.previewButton': 'Кнопка',
    'color.selected': 'Выбрано',
    'color.select': 'Выбрать',
    'color.selectedPalette': 'Выбранная палитра',
    'color.badge': '{ratio}:1',
    'color.note':
      'Палитры проверены на читаемость: основной текст и текст на кнопках не ниже 4.5:1. Для кнопок цвет подписи подбирается автоматически — тёмный #0B0B10 или светлый, что даёт лучший контраст.',

    'theme.mascotLabel': 'Тема карточки',
    'theme.editorLabel': 'Тема предпросмотра',
    'theme.layoutsLabel': 'Тема макетов',
    'theme.commitLabel': 'Тема для PDF',
    'theme.hintPreview':
      'Меняет только предпросмотр: основной вид сайта и карусель остаются как есть. Финальную тему выбирайте в блоке «Итог».',
    'theme.hintCommit':
      'Выбор фиксирует тему для печати: карусель больше не переключает цвета. Нажмите «Авто», чтобы вернуть переключение.',
    'theme.fixedStatus': 'Тема зафиксирована: {palette}',
    'theme.autoStatus': 'Авто: тема следует за каруселью',
    'theme.auto': 'Авто',
    'theme.autoTitlePreview': 'Следовать теме сайта',
    'theme.autoTitleCommit': 'Вернуть авто-переключение темы',
    'theme.choosePreview': 'Показать тему {palette} в предпросмотре',
    'theme.chooseCommit': 'Зафиксировать тему {palette} для PDF',
    'theme.pickerAriaPreview': 'Тема предпросмотра',
    'theme.pickerAriaCommit': 'Тема для PDF',

    'typography.kicker': '03 · Типографика',
    'typography.title': 'Свет и буквы',
    'typography.lead':
      'Два шрифта с кириллицей и запасным стеком. Настройте образец и посмотрите, как он живёт в заголовке, абзаце, макетах и карточке.',
    'typography.previewText': 'Текст примера',
    'typography.previewPlaceholder': 'Даже в темноте история найдёт свет.',
    'typography.font': 'Шрифт',
    'typography.size': 'Размер',
    'typography.weight': 'Насыщенность',
    'typography.heading': 'Заголовок',
    'typography.body': 'Абзац',
    'typography.bodyText':
      'Пиксельная эстетика, тёмная атмосфера и отомэ-чувственность. Мы издаём истории с сильным эмоциональным ядром — от милых и тревожных до мрачных и психологических.',
    'typography.monoNote':
      'Техно-детали набираем IBM Plex Mono: подписи, метрики и служебные пометки.',
    'typography.values': '{size} px · {weight}',
    'typography.sizeAria': 'Размер шрифта в пикселях',
    'typography.weightAria': 'Насыщенность шрифта',
    'typography.applyNote':
      'Значения применяются к постеру, карточке соцсетей, цитате маскота и итоговому брендбуку.',

    'mascot.kicker': '04 · Маскот',
    'mascot.title': 'Пиксельное сердце',
    'mascot.lead':
      'Самостоятельный образ, собранный из слоёв head, body, outfit и accessory. Голова — пиксельное сердце, а одежду, аксессуар и цвета можно менять: карточка обновится мгновенно.',
    'mascot.caption': 'Маскот бренда',
    'mascot.cta': 'Создайте своего маскота',
    'mascot.sceneNote': 'Вариант новеллы: {novel}',
    'mascot.sceneFree': 'Свободный образ: {outfit}, {accessory}',
    'mascot.editorTitle': 'Редактор маскота',
    'mascot.editorLead':
      'Соберите образ и подпишите его. Цитата печатается выбранным шрифтом и цветами палитры.',
    'mascot.outfit': 'Одежда',
    'mascot.accessory': 'Аксессуар',
    'mascot.headColor': 'Цвет головы',
    'mascot.bodyColor': 'Цвет тела',
    'mascot.quote': 'Цитата на карточке',
    'mascot.quotePlaceholder': 'Короткая фраза для карточки',
    'mascot.cardCaption': 'Карточка маскота',
    'mascot.cardNote': 'Печатается отдельно от брендбука',
    'mascot.cardFooter': 'Учебный проект Pixel Heart',
    'mascot.layersNote':
      'Слои маскота: assets/mascot/head.svg, body.svg, outfit-*.svg, accessory-*.svg. Свои PNG кладите по этим же путям.',
    'mascot.live': 'Маскот обновлён: {outfit}, {accessory}',
    'mascot.openAria': 'Открыть редактор маскота',
    'mascot.noQuote': 'Цитата появится здесь.',

    'layouts.kicker': '05 · Макеты',
    'layouts.title': 'Один бренд, два носителя',
    'layouts.lead':
      'Вертикальный постер и квадратная карточка для соцсетей. Композиция переключается сразу на обоих макетах и в итоговом брендбуке.',
    'layouts.composition': 'Композиция',
    'layouts.poster': 'Постер',
    'layouts.social': 'Карточка соцсетей',
    'layouts.posterMeta': '1080 × 1350 · вертикаль',
    'layouts.socialMeta': '1080 × 1080 · квадрат',
    'layouts.paletteMeta': 'Палитра: {palette}',
    'layouts.fontMeta': 'Шрифт: {font}',
    'layouts.mockupAria': 'Макет «{kind}»: {name}. Слоган: {slogan}. Палитра {palette}, шрифт {font}, композиция {layout}.',

    'final.kicker': '06 · Итог',
    'final.title': 'Брендбук на одну страницу',
    'final.lead':
      'Всё, что вы собрали: бриф, цвета, типографика, макеты и композиция. Печать даёт аккуратный PDF на A4.',
    'final.brief': 'Бриф',
    'final.colors': 'Цвета',
    'final.type': 'Типографика',
    'final.mockups': 'Макеты',
    'final.composition': 'Композиция',
    'final.name': 'Название',
    'final.slogan': 'Слоган',
    'final.audience': 'Аудитория',
    'final.goal': 'Цель',
    'final.character': 'Характер',
    'final.fontLabel': 'Шрифт',
    'final.sizeLabel': 'Размер',
    'final.weightLabel': 'Насыщенность',
    'final.paletteLabel': 'Палитра',
    'final.novelLabel': 'Активная новелла',
    'final.signature': 'Учебный проект Pixel Heart',
    'final.date': 'Собрано {date}',
    'final.printNote':
      'Печать: A4, поля 14 мм. Брендбук выходит на белом с сохранением акцентов, макеты и карточка печатаются в своих цветах.',
    'final.storageNote':
      'Настройки сохраняются только в этом браузере и не отправляются на сервер. В другом браузере будет своя версия.',
    'final.empty': 'не задано',
    'final.mood': 'Настроение',

    'footer.rights':
      'Doki Doki, Saya no Uta, 9 Rip и VA-11 HALL-A используются как учебная стилизация. Проект не выдаёт себя за официальные сайты игр. Изображения предоставлены командой для некоммерческого учебного проекта; права принадлежат правообладателям.',
    'footer.storage':
      'Без сервера и аккаунтов: черновик живёт в localStorage этого браузера. Очистка данных сайта удалит настройки.',
    'footer.made':
      'HTML, CSS и ванильный JavaScript с ES-модулями. Без сборщиков, фреймворков и внешних API.',

    'status.restored': 'Черновик восстановлен из этого браузера.',
    'status.corrupt':
      'Сохранённый черновик был повреждён — загружены демо-данные. Дальше сохранение работает как обычно.',
    'status.unavailable':
      'Хранилище недоступно: приватный режим или запрет cookies. Сайт работает, но настройки не сохранятся.',
    'status.quota':
      'Не удалось сохранить черновик: хранилище переполнено. Освободите место в браузере или нажмите «Сброс».',
    'status.reset': 'Демо-данные восстановлены, черновик удалён из этого браузера.',
    'status.savedAt': 'Сохранено {time}'
  },

  en: {
    'meta.title': 'Pixel Heart — a visual novel publisher brandbook study',
    'meta.description':
      'A Pixel Heart brandbook study: dark minimalism, pixel accents, four palettes and a mascot you can build yourself.',

    'brand.sub': 'study brandbook',
    'brand.logoAlt': 'Pixel Heart — back to top',

    'nav.aria': 'Brandbook sections',
    'nav.brief': 'Brief',
    'nav.color': 'Color',
    'nav.typography': 'Typography',
    'nav.mascot': 'Mascot',
    'nav.layouts': 'Layouts',
    'nav.final': 'Final',

    'actions.print': 'Print / PDF',
    'actions.printCard': 'Print card',
    'actions.reset': 'Reset',
    'actions.resetMascot': 'Reset mascot',
    'actions.close': 'Close',
    'actions.dismiss': 'Dismiss message',

    'lang.aria': 'Interface language',
    'a11y.skip': 'Skip to content',
    'a11y.newTab': 'opens in a new tab',

    'hero.aria': 'Novel carousel',
    'hero.kicker': 'Featured',
    'hero.headTitle': 'A visual novel publisher',
    'hero.headLead':
      'Dark minimalism, pixel accents and soft light. Four stories — one recognisable system.',
    'hero.prev': 'Previous slide',
    'hero.next': 'Next slide',
    'hero.dot': 'Slide {n}: {name}',
    'hero.live': 'Slide {n} of {total}: {name}',
    'hero.choose': 'Choose this theme',
    'hero.hint': 'Arrow keys ← → move through stories, Home and End jump to the edges. Hover or focus inside pauses autoplay.',
    'hero.placeholder': 'Key art is not added yet',
    'hero.placeholderPath': 'Drop your file here: {path}',
    'hero.imageAlt': 'Key art for {name}',

    'brief.kicker': '01 · Brief',
    'brief.title': 'What we put together',
    'brief.lead':
      'A brand system for a publisher that mixes pixel aesthetics, dark atmosphere and otome tenderness. Edit the fields — examples, layouts and the brandbook update instantly.',
    'brief.name': 'Name',
    'brief.namePlaceholder': 'Pixel Heart, for instance',
    'brief.slogan': 'Slogan',
    'brief.sloganPlaceholder': 'A short line that glows',
    'brief.audience': 'Audience',
    'brief.audiencePlaceholder': 'Who we are talking to',
    'brief.goal': 'Goal',
    'brief.goalPlaceholder': 'What the brand should achieve',
    'brief.character': 'Character',
    'brief.characterPlaceholder': 'Three words, comma separated',
    'brief.required': 'Required field',
    'brief.nameError': 'A brandbook needs a name. Add the brand name.',
    'brief.sloganError': 'Add a slogan — it holds every layout together.',
    'brief.memoTitle': 'How it looks on a layout',
    'brief.memoNote': 'A live example: it updates on every keystroke.',
    'brief.characterEmpty': 'character not set',
    'brief.memoBrand': 'independent visual novel publisher',

    'color.kicker': '02 · Color',
    'color.title': 'Four palettes, one brand',
    'color.lead':
      'Each palette belongs to a novel and sets a mood. Choosing one re-themes the whole site, the samples and the layouts — but never your typed text.',
    'color.legend': 'Brand palette',
    'color.bg': 'Background',
    'color.text': 'Text',
    'color.button': 'Button',
    'color.accent': 'Accent',
    'color.accent2': 'Second accent',
    'color.contrastText': 'Text on background',
    'color.contrastButton': 'Text on button',
    'color.previewTitle': 'Heading in the selected palette',
    'color.previewBody':
      'A dark base, plenty of air and soft glow instead of heavy effects. Colour works alongside labels, not instead of them.',
    'color.previewButton': 'Button',
    'color.selected': 'Selected',
    'color.select': 'Select',
    'color.selectedPalette': 'Selected palette',
    'color.badge': '{ratio}:1',
    'color.note':
      'Palettes are checked for readability: body text and button labels stay at 4.5:1 or higher. Button labels pick dark #0B0B10 or light ink automatically, whichever contrasts better.',

    'theme.mascotLabel': 'Card theme',
    'theme.editorLabel': 'Preview theme',
    'theme.layoutsLabel': 'Layout theme',
    'theme.commitLabel': 'PDF theme',
    'theme.hintPreview':
      'Changes this preview only: the main site and carousel stay as they are. Pick the final theme in the Final block.',
    'theme.hintCommit':
      'Choosing a theme fixes it for print: the carousel no longer switches colours. Press “Auto” to bring switching back.',
    'theme.fixedStatus': 'Theme fixed: {palette}',
    'theme.autoStatus': 'Auto: the theme follows the carousel',
    'theme.auto': 'Auto',
    'theme.autoTitlePreview': 'Follow the site theme',
    'theme.autoTitleCommit': 'Return to auto theme switching',
    'theme.choosePreview': 'Preview the {palette} theme',
    'theme.chooseCommit': 'Fix the {palette} theme for PDF',
    'theme.pickerAriaPreview': 'Preview theme',
    'theme.pickerAriaCommit': 'PDF theme',

    'typography.kicker': '03 · Typography',
    'typography.title': 'Light and letters',
    'typography.lead':
      'Two fonts with Cyrillic support and full fallback stacks. Tune the specimen and watch it live in a heading, a paragraph, the layouts and the card.',
    'typography.previewText': 'Preview text',
    'typography.previewPlaceholder': 'Even in the dark, a story finds the light.',
    'typography.font': 'Font',
    'typography.size': 'Size',
    'typography.weight': 'Weight',
    'typography.heading': 'Heading',
    'typography.body': 'Paragraph',
    'typography.bodyText':
      'Pixel aesthetics, dark atmosphere and otome tenderness. We publish stories with a strong emotional core — from sweet and unsettling to bleak and psychological.',
    'typography.monoNote':
      'Tech details are set in IBM Plex Mono: labels, metrics and service notes.',
    'typography.values': '{size} px · {weight}',
    'typography.sizeAria': 'Font size in pixels',
    'typography.weightAria': 'Font weight',
    'typography.applyNote':
      'The values apply to the poster, the social card, the mascot quote and the final brandbook.',

    'mascot.kicker': '04 · Mascot',
    'mascot.title': 'A pixel heart',
    'mascot.lead':
      'An original character built from head, body, outfit and accessory layers. The head is a pixel heart, and clothes, accessory and colours are yours to change — the card follows instantly.',
    'mascot.caption': 'Brand mascot',
    'mascot.cta': 'Create your mascot',
    'mascot.sceneNote': 'Novel variant: {novel}',
    'mascot.sceneFree': 'Free-form look: {outfit}, {accessory}',
    'mascot.editorTitle': 'Mascot editor',
    'mascot.editorLead':
      'Build the look and give it a line. The quote is set in the chosen font and palette colours.',
    'mascot.outfit': 'Outfit',
    'mascot.accessory': 'Accessory',
    'mascot.headColor': 'Head color',
    'mascot.bodyColor': 'Body color',
    'mascot.quote': 'Card quote',
    'mascot.quotePlaceholder': 'A short line for the card',
    'mascot.cardCaption': 'Mascot card',
    'mascot.cardNote': 'Prints on its own, apart from the brandbook',
    'mascot.cardFooter': 'Pixel Heart study project',
    'mascot.layersNote':
      'Mascot layers: assets/mascot/head.svg, body.svg, outfit-*.svg, accessory-*.svg. Put your PNGs in the same paths.',
    'mascot.live': 'Mascot updated: {outfit}, {accessory}',
    'mascot.openAria': 'Open the mascot editor',
    'mascot.noQuote': 'The quote will appear here.',

    'layouts.kicker': '05 · Layouts',
    'layouts.title': 'One brand, two formats',
    'layouts.lead':
      'A vertical poster and a square social card. The composition switch is visible on both layouts and in the final brandbook at once.',
    'layouts.composition': 'Composition',
    'layouts.poster': 'Poster',
    'layouts.social': 'Social card',
    'layouts.posterMeta': '1080 × 1350 · portrait',
    'layouts.socialMeta': '1080 × 1080 · square',
    'layouts.paletteMeta': 'Palette: {palette}',
    'layouts.fontMeta': 'Font: {font}',
    'layouts.mockupAria': '“{kind}” layout: {name}. Slogan: {slogan}. Palette {palette}, font {font}, composition {layout}.',

    'final.kicker': '06 · Final',
    'final.title': 'The brandbook on one page',
    'final.lead':
      'Everything you built: brief, colours, typography, layouts and composition. Printing gives a clean A4 PDF.',
    'final.brief': 'Brief',
    'final.colors': 'Colors',
    'final.type': 'Typography',
    'final.mockups': 'Layouts',
    'final.composition': 'Composition',
    'final.name': 'Name',
    'final.slogan': 'Slogan',
    'final.audience': 'Audience',
    'final.goal': 'Goal',
    'final.character': 'Character',
    'final.fontLabel': 'Font',
    'final.sizeLabel': 'Size',
    'final.weightLabel': 'Weight',
    'final.paletteLabel': 'Palette',
    'final.novelLabel': 'Active novel',
    'final.signature': 'Pixel Heart study project',
    'final.date': 'Compiled {date}',
    'final.printNote':
      'Print: A4, 14 mm margins. The brandbook prints on white while keeping accents; layouts and the card keep their own colours.',
    'final.storageNote':
      'Settings are stored in this browser only and are never sent to a server. Another browser gets its own version.',
    'final.empty': 'not set',
    'final.mood': 'Mood',

    'footer.rights':
      'Doki Doki, Saya no Uta, 9 Rip and VA-11 HALL-A are used as a study stylisation. This project does not pose as the official websites of those games. Images were provided by the team for a non-commercial study project; rights belong to their respective owners.',
    'footer.storage':
      'No server and no accounts: the draft lives in this browser’s localStorage. Clearing site data deletes the settings.',
    'footer.made':
      'HTML, CSS and vanilla JavaScript with ES modules. No bundlers, frameworks or external APIs.',

    'status.restored': 'Draft restored from this browser.',
    'status.corrupt':
      'The saved draft was corrupted, so demo data was loaded. Saving keeps working from here.',
    'status.unavailable':
      'Storage is unavailable: private mode or blocked cookies. The site works, but settings will not be saved.',
    'status.quota':
      'Could not save the draft: storage is full. Free some space in the browser or press “Reset”.',
    'status.reset': 'Demo data restored, the draft was removed from this browser.',
    'status.savedAt': 'Saved {time}'
  }
};

# Слои маскота Pixel Heart

Маскот на сайте — **inline SVG** из `js/mascot.js`. Он собран из четырёх групп,
и команда может заменить вектор растром, сохранив ту же структуру слоёв.

## Как устроен маскот в коде

| Слой | Что это | Цвет / вариант |
| --- | --- | --- |
| `data-part="body"` | тело, руки, ноги, ступни | `--mascot-body` (input `type="color"`) |
| `data-part="outfit"` | одежда поверх тела | зависит от `outfitId`: `doki`, `saya`, `nine`, `va11` |
| `data-part="head"` | голова, уши, глаза, рот, румянец | `--mascot-head` (input `type="color"`), румянец — `--theme-accent` |
| `data-part="accessory"` | аксессуар поверх головы | зависит от `accessoryId`: `none`, `doki`, `saya`, `nine`, `va11` |

Порядок отрисовки: `body` → `outfit` → `head` → `accessory`.

## Точные пути для своих файлов (PNG)

Если команда рисует маскота в растре, нужны **отдельные PNG с прозрачностью**,
все — 1024 × 1088 px (это viewBox 32 × 34, умноженный на 32), с одинаковым
положением персонажа в кадре, чтобы слои совпадали:

```
assets/mascot/head.png
assets/mascot/body.png
assets/mascot/outfit-doki.png
assets/mascot/outfit-saya.png
assets/mascot/outfit-nine.png
assets/mascot/outfit-va11.png
assets/mascot/accessory-none.png      (пустой прозрачный файл, для полноты набора)
assets/mascot/accessory-doki.png
assets/mascot/accessory-saya.png
assets/mascot/accessory-nine.png
assets/mascot/accessory-va11.png
```

Требования к слоям:

- единый холст и единая точка привязки — например, ступни на линии `y = 1024`;
- одежда рисуется без головы, голова — без одежды и аксессуара;
- аксессуар не должен включать части головы;
- цвет головы и тела на сайте задаётся CSS-переменными, поэтому PNG-слои
  головы и тела лучше делать в нейтральном светлом цвете (или заменить их
  SVG-группами, как сейчас).

## Что менять в коде

1. `js/mascot.js` → объекты `OUTFIT_PARTS`, `ACCESSORY_PARTS`, константы `HEAD`, `BODY`.
2. Если PNG: заменить `<rect>`-группы на `<image href="assets/mascot/head.png" width="32" height="34" />`
   внутри тех же `data-part`-групп.
3. Список вариантов и подписи — в `js/data.js` (`OUTFITS`, `ACCESSORIES`).
4. Размеры на сцене и карточке — в `css/mascot.css`.

Маскот самостоятельный: это не копия персонажей Doki Doki, Saya no Uta,
9 Rip или VA-11 HALL-A, а собственный пиксельный образ бренда.

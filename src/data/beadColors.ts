import type { BeadColor, Brand, ColorFamily } from '../types';
import { classifyFamily, hexToRgb, rgbToLab } from '../lib/color';

type RawColor = [code: string, name: string, hex: string, family?: ColorFamily];

/**
 * Perler (standard 5mm) colour approximations. Hex values are calibrated
 * against photographed bead samples; actual bead colours vary by batch.
 */
const PERLER: RawColor[] = [
  ['P01', 'White', '#F1F1F1'],
  ['P02', 'Cream', '#E0DEA9'],
  ['P03', 'Yellow', '#ECD800'],
  ['P04', 'Orange', '#ED6120'],
  ['P05', 'Red', '#BF2633'],
  ['P06', 'Bubblegum', '#DD6698'],
  ['P07', 'Purple', '#604089'],
  ['P08', 'Dark Blue', '#2B3F87'],
  ['P09', 'Light Blue', '#3370C0'],
  ['P10', 'Dark Green', '#1C753E'],
  ['P11', 'Light Green', '#56BA9F'],
  ['P12', 'Brown', '#513931', 'Browns'],
  ['P17', 'Grey', '#8A8D91'],
  ['P18', 'Black', '#2E2F32'],
  ['P20', 'Rust', '#8C372C', 'Browns'],
  ['P21', 'Light Brown', '#815D34', 'Browns'],
  ['P33', 'Peach', '#EEBAB2', 'Pinks'],
  ['P35', 'Tan', '#BC9371', 'Browns'],
  ['P38', 'Magenta', '#F22B88', 'Pinks'],
  ['P52', 'Pastel Blue', '#6497DA'],
  ['P53', 'Pastel Green', '#76C882'],
  ['P54', 'Pastel Lavender', '#8A72C1'],
  ['P56', 'Pastel Yellow', '#FEF68A'],
  ['P57', 'Cheddar', '#F1AA0C', 'Oranges'],
  ['P58', 'Toothpaste', '#93C8D4'],
  ['P59', 'Hot Coral', '#FF3B50', 'Reds'],
  ['P60', 'Plum', '#A24B9C'],
  ['P61', 'Kiwi Lime', '#6CBE13'],
  ['P62', 'Turquoise', '#2B89C6'],
  ['P63', 'Blush', '#FF8987', 'Pinks'],
  ['P70', 'Periwinkle', '#6F82C8'],
  ['P79', 'Light Pink', '#F6BBD5', 'Pinks'],
  ['P80', 'Bright Green', '#4FAE4C'],
  ['P83', 'Pink', '#E8508E', 'Pinks'],
  ['P88', 'Raspberry', '#A9315F', 'Reds'],
  ['P90', 'Butterscotch', '#CF8F3C', 'Oranges'],
  ['P91', 'Parrot Green', '#068E9F', 'Blues'],
  ['P92', 'Dark Grey', '#4D5156'],
  ['P93', 'Blueberry Cream', '#8AA1E0'],
  ['P96', 'Cranapple', '#7E2B39', 'Reds'],
  ['P97', 'Prickly Pear', '#BEDB51'],
  ['P98', 'Sand', '#E4CEB0', 'Neutrals'],
  ['P101', 'Fern', '#3E8E5A'],
  ['P102', 'Mist', '#B9C7C8', 'Neutrals'],
  ['P103', 'Forest', '#235342'],
  ['P104', 'Cobalt', '#1C5BA8'],
  ['P105', 'Midnight', '#1F2A55'],
  ['P106', 'Light Grey', '#C2C4C6'],
  ['P107', 'Spice', '#B65F2E', 'Oranges'],
  ['P108', 'Clay', '#C2725A', 'Browns'],
  ['P109', 'Mulberry', '#7B3765', 'Purples'],
  ['P110', 'Orchid', '#D78ED2', 'Purples'],
  ['P111', 'Sky', '#7FCDEE'],
  ['P112', 'Robin’s Egg', '#ADE1E1'],
  ['P113', 'Mint', '#A8E6C2'],
  ['P114', 'Lemon', '#F7E443'],
  ['P115', 'Apricot', '#F6A35B', 'Oranges'],
  ['P116', 'Salmon', '#F57E6B', 'Oranges'],
  ['P117', 'Toasted Marshmallow', '#F1DECF', 'Neutrals'],
  ['P118', 'Gold', '#C99B33', 'Yellows'],
  ['P119', 'Olive', '#7B7C2E', 'Greens'],
  ['P120', 'Eggplant', '#3E2558', 'Purples'],
  ['P121', 'Lilac', '#C3B1E1', 'Purples'],
  ['P122', 'Cocoa', '#6E4B3A', 'Browns'],
  ['P123', 'Charcoal', '#3A3B3F'],
];

/** Hama Midi (5mm) colour approximations. */
const HAMA: RawColor[] = [
  ['H01', 'White', '#ECEDED'],
  ['H02', 'Cream', '#F0E8B9'],
  ['H03', 'Yellow', '#F0B901'],
  ['H04', 'Orange', '#E64F27', 'Oranges'],
  ['H05', 'Red', '#B63136'],
  ['H06', 'Pink', '#E1889F', 'Pinks'],
  ['H07', 'Purple', '#694A82'],
  ['H08', 'Blue', '#2C4690'],
  ['H09', 'Light Blue', '#305CB0'],
  ['H10', 'Green', '#256D47'],
  ['H11', 'Light Green', '#49AE89'],
  ['H12', 'Brown', '#534137', 'Browns'],
  ['H13', 'Transparent Red', '#BB4C48', 'Reds'],
  ['H17', 'Grey', '#83888A'],
  ['H18', 'Black', '#2E2F31'],
  ['H20', 'Reddish Brown', '#7F332A', 'Browns'],
  ['H21', 'Light Brown', '#A5693F', 'Browns'],
  ['H22', 'Dark Red', '#A02C34', 'Reds'],
  ['H26', 'Flesh', '#DE9B90', 'Pinks'],
  ['H27', 'Beige', '#DEB48B', 'Browns'],
  ['H28', 'Dark Green', '#363F38'],
  ['H29', 'Claret', '#B9395E', 'Reds'],
  ['H30', 'Burgundy', '#682137', 'Reds'],
  ['H31', 'Turquoise', '#6997AF'],
  ['H32', 'Neon Fuchsia', '#E83E8A', 'Pinks'],
  ['H33', 'Cherry', '#C62B41', 'Reds'],
  ['H43', 'Pastel Yellow', '#F4EE8F'],
  ['H44', 'Pastel Red', '#F2846C', 'Pinks'],
  ['H45', 'Pastel Purple', '#9884BC'],
  ['H46', 'Pastel Blue', '#73A5D9'],
  ['H47', 'Pastel Green', '#90D1A0'],
  ['H48', 'Pastel Pink', '#D58BBB', 'Pinks'],
  ['H49', 'Azure', '#43A3C9'],
  ['H60', 'Teddy Bear Brown', '#B48434', 'Browns'],
  ['H70', 'Light Grey', '#BEC0BD'],
  ['H71', 'Dark Grey', '#545556'],
  ['H75', 'Tan', '#B5917B', 'Browns'],
  ['H76', 'Nougat', '#8F6950', 'Browns'],
  ['H77', 'Mint', '#BCE5D3'],
  ['H78', 'Pastel Rose', '#F2C1C6', 'Pinks'],
  ['H79', 'Apricot', '#F2A87A', 'Oranges'],
  ['H82', 'Plum', '#8A3A70', 'Purples'],
  ['H83', 'Petrol', '#2E7C86', 'Blues'],
  ['H84', 'Olive', '#6E7243', 'Greens'],
  ['H96', 'Lilac', '#BBA4D1', 'Purples'],
  ['H97', 'Gold Ochre', '#D6A23A', 'Yellows'],
  ['H98', 'Sea Green', '#53B29E'],
  ['H102', 'Lime', '#A3C933'],
];

function build(raw: RawColor[], brand: Brand): BeadColor[] {
  return raw.map(([code, name, hex, family]) => {
    const rgb = hexToRgb(hex);
    return {
      id: code,
      code,
      name,
      hex: hex.toUpperCase(),
      brand,
      family: family ?? classifyFamily(rgb),
      rgb,
      lab: rgbToLab(rgb),
    };
  });
}

export const BEAD_COLORS: BeadColor[] = [...build(PERLER, 'Perler'), ...build(HAMA, 'Hama')];

export const BEAD_BY_ID: Map<string, BeadColor> = new Map(BEAD_COLORS.map((c) => [c.id, c]));

export const BRANDS: Brand[] = ['Perler', 'Hama'];

export const COLOR_FAMILIES: ColorFamily[] = [
  'Reds',
  'Oranges',
  'Yellows',
  'Greens',
  'Blues',
  'Purples',
  'Pinks',
  'Browns',
  'Neutrals',
];

export const FAMILY_SWATCH: Record<ColorFamily, string> = {
  Reds: '#DC2626',
  Oranges: '#F97316',
  Yellows: '#FACC15',
  Greens: '#22C55E',
  Blues: '#3B82F6',
  Purples: '#8B5CF6',
  Pinks: '#EC4899',
  Browns: '#92400E',
  Neutrals: '#9CA3AF',
};

/** The 24 colours most commonly found in starter kits. */
export const BASIC_24: Record<Brand, string[]> = {
  Perler: [
    'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11', 'P12',
    'P17', 'P18', 'P20', 'P21', 'P33', 'P35', 'P38', 'P53', 'P56', 'P57', 'P62', 'P83',
  ],
  Hama: [
    'H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10', 'H11', 'H12',
    'H17', 'H18', 'H20', 'H21', 'H22', 'H26', 'H27', 'H28', 'H43', 'H46', 'H47', 'H49',
  ],
};

export function colorsForBrand(brand: Brand): BeadColor[] {
  return BEAD_COLORS.filter((c) => c.brand === brand);
}

"""Build original vector cover art and the Windows icon; Pillow is optional build tooling."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / 'assets'
ROOT.mkdir(exist_ok=True)
palettes = [
    ('#172e2b', '#638063', '#bde09a', '#34583d', '#152e24', '#d0e4a4'),
    ('#282444', '#8b7aa6', '#ebc5ef', '#61517e', '#29223e', '#d9b5ef'),
    ('#502f2d', '#bf855b', '#ffd89b', '#9b5d44', '#4f3430', '#f8b56f'),
    ('#142e43', '#5c99b2', '#bde7ef', '#326781', '#15374d', '#a5e6e5'),
]
for index, (sky, haze, sun, mountain, foreground, light) in enumerate(palettes):
    details = [
        f'<ellipse cx="254" cy="170" rx="42" ry="70" fill="none" stroke="{light}" stroke-width="10"/><ellipse cx="254" cy="170" rx="36" ry="64" fill="url(#portal)"/><path d="m246 227-30 73h115l-70-73Z" fill="{light}" opacity=".3"/>',
        f'<g transform="translate(236 110) rotate(20)"><rect x="-35" y="-35" width="70" height="70" fill="{light}" opacity=".85"/><path d="m-35 35 35 20 70-70-35-20Z" fill="{haze}"/><path d="m35-35 35 20v70L35 35Z" fill="{mountain}"/></g><ellipse cx="247" cy="215" rx="62" ry="12" stroke="{light}" opacity=".4"/>',
        f'<circle cx="260" cy="136" r="51" fill="{sun}"/><path d="m189 257 60-92 41 54 40-23 60 88Z" fill="{foreground}"/><path d="m249 165 41 54-44-18Z" fill="{haze}"/><path d="m249 165-60 92 57-56Z" fill="{light}" opacity=".65"/>',
        f'<ellipse cx="260" cy="145" rx="49" ry="68" stroke="{light}" stroke-width="2"/><ellipse cx="260" cy="145" rx="68" ry="22" stroke="{light}" opacity=".8" transform="rotate(-30 260 145)"/><circle cx="260" cy="145" r="30" fill="{light}" opacity=".8"/><circle cx="250" cy="135" r="8" fill="{sun}" opacity=".6"/>',
    ][index]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300"><defs><linearGradient id="sky" x2=".8" y2="1"><stop stop-color="{sky}"/><stop offset="1" stop-color="{haze}"/></linearGradient><radialGradient id="glow"><stop stop-color="{light}" stop-opacity=".25"/><stop offset="1" stop-color="{light}" stop-opacity="0"/></radialGradient><linearGradient id="portal" x2="0" y2="1"><stop stop-color="{sun}"/><stop offset="1" stop-color="{haze}"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h480v300H0z"/><ellipse cx="260" cy="130" rx="180" ry="170" fill="url(#glow)"/><circle cx="382" cy="55" r="17" fill="{sun}" opacity=".6"/><g fill="{sun}" opacity=".75"><circle cx="91" cy="61" r="1"/><circle cx="163" cy="38" r="1.3"/><circle cx="324" cy="89" r="1"/><path d="m354 129 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"/></g><path d="m0 220 82-99 81 77 59-104 115 117 76-63 67 57v95H0Z" fill="{mountain}" opacity=".6"/><path d="m0 264 98-64 84 57 65-54 97 55 80-49 56 26v65H0Z" fill="{foreground}" opacity=".8"/>{details}<path d="M0 270q98-48 160 2t180 13l140-44v59H0Z" fill="{foreground}"/><path d="m70 272 27-43 35 14 13 38Z" fill="{mountain}"/><path d="m97 229 35 14-35 18-27 11Z" fill="{haze}"/><path d="m373 280 19-39 25 10 13 36Z" fill="{mountain}"/><g fill="{light}" opacity=".5"><circle cx="181" cy="207" r="1"/><circle cx="312" cy="238" r="1.5"/></g></svg>'''
    (ROOT / f'world-{index}.svg').write_text(svg, encoding='utf-8')

image = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((8, 8, 248, 248), radius=57, fill='#151e1b', outline='#2f4634', width=3)
draw.polygon([(128, 40), (151, 105), (216, 128), (151, 151), (128, 216), (105, 151), (40, 128), (105, 105)], fill='#b9f87b')
draw.polygon([(128, 94), (162, 128), (128, 162), (94, 128)], fill='#1d3023')
image.save(ROOT / 'icon.png')
image.save(ROOT / 'icon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

"""Package the game into one portable HTML document. No build dependencies."""
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent


def build():
    html = (ROOT / 'index.html').read_text()
    css = (ROOT / 'style.css').read_text()
    # Use system fonts in the portable version so it never requires a network.
    css = '\n'.join(line for line in css.splitlines() if not line.startswith('@import'))
    html = html.replace('  <link rel="manifest" href="manifest.webmanifest">\n', '')
    html = html.replace('href="icon.svg"', 'href="data:image/svg+xml,' + quote((ROOT / 'icon.svg').read_text(), safe='') + '"')
    html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
    html = html.replace('<script src="engine.js"></script>', '<script>window.CITY_ROUTE_PORTABLE=true;\n' + (ROOT / 'engine.js').read_text() + '\n</script>')
    html = html.replace('<script src="game.js"></script>', '<script>\n' + (ROOT / 'game.js').read_text() + '\n</script>')
    output = ROOT / 'Городской маршрут.html'
    output.write_text(html)
    return output


if __name__ == '__main__':
    print(build())

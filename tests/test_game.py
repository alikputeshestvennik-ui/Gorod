"""Run with Python 3 and Node.js or QuickJS (JS_RUNTIME overrides the executable)."""
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def javascript(sources):
    runtime = os.environ.get('JS_RUNTIME') or shutil.which('node') or shutil.which('qjs')
    if not runtime:
        raise RuntimeError('Install Node.js or QuickJS, or set JS_RUNTIME to its executable.')
    with tempfile.TemporaryDirectory() as folder:
        script = Path(folder) / 'test.js'
        script.write_text('\n'.join(sources))
        result = subprocess.run([runtime, str(script)], capture_output=True, text=True, timeout=30)
        if result.returncode:
            raise AssertionError(result.stdout + result.stderr)
        return result.stdout


class GameTests(unittest.TestCase):
    def test_simulation_and_full_chapter(self):
        output = javascript(['var window=globalThis;', (ROOT / 'engine.js').read_text(), (ROOT / 'tests/simulation.js').read_text()])
        self.assertIn('ALL SIMULATION TESTS PASSED', output)
        print(output.strip())

    def test_interface_and_canvas(self):
        output = javascript([(ROOT / 'tests/browser-stub.js').read_text(), (ROOT / 'engine.js').read_text(), (ROOT / 'game.js').read_text(), (ROOT / 'tests/interface.js').read_text()])
        self.assertIn('ALL INTERFACE TESTS PASSED', output)
        print(output.strip())

    def test_manifest_and_html_assets(self):
        class Assets(HTMLParser):
            def handle_starttag(self, tag, attrs):
                attrs = dict(attrs)
                for name in ('src', 'href'):
                    value = attrs.get(name, '')
                    if value and not value.startswith(('http', '#')):
                        if not (ROOT / value).exists():
                            raise AssertionError(f'Missing {value}')
        Assets().feed((ROOT / 'prototype-original.html').read_text())
        manifest = json.loads((ROOT / 'manifest.webmanifest').read_text())
        for icon in manifest['icons']:
            self.assertTrue((ROOT / icon['src']).is_file())
        self.assertEqual(manifest['display'], 'standalone')

    def test_portable_game(self):
        class Scripts(HTMLParser):
            def __init__(self):
                super().__init__()
                self.inside = False
                self.scripts = []

            def handle_starttag(self, tag, attrs):
                if tag == 'script':
                    if dict(attrs).get('src'):
                        raise AssertionError('Portable game has an external script')
                    self.inside = True

            def handle_endtag(self, tag):
                if tag == 'script':
                    self.inside = False

            def handle_data(self, data):
                if self.inside:
                    self.scripts.append(data)

        html = (ROOT / 'Городской маршрут.html').read_text()
        self.assertNotIn('@import', html)
        self.assertNotIn('rel="stylesheet"', html)
        parser = Scripts()
        parser.feed(html)
        output = javascript([(ROOT / 'tests/browser-stub.js').read_text(), *parser.scripts, (ROOT / 'tests/interface.js').read_text()])
        self.assertIn('ALL INTERFACE TESTS PASSED', output)


if __name__ == '__main__':
    unittest.main()

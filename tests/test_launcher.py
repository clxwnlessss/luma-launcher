import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from launcher import Launcher, place_id, read_library, write_library


class LibraryTests(unittest.TestCase):
    def test_link_validation(self):
        self.assertEqual(place_id('https://www.roblox.com/games/123/Test?x=1'), '123')
        self.assertEqual(place_id(' 123 '), '123')
        for invalid in ['0', '-1', 'https://evil.test/games/123', 'https://roblox.com.evil.test/games/123', '123&command=x']:
            with self.assertRaises(ValueError):
                place_id(invalid)

    def test_round_trip_and_corruption(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'library.json'
            self.assertEqual(read_library(path), {'games': [], 'history': []})
            data = {'games': [{'name': 'Мій світ', 'id': '123'}], 'history': []}
            write_library(data, path)
            self.assertEqual(read_library(path), data)
            path.write_text('broken', encoding='utf-8')
            with self.assertRaises(ValueError):
                read_library(path)
            self.assertEqual(path.read_text(), 'broken')

    def test_ui_smoke(self):
        with patch('launcher.read_library', return_value={'games': [{'name': 'Тест', 'id': '123'}], 'history': []}):
            app = Launcher()
            try:
                app.update()
                app.query.set('неіснуюча')
                app.update()
                app.navigate('history')
                app.update()
                app.navigate('about')
                app.update()
                app.add_dialog()
                app.update()
            finally:
                app.destroy()


if __name__ == '__main__':
    unittest.main()

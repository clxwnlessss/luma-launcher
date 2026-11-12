"""Luma Launcher — a small, independent Roblox library for Windows."""
import json
import ctypes
import os
import re
import tempfile
import tkinter as tk
import webbrowser
from datetime import datetime
from pathlib import Path
from tkinter import messagebox
from urllib.parse import urlparse

BG, PANEL, CARD, TEXT, MUTED, ACCENT = '#10141d', '#171d29', '#202938', '#edf3fa', '#94a3b8', '#89efcb'
DATA = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'LumaLauncher' / 'library.json'


def place_id(value):
    value = value.strip()
    if re.fullmatch(r'[1-9][0-9]{0,19}', value):
        return value
    url = urlparse(value)
    if url.scheme == 'https' and url.hostname in ('roblox.com', 'www.roblox.com'):
        match = re.match(r'^/games/([1-9][0-9]{0,19})(?:/|$)', url.path)
        if match:
            return match[1]
    raise ValueError('Введіть числовий Place ID або https://www.roblox.com/games/ID/…')


def read_library(path=DATA):
    if not path.exists():
        return {'games': [], 'history': []}
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or not isinstance(data.get('games'), list) or not isinstance(data.get('history'), list):
        raise ValueError('Невірний формат бібліотеки')
    for item in data['games'] + data['history']:
        if not isinstance(item, dict) or not isinstance(item.get('name'), str):
            raise ValueError('Невірний запис бібліотеки')
        place_id(item.get('id', ''))
    return data


def write_library(data, path=DATA):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as file:
            temporary = file.name
            json.dump(data, file, ensure_ascii=False, indent=2)
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


class Launcher(tk.Tk):
    def __init__(self):
        if os.name == 'nt':
            ctypes.windll.user32.SetProcessDPIAware()
        super().__init__()
        self.tk.call('tk', 'scaling', 1.33)
        self.title('Luma Launcher')
        self.geometry('1060x720')
        self.minsize(820, 580)
        self.configure(bg=BG)
        self.option_add('*Font', ('Segoe UI', 11))
        self.view = 'library'
        self.query = tk.StringVar()
        self.status = tk.StringVar(value='Готовий до наступної пригоди')
        self.storage_ok = True
        try:
            self.data = read_library()
        except (OSError, ValueError, TypeError, AttributeError) as error:
            self.data = {'games': [], 'history': []}
            self.storage_ok = False
            messagebox.showerror('Не вдалося прочитати бібліотеку', f'{error}\n\nФайл збережено без змін:\n{DATA}\nВиправте або перейменуйте його та перезапустіть Luma.')
        self.build()
        self.query.trace_add('write', lambda *_: self.render())
        self.render()

    def label(self, parent, text, size=11, color=TEXT, bg=None, **kw):
        return tk.Label(parent, text=text, font=('Segoe UI', size), fg=color, bg=bg or parent.cget('bg'), **kw)

    def button(self, parent, text, command, primary=False):
        return tk.Button(parent, text=text, command=command, bg=ACCENT if primary else CARD,
                         fg=BG if primary else TEXT, activebackground='#b5f9e1', activeforeground=BG,
                         relief='flat', bd=0, padx=18, pady=10, cursor='hand2')

    def build(self):
        sidebar = tk.Frame(self, bg=PANEL, width=210)
        sidebar.pack(side='left', fill='y')
        sidebar.pack_propagate(False)
        self.label(sidebar, '◈  LUMA', 24, ACCENT).pack(anchor='w', padx=24, pady=(32, 0))
        self.label(sidebar, 'ROBLOX LAUNCHER', 9, MUTED).pack(anchor='w', padx=26, pady=(4, 36))
        for title, view in [('Моя бібліотека', 'library'), ('Історія запусків', 'history'), ('Про Luma', 'about')]:
            self.button(sidebar, title, lambda v=view: self.navigate(v)).pack(fill='x', padx=16, pady=5)
        self.label(sidebar, 'Незалежний проєкт\nВерсія 0.1.0', 10, MUTED, justify='left').pack(side='bottom', anchor='w', padx=24, pady=24)
        main = tk.Frame(self, bg=BG)
        main.pack(side='left', fill='both', expand=True, padx=32, pady=28)
        top = tk.Frame(main, bg=BG)
        top.pack(fill='x')
        self.label(top, 'Твій простір для гри', 23).pack(side='left')
        self.button(top, '+ Додати гру', self.add_dialog, True).pack(side='right')
        hero = tk.Frame(main, bg=PANEL, padx=24, pady=22)
        hero.pack(fill='x', pady=24)
        self.label(hero, 'НАСТУПНА ПРИГОДА ПОЧИНАЄТЬСЯ ТУТ', 9, ACCENT).pack(anchor='w')
        self.label(hero, 'Менше пошуку. Більше гри.', 21).pack(anchor='w', pady=(8, 4))
        self.label(hero, 'Збережи улюблені світи та відкривай їх одним натисканням.', 10, MUTED).pack(anchor='w')
        self.search = tk.Entry(main, textvariable=self.query, bg=CARD, fg=TEXT, insertbackground=ACCENT,
                               relief='flat', font=('Segoe UI', 12))
        self.label(main, 'ПОШУК У БІБЛІОТЕЦІ', 9, MUTED).pack(anchor='w', pady=(0, 8))
        self.search.pack(fill='x', ipady=10)
        self.heading = self.label(main, '', 15)
        self.heading.pack(anchor='w', pady=(22, 12))
        container = tk.Frame(main, bg=BG)
        container.pack(fill='both', expand=True)
        self.canvas = tk.Canvas(container, bg=BG, highlightthickness=0)
        scroll = tk.Scrollbar(container, orient='vertical', command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=scroll.set)
        scroll.pack(side='right', fill='y')
        self.canvas.pack(side='left', fill='both', expand=True)
        self.rows = tk.Frame(self.canvas, bg=BG)
        self.window = self.canvas.create_window(0, 0, window=self.rows, anchor='nw')
        self.rows.bind('<Configure>', lambda _: self.canvas.configure(scrollregion=self.canvas.bbox('all')))
        self.canvas.bind('<Configure>', lambda e: self.canvas.itemconfigure(self.window, width=e.width))
        self.canvas.bind_all('<MouseWheel>', lambda e: self.canvas.yview_scroll(-int(e.delta / 120), 'units'))
        tk.Label(main, textvariable=self.status, bg=BG, fg=MUTED, anchor='w', font=('Segoe UI', 9)).pack(fill='x', pady=(16, 0))

    def navigate(self, view):
        self.view = view
        self.render()

    def persist(self):
        if not self.storage_ok:
            messagebox.showerror('Збереження недоступне', 'Спочатку виправте файл бібліотеки та перезапустіть Luma.')
            return False
        try:
            write_library(self.data)
            return True
        except OSError as error:
            messagebox.showerror('Помилка збереження', str(error))
            return False

    def render(self):
        for child in self.rows.winfo_children():
            child.destroy()
        if self.view == 'about':
            self.heading.configure(text='Знайомся, Luma')
            self.label(self.rows, 'Власна бібліотека. Швидкий запуск. Твій стиль.\n\nLuma відкриває встановлений Roblox через roblox://.\nВхід в акаунт відбувається у Roblox.\n\nБібліотека та історія зберігаються лише на цьому ПК.\nІсторія показує запити запуску, а не підтверджений вхід у гру.\n\nLuma не встановлює й не оновлює клієнт Roblox.\nНезалежний проєкт, не пов’язаний із Roblox Corporation.', 11, MUTED, justify='left', wraplength=560).pack(anchor='w')
            self.button(self.rows, 'Відкрити сайт Roblox', lambda: webbrowser.open('https://www.roblox.com/download')).pack(anchor='w', pady=20)
            return
        history = self.view == 'history'
        items = list(reversed(self.data['history'])) if history else self.data['games']
        query = self.query.get().strip().casefold()
        items = [g for g in items if query in g['name'].casefold() or query in g['id']]
        self.heading.configure(text=f'{"Історія запусків" if history else "Моя бібліотека"} · {len(items)}')
        if not items:
            self.label(self.rows, 'Нічого не знайдено' if query else ('Запуски з’являться тут.' if history else 'Тут житимуть твої улюблені світи.'), 15).pack(anchor='w', pady=(24, 8))
            if not history and not query:
                self.label(self.rows, 'Натисни «Додати гру» та встав посилання з Roblox.', 11, MUTED).pack(anchor='w')
        for game in items:
            row = tk.Frame(self.rows, bg=PANEL, padx=16, pady=14)
            row.pack(fill='x', pady=(0, 8))
            self.button(row, 'Грати  ↗', lambda g=game: self.launch(g), True).pack(side='right')
            if not history:
                self.button(row, '×', lambda g=game: self.remove(g)).pack(side='right', padx=8)
            text = tk.Frame(row, bg=PANEL)
            text.pack(side='left', fill='x', expand=True)
            self.label(text, game['name'], 13, wraplength=300, justify='left').pack(anchor='w')
            self.label(text, game.get('time', f"PLACE ID  {game['id']}"), 9, MUTED).pack(anchor='w', pady=(4, 0))
        self.canvas.yview_moveto(0)

    def add_dialog(self):
        dialog = tk.Toplevel(self)
        dialog.title('Додати світ • Luma')
        dialog.geometry('520x320')
        dialog.configure(bg=PANEL)
        dialog.resizable(False, False)
        dialog.transient(self)
        dialog.grab_set()
        fields = []
        for title in ['Назва гри', 'Посилання Roblox або Place ID']:
            self.label(dialog, title, 11).pack(anchor='w', padx=24, pady=(18, 8))
            field = tk.Entry(dialog, bg=CARD, fg=TEXT, insertbackground=ACCENT, relief='flat')
            field.pack(fill='x', padx=24, ipady=9)
            fields.append(field)

        def submit():
            try:
                name = fields[0].get().strip()
                if not name or len(name) > 80:
                    raise ValueError('Назва має містити від 1 до 80 символів.')
                identifier = place_id(fields[1].get())
                if any(g['id'] == identifier for g in self.data['games']):
                    raise ValueError('Ця гра вже є у бібліотеці.')
                game = {'name': name, 'id': identifier}
                self.data['games'].append(game)
                if not self.persist():
                    self.data['games'].remove(game)
                    return
                dialog.destroy()
                self.view = 'library'
                self.query.set('')
                self.render()
            except ValueError as error:
                messagebox.showerror('Перевірте дані', str(error), parent=dialog)

        self.button(dialog, 'Додати до бібліотеки', submit, True).pack(anchor='e', padx=24, pady=24)
        dialog.bind('<Return>', lambda _: submit())
        dialog.bind('<Escape>', lambda _: dialog.destroy())
        fields[0].focus_set()

    def remove(self, game):
        if messagebox.askyesno('Прибрати гру?', f'Прибрати «{game["name"]}» з бібліотеки?'):
            original = self.data['games'][:]
            self.data['games'].remove(game)
            if not self.persist():
                self.data['games'] = original
            self.render()

    def launch(self, game):
        try:
            os.startfile(f"roblox://placeId={place_id(game['id'])}")
        except (OSError, ValueError, AttributeError) as error:
            messagebox.showerror('Не вдалося відкрити Roblox', f'Перевірте, що Roblox встановлений.\n{error}')
            return
        original = self.data['history'][:]
        self.data['history'].append({'name': game['name'], 'id': game['id'], 'time': datetime.now().strftime('%d.%m.%Y · %H:%M')})
        self.data['history'] = self.data['history'][-200:]
        if not self.persist():
            self.data['history'] = original
        self.status.set(f'Запит запуску: {game["name"]}')
        self.render()


if __name__ == '__main__':
    Launcher().mainloop()

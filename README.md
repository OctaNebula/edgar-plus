# edgar-plus
Adds a multitude of QoL improvements to FER's Edgar evaluator.

Edgar+ improves on FER's code evaluation system, Edgar, by adding multiple different QoL features.

## Features

### Editor
 - Switches to a better open source code editor, Ace
 - Code autocomplete & better syntax highlighting, rainbow brackets
 - Inline error highlighting (C and Java compiler errors next to the right line)
 - Vim mode, themes, zoom
 - Ability to completely detach the code editor from the browser, enabling OS-native split screening
 - Hotkeys: F1 to paste & run your code, F5 / Ctrl+Enter to run, Ctrl+S to save, Shift+Alt+F to format
 - Code formatter that only ever changes whitespace (it refuses to touch code it can't format safely)
 - Code history: snapshots on every run, every 2 minutes of typing and before anything replaces your code, with diff and restore
 - Run status: shows whether the code in the editor is the code you last ran

### Code archive & cheat sheet (Ctrl+Shift+F)
 - Downloads everything you've ever submitted to Edgar (exam and lab answers including every version you ran, tutorial code, playground snippets) and lets you search it offline, right inside Edgar
 - Suggests similar past tasks from your archive when you open an exam question
 - Cheat sheet with 60+ C snippets that insert into the editor with the needed `#include`s, reference tables and a glossary, in Croatian or English
 - Save your own snippets and share them as JSON

### Exam helpers
 - Readable line-by-line diff of expected vs. your output under Edgar's test results
 - Time spent per question, plus warnings at 15 and 5 minutes left
 - Toggles to hide newline/space markings in Edgar's output and to hide the timer

Everything can be switched on/off from the Edgar+ sidebar (⚙️ in the editor toolbar). Switching Edgar+ off from the popup restores Edgar's original editor instantly, without a page reload.

## Building
Run `python3 packager.py` in this folder. It creates `../edgar-plus-chrome.zip` and `../edgar-plus-firefox.zip` (the Firefox build uses `manifest-firefox.json`).

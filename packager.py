"""Builds the Chrome and Firefox packages of Edgar+.

Usage (run from the EdgarPlus/ folder):
    python3 packager.py            -> ../edgar-plus-chrome.zip and ../edgar-plus-firefox.zip
    python3 packager.py chrome     -> only the Chrome package
    python3 packager.py firefox    -> only the Firefox package

The Firefox build uses manifest-firefox.json (in this folder, or ../manifest-firefox.json) as its manifest.json.
"""
import json
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SKIP_FILES = {'packager.py', 'manifest.json', 'manifest-firefox.json', 'README.md', 'LICENSE'}
SKIP_EXT = ('.zip', '.pyc')


def build(target):
    if target == 'chrome':
        manifest_path = os.path.join(HERE, 'manifest.json')
    else:
        manifest_path = os.path.join(HERE, 'manifest-firefox.json')
        if not os.path.exists(manifest_path):
            manifest_path = os.path.join(ROOT, 'manifest-firefox.json')
    with open(manifest_path, encoding='utf-8') as f:
        manifest = json.load(f)
    output_path = os.path.join(ROOT, f'edgar-plus-{target}.zip')
    print(f"Packaging {target} v{manifest['version']} to {output_path}...")
    count = 0
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipf.writestr('manifest.json', json.dumps(manifest, indent=2, ensure_ascii=False))
        for root, dirs, files in os.walk(HERE):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__']
            for file in files:
                rel_root = os.path.relpath(root, HERE)
                if rel_root == '.' and file in SKIP_FILES:
                    continue
                if file.endswith(SKIP_EXT) or file.startswith('.'):
                    continue
                filepath = os.path.join(root, file)
                zipf.write(filepath, os.path.relpath(filepath, HERE))
                count += 1
    print(f'  {count + 1} files. Done.')


if __name__ == '__main__':
    targets = sys.argv[1:] or ['chrome', 'firefox']
    for t in targets:
        if t not in ('chrome', 'firefox'):
            print(__doc__)
            sys.exit(1)
        build(t)

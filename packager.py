import zipfile
import os
import sys

if len(sys.argv) < 2:
    print("Usage: python3 packager.py <output_filename>")
    sys.exit(1)

output_filename = sys.argv[1]
output_path = os.path.join('..', output_filename)

print(f"Packaging to {output_path}...")

with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file == 'packager.py': continue
            if file.endswith('.zip'): continue
            if '.git' in root: continue
            
            filepath = os.path.join(root, file)
            arcname = os.path.relpath(filepath, '.')
            print(f"Adding {arcname}")
            zipf.write(filepath, arcname)

print("Done.")

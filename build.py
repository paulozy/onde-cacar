#!/usr/bin/env python3
"""Empacota o Onde Caçar para as lojas (mesma coisa que o build.ps1, para Linux e macOS).
   python3 build.py            usa a versão do manifest.json
   python3 build.py 2.1.0      muda a versão antes de empacotar"""
import json, os, sys, zipfile, copy
AQUI = os.path.dirname(os.path.abspath(__file__))
ID_FIREFOX = 'onde-cacar@ajudante-pokeidle'  # depois de publicar no Firefox, NUNCA mude este ID
os.chdir(AQUI)
m = json.load(open('manifest.json', encoding='utf-8'))
if len(sys.argv) > 1:
    m['version'] = sys.argv[1]
    json.dump(m, open('manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
v = m['version']
os.makedirs('dist', exist_ok=True)

def empacotar(destino, manifest):
    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
        for pasta in ('src', 'icons'):
            for raiz, _, arqs in os.walk(pasta):
                for a in sorted(arqs):
                    caminho = os.path.join(raiz, a)
                    z.write(caminho, caminho.replace(os.sep, '/'))
        z.write('LICENSE', 'LICENSE')
    print('  ' + destino)

chrome = copy.deepcopy(m); chrome.pop('browser_specific_settings', None)
firefox = copy.deepcopy(m)
firefox['browser_specific_settings'] = {'gecko': {'id': ID_FIREFOX, 'strict_min_version': '128.0', 'data_collection_permissions': {'required': ['none']}}}
print(f'Onde Caçar {v}')
empacotar(f'dist/onde-cacar-{v}-chrome-edge-opera.zip', chrome)
empacotar(f'dist/onde-cacar-{v}-firefox.zip', firefox)
print('Pronto.')

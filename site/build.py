import re, shutil, os
parts=['core.js','pinch.js','pidsim.js','loops.js','mc.js','mc_seed.js','data.js','streams_data.js','flowsheet.js','fdd_data.js','app.js']
js='\n'.join(open(p).read() for p in parts)
css=open('style.css').read()
html=open('index.src.html').read().replace('/*CSS*/',css).replace('/*JS*/',js)
os.makedirs('dist', exist_ok=True); open('dist/index.html','w').write(html); print('built', len(html)//1024, 'KB')

for d in ['fonts','art']:
    shutil.copytree(d, os.path.join('dist', d), dirs_exist_ok=True)
for f in ['pid_base.webp','pid_hi.webp']:
    if os.path.exists(f): shutil.copy(f, os.path.join('dist', f))

import re
parts=['core.js','pinch.js','pidsim.js','mc.js','mc_seed.js','data.js','streams_data.js','flowsheet.js','fdd_data.js','app.js']
js='\n'.join(open(p).read() for p in parts)
css=open('style.css').read()
html=open('index.src.html').read().replace('/*CSS*/',css).replace('/*JS*/',js)
open('../index.html' if __import__('os').path.exists('../code') else 'dist/index.html','w').write(html); print('built', len(html)//1024, 'KB')

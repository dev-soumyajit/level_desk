import json
from pathlib import Path
import pymupdf
from PIL import Image
path = next(Path('.').glob('*.pdf'))
doc = pymupdf.open(path)
page = doc[0]
tokens=[]
for block in page.get_text('dict')['blocks']:
    for line in block.get('lines', []):
        for span in line['spans']:
            # PDF.js uses baseline minus font size for its upper bound.
            x,baseline = span['origin']
            tokens.append(dict(text=span['text'],x=x,y=baseline-span['size'],width=span['bbox'][2]-span['bbox'][0],height=span['size']))
pix = page.get_pixmap(alpha=False)
im = Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
pixels=im.load()
left,top,right,bottom=pix.width,pix.height,-1,-1
rows=[]
for y in range(pix.height):
    dark=0
    for x in range(pix.width):
        v=min(pixels[x,y])
        if v<210:
            left=min(left,x);right=max(right,x);top=min(top,y);bottom=max(bottom,y)
        if v<100:dark+=1
    rows.append(dark)
Path('artifacts').mkdir(exist_ok=True)
Path('artifacts/sample-analysis.json').write_text(json.dumps(dict(tokens=tokens,width=page.rect.width,height=page.rect.height,scan=dict(bounds=dict(x=left,y=top,width=right-left+1,height=bottom-top+1),darkRows=rows))))
print('Sample geometry extracted for local regression check.')

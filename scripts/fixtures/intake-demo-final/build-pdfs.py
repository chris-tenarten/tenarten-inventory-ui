"""Local artifact generation only. Never connects to TenOps or Storage."""
import hashlib
import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfbase.pdfmetrics import stringWidth
import pymupdf
from PIL import Image, ImageOps, ImageDraw

manifest_path = Path('scripts/fixtures/intake-demo-final/manifest.json')
manifest = json.loads(manifest_path.read_text())
width, height = landscape(letter)
thumbs = []
for record in manifest['records']:
    attachment = record['attachment']
    target = Path(attachment['local_path'])
    target.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(target), pagesize=(width, height), invariant=1, pageCompression=1)
    pdf.setTitle(attachment['filename'])
    pdf.setAuthor('TenOps fictional demonstration fixture')
    label = attachment['label']
    size = min(34, (width - 100) / stringWidth(label, 'Helvetica-Bold', 1))
    pdf.setFont('Helvetica-Bold', size)
    pdf.drawCentredString(width / 2, height / 2 - size * 0.35, label)
    pdf.showPage()
    pdf.save()
    attachment['sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    attachment['byte_size'] = target.stat().st_size
    document = pymupdf.open(target)
    assert len(document) == 1
    assert document[0].get_text().strip() == label
    rendered = document[0].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5))
    png = Path('tmp/pdfs/intake-demo') / (target.stem + '.png')
    png.parent.mkdir(parents=True, exist_ok=True)
    rendered.save(png)
    thumb = Image.open(png).convert('RGB')
    thumb.thumbnail((594, 459))
    tile = Image.new('RGB', (614, 495), '#dce1e7')
    tile.paste(thumb, ((614-thumb.width)//2, 24))
    ImageDraw.Draw(tile).text((12, 4), target.name, fill='black')
    thumbs.append(tile)
contact = Image.new('RGB', (1228, 1980), '#dce1e7')
for i, tile in enumerate(thumbs):
    contact.paste(tile, ((i % 2)*614, (i//2)*495))
contact.save('tmp/pdfs/intake-demo/contact-sheet.png')
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
print('8 deterministic single-page PDFs: exact label-only text verified; rendered for visual inspection.')

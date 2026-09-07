import sys

try:
    import pypdf
    reader = pypdf.PdfReader(r'C:\Users\dddi1\.gemini\antigravity\brain\90c4763b-e313-423a-a9ca-056066cf2d30\.user_uploaded\media_1788072360573.pdf')
    print('Num pages:', len(reader.pages))
    text = '\n'.join([p.extract_text() for p in reader.pages if p.extract_text()])
    print('Total text length:', len(text))
    
    with open('extracted_pdf_spec.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Saved to extracted_pdf_spec.txt')
except Exception as e:
    print('Error:', e)
